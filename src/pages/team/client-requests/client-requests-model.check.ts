/**
 * Self-check for the Client Requests tab's metrics, filters and sort (owner, 21 Oct 2026).
 * Run it:
 *   node --experimental-strip-types src/pages/team/client-requests/client-requests-model.check.ts
 *
 * Plain asserts, no test runner, like its siblings. `tsc -b` type-checks it under src/.
 */
import assert from "node:assert/strict";
import type { Ticket } from "../../client/help/help-model.ts";
import { NO_FILTERS, applyFilters, clientOptions, hasFilters, isOverdue, metricsOf, requestHref, sortTickets } from "./client-requests-model.ts";

const TODAY = "2026-10-21";
const NOW = new Date(2026, 9, 21, 12);

const row = (id: string, over: Partial<Ticket>): Ticket => ({
    id,
    reference: `REQ-${id}`,
    topic: "website",
    title: `Request ${id}`,
    status: "received",
    created_at: `2026-10-0${id}T10:00:00Z`,
    client_slug: "paradise-pointe-dashboard",
    client_name: "Paradise Pointe",
    ...over,
});

const rows: Ticket[] = [
    row("1", { status: "completed", completed_at: "2026-10-03T15:00:00Z", needed_by: "2026-10-01" }),
    row("2", { status: "completed", completed_at: "2026-09-29T15:00:00Z" }),
    row("3", { status: "in_review", needed_by: "2026-10-20", priority: "high" }),
    row("4", {
        status: "in_progress",
        needed_by: "2026-10-21",
        client_slug: "stay-saluda-dashboard",
        client_name: "Stay Saluda",
        title: "Swap the hero image",
    }),
    row("5", { status: "withdrawn", needed_by: "2026-10-02", client_slug: "flohom-dashboard", client_name: null }),
    row("6", { status: "received", priority: "urgent" }),
];

/* 1. Overdue: open and asked for before today. Due today is not overdue; a closed request never is. */
assert.equal(isOverdue(rows[2], TODAY), true, "in_review counts as open");
assert.equal(isOverdue(rows[3], TODAY), false, "due today is not overdue");
assert.equal(isOverdue(rows[0], TODAY), false, "completed is never overdue");
assert.equal(isOverdue(rows[4], TODAY), false, "withdrawn is never overdue");

/* 2. The four cards. Completed this month ignores September's. */
assert.deepEqual(metricsOf(rows, TODAY, NOW), { open: 3, inReview: 1, overdue: 1, completedThisMonth: 1 });

/* 3. Filters: tabs, the metric focus, client, priority, search. */
const ids = (ts: Ticket[]) => ts.map((t) => t.id);
const f = (over: Partial<typeof NO_FILTERS>) => applyFilters(rows, { ...NO_FILTERS, ...over }, TODAY, NOW);
assert.deepEqual(ids(f({})), ["1", "2", "3", "4", "5", "6"]);
assert.deepEqual(ids(f({ tab: "open" })), ["3", "4", "6"]);
assert.deepEqual(ids(f({ tab: "in_review" })), ["3"]);
assert.deepEqual(ids(f({ tab: "open", focus: "overdue" })), ["3"]);
assert.deepEqual(ids(f({ tab: "completed", focus: "month" })), ["1"]);
assert.deepEqual(ids(f({ tab: "withdrawn" })), ["5"]);
assert.deepEqual(ids(f({ client: "stay-saluda-dashboard" })), ["4"]);
assert.deepEqual(ids(f({ priority: "urgent" })), ["6"]);
assert.deepEqual(ids(f({ query: "  HERO " })), ["4"], "title, trimmed, any case");
assert.deepEqual(ids(f({ query: "req-5" })), ["5"], "reference");
assert.deepEqual(ids(f({ query: "saluda" })), ["4"], "client name");
assert.deepEqual(ids(f({ query: "flohom" })), ["5"], "a missing client_name falls back to the slug");
assert.deepEqual(ids(f({ tab: "completed", priority: "urgent" })), [], "filters narrow together");
assert.equal(hasFilters(NO_FILTERS), false);
assert.equal(hasFilters({ ...NO_FILTERS, query: "   " }), false, "a blank search is no filter");
assert.equal(hasFilters({ ...NO_FILTERS, priority: "low" }), true);

/* 4. Sort: dates either way; no needed-by date always last. */
assert.deepEqual(ids(sortTickets(rows, "created_at", "ascending")), ["1", "2", "3", "4", "5", "6"]);
assert.deepEqual(ids(sortTickets(rows, "created_at", "descending")), ["6", "5", "4", "3", "2", "1"]);
assert.deepEqual(ids(sortTickets(rows, "needed_by", "ascending")), ["1", "5", "3", "4", "6", "2"]);
assert.deepEqual(ids(sortTickets(rows, "needed_by", "descending")), ["4", "3", "5", "1", "6", "2"]);

/* 5. Client options and the row link. */
assert.deepEqual(clientOptions(rows), [
    { id: "flohom-dashboard", label: "flohom" },
    { id: "paradise-pointe-dashboard", label: "Paradise Pointe" },
    { id: "stay-saluda-dashboard", label: "Stay Saluda" },
]);
assert.equal(requestHref(rows[3]), "/stay-saluda/help/requests/REQ-4");

console.log("client-requests-model: all checks pass");
