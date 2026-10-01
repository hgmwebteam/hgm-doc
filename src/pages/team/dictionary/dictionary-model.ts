/**
 * The Industry Acumen Dictionary's model: the stored shape, the labels the master
 * leaves to us, and the search. No React, so this is the one file to open when a
 * search returns the wrong thing. dictionary-model.check.ts pins its behaviour.
 *
 * The data is `src/data/ref_dictionary-v2-253.json`, a master kept OUTSIDE this
 * repo and dropped in whole under the same name. Never edit it here. It is loaded
 * lazily through dictionary-data.ts, so it is its own ~45 KB chunk rather than
 * weight on every page of the site.
 *
 * Only slug, term, tier, section and gloss are required below. A replaced master
 * that loses one of those fails `tsc -b`, so Netlify keeps the last good deploy;
 * every other field may be null, empty or missing and is simply left off the page.
 *
 * Search runs in memory: one pass over 253 entries costs well under a millisecond,
 * so there is no index server and no library. Ranking, best first:
 *   1 exact: the term, its acronym, an alias, or the text in its brackets
 *   2 the term or an alias starts with the query
 *   3 a later word of the term starts with the query
 *   4 the query is inside the term or an alias
 *   5 the query is inside the definition (gloss)
 *   6 a typo of the term: edit distance 1 for 4–6 characters, 2 for 7 or more
 * Ties go to tier A, then B, then C, then A–Z.
 *
 * Matching ignores case, accents and punctuation, spaces included, so "revpar",
 * "Rev PAR" and "rev-par" are one query. Two refinements keep that from matching
 * nonsense: a substring (rules 4–5) must start at a word or stay inside one word,
 * so "adt" is not found in "le|ad t|ime"; and filler words (and, the, per…) are
 * not typo targets, so "land" is not a typo of every "… and …" term.
 */

export type DictionaryLink = { title: string; url: string; checked?: string | null };

export type DictionaryCore = {
    worked?: string[] | null;
    hgm?: string | null;
    confusions?: string | null;
    links?: DictionaryLink[] | null;
};

export type DictionaryEntry = {
    slug: string;
    term: string;
    tier: string;
    section: number;
    gloss: string;
    origin?: string | null;
    formula?: string | null;
    example?: string | null;
    owner?: string | null;
    usage?: string | null;
    source?: string | null;
    aliases?: string[] | null;
    related?: string[] | null;
    core?: DictionaryCore | null;
};

/* ── Labels the master leaves to us ─────────────────────────────── */

/** The master stores sections as numbers only. A number missing here still renders, as "Section N". */
export const SECTION_NAMES: Record<number, string> = {
    1: "Core revenue metrics",
    2: "Rates, pricing and restrictions",
    3: "Distribution and OTA economics",
    4: "Demand, segments and time",
    5: "Property types, structure and ownership",
    6: "Guest behaviour and reputation",
    7: "Marketing metrics and HGM's translation",
    8: "Tools and software, by category",
    9: "The owner-operator mindset",
};

export const sectionName = (section: number) => SECTION_NAMES[section] ?? `Section ${section}`;

/** Every entry carries its tier as a badge: "Tier A", "Tier B", "Tier C" (decided 2026-10-01). */
export const tierBadge = (tier: string): string | null => (tier.trim() ? `Tier ${tier.trim()}` : null);

/** The browse view's filters: everything, or one tier. Counts come from the data, never hard-coded. */
export type DictionaryFilter = "all" | "A" | "B" | "C";

export const FILTERS: { id: DictionaryFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "A", label: "Tier A" },
    { id: "B", label: "Tier B" },
    { id: "C", label: "Tier C" },
];

export const matchesFilter = (entry: DictionaryEntry, filter: DictionaryFilter) => filter === "all" || entry.tier === filter;

const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });
export const byTerm = (a: DictionaryEntry, b: DictionaryEntry) => collator.compare(a.term, b.term);

/** Browse view: sections in number order, entries A–Z inside each. Empty sections are dropped. */
export const groupBySection = (entries: DictionaryEntry[]) => {
    const groups = new Map<number, DictionaryEntry[]>();
    for (const e of entries) groups.set(e.section, [...(groups.get(e.section) ?? []), e]);
    return [...groups.entries()].sort(([a], [b]) => a - b).map(([section, list]) => ({ section, name: sectionName(section), entries: list.sort(byTerm) }));
};

/**
 * A link in `core.links` is either a web page or an internal doctrine file written
 * `repo:revenue-management.md`. Only http(s) becomes an <a>; anything else is text,
 * so a stray scheme in the master can never become a clickable script.
 */
export const linkKind = (url: string): { kind: "web"; href: string } | { kind: "doctrine"; file: string } | { kind: "text" } => {
    if (/^https?:\/\//i.test(url)) return { kind: "web", href: url };
    if (url.startsWith("repo:")) return { kind: "doctrine", file: url.slice("repo:".length) };
    return { kind: "text" };
};

/* ── Normalising ────────────────────────────────────────────────── */

// Apostrophes are dropped, not split on, so "HGM's" and "HGM’s" both read "hgms".
const APOSTROPHES = /['`‘’ʼ]/g;

/** Words: runs of a–z and 0–9 after folding case and accents; everything else separates. */
export const words = (s: string) =>
    s
        .normalize("NFKD")
        .replace(APOSTROPHES, "")
        .replace(/\p{M}/gu, "")
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean);

/** The words joined with nothing between them: "Rev PAR", "rev-par" and "RevPAR" are all "revpar". */
export const compact = (s: string) => words(s).join("");

type Field = { words: string[]; text: string; starts: number[]; ends: number[] };

const field = (s: string): Field => {
    const w = words(s);
    const starts: number[] = [];
    const ends: number[] = [];
    let text = "";
    for (const x of w) {
        starts.push(text.length);
        text += x;
        ends.push(text.length);
    }
    return { words: w, text, starts, ends };
};

/* ── Edit distance ──────────────────────────────────────────────── */

/** Levenshtein distance. With `max`, gives up early and returns max + 1 once the answer must exceed it. */
export const editDistance = (a: string, b: string, max = Infinity) => {
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > max) return max + 1;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    let cur = new Array<number>(b.length + 1);
    for (let i = 1; i <= a.length; i++) {
        cur[0] = i;
        let rowMin = i;
        for (let j = 1; j <= b.length; j++) {
            const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
            cur[j] = v;
            if (v < rowMin) rowMin = v;
        }
        if (rowMin > max) return max + 1;
        [prev, cur] = [cur, prev];
    }
    return prev[b.length];
};

/* ── Reading a term ─────────────────────────────────────────────── */

/**
 * Acronym-like: two or more capitals, making up at least half the letters.
 * ADR, RevPAR, GOPPAR, ToF, OTAs pass; GoHighLevel and TravelAds do not.
 */
const isAcronym = (token: string) => {
    const letters = token
        .replace(/['’]s$/, "")
        .replace(/[^A-Za-z0-9+]/g, "")
        .replace(/[^A-Za-z]/g, "");
    if (letters.length < 2) return false;
    const upper = (letters.match(/[A-Z]/g) ?? []).length;
    return upper >= 2 && upper * 2 >= letters.length;
};

/**
 * Split "X (y)" into its parts and work out which side is the acronym:
 * "ADR (average daily rate)", "Effective commission (EC)", "Funnel stages (ToF, MoF, BoF)".
 * A bracket that is neither an acronym nor an expansion is a qualifier: "Ad (Meta)".
 */
export const parseTerm = (term: string): { name: string; bracket: string | null; acronyms: string[] } => {
    const m = term.match(/^(.*?)\s*\(([^()]*)\)\s*(.*)$/);
    if (!m) return { name: term, bracket: null, acronyms: [] };
    const [, outside, inner] = m;
    const outTokens = outside.split(/\s+/).filter(Boolean);
    const inTokens = inner.split(/[\s,]+/).filter(Boolean);
    let acronyms: string[] = [];
    if (outTokens.length && outTokens.every(isAcronym)) acronyms = [outside];
    else if (outTokens.length > 1 && isAcronym(outTokens[0])) acronyms = [outTokens[0]];
    else if (inTokens.length && inTokens.every(isAcronym)) acronyms = inTokens;
    return { name: outside, bracket: inner, acronyms };
};

/* ── Index and search ───────────────────────────────────────────── */

const STOPWORDS = new Set(["a", "an", "and", "as", "at", "by", "for", "in", "of", "on", "or", "per", "the", "to", "vs", "with"]);
const TIER_RANK: Record<string, number> = { A: 0, B: 1, C: 2 };

export type IndexedEntry = {
    entry: DictionaryEntry;
    tierRank: number;
    term: Field;
    aliases: Field[];
    gloss: Field;
    /** Compact forms that count as an exact match (rule 1). */
    exact: Set<string>;
    /** Compact forms a typo is measured against (rule 6), before single words. */
    typoTargets: string[];
    /** Single words of the term and aliases, filler words removed. */
    typoWords: string[];
};

export const buildIndex = (entries: DictionaryEntry[]): IndexedEntry[] =>
    entries.map((entry) => {
        const parsed = parseTerm(entry.term);
        const term = field(entry.term);
        const aliases = (entry.aliases ?? []).filter((a) => typeof a === "string" && a.trim()).map(field);
        const name = compact(parsed.name);
        const bracket = parsed.bracket ? compact(parsed.bracket) : "";
        const acronyms = parsed.acronyms.map(compact).filter(Boolean);
        // "Resort fee / amenity fee" and "(cost per mille — cost per thousand impressions)" name
        // two things; each half is a typo target of its own, so "amenty fee" still lands.
        const halves = [
            ...(!parsed.bracket && entry.term.includes("/") ? entry.term.split(/\s*\/\s*/) : []),
            ...(parsed.bracket && /\s[—–]\s/.test(parsed.bracket) ? parsed.bracket.split(/\s+[—–]\s+/) : []),
        ].map(compact);
        const exact = new Set([term.text, name, bracket, ...acronyms, ...aliases.map((a) => a.text)].filter(Boolean));
        const typoTargets = [...new Set([...acronyms, name, bracket, ...aliases.map((a) => a.text), ...halves].filter(Boolean))];
        const typoWords = [...new Set([...term.words, ...aliases.flatMap((a) => a.words)])].filter((w) => !STOPWORDS.has(w));
        return { entry, tierRank: TIER_RANK[entry.tier] ?? 3, term, aliases, gloss: field(entry.gloss ?? ""), exact, typoTargets, typoWords };
    });

/** Rules 4–5: the query sits at a word start, or wholly inside one word — never straddling a word break mid-word. */
const contains = (f: Field, q: string) => {
    for (let p = f.text.indexOf(q); p !== -1; p = f.text.indexOf(q, p + 1)) {
        let w = 0;
        while (w + 1 < f.starts.length && f.starts[w + 1] <= p) w++;
        if (f.starts[w] === p || p + q.length <= f.ends[w]) return true;
    }
    return false;
};

/** Rule 3: a word after the first starts the query (compared compactly, so "daily rate" works). */
const laterWordStarts = (f: Field, q: string) => f.starts.slice(1).some((s) => f.text.startsWith(q, s));

export type Rule = 1 | 2 | 3 | 4 | 5 | 6;

/** Which rule an entry matches a compact query by, or null. Exposed for the self-check. */
export const scoreEntry = (x: IndexedEntry, q: string): Rule | null => {
    if (x.exact.has(q)) return 1;
    if (x.term.text.startsWith(q) || x.aliases.some((a) => a.text.startsWith(q))) return 2;
    if (laterWordStarts(x.term, q)) return 3;
    if (contains(x.term, q) || x.aliases.some((a) => contains(a, q))) return 4;
    if (contains(x.gloss, q)) return 5;
    if (q.length >= 4) {
        const max = q.length <= 6 ? 1 : 2;
        if ([...x.typoTargets, ...x.typoWords].some((t) => editDistance(q, t, max) <= max)) return 6;
    }
    return null;
};

export type Hit = { entry: DictionaryEntry; rule: Rule };

/** Every match, best first. The page shows the first 25 and offers the rest. */
export const search = (index: IndexedEntry[], query: string): Hit[] => {
    const q = compact(query);
    if (!q) return [];
    const hits: { x: IndexedEntry; rule: Rule }[] = [];
    for (const x of index) {
        const rule = scoreEntry(x, q);
        if (rule) hits.push({ x, rule });
    }
    hits.sort((a, b) => a.rule - b.rule || a.x.tierRank - b.x.tierRank || collator.compare(a.x.entry.term, b.x.entry.term));
    return hits.map(({ x, rule }) => ({ entry: x.entry, rule }));
};

/** No match at all: the closest terms by edit distance, measured against the same strings the typo rule uses. */
export const suggest = (index: IndexedEntry[], query: string, count = 3): DictionaryEntry[] => {
    const q = compact(query);
    if (!q) return [];
    return index
        .map((x) => ({ x, d: Math.min(...[...x.typoTargets, ...x.typoWords].map((t) => editDistance(q, t))) }))
        .sort((a, b) => a.d - b.d || a.x.tierRank - b.x.tierRank || collator.compare(a.x.entry.term, b.x.entry.term))
        .slice(0, count)
        .map(({ x }) => x.entry);
};
