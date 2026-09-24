/**
 * Automation branding — the pure half: the row shape, the field list the card renders
 * from, and the brand-kit prefill. No React and no Supabase, so automation-branding.check.ts
 * can run the prefill rules without either.
 *
 * What this is: the reel, carousel/story and email automations each read a hand-filled
 * Google Sheet of fonts and colours per client, sitting next to a brand kit that already
 * holds the same palette and families. These fields move that into the portal so the
 * automations pull one row and the team fills nothing twice. Column names follow the
 * sheets' own headers so the mapping stays readable from either end.
 *
 * Team-only: `automation_branding` has no anon policy at all, so a client cannot read it
 * even if they reached the section.
 */

/** One client's row. Every field is text — a font size is "7.5vmin", a weight is "400",
 *  and keeping them as typed means a value is never silently reformatted on the way to an
 *  automation that expects the string it was given. */
export interface AutomationBranding {
    reel_primary_font: string;
    reel_primary_font_size: string;
    reel_secondary_font_size: string;
    reel_font_weight: string;
    reel_secondary_font: string;
    carousel_story_title_font: string;
    carousel_story_body_font: string;
    story_background_color: string;
    story_accent_color: string;
    story_font_color: string;
    email_background_color: string;
    email_button_color: string;
    email_secondary_color: string;
    email_contact_info: string;
    email_footer_text: string;
    email_instagram_link: string;
    email_facebook_link: string;
    email_tiktok_link: string;
    email_website_link: string;
    email_contact_number: string;
}

export type AutomationField = keyof AutomationBranding;

/** What the card draws for a field. `color` adds a swatch and a native picker beside the
 *  hex; `area` is the multi-line footer blurb; everything else is one line. */
export type FieldKind = "text" | "color" | "area";

export interface FieldSpec {
    key: AutomationField;
    label: string;
    kind: FieldKind;
    /** Shown under the input where the expected shape isn't obvious from the label. */
    hint?: string;
    placeholder?: string;
}

/** The three groups, in the order the automations were described. Each group names the
 *  sheet it replaces, so anyone comparing the two knows they are looking at the same thing. */
export const AUTOMATION_GROUPS: { id: string; title: string; note: string; fields: FieldSpec[] }[] = [
    {
        id: "reels",
        title: "Reels",
        note: "Replaces the Reel Automation Fonts sheet.",
        fields: [
            { key: "reel_primary_font", label: "Primary font", kind: "text", placeholder: "Advercase" },
            { key: "reel_secondary_font", label: "Secondary font", kind: "text", placeholder: "Cormorant Garamond" },
            { key: "reel_primary_font_size", label: "Primary font size", kind: "text", hint: "A CSS length, e.g. 7.5vmin", placeholder: "7.5vmin" },
            { key: "reel_secondary_font_size", label: "Secondary font size", kind: "text", hint: "A CSS length, e.g. 5.5vmin", placeholder: "5.5vmin" },
            { key: "reel_font_weight", label: "Font weight", kind: "text", hint: "400, 500, 700 …", placeholder: "400" },
        ],
    },
    {
        id: "carousel",
        title: "Carousels & stories",
        note: "Replaces the Carousel & Story Automation Branding sheet. The type is shared by both; the colours belong to stories.",
        fields: [
            { key: "carousel_story_title_font", label: "Title font", kind: "text", placeholder: "Montserrat" },
            { key: "carousel_story_body_font", label: "Body font", kind: "text", placeholder: "Space Grotesk" },
            { key: "story_background_color", label: "Story background", kind: "color" },
            { key: "story_accent_color", label: "Story accent", kind: "color" },
            { key: "story_font_color", label: "Story font colour", kind: "color" },
        ],
    },
    {
        id: "email",
        title: "Email",
        note: "Replaces the Email Components (Automation) sheet.",
        fields: [
            { key: "email_background_color", label: "Background", kind: "color" },
            { key: "email_button_color", label: "Button", kind: "color" },
            { key: "email_secondary_color", label: "Secondary", kind: "color" },
            { key: "email_contact_info", label: "Contact email", kind: "text", placeholder: "info@example.com" },
            { key: "email_contact_number", label: "Contact number", kind: "text", placeholder: "+1 555 000 0000" },
            { key: "email_website_link", label: "Website", kind: "text", placeholder: "https://example.com/" },
            { key: "email_instagram_link", label: "Instagram", kind: "text", placeholder: "https://www.instagram.com/…" },
            { key: "email_facebook_link", label: "Facebook", kind: "text", placeholder: "https://www.facebook.com/…" },
            { key: "email_tiktok_link", label: "TikTok", kind: "text", placeholder: "https://www.tiktok.com/@…" },
            {
                key: "email_footer_text",
                label: "Footer text",
                kind: "area",
                hint: "The paragraph that closes every email.",
                placeholder: "Your serene escape in…",
            },
        ],
    },
];

export const AUTOMATION_FIELDS: FieldSpec[] = AUTOMATION_GROUPS.flatMap((g) => g.fields);

export const EMPTY_AUTOMATION_BRANDING: AutomationBranding = Object.fromEntries(AUTOMATION_FIELDS.map((f) => [f.key, ""])) as unknown as AutomationBranding;

/** A row from the table, or anything shaped like one, coerced to every field as a string. */
export const mergeAutomationBranding = (row: Partial<Record<AutomationField, unknown>> | null | undefined): AutomationBranding =>
    Object.fromEntries(AUTOMATION_FIELDS.map((f) => [f.key, String(row?.[f.key] ?? "")])) as unknown as AutomationBranding;

/** What the brand kit and the rest of the dashboard already know, as the prefill sees it. */
export interface PrefillSource {
    /** The kit's palette, in its own order: Primary, Secondary, Accent, Neutral by default. */
    colors: { name: string; hex: string }[];
    /** The kit's families as typed — comma-separated, heading first. */
    fonts: string;
    instagramUrl?: string;
    websiteUrl?: string;
    /** The brand bio from the Master Brand Document — the closest thing to footer copy. */
    brandBio?: string;
}

const byName = (colors: { name: string; hex: string }[], name: string) => colors.find((c) => c.name.trim().toLowerCase() === name)?.hex ?? "";

/**
 * Fill the blanks from what the portal already knows, and ONLY the blanks — a value someone
 * typed is never overwritten, because the prefill is a guess (the kit has no idea which of
 * its colours is a story background) and the typed one is a decision.
 *
 * Colour roles follow the kit's own names: Secondary is the dark one, so it backs a story
 * and an email; Primary is the brand colour, so it draws buttons and accents; Neutral is
 * the pale one, so text on a dark background reads in it. A kit whose palette was renamed
 * falls back to position, which is the same order.
 */
export const prefillAutomationBranding = (current: AutomationBranding, src: PrefillSource): AutomationBranding => {
    const primary = byName(src.colors, "primary") || src.colors[0]?.hex || "";
    const secondary = byName(src.colors, "secondary") || src.colors[1]?.hex || "";
    const accent = byName(src.colors, "accent") || src.colors[2]?.hex || "";
    const neutral = byName(src.colors, "neutral") || src.colors[3]?.hex || "";

    const families = src.fonts
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean);
    const heading = families[0] ?? "";
    const body = families[1] ?? families[0] ?? "";

    const guess: Partial<AutomationBranding> = {
        reel_primary_font: heading,
        reel_secondary_font: body,
        carousel_story_title_font: heading,
        carousel_story_body_font: body,
        story_background_color: secondary,
        story_accent_color: primary,
        story_font_color: neutral,
        email_background_color: secondary,
        email_button_color: primary,
        email_secondary_color: accent,
        email_instagram_link: src.instagramUrl ?? "",
        email_website_link: src.websiteUrl ?? "",
        email_footer_text: src.brandBio ?? "",
    };

    const next = { ...current };
    for (const [k, v] of Object.entries(guess) as [AutomationField, string][]) {
        if (!next[k].trim() && v.trim()) next[k] = v.trim();
    }
    return next;
};

/** True when there is nothing for an automation to pull yet. */
export const isAutomationBrandingEmpty = (b: AutomationBranding) => AUTOMATION_FIELDS.every((f) => !b[f.key].trim());

/** How many fields an automation would find filled — the card's "12 of 20" counter. */
export const automationBrandingFilled = (b: AutomationBranding) => AUTOMATION_FIELDS.filter((f) => b[f.key].trim()).length;
