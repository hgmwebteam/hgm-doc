import { type MissedNoun, grade, roundPct } from "@/pages/team/dictionary/check/check-score";
import { type Mark, type Stage, stageCards } from "@/pages/team/dictionary/tools/sort-model";

/**
 * The tools check's results: what a finished run of Sort the stack (/dictionary/tools/review)
 * leaves behind, and the tools to refresh on. No React, so tools-results-model.check.ts can pin
 * all of it; the page is tools-results-screen.tsx.
 *
 * Kept in this browser only (Kyle, 6 Oct 2026): the session's slide promises "Nothing leaves your
 * device", and team-password visitors, who have no Supabase session, can use it too. So it's per
 * browser, and a reset clears this browser's record. Like the terms check, it's for learning: the
 * grade is the same Ontario scale, for fun, and never a pass mark.
 *
 * What counts: each vendor card in rounds 1 and 2 is one point, right or not; each round 3 suite is
 * one point, shared out over its jobs (5 of 7 jobs right is 5/7 of a point). A vendor's status is
 * its latest result (a suite is right only with every job right), and the tools to refresh are the
 * vendors whose latest result wasn't right. A vendor named twice in one run (Mews, a card and a
 * suite) takes the later board's result.
 */

/** Where a finished tools check's results are (tools-results-screen.tsx). */
export const TOOLS_RESULTS = "/dictionary/tools/review/results";

/** One checked board, as "Check my stack" left it. */
export type BoardResult = { kind: "vendors"; marks: { vendor: string; right: boolean }[] } | { kind: "jobs"; vendor: string; right: number; total: number };

/** A board's result from its marks (sort-model's markBoard). */
export const boardResult = (stage: Stage, marks: ReadonlyMap<string, Mark>): BoardResult => {
    if (stage.kind === "vendors")
        return { kind: "vendors", marks: stage.round.cards.map((c) => ({ vendor: c.vendor, right: marks.get(c.vendor)?.right === true })) };
    const jobs = stageCards(stage);
    return { kind: "jobs", vendor: stage.suite.vendor, right: jobs.filter((j) => marks.get(j)?.right === true).length, total: jobs.length };
};

/** One finished run. `refresh` is how many tools were left to refresh after it, for "2 fewer tools to refresh". */
export type ToolRun = { at: string; score: number; grade: string; missed: string[]; refresh: number };

/** Everything kept in this browser. `status`: vendor name → right at its latest showing. `runs`: newest first. */
export type ToolsRecord = { version: 1; status: Record<string, boolean>; runs: ToolRun[] };

export const EMPTY_RECORD: ToolsRecord = { version: 1, status: {}, runs: [] };

/** How many runs are kept: enough for "since last time", small enough to stay well inside storage. */
export const MAX_RUNS = 20;

/** The run's score, a whole percent: each vendor card a point, each suite a point shared over its jobs. */
export const runScore = (results: readonly BoardResult[]): number => {
    let points = 0;
    let right = 0;
    for (const r of results) {
        if (r.kind === "vendors") {
            points += r.marks.length;
            right += r.marks.filter((m) => m.right).length;
        } else if (r.total > 0) {
            points += 1;
            right += r.right / r.total;
        }
    }
    return points ? roundPct((right * 100) / points) : 0;
};

/** Each vendor's result in this run, in the order it was shown: the later board wins for a name shown twice. */
const runStatus = (results: readonly BoardResult[]): Map<string, boolean> => {
    const status = new Map<string, boolean>();
    for (const r of results) {
        if (r.kind === "vendors") for (const m of r.marks) status.set(m.vendor, m.right);
        else status.set(r.vendor, r.right === r.total);
    }
    return status;
};

/** The vendors this run got wrong, in the order they were shown. */
export const runMissed = (results: readonly BoardResult[]): string[] => [...runStatus(results)].filter(([, right]) => !right).map(([vendor]) => vendor);

/** The tools to refresh on: every vendor whose latest result wasn't right, A to Z. */
export const toRefresh = (record: ToolsRecord): string[] =>
    Object.entries(record.status)
        .filter(([, right]) => !right)
        .map(([vendor]) => vendor)
        .sort((a, b) => a.localeCompare(b));

/**
 * The record after a finished run. `replacing`: the run's last board was checked again (Try
 * again, then Check my stack), so this replaces the run it saved a moment ago rather than adding a
 * second one. Its statuses are applied again, which is the same thing: the latest result wins.
 */
export const finishRun = (record: ToolsRecord, results: readonly BoardResult[], at: Date, replacing = false): ToolsRecord => {
    const status = { ...record.status, ...Object.fromEntries(runStatus(results)) };
    const score = runScore(results);
    const next: ToolsRecord = { version: 1, status, runs: [] };
    const run: ToolRun = { at: at.toISOString(), score, grade: grade(score), missed: runMissed(results), refresh: toRefresh({ ...next, status }).length };
    return { ...next, runs: [run, ...(replacing ? record.runs.slice(1) : record.runs)].slice(0, MAX_RUNS) };
};

/** progressLine's words for the tools check: "Up 9% since last time · 2 fewer tools to refresh". */
export const TOOLS_NOUN: MissedNoun = { one: "tool", many: "tools", tail: "to refresh" };

/** Encouragement for an R, never a verdict: the tools check's R_LINE. */
export const TOOLS_R_LINE = "These names take a few rounds. Practise the ones below and try again.";

/** A record from storage, trusting nothing about its shape: anything unreadable is an empty record. */
export const parseRecord = (raw: unknown): ToolsRecord => {
    if (!raw || typeof raw !== "object") return EMPTY_RECORD;
    const r = raw as Partial<ToolsRecord>;
    if (r.version !== 1 || !r.status || typeof r.status !== "object" || !Array.isArray(r.runs)) return EMPTY_RECORD;
    const status = Object.fromEntries(Object.entries(r.status).filter((e): e is [string, boolean] => typeof e[1] === "boolean"));
    const runs = r.runs
        .filter(
            (x): x is ToolRun =>
                !!x &&
                typeof x.at === "string" &&
                typeof x.score === "number" &&
                typeof x.grade === "string" &&
                typeof x.refresh === "number" &&
                Array.isArray(x.missed) &&
                x.missed.every((m) => typeof m === "string"),
        )
        .slice(0, MAX_RUNS);
    return { version: 1, status, runs };
};

/* ── This browser's copy ────────────────────────────────────────── */

const KEY = "hgm_tools_check";

/** The record kept in this browser, or an empty one (nothing yet, storage blocked, or unreadable). */
export const readToolsRecord = (): ToolsRecord => {
    try {
        const raw = localStorage.getItem(KEY);
        return raw ? parseRecord(JSON.parse(raw)) : EMPTY_RECORD;
    } catch {
        return EMPTY_RECORD;
    }
};

/** Saves the record; false when the browser won't keep it (private window, storage blocked or full). */
export const writeToolsRecord = (record: ToolsRecord): boolean => {
    try {
        localStorage.setItem(KEY, JSON.stringify(record));
        return true;
    } catch {
        return false;
    }
};

/** "Reset your tools results": forgets every run and status in this browser. */
export const clearToolsRecord = (): boolean => {
    try {
        localStorage.removeItem(KEY);
        return true;
    } catch {
        return false;
    }
};
