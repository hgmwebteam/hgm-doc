/**
 * 02 REQUESTS - every request this client has raised, filterable, newest first.
 *
 * Built against the Figma file "Reporting System" (key rdig9bGu5N0KogiBW8H2CF), frames
 * "Desktop · Light / 2 My requests" (117:14) and "Mobile · Light / 390 My requests"
 * (121:49), node for node; an automated proof holds the page against those trees, so
 * every size, colour and gap here is the file's, not a preference. The building blocks
 * are the atoms in help-atoms.tsx (measured against the file's components) and the
 * `--hc-*` tokens and `hc-t-*` type utilities of src/styles/help-centre.css.
 *
 * The older atom exports at the top of this file are thin wrappers over those atoms,
 * kept so the screens that still import from here (the request detail, the team's
 * tickets screen) compile while they are rebuilt. New code imports from help-atoms.tsx.
 * The shell in help-center-screen.tsx WRAPS the other two screens rather than being
 * imported by them, so the dependency graph runs requests-screen -> request-detail ->
 * center-screen in one direction with no cycle.
 *
 * ── WHAT THIS SCREEN PROMISES ───────────────────────────────────────────────
 * A withdrawn request STAYS on the list and gets its own filter. Nothing a client raised
 * ever disappears from their own history, because the commonest reason to come looking for
 * a withdrawn request is having withdrawn it by mistake.
 */
import type { ReactNode } from "react";
import { AlertCircle, Inbox01 } from "@untitledui-pro/icons/line";
import { Link } from "react-router";
import { Button, Card, Eyebrow as AtomEyebrow, FilterChip, MonoRef as AtomMonoRef, type PillTone, StatusPill as AtomStatusPill } from "@/pages/client/help/help-atoms";
import {
    FILTERS,
    type RequestFilter,
    STATUS_META,
    type Ticket,
    type TicketCounts,
    type TicketStatus,
    type TicketTopic,
    matchesFilter,
    requestDueLine,
    requestMetaLine,
    requestsSummary,
    topicLabel,
} from "@/pages/client/help/help-model";
import { cx } from "@/utils/cx";
import "@/pages/client/help/help-requests-screen.css";

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
 * One request, at both widths, read from the frames node for node.
 *
 * Desktop ("Requests" 117:43, one "Request" frame per row): 76 tall, padding 16 by 20,
 * gap 16, the words filling on the left (the title in label/field, then a 20px meta
 * line: the mono reference and ONE helper text "{topic}  ·  raised {d Mon}", gap 8),
 * then the due line in body/helper text/secondary, then the pill. Rows alternate
 * bg/primary and bg/secondary, and every row but the first carries a 1px border/secondary
 * on top drawn INSIDE its 76, so it has 15 of padding above the words instead of 16.
 *
 * Phone ("Request" 121:75): each row is its own card, 124 tall, padding 16, gap 10, with
 * elevation/card: the title in body/input, the meta line (the reference, then the topic
 * label alone), and a footer with the pill first and the due line filling to the right.
 *
 * One DOM for both: the words column, then the pill and the due line, which are a footer
 * row on a phone and (through `sm:contents`) two more items of the row on desktop, the
 * pill ordered last. The meta line's two spellings are both in the DOM and one is hidden
 * per width, because the frame's desktop node holds the raise date and its phone node
 * does not.
 *
 * The whole row is one link to the request, so the tap target is the row itself. The
 * list card clips its rows to its radius, which would also clip the page's focus ring
 * (drawn 2px outside a control), so a row draws its ring 2px inside itself instead
 * (help-requests-screen.css); it stays visible on every row, including the first and
 * last.
 */
const RequestRow = ({ ticket, topics, slug, index }: { ticket: Ticket; topics: TicketTopic[]; slug: string; index: number }) => {
    const due = requestDueLine(ticket);
    const tinted = index % 2 === 1;
    return (
        <li>
            <Link
                to={`/${slug}/help/requests/${ticket.reference}`}
                className={cx(
                    "hc-hover hc-requests-row flex cursor-pointer",
                    // Phone: a card of its own.
                    "flex-col gap-2.5 rounded-(--hc-radius-xl) border border-(--hc-border-secondary) bg-(--hc-bg-primary) p-[15px] shadow-(--hc-elevation-card) hover:bg-(--hc-bg-primary_hover)",
                    // Desktop: a row inside the list card.
                    "sm:flex-row sm:items-center sm:gap-4 sm:rounded-none sm:border-0 sm:px-5 sm:py-4 sm:shadow-none",
                    tinted ? "sm:bg-(--hc-bg-secondary) sm:hover:bg-(--hc-bg-tertiary)" : "sm:bg-(--hc-bg-primary) sm:hover:bg-(--hc-bg-primary_hover)",
                    index > 0 && "sm:border-t sm:border-(--hc-border-secondary) sm:pt-[15px]",
                )}
            >
                <div className="flex min-w-0 flex-col gap-2.5 sm:flex-1 sm:gap-1">
                    <p className="hc-t-body-input text-(--hc-text-primary) sm:hc-t-label-field">{ticket.title}</p>
                    <div className="flex min-w-0 items-center gap-2">
                        <MonoRef>{ticket.reference}</MonoRef>
                        <span className="hc-t-body-helper min-w-0 flex-1 truncate text-(--hc-text-tertiary) sm:hidden">{topicLabel(topics, ticket.topic)}</span>
                        <span className="hc-t-body-helper hidden min-w-0 truncate text-(--hc-text-tertiary) sm:inline">{requestMetaLine(topics, ticket)}</span>
                    </div>
                </div>
                <div className="flex items-center gap-2 sm:contents">
                    <StatusPill status={ticket.status} className="shrink-0 sm:order-last" />
                    {due && <span className="hc-t-body-helper min-w-0 flex-1 text-right whitespace-nowrap text-(--hc-text-secondary) sm:flex-none">{due}</span>}
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

/**
 * The list: "Desktop · Light / 2 My requests" (117:14) and "Mobile · Light / 390 My
 * requests" (121:49).
 *
 * Desktop, a 40 rhythm: the heading row (the hero title and "{n} requests. {m} open." in
 * body/helper, gap 4, with the 176-wide primary Button "New request" centred beside
 * them), the four filter chips at 36 with 8 between, then the one list card. Phone, a 16
 * rhythm: the title in display/title, the helper in body/input, the chips at 44, then a
 * card per request. The 390 frame draws no "New request" button, so none is shown there;
 * the help home carries the raise action on a phone.
 *
 * Filters narrow one list that is already present rather than swapping panels, so they
 * are toggle buttons with aria-pressed inside one group (build notes), not tabs.
 */
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
        <div className="flex flex-col gap-4 sm:gap-10">
            <header className="flex items-center gap-4">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <h1 className="hc-t-display-title text-(--hc-text-primary) sm:hc-t-display-hero">Requests</h1>
                    <p className="hc-t-body-input text-(--hc-text-tertiary) sm:hc-t-body-helper">{requestsSummary(counts)}</p>
                </div>
                {!readOnly && (
                    <div className="hidden shrink-0 sm:block">
                        <Button to={`/${slug}/help`}>New request</Button>
                    </div>
                )}
            </header>

            <div role="group" aria-label="Filter requests" className="flex flex-wrap items-center gap-2">
                {FILTERS.map((f) => (
                    <FilterChip key={f.key} selected={f.key === filter} onClick={() => onFilterChange(f.key)} className="cursor-pointer">
                        {f.label}
                    </FilterChip>
                ))}
            </div>

            {shown.length === 0 ? (
                <EmptyNote title={emptyCopy[filter].title} detail={emptyCopy[filter].detail} />
            ) : (
                <ul className="flex flex-col gap-4 sm:gap-0 sm:overflow-hidden sm:rounded-(--hc-radius-xl) sm:border sm:border-(--hc-border-secondary) sm:bg-(--hc-bg-primary) sm:shadow-(--hc-elevation-card)">
                    {shown.map((t, i) => (
                        <RequestRow key={t.id} ticket={t} topics={topics} slug={slug} index={i} />
                    ))}
                </ul>
            )}
        </div>
    );
};
