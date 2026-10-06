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
 * with what it's known for (`main`) and everything else it sells (the rest of `categories`) on the
 * back, worded as the card list's boxes. Nothing here names a vendor's boxes: correcting one is a
 * data change, made in the manifest and the card list together, because `boxClashes` holds the two
 * to one answer per vendor.
 */

/** The fields the portal reads. The rest of an entry (its file paths, tile colour) describes the Claude project's unpacked folder. */
export type IconVendor = {
    name: string;
    /** "Mews logo": for an icon shown without its name beside it. */
    alt: string;
    /**
     * Every box it sells, as the card list's box ids: a job counts when the vendor sells it under its own
     * name, in a plan or as a paid add-on (never a partner's product or a sister brand's).
     */
    categories: string[];
    /** What it's known for: one of `categories` per product, so one box for every vendor but Amadeus (iHotelier and Demand360). */
    main: string[];
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
    /** What it's known for: the card list's boxes, in the slides' order. */
    main: SortBox[];
    /** Everything else it sells, in the slides' order. */
    also: SortBox[];
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
        const main: unknown[] = Array.isArray(v?.main) ? v.main : [];
        if (!main.length) say(`${slug} has no main box.`);
        main.forEach((id, i) => {
            if (main.indexOf(id) < i) say(`${slug}'s main names "${String(id)}" twice.`);
            else if (under.length && !under.includes(id)) say(`${slug}'s main box "${String(id)}" isn't one of its categories.`);
        });
    }
    return problems;
};

/** The training's deck: one card per vendor in the manifest, keyed by slug. Expects trainingProblems to have found nothing. */
export const trainingCards = (icons: VendorIcons, data: SortData): TrainingCard[] => {
    const boxes = cardListBoxes(data);
    const slides = slideOf(icons);
    const inSlideOrder = (ids: string[]) => [...ids].sort((a, b) => slides.get(a)! - slides.get(b)!).flatMap((id) => boxes.get(id) ?? []);
    return Object.entries(icons.vendors).map(([slug, v]) => ({
        slug,
        name: v.name,
        products: v.deck_card_names.length > 1 ? v.deck_card_names : [],
        main: inSlideOrder(v.main),
        also: inSlideOrder(v.categories.filter((id) => !v.main.includes(id))),
    }));
};

/* ── One answer per vendor ──────────────────────────────────────── */

/**
 * Every place the game and the training would tell a player different things about a vendor, as
 * plain sentences; empty when they agree. The training shows the manifest; the game marks by the
 * card list. So, for every card and suite in the card list:
 *
 * - a card's box (where the round deals it) is what its vendor is known for (`main`), and the card
 *   accepts exactly the vendor's boxes (its box and `also` together are `categories`);
 * - a suite does exactly the vendor's boxes, and none of its distractors is one of them.
 *
 * A manifest entry covering several products (Amadeus: iHotelier and Demand360) answers for all of
 * them, so a card for one product may accept fewer boxes than the entry, never more.
 *
 * Expects sortProblems and trainingProblems to have found nothing. The pages don't call it: a clash
 * is a content question, caught by vendor-icons.check.ts before it ships.
 */
export const boxClashes = (icons: VendorIcons, data: SortData): string[] => {
    const name = new Map(data.rounds.flatMap((r) => (r.mode === "vendors" ? r.boxes.map((b) => [b.id, b.name] as const) : [])));
    const names = (ids: string[]) => ids.map((id) => name.get(id) ?? id).join(", ");
    const problems: string[] = [];
    const compare = (who: string, accepts: string[], vendorName: string) => {
        const slug = iconSlug(icons, vendorName);
        if (!slug) return;
        const v = icons.vendors[slug];
        const onlyGame = accepts.filter((id) => !v.categories.includes(id));
        const onlyTraining = v.deck_card_names.length > 1 ? [] : v.categories.filter((id) => !accepts.includes(id));
        if (onlyGame.length) problems.push(`${who}: the game accepts ${names(onlyGame)}, which the training doesn't list for ${v.name}.`);
        if (onlyTraining.length) problems.push(`${who}: the training lists ${names(onlyTraining)} for ${v.name}, which the game doesn't accept.`);
    };
    data.rounds.forEach((r, i) => {
        if (r.mode === "vendors")
            for (const c of r.cards) {
                compare(`${c.vendor}, round ${i + 1}`, [c.box, ...c.also], c.vendor);
                const slug = iconSlug(icons, c.vendor);
                if (slug && !icons.vendors[slug].main.includes(c.box))
                    problems.push(
                        `${c.vendor}, round ${i + 1}: the round deals it as ${names([c.box])}, but the training says it's known for ${names(icons.vendors[slug].main)}.`,
                    );
            }
        else
            for (const s of r.suites) {
                compare(`${s.vendor}, round ${i + 1} suite`, s.does, s.vendor);
                const slug = iconSlug(icons, s.vendor);
                const sold = slug ? s.distractors.filter((id) => icons.vendors[slug].categories.includes(id)) : [];
                if (sold.length) problems.push(`${s.vendor}, round ${i + 1} suite: ${names(sold)} is a distractor, but the training lists it.`);
            }
    });
    return problems;
};
