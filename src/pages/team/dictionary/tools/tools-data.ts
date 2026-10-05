import { useEffect, useState } from "react";
import type { SortData } from "@/pages/team/dictionary/tools/sort-model";

/**
 * The one way to load Sort the stack's card list. Like loadDictionary() and loadCheckBank(), it
 * is a lazy chunk, fetched only by the tools pages and never part of the bundle every page
 * downloads. Never import the JSON statically.
 *
 * A cast, not an assignment: JSON can't carry the rounds' literal "mode" fields, so the
 * compiler can't check the shape. sortProblems() does, at runtime, before anything plays.
 * After this one chunk the tools pages fetch nothing, store nothing and send nothing.
 */

let loading: Promise<SortData> | null = null;

export const loadSortCards = () =>
    (loading ??= import("@/data/industry-acumen-sort-cards.json")
        .then((mod) => mod.default as unknown as SortData)
        .catch((error: unknown) => {
            loading = null; // a stale tab after a deploy can retry after reloading
            throw error;
        }));

export type SortCards = { status: "loading" } | { status: "failed" } | { status: "ready"; data: SortData };

/** The card list for a page: loading, failed (usually a tab older than the last deploy), or ready. */
export const useSortCards = (): SortCards => {
    const [state, setState] = useState<SortCards>({ status: "loading" });
    useEffect(() => {
        let live = true;
        loadSortCards().then(
            (data) => live && setState({ status: "ready", data }),
            () => live && setState({ status: "failed" }),
        );
        return () => {
            live = false;
        };
    }, []);
    return state;
};
