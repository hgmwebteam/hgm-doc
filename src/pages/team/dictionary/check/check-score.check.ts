/**
 * Self-check for check-score.ts: grade boundaries, rounding, and how the score moves
 * across retakes.
 *
 * Run it from the repo root:
 *   npx esbuild src/pages/team/dictionary/check/check-score.check.ts --bundle \
 *     --platform=node --format=cjs --alias:@=./src --outfile=/tmp/hgm-check/check-score.cjs \
 *   && node /tmp/hgm-check/check-score.cjs
 */
import assert from "node:assert";
import bankJson from "@/data/check-bank.json";
import master from "@/data/ref_dictionary-v2-253.json";
import type { CheckBank } from "@/pages/team/dictionary/check/check-model";
import { applyResults, grade, missedTerms, progressLine, roundPct, scorePct, termWeights } from "@/pages/team/dictionary/check/check-score";
import type { DictionaryEntry } from "@/pages/team/dictionary/dictionary-model";

const bank = bankJson as unknown as CheckBank;
const entries: DictionaryEntry[] = master;
const bySlug = new Map(entries.map((e) => [e.slug, e]));
const weights = termWeights(bank, bySlug);
const slugs = [...weights.keys()];
const tierA = slugs.filter((s) => bySlug.get(s)!.tier === "A");
const tierB = slugs.filter((s) => bySlug.get(s)!.tier === "B");

/* ── Weights come from the bank, tiers from the dictionary ──────── */

assert.equal(weights.size, 90);
assert.equal(weights.get("adr-average-daily-rate"), 2, "core terms are worth 2");
assert.equal(weights.get("rack-rate"), 1, "reference terms are worth 1");

/* ── Grade boundaries (Ontario scale; R below 50) ───────────────── */

const boundaries: [number, string][] = [
    [0, "R"],
    [49, "R"],
    [50, "D−"],
    [52, "D−"],
    [53, "D"],
    [57, "D+"],
    [60, "C−"],
    [63, "C"],
    [67, "C+"],
    [69, "C+"],
    [70, "B−"],
    [73, "B"],
    [77, "B+"],
    [79, "B+"],
    [80, "A−"],
    [84, "A−"],
    [85, "A"],
    [89, "A"],
    [90, "A+"],
    [100, "A+"],
];
for (const [pct, g] of boundaries) assert.equal(grade(pct), g, `${pct}% is ${g}`);

/* ── Rounding: 79.5 → 80 → A− ───────────────────────────────────── */

assert.equal(roundPct(79.5), 80);
assert.equal(grade(roundPct(79.5)), "A−");
assert.equal(roundPct(79.49), 79);
{
    // 159 of 200 points is exactly 79.5%: it rounds up, to an A−.
    const w = new Map(Array.from({ length: 200 }, (_, i) => [`t${i}`, 1]));
    const s = new Map(Array.from({ length: 159 }, (_, i) => [`t${i}`, true]));
    assert.equal(scorePct(w, s), 80);
    assert.equal(grade(scorePct(w, s)), "A−");
}

/* ── The real weights ───────────────────────────────────────────── */

const none = new Map<string, boolean>();
const all = new Map(slugs.map((s) => [s, true]));
assert.equal(scorePct(weights, none), 0, "nothing answered yet");
assert.equal(scorePct(weights, all), 100);
assert.equal(scorePct(weights, new Map(tierA.map((s) => [s, true]))), 50, "every core term right: 60 of 120");
assert.equal(scorePct(weights, new Map(tierB.map((s) => [s, true]))), 50, "every reference term right: 60 of 120");

/* ── A missed-only retake raises the score ──────────────────────── */

// First full check: 10 core and 20 reference terms wrong.
const firstWrong = new Set([...tierA.slice(0, 10), ...tierB.slice(0, 20)]);
const afterFirst = applyResults(none, new Map(slugs.map((s) => [s, !firstWrong.has(s)])));
assert.equal(scorePct(weights, afterFirst), 67, "(40 + 40) of 120 = 66.7 → 67");
assert.equal(grade(67), "C+");
assert.equal(missedTerms(weights, afterFirst).length, 30);

// Retake only those 30, getting 20 of them right. Nothing else is touched.
const retake = new Map([...firstWrong].map((s, i) => [s, i % 3 !== 0]));
const afterRetake = applyResults(afterFirst, retake);
assert.ok(scorePct(weights, afterRetake) > scorePct(weights, afterFirst), "the score goes up");
assert.equal(missedTerms(weights, afterRetake).length, 10, "and fewer terms come back");
for (const s of slugs) if (!firstWrong.has(s)) assert.equal(afterRetake.get(s), true, "terms the retake didn't serve keep their status");

/* ── A full retake can lower a term that was right ──────────────── */

const term = tierA[20];
assert.equal(afterRetake.get(term), true);
const fullAgain = applyResults(afterRetake, new Map(slugs.map((s) => [s, s !== term && afterRetake.get(s) === true])));
assert.equal(fullAgain.get(term), false, "the most recent answer wins");
assert.ok(scorePct(weights, fullAgain) < scorePct(weights, afterRetake), "so the score goes down");
assert.equal(missedTerms(weights, fullAgain).length, missedTerms(weights, afterRetake).length + 1);

/* ── The quiet comparison line ──────────────────────────────────── */

assert.equal(progressLine(null, { score: 80, missed: 12 }), null, "no line on a first sitting");
assert.equal(progressLine({ score: 71, missed: 19 }, { score: 80, missed: 12 }), "Up 9% since last time · 7 fewer terms to review");
assert.equal(progressLine({ score: 80, missed: 12 }, { score: 80, missed: 12 }), "The same score as last time");
assert.equal(progressLine({ score: 80, missed: 12 }, { score: 77, missed: 13 }), "Down 3% since last time · 1 more term to review");
for (const line of [progressLine({ score: 90, missed: 1 }, { score: 10, missed: 80 })!]) assert.ok(!/fail|problem|!/i.test(line), "never reads as a failure");

console.log("check-score: PASS");
