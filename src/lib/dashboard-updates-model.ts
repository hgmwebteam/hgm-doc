import type { DashboardContent } from "@/lib/supabase";

/**
 * The pure half of the dashboard activity feed: what counts as a change, and what it's
 * called. No React, no Supabase — so the self-check in dashboard-updates.check.ts can run it
 * on its own. The writes and reads live in dashboard-updates.ts.
 *
 * The one rule this module exists to enforce: names travel, values never do. A change is
 * described by the section it happened in and the fields inside it, and nothing in here ever
 * returns a value it read. dashboard_pages.data holds share_password, per-person passwords
 * and everything a client wrote about their business; the feed's job is to say "Alicia
 * changed the Brand Kit (Colours, Fonts)", which needs none of it.
 */

export interface SectionChange {
    /** Human section label, e.g. "Brand Kit". */
    section: string;
    /** Field names inside that section. Names only — never values. */
    fields: string[];
}

/**
 * Top-level `dashboard_pages.data` keys, mapped to the section a person would name.
 *
 * Order is the side menu's own order (dashboard-navigation.ts), so an entry touching three
 * sections lists them the way the dashboard does. Keys absent from this list are ignored
 * outright — that's how internal bookkeeping stays out of a feed meant to describe work.
 *
 * `fields: false` suppresses the field breakdown. The three access keys share one label for
 * that reason: "Client access" is all a colleague needs, and naming the keys underneath it
 * only advertises where the passwords live.
 */
const SECTION_MAP: { key: keyof DashboardContent; label: string; fields?: boolean }[] = [
    { key: "status", label: "Status", fields: false },
    { key: "overview_doc", label: "Overview Document" },
    { key: "foundation", label: "Master Brand" },
    { key: "brand", label: "Brand Kit" },
    { key: "pinned_posts", label: "Pinned Posts" },
    { key: "reels", label: "Example Reels", fields: false },
    { key: "instagram", label: "Instagram" },
    { key: "ghl", label: "GoHighLevel Setup" },
    { key: "revenue", label: "Revenue & Results" },
    { key: "videos", label: "Video Guides", fields: false },
    { key: "website_setup", label: "Website Setup Guide" },
    { key: "links", label: "Quick links", fields: false },
    { key: "resources", label: "Resources", fields: false },
    { key: "chat_link", label: "Google Chat link", fields: false },
    { key: "onboarding_call_url", label: "Onboarding call link", fields: false },
    { key: "journey_done", label: "Client journey", fields: false },
    { key: "client_visible", label: "Client visibility", fields: false },
    { key: "logo_url", label: "Logo", fields: false },
    { key: "sidebar_bg_url", label: "Side-menu background", fields: false },
    { key: "login_bg_url", label: "Sign-in background", fields: false },
    { key: "allowed_emails", label: "Client access", fields: false },
    { key: "dashboard_users", label: "Client access", fields: false },
    { key: "share_password", label: "Client access", fields: false },
];

/** Section labels used by entries that don't come from a diff (see recordDashboardPublish). */
export const LANDING_SECTION = "Landing Page";
export const STORIES_SECTION = "Pinned Stories";

/** Acronyms and compounds the generic humaniser would mangle. */
const FIELD_LABELS: Record<string, string> = {
    uvp: "UVP",
    folder_link: "Folder link",
    profile_url: "Profile",
    login_url: "Login",
    canva_url: "Canva design",
    ai_website: "AI website",
    netlify_email: "Netlify account",
    netlify_done: "Netlify confirmed",
    font_files: "Uploaded fonts",
    promptHidden: "Working prompt",
};

/** "focusProperties" → "Focus properties"; "folder_link" → "Folder link". */
export const humaniseField = (key: string): string => {
    if (FIELD_LABELS[key]) return FIELD_LABELS[key];
    const spaced = key
        .replace(/[-_]+/g, " ")
        .replace(/([a-z\d])([A-Z])/g, "$1 $2")
        .toLowerCase()
        .trim();
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

const isPlainObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

const isEmpty = (v: unknown): boolean => {
    if (v === undefined || v === null || v === "") return true;
    if (Array.isArray(v)) return v.length === 0;
    if (isPlainObject(v)) return Object.keys(v).every((k) => isEmpty(v[k]));
    return false;
};

/**
 * Serialise with object keys in a fixed order, so two objects holding the same data compare
 * equal whatever order their keys arrived in.
 *
 * Not a nicety: the "before" side of every diff is the row read back from Supabase, and jsonb
 * does not preserve key order. A plain JSON.stringify would therefore find every section
 * different on the first save after a reload, and the feed would claim an AM rewrote the whole
 * dashboard when they fixed one tagline.
 *
 * Array order is left alone — it is meaningful here (tagline 01/02/03, the persona rail), so
 * reordering personas IS a change and should be reported as one.
 */
const stable = (v: unknown): string =>
    JSON.stringify(v ?? null, (_k, val) =>
        val && typeof val === "object" && !Array.isArray(val)
            ? Object.fromEntries(
                  Object.keys(val as Record<string, unknown>)
                      .sort()
                      .map((k) => [k, (val as Record<string, unknown>)[k]]),
              )
            : val,
    );

/** Deep equality, ignoring key order. Enough here: this is plain JSON on its way to jsonb. */
const same = (a: unknown, b: unknown) => stable(a) === stable(b);

/** Sub-keys of a section that differ. Depth one on purpose: "Personas" says enough, and
 *  walking into a persona would start naming the client's own words back in the field list. */
const changedFields = (before: unknown, after: unknown): string[] => {
    if (!isPlainObject(before) || !isPlainObject(after)) return [];
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    return [...keys].filter((k) => !same(before[k], after[k])).map(humaniseField);
};

/** How many field names one entry carries before it stops being scannable. */
export const MAX_FIELDS = 8;

/**
 * What changed between two saves of a dashboard row.
 *
 * `before` is null only for the very first save of a row, which reports every section that
 * has anything in it rather than nothing — a dashboard being set up is exactly the kind of
 * thing the feed should show.
 */
export function diffDashboardContent(before: Partial<DashboardContent> | null, after: Partial<DashboardContent>): SectionChange[] {
    const from = (before ?? {}) as Record<string, unknown>;
    const to = after as Record<string, unknown>;

    const changes: SectionChange[] = [];
    for (const entry of SECTION_MAP) {
        const key = entry.key as string;
        if (same(from[key], to[key])) continue;

        // A key going from absent to empty is a shape upgrade, not a person's edit: an older
        // row gains `resources: []` the first time it's opened in a newer build, and a feed
        // full of those would be noise nobody reads. Skipped only for an existing row — on a
        // first save there is no shape to upgrade.
        if (before !== null && from[key] === undefined && isEmpty(to[key])) continue;

        const fields = entry.fields === false ? [] : changedFields(from[key], to[key]).slice(0, MAX_FIELDS);
        // Two keys can share a label ("Client access"); fold them into one entry so the feed
        // doesn't print the same word three times for one save.
        const existing = changes.find((c) => c.section === entry.label);
        if (existing) existing.fields = [...new Set([...existing.fields, ...fields])].slice(0, MAX_FIELDS);
        else changes.push({ section: entry.label, fields });
    }
    return changes;
}
