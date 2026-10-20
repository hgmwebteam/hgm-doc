import { BRAIN_API_KEY, BRAIN_TICKET_URL, ConfigError, accessTokenFrom, cleanText, jsonError, readJson, recordAccess, reportingDb, verifyCaller } from "../lib/reporting.mts";
import { TIMED_OUT, UNREACHABLE, approveUrlFrom, notInReview, platformAnswer } from "../lib/ticket-approval.mts";

/**
 * Staff approve a finished request, and only then is the client told it is done.
 *
 * ── THE APPROVAL STAGE (owner, 20 Oct 2026) ─────────────────────────────────
 * When the web team ticks a request's Asana task done, the platform (hiddengem-ai) no longer
 * completes the ticket and emails the client there and then. It sets the status to
 * `in_review` and sends the client's account manager a Google Chat message linking to the
 * request page, https://hgmportal.com/{client_slug}/help/requests/{reference}. The AM opens
 * it signed in as staff, checks the work and presses Approve, which lands here. This file
 * decides who may approve and that the request is waiting; the platform does the rest
 * (completed, completed_at, the completion email) exactly as it did before the stage existed,
 * so there is still one writer of a completion and one sender of its email.
 *
 * A client never sees `in_review`: every answer a client gets reads it as `in_progress`
 * (ticket-columns.mts, clientView), so to them the request is still in progress until the AM
 * approves it.
 *
 * ── WHO MAY APPROVE ─────────────────────────────────────────────────────────
 * Staff only, by verifyCaller's three tests (staff.mts), scoped to the verified slug like
 * every ticket read, so another client's reference is a 404. A listed client gets 403: the
 * stage exists so that somebody at HiddenGem Media looks first. Any staff member may press
 * it, not only the request's AM, because a colleague covering for them opens the same page.
 *
 * ── THE PLATFORM CALL ───────────────────────────────────────────────────────
 * POST { ticket_id, approver_email, approver_name } with header x-api-key: BRAIN_API_KEY (the
 * key ticket-create sends to /received) to BRAIN_TICKET_APPROVE_URL, or to
 * BRAIN_TICKETS_RECEIVED_URL with /received made /approve (ticket-approval.mts, which also
 * words every answer). The status is read here first so a stale page gets a sentence without
 * a round trip, and the platform checks it again, since it is the one that writes. Budgeted at
 * about nine seconds from the start of this call, under the ten Netlify allows a function: past
 * that the approval may still land, so the page says to reload rather than that it failed.
 * Pressing again is always safe, because the platform answers a second approval with `already`.
 *
 * POST application/json { slug, reference } + Authorization: Bearer <session token>
 *   -> 200 { approved: true, already, email: "sent" | "queued" | "retrying" | "failed" | "not_sent" | "not_applicable" | null }
 *   -> 409 { error } not awaiting review; 503 not configured; 502 or 504 { error } the platform could not say yes
 *
 * House style: no em or en dashes anywhere.
 */

const REFERENCE = /^REQ-\d{1,12}$/;

/** The platform's share of this call, counted from its start: Netlify stops a function at ten seconds. */
const BUDGET_MS = 9_000;

export default async (req: Request) => {
    const started = Date.now();
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

    const parsed = await readJson<{ slug?: unknown; accessToken?: unknown; reference?: unknown }>(req);
    if (!parsed.ok) return parsed.response;

    try {
        const gate = await verifyCaller(String(parsed.body.slug ?? ""), accessTokenFrom(req, parsed.body));
        if (!gate.ok) return jsonError(gate.status, gate.error, gate.reason);
        // Refused explicitly, not by omission (reporting.mts, Via): a client may read this
        // request but never approve it.
        if (gate.via !== "staff") return jsonError(403, "Not authorized.");

        const reference = cleanText(parsed.body.reference, 40).toUpperCase();
        if (!REFERENCE.test(reference)) return jsonError(400, "That is not a request reference.");

        const { data: ticket, error } = await reportingDb().from("tickets").select("id, status").eq("reference", reference).eq("client_slug", gate.caller.slug).maybeSingle();
        if (error) {
            console.error("[ticket-approve] read failed", error.message);
            return jsonError(500, "Could not load that request.");
        }
        if (!ticket) return jsonError(404, "We could not find a request with that reference.");

        // On the record, as every staff read of a client's request is (ticket_access_log).
        await recordAccess(gate, "ticket-approve", reference);

        const row = ticket as { id: string; status: string };
        if (row.status !== "in_review") return jsonError(409, notInReview(reference, row.status));

        const url = approveUrlFrom(process.env.BRAIN_TICKET_APPROVE_URL, BRAIN_TICKET_URL);
        if (!url || !BRAIN_API_KEY) {
            console.error("[ticket-approve] BRAIN_TICKET_APPROVE_URL (or a BRAIN_TICKETS_RECEIVED_URL ending /received) / BRAIN_API_KEY are not set", reference);
            return jsonError(503, "Approving is not switched on yet, so nothing was approved. Tell the web team.");
        }

        let res: Response;
        try {
            res = await fetch(url, {
                method: "POST",
                headers: { "content-type": "application/json", "x-api-key": BRAIN_API_KEY },
                body: JSON.stringify({ ticket_id: row.id, approver_email: gate.caller.email, approver_name: gate.caller.name }),
                signal: AbortSignal.timeout(Math.max(1_000, BUDGET_MS - (Date.now() - started))),
            });
        } catch (err) {
            const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
            console.error("[ticket-approve] the platform", timedOut ? "did not answer in time" : "could not be reached", err instanceof Error ? err.message : String(err), reference);
            return timedOut ? jsonError(504, TIMED_OUT) : jsonError(502, UNREACHABLE);
        }

        const answer = platformAnswer(reference, res.status, await res.json().catch(() => null));
        // Status only, as ticket-create logs the platform: its body can carry its internals.
        if (answer.status !== 200) console.error("[ticket-approve] the platform did not approve", res.status, reference);
        return Response.json(answer.body, { status: answer.status });
    } catch (err) {
        if (err instanceof ConfigError) {
            console.error("[ticket-approve] not configured", err.message);
            return jsonError(500, "The Help Center is not configured. Tell the web team.");
        }
        console.error("[ticket-approve] unexpected failure", err instanceof Error ? err.message : String(err));
        return jsonError(500, "Something went wrong at our end.");
    }
};
