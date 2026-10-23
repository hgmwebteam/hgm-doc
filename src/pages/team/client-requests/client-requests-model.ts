/**
 * Web Team → Client Input → Client Requests: the rules behind the metric cards and the
 * filters (owner, 21 Oct 2026). No React and no fetch, so client-requests-model.check.ts can
 * run them under plain Node.
 *
 * Rows are the staff list ticket-list-all.mts returns. Open, the status words and the dates
 * come from help-model.ts, the same file the client's own list and the standalone team list
 * (/team/tickets) read, so the three never disagree on what "open" means. Imported by a
 * relative path with its extension, as help-model's own self-check does, so Node can follow
 * it without the bundler's alias.
 */
import { type Priority, type Ticket, isOpen } from "../../client/help/help-model.ts";

/** The toolbar's status tabs. Awaiting review is in_review: the web team is done and the AM has not approved it. */
export type StatusTab = "all" | "open" | "in_review" | "completed" | "withdrawn";

export const STATUS_TABS: { id: StatusTab; label: string }[] = [
    { id: "all", label: "All" },
    { id: "open", label: "Open" },
    { id: "in_review", label: "Awaiting review" },
    { id: "completed", label: "Completed" },
    { id: "withdrawn", label: "Withdrawn" },
];

/**
 * The two metric cards that no tab matches. Overdue narrows Open, Completed this month
 * narrows Completed, and the toolbar shows the narrowing as a chip that can be removed.
 */
export type Focus = "overdue" | "month" | null;

export interface Filters {
    tab: StatusTab;
    focus: Focus;
    /** A client_slug, or "" for every client. */
    client: string;
    priority: Priority | "";
    query: string;
}

export const NO_FILTERS: Filters = { tab: "all", focus: null, client: "", priority: "", query: "" };

export const hasFilters = (f: Filters): boolean => f.tab !== "all" || f.focus !== null || f.client !== "" || f.priority !== "" || f.query.trim() !== "";

/** "paradise-pointe" from "paradise-pointe-dashboard": the help centre's short address, as /team/tickets links it. */
export const shortSlug = (slug: string | null | undefined): string => (slug ?? "").replace(/-dashboard$/, "");

export const clientNameOf = (t: Ticket): string => (t.client_name ?? "").trim() || shortSlug(t.client_slug);

/** The client's request page; staff see its staff view there (history, Approve). */
export const requestHref = (t: Pick<Ticket, "client_slug" | "reference">): string => `/${shortSlug(t.client_slug)}/help/requests/${t.reference}`;

/**
 * Still open and asked for before today. `needed_by` and `today` are both plain
 * "YYYY-MM-DD" days in local time (help-model's todayIsoDay), so a string compare is a day
 * compare and no timezone can move it.
 */
export const isOverdue = (t: Ticket, today: string): boolean => isOpen(t) && !!t.needed_by && t.needed_by < today;

/** Completed inside the calendar month `now` falls in, local time, as help-model counts it for the client. */
export const completedInMonth = (t: Ticket, now: Date): boolean => {
    if (t.status !== "completed" || !t.completed_at) return false;
    const d = new Date(t.completed_at);
    return !Number.isNaN(d.getTime()) && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
};

const inTab = (t: Ticket, tab: StatusTab): boolean => (tab === "all" ? true : tab === "open" ? isOpen(t) : t.status === tab);

export const applyFilters = (tickets: Ticket[], f: Filters, today: string, now: Date): Ticket[] => {
    const q = f.query.trim().toLowerCase();
    return tickets.filter(
        (t) =>
            inTab(t, f.tab) &&
            (f.focus !== "overdue" || isOverdue(t, today)) &&
            (f.focus !== "month" || completedInMonth(t, now)) &&
            (!f.client || t.client_slug === f.client) &&
            (!f.priority || t.priority === f.priority) &&
            (!q || [t.reference, t.title, clientNameOf(t)].some((s) => (s ?? "").toLowerCase().includes(q))),
    );
};

export interface Metrics {
    open: number;
    inReview: number;
    overdue: number;
    completedThisMonth: number;
}

export const metricsOf = (tickets: Ticket[], today: string, now: Date): Metrics => ({
    open: tickets.filter(isOpen).length,
    inReview: tickets.filter((t) => t.status === "in_review").length,
    overdue: tickets.filter((t) => isOverdue(t, today)).length,
    completedThisMonth: tickets.filter((t) => completedInMonth(t, now)).length,
});

/** What each metric card sets when pressed, and so when it reads as the active one. */
export const METRIC_FILTERS: Record<keyof Metrics, Pick<Filters, "tab" | "focus">> = {
    open: { tab: "open", focus: null },
    inReview: { tab: "in_review", focus: null },
    overdue: { tab: "open", focus: "overdue" },
    completedThisMonth: { tab: "completed", focus: "month" },
};

export type SortColumn = "created_at" | "needed_by";

/**
 * Sorted copy. A request with no needed-by date goes last in either direction, so sorting
 * by it always leads with the requests that have one. Ties keep the newest first.
 */
export const sortTickets = (tickets: Ticket[], column: SortColumn, direction: "ascending" | "descending"): Ticket[] => {
    const sign = direction === "ascending" ? 1 : -1;
    return [...tickets].sort((a, b) => {
        const x = a[column] ?? "";
        const y = b[column] ?? "";
        if (x === y) return b.created_at.localeCompare(a.created_at);
        if (!x) return 1;
        if (!y) return -1;
        // created_at arrives as ISO timestamps from one database, and needed_by as plain days,
        // so within a column the strings sort as the instants do.
        return x < y ? -sign : sign;
    });
};

/**
 * A history entry's heading in the request panel (phase 2, owner, 21 Oct 2026). Staff read
 * every event kind, the routing ones a client never sees included; a kind added later reads
 * as its own words rather than a key.
 */
const EVENT_LABELS: Record<string, string> = {
    received: "Received",
    assigned: "Assigned",
    in_progress: "In progress",
    in_review: "Awaiting review",
    team_update: "Team update",
    client_question: "Client asked",
    promised_date_set: "Due date set",
    route_failed: "Could not be routed",
    completed: "Completed",
    withdrawn: "Withdrawn",
};

export const eventLabel = (kind: string): string => {
    const words = kind.replace(/[-_]+/g, " ").trim();
    return EVENT_LABELS[kind] ?? (words ? words.charAt(0).toUpperCase() + words.slice(1) : "Update");
};

/** The patch a list row takes after Approve: the fresh read when it moved on, else completed now (the platform said yes). */
export const approvedPatch = (fresh: Pick<Ticket, "status" | "completed_at"> | null, nowIso: string): Pick<Ticket, "status" | "completed_at"> =>
    fresh && fresh.status !== "in_review"
        ? { status: fresh.status, completed_at: fresh.completed_at ?? (fresh.status === "completed" ? nowIso : null) }
        : { status: "completed", completed_at: nowIso };

/** The side menu badge's spoken words (phase 3, owner, 21 Oct 2026): "3 open requests, 1 awaiting review". */
export const openBadgeLabel = (open: number, inReview: number): string =>
    `${open} open ${open === 1 ? "request" : "requests"}${inReview ? `, ${inReview} awaiting review` : ""}`;

/** The Client select's options: each client on the loaded rows once, by name. */
export const clientOptions = (tickets: Ticket[]): { id: string; label: string }[] => {
    const seen = new Map<string, string>();
    for (const t of tickets) if (t.client_slug && !seen.has(t.client_slug)) seen.set(t.client_slug, clientNameOf(t));
    return [...seen.entries()].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
};
