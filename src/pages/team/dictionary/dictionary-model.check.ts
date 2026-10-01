/**
 * Self-check for the Industry Acumen Dictionary: the master's shape, and the searches
 * the brief promised account managers.
 *
 * Run it after dropping in a new master, or after touching dictionary-model.ts. The data
 * checks should always pass; if a search check fails after a new master, read the
 * failure before "fixing" the ranking — the master may simply have renamed a term.
 *
 * Same no-framework pattern as its siblings: a plain assert script, no test runner, no new
 * dependency. Run it:
 *   npx esbuild src/pages/team/dictionary/dictionary-model.check.ts --bundle \
 *     --platform=node --format=cjs --alias:@=./src --outfile=/tmp/hgm-check/dictionary.cjs \
 *   && node /tmp/hgm-check/dictionary.cjs
 */
import assert from "node:assert";
import master from "@/data/ref_dictionary-v2-253.json";
import {
    type DictionaryEntry,
    buildIndex,
    compact,
    editDistance,
    groupBySection,
    linkKind,
    search,
    suggest,
    tierBadge,
} from "@/pages/team/dictionary/dictionary-model";

const entries: DictionaryEntry[] = master;
const index = buildIndex(entries);
const bySlug = new Map(entries.map((e) => [e.slug, e]));
const top = (q: string) => search(index, q)[0]?.entry.slug;
const slugs = (q: string) => search(index, q).map((h) => h.entry.slug);

/* ── The master ─────────────────────────────────────────────────── */

assert.equal(bySlug.size, entries.length, "slugs are unique");
for (const e of entries) {
    assert.match(e.slug, /^[a-z0-9]+(-[a-z0-9]+)*$/, `slug is URL-safe: ${e.slug}`);
    assert.ok(e.term.trim() && e.gloss.trim(), `term and gloss are filled: ${e.slug}`);
    assert.ok(["A", "B", "C"].includes(e.tier), `tier is A, B or C: ${e.slug}`);
    assert.ok(Number.isInteger(e.section) && e.section > 0, `section is a whole number: ${e.slug}`);
    for (const r of e.related ?? []) assert.ok(bySlug.has(r), `${e.slug} relates to an entry that exists: ${r}`);
    if (e.core) assert.equal(e.tier, "A", `only Core terms carry core: ${e.slug}`);
    for (const l of e.core?.links ?? []) assert.notEqual(linkKind(l.url).kind, "text", `a link is a web page or repo: doctrine: ${l.url}`);
}

/* The browse view's nine groups account for every entry, once. */
const groups = groupBySection(entries);
assert.equal(
    groups.reduce((n, g) => n + g.entries.length, 0),
    entries.length,
);
assert.equal(groups.length, 9, "nine sections");

/* The tier letter never reaches the page; only these two labels do. */
assert.equal(tierBadge("A"), "Core term");
assert.equal(tierBadge("B"), "On the check");
assert.equal(tierBadge("C"), null);

/* ── Normalising and edit distance ──────────────────────────────── */

assert.equal(compact("Rev PAR"), "revpar");
assert.equal(compact("rev-par"), "revpar");
assert.equal(compact("HGM’s own stack"), compact("HGM's own stack"));
assert.equal(editDistance("revpr", "revpar"), 1);
assert.equal(editDistance("kitten", "sitting"), 3);
assert.equal(editDistance("abcdef", "uvwxyz", 1), 2, "gives up past the cap");

/* ── The brief's searches ───────────────────────────────────────── */

// Punctuation and spacing never change the answer.
for (const q of ["revpar", "Rev PAR", "rev-par", "REVPAR"]) assert.equal(top(q), "revpar-revenue-per-available-room", q);

// A broad word lists several, with Rate parity near the top.
assert.ok(slugs("rate").length > 5);
assert.ok(slugs("rate").indexOf("rate-parity") < 3, "Rate parity near the top of 'rate'");

// One typo still finds the term; the acronym's expansion finds the acronym; an alias counts.
assert.equal(top("revpr"), "revpar-revenue-per-available-room");
assert.equal(top("average daily rate"), "adr-average-daily-rate");
assert.equal(top("direct-booking widget"), "direct-booking-widget");
assert.equal(bySlug.get("direct-booking-widget")?.term, "Price comparison widget");
assert.equal(top("cap rate"), "cap-rate");
assert.equal(top("cancelation policy"), "cancellation-policy");
assert.equal(top("amenty fee"), "resort-fee-amenity-fee");

// A match must start at a word or stay inside one: "adt" is not in "le|ad t|ime".
assert.ok(!slugs("adt").includes("lead-time"));
// Three letters get no typo tolerance, and filler words are never typo targets.
assert.ok(!slugs("adt").includes("adr-average-daily-rate"));
assert.ok(!slugs("land").includes("event-and-wedding-revenue"));

// Ties go A before B before C.
const tiers = search(index, "booking")
    .filter((h) => h.rule === 2)
    .map((h) => h.entry.tier);
assert.deepEqual(tiers, [...tiers].sort());

// Nothing matches: three suggestions, closest first.
assert.deepEqual(slugs("zzzqx"), []);
assert.equal(suggest(index, "zzzqx").length, 3);
assert.equal(suggest(index, "adt")[0]?.slug, "adr-average-daily-rate");
assert.deepEqual(search(index, " — "), [], "punctuation alone is an empty search");

console.log(`dictionary: ${entries.length} entries in ${groups.length} sections, all checks pass`);
