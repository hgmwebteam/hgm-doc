import { useCallback, useEffect, useState } from "react";
import { useAuthUser } from "@/hooks/use-auth-user";
import { type CheckAttempt, listAttempts, listTermStatus } from "@/lib/check-attempts";
import { loadCheckBank } from "@/pages/team/dictionary/check/check-bank-data";
import { type CheckBank, type TermStatus, bankProblems } from "@/pages/team/dictionary/check/check-model";
import { termWeights } from "@/pages/team/dictionary/check/check-score";
import { type DictionaryData, loadDictionary } from "@/pages/team/dictionary/dictionary-data";

/**
 * Everything the check, results and flashcard pages load before they can show anything:
 * the bank and the dictionary (both lazy chunks), who's signed in, and that person's own
 * history. One hook, so the three pages agree on what "ready" means.
 *
 * Signing in: TeamGate also opens with the shared team password, which creates no Supabase
 * session. The check stores each person's answers under their own sign-in, so without a
 * session there is nothing to save to; those visitors are asked to continue with Google.
 */

export const TEAM_DOMAIN = "hiddengem.media";

export type CheckContent = { bank: CheckBank; dict: DictionaryData; weights: Map<string, number> };

export type CheckHistory = {
    attempts: CheckAttempt[];
    /** Latest answer per term, from finished sittings. */
    status: Map<string, TermStatus>;
    /** The same, as right-or-not, for scoring. */
    correct: Map<string, boolean>;
    /** The sitting in progress, if there is one (at most one, by a unique index). */
    open: CheckAttempt | null;
    /** Finished sittings, newest first. */
    finished: CheckAttempt[];
};

export type CheckSession =
    | { status: "loading" }
    | { status: "failed" }
    | { status: "broken"; problems: string[] }
    | { status: "signed-out"; content: CheckContent; email?: string }
    | { status: "history-failed"; content: CheckContent; retry: () => void }
    | { status: "ready"; content: CheckContent; userId: string; history: CheckHistory; reload: () => Promise<CheckHistory | null> };

export const toHistory = (attempts: CheckAttempt[], rows: TermStatus[]): CheckHistory => {
    const status = new Map(rows.map((r) => [r.term_slug, r]));
    const finished = attempts.filter((a) => a.completed_at).sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""));
    return {
        attempts,
        status,
        correct: new Map(rows.map((r) => [r.term_slug, r.correct])),
        open: attempts.find((a) => !a.completed_at) ?? null,
        finished,
    };
};

type ContentState = { status: "loading" } | { status: "failed" } | { status: "broken"; problems: string[] } | { status: "ready"; content: CheckContent };

const useCheckContent = (): ContentState => {
    const [state, setState] = useState<ContentState>({ status: "loading" });
    useEffect(() => {
        let live = true;
        Promise.all([loadCheckBank(), loadDictionary()]).then(
            ([bank, dict]) => {
                if (!live) return;
                // A bank that doesn't fit the dictionary is never served half-working.
                const problems = bankProblems(bank, dict.bySlug);
                setState(
                    problems.length ? { status: "broken", problems } : { status: "ready", content: { bank, dict, weights: termWeights(bank, dict.bySlug) } },
                );
            },
            () => live && setState({ status: "failed" }),
        );
        return () => {
            live = false;
        };
    }, []);
    return state;
};

export const useCheckSession = (): CheckSession => {
    const content = useCheckContent();
    const { user, loading: userLoading } = useAuthUser();
    const isTeam = !!user?.email && user.email.toLowerCase().endsWith(`@${TEAM_DOMAIN}`);
    const userId = isTeam ? user!.id : null;

    const [history, setHistory] = useState<CheckHistory | null>(null);
    const [historyFailed, setHistoryFailed] = useState(false);

    const reload = useCallback(async () => {
        if (!userId) return null;
        try {
            const [attempts, rows] = await Promise.all([listAttempts(userId), listTermStatus(userId)]);
            const h = toHistory(attempts, rows);
            setHistory(h);
            setHistoryFailed(false);
            return h;
        } catch (error) {
            console.error("[check] couldn't load history:", error);
            setHistoryFailed(true);
            return null;
        }
    }, [userId]);

    useEffect(() => {
        setHistory(null);
        if (userId) void reload();
    }, [userId, reload]);

    if (content.status !== "ready") return content;
    if (userLoading) return { status: "loading" };
    if (!userId) return { status: "signed-out", content: content.content, email: user?.email };
    if (historyFailed) return { status: "history-failed", content: content.content, retry: () => void reload() };
    if (!history) return { status: "loading" };
    return { status: "ready", content: content.content, userId, history, reload };
};
