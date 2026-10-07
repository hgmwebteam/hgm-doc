import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The portal's Canva Connect API credentials — shared by canva-auth.mts (which obtains
 * them) and canva-import.mts (which spends them).
 *
 * Canva's OAuth 2.0 model, and why this file exists:
 *   • Access tokens live 4 hours.
 *   • Refresh tokens are single-use: every refresh returns a NEW refresh token and
 *     invalidates the old one.
 * So the pair must be stored where a server can both read and rewrite it, and every
 * caller must go through one place that refreshes-and-saves atomically enough that two
 * functions don't race to spend the same refresh token. That place is
 * `getCanvaAccessToken` below; nothing else reads canva_connection.
 *
 * Environment (Netlify UI → Environment variables, never netlify.toml):
 *   CANVA_CLIENT_ID / CANVA_CLIENT_SECRET — the integration registered in the Canva
 *     Developer Portal (https://www.canva.com/developers/integrations) with the scopes
 *     in CANVA_SCOPES and the redirect URL below added under Authentication.
 *   CANVA_REDIRECT_URI — optional override; defaults to `${URL}/.netlify/functions/canva-auth`
 *     where URL is Netlify's own primary-site variable (https://hgmportal.com). Canva
 *     requires an exact match, so a preview host needs its own registered URI.
 *   CANVA_ACCESS_TOKEN — legacy stop-gap, used only when nothing is connected AND no
 *     integration (client id/secret) is set up; see legacyCanvaToken.
 */

export const CANVA_API = "https://api.canva.com/rest/v1";
export const CANVA_AUTHORIZE_URL = "https://www.canva.com/api/oauth/authorize";
export const CANVA_TOKEN_URL = `${CANVA_API}/oauth/token`;
/** Reading a design's metadata and exporting its pages — nothing that writes to Canva. */
export const CANVA_SCOPES = ["design:meta:read", "design:content:read"];

const ROW_ID = "team";
/** Refresh this long before expiry so an export that takes a minute never straddles it. */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

export interface CanvaTokens {
    access_token: string;
    refresh_token: string;
    /** Seconds, from Canva (14400 = 4 h). */
    expires_in: number;
    scope?: string;
}

export const canvaClientCreds = (): { id: string; secret: string } | null => {
    const id = process.env.CANVA_CLIENT_ID;
    const secret = process.env.CANVA_CLIENT_SECRET;
    return id && secret ? { id, secret } : null;
};

export const canvaRedirectUri = (): string | null => {
    if (process.env.CANVA_REDIRECT_URI) return process.env.CANVA_REDIRECT_URI;
    const site = process.env.URL;
    return site ? `${site.replace(/\/$/, "")}/.netlify/functions/canva-auth` : null;
};

/* ── PKCE ─────────────────────────────────────────────────────────────────── */

const b64url = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export const randomToken = (bytes = 48) => b64url(crypto.getRandomValues(new Uint8Array(bytes)));

export const pkceChallenge = async (verifier: string) => b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));

/* ── Token endpoint ───────────────────────────────────────────────────────── */

const tokenRequest = async (creds: { id: string; secret: string }, form: Record<string, string>): Promise<CanvaTokens | { error: string }> => {
    const res = await fetch(CANVA_TOKEN_URL, {
        method: "POST",
        headers: {
            Authorization: `Basic ${Buffer.from(`${creds.id}:${creds.secret}`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(form).toString(),
    });
    const json = (await res.json().catch(() => ({}))) as Partial<CanvaTokens> & { error?: string; error_description?: string };
    if (!res.ok || !json.access_token || !json.refresh_token) {
        return { error: json.error_description || json.error || `Canva token request failed (${res.status})` };
    }
    return { access_token: json.access_token, refresh_token: json.refresh_token, expires_in: Number(json.expires_in ?? 14400), scope: json.scope };
};

export const exchangeCode = (creds: { id: string; secret: string }, code: string, codeVerifier: string, redirectUri: string) =>
    tokenRequest(creds, { grant_type: "authorization_code", code, code_verifier: codeVerifier, redirect_uri: redirectUri });

export const refreshTokens = (creds: { id: string; secret: string }, refreshToken: string) =>
    tokenRequest(creds, { grant_type: "refresh_token", refresh_token: refreshToken, scope: CANVA_SCOPES.join(" ") });

/* ── The stored connection ───────────────────────────────────────────────── */

export interface CanvaConnectionRow {
    id: string;
    access_token: string;
    refresh_token: string;
    expires_at: string;
    scope: string;
    connected_by: string;
    connected_at: string;
}

export const saveConnection = async (admin: SupabaseClient, tokens: CanvaTokens, connectedBy?: string) => {
    const now = new Date();
    const row: Record<string, unknown> = {
        id: ROW_ID,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: new Date(now.getTime() + tokens.expires_in * 1000).toISOString(),
        scope: tokens.scope ?? "",
        updated_at: now.toISOString(),
    };
    if (connectedBy !== undefined) {
        row.connected_by = connectedBy;
        row.connected_at = now.toISOString();
    }
    const { error } = await admin.from("canva_connection").upsert(row, { onConflict: "id" });
    return !error;
};

export const readConnection = async (admin: SupabaseClient): Promise<CanvaConnectionRow | null> => {
    const { data } = await admin.from("canva_connection").select("*").eq("id", ROW_ID).maybeSingle();
    return (data as CanvaConnectionRow | null) ?? null;
};

export const dropConnection = (admin: SupabaseClient) => admin.from("canva_connection").delete().eq("id", ROW_ID);

export type CanvaTokenResult = { token: string } | { error: "not_connected" | "refresh_failed"; detail?: string };

/**
 * Spend the stored refresh token now and save the new pair. A refresh Canva refuses (it
 * revoked the grant, the integration's secret changed) drops the row: the section then
 * shows "Connect Canva" again instead of failing every import with a dead token.
 */
export async function refreshConnection(admin: SupabaseClient, row: CanvaConnectionRow): Promise<CanvaTokenResult> {
    const creds = canvaClientCreds();
    if (!creds) return { error: "refresh_failed", detail: "CANVA_CLIENT_ID / CANVA_CLIENT_SECRET are not set, so the expired token can't be refreshed." };
    const refreshed = await refreshTokens(creds, row.refresh_token);
    if ("error" in refreshed) {
        await dropConnection(admin);
        return { error: "refresh_failed", detail: refreshed.error };
    }
    await saveConnection(admin, refreshed);
    return { token: refreshed.access_token };
}

/**
 * The legacy CANVA_ACCESS_TOKEN stop-gap counts only while no Canva integration is set up.
 * A pasted token dies within Canva's 4 hours, and while it was honoured alongside a real
 * integration it made the portal report "connected" forever — so Connect Canva never
 * showed and every import failed with "connect Canva again" and no way to do it.
 */
export const legacyCanvaToken = (): string | null => (canvaClientCreds() ? null : process.env.CANVA_ACCESS_TOKEN || null);

/** A usable access token, refreshed and re-saved when it is near expiry. */
export async function getCanvaAccessToken(admin: SupabaseClient): Promise<CanvaTokenResult> {
    const row = await readConnection(admin);
    if (!row) {
        const env = legacyCanvaToken();
        return env ? { token: env } : { error: "not_connected" };
    }
    if (new Date(row.expires_at).getTime() - Date.now() > REFRESH_MARGIN_MS) return { token: row.access_token };
    return refreshConnection(admin, row);
}

/**
 * Canva answered 401 to a token we believed was good (revoked early, or the clock row is
 * stale): refresh once and hand back the new token, or null — in which case the row is
 * gone and the caller should ask the AM to connect again.
 */
export async function recoverRejectedToken(admin: SupabaseClient): Promise<string | null> {
    const row = await readConnection(admin);
    if (!row) return null;
    const result = await refreshConnection(admin, row);
    return "token" in result ? result.token : null;
}
