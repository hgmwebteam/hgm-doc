/**
 * Self-check for the automation-branding model — the two things that would quietly corrupt
 * an automation's input: a field list that drifts from the table's columns, and a prefill
 * that overwrites a value someone chose.
 *
 * Same no-framework pattern as suggestions.check.ts. Run it:
 *   npx tsc src/pages/client/dashboard/automation-branding.check.ts \
 *     src/pages/client/dashboard/automation-branding.ts \
 *     --outDir /tmp/hgm-check --module commonjs --moduleResolution node \
 *     --target es2022 --skipLibCheck --esModuleInterop --types node \
 *   ; node /tmp/hgm-check/automation-branding.check.js
 */
import assert from "node:assert/strict";
import {
    AUTOMATION_FIELDS,
    AUTOMATION_GROUPS,
    type AutomationBranding,
    EMPTY_AUTOMATION_BRANDING,
    automationBrandingFilled,
    isAutomationBrandingEmpty,
    mergeAutomationBranding,
    prefillAutomationBranding,
} from "./automation-branding";

/** The columns `automation_branding` actually has, copied from the migration. A field the
 *  card renders but the table lacks is dropped on save with no error; a column the card
 *  never renders can only ever be filled by hand in Supabase. Both are silent, so they are
 *  asserted here rather than discovered by an automation reading an empty string. */
const TABLE_COLUMNS = [
    "reel_primary_font",
    "reel_primary_font_size",
    "reel_secondary_font_size",
    "reel_font_weight",
    "reel_secondary_font",
    "carousel_story_title_font",
    "carousel_story_body_font",
    "story_background_color",
    "story_accent_color",
    "story_font_color",
    "email_background_color",
    "email_button_color",
    "email_secondary_color",
    "email_contact_info",
    "email_footer_text",
    "email_instagram_link",
    "email_facebook_link",
    "email_tiktok_link",
    "email_website_link",
    "email_contact_number",
].sort();

/* 1. Field list ↔ table columns, exactly. */
const rendered = AUTOMATION_FIELDS.map((f) => f.key as string).sort();
assert.deepEqual(rendered, TABLE_COLUMNS, "the card's fields and the table's columns have drifted apart");
assert.equal(new Set(rendered).size, rendered.length, "a field is listed twice — the second input would shadow the first");
assert.equal(AUTOMATION_GROUPS.flatMap((g) => g.fields).length, AUTOMATION_FIELDS.length);

/* 2. An empty row is every field, empty — never a partial object an automation reads as
      undefined. */
assert.deepEqual(Object.keys(EMPTY_AUTOMATION_BRANDING).sort(), TABLE_COLUMNS);
assert.ok(isAutomationBrandingEmpty(EMPTY_AUTOMATION_BRANDING));
assert.equal(automationBrandingFilled(EMPTY_AUTOMATION_BRANDING), 0);

/* 3. A row read back from Supabase is coerced field by field: nulls become "", and a
      column that arrives missing doesn't leave the property undefined. */
const fromDb = mergeAutomationBranding({ reel_primary_font: "Advercase", story_accent_color: null, email_contact_number: 5550000 } as never);
assert.equal(fromDb.reel_primary_font, "Advercase");
assert.equal(fromDb.story_accent_color, "", "null must read as empty, not the string 'null'");
assert.equal(fromDb.email_contact_number, "5550000");
assert.equal(fromDb.email_facebook_link, "");
assert.equal(automationBrandingFilled(fromDb), 2);

/* 4. Prefill fills blanks from the kit… */
const kit = {
    colors: [
        { name: "Primary", hex: "#8dbc5f" },
        { name: "Secondary", hex: "#17240f" },
        { name: "Accent", hex: "#de9c31" },
        { name: "Neutral", hex: "#faf7f0" },
    ],
    fonts: "Advercase, Cormorant Garamond",
    instagramUrl: "https://www.instagram.com/example/",
    websiteUrl: "https://example.com/",
    brandBio: "A serene escape in the hills.",
};
const filled = prefillAutomationBranding(EMPTY_AUTOMATION_BRANDING, kit);
assert.equal(filled.reel_primary_font, "Advercase");
assert.equal(filled.reel_secondary_font, "Cormorant Garamond");
assert.equal(filled.carousel_story_title_font, "Advercase");
assert.equal(filled.story_background_color, "#17240f", "the dark colour backs a story");
assert.equal(filled.story_accent_color, "#8dbc5f");
assert.equal(filled.story_font_color, "#faf7f0", "text on the dark background is the pale colour");
assert.equal(filled.email_button_color, "#8dbc5f");
assert.equal(filled.email_secondary_color, "#de9c31");
assert.equal(filled.email_website_link, "https://example.com/");
assert.equal(filled.email_footer_text, "A serene escape in the hills.");
/* …and leaves alone the ones the kit can't know. */
assert.equal(filled.reel_primary_font_size, "", "the kit has no idea what size a reel headline is");
assert.equal(filled.email_facebook_link, "");

/* 5. …and NEVER overwrites a value a person chose. This is the whole reason prefill is a
      button and not an effect. */
const chosen: AutomationBranding = { ...filled, story_background_color: "#000000", reel_primary_font: "Castio", email_footer_text: "Hand-written footer." };
const again = prefillAutomationBranding(chosen, kit);
assert.equal(again.story_background_color, "#000000");
assert.equal(again.reel_primary_font, "Castio");
assert.equal(again.email_footer_text, "Hand-written footer.");

/* 6. A kit with one family uses it for both roles rather than leaving the body font blank,
      and a renamed palette still resolves by position. */
const oneFont = prefillAutomationBranding(EMPTY_AUTOMATION_BRANDING, { ...kit, fonts: "Inter" });
assert.equal(oneFont.carousel_story_title_font, "Inter");
assert.equal(oneFont.carousel_story_body_font, "Inter");

const renamed = prefillAutomationBranding(EMPTY_AUTOMATION_BRANDING, {
    ...kit,
    colors: [
        { name: "Moss", hex: "#8dbc5f" },
        { name: "Forest", hex: "#17240f" },
        { name: "Amber", hex: "#de9c31" },
        { name: "Bone", hex: "#faf7f0" },
    ],
});
assert.equal(renamed.story_background_color, "#17240f", "a renamed palette falls back to position");
assert.equal(renamed.email_button_color, "#8dbc5f");

/* 7. An empty kit prefills nothing and throws nothing — a brand kit that hasn't been
      generated yet is the normal state of a new client. */
const blank = prefillAutomationBranding(EMPTY_AUTOMATION_BRANDING, { colors: [], fonts: "" });
assert.ok(isAutomationBrandingEmpty(blank));

console.log("automation-branding.check: all assertions passed");
