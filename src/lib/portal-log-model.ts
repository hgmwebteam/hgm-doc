/**
 * /log, the portal change log: dashboard saves, releases and bugs in one feed, newest first.
 *
 * Pure (no React, no fetch), so portal-log-model.check.ts runs it under plain Node and
 * netlify/functions/ticket-bug-log.mts shares the one rule for what counts as a bug. Imports by
 * relative path with the extension, as client-requests-model.ts does, so Node can follow them.
 *
 *   dashboard  every client-dashboard Save or publish (dashboard_updates, src/lib/dashboard-updates.ts)
 *   release    every change in the build being served (src/lib/portal-releases.ts)
 *   bug        every request a team member raised about a portal page, which is what the
 *              dashboard's Report a problem button files (report-page-problem.tsx), and each
 *              status it has moved through since (ticket_events in HGM Reporting)
 */
import { STATUS_META, type TicketEvent, type TicketStatus, actorName, isTeamAddress } from "../pages/client/help/help-model.ts";
import type { DashboardUpdate } from "./dashboard-updates.ts";
import type { Release } from "./portal-releases.ts";

export type LogType = "dashboard" | "release" | "bug";

export const LOG_TYPES: { id: LogType; label: string }[] = [
    { id: "dashboard", label: "Dashboard updates" },
    { id: "release", label: "Releases" },
    { id: "bug", label: "Bugs" },
];

/** A ticket as ticket-bug-log.mts sends it. `urls` is the stored jsonb, unchecked: read it through portalPages. */
export interface BugTicket {
    id: string;
    reference: string;
    client_slug: string;
    client_name: string | null;
    title: string;
    status: TicketStatus;
    submitted_by: string;
    submitted_by_name: string | null;
    created_at: string;
    urls: unknown;
}

export type BugEvent = Pick<TicketEvent, "id" | "kind" | "actor_name" | "actor_email" | "created_at"> & { ticket_id: string };

/* ── What counts as a bug ─────────────────────────────────────────────────
   The Report a problem button files an ordinary Client Request (owner's choice, 22 Oct 2026),
   so no column says "from the button". What it always leaves is a team submitter and the open
   page's portal address in Pages, and that pair is the rule: a team member's request about a
   portal page. A request someone raised by hand with a portal link in it counts too, which is
   the same report by another route. */

/** hgmportal.com, the Netlify host and its deploy previews, and a local dev server. */
const PORTAL_HOST = /^(www\.)?hgmportal\.com$|(^|--)docs-hgm\.netlify\.app$|^localhost$/;

/** The portal addresses among a ticket's stored pages. */
export const portalPages = (urls: unknown): string[] =>
    (Array.isArray(urls) ? urls : []).filter((u): u is string => {
        if (typeof u !== "string") return false;
        try {
            return PORTAL_HOST.test(new URL(u).hostname);
        } catch {
            return false;
        }
    });

export const isPortalReport = (t: { submitted_by?: string | null; urls?: unknown }): boolean => isTeamAddress(t.submitted_by) && portalPages(t.urls).length > 0;

/* ── The feed ──────────────────────────────────────────────────────────── */

export interface LogPerson {
    /** Lower-cased email, or the name when there is none: what the Who filter keys on. */
    key: string;
    name: string;
    avatar: string;
}

interface EntryBase {
    key: string;
    at: string;
    who: LogPerson;
    /** The dashboard it is about. Null for a release, which is the whole portal. */
    client: { slug: string; name: string } | null;
}

export type LogEntry =
    | (EntryBase & { type: "dashboard"; update: DashboardUpdate })
    | (EntryBase & { type: "release"; release: Release })
    /** `moved` is the status it moved to, or null for the report itself. */
    | (EntryBase & { type: "bug"; ticket: BugTicket; moved: TicketStatus | null });

export const buildFeed = (updates: DashboardUpdate[], releases: Release[], bugs: BugTicket[], events: BugEvent[]): LogEntry[] => {
    // A person's Google name and photo from their dashboard saves, so their git name on a release
    // and the name they typed on a report read as the same person, under one Who option.
    const known = new Map<string, { name: string; avatar: string }>();
    for (const u of updates) {
        const key = u.author_email.toLowerCase();
        if (!known.has(key)) known.set(key, { name: u.author_name, avatar: u.author_avatar });
    }
    const person = (email: string | null | undefined, name: string): LogPerson => {
        const key = (email ?? "").trim().toLowerCase() || name.trim().toLowerCase();
        const seen = known.get(key);
        return { key, name: seen?.name || name.trim() || key, avatar: seen?.avatar ?? "" };
    };
    const client = (slug: string, name: string | null) => ({ slug, name: (name ?? "").trim() || slug });

    const out: LogEntry[] = [
        ...updates.map(
            (u): LogEntry => ({
                type: "dashboard",
                key: `d:${u.id}`,
                at: u.created_at,
                who: person(u.author_email, u.author_name),
                client: client(u.slug, u.client_name),
                update: u,
            }),
        ),
        ...releases.map((r): LogEntry => ({ type: "release", key: `r:${r.sha}`, at: r.at, who: person(r.author_email, r.author_name), client: null, release: r })),
        ...bugs.map(
            (t): LogEntry => ({
                type: "bug",
                key: `b:${t.id}`,
                at: t.created_at,
                who: person(t.submitted_by, t.submitted_by_name ?? ""),
                client: client(t.client_slug, t.client_name),
                ticket: t,
                moved: null,
            }),
        ),
    ];

    const ticketById = new Map(bugs.map((t) => [t.id, t]));
    for (const e of events) {
        const ticket = ticketById.get(e.ticket_id);
        // "received" is the report itself, already an entry above. Updates and questions are
        // not status changes, and a kind added later is left out until it has a status label.
        if (!ticket || e.kind === "received" || !(e.kind in STATUS_META)) continue;
        out.push({
            type: "bug",
            key: `e:${e.id}`,
            at: e.created_at,
            who: person(e.actor_email, actorName(e)),
            client: client(ticket.client_slug, ticket.client_name),
            ticket,
            moved: e.kind as TicketStatus,
        });
    }

    // By instant, not by string: git dates carry the committer's offset ("-04:00") and Supabase's
    // carry UTC, so the strings do not sort in time order.
    return out.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
};

export const ALL = "__all__";

export interface LogFilters {
    type: LogType | typeof ALL;
    who: string;
    client: string;
}

/** A client filter hides releases: they belong to no one client. */
export const filterFeed = (entries: LogEntry[], f: LogFilters): LogEntry[] =>
    entries.filter((e) => (f.type === ALL || e.type === f.type) && (f.who === ALL || e.who.key === f.who) && (f.client === ALL || e.client?.slug === f.client));
