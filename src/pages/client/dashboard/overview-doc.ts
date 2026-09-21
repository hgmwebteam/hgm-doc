/**
 * The Client Overview Document's field list — the team-only internal brief.
 *
 * One list drives the form on screen, the "x of 26 fields filled" counter and the tool
 * schema the model fills, so a field cannot exist in one and be missing from another.
 * The stored shape is OverviewDoc in @/lib/supabase.
 */
import type { OverviewDoc } from "@/lib/supabase";

/**
 * The Client Overview Document's fields, in the order they appear on screen.
 *
 * One list drives the form, the "x of 26 filled" counter and the tool schema the model
 * fills, so a field can't exist in one of those and be missing from another. `long` picks a
 * textarea over a single line; `half` puts two fields side by side.
 */
export const OVERVIEW_SECTIONS: {
    id: string;
    title: string;
    fields: { key: keyof OverviewDoc; label: string; placeholder?: string; long?: boolean; half?: boolean }[];
}[] = [
    {
        id: "client",
        title: "Client information",
        fields: [
            { key: "client_name", label: "Client name", half: true },
            { key: "business_name", label: "Business name", half: true },
            { key: "email", label: "Email", placeholder: "you@example.com", half: true },
            { key: "business_type", label: "Business type", placeholder: "e.g. cabins, beach houses", half: true },
            { key: "locations", label: "Business location(s)" },
        ],
    },
    {
        id: "platforms",
        title: "Platforms",
        fields: [
            { key: "instagram", label: "Instagram", placeholder: "@handle", half: true },
            { key: "tiktok", label: "TikTok", placeholder: "@handle", half: true },
            { key: "direct_booking_website", label: "Direct booking website", placeholder: "https://", half: true },
            { key: "airbnb", label: "Airbnb", placeholder: "https://", half: true },
        ],
    },
    {
        id: "goals",
        title: "Business goals & objectives",
        fields: [
            {
                key: "short_term_goals",
                label: "Short-term goals",
                placeholder: "e.g. increasing bookings, building brand awareness, optimizing listings",
                long: true,
            },
            { key: "long_term_goals", label: "Long-term goals", placeholder: "e.g. business growth, equity value, direct booking focus", long: true },
            { key: "success_metrics", label: "Key success metrics", placeholder: "e.g. website conversion rate, ADR, occupancy rate", long: true },
        ],
    },
    {
        id: "brand",
        title: "Brand & positioning",
        fields: [
            { key: "target_audience", label: "Target audience", long: true },
            { key: "unique_selling_points", label: "Unique selling points", long: true },
            { key: "branding", label: "Branding", long: true },
            { key: "competitor_inspiration", label: "Competitor inspiration", long: true, half: true },
            { key: "market_insights", label: "Market insights", long: true, half: true },
        ],
    },
    {
        id: "preferences",
        title: "Client preferences & notes",
        fields: [
            { key: "communication_style", label: "Preferred communication style", long: true },
            { key: "concerns", label: "Client's concerns or requests", long: true },
            { key: "other_notes", label: "Other notes", long: true },
        ],
    },
];

/** The section rail's list, in reading order — OVERVIEW_SECTIONS plus the two blocks that
 *  render outside it (Properties sits between Platforms and Goals; Baseline closes the doc). */
export const OVERVIEW_RAIL: { id: string; label: string }[] = [
    ...OVERVIEW_SECTIONS.slice(0, 2).map((s) => ({ id: s.id, label: s.title })),
    { id: "properties", label: "Properties" },
    ...OVERVIEW_SECTIONS.slice(2).map((s) => ({ id: s.id, label: s.title })),
    { id: "baseline", label: "Baseline (snapshot)" },
];

/** 1-based heading number for a rail section, shared by the rail and the headings. */
export const overviewSectionNumber = (id: string) => OVERVIEW_RAIL.findIndex((r) => r.id === id) + 1;

/** The kickoff numbers. Kept out of OVERVIEW_SECTIONS because they render as tiles, not rows. */
export const OVERVIEW_BASELINE: { key: keyof OverviewDoc; label: string }[] = [
    { key: "instagram_followers", label: "Instagram followers" },
    { key: "facebook_followers", label: "Facebook followers" },
    { key: "tiktok_followers", label: "TikTok followers" },
    { key: "email_list_size", label: "Email list size" },
];

/** Everything the "x of 26 fields filled" counter looks at. Properties are a list, so they
 *  are deliberately not part of the count — a client with two properties isn't 24/26 done. */
export const OVERVIEW_COUNTED_FIELDS: (keyof OverviewDoc)[] = [
    ...OVERVIEW_SECTIONS.flatMap((s) => s.fields.map((f) => f.key)),
    ...OVERVIEW_BASELINE.map((f) => f.key),
    "direct_booking_split",
    "instagram_screenshot",
];

/**
 * Title Case for the pasted document's headings and field labels.
 *
 * The screen writes labels in sentence case ("Business location(s)"); the team's Google
 * Doc template writes them in Title Case ("Business Location(s)"). Derived rather than
 * listed twice, so a relabelled field cannot drift between the form and the paste.
 *
 * Only the first letter of a word is touched, so "TikTok" and "Airbnb" survive intact.
 * Hyphens split words ("Short-term" → "Short-Term") but apostrophes do not, or "Client's"
 * would come out "Client'S".
 */
const SMALL_WORDS = new Set(["a", "an", "and", "as", "at", "but", "by", "for", "if", "in", "of", "on", "or", "the", "to", "vs"]);
const titleCase = (s: string) =>
    s
        .split(" ")
        .map((word, wordIndex) =>
            word
                .split("-")
                .map((part, partIndex) =>
                    wordIndex > 0 && partIndex === 0 && SMALL_WORDS.has(part.toLowerCase())
                        ? part.toLowerCase()
                        : part.charAt(0).toUpperCase() + part.slice(1),
                )
                .join("-"),
        )
        .join(" ");

const escapeHtml = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export type OverviewDocSection = {
    title: string;
    /** Label/value pairs, in screen order. A blank value still gets its bullet. */
    rows: { label: string; value: string }[];
    /** Properties are a name with a link beneath, not a label and a value. */
    properties?: { name: string; link: string }[];
};

/**
 * The Overview brief as one pasteable document, shaped like the team's Google Doc template:
 * a "{Business} - Overview" title, a heading per section, and one bulleted row per field
 * with the label in bold.
 *
 * `html` is what makes a paste into Google Docs arrive as real headings and real bullets —
 * pasting the markdown instead lands one grey paragraph per section, which is what this
 * replaced. `markdown` rides along for editors that take only text.
 *
 * Empty fields keep their bullet rather than being dropped: the template is a worksheet an
 * AM fills in beside the client, so a missing row reads as a question nobody asked.
 */
export const compileOverviewDocument = (doc: OverviewDoc): { title: string; sections: OverviewDocSection[]; markdown: string; html: string } => {
    const val = (key: keyof OverviewDoc) => String(doc[key] ?? "").trim();
    const fieldRows = (fields: { key: keyof OverviewDoc; label: string }[]) => fields.map((f) => ({ label: titleCase(f.label), value: val(f.key) }));

    const sections: OverviewDocSection[] = [
        ...OVERVIEW_SECTIONS.slice(0, 2).map((s) => ({ title: titleCase(s.title), rows: fieldRows(s.fields) })),
        {
            title: "Properties",
            rows: [],
            properties: doc.properties.filter((p) => p.name.trim() || p.link.trim()).map((p) => ({ name: p.name.trim() || "Unnamed property", link: p.link.trim() })),
        },
        ...OVERVIEW_SECTIONS.slice(2).map((s) => ({ title: titleCase(s.title), rows: fieldRows(s.fields) })),
        {
            title: "Baseline (Snapshot)",
            rows: [
                ...OVERVIEW_BASELINE.map((f) => ({ label: titleCase(f.label), value: val(f.key) })),
                { label: "Current Direct Booking Split", value: val("direct_booking_split") },
                // The screenshot is a base64 data URL. Naming it beats pasting megabytes of it.
                { label: "Instagram Screenshot", value: doc.instagram_screenshot ? "Attached on the dashboard" : "" },
            ],
        },
    ];

    const title = `${doc.business_name.trim() || doc.client_name.trim() || "Client"} - Overview`;

    // Heading levels match the template, where the title is Heading 2 and sections Heading 3.
    const md: string[] = [`## ${title}`, ""];
    const html: string[] = [`<h2>${escapeHtml(title)}</h2>`];

    for (const section of sections) {
        md.push(`### ${section.title}`, "");
        html.push(`<h3>${escapeHtml(section.title)}</h3>`);

        if (section.properties) {
            md.push(...section.properties.map((p) => `- **${p.name}**${p.link ? `\n    - [Link](${p.link})` : ""}`), "");
            html.push(
                `<ul>${section.properties
                    .map(
                        (p) =>
                            `<li><strong>${escapeHtml(p.name)}</strong>${
                                p.link ? `<ul><li><a href="${escapeHtml(p.link)}">Link</a></li></ul>` : ""
                            }</li>`,
                    )
                    .join("")}</ul>`,
            );
            continue;
        }

        md.push(...section.rows.map((r) => `- **${r.label}**: ${r.value}`), "");
        html.push(
            `<ul>${section.rows
                .map((r) => `<li><strong>${escapeHtml(r.label)}</strong>: ${escapeHtml(r.value).replace(/\n/g, "<br>")}</li>`)
                .join("")}</ul>`,
        );
    }

    return { title, sections, markdown: md.join("\n"), html: html.join("") };
};

export const DEFAULT_OVERVIEW_DOC: OverviewDoc = {
    client_name: "",
    business_name: "",
    email: "",
    business_type: "",
    locations: "",
    instagram: "",
    tiktok: "",
    direct_booking_website: "",
    airbnb: "",
    properties: [],
    short_term_goals: "",
    long_term_goals: "",
    success_metrics: "",
    target_audience: "",
    unique_selling_points: "",
    branding: "",
    competitor_inspiration: "",
    market_insights: "",
    communication_style: "",
    concerns: "",
    other_notes: "",
    instagram_followers: "",
    facebook_followers: "",
    tiktok_followers: "",
    email_list_size: "",
    direct_booking_split: "",
    instagram_screenshot: "",
};
