import { createClient } from "@supabase/supabase-js";
import {
    CANVA_AUTHORIZE_URL,
    CANVA_SCOPES,
    canvaClientCreds,
    canvaRedirectUri,
    dropConnection,
    exchangeCode,
    legacyCanvaToken,
    pkceChallenge,
    randomToken,
    readConnection,
    saveConnection,
} from "../lib/canva.mts";
import { NOT_CONFIGURED, callerEmail, isTeamEmail, readAuthEnv } from "../lib/client-sources.mts";

/**
 * "Connect Canva" — the one-time OAuth handshake that gives the portal a Canva Connect API
 * token pair, and the status/disconnect controls beside it. Once connected, canva-import.mts
 * spends and refreshes the tokens on its own (see ../lib/canva.mts for why a static token
 * can't do this job).
 *
 * Two faces:
 *
 *   POST, JSON, team-only (Bearer = the AM's Supabase access token):
 *     { action: "status" }            → { configured, connected, connectedBy, connectedAt, expiresAt, redirectUri }
 *     { action: "start", returnTo }   → { url }   — the browser navigates there
 *     { action: "disconnect" }        → { ok: true }
 *
 *   GET — Canva's redirect back after the AM approves (or declines):
 *     ?code=…&state=…                 → exchanges the code, stores the pair, 302 → returnTo?canva=connected
 *     ?error=…&state=…                → 302 → returnTo?canva=error&reason=…
 *
 * The GET leg carries no Bearer (it is a browser navigation from canva.com), so its
 * authority comes from `state`: a random value this function minted for a verified team
 * member in `start`, stored with the PKCE verifier in canva_oauth_states, consumed exactly
 * once here. An unknown or reused state does nothing.
 *
 * Setup, once, in the Canva Developer Portal (https://www.canva.com/developers/integrations):
 * create an integration, add the scopes in CANVA_SCOPES, add the redirect URL
 * https://hgmportal.com/.netlify/functions/canva-auth, and put its client id / secret in
 * Netlify as CANVA_CLIENT_ID / CANVA_CLIENT_SECRET. Then press Connect Canva on any
 * Pinned Stories import panel.
 */

const STATE_TTL_MS = 10 * 60 * 1000;

const safeReturnTo = (raw: unknown): string => {
    const s = String(raw ?? "/").trim();
    // Same-origin paths only: must start with one slash, never two (protocol-relative).
    return /^\/(?!\/)[^\s]*$/.test(s) && s.length <= 300 ? s : "/";
};

/** Append ?canva=… before any #hash so the dashboard's section deep link survives. */
const withQuery = (path: string, params: Record<string, string>) => {
    const [base, hash] = path.split("#");
    const url = new URL(base, "https://placeholder.local");
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    return `${url.pathname}${url.search}${hash ? `#${hash}` : ""}`;
};

const redirect = (location: string) => new Response(null, { status: 302, headers: { Location: location, "Cache-Control": "no-store" } });

export default async (req: Request) => {
    const auth = readAuthEnv();
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!auth || !serviceKey) return Response.json({ error: NOT_CONFIGURED }, { status: 500 });
    const admin = createClient(auth.supabaseUrl, serviceKey);
    const creds = canvaClientCreds();
    const redirectUri = canvaRedirectUri();

    /* ── GET: Canva sends the AM back ── */
    if (req.method === "GET") {
        const url = new URL(req.url);
        const state = url.searchParams.get("state") ?? "";
        const { data: pending } = state ? await admin.from("canva_oauth_states").select("*").eq("state", state).maybeSingle() : { data: null };
        if (state) await admin.from("canva_oauth_states").delete().eq("state", state);
        const returnTo = safeReturnTo(pending?.return_to);

        if (!pending || Date.now() - new Date(pending.created_at).getTime() > STATE_TTL_MS) {
            return redirect(withQuery(returnTo, { canva: "error", reason: "That connection link had expired — press Connect Canva again." }));
        }
        const denied = url.searchParams.get("error");
        if (denied) return redirect(withQuery(returnTo, { canva: "error", reason: url.searchParams.get("error_description") || denied }));
        const code = url.searchParams.get("code");
        if (!code || !creds || !redirectUri) return redirect(withQuery(returnTo, { canva: "error", reason: "Canva didn't return a code." }));

        const tokens = await exchangeCode(creds, code, pending.code_verifier, redirectUri);
        if ("error" in tokens) return redirect(withQuery(returnTo, { canva: "error", reason: tokens.error }));
        const saved = await saveConnection(admin, tokens, String(pending.started_by ?? ""));
        return redirect(withQuery(returnTo, saved ? { canva: "connected" } : { canva: "error", reason: "Couldn't store the connection." }));
    }

    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

    /* ── POST: team-only controls ── */
    const email = await callerEmail(req, auth.supabaseUrl, auth.anonKey);
    if (!isTeamEmail(email)) return Response.json({ error: "Team sign-in required." }, { status: 401 });

    let body: Record<string, unknown>;
    try {
        body = (await req.json()) as Record<string, unknown>;
    } catch {
        return Response.json({ error: "Bad request." }, { status: 400 });
    }
    const action = String(body.action ?? "");

    if (action === "status") {
        const row = await readConnection(admin);
        return Response.json({
            configured: !!creds && !!redirectUri,
            redirectUri,
            connected: !!row || !!legacyCanvaToken(),
            connectedBy: row?.connected_by ?? (legacyCanvaToken() ? "environment variable" : ""),
            connectedAt: row?.connected_at ?? null,
            expiresAt: row?.expires_at ?? null,
        });
    }

    if (action === "start") {
        if (!creds || !redirectUri) {
            return Response.json(
                { error: "Canva isn't set up on the portal yet — CANVA_CLIENT_ID and CANVA_CLIENT_SECRET are missing in Netlify." },
                { status: 501 },
            );
        }
        // Prune handshakes nobody finished, then mint this one.
        await admin
            .from("canva_oauth_states")
            .delete()
            .lt("created_at", new Date(Date.now() - STATE_TTL_MS).toISOString());
        const state = randomToken(24);
        const verifier = randomToken(64);
        const { error } = await admin
            .from("canva_oauth_states")
            .insert({ state, code_verifier: verifier, started_by: email, return_to: safeReturnTo(body.returnTo) });
        if (error) return Response.json({ error: "Couldn't start the connection — is the canva_oauth_states table applied?" }, { status: 500 });

        const u = new URL(CANVA_AUTHORIZE_URL);
        u.searchParams.set("response_type", "code");
        u.searchParams.set("client_id", creds.id);
        u.searchParams.set("redirect_uri", redirectUri);
        u.searchParams.set("scope", CANVA_SCOPES.join(" "));
        u.searchParams.set("state", state);
        u.searchParams.set("code_challenge", await pkceChallenge(verifier));
        u.searchParams.set("code_challenge_method", "s256");
        return Response.json({ url: u.toString() });
    }

    if (action === "disconnect") {
        await dropConnection(admin);
        return Response.json({ ok: true });
    }

    return Response.json({ error: "Unknown action." }, { status: 400 });
};
