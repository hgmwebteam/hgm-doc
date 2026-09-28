import { useCallback, useEffect, useRef, useState } from "react";
import { readSopPage, writeSopPage } from "@/lib/db-sync";
import { DIRECTORY_SLUG, type DirectoryData, normalizeDirectoryData } from "./directory-model";
import { SEED_CLIENTS, SEED_SECTIONS } from "./directory-seed";

export type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * The directory document: one `sop_pages` row, read once and rewritten whole on every change.
 *
 * Until the first save there is no row, so `readSopPage` throws and the seed stands in — the
 * page renders as it did the day it moved into the portal, and the first edit writes it.
 * Every save is optimistic (the screen updates first) and surfaces its failure in `saveState`
 * rather than rolling back, so a team member sees what they typed and that it isn't saved.
 */
export function useDirectoryData() {
    const [data, setData] = useState<DirectoryData | null>(null);
    const [loading, setLoading] = useState(true);
    const [saveState, setSaveState] = useState<SaveState>("idle");
    const [saveError, setSaveError] = useState("");
    const savedTimer = useRef<number | null>(null);

    useEffect(() => {
        let cancelled = false;
        const seed: DirectoryData = { clients: SEED_CLIENTS, sections: SEED_SECTIONS };
        readSopPage(DIRECTORY_SLUG)
            .then((row) => {
                if (!cancelled) setData(normalizeDirectoryData(row?.data, seed));
            })
            .catch(() => {
                // No row yet (or no connection): the seed, until a save writes the row.
                if (!cancelled) setData(seed);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(
        () => () => {
            if (savedTimer.current) window.clearTimeout(savedTimer.current);
        },
        [],
    );

    const save = useCallback(async (next: DirectoryData) => {
        setData(next);
        setSaveState("saving");
        setSaveError("");
        try {
            await writeSopPage(DIRECTORY_SLUG, next);
            setSaveState("saved");
            if (savedTimer.current) window.clearTimeout(savedTimer.current);
            savedTimer.current = window.setTimeout(() => setSaveState("idle"), 1800);
        } catch (e) {
            setSaveState("error");
            setSaveError(e instanceof Error ? e.message : "Could not save.");
            throw e;
        }
    }, []);

    return { data, loading, save, saveState, saveError };
}
