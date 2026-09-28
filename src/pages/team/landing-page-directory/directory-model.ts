/**
 * Landing Page Directory — the pure model. No React in here.
 *
 * The directory is the web team's list of every client's landing-page setup: where it is hosted,
 * who manages the client, the four channel links (one per traffic source, each a fixed slug on
 * the client's domain), the stays and property pages, and whether the page is live with its meta
 * tags installed. It came into the portal from a standalone page the team built; the rules below
 * are that page's rules, kept so the two agree on every derived value.
 *
 * Everything persists as one JSON document (`DirectoryData`) in `sop_pages` under
 * `DIRECTORY_SLUG`, the same store the owner guides use.
 */

export type Hosting = "GoHighLevel" | "Netlify";
export type ChannelKey = "instagram" | "facebook" | "metaAds" | "tiktok";

export interface DirectoryProperty {
    name: string;
    url: string;
}

export interface DirectoryClient {
    name: string;
    platform: Hosting;
    /** Account manager, by first name (the roster in `TEAM`). */
    manager?: string;
    /** One of `DESIGNS`, or unset. */
    design?: string;
    /** Master brand doc link. */
    doc?: string;
    /** The landing page's domain, e.g. `go.example.com`. Channel links derive from it. */
    domain?: string;
    /** A channel link set by hand, overriding the one derived from the domain. */
    instagram?: string;
    facebook?: string;
    metaAds?: string;
    tiktok?: string;
    /** Built on the current universal slugs (`CHANNELS[].slug`). Unset means the set every client
     *  added before 25 Sep 2026 was built on (`legacySlug`), which those clients keep. */
    newSlugs?: boolean;
    /** The stays page, when it isn't `domain + STAYS_SLUG`. */
    stays?: string;
    /** The client has no stays page: none is derived from the domain, and the card leaves it out. */
    noStays?: boolean;
    properties?: DirectoryProperty[];
    metaTags?: boolean;
    live?: boolean;
    /** Still onboarding: listed under Upcoming and never counted as needing attention. */
    upcoming?: boolean;
    /** YYYY-MM-DD, set when the client is added here. */
    added?: string;
}

export interface DirectoryPrompt {
    id: string;
    title: string;
    text: string;
    /** One line on when to use it. */
    use?: string;
}

export interface PromptSection {
    id: string;
    title: string;
    prompts: DirectoryPrompt[];
}

export interface DirectoryData {
    clients: DirectoryClient[];
    sections: PromptSection[];
}

/** The `sop_pages` row the whole directory lives in. */
export const DIRECTORY_SLUG = "landing-page-directory";

/** The four traffic channels and the universal slug each one's landing page lives at. `legacySlug`
 *  is the slug clients added before 25 Sep 2026 were built on; they keep it (see `newSlugs`). */
export const CHANNELS: { key: ChannelKey; label: string; slug: string; legacySlug: string }[] = [
    { key: "instagram", label: "Instagram", slug: "/booknow", legacySlug: "/booknow" },
    { key: "facebook", label: "Facebook", slug: "/info", legacySlug: "/signupnow" },
    { key: "metaAds", label: "Meta Ads", slug: "/signup", legacySlug: "/booking" },
    { key: "tiktok", label: "TikTok", slug: "/promo", legacySlug: "/promo" },
];
export const STAYS_SLUG = "/stays";

export const DESIGNS: { id: string; label: string; full: string }[] = [
    { id: "design1", label: "Old", full: "Old Landing Page" },
    { id: "design2", label: "Standard", full: "Standard Landing Page" },
    { id: "enhanced", label: "Enhance", full: "Enhance Landing Page" },
];

/** The account managers, by first name — how the directory has always stored them. Mirrors the
 *  first names of ACCOUNT_MANAGERS in dashboard-screen; anyone already assigned to a client is
 *  offered as well, so a name missing here still shows up. */
export const TEAM = ["Charlotte", "Makenna", "Alicia", "Nicole", "Ananya", "Chiara", "Kristal"];

/* ── Names, ids and links ─────────────────────────────────────────── */

export const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

export const clientSlug = (s: string) =>
    norm(s)
        .toLowerCase()
        .replace(/&/g, "and")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

/** A client's id is its name as a slug: two clients can't share a name, and renaming moves it. */
export const clientId = (c: DirectoryClient) => clientSlug(c.name);

export const byName = (a: DirectoryClient, b: DirectoryClient) => norm(a.name).localeCompare(norm(b.name), "en", { sensitivity: "base" });

/** A channel's universal slug, from the legacy set for a client that predates the current one. */
export const slugOf = (key: ChannelKey, legacy = false) => {
    const ch = CHANNELS.find((c) => c.key === key);
    return (legacy ? ch?.legacySlug : ch?.slug) ?? "";
};

/** Whether a saved client is still on the legacy slugs. */
export const isLegacy = (c: DirectoryClient) => !c.newSlugs;

/** The channel link the domain implies, or nothing without a domain. */
export const derivedFor = (domain: string, key: ChannelKey, legacy = false) => (domain ? `https://${domain}${slugOf(key, legacy)}` : "");

/** A hand-set link wins; otherwise the domain's derived one. */
export const linkOf = (c: DirectoryClient, key: ChannelKey) => c[key] || derivedFor(c.domain ?? "", key, isLegacy(c));

export const staysOf = (c: DirectoryClient) => (c.noStays ? "" : c.stays || (c.domain ? `https://${c.domain}${STAYS_SLUG}` : ""));

export const propsOf = (c: DirectoryClient): DirectoryProperty[] => (Array.isArray(c.properties) ? c.properties : []).filter((p) => p && p.url);

export const channelLinkCount = (c: DirectoryClient) => CHANNELS.filter((ch) => linkOf(c, ch.key)).length;

export const normDomain = (v: string) =>
    (v || "")
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/\/.*$/, "");

export const isDomain = (d: string) => /^[a-z0-9.-]+\.[a-z0-9-]+$/i.test(d);

export const normalizeUrl = (v: string) => {
    const t = (v || "").trim();
    if (!t) return "";
    return /^https?:\/\//i.test(t) ? t : `https://${t}`;
};

/** A client saved before domains were a field: read the domain back out of a channel link that
 *  sits at its universal slug. */
export const inferDomain = (c: DirectoryClient) => {
    for (const ch of CHANNELS) {
        const u = c[ch.key];
        if (!u) continue;
        const m = u.match(/^https?:\/\/([^/]+)(\/.*)?$/i);
        if (m && [ch.slug, ch.legacySlug].includes(m[2] || "")) return m[1].toLowerCase();
    }
    return "";
};

export const showUrl = (u: string) => u.replace(/^https?:\/\//, "").replace(/\/$/, "");

export const managerOf = (c: DirectoryClient) => (c.manager ?? "").trim();

export const managersOf = (clients: DirectoryClient[]) => [...new Set(clients.map(managerOf).filter(Boolean))].sort((a, b) => a.localeCompare(b));

export const designName = (c: DirectoryClient) => DESIGNS.find((d) => d.id === c.design)?.full ?? "";

/* ── Status ───────────────────────────────────────────────────────── */

export type StateTone = "live" | "warn" | "soon" | "off" | "tags";

export interface ClientState {
    tone: StateTone;
    label: string;
    detail: string;
}

/** One status for a client card: live and tagged is the only good state. */
export const cardState = (c: DirectoryClient): ClientState => {
    const detail = `${c.live ? "Live" : "Not live"} · ${c.metaTags ? "Meta tags added" : "Meta tags pending"}`;
    if (c.upcoming && !c.live) return { tone: "soon", label: "Upcoming", detail };
    if (c.live && c.metaTags) return { tone: "live", label: "Live", detail };
    if (c.live) return { tone: "warn", label: "Live · tags missing", detail };
    return { tone: "off", label: "Offline", detail };
};

export const liveState = (c: DirectoryClient): ClientState => {
    if (c.live) return { tone: "live", label: "Live", detail: "Landing page is published" };
    if (c.upcoming) return { tone: "soon", label: "Upcoming", detail: "Onboarding" };
    return { tone: "off", label: "Offline", detail: "Landing page is not published yet" };
};

export const tagState = (c: DirectoryClient): ClientState =>
    c.metaTags
        ? { tone: "tags", label: "Added", detail: "Tracking pixels and meta tags are installed" }
        : { tone: "off", label: "Missing", detail: "Meta tags not added yet" };

/* ── Sorting and searching ────────────────────────────────────────── */

export type SortKey = "name" | "live" | "tags" | "manager" | "platform";

const LIVE_RANK: Record<StateTone, number> = { live: 0, soon: 1, off: 2, warn: 0, tags: 0 };

const sortValue = (c: DirectoryClient, key: SortKey): string | number => {
    switch (key) {
        case "name":
            return norm(c.name).toLowerCase();
        case "live":
            return LIVE_RANK[liveState(c).tone];
        case "tags":
            return c.metaTags ? 0 : 1;
        case "manager":
            return (c.manager || "￿").toLowerCase();
        case "platform":
            return (c.platform || "").toLowerCase();
    }
};

export const sortClients = (clients: DirectoryClient[], key: SortKey, dir: 1 | -1) =>
    [...clients].sort((a, b) => {
        const va = sortValue(a, key);
        const vb = sortValue(b, key);
        if (va !== vb) return va < vb ? -dir : dir;
        return norm(a.name).toLowerCase().localeCompare(norm(b.name).toLowerCase());
    });

/** `q` is the typed text, any case; accents are ignored on both sides. */
export const matchesQuery = (c: DirectoryClient, q: string) => {
    const needle = norm(q).trim().toLowerCase();
    if (!needle) return true;
    return norm(c.name).toLowerCase().includes(needle) || c.platform.toLowerCase().includes(needle);
};

/* ── Alerts ───────────────────────────────────────────────────────── */

export type AlertLevel = "high" | "mid" | "low";
export type EditorTab = "details" | "links" | "status";

export interface AlertRule {
    id: string;
    level: AlertLevel;
    label: string;
    hint: string;
    /** The editor tab where the fix lives. */
    tab: EditorTab;
    test: (c: DirectoryClient) => boolean;
}

/** What "needs attention" means, in the order it's shown. Upcoming clients are exempt (see alertsFor). */
export const ALERTS: AlertRule[] = [
    {
        id: "live-no-tags",
        level: "high",
        label: "Live without meta tags",
        hint: "Tracking is missing on a published page.",
        tab: "status",
        test: (c) => !!c.live && !c.metaTags,
    },
    {
        id: "no-domain",
        level: "mid",
        label: "No landing page domain",
        hint: "Channel links and the stays page cannot be built yet.",
        tab: "links",
        test: (c) => !c.domain && !CHANNELS.some((ch) => c[ch.key]),
    },
    {
        id: "no-manager",
        level: "mid",
        label: "No account manager",
        hint: "Not listed under anyone in Viewing as.",
        tab: "details",
        test: (c) => !managerOf(c),
    },
    { id: "no-doc", level: "low", label: "No brand doc", hint: "Master brand doc link is empty.", tab: "details", test: (c) => !c.doc },
];

export interface AlertHits {
    rule: AlertRule;
    hits: DirectoryClient[];
}

/** Every rule with at least one client failing it. Upcoming clients are still being onboarded,
 *  so they never count. */
export const alertsFor = (clients: DirectoryClient[]): AlertHits[] =>
    ALERTS.map((rule) => ({ rule, hits: clients.filter((c) => !c.upcoming && rule.test(c)).sort(byName) })).filter((a) => a.hits.length > 0);

export const issuesFor = (c: DirectoryClient): AlertRule[] => (c.upcoming ? [] : ALERTS.filter((r) => r.test(c)));

/* ── Misc ─────────────────────────────────────────────────────────── */

export const todayIso = () => new Date().toISOString().slice(0, 10);

export const fmtAdded = (iso: string) => {
    const d = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(d.getTime())) return iso;
    const days = Math.round((Date.now() - d.getTime()) / 86400000);
    if (days <= 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

/** An id for a new prompt or section: its title as a slug plus a time suffix, so two prompts
 *  with the same title still differ. */
export const newId = (title: string, fallback: string) => `${clientSlug(title) || fallback}-${Date.now().toString(36)}`;

export const emptyClient = (): DirectoryClient => ({ name: "", platform: "GoHighLevel" });

/* ── Loading ──────────────────────────────────────────────────────── */

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

const isClient = (v: unknown): v is DirectoryClient => isRecord(v) && typeof v.name === "string" && v.name.trim().length > 0;

const isPrompt = (v: unknown): v is DirectoryPrompt => isRecord(v) && typeof v.id === "string" && typeof v.title === "string" && typeof v.text === "string";

const isSection = (v: unknown): v is PromptSection => isRecord(v) && typeof v.id === "string" && typeof v.title === "string";

/**
 * The stored document, checked field by field. A half-written or older row keeps whatever it has
 * and takes the rest from `seed`; a row that is nothing like a directory is the seed outright.
 */
export const normalizeDirectoryData = (raw: unknown, seed: DirectoryData): DirectoryData => {
    const obj = isRecord(raw) ? raw : {};
    const clients = Array.isArray(obj.clients)
        ? (obj.clients as unknown[]).filter(isClient).map((c) => ({ ...c, platform: c.platform === "Netlify" ? "Netlify" : "GoHighLevel" }) as DirectoryClient)
        : seed.clients;
    const sections = Array.isArray(obj.sections)
        ? (obj.sections as unknown[])
              .filter(isSection)
              .map((s) => ({ id: s.id, title: s.title, prompts: (Array.isArray(s.prompts) ? (s.prompts as unknown[]) : []).filter(isPrompt) }))
        : seed.sections;
    return { clients, sections };
};
