import type { CheckResponse } from "@/pages/team/dictionary/check/check-model";

/**
 * What's typed in the check, kept in this browser (decision 1a, 2026-10-01): one localStorage
 * entry per sitting, so resuming on the same device restores every answer. Supabase only ever
 * gets right or wrong. Used by the check (check-screen.tsx) and by "Reset your results" on the
 * results page, which clears every sitting's draft along with the sittings themselves.
 */

export type Draft = { responses: Record<string, CheckResponse>; at: number };
const PREFIX = "hgm_check_draft:";
const draftKey = (attemptId: string) => `${PREFIX}${attemptId}`;

export const readDraft = (attemptId: string): Draft => {
    try {
        const raw = localStorage.getItem(draftKey(attemptId));
        const d = raw ? (JSON.parse(raw) as Partial<Draft>) : null;
        return { responses: d?.responses && typeof d.responses === "object" ? d.responses : {}, at: typeof d?.at === "number" ? d.at : -1 };
    } catch {
        return { responses: {}, at: -1 };
    }
};

export const writeDraft = (attemptId: string, draft: Draft) => {
    try {
        localStorage.setItem(draftKey(attemptId), JSON.stringify(draft));
    } catch {
        /* storage full or blocked: Supabase still has right or wrong for everything answered */
    }
};

export const clearDraft = (attemptId: string) => {
    try {
        localStorage.removeItem(draftKey(attemptId));
    } catch {
        /* nothing to clear */
    }
};

/** Every sitting's draft in this browser: "Reset your results". */
export const clearAllDrafts = () => {
    try {
        const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).filter((k): k is string => !!k?.startsWith(PREFIX));
        for (const k of keys) localStorage.removeItem(k);
    } catch {
        /* nothing to clear */
    }
};
