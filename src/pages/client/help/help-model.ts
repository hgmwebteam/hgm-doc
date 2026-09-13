/**
 * The help centre's data model: the shapes the portal functions hand back, and the pure
 * rules that turn a ticket row into the words a client reads.
 *
 * No React and no fetch on purpose. The honest-degradation rules below are the part of
 * this feature most likely to be got wrong later, so they live somewhere they can be read
 * (and checked) without standing a page up.
 *
 * ── THE RULE THIS FILE EXISTS TO ENFORCE ────────────────────────────────────
 * `ticket_topics.turnaround_days` is NULL on both seeded topics, by the owner's decision
 * on the day this was built, so `tickets.promised_date` is NULL on every ticket. Every
 * screen therefore has to say "received, owner assigned" and NO date. Not "soon", not
 * "usually a few days", not a date computed from the topic. promiseBlock() below is the
 * single place that decision is expressed: it reads promised_date first, so the day a
 * turnaround is set and the brain starts writing the column, the date appears on every
 * screen with no code change here or anywhere else.
 */

/* ── The reporting schema, as the browser sees it ────────────────────────────
   Mirrors the live tables in the HGM Reporting project (verified against the live
   OpenAPI definition rather than transcribed from the design document). Kept in step
   with them deliberately: these names are the wire format of the portal functions. */

export type TicketStatus = "received" | "assigned" | "in_progress" | "completed" | "withdrawn";

export type TicketEventKind =
    | "received"
    | "assigned"
    | "in_progress"
    | "team_update"
    | "completed"
    | "withdrawn"
    | "route_failed"
    | "promised_date_set";

export interface TicketTopic {
    key: string;
    label: string;
    description: string | null;
    /** NULL today on every topic. See the header: a number here is a promise we can keep. */
    turnaround_days: number | null;
}

/**
 * One request.
 *
 * Everything past `created_at` is optional because the list endpoint returns a narrower
 * row than the detail endpoint. Typing them as required would make the list screen lie
 * about what it holds, and the first `ticket.detail.length` would throw in production
 * rather than in the type-checker.
 */
export type Priority = "low" | "medium" | "high" | "urgent";

/**
 * The Figma's Priority/Chip and Priority/Legend: four values from the platform's own
 * triage enum, each with its tint and the one-line meaning shown under the chips "so
 * people pick by consequence, not by mood - the cure for everything being marked urgent".
 * Chip tints are the utility pairs the file binds them to: blue, success, warning, error.
 */
export const PRIORITIES: { key: Priority; label: string; meaning: string; dot: string; chip: string; pill: string }[] = [
    { key: "low", label: "Low", meaning: "Cosmetic or nice-to-have. Nobody is blocked.", dot: "bg-fg-brand-primary", chip: "bg-brand-primary ring-brand", pill: "bg-brand-primary text-fg-brand-primary" },
    { key: "medium", label: "Medium", meaning: "Something is wrong but there is a workaround. Fix this week.", dot: "bg-green-700", chip: "bg-green-50 ring-green-700", pill: "bg-green-50 text-green-800" },
    { key: "high", label: "High", meaning: "A client-facing feature is broken or a client is asking. Fix today.", dot: "bg-yellow-700", chip: "bg-yellow-50 ring-yellow-700", pill: "bg-yellow-50 text-yellow-800" },
    { key: "urgent", label: "Urgent", meaning: "Revenue is stopping: bookings, payments or the site are down. Drop everything.", dot: "bg-red-600", chip: "bg-red-50 ring-red-600", pill: "bg-red-50 text-red-700" },
];
export const priorityMeta = (key: Priority | null | undefined) => PRIORITIES.find((p) => p.key === key) ?? null;

/** Whether an address is the team's. Mirrors the server's domain test for the one purpose of wording a byline. */
export const isTeamAddress = (email: string | null | undefined): boolean => {
    const e = (email ?? "").trim().toLowerCase();
    const at = e.lastIndexOf("@");
    return at > 0 && e.slice(at + 1) === "hiddengem.media";
};

export interface Ticket {
    id: string;
    reference: string;
    topic: string;
    title: string;
    status: TicketStatus;
    created_at: string;

    detail?: string | null;
    property?: string | null;
    needed_by?: string | null;
    image_count?: number | null;
    drive_folder_url?: string | null;
    client_name?: string | null;
    submitted_by?: string | null;
    submitted_by_name?: string | null;
    /** Set by the team on their own form; null when a client raised it. */
    priority?: Priority | null;
    /** On the team's cross-client list. */
    client_slug?: string | null;
    assignee_name?: string | null;
    assignee_email?: string | null;
    account_manager_email?: string | null;
    account_manager_name?: string | null;
    promised_date?: string | null;
    completed_at?: string | null;
    completed_by?: string | null;
    withdrawn_at?: string | null;
    withdrawn_by?: string | null;
}

export interface TicketEvent {
    id: string;
    kind: TicketEventKind;
    body: string | null;
    actor_email: string | null;
    actor_name: string | null;
    created_at: string;
}

export interface TicketCounts {
    total: number;
    open: number;
}

/* ── Status vocabulary ───────────────────────────────────────────────────────
   One entry per enum member, so a status the database can produce can never reach a
   screen without a label. `tone` picks the pill styling in the screens; the colours
   themselves live there, because this file stays free of Tailwind. */

export const OPEN_STATUSES: TicketStatus[] = ["received", "assigned", "in_progress"];

export const isOpen = (t: Ticket): boolean => OPEN_STATUSES.includes(t.status);

export const STATUS_META: Record<TicketStatus, { label: string; tone: "neutral" | "brand" | "success" | "muted" }> = {
    received: { label: "Received", tone: "neutral" },
    assigned: { label: "Assigned", tone: "brand" },
    in_progress: { label: "In progress", tone: "brand" },
    completed: { label: "Completed", tone: "success" },
    // Muted rather than an error red. Withdrawing is a normal thing a client may do and
    // the row stays on their list forever; colouring it like a failure would read as a
    // telling-off every time they scroll past it.
    withdrawn: { label: "Withdrawn", tone: "muted" },
};

/**
 * Status changes a client sees on the timeline.
 *
 * `route_failed` is deliberately absent. It means the topic had no Asana board or no
 * default assignee, so the brain refused to open an orphan task and told the account
 * manager instead. That is our problem being handled, not news for the client, and
 * "route failed" on their screen would read as their request being lost. The ticket
 * simply stays at "Received" for them, which is true.
 */
export const CLIENT_VISIBLE_EVENTS: TicketEventKind[] = [
    "received",
    "assigned",
    "in_progress",
    "promised_date_set",
    "completed",
    "withdrawn",
];

export const EVENT_LABEL: Record<TicketEventKind, string> = {
    received: "Received",
    assigned: "Assigned",
    in_progress: "In progress",
    team_update: "Update from the team",
    completed: "Completed",
    withdrawn: "Withdrawn",
    route_failed: "Routing held",
    promised_date_set: "Completion date set",
};

/** The lifecycle steps, in order, for the reference list on the help home. */
export const LIFECYCLE: { status: TicketStatus; label: string; detail: string }[] = [
    { status: "received", label: "Received", detail: "We have it. It gets a reference you can quote." },
    { status: "assigned", label: "Assigned", detail: "A named person on the team has it." },
    { status: "in_progress", label: "In progress", detail: "Work has started. Updates from the team appear on the request." },
    { status: "completed", label: "Completed", detail: "Done. The request stays here for your records." },
];

/* ── Dates ───────────────────────────────────────────────────────────────────
   Two kinds of value arrive from the database and they must not be parsed the same way.

   `created_at`, `completed_at` and `withdrawn_at` are timestamptz: an instant, safe to
   hand straight to `new Date()`.

   `needed_by` and `promised_date` are plain `date` columns, "2026-09-11" with no zone.
   `new Date("2026-09-11")` is specified to parse a bare date as UTC midnight, which in
   any negative-offset timezone renders as the 10th. A client in Los Angeles being shown
   a promised date one day earlier than the one we agreed is exactly the class of quiet
   wrongness this feature exists to remove, so date-only strings get their own parser. */

export const parseDayLocal = (isoDay: string): Date | null => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDay.trim());
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return Number.isNaN(d.getTime()) ? null : d;
};

const DAY_LONG = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" });
const DAY_SHORT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const DAY_TIME = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** "11 September 2026" from a plain `date` column. Empty string when there is nothing to show. */
export const formatDayLong = (isoDay: string | null | undefined): string => {
    const d = isoDay ? parseDayLocal(isoDay) : null;
    return d ? DAY_LONG.format(d) : "";
};

/** "11 Sep 2026" from a plain `date` column. */
export const formatDayShort = (isoDay: string | null | undefined): string => {
    const d = isoDay ? parseDayLocal(isoDay) : null;
    return d ? DAY_SHORT.format(d) : "";
};

/** "12 September", the way the Figma writes a due date: day and full month, no year. */
export const formatDayMonth = (iso: string | null | undefined): string => {
    if (!iso) return "";
    const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? parseDayLocal(iso) : new Date(iso);
    return !d || Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", { day: "numeric", month: "long" });
};

/** "8 Sep", the way the Figma writes the day a request was raised. */
export const formatDayMonthShort = (iso: string | null | undefined): string => {
    if (!iso) return "";
    const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? parseDayLocal(iso) : new Date(iso);
    return !d || Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

/** "Friday 12 September", the COMMITTED block's date. */
export const formatWeekdayDayMonth = (iso: string | null | undefined): string => {
    if (!iso) return "";
    const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? parseDayLocal(iso) : new Date(iso);
    return !d || Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
};

/** "8 September, 16:12", a timeline stamp. */
export const formatDayMonthTime = (iso: string | null | undefined): string => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "long" })}, ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
};

/** "11 Sep 2026" from a timestamptz. */
export const formatStampShort = (iso: string | null | undefined): string => {
    if (!iso) return "";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "" : DAY_SHORT.format(d);
};

/** "11 Sep 2026, 14:32" from a timestamptz, for the timeline where order matters. */
export const formatStampWithTime = (iso: string | null | undefined): string => {
    if (!iso) return "";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "" : DAY_TIME.format(d);
};

/** Today, as a `date` string, for the "needed by" minimum on the form. */
export const todayIsoDay = (): string => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/**
 * How long a request has been open, in whole days, counted from calendar day to calendar
 * day rather than by dividing elapsed milliseconds.
 *
 * Raised at 23:00 and read at 07:00 the next morning is one day old to the person reading
 * it, not zero, and a millisecond division says zero. Clients quote this number back at
 * us, so it has to match what their calendar says.
 */
export const elapsedDays = (fromIso: string, toIso?: string | null): number | null => {
    const from = new Date(fromIso);
    const to = toIso ? new Date(toIso) : new Date();
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const days = Math.round((startOfDay(to) - startOfDay(from)) / 86_400_000);
    return days < 0 ? 0 : days;
};

export const elapsedLabel = (t: Ticket): string => {
    const end = t.completed_at ?? t.withdrawn_at ?? null;
    const days = elapsedDays(t.created_at, end);
    if (days === null) return "";
    const word = days === 0 ? "Today" : days === 1 ? "1 day" : `${days} days`;
    return end ? (days === 0 ? "Same day" : word) : word;
};

/* ── The promise block ───────────────────────────────────────────────────────
   The single source for what a client is told about timing, on every screen and at every
   width. Read the file header before changing it. */

export type PromiseTone = "pending" | "dated" | "done" | "closed";

export interface PromiseBlock {
    tone: PromiseTone;
    /** The one line set in large type. */
    headline: string;
    /** The line under it. Always a statement of fact, never an estimate. */
    sub: string;
}

export const promiseBlock = (t: Ticket): PromiseBlock => {
    const owner = (t.assignee_name ?? "").trim();

    if (t.status === "withdrawn") {
        const on = formatStampShort(t.withdrawn_at);
        return {
            tone: "closed",
            headline: "Withdrawn",
            sub: on ? `Withdrawn on ${on}. Nothing more will happen on it.` : "Nothing more will happen on it.",
        };
    }

    if (t.status === "completed") {
        const on = formatStampShort(t.completed_at);
        return {
            tone: "done",
            headline: on ? `Completed ${on}` : "Completed",
            sub: owner ? `Finished by ${owner}.` : "This request is finished.",
        };
    }

    // Checked before anything else below it, so the day a turnaround is configured and the
    // brain starts writing promised_date, every screen shows the date with no code change.
    if (t.promised_date) {
        const on = formatDayLong(t.promised_date);
        return {
            tone: "dated",
            headline: `Promised by ${on}`,
            sub: owner ? `${owner} has this request.` : "We are confirming who has this request.",
        };
    }

    // No promised date exists, and we do not invent one. Both branches name what IS true
    // and say plainly that a date is not set, rather than reaching for "soon".
    if (owner) {
        return {
            tone: "pending",
            headline: "Assigned",
            sub: `${owner} has this request. No completion date has been set yet.`,
        };
    }

    return {
        tone: "pending",
        headline: "Received",
        sub: "We have it and are deciding who will take it. No completion date has been set yet.",
    };
};

/**
 * What a topic tells a client about turnaround, before they raise anything.
 *
 * Separate from promiseBlock on purpose: this is a property of the TOPIC, read straight
 * from the row, not a prediction about one request. NULL turnaround_days returns null and
 * the chooser renders no timing line at all, so nothing has to be edited when a real
 * number is set.
 */
export const topicTurnaroundLabel = (topic: TicketTopic): string | null => {
    const n = topic.turnaround_days;
    if (n === null || n === undefined || !Number.isFinite(n) || n <= 0) return null;
    return n === 1 ? "1 working day" : `${n} working days`;
};

/* ── List filtering and counting ─────────────────────────────────────────────
   A withdrawn request STAYS on the list. It has its own filter rather than being dropped,
   because a client who withdrew something by mistake needs to find it again. */

export type RequestFilter = "all" | "open" | "completed" | "withdrawn";

export const FILTERS: { key: RequestFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "open", label: "Open" },
    { key: "completed", label: "Completed" },
    { key: "withdrawn", label: "Withdrawn" },
];

export const matchesFilter = (t: Ticket, filter: RequestFilter): boolean => {
    if (filter === "all") return true;
    if (filter === "open") return isOpen(t);
    if (filter === "completed") return t.status === "completed";
    return t.status === "withdrawn";
};

/** Counts computed here as well as returned by the API, so a filtered view stays truthful
 *  while a request is being withdrawn and the server counts have not caught up. */
export const countsFor = (tickets: Ticket[]): TicketCounts => ({
    total: tickets.length,
    open: tickets.filter(isOpen).length,
});

/** "7 requests. 2 open." Singular handled because "1 requests" undoes the care everywhere else. */
export const requestsSummary = (counts: TicketCounts): string => {
    const total = `${counts.total} ${counts.total === 1 ? "request" : "requests"}`;
    return `${total}. ${counts.open} open.`;
};

/** Completed inside the current calendar month, for the Current position panel. */
export const completedThisMonth = (tickets: Ticket[]): number => {
    const now = new Date();
    return tickets.filter((t) => {
        if (t.status !== "completed" || !t.completed_at) return false;
        const d = new Date(t.completed_at);
        return !Number.isNaN(d.getTime()) && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
};

export const inProgressCount = (tickets: Ticket[]): number => tickets.filter((t) => t.status === "in_progress").length;

/** A ticket can only be withdrawn while it is still open. Closed rows are never deleted. */
export const canWithdraw = (t: Ticket): boolean => isOpen(t);

/* ── Small shared helpers ────────────────────────────────────────────────── */

/** The topic's label, falling back to the raw key so an unseeded topic still reads as something. */
export const topicLabel = (topics: TicketTopic[], key: string): string => topics.find((t) => t.key === key)?.label ?? key;

/**
 * Who wrote a team update, for the byline.
 *
 * Rule 3 of the design document puts the person's name on every comment because the Asana
 * connection is one shared account. The same reasoning applies facing the other way: an
 * update signed "HiddenGem Media" tells a client nothing about who to thank or chase. Falls back
 * to the address, then to a neutral label, so a byline is never blank.
 */
export const actorName = (e: TicketEvent): string => (e.actor_name ?? "").trim() || (e.actor_email ?? "").trim() || "HiddenGem Media team";

/** First letter of a name, for the update avatars. */
export const initialOf = (name: string): string => (name.trim()[0] ?? "?").toUpperCase();

// requests screen

/*
 * Month names written out here rather than asked of Intl: Chrome's en-GB short month
 * for September is "Sept", and the frame writes "raised 8 Sep". A table cannot drift
 * with the browser's locale data.
 */
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** A plain `date` column parses as a local day; a timestamptz as the instant it is. */
const dateOf = (iso: string | null | undefined): Date | null => {
    if (!iso) return null;
    const d = /^\d{4}-\d{2}-\d{2}$/.test(iso.trim()) ? parseDayLocal(iso) : new Date(iso);
    return !d || Number.isNaN(d.getTime()) ? null : d;
};

/** "12 September": the requests list's due date, day and full month, no year. */
export const formatDueDay = (iso: string | null | undefined): string => {
    const d = dateOf(iso);
    return d ? `${d.getDate()} ${MONTHS_LONG[d.getMonth()]}` : "";
};

/** "8 Sep": the day a request was raised, three-letter month. */
export const formatRaisedDay = (iso: string | null | undefined): string => {
    const d = dateOf(iso);
    return d ? `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}` : "";
};

/**
 * The list row's right-hand line. "Due 12 September" while the request is open and a
 * date has been promised; "Completed in 3 days" (or "Completed same day") counted from
 * the day it was raised to the day it was finished; "Withdrawn" when it was; and
 * nothing at all for an open request with no promised date, because there is no date
 * to show and the row does not invent one.
 */
export const requestDueLine = (t: Ticket): string => {
    if (t.status === "withdrawn") return "Withdrawn";
    if (t.status === "completed") {
        const days = elapsedDays(t.created_at, t.completed_at);
        if (days === null) return "Completed";
        return days === 0 ? "Completed same day" : `Completed in ${days} ${days === 1 ? "day" : "days"}`;
    }
    if (isOpen(t) && t.promised_date) return `Due ${formatDueDay(t.promised_date)}`;
    return "";
};

/**
 * The meta line under a row title, ONE text node as the frame draws it:
 * "{topic label}  ·  raised {d Mon}" with two spaces either side of the dot, kept from
 * collapsing by non-breaking spaces. Without a raise date it is the topic label alone.
 */
export const requestMetaLine = (topics: TicketTopic[], t: Ticket): string => {
    const raised = formatRaisedDay(t.created_at);
    const label = topicLabel(topics, t.topic);
    return raised ? `${label}\u00a0\u00a0·\u00a0\u00a0raised ${raised}` : label;
};
