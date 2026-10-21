/**
 * Client Requests, phase 3 (owner, 21 Oct 2026): how many requests are open, as a small pill
 * on the "Client Requests" row of the Web Team side menu. The row carries this component as
 * its `badge` (dashboard-screen.tsx DeptTab), so the menu knows nothing about requests.
 *
 * One count for the whole tab, kept in this module: read once when the Web Team menu first
 * shows (the same staff-only ticket-list-all read the screen makes, all pages), read again
 * when the window regains focus, and replaced whenever the Client Requests screen has rows,
 * so an Approve in its panel moves the badge with the metric cards. Open is help-model's
 * (received, assigned, in progress, awaiting review); the pill turns warning while any await
 * the AM's review. A failed read, a password unlock with no session or a non-staff session
 * shows no badge at all: the menu never shows an error.
 */
import { useEffect, useSyncExternalStore } from "react";
import { Badge } from "@/components/base/badges/badges";
import { fetchAllTickets } from "@/pages/client/help/help-api";
import { type Ticket, todayIsoDay } from "@/pages/client/help/help-model";
import { metricsOf, openBadgeLabel } from "@/pages/team/client-requests/client-requests-model";

/** Ten pages of 200. Past this the screen says how many it shows; /team/tickets pages through the rest. */
export const MAX_ROWS = 2000;

/** Every request, newest first, following next_before until the server has no more or MAX_ROWS is reached. */
export const loadAllRequests = async (): Promise<{ rows: Ticket[]; total: number; capped: boolean }> => {
    const rows: Ticket[] = [];
    let total = 0;
    let before: string | null = null;
    do {
        const page = await fetchAllTickets({ before });
        // The first page's count is every request; later pages count only what is older.
        if (!rows.length) total = page.total;
        rows.push(...page.tickets);
        before = page.next_before;
    } while (before && rows.length < MAX_ROWS);
    return { rows, total, capped: !!before };
};

type Counts = { open: number; inReview: number } | null;

let counts: Counts = null;
let started = false;
let inFlight = false;
const listeners = new Set<() => void>();
const set = (next: Counts) => {
    counts = next;
    listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
};

/** The screen hands its rows over on every change, so the badge and the metric cards agree. */
export const setOpenCountsFrom = (rows: Ticket[]) => {
    const m = metricsOf(rows, todayIsoDay(), new Date());
    set({ open: m.open, inReview: m.inReview });
};

const refresh = async () => {
    if (inFlight) return;
    inFlight = true;
    try {
        setOpenCountsFrom((await loadAllRequests()).rows);
    } catch {
        set(null);
    }
    inFlight = false;
};

export const OpenRequestsBadge = () => {
    const c = useSyncExternalStore(subscribe, () => counts);
    useEffect(() => {
        if (!started) {
            started = true;
            void refresh();
        }
        const onFocus = () => void refresh();
        window.addEventListener("focus", onFocus);
        return () => window.removeEventListener("focus", onFocus);
    }, []);

    if (!c || c.open === 0) return null;
    return (
        <Badge type="pill-color" size="sm" color={c.inReview ? "warning" : "gray"} className="ml-auto shrink-0">
            <span aria-hidden="true">{c.open.toLocaleString("en-US")}</span>
            <span className="sr-only">{`, ${openBadgeLabel(c.open, c.inReview)}`}</span>
        </Badge>
    );
};
