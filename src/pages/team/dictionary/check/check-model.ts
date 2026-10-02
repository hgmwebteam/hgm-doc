import type { DictionaryEntry } from "@/pages/team/dictionary/dictionary-model";

/**
 * The check's model: the bank's stored shape, how a question turns into scored terms,
 * masking, building a sitting, and marking an answer. No React and no Supabase, so
 * check-model.check.ts can pin all of it, and check-bank.check.ts runs `bankProblems`
 * against the real bank and dictionary.
 *
 * THE RULE everything hangs off: every scored unit is exactly one dictionary slug. A word
 * problem's blanks, a sorting question's chips and a matching question's pairs each score
 * their own slug; every other question scores the one in `term`. A term's tier, and so its
 * weight, comes from the dictionary, never from the bank. Because a wrong answer, a review
 * card and a flashcard all point at the same slug, they always show the same entry.
 *
 * The bank is src/data/check-bank.json, a byte-for-byte copy of
 * reference/industry-acumen-check/data/check-bank.json, which that folder's
 * tools/build_check_bank.py generates. Never edit either JSON by hand: change the builder,
 * re-run it, and copy the result over (check-bank.check.ts fails if the two differ).
 */

/* ── The bank's stored shape ────────────────────────────────────── */

/** A table's rows. When the first row starts with an empty cell, it is a header row. */
export type BankTable = string[][];

export type WordProblemBlank = { id: string; term: string; label: string; answer: number; unit: string; tolerance: number; explanation: string };
export type WordProblemVariant = { id: string; prompt: string; table: BankTable; blanks: WordProblemBlank[] };
export type NumericVariant = { id: string; prompt: string; table: BankTable; answer: number; unit: string; tolerance: number; explanation: string };
/**
 * `answer` is the option's text, not its index, so shuffling the options can't break it.
 * A `format: "define"` variant is a reverse question (Kyle, 2 Oct 2026): it shows the item's term
 * and its options are dictionary SLUGS, each shown as that entry's definition; the answer is the
 * term's own slug. The definitions are never retyped in the bank.
 */
export type ChoiceVariant = { id: string; prompt: string; options: string[]; answer: string; explanation: string; format?: "define" };
export type BucketChip = { text: string; term: string; box: string };
export type BucketsVariant = { id: string; prompt: string; boxes: string[]; chips: BucketChip[]; explanation: string };
/** The lines come from the dictionary: each term's `gloss`, or its `usage` with the term blanked. */
export type MatchingVariant = { id: string; prompt: string; match_on: "gloss" | "usage" };
/** `steps` are stored in the correct order; the page shuffles them. */
export type OrderingVariant = { id: string; prompt: string; steps: string[]; explanation: string };
export type TrueFalseVariant = { id: string; statement: string; answer: boolean; explanation: string };

export type WordProblemItem = { id: string; type: "wordproblem"; variants: WordProblemVariant[] };
export type NumericItem = { id: string; type: "numeric"; term: string; variants: NumericVariant[] };
export type ChoiceItem = { id: string; type: "mcq" | "scenario"; term: string; variants: ChoiceVariant[] };
export type BucketsItem = { id: string; type: "buckets"; variants: BucketsVariant[] };
export type MatchingItem = { id: string; type: "matching"; terms: string[]; mask_extra?: Record<string, string[]>; variants: MatchingVariant[] };
export type OrderingItem = { id: string; type: "ordering"; term: string; variants: OrderingVariant[] };
export type TrueFalseItem = { id: string; type: "truefalse"; term: string; variants: TrueFalseVariant[] };

export type BankItem = WordProblemItem | NumericItem | ChoiceItem | BucketsItem | MatchingItem | OrderingItem | TrueFalseItem;
export type BankVariant = BankItem["variants"][number];

export type CheckBank = {
    version: string;
    status?: string;
    /** Points per tier, e.g. { A: 2, B: 1 }. The check reads weights from here and tiers from the dictionary. */
    weights: Record<string, number>;
    masking_rule: string;
    illustrative_note?: string;
    items: BankItem[];
};

/* ── Scored units ───────────────────────────────────────────────── */

/** The slugs an item scores, one per unit. Every variant scores the same ones (bankProblems checks). */
export const itemTerms = (item: BankItem): string[] => {
    switch (item.type) {
        case "wordproblem":
            return item.variants[0].blanks.map((b) => b.term);
        case "buckets":
            return item.variants[0].chips.map((c) => c.term);
        case "matching":
            return item.terms;
        default:
            return [item.term];
    }
};

export const findVariant = (item: BankItem, variantId: string): BankVariant | undefined => (item.variants as BankVariant[]).find((v) => v.id === variantId);

/* ── Validation ─────────────────────────────────────────────────── */

const TABLE_TYPES = new Set(["wordproblem", "numeric"]);

/**
 * Everything wrong with a bank, measured against the dictionary, as plain sentences. Empty
 * means it's fit to serve. check-bank.check.ts fails on any of these, and the check, results
 * and flashcard pages refuse to run a bank that has any, so a bad copy can never put a
 * half-scorable check in front of someone.
 *
 * The rules: every scored slug is in the dictionary at tier A or B; every A and B term is
 * scored exactly once (so 30 A and 60 B, 120 points at the current weights); no tier A term
 * sits in matching or true/false; every item has at least two variants, and every variant
 * scores the same slugs; a multiple-choice answer is one of its four options; a chip's box is
 * one of its boxes; numbers are numbers; ids are unique.
 */
export const bankProblems = (bank: CheckBank, bySlug: Map<string, DictionaryEntry>): string[] => {
    const problems: string[] = [];
    const say = (m: string) => problems.push(m);
    const seen = new Map<string, string>();
    const itemIds = new Set<string>();
    const variantIds = new Set<string>();
    const isNum = (n: unknown) => typeof n === "number" && Number.isFinite(n);

    if (!bank || !Array.isArray(bank.items)) return ["The bank has no items."];
    for (const tier of ["A", "B"]) if (!isNum(bank.weights?.[tier])) say(`The bank has no weight for tier ${tier}.`);

    for (const item of bank.items) {
        if (itemIds.has(item.id)) say(`Item id ${item.id} appears twice.`);
        itemIds.add(item.id);
        const variants = (item.variants ?? []) as BankVariant[];
        if (variants.length < 2) {
            say(`${item.id}: has ${variants.length} variant(s); every item needs at least two.`);
            if (!variants.length) continue;
        }
        for (const v of variants) {
            if (variantIds.has(v.id)) say(`Variant id ${v.id} appears twice.`);
            variantIds.add(v.id);
        }

        const terms = itemTerms(item);
        for (const slug of terms) {
            const entry = bySlug.get(slug);
            if (!entry) {
                say(`${item.id}: "${slug}" is not in the dictionary.`);
                continue;
            }
            if (entry.tier !== "A" && entry.tier !== "B") say(`${item.id}: "${slug}" is tier ${entry.tier}; only tier A and B terms are scored.`);
            if (seen.has(slug)) say(`"${slug}" is scored twice: in ${seen.get(slug)} and in ${item.id}.`);
            seen.set(slug, item.id);
            if (entry.tier === "A" && (item.type === "matching" || item.type === "truefalse"))
                say(`${item.id}: tier A "${slug}" can't sit in a ${item.type} item.`);
        }

        const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
        switch (item.type) {
            case "wordproblem":
                for (const v of item.variants) {
                    if (
                        !same(
                            v.blanks.map((b) => b.term),
                            terms,
                        )
                    )
                        say(`${v.id}: its blanks score different terms from ${item.variants[0].id}.`);
                    for (const b of v.blanks) if (!isNum(b.answer) || !isNum(b.tolerance)) say(`${v.id}/${b.id}: answer and tolerance must be numbers.`);
                }
                break;
            case "numeric":
                for (const v of item.variants) if (!isNum(v.answer) || !isNum(v.tolerance)) say(`${v.id}: answer and tolerance must be numbers.`);
                break;
            case "mcq":
            case "scenario":
                for (const v of item.variants) {
                    if (!v.options.includes(v.answer)) say(`${v.id}: the answer "${v.answer}" is not one of its options.`);
                    if (v.options.length !== 4) say(`${v.id}: has ${v.options.length} options; it needs 4.`);
                    if (new Set(v.options).size !== v.options.length) say(`${v.id}: an option appears twice.`);
                    if (v.format === "define") {
                        if (v.answer !== item.term) say(`${v.id}: a reverse question's answer must be its own term, "${item.term}".`);
                        const asked = bySlug.get(item.term);
                        for (const slug of v.options) {
                            const e = bySlug.get(slug);
                            if (!e?.gloss?.trim()) say(`${v.id}: option "${slug}" isn't a dictionary entry with a definition.`);
                            // A definition that names the asked term would give the answer away, or mislead.
                            else if (asked && maskText(e.gloss, maskWords(asked)) !== e.gloss)
                                say(`${v.id}: the definition of "${slug}" names "${asked.term}".`);
                        }
                    }
                }
                break;
            case "buckets":
                for (const v of item.variants) {
                    if (!same(v.chips.map((c) => c.term).sort(), [...terms].sort()))
                        say(`${v.id}: its chips score different terms from ${item.variants[0].id}.`);
                    for (const c of v.chips)
                        if (!v.boxes.includes(c.box)) say(`${v.id}: the chip "${c.text}" goes in "${c.box}", which isn't one of its boxes.`);
                }
                break;
            case "matching":
                if (item.terms.length > 6 || item.terms.length < 4) say(`${item.id}: matches ${item.terms.length} terms; it needs 4 to 6.`);
                for (const v of item.variants) {
                    if (v.match_on !== "gloss" && v.match_on !== "usage") say(`${v.id}: match_on must be "gloss" or "usage".`);
                    for (const slug of item.terms) {
                        const e = bySlug.get(slug);
                        if (e && !e[v.match_on]?.trim()) say(`${v.id}: "${slug}" has no ${v.match_on} in the dictionary to match on.`);
                    }
                }
                break;
            case "ordering":
                for (const v of item.variants) {
                    if (v.steps.length < 2) say(`${v.id}: needs at least two steps.`);
                    if (new Set(v.steps).size !== v.steps.length) say(`${v.id}: a step appears twice, so the order can't be marked.`);
                }
                break;
            case "truefalse":
                for (const v of item.variants) if (typeof v.answer !== "boolean") say(`${v.id}: the answer must be true or false.`);
                break;
            default:
                say(`${(item as { id: string }).id}: unknown type "${(item as { type: string }).type}".`);
        }
        if (TABLE_TYPES.has(item.type))
            for (const v of variants as { id: string; table?: unknown }[]) if (!Array.isArray(v.table)) say(`${v.id}: needs a table.`);
    }

    for (const entry of bySlug.values()) {
        if ((entry.tier === "A" || entry.tier === "B") && !seen.has(entry.slug))
            say(`Tier ${entry.tier} "${entry.slug}" is in the dictionary but not in the bank.`);
    }
    return problems;
};

/* ── Masking ────────────────────────────────────────────────────── */

export const MASK = "___";

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** "EBITDA (earnings before …)" → the text inside the brackets, split where it names two things. */
const bracketParts = (term: string) => {
    const m = term.match(/\(([^()]*)\)/);
    return m ? m[1].split(/\s+[—–]\s+/).map((s) => s.trim()) : [];
};

/**
 * The words to blank for one term, longest first, by the bank's `masking_rule`: the term,
 * the term without its bracketed expansion, each part of a term split on " / ", its
 * aliases, and any extra words the item names for that slug.
 */
export const maskWords = (entry: DictionaryEntry, extra: string[] = []): string[] => {
    const noBracket = entry.term.replace(/\s*\([^()]*\)\s*/g, " ").trim();
    const words = [
        entry.term,
        noBracket,
        ...entry.term.split(" / "),
        ...noBracket.split(" / "),
        ...(entry.aliases ?? []).filter((a): a is string => typeof a === "string"),
        ...extra,
    ]
        .map((w) => w.trim())
        .filter(Boolean);
    return [...new Set(words)].sort((a, b) => b.length - a.length);
};

/**
 * Blanks every word in `words` out of `text`, ignoring case, with an optional plural "s".
 * A word only matches whole: "rate" never blanks the middle of "pirate". (Written without
 * lookbehind, which older Safari can't parse.)
 */
export const maskText = (text: string, words: string[]): string =>
    words.reduce(
        (t, w) => t.replace(new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(w)}s?(?![\\p{L}\\p{N}])`, "giu"), (_m, before: string) => `${before}${MASK}`),
        text,
    );

/** Every mask_extra the bank gives a slug, from whichever matching item holds it. */
export const bankMaskExtra = (bank: CheckBank, slug: string): string[] =>
    bank.items.flatMap((i) => (i.type === "matching" ? (i.mask_extra?.[slug] ?? []) : []));

/**
 * The line a matching question shows for one term: its definition (version 1) or its call line
 * (version 2), with the term blanked by the bank's masking rule in both. Version 1 is masked
 * too since 2 Oct 2026, because "owners say keys, the doctrine says units" answered itself.
 */
export const matchingLine = (entry: DictionaryEntry, matchOn: "gloss" | "usage", maskExtra: string[] = []): string =>
    maskText((matchOn === "usage" ? entry.usage : entry.gloss) ?? "", maskWords(entry, maskExtra));

/**
 * Definition-first flashcards blank a little more than the bank's rule, because four
 * definitions gave their own answer away under it (found by the bank validator, 1 Oct 2026;
 * Kyle chose to fix it here): EBITDA's definition IS its bracketed expansion, so flashcards also
 * blank the bracket text. Flag's "flagged" and Keys' "keys … units" moved into the bank's
 * mask_extra on 2 Oct (they're matching terms, so bankMaskExtra brings them in). Genius is a
 * true/false term with no matching item to carry a mask_extra, so it stays here.
 */
export const FLASHCARD_MASK_EXTRA: Record<string, string[]> = {
    "booking-com-genius": ["Genius"],
};

export const flashcardMaskWords = (entry: DictionaryEntry, bank: CheckBank): string[] =>
    maskWords(entry, [...bracketParts(entry.term), ...bankMaskExtra(bank, entry.slug), ...(FLASHCARD_MASK_EXTRA[entry.slug] ?? [])]);

/* ── Randomness ─────────────────────────────────────────────────── */

export type Random = () => number;

/**
 * A repeatable random sequence from a string. The page seeds it with the attempt id plus the
 * question, so a resumed sitting shows options in the same order it did before.
 * (xmur3 hash feeding mulberry32: small, fast, and plenty for shuffling.)
 */
export const seededRandom = (seed: string): Random => {
    let h = 1779033703 ^ seed.length;
    for (let i = 0; i < seed.length; i++) {
        h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
    }
    let a = h >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

/** A shuffled copy (Fisher–Yates). */
export const shuffle = <T>(xs: readonly T[], random: Random): T[] => {
    const out = [...xs];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
};

/** Ordering items start shuffled, and never already in the right order (that would be a free point). */
export const shuffledSteps = (steps: readonly string[], random: Random): string[] => {
    if (steps.length < 2) return [...steps];
    for (let tries = 0; tries < 20; tries++) {
        const s = shuffle(steps, random);
        if (s.some((x, i) => x !== steps[i])) return s;
    }
    return [...steps.slice(1), steps[0]];
};

/* ── A sitting ──────────────────────────────────────────────────── */

export type CheckMode = "full" | "missed";

/**
 * One screen of a sitting: an item, the variant shown, and the terms this screen scores.
 * `blank` is set when a word problem's missed blank is served alone, as a number question
 * on the other variant's table. Stored in check_attempts.plan, so a resumed sitting shows
 * the same questions, versions and order on any device.
 */
export type PlanEntry = { item: string; variant: string; blank?: string; terms: string[] };

/** A person's latest answer to one term in a finished sitting: one row of check_term_status. */
export type TermStatus = { term_slug: string; correct: boolean; item_id: string; variant_id: string; answered_at: string };

/** The key a screen's answer is stored under while the sitting is open. */
export const entryKey = (e: Pick<PlanEntry, "item" | "blank">) => (e.blank ? `${e.item}/${e.blank}` : e.item);

/** A retake prefers the variant the person didn't see most recently: the next one after it. */
export const nextVariant = <V extends { id: string }>(variants: readonly V[], lastSeen?: string): V => {
    const i = variants.findIndex((v) => v.id === lastSeen);
    return i === -1 ? variants[0] : variants[(i + 1) % variants.length];
};

/** The variant this person saw most recently for an item: the newest answer among its terms. */
const lastSeenVariant = (item: BankItem, status: Map<string, TermStatus>) => {
    let latest: TermStatus | undefined;
    for (const slug of itemTerms(item)) {
        const s = status.get(slug);
        if (s && s.item_id === item.id && (!latest || s.answered_at > latest.answered_at)) latest = s;
    }
    return latest?.variant_id;
};

/** How many screens go before the first word problem; neither word problem is ever last. */
export const WORD_PROBLEMS_AFTER = 3;

/**
 * Orders a full sitting: everything shuffled, no sections, then each word problem dropped in
 * somewhere after the first few screens and before the last one.
 */
const orderFull = (entries: PlanEntry[], isWordProblem: (e: PlanEntry) => boolean, random: Random) => {
    const out = shuffle(
        entries.filter((e) => !isWordProblem(e)),
        random,
    );
    for (const wp of shuffle(entries.filter(isWordProblem), random)) {
        const lo = Math.min(WORD_PROBLEMS_AFTER, out.length);
        const hi = Math.max(lo, out.length - 1);
        out.splice(lo + Math.floor(random() * (hi - lo + 1)), 0, wp);
    }
    return out;
};

/**
 * The screens of a new sitting.
 *
 * full:   every item, whole. The first sitting shows each item's first variant (the one in
 *         the review copy); later sittings show the variant not seen most recently.
 * missed: only items with a term the person currently has wrong (or has never answered).
 *         A missed word-problem blank is served alone, on the other variant's table. Any
 *         other item comes back whole, on its other variant, but scores only the terms that
 *         were missed: removing pairs from a matching item would make the rest trivial, and
 *         this way a missed-only retake can only raise the score (decision 2a, 1 Oct 2026).
 */
export const buildPlan = (bank: CheckBank, mode: CheckMode, status: Map<string, TermStatus>, random: Random): PlanEntry[] => {
    if (mode === "full") {
        const entries = bank.items.map((item) => ({
            item: item.id,
            variant: nextVariant(item.variants as BankVariant[], lastSeenVariant(item, status)).id,
            terms: itemTerms(item),
        }));
        const types = new Map(bank.items.map((i) => [i.id, i.type]));
        return orderFull(entries, (e) => types.get(e.item) === "wordproblem", random);
    }

    const entries: PlanEntry[] = [];
    for (const item of bank.items) {
        const missed = itemTerms(item).filter((slug) => status.get(slug)?.correct !== true);
        if (!missed.length) continue;
        if (item.type === "wordproblem") {
            for (const slug of missed) {
                const v = nextVariant(item.variants, status.get(slug)?.item_id === item.id ? status.get(slug)?.variant_id : undefined);
                const blank = v.blanks.find((b) => b.term === slug);
                if (blank) entries.push({ item: item.id, variant: v.id, blank: blank.id, terms: [slug] });
            }
        } else {
            entries.push({ item: item.id, variant: nextVariant(item.variants as BankVariant[], lastSeenVariant(item, status)).id, terms: missed });
        }
    }
    return shuffle(entries, random);
};

/* ── Answers ────────────────────────────────────────────────────── */

/** What someone has entered on one screen. Kept in their own browser while the sitting is open; never stored in Supabase. */
export type CheckResponse =
    | { kind: "number"; value: string }
    | { kind: "numbers"; values: Record<string, string> }
    | { kind: "choice"; value: string }
    | { kind: "bool"; value: boolean }
    | { kind: "boxes"; placed: Record<string, string> }
    | { kind: "pairs"; chosen: Record<string, string> }
    | { kind: "order"; steps: string[] };

/**
 * A typed number, accepting what people actually type: "1,350", "$232.50", "75%", " 2.5x ".
 * Anything else, an empty box included, is null, which marks as unanswered.
 */
export const parseNumber = (raw: string | undefined): number | null => {
    if (raw == null) return null;
    const s = raw
        .trim()
        .replace(/[\s,$%]/g, "")
        .replace(/[x×]$/i, "")
        .replace(/^[−–]/, "-");
    if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
    return Number(s);
};

/** Within ± tolerance of the answer. The epsilon absorbs float noise, e.g. 232.5 ± 0.5. */
export const isWithin = (value: number, answer: number, tolerance: number) => Math.abs(value - answer) <= tolerance + 1e-9;

const numberCorrect = (raw: string | undefined, answer: number, tolerance: number) => {
    const n = parseNumber(raw);
    return n !== null && isWithin(n, answer, tolerance);
};

/** A word problem's blank, served alone: its numbers and the variant's table. */
export type StandaloneBlank = { variant: WordProblemVariant; blank: WordProblemBlank };

export const standaloneBlank = (item: BankItem, entry: PlanEntry): StandaloneBlank | null => {
    if (item.type !== "wordproblem" || !entry.blank) return null;
    const variant = item.variants.find((v) => v.id === entry.variant);
    const blank = variant?.blanks.find((b) => b.id === entry.blank);
    return variant && blank ? { variant, blank } : null;
};

/** "Ancillary revenue" → "ancillary revenue"; "ADR", "RevPAR" and "CPB (…)" keep their capitals. */
const inSentence = (label: string) => (/^[A-Z][a-z]+(\s|$)/.test(label) ? label[0].toLowerCase() + label.slice(1) : label);

/**
 * The question for a blank served alone. The bank has no prompt per blank, so this keeps the
 * variant's opening ("An owner sends you their November numbers.") and asks for the one figure.
 */
export const standalonePrompt = ({ variant, blank }: StandaloneBlank) => {
    const lead = variant.prompt.match(/^(.*?)\s*Work out\b/)?.[1]?.trim();
    return `${lead ? `${lead} ` : ""}Work out the ${inSentence(blank.label)}. Not every row is needed.`;
};

/**
 * Right or wrong for every term a screen scores. Anything unanswered is wrong: the check
 * counts a skipped term as one to review, never as a gap.
 */
export const markEntry = (item: BankItem, entry: PlanEntry, response: CheckResponse | undefined): Map<string, boolean> => {
    const marks = new Map<string, boolean>(entry.terms.map((t) => [t, false]));
    const variant = findVariant(item, entry.variant);
    if (!variant || !response) return marks;
    const set = (slug: string, ok: boolean) => marks.has(slug) && marks.set(slug, ok);

    switch (item.type) {
        case "wordproblem": {
            const alone = standaloneBlank(item, entry);
            if (alone) {
                if (response.kind === "number") set(alone.blank.term, numberCorrect(response.value, alone.blank.answer, alone.blank.tolerance));
            } else if (response.kind === "numbers") {
                for (const b of (variant as WordProblemVariant).blanks) set(b.term, numberCorrect(response.values[b.id], b.answer, b.tolerance));
            }
            break;
        }
        case "numeric": {
            const v = variant as NumericVariant;
            if (response.kind === "number") set(item.term, numberCorrect(response.value, v.answer, v.tolerance));
            break;
        }
        case "mcq":
        case "scenario":
            if (response.kind === "choice") set(item.term, response.value === (variant as ChoiceVariant).answer);
            break;
        case "truefalse":
            if (response.kind === "bool") set(item.term, response.value === (variant as TrueFalseVariant).answer);
            break;
        case "buckets":
            if (response.kind === "boxes") for (const c of (variant as BucketsVariant).chips) set(c.term, response.placed[c.term] === c.box);
            break;
        case "matching":
            // Each line belongs to one term (its slug); the pair is right when that term is picked for it.
            if (response.kind === "pairs") for (const slug of item.terms) set(slug, response.chosen[slug] === slug);
            break;
        case "ordering": {
            const steps = (variant as OrderingVariant).steps;
            if (response.kind === "order") set(item.term, response.steps.length === steps.length && response.steps.every((s, i) => s === steps[i]));
            break;
        }
    }
    return marks;
};

/**
 * Whether every part of a screen has an answer. Drives the "Answered" mark and the count of
 * unanswered screens before finishing. An ordering item counts once a step has been moved
 * (its starting order is never the right one, so leaving it untouched can't be an answer).
 */
export const isAnswered = (item: BankItem, entry: PlanEntry, response: CheckResponse | undefined): boolean => {
    if (!response) return false;
    const variant = findVariant(item, entry.variant);
    if (!variant) return false;
    switch (response.kind) {
        case "number":
            return parseNumber(response.value) !== null;
        case "numbers":
            return (variant as WordProblemVariant).blanks.every((b) => parseNumber(response.values[b.id]) !== null);
        case "choice":
            return !!response.value;
        case "bool":
            return true;
        case "boxes":
            return (variant as BucketsVariant).chips.every((c) => !!response.placed[c.term]);
        case "pairs":
            return item.type === "matching" && item.terms.every((slug) => !!response.chosen[slug]);
        case "order":
            return response.steps.length > 0;
    }
};

/** The terms of a screen whose part has an answer: a filled blank, a placed chip, a chosen line. */
export const answeredTerms = (item: BankItem, entry: PlanEntry, response: CheckResponse | undefined): Set<string> => {
    const out = new Set<string>();
    if (!response) return out;
    const variant = findVariant(item, entry.variant);
    switch (response.kind) {
        case "number":
            if (parseNumber(response.value) !== null) entry.terms.forEach((t) => out.add(t));
            break;
        case "numbers":
            for (const b of (variant as WordProblemVariant | undefined)?.blanks ?? []) if (parseNumber(response.values[b.id]) !== null) out.add(b.term);
            break;
        case "boxes":
            for (const t of entry.terms) if (response.placed[t]) out.add(t);
            break;
        case "pairs":
            for (const t of entry.terms) if (response.chosen[t]) out.add(t);
            break;
        default:
            entry.terms.forEach((t) => out.add(t));
    }
    return out;
};

/** One answer row as the browser sends it: which question and version, which term, right or wrong. */
export type AnswerRow = { item_id: string; variant_id: string; term_slug: string; correct: boolean };

/**
 * The rows to add after a screen's answer changes, given what this sitting has already saved
 * per term. A term gets a row the first time its part is answered, and again only when it
 * flips between right and wrong, so retyping "310" as "310.00" writes nothing. Clearing an
 * answer after it was saved writes "wrong", because an empty answer is a missed term.
 */
export const rowsToSave = (item: BankItem, entry: PlanEntry, response: CheckResponse | undefined, saved: ReadonlyMap<string, boolean>): AnswerRow[] => {
    const marks = markEntry(item, entry, response);
    const answered = answeredTerms(item, entry, response);
    return entry.terms
        .filter((t) => (saved.has(t) ? saved.get(t) !== marks.get(t) : answered.has(t)))
        .map((t) => ({ item_id: entry.item, variant_id: entry.variant, term_slug: t, correct: marks.get(t) === true }));
};

/** The latest saved answer per term, from rows oldest first. */
export const latestByTerm = (rows: readonly { term_slug: string; correct: boolean }[]): Map<string, boolean> =>
    new Map(rows.map((r) => [r.term_slug, r.correct]));

/**
 * What a sitting adds up to when it's finished: every term it served, right or wrong, plus
 * the "wrong" rows to add for terms that were never answered (unanswered counts as missed).
 */
export const finishSitting = (plan: readonly PlanEntry[], saved: ReadonlyMap<string, boolean>): { results: Map<string, boolean>; missing: AnswerRow[] } => {
    const results = new Map<string, boolean>();
    const missing: AnswerRow[] = [];
    for (const entry of plan) {
        for (const t of entry.terms) {
            if (saved.has(t)) results.set(t, saved.get(t) === true);
            else {
                results.set(t, false);
                missing.push({ item_id: entry.item, variant_id: entry.variant, term_slug: t, correct: false });
            }
        }
    }
    return { results, missing };
};

/** The explanation shown on the results card for a term, from the variant the person last saw. Matching items have none. */
export const explanationFor = (bank: CheckBank, status: TermStatus): string | null => {
    const item = bank.items.find((i) => i.id === status.item_id);
    if (!item) return null;
    const variant = findVariant(item, status.variant_id);
    if (!variant) return null;
    if (item.type === "wordproblem") return (variant as WordProblemVariant).blanks.find((b) => b.term === status.term_slug)?.explanation ?? null;
    return "explanation" in variant ? variant.explanation : null;
};
