/**
 * 03 REQUEST DETAIL - one request, its timing, who owns it, and everything that has
 * happened to it. Built to the Figma file's "3 Request detail" frames (118:26 at 1440,
 * 122:60 at 390) node for node; an automated proof holds the page against them.
 *
 * Reading order is the same at both widths: the title and its meta line, the promise
 * block, the four facts, the timeline, the team's updates. On the desktop all of that
 * sits in one card with 24 of padding and 24 between blocks; at 390 the card falls away
 * and the promise, the timeline and each update stand as their own cards in the 16
 * rhythm of the mobile frame, with the facts as bordered tiles two to a row.
 *
 * ── NO INVENTED DATES ───────────────────────────────────────────────────────
 * The promise block is drawn only when `promised_date` is set (or the request is
 * closed, when it shows the day it closed). No date, no block: a page that implied a
 * date would be doing exactly what this feature exists to stop. The timeline's stamps
 * are the events' own, and its one forward-looking line ("Expected Friday 12
 * September.") repeats the promised date already on the page.
 *
 * ── WHAT IS DELIBERATELY NOT SHOWN ──────────────────────────────────────────
 * `route_failed` and `promised_date_set` never reach the timeline. The first means the
 * topic had no Asana board or no default assignee, so the brain refused to open an
 * unowned task and told the account manager instead: that is us handling it, and to
 * the client the request is simply still "Received", which is the truth. The second is
 * already on the page as the promise block.
 *
 * ── TIMES ───────────────────────────────────────────────────────────────────
 * Stamps are shown in the client's own time zone, as the browser renders them, with a
 * 24-hour clock: "8 September, 16:12".
 *
 * House style: no em or en dashes anywhere.
 */
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { type CallerProof, HelpApiError, fetchTicket, withdrawTicket } from "@/pages/client/help/help-api";
import { Button, Card, ErrorIcon, Eyebrow, MonoRef, type PillTone, SpinnerIcon, StatusPill } from "@/pages/client/help/help-atoms";
import {
    STATUS_META,
    type StepState,
    type Ticket,
    type TicketEvent,
    type TicketStatus,
    type TicketTopic,
    actorName,
    canWithdraw,
    elapsedLabel,
    formatDayMonth,
    formatDayMonthTime,
    formatWeekdayDayMonth,
    isTeamAddress,
    timelineSteps,
    topicLabel,
} from "@/pages/client/help/help-model";
import { cx } from "@/utils/cx";
import { Linkified } from "@/utils/linkify";

/* ── Small pieces ────────────────────────────────────────────────────────── */

/**
 * The file's Status/Pill by ticket status. "received" has no variant of its own and is
 * shown as the blue "with the team" pill, because that is where such a request is.
 */
const PILL_TONE: Record<TicketStatus, PillTone> = {
    received: "with-the-team",
    assigned: "with-the-team",
    in_progress: "in-progress",
    completed: "done",
    withdrawn: "withdrawn",
};

/** The two spaces either side of the dot are the frame's, kept as non-breaking spaces so one text node survives white-space collapsing. */
const DOT = "  ·  ";

/**
 * The Button atom does not set the cursor (Tailwind v4's preflight leaves a button at
 * the default arrow), and the owner's rule is that everything clickable shows a
 * pointer, so every Button here is given cursor-pointer while it is clickable.
 */
/** body/helper, text/tertiary: the sentence under a step, a fact's hint, the withdraw link. */
const HELPER_TERTIARY = "hc-t-body-helper text-(--hc-text-tertiary)";

const Spinner = ({ label }: { label: string }) => (
    <div role="status" aria-live="polite" className={cx("flex items-center justify-center gap-3 py-16", HELPER_TERTIARY)}>
        <SpinnerIcon className="text-(--hc-border-brand)" />
        {label}
    </div>
);

/** A failure the client can act on, with the retry beside it rather than somewhere else. */
const ErrorNote = ({ message, onRetry }: { message: string; onRetry?: () => void }) => (
    <Card flat className="flex flex-col gap-3 border-(--hc-border-error)!">
        <div className="flex items-start gap-3">
            <ErrorIcon className="mt-0.5 text-(--hc-text-error-primary)" />
            <p className="hc-t-body-input min-w-0 flex-1 text-(--hc-text-primary)" role="alert">
                {message}
            </p>
        </div>
        {onRetry && (
            <Button variant="secondary" className="cursor-pointer" onClick={onRetry}>
                Try again
            </Button>
        )}
    </Card>
);

/* ── The promise block ───────────────────────────────────────────────────── */

/**
 * The frame's "Promise" (129:94 / 122:80): bg/brand-primary with a 1px border/brand.
 * On the desktop a row, radius/2xl, padding 20 by 24, the date column then the pill,
 * centred; at 390 a column, radius/xl, padding 16, gap 6, with the card shadow, and no
 * line under the date. "COMMITTED" in caption/meta, the date in display/hero
 * (display/title at 390), the line in body/helper text/secondary.
 *
 * Only when there is a date. A closed request shows the day it closed instead, under
 * the matching word, so the biggest type on the page is always a day that is true.
 */
const PromiseBlock = ({ ticket }: { ticket: Ticket }) => {
    const am = (ticket.account_manager_name ?? "").trim() || "Your account manager";
    let eyebrow = "";
    let day = "";
    let line = "";
    if (ticket.status === "completed" && ticket.completed_at) {
        eyebrow = "COMPLETED";
        day = formatWeekdayDayMonth(ticket.completed_at);
        line = "Done. Nothing more is needed from you.";
    } else if (ticket.status === "withdrawn" && ticket.withdrawn_at) {
        eyebrow = "WITHDRAWN";
        day = formatWeekdayDayMonth(ticket.withdrawn_at);
        line = "Nothing more will happen on it. It stays on your list.";
    } else if (ticket.status !== "completed" && ticket.status !== "withdrawn" && ticket.promised_date) {
        eyebrow = "COMMITTED";
        day = formatWeekdayDayMonth(ticket.promised_date);
        line = `${am} will confirm on completion. No action is required from you.`;
    }
    if (!day) return null;

    return (
        <div
            className={cx(
                "flex flex-col gap-1.5 rounded-(--hc-radius-xl) border border-(--hc-border-brand) bg-(--hc-bg-brand-primary) p-[15px] shadow-(--hc-elevation-card)",
                "sm:flex-row sm:items-center sm:gap-6 sm:rounded-(--hc-radius-2xl) sm:px-[23px] sm:py-[19px] sm:shadow-none",
            )}
        >
            <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:gap-1">
                <Eyebrow>{eyebrow}</Eyebrow>
                <p className="hc-t-display-title sm:hc-t-display-hero text-(--hc-text-primary)">{day}</p>
                <p className="hc-t-body-helper hidden text-(--hc-text-secondary) sm:block">{line}</p>
            </div>
            <StatusPill label={STATUS_META[ticket.status].label} tone={PILL_TONE[ticket.status]} className="self-start sm:self-center" />
        </div>
    );
};

/* ── The four facts ──────────────────────────────────────────────────────── */

/**
 * One fact (118:54 / 122:86): caption/meta over label/field, gap 4, 64 tall. A
 * bg/secondary tile with 12 by 16 padding on the desktop; at 390 a bg/primary tile
 * with a 1px border/secondary and 12 by 14 padding (13 plus the border).
 */
const Fact = ({ label, value }: { label: string; value: string }) => (
    <div className="flex flex-col gap-1 rounded-(--hc-radius-lg) border border-(--hc-border-secondary) bg-(--hc-bg-primary) px-[13px] py-[11px] sm:border-0 sm:bg-(--hc-bg-secondary) sm:px-4 sm:py-3">
        <Eyebrow>{label}</Eyebrow>
        <p className="hc-t-label-field text-(--hc-text-primary)">{value}</p>
    </div>
);

/**
 * PROPERTY / ASSIGNED TO / ACCOUNT MANAGER / ELAPSED: one row of four on the desktop
 * (gap 8), two rows of two at 390 (8 across, 16 down, the body's rhythm). Every cell
 * renders even when its value is empty: a missing "Assigned to" is information
 * ("nobody yet"), and collapsing the cell would reflow the grid per request.
 */
const FactRow = ({ ticket }: { ticket: Ticket }) => {
    const owner = (ticket.assignee_name ?? "").trim();
    // The manager's full name is on the ticket; the mailbox name, capitalised, is the
    // fallback when it is missing ("chiara@hiddengem.media" reads as "Chiara").
    const amName = (ticket.account_manager_name ?? "").trim();
    const amLocal = (ticket.account_manager_email ?? "").trim().split("@")[0] ?? "";
    const am = amName || (amLocal ? amLocal.charAt(0).toUpperCase() + amLocal.slice(1) : "");
    const property = (ticket.property ?? "").trim();
    const elapsed = elapsedLabel(ticket);
    // "Not yet" promises something on an open request; a closed one gets a plain "None".
    const none = canWithdraw(ticket) ? "Not yet" : "None";
    return (
        <div className="grid grid-cols-2 gap-x-2 gap-y-4 sm:grid-cols-4 sm:gap-2">
            <Fact label="PROPERTY" value={property || "All properties"} />
            <Fact label="ASSIGNED TO" value={owner || none} />
            <Fact label="ACCOUNT MANAGER" value={am || none} />
            <Fact label="ELAPSED" value={elapsed || "Today"} />
        </div>
    );
};

/* ── The timeline ────────────────────────────────────────────────────────── */

/**
 * The frame's step marker (118:68): a 24px circle in caption/meta. A tick on the
 * success tint for a step that happened, a dot on the warning tint for the current
 * one, its number on bg/tertiary with a hairline for one still to come. The glyph is a
 * text node, as the frame draws it, so it is not hidden from assistive technology: the
 * step's own words carry the state either way.
 */
const StepDot = ({ state, n }: { state: StepState; n: number }) => (
    <span
        className={cx(
            "hc-t-caption-meta flex size-6 shrink-0 items-center justify-center rounded-(--hc-radius-full)",
            state === "done" && "bg-(--hc-utility-success-bg) text-(--hc-utility-success-fg)",
            state === "now" && "bg-(--hc-utility-warning-bg) text-(--hc-utility-warning-fg)",
            state === "todo" && "border border-(--hc-border-secondary) bg-(--hc-bg-tertiary) text-(--hc-text-tertiary)",
        )}
    >
        {state === "done" ? "✓" : state === "now" ? "•" : n}
    </span>
);

/**
 * The timeline (118:66 / 122:99): steps 42 tall, the marker then the words with 12
 * between, label/field over body/helper text/tertiary with 2 between. 16 between steps
 * on the desktop, where it sits bare inside the request card; at 390 it is its own
 * card (bg/primary, border/secondary, radius/xl, padding 16, the card shadow) with 14
 * between steps. The 390 frame writes a shorter sentence under a step (just the
 * time), so both sentences are rendered as whole text nodes and one is shown per width.
 */
const Timeline = ({ ticket, events }: { ticket: Ticket; events: TicketEvent[] }) => {
    const steps = timelineSteps(ticket, events);
    return (
        <ol
            aria-label="Timeline"
            className="flex flex-col gap-3.5 rounded-(--hc-radius-xl) border border-(--hc-border-secondary) bg-(--hc-bg-primary) p-[15px] shadow-(--hc-elevation-card) sm:gap-4 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none"
        >
            {steps.map((step, i) => (
                <li key={step.key} className="flex items-start gap-3" aria-current={step.state === "now" ? "step" : undefined}>
                    <StepDot state={step.state} n={i + 1} />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <p className="hc-t-label-field text-(--hc-text-primary)">{step.label}</p>
                        {step.wide === step.narrow ? (
                            <p className={HELPER_TERTIARY}>
                                <Linkified text={step.wide} />
                            </p>
                        ) : (
                            <>
                                <p className={cx(HELPER_TERTIARY, "sm:hidden")}>{step.narrow}</p>
                                <p className={cx(HELPER_TERTIARY, "hidden sm:block")}>
                                    <Linkified text={step.wide} />
                                </p>
                            </>
                        )}
                    </div>
                </li>
            ))}
        </ol>
    );
};

/* ── Team updates ────────────────────────────────────────────────────────── */

/**
 * Every update is signed: "Kyle Zinger  ·  9 September, 10:04" is one text node in
 * label/field, the words under it in body/helper text/secondary (body/input at 390).
 *
 * Desktop (118:91): a hairline above, 16 of padding, "TEAM UPDATES", then each update
 * with 12 between. 390 (122:124): every update is its own card, "TEAM UPDATE" in it,
 * with 6 between its three lines. Both trees are in the DOM and the width picks one;
 * the hidden one is display:none, so it is neither drawn nor read out.
 */
const TeamUpdates = ({ events }: { events: TicketEvent[] }) => {
    const updates = events.filter((e) => e.kind === "team_update" && (e.body ?? "").trim());
    if (updates.length === 0) return null;
    const signed = (e: TicketEvent) => `${actorName(e)}${DOT}${formatDayMonthTime(e.created_at)}`;

    return (
        <>
            <section aria-label="Team updates" className="hidden flex-col gap-3 border-t border-(--hc-border-secondary) pt-[15px] sm:flex">
                <Eyebrow>TEAM UPDATES</Eyebrow>
                <ul className="flex flex-col gap-3">
                    {updates.map((e) => (
                        <li key={e.id} className="flex flex-col gap-1">
                            <p className="hc-t-label-field whitespace-pre text-(--hc-text-primary)">{signed(e)}</p>
                            <p className="hc-t-body-helper whitespace-pre-wrap text-(--hc-text-secondary)">
                                <Linkified text={e.body!.trim()} />
                            </p>
                        </li>
                    ))}
                </ul>
            </section>
            <ul aria-label="Team updates" className="flex flex-col gap-4 sm:hidden">
                {updates.map((e) => (
                    <Card as="li" key={e.id} className="flex flex-col gap-1.5">
                        <Eyebrow>TEAM UPDATE</Eyebrow>
                        <p className="hc-t-label-field whitespace-pre text-(--hc-text-primary)">{signed(e)}</p>
                        <p className="hc-t-body-input whitespace-pre-wrap text-(--hc-text-secondary)">
                            <Linkified text={e.body!.trim()} />
                        </p>
                    </Card>
                ))}
            </ul>
        </>
    );
};

/* ── Withdrawing ─────────────────────────────────────────────────────────── */

/**
 * The frame draws no withdraw control, so this is a text link in body/helper
 * text/tertiary under the card, and nothing more until it is pressed. Then a two-step
 * confirm, in the page rather than window.confirm (which cannot be styled, is
 * announced badly, and on a phone appears detached from the thing it is about). The
 * confirm names the request and says in plain words that the row is kept: withdrawing
 * closes a request and never deletes it, and a client who thinks "withdraw" means
 * "delete" will not use it.
 */
const WithdrawBlock = ({ ticket, proof, onWithdrawn }: { ticket: Ticket; proof: CallerProof; onWithdrawn: () => void }) => {
    const [confirming, setConfirming] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    if (!canWithdraw(ticket)) return null;
    // ONLY THE PERSON WHO RAISED IT. That is the server's rule (a colleague on the same
    // dashboard gets 403, staff get 403), and a control the server will refuse should
    // not be on the page. submitted_by is on the detail read for exactly this comparison.
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

    if (!confirming) {
        return (
            <button
                type="button"
                onClick={() => setConfirming(true)}
                // 16 under the card on the desktop, where the column's rhythm is 40.
                className={cx("hc-hover w-max cursor-pointer rounded-(--hc-radius-sm) hover:underline sm:-mt-6", HELPER_TERTIARY)}
            >
                Withdraw this request
            </button>
        );
    }

    return (
        <Card as="section" flat className="flex flex-col gap-3 sm:-mt-6">
            <p className="hc-t-label-field text-(--hc-text-primary)">Withdraw {ticket.reference}?</p>
            <p className={cx("max-w-[60ch]", HELPER_TERTIARY)}>
                We will stop work on it and mark it withdrawn. It stays on your list with everything on it, so you can always look back at what you asked for.
            </p>
            {error && (
                <p className="hc-t-body-helper text-(--hc-text-error-primary)" role="alert">
                    {error}
                </p>
            )}
            {/* Full width and the primary on top at 390 (build notes); two 176 buttons on the desktop. */}
            <div className="flex flex-col-reverse gap-2 sm:grid sm:grid-cols-[176px_176px]">
                <Button variant="secondary" fill disabled={busy} className={busy ? undefined : "cursor-pointer"} onClick={() => setConfirming(false)}>
                    Keep it open
                </Button>
                <Button fill loading={busy} className={busy ? undefined : "cursor-pointer"} onClick={submit}>
                    {busy ? "Withdrawing" : "Yes, withdraw it"}
                </Button>
            </div>
        </Card>
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

    // The 390 frame's body starts 20 under the top bar where the shell (shared with the
    // other help screens) gives 24, hence the 4px pull-up below 640px. body/input at
    // 390, body/helper on the desktop, text/brand-secondary at both.
    const shell = (children: ReactNode) => (
        <div className="-mt-1 flex flex-col gap-4 sm:mt-0 sm:gap-10">
            <Link to={`/${slug}/help/requests`} className="hc-t-body-input sm:hc-t-body-helper hc-hover w-max rounded-(--hc-radius-sm) text-(--hc-text-brand-secondary) hover:underline">
                All requests
            </Link>
            {children}
        </div>
    );

    if (loading) return shell(<Spinner label={`Opening ${reference}`} />);

    if (missing || !ticket) {
        return shell(
            <Card className="flex flex-col items-center gap-2 px-5 py-12 text-center">
                <p className="hc-t-heading-section text-(--hc-text-primary)">We cannot find {reference}</p>
                <p className={cx("max-w-[44ch]", HELPER_TERTIARY)}>Check the reference, or open it from your list of requests.</p>
                <Button to={`/${slug}/help/requests`} className="mt-3 cursor-pointer">
                    See my requests
                </Button>
            </Card>,
        );
    }

    const byline = isTeamAddress(ticket.submitted_by)
        ? `raised for you by ${(ticket.submitted_by_name ?? "").trim() || "HiddenGem Media"}, ${formatDayMonth(ticket.created_at)}`
        : `submitted ${(ticket.submitted_by_name ?? "").trim() ? `by ${ticket.submitted_by_name!.trim()}, ` : ""}${formatDayMonth(ticket.created_at)}`;
    const topic = topicLabel(topics, ticket.topic);

    return shell(
        <>
            {error && <ErrorNote message={error} onRetry={() => void load()} />}

            {/* The frame's "Request" card (118:41): bg/primary, 1px border/secondary,
                radius/xl, the card shadow, 24 padding, 24 between blocks. At 390 the card
                has no chrome and the blocks stand 16 apart. */}
            <article className="flex flex-col gap-4 sm:gap-6 sm:rounded-(--hc-radius-xl) sm:border sm:border-(--hc-border-secondary) sm:bg-(--hc-bg-primary) sm:p-[23px] sm:shadow-(--hc-elevation-card)">
                <header className="flex flex-col gap-1.5">
                    <h1 className="hc-t-display-title sm:hc-t-display-hero text-(--hc-text-primary)">{ticket.title}</h1>
                    <p className="flex items-center gap-2">
                        <MonoRef>{ticket.reference}</MonoRef>
                        {/* One text node either way: the 390 frame stops at the topic, the
                            1440 frame carries on to who raised it and when. */}
                        <span className={cx("whitespace-pre sm:hidden", HELPER_TERTIARY)}>{topic}</span>
                        <span className={cx("hidden whitespace-pre sm:inline", HELPER_TERTIARY)}>{`${topic}${DOT}${byline}`}</span>
                    </p>
                </header>

                <PromiseBlock ticket={ticket} />
                <FactRow ticket={ticket} />
                <Timeline ticket={ticket} events={events} />
                <TeamUpdates events={events} />
            </article>

            <WithdrawBlock
                ticket={ticket}
                proof={proof}
                onWithdrawn={() => {
                    void load();
                    onTicketChanged();
                }}
            />
        </>,
    );
};
