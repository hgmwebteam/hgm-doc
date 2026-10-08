import { useEffect, useState } from "react";
import { ClipboardCheck, LayersThree01, RefreshCw01 } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { useAuthUser } from "@/hooks/use-auth-user";
import { type CheckAttempt, listAttempts } from "@/lib/check-attempts";
import { TEAM_DOMAIN } from "@/pages/team/dictionary/check/use-check-session";
import { TOOLS_RESULTS, readToolsRecord, toRefresh } from "@/pages/team/dictionary/tools/tools-results-model";

/**
 * The check's way in, under the dictionary's heading: "Take the check" and "Practise the
 * terms". Once the person has finished a sitting it reads "Retake the check", with a quiet
 * "12 terms to review" linking to their results.
 *
 * Kept small on purpose: /dictionary is a search page used live on calls, so the search box
 * stays the first thing on it. The buttons show at once with first-visit wording and change
 * when the person's own history arrives; a password visitor (no session) keeps them as they
 * are, and the check asks them to sign in.
 *
 * On the right of the same row, the tools, worded the same way: "Take the tools check" (Sort the
 * stack), "Retake the tools check" once this browser has a finished run, with "3 tools to refresh"
 * linking to its results, and "Practise the tools" (the tools training: every vendor in the icon
 * manifest), from src/pages/team/dictionary/tools/. The tools check is kept in this browser, so
 * these come from localStorage, not Supabase, and work with the team password too. On a phone
 * they wrap under the check's buttons.
 */

type Summary = { open: boolean; latest: CheckAttempt | null };

export const CheckLinks = () => {
    const { user } = useAuthUser();
    const userId = user?.email?.toLowerCase().endsWith(`@${TEAM_DOMAIN}`) ? user.id : null;
    const [summary, setSummary] = useState<Summary | null>(null);

    useEffect(() => {
        if (!userId) return setSummary(null);
        let live = true;
        listAttempts(userId).then(
            (attempts) => {
                if (!live) return;
                const finished = attempts.filter((a) => a.completed_at).sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""));
                setSummary({ open: attempts.some((a) => !a.completed_at), latest: finished[0] ?? null });
            },
            // Quietly keep the first-visit wording; the check itself says if something's wrong.
            () => live && setSummary(null),
        );
        return () => {
            live = false;
        };
    }, [userId]);

    // Read after mount, like the check's history: the first render is the same on every visit.
    const [tools, setTools] = useState<{ taken: boolean; refresh: number } | null>(null);
    useEffect(() => {
        const record = readToolsRecord();
        setTools({ taken: record.runs.length > 0, refresh: toRefresh(record).length });
    }, []);

    const toReview = summary?.latest?.missed_count ?? 0;
    const checkLabel = summary?.open ? "Resume the check" : summary?.latest ? "Retake the check" : "Take the check";
    const practiseSet = summary?.latest && toReview > 0 ? "missed" : "all";

    return (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <Button size="sm" color="secondary" iconLeading={ClipboardCheck} href="/dictionary/check">
                    {checkLabel}
                </Button>
                <Button size="sm" color="secondary" iconLeading={RefreshCw01} href={`/dictionary/practice?set=${practiseSet}`}>
                    Practise the terms
                </Button>
                {summary?.latest && toReview > 0 && (
                    <Button size="sm" color="link-color" href="/dictionary/check/results">
                        {`${toReview} ${toReview === 1 ? "term" : "terms"} to review`}
                    </Button>
                )}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <Button size="sm" color="secondary" iconLeading={LayersThree01} href="/dictionary/tools/review">
                    {tools?.taken ? "Retake the tools check" : "Take the tools check"}
                </Button>
                <Button size="sm" color="secondary" iconLeading={RefreshCw01} href={`/dictionary/tools/practice${tools?.refresh ? "?set=missed" : ""}`}>
                    Practise the tools
                </Button>
                {tools?.taken && tools.refresh > 0 && (
                    <Button size="sm" color="link-color" href={TOOLS_RESULTS}>
                        {`${tools.refresh} ${tools.refresh === 1 ? "tool" : "tools"} to refresh`}
                    </Button>
                )}
            </div>
        </div>
    );
};
