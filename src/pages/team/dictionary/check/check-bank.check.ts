/**
 * The bank validator: the check's question bank against the portal's dictionary.
 *
 * Run it after changing either JSON, from the repo root:
 *   npx esbuild src/pages/team/dictionary/check/check-bank.check.ts --bundle \
 *     --platform=node --format=cjs --alias:@=./src --outfile=/tmp/hgm-check/check-bank.cjs \
 *   && node /tmp/hgm-check/check-bank.cjs
 *
 * It fails if bankProblems() finds anything (a slug not in the dictionary, an A or B term
 * missing or scored twice, a tier A term in matching or true/false, an item with one
 * variant, an answer that isn't an option, a chip whose box doesn't exist…), if the totals
 * aren't 30 A + 60 B = 120 points, or if src/data/check-bank.json has drifted from the copy
 * in reference/industry-acumen-check/. It also prints what the matching questions' blanked
 * call lines will read like, since a line that still names its term is a free point.
 */
import assert from "node:assert";
import { readFileSync } from "node:fs";
import bankJson from "@/data/check-bank.json";
import master from "@/data/ref_dictionary-v2-253.json";
import { type CheckBank, bankMaskExtra, bankProblems, itemTerms, matchingLine } from "@/pages/team/dictionary/check/check-model";
import { termWeights } from "@/pages/team/dictionary/check/check-score";
import type { DictionaryEntry } from "@/pages/team/dictionary/dictionary-model";

const bank = bankJson as unknown as CheckBank;
const entries: DictionaryEntry[] = master;
const bySlug = new Map(entries.map((e) => [e.slug, e]));

const types = bank.items.reduce<Record<string, number>>((m, i) => ({ ...m, [i.type]: (m[i.type] ?? 0) + 1 }), {});
const weights = termWeights(bank, bySlug);
const scored = [...weights.keys()];
const countTier = (t: string) => scored.filter((s) => bySlug.get(s)?.tier === t).length;
const dictTier = (t: string) => entries.filter((e) => e.tier === t).length;
const points = [...weights.values()].reduce((a, b) => a + b, 0);

console.log(
    `Bank ${bank.version} · ${bank.items.length} items · ${Object.entries(types)
        .map(([t, n]) => `${t} ${n}`)
        .join(", ")}`,
);
console.log(`Dictionary: ${entries.length} entries · tier A ${dictTier("A")} · tier B ${dictTier("B")} · tier C ${dictTier("C")}`);
console.log(`Scored: ${countTier("A")} A × ${bank.weights.A} + ${countTier("B")} B × ${bank.weights.B} = ${points} points across ${scored.length} terms`);

/* What matching shows: each group's theme, then every call line (v2) with its term blanked, and
   any definition (v1) the masking changed. A line that still names its term is a free point. */
const lines = bank.items.flatMap((item) =>
    item.type === "matching"
        ? item.terms.map((slug) => {
              const e = bySlug.get(slug)!;
              const extra = bankMaskExtra(bank, slug);
              const masked = matchingLine(e, "usage", extra);
              const gloss = matchingLine(e, "gloss", extra);
              return { item: item.id, slug, masked, blanked: masked !== e.usage, gloss, glossMasked: gloss !== e.gloss };
          })
        : [],
);
console.log("\nMatching groups:");
for (const item of bank.items)
    if (item.type === "matching") console.log(`  ${item.id.padEnd(16)} ${item.variants[0].prompt.split(". ")[0]}: ${item.terms.join(", ")}`);
console.log(`\nMatching call lines blanked: ${lines.filter((l) => l.blanked).length} of ${lines.length}`);
for (const l of lines) console.log(`  ${l.blanked ? "ok" : "--"}  ${l.slug.padEnd(32)} ${l.masked}`);
const glossed = lines.filter((l) => l.glossMasked);
console.log(`Definitions that named their own term, now blanked: ${glossed.length}`);
for (const l of glossed) console.log(`  ok  ${l.slug.padEnd(32)} ${l.gloss}`);

/* The reverse questions: the term, and the four definitions it offers. */
const reverse = bank.items.flatMap((item) =>
    item.type === "mcq" || item.type === "scenario" ? item.variants.filter((v) => v.format === "define").map((v) => ({ item, v })) : [],
);
console.log(`\nReverse questions: ${reverse.length}`);
for (const { item, v } of reverse) {
    const asked = bySlug.get(item.term)!;
    const lengths = v.options.map((o) => bySlug.get(o)?.gloss.length ?? 0);
    console.log(`  ${asked.term} — options: ${v.options.join(", ")} (definition lengths ${lengths.join("/")})`);
}

const problems = bankProblems(bank, bySlug);
console.log(`\n${problems.length} problem(s)`);
for (const p of problems) console.log(`  ✗ ${p}`);

assert.deepEqual(problems, [], "the bank has problems (listed above)");
assert.equal(countTier("A"), 30, "30 tier A terms");
assert.equal(countTier("B"), 60, "60 tier B terms");
assert.equal(points, 120, "120 points");
assert.equal(scored.length, new Set(bank.items.flatMap(itemTerms)).size, "no term scored twice");
for (const l of lines) assert.ok(l.blanked, `the call line for ${l.slug} names its term after masking`);

/* The app's copy must be the reference copy, byte for byte. */
const here = readFileSync("src/data/check-bank.json", "utf8");
const reference = readFileSync("reference/industry-acumen-check/data/check-bank.json", "utf8");
assert.equal(here, reference, "src/data/check-bank.json differs from reference/industry-acumen-check/data/check-bank.json — copy the reference over");

console.log("\ncheck-bank: PASS");
