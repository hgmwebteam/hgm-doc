import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen01, Check } from "@untitledui/icons";
import { useNavigate, useSearchParams } from "react-router";
import { Button } from "@/components/base/buttons/button";
import { ProgressBarBase } from "@/components/base/progress-indicators/progress-indicators";
import { type CheckAttempt, discardAttempt, finishAttempt, listAnswers, listTermStatus, saveAnswers, startAttempt } from "@/lib/check-attempts";
import { CheckPage, Notice, PageTitle, SessionFallback } from "@/pages/team/dictionary/check/check-chrome";
import {
    type BankItem,
    type CheckMode,
    type CheckResponse,
    type PlanEntry,
    buildPlan,
    entryKey,
    findVariant,
    finishSitting,
    isAnswered,
    latestByTerm,
    rowsToSave,
} from "@/pages/team/dictionary/check/check-model";
import { Question } from "@/pages/team/dictionary/check/check-questions";
import { applyResults, grade, missedTerms, scorePct } from "@/pages/team/dictionary/check/check-score";
import { type CheckContent, type CheckHistory, useCheckSession } from "@/pages/team/dictionary/check/use-check-session";
import { cx } from "@/utils/cx";

/**
 * `/dictionary/check` — the check. `?mode=full` (the default) or `?mode=missed`.
 *
 * It opens on an intro and never starts on its own: Google sign-in returns here without the
 * query, so landing back must not set off a long sitting. A sitting is one continuous run,
 * one screen at a time, in random order, no feedback until the end. Back works until it's
 * finished, and anything left unanswered then counts as a term to review.
 *
 * Saving, which is what lets a first sitting run 45 minutes or more and be finished another
 * day: what someone has entered is kept in their own browser (localStorage, per sitting) and
 * nowhere else. Supabase gets only right or wrong, per term, as they go — a row the first
 * time a term is answered and again whenever it flips (rowsToSave). Resuming on the same
 * device restores every answer; on another device, answered screens are marked and can be
 * answered again (decision 1a, 2026-10-01).
 */

/* ── What's typed, kept in this browser ─────────────────────────── */

type Draft = { responses: Record<string, CheckResponse>; at: number };
const draftKey = (attemptId: string) => `hgm_check_draft:${attemptId}`;

const readDraft = (attemptId: string): Draft => {
    try {
        const raw = localStorage.getItem(draftKey(attemptId));
        const d = raw ? (JSON.parse(raw) as Partial<Draft>) : null;
        return { responses: d?.responses && typeof d.responses === "object" ? d.responses : {}, at: typeof d?.at === "number" ? d.at : -1 };
    } catch {
        return { responses: {}, at: -1 };
    }
};

const writeDraft = (attemptId: string, draft: Draft) => {
    try {
        localStorage.setItem(draftKey(attemptId), JSON.stringify(draft));
    } catch {
        /* storage full or blocked: Supabase still has right or wrong for everything answered */
    }
};

const clearDraft = (attemptId: string) => {
    try {
        localStorage.removeItem(draftKey(attemptId));
    } catch {
        /* nothing to clear */
    }
};

/** The screens of a sitting that still match the bank. A question changed mid-sitting is skipped, and its terms count as missed. */
const usableScreens = (plan: PlanEntry[], content: CheckContent) => {
    const items = new Map(content.bank.items.map((i) => [i.id, i]));
    return plan.flatMap((entry) => {
        const item = items.get(entry.item);
        return item && findVariant(item, entry.variant) ? [{ entry, item, key: entryKey(entry) }] : [];
    });
};

type Screen = { entry: PlanEntry; item: BankItem; key: string };

const MODE_LABEL: Record<CheckMode, string> = { full: "the whole check", missed: "the terms you missed" };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const OpenBookLine = ({ className }: { className?: string }) => (
    <p className={cx("flex items-start gap-2 text-sm text-tertiary", className)}>
        <BookOpen01 className="mt-0.5 size-4 shrink-0 text-fg-quaternary" aria-hidden="true" />
        <span>Open book: the dictionary and cheat sheet are allowed, and a calculator is welcome. Every figure is illustrative.</span>
    </p>
);

/* ── The intro ──────────────────────────────────────────────────── */

const Intro = ({
    content,
    history,
    userId,
    requested,
    reload,
    onBegin,
}: {
    content: CheckContent;
    history: CheckHistory;
    userId: string;
    requested: CheckMode;
    reload: () => Promise<CheckHistory | null>;
    onBegin: (attempt: CheckAttempt) => void;
}) => {
    const { bank, weights } = content;
    const hasFinished = history.finished.length > 0;
    // A missed-terms retake needs a finished sitting to know what was missed.
    const mode: CheckMode = requested === "missed" && hasFinished ? "missed" : "full";
    const plan = useMemo(() => (mode === "missed" ? buildPlan(bank, "missed", history.status, Math.random) : null), [bank, mode, history.status]);
    const missedCount = missedTerms(weights, history.correct).length;

    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [confirmDiscard, setConfirmDiscard] = useState(false);
    const [openAnswered, setOpenAnswered] = useState<number | null>(null);
    const open = history.open;

    // "Start again" and "Keep it" swap one card for the other, removing the button just pressed;
    // focus moves to the card that replaced it, so it isn't dropped on the page.
    const swapRef = useRef<HTMLDivElement>(null);
    const swapped = useRef(false);
    useEffect(() => {
        if (!swapped.current) return;
        swapped.current = false;
        swapRef.current?.focus({ preventScroll: true });
    }, [confirmDiscard]);
    const toggleDiscard = (on: boolean) => {
        swapped.current = true;
        setConfirmDiscard(on);
    };

    // How far the sitting in progress has got: answered here, or saved from another device.
    useEffect(() => {
        if (!open) return;
        let live = true;
        const screens = usableScreens(open.plan, content);
        const draft = readDraft(open.id);
        listAnswers(userId, open.id)
            .then((rows) => {
                const saved = latestByTerm(rows);
                if (live)
                    setOpenAnswered(
                        screens.filter((s) => isAnswered(s.item, s.entry, draft.responses[s.key]) || s.entry.terms.every((t) => saved.has(t))).length,
                    );
            })
            .catch(() => live && setOpenAnswered(null));
        return () => {
            live = false;
        };
    }, [open, content, userId]);

    const begin = async () => {
        setBusy(true);
        setError("");
        try {
            onBegin(await startAttempt({ mode, bankVersion: bank.version, plan: buildPlan(bank, mode, history.status, Math.random) }));
        } catch (e) {
            console.error("[check] couldn't start:", e);
            // Most likely another tab started one a moment ago; show it.
            await reload();
            setError("The check couldn't start. If you have it open in another tab, resume that one.");
            setBusy(false);
        }
    };

    const discardAndBegin = async () => {
        if (!open) return;
        setBusy(true);
        setError("");
        try {
            await discardAttempt(open.id);
            clearDraft(open.id);
            const h = await reload();
            onBegin(await startAttempt({ mode, bankVersion: bank.version, plan: buildPlan(bank, mode, h?.status ?? history.status, Math.random) }));
        } catch (e) {
            console.error("[check] couldn't start again:", e);
            setError("That didn't go through. Try again in a moment.");
            setBusy(false);
        }
    };

    if (open) {
        const total = usableScreens(open.plan, content).length;
        const progress = openAnswered === null ? `${plural(total, "question", "questions")}` : `${openAnswered} of ${total} answered`;
        const same = open.mode === mode;
        return (
            <>
                <PageTitle>The check</PageTitle>
                <div className="mt-6 flex flex-col gap-4">
                    <div ref={swapRef} tabIndex={-1} className="outline-none">
                        {confirmDiscard ? (
                            <Notice
                                title={same ? "Start again?" : `Start ${MODE_LABEL[mode]} instead?`}
                                actions={
                                    <>
                                        <Button size="md" onClick={discardAndBegin} isLoading={busy} showTextWhileLoading>
                                            {same ? "Clear it and start again" : "Clear it and start"}
                                        </Button>
                                        <Button size="md" color="secondary" onClick={() => toggleDiscard(false)} isDisabled={busy}>
                                            Keep it
                                        </Button>
                                    </>
                                }
                            >
                                This clears the answers in the one you're partway through. Nothing from finished rounds changes.
                            </Notice>
                        ) : (
                            <Notice
                                title={same ? "You're partway through" : "You have a check in progress"}
                                actions={
                                    <>
                                        <Button size="md" onClick={() => onBegin(open)} iconTrailing={ArrowRight}>
                                            Resume
                                        </Button>
                                        <Button size="md" color="secondary" onClick={() => toggleDiscard(true)}>
                                            {same ? "Start again" : `Start ${MODE_LABEL[mode]} instead`}
                                        </Button>
                                    </>
                                }
                            >
                                {same ? `${progress}. It picks up where you left off.` : `It's ${MODE_LABEL[open.mode]}, ${progress}.`}
                            </Notice>
                        )}
                    </div>
                    {error && (
                        <p role="alert" className="text-sm text-error-primary">
                            {error}
                        </p>
                    )}
                    <OpenBookLine />
                </div>
            </>
        );
    }

    if (mode === "missed" && plan && plan.length === 0) {
        return (
            <>
                <PageTitle>The check</PageTitle>
                <div className="mt-6">
                    <Notice
                        title="Nothing to retake"
                        actions={
                            <>
                                <Button size="md" href="/dictionary/practice?set=all">
                                    Practise all the terms
                                </Button>
                                <Button size="md" color="secondary" href="/dictionary/check?mode=full">
                                    Retake the whole check
                                </Button>
                            </>
                        }
                    >
                        You have every term right.
                    </Notice>
                </div>
            </>
        );
    }

    const questions = mode === "missed" ? plan!.length : bank.items.length;
    const terms = mode === "missed" ? missedCount : weights.size;

    return (
        <>
            <PageTitle>The check</PageTitle>
            <div className="mt-3 flex max-w-[66ch] flex-col gap-4 text-md text-pretty text-tertiary">
                {requested === "missed" && !hasFinished && <p className="text-secondary">You haven't finished the check yet, so this is the whole check.</p>}
                {mode === "missed" ? (
                    <p>
                        Just the {plural(terms, "term", "terms")} you have to review, as {plural(questions, "question", "questions")}, each one the version you
                        didn't see last time. Your other terms stay as they are.
                    </p>
                ) : (
                    <p>
                        {hasFinished ? "The whole check again, with the other version of each question: " : "One run through "}
                        {hasFinished ? `all ${terms} terms` : `the ${terms} terms you've been learning`}, to see which ones you know and which to practise.
                        There's no pass mark, and only you can see your answers and your score.
                    </p>
                )}
            </div>

            <div className="mt-6 rounded-xl bg-secondary p-4 ring-1 ring-secondary sm:p-5">
                <OpenBookLine className="text-md text-secondary" />
                <ul className="mt-3 flex flex-col gap-1.5 pl-6 text-sm text-tertiary">
                    <li className="list-disc">{plural(questions, "question", "questions")}, one at a time.</li>
                    <li className="list-disc">It saves as you go, so you can leave and pick up where you left off.</li>
                    <li className="list-disc">You can go back and change an answer until you finish.</li>
                </ul>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button size="lg" onClick={begin} isLoading={busy} showTextWhileLoading iconTrailing={ArrowRight}>
                    {mode === "missed" ? "Start the terms you missed" : "Start the check"}
                </Button>
            </div>
            {error && (
                <p role="alert" className="mt-3 text-sm text-error-primary">
                    {error}
                </p>
            )}
        </>
    );
};

/* ── A sitting ──────────────────────────────────────────────────── */

type SaveState = "idle" | "saving" | "saved" | "error";

const SAVE_DELAY_MS = 700;

const Sitting = ({
    attempt,
    content,
    userId,
    scrollRef,
}: {
    attempt: CheckAttempt;
    content: CheckContent;
    userId: string;
    scrollRef: RefObject<HTMLDivElement | null>;
}) => {
    const navigate = useNavigate();
    const screens = useMemo<Screen[]>(() => usableScreens(attempt.plan, content), [attempt.plan, content]);
    const initial = useMemo(() => readDraft(attempt.id), [attempt.id]);

    const [responses, setResponses] = useState<Record<string, CheckResponse>>(initial.responses);
    const [index, setIndex] = useState(() => Math.min(Math.max(initial.at, 0), Math.max(screens.length - 1, 0)));
    const [saved, setSaved] = useState<Map<string, boolean> | null>(null);
    const [saveState, setSaveState] = useState<SaveState>("idle");
    const [finishing, setFinishing] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState("");

    const responsesRef = useRef(responses);
    /** Latest right-or-wrong per term that Supabase has for this sitting. */
    const savedRef = useRef(new Map<string, boolean>());
    const loaded = useRef(false);
    const pending = useRef(new Set<string>());
    const timer = useRef<number | undefined>(undefined);
    const chain = useRef<Promise<boolean>>(Promise.resolve(true));
    const headingRef = useRef<HTMLHeadingElement>(null);
    // True from the start: Start and Resume unmount the intro, so the first screen takes focus too.
    const moved = useRef(true);
    const byKey = useMemo(() => new Map(screens.map((s) => [s.key, s])), [screens]);

    /**
     * What this sitting already has in Supabase, from this device or another. Nothing is
     * sent until this is in, so a resumed sitting never re-sends a row it already has. Then
     * every answer in the draft is queued: rowsToSave sends only what differs, which also
     * catches anything a previous visit typed but couldn't save.
     */
    const loadSaved = useCallback(async () => {
        try {
            savedRef.current = latestByTerm(await listAnswers(userId, attempt.id));
            loaded.current = true;
            setSaved(new Map(savedRef.current));
            for (const k of Object.keys(responsesRef.current)) if (byKey.has(k)) pending.current.add(k);
            return true;
        } catch (e) {
            console.error("[check] couldn't load saved answers:", e);
            setSaveState("error");
            return false;
        }
    }, [userId, attempt.id, byKey]);

    /** Sends whatever has changed. One at a time, so two saves never race to write the same term. */
    const flush = useCallback(
        () =>
            (chain.current = chain.current.then(async () => {
                window.clearTimeout(timer.current);
                if (!loaded.current && !(await loadSaved())) return false;
                const keys = [...pending.current];
                pending.current.clear();
                const rows = keys.flatMap((k) => {
                    const s = byKey.get(k);
                    return s ? rowsToSave(s.item, s.entry, responsesRef.current[k], savedRef.current) : [];
                });
                if (!rows.length) return true;
                setSaveState("saving");
                try {
                    await saveAnswers(attempt.id, rows);
                    for (const r of rows) savedRef.current.set(r.term_slug, r.correct);
                    setSaved(new Map(savedRef.current));
                    setSaveState("saved");
                    return true;
                } catch (e) {
                    console.error("[check] couldn't save:", e);
                    keys.forEach((k) => pending.current.add(k));
                    setSaveState("error");
                    return false;
                }
            })),
        [attempt.id, byKey, loadSaved],
    );

    // On arrival: learn what's saved, send anything the draft has that Supabase doesn't, and
    // on a device with no draft, start at the first screen without an answer.
    useEffect(() => {
        void flush().then(() => {
            if (initial.at >= 0 || !loaded.current) return;
            const first = screens.findIndex((s) => !s.entry.terms.every((t) => savedRef.current.has(t)));
            setIndex(first < 0 ? 0 : first);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps -- once per sitting
    }, []);

    // Leaving the tab or the page: send what's waiting. (What's typed is already in the draft.)
    useEffect(() => {
        const onHide = () => document.visibilityState === "hidden" && void flush();
        document.addEventListener("visibilitychange", onHide);
        return () => {
            document.removeEventListener("visibilitychange", onHide);
            void flush();
        };
    }, [flush]);

    useEffect(() => () => window.clearTimeout(timer.current), []);

    const change = (key: string, response: CheckResponse) => {
        const next = { ...responsesRef.current, [key]: response };
        responsesRef.current = next;
        setResponses(next);
        writeDraft(attempt.id, { responses: next, at: index });
        pending.current.add(key);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => void flush(), SAVE_DELAY_MS);
    };

    const answered = (s: Screen) => isAnswered(s.item, s.entry, responses[s.key]) || (!!saved && s.entry.terms.every((t) => saved.has(t)) && !responses[s.key]);
    const unanswered = screens.filter((s) => !answered(s));

    const go = (i: number) => {
        void flush();
        setFinishing(false);
        setIndex(i);
        writeDraft(attempt.id, { responses: responsesRef.current, at: i });
        moved.current = true;
    };

    // Each new screen starts at the top, with focus on its heading so a screen reader reads it.
    useEffect(() => {
        if (!moved.current) return;
        scrollRef.current?.scrollTo({ top: 0, behavior: "instant" });
        headingRef.current?.focus({ preventScroll: true });
    }, [index, finishing, scrollRef]);

    const submit = async () => {
        setSubmitting(true);
        setSubmitError("");
        try {
            if (!(await flush())) throw new Error("some answers aren't saved");
            const rows = await listAnswers(userId, attempt.id);
            const { results, missing } = finishSitting(attempt.plan, latestByTerm(rows));
            await saveAnswers(attempt.id, missing);
            const before = new Map((await listTermStatus(userId)).map((r) => [r.term_slug, r.correct]));
            const after = applyResults(before, results);
            const score = scorePct(content.weights, after);
            await finishAttempt(attempt.id, { score_pct: score, grade: grade(score), missed_count: missedTerms(content.weights, after).length });
            clearDraft(attempt.id);
            navigate("/dictionary/check/results");
        } catch (e) {
            console.error("[check] couldn't finish:", e);
            setSubmitError("It didn't finish, probably the connection. Your answers are kept. Try again in a moment.");
            setSubmitting(false);
        }
    };

    if (!screens.length) {
        return (
            <Notice
                title="This round has no questions left"
                actions={
                    <Button size="md" href="/dictionary/check">
                        Back to the check
                    </Button>
                }
            >
                The questions changed after it started. Start a new round from the check.
            </Notice>
        );
    }

    const screen = screens[Math.min(index, screens.length - 1)];
    const last = index >= screens.length - 1;
    const remoteOnly = !!saved && !responses[screen.key] && screen.entry.terms.every((t) => saved.has(t));

    return (
        <>
            <OpenBookLine />
            <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-secondary tabular-nums">{finishing ? "Ready to finish" : `${index + 1} of ${screens.length}`}</p>
                <SaveStatus state={saveState} onRetry={() => void flush()} />
            </div>
            <div aria-hidden="true" className="mt-2">
                <ProgressBarBase value={finishing ? screens.length : index + 1} max={screens.length} />
            </div>

            {finishing ? (
                <section className="mt-8 flex flex-col gap-4" aria-labelledby="check-finish">
                    <h2 id="check-finish" ref={headingRef} tabIndex={-1} className="text-lg font-semibold text-primary outline-none">
                        {unanswered.length ? `${plural(unanswered.length, "question doesn't", "questions don't")} have an answer yet` : "That's every question"}
                    </h2>
                    <p className="max-w-[60ch] text-md text-pretty text-tertiary">
                        {unanswered.length
                            ? "They'll count as terms to review, and you can practise them after. Or go back and answer them first."
                            : "Finish to see your score and the terms to review. Answers can't be changed after this."}
                    </p>
                    <div className="flex flex-wrap gap-3">
                        <Button size="lg" onClick={submit} isLoading={submitting} showTextWhileLoading iconLeading={Check}>
                            Finish the check
                        </Button>
                        {unanswered.length > 0 ? (
                            <Button size="lg" color="secondary" onClick={() => go(screens.indexOf(unanswered[0]))} isDisabled={submitting}>
                                Go to the first one
                            </Button>
                        ) : (
                            <Button size="lg" color="secondary" onClick={() => go(index)} isDisabled={submitting}>
                                Back to the questions
                            </Button>
                        )}
                    </div>
                    {submitError && (
                        <p role="alert" className="text-sm text-error-primary">
                            {submitError}
                        </p>
                    )}
                </section>
            ) : (
                <section className="mt-8" aria-labelledby="check-question">
                    <h2 id="check-question" ref={headingRef} tabIndex={-1} className="sr-only">
                        Question {index + 1} of {screens.length}
                    </h2>
                    {remoteOnly && (
                        <p className="mb-4 rounded-lg bg-secondary px-3 py-2 text-sm text-tertiary">
                            You answered this on another device. Answer again here to change it.
                        </p>
                    )}
                    <Question
                        key={screen.key}
                        item={screen.item}
                        entry={screen.entry}
                        response={responses[screen.key]}
                        onChange={(r) => change(screen.key, r)}
                        seed={`${attempt.id}:${screen.key}`}
                        bank={content.bank}
                        bySlug={content.dict.bySlug}
                    />
                </section>
            )}

            {!finishing && (
                <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-secondary pt-5">
                    {/* "Previous", not "Back": the shell's history arrow is already a button named Back. */}
                    <Button size="lg" color="secondary" iconLeading={ArrowLeft} onClick={() => go(index - 1)} isDisabled={index === 0}>
                        Previous
                    </Button>
                    {last ? (
                        <Button
                            size="lg"
                            onClick={() => {
                                void flush();
                                setFinishing(true);
                                moved.current = true;
                            }}
                        >
                            Finish the check
                        </Button>
                    ) : (
                        <Button size="lg" iconTrailing={ArrowRight} onClick={() => go(index + 1)}>
                            Next
                        </Button>
                    )}
                </div>
            )}
            <div className="mt-6">
                <Button href="/dictionary" color="link-gray" size="sm">
                    Leave and finish later
                </Button>
            </div>
        </>
    );
};

/**
 * "Saving…" and "Saved" are for the eye only: announcing them after every answer would talk
 * over the question. Only a failed save is announced.
 */
const SaveStatus = ({ state, onRetry }: { state: SaveState; onRetry: () => void }) => (
    <div className="flex items-center gap-2 text-sm text-tertiary">
        {state === "saving" && <span>Saving…</span>}
        {state === "saved" && (
            <>
                <Check className="size-4 text-fg-success-secondary" aria-hidden="true" />
                <span>Saved</span>
            </>
        )}
        {state === "error" && (
            <>
                <span aria-hidden="true">Not saved yet</span>
                <Button color="link-color" size="sm" onClick={onRetry}>
                    Try again
                </Button>
            </>
        )}
        <span role="status" className="sr-only">
            {state === "error" ? "Not saved yet. Your answers are kept in this browser." : ""}
        </span>
    </div>
);

/* ── The page ───────────────────────────────────────────────────── */

const TheCheck = ({ scrollRef }: { scrollRef: RefObject<HTMLDivElement | null> }) => {
    const session = useCheckSession();
    const [params] = useSearchParams();
    const requested: CheckMode = params.get("mode") === "missed" ? "missed" : "full";
    const [running, setRunning] = useState<CheckAttempt | null>(null);

    if (session.status !== "ready") {
        return (
            <>
                <PageTitle>The check</PageTitle>
                <div className="mt-6">
                    <SessionFallback session={session} />
                </div>
            </>
        );
    }

    if (running) return <Sitting key={running.id} attempt={running} content={session.content} userId={session.userId} scrollRef={scrollRef} />;
    return (
        <Intro content={session.content} history={session.history} userId={session.userId} requested={requested} reload={session.reload} onBegin={setRunning} />
    );
};

export const CheckScreen = () => {
    const scrollRef = useRef<HTMLDivElement>(null);
    return (
        <CheckPage scrollRef={scrollRef}>
            <TheCheck scrollRef={scrollRef} />
        </CheckPage>
    );
};
