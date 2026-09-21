/**
 * Self-check for the suggestion-mode model — the guarantee AM review rests on:
 * a suggestion applies exactly where its key points, applies nowhere when the key is
 * unknown or its row was deleted, and never mutates the document it reads.
 *
 * Same no-framework pattern as dashboard-model.check.ts. Run it:
 *   npx tsc src/pages/client/dashboard/suggestions.check.ts \
 *     --outDir /tmp/hgm-check --module commonjs --moduleResolution node \
 *     --target es2022 --skipLibCheck --esModuleInterop \
 *     --baseUrl . --paths '{"@/*":["src/*"]}'
 *   ; node -r /tmp/hgm-check/alias.js /tmp/hgm-check/pages/client/dashboard/suggestions.check.js
 *
 * `--paths` only teaches the COMPILER the `@/` alias; node still needs it at require time,
 * because dashboard-model.ts pulls in `@/pages/client/dashboard/website-setup` for real
 * (not as a type). An `alias.js` that rewrites `@/x` to `<outDir>/x` in
 * `Module._resolveFilename` is enough — or run it through tsx/vite-node, which resolve
 * tsconfig paths themselves.
 */
import assert from "node:assert/strict";
import { DEFAULT_FOUNDATION, type Foundation, emptyFavorite, emptyFocusProperty, emptyPersona, emptyWebsiteLink } from "./dashboard-model";
import {
    FLOW_FEEDBACK_KEY,
    LANDING_FEEDBACK_KEY,
    LIST_COLUMNS,
    REELS_FEEDBACK_KEY,
    SCALAR_KEYS,
    STORIES_FEEDBACK_KEY,
    applySuggestion,
    isFlowFeedbackKey,
    isLandingFeedbackKey,
    isReelsFeedbackKey,
    isSectionFeedbackKey,
    isStoriesFeedbackKey,
    labelForKey,
    valueForKey,
} from "./suggestions-model";

const base = (over: Partial<Foundation> = {}): Foundation => ({ ...DEFAULT_FOUNDATION, ...over });

/* 1. Every scalar key exists on the foundation and is a string — a typo here would
      make a whole field silently unsuggestible. */
for (const k of SCALAR_KEYS) {
    assert.equal(typeof DEFAULT_FOUNDATION[k], "string", `SCALAR_KEYS entry "${k}" must be a string field on Foundation`);
}

/* 2. Every list name is a real array field. */
for (const list of Object.keys(LIST_COLUMNS) as (keyof typeof LIST_COLUMNS)[]) {
    assert.ok(Array.isArray(DEFAULT_FOUNDATION[list]), `LIST_COLUMNS entry "${list}" must be an array field on Foundation`);
}

/* 3. A scalar round-trips. */
{
    const f = base();
    const patch = applySuggestion(f, "hosts", "Two sisters who inherited the lodge.");
    assert.ok(patch);
    assert.equal(patch.hosts, "Two sisters who inherited the lodge.");
    assert.equal(valueForKey({ ...f, ...patch }, "hosts"), "Two sisters who inherited the lodge.");
}

/* 4. A tagline slot round-trips and touches only its own index. */
{
    const f = base({ taglines: ["a", "b", "c"] });
    const patch = applySuggestion(f, "taglines.1", "Stay wild");
    assert.ok(patch);
    assert.deepEqual(patch.taglines, ["a", "Stay wild", "c"]);
    assert.equal(valueForKey({ ...f, ...patch }, "taglines.1"), "Stay wild");
}

/* 5. One row-column per list round-trips, keyed by the row's stable id. */
{
    const persona = { ...emptyPersona("Primary"), id: "p1" };
    const focus = { ...emptyFocusProperty(), id: "f1" };
    const rest = { ...emptyFavorite(), id: "r1" };
    const link = { ...emptyWebsiteLink("Home"), id: "w1" };
    const f = base({ personas: [persona], focusProperties: [focus], restaurants: [rest], websiteLinks: [link] });

    for (const [key, expect] of [
        ["personas.p1.age", "35–44"],
        ["focusProperties.f1.description", "A-frame over the creek."],
        ["restaurants.r1.name", "Joe's Diner"],
        ["websiteLinks.w1.url", "https://example.com"],
    ] as const) {
        const patch = applySuggestion(f, key, expect);
        assert.ok(patch, `apply failed for ${key}`);
        assert.equal(valueForKey({ ...f, ...patch }, key), expect, `round-trip failed for ${key}`);
    }
}

/* 6. Unknown keys and deleted rows apply to NOTHING. */
{
    const f = base({ personas: [{ ...emptyPersona("Primary"), id: "p1" }] });
    assert.equal(applySuggestion(f, "notAField", "x"), null);
    assert.equal(applySuggestion(f, "taglines.9", "x"), null);
    assert.equal(applySuggestion(f, "personas.p1.notACol", "x"), null);
    assert.equal(applySuggestion(f, "personas.deleted-row.age", "x"), null, "a deleted row must not apply");
    assert.equal(applySuggestion(f, "client_visible.0.x", "x"), null, "keys outside the whitelist must not apply");
    assert.equal(valueForKey(f, "personas.deleted-row.age"), null);
}

/* 7. applySuggestion never mutates its input. */
{
    const f = base({ taglines: ["a", "b", "c"], restaurants: [{ id: "r1", name: "Old", description: "" }] });
    const snapshot = JSON.stringify(f);
    applySuggestion(f, "taglines.0", "changed");
    applySuggestion(f, "restaurants.r1.name", "changed");
    applySuggestion(f, "hosts", "changed");
    assert.equal(JSON.stringify(f), snapshot, "input foundation must be untouched");
}

/* 8. Labels are human-readable and survive missing rows. */
{
    const f = base({ restaurants: [{ id: "r1", name: "Joe's Diner", description: "" }] });
    assert.equal(labelForKey(f, "uvp"), "Unique value proposition");
    assert.equal(labelForKey(f, "taglines.2"), "Tagline 3");
    assert.ok(labelForKey(f, "restaurants.r1.name").includes("Joe's Diner"));
    assert.equal(labelForKey(f, "personas.gone.howTheyBook").includes("How they book"), true);
}

/* 9. Section feedback keys: one family each, never each other's, never a document edit.
      The prefixes are what the Netlify function gates visibility on and what the team's
      lists filter by, so an overlap would show one section's notes under another — and
      "pinnedStories." vs Pinned Posts' "pinnedposts." is exactly the pair that could. */
{
    const families = [
        { key: FLOW_FEEDBACK_KEY, mine: isFlowFeedbackKey },
        { key: LANDING_FEEDBACK_KEY, mine: isLandingFeedbackKey },
        { key: REELS_FEEDBACK_KEY, mine: isReelsFeedbackKey },
        { key: STORIES_FEEDBACK_KEY, mine: isStoriesFeedbackKey },
    ];
    const tests = families.map((f) => f.mine);

    for (const { key, mine } of families) {
        assert.ok(mine(key), `${key} must belong to its own family`);
        assert.ok(isSectionFeedbackKey(key), `${key} must count as section feedback`);
        assert.equal(tests.filter((t) => t(key)).length, 1, `${key} matches more than one family`);
        // A note is never applied to the document — done or dismissed is the whole outcome.
        assert.equal(applySuggestion(base(), key, "a note"), null, `${key} must not apply to the foundation`);
        assert.equal(valueForKey(base(), key), null, `${key} must not resolve to a field`);
    }

    // Pinned POSTS keys are a separate family, read beside their own section.
    assert.equal(isSectionFeedbackKey("pinnedposts.abc123.feedback"), false, "pinned post keys must not read as section feedback");
    assert.equal(isStoriesFeedbackKey("pinnedposts.abc123.feedback"), false, "pinned post keys must not read as pinned stories");
    assert.equal(isSectionFeedbackKey("hosts"), false, "a document key must not read as feedback");
}

console.log("suggestions.check: all assertions passed");
