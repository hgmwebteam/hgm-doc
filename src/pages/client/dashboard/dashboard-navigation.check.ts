/**
 * Self-check for journey completion as it is stored — the part that can corrupt a
 * client's recorded progress quietly if it ever drifts.
 *
 * Same no-framework pattern as its siblings: a plain assert script, no test runner, no new
 * dependency. Nothing imports it, so it costs nothing at runtime; `tsc -b` still type-checks
 * it because it lives under src/.
 *
 * Bundled rather than compiled file-by-file, because this module imports icons from an
 * ESM-only subpath that plain `tsc --module commonjs` output cannot require (the same
 * reason the tsc command written at the top of dashboard-model.check.ts no longer runs —
 * that one predates an aliased import it now pulls in). Run it:
 *   npx esbuild src/pages/client/dashboard/dashboard-navigation.check.ts --bundle \
 *     --platform=node --format=cjs --alias:@=./src --outfile=/tmp/hgm-check/check.cjs \
 *   && node /tmp/hgm-check/check.cjs
 */
import assert from "node:assert/strict";
import {
    JOURNEY_BAR,
    JOURNEY_STAGES,
    JOURNEY_STEPS,
    type JourneyStepId,
    isJourneyItemDone,
    journeyItemIds,
    journeyItemKey,
    toggleJourneyItemDone,
    toggleJourneyStepDone,
} from "./dashboard-navigation";

const tickable = JOURNEY_STEPS.filter((s) => s.itemsTickable);
assert.ok(tickable.length > 0, "no tickable steps left — delete this check if that is deliberate");

/* 1. Every tickable step's items carry an explicit id. The label fallback exists for the
      untickable lists; relying on it for a stored key means a copy edit silently loses a
      client's ticks. */
for (const step of tickable) {
    for (const item of step.items ?? []) {
        assert.ok(item.id, `tickable step "${step.id}" has an item without an id: "${item.label}"`);
    }
    const ids = journeyItemIds(step.id);
    assert.equal(new Set(ids).size, ids.length, `duplicate item ids in step "${step.id}"`);
}

/* 2. No item key can ever be read as a step id, or ticking a piece would finish a step. */
const stepIds = new Set<string>(JOURNEY_STEPS.map((s) => s.id));
for (const step of tickable) {
    for (const itemId of journeyItemIds(step.id)) {
        assert.ok(!stepIds.has(journeyItemKey(step.id, itemId)), `item key collides with a step id: ${journeyItemKey(step.id, itemId)}`);
    }
}

const FUNNEL: JourneyStepId = "funnel";
const items = journeyItemIds(FUNNEL);
const keys = items.map((id) => journeyItemKey(FUNNEL, id));
const allDone = (done: string[]) => items.every((id) => isJourneyItemDone(done, FUNNEL, id));

/* 3. A legacy row — the bare step id, ticked before the step was broken up — still reads
      as every piece done. This is the case that would visibly un-finish a step for a
      client who had already got there. */
assert.ok(allDone([FUNNEL]), "a legacy bare step id must still read as every item done");

/* 4. Unticking ONE piece of a legacy row leaves the other four ticked. Dropping the bare
      id on its own would untick all five. */
const afterOne = toggleJourneyItemDone([FUNNEL], FUNNEL, items[0]);
assert.ok(!afterOne.includes(FUNNEL), "the bare id must be expanded, not kept");
assert.equal(isJourneyItemDone(afterOne, FUNNEL, items[0]), false);
for (const id of items.slice(1)) assert.equal(isJourneyItemDone(afterOne, FUNNEL, id), true, `"${id}" must survive unticking a sibling`);

/* 5. Ticking every piece one by one is the same state the all-at-once shortcut writes. */
let oneByOne: string[] = [];
for (const id of items) oneByOne = toggleJourneyItemDone(oneByOne, FUNNEL, id);
assert.ok(allDone(oneByOne));
assert.deepEqual([...oneByOne].sort(), [...toggleJourneyStepDone([], FUNNEL)].sort());

/* 6. "Undo all" clears every key AND the legacy bare id — leaving either behind would
      read as done again on the next render. */
for (const start of [oneByOne, [FUNNEL], [FUNNEL, ...keys]]) {
    const cleared = toggleJourneyStepDone(start, FUNNEL);
    assert.equal(allDone(cleared), false, "undo all must clear the step");
    for (const id of items) assert.equal(isJourneyItemDone(cleared, FUNNEL, id), false);
}

/* 7. Neither reducer ever disturbs another step's progress. */
const other: JourneyStepId = "kickoff";
assert.ok(toggleJourneyItemDone([other], FUNNEL, items[0]).includes(other));
assert.ok(toggleJourneyStepDone([other], FUNNEL).includes(other));
assert.ok(toggleJourneyStepDone([other, ...keys], FUNNEL).includes(other));

/* 8. A step with no tickable items keeps the plain on/off behaviour it always had. */
assert.deepEqual(toggleJourneyStepDone([], other), [other]);
assert.deepEqual(toggleJourneyStepDone([other], other), []);

/* 9. Ticking a piece twice returns to where it started — no key left duplicated. */
const twice = toggleJourneyItemDone(toggleJourneyItemDone([], FUNNEL, items[1]), FUNNEL, items[1]);
assert.deepEqual(twice, []);

/* 10. Every journey step belongs to exactly one launch-meter stage. A step missing from
       JOURNEY_STAGES would quietly stop counting towards launch — the list below would
       still show it, and the bar would read 100% with work outstanding. */
{
    const placed = JOURNEY_STAGES.flatMap((stage) => stage.steps);
    assert.equal(new Set(placed).size, placed.length, "a step is in more than one launch-meter stage");
    for (const step of JOURNEY_STEPS) {
        assert.ok(placed.includes(step.id), `step "${step.id}" is in no launch-meter stage, so it can never count towards launch`);
    }
    for (const id of placed) {
        assert.ok(
            JOURNEY_STEPS.some((step) => step.id === id),
            `launch-meter stages name "${id}", which is not a journey step`,
        );
    }
}

/* 11. The last step is the one the rocket rides on, so it has to be the last stage's last
       step — otherwise the rocket lands mid-bar. */
{
    const last = JOURNEY_STEPS[JOURNEY_STEPS.length - 1].id;
    const lastStage = JOURNEY_STAGES[JOURNEY_STAGES.length - 1];
    assert.equal(lastStage.steps[lastStage.steps.length - 1], last, "the journey's last step must end the last stage");
}

/* 12. Every launch-meter cell names a real stage and real steps. The bar is declared apart
       from the step list on purpose, so a rename on either side would otherwise drop a cell
       or empty a stage with nothing failing. */
{
    const stages = new Set(JOURNEY_STAGES.map((stage) => stage.id));
    const stepIds = new Set(JOURNEY_STEPS.map((step) => step.id));
    const ids = JOURNEY_BAR.map((cell) => cell.id);
    assert.equal(new Set(ids).size, ids.length, "two launch-meter cells share an id");
    for (const cell of JOURNEY_BAR) {
        assert.ok(stages.has(cell.stage), `bar cell "${cell.id}" names stage "${cell.stage}", which is not a launch-meter stage`);
        assert.ok(cell.steps.length > 0, `bar cell "${cell.id}" names no steps, so it can never fill`);
        for (const id of cell.steps) {
            assert.ok(stepIds.has(id), `bar cell "${cell.id}" names step "${id}", which is not a journey step`);
        }
    }
}

/* 13. No step reaches the bar through two cells — it would be counted twice, and the bar
       would run ahead of the work. */
{
    const named = JOURNEY_BAR.flatMap((cell) => cell.steps);
    assert.equal(new Set(named).size, named.length, "a journey step is on the launch meter more than once");
}

/* 14. The bar's last cell is the one the rocket rides on, so it has to sit in the last
       stage — otherwise the rocket lands mid-bar. Its step is the journey's last, so the
       bar can never claim launch before the step list does. */
{
    const last = JOURNEY_BAR[JOURNEY_BAR.length - 1];
    assert.equal(last.stage, JOURNEY_STAGES[JOURNEY_STAGES.length - 1].id, "the bar's last cell must sit in the last stage");
    assert.deepEqual(last.steps, [JOURNEY_STEPS[JOURNEY_STEPS.length - 1].id], "the bar's last cell must be the journey's last step");
}

/* 15. Steps the bar leaves out are a deliberate, short list — not an accident. Anything
       else dropped from JOURNEY_BAR would silently stop counting towards launch. */
{
    const onBar = new Set(JOURNEY_BAR.flatMap((cell) => cell.steps));
    const off = JOURNEY_STEPS.filter((step) => !onBar.has(step.id)).map((step) => step.id);
    assert.deepEqual(off, ["chat"], `the launch meter drops ${JSON.stringify(off)}; only joining the chat is meant to be off it`);
}

console.log("dashboard-navigation.check: all assertions passed");
