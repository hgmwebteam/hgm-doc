/**
 * Self-check for revealCheck — what the "Show to client?" dialog lists as still empty.
 *
 * Plain assert script, like the other *.check.ts files here. Run it:
 *   npx --yes tsx --tsconfig tsconfig.app.json src/pages/client/dashboard/reveal-check.check.ts
 */
import assert from "node:assert/strict";
import { createDefaultContent } from "@/pages/client/dashboard/dashboard-model";
import { FOUNDATION_SECTIONS } from "@/pages/client/dashboard/master-brand-document";
import { revealCheck } from "@/pages/client/dashboard/reveal-check";

const fresh = createDefaultContent("acme");

// A brand-new client copy: everything is empty except Website links, whose seeded "Home"
// row foundationProgress already counts as filled. The dialog follows that model on
// purpose, so it always agrees with the page's own "x of 11" counter and rail ticks.
const mb = revealCheck("foundation", fresh);
assert.ok(mb);
assert.equal(mb.total, 11);
assert.deepEqual(
    mb.empty,
    FOUNDATION_SECTIONS.filter((s) => s.id !== "links").map((s) => s.label),
);
assert.deepEqual(revealCheck("brand", fresh)?.empty, ["Palette is still the template", "No fonts chosen", "No logo uploaded"]);

// Filling a section drops it from the list, in reading order.
const some = { ...fresh, foundation: { ...fresh.foundation!, hosts: "Sam and Jo", uvp: "Treehouses an hour from Austin" } };
const after = revealCheck("foundation", some)!.empty;
assert.ok(!after.includes("About the hosts") && !after.includes("Unique value proposition"));
assert.equal(after.length, 8);
assert.equal(after[0], "About the properties");

// A finished Brand Kit lists nothing.
const kit = {
    ...fresh,
    brand: { ...fresh.brand, colors: [{ name: "Forest", hex: "#2C302C" }], fonts: "Playfair Display", logos: [{ name: "Primary", url: "data:," }] },
} as typeof fresh;
assert.deepEqual(revealCheck("brand", kit)?.empty, []);

// Sections without a completeness check get the plain confirmation.
assert.equal(revealCheck("landing", fresh), null);

console.log("reveal-check: ok");
