/**
 * Self-check for tools-results-model.ts: the tools check's score, its tools to refresh, and what
 * this browser keeps. The scoring is pinned on hand-made results; boardResult on a real drawn run.
 *
 * Run it from the repo root:
 *   npx esbuild src/pages/team/dictionary/tools/tools-results-model.check.ts --bundle \
 *     --platform=node --format=cjs --alias:@=./src --outfile=/tmp/hgm-check/tools-results-model.cjs \
 *     --log-level=warning && node /tmp/hgm-check/tools-results-model.cjs
 */
import assert from "node:assert";
import cardsJson from "@/data/industry-acumen-sort-cards.json";
import { seededRandom } from "@/pages/team/dictionary/check/check-model";
import { grade, progressLine } from "@/pages/team/dictionary/check/check-score";
import { SUITE, type SortData, drawRun, gameStages, markBoard, moveCard, newBoard } from "@/pages/team/dictionary/tools/sort-model";
import {
    type BoardResult,
    EMPTY_RECORD,
    MAX_RUNS,
    TOOLS_NOUN,
    boardResult,
    clearToolsRecord,
    finishRun,
    parseRecord,
    readToolsRecord,
    runMissed,
    runScore,
    toRefresh,
    writeToolsRecord,
} from "@/pages/team/dictionary/tools/tools-results-model";

const pass = (what: string) => console.log(`  ok  ${what}`);
const section = (name: string) => console.log(`\n${name}`);
const at = new Date("2026-10-06T12:00:00Z");

const vendors = (marks: [string, boolean][]): BoardResult => ({ kind: "vendors", marks: marks.map(([vendor, right]) => ({ vendor, right })) });
const suite = (vendor: string, right: number, total: number): BoardResult => ({ kind: "jobs", vendor, right, total });

section("The score");
{
    assert.equal(runScore([]), 0, "nothing played scores 0");
    assert.equal(
        runScore([
            vendors([
                ["A", true],
                ["B", true],
                ["C", false],
                ["D", true],
            ]),
        ]),
        75,
    );
    // 9 of 12 cards, then a suite with 5 of 7 jobs: (9 + 5/7) / 13 = 74.7… → 75.
    const twelve = vendors(Array.from({ length: 12 }, (_, i) => [`V${i}`, i < 9] as [string, boolean]));
    assert.equal(runScore([twelve, suite("S", 5, 7)]), 75);
    assert.equal(runScore([suite("S", 7, 7), suite("T", 0, 8)]), 50, "each suite is one point, shared over its jobs");
    assert.equal(runScore([suite("Empty", 0, 0)]), 0, "a suite with no jobs counts for nothing");
    pass("a point a card, a point a suite shared over its jobs, rounded half up");
}

section("What was missed");
{
    const results = [
        vendors([
            ["Mews", true],
            ["Oaky", false],
            ["Kipsu", false],
        ]),
        suite("Mews", 5, 6),
        suite("Cloudbeds", 8, 8),
    ];
    assert.deepEqual(runMissed(results), ["Mews", "Oaky", "Kipsu"], "in the order shown, the later board winning: Mews' suite overrides its card");
    const record = finishRun(EMPTY_RECORD, results, at);
    assert.deepEqual(record.status, { Mews: false, Oaky: false, Kipsu: false, Cloudbeds: true });
    assert.deepEqual(toRefresh(record), ["Kipsu", "Mews", "Oaky"], "A to Z");
    assert.equal(record.runs[0].refresh, 3);
    assert.equal(record.runs[0].grade, grade(record.runs[0].score), "graded on the check's own scale");

    // A later run shows Oaky again, right this time: it leaves the list; vendors it didn't show keep their status.
    const later = finishRun(
        record,
        [
            vendors([
                ["Oaky", true],
                ["Nor1", true],
            ]),
        ],
        at,
    );
    assert.deepEqual(toRefresh(later), ["Kipsu", "Mews"]);
    assert.equal(later.runs.length, 2);
    assert.equal(later.runs[0].score, 100);
    assert.equal(
        progressLine(
            { score: later.runs[1].score, missed: later.runs[1].refresh },
            { score: later.runs[0].score, missed: later.runs[0].refresh },
            TOOLS_NOUN,
        )?.endsWith("1 fewer tool to refresh"),
        true,
    );
    pass("latest result per vendor; the list shrinks as they come back right; vendors not shown keep theirs");

    const replaced = finishRun(later, [vendors([["Oaky", false]])], at, true);
    assert.equal(replaced.runs.length, 2, "checking the last board again replaces the run it saved");
    assert.deepEqual(toRefresh(replaced), ["Kipsu", "Mews", "Oaky"]);

    let many = EMPTY_RECORD;
    for (let i = 0; i < MAX_RUNS + 5; i++) many = finishRun(many, [vendors([["A", i % 2 === 0]])], at);
    assert.equal(many.runs.length, MAX_RUNS, `only the latest ${MAX_RUNS} runs are kept`);
    pass("a re-checked last board replaces its run; runs capped");
}

section("progressLine, for tools");
{
    assert.equal(progressLine({ score: 60, missed: 5 }, { score: 69, missed: 3 }, TOOLS_NOUN), "Up 9% since last time · 2 fewer tools to refresh");
    assert.equal(progressLine({ score: 70, missed: 2 }, { score: 70, missed: 3 }, TOOLS_NOUN), "The same score as last time · 1 more tool to refresh");
    assert.equal(
        progressLine({ score: 60, missed: 5 }, { score: 69, missed: 3 }),
        "Up 9% since last time · 2 fewer terms to review",
        "the terms check's words are unchanged",
    );
    pass("tools to refresh, and the terms check's own line as it was");
}

section("A board's result, from a real drawn run");
{
    const data = drawRun(cardsJson as unknown as SortData, seededRandom("tools-results"));
    const stages = gameStages(data);
    const first = stages[0];
    assert.ok(first.kind === "vendors");
    // Every card into its own box: all right.
    let board = newBoard(first, seededRandom("board"));
    for (const c of first.round.cards) board = moveCard(board, c.vendor, c.box, first.round.per_box).board;
    const right = boardResult(first, markBoard(first, board));
    assert.ok(right.kind === "vendors" && right.marks.length === 12 && right.marks.every((m) => m.right));
    // Left in the tray: wrong.
    const empty = boardResult(first, markBoard(first, newBoard(first, seededRandom("board"))));
    assert.ok(empty.kind === "vendors" && empty.marks.every((m) => !m.right));

    const suiteStage = stages.find((s) => s.kind === "jobs")!;
    assert.ok(suiteStage.kind === "jobs");
    let jobs = newBoard(suiteStage, seededRandom("suite"));
    for (const j of suiteStage.suite.does) jobs = moveCard(jobs, j, SUITE, null).board;
    const all = boardResult(suiteStage, markBoard(suiteStage, jobs));
    assert.deepEqual(all, {
        kind: "jobs",
        vendor: suiteStage.suite.vendor,
        right: all.kind === "jobs" ? all.total : -1,
        total: suiteStage.suite.does.length + suiteStage.suite.distractors.length,
    });
    pass("twelve cards, right in their own boxes and wrong in the tray; a suite with exactly its jobs in is all right");
}

section("What this browser keeps");
{
    assert.deepEqual(parseRecord(null), EMPTY_RECORD);
    assert.deepEqual(parseRecord({ version: 2, status: {}, runs: [] }), EMPTY_RECORD, "an unknown version is ignored");
    assert.deepEqual(parseRecord("nonsense"), EMPTY_RECORD);
    const good = finishRun(EMPTY_RECORD, [vendors([["A", false]])], at);
    assert.deepEqual(parseRecord(JSON.parse(JSON.stringify(good))), good, "a saved record reads back the same");
    assert.deepEqual(
        parseRecord({ version: 1, status: { A: false, B: "yes" }, runs: [good.runs[0], { at: 1 }] }),
        { version: 1, status: { A: false }, runs: [good.runs[0]] },
        "bad entries are dropped, good ones kept",
    );
    // No localStorage here (node), as in a browser that blocks it: nothing throws.
    assert.deepEqual(readToolsRecord(), EMPTY_RECORD);
    assert.equal(writeToolsRecord(good), false);
    assert.equal(clearToolsRecord(), false);
    pass("junk reads as empty; a round trip is exact; blocked storage reads empty and never throws");
}

console.log("\ntools-results-model: PASS");
