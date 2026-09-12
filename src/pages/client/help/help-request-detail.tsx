/**
 * 03 REQUEST DETAIL - one request, its timing, who owns it, and everything that has
 * happened to it.
 *
 * Reading order is fixed by the approved design and is the same at every width: the timing
 * block, then PROPERTY / ASSIGNED TO / ACCOUNT MANAGER / ELAPSED, then the timeline, then
 * the team's updates. On a phone that puts the timing block above everything else, which is
 * the one thing a client opens this screen to find; on a desktop the four facts spread into
 * a single row instead of stacking, so the timeline starts above the fold rather than being
 * pushed down by a column of labels.
 *
 * ── NO INVENTED DATES ───────────────────────────────────────────────────────
 * Everything this screen says about timing comes from promiseBlock() in help-model.ts and
 * nothing else. There is no fallback string here, no "usually", no date arithmetic. Read
 * that function's header before touching the timing block.
 *
 * ── WHAT IS DELIBERATELY NOT SHOWN ──────────────────────────────────────────
 * `route_error` and the `route_failed` event never reach this screen. They mean the topic
 * had no Asana board or no default assignee so the brain refused to open an unowned task
 * and told the account manager instead. That is us handling it. To the client the request
 * is simply still "Received", which is the truth.
 */
import { useCallback, useEffect, useState } from "react";
import { ArrowNarrowLeft, Calendar, Folder, Image01 } from "@untitledui-pro/icons/line";
import { type CallerProof, HelpApiError, fetchTicket, withdrawTicket } from "@/pages/client/help/help-api";
import {
    CLIENT_VISIBLE_EVENTS,
    EVENT_LABEL,
    type PromiseTone,
    type Ticket,
    type TicketEvent,
    type TicketTopic,
    actorName,
    canWithdraw,
    elapsedLabel,
    formatDayLong,
    formatStampShort,
    formatStampWithTime,
    initialOf,
    isTeamAddress,
    promiseBlock,
    topicLabel,
} from "@/pages/client/help/help-model";
import {
    ErrorNote,
    Eyebrow,
    FOCUS,
    HelpSpinner,
    MonoRef,
    Panel,
    PrimaryButton,
    SecondaryButton,
    StatusPill,
    T,
    TextLink,
} from "@/pages/client/help/help-requests-screen";
import { cx } from "@/utils/cx";
import { Linkified } from "@/utils/linkify";


/* ── The promise block ───────────────────────────────────────────────────── */

/**
 * The Figma's "Promise" block: full width under the title, bg/brand-primary with a hairline
 * in border/brand, radius/2xl, 20 by 24 padding. "PROMISED" in caption/meta, the date in
 * display/hero (display/title on a phone), a line under it in body/helper, and the status
 * pill on the right.
 *
 * The date is the thing a client opens this page for, so it is the biggest type on the
 * page - and only when there IS one. promiseBlock() decides the headline for every state,
 * including "Received, owner assigned" when no date has been set, because a page that
 * implied a date would be doing exactly what this feature exists to stop.
 */
const TONE_SURFACE: Record<PromiseTone, string> = {
    pending: "bg-secondary ring-secondary",
    dated: "bg-brand-primary ring-brand",
    done: "bg-green-50 ring-green-200",
    closed: "bg-tertiary ring-secondary",
};

const PromiseCard = ({ ticket }: { ticket: Ticket }) => {
    const block = promiseBlock(ticket);
    return (
        <div className={cx("flex flex-col gap-4 rounded-2xl p-4 ring-1 sm:flex-row sm:items-center sm:gap-6 sm:px-6 sm:py-5", TONE_SURFACE[block.tone])}>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
                <Eyebrow>{block.tone === "dated" ? "Promised" : "Where it stands"}</Eyebrow>
                {/* Under a caption that already says PROMISED, the headline is the date and
                    nothing else, as the Figma has it ("Friday 12 September"). */}
                <p className={cx("text-pretty text-primary", T.title, block.tone === "dated" && "sm:text-[40px] sm:leading-[44px] sm:tracking-[-1px]")}>
                    {block.tone === "dated" && ticket.promised_date ? formatDayLong(ticket.promised_date) : block.headline}
                </p>
                <p className={cx(T.helper, "max-w-[60ch] text-pretty text-secondary")}>{block.sub}</p>
            </div>
            <div className="shrink-0">
                <StatusPill status={ticket.status} />
            </div>
        </div>
    );
};

/* ── The four facts ──────────────────────────────────────────────────────── */

/** One fact, per the Figma: caption/meta label over label/field value on a bg/secondary tile. */
const Fact = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
    <div className="flex flex-col gap-1 rounded-[10px] bg-secondary px-4 py-3 ring-1 ring-secondary sm:ring-0">
        <Eyebrow>{label}</Eyebrow>
        <p className={cx(T.label, "text-pretty text-primary")}>{value}</p>
        {hint && <p className={cx(T.helper, "text-tertiary")}>{hint}</p>}
    </div>
);

/**
 * PROPERTY / ASSIGNED TO / YOUR MANAGER / OPEN FOR.
 *
 * Two per row at 390 and one row of four on desktop, exactly as the two Figma frames have
 * it. Every cell renders even when its value is empty: a missing "Assigned to" is
 * information ("nobody yet"), and collapsing the cell would make the grid reflow into a
 * different shape per request.
 */
const FactRow = ({ ticket }: { ticket: Ticket }) => {
    const owner = (ticket.assignee_name ?? "").trim();
    // The mailbox name, capitalised: "chiara@hiddengem.media" reads as "Chiara". Not a
    // full name - we do not hold one - and never a guess at a surname. The address stays
    // on the element for anyone who needs it.
    const amEmail = (ticket.account_manager_email ?? "").trim();
    const amLocal = amEmail.split("@")[0] ?? "";
    const am = amLocal ? amLocal.charAt(0).toUpperCase() + amLocal.slice(1) : "";
    const property = (ticket.property ?? "").trim();
    const elapsed = elapsedLabel(ticket);
    const closed = ticket.status === "completed" || ticket.status === "withdrawn";

    return (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Fact label="Property" value={property || "All properties"} hint={property ? undefined : "Not tied to one listing"} />
            <Fact label="Assigned to" value={owner || "Being assigned"} hint={owner ? undefined : "Named before work starts"} />
            <Fact label="Your manager" value={am || "Your HiddenGem AM"} hint={amEmail || undefined} />
            <Fact label={closed ? "Took" : "Open for"} value={elapsed || "Just now"} />
        </div>
    );
};

/* ── The timeline ────────────────────────────────────────────────────────── */

/**
 * The Figma's timeline: an ordered list of steps, each with a 24px dot on the left. Done
 * steps get a tick on the success tint, the current step a dot on the warning tint, and
 * anything still to come its number on bg/tertiary with a hairline. Step state is in the
 * text as well, never in the colour alone (build notes).
 */
const StepDot = ({ state, n }: { state: "done" | "now" | "todo"; n: number }) => (
    <span
        aria-hidden="true"
        className={cx(
            "flex size-6 shrink-0 items-center justify-center rounded-full tabular-nums",
            T.caption,
            state === "done" && "bg-green-50 text-green-800",
            state === "now" && "bg-yellow-50 text-yellow-800",
            state === "todo" && "bg-tertiary text-tertiary ring-1 ring-secondary",
        )}
    >
        {state === "done" ? "\u2713" : state === "now" ? "\u2022" : n}
    </span>
);

const Timeline = ({ events, ticket }: { events: TicketEvent[]; ticket: Ticket }) => {
    const shown = events.filter((e) => CLIENT_VISIBLE_EVENTS.includes(e.kind));
    if (shown.length === 0) return null;
    const open = ticket.status !== "completed" && ticket.status !== "withdrawn";

    return (
        <section className="flex flex-col gap-4 rounded-xl bg-primary p-4 ring-1 ring-secondary sm:rounded-none sm:p-0 sm:ring-0">
            <h2 className={cx(T.section, "text-primary")}>History</h2>
            <ol className="flex flex-col gap-4">
                {shown.map((e, i) => {
                    const last = i === shown.length - 1;
                    // The newest event on an open request is what is happening now; every
                    // earlier one, and every one on a closed request, is done.
                    const state: "done" | "now" | "todo" = last && open ? "now" : "done";
                    return (
                        <li key={e.id} className="flex gap-3">
                            <StepDot state={state} n={i + 1} />
                            <div className="min-w-0 flex-1">
                                <p className={cx(T.label, "text-primary")}>
                                    {EVENT_LABEL[e.kind]}
                                    {state === "now" && <span className="sr-only"> (current step)</span>}
                                </p>
                                <p className={cx(T.helper, "mt-0.5 text-tertiary")}>
                                    {formatStampWithTime(e.created_at)}
                                    {e.body?.trim() && (
                                        <>
                                            {". "}
                                            <Linkified text={e.body.trim()} />
                                        </>
                                    )}
                                </p>
                            </div>
                        </li>
                    );
                })}
            </ol>
        </section>
    );
};

/* ── Team updates ────────────────────────────────────────────────────────── */

/**
 * Every update is signed. Rule 3 of the design document puts a person's name on every
 * comment written INTO Asana, because that connection is one shared account. The same
 * reasoning applies facing the client. The Figma's "Updates from the team": a hairline
 * above, the caption, then "Name  ·  when" in label/field over the words in body/helper.
 */
const TeamUpdates = ({ events }: { events: TicketEvent[] }) => {
    const updates = events.filter((e) => e.kind === "team_update" && (e.body ?? "").trim());
    if (updates.length === 0) return null;

    return (
        <section className="flex flex-col gap-3 rounded-xl bg-primary p-4 ring-1 ring-secondary sm:rounded-none sm:border-t sm:border-secondary sm:p-0 sm:pt-4 sm:ring-0">
            <Eyebrow>Updates from the team</Eyebrow>
            <ul className="flex flex-col gap-4">
                {updates.map((e) => {
                    const who = actorName(e);
                    return (
                        <li key={e.id} className="flex gap-3">
                            <span
                                aria-hidden="true"
                                className={cx("flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-primary text-fg-brand-primary ring-1 ring-brand", T.caption)}
                            >
                                {initialOf(who)}
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className={cx(T.label, "text-primary")}>
                                    {who}
                                    {"  "}
                                    <span aria-hidden="true" className="text-tertiary">
                                        &middot;
                                    </span>
                                    {"  "}
                                    <span className={cx(T.helper, "font-normal text-tertiary")}>{formatStampWithTime(e.created_at)}</span>
                                </p>
                                <p className={cx(T.body, "mt-1 whitespace-pre-wrap text-pretty text-secondary sm:text-[13px] sm:leading-[18px]")}>
                                    <Linkified text={e.body!.trim()} />
                                </p>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
};

/* ── What the client asked for ───────────────────────────────────────────── */

/**
 * The client's own words, shown back to them verbatim. `derived_subject` is deliberately not
 * rendered: that is the model's summary written for the Asana task, and a client cannot
 * edit our paraphrase of their own request.
 */
const TheirWords = ({ ticket, topics }: { ticket: Ticket; topics: TicketTopic[] }) => {
    const detail = (ticket.detail ?? "").trim();
    const neededBy = formatDayLong(ticket.needed_by);
    const images = ticket.image_count ?? 0;
    const folder = (ticket.drive_folder_url ?? "").trim();

    return (
        <section className="flex flex-col gap-3">
            <h2 className={cx(T.section, "text-primary")}>What you asked for</h2>
            <div className="rounded-[10px] bg-secondary px-4 py-3.5">
                <Eyebrow>{topicLabel(topics, ticket.topic)}</Eyebrow>
                {detail ? (
                    <p className={cx(T.body, "mt-2 whitespace-pre-wrap text-pretty text-secondary sm:text-[13px] sm:leading-[18px]")}>
                        <Linkified text={detail} />
                    </p>
                ) : (
                    <p className={cx(T.helper, "mt-2 text-tertiary")}>No further detail was added.</p>
                )}

                {(neededBy || images > 0 || folder) && (
                    <div className={cx("mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-secondary pt-3 text-tertiary", T.helper)}>
                        {neededBy && (
                            <span className="inline-flex items-center gap-1.5">
                                <Calendar className="size-3.5" aria-hidden="true" />
                                {/* Worded as the client's ask, never as our commitment. */}
                                You asked for this by {neededBy}
                            </span>
                        )}
                        {images > 0 && (
                            <span className="inline-flex items-center gap-1.5">
                                <Image01 className="size-3.5" aria-hidden="true" />
                                {images} {images === 1 ? "image" : "images"} attached
                            </span>
                        )}
                        {folder && (
                            <a
                                href={folder}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={cx("inline-flex min-h-6 items-center gap-1.5 rounded text-fg-brand-primary hover:underline", FOCUS)}
                            >
                                <Folder className="size-3.5" aria-hidden="true" />
                                Open the file folder
                            </a>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
};

/* ── Withdrawing ─────────────────────────────────────────────────────────── */

/**
 * Two-step, in the page.
 *
 * Not window.confirm: it cannot be styled, it is announced badly, and on a phone it appears
 * detached from the thing it is about. The confirm step names the request and says in
 * plain words that the row is kept, because rule 4 is that withdrawing closes a request and
 * never deletes it - and a client who thinks "withdraw" means "delete" will not use it.
 */
const WithdrawBlock = ({ ticket, proof, onWithdrawn }: { ticket: Ticket; proof: CallerProof; onWithdrawn: () => void }) => {
    const [confirming, setConfirming] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    if (!canWithdraw(ticket)) return null;
    // ONLY THE PERSON WHO RAISED IT. That is the server's rule (a colleague on
    // the same dashboard gets 403, staff get 403), and a control the server
    // will refuse should not be on the page: it was being shown to everyone
    // who could open the request, and the first anyone learned of the rule
    // was the refusal after the confirm step. submitted_by is on the detail
    // read for exactly this comparison.
    if ((ticket.submitted_by ?? "").trim().toLowerCase() !== proof.email.trim().toLowerCase()) return null;

    const submit = async () => {
        setBusy(true);
        setError("");
        try {
            await withdrawTicket(proof, ticket.reference);
            onWithdrawn();
        } catch (e) {
            setError(e instanceof HelpApiError ? e.message : "We could not withdraw that just then. Try again in a moment.");
            setBusy(false);
        }
    };

    return (
        <section className="border-t border-secondary pt-4">
            {confirming ? (
                <div className="flex flex-col gap-3">
                    <p className={cx(T.label, "text-primary")}>Withdraw {ticket.reference}?</p>
                    <p className={cx(T.helper, "max-w-[60ch] text-pretty text-tertiary")}>
                        We will stop work on it and mark it withdrawn. It stays on your list with everything on it, so you can always look back at what you
                        asked for.
                    </p>
                    {error && (
                        <p className={cx(T.helper, "text-red-700")} role="alert">
                            {error}
                        </p>
                    )}
                    <div className="flex flex-col-reverse gap-2 sm:flex-row">
                        <SecondaryButton className="h-11" disabled={busy} onClick={() => setConfirming(false)}>
                            Keep it open
                        </SecondaryButton>
                        <button
                            type="button"
                            disabled={busy}
                            onClick={submit}
                            className={cx(
                                "inline-flex h-11 items-center justify-center rounded-lg bg-error-solid px-5 text-white transition duration-100 ease-linear hover:bg-error-solid_hover disabled:opacity-60 motion-reduce:transition-none",
                                T.button,
                                FOCUS,
                            )}
                        >
                            {busy ? "Withdrawing..." : "Yes, withdraw it"}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className={cx(T.helper, "text-tertiary")}>Changed your mind about this request?</p>
                    <button
                        type="button"
                        onClick={() => setConfirming(true)}
                        className={cx("inline-flex min-h-11 items-center rounded px-1 text-red-700 hover:underline", T.helper, "font-medium", FOCUS)}
                    >
                        Withdraw request
                    </button>
                </div>
            )}
        </section>
    );
};

/* ── The screen ──────────────────────────────────────────────────────────── */

export const HelpRequestDetail = ({
    proof,
    reference,
    slug,
    topics,
    onTicketChanged,
}: {
    proof: CallerProof;
    reference: string;
    slug: string;
    topics: TicketTopic[];
    /** Lets the shell refresh its list and counts after a withdrawal. */
    onTicketChanged: () => void;
}) => {
    const [ticket, setTicket] = useState<Ticket | null>(null);
    const [events, setEvents] = useState<TicketEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [missing, setMissing] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        setMissing(false);
        try {
            const res = await fetchTicket(proof, reference);
            setTicket(res.ticket);
            setEvents(res.events ?? []);
        } catch (e) {
            // A reference that is not this client's own comes back as a 404 rather than a
            // 403, so there is nothing to distinguish here: either way this client has no
            // such request, and saying so is both true and non-enumerable.
            if (e instanceof HelpApiError && e.status === 404) setMissing(true);
            else setError(e instanceof HelpApiError ? e.message : "We could not open that request just then.");
        }
        setLoading(false);
    }, [proof, reference]);

    useEffect(() => {
        void load();
    }, [load]);

    const backLink = (
        <TextLink to={`/${slug}/help/requests`} className="w-max">
            <ArrowNarrowLeft className="size-4" aria-hidden="true" />
            Back to my requests
        </TextLink>
    );

    if (loading) {
        return (
            <div className="flex flex-col gap-4">
                {backLink}
                <HelpSpinner label={`Opening ${reference}`} />
            </div>
        );
    }

    if (missing || !ticket) {
        return (
            <div className="flex flex-col gap-4 sm:gap-6">
                {backLink}
                <Panel className="px-5 py-12 text-center">
                    <p className={cx(T.section, "text-primary")}>We cannot find {reference}</p>
                    <p className={cx(T.helper, "mx-auto mt-1.5 max-w-[44ch] text-pretty text-tertiary")}>Check the reference, or open it from your list of requests.</p>
                    <div className="mt-5 flex justify-center">
                        <PrimaryButton as="link" to={`/${slug}/help/requests`}>
                            See my requests
                        </PrimaryButton>
                    </div>
                </Panel>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 sm:gap-6">
            {backLink}

            {error && <ErrorNote message={error} onRetry={() => void load()} />}

            {/* One card on desktop, per the Figma's "Request" frame: 24 padding, 24 between
                blocks. On a phone the card drops its chrome and each block stands alone in
                the 16 rhythm of the mobile frame. Order is identical at both widths. */}
            <article className={cx("flex flex-col gap-5 sm:gap-6 sm:rounded-xl sm:bg-primary sm:p-6 sm:ring-1 sm:ring-secondary", "sm:shadow-[0_1px_2px_rgba(23,23,23,0.04),0_8px_24px_-4px_rgba(23,23,23,0.05)]")}>
                <header className="flex flex-col gap-1.5">
                    <h1 className={cx(T.title, "text-pretty text-primary")}>{ticket.title}</h1>
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <MonoRef>{ticket.reference}</MonoRef>
                        <span className={cx(T.helper, "text-tertiary")}>
                            {topicLabel(topics, ticket.topic)}
                            {"  "}
                            <span aria-hidden="true">&middot;</span>
                            {"  "}
                            {/* A team member raising for a client is named as such: the client
                                should never wonder who "Kyle" is or why he is in their history. */}
                            {isTeamAddress(ticket.submitted_by)
                                ? `raised for you by ${(ticket.submitted_by_name ?? "").trim() || "HiddenGem"} at HiddenGem, `
                                : `submitted ${(ticket.submitted_by_name ?? "").trim() ? `by ${ticket.submitted_by_name!.trim()}, ` : ""}`}
                            {formatStampShort(ticket.created_at)}
                        </span>
                    </p>
                </header>

                <PromiseCard ticket={ticket} />
                <FactRow ticket={ticket} />
                <TheirWords ticket={ticket} topics={topics} />
                <Timeline events={events} ticket={ticket} />
                <TeamUpdates events={events} />
                <WithdrawBlock
                    ticket={ticket}
                    proof={proof}
                    onWithdrawn={() => {
                        void load();
                        onTicketChanged();
                    }}
                />
            </article>
        </div>
    );
};
