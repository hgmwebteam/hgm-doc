/**
 * Self-check for client-stage.ts: which dashboard a client is sent to. The wrong answer
 * either hides a paying client's journey or drops an onboarding client onto a help centre
 * with nothing in it, so the matching and the status rule are pinned here.
 *
 * Same no-framework pattern as dashboard-access.check.ts. Run it:
 *   npx tsc src/pages/client/dashboard/client-stage.check.ts \
 *     src/pages/client/dashboard/client-stage.ts \
 *     src/pages/client/dashboard/dashboard-model.ts \
 *     src/pages/client/dashboard/website-setup.ts \
 *     --outDir /tmp/hgm-check --module commonjs --moduleResolution node \
 *     --target es2022 --skipLibCheck --esModuleInterop --types node \
 *   ; sed -i '' 's#@/pages/client/dashboard/#./#g' /tmp/hgm-check/*.js \
 *   ; node /tmp/hgm-check/client-stage.check.js
 *
 * client-stage.ts imports `@/lib/supabase` for the live fetch; the compiled check never
 * calls it, and the TS2307 for that alias is type-level noise. Ignore that line.
 */
import assert from "node:assert/strict";
import { clientRowMatches, pickClientRow, stageOf } from "@/pages/client/dashboard/client-stage";

// A link in any of the shapes the Edit Client dialog has been given.
assert.equal(clientRowMatches({ name: "x", link: "/enjoy-unique-stays-dashboard" }, "enjoy-unique-stays-dashboard"), true);
assert.equal(clientRowMatches({ name: "x", link: "/enjoy-unique-stays" }, "enjoy-unique-stays-dashboard"), true);
assert.equal(clientRowMatches({ name: "x", link: "https://hgmportal.com/enjoy-unique-stays-dashboard/" }, "enjoy-unique-stays-dashboard"), true);
assert.equal(clientRowMatches({ name: "x", link: "enjoy-unique-stays-dashboard?x=1" }, "enjoy-unique-stays-dashboard"), true);
// The short slug the visitor typed resolves the same way.
assert.equal(clientRowMatches({ name: "x", link: "/enjoy-unique-stays-dashboard" }, "enjoy-unique-stays"), true);
// No link: the name decides, slugified as the Create dialog does.
assert.equal(clientRowMatches({ name: "Enjoy Unique Stays", link: "" }, "enjoy-unique-stays-dashboard"), true);
assert.equal(clientRowMatches({ name: "Enjoy Unique Stays", link: null }, "enjoy-unique-stays-dashboard"), true);
// A different client never matches, by link or by name.
assert.equal(clientRowMatches({ name: "Flohom", link: "/flohom-dashboard" }, "enjoy-unique-stays-dashboard"), false);
// A link to some other page of theirs is not their dashboard.
assert.equal(clientRowMatches({ name: "Zed", link: "/enjoy-unique-stays-metapixel" }, "enjoy-unique-stays-dashboard"), false);

// The status rule: only "onboarding" keeps the journey.
assert.equal(stageOf({ name: "a", status: "onboarding" }), "onboarding");
assert.equal(stageOf({ name: "a", status: "Onboarding " }), "onboarding");
assert.equal(stageOf({ name: "a", status: "existing" }), "existing");
assert.equal(stageOf({ name: "a", status: "offboarding" }), "existing");
assert.equal(stageOf({ name: "a", status: "" }), "existing");
assert.equal(stageOf({ name: "a" }), "existing");
// No row at all is unknown, not existing: the page keeps what it had.
assert.equal(stageOf(null), null);

// The first matching row wins; none is null.
const rows = [
    { name: "Flohom", link: "/flohom-dashboard", status: "existing" },
    { name: "Testa", link: "/testa-dashboard", status: "onboarding" },
];
assert.equal(pickClientRow(rows, "testa-dashboard")?.name, "Testa");
assert.equal(pickClientRow(rows, "nobody-dashboard"), null);

console.log("client-stage.check: ok");
