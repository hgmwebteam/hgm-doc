import { ConfigError, jsonError, readJson, reportingDb, accessTokenFrom, verifyCaller, recordAccess, viewerOf } from "../lib/reporting.mts";

/**
 * Every request one client has raised, newest first.
 *
 * ── THE ONE RULE THIS FILE HAS ──────────────────────────────────────────────
 * The list is scoped by `gate.caller.slug` and by nothing else. Not by a slug in the body,
 * not by a client name, not by an id the browser worked out for itself. verifyCaller() has
 * just proved that address clears THAT dashboard's gate against the live row, so the slug it
 * hands back is the only client identifier in this file that means anything. The day someone
 * adds a `client` field to the body for convenience, this becomes an endpoint that reads any
 * client's request history to anyone who signs in with any address on any list.
 *
 * Withdrawn requests are included deliberately. help-model.ts gives them their own filter
 * rather than dropping them, because a client who withdrew something by mistake has to be
 * able to find it again.
 *
 * POST application/json { slug } + Authorization: Bearer <session token> -> { tickets: [...], counts: { total, open } }
 */

/** Narrower than ticket-detail.mts on purpose, and exactly what the list screen reads:
 *  isOpen, matchesFilter, elapsedLabel, promiseBlock, completedThisMonth, inProgressCount
 *  and topicLabel in help-model.ts, and nothing else. `detail` in particular is absent -
 *  sending every client's full request bodies to render a list of titles is a page of
 *  payload nobody looks at. */
const LIST_COLUMNS =
    "id, reference, topic, title, status, created_at, property, needed_by, priority, image_count, submitted_by, assignee_name, promised_date, completed_at, withdrawn_at";

/** Matches OPEN_STATUSES in src/pages/client/help/help-model.ts. Two copies, because one is
 *  a Postgres filter and the other is a browser predicate; they must be changed together. */
const OPEN_STATUSES = ["received", "assigned", "in_progress"];

/** A client with more requests than this needs paging, not a bigger number here. The counts
 *  below are computed by the database rather than from these rows, so the summary line stays
 *  true even for the client who eventually goes past it. */
const MAX_ROWS = 200;

export default async (req: Request) => {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

    const parsed = await readJson<{ slug?: unknown; accessToken?: unknown }>(req);
    if (!parsed.ok) return parsed.response;

    try {
        const gate = await verifyCaller(String(parsed.body.slug ?? ""), accessTokenFrom(req, parsed.body));
        if (!gate.ok) return jsonError(gate.status, gate.error, gate.reason);

        const db = reportingDb();

        // Staff may read, scoped to this ONE slug exactly as a client is, and the
        // read goes on the record. Nothing else about the query changes for
        // them: the scope is gate.caller.slug either way, which is the whole
        // point of deciding identity in one place.
        await recordAccess(gate, "ticket-list");

        const [{ data, error, count }, openResult] = await Promise.all([
            db
                .from("tickets")
                .select(LIST_COLUMNS, { count: "exact" })
                .eq("client_slug", gate.caller.slug)
                .order("created_at", { ascending: false })
                .range(0, MAX_ROWS - 1),
            db.from("tickets").select("id", { count: "exact", head: true }).eq("client_slug", gate.caller.slug).in("status", OPEN_STATUSES),
        ]);

        if (error) {
            console.error("[ticket-list] read failed", error.message);
            return jsonError(500, "Could not load your requests.");
        }

        const tickets = data ?? [];

        return Response.json({
            viewer: viewerOf(gate),
            tickets,
            counts: {
                // `count` is the number of rows that MATCHED, not the number returned, so the
                // summary stays right past MAX_ROWS. It is null only when the database
                // declined to count, and then the rows in hand are the honest answer.
                total: count ?? tickets.length,
                open: openResult.count ?? tickets.filter((t) => OPEN_STATUSES.includes((t as { status: string }).status)).length,
            },
        });
    } catch (err) {
        if (err instanceof ConfigError) {
            console.error("[ticket-list] not configured", err.message);
            return jsonError(500, "The help centre is not configured. Ask your account manager to tell the web team.");
        }
        console.error("[ticket-list] unexpected failure", err instanceof Error ? err.message : String(err));
        return jsonError(500, "Something went wrong at our end.");
    }
};
