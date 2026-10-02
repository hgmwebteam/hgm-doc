import type { CheckBank } from "@/pages/team/dictionary/check/check-model";

/**
 * The one way to load the check's question bank. Like loadDictionary(), it is a lazy chunk
 * (~70 KB), fetched only by the check, results and flashcard pages, never part of the bundle
 * every page downloads. Never import the JSON statically.
 *
 * A cast, not an assignment: JSON can't carry the item types' literal "type" fields, so the
 * compiler can't check the shape. bankProblems() does, at runtime, on every page that uses it.
 */

let loading: Promise<CheckBank> | null = null;

export const loadCheckBank = () =>
    (loading ??= import("@/data/check-bank.json")
        .then((mod) => mod.default as unknown as CheckBank)
        .catch((error: unknown) => {
            loading = null; // a stale tab after a deploy can retry after reloading
            throw error;
        }));
