import { useEffect, useState } from "react";
import { ClipboardCheck, RefreshCw01 } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { useAuthUser } from "@/hooks/use-auth-user";
import { type CheckAttempt, listAttempts } from "@/lib/check-attempts";
import { TEAM_DOMAIN } from "@/pages/team/dictionary/check/use-check-session";

/**
 * The check's way in, under the dictionary's heading: "Take the check" and "Practise the
 * terms". Once the person has finished a sitting it reads "Retake the check", with a quiet
 * "12 terms to review" linking to their results.
 *
 * Kept small on purpose: /dictionary is a search page used live on calls, so the search box
 * stays the first thing on it. The buttons show at once with first-visit wording and change
 * when the person's own history arrives; a password visitor (no session) keeps them as they
 * are, and the check asks them to sign in.
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

    const toReview = summary?.latest?.missed_count ?? 0;
    const checkLabel = summary?.open ? "Resume the check" : summary?.latest ? "Retake the check" : "Take the check";
    const practiseSet = summary?.latest && toReview > 0 ? "missed" : "all";

    return (
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
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
    );
};
