/**
 * 03 REQUEST DETAIL - one request, where it stands, and everything that has happened to
 * it. Built to the Figma file's "3 Request detail" frames (118:26 at 1440, 122:60 at 390)
 * node for node, with the owner's changes of 28 Sep 2026 on top (the parity proof carries
 * them as owner changes); an automated proof holds the page against them.
 *
 * Reading order is the same at both widths: the title and its meta line, the status block,
 * the four facts, the timeline, the team's updates. On the desktop all of that sits in one
 * card with 24 of padding and 24 between blocks; at 390 the card falls away and the status,
 * the timeline and each update stand as their own cards in the 16 rhythm of the mobile
 * frame, with the facts as bordered tiles two to a row.
 *
 * ── NO ESTIMATED DATES, NO ASSIGNEE ─────────────────────────────────────────
 * Owner, 28 Sep 2026: "Do not give a date estimate, only show when the date is complete",
 * then "Remove the assigned to" (and "Actually, leave time elapsed"). So while a request is
 * open the status block names its status and who confirms completion (the account manager),
 * with no date; once it is completed or withdrawn it carries that day. The facts are
 * PROPERTY, SUBMITTED BY, ACCOUNT MANAGER and ELAPSED: SUBMITTED BY stands where the Assigned
 * to tile was, and the timeline's "Assigned to" step is gone. ELAPSED is time since the
 * request was raised, never time left. The functions do not send a client the promised date
 * or the assignee at all (ticket-columns.mts, clientView).
 *
 * ── WHAT IS DELIBERATELY NOT SHOWN ──────────────────────────────────────────
 * `route_failed`, `assigned` and `promised_date_set` never reach a client's timeline; the
 * function leaves them out (ticket-detail.mts). The first means the topic had no Asana board
 * or no default assignee, so the brain refused to open an unowned task and told the account
 * manager instead: that is us handling it, and to the client the request is simply still
 * "Received", which is the truth. The other two name the assignee and the promised date.
 *
 * ── PAGES AND FILES ─────────────────────────────────────────────────────────
 * What the request is about and what came with it, as two tiles under the four facts:
 * PAGES (each address a link, re-checked for http or https as it is drawn) and FILES
 * (each file's type, name and size). Tiles rather than a fifth fact: the fact row is a
 * fixed grid of four 64px cells the frame pins, and ten addresses do not fit a cell. They
 * render only when there is something in them, so a request with neither looks exactly as
 * the frame draws it.
 *
 * ── TIMES ───────────────────────────────────────────────────────────────────
 * Stamps are shown in the client's own time zone, as the browser renders them, with a
 * 24-hour clock: "8 September, 16:12".
 *
 * House style: no em or en dashes anywhere.
 */
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { type CallerProof, HelpApiError, fetchTicket, withdrawTicket } from "@/pages/client/help/help-api";
import { Button, Card, ErrorIcon, Eyebrow, MonoRef, type PillTone, SpinnerIcon, StatusPill, formatFileSize } from "@/pages/client/help/help-atoms";
import {
    STATUS_META,
    type StepState,
    type Ticket,
    type TicketEvent,
    type TicketFile,
    type TicketStatus,
    type TicketTopic,
    actorName,
    canWithdraw,
    displayUrl,
    elapsedLabel,
    formatDayMonth,
    formatDayMonthTime,
    formatWeekdayDayMonth,
    isTeamAddress,
    isWebLink,
    timelineSteps,
    topicLabel,
} from "@/pages/client/help/help-model";
import { FILE_TYPES } from "@/pages/client/help/request-rules";
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

/* ── The status block ────────────────────────────────────────────────────── */

/**
 * The account manager as the page names them: the full name on the ticket, else the mailbox
 * name capitalised ("chiara@hiddengem.media" reads as "Chiara"), else "". One answer for the
 * status sentence and the ACCOUNT MANAGER tile, so the sentence never says "Your account
 * manager" beside a tile that names her.
 */
const accountManagerName = (ticket: Ticket): string => {
    const name = (ticket.account_manager_name ?? "").trim();
    const local = (ticket.account_manager_email ?? "").trim().split("@")[0] ?? "";
    return name || (local ? local.charAt(0).toUpperCase() + local.slice(1) : "");
};

/**
 * The frame's "Promise" (129:94 / 122:80), now the request's status: bg/brand-primary with a
 * 1px border/brand. On the desktop a row, radius/2xl, padding 20 by 24; at 390 a column,
 * radius/xl, padding 16, gap 6, with the card shadow. The eyebrow in caption/meta, the big
 * line in display/hero (display/title at 390), the sentence in body/helper text/secondary.
 *
 *   open        STATUS, then the status itself ("In progress"), then who confirms
 *               completion. No date and no pill: the big line is the status, and a request
 *               that is not done has no date a client is shown (owner, 28 Sep 2026)
 *   completed   COMPLETED, the day it was completed, and the status pill
 *   withdrawn   WITHDRAWN, the day it was withdrawn, and the status pill
 *
 * The sentence under an open request names the account manager, and, when an address is on
 * the request and the switch is on, says where its completion notice goes. It is true before
 * the platform can send: it names the address's purpose, never that an email was or will be
 * sent. The 390 frame draws no sentence; the one exception is that completion notice.
 */
const StatusBlock = ({ ticket }: { ticket: Ticket }) => {
    const am = accountManagerName(ticket);
    let eyebrow = "STATUS";
    let headline: string = STATUS_META[ticket.status].label;
    let line = "";
    let closed = false;
    if (ticket.status === "completed" && ticket.completed_at) {
        eyebrow = "COMPLETED";
        headline = formatWeekdayDayMonth(ticket.completed_at);
        line = "Done. Nothing more is needed from you.";
        closed = true;
    } else if (ticket.status === "withdrawn" && ticket.withdrawn_at) {
        eyebrow = "WITHDRAWN";
        headline = formatWeekdayDayMonth(ticket.withdrawn_at);
        line = "Nothing more will happen on it. It stays on your list.";
        closed = true;
    } else if (canWithdraw(ticket)) {
        line = ticket.completion_email_set
            ? `${am || "Your account manager"} will confirm on completion, and the address on this request is where its completion notice goes. No action is required from you.`
            : `${am || "Your account manager"} will confirm on completion. No action is required from you.`;
    }
    if (!headline) return null;

    return (
        <div
            className={cx(
                "flex flex-col gap-1.5 rounded-(--hc-radius-xl) border border-(--hc-border-brand) bg-(--hc-bg-brand-primary) p-[15px] shadow-(--hc-elevation-card)",
                "sm:flex-row sm:items-center sm:gap-6 sm:rounded-(--hc-radius-2xl) sm:px-[23px] sm:py-[19px] sm:shadow-none",
            )}
        >
            <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:gap-1">
                <Eyebrow>{eyebrow}</Eyebrow>
                <p className="hc-t-display-title sm:hc-t-display-hero text-(--hc-text-primary)">{headline}</p>
                {line && <p className={cx("hc-t-body-helper text-(--hc-text-secondary)", ticket.completion_email_set && !closed ? "block" : "hidden sm:block")}>{line}</p>}
            </div>
            {closed && <StatusPill label={STATUS_META[ticket.status].label} tone={PILL_TONE[ticket.status]} className="self-start sm:self-center" />}
        </div>
    );
};

/* ── The four facts ──────────────────────────────────────────────────────── */

/**
 * One fact (118:54 / 122:86): caption/meta over label/field, gap 4, 64 tall. A
 * bg/secondary tile with 12 by 16 padding on the desktop; at 390 a bg/primary tile
 * with a 1px border/secondary and 12 by 14 padding (13 plus the border).
 */
/** The tile every fact sits in, shared with the PAGES and FILES tiles below the row. */
const FACT_TILE = "rounded-(--hc-radius-lg) border border-(--hc-border-secondary) bg-(--hc-bg-primary) px-[13px] py-[11px] sm:border-0 sm:bg-(--hc-bg-secondary) sm:px-4 sm:py-3";

const Fact = ({ label, value }: { label: string; value: string }) => (
    <div className={cx("flex flex-col gap-1", FACT_TILE)}>
        <Eyebrow>{label}</Eyebrow>
        <p className="hc-t-label-field text-(--hc-text-primary)">{value}</p>
    </div>
);

/**
 * PROPERTY / SUBMITTED BY / ACCOUNT MANAGER / ELAPSED: one row of four on the desktop (gap
 * 8), two rows of two at 390 (8 across, 16 down, the body's rhythm), in the frame's cells.
 * SUBMITTED BY, the name typed in the form's Submitted by field, stands where ASSIGNED TO was
 * (owner, 28 Sep 2026), so the grid stays whole at both widths and a phone, whose meta line
 * stops at the category, sees who raised it too. Every cell renders even when its value is
 * empty, so the grid never reflows per request.
 */
const FactRow = ({ ticket }: { ticket: Ticket }) => {
    const am = accountManagerName(ticket);
    const property = (ticket.property ?? "").trim();
    const by = (ticket.submitted_by_name ?? "").trim();
    const elapsed = elapsedLabel(ticket);
    // "Not yet" promises something on an open request; a closed one gets a plain "None".
    const none = canWithdraw(ticket) ? "Not yet" : "None";
    return (
        <div className="grid grid-cols-2 gap-x-2 gap-y-4 sm:grid-cols-4 sm:gap-2">
            <Fact label="PROPERTY" value={property || "Not given"} />
            <Fact label="SUBMITTED BY" value={by || "Not given"} />
            <Fact label="ACCOUNT MANAGER" value={am || none} />
            <Fact label="ELAPSED" value={elapsed || "Today"} />
        </div>
    );
};

/* ── Pages and files ─────────────────────────────────────────────────────── */

/** The type label a stored file carries (PDF, DOCX), from its mime; "FILE" for anything older. */
const badgeFor = (mime: string): string => FILE_TYPES.find((t) => t.mime === mime)?.label ?? "FILE";

/**
 * PAGES and FILES under the facts, in Fact's tile (bg/secondary on the desktop; a bordered
 * bg/primary tile at 390). Side by side on the desktop when both are there, one full width
 * when alone; stacked at 390. PAGES: each address a link in label/field
 * text/brand-secondary, underlined, opening in a new tab. FILES: the type
 * badge, the name in label/field, the size in caption/meta. Names and addresses wrap rather
 * than truncate, so everything that arrived can be read on a phone. Nothing when neither exists.
 */
const RequestLinks = ({ urls, files }: { urls: string[]; files: TicketFile[] }) => {
    // Stored addresses were cleaned on the way in; checked again here because this is
    // where one becomes a link.
    const links = urls.filter(isWebLink);
    if (!links.length && !files.length) return null;
    const tile = cx("flex min-w-0 flex-col gap-2", FACT_TILE);
    return (
        <div className={cx("grid grid-cols-1 gap-4 sm:gap-2", links.length && files.length ? "sm:grid-cols-2" : "")}>
            {links.length > 0 && (
                <section aria-labelledby="hc-pages" className={tile}>
                    <h2 id="hc-pages" className="hc-t-caption-meta text-(--hc-text-tertiary)">
                        PAGES
                    </h2>
                    {/* Each link a 44px row on a phone (targets never overlap); on the desktop both
                        lists run at a 28px pitch so the two tiles' lines align. */}
                    <ul className="flex flex-col">
                        {links.map((u) => (
                            <li key={u} className="flex min-h-11 min-w-0 items-center sm:min-h-7">
                                <a
                                    href={u}
                                    target="_blank"
                                    rel="noopener noreferrer nofollow"
                                    className="hc-t-label-field hc-hover min-w-0 break-words rounded-(--hc-radius-sm) text-(--hc-text-brand-secondary) underline underline-offset-2 hover:decoration-2"
                                >
                                    {displayUrl(u)}
                                    <span className="sr-only"> (opens in a new tab)</span>
                                </a>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
            {files.length > 0 && (
                <section aria-labelledby="hc-files" className={tile}>
                    <h2 id="hc-files" className="hc-t-caption-meta text-(--hc-text-tertiary)">
                        FILES
                    </h2>
                    <ul className="flex flex-col">
                        {files.map((f, i) => (
                            <li key={`${i}-${f.name}`} className="flex min-h-7 min-w-0 items-start gap-3 py-1">
                                <span aria-hidden="true" className="hc-t-caption-meta w-12 shrink-0 rounded-(--hc-radius-sm) bg-(--hc-bg-brand-primary) py-0.5 text-center tracking-normal text-(--hc-text-brand-secondary)">
                                    {badgeFor(f.mime)}
                                </span>
                                <span className="hc-t-label-field min-w-0 flex-1 break-words text-(--hc-text-primary)">{f.name}</span>
                                {typeof f.bytes === "number" && <span className="hc-t-caption-meta shrink-0 text-(--hc-text-tertiary)">{formatFileSize(f.bytes)}</span>}
                            </li>
                        ))}
                    </ul>
                </section>
            )}
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
// aria-hidden: the build notes make the dots decorative; the step's words carry its
// state ("Received", "In progress"), and a reader should not hear a tick or a bullet.
const StepDot = ({ state, n }: { state: StepState; n: number }) => (
    <span
        aria-hidden="true"
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
const Timeline = ({ ticket, events, files }: { ticket: Ticket; events: TicketEvent[]; files: TicketFile[] }) => {
    const steps = timelineSteps(ticket, events, files);
    return (
        <>
        {/* The build notes ask for h2 Timeline; the frame draws no heading, so it is for readers only. */}
        <h2 id="hc-timeline" className="sr-only">
            Timeline
        </h2>
        <ol
            aria-labelledby="hc-timeline"
            className="flex flex-col gap-3.5 rounded-(--hc-radius-xl) border border-(--hc-border-secondary) bg-(--hc-bg-primary) p-[15px] shadow-(--hc-elevation-card) sm:gap-4 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none"
        >
            {steps.map((step, i) => (
                <li key={step.key} className="flex items-start gap-3" aria-current={step.state === "now" ? "step" : undefined}>
                    <StepDot state={step.state} n={i + 1} />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <p className="hc-t-label-field text-(--hc-text-primary)">
                            {step.label}
                            {/* The state in words for a reader, since the dot is decorative (build notes). */}
                            <span className="sr-only">{step.state === "done" ? ", done" : step.state === "now" ? ", happening now" : ", to come"}</span>
                        </p>
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
        </>
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
            <section aria-labelledby="hc-updates" className="hidden flex-col gap-3 border-t border-(--hc-border-secondary) pt-[15px] sm:flex">
                <h2 id="hc-updates" className="sr-only">
                    Updates from the team
                </h2>
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
    // Keyboard and screen-reader users follow focus: the confirm card takes it when
    // it appears, and "Keep it open" hands it back to the link.
    const confirmRef = useRef<HTMLDivElement>(null);
    const linkRef = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        if (confirming) confirmRef.current?.focus();
    }, [confirming]);

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
                ref={linkRef}
                type="button"
                onClick={() => setConfirming(true)}
                // 16 under the card on the desktop, where the column's rhythm is 40. The
                // pseudo-element is the 44px target; the text stays 20 tall.
                className={cx("hc-hover relative w-max cursor-pointer rounded-(--hc-radius-sm) after:absolute after:inset-x-0 after:-inset-y-3 after:content-[''] hover:underline sm:-mt-6", HELPER_TERTIARY)}
            >
                Withdraw this request
            </button>
        );
    }

    return (
        <Card as="section" flat className="flex flex-col gap-3 sm:-mt-6">
            <div ref={confirmRef} tabIndex={-1} role="group" aria-label={`Withdraw ${ticket.reference}?`} className="outline-none" />
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
                <Button
                    variant="secondary"
                    fill
                    disabled={busy}
                    className={busy ? undefined : "cursor-pointer"}
                    onClick={() => {
                        setConfirming(false);
                        // Back to the link that opened the card, once it is on the page again.
                        setTimeout(() => linkRef.current?.focus(), 0);
                    }}
                >
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
    const [files, setFiles] = useState<TicketFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [missing, setMissing] = useState(false);
    // What a screen reader hears after a withdrawal, and where focus goes: the title.
    const [announce, setAnnounce] = useState("");
    const titleRef = useRef<HTMLHeadingElement>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        setMissing(false);
        try {
            const res = await fetchTicket(proof, reference);
            setTicket(res.ticket);
            setEvents(res.events ?? []);
            setFiles(res.files ?? []);
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
    // Links Linkified writes inside steps and updates carry the portal's classes, which
    // in dark mode are a grey; the wrapper repaints them with the hc token. The
    // "All requests" link keeps its 20px line and gets a 44px hit area from the
    // pseudo-element (build notes).
    const shell = (children: ReactNode) => (
        <div className="-mt-1 flex flex-col gap-4 sm:mt-0 sm:gap-10 [&_a.text-brand-secondary]:text-(--hc-text-brand-secondary)">
            <Link
                to={`/${slug}/help/requests`}
                className="hc-t-body-input sm:hc-t-body-helper hc-hover relative w-max rounded-(--hc-radius-sm) text-(--hc-text-brand-secondary) after:absolute after:inset-x-0 after:-inset-y-3 after:content-[''] hover:underline"
            >
                All requests
            </Link>
            {children}
            <p aria-live="polite" className="sr-only">
                {announce}
            </p>
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
                    <h1 ref={titleRef} tabIndex={-1} className="hc-t-display-title sm:hc-t-display-hero text-(--hc-text-primary) outline-none">
                        {ticket.title}
                    </h1>
                    <p className="flex items-center gap-2">
                        <MonoRef>{ticket.reference}</MonoRef>
                        {/* One text node either way: the 390 frame stops at the topic, the
                            1440 frame carries on to who raised it and when. */}
                        <span className={cx("whitespace-pre sm:hidden", HELPER_TERTIARY)}>{topic}</span>
                        <span className={cx("hidden whitespace-pre sm:inline", HELPER_TERTIARY)}>{`${topic}${DOT}${byline}`}</span>
                    </p>
                </header>

                <StatusBlock ticket={ticket} />
                <FactRow ticket={ticket} />
                <RequestLinks urls={Array.isArray(ticket.urls) ? ticket.urls : []} files={files} />
                <Timeline ticket={ticket} events={events} files={files} />
                <TeamUpdates events={events} />
            </article>

            <WithdrawBlock
                ticket={ticket}
                proof={proof}
                onWithdrawn={() => {
                    setAnnounce(`${ticket.reference} withdrawn.`);
                    void load().then(() => titleRef.current?.focus());
                    onTicketChanged();
                }}
            />
        </>,
    );
};
