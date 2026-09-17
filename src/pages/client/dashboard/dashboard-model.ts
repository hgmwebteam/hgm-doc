/**
 * The client dashboard's data model: the shapes stored in `dashboard_pages.data`, the
 * defaults an older or brand-new row is merged over, and the small pure helpers the
 * rest of the dashboard shares.
 *
 * No JSX and no React, so a test or a script can import it without pulling in the UI.
 */
import type { DashboardContent } from "@/lib/supabase";
import { mergeWebsiteSetup } from "@/pages/client/dashboard/website-setup";

export type BrandColor = DashboardContent["brand"]["colors"][number];
export type Highlight = DashboardContent["instagram"]["highlights"][number];
export type GhlItem = DashboardContent["ghl"]["items"][number];
export type RevenueMonth = DashboardContent["revenue"]["months"][number];
export type QuickLink = DashboardContent["links"][number];
export type VideoGuide = NonNullable<DashboardContent["videos"]>[number];
export type ExampleReel = NonNullable<DashboardContent["reels"]>[number];
export type PinnedPosts = NonNullable<DashboardContent["pinned_posts"]>;
export type PinnedPost = PinnedPosts["posts"][number];
export type PinnedSlide = PinnedPost["slides"][number];
export type Foundation = NonNullable<DashboardContent["foundation"]>;
export type Persona = Foundation["personas"][number];
export type FocusProperty = Foundation["focusProperties"][number];
export type LocalFavorite = Foundation["restaurants"][number];
export type WebsiteLink = Foundation["websiteLinks"][number];

export const STATUS_OPTIONS = ["Onboarding", "Active", "Paused"] as const;

export const normEmail = (e: string) => e.trim().toLowerCase();

/* ── Per-person access ───────────────────────────────────────────────────────
   One row per person an AM has shared the dashboard with. Replaces the flat
   `allowed_emails` + one shared password, which made every listed address
   interchangeable: anyone holding the password could type anyone else's email,
   so a per-person view would have been decorative. `allowed_emails` is still
   written alongside as a derived mirror — the Netlify suggestion function and
   the read-gating RLS policy to come both read that key.

   Still UI-level, not a security boundary: the row is readable with the public
   anon key until that policy lands, so this narrows what a person is SHOWN, not
   what they could extract. Don't describe it to a client as more than that. */

export type DashboardUser = {
    email: string;
    /** This person's own password. Empty falls back to the dashboard's shared one, so
     *  the 49 rows written before this existed keep working untouched. */
    password?: string;
    /**
     * Sections this person may see — an allowlist of SectionId, exactly like
     * `client_visible` but for one address.
     *
     * Absent/null means "follow the dashboard default", which is NOT the same as `[]`
     * ("this person sees Overview and nothing else"). Keeping the two distinct is what
     * lets a section added later reach everyone on the default without an AM re-ticking
     * every person on every dashboard.
     */
    sections?: string[] | null;
};

/** The access list as the UI works with it. A legacy row (allowed_emails only) upgrades
 *  on read — no write, so merely opening a dashboard never rewrites its access. */
export const readDashboardUsers = (content: { dashboard_users?: DashboardUser[]; allowed_emails?: string[] }): DashboardUser[] =>
    content.dashboard_users ?? (content.allowed_emails ?? []).map((email) => ({ email }));

/** The derived mirror written beside `dashboard_users` on every change. */
export const usersToAllowedEmails = (users: DashboardUser[]): string[] => users.map((u) => u.email.trim()).filter(Boolean);

/** The password this person signs in with: their own, else the dashboard's shared one.
 *  Empty means they have no way in — the panel flags that rather than failing silently. */
export const passwordFor = (user: DashboardUser, sharePassword: string): string => (user.password ?? "").trim() || sharePassword.trim();

export const findDashboardUser = (users: DashboardUser[], email: string): DashboardUser | null =>
    users.find((u) => normEmail(u.email) === normEmail(email)) ?? null;

/**
 * The section allowlist that applies to ONE viewer.
 *
 * A person given their own list uses it; everyone else follows the dashboard-wide list an
 * AM sets with the eye toggles. `[]` is a real answer ("Overview only") and must not fall
 * through to the default, which is why this tests for null-ish rather than emptiness — get
 * that wrong and locking someone down to nothing silently shows them everything instead.
 */
export const sectionsForViewer = (user: DashboardUser | null, dashboardDefault: string[] | undefined): string[] =>
    user?.sections ?? dashboardDefault ?? DEFAULT_CLIENT_VISIBLE;

/** ABC-DEF-HGMS — the format the team shares client passwords in. The alphabet drops
 *  I/L/O so a password read aloud on a call can't be mistyped. */
export const genSharePassword = () => {
    const grp = () => Array.from({ length: 3 }, () => "ABCDEFGHJKMNPQRSTUVWXYZ"[Math.floor(Math.random() * 23)]).join("");
    return `${grp()}-${grp()}-HGMS`;
};

/**
 * Status pill colour on the CLIENT dashboard. Local on purpose — the team's Client List
 * keeps its own mapping, where telling Onboarding from Active still matters.
 *
 * Onboarding reads green rather than blue: a client opening their own dashboard shouldn't
 * see a colour that says "not underway yet". Paused stays amber, because that genuinely is
 * a stop and it would be dishonest to paint it as running.
 */
export const statusColor = (status: string) => (status === "Paused" ? "warning" : "success");

export function slugify(name: string): string {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

export const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `id-${Math.random().toString(36).slice(2)}`);

export const DEFAULT_FOUNDATION: Foundation = {
    hosts: "",
    propertyType: "",
    structure: "",
    generalAmenities: "",
    sharedAmenities: "",
    exactLocation: "",
    proximityCities: "",
    proximityAirports: "",
    targetAudience: "",
    uvp: "",
    brandVoice: "",
    taglines: ["", "", ""],
    brandBio: "",
    personas: [],
    personaResonance: "",
    focusProperties: [],
    restaurants: [],
    activities: [],
    corePillars: "",
    emotionalThemes: "",
    promptHidden: false,
    websiteLinks: [],
};

export const emptyPersona = (rank: string): Persona => ({
    id: uid(),
    name: "",
    summary: "",
    rank,
    age: "",
    relationship: "",
    location: "",
    interests: "",
    painPoints: "",
    seeking: "",
    howTheyBook: "",
    keywords: [],
});

export const emptyFocusProperty = (): FocusProperty => ({
    id: uid(),
    name: "",
    link: "",
    location: "",
    guests: "",
    bedrooms: "",
    beds: "",
    bathrooms: "",
    description: "",
    features: "",
    terms: "",
    reviews: ["", "", ""],
});

export const emptyFavorite = (): LocalFavorite => ({ id: uid(), name: "", description: "" });

/**
 * Example Reels is exactly three phones, so the row reads as one deliverable rather than a
 * growing list. Slots are fixed — the team fills, replaces or clears them, never adds a
 * fourth — and each starts with a numbered placeholder title an AM overwrites.
 */
export const REEL_SLOTS = 3;
export const emptyReel = (n: number): ExampleReel => ({ id: uid(), title: `Example ${n}`, description: "", url: "" });
/** Pad whatever a row stored up to the three slots; a row written with more keeps them. */
export const normalizeReels = (reels?: ExampleReel[] | null): ExampleReel[] => {
    const out = [...(reels ?? [])];
    while (out.length < REEL_SLOTS) out.push(emptyReel(out.length + 1));
    return out;
};

export const emptyWebsiteLink = (page = ""): WebsiteLink => ({ id: uid(), page, url: "" });

/* ── Pinned Posts ─────────────────────────────────────────────────────────── */

/** Instagram pins at most three posts to the top of a profile grid. */
export const MAX_PINNED_POSTS = 3;

export const emptyPinnedPost = (): PinnedPost => ({ id: uid(), title: "", caption: "", slides: [] });

/**
 * The three pinned slots always exist, like Example Reels' three phones: the AM drags
 * imported pages into slot 01, 02 or 03 rather than creating posts. Pads a stored list up
 * to three and never drops a stored post — a row written with more keeps them, so nothing a
 * client already approved can vanish on load.
 */
export const normalizePinnedPosts = (posts?: PinnedPost[] | null): PinnedPost[] => {
    const out = (posts ?? []).map((p) => ({ ...p, caption: p.caption ?? "", slides: p.slides ?? [] }));
    while (out.length < MAX_PINNED_POSTS) out.push(emptyPinnedPost());
    return out;
};

/** A slot with no slides is a placeholder: the client never sees it and the phone leaves its tile empty. */
export const filledPinnedPosts = (posts: PinnedPost[]) => posts.filter((p) => p.slides.length > 0);

export const EMPTY_PINNED_POSTS: PinnedPosts = { canva_url: "", handle: "", posts: [] };

/**
 * The sample set the template shows — the three carousels HiddenGem designed for Selah
 * Place, exported from Canva and committed under public/pinned-posts-sample/. Sample content
 * on the template follows the revenue precedent above: the template demonstrates the
 * section, and createDefaultContent strips it so no client copy starts with another host's
 * posts. Also what "Load the sample set" drops into a test client in edit mode.
 */
const samplePost = (title: string, caption: string, file: string, count: number): PinnedPost => ({
    id: `sample-${file}`,
    title,
    caption,
    slides: Array.from({ length: count }, (_, i) => ({
        id: `sample-${file}-${i + 1}`,
        url: `/pinned-posts-sample/${file}-${String(i + 1).padStart(2, "0")}.webp`,
    })),
});

export const SAMPLE_PINNED_POSTS: PinnedPosts = {
    canva_url: "https://www.canva.com/design/DAHLEcUFy7U/pP-I3g5lrEe4dC_mAg7OTg/edit",
    handle: "selah.place",
    posts: [
        samplePost(
            "Follow us to win a free stay",
            "Each year, several lucky followers will be selected to win a free stay. Follow @selah.place, engage on recent posts, and the winner is announced on our story.",
            "win-a-free-stay",
            6,
        ),
        samplePost(
            "Sign up for 10% off your stay",
            "Click the link in our bio and sign up for our email list. Your exclusive 10% off code lands in your inbox — use it on stays of two nights or more.",
            "10-percent-off",
            5,
        ),
        samplePost(
            "Book direct, save on fees",
            "The perfect destination for couples and small families, one hour from Dallas. Skip the third-party fees and save 7–10% booking direct on selah.place.",
            "book-direct",
            7,
        ),
    ],
};

/** Best guess at the handle from the Instagram profile URL an AM already entered. */
export const handleFromProfileUrl = (url: string): string => {
    const m = /instagram\.com\/([A-Za-z0-9._]+)/i.exec(url.trim());
    return m ? m[1].replace(/\/+$/, "") : "";
};

/**
 * Canva share/edit links all carry the design id as the segment after /design/. Anything
 * that isn't a Canva design link returns null, so a stray URL never gets an "Open in Canva"
 * button.
 */
export const parseCanvaUrl = (raw: string): { id: string; url: string } | null => {
    const url = raw.trim();
    const m = /^https:\/\/(?:www\.)?canva\.com\/design\/(D[A-Za-z0-9_-]{6,})(?:\/|$)/i.exec(url);
    return m ? { id: m[1], url } : null;
};

export const filled = (v: string | undefined) => Boolean(v && v.trim());

export const DEFAULT_GHL_ITEMS: GhlItem[] = [
    { label: "Domain & website connected", done: false },
    { label: "Business phone number", done: false },
    { label: "Calendar & online booking", done: false },
    { label: "Sales pipeline", done: false },
    { label: "Automations & follow-up workflows", done: false },
    { label: "Review requests", done: false },
    { label: "Email & SMS templates", done: false },
    { label: "Mobile app installed", done: false },
];

/** Default page links for a client, derived from the shared slug base. */
export const defaultLinks = (base: string): QuickLink[] => [
    { title: "Meta Pixel Setup Guide", description: "Install your tracking pixel step by step.", url: `/${base}-metapixel` },
    { title: "Lead Capture Popup", description: "Your website popup & inline form setup.", url: `/${base}-leadcapture` },
    { title: "Chat Widget", description: "Add the website chat widget to your site.", url: `/${base}-chatwidget` },
];

export const TEMPLATE_CONTENT: DashboardContent = {
    status: "Active",
    logo_url: "",
    sidebar_bg_url: "",
    brand: {
        colors: [
            { name: "Primary", hex: "#7F56D9" },
            { name: "Secondary", hex: "#101828" },
            { name: "Accent", hex: "#F4EBFF" },
            { name: "Neutral", hex: "#FAFAFA" },
        ],
        fonts: "Inter",
        folder_link: "",
        logos: [],
    },
    instagram: { profile_url: "", highlights: [] },
    ghl: { login_url: "https://app.gohighlevel.com", items: DEFAULT_GHL_ITEMS },
    revenue: {
        currency: "USD",
        months: [
            { month: "Jan", revenue: 8200, leads: 34, appointments: 18 },
            { month: "Feb", revenue: 9400, leads: 41, appointments: 22 },
            { month: "Mar", revenue: 11800, leads: 52, appointments: 27 },
            { month: "Apr", revenue: 10900, leads: 47, appointments: 25 },
            { month: "May", revenue: 13600, leads: 61, appointments: 33 },
            { month: "Jun", revenue: 15200, leads: 68, appointments: 37 },
        ],
    },
    links: defaultLinks("yourclient"),
    videos: [],
    reels: normalizeReels(),
    pinned_posts: SAMPLE_PINNED_POSTS,
    foundation: DEFAULT_FOUNDATION,
};

/**
 * True while the palette is still the untouched template — the four Untitled UI purples,
 * which are wrong for every client. Compared by value, not JSON.stringify: Postgres jsonb
 * stores object keys sorted, so a saved swatch returns as {hex,name} while the template
 * literal is {name,hex}, and stringifying made every round-tripped palette look edited.
 */
export const isTemplatePalette = (colors: BrandColor[]) => {
    const tpl = TEMPLATE_CONTENT.brand.colors;
    return colors.length === tpl.length && colors.every((c, i) => c.name === tpl[i].name && c.hex.toLowerCase() === tpl[i].hex.toLowerCase());
};

/**
 * True when nobody has touched the Brand Kit at all — template palette, default font, no
 * logos, no uploads, no folder. A client should see "on the way" for such a kit, never
 * the placeholder purples presented as their official colours.
 */
export const isUntouchedBrandKit = (brand: DashboardContent["brand"]) =>
    isTemplatePalette(brand.colors) &&
    (!brand.fonts.trim() || brand.fonts.trim() === TEMPLATE_CONTENT.brand.fonts) &&
    !(brand.logos ?? []).length &&
    !brand.font_files?.heading &&
    !brand.font_files?.body &&
    !brand.folder_link.trim();

/** Fresh content for a newly created client copy — no sample numbers. */
export const createDefaultContent = (base: string): DashboardContent => ({
    ...TEMPLATE_CONTENT,
    status: "Onboarding",
    revenue: { currency: "USD", months: [] },
    ghl: { ...TEMPLATE_CONTENT.ghl, items: DEFAULT_GHL_ITEMS.map((i) => ({ ...i })) },
    links: defaultLinks(base),
    // A fresh client copy starts with the scaffolding an AM would otherwise add by hand:
    // two ranked personas, one focus property, and a Home row in the sitemap table.
    foundation: {
        ...DEFAULT_FOUNDATION,
        personas: [emptyPersona("Primary"), emptyPersona("Secondary")],
        focusProperties: [emptyFocusProperty()],
        restaurants: [emptyFavorite(), emptyFavorite(), emptyFavorite()],
        activities: [emptyFavorite(), emptyFavorite(), emptyFavorite()],
        websiteLinks: [emptyWebsiteLink("Home"), emptyWebsiteLink(), emptyWebsiteLink()],
    },
    videos: [],
    reels: normalizeReels(),
    pinned_posts: { ...EMPTY_PINNED_POSTS, posts: normalizePinnedPosts() },
    client_visible: [...DEFAULT_CLIENT_VISIBLE],
});

/** Merge a partial jsonb blob from the DB over the defaults so old rows never crash new sections. */
export const mergeContent = (partial?: Partial<DashboardContent> | null): DashboardContent => ({
    ...TEMPLATE_CONTENT,
    ...partial,
    brand: { ...TEMPLATE_CONTENT.brand, ...partial?.brand },
    instagram: { ...TEMPLATE_CONTENT.instagram, ...partial?.instagram },
    ghl: { ...TEMPLATE_CONTENT.ghl, ...partial?.ghl },
    revenue: { ...TEMPLATE_CONTENT.revenue, ...partial?.revenue },
    links: partial?.links ?? TEMPLATE_CONTENT.links,
    videos: partial?.videos ?? [],
    reels: normalizeReels(partial?.reels),
    // No row at all (the template page) shows the sample set; a real row from before the
    // section existed gets the empty shape, never another host's posts.
    pinned_posts: partial
        ? {
              ...EMPTY_PINNED_POSTS,
              ...partial.pinned_posts,
              posts: normalizePinnedPosts(partial.pinned_posts?.posts),
          }
        : TEMPLATE_CONTENT.pinned_posts,
    resources: partial?.resources ?? [],
    // Arrays are spread-hostile: `...partial.foundation` would hand back `undefined` for
    // every list an older row predates, and the section renderers all call .map on them.
    // Each one falls back explicitly. `taglines` is padded to three so the 01/02/03 rail
    // renders even if a row was written with fewer.
    foundation: {
        ...DEFAULT_FOUNDATION,
        ...partial?.foundation,
        taglines: [0, 1, 2].map((i) => partial?.foundation?.taglines?.[i] ?? ""),
        personas: partial?.foundation?.personas ?? [],
        focusProperties: partial?.foundation?.focusProperties ?? [],
        restaurants: partial?.foundation?.restaurants ?? [],
        activities: partial?.foundation?.activities ?? [],
        websiteLinks: partial?.foundation?.websiteLinks ?? [],
        // Deprecated v1 keys — carried through untouched so saving a redesigned document
        // never erases answers a client gave against the old one.
        faqs: partial?.foundation?.faqs ?? [],
    },
    // Absent ⇒ the day-one default. An AM who hides everything stores an empty array,
    // which is meaningfully different from "never set" and must survive as [].
    client_visible: partial?.client_visible ?? [...DEFAULT_CLIENT_VISIBLE],
    website_setup: mergeWebsiteSetup(partial?.website_setup),
});

/** Side-menu taxonomy — mirrors the funnel Dustin walks every client through on the
 * onboarding call: Foundation (the Master Document everything else reads from) feeds
 * Top of funnel (get seen) → Middle of funnel (nurture + capture) → Bottom of funnel
 * (convert to a direct booking). Module scope so the array isn't rebuilt every render. */
export type SectionId =
    | "overview"
    | "intake"
    | "onboarding"
    | "overviewdoc"
    | "foundation"
    | "brand"
    | "videos"
    | "comms"
    | "website"
    | "instagram"
    | "flow"
    | "chatwidget"
    | "ghl"
    | "revenue"
    // Menu entries added with the client-facing side-menu rework. Landing, Pinned Posts and
    // Example Reels have section bodies; Pinned Stories has none yet and renders with the
    // existing "Soon" treatment; Folder of Content is a link out rather than a section.
    //
    // "repeatflow" was here too until it was dropped from the menu in 2026-09. It never had
    // a section body, so nothing was left behind — but an older row's visible_sections may
    // still carry the string, where it now matches nothing and is ignored.
    | "landing"
    | "pinnedposts"
    | "pinnedstories"
    | "reels"
    | "contentfolder"
    // The Website Setup Guide section: the required Netlify account and the AI website
    // opt-in. Kept as "ownerguide" so older #hash links and journey steps still land.
    | "ownerguide"
    // The client help centre. A LINK OUT of the dashboard, like "contentfolder" - it is its
    // own route (/{slug}/help) with its own server-side gate, not a section body on this
    // page. It is here only so it can sit in the side menu and be numbered with everything
    // else; there is no `help` case in the section renderer and there should not be one.
    | "help";

/**
 * What a client can see before an AM reveals anything.
 *
 * The two intake forms and the Website Setup Guide. They're what we need FROM the client
 * on day one, so a brand-new dashboard is still actionable — everything else would
 * otherwise present unfinished work as though it were delivered. An AM reveals each
 * remaining section per client with the eye toggle in edit mode, as it actually ships.
 *
 * The Website Setup Guide is in the default because its first card (a Netlify account in
 * the client's own name) is mandatory for every client, opted in to a website or not.
 * Rows that already store their own list are unaffected: an AM reveals the row there.
 *
 * Stored as an ALLOWLIST rather than a hidden-list on purpose: a section added later
 * defaults to invisible to clients instead of leaking the moment it lands.
 */
export const DEFAULT_CLIENT_VISIBLE: SectionId[] = ["intake", "onboarding", "ownerguide"];

/* ── Merging a drafted Master Document ───────────────────────────────────── */

/** The plain text fields of the Master Document, in section order. */
const DRAFT_TEXT_KEYS = [
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
] as const satisfies readonly (keyof Foundation)[];

const str = (v: unknown) => String(v ?? "").trim();
const strList = (v: unknown) => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);

/**
 * Merge one drafted row list into an existing one.
 *
 * Rows a person filled in are kept EXACTLY as they are and win any collision. Empty rows
 * carry no information, so they're dropped in favour of drafted ones rather than being
 * preserved as blanks. Drafted rows whose key already exists are skipped, so re-running a
 * draft doesn't stack duplicates.
 */
const mergeRows = <T>(current: T[], drafted: T[], isFilled: (r: T) => boolean, key: (r: T) => string): T[] | null => {
    if (!drafted.length) return null;
    const keep = current.filter(isFilled);
    const taken = new Set(keep.map((r) => key(r).toLowerCase()).filter(Boolean));
    const fresh = drafted.filter((r) => {
        const k = key(r).toLowerCase();
        if (!k || taken.has(k)) return false;
        taken.add(k);
        return true;
    });
    if (!fresh.length) return null;
    return [...keep, ...fresh];
};

/**
 * Turn a drafted Master Document into a patch that can only ADD.
 *
 * The one rule: a draft never changes or erases something a person wrote. Every text field
 * is skipped when it already has content, and every row list keeps its filled rows. That is
 * what makes the Draft button safe to press twice — the second run is a no-op on everything
 * the first run produced and the AM then edited.
 *
 * It exists as a pure function so the guarantee is checkable in one place rather than
 * spread through the page's click handler. See the sibling Overview draft, which spreads the
 * model's reply straight into state and blanks fields for exactly this reason.
 *
 * Unknown keys are ignored: the drafting function's schema and this document can drift, and
 * when they do the extra keys should vanish here rather than be saved into a client's row.
 */
export const mergeFoundationDraft = (current: Foundation, draft: Record<string, unknown>): Partial<Foundation> => {
    const patch: Record<string, unknown> = {};

    for (const k of DRAFT_TEXT_KEYS) {
        const v = str(draft[k]);
        if (v && !filled(current[k])) patch[k] = v;
    }

    if (!current.taglines.some(filled)) {
        const taglines = strList(draft.taglines);
        if (taglines.length) patch.taglines = taglines;
    }

    if (Array.isArray(draft.personas)) {
        const drafted: Persona[] = (draft.personas as Record<string, unknown>[]).map((p) => ({
            ...emptyPersona(str(p.rank) || "Primary"),
            name: str(p.name),
            summary: str(p.summary),
            age: str(p.age),
            relationship: str(p.relationship),
            location: str(p.location),
            interests: str(p.interests),
            painPoints: str(p.painPoints),
            seeking: str(p.seeking),
            howTheyBook: str(p.howTheyBook),
            keywords: strList(p.keywords),
        }));
        const merged = mergeRows(
            current.personas,
            drafted,
            (p) => filled(p.name) || filled(p.summary),
            (p) => p.name,
        );
        if (merged) patch.personas = merged;
    }

    if (Array.isArray(draft.focusProperties)) {
        const drafted: FocusProperty[] = (draft.focusProperties as Record<string, unknown>[]).map((p) => ({
            ...emptyFocusProperty(),
            name: str(p.name),
            link: str(p.link),
            location: str(p.location),
            guests: str(p.guests),
            bedrooms: str(p.bedrooms),
            beds: str(p.beds),
            bathrooms: str(p.bathrooms),
            description: str(p.description),
            features: str(p.features),
            terms: str(p.terms),
            reviews: strList(p.reviews),
        }));
        const merged = mergeRows(
            current.focusProperties,
            drafted,
            (p) => filled(p.name) || filled(p.link),
            (p) => p.name,
        );
        if (merged) patch.focusProperties = merged;
    }

    for (const list of ["restaurants", "activities"] as const) {
        if (!Array.isArray(draft[list])) continue;
        const drafted: LocalFavorite[] = (draft[list] as Record<string, unknown>[]).map((r) => ({
            ...emptyFavorite(),
            name: str(r.name),
            description: str(r.description),
        }));
        // Filling an EMPTY description on a row that already exists doesn't change anything a
        // person wrote — without this, a re-draft could never add the website addresses to
        // rows an earlier draft created with names only.
        const byName = new Map(drafted.filter((r) => filled(r.name)).map((r) => [r.name.trim().toLowerCase(), r.description]));
        let filledExisting = false;
        const existing = current[list].map((r) => {
            const d = byName.get(r.name.trim().toLowerCase());
            if (!filled(r.description) && d && filled(d)) {
                filledExisting = true;
                return { ...r, description: d };
            }
            return r;
        });
        const merged = mergeRows(
            existing,
            drafted,
            (r) => filled(r.name),
            (r) => r.name,
        );
        if (merged) patch[list] = merged;
        else if (filledExisting) patch[list] = existing;
    }

    if (Array.isArray(draft.websiteLinks)) {
        const drafted: WebsiteLink[] = (draft.websiteLinks as Record<string, unknown>[]).map((l) => ({
            ...emptyWebsiteLink(str(l.page)),
            url: str(l.url),
        }));
        const merged = mergeRows(
            current.websiteLinks,
            drafted,
            (l) => filled(l.page) || filled(l.url),
            (l) => l.url,
        );
        if (merged) patch.websiteLinks = merged;
    }

    return patch as Partial<Foundation>;
};

/* Eye / eye-off, matching the owner guide's per-client step toggle so the gesture reads
   the same in both places. Inline SVG for the same reason it is there: these are 13px
   controls inside a dense row, not icon-set sizes. */
