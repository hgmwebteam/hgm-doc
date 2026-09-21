import { createClient } from "@supabase/supabase-js";

/**
 * Suggestion mode for the Master Brand Document.
 *
 * Why a function (same reasoning as mark-booked.mts): the client reading their dashboard
 * is `anon` to Supabase — they cleared the app's own email/password gate, not Supabase
 * auth — and `anon` has no grants at all on dashboard_suggestions. Granting anon INSERT
 * would let every unauthenticated visitor on the internet flood the table, so instead the
 * browser asks this function, which holds the service-role key and validates on every
 * call that the caller's email is on THAT dashboard's allowed_emails list.
 *
 * Deliberately quarantined: this function only ever touches dashboard_suggestions. It
 * never writes dashboard_pages — a suggestion becomes document content only when an AM
 * presses Accept and saves through the dashboard's own (authenticated, conflict-guarded)
 * save path. So the worst a caller with a stolen email + slug pair can do is file
 * suggestions an AM will read and decline. Keep it that way.
 *
 * The same rows also carry a client's feedback on the welcome emails, under field keys
 * "welcomeFlow.{0-8}" (see suggestions-model.ts). Nothing here treats them differently
 * except the visibility check: they need the flow section shared, not the foundation.
 *
 * Actions (POST, JSON):
 *   { action: "list",     slug, email }         → { suggestions: [...] }
 *   { action: "create",   slug, email, items }  → { ok: true, created }
 *   { action: "withdraw", slug, email, id }     → { ok: true }
 */

const MAX_ITEMS = 60;
const MAX_VALUE = 10_000;
const MAX_PENDING = 200;
// Scalars ("hosts"), taglines ("taglines.0"), row columns ("personas.{id}.age").
const FIELD_KEY_RE = /^[a-zA-Z]+(\.[A-Za-z0-9-]{1,64}(\.[a-zA-Z]+)?)?$/;

const norm = (e: unknown) =>
    String(e ?? "")
        .trim()
        .toLowerCase();

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

    const action = String(body.action ?? "");
    const slug = String(body.slug ?? "").trim();
    const email = norm(body.email);

    // Shape checks before touching the database: these slugs are always "{client}-dashboard".
    if (!slug || slug.length > 120 || !/^[a-z0-9-]+-dashboard$/.test(slug)) {
        return Response.json({ error: "Bad slug." }, { status: 400 });
    }
    if (!email || email.length > 200 || !email.includes("@")) {
        return Response.json({ error: "Bad email." }, { status: 400 });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    // Identity: the email must be on THIS dashboard's allowlist, read fresh from the row —
    // never from anything the browser sends. An empty allowlist authenticates nobody.
    const { data: row, error: readErr } = await supabaseAdmin.from("dashboard_pages").select("data").eq("slug", slug).single();
    if (readErr || !row) return Response.json({ error: "Not found." }, { status: 404 });
    const data = (row.data ?? {}) as Record<string, unknown>;
    const allowed = Array.isArray(data.allowed_emails) ? (data.allowed_emails as unknown[]).map(norm) : [];
    if (!allowed.includes(email)) return Response.json({ error: "Not allowed." }, { status: 403 });

    if (action === "list") {
        const { data: rows, error } = await supabaseAdmin
            .from("dashboard_suggestions")
            .select("*")
            .eq("slug", slug)
            .order("created_at", { ascending: false })
            .limit(500);
        if (error) return Response.json({ error: "Could not load suggestions." }, { status: 500 });
        return Response.json({ suggestions: rows ?? [] });
    }

    if (action === "create") {
        // Suggesting requires the section the key belongs to be shared with the client:
        // feedback on a welcome email ("welcomeFlow.3") needs the flow shared, feedback or an
        // approval on a pinned post ("pinnedposts.{postId}.feedback|approve") needs Pinned
        // Posts shared, everything else is a Master Brand Document edit and needs the
        // foundation shared.
        //
        // Shared with THIS person, not with the dashboard: access is per person, so their own
        // section list wins where they have one and only a caller without one falls back to
        // the dashboard default. Read from the row, never from anything the browser sends.
        const users = Array.isArray(data.dashboard_users) ? (data.dashboard_users as Record<string, unknown>[]) : [];
        const me = users.find((u) => norm(u.email) === email);
        const visible = Array.isArray(me?.sections) ? (me.sections as unknown[]) : Array.isArray(data.client_visible) ? (data.client_visible as unknown[]) : [];
        const sectionFor = (key: string) => (key.startsWith("welcomeFlow.") ? "flow" : key.startsWith("pinnedposts.") ? "pinnedposts" : "foundation");

        const items = Array.isArray(body.items) ? (body.items as Record<string, unknown>[]) : [];
        if (items.length === 0 || items.length > MAX_ITEMS) return Response.json({ error: "Bad items." }, { status: 400 });

        const clean = items.map((i) => ({
            slug,
            field_key: String(i.fieldKey ?? ""),
            field_label: String(i.fieldLabel ?? "").slice(0, 200),
            current_value: String(i.currentValue ?? ""),
            suggested_value: String(i.suggestedValue ?? ""),
            suggested_by: email,
        }));
        for (const c of clean) {
            if (!c.field_key || c.field_key.length > 120 || !FIELD_KEY_RE.test(c.field_key)) {
                return Response.json({ error: "Bad field key." }, { status: 400 });
            }
            if (c.current_value.length > MAX_VALUE || c.suggested_value.length > MAX_VALUE) {
                return Response.json({ error: "Suggestion too long." }, { status: 400 });
            }
            if (!visible.includes(sectionFor(c.field_key))) return Response.json({ error: "Not allowed." }, { status: 403 });
        }

        // ponytail: shape caps only, no rate limiter — add one if a client ever abuses this.
        const { count } = await supabaseAdmin
            .from("dashboard_suggestions")
            .select("id", { count: "exact", head: true })
            .eq("slug", slug)
            .eq("status", "pending");
        if ((count ?? 0) >= MAX_PENDING)
            return Response.json({ error: "Too many pending suggestions — ask your account manager to review them first." }, { status: 400 });

        // Re-suggesting a field replaces the caller's own pending suggestion for it.
        const { error: delErr } = await supabaseAdmin
            .from("dashboard_suggestions")
            .delete()
            .eq("slug", slug)
            .eq("suggested_by", email)
            .eq("status", "pending")
            .in(
                "field_key",
                clean.map((c) => c.field_key),
            );
        if (delErr) return Response.json({ error: "Could not save suggestions." }, { status: 500 });

        const { error: insErr } = await supabaseAdmin.from("dashboard_suggestions").insert(clean);
        if (insErr) return Response.json({ error: "Could not save suggestions." }, { status: 500 });
        return Response.json({ ok: true, created: clean.length });
    }

    if (action === "withdraw") {
        const id = String(body.id ?? "");
        if (!/^[0-9a-f-]{36}$/.test(id)) return Response.json({ error: "Bad id." }, { status: 400 });
        // Scoped to the caller's own pending rows — nobody withdraws someone else's.
        const { error } = await supabaseAdmin
            .from("dashboard_suggestions")
            .delete()
            .eq("id", id)
            .eq("slug", slug)
            .eq("suggested_by", email)
            .eq("status", "pending");
        if (error) return Response.json({ error: "Could not withdraw." }, { status: 500 });
        return Response.json({ ok: true });
    }

    return Response.json({ error: "Unknown action." }, { status: 400 });
};
