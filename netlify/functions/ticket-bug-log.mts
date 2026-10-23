import { isPortalReport } from "../../src/lib/portal-log-model.ts";
import { ConfigError, accessTokenFrom, jsonError, readJson, recordAccess, reportingDb, verifyStaff } from "../lib/reporting.mts";
import { isMissingColumn } from "../lib/ticket-columns.mts";

/**
 * The Bugs on /log: the requests the team raised about a portal page (what the dashboard's
 * Report a problem button files) and the status changes on their timelines.
 *
 * ── WHO MAY CALL THIS ───────────────────────────────────────────────────────
 * Staff only, by verifyStaff, exactly as ticket-list-all: a client session gets the same 403
 * as a client not on a list. On the record in ticket_access_log under client_slug "all".
 *
 * ── WHAT COUNTS AS A BUG ────────────────────────────────────────────────────
 * isPortalReport (src/lib/portal-log-model.ts): a team submitter and a portal address among
 * the pages. No column marks a report as the button's, so the rule is read off what the button
 * always leaves, and the screen and this endpoint share it.
 *
 * ── WHAT IT RETURNS ─────────────────────────────────────────────────────────
 * The columns the team list shows plus the pages, and the timeline rows of those tickets with
 * no body: a status change needs its kind, who and when, and a body is words written for the
 * client. Every event kind is sent and the screen keeps the status ones, so a kind not yet
 * added to the enum by hand (client_question) cannot fail the read.
 *
 * POST application/json + Authorization: Bearer <session token>
 *   -> { bugs: [...], events: [{ id, ticket_id, kind, actor_name, actor_email, created_at }] }
 */

const COLUMNS = "id, reference, client_slug, client_name, title, status, submitted_by, submitted_by_name, created_at, urls";
const EVENT_COLUMNS = "id, ticket_id, kind, actor_name, actor_email, created_at";

// ponytail: scans the newest 300 requests that carry pages and keeps up to 100 reports, so the
// events read stays one short `in` list. Page by created_at, as ticket-list-all does, when the
// log has to reach further back.
const SCAN = 300;
const MAX_BUGS = 100;
const MAX_EVENTS = 1000;

export default async (req: Request) => {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
    const parsed = await readJson(req);
    if (!parsed.ok) return parsed.response;

    try {
        const gate = await verifyStaff(accessTokenFrom(req, parsed.body));
        if (!gate.ok) return jsonError(gate.status, gate.error, gate.reason);

        await recordAccess(gate, "ticket-bug-log");

        const db = reportingDb();
        const { data, error } = await db.from("tickets").select(COLUMNS).not("urls", "is", null).order("created_at", { ascending: false }).limit(SCAN);
        if (error) {
            console.error("[ticket-bug-log] read failed", error.message);
            // 503, so the sentence reaches the screen (help-api.ts passes it through).
            if (isMissingColumn(error)) return jsonError(503, "The reporting database has no pages column yet, so reports from the portal cannot be picked out.");
            return jsonError(500, "Could not load the bug reports.");
        }
        const bugs = ((data ?? []) as unknown as Array<{ id: string; submitted_by: string | null; urls: unknown }>).filter(isPortalReport).slice(0, MAX_BUGS);

        let events: unknown[] = [];
        if (bugs.length) {
            const { data: rows, error: eventsErr } = await db
                .from("ticket_events")
                .select(EVENT_COLUMNS)
                .in(
                    "ticket_id",
                    bugs.map((b) => b.id),
                )
                .order("created_at", { ascending: false })
                .limit(MAX_EVENTS);
            // The reports are the answer and the moves are detail on them, as on ticket-detail:
            // a failed timeline read is an empty list and a log line, not an error page.
            if (eventsErr) console.error("[ticket-bug-log] timeline read failed", eventsErr.message);
            else events = rows ?? [];
        }

        return Response.json({ bugs, events });
    } catch (err) {
        if (err instanceof ConfigError) {
            console.error("[ticket-bug-log] not configured", err.message);
            return jsonError(500, "The Help Center is not configured. Tell the web team.");
        }
        console.error("[ticket-bug-log] unexpected failure", err instanceof Error ? err.message : String(err));
        return jsonError(500, "Something went wrong at our end.");
    }
};
