import { createClient } from "@supabase/supabase-js";
import { alertClientNote } from "../lib/client-note-alert.mts";

/**
 * Client review actions on the Marketing → Landing page section (Approve / Request
 * changes).
 *
 * Same reasoning as dashboard-suggestions.mts: the client reading their dashboard is
 * `anon` to Supabase — they cleared the app's own email/password gate, not Supabase
 * auth — and `anon` has no write grant on landing_pages at all (see the migration).
 * Granting anon UPDATE would let anyone who finds a dashboard's slug flip its review
 * state, so instead the browser asks this function, which holds the service-role key
 * and validates on every call that the caller's email is on THAT dashboard's
 * allowed_emails list, exactly like the suggestion flow.
 *
 * This function only ever touches landing_pages.data.review — it never publishes or
 * restores a version, so the worst a caller with a stolen email + slug pair can do is
 * mark a page approved or leave a change note, both of which an AM sees and can undo
 * by publishing a new version.
 *
 * Actions (POST, JSON):
 *   { action: "approve",         slug, email }        → { ok: true, review }
 *   { action: "request_changes", slug, email, note }  → { ok: true, review }
 */

const MAX_NOTE = 4000;

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
    if (action !== "approve" && action !== "request_changes") {
        return Response.json({ error: "Unknown action." }, { status: 400 });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    // Identity: the email must be on THIS dashboard's allowlist, read fresh from the row —
    // never from anything the browser sends. An empty allowlist authenticates nobody.
    const { data: dashboardRow, error: dashboardErr } = await supabaseAdmin.from("dashboard_pages").select("data, client_name").eq("slug", slug).single();
    if (dashboardErr || !dashboardRow) return Response.json({ error: "Not found." }, { status: 404 });
    const dashboardData = (dashboardRow.data ?? {}) as Record<string, unknown>;
    const allowed = Array.isArray(dashboardData.allowed_emails) ? (dashboardData.allowed_emails as unknown[]).map(norm) : [];
    if (!allowed.includes(email)) return Response.json({ error: "Not allowed." }, { status: 403 });

    // Reviewing requires the section to actually be shared with the client — same rule
    // dashboard-suggestions.mts applies to "foundation".
    const visible = Array.isArray(dashboardData.client_visible) && (dashboardData.client_visible as unknown[]).includes("landing");
    if (!visible) return Response.json({ error: "Not allowed." }, { status: 403 });

    const { data: landingRow, error: landingErr } = await supabaseAdmin.from("landing_pages").select("data").eq("slug", slug).maybeSingle();
    if (landingErr) return Response.json({ error: "Could not load the landing page." }, { status: 500 });
    const landingData = (landingRow?.data ?? {}) as { versions?: unknown[]; review?: Record<string, unknown> };
    const versions = Array.isArray(landingData.versions) ? landingData.versions : [];
    // Nothing published yet — there is nothing to approve or request changes on.
    if (versions.length === 0) return Response.json({ error: "Nothing published yet." }, { status: 400 });

    const respondedAt = new Date().toISOString();
    let review: Record<string, unknown>;
    if (action === "approve") {
        review = { status: "approved", respondedAt, respondedBy: email };
    } else {
        const note = String(body.note ?? "").trim();
        if (!note || note.length > MAX_NOTE) return Response.json({ error: "Bad note." }, { status: 400 });
        review = { status: "changes", note, respondedAt, respondedBy: email };
    }

    // The row is known to exist (versions.length was checked above), so this only ever
    // touches data/updated_at — client_name is left exactly as the team set it.
    const nextData = { versions, review };
    const { error: writeErr } = await supabaseAdmin.from("landing_pages").update({ data: nextData, updated_at: respondedAt }).eq("slug", slug);
    if (writeErr) return Response.json({ error: "Could not save your response." }, { status: 500 });

    // A change request is a note for the team; an approval is not. Best-effort and bounded —
    // the review is saved, so a failed alert never fails the client's response.
    if (action === "request_changes") {
        await alertClientNote(supabaseAdmin, {
            slug,
            by: email,
            dashboardClientName: String(dashboardRow.client_name ?? ""),
            items: [{ key: "landingPage.review", label: "Landing page · requested changes", text: String(review.note ?? "") }],
        });
    }

    return Response.json({ ok: true, review });
};
