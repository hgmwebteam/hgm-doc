import { ConfigError, cleanText, jsonError, readJson, reportingDb, accessTokenFrom, verifyCaller, staffReadOnly } from "../lib/reporting.mts";

/**
 * A client withdraws their own request.
 *
 * Rule 4 of the design document: withdrawing CLOSES a ticket and marks it withdrawn. It
 * never deletes the row. The request stays on the client's list under its own filter,
 * because somebody who withdrew a thing by mistake has to be able to find it again, and
 * because the history of what was asked for is the reason this system exists.
 *
 * ── THREE THINGS ARE CHECKED, AND ALL THREE MATTER ──────────────────────────
 *  1. `confirm: true`. This is destructive from the client's point of view and the browser
 *     has to have asked them. A body without it is a mis-wired button, not a decision.
 *  2. The caller is the person who SUBMITTED it. Everyone on a dashboard's access list can
 *     see every request that dashboard has raised, which is right - a team should see its
 *     own history. It does not follow that a colleague may cancel work somebody else asked
 *     for, so `submitted_by` is compared, not merely the slug.
 *  3. The request is still open. A completed request has already cost the time it was going
 *     to cost, and rewriting it as withdrawn would put a lie in the record.
 *
 * The update is guarded by the status a second time, in the WHERE clause, so a request the
 * team completed in the seconds between the read and the write is not quietly reopened and
 * closed again as withdrawn.
 *
 * POST application/json { slug, reference, confirm: true } + Authorization: Bearer <session token> -> { ticket }
 */

/** Kept in step with ticket-create.mts and ticket-detail.mts, which hand back the same row.
 *  Internal routing columns (tenant_id, portal_client_id, asana_*, derived_subject, routed_at,
 *  route_error) are absent by construction rather than stripped afterwards. */
const TICKET_COLUMNS =
    "id, reference, topic, title, status, created_at, detail, property, needed_by, image_count, drive_folder_url, client_name, submitted_by, submitted_by_name, assignee_name, assignee_email, account_manager_email, promised_date, completed_at, completed_by, withdrawn_at, withdrawn_by";

/** Matches OPEN_STATUSES in src/pages/client/help/help-model.ts, where canWithdraw() shows or
 *  hides the button. That copy decides what a client is offered; this one decides what
 *  happens, and they must be changed together. */
const OPEN_STATUSES = ["received", "assigned", "in_progress"];

const REFERENCE = /^REQ-\d{1,12}$/;

export default async (req: Request) => {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

    const parsed = await readJson<{ slug?: unknown; accessToken?: unknown; reference?: unknown; confirm?: unknown }>(req);
    if (!parsed.ok) return parsed.response;

    try {
        const gate = await verifyCaller(String(parsed.body.slug ?? ""), accessTokenFrom(req, parsed.body));
        if (!gate.ok) return jsonError(gate.status, gate.error, gate.reason);
        // THE STRONGEST NO OF THE FIVE. Even a colleague on the same dashboard
        // cannot withdraw somebody else's request; staff certainly cannot.
        // Refused here, before the ownership test further down, because that
        // test compares against submitted_by and would otherwise be the thing
        // deciding - and "whatever submitted_by happens to say" is an accident,
        // not a decision.
        if (gate.via === "staff") return staffReadOnly("withdrawing it");

        if (parsed.body.confirm !== true) return jsonError(400, "Withdrawing a request has to be confirmed.");

        const reference = cleanText(parsed.body.reference, 40).toUpperCase();
        if (!REFERENCE.test(reference)) return jsonError(400, "That is not a request reference.");

        const db = reportingDb();

        // Scoped by the verified slug, so a reference belonging to another client is a 404
        // and not a way to find out that it exists.
        const { data: ticket, error } = await db
            .from("tickets")
            .select(TICKET_COLUMNS)
            .eq("reference", reference)
            .eq("client_slug", gate.caller.slug)
            .maybeSingle();

        if (error) {
            console.error("[ticket-withdraw] read failed", error.message);
            return jsonError(500, "Could not load that request.");
        }
        if (!ticket) return jsonError(404, "We could not find a request with that reference.");

        const current = ticket as { id: string; status: string; submitted_by: string | null };

        if ((current.submitted_by ?? "").toLowerCase() !== gate.caller.email) {
            return jsonError(403, "Only the person who raised a request can withdraw it. Ask them, or speak to your account manager.");
        }
        if (current.status === "withdrawn") return jsonError(422, "That request has already been withdrawn.");
        if (!OPEN_STATUSES.includes(current.status)) return jsonError(422, "That request is already finished, so there is nothing to withdraw.");

        const now = new Date().toISOString();
        const { data: updated, error: writeErr } = await db
            .from("tickets")
            .update({ status: "withdrawn", withdrawn_at: now, withdrawn_by: gate.caller.email, updated_at: now })
            .eq("id", current.id)
            // The guard: if the team completed it in the meantime, this matches nothing and
            // the completion stands.
            .in("status", OPEN_STATUSES)
            .select(TICKET_COLUMNS)
            .maybeSingle();

        if (writeErr) {
            console.error("[ticket-withdraw] update failed", writeErr.message, reference);
            return jsonError(500, "We could not withdraw that request. Nothing was changed - try again in a moment.");
        }
        if (!updated) return jsonError(422, "That request was finished just before you withdrew it, so it has been left as completed.");

        // The timeline entry, and the team's notification in one row: it is written with
        // mirrored_to_asana false, which is what the brain's mirror looks for when it copies
        // an update onto the Asana task. Jarvis never messages the client, and this does not
        // either - it tells the person who owns the work that the work has stopped.
        const { error: eventErr } = await db.from("ticket_events").insert({
            ticket_id: current.id,
            kind: "withdrawn",
            body: `${gate.caller.name} withdrew this request.`,
            actor_email: gate.caller.email,
            actor_name: gate.caller.name,
        });
        // The ticket IS withdrawn. A missing timeline row is worth a log line, not an error
        // that would leave the client pressing the button again on a closed request.
        if (eventErr) console.error("[ticket-withdraw] withdrawn event failed", eventErr.message, reference);

        return Response.json({ ticket: updated });
    } catch (err) {
        if (err instanceof ConfigError) {
            console.error("[ticket-withdraw] not configured", err.message);
            return jsonError(500, "The help centre is not configured. Ask your account manager to tell the web team.");
        }
        console.error("[ticket-withdraw] unexpected failure", err instanceof Error ? err.message : String(err));
        return jsonError(500, "Something went wrong at our end.");
    }
};
