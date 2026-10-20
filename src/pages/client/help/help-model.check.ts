/**
 * Self-check for the words a list row says about a request's websites (Enjoy Unique Stays,
 * 29 Sep 2026): websitesShort, and the suffix the meta lines gain. The case that matters most
 * is the one every other client is: a request with no websites keeps its line byte for byte.
 * Since 20 Oct 2026 also the awaiting-review rules and the line staff read after Approve.
 * Run it:
 *   node --experimental-strip-types src/pages/client/help/help-model.check.ts
 *
 * Same no-framework pattern as its siblings: plain asserts, no test runner. `tsc -b` still
 * type-checks it because it lives under src/.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { STATUS_META, type Ticket, approvalLine, canAsk, canWithdraw, isOpen, requestMetaLine, timelineSteps, underwayTickets, websitesShort, websitesSuffix } from "./help-model.ts";
import type { StoredWebsites, Website } from "./request-rules.ts";

const SIX: Website[] = [
    { name: "Paradise Pointe", url: "https://stayparadisepointe.com/", tenant_slug: "paradise-pointe" },
    { name: "Ridge & Falls", url: "https://ridgeandfalls.com/", tenant_slug: "ridge-falls" },
    { name: "Treetop Escapes", url: "https://staytreetopescapes.com/", tenant_slug: "treetop-escapes" },
    { name: "Little River Landing", url: "https://staylittleriver.com/", tenant_slug: "little-river-landing" },
    { name: "Stay Saluda", url: "https://staysaluda.com/", tenant_slug: "stay-saluda" },
    { name: "Inspired Retreats", url: "https://stayinspiredretreats.com/", tenant_slug: "inspired-retreats" },
];
const of = (...picks: number[]): StoredWebsites => ({ offered: 6, chosen: picks.map((i) => SIX[i]) });

/* 1. websitesShort: all, one, two, three or more. */
assert.equal(websitesShort(of(0, 1, 2, 3, 4, 5)), "All 6 websites");
assert.equal(websitesShort(of(4)), "Stay Saluda", "one: its name");
assert.equal(websitesShort(of(0, 4)), "Paradise Pointe and Stay Saluda", "two: both names");
assert.equal(websitesShort(of(0, 1, 4)), "3 websites", "three, not all: a count");
assert.equal(websitesShort(of(0, 1, 2, 3, 4)), "5 websites");
assert.equal(websitesShort({ offered: 2, chosen: SIX.slice(0, 2) }), "All 2 websites", "all is decided by what was offered, not by six");
assert.equal(websitesShort({ offered: 3, chosen: SIX.slice(0, 2) }), "Paradise Pointe and Ridge & Falls");

/* 2. The meta line: unchanged without websites, one suffix with them. */
const DOT = "\u00a0\u00a0·\u00a0\u00a0";
const topics = [{ key: "website", label: "Website", description: null }];
const base: Ticket = { id: "t1", reference: "REQ-1", topic: "website", title: "Swap the hero", status: "received", created_at: "2026-09-08T12:00:00Z" };
const today = `Website${DOT}raised 8 Sep`;
assert.equal(requestMetaLine(topics, base), today, "no websites key: the line as it always was");
assert.equal(requestMetaLine(topics, { ...base, websites: null }), today, "null: a dashboard with no choice");
assert.equal(requestMetaLine(topics, { ...base, websites: { offered: 6, chosen: [] } }), today, "a value that is not the stored shape draws nothing");
assert.equal(requestMetaLine(topics, { ...base, websites: SIX }), today, "a bare list is not the stored shape either");
assert.equal(requestMetaLine(topics, { ...base, websites: of(0, 1, 2, 3, 4, 5) }), `${today}${DOT}All 6 websites`);
assert.equal(requestMetaLine(topics, { ...base, websites: of(0, 4) }), `${today}${DOT}Paradise Pointe and Stay Saluda`);
assert.equal(requestMetaLine(topics, { ...base, created_at: "not a date", websites: of(4) }), `Website${DOT}Stay Saluda`, "no raise date: the label, then the websites");
assert.equal(requestMetaLine(topics, { ...base, created_at: "not a date" }), "Website", "and the label alone without them");
// jsonb hands keys back in its own order: the stored value reads the same.
const fromJsonb = JSON.parse(`{"chosen": [{"url": "https://staysaluda.com/", "name": "Stay Saluda", "tenant_slug": "stay-saluda"}], "offered": 6}`);
assert.equal(websitesSuffix({ ...base, websites: fromJsonb }), `${DOT}Stay Saluda`);
assert.equal(websitesSuffix(base), "");

/* 3. Awaiting review (owner, 20 Oct 2026): staff only, still open, never withdrawable, Completed not ticked. */
const review: Ticket = { ...base, status: "in_review" };
assert.equal(STATUS_META.in_review.label, "Awaiting review");
assert.ok(isOpen(review), "open: the client has not been told it is done");
assert.ok(canAsk(review), "a question still reaches the team");
assert.ok(!canWithdraw(review), "the work is done: ticket-withdraw refuses it");
assert.ok(canWithdraw({ ...base, status: "in_progress" }), "in progress still withdrawable");
assert.deepEqual(underwayTickets([review, base]), [review], "counted as underway, received is not");
assert.deepEqual(
    timelineSteps(review, []).map((s) => [s.key, s.state]),
    [["received", "done"], ["in_progress", "now"], ["completed", "todo"]],
    "Completed is ticked only once approved",
);

/* 4. The line after Approve: the client's name, then the email outcome from the platform's answer. */
assert.equal(approvalLine("Paradise Pointe", { already: false, email: "sent" }), "Approved. Paradise Pointe now sees it completed. The completion email went out.");
assert.equal(approvalLine("Paradise Pointe", { already: false, email: "failed" }), "Approved. Paradise Pointe now sees it completed. The completion email could not be sent, so let them know yourself.");
assert.equal(approvalLine("Paradise Pointe", { already: false, email: "not_applicable" }), "Approved. Paradise Pointe now sees it completed. No completion email was asked for on this request.");
assert.equal(approvalLine("  ", { already: false, email: null }), "Approved. The client now sees it completed.", "no name, no email word: nothing invented");
assert.equal(approvalLine("FLOHOM", { already: true, email: "sent" }), "It was already approved. FLOHOM sees it completed.", "a second press");

/* 5. House style. */
const dashes = new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`);
for (const f of ["./help-model.ts", "./help-model.check.ts"]) assert.ok(!dashes.test(readFileSync(new URL(f, import.meta.url), "utf8")), `no en or em dash in ${f}`);

console.log("help-model: all checks passed");
