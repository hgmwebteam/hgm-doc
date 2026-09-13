/**
 * 02 REQUESTS - every request this client has raised, filterable, newest first.
 *
 * The help centre's shared building blocks live in help-atoms.tsx, measured against the
 * Figma file's component nodes; this file keeps its older atom exports as thin wrappers
 * over them so the screens that still import from here compile while they are rebuilt.
 * The shell in help-center-screen.tsx WRAPS the other two screens rather than being
 * imported by them, so the dependency graph runs requests-screen -> request-detail ->
 * center-screen in one direction with no cycle.
 *
 * ── THE DESIGN THIS FOLLOWS ─────────────────────────────────────────────────
 * The Figma file "Reporting System", page "Help Center": frames "Desktop · Light / 1 Help
 * home, 2 My requests, 3 Request detail" and their "Mobile · Light / 390" pairs, plus the
 * "Build notes · Accessibility and states" frame beside them. Every size, colour and
 * spacing below is that file's, not a preference:
 *
 *   type      display/hero 40/44 -1 (desktop page title)  display/title 28/32 -0.5
 *             heading/section 18/24 -0.2   label/field 14/20 500   body/input 16/24
 *             body/helper 13/20   caption/meta 13/16 500 +0.2   button/label 15/20 600
 *             mono/id Geist Mono 13/16 (the hc-t-* utilities in help-centre.css)
 *   colour    the file's "HGM Portal Tokens" collection, both modes, as the --hc-* custom
 *             properties in help-centre.css (generated from help-centre-tokens.json)
 *   radius    cards xl (12), tiles and stats lg (10), pills full
 *   elevation "elevation/card": 0 1px 2px rgba(23,23,23,.04) and 0 8px 24px -4px
 *             rgba(23,23,23,.05). Two layers, both quiet.
 *   rhythm    desktop gutters 200 on 1440 (a 1040 column), body top 56, sections 40, card
 *             padding 24. Mobile gutters 16, body top 24, sections 24 (16 on the list), card
 *             padding 16. Everything on the 8-point grid.
 *   targets   primary button 48, chips 44, rows 56 to 72, nothing under 44.
 *
 * ── WHAT THIS SCREEN PROMISES ───────────────────────────────────────────────
 * A withdrawn request STAYS on the list and gets its own filter. Nothing a client raised
 * ever disappears from their own history, because the commonest reason to come looking for
 * a withdrawn request is having withdrawn it by mistake.
 */
import type { ReactNode } from "react";
import { AlertCircle, Inbox01 } from "@untitledui-pro/icons/line";
import { Link } from "react-router";
import { Button, Card, Eyebrow as AtomEyebrow, MonoRef as AtomMonoRef, type PillTone, StatusPill as AtomStatusPill } from "@/pages/client/help/help-atoms";
import {
    FILTERS,
    type RequestFilter,
    STATUS_META,
    type Ticket,
    type TicketCounts,
    type TicketStatus,
    type TicketTopic,
    formatDayMonth,
    elapsedDays,
    formatDayMonthShort,
    matchesFilter,
    requestsSummary,
    topicLabel,
} from "@/pages/client/help/help-model";
import { cx } from "@/utils/cx";

/* ── The legacy atoms ────────────────────────────────────────────────────────
   The building blocks now live in help-atoms.tsx, measured against the Figma file's
   component nodes and its tokens (help-centre.css). What follows keeps this module's
   old exports compiling for the screens that still import them; each is the thinnest
   possible wrapper over the new atom, and each screen is being rebuilt on the atoms
   directly. New code imports from help-atoms.tsx, not from here. */

/** The nine text styles, as the hc-t-* utilities. Exact family, size, line height, weight and tracking. */
export const T = {
    hero: "hc-t-display-hero",
    title: "hc-t-display-title",
    section: "hc-t-heading-section",
    label: "hc-t-label-field",
    body: "hc-t-body-input",
    helper: "hc-t-body-helper",
    caption: "hc-t-caption-meta",
    button: "hc-t-button-label",
    mono: "hc-t-mono-id tabular-nums",
} as const;

/** The card shadow from the Figma's elevation/card effect style (help-centre.css). */
export const ELEVATION = "shadow-(--hc-elevation-card)";

/** Focus is painted by help-centre.css on everything inside .hc; kept so old call sites compile. */
export const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--hc-border-brand)";

/** The page's white card. Old call sites pass their own padding, so none is applied here. */
export const Panel = ({ children, className, flat }: { children: ReactNode; className?: string; flat?: boolean }) => (
    <Card flat={flat} className={cx("p-0", className)}>
        {children}
    </Card>
);

/** caption/meta in text/tertiary. The old callers pass mixed case and relied on a transform; the atom does not have one. */
export const Eyebrow = ({ children, className }: { children: ReactNode; className?: string }) => <AtomEyebrow className={cx("uppercase", className)}>{children}</AtomEyebrow>;

/** A reference number in mono/id. */
export const MonoRef = ({ children, className }: { children: ReactNode; className?: string }) => <AtomMonoRef className={className}>{children}</AtomMonoRef>;

/** Separator between meta items. Hidden from screen readers: it is punctuation, not content. */
export const MetaDot = () => (
    <span aria-hidden="true" className="text-(--hc-text-tertiary)">
        &middot;
    </span>
);

/**
 * The status pill by ticket status. The file draws four variants; "received" has none,
 * and is shown as the blue "with the team" pill because that is where such a ticket is.
 */
const PILL_TONE: Record<TicketStatus, PillTone> = {
    received: "with-the-team",
    assigned: "with-the-team",
    in_progress: "in-progress",
    completed: "done",
    withdrawn: "withdrawn",
};

export const StatusPill = ({ status, className }: { status: TicketStatus; size?: "sm" | "md"; className?: string }) => (
    <AtomStatusPill label={STATUS_META[status].label} tone={PILL_TONE[status]} className={className} />
);

/** The primary action, as a button or a link. */
export const PrimaryButton = ({
    children,
    className,
    ...rest
}: { children: ReactNode; className?: string } & (
    | ({ as?: "button" } & React.ButtonHTMLAttributes<HTMLButtonElement>)
    | { as: "link"; to: string }
)) => {
    if ("as" in rest && rest.as === "link") {
        return (
            <Button to={rest.to} className={className}>
                {children}
            </Button>
        );
    }
    const { as: _as, disabled, ...buttonProps } = rest as { as?: "button" } & React.ButtonHTMLAttributes<HTMLButtonElement>;
    void _as;
    return (
        <Button {...buttonProps} disabled={disabled} className={className}>
            {children}
        </Button>
    );
};

/** The quieter action beside a primary one. */
export const SecondaryButton = ({ children, className, disabled, ...rest }: { children: ReactNode; className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <Button variant="secondary" {...rest} disabled={disabled} className={className}>
        {children}
    </Button>
);

/** A text link in text/brand-secondary, body/helper. The file underlines guide links; actions are plain. */
export const TextLink = ({ to, children, className, underline }: { to: string; children: ReactNode; className?: string; underline?: boolean }) => (
    <Link to={to} className={cx("hc-t-body-helper inline-flex min-h-11 items-center gap-1.5 rounded-(--hc-radius-sm) text-(--hc-text-brand-secondary) hover:underline", underline && "underline", className)}>
        {children}
    </Link>
);

/** The shared loading state. Announced, so it is not a silent pause for a screen reader. */
export const HelpSpinner = ({ label = "Loading" }: { label?: string }) => (
    <div role="status" aria-live="polite" className="hc-t-body-helper flex items-center justify-center gap-3 py-16 text-(--hc-text-tertiary)">
        <span className="hc-spin size-4 rounded-(--hc-radius-full) border-2 border-(--hc-border-brand) border-t-transparent" aria-hidden="true" />
        {label}
    </div>
);

/** A failure the client can act on, with the retry beside it rather than somewhere else. */
export const ErrorNote = ({ message, onRetry }: { message: string; onRetry?: () => void }) => (
    <Card flat className="border-(--hc-border-error)">
        <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-(--hc-text-error-primary)" aria-hidden="true" />
            <div className="min-w-0 flex-1">
                <p className="hc-t-body-input text-(--hc-text-primary)" role="alert">
                    {message}
                </p>
                {onRetry && (
                    <SecondaryButton className="mt-3" onClick={onRetry}>
                        Try again
                    </SecondaryButton>
                )}
            </div>
        </div>
    </Card>
);

/** The shared empty state. Never a shrug: every copy passed in says what to do next. */
export const EmptyNote = ({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) => (
    <Card className="px-5 py-12 text-center">
        <Inbox01 className="mx-auto size-6 text-(--hc-text-tertiary)" aria-hidden="true" />
        <p className="hc-t-label-field mt-3 text-(--hc-text-primary)">{title}</p>
        <p className="hc-t-body-helper mx-auto mt-1.5 max-w-[42ch] text-pretty text-(--hc-text-tertiary)">{detail}</p>
        {action && <div className="mt-5 flex justify-center">{action}</div>}
    </Card>
);

/* ── 02 REQUESTS ─────────────────────────────────────────────────────────── */

/**
 * The right-hand line on a row: the promised date, or what stands in for one. The Figma
 * shows "Due 12 September" on open rows and "Finished in 3 days" on completed ones. Nothing
 * here is promised that the row does not carry: a request with no promised_date shows the
 * day it was raised, because that is the only date we hold about it.
 */
/** The frame's right-hand line: "Due 12 September", "Completed in 3 days", "Withdrawn". */
const dueLine = (t: Ticket): string => {
    if (t.status === "withdrawn") return "Withdrawn";
    if (t.status === "completed") {
        const days = elapsedDays(t.created_at, t.completed_at);
        return days === null ? "Completed" : days === 0 ? "Completed same day" : `Completed in ${days} ${days === 1 ? "day" : "days"}`;
    }
    if (t.promised_date) return `Due ${formatDayMonth(t.promised_date)}`;
    return "";
};

/**
 * One row, the desktop shape: a list card with alternating rows and a hairline between
 * them (Figma "Requests" frame), title in label/field, meta in mono plus helper, the due
 * line right-aligned, the pill last. On a phone each row is its own card with the pill and
 * the due line in a footer row ("Mobile · Light / 390 My requests").
 *
 * A whole-row link, so the tap target is the row and not just the title.
 */
const RequestRow = ({ ticket, topics, slug, index }: { ticket: Ticket; topics: TicketTopic[]; slug: string; index: number }) => {
    const raised = formatDayMonthShort(ticket.created_at);
    const due = dueLine(ticket);
    return (
        <li className={cx(index > 0 && "sm:border-t sm:border-secondary")}>
            <Link
                to={`/${slug}/help/requests/${ticket.reference}`}
                className={cx(
                    // Phone: a card. Desktop: a row inside the list card, alternating tint.
                    "block rounded-xl bg-primary p-4 ring-1 ring-secondary transition duration-100 ease-linear hover:bg-primary_hover motion-reduce:transition-none",
                    "sm:rounded-none sm:px-5 sm:py-4 sm:ring-0",
                    index % 2 === 1 && "sm:bg-secondary sm:hover:bg-tertiary",
                    FOCUS,
                )}
            >
                <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-4">
                    <div className="min-w-0 flex-1">
                        <p className={cx("text-pretty text-primary", T.body, "sm:text-[14px] sm:leading-5 sm:font-medium")}>{ticket.title}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                            <MonoRef>{ticket.reference}</MonoRef>
                            <span className={cx(T.helper, "text-tertiary")}>
                                {topicLabel(topics, ticket.topic)}
                                {raised && (
                                    <>
                                        {"  "}
                                        <MetaDot />
                                        {"  "}
                                        raised {raised}
                                    </>
                                )}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                        <StatusPill status={ticket.status} className="sm:order-2" />
                        {due && <span className={cx(T.helper, "text-secondary sm:order-1 sm:text-right")}>{due}</span>}
                    </div>
                </div>
            </Link>
        </li>
    );
};

const emptyCopy: Record<RequestFilter, { title: string; detail: string }> = {
    all: {
        title: "No requests yet",
        detail: "When you raise your first request it will appear here, with the name of the person who owns it.",
    },
    open: {
        title: "Nothing open",
        detail: "Every request you have raised is closed. Raise a new one whenever you need something.",
    },
    completed: {
        title: "Nothing completed yet",
        detail: "Requests move here once the work is finished, and stay for your records.",
    },
    withdrawn: {
        title: "Nothing withdrawn",
        detail: "Requests you withdraw stay on this list rather than disappearing, so you can always find them again.",
    },
};

export const HelpRequestsScreen = ({
    tickets,
    counts,
    topics,
    slug,
    filter,
    onFilterChange,
    readOnly,
}: {
    tickets: Ticket[];
    counts: TicketCounts;
    topics: TicketTopic[];
    slug: string;
    filter: RequestFilter;
    onFilterChange: (f: RequestFilter) => void;
    /** Staff: no "New request" button, because the server would refuse it. */
    readOnly?: boolean;
}) => {
    const shown = tickets.filter((t) => matchesFilter(t, filter));

    return (
        <div className="flex flex-col gap-4 sm:gap-6">
            {/* Heading row: title and summary on the left, the one primary action on the
                right ("Desktop · Light / 2 My requests"). On a phone the button moves under
                the heading, full width, as the mobile frame has it. */}
            <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-1">
                    <h1 className={cx("text-primary", T.title, "sm:text-[40px] sm:leading-[44px] sm:tracking-[-1px]")}>Requests</h1>
                    <p className={cx("text-tertiary", T.body, "sm:text-[13px] sm:leading-[18px]")}>{requestsSummary(counts)}</p>
                </div>
                {!readOnly && (
                    <PrimaryButton as="link" to={`/${slug}/help`} className="w-full sm:w-auto">
                        New request
                    </PrimaryButton>
                )}
            </header>

            {/* Filters, not tabs. They narrow one list that is already present rather than
                swapping panels, so they are buttons carrying aria-pressed (build notes).
                Selected: bg/brand-primary, border/brand, text/brand-secondary. 44 tall. */}
            <div role="group" aria-label="Filter requests" className="flex flex-wrap items-center gap-2">
                {FILTERS.map((f) => {
                    const active = f.key === filter;
                    return (
                        <button
                            key={f.key}
                            type="button"
                            aria-pressed={active}
                            onClick={() => onFilterChange(f.key)}
                            className={cx(
                                "inline-flex min-h-11 items-center rounded-full px-4 whitespace-nowrap ring-1 transition duration-100 ease-linear motion-reduce:transition-none",
                                T.helper,
                                FOCUS,
                                active ? "bg-brand-primary text-fg-brand-primary ring-brand" : "bg-primary text-secondary ring-secondary hover:bg-primary_hover",
                            )}
                        >
                            {f.label}
                        </button>
                    );
                })}
            </div>

            {shown.length === 0 ? (
                <EmptyNote title={emptyCopy[filter].title} detail={emptyCopy[filter].detail} />
            ) : (
                // Phone: stacked cards with a gap. Desktop: one list card, rows flush.
                <ul
                    className={cx(
                        "flex flex-col gap-3",
                        "sm:gap-0 sm:overflow-hidden sm:rounded-xl sm:bg-primary sm:ring-1 sm:ring-secondary",
                        // The literal, not `sm:${ELEVATION}`: Tailwind reads classes out of the
                        // source text and a template string is invisible to it.
                        "sm:shadow-[0_1px_2px_rgba(23,23,23,0.04),0_8px_24px_-4px_rgba(23,23,23,0.05)]",
                    )}
                >
                    {shown.map((t, i) => (
                        <RequestRow key={t.id} ticket={t} topics={topics} slug={slug} index={i} />
                    ))}
                </ul>
            )}
        </div>
    );
};
