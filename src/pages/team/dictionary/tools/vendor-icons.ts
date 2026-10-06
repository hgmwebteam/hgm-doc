import { type SortBox, type SortData, isText } from "@/pages/team/dictionary/tools/sort-model";

/**
 * The vendor icons: what the tools pages read from src/data/vendor-icons.json, the manifest of the
 * icons in public/vendor-icons/. No React, so vendor-icons.check.ts can pin all of it.
 *
 * The manifest is a copy of the Claude project's vendor-icons-manifest.json, replaced whole and
 * never edited here (its handoff record is reference/industry-acumen-sort/vendor-icons.md). A
 * vendor's slug names its two files, /vendor-icons/128/<slug>.png and /vendor-icons/512/<slug>.png.
 * A vendor is found by its name exactly as the slides and the card list write it, through
 * `card_name_to_slug` ("Sabre SynXis" is sabre), never by guessing, so the card list needs no logo
 * field.
 *
 * The tools training (/dictionary/tools/practice) is built from the manifest: one card per vendor,
 * with the boxes the session 2 tools slides put it under (`categories`) on the back, worded as the
 * card list's boxes. Nothing here names a vendor's boxes: correcting one is a data change.
 */

/** The fields the portal reads. The rest of an entry (its file paths, tile colour) describes the Claude project's unpacked folder. */
export type IconVendor = {
    name: string;
    /** "Mews logo": for an icon shown without its name beside it. */
    alt: string;
    /** The boxes the slides put it under, as the card list's box ids. */
    categories: string[];
    /** Its products as the slides name them: "Amadeus iHotelier", "Amadeus Demand360". */
    deck_card_names: string[];
    /** "identified", "identified (supplied by Kyle)" or "check by eye". */
    confidence: string;
    note: string;
};

export type VendorIcons = {
    version: string;
    made: string;
    /** Each tools slide's number → the box it covers, so slide order is box order. */
    categories: Record<string, string>;
    /** A vendor's name exactly as on the slides and the card list → its slug. */
    card_name_to_slug: Record<string, string>;
    vendors: Record<string, IconVendor>;
};

/** The two sizes of every icon: 128 px for the pages, 512 px for ?present and the training. */
export type IconSize = 128 | 512;

/** An icon's file on this site. The manifest's own `file` paths describe the Claude project's folder, so they're never used. */
export const iconUrl = (slug: string, size: IconSize) => `/vendor-icons/${size}/${slug}.png`;

/** The slug of the icon for a vendor named exactly as on the slides and the card list, or null when the manifest has none. */
export const iconSlug = (icons: VendorIcons, vendorName: string): string | null => {
    const slug = icons.card_name_to_slug && Object.hasOwn(icons.card_name_to_slug, vendorName) ? icons.card_name_to_slug[vendorName] : null;
    return slug && icons.vendors && Object.hasOwn(icons.vendors, slug) ? slug : null;
};

/* ── The training ───────────────────────────────────────────────── */

/** One card of the training: a vendor's logo and name on the front, what it falls under on the back. */
export type TrainingCard = {
    slug: string;
    name: string;
    /** The products the slides name for it, when there's more than one (Amadeus iHotelier and Amadeus Demand360). */
    products: string[];
    /** What it falls under: the card list's boxes, in the slides' order. */
    boxes: SortBox[];
};

/** Every vendor box in the card list, by id. */
const cardListBoxes = (data: SortData) => new Map(data.rounds.flatMap((r) => (r.mode === "vendors" ? r.boxes.map((b) => [b.id, b] as const) : [])));

/** Box id → the slide it's on. */
const slideOf = (icons: VendorIcons) => new Map(Object.entries(icons.categories ?? {}).map(([slide, id]) => [id, Number(slide)]));

/**
 * Everything that stops the training showing a vendor's card right, as plain sentences; empty
 * when it's fine. The manifest reaches the page by a cast, so this trusts nothing about its shape;
 * the card list must already have passed sortProblems. It never reads `verify`: the training isn't
 * behind the game's gate.
 */
export const trainingProblems = (icons: VendorIcons, data: SortData): string[] => {
    const vendors = icons?.vendors && typeof icons.vendors === "object" ? Object.entries(icons.vendors) : [];
    if (!vendors.length) return ["Vendor icons: the manifest has no vendors."];
    const boxes = cardListBoxes(data);
    const slides = slideOf(icons);
    const problems: string[] = [];
    const say = (p: string) => problems.push(`Vendor icons: ${p}`);
    for (const [slug, v] of vendors) {
        if (!isText(v?.name)) say(`${slug} has no name.`);
        if (!isText(v?.alt)) say(`${slug} has no alt text.`);
        if (!Array.isArray(v?.deck_card_names) || !v.deck_card_names.every(isText)) say(`${slug}'s deck_card_names must be a list of names.`);
        const under: unknown[] = Array.isArray(v?.categories) ? v.categories : [];
        if (!under.length) say(`${slug} isn't under any box.`);
        under.forEach((id, i) => {
            if (under.indexOf(id) < i) say(`${slug} names "${String(id)}" twice.`);
            else if (!isText(id) || !boxes.has(id)) say(`${slug}'s box "${String(id)}" isn't a box in the card list.`);
            else if (!slides.has(id)) say(`${slug}'s box "${id}" isn't on any slide in categories.`);
        });
    }
    return problems;
};

/** The training's deck: one card per vendor in the manifest, keyed by slug. Expects trainingProblems to have found nothing. */
export const trainingCards = (icons: VendorIcons, data: SortData): TrainingCard[] => {
    const boxes = cardListBoxes(data);
    const slides = slideOf(icons);
    return Object.entries(icons.vendors).map(([slug, v]) => ({
        slug,
        name: v.name,
        products: v.deck_card_names.length > 1 ? v.deck_card_names : [],
        boxes: [...v.categories].sort((a, b) => slides.get(a)! - slides.get(b)!).flatMap((id) => boxes.get(id) ?? []),
    }));
};
