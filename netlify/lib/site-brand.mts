import { ASSET_CAP, PAGE_CAP, asText, grab } from "./client-sources.mts";

/**
 * Reads a client's website down to a draft Brand Kit: palette, the two typefaces, logos.
 *
 * NO HEX IS INVENTED. Every colour returned is one the site's own CSS or markup declares;
 * the only transformation is exact colour-space conversion (an `oklch()` or `lab()` value
 * becomes the hex it already is). What this module decides is which declared colours are
 * the BRAND, and that is where the first version went wrong.
 *
 * It counted occurrences. A stylesheet mentions white and grey hundreds of times for
 * borders, shadows and resets, while the brand colour paints the header and the Book button
 * in a handful of declarations — so every kit came back black, white and greys. On
 * hiddengem.media the gold appeared 24 times and still ranked below `--tw-ring-offset-color`.
 *
 * So a colour is now scored by WHERE it is used, as a stand-in for how much of the page it
 * paints (checked against a headless-browser measurement of the same sites — see
 * scripts/brand-kit-eval.mts):
 *
 *  - The selector's role. A background on a button selector or the site header is worth far
 *    more than a border colour on an arbitrary class.
 *  - Whether the selector is on THIS page at all. A theme ships CSS for every page, and a
 *    framework ships its whole palette; a rule whose classes appear nowhere in the homepage
 *    HTML paints nothing on it, so it barely counts. Classes the page uses a lot count more.
 *  - `var()` references are resolved, so `.btn { background: var(--primary) }` credits the
 *    colour `--primary` holds, with the button's weight.
 *  - `<meta name="theme-color">` is the site telling the browser its brand colour outright.
 *
 * Near-greys are ranked apart from chromatic colours, so a grey can be the kit's Text or
 * Background but never its Primary.
 */

/* ── colour parsing & conversion ────────────────────────────────────────── */

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const toByte = (n: number) => Math.round(clamp01(n) * 255);
const hexOf = (r: number, g: number, b: number) =>
    "#" +
    [r, g, b]
        .map((n) => toByte(n).toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase();
const gamma = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
const linear = (v: number) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));

function oklabToHex(L: number, a: number, b: number) {
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    return hexOf(
        gamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
        gamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
        gamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
    );
}

/** CIE Lab (D50, as CSS defines `lab()`) → sRGB, via the CSS Color 4 reference matrices. */
function labToHex(L: number, a: number, b: number) {
    const e = 216 / 24389;
    const k = 24389 / 27;
    const fy = (L + 16) / 116;
    const fx = a / 500 + fy;
    const fz = fy - b / 200;
    const x = (fx ** 3 > e ? fx ** 3 : (116 * fx - 16) / k) * (0.3457 / 0.3585);
    const y = L > k * e ? fy ** 3 : L / k;
    const z = (fz ** 3 > e ? fz ** 3 : (116 * fz - 16) / k) * ((1 - 0.3457 - 0.3585) / 0.3585);
    return hexOf(
        gamma(3.1341359569958707 * x - 1.6173863321612538 * y - 0.4906619460083532 * z),
        gamma(-0.978795502912089 * x + 1.916254567259524 * y + 0.03344273116131949 * z),
        gamma(0.07195537988411677 * x - 0.2289768264158322 * y + 1.405386058324125 * z),
    );
}

function hslToHex(h: number, s: number, l: number) {
    const k = (n: number) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return hexOf(f(0), f(8), f(4));
}

/** A colour's alpha below this reads as a tint or an overlay, not a brand colour. */
const MIN_ALPHA = 0.6;

/** Numbers inside a colour function; `%` kept so each space can scale it its own way. */
const args = (inner: string) =>
    inner
        .replace(/,/g, " ")
        .split(/[\s/]+/)
        .filter(Boolean)
        .map((t) => ({ n: t === "none" ? 0 : parseFloat(t), pct: t.endsWith("%"), raw: t }));

/**
 * Any CSS colour token → "#RRGGBB", or null for things that aren't a solid colour
 * (transparent, low alpha, color-mix(), currentColor, keywords).
 */
export function parseColor(token: string): string | null {
    const t = token.trim().toLowerCase();
    if (t.startsWith("#")) {
        const h = t.slice(1);
        if (!/^[0-9a-f]+$/.test(h) || ![3, 4, 6, 8].includes(h.length)) return null;
        const full = h.length <= 4 ? [...h].map((c) => c + c).join("") : h;
        if (full.length === 8 && parseInt(full.slice(6), 16) / 255 < MIN_ALPHA) return null;
        return `#${full.slice(0, 6).toUpperCase()}`;
    }
    const m = t.match(/^(rgba?|hsla?|lab|lch|oklab|oklch)\((.*)\)$/);
    if (!m) return null;
    const p = args(m[2]);
    if (p.length < 3 || p.slice(0, 3).some((x) => Number.isNaN(x.n))) return null;
    if (p[3] && (p[3].pct ? p[3].n / 100 : p[3].n) < MIN_ALPHA) return null;
    const [a, b, c] = p;
    switch (m[1]) {
        case "rgb":
        case "rgba":
            return hexOf(...([a, b, c].map((x) => (x.pct ? x.n / 100 : x.n / 255)) as [number, number, number]));
        case "hsl":
        case "hsla":
            return hslToHex(a.n, b.n / 100, c.n / 100);
        case "lab":
            return labToHex(a.n, b.pct ? (b.n * 125) / 100 : b.n, c.pct ? (c.n * 125) / 100 : c.n);
        case "lch": {
            const C = b.pct ? (b.n * 150) / 100 : b.n;
            return labToHex(a.n, C * Math.cos((c.n * Math.PI) / 180), C * Math.sin((c.n * Math.PI) / 180));
        }
        case "oklab":
            return oklabToHex(a.pct ? a.n / 100 : a.n, b.pct ? (b.n * 0.4) / 100 : b.n, c.pct ? (c.n * 0.4) / 100 : c.n);
        case "oklch": {
            const C = b.pct ? (b.n * 0.4) / 100 : b.n;
            return oklabToHex(a.pct ? a.n / 100 : a.n, C * Math.cos((c.n * Math.PI) / 180), C * Math.sin((c.n * Math.PI) / 180));
        }
    }
    return null;
}

/** "#RRGGBB" → OKLab, for perceptual distance and for telling greys from colours. */
export function oklab(hex: string): { L: number; a: number; b: number; C: number } {
    const [r, g, b] = [1, 3, 5].map((i) => linear(parseInt(hex.slice(i, i + 2), 16) / 255));
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
    const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
    const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
    return { L, a: A, b: B, C: Math.hypot(A, B) };
}

const distance = (x: string, y: string) => {
    const p = oklab(x);
    const q = oklab(y);
    return Math.hypot(p.L - q.L, p.a - q.a, p.b - q.b);
};

/** Below this OKLCh chroma a colour reads as a grey, cream or off-black — a neutral. */
const NEUTRAL_CHROMA = 0.035;
export const isNeutral = (hex: string) => oklab(hex).C < NEUTRAL_CHROMA;

/** Colour tokens inside a declaration value, in order. */
const COLOR_TOKEN = /#[0-9a-f]{3,8}\b|(?:rgba?|hsla?|lab|lch|oklab|oklch)\((?:[^()]|var\([^()]*\))*\)|var\(\s*--[\w-]+\s*(?:,[^()]*(?:\([^()]*\))?[^()]*)?\)/gi;

/* ── CSS model ──────────────────────────────────────────────────────────── */

interface Rule {
    selectors: string[];
    decls: [prop: string, value: string][];
}

/**
 * Flat rule list. Nested at-rules need no special handling: only an innermost
 * `sel { decls }` has declarations, and a media query's own header never does.
 *
 * A single linear scan, NOT a `([^{}]+)\{([^{}]*)\}` regex. That regex was the first
 * version and it is quadratic on any long brace-free stretch — a base64 font, or an HTML
 * error page served where a stylesheet was expected — and getaway.house hung it outright.
 */
export function parseRules(css: string): Rule[] {
    const out: Rule[] = [];
    const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
    let segStart = 0;
    let open = -1; // index of the "{" that opened the block we're in, if it's innermost
    let selector = "";
    for (let i = 0; i < clean.length; i++) {
        const c = clean.charCodeAt(i);
        if (c === 123 /* { */) {
            selector = clean.slice(segStart, i);
            open = i;
            segStart = i + 1;
        } else if (c === 125 /* } */) {
            if (open >= 0) pushRule(out, selector, clean.slice(open + 1, i));
            open = -1;
            segStart = i + 1;
        }
    }
    return out;
}

function pushRule(out: Rule[], rawSelector: string, body: string) {
    const sel = rawSelector.trim();
    if (!sel || sel.startsWith("@") || sel.length > 2000) return;
    const decls: [string, string][] = [];
    for (const d of body.split(";")) {
        const i = d.indexOf(":");
        if (i < 1) continue;
        decls.push([
            d.slice(0, i).trim().toLowerCase(),
            d
                .slice(i + 1)
                .replace(/!important/i, "")
                .trim(),
        ]);
    }
    if (decls.length) out.push({ selectors: splitSelectors(sel), decls });
}

/** Split a selector list on its TOP-LEVEL commas only: `:is(h1, h2):not(.a, .b)` is one. */
function splitSelectors(sel: string): string[] {
    const out: string[] = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < sel.length; i++) {
        const c = sel[i];
        if (c === "(") depth++;
        else if (c === ")") depth = Math.max(0, depth - 1);
        else if (c === "," && depth === 0) {
            out.push(sel.slice(start, i).trim());
            start = i + 1;
        }
    }
    out.push(sel.slice(start).trim());
    return out.filter(Boolean);
}

/** Custom properties that are a framework's stock palette or plumbing, never a brand's. */
const FRAMEWORK_VAR =
    /^--(tw-|bs-|wp--preset|wp-admin|un-|chakra-|mantine-|mdc-|mat-|swiper-|toastify-|rsuite-|ant-|fa-|plyr-|vjs-|e-a11y|cky-|ot-|color-(slate|gray|grey|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white)(-|$))/i;
/** Custom properties whose NAME claims a brand role. */
const BRANDY_VAR = /brand|primary|secondary|accent|theme|main|highlight|e-global-color/i;

/** Selectors that belong to a widget, not the site: carousels, cookie banners, date pickers… */
const VENDOR_SELECTOR =
    /\.(fa|swiper|slick|mfp|select2|flatpickr|pswp|leaflet|gm|grecaptcha|cookie|cky|cc|iti|intl-tel|tippy|tooltip|toast|pika|daterangepicker|ui-datepicker|fancybox|lg|plyr|vjs|mejs|wpcf7|gform|ginput|woocommerce|wc-|has-[\w-]+-(background-)?color)\b|#onetrust|#CybotCookiebot|::?-webkit-|::-moz-|::?selection|::?placeholder|:disabled|\[disabled\]/i;

const BOOTSTRAP_STOCK = new Set(
    // v4 and v5 theme colours and their generated hover/active shades.
    "#007BFF #0069D9 #0062CC #005CBF #0D6EFD #0B5ED7 #0A58CA #6C757D #5A6268 #545B62 #28A745 #218838 #1E7E34 #198754 #157347 #146C43 #17A2B8 #138496 #117A8B #0DCAF0 #31D2F2 #FFC107 #E0A800 #D39E00 #DC3545 #C82333 #BD2130 #BB2D3B #B02A37 #343A40 #23272B #1D2124 #212529 #F8F9FA #E2E6EA #DAE0E5".split(
        " ",
    ),
);

const STATE = /:(hover|focus|focus-visible|focus-within|active|visited|checked)\b/i;

/** Selectors for a component's off-states: a disabled tile or an error message paints the
 *  page rarely and is never a brand colour. Distinct from STATE, which is still the brand
 *  colour one shade darker — that one is kept but kept out of its own swatch. */
const OFF_STATE = /(^|[^a-z])(disabled|is-disabled|inactive|error|invalid|danger|warning|alert|success|skeleton|placeholder|loading)([^a-z]|$)/i;

/** Custom-property names that describe a state or plumbing, even when they also say
 *  "primary" — a design-token system names `--palette-bg-primary-inverse-error-hover`. */
const STATE_VAR =
    /hover|active|pressed|focus|visited|disabled|error|invalid|danger|warning|success|alert|skeleton|overlay|shadow|scrim|backdrop|blanket|placeholder|border|divider|outline/i;

/** How much a selector's colour is worth, by what it styles. */
function selectorRole(sel: string, prop: string): { w: number; role: string } {
    const bg = prop.startsWith("background") || prop === "fill";
    if (
        /\b(btn|button|cta)\b|^button\b|[\s>+~]button\b|\[type=["']?submit|wp-block-button__link|elementor-button|sqs-button|book(ing)?-?(now|btn|button)|\breserve\b/i.test(
            sel,
        )
    )
        return bg ? { w: 12, role: "button background" } : { w: 3, role: "button text" };
    if (/(^|[\s>+~.#-])(header|navbar|nav|masthead|topbar|top-bar|announcement|site-header|main-menu)\b/i.test(sel))
        return bg ? { w: 6, role: "header background" } : { w: 2.5, role: "header text" };
    if (/(^|[\s>+~,])h[1-3]\b|(^|[^a-z])(heading|headline|hero|display|title)([^a-z]|$)/i.test(sel))
        return bg ? { w: 2, role: "hero" } : { w: 5, role: "heading text" };
    if (/^(html|body|:root)$/i.test(sel) || /^body\s*[.#]/i.test(sel)) return bg ? { w: 4, role: "page background" } : { w: 3, role: "body text" };
    if (/(^|[\s>+~])a(\b|:|\[|\.)|\blink\b/i.test(sel)) return bg ? { w: 1.5, role: "link" } : { w: 3, role: "link text" };
    if (/\bfooter\b/i.test(sel)) return bg ? { w: 3, role: "footer background" } : { w: 1, role: "footer text" };
    return { w: 1, role: bg ? "background" : "text" };
}

const propWeight = (p: string) =>
    p === "background" || p === "background-color" || p === "fill" || p === "color"
        ? 1
        : p === "background-image"
          ? 0.5
          : p.startsWith("border") || p === "stroke" || p === "text-decoration-color"
            ? 0.3
            : p === "outline" || p === "outline-color" || p.includes("shadow") || p === "caret-color" || p === "accent-color"
              ? 0.1
              : 0;

const unescapeCss = (s: string) => s.replace(/\\([^\n])/g, "$1");

/** Class usage on the page: how many elements carry each class. */
function classCounts(html: string) {
    const counts = new Map<string, number>();
    for (const m of html.matchAll(/\bclass\s*=\s*["']([^"']+)["']/gi)) {
        for (const c of m[1].split(/\s+/)) if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    return counts;
}

/** 0.15 for a selector nothing on this page matches, up to ~3 for classes used everywhere. */
function presence(sel: string, counts: Map<string, number>, tags: Set<string>) {
    const classes = [...sel.matchAll(/\.((?:\\.|[\w-])+)/g)].map((m) => unescapeCss(m[1]));
    if (!classes.length) {
        const tag = sel.match(/^([a-z][a-z0-9]*)/i)?.[1]?.toLowerCase();
        return !tag || tags.has(tag) || ["html", "body"].includes(tag) ? 1 : 0.15;
    }
    const least = Math.min(...classes.map((c) => counts.get(c) ?? 0));
    return least === 0 ? 0.15 : 1 + Math.min(2, Math.log2(1 + least) / 2);
}

/* ── colour scoring ─────────────────────────────────────────────────────── */

export interface Swatch {
    name: string;
    hex: string;
    /** Where the colour came from, for the AM: "button background (.btn-primary)". */
    source: string;
}

interface Tally {
    score: number;
    /** Weight by role, to name the colour and pick Text/Background. */
    roles: Map<string, number>;
    example: Map<string, string>;
    /** Weight from :hover/:active rules — the same brand colour a shade off. */
    state: number;
    varName?: string;
}

/**
 * Score every colour the page declares.
 *
 * Exported for the eval script; the endpoint only needs readSiteBrand.
 */
export function scoreColors(css: string, html: string): Map<string, Tally> {
    const rules = parseRules(css);
    const counts = classCounts(html);
    const tags = new Set([...html.matchAll(/<([a-z][a-z0-9]*)\b/gi)].map((m) => m[1].toLowerCase()));
    const tallies = new Map<string, Tally>();
    const credit = (hex: string, w: number, role: string, example: string, varName?: string, state = false) => {
        if (w <= 0) return;
        const t: Tally = tallies.get(hex) ?? { score: 0, roles: new Map(), example: new Map(), state: 0 };
        t.score += w;
        if (state) t.state += w;
        t.roles.set(role, (t.roles.get(role) ?? 0) + w);
        if (!t.example.has(role)) t.example.set(role, example);
        if (varName && !t.varName) t.varName = varName;
        tallies.set(hex, t);
    };

    // Pass 1: custom properties. Later definitions win, like the cascade.
    const vars = new Map<string, string>();
    for (const r of rules) for (const [p, v] of r.decls) if (p.startsWith("--")) vars.set(p, v);
    const resolve = (value: string, depth = 0): string | null => {
        const v = value.trim();
        const ref = v.match(/^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\)$/);
        if (ref) {
            if (depth > 6) return null;
            const inner = vars.get(ref[1]);
            return inner !== undefined ? resolve(inner, depth + 1) : ref[2] ? resolve(ref[2], depth + 1) : null;
        }
        // Wix and Squarespace store bare channels: `--color_11: 32,42,68` / `--accent-hsl: 212,68%,40%`.
        if (/^\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}$/.test(v)) return parseColor(`rgb(${v})`);
        if (/^[\d.]+\s*,\s*[\d.]+%\s*,\s*[\d.]+%$/.test(v)) return parseColor(`hsl(${v})`);
        // A colour function fed from variables — `hsl(var(--siteColor1))` with
        // `--siteColor1: 18 64% 38%`, the shape Tailwind v3 themes and most site builders use.
        if (/^[a-z]+\(.*var\(/i.test(v)) {
            let out = v;
            for (let i = 0; i < 6 && out.includes("var("); i++) {
                out = out.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*))?\)/g, (_, n: string, fb?: string) => vars.get(n) ?? fb ?? "");
            }
            return parseColor(out);
        }
        return parseColor(v);
    };
    const varOf = (v: string) => v.match(/var\(\s*(--[\w-]+)/)?.[1];

    // A brand-named custom property is a claim by the site's author; worth a little on its
    // own, and it names the swatch. Its real weight comes from being USED, below.
    const claimed = new Set<string>();
    for (const [name, value] of vars) {
        if (FRAMEWORK_VAR.test(name) || !BRANDY_VAR.test(name) || STATE_VAR.test(name)) continue;
        const hex = resolve(value);
        // Once per colour: a token system that restates its primary under forty aliases
        // hasn't said it forty times.
        if (!hex || claimed.has(hex)) continue;
        claimed.add(hex);
        credit(hex, 3, "brand variable", name, name);
    }

    // Pass 2: every colour a rule actually paints with.
    for (const r of rules) {
        for (const [prop, value] of r.decls) {
            const pw = propWeight(prop);
            if (!pw) continue;
            for (const tok of value.match(COLOR_TOKEN) ?? []) {
                const hex = resolve(tok);
                if (!hex) continue;
                const v = varOf(tok);
                let best = 0;
                let bestRole = "";
                let bestSel = "";
                let bestState = false;
                for (const sel of r.selectors) {
                    if (VENDOR_SELECTOR.test(sel)) continue;
                    const { w, role } = selectorRole(sel, prop);
                    const state = STATE.test(sel);
                    const x = w * presence(sel, counts, tags) * (state ? 0.35 : 1) * (OFF_STATE.test(sel) ? 0.1 : 1);
                    if (x > best) [best, bestRole, bestSel, bestState] = [x, role, sel, state];
                }
                // Bootstrap's stock palette, compiled into a theme's own stylesheet where the
                // vendor-sheet filter can't see it. homesteadmodern.com's .btn-primary rule is
                // #007BFF while every button on the page is their rust #9F4423.
                if (BOOTSTRAP_STOCK.has(hex)) best *= 0.15;
                credit(hex, best * pw, bestRole, bestSel.slice(0, 60), v && !FRAMEWORK_VAR.test(v) && !STATE_VAR.test(v) ? v : undefined, bestState);
            }
        }
    }

    // Inline style attributes: page builders put their real colours here.
    for (const m of html.matchAll(/<([a-z][a-z0-9]*)\b[^>]*\bstyle\s*=\s*["']([^"']*)["'][^>]*>/gi)) {
        const btn = /^(a|button)$/i.test(m[1]) && /btn|button|cta/i.test(m[0]);
        for (const d of m[2].split(";")) {
            const [p, v] = [d.slice(0, d.indexOf(":")).trim().toLowerCase(), d.slice(d.indexOf(":") + 1)];
            const pw = propWeight(p);
            if (!pw) continue;
            for (const tok of v.match(COLOR_TOKEN) ?? []) {
                const hex = resolve(tok);
                if (hex) credit(hex, (btn ? 8 : 1.5) * pw, btn ? "button background" : "inline style", `<${m[1]} style>`);
            }
        }
    }

    // The site naming its own colour to the browser.
    for (const m of html.matchAll(/<meta\b[^>]*name\s*=\s*["'](theme-color|msapplication-TileColor)["'][^>]*>/gi)) {
        const c = m[0].match(/content\s*=\s*["']([^"']+)["']/i)?.[1];
        const hex = c && parseColor(c);
        if (hex) credit(hex, m[1].toLowerCase() === "theme-color" ? 20 : 8, "theme-color", "<meta name=theme-color>");
    }
    return tallies;
}

/** Near-identical declared shades (#1A73E8 vs #1A74E9) are one brand colour. The heaviest
 *  one's own hex is kept — merging never averages, so the hex is still one the site wrote. */
function cluster(tallies: Map<string, Tally>) {
    const sorted = [...tallies].sort((a, b) => b[1].score - a[1].score);
    const groups: [string, Tally][] = [];
    for (const [hex, t] of sorted) {
        const g = groups.find(([h]) => distance(h, hex) < 0.03);
        if (!g) {
            groups.push([hex, { score: t.score, roles: new Map(t.roles), example: new Map(t.example), state: t.state, varName: t.varName }]);
            continue;
        }
        g[1].score += t.score;
        g[1].state += t.state;
        for (const [r, w] of t.roles) g[1].roles.set(r, (g[1].roles.get(r) ?? 0) + w);
        for (const [r, e] of t.example) if (!g[1].example.has(r)) g[1].example.set(r, e);
        g[1].varName ??= t.varName;
    }
    return groups;
}

const topRole = (t: Tally) => [...t.roles].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
const describe = (t: Tally, only?: RegExp) => {
    const role = only ? ([...t.roles].filter(([r]) => only.test(r)).sort((a, b) => b[1] - a[1])[0]?.[0] ?? topRole(t)) : topRole(t);
    const ex = t.example.get(role);
    return ex && role !== "theme-color" ? `${role} (${ex})` : role;
};
const roleWeight = (t: Tally, re: RegExp) => [...t.roles].filter(([r]) => re.test(r)).reduce((s, [, w]) => s + w, 0);

const MAX_COLORS = 6;

/**
 * Below this, the leading colour is used too thinly for the read to be trusted — a
 * button or two on selectors the page barely uses. Measured on the eval set: every wrong
 * kit's primary scored under 4, and most right ones well over 10. Sites under it are
 * usually styled by JavaScript at runtime, which only a real browser sees; the kit still
 * ships, flagged, so the AM checks it against the site rather than trusting it.
 */
const CONFIDENT_SCORE = 10;
const CHROMATIC_NAMES = ["Primary", "Secondary", "Accent", "Accent 2"];

/**
 * Scores → the palette an AM would write down: brand colours first, then the ink and the
 * ground the site actually sets its text on.
 */
export function pickPalette(tallies: Map<string, Tally>): { colors: Swatch[]; confident: boolean } {
    const groups = cluster(tallies);
    // A colour that mostly appears on :hover is the button one shade darker — keep it out
    // of the kit rather than list the primary three times (casago.com did exactly that).
    const chroma = groups.filter(([h, t]) => !isNeutral(h) && t.state < t.score * 0.5);
    const neutral = groups.filter(([h]) => isNeutral(h));

    const out: Swatch[] = [];
    const lead = chroma[0]?.[1].score ?? 0;
    // A chromatic colour worth under a tenth of the leader is an icon or an error state.
    // A colour known only as a brand variable, never painted, that is also weak against the
    // leader is one step of the brand's own tint scale (`--color-brand-300` beside a primary
    // the page actually uses) — not a second brand colour.
    const onlyDeclared = (t: Tally) => [...t.roles.keys()].every((r) => r === "brand variable");
    for (const [hex, t] of chroma
        .filter(([, t], i) => t.score >= lead * 0.1 && !(i > 0 && onlyDeclared(t) && t.score < lead * 0.2))
        .slice(0, CHROMATIC_NAMES.length)) {
        out.push({ name: CHROMATIC_NAMES[out.length], hex, source: describe(t) });
    }

    // Ink: the dark neutral the site sets headings and body copy in.
    const ink = neutral
        .filter(([h]) => oklab(h).L < 0.4)
        .map(([h, t]) => [h, t, roleWeight(t, /text/)] as const)
        .filter(([, , w]) => w > 0)
        .sort((a, b) => b[2] - a[2])[0];
    // Dark: a near-black the site paints surfaces with (buttons, header) — a brand colour on
    // a monochrome site like getaway.house, where it's the only one there is.
    const dark = neutral
        .filter(([h]) => oklab(h).L < 0.4 && h !== ink?.[0])
        .map(([h, t]) => [h, t, roleWeight(t, /button background|header background|footer background/)] as const)
        .filter(([, , w]) => w > 0)
        .sort((a, b) => b[2] - a[2])[0];
    // Ground: the light neutral behind the content, when it isn't plain white. Only a page,
    // header, footer or hero surface counts — any other light grey is a card or a tile.
    const ground = neutral
        .filter(([h]) => oklab(h).L > 0.85 && h !== "#FFFFFF")
        .map(([h, t]) => [h, t, roleWeight(t, /page background|header background|footer background|hero|theme-color/)] as const)
        .filter(([, , w]) => w > 0)
        .sort((a, b) => b[2] - a[2])[0];

    const inkIsBrand = ink && roleWeight(ink[1], /button background|header background/) > roleWeight(ink[1], /text/);
    if (!out.length && (dark || ink)) {
        // Monochrome brand: its near-black IS the primary.
        const [hex, t] = dark ?? ink!;
        out.push({ name: "Primary", hex, source: describe(t) });
    } else if (dark && roleWeight(dark[1], /button background/) > 0) {
        out.push({ name: "Dark", hex: dark[0], source: describe(dark[1], /background/) });
    }
    if (ink && !out.some((s) => s.hex === ink[0])) out.push({ name: inkIsBrand ? "Dark" : "Text", hex: ink[0], source: describe(ink[1], /text/) });
    if (ground && !out.some((s) => s.hex === ground[0])) out.push({ name: "Background", hex: ground[0], source: describe(ground[1], /background|hero|theme/) });
    return { colors: out.slice(0, MAX_COLORS), confident: (chroma[0]?.[1].score ?? 0) >= CONFIDENT_SCORE || (!chroma.length && !!out.length) };
}

/* ── fonts ──────────────────────────────────────────────────────────────── */

/** Typefaces that tell us nothing about a brand (fallback chains, icon fonts). */
export const GENERIC_FONT =
    /^(inherit|initial|unset|revert|sans-serif|serif|monospace|cursive|fantasy|system-ui|ui-\w+|-apple-system|blinkmacsystemfont|segoe ui( \w+)?|roboto|helvetica( neue)?|arial|apple color emoji|noto color emoji|emoji|math|fangsong|times( new roman)?|courier( new)?|zapfdingbats|dingbats|symbol|wingdings|cambria math|none|var\(.*|.*icons?|.*awesome.*|dashicons|eicons|glyphicons.*|swiper-icons|slick|revicons|fontello|icomoon|miicons|star|woocommerce|wc\w*)$/i;

const cleanFamily = (f: string) =>
    f
        .replace(/!important/gi, "")
        .trim()
        .replace(/^["']|["']$/g, "")
        .trim();

const firstFamily = (stack: string) => cleanFamily(stack.split(",")[0] ?? "");

const okFamily = (f: string) => !!f && f.length <= 40 && !/^[\d.-]/.test(f) && !/[()&#;]/.test(f) && !GENERIC_FONT.test(f) && !/fallback/i.test(f);

/** The heading and body typefaces the site actually sets its text in. */
export function readFonts(html: string, css: string): { heading: string; body: string; loaded: string[] } {
    const loaded: string[] = [];
    const addLoaded = (f: string) => {
        const t = cleanFamily(f);
        if (okFamily(t) && !loaded.some((l) => l.toLowerCase() === t.toLowerCase())) loaded.push(t);
    };
    for (const m of html.matchAll(/fonts\.googleapis\.com\/css2?\?([^"'\s>]+)/gi)) {
        for (const fam of m[1].replace(/&amp;/g, "&").matchAll(/family=([^&:]+)/gi)) {
            for (const f of decodeURIComponent(fam[1]).replace(/\+/g, " ").split("|")) addLoaded(f);
        }
    }
    for (const m of css.matchAll(/@font-face\s*\{[^}]*?font-family\s*:\s*([^;}]+)/gi)) addLoaded(m[1]);

    const rules = parseRules(css);
    const vars = new Map<string, string>();
    for (const r of rules) for (const [p, v] of r.decls) if (p.startsWith("--")) vars.set(p, v);
    // References anywhere in the stack, not just a whole-value var(): inspirato.com sets
    // `var(--font-headline-serif, Domaine Display), sans-serif` with the variable undefined,
    // so the fallback is what renders.
    const resolveStack = (v: string): string => {
        let out = v;
        for (let i = 0; i < 6 && out.includes("var("); i++) {
            out = out.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*))?\)/g, (_, name: string, fb?: string) => vars.get(name) ?? fb ?? "");
        }
        return out;
    };

    // The classes the page's own headings and body actually carry. A rule that styles one of
    // them is what the rendered h1 is set in — the nearest this gets to computed style.
    const classesOn = (tag: RegExp) => {
        const set = new Set<string>();
        for (const m of html.matchAll(tag)) for (const c of (m[1] ?? "").split(/\s+/)) if (c) set.add(c);
        return set;
    };
    const headingClasses = classesOn(/<h[12]\b[^>]*\bclass\s*=\s*["']([^"']*)["']/gi);
    const bodyClasses = classesOn(/<(?:body|p)\b[^>]*\bclass\s*=\s*["']([^"']*)["']/gi);
    const lastCompoundHas = (sel: string, set: Set<string>) => {
        const last = sel.split(/[\s>+~]+/).pop() ?? "";
        return [...last.matchAll(/\.((?:\\.|[\w-])+)/g)].some((m) => set.has(unescapeCss(m[1])));
    };
    const HEADING_SEL = /(^|[\s>+~,])h[1-3]\b|(^|[^a-z])(heading|headline|hero|display|title)([^a-z]|$)/i;

    // Per family: the strongest single piece of evidence, then the total. Strongest first,
    // because forty `.type-heading-*` utility rules in the body face must not outvote the one
    // rule that sets the page's actual <h1> (vacasa.com).
    const heading = new Map<string, { max: number; sum: number }>();
    const body = new Map<string, { max: number; sum: number }>();
    const bump = (m: Map<string, { max: number; sum: number }>, f: string, w: number) => {
        const cur = m.get(f) ?? { max: 0, sum: 0 };
        m.set(f, { max: Math.max(cur.max, w), sum: cur.sum + w });
    };
    const isLoaded = (f: string) => loaded.some((l) => l.toLowerCase() === f.toLowerCase());
    for (const r of rules) {
        for (const [p, v] of r.decls) {
            let stack = "";
            if (p === "font-family") stack = resolveStack(v);
            else if (p === "font") stack = resolveStack(v).match(/(?:[\d.]+(?:px|rem|em|%)?(?:\/[\d.]+\w*)?\s+)([^\d].*)$/)?.[1] ?? "";
            else if (p.startsWith("--") && /font|family|heading|body|display|typeface/i.test(p)) {
                // `--font-heading: "Canela", serif` names both a role and a family.
                const f = firstFamily(resolveStack(v));
                if (okFamily(f) && /,|["']/.test(v)) {
                    if (/head|display|title|h1|serif-display/i.test(p)) bump(heading, f, 3);
                    else if (/body|base|text|sans|copy|main|primary/i.test(p)) bump(body, f, 3);
                }
                continue;
            }
            const f = firstFamily(stack);
            if (!okFamily(f)) continue;
            // A family the site loads counts double: it was chosen, not inherited.
            const w = isLoaded(f) ? 2 : 1;
            // Once per rule, at its strongest selector — a rule listing h1…h6 and .h1….h6 is
            // one decision, not twelve.
            let hw = 0;
            let bw = 0;
            for (const sel of r.selectors) {
                if (VENDOR_SELECTOR.test(sel)) continue;
                const last = sel.split(/[\s>+~]+(?![^(]*\))/).pop() ?? "";
                if (/^h[12]$/i.test(sel) || lastCompoundHas(sel, headingClasses)) hw = Math.max(hw, 6);
                // `:is(h1, h2, …)` or a contextual `.hero h1` — still the page's real headings.
                else if (/(^|[^a-z0-9-])h[12]([^0-9a-z-]|$)/i.test(last)) hw = Math.max(hw, 5);
                else if (HEADING_SEL.test(sel)) hw = Math.max(hw, 1.5);
                if (/^(html|body|:root|p)$/i.test(sel) || lastCompoundHas(sel, bodyClasses)) bw = Math.max(bw, 4);
                else if (/^body\s*[.#]/i.test(sel) || /(^|[\s>])p$/.test(sel)) bw = Math.max(bw, 1.5);
            }
            if (hw) bump(heading, f, hw * w);
            if (bw) bump(body, f, bw * w);
        }
    }
    const best = (m: Map<string, { max: number; sum: number }>) => [...m].sort((a, b) => b[1].max - a[1].max || b[1].sum - a[1].sum)[0]?.[0] ?? "";
    const b = best(body) || loaded[0] || "";
    // Among heading candidates about as strong as the leader, prefer one that ISN'T the body
    // face: a site loads a separate display face only to set headings in it. vacasa.com ties
    // Stix Two Text (its <h1>) with Public Sans (its heading-sized utility classes).
    const top = Math.max(0, ...[...heading.values()].map((v) => v.max));
    const distinct = [...heading].filter(([f, v]) => v.max >= top * 0.8 && f.toLowerCase() !== b.toLowerCase());
    const h = (distinct.length ? best(new Map(distinct)) : best(heading)) || b || loaded[0] || "";
    return { heading: h, body: b || h, loaded };
}

/* ── stylesheets ────────────────────────────────────────────────────────── */

/** CSS that is somebody else's widget, not the site's design. */
const VENDOR_SHEET =
    /font-?awesome|fontawesome|bootstrap(\.min)?\.css|block-library|wp-includes|dashicons|elementor\/assets\/lib|animate(\.min)?\.css|slick|swiper|owl\.carousel|jquery-ui|magnific|fancybox|select2|flatpickr|woocommerce|gravity-?forms|cookie|onetrust|intl-tel|leaflet|mapbox|recaptcha|plyr|video-?js|mediaelement|lightbox|photoswipe|aos(\.min)?\.css|contentbuilder|contentbox/i;

const MAX_SHEETS = 10;

function sheetUrls(html: string, base: URL): string[] {
    const hrefs: string[] = [];
    for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
        const tag = m[0];
        const isSheet = /rel\s*=\s*["'][^"']*stylesheet/i.test(tag) || (/rel\s*=\s*["']preload["']/i.test(tag) && /as\s*=\s*["']style["']/i.test(tag));
        if (!isSheet) continue;
        const href = tag.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
        if (!href) continue;
        try {
            const abs = new URL(href.replace(/&amp;/g, "&"), base).href;
            if (!hrefs.includes(abs) && !VENDOR_SHEET.test(abs)) hrefs.push(abs);
        } catch {
            /* unparseable href */
        }
    }
    // Typekit / Adobe Fonts kits are read for their @font-face names; Google Fonts CSS is
    // already understood from its URL, so fetching it adds nothing.
    const own = (u: string) => new URL(u).hostname.replace(/^www\./, "") === base.hostname.replace(/^www\./, "");
    const fonts = hrefs.filter((u) => /use\.typekit\.net|p\.typekit\.net/.test(u));
    const rest = hrefs.filter((u) => !/fonts\.googleapis\.com|typekit\.net/.test(u));
    // First-party sheets first: that's where a theme's own design lives.
    return [...fonts.slice(0, 2), ...rest.filter(own), ...rest.filter((u) => !own(u))].slice(0, MAX_SHEETS);
}

async function fetchCss(urls: string[], timeoutMs: number): Promise<string[]> {
    const got = await Promise.all(urls.map((u) => grab(u, PAGE_CAP, timeoutMs).then((r) => ({ u, css: r ? asText(r.body) : "" }))));
    // One level of @import — some themes are nothing but a list of them.
    const imports: string[] = [];
    for (const { u, css } of got) {
        for (const m of css.matchAll(/@import\s+(?:url\()?\s*["']?([^"')\s;]+)["']?\s*\)?/gi)) {
            try {
                const abs = new URL(m[1], u).href;
                if (!VENDOR_SHEET.test(abs) && !/fonts\.googleapis\.com/.test(abs) && imports.length < 4) imports.push(abs);
            } catch {
                /* skip */
            }
        }
    }
    const extra = imports.length ? await Promise.all(imports.map((u) => grab(u, PAGE_CAP, timeoutMs).then((r) => (r ? asText(r.body) : "")))) : [];
    return [...got.map((g) => g.css), ...extra];
}

/* ── logo ───────────────────────────────────────────────────────────────── */

export interface Logo {
    name: string;
    url: string;
}

const LOGO_HINT = /logo|brand|wordmark|site-title|custom-logo|site-branding|navbar-brand/i;

/** Best-guess logo sources, most likely first. Inline SVGs come back as data: URLs. */
export function logoCandidates(html: string, base: URL): { src: string; name: string }[] {
    const out: { src: string; name: string }[] = [];
    const add = (u: string | undefined | null, name?: string) => {
        if (!u) return;
        try {
            const src = u.startsWith("data:") ? u : new URL(u.replace(/&amp;/g, "&"), base).href;
            if (!out.some((o) => o.src === src)) out.push({ src, name: name ?? decodeURIComponent(src.split("/").pop() ?? "logo").replace(/[?#].*$/, "") });
        } catch {
            /* unparseable */
        }
    };

    // JSON-LD: an Organization's own logo field is the most deliberate signal there is.
    for (const m of html.matchAll(/"logo"\s*:\s*(?:\{[^}]*?"url"\s*:\s*)?"(https?:[^"]+)"/gi)) add(m[1].replace(/\\\//g, "/"));

    // The header region: where a site's logo lives on every template we've seen.
    const header = html.match(/<header\b[\s\S]*?<\/header>/i)?.[0] ?? html.match(/<nav\b[\s\S]*?<\/nav>/i)?.[0] ?? "";

    for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
        const tag = m[0];
        if (!LOGO_HINT.test(tag)) continue;
        add(tag.match(/\b(?:data-src|src)\s*=\s*["']([^"']+)["']/i)?.[1]);
    }
    // An inline <svg> that is (or sits in) the logo link.
    const svgLogo =
        html.match(
            /<a\b[^>]*(?:class|id|aria-label)\s*=\s*["'][^"']*(?:logo|brand|home)[^"']*["'][^>]*>\s*(?:<[^>]+>\s*){0,4}?(<svg\b[\s\S]*?<\/svg>)/i,
        )?.[1] ??
        html.match(/<svg\b[^>]*(?:class|id|aria-label)\s*=\s*["'][^"']*logo[^"']*["'][\s\S]*?<\/svg>/i)?.[0] ??
        header.match(/<svg\b[\s\S]*?<\/svg>/i)?.[0];
    if (svgLogo && svgLogo.length < ASSET_CAP && /<path|<text|<g\b/i.test(svgLogo)) {
        const svg = /xmlns=/.test(svgLogo) ? svgLogo : svgLogo.replace(/<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
        add(`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`, "logo");
    }
    // First image in the header, when nothing is labelled.
    add(header.match(/<img\b[^>]*\b(?:data-src|src)\s*=\s*["']([^"']+)["']/i)?.[1]);
    for (const m of html.matchAll(/<link\b[^>]*rel\s*=\s*["'][^"']*(?:apple-touch-icon|mask-icon|icon)[^"']*["'][^>]*>/gi)) {
        add(m[0].match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1]);
    }
    return out.slice(0, 6);
}

/** No JPEG: a logo is a flat mark; a JPEG under a "brand" wrapper is nearly always a photo. */
const IMG_OK = /^image\/(svg\+xml|png|webp|x-icon|vnd\.microsoft\.icon|gif|avif)$/;
const RASTER_CAP = 250_000;

async function fetchLogos(html: string, base: URL): Promise<Logo[]> {
    const out: Logo[] = [];
    for (const cand of logoCandidates(html, base)) {
        if (out.length >= 3) break;
        if (cand.src.startsWith("data:")) {
            out.push({ name: cand.name, url: cand.src });
            continue;
        }
        const got = await grab(cand.src, ASSET_CAP, 5000);
        const mime = got?.type.split(";")[0].trim() ?? "";
        if (!got || !IMG_OK.test(mime)) continue;
        if (mime !== "image/svg+xml" && got.body.byteLength > RASTER_CAP) continue;
        const url = `data:${mime};base64,${Buffer.from(got.body).toString("base64")}`;
        if (out.some((o) => o.url === url)) continue;
        out.push({ name: cand.name.replace(/\.[^.]+$/, "").slice(0, 60) || "logo", url });
    }
    return out;
}

/* ── the read ───────────────────────────────────────────────────────────── */

export interface SiteBrand {
    colors: Swatch[];
    /** False when the palette rests on thin evidence — see CONFIDENT_SCORE. */
    confident: boolean;
    /** "Heading, Body" — the order the dashboard's Fonts field reads them in. */
    fonts: string;
    logos: Logo[];
    stylesheets: number;
    cssBytes: number;
}

/** Everything from an already-fetched homepage. Never throws; an empty read is the caller's call. */
export async function readSiteBrand(site: URL, html: string, opts: { sheetMs?: number; logos?: boolean } = {}): Promise<SiteBrand> {
    const urls = sheetUrls(html, site);
    const inline = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n");
    const external = await fetchCss(urls, opts.sheetMs ?? 6000);
    const css = `${inline}\n${external.join("\n")}`;

    const { colors, confident } = pickPalette(scoreColors(css, html));
    const f = readFonts(html, css);
    const fonts = f.heading && f.body && f.heading.toLowerCase() !== f.body.toLowerCase() ? `${f.heading}, ${f.body}` : f.heading || f.body;
    const logos = opts.logos === false ? [] : await fetchLogos(html, site);
    return { colors, confident, fonts, logos, stylesheets: urls.length, cssBytes: css.length };
}
