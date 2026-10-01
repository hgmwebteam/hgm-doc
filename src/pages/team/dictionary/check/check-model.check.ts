/**
 * Self-check for check-model.ts: the validator catches each rule it claims to, sittings are
 * built the way the brief says, and every question type marks correctly.
 *
 * Same no-framework pattern as its siblings. Run it from the repo root:
 *   npx esbuild src/pages/team/dictionary/check/check-model.check.ts --bundle \
 *     --platform=node --format=cjs --alias:@=./src --outfile=/tmp/hgm-check/check-model.cjs \
 *   && node /tmp/hgm-check/check-model.cjs
 */
import assert from "node:assert";
import bankJson from "@/data/check-bank.json";
import master from "@/data/ref_dictionary-v2-253.json";
import {
    type BankItem,
    type CheckBank,
    MASK,
    type PlanEntry,
    type TermStatus,
    WORD_PROBLEMS_AFTER,
    bankProblems,
    buildPlan,
    explanationFor,
    finishSitting,
    flashcardMaskWords,
    isAnswered,
    isWithin,
    itemTerms,
    latestByTerm,
    markEntry,
    maskText,
    maskWords,
    nextVariant,
    parseNumber,
    rowsToSave,
    seededRandom,
    shuffledSteps,
    standaloneBlank,
    standalonePrompt,
} from "@/pages/team/dictionary/check/check-model";
import type { DictionaryEntry } from "@/pages/team/dictionary/dictionary-model";

const bank = bankJson as unknown as CheckBank;
const entries: DictionaryEntry[] = master;
const bySlug = new Map(entries.map((e) => [e.slug, e]));
const item = (id: string) => bank.items.find((i) => i.id === id)!;
const clone = (): CheckBank => JSON.parse(JSON.stringify(bank));
const has = (problems: string[], text: string) => problems.some((p) => p.includes(text));

/* ── The validator catches each rule ────────────────────────────── */

assert.deepEqual(bankProblems(bank, bySlug), [], "the real bank is clean");
{
    const b = clone();
    (b.items.find((i) => i.id === "noi") as { term: string }).term = "not-a-term";
    const p = bankProblems(b, bySlug);
    assert.ok(has(p, `"not-a-term" is not in the dictionary`), "unknown slug");
    assert.ok(has(p, `"noi-net-operating-income" is in the dictionary but not in the bank`), "a missing A term");
}
{
    const b = clone();
    (b.items.find((i) => i.id === "ebitda") as { term: string }).term = "cap-rate";
    assert.ok(has(bankProblems(b, bySlug), `"cap-rate" is scored twice`), "a term scored twice");
}
{
    const b = clone();
    (b.items.find((i) => i.id === "genius") as { term: string }).term = "adr-average-daily-rate";
    assert.ok(has(bankProblems(b, bySlug), `tier A "adr-average-daily-rate" can't sit in a truefalse item`), "tier A in true/false");
}
{
    const b = clone();
    const m = b.items.find((i) => i.id === "match-rates") as { terms: string[] };
    m.terms[0] = "comp-set";
    assert.ok(has(bankProblems(b, bySlug), `tier A "comp-set" can't sit in a matching item`), "tier A in matching");
}
{
    const b = clone();
    b.items.find((i) => i.id === "pace")!.variants.pop();
    assert.ok(has(bankProblems(b, bySlug), "pace: has 1 variant(s)"), "fewer than two variants");
}
{
    const b = clone();
    (b.items.find((i) => i.id === "pace")!.variants[0] as { answer: string }).answer = "Not an option";
    assert.ok(has(bankProblems(b, bySlug), `the answer "Not an option" is not one of its options`), "mcq answer not an option");
}
{
    const b = clone();
    (b.items.find((i) => i.id === "tools-buckets")!.variants[0] as { chips: { box: string }[] }).chips[0].box = "Nowhere";
    assert.ok(has(bankProblems(b, bySlug), `goes in "Nowhere", which isn't one of its boxes`), "chip box not in boxes");
}
{
    const b = clone();
    b.items.push({ id: "extra", type: "truefalse", term: "pixel-c-term-that-does-not-exist", variants: [] } as unknown as BankItem);
    assert.ok(has(bankProblems(b, bySlug), "extra: has 0 variant(s)"), "an item with no variants");
}
{
    const tierC = entries.find((e) => e.tier === "C")!;
    const b = clone();
    (b.items.find((i) => i.id === "ebitda") as { term: string }).term = tierC.slug;
    assert.ok(has(bankProblems(b, bySlug), `is tier C; only tier A and B terms are scored`), "a tier C term");
}

/* ── Numbers people type ────────────────────────────────────────── */

assert.equal(parseNumber("1,350"), 1350);
assert.equal(parseNumber("$232.50"), 232.5);
assert.equal(parseNumber(" 75% "), 75);
assert.equal(parseNumber("$418,500"), 418500);
assert.equal(parseNumber("2.5x"), 2.5);
assert.equal(parseNumber(".5"), 0.5);
assert.equal(parseNumber("−4"), -4, "a typographic minus");
for (const bad of ["", "  ", "abc", "1.2.3", "75 percent", "$", "1e3"]) assert.equal(parseNumber(bad), null, `"${bad}" is not a number`);
assert.ok(isWithin(232.5, 232.5, 0.5));
assert.ok(isWithin(232, 232.5, 0.5), "the edge of the tolerance counts");
assert.ok(!isWithin(231.9, 232.5, 0.5));
assert.ok(isWithin(12.05, 12, 0.05), "float noise at the edge still counts");

/* ── Masking ────────────────────────────────────────────────────── */

const e = (slug: string) => bySlug.get(slug)!;
assert.equal(maskText("We have 40 keys.", ["keys"]), `We have 40 ${MASK}.`);
assert.equal(maskText("Rate plans and a rate plan", ["Rate plan"]), `${MASK} and a ${MASK}`, "case and an optional plural");
assert.equal(maskText("A pirate's rate", ["rate"]), `A pirate's ${MASK}`, "only whole words");
assert.ok(maskWords(e("otb-on-the-books")).includes("OTB"), "the term without its brackets");
assert.ok(maskWords(e("resort-fee-amenity-fee")).includes("amenity fee"), "each half of a / term");

// The four definitions that gave themselves away under the bank's rule (decision 3a).
for (const slug of ["ebitda", "flag", "keys-rooms-and-units", "booking-com-genius"]) {
    const before = maskText(e(slug).gloss, maskWords(e(slug)));
    const after = maskText(e(slug).gloss, flashcardMaskWords(e(slug), bank));
    assert.notEqual(after, before, `the flashcard mask blanks more of ${slug}'s definition`);
}
assert.ok(!/earnings before interest/i.test(maskText(e("ebitda").gloss, flashcardMaskWords(e("ebitda"), bank))), "EBITDA's expansion is blanked");
assert.ok(!/\bgenius\b/i.test(maskText(e("booking-com-genius").gloss, flashcardMaskWords(e("booking-com-genius"), bank))), "Genius is blanked");

/* ── Variants and shuffles ──────────────────────────────────────── */

const vs = [{ id: "a" }, { id: "b" }];
assert.equal(nextVariant(vs).id, "a", "a first sitting shows the first variant");
assert.equal(nextVariant(vs, "a").id, "b", "a retake shows the other one");
assert.equal(nextVariant(vs, "b").id, "a");
assert.equal(nextVariant(vs, "gone").id, "a", "an unknown variant starts again");

const r1 = seededRandom("attempt-1/pace");
const r2 = seededRandom("attempt-1/pace");
assert.deepEqual([r1(), r1(), r1()], [r2(), r2(), r2()], "a seed repeats exactly");
const steps = ["one", "two", "three", "four"];
for (let s = 0; s < 200; s++) assert.notDeepEqual(shuffledSteps(steps, seededRandom(`s${s}`)), steps, "ordering never starts solved");

/* ── A full sitting ─────────────────────────────────────────────── */

const none = new Map<string, TermStatus>();
const wpIds = new Set(bank.items.filter((i) => i.type === "wordproblem").map((i) => i.id));
for (let s = 0; s < 300; s++) {
    const plan = buildPlan(bank, "full", none, seededRandom(`full-${s}`));
    assert.equal(plan.length, bank.items.length, "every item once");
    assert.equal(new Set(plan.map((p) => p.item)).size, bank.items.length);
    assert.equal(plan.flatMap((p) => p.terms).length, 90, "all 90 terms");
    plan.forEach((p, i) => {
        if (wpIds.has(p.item)) {
            assert.ok(i >= WORD_PROBLEMS_AFTER, `a word problem is never in the first ${WORD_PROBLEMS_AFTER}`);
            assert.ok(i < plan.length - 1, "a word problem is never last");
        }
    });
    assert.ok(
        plan.every((p) => p.variant === item(p.item).variants[0].id),
        "a first sitting shows every item's first variant",
    );
}

/* A status built from one plan, every term answered as `correct(slug)`. */
const statusFrom = (plan: PlanEntry[], correct: (slug: string) => boolean, at = "2026-10-01T10:00:00Z") =>
    new Map(
        plan.flatMap((p) => p.terms.map((t) => [t, { term_slug: t, correct: correct(t), item_id: p.item, variant_id: p.variant, answered_at: at }] as const)),
    );

const first = buildPlan(bank, "full", none, seededRandom("first"));
const allRight = statusFrom(first, () => true);
const second = buildPlan(bank, "full", allRight, seededRandom("second"));
assert.ok(
    second.every((p) => p.variant === item(p.item).variants[1].id),
    "the next full sitting shows every item's other variant",
);

/* ── A missed-terms sitting ─────────────────────────────────────── */

assert.deepEqual(buildPlan(bank, "missed", allRight, seededRandom("m")), [], "nothing missed, nothing served");

const wrong = new Set(["adr-average-daily-rate", "rack-rate", "rate-plan", "cap-rate"]);
const someWrong = statusFrom(first, (t) => !wrong.has(t));
const missed = buildPlan(bank, "missed", someWrong, seededRandom("m"));
assert.deepEqual(new Set(missed.flatMap((p) => p.terms)), wrong, "only the missed terms are scored");

const adr = missed.find((p) => p.terms.includes("adr-average-daily-rate"))!;
assert.equal(adr.item, "wp-month");
assert.equal(adr.variant, "wp-month-v2", "a missed blank uses the other variant's table");
assert.ok(adr.blank, "and is served alone");
const alone = standaloneBlank(item("wp-month"), adr)!;
assert.equal(alone.blank.term, "adr-average-daily-rate");
assert.equal(standalonePrompt(alone), "An owner sends you their November numbers. Work out the ADR. Not every row is needed. All figures are illustrative.");

const rates = missed.find((p) => p.item === "match-rates")!;
assert.equal(rates.variant, "match-rates-v2", "a partly missed matching item comes back on its other variant");
assert.deepEqual(rates.terms.sort(), ["rack-rate", "rate-plan"], "but scores only the pairs that were missed");

const never = buildPlan(bank, "missed", none, seededRandom("m"));
assert.equal(never.flatMap((p) => p.terms).length, 90, "terms never answered count as missed");
assert.ok(
    never.every((p) => !wpIds.has(p.item) || p.blank),
    "in a missed sitting every word-problem blank stands alone",
);

/* ── Marking every type ─────────────────────────────────────────── */

const whole = (id: string, variant = 0): PlanEntry => ({ item: id, variant: item(id).variants[variant].id, terms: itemTerms(item(id)) });
const ok = (marks: Map<string, boolean>) => [...marks.values()].every(Boolean);

// Word problem, whole: each blank on its own.
{
    const wp = whole("wp-month");
    const values = { occ: "75%", adr: "$310", revpar: "232.50", anc: "$135,000" };
    assert.ok(ok(markEntry(item("wp-month"), wp, { kind: "numbers", values })), "a word problem answered right");
    const marks = markEntry(item("wp-month"), wp, { kind: "numbers", values: { ...values, adr: "300" } });
    assert.equal(marks.get("adr-average-daily-rate"), false, "a wrong blank is wrong on its own");
    assert.equal(marks.get("occupancy"), true, "and the others still count");
    assert.ok(isAnswered(item("wp-month"), wp, { kind: "numbers", values }));
    assert.ok(!isAnswered(item("wp-month"), wp, { kind: "numbers", values: { occ: "75" } }), "a half-filled word problem isn't answered");
}
// Word problem blank alone.
assert.ok(ok(markEntry(item("wp-month"), adr, { kind: "number", value: "250" })), "a standalone blank on v2's numbers");
assert.ok(!ok(markEntry(item("wp-month"), adr, { kind: "number", value: "310" })), "v1's answer is wrong on v2's table");
// Numeric, with tolerance.
assert.ok(ok(markEntry(item("noi"), whole("noi"), { kind: "number", value: "$220,000" })));
assert.ok(ok(markEntry(item("cap-rate"), whole("cap-rate"), { kind: "number", value: "7.04" })), "within ± 0.05");
assert.ok(!ok(markEntry(item("cap-rate"), whole("cap-rate"), { kind: "number", value: "7.1" })), "outside ± 0.05");
assert.ok(!ok(markEntry(item("noi"), whole("noi"), undefined)), "unanswered is missed");
// Choice: the option's text, so shuffling can't break it.
assert.ok(ok(markEntry(item("pace"), whole("pace"), { kind: "choice", value: "Pace" })));
assert.ok(!ok(markEntry(item("pace"), whole("pace"), { kind: "choice", value: "Pickup" })));
// True or false.
assert.ok(ok(markEntry(item("ebitda"), whole("ebitda"), { kind: "bool", value: true })));
assert.ok(ok(markEntry(item("ebitda"), whole("ebitda", 1), { kind: "bool", value: false })));
assert.ok(isAnswered(item("ebitda"), whole("ebitda"), { kind: "bool", value: false }), "false is an answer");
// Buckets: each chip on its own.
{
    const placed = {
        "crm-tools": "CRM",
        "guest-messaging-tools": "Upsell",
        "rate-shopping-and-market-intelligence-tools": "Rate shopping and market intelligence",
        "upsell-tools": "Upsell",
    };
    const marks = markEntry(item("tools-buckets"), whole("tools-buckets"), { kind: "boxes", placed });
    assert.deepEqual([...marks.values()], [true, false, true, true]);
}
// Matching: each pair on its own.
{
    const m = item("match-rates") as { terms: string[] };
    const chosen = Object.fromEntries(m.terms.map((t) => [t, t]));
    [chosen["rack-rate"], chosen["rate-plan"]] = ["rate-plan", "rack-rate"];
    const marks = markEntry(item("match-rates"), whole("match-rates"), { kind: "pairs", chosen });
    assert.equal([...marks.values()].filter(Boolean).length, 4, "two swapped pairs, four right");
    // A partly missed item scores only its listed terms.
    assert.deepEqual([...markEntry(item("match-rates"), rates, { kind: "pairs", chosen }).keys()].sort(), ["rack-rate", "rate-plan"]);
}
// Ordering: all or nothing.
{
    const steps = (item("profit-ladder").variants[0] as { steps: string[] }).steps;
    assert.ok(ok(markEntry(item("profit-ladder"), whole("profit-ladder"), { kind: "order", steps })));
    assert.ok(!ok(markEntry(item("profit-ladder"), whole("profit-ladder"), { kind: "order", steps: [steps[1], steps[0], ...steps.slice(2)] })));
}

/* ── Saving as you go ───────────────────────────────────────────── */

{
    const wp = whole("wp-month");
    const none = new Map<string, boolean>();
    // One blank filled: only that blank is saved, so the other three still read as unanswered.
    const first = rowsToSave(item("wp-month"), wp, { kind: "numbers", values: { adr: "310" } }, none);
    assert.deepEqual(
        first.map((r) => [r.term_slug, r.correct]),
        [["adr-average-daily-rate", true]],
    );
    const saved = latestByTerm(first);
    // Retyping the same right answer writes nothing; making it wrong writes one "wrong" row.
    assert.deepEqual(rowsToSave(item("wp-month"), wp, { kind: "numbers", values: { adr: "310.00" } }, saved), []);
    assert.deepEqual(
        rowsToSave(item("wp-month"), wp, { kind: "numbers", values: { adr: "31" } }, saved).map((r) => r.correct),
        [false],
    );
    // Clearing a saved answer is a missed term.
    assert.deepEqual(
        rowsToSave(item("wp-month"), wp, { kind: "numbers", values: {} }, saved).map((r) => [r.term_slug, r.correct]),
        [["adr-average-daily-rate", false]],
    );
    // Rows carry the screen's question and version, never the answer.
    assert.deepEqual(Object.keys(first[0]).sort(), ["correct", "item_id", "term_slug", "variant_id"]);
}

/* ── Finishing a sitting ────────────────────────────────────────── */

{
    const plan: PlanEntry[] = [whole("pace"), whole("tools-buckets")];
    const saved = new Map([
        ["pace", true],
        ["crm-tools", false],
    ]);
    const { results, missing } = finishSitting(plan, saved);
    assert.equal(results.size, 5, "every term the sitting served");
    assert.equal(results.get("pace"), true);
    assert.equal(results.get("crm-tools"), false);
    assert.deepEqual(
        missing.map((m) => m.term_slug),
        ["guest-messaging-tools", "rate-shopping-and-market-intelligence-tools", "upsell-tools"],
        "unanswered terms get a 'wrong' row",
    );
    assert.ok(missing.every((m) => !m.correct && m.item_id === "tools-buckets" && m.variant_id === "tools-buckets-v1"));
}

/* ── Explanations on the results page ───────────────────────────── */

const ex = (slug: string, item_id: string, variant_id: string) =>
    explanationFor(bank, { term_slug: slug, correct: false, item_id, variant_id, answered_at: "" });
assert.match(ex("adr-average-daily-rate", "wp-month", "wp-month-v2") ?? "", /\$390,000 ÷ 1,560/, "a blank's own explanation, from the variant seen");
assert.match(ex("pace", "pace", "pace-v1") ?? "", /Pace compares/);
assert.equal(ex("rack-rate", "match-rates", "match-rates-v1"), null, "matching items have no explanation");

console.log("check-model: PASS");
