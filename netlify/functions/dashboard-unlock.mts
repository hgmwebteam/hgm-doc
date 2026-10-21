import { createClient } from "@supabase/supabase-js";

/**
 * The client sign-in check for a password-gated dashboard (DashboardAccessGate).
 *
 * The passwords used to sit on the dashboard_pages row, which the public anon key can read,
 * and the browser compared them itself — so anyone could read every client's password. They
 * now live in dashboard_access_secrets (team-only, see 20261021120000_dashboard_access_secrets.sql)
 * and this function, holding the service key, is the only thing that compares them. It
 * answers yes or no and never returns a password.
 *
 * Same rule as before: the typed email picks the person on THIS dashboard's list, and that
 * person's own password must match, else the dashboard's shared one. Email is matched trimmed
 * and lower-cased; the password trimmed (a pasted trailing space was locking people out) but
 * case-sensitive.
 *
 * Until 20261021120100_dashboard_access_strip.sql runs, a row with no secrets copy falls back
 * to the plaintext still on dashboard_pages, so a dashboard created in that window still opens.
 *
 * POST, JSON: { slug, email, password } → { ok: true, email } | { ok: false }
 */

const norm = (e: unknown) =>
    String(e ?? "")
        .trim()
        .toLowerCase();

type ListedUser = { email?: unknown; password?: unknown };

/** dashboard_users when present, else the legacy allowed_emails — readDashboardUsers' rule. */
const listedUsers = (data: Record<string, unknown>): ListedUser[] => {
    if (data.dashboard_users !== undefined && data.dashboard_users !== null) {
        return Array.isArray(data.dashboard_users) ? (data.dashboard_users as ListedUser[]) : [];
    }
    return Array.isArray(data.allowed_emails) ? (data.allowed_emails as unknown[]).map((email) => ({ email })) : [];
};

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
    const password = String(body.password ?? "").trim();

    if (!slug || slug.length > 120 || !/^[a-z0-9-]+-dashboard$/.test(slug)) {
        return Response.json({ error: "Bad slug." }, { status: 400 });
    }
    // One answer for every miss, as the sign-in card always gave: saying "that email isn't on
    // the list" would let someone probe who a dashboard is shared with.
    if (!email || email.length > 200 || !password || password.length > 200) return Response.json({ ok: false });

    const admin = createClient(supabaseUrl, serviceKey);
    const [{ data: row, error: rowErr }, { data: secrets, error: secretsErr }] = await Promise.all([
        admin.from("dashboard_pages").select("data").eq("slug", slug).maybeSingle(),
        admin.from("dashboard_access_secrets").select("share_password, passwords").eq("slug", slug).maybeSingle(),
    ]);
    if (rowErr || secretsErr) return Response.json({ error: "Could not check right now. Try again in a moment." }, { status: 502 });
    if (!row) return Response.json({ ok: false });

    const data = (row.data ?? {}) as Record<string, unknown>;
    const me = listedUsers(data).find((u) => norm(u.email) === email);
    if (!me) return Response.json({ ok: false });

    let own: string;
    let shared: string;
    if (secrets) {
        const map = (secrets.passwords ?? {}) as Record<string, unknown>;
        own = String(map[email] ?? "").trim();
        shared = String(secrets.share_password ?? "").trim();
    } else {
        own = String(me.password ?? "").trim();
        shared = String(data.share_password ?? "").trim();
    }
    const expected = own || shared;
    // `expected` is checked for emptiness too: a person with no password on a dashboard with no
    // shared one must not be let in by an empty string (already refused above, kept explicit).
    if (!expected || password !== expected) return Response.json({ ok: false });

    return Response.json({ ok: true, email });
};
