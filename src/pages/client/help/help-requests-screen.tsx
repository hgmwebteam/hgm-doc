/**
 * 02 REQUESTS - every request this client has raised, filterable, newest first.
 *
 * This file is also where the help centre's shared visual atoms live. That is an import
 * ordering decision, not a naming one: the shell in help-center-screen.tsx WRAPS the other
 * two screens rather than being imported by them, so the dependency graph runs
 * requests-screen -> request-detail -> center-screen in one direction with no cycle.
 *
 * ── THE DESIGN THIS FOLLOWS ─────────────────────────────────────────────────
 * The Figma file "Reporting System", page "Help Center": frames "Desktop · Light / 1 Help
 * home, 2 My requests, 3 Request detail" and their "Mobile · Light / 390" pairs, plus the
 * "Build notes · Accessibility and states" frame beside them. Every size, colour and
 * spacing below is that file's, not a preference:
 *
 *   type      display/hero 40/44 -1 (desktop page title)  display/title 28/34 -0.5
 *             heading/section 18/26 -0.2   label/field 14/20 500   body/input 16/24
 *             body/helper 13/18   caption/meta 12/16 500 +0.2   button/label 15/20 600
 *             mono/id Geist Mono 13/18
 *   colour    the portal's own tokens - the Figma variables were sampled from theme.css and
 *             carry the CSS variable name in their code syntax - with four values stepped
 *             off the scale for AA: success text green-800, warning text yellow-800, error
 *             text red-700, and tertiary text neutral-600, which is what text-tertiary
 *             already resolves to here
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
import {
    FILTERS,
    type RequestFilter,
    STATUS_META,
    type Ticket,
    type TicketCounts,
    type TicketStatus,
    type TicketTopic,
    formatStampShort,
    matchesFilter,
    requestsSummary,
    topicLabel,
} from "@/pages/client/help/help-model";
import { cx } from "@/utils/cx";

/* ── The type scale, as classes ──────────────────────────────────────────────
   Named after the Figma text styles so a reviewer can hold the two side by side. Arbitrary
   values rather than the portal's text-* presets because the presets do not carry these
   exact line heights and trackings, and the point of a type scale is that it is exact. */
export const T = {
    hero: "text-[40px] leading-[44px] font-semibold tracking-[-1px]",
    title: "text-[28px] leading-[34px] font-semibold tracking-[-0.5px]",
    section: "text-[18px] leading-[26px] font-semibold tracking-[-0.2px]",
    label: "text-[14px] leading-5 font-medium",
    body: "text-[16px] leading-6",
    helper: "text-[13px] leading-[18px]",
    caption: "text-[12px] leading-4 font-medium tracking-[0.2px]",
    button: "text-[15px] leading-5 font-semibold",
    mono: "font-mono text-[13px] leading-[18px] tabular-nums",
} as const;

/** The card shadow from the Figma's elevation/card effect style. */
export const ELEVATION = "shadow-[0_1px_2px_rgba(23,23,23,0.04),0_8px_24px_-4px_rgba(23,23,23,0.05)]";

/** Focus, everywhere, the same: a 2px brand ring with 2px of air. Never removed. */
export const FOCUS = "outline-brand focus-visible:outline-2 focus-visible:outline-offset-2";

/* ── Shared atoms ────────────────────────────────────────────────────────── */

/**
 * The page's white card: bg/primary, border/secondary, radius/xl, elevation/card.
 *
 * `ring-1` rather than `border`, matching the dashboard: a ring does not take part in
 * layout, so a card can sit flush in a grid without its outline nudging its neighbours.
 */
export const Panel = ({ children, className, flat }: { children: ReactNode; className?: string; flat?: boolean }) => (
    <div className={cx("rounded-xl bg-primary ring-1 ring-secondary", !flat && ELEVATION, className)}>{children}</div>
);

/** caption/meta in text/tertiary, uppercase. The eyebrow above a page title or a fact. */
export const Eyebrow = ({ children, className }: { children: ReactNode; className?: string }) => (
    <p className={cx(T.caption, "text-tertiary uppercase", className)}>{children}</p>
);

/** A reference number in mono/id. Monospaced so two references are comparable digit by digit. */
export const MonoRef = ({ children, className }: { children: ReactNode; className?: string }) => (
    <span className={cx(T.mono, "text-tertiary", className)}>{children}</span>
);

/** Separator between meta items. Hidden from screen readers: it is punctuation, not content. */
export const MetaDot = () => (
    <span aria-hidden="true" className="text-tertiary">
        &middot;
    </span>
);

/**
 * The status pill, from the Figma's Status/Pill component set: caption/meta on a full-radius
 * tint, padding 6 by 12. Text always carries the state; colour only reinforces it.
 *
 *   In progress   warning tint, yellow-800 text     (measured 6.61:1 in the build notes)
 *   Assigned      brand tint, brand-600 text        (5.03:1)
 *   Completed     success tint, green-800 text      (6.81:1)
 *   Withdrawn     bg/tertiary, text/tertiary
 *   Received      the neutral pair with a hairline, so it cannot be mistaken for Assigned
 */
const PILL: Record<TicketStatus, string> = {
    received: "bg-secondary text-secondary ring-1 ring-secondary",
    assigned: "bg-brand-primary text-fg-brand-primary",
    in_progress: "bg-yellow-50 text-yellow-800",
    completed: "bg-green-50 text-green-800",
    withdrawn: "bg-tertiary text-tertiary",
};

export const StatusPill = ({ status, className }: { status: TicketStatus; size?: "sm" | "md"; className?: string }) => (
    <span className={cx("inline-flex items-center rounded-full px-3 py-1.5 whitespace-nowrap", T.caption, PILL[status], className)}>
        {STATUS_META[status].label}
    </span>
);

/** The primary action: bg/brand-solid, button/label, 48 tall, radius/lg. One per view. */
export const PrimaryButton = ({
    children,
    className,
    ...rest
}: { children: ReactNode; className?: string } & (
    | ({ as?: "button" } & React.ButtonHTMLAttributes<HTMLButtonElement>)
    | { as: "link"; to: string }
)) => {
    const base = cx(
        "inline-flex h-12 items-center justify-center rounded-lg bg-brand-solid px-5 text-white transition duration-100 ease-linear hover:bg-brand-solid_hover disabled:opacity-60 motion-reduce:transition-none",
        T.button,
        FOCUS,
        className,
    );
    if ("as" in rest && rest.as === "link") {
        return (
            <Link to={rest.to} className={base}>
                {children}
            </Link>
        );
    }
    const { as: _as, ...buttonProps } = rest as { as?: "button" } & React.ButtonHTMLAttributes<HTMLButtonElement>;
    void _as;
    return (
        <button type="button" {...buttonProps} className={base}>
            {children}
        </button>
    );
};

/** The quieter action beside a primary one. Same height, same radius, a hairline instead of a fill. */
export const SecondaryButton = ({ children, className, ...rest }: { children: ReactNode; className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button
        type="button"
        {...rest}
        className={cx(
            "inline-flex h-12 items-center justify-center rounded-lg bg-primary px-5 text-secondary ring-1 ring-primary transition duration-100 ease-linear hover:bg-primary_hover disabled:opacity-60 motion-reduce:transition-none",
            T.button,
            FOCUS,
            className,
        )}
    >
        {children}
    </button>
);

/** A text link in text/brand-secondary. The Figma underlines guide links; actions are plain. */
export const TextLink = ({ to, children, className, underline }: { to: string; children: ReactNode; className?: string; underline?: boolean }) => (
    <Link
        to={to}
        className={cx(
            "inline-flex min-h-11 items-center gap-1.5 rounded text-fg-brand-primary hover:underline",
            underline && "underline",
            T.helper,
            FOCUS,
            className,
        )}
    >
        {children}
    </Link>
);

/** The shared loading state. Announced, so it is not a silent pause for a screen reader. */
export const HelpSpinner = ({ label = "Loading" }: { label?: string }) => (
    <div role="status" aria-live="polite" className={cx("flex items-center justify-center gap-3 py-16 text-tertiary", T.helper)}>
        <span className="size-4 animate-spin rounded-full border-2 border-brand border-t-transparent motion-reduce:animate-none" aria-hidden="true" />
        {label}
    </div>
);

/** A failure the client can act on, with the retry beside it rather than somewhere else. */
export const ErrorNote = ({ message, onRetry }: { message: string; onRetry?: () => void }) => (
    <Panel flat className="p-4 ring-error_subtle sm:p-5">
        <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-error-primary" aria-hidden="true" />
            <div className="min-w-0 flex-1">
                <p className={cx(T.body, "text-primary")} role="alert">
                    {message}
                </p>
                {onRetry && (
                    <SecondaryButton className="mt-3 h-11" onClick={onRetry}>
                        Try again
                    </SecondaryButton>
                )}
            </div>
        </div>
    </Panel>
);

/** The shared empty state. Never a shrug: every copy passed in says what to do next. */
export const EmptyNote = ({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) => (
    <Panel className="px-5 py-12 text-center">
        <Inbox01 className="mx-auto size-6 text-tertiary" aria-hidden="true" />
        <p className={cx(T.label, "mt-3 text-primary")}>{title}</p>
        <p className={cx(T.helper, "mx-auto mt-1.5 max-w-[42ch] text-pretty text-tertiary")}>{detail}</p>
        {action && <div className="mt-5 flex justify-center">{action}</div>}
    </Panel>
);

/* ── 02 REQUESTS ─────────────────────────────────────────────────────────── */

/**
 * The right-hand line on a row: the promised date, or what stands in for one. The Figma
 * shows "Due 12 September" on open rows and "Finished in 3 days" on completed ones. Nothing
 * here is promised that the row does not carry: a request with no promised_date shows the
 * day it was raised, because that is the only date we hold about it.
 */
const dueLine = (t: Ticket): string => {
    if (t.status === "withdrawn") return t.withdrawn_at ? `Withdrawn ${formatStampShort(t.withdrawn_at)}` : "Withdrawn by you";
    if (t.status === "completed") return t.completed_at ? `Completed ${formatStampShort(t.completed_at)}` : "Completed";
    if (t.promised_date) return `Due ${formatStampShort(t.promised_date)}`;
    return formatStampShort(t.created_at) ? `Raised ${formatStampShort(t.created_at)}` : "";
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
    const raised = formatStampShort(ticket.created_at);
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
                                        {raised}
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
                    const n = tickets.filter((t) => matchesFilter(t, f.key)).length;
                    return (
                        <button
                            key={f.key}
                            type="button"
                            aria-pressed={active}
                            onClick={() => onFilterChange(f.key)}
                            className={cx(
                                "inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 whitespace-nowrap ring-1 transition duration-100 ease-linear motion-reduce:transition-none",
                                T.helper,
                                FOCUS,
                                active ? "bg-brand-primary text-fg-brand-primary ring-brand" : "bg-primary text-secondary ring-secondary hover:bg-primary_hover",
                            )}
                        >
                            {f.label}
                            <span className={cx("tabular-nums", active ? "text-fg-brand-primary" : "text-tertiary")}>{n}</span>
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
