import { useEffect, useState } from "react";
import type { SortData } from "@/pages/team/dictionary/tools/sort-model";
import type { VendorIcons } from "@/pages/team/dictionary/tools/vendor-icons";

/**
 * The one way to load the tools pages' data: Sort the stack's card list and the vendor icons'
 * manifest. Like loadDictionary() and loadCheckBank(), each is a lazy chunk, fetched only by the
 * tools pages and never part of the bundle every page downloads. Never import either JSON statically.
 *
 * A cast, not an assignment: JSON can't carry the rounds' literal "mode" fields, so the compiler
 * can't check the shapes. sortProblems() and trainingProblems() do, at runtime, before anything
 * shows. After these two chunks the tools pages fetch only the icons themselves (static files on
 * this site), store nothing and send nothing.
 */

/** A lazy chunk, fetched once. A failure isn't kept: a stale tab after a deploy can retry after reloading. */
const once = <T>(load: () => Promise<T>) => {
    let loading: Promise<T> | null = null;
    return () =>
        (loading ??= load().catch((error: unknown) => {
            loading = null;
            throw error;
        }));
};

const loadSortCards = once(() => import("@/data/industry-acumen-sort-cards.json").then((mod) => mod.default as unknown as SortData));
const loadVendorIcons = once(() => import("@/data/vendor-icons.json").then((mod) => mod.default as unknown as VendorIcons));

export type ToolsData = { cards: SortData; icons: VendorIcons };

export type ToolsLoad = { status: "loading" } | { status: "failed" } | { status: "ready"; data: ToolsData };

/** Both, for a page: loading, failed (usually a tab older than the last deploy), or ready. */
export const useToolsData = (): ToolsLoad => {
    const [state, setState] = useState<ToolsLoad>({ status: "loading" });
    useEffect(() => {
        let live = true;
        Promise.all([loadSortCards(), loadVendorIcons()]).then(
            ([cards, icons]) => live && setState({ status: "ready", data: { cards, icons } }),
            () => live && setState({ status: "failed" }),
        );
        return () => {
            live = false;
        };
    }, []);
    return state;
};
