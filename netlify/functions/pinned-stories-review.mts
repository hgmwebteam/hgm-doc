import { createClient } from "@supabase/supabase-js";
import { alertClientNote } from "../lib/client-note-alert.mts";

/**
 * Client review actions on Marketing → Pinned Stories: a note on one slide, a note on the
 * whole set, or approval.
 *
 * Same reasoning as landing-page-review.mts: the client is `anon` to Supabase and has no
 * write grant on pinned_stories, so the browser asks this function, which holds the
 * service-role key and checks on every call that the caller's email is on THAT
 * dashboard's allowed_emails and that the section has actually been revealed to them.
 *
 * Only versions[0].review is ever touched — never the highlights, never the draft, never
 * an older version — so the worst a caller with a stolen email + slug pair can do is leave
 * a note the AM will read and can resolve.
 *
 * Actions (POST, JSON):
 *   { action: "comment", slug, email, text, highlightId?, slideId? } → { ok: true, review }
 *   { action: "approve", slug, email }                              → { ok: true, review }
 */

const MAX_TEXT = 2000;
const MAX_COMMENTS = 200;

const norm = (e: unknown) =>
    String(e ?? "")
        .trim()
        .toLowerCase();

const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `id-${Math.random().toString(36).slice(2)}`);

export default async (req: Request) => {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
        return Response.json({ error: "Not configured — SUPABASE_SERVICE_ROLE_KEY is missing in Netlify." }, { status: 500 });
    }

    let body: Record<string, unknown>;
    try {
        body = (await req.json()) as Record<string, unknown>;
    } catch {
        return Response.json({ error: "Bad request." }, { status: 400 });
    }

    const action = String(body.action ?? "");
    const slug = String(body.slug ?? "").trim();
    const email = norm(body.email);

    if (!slug || slug.length > 120 || !/^[a-z0-9-]+-dashboard$/.test(slug)) return Response.json({ error: "Bad slug." }, { status: 400 });
    if (!email || email.length > 200 || !email.includes("@")) return Response.json({ error: "Bad email." }, { status: 400 });
    if (action !== "comment" && action !== "approve") return Response.json({ error: "Unknown action." }, { status: 400 });

    const admin = createClient(supabaseUrl, serviceKey);

    // Identity: read fresh from the dashboard row, never from anything the browser sends.
    const { data: dashboardRow, error: dashboardErr } = await admin.from("dashboard_pages").select("data, client_name").eq("slug", slug).single();
    if (dashboardErr || !dashboardRow) return Response.json({ error: "Not found." }, { status: 404 });
    const dashboardData = (dashboardRow.data ?? {}) as Record<string, unknown>;
    const allowed = Array.isArray(dashboardData.allowed_emails) ? (dashboardData.allowed_emails as unknown[]).map(norm) : [];
    if (!allowed.includes(email)) return Response.json({ error: "Not allowed." }, { status: 403 });
    const visible = Array.isArray(dashboardData.client_visible) && (dashboardData.client_visible as unknown[]).includes("pinnedstories");
    if (!visible) return Response.json({ error: "Not allowed." }, { status: 403 });

    const { data: row, error: rowErr } = await admin.from("pinned_stories").select("data").eq("slug", slug).maybeSingle();
    if (rowErr) return Response.json({ error: "Could not load the stories." }, { status: 500 });
    const data = (row?.data ?? {}) as { draft?: unknown; versions?: Record<string, unknown>[] };
    const versions = Array.isArray(data.versions) ? data.versions : [];
    const live = versions[0];
    if (!live) return Response.json({ error: "Nothing published yet." }, { status: 400 });

    const current = (live.review ?? {}) as { status?: string; comments?: unknown[] };
    const comments = Array.isArray(current.comments) ? current.comments : [];
    const now = new Date().toISOString();
    let review: Record<string, unknown>;
    // What the team's alert says about a note: the highlight it is on, or the whole set.
    let noteLabel = "";
    let noteText = "";

    if (action === "approve") {
        review = { status: "approved", respondedAt: now, respondedBy: email, comments };
    } else {
        const text = String(body.text ?? "").trim();
        if (!text || text.length > MAX_TEXT) return Response.json({ error: "Bad note." }, { status: 400 });
        if (comments.length >= MAX_COMMENTS) return Response.json({ error: "Too many notes on this version." }, { status: 429 });
        const highlightId = String(body.highlightId ?? "").slice(0, 80);
        const slideId = String(body.slideId ?? "").slice(0, 80);
        // A slide reference must point at a slide that exists in the live version; anything
        // else is stored as a note on the whole set rather than rejected.
        const highlights = Array.isArray(live.highlights) ? (live.highlights as { id: string; title?: string; slides?: { id: string }[] }[]) : [];
        const h = highlights.find((x) => x.id === highlightId);
        const valid = !!h && !!h.slides?.some((s) => s.id === slideId);
        const comment = { id: newId(), highlightId: valid ? highlightId : "", slideId: valid ? slideId : "", text, by: email, at: now };
        review = { status: "changes", respondedAt: now, respondedBy: email, comments: [...comments, comment] };
        noteLabel = valid ? `Pinned stories · “${String(h!.title ?? "").trim() || "Untitled"}”` : "Pinned stories · whole set";
        noteText = text;
    }

    const nextVersions = [{ ...live, review }, ...versions.slice(1)];
    const { error: writeErr } = await admin
        .from("pinned_stories")
        .update({ data: { ...data, versions: nextVersions }, updated_at: now })
        .eq("slug", slug);
    if (writeErr) return Response.json({ error: "Could not save your note." }, { status: 500 });

    // A note is for the team; an approval is not. Best-effort and bounded — the note is
    // saved, so a failed alert never fails the client's send.
    if (action === "comment") {
        await alertClientNote(admin, {
            slug,
            by: email,
            dashboardClientName: String(dashboardRow.client_name ?? ""),
            items: [{ key: "pinnedStories.review", label: noteLabel, text: noteText }],
        });
    }

    return Response.json({ ok: true, review });
};
