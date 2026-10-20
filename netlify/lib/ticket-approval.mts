/**
 * The pure half of ticket-approve.mts (owner, 20 Oct 2026): where the platform's approve
 * endpoint is, and what each of its answers means in a sentence staff can act on.
 *
 * Here rather than in the function so ticket-approval.check.mts can hold both without a
 * network: every top-level file in netlify/functions is an endpoint, so a check beside the
 * function would be one too.
 *
 * ── THE PLATFORM'S ANSWERS (the contract hiddengem-ai is built against) ─────
 *   200 { ok: true, email: "sent" | "queued" | "retrying" | "failed" | "not_sent" | "not_applicable" }
 *   200 { ok: true, already: true }          approved before; pressing again is safe
 *   409 { error: "not_in_review", status }   the request is not waiting for approval
 *   401                                      the key we sent is not the one it expects
 *
 * House style: no em or en dashes anywhere.
 */

/** What the platform says about the client's completion email. Passed to the screen as it is. */
export const EMAIL_OUTCOMES = ["sent", "queued", "retrying", "failed", "not_sent", "not_applicable"] as const;
export type EmailOutcome = (typeof EMAIL_OUTCOMES)[number];

const RECEIVED_TAIL = /\/received\/?$/;

/**
 * BRAIN_TICKET_APPROVE_URL when it is set; otherwise BRAIN_TICKETS_RECEIVED_URL with its
 * trailing /received made /approve. Undefined when neither gives one: a received URL of any
 * other shape is never posted to, because an approval sent to the routing endpoint would
 * approve nothing and look to the AM as if it had.
 */
export const approveUrlFrom = (override: string | undefined, received: string | undefined): string | undefined => {
    const set = (override ?? "").trim();
    if (set) return set;
    const r = (received ?? "").trim();
    return RECEIVED_TAIL.test(r) ? r.replace(RECEIVED_TAIL, "/approve") : undefined;
};

const STATUS_WORDS: Record<string, string> = { received: "received", assigned: "assigned", in_progress: "in progress", withdrawn: "withdrawn" };

/** The 409 sentence: what the request is instead of awaiting review, read off the portal's row or the platform's answer. */
export const notInReview = (reference: string, status: unknown): string => {
    if (status === "completed") return `${reference} is already completed, so the client already sees it done. There is nothing to approve.`;
    const word = typeof status === "string" ? STATUS_WORDS[status] : undefined;
    return `${reference} is ${word ? `${word}, not awaiting review` : "not awaiting review"}, so there is nothing to approve. Reload the page to see where it stands.`;
};

/** Said when the platform did not answer inside the budget: it may still have approved. */
export const TIMED_OUT = "The approval is taking longer than usual and may still be finishing. Reload this page in a minute to see where it stands.";
/** Said when the platform could not be reached at all. */
export const UNREACHABLE = "We could not reach the approval service just then. Try again in a moment: approving twice is safe.";

export type ApproveAnswer = { status: 200; body: { approved: true; already: boolean; email: EmailOutcome | null } } | { status: 409 | 502; body: { error: string } };

/**
 * The platform's answer as the screen gets it. Any 2xx with ok is approved (`email` null when
 * the platform named no outcome we know, so the page claims nothing about the email). The 409
 * keeps its status and gains a sentence. A 401 is our key, and anything else is a 502 that says
 * trying again is safe, because a second approval is answered with `already`.
 */
export const platformAnswer = (reference: string, status: number, body: unknown): ApproveAnswer => {
    const b = (body && typeof body === "object" ? body : {}) as { ok?: unknown; already?: unknown; email?: unknown; error?: unknown; status?: unknown };
    if (status >= 200 && status < 300 && b.ok === true) {
        const email = (EMAIL_OUTCOMES as readonly unknown[]).includes(b.email) ? (b.email as EmailOutcome) : null;
        return { status: 200, body: { approved: true, already: b.already === true, email } };
    }
    if (status === 409 && b.error === "not_in_review") return { status: 409, body: { error: notInReview(reference, b.status) } };
    if (status === 401) return { status: 502, body: { error: "The approval service did not accept the portal's key, so nothing was approved. Tell the web team." } };
    return { status: 502, body: { error: "The approval service could not approve it just then. Try again in a moment: approving twice is safe." } };
};
