import { ConfigError, jsonError, readJson, reportingDb, accessTokenFrom, verifyCaller, viewerOf } from "../lib/reporting.mts";

/**
 * The topics a client may raise a request against.
 *
 * Read straight from `ticket_topics` in the HGM Reporting project, active only, in the
 * team's own sort order. Nothing is computed and nothing is defaulted: the chooser shows
 * exactly the rows that exist, so seeding a third topic needs no deploy here or in the
 * bundle.
 *
 * ── WHY turnaround_days IS NOT SENT ────────────────────────────────────────
 * A topic's turnaround is an estimate, and a client is never shown a planned or estimated
 * date (owner, 28 Sep 2026). The column stays in the table for the brain (route-ticket.ts),
 * but it is not selected here, so no screen can turn it into words: the same rule as the
 * promised date and the assignee, which the ticket functions leave out of a client's
 * answers (ticket-columns.mts, clientView).
 *
 * ── WHY THIS ONE IS GATED TOO ───────────────────────────────────────────────
 * `ticket_topics` is the one reporting table with a SELECT policy for anon, so this list
 * is not a secret and the gate is not protecting it. It is here because the help centre
 * calls this first: a client whose proof has gone stale needs to meet the sign-in gate on
 * the screen that loads the form, not after they have typed a request into it. One code
 * path, one place the 401 can come from.
 *
 * POST application/json { slug } + Authorization: Bearer <session token> -> { topics: [...] }
 */

/** The three fields help-model.ts's TicketTopic declares. Internal routing columns
 *  (asana_project_gid, default_assignee_email, queue_label) are deliberately not among
 *  them: a client has no use for the board a request lands on. Nor is turnaround_days
 *  (see above). */
const TOPIC_COLUMNS = "key, label, description";

export default async (req: Request) => {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

    const parsed = await readJson<{ slug?: unknown; accessToken?: unknown }>(req);
    if (!parsed.ok) return parsed.response;

    try {
        const gate = await verifyCaller(String(parsed.body.slug ?? ""), accessTokenFrom(req, parsed.body));
        if (!gate.ok) return jsonError(gate.status, gate.error, gate.reason);

        const { data, error } = await reportingDb().from("ticket_topics").select(TOPIC_COLUMNS).eq("is_active", true).order("sort_order", { ascending: true });

        if (error) {
            console.error("[ticket-topics] read failed", error.message);
            return jsonError(500, "Could not load the request types.");
        }

        return Response.json({ viewer: viewerOf(gate), topics: data ?? [] });
    } catch (err) {
        // A missing environment variable is the one failure worth naming out loud: it is
        // ours, it is the same on every call, and "try again" is the wrong advice for it.
        if (err instanceof ConfigError) {
            console.error("[ticket-topics] not configured", err.message);
            return jsonError(500, "The help centre is not configured. Ask your account manager to tell the web team.");
        }
        console.error("[ticket-topics] unexpected failure", err instanceof Error ? err.message : String(err));
        return jsonError(500, "Something went wrong at our end.");
    }
};
