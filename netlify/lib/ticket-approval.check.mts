/**
 * Self-check for ticket-approval.mts: the approve URL, and every platform answer in words.
 * No network. Run it:
 *   node --experimental-strip-types netlify/lib/ticket-approval.check.mts
 *
 * The case that matters most: a received URL that does not end /received gives no approve URL
 * at all, so an approval is never posted to the routing endpoint.
 *
 * House style: no em or en dashes anywhere.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TIMED_OUT, UNREACHABLE, approveUrlFrom, notInReview, platformAnswer } from "./ticket-approval.mts";

/* 1. Where the approval goes. */
const RECEIVED = "https://app.hiddengem.media/api/v1/tickets/received";
assert.equal(approveUrlFrom(undefined, RECEIVED), "https://app.hiddengem.media/api/v1/tickets/approve");
assert.equal(approveUrlFrom("", `${RECEIVED}/`), "https://app.hiddengem.media/api/v1/tickets/approve", "a trailing slash too");
assert.equal(approveUrlFrom(" https://x.test/approve-here ", RECEIVED), "https://x.test/approve-here", "the override wins");
assert.equal(approveUrlFrom(undefined, "https://app.hiddengem.media/api/v1/tickets"), undefined, "never the routing endpoint");
assert.equal(approveUrlFrom(undefined, "https://app.hiddengem.media/received-tickets"), undefined);
assert.equal(approveUrlFrom(undefined, undefined), undefined);

/* 2. Approved, with what happened to the email. */
assert.deepEqual(platformAnswer("REQ-1", 200, { ok: true, email: "sent" }), { status: 200, body: { approved: true, already: false, email: "sent" } });
assert.deepEqual(platformAnswer("REQ-1", 200, { ok: true, already: true }), { status: 200, body: { approved: true, already: true, email: null } }, "a second approval");
assert.deepEqual(platformAnswer("REQ-1", 200, { ok: true, email: "posted" }), { status: 200, body: { approved: true, already: false, email: null } }, "an unknown word claims nothing");
for (const email of ["queued", "retrying", "failed", "not_sent", "not_applicable"]) assert.equal((platformAnswer("REQ-1", 200, { ok: true, email }).body as { email: unknown }).email, email);

/* 3. Not approved. */
assert.deepEqual(platformAnswer("REQ-7", 409, { error: "not_in_review", status: "completed" }), { status: 409, body: { error: notInReview("REQ-7", "completed") } });
assert.match(notInReview("REQ-7", "in_progress"), /^REQ-7 is in progress, not awaiting review/);
assert.match(notInReview("REQ-7", "something_new"), /^REQ-7 is not awaiting review/, "an unknown status is not echoed raw");
assert.equal(platformAnswer("REQ-1", 401, { error: "unauthorized" }).status, 502, "our key is wrong: not the AM's 401");
assert.match((platformAnswer("REQ-1", 401, null).body as { error: string }).error, /key/);
assert.equal(platformAnswer("REQ-1", 500, { error: "boom" }).status, 502);
assert.equal(platformAnswer("REQ-1", 200, { ok: false }).status, 502, "200 without ok is not an approval");
assert.equal(platformAnswer("REQ-1", 200, null).status, 502, "nor is an unreadable body");
assert.equal(platformAnswer("REQ-1", 409, { error: "conflict" }).status, 502, "a 409 that is not not_in_review");
assert.ok(TIMED_OUT.includes("Reload") && UNREACHABLE.includes("twice is safe"));

/* 4. House style. */
const dashes = new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`);
for (const f of ["./ticket-approval.mts", "./ticket-approval.check.mts", "../functions/ticket-approve.mts"]) assert.ok(!dashes.test(readFileSync(new URL(f, import.meta.url), "utf8")), `no en or em dash in ${f}`);

console.log("ticket-approval: all checks passed");
