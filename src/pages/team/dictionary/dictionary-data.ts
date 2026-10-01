import { type DictionaryEntry, type IndexedEntry, buildIndex } from "@/pages/team/dictionary/dictionary-model";

/**
 * The one way to load the dictionary master. The page and the header's global search
 * both call this, so the ~45 KB chunk is fetched once per visit and only when someone
 * opens the dictionary or starts searching. Never import the JSON statically: that
 * would put it in the bundle every page of the site downloads.
 */

export type DictionaryData = { entries: DictionaryEntry[]; index: IndexedEntry[]; bySlug: Map<string, DictionaryEntry> };

let loading: Promise<DictionaryData> | null = null;

export const loadDictionary = () =>
    (loading ??= import("@/data/ref_dictionary-v2-253.json")
        .then((mod) => {
            // An assignment, not a cast: a new master missing a field the page needs fails the build.
            const entries: DictionaryEntry[] = mod.default;
            return { entries, index: buildIndex(entries), bySlug: new Map(entries.map((e) => [e.slug, e])) };
        })
        .catch((error: unknown) => {
            loading = null; // a stale tab after a deploy can retry after reloading
            throw error;
        }));

/** The address of one entry, used by Copy link and by the global search. */
export const entryPath = (slug: string) => `/dictionary#${slug}`;
