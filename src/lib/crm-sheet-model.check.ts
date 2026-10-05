/**
 * Self-check for the CRM sheet mirror: a save pushes exactly the cells it changed, and nothing
 * on a brand-new row. Same no-framework pattern as its siblings. Run it:
 *   npx esbuild src/lib/crm-sheet-model.check.ts --bundle --platform=node --format=cjs \
 *     --alias:@=./src --outfile=/tmp/hgm-check/crm.cjs && node /tmp/hgm-check/crm.cjs
 */
import assert from "node:assert/strict";
import type { DashboardContent } from "@/lib/supabase";
import { crmCells, crmChanges } from "./crm-sheet-model";

type Content = Partial<DashboardContent>;
const row = (journey_done: string[], hosts = ""): Content => ({ journey_done, foundation: { hosts } as DashboardContent["foundation"] });

// Fresh row: everything at its "not yet" value.
assert.deepEqual(crmCells(row([])), {
    "Brand Assets": "Not Yet Gathered",
    "Onboarding Call": "Incomplete",
    "Master Brand Document": "Incomplete",
    "Canva Brand Kit": "Incomplete",
});

// One section filled ⇒ In Progress; the AM's tick ⇒ Complete regardless.
assert.equal(crmCells(row([], "Two sisters"))["Master Brand Document"], "In Progress");
assert.equal(crmCells(row(["masterdoc"]))["Master Brand Document"], "Complete");

// Only what changed is pushed — an unrelated save pushes nothing.
assert.deepEqual(crmChanges(row(["call"]), row(["call"])), {});
assert.deepEqual(crmChanges(row([]), row(["call"])), { "Onboarding Call": "Complete" });
// Unticking is a change too.
assert.deepEqual(crmChanges(row(["resources"]), row([])), { "Brand Assets": "Not Yet Gathered" });
// No previous row ⇒ nothing to report.
assert.deepEqual(crmChanges(null, row(["call", "brandkit"])), {});

console.log("crm-sheet-model.check: ok");
