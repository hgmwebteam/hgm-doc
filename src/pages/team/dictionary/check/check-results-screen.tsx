import { useState } from "react";
import { ArrowRight } from "@untitledui/icons";
import { useNavigate } from "react-router";
import { Button } from "@/components/base/buttons/button";
import { CheckPage, Notice, PageTitle, SessionFallback } from "@/pages/team/dictionary/check/check-chrome";
import { explanationFor } from "@/pages/team/dictionary/check/check-model";
import { R_LINE, grade as gradeFor, missedTerms, progressLine, scorePct } from "@/pages/team/dictionary/check/check-score";
import { useCheckSession } from "@/pages/team/dictionary/check/use-check-session";
import { entryPath } from "@/pages/team/dictionary/dictionary-data";
import { DictionaryEntryCard } from "@/pages/team/dictionary/dictionary-entry";

/**
 * `/dictionary/check/results` — the signed-in person's latest finished sitting.
 *
 * The score is for fun and must never read as a problem: no pass mark, never "fail", and an R
 * comes with encouragement. Below it, every term not currently right, as the dictionary's own
 * cards (collapsed, no tier), each opening in place with the question's explanation.
 *
 * The score shown is the one that sitting left the person with (check_attempts.score_pct), so
 * it lines up with "Up 9% since last time", which compares it with the sitting before. The
 * cards come from current status, which is the same thing unless the bank has since changed.
 */

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const Results = () => {
    const session = useCheckSession();
    const navigate = useNavigate();
    const [openSlug, setOpenSlug] = useState<string | null>(null);

    if (session.status !== "ready") {
        return (
            <>
                <PageTitle>Your results</PageTitle>
                <div className="mt-6">
                    <SessionFallback session={session} />
                </div>
            </>
        );
    }

    const { content, history } = session;
    const latest = history.finished[0];

    if (!latest) {
        return (
            <>
                <PageTitle>Your results</PageTitle>
                <div className="mt-6">
                    <Notice
                        title="You haven't finished the check yet"
                        actions={
                            <Button size="md" href="/dictionary/check" iconTrailing={ArrowRight}>
                                {history.open ? "Resume the check" : "Take the check"}
                            </Button>
                        }
                    >
                        Your score and the terms to review show here once you have.
                    </Notice>
                </div>
            </>
        );
    }

    const missed = missedTerms(content.weights, history.correct);
    const score = latest.score_pct ?? scorePct(content.weights, history.correct);
    const grade = latest.grade ?? gradeFor(score);
    const previous = history.finished[1];
    const line = progressLine(
        previous?.score_pct != null && previous.missed_count != null ? { score: previous.score_pct, missed: previous.missed_count } : null,
        { score, missed: latest.missed_count ?? missed.length },
    );

    return (
        <>
            <PageTitle>Thanks for completing the check.</PageTitle>

            {history.open && (
                <p className="mt-3 flex flex-wrap items-center gap-x-2 text-sm text-tertiary">
                    You're partway through another round.
                    <Button href="/dictionary/check" color="link-color" size="sm">
                        Resume it
                    </Button>
                </p>
            )}

            <section aria-label="Your score" className="mt-6 rounded-xl bg-primary p-5 ring-1 ring-secondary sm:p-6">
                <dl className="flex flex-wrap gap-x-12 gap-y-4">
                    <div>
                        <dt className="text-sm font-medium text-tertiary">Score</dt>
                        <dd className="mt-1 text-display-lg font-semibold text-primary tabular-nums">{score}%</dd>
                    </div>
                    <div>
                        <dt className="text-sm font-medium text-tertiary">Grade</dt>
                        <dd className="mt-1 text-display-lg font-semibold text-primary">{grade}</dd>
                    </div>
                </dl>
                {grade === "R" && <p className="mt-4 max-w-[60ch] text-md text-pretty text-secondary">{R_LINE}</p>}
                {line && <p className="mt-4 text-sm text-tertiary">{line}</p>}
            </section>

            <div className="mt-6 flex flex-wrap items-center gap-3">
                {missed.length > 0 ? (
                    <>
                        <Button size="lg" href="/dictionary/practice?set=missed">
                            Practise the terms you missed
                        </Button>
                        <Button size="lg" color="secondary" href="/dictionary/check?mode=missed">
                            Retake the terms you missed
                        </Button>
                        <Button size="lg" color="secondary" href="/dictionary/check?mode=full">
                            Retake the whole check
                        </Button>
                    </>
                ) : (
                    <>
                        <Button size="lg" href="/dictionary/practice?set=all">
                            Practise all the terms
                        </Button>
                        <Button size="lg" color="secondary" href="/dictionary/check?mode=full">
                            Retake the whole check
                        </Button>
                    </>
                )}
                <Button size="lg" color="link-gray" href="/dictionary">
                    Back to the dictionary
                </Button>
            </div>

            <section aria-labelledby="check-review" className="mt-10">
                <h2 id="check-review" className="text-lg font-semibold text-primary">
                    {missed.length ? "Terms to review" : "Nothing to review"}
                </h2>
                {missed.length > 0 ? (
                    <>
                        <p className="mt-1 text-sm text-tertiary">
                            {plural(missed.length, "term", "terms")}. Open one for the full entry and how its question worked.
                        </p>
                        <ul className="mt-4 flex flex-col gap-2">
                            {missed.map((slug) => {
                                const entry = content.dict.bySlug.get(slug);
                                const status = history.status.get(slug);
                                if (!entry) return null;
                                return (
                                    <li key={slug}>
                                        <DictionaryEntryCard
                                            entry={entry}
                                            open={openSlug === slug}
                                            bySlug={content.dict.bySlug}
                                            onToggle={(s) => setOpenSlug((cur) => (cur === s ? null : s))}
                                            onRelated={(s) => navigate(entryPath(s))}
                                            showTier={false}
                                            explanation={status ? explanationFor(content.bank, status) : null}
                                        />
                                    </li>
                                );
                            })}
                        </ul>
                    </>
                ) : (
                    <p className="mt-1 text-md text-tertiary">You got every term right.</p>
                )}
            </section>
        </>
    );
};

export const CheckResultsScreen = () => (
    <CheckPage>
        <Results />
    </CheckPage>
);
