import { createClient } from "@supabase/supabase-js";

/**
 * Saves a client's Website Setup Guide answers.
 *
 * Why a function (same reasoning as mark-booked.mts): the client reading their dashboard is
 * `anon` to Supabase — they cleared the app's own email/password gate, not Supabase auth —
 * and `anon` has no UPDATE grant on dashboard_pages. Granting it would let every visitor on
 * the internet rewrite any client's dashboard, so the browser asks this function instead,
 * which holds the service-role key and does the one narrow thing below.
 *
 * Deliberately narrow: it replaces `data.website_setup` and touches nothing else. The blob
 * is rebuilt field by field from an allowlist (unknown keys vanish, strings are trimmed and
 * capped, booleans are coerced), so the endpoint can never be steered into writing another
 * key. The worst a caller with a guessed slug can do is change a client's own setup
 * answers, none of which are secrets — the section never asks for a password or an API key,
 * and this row is readable with the anon key regardless.
 *
 * Identity: when the dashboard has an allowlist, the caller's email must be on it (read
 * fresh from the row, never trusted from the body). A dashboard with no allowlist is open by
 * URL today (see gateArmed in client-dashboard-page.tsx), so it accepts the write at the
 * same trust level as mark-booked. The section must also be shared with the client.
 *
 * Mirrors ACCOUNT_IDS and the caps in src/pages/client/dashboard/website-setup.ts — change
 * both together.
 */

const ACCOUNT_IDS = ["supabase", "resend", "stripe", "pms", "domain", "cloudflare"];
const MAX_SHORT = 200;
const MAX_NOTES = 2000;

const norm = (e: unknown) =>
    String(e ?? "")
        .trim()
        .toLowerCase();
const short = (v: unknown) =>
    String(v ?? "")
        .trim()
        .slice(0, MAX_SHORT);

export default async (req: Request) => {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
        return Response.json({ error: "Not configured — SUPABASE_SERVICE_ROLE_KEY is missing in Netlify." }, { status: 500 });
    }

    let body: Record<string, unknown>;
    try {
        body = await req.json();
    } catch {
        return Response.json({ error: "Bad request." }, { status: 400 });
    }

    const slug = String(body.slug ?? "").trim();
    const email = norm(body.email);
    const raw = body.setup;

    // Shape checks before touching the database: these slugs are always "{client}-dashboard".
    if (!slug || slug.length > 120 || !/^[a-z0-9-]+-dashboard$/.test(slug)) {
        return Response.json({ error: "Bad slug." }, { status: 400 });
    }
    if (email && (email.length > 200 || !email.includes("@"))) {
        return Response.json({ error: "Bad email." }, { status: 400 });
    }
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        return Response.json({ error: "Bad setup." }, { status: 400 });
    }
    const s = raw as Record<string, unknown>;

    // Rebuilt from scratch: nothing the browser sends is stored as-is.
    const aiRaw = String(s.ai_website ?? "");
    const rawAccounts = s.accounts && typeof s.accounts === "object" && !Array.isArray(s.accounts) ? (s.accounts as Record<string, unknown>) : {};
    const accounts: Record<string, { value: string; done: boolean }> = {};
    for (const id of ACCOUNT_IDS) {
        const a = rawAccounts[id];
        if (!a || typeof a !== "object") continue;
        const entry = { value: short((a as Record<string, unknown>).value), done: (a as Record<string, unknown>).done === true };
        if (entry.value || entry.done) accounts[id] = entry;
    }
    const setup = {
        netlify_email: short(s.netlify_email),
        netlify_password: short(s.netlify_password),
        ai_website: aiRaw === "yes" || aiRaw === "no" ? aiRaw : "",
        accounts,
        domain: short(s.domain),
        notes: String(s.notes ?? "")
            .trim()
            .slice(0, MAX_NOTES),
        updated_at: new Date().toISOString(),
    };

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    // Read-modify-write against the row as it is right now, rather than trusting anything the
    // browser sends. A client's stale copy of `data` must never overwrite a team member's edits.
    const { data: row, error: readErr } = await supabaseAdmin.from("dashboard_pages").select("data").eq("slug", slug).single();
    if (readErr || !row) return Response.json({ error: "Not found." }, { status: 404 });
    const data = (row.data ?? {}) as Record<string, unknown>;

    const allowed = Array.isArray(data.allowed_emails) ? (data.allowed_emails as unknown[]).map(norm).filter(Boolean) : [];
    if (allowed.length && !allowed.includes(email)) return Response.json({ error: "Not allowed." }, { status: 403 });

    // Answering requires the section to actually be shared with the client.
    const visible = Array.isArray(data.client_visible) ? (data.client_visible as unknown[]).includes("ownerguide") : true;
    if (!visible) return Response.json({ error: "Not allowed." }, { status: 403 });

    const { error: writeErr } = await supabaseAdmin
        .from("dashboard_pages")
        .update({ data: { ...data, website_setup: setup } })
        .eq("slug", slug);

    if (writeErr) {
        console.error("[website-setup] update failed", writeErr);
        return Response.json({ error: "Could not save." }, { status: 500 });
    }

    return Response.json({ ok: true, updated_at: setup.updated_at });
};
