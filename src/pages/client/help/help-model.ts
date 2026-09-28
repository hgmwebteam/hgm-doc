/**
 * The help centre's data model: the shapes the portal functions hand back, and the pure
 * rules that turn a ticket row into the words a client reads.
 *
 * No React and no fetch on purpose. The honest-degradation rules below are the part of
 * this feature most likely to be got wrong later, so they live somewhere they can be read
 * (and checked) without standing a page up.
 *
 * ── THE RULE THIS FILE EXISTS TO ENFORCE ────────────────────────────────────
 * A client never sees a planned, promised, expected or estimated date, and never sees who a
 * request is assigned to (owner, 28 Sep 2026: "Do not give a date estimate, only show when the
 * date is complete", and "Remove the assigned to"). While a request is open it reads as its
 * status and its account manager; once it is done it carries the day it was completed. How
 * long it has been open (ELAPSED) is not an estimate and stays. `promised_date` and
 * `assignee_name` still exist, because routing writes them and the team's
 * own list and the Asana task use them, but the portal functions do not hand them to a client
 * (ticket-columns.mts, clientView) and nothing in this file turns one into words.
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

/**
 * A page address as a person reads it: without "https://" or "http://" and without a
 * trailing slash ("staysaluda.com/book"). Only for showing; the link keeps the full address.
 */
export const displayUrl = (url: string): string => url.replace(/^https?:\/\//i, "").replace(/\/$/, "");

/** Whether a stored page address may be rendered as a link: http or https, checked again at render. */
export const isWebLink = (url: unknown): url is string => {
    if (typeof url !== "string") return false;
    try {
        const u = new URL(url);
        return u.protocol === "https:" || u.protocol === "http:";
    } catch {
        return false;
    }
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
    /** How many files are attached: every file, not only images (the name predates PDFs). */
    image_count?: number | null;
    drive_folder_url?: string | null;
    client_name?: string | null;
    /** The signed-in address that raised it: the account of record. */
    submitted_by?: string | null;
    /** The Submitted by name the person typed (since 28 Sep 2026; the account's name before). */
    submitted_by_name?: string | null;
    /** Everyone sets one since 13 Sep 2026; null on a request raised before that. */
    priority?: Priority | null;
    /** The pages the request is about: absolute http or https addresses. Absent until the column exists. */
    urls?: string[] | null;
    /** The completion email address. Only ever in ticket-create's own answer, and only when it was stored. */
    notify_email?: string | null;
    /** ticket-detail: an address is stored and the completion email is switched on. Never the address itself. */
    completion_email_set?: boolean;
    /** On the team's cross-client list. */
    client_slug?: string | null;
    /** The team's views only: a client's answer never carries these two or promised_date. */
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

/** One attached file as the success card and the request page list it. Where it is kept is never sent. */
export interface TicketFile {
    name: string;
    mime: string;
    bytes: number | null;
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

/* ── Dates ───────────────────────────────────────────────────────────────────
   Two kinds of value arrive from the database and they must not be parsed the same way.

   `created_at`, `completed_at` and `withdrawn_at` are timestamptz: an instant, safe to
   hand straight to `new Date()`.

   `needed_by` and `promised_date` are plain `date` columns, "2026-09-11" with no zone.
   `new Date("2026-09-11")` is specified to parse a bare date as UTC midnight, which in
   any negative-offset timezone renders as the 10th. The team's list showing a date one day
   earlier than the one on the task is exactly the class of quiet wrongness this feature
   exists to remove, so date-only strings get their own parser. */

export const parseDayLocal = (isoDay: string): Date | null => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDay.trim());
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return Number.isNaN(d.getTime()) ? null : d;
};

const DAY_TIME = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

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

/** "Friday 4 September": the day a closed request was completed or withdrawn, in the status block. */
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

/**
 * The ELAPSED fact on the request page: time since the request was raised (to the day it
 * closed, once it has), never an estimate of what is left. The owner kept it (28 Sep 2026:
 * "Actually, leave time elapsed").
 */
export const elapsedLabel = (t: Ticket): string => {
    const end = t.completed_at ?? t.withdrawn_at ?? null;
    // A closed request with no closing stamp has no span to count; a growing
    // number would be a lie about a thing that has stopped.
    if (!end && (t.status === "completed" || t.status === "withdrawn")) return "";
    const days = elapsedDays(t.created_at, end);
    if (days === null) return "";
    const word = days === 0 ? "Today" : days === 1 ? "1 day" : `${days} days`;
    return end ? (days === 0 ? "Same day" : word) : word;
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
/** The category's label; a category no longer listed (deactivated) reads as words, not a key. */
export const topicLabel = (topics: TicketTopic[], key: string): string => {
    const known = topics.find((t) => t.key === key)?.label;
    if (known) return known;
    const words = key.replace(/[-_]+/g, " ").trim();
    return words ? words.charAt(0).toUpperCase() + words.slice(1) : key;
};

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

// home screen

/**
 * The "In progress" count on the help home: requests the team has taken on (assigned or in
 * progress). Received is left out, so the count agrees with the pills on the list, where a
 * received request reads "Received".
 */
export const underwayTickets = (tickets: Ticket[]): Ticket[] => tickets.filter((t) => t.status === "assigned" || t.status === "in_progress");

/** The "In progress" stat's second line. A state, never a date and never a name. */
export const underwayLine = (tickets: Ticket[]): string => (underwayTickets(tickets).length ? "With the team now" : "Nothing in progress right now");

/** The requests completed inside the current calendar month, for the second stat. */
export const completedThisMonthTickets = (tickets: Ticket[]): Ticket[] => {
    const now = new Date();
    return tickets.filter((t) => {
        if (t.status !== "completed" || !t.completed_at) return false;
        const d = new Date(t.completed_at);
        return !Number.isNaN(d.getTime()) && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
};

/**
 * "Last completed 4 September": the latest completion this month, the one kind of date a
 * client is shown (a completed one). It replaced "3.2 day average", which a client reads as the
 * time their next request will take. With nothing completed this month it says so.
 */
export const lastCompletedLine = (tickets: Ticket[]): string => {
    const latest = completedThisMonthTickets(tickets)
        .map((t) => t.completed_at!)
        .sort()
        .at(-1);
    const day = latest ? formatDayMonth(latest) : "";
    return day ? `Last completed ${day}` : "None yet this month";
};

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

/** "12 September": a due date on the team's list, day and full month, no year. */
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
 * The client list row's right-hand line, only once the request has closed: "Completed in 3
 * days" (or "Completed same day"), counted from the day it was raised to the day it was
 * finished, and "Withdrawn". Nothing while it is open: the status pill beside it says where it
 * is, and a client is never shown a due date. The team's list adds its own due dates to this.
 */
export const requestOutcomeLine = (t: Ticket): string => {
    if (t.status === "withdrawn") return "Withdrawn";
    if (t.status === "completed") {
        const days = t.completed_at ? elapsedDays(t.created_at, t.completed_at) : null;
        if (days === null) return "Completed";
        return days === 0 ? "Completed same day" : `Completed in ${days} ${days === 1 ? "day" : "days"}`;
    }
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

// detail screen

/**
 * Small counts as words, the way the detail frame writes "Three files attached."
 * Past twelve a numeral reads better than "thirteen", so the word list stops there.
 */
export const countWord = (n: number): string => {
    const words = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
    const w = words[n];
    return w ? w.charAt(0).toUpperCase() + w.slice(1) : String(n);
};

/** "Three files attached." or "One file attached."; empty when there are none, so nothing claims an attachment that does not exist. */
export const filesSentence = (count: number | null | undefined): string => {
    const n = count ?? 0;
    if (n <= 0) return "";
    return `${countWord(n)} ${n === 1 ? "file" : "files"} attached.`;
};

export type StepState = "done" | "now" | "todo";

/**
 * One row of the request timeline. `wide` is the sentence the 1440 frame writes under
 * the step and `narrow` the shorter one the 390 frame writes (usually just the time);
 * both are one text node so the screen can show either without splitting a sentence.
 */
export interface TimelineStep {
    key: string;
    label: string;
    state: StepState;
    wide: string;
    narrow: string;
}

const eventAt = (events: TicketEvent[], kind: TicketEventKind): TicketEvent | undefined =>
    [...events].filter((e) => e.kind === kind).sort((a, b) => a.created_at.localeCompare(b.created_at))[0];

/** The last step's line while the request is open: what will appear there, never when. One line in the 290 column at 390. */
export const COMPLETION_TO_COME = "The date appears here once it is done.";

/**
 * The lifecycle steps a client is shown: Received, In progress and Completed and verified,
 * with the ones that happened ticked, the current one marked and the rest numbered, plus a
 * "Withdrawn" step when the client withdrew it. Every date is an event's own stamp or the
 * completion itself. The frame's "Assigned to {name}" step is gone (owner, 28 Sep 2026: no
 * assignee and no promised date for clients), and so is the last step's "Expected {day}": until
 * the request is done that step says where its date will appear.
 */
export const timelineSteps = (ticket: Ticket, events: TicketEvent[], files: TicketFile[] = []): TimelineStep[] => {
    const received = eventAt(events, "received");
    const started = eventAt(events, "in_progress");
    const completed = eventAt(events, "completed");
    const withdrawn = eventAt(events, "withdrawn");
    const rank: Record<TicketStatus, number> = { received: 0, assigned: 1, in_progress: 2, completed: 3, withdrawn: -1 };
    const reached = rank[ticket.status];
    const open = ticket.status !== "completed" && ticket.status !== "withdrawn";

    const receivedAt = received?.created_at ?? ticket.created_at;
    const receivedTime = formatDayMonthTime(receivedAt);
    // The listed files are the truth when the page has them; the count covers an older
    // detail answer that carried none.
    const shots = filesSentence(Math.max(files.length, ticket.image_count ?? 0));

    const startedBody = (started?.body ?? "").trim() || (started ? formatDayMonthTime(started.created_at) : "");
    // The ticket's completed_at is the moment the task was closed; the event's
    // created_at is when the sweep noticed, up to half an hour later.
    const completedTime = ticket.completed_at ? formatDayMonthTime(ticket.completed_at) : completed ? formatDayMonthTime(completed.created_at) : "";
    const startedLine = started || reached >= 2 ? startedBody || "Work has started." : "Work starts. Updates from the team appear here.";

    const steps: TimelineStep[] = [
        {
            key: "received",
            label: "Received",
            state: "done",
            wide: shots ? `${receivedTime}. ${shots}` : receivedTime,
            narrow: receivedTime,
        },
        {
            key: "in_progress",
            label: "In progress",
            state: started || reached >= 2 ? "done" : "todo",
            wide: startedLine,
            narrow: startedLine,
        },
        {
            key: "completed",
            label: "Completed and verified",
            state: reached >= 3 ? "done" : "todo",
            wide: reached >= 3 ? completedTime || "Done." : COMPLETION_TO_COME,
            narrow: reached >= 3 ? completedTime || "Done." : COMPLETION_TO_COME,
        },
    ];

    if (ticket.status === "withdrawn") {
        // The lifecycle stopped here: the steps that had not happened are dropped, and
        // the withdrawal is the last thing on the list, with its own stamp.
        const at = formatDayMonthTime(withdrawn?.created_at ?? ticket.withdrawn_at);
        const kept = steps.filter((s) => s.state === "done");
        return [...kept, { key: "withdrawn", label: "Withdrawn", state: "done", wide: at || "By you.", narrow: at || "By you." }];
    }

    if (open) {
        // The current step is the last one that happened; the frame marks it with a
        // dot on the warning tint rather than a tick.
        const last = steps.map((s) => s.state).lastIndexOf("done");
        if (last >= 0) steps[last].state = "now";
    }
    return steps;
};
