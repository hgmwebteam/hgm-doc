import { ConfigError, cleanText, jsonError, readJson, reportingDb, accessTokenFrom, recordAccess, verifyStaff, viewerOf } from "../lib/reporting.mts";

/**
 * Every client's requests, for the team.
 *
 * ── WHO MAY CALL THIS ───────────────────────────────────────────────────────
 * Staff only, decided by verifyStaff - the same three tests as the per-client
 * gate (domain parsed strictly, confirmed email, Google provider) with no
 * dashboard in the picture, because there is no one client here. A client
 * session, however valid, gets the same refusal as a client not on a list:
 * 403, reason not_listed, byte for byte.
 *
 * ── WHAT IT RETURNS ─────────────────────────────────────────────────────────
 * The columns the team list shows and nothing internal: no route_error, no
 * intake_notes, no Asana ids. Newest first, paged by created_at so a request
 * landing mid-scroll cannot shift the page. Filters are optional and narrow
 * rather than replace: a status, a client slug.
 *
 * Every call is on the record in ticket_access_log under client_slug "all",
 * because reading every client's history in one call is exactly the read the
 * log exists for.
 */

const COLUMNS =
    "id, reference, client_slug, client_name, topic, title, status, priority, created_at, needed_by, promised_date, submitted_by, submitted_by_name, assignee_name, account_manager_email, completed_at, withdrawn_at";

const PAGE = 200;
const STATUSES = ["received", "assigned", "in_progress", "completed", "withdrawn"] as const;

interface ListAllBody {
    accessToken?: unknown;
    /** ISO created_at of the last row seen; the next page starts strictly before it. */
    before?: unknown;
    status?: unknown;
    client_slug?: unknown;
}

export default async (req: Request) => {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
    const parsed = await readJson<ListAllBody>(req);
    if (!parsed.ok) return parsed.response;

    try {
        const gate = await verifyStaff(accessTokenFrom(req, parsed.body));
        if (!gate.ok) return jsonError(gate.status, gate.error, gate.reason);

        await recordAccess(gate, "ticket-list-all");

        const db = reportingDb();
        let query = db.from("tickets").select(COLUMNS, { count: "exact" }).order("created_at", { ascending: false }).limit(PAGE);

        const status = cleanText(parsed.body.status, 20);
        if (status && (STATUSES as readonly string[]).includes(status)) query = query.eq("status", status);
        const slug = cleanText(parsed.body.client_slug, 120);
        if (slug && /^[a-z0-9-]+$/.test(slug)) query = query.eq("client_slug", slug);
        const before = cleanText(parsed.body.before, 40);
        if (before && !Number.isNaN(new Date(before).getTime())) query = query.lt("created_at", before);

        const { data, error, count } = await query;
        if (error) {
            console.error("[ticket-list-all] read failed", error.message);
            return jsonError(500, "Could not load the requests.");
        }
        const tickets = data ?? [];
        return Response.json({
            viewer: viewerOf(gate),
            tickets,
            total: count ?? tickets.length,
            // The cursor for the next page, or null at the end. The caller passes it back
            // as `before`.
            next_before: tickets.length === PAGE ? (tickets[tickets.length - 1] as { created_at: string }).created_at : null,
        });
    } catch (err) {
        if (err instanceof ConfigError) {
            console.error("[ticket-list-all] not configured", err.message);
            return jsonError(500, "The help centre is not configured. Tell the web team.");
        }
        console.error("[ticket-list-all] unexpected failure", err instanceof Error ? err.message : String(err));
        return jsonError(500, "Something went wrong at our end.");
    }
};
