import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { ASSET_CAP, NOT_CONFIGURED, PAGE_CAP, asText, assertPublicUrl, callerEmail, grab, isTeamEmail, readAuthEnv } from "../lib/client-sources.mts";
import { PDF_CAP, readBrandPdf } from "../lib/pdf-brand.mts";

/**
 * Returns a first-draft Brand Kit — palette, fonts and logo files — for the account manager
 * to review, read from the client's own website, their brand guidelines PDF, or both.
 *
 * NOTHING HERE INVENTS A HEX, and every part of the design follows from that. A brand kit's
 * value is that the colours are exactly the client's; a model asked to "find the brand
 * colours" will happily return a plausible navy that appears nowhere in their material, and
 * a wrong-but-believable hex gets copied into emails and a website and is very hard to walk
 * back. So the two readers work the same way:
 *
 *  - WEBSITE: no model at all. Colours are lifted out of the page's own CSS and ranked by
 *    how much the stylesheet leans on them. A bad result is visibly bad (junk greys)
 *    rather than quietly wrong.
 *  - PDF: the hexes and typefaces come out of the file verbatim (netlify/lib/pdf-brand.mts),
 *    and a model is shown ONLY that extracted text. Its job is naming and ranking — which
 *    swatch is the primary, which typeface is for headings — because a guidelines doc says
 *    so in words that a regex can't follow. Every hex it returns is then checked against the
 *    list of hexes actually printed in the document and dropped if it isn't there, so the
 *    model can reorder and label the palette but cannot add a colour to it. When the model
 *    is unavailable, slow, or returns nothing usable, the extracted palette ships as-is with
 *    positional role names — the draft is never blocked on it.
 *
 * A PDF beats the website outright when it yields a palette: a guidelines document STATES
 * which colour is primary, while the CSS reader can only infer it from variable names, and
 * blending the two buries four correct swatches under six scraped greys. Logos still come
 * from the site (nothing extracts a logo from a PDF here), and fonts prefer the PDF.
 *
 * Like generate-overview it RETURNS the draft rather than writing it — the dashboard merges
 * it into unsaved state so the AM sees it before anything is saved.
 *
 * This function fetches a URL a person typed, from inside our own network, which is the
 * textbook SSRF shape. The assertPublicUrl guard it imports is not optional: without it
 * "http://169.254.169.254/" turns this endpoint into a reader for the cloud metadata
 * service. That guard and the capped fetcher live in netlify/lib/client-sources.mts so this
 * function and the Master Document drafter cannot drift apart on them.
 */

const MAX_COLORS = 6;

/** Fallback swatch names, in the order a palette is normally introduced. Shared by both
 *  readers so a PDF-drafted kit and a site-drafted one read the same. */
const ROLES = ["Primary", "Secondary", "Accent", "Neutral", "Primary 2", "Accent 2"];

/** Two swatches both labelled "Secondary" reads as a bug; number the repeats. */
const numberRepeats = (colors: { name: string; hex: string }[]) =>
    colors.map((c, i, all) => {
        const before = all.slice(0, i).filter((x) => x.name === c.name).length;
        return before ? { ...c, name: `${c.name} ${before + 1}` } : c;
    });

/* ── colours ────────────────────────────────────────────────────────────── */

const norm = (hex: string) => {
    const h = hex.replace("#", "").toLowerCase();
    const full =
        h.length === 3
            ? h
                  .split("")
                  .map((c) => c + c)
                  .join("")
            : h.slice(0, 6);
    return `#${full.toUpperCase()}`;
};
const rgbToHex = (r: number, g: number, b: number) =>
    "#" +
    [r, g, b]
        .map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase();

/**
 * Rank colours by how much the stylesheet leans on them.
 *
 * Custom properties come first and count double: a site builder that exposes
 * `--brand-primary` has already told us which colours are the brand, which no frequency
 * count can match. Everything else is ranked by raw occurrences.
 */
function extractColors(css: string): { name: string; hex: string }[] {
    const score = new Map<string, number>();
    const named = new Map<string, string>();
    const bump = (hex: string, by: number) => score.set(hex, (score.get(hex) ?? 0) + by);

    // --brand-primary: #214254   /  --accent: rgb(20 40 60)
    const varRe = /--([a-z0-9-]*(?:brand|primary|secondary|accent|theme|colou?r)[a-z0-9-]*)\s*:\s*(#[0-9a-f]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))/gi;
    for (const m of css.matchAll(varRe)) {
        // WordPress/Elementor emit a fixed default palette as --wp--preset--color--vivid-red
        // and friends. They match every keyword above and, scored as brand colours, buried
        // the theme's actual palette under eight stock swatches on every WP site tested.
        if (/preset|wp--|elementor-global/i.test(m[1])) continue;
        const hex = m[2].startsWith("#") ? norm(m[2]) : fromColorFn(m[2]);
        if (!hex) continue;
        bump(hex, 8);
        if (!named.has(hex)) named.set(hex, prettyVarName(m[1]));
    }
    for (const m of css.matchAll(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi)) bump(norm(m[0]), 1);
    for (const m of css.matchAll(/rgba?\([^)]{5,40}\)|hsla?\([^)]{5,40}\)/gi)) {
        const hex = fromColorFn(m[0]);
        if (hex) bump(hex, 1);
    }

    return numberRepeats(
        [...score.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, MAX_COLORS)
            .map(([hex], i) => ({ name: named.get(hex) ?? ROLES[i] ?? `Colour ${i + 1}`, hex })),
    );
}

/** rgb()/rgba()/hsl()/hsla() -> hex. Returns null for anything else (e.g. oklch(), which
 *  would need the OKLab->sRGB matrix and isn't worth it for a draft palette). */
function fromColorFn(s: string): string | null {
    const n = s.match(/-?[\d.]+/g);
    if (!n || n.length < 3) return null;
    const [a, b, c] = n.map(Number);
    if (/^hsl/i.test(s)) return hslToHex(a, b, c);
    return rgbToHex(a, b, c);
}

function hslToHex(h: number, s: number, l: number): string {
    const sn = s / 100;
    const ln = l / 100;
    const k = (n: number) => (n + h / 30) % 12;
    const a = sn * Math.min(ln, 1 - ln);
    const f = (n: number) => ln - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return rgbToHex(Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255));
}

const prettyVarName = (v: string) => {
    const t = v
        .replace(/^-+/, "")
        .replace(/(colou?r|theme)-?/gi, "")
        .replace(/[-_]+/g, " ")
        .trim();
    return t ? t.replace(/\b\w/g, (c) => c.toUpperCase()) : "Brand";
};

/* ── fonts ──────────────────────────────────────────────────────────────── */

/**
 * Typefaces that tell us nothing about a brand.
 *
 * The CSS half of this list is the stock fallback chains. The tail — Times, Courier,
 * ZapfDingbats, Symbol — is for the PDF reader: every PDF declares some of the base-14
 * fonts whether or not a word is set in them, and a jsPDF or Word export declares all
 * fourteen, so without them the Fonts field fills up with "Courier, ZapfDingbats".
 */
const GENERIC =
    /^(inherit|initial|unset|revert|sans-serif|serif|monospace|cursive|fantasy|system-ui|ui-\w+|-apple-system|blinkmacsystemfont|segoe ui|roboto|helvetica( neue)?|arial|apple color emoji|segoe ui emoji|noto color emoji|emoji|math|fangsong|times( new roman)?|courier( new)?|zapfdingbats|dingbats|symbol|wingdings|cambria math)$/i;

/** Collects typeface names, rejecting the ones that aren't anybody's brand font. One
 *  collector for both readers, so the website and the PDF can't disagree about what
 *  counts as a real typeface. */
function fontCollector() {
    const out: string[] = [];
    return {
        push(f: string) {
            // "var(--wp--preset--font-family--arvo) !important" is a reference, not a
            // typeface — it was going straight into the Fonts field verbatim.
            const t = f
                .replace(/!important/gi, "")
                .trim()
                .replace(/^["']|["']$/g, "");
            // Reject HTML entities ("Inter &#8211" came out of a page title), generated
            // fallback faces, and player/widget fonts that aren't the brand's.
            if (!t || t.includes("var(") || /["'()]/.test(t) || /&#|&[a-z]+;/i.test(t)) return;
            if (/\b(fallback|videojs|icons?|glyph)\b/i.test(t) || t.length > 40 || GENERIC.test(t)) return;
            if (!out.some((o) => o.toLowerCase() === t.toLowerCase())) out.push(t);
        },
        get list() {
            return out;
        },
    };
}

/**
 * Only the fonts the site actually LOADS — Google Fonts links and @font-face families.
 *
 * Scanning `font-family:` declarations was the first approach and it was worse than
 * nothing: a declaration is a fallback chain, so it returned "Oxygen-Sans, Ubuntu,
 * Cantarell" (WordPress's stock chain) and "Segoe UI Symbol, Noto Color Emoji" as if they
 * were the brand's typefaces. A loaded font is one the designer chose on purpose.
 */
function extractFonts(html: string, css: string): string {
    const fonts = fontCollector();
    for (const m of html.matchAll(/fonts\.googleapis\.com\/css2?\?([^"'\s>]+)/gi)) {
        for (const fam of m[1].matchAll(/family=([^&:]+)/gi)) fonts.push(decodeURIComponent(fam[1]).replace(/\+/g, " "));
    }
    for (const m of css.matchAll(/@font-face\s*\{[^}]*?font-family\s*:\s*([^;}]+)/gi)) fonts.push(m[1].split(",")[0]);
    return fonts.list.slice(0, 4).join(", ");
}

/* ── logo ───────────────────────────────────────────────────────────────── */

/** Best-guess logo candidates, most likely first. */
function logoCandidates(html: string, base: URL): string[] {
    const urls: string[] = [];
    const add = (u?: string | null) => {
        if (!u) return;
        try {
            const abs = new URL(u, base).href;
            if (!urls.includes(abs)) urls.push(abs);
        } catch {
            /* skip unparseable src */
        }
    };
    // An <img> the site itself calls a logo is the most reliable signal there is.
    for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
        const tag = m[0];
        if (!/logo|brand|wordmark/i.test(tag)) continue;
        add(tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1]);
    }
    for (const m of html.matchAll(/<link\b[^>]*rel\s*=\s*["'][^"']*(?:apple-touch-icon|icon)[^"']*["'][^>]*>/gi)) {
        add(m[0].match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1]);
    }
    add(html.match(/<meta\b[^>]*property\s*=\s*["']og:image["'][^>]*content\s*=\s*["']([^"']+)["']/i)?.[1]);
    // Vectors first — an SVG mark stays crisp and is what a designer actually wants.
    return urls.sort((a, b) => Number(b.includes(".svg")) - Number(a.includes(".svg"))).slice(0, 4);
}

/** No JPEG: a logo is a flat mark, so it ships as SVG/PNG/ICO essentially always, whereas
 *  a JPEG match is nearly always a photo that happened to sit in a "brand" wrapper — the
 *  getaway.house test pulled two 120KB photos of a bed and a campfire this way. */
const IMG_OK = /^image\/(svg\+xml|png|webp|x-icon|vnd\.microsoft\.icon)$/;
const RASTER_CAP = 250_000;

async function fetchLogos(html: string, base: URL) {
    const out: { name: string; url: string }[] = [];
    for (const cand of logoCandidates(html, base)) {
        if (out.length >= 2) break;
        const got = await grab(cand, ASSET_CAP);
        const mime = got?.type.split(";")[0].trim() ?? "";
        if (!got || !IMG_OK.test(mime)) continue;
        if (mime !== "image/svg+xml" && got.body.byteLength > RASTER_CAP) continue;
        const b64 = Buffer.from(got.body).toString("base64");
        const name =
            decodeURIComponent(cand.split("/").pop() ?? "logo")
                .replace(/\.[^.]+$/, "")
                .slice(0, 60) || "logo";
        out.push({ name, url: `data:${mime};base64,${b64}` });
    }
    return out;
}

/* ── the guidelines PDF ─────────────────────────────────────────────────── */

const MODEL = "claude-opus-5";

/** The model only ranks and names; it never blocks the draft. Past this the extracted
 *  palette ships with positional role names, which is a slightly worse kit, not a failure.
 *  Sized to leave room inside the function's ~10s budget for the website read as well. */
const MODEL_MS = 7000;

/**
 * Where an uploaded guidelines PDF lives — "acme/1726000000-brand-guide.pdf", the same
 * shape the onboarding form's own brand-kit uploads use.
 *
 * Pinned to that shape on purpose. This endpoint takes a storage path from the browser, so
 * without it a team member could point it at any object in any bucket the caller's key can
 * reach and have the contents read back to them through the draft.
 */
const isBrandKitPath = (p: string) => p.length <= 300 && !p.includes("..") && /^[a-z0-9][a-z0-9_-]*\/[a-z0-9][a-z0-9._-]*\.pdf$/i.test(p);

interface PdfKit {
    colors: { name: string; hex: string }[];
    fonts: string;
    pages: number;
    /** How many distinct hexes the document actually printed, before any ranking. Reported
     *  so a two-swatch result reads as "the document only names two" rather than a bug. */
    found: number;
    /** False when the palette shipped straight from the extractor — no key, too slow, or
     *  nothing usable came back — so the AM knows the role names are positional guesses. */
    named: boolean;
}

const KIT_TOOL: Anthropic.Tool = {
    name: "brand_kit",
    description: "Record the palette and typefaces a brand guidelines document states.",
    input_schema: {
        type: "object",
        properties: {
            colors: {
                type: "array",
                description: `The brand's palette, most important first, at most ${MAX_COLORS} entries.`,
                items: {
                    type: "object",
                    properties: {
                        name: {
                            type: "string",
                            description: "What this colour is for, in the document's own words where it has them — 'Primary', 'Accent', 'Sand', 'Deep Forest'.",
                        },
                        hex: {
                            type: "string",
                            description: "The hex code copied character-for-character from the document. Never adjusted, never read off a printed swatch.",
                        },
                    },
                    required: ["name", "hex"],
                },
            },
            heading_font: { type: "string", description: "The typeface the document gives for headings or display. Empty string if it does not say." },
            body_font: { type: "string", description: "The typeface the document gives for body copy. Empty string if it does not say." },
        },
        required: ["colors", "heading_font", "body_font"],
    },
};

const KIT_SYSTEM = `You read brand guidelines documents for HiddenGem Media, a marketing agency for short-term rental and boutique hospitality businesses.

You are given the text of a client's brand guidelines PDF, plus two lists read mechanically out of the file: every hex code printed anywhere in it, and the typefaces it is embedded with. An account manager will review what you return and then it becomes the client's official Brand Kit.

Your job is ranking and naming, not finding. The extraction already found the colours; what it cannot do is tell a primary from a page-number grey, or know that the client calls their green "Moss". You can, because the document says so in words.

Rules:

1. Every hex you return must be copied exactly from the list you are given. Anything else is dropped before the account manager sees it, so inventing a colour only loses you a slot. Never read a colour off a description, and never adjust one to look more like a brand colour.
2. Order them the way the document does — the primary first, then secondary, then accents and neutrals.
3. Leave out page furniture: a grey used only for footers or captions, a colour that appears once inside an example photograph or a chart, the white of the page when the document never calls it a brand colour.
4. Name each one from the document's own vocabulary where it has one. Fall back to Primary / Secondary / Accent / Neutral only where it doesn't.
5. For the two font fields, name a typeface only if the document assigns one to that role. If it names one typeface for everything, use it for both. If it names none, return empty strings — never fill these with a well-known typeface because it looks similar.

A short honest answer beats a padded one. Two colours the document actually specifies is a good result.`;

/**
 * Read an uploaded guidelines PDF into a draft palette and font pair.
 *
 * Downloaded with the PUBLISHABLE key, not the service key: the brandkits bucket is
 * public-read, so the anon client can already fetch this object, and handing this path a
 * service-role key would widen what a malformed path could reach for no gain at all.
 *
 * Throws with a message written for an account manager; the caller passes it straight on.
 */
async function readPdfKit(path: string, supabaseUrl: string, anonKey: string, apiKey?: string): Promise<PdfKit> {
    const { data: blob, error } = await createClient(supabaseUrl, anonKey).storage.from("brandkits").download(path);
    if (error || !blob) throw new Error("That PDF couldn't be read back from storage — try uploading it again.");
    if (blob.size > PDF_CAP) {
        throw new Error(
            `That PDF is ${Math.round(blob.size / 1_000_000)}MB, which is too big to read. Export a lighter copy — or just the colour and type pages — and upload that.`,
        );
    }

    const pdf = await readBrandPdf(new Uint8Array(await blob.arrayBuffer()));

    // Document order, not frequency: a guidelines doc introduces its primary first.
    const ordered: string[] = [];
    for (const raw of pdf.hexes) {
        const hex = norm(raw);
        if (!ordered.includes(hex)) ordered.push(hex);
    }

    if (!ordered.length && !pdf.fontCandidates.length) {
        throw new Error(
            pdf.text
                ? "That PDF has no hex codes or embedded fonts in it — if the palette is only shown as swatches, the hexes have to go in by hand."
                : "That PDF has no readable text layer — it's likely a scan or an exported image. Add the colours by hand, or upload a version exported from the design file.",
        );
    }

    const pdfFonts = fontCollector();
    for (const f of pdf.fontCandidates) pdfFonts.push(f);

    // The floor: what ships when the model can't or won't. Never empty when hexes exist.
    let colors = numberRepeats(ordered.slice(0, MAX_COLORS).map((hex, i) => ({ name: ROLES[i] ?? `Colour ${i + 1}`, hex })));
    let fonts = pdfFonts.list.slice(0, 4).join(", ");
    let named = false;

    if (apiKey && pdf.text) {
        try {
            const message = await new Anthropic({ apiKey, maxRetries: 0 }).messages.create(
                {
                    model: MODEL,
                    max_tokens: 2048,
                    // Ranking and labelling text that is already in front of it — the depth
                    // is not what makes this good, and the endpoint answers synchronously.
                    output_config: { effort: "low" },
                    system: KIT_SYSTEM,
                    tools: [KIT_TOOL],
                    tool_choice: { type: "tool", name: KIT_TOOL.name },
                    messages: [
                        {
                            role: "user",
                            content: `HEX CODES PRINTED IN THE DOCUMENT (the only ones you may return, in the order they appear):
${ordered.join("\n")}

TYPEFACES THE FILE IS EMBEDDED WITH:
${pdfFonts.list.join("\n") || "(none the file admits to)"}

DOCUMENT TEXT:
${pdf.text}

Record this client's brand kit.`,
                        },
                    ],
                },
                { timeout: MODEL_MS },
            );

            const block = message.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
            const input = (block?.input ?? {}) as { colors?: { name?: unknown; hex?: unknown }[]; heading_font?: unknown; body_font?: unknown };

            /* THE CHECK THIS WHOLE DESIGN RESTS ON. A returned hex is kept only if the
               document actually printed it, so the model can reorder and rename the palette
               but cannot add a colour to it. */
            const picked: { name: string; hex: string }[] = [];
            for (const c of input.colors ?? []) {
                const hex = norm(String(c?.hex ?? ""));
                if (!ordered.includes(hex) || picked.some((p) => p.hex === hex)) continue;
                const name = String(c?.name ?? "")
                    .trim()
                    .slice(0, 40);
                picked.push({ name: name || ROLES[picked.length] || `Colour ${picked.length + 1}`, hex });
                if (picked.length >= MAX_COLORS) break;
            }

            /* Same rule for typefaces: a name is kept only if it is written in the document
               or embedded in the file. Rule 5 tells the model not to guess a lookalike; this
               is what makes that more than a request. */
            const said = `${pdf.text}\n${pdfFonts.list.join("\n")}`.toLowerCase();
            const chosen = fontCollector();
            for (const key of ["heading_font", "body_font"] as const) {
                const t = String(input[key] ?? "").trim();
                if (t && said.includes(t.toLowerCase())) chosen.push(t);
            }

            if (picked.length) {
                colors = numberRepeats(picked);
                named = true;
            }
            if (chosen.list.length) fonts = chosen.list.join(", ");
        } catch (err) {
            // Never fatal. The extracted palette is already sitting in `colors`.
            console.warn("[generate-brand-kit] naming pass skipped:", err instanceof Error ? err.message : err);
        }
    }

    return { colors, fonts, pages: pdf.pages, found: ordered.length, named };
}

/* ── handler ────────────────────────────────────────────────────────────── */

export default async (req: Request) => {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

    // Team-only. Without this, anyone who finds the URL can make our server fetch any public
    // site and hand back its images — an open fetch proxy wearing our IP address.
    const auth = readAuthEnv();
    if (!auth) return Response.json({ error: NOT_CONFIGURED }, { status: 500 });
    if (!isTeamEmail(await callerEmail(req, auth.supabaseUrl, auth.anonKey))) {
        return Response.json({ error: "Team sign-in required." }, { status: 401 });
    }

    let rawUrl: string;
    let pdfPath: string;
    try {
        const body = (await req.json()) as { url?: unknown; pdf_path?: unknown };
        rawUrl = String(body.url ?? "").trim();
        pdfPath = String(body.pdf_path ?? "").trim();
    } catch {
        return Response.json({ error: "Bad request." }, { status: 400 });
    }
    if (rawUrl.length > 500) return Response.json({ error: "That website address is too long." }, { status: 400 });
    if (pdfPath && !isBrandKitPath(pdfPath)) return Response.json({ error: "That uploaded file couldn't be found — try uploading it again." }, { status: 400 });
    if (!rawUrl && !pdfPath) {
        return Response.json({ error: "Add the client's website address, or upload their brand guidelines PDF." }, { status: 400 });
    }

    /* The PDF first, and on its own error budget. It is the better source when it is
       there, so a site that fails to load must not take the guidelines down with it — and
       a PDF that can't be read must not silently yield a website-only kit that looks like
       it came from the document. */
    let pdfKit: PdfKit | null = null;
    if (pdfPath) {
        try {
            pdfKit = await readPdfKit(pdfPath, auth.supabaseUrl, auth.anonKey, process.env.ANTHROPIC_API_KEY?.trim());
        } catch (err) {
            console.error("[generate-brand-kit] pdf", err);
            return Response.json({ error: (err as Error).message }, { status: 422 });
        }
    }

    let site: URL | null = null;
    let siteColors: { name: string; hex: string }[] = [];
    let siteFonts = "";
    let logos: { name: string; url: string }[] = [];
    let sheetCount = 0;
    let cssBytes = 0;

    if (rawUrl) {
        try {
            site = await assertPublicUrl(rawUrl);
        } catch (err) {
            // With a PDF in hand a bad address is a note, not a dead end.
            if (!pdfKit) return Response.json({ error: (err as Error).message }, { status: 400 });
        }
    }

    if (site) {
        const page = await grab(site.href, PAGE_CAP);
        if (!page && !pdfKit) {
            return Response.json({ error: `Couldn't load ${site.hostname}. Is the address right, and the site public?` }, { status: 502 });
        }
        if (page) {
            const html = asText(page.body);

            // Inline <style> plus the first few external stylesheets — enough for a theme palette
            // without walking a whole build's worth of CSS on a 10s budget.
            const sheets = [...html.matchAll(/<link\b[^>]*rel\s*=\s*["']stylesheet["'][^>]*>/gi)]
                .map((m) => m[0].match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1])
                .filter((h): h is string => !!h)
                .map((h) => {
                    try {
                        return new URL(h, site!).href;
                    } catch {
                        return "";
                    }
                })
                .filter(Boolean)
                .slice(0, 4);

            const inline = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n");
            const external = (await Promise.all(sheets.map((u) => grab(u, PAGE_CAP)))).map((r) => (r ? asText(r.body) : "")).join("\n");
            const css = `${inline}\n${external}`;

            siteColors = extractColors(css);
            siteFonts = extractFonts(html, css);
            logos = await fetchLogos(html, site);
            sheetCount = sheets.length;
            cssBytes = css.length;
        }
    }

    /* A guidelines document STATES which colour is primary; the CSS reader can only infer
       it from variable names. So the PDF's palette replaces the site's rather than joining
       it — four correct swatches beat four correct swatches buried under six scraped greys.
       Fonts follow the same order. Logos are the site's either way: nothing here pulls a
       mark out of a PDF. */
    const colors = pdfKit?.colors.length ? pdfKit.colors : siteColors;
    const fonts = pdfKit?.fonts || siteFonts;

    if (!colors.length && !fonts && !logos.length) {
        const where = site ? site.hostname : "that PDF";
        return Response.json(
            { error: `Nothing usable found on ${where} — the site may build its styles in JavaScript. Add the colours by hand.` },
            { status: 422 },
        );
    }

    return Response.json({
        colors,
        fonts,
        logos,
        source: {
            site: site?.href ?? "",
            stylesheets: sheetCount,
            css_bytes: cssBytes,
            pdf: pdfKit && { pages: pdfKit.pages, hexes_found: pdfKit.found, named: pdfKit.named },
        },
    });
};
