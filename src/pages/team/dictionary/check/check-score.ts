import type { CheckBank } from "@/pages/team/dictionary/check/check-model";
import { itemTerms } from "@/pages/team/dictionary/check/check-model";
import type { DictionaryEntry } from "@/pages/team/dictionary/dictionary-model";

/**
 * Scoring the check. Plain functions, pinned by check-score.check.ts.
 *
 * A person has a current status per term: right or not, from their most recent answer to it
 * in a finished sitting. A full check updates every term; a missed-terms retake updates only
 * the terms it served. The score is the weighted share of terms currently right:
 *
 *     score = sum of weights of terms currently right ÷ total weight × 100, rounded
 *
 * with weights from the bank (tier A 2, tier B 1) and tiers from the dictionary. A term never
 * answered counts as not right. The same "latest answer wins" rule is check_term_status in
 * supabase/migrations/20261001120000_dictionary_check.sql; keep the two in step.
 *
 * There is no pass mark. The grade is for fun, on the Ontario provincial scale, and nothing
 * here or on the page may read as a problem (Kyle, 1 Oct 2026).
 */

/** Every scored term with its weight, in bank order. */
export const termWeights = (bank: CheckBank, bySlug: Map<string, DictionaryEntry>): Map<string, number> => {
    const weights = new Map<string, number>();
    for (const item of bank.items) {
        for (const slug of itemTerms(item)) {
            const tier = bySlug.get(slug)?.tier;
            const w = tier ? bank.weights[tier] : undefined;
            if (typeof w === "number") weights.set(slug, w);
        }
    }
    return weights;
};

/** Status after a sitting: everything it served is replaced by its result; everything else is unchanged. */
export const applyResults = (before: ReadonlyMap<string, boolean>, results: ReadonlyMap<string, boolean>): Map<string, boolean> =>
    new Map([...before, ...results]);

/** Rounds to a whole percent, half up: 79.5 → 80. The epsilon keeps float noise (79.49999…) from rounding down. */
export const roundPct = (x: number) => Math.round(x + 1e-9);

export const scorePct = (weights: ReadonlyMap<string, number>, status: ReadonlyMap<string, boolean>): number => {
    let total = 0;
    let right = 0;
    for (const [slug, w] of weights) {
        total += w;
        if (status.get(slug) === true) right += w;
    }
    return total ? roundPct((right * 100) / total) : 0;
};

/** The terms not currently right, in bank order. These are the review cards and the "missed" flashcards. */
export const missedTerms = (weights: ReadonlyMap<string, number>, status: ReadonlyMap<string, boolean>): string[] =>
    [...weights.keys()].filter((slug) => status.get(slug) !== true);

/** Ontario provincial scale, as shown by Upper Grand DSB. Lowest percentage for each grade. */
export const GRADE_SCALE: readonly (readonly [number, string])[] = [
    [90, "A+"],
    [85, "A"],
    [80, "A−"],
    [77, "B+"],
    [73, "B"],
    [70, "B−"],
    [67, "C+"],
    [63, "C"],
    [60, "C−"],
    [57, "D+"],
    [53, "D"],
    [50, "D−"],
];

/** The letter grade for a rounded percentage. Below 50 is R, which the page always pairs with encouragement. */
export const grade = (pct: number): string => GRADE_SCALE.find(([min]) => pct >= min)?.[1] ?? "R";

/** Encouragement for an R, never a verdict. */
export const R_LINE = "These words take a few rounds. Practise the ones below and try again.";

const terms = (n: number, word: "fewer" | "more") => `${n} ${word} ${n === 1 ? "term" : "terms"} to review`;

/**
 * The one quiet line comparing this sitting with the one before, e.g.
 * "Up 9% since last time · 7 fewer terms to review". Null without a previous sitting.
 * A lower score is stated plainly, never as a problem: the whole check moves around
 * from one round to the next.
 */
export const progressLine = (previous: { score: number; missed: number } | null, now: { score: number; missed: number }): string | null => {
    if (!previous) return null;
    const d = now.score - previous.score;
    const m = now.missed - previous.missed;
    const score = d > 0 ? `Up ${d}% since last time` : d < 0 ? `Down ${-d}% since last time` : "The same score as last time";
    const review = m < 0 ? terms(-m, "fewer") : m > 0 ? terms(m, "more") : null;
    return review ? `${score} · ${review}` : score;
};
