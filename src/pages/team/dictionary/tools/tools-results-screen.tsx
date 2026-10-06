import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { CheckPage, Notice, PageTitle } from "@/pages/team/dictionary/check/check-chrome";
import { progressLine } from "@/pages/team/dictionary/check/check-score";
import { sortProblems } from "@/pages/team/dictionary/tools/sort-model";
import { BrokenNotice, ToolsLoading, VendorIcon } from "@/pages/team/dictionary/tools/sort-stack";
import { type ToolsData, useToolsData } from "@/pages/team/dictionary/tools/tools-data";
import { TOOLS_NOUN, TOOLS_R_LINE, type ToolsRecord, clearToolsRecord, readToolsRecord, toRefresh } from "@/pages/team/dictionary/tools/tools-results-model";
import { iconSlug, trainingCards } from "@/pages/team/dictionary/tools/vendor-icons";

/**
 * `/dictionary/tools/review/results` — the tools check's results: this browser's latest finished
 * run of Sort the stack. Laid out like the terms check's results (check-results-screen.tsx): the
 * score and grade (for fun, never a pass mark, an R with encouragement), the line comparing it
 * with the run before, then every tool to refresh on, each with its logo, what it's known for,
 * what else it sells, and the game's note on it. At the bottom, "Reset your tools results", behind
 * a second press, clears this browser's record.
 *
 * Kept in this browser only (tools-results-model.ts), so another device or browser starts empty;
 * the page says so. The tools to refresh are each vendor's latest result across runs, so the list
 * shrinks as practice and retakes bring them back right.
 */

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Each vendor's note, as the card list words it (its card's, or else its suite's). */
const notesOf = (data: ToolsData) => {
    const notes = new Map<string, string>();
    for (const r of data.cards.rounds) for (const e of r.mode === "vendors" ? r.cards : r.suites) if (!notes.has(e.vendor)) notes.set(e.vendor, e.note);
    return notes;
};

/** One tool to refresh on: its logo and name, what it falls under, and the game's note. */
const RefreshItem = ({ name, data }: { name: string; data: ToolsData }) => {
    const slug = iconSlug(data.icons, name);
    const card = useMemo(() => (slug ? trainingCards(data.icons, data.cards).find((c) => c.slug === slug) : undefined), [slug, data]);
    const note = useMemo(() => notesOf(data).get(name), [name, data]);
    return (
        <li className="flex gap-4 rounded-xl bg-primary p-4 ring-1 ring-secondary sm:p-5">
            {slug && (
                <span className="shrink-0">
                    <VendorIcon slug={slug} size={40} />
                </span>
            )}
            <div className="min-w-0">
                <p className="text-md font-semibold text-primary">{name}</p>
                {card && (
                    <p className="mt-1 text-sm text-pretty text-secondary">
                        <span className="font-medium">Falls under:</span> {card.main.map((b) => b.name).join(", ")}
                        {card.also.length > 0 && (
                            <>
                                {" · "}
                                <span className="font-medium">Also sells:</span> {card.also.map((b) => b.name).join(", ")}
                            </>
                        )}
                    </p>
                )}
                {note && <p className="mt-2 text-sm text-pretty text-tertiary">{note}</p>}
            </div>
        </li>
    );
};

/** "Reset your tools results": a quiet link that turns into a confirm card, so one press can't clear it. */
const ResetTools = ({ onReset }: { onReset: () => void }) => {
    const [confirm, setConfirm] = useState(false);
    const [error, setError] = useState("");
    const ref = useRef<HTMLDivElement>(null);
    const swapped = useRef(false);
    // The pressed button vanishes with the swap; focus moves to what replaced it.
    useEffect(() => {
        if (!swapped.current) return;
        swapped.current = false;
        ref.current?.focus({ preventScroll: true });
    }, [confirm]);
    const toggle = (on: boolean) => {
        swapped.current = true;
        setConfirm(on);
    };
    return (
        <section aria-label="Reset" className="mt-12 border-t border-secondary pt-6">
            <div ref={ref} tabIndex={-1} className="outline-none">
                {confirm ? (
                    <Notice
                        title="Reset your tools results?"
                        actions={
                            <>
                                <Button
                                    size="md"
                                    color="primary-destructive"
                                    onClick={() => (clearToolsRecord() ? onReset() : setError("This browser wouldn't clear them. Try again in a moment."))}
                                >
                                    Reset them
                                </Button>
                                <Button size="md" color="secondary" onClick={() => toggle(false)}>
                                    Keep them
                                </Button>
                            </>
                        }
                    >
                        This clears every score and the tools to refresh, in this browser. The game and the flashcards stay as they are.
                    </Notice>
                ) : (
                    <Button size="sm" color="link-gray" onClick={() => toggle(true)}>
                        Reset your tools results
                    </Button>
                )}
            </div>
            {error && (
                <p role="alert" className="mt-3 text-sm text-error-primary">
                    {error}
                </p>
            )}
        </section>
    );
};

const Results = ({ data }: { data: ToolsData }) => {
    const [record, setRecord] = useState<ToolsRecord>(readToolsRecord);
    const latest = record.runs[0];

    if (!latest) {
        return (
            <>
                <PageTitle>Your tools results</PageTitle>
                <div className="mt-6">
                    <Notice
                        title="You haven't finished the tools check yet"
                        actions={
                            <Button size="md" href="/dictionary/tools/review" iconTrailing={ArrowRight}>
                                Take the tools check
                            </Button>
                        }
                    >
                        Your score and the tools to refresh on show here once you have. They're kept in this browser only.
                    </Notice>
                </div>
            </>
        );
    }

    const refresh = toRefresh(record);
    const previous = record.runs[1];
    const line = progressLine(
        previous ? { score: previous.score, missed: previous.refresh } : null,
        { score: latest.score, missed: latest.refresh },
        TOOLS_NOUN,
    );

    return (
        <>
            <PageTitle>Thanks for completing the tools check.</PageTitle>

            <section aria-label="Your score" className="mt-6 rounded-xl bg-primary p-5 ring-1 ring-secondary sm:p-6">
                <dl className="flex flex-wrap gap-x-12 gap-y-4">
                    <div>
                        <dt className="text-sm font-medium text-tertiary">Score</dt>
                        <dd className="mt-1 text-display-lg font-semibold text-primary tabular-nums">{latest.score}%</dd>
                    </div>
                    <div>
                        <dt className="text-sm font-medium text-tertiary">Grade</dt>
                        <dd className="mt-1 text-display-lg font-semibold text-primary">{latest.grade}</dd>
                    </div>
                </dl>
                {latest.grade === "R" && <p className="mt-4 max-w-[60ch] text-md text-pretty text-secondary">{TOOLS_R_LINE}</p>}
                {line && <p className="mt-4 text-sm text-tertiary">{line}</p>}
                <p className="mt-4 text-sm text-quaternary">Kept in this browser only.</p>
            </section>

            <div className="mt-6 flex flex-wrap items-center gap-3">
                {refresh.length > 0 ? (
                    <Button size="lg" href="/dictionary/tools/practice?set=missed">
                        Practise the tools to refresh
                    </Button>
                ) : (
                    <Button size="lg" href="/dictionary/tools/practice">
                        Practise all the tools
                    </Button>
                )}
                <Button size="lg" color="secondary" href="/dictionary/tools/review">
                    Retake the tools check
                </Button>
                <Button size="lg" color="link-gray" href="/dictionary">
                    Back to the dictionary
                </Button>
            </div>

            <section aria-labelledby="tools-refresh" className="mt-10">
                <h2 id="tools-refresh" className="text-lg font-semibold text-primary">
                    {refresh.length ? "Tools to refresh on" : "Nothing to refresh"}
                </h2>
                {refresh.length > 0 ? (
                    <>
                        <p className="mt-1 text-sm text-tertiary">
                            {plural(refresh.length, "tool", "tools")}, from your latest result for each. Every run deals different tools, so the list shrinks as
                            they come round again.
                        </p>
                        <ul className="mt-4 flex flex-col gap-2">
                            {refresh.map((name) => (
                                <RefreshItem key={name} name={name} data={data} />
                            ))}
                        </ul>
                    </>
                ) : (
                    <p className="mt-1 text-md text-tertiary">You've got every tool you've been dealt right.</p>
                )}
            </section>

            <ResetTools onReset={() => setRecord(readToolsRecord())} />
        </>
    );
};

const Loaded = () => {
    const loaded = useToolsData();
    if (loaded.status !== "ready") return <ToolsLoading title="Your tools results" failed={loaded.status === "failed"} />;
    const problems = sortProblems(loaded.data.cards);
    if (problems.length)
        return (
            <>
                <PageTitle>Your tools results</PageTitle>
                <div className="mt-6">
                    <BrokenNotice problems={problems} />
                </div>
            </>
        );
    return <Results data={loaded.data} />;
};

export const ToolsResultsScreen = () => (
    <CheckPage>
        <Loaded />
    </CheckPage>
);
