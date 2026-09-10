/**
 * Master Brand Document suggestion mode — the pure model.
 *
 * Field-key addressing for client-proposed edits: one string names any suggestible
 * value in the foundation, and everything is whitelist-driven so an unknown or
 * malformed key applies to nothing (a bogus row in dashboard_suggestions is inert).
 *
 *     "hosts"                      — a flat field
 *     "taglines.0"                 — one of the three fixed tagline slots
 *     "personas.{rowId}.age"       — a column of a row, keyed by its stable uid()
 *
 * No JSX and no React, so suggestions.check.ts can compile and run it standalone.
 * The context, <SuggestionBox> and fetch wrappers live in suggestions.tsx.
 */
import type { Foundation } from "./dashboard-model";

/** One row of dashboard_suggestions, as the API returns it. */
export interface Suggestion {
    id: string;
    slug: string;
    field_key: string;
    field_label: string;
    /** The value the client saw when suggesting — compared to the live value for staleness. */
    current_value: string;
    suggested_value: string;
    suggested_by: string;
    status: "pending" | "accepted" | "declined";
    resolved_by: string;
    resolved_at: string | null;
    created_at: string;
}

/* ── Welcome-flow feedback ──
   A client's note on the welcome emails rides the same table, function and review loop
   as a document edit, under its own key family so the two never mix. There is ONE note
   per person for the whole flow — "welcomeFlow.all" — not one per email: a client
   reviewing nine emails wants to write a single message and send it once (2026-09-10).
   `suggested_value` holds the note.

   Notes written before that carry a per-email key instead ("welcomeFlow.3" was feedback
   on E4) and are still read, labelled and resolved — only new notes use the combined
   key, so nothing already sent is stranded.

   parseKey below knows nothing about any of these keys on purpose — applySuggestion
   returns null, so a feedback row can never be "accepted" into the Master Brand
   Document. The team resolves it as done or dismissed. */

export const FLOW_FEEDBACK_PREFIX = "welcomeFlow.";
/** The one key a new note is stored under — the whole flow, not a single email. */
export const FLOW_FEEDBACK_KEY = `${FLOW_FEEDBACK_PREFIX}all`;
export const isFlowFeedbackKey = (key: string) => key.startsWith(FLOW_FEEDBACK_PREFIX);
/** The 0-based email a legacy per-email note addresses. NaN for a combined note and for
 *  any other key, so `Number.isInteger` is the test for "this one names an email". */
export const flowFeedbackSlot = (key: string) => (isFlowFeedbackKey(key) ? Number(key.slice(FLOW_FEEDBACK_PREFIX.length)) : NaN);

/* ── Landing-page feedback ──
   The same thing for Marketing → Landing page, under its own prefix so the two never mix.
   One note per person for the page as a whole: "landingPage.all".

   This is deliberately NOT the Approve / Request changes gate in landing-page-section.tsx.
   That one is a decision — it closes, and once a client has approved they have no way to
   say anything more. This is the open-ended channel that stays available either side of
   that decision (2026-09-10).

   Like the flow keys, parseKey knows nothing about these, so applySuggestion returns null
   and a note can never be "accepted" into the Master Brand Document. */

export const LANDING_FEEDBACK_PREFIX = "landingPage.";
/** The one key a landing-page note is stored under. */
export const LANDING_FEEDBACK_KEY = `${LANDING_FEEDBACK_PREFIX}all`;
export const isLandingFeedbackKey = (key: string) => key.startsWith(LANDING_FEEDBACK_PREFIX);

/** One proposed edit, as the client's browser sends it to the create action. */
export interface SuggestionItem {
    fieldKey: string;
    fieldLabel: string;
    currentValue: string;
    suggestedValue: string;
}

export const SCALAR_KEYS = [
    "hosts",
    "propertyType",
    "structure",
    "generalAmenities",
    "sharedAmenities",
    "exactLocation",
    "proximityCities",
    "proximityAirports",
    "targetAudience",
    "uvp",
    "brandVoice",
    "brandBio",
    "personaResonance",
    "corePillars",
    "emotionalThemes",
] as const;

export const LIST_COLUMNS = {
    personas: ["name", "summary", "rank", "age", "relationship", "location", "interests", "painPoints", "seeking", "howTheyBook"],
    focusProperties: ["name", "link", "location", "guests", "bedrooms", "beds", "bathrooms", "description", "features", "terms"],
    restaurants: ["name", "description"],
    activities: ["name", "description"],
    websiteLinks: ["page", "url"],
} as const;

type ListName = keyof typeof LIST_COLUMNS;

/** Parse a field key into its addressed parts, or null when it names nothing we allow. */
const parseKey = (
    f: Foundation,
    key: string,
): { kind: "scalar" } | { kind: "tagline"; index: number } | { kind: "row"; list: ListName; rowId: string; col: string } | null => {
    if ((SCALAR_KEYS as readonly string[]).includes(key)) return { kind: "scalar" };
    const parts = key.split(".");
    if (parts[0] === "taglines" && parts.length === 2) {
        const index = Number(parts[1]);
        return Number.isInteger(index) && index >= 0 && index < f.taglines.length ? { kind: "tagline", index } : null;
    }
    if (parts.length === 3) {
        const [list, rowId, col] = parts as [string, string, string];
        const cols = (LIST_COLUMNS as Record<string, readonly string[]>)[list];
        if (!cols || !cols.includes(col)) return null;
        return { kind: "row", list: list as ListName, rowId, col };
    }
    return null;
};

/**
 * The patch that writes `value` at `key`, or null when the key is unknown or its row
 * has been deleted since the suggestion was made. Never mutates its input — the result
 * goes straight into patchFoundation.
 */
export function applySuggestion(f: Foundation, key: string, value: string): Partial<Foundation> | null {
    const parsed = parseKey(f, key);
    if (!parsed) return null;
    if (parsed.kind === "scalar") return { [key]: value } as Partial<Foundation>;
    if (parsed.kind === "tagline") return { taglines: f.taglines.map((t, i) => (i === parsed.index ? value : t)) };
    const rows = f[parsed.list] as { id: string }[];
    if (!rows.some((r) => r.id === parsed.rowId)) return null;
    return { [parsed.list]: rows.map((r) => (r.id === parsed.rowId ? { ...r, [parsed.col]: value } : r)) } as Partial<Foundation>;
}

/** The live value at `key`, or null when the key no longer resolves. */
export function valueForKey(f: Foundation, key: string): string | null {
    const parsed = parseKey(f, key);
    if (!parsed) return null;
    if (parsed.kind === "scalar") return (f[key as (typeof SCALAR_KEYS)[number]] ?? "") as string;
    if (parsed.kind === "tagline") return f.taglines[parsed.index] ?? "";
    const row = (f[parsed.list] as ({ id: string } & Record<string, unknown>)[]).find((r) => r.id === parsed.rowId);
    return row ? String(row[parsed.col] ?? "") : null;
}

const SCALAR_LABELS: Record<string, string> = {
    hosts: "About the hosts",
    propertyType: "Property type",
    structure: "Structure",
    generalAmenities: "General amenities",
    sharedAmenities: "Shared resort amenities",
    exactLocation: "Exact location",
    proximityCities: "Proximity to popular cities",
    proximityAirports: "Proximity to airports",
    targetAudience: "Target audience profile",
    uvp: "Unique value proposition",
    brandVoice: "Brand voice",
    brandBio: "Brand bio",
    personaResonance: "Why the brand resonates",
    corePillars: "Core brand pillars & key selling points",
    emotionalThemes: "Emotional & experiential themes",
};

const LIST_LABELS: Record<ListName, string> = {
    personas: "Persona",
    focusProperties: "Focus property",
    restaurants: "Restaurant",
    activities: "Activity",
    websiteLinks: "Website link",
};

/** "howTheyBook" → "How they book". */
const humanize = (col: string) =>
    (col.charAt(0).toUpperCase() + col.slice(1)).replace(/([a-z])([A-Z])/g, (_, a: string, b: string) => `${a} ${b.toLowerCase()}`);

/** Human label for a key, captured at suggest time so history survives row deletion. */
export function labelForKey(f: Foundation, key: string): string {
    const parsed = parseKey(f, key);
    if (!parsed) return key;
    if (parsed.kind === "scalar") return SCALAR_LABELS[key] ?? key;
    if (parsed.kind === "tagline") return `Tagline ${parsed.index + 1}`;
    const row = (f[parsed.list] as ({ id: string; name?: string; page?: string } & Record<string, unknown>)[]).find((r) => r.id === parsed.rowId);
    const rowName = (row?.name || row?.page || "").toString().trim();
    return `${LIST_LABELS[parsed.list]}${rowName ? ` “${rowName}”` : ""} · ${humanize(parsed.col)}`;
}
