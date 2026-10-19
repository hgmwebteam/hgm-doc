import { ConfigError, cleanText, jsonError, readJson, reportingDb, accessTokenFrom, verifyCaller } from "../lib/reporting.mts";
import { FORM_SUBMISSION_CC } from "../lib/team-emails.mts";
import { cleanQuestion } from "../../src/pages/client/help/request-rules.ts";

/**
 * A client asks the team something about an open request, most often when it will be done.
 *
 * FLOHOM, 15 Oct 2026: "Do we inquire about updates on timing of completion through the portal
 * as well?" This is the yes. The question is written on the request's own timeline as a
 * `client_question` event, so it is on the record next to the team's updates, and it is emailed
 * to the people on the request (the assignee and the account manager) with the asker as the
 * reply-to address, so a reply from their mailbox reaches the client directly. The portal gives
 * a client no promised date (owner, 28 Sep 2026), and this does not change that: what the team
 * says in reply is the team's call.
 *
 * ── WHO MAY ASK ─────────────────────────────────────────────────────────────
 * Anyone the dashboard lists, and staff. Unlike withdrawing, asking is not limited to the
 * person who raised the request: a front desk asking after a colleague's request is the normal
 * case, and a question changes nothing about the work.
 *
 * ── WHEN THE DATABASE DOES NOT KNOW THE KIND YET ────────────────────────────
 * `ticket_events.kind` is a Postgres enum, and `client_question` has to be added to it by hand
 * in the HGM Reporting project:
 *
 *   alter type ticket_event_kind add value if not exists 'client_question';
 *
 * Until that is run the insert fails with "invalid input value for enum", and the client is
 * told, in one plain sentence, to email their account manager instead. Nothing is emailed in
 * that case: a question that is not on the record is not one the page can show as sent.
 *
 * POST application/json { slug, reference, question } + Authorization: Bearer <session token>
 *   -> { event: { id, kind, body, actor_email, actor_name, created_at } }
 */

const OPEN_STATUSES = ["received", "assigned", "in_progress"];
const REFERENCE = /^REQ-\d{1,12}$/;
const EVENT_COLUMNS = "id, kind, body, actor_email, actor_name, created_at";
const SITE = "https://hgmportal.com";

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

interface TicketRow {
    id: string;
    reference: string;
    title: string;
    status: string;
    client_slug: string;
    client_name: string | null;
    assignee_email: string | null;
    account_manager_email: string | null;
    asana_task_url: string | null;
}

/**
 * The email, best effort: a failure is logged with the reference and never undoes the event.
 * To the assignee and the account manager; when the row names neither (a request the brain has
 * not routed yet), to the agency's form-submission inbox, the same people a new onboarding form
 * is sent to, so a question never lands nowhere.
 */
const emailTheTeam = async (ticket: TicketRow, asker: { email: string; name: string }, question: string): Promise<void> => {
    const resendKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM;
    if (!resendKey || !from) {
        console.error("[ticket-ask] RESEND_API_KEY / RESEND_FROM are not set, the question is on the timeline only", ticket.reference);
        return;
    }
    const named = [ticket.assignee_email, ticket.account_manager_email].map((e) => (e ?? "").trim().toLowerCase()).filter((e) => e.includes("@"));
    const to = named.length ? [...new Set(named)] : FORM_SUBMISSION_CC;
    const client = (ticket.client_name ?? "").trim() || ticket.client_slug.replace(/-dashboard$/, "");
    const pageUrl = `${SITE}/${ticket.client_slug}/help/requests/${ticket.reference}`;
    const subject = `${client} asked about ${ticket.reference}: ${ticket.title}`;
    const text = [
        `${asker.name} (${asker.email}) asked on ${ticket.reference} "${ticket.title}":`,
        "",
        question,
        "",
        "Reply to this email to answer them directly.",
        `Request page: ${pageUrl}`,
        ...(ticket.asana_task_url ? [`Asana task: ${ticket.asana_task_url}`] : []),
    ].join("\n");
    const html = `<p><strong>${escapeHtml(asker.name)}</strong> (${escapeHtml(asker.email)}) asked on ${escapeHtml(ticket.reference)} &ldquo;${escapeHtml(ticket.title)}&rdquo;:</p>
<blockquote style="margin:0 0 16px;padding:0 0 0 12px;border-left:3px solid #ccc;white-space:pre-wrap">${escapeHtml(question)}</blockquote>
<p>Reply to this email to answer them directly.</p>
<p><a href="${pageUrl}">Request page</a>${ticket.asana_task_url ? ` &middot; <a href="${escapeHtml(ticket.asana_task_url)}">Asana task</a>` : ""}</p>`;

    try {
        const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ from, to, reply_to: asker.email, subject, text, html }),
            signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) console.error("[ticket-ask] Resend failed", res.status, ticket.reference);
    } catch (err) {
        console.error("[ticket-ask] Resend could not be reached", err instanceof Error ? err.message : String(err), ticket.reference);
    }
};

export default async (req: Request) => {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

    const parsed = await readJson<{ slug?: unknown; accessToken?: unknown; reference?: unknown; question?: unknown }>(req);
    if (!parsed.ok) return parsed.response;

    try {
        const gate = await verifyCaller(String(parsed.body.slug ?? ""), accessTokenFrom(req, parsed.body));
        if (!gate.ok) return jsonError(gate.status, gate.error, gate.reason);

        const reference = cleanText(parsed.body.reference, 40).toUpperCase();
        if (!REFERENCE.test(reference)) return jsonError(400, "That is not a request reference.");

        const cleaned = cleanQuestion(parsed.body.question);
        if (!cleaned.ok) return jsonError(400, cleaned.error);

        const db = reportingDb();

        // Scoped by the verified slug, as every ticket read is: another client's reference is a 404.
        const { data: ticket, error } = await db
            .from("tickets")
            .select("id, reference, title, status, client_slug, client_name, assignee_email, account_manager_email, asana_task_url")
            .eq("reference", reference)
            .eq("client_slug", gate.caller.slug)
            .maybeSingle();

        if (error) {
            console.error("[ticket-ask] read failed", error.message);
            return jsonError(500, "Could not load that request.");
        }
        if (!ticket) return jsonError(404, "We could not find a request with that reference.");

        const row = ticket as unknown as TicketRow;
        if (!OPEN_STATUSES.includes(row.status)) return jsonError(422, "That request is finished, so there is nobody working on it to ask. Raise a new request if something else is needed.");

        const { data: event, error: eventErr } = await db
            .from("ticket_events")
            .insert({ ticket_id: row.id, kind: "client_question", body: cleaned.question, actor_email: gate.caller.email, actor_name: gate.caller.name })
            .select(EVENT_COLUMNS)
            .single();

        if (eventErr || !event) {
            if (eventErr && /invalid input value for enum/i.test(eventErr.message)) {
                console.error("[ticket-ask] client_question is not on ticket_event_kind yet, run the alter type in this file's header", reference);
                return jsonError(503, "Asking for an update is not switched on yet. Email your account manager and they will let you know.");
            }
            console.error("[ticket-ask] event insert failed", eventErr?.message, reference);
            return jsonError(500, "We could not send your question. Nothing was sent - try again in a moment.");
        }

        await emailTheTeam(row, { email: gate.caller.email, name: gate.caller.name }, cleaned.question);

        return Response.json({ event }, { status: 201 });
    } catch (err) {
        if (err instanceof ConfigError) {
            console.error("[ticket-ask] not configured", err.message);
            return jsonError(500, "The Help Center is not configured. Ask your account manager to tell the web team.");
        }
        console.error("[ticket-ask] unexpected failure", err instanceof Error ? err.message : String(err));
        return jsonError(500, "Something went wrong at our end.");
    }
};
