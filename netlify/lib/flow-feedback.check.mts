/**
 * Self-check for the row-matching rule. Run it:
 *   node --experimental-strip-types netlify/lib/flow-feedback.check.mts
 *
 * The case that matters is the second fixture: a client whose `position` values repeat.
 * That shape is real, not hypothetical — it is what one live client's nine emails look
 * like — and matching on position instead of week silently mis-files two of nine notes.
 */
import assert from "node:assert/strict";
import { type FlowEmailRow, flowSlot, pickFlowEmailRow } from "./flow-feedback.mts";

/* 1. Keys → slot. Anything that isn't a welcome-flow email is nobody's business here. */
assert.equal(flowSlot("welcomeFlow.0"), 0);
assert.equal(flowSlot("welcomeFlow.8"), 8);
assert.equal(flowSlot("welcomeFlow.9"), null, "only nine emails exist");
assert.equal(flowSlot("welcomeFlow.all"), null, "the legacy whole-flow note names no email");
assert.equal(flowSlot("welcomeFlow.-1"), null);
assert.equal(flowSlot("landingPage.all"), null);
assert.equal(flowSlot("hosts"), null, "a document field is not feedback");

/* 2. The tidy client: week and position agree, so either would have worked. */
const tidy: FlowEmailRow[] = Array.from({ length: 9 }, (_, i) => ({ id: `t${i + 1}`, week: i + 1, position: i + 1 }));
for (let slot = 0; slot < 9; slot++) assert.equal(pickFlowEmailRow(tidy, slot)?.id, `t${slot + 1}`);

/* 3. The client that forced this rule: nine emails, six distinct positions, out of order.
      Every note must still land on its own row. */
const messy: FlowEmailRow[] = [
    { id: "w1", week: 1, position: 2 },
    { id: "w2", week: 2, position: 3 },
    { id: "w3", week: 3, position: 1 },
    { id: "w4", week: 4, position: 4 },
    { id: "w5", week: 5, position: 4 },
    { id: "w6", week: 6, position: 5 },
    { id: "w7", week: 7, position: 5 },
    { id: "w8", week: 8, position: 6 },
    { id: "w9", week: 9, position: 6 },
];
for (let slot = 0; slot < 9; slot++) assert.equal(pickFlowEmailRow(messy, slot)?.id, `w${slot + 1}`, `email ${slot + 1} landed on the wrong row`);

/* 3b. …and prove the rejected rule really would have broken it, so this check can't be
       "fixed" one day by going back to position. */
const byPosition = (rows: FlowEmailRow[], slot: number) => rows.filter((r) => r.position === slot + 1);
assert.equal(byPosition(messy, 3).length, 2, "position 4 holds two emails — matching on it is ambiguous");

/* 4. Rows written before `week` existed fall back to position. */
const legacy: FlowEmailRow[] = [
    { id: "p1", week: null, position: 1 },
    { id: "p2", week: null, position: 2 },
];
assert.equal(pickFlowEmailRow(legacy, 1)?.id, "p2");

/* 5. No row for that email yet, and no rows at all — both are "nothing to write", never a throw. */
assert.equal(pickFlowEmailRow(legacy, 5), null);
assert.equal(pickFlowEmailRow([], 0), null);

console.log("flow-feedback.check: all assertions passed");
