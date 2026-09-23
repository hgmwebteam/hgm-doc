import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { PAGE_CAP, asText, assertPublicUrl, grab } from "./client-sources.mts";
import { PDF_CAP, type PdfCode, readBrandPdf } from "./pdf-brand.mts";
import { GENERIC_FONT, type Logo, type Swatch, readSiteBrand } from "./site-brand.mts";

/**
 * Builds a first-draft Brand Kit — palette, fonts and logo files — from a client's website,
 * their brand guidelines PDF, or both, for the account manager to review.
 *
 * NOTHING HERE INVENTS A HEX, and every part of the design follows from that. A brand kit's
 * value is that the colours are exactly the client's; a model asked to "find the brand
 * colours" will happily return a plausible navy that appears nowhere in their material, and
 * a wrong-but-believable hex gets copied into emails and a website and is very hard to walk
 * back. So:
 *
 *  - WEBSITE: no model. netlify/lib/site-brand.mts scores the colours the site's own CSS
 *    declares by where they're used (button and header backgrounds, heading text, the
 *    theme-color meta), and says when the evidence is thin.
 *  - PDF: every colour code the document prints is read out verbatim first
 *    (netlify/lib/pdf-brand.mts — "#2C302C", "HEX 2C302C", RGB triples). Claude then reads
 *    the actual PDF, pages and all, to decide which code is the primary and what the client
 *    calls it — but it answers with the ID of a code from that list, never with a hex. It
 *    cannot add a colour to the palette, only choose and name them. Swatches the document
 *    shows WITHOUT a printed code come back as a note for the AM to fill in by hand.
 *
 * A PDF beats the website outright when it yields a palette: a guidelines document STATES
 * which colour is primary; the site can only be read for it. Logos come from the site.
 *
 * Runs inside generate-brand-kit-background, so the model has minutes, not the ~10s a
 * synchronous function gets — that budget is what used to drop the naming pass.
 */

const MODEL = "claude-fable-5";
const MODEL_MS = 150_000;
const MAX_COLORS = 6;

/** The PDF goes to the model whole only under this; base64 adds a third, and the request cap is 32MB. */
const VISION_CAP = 20_000_000;
const VISION_PAGES = 100;

const ROLES = ["Primary", "Secondary", "Accent", "Neutral", "Primary 2", "Accent 2"];

export interface KitInput {
    url: string;
    pdfPath: string;
}

export interface Kit {
    colors: Swatch[];
    fonts: string;
    logos: Logo[];
    /** Plain sentences for the AM: what to check, what couldn't be read. */
    notes: string[];
    /** False when the palette should be checked against the source before it's saved. */
    confident: boolean;
    source: {
        site: string;
        stylesheets: number;
        pdf: { pages: number; codes: number; named: boolean; vision: boolean } | null;
    };
}

/** Thrown with a message written for an account manager; the job stores it verbatim. */
export class KitError extends Error {}

/**
 * Where an uploaded guidelines PDF lives — "acme/1726000000-brand-guide.pdf", the same
 * shape the onboarding form's own brand-kit uploads use.
 *
 * Pinned to that shape on purpose. The endpoint takes a storage path from the browser, so
 * without it a team member could point it at any object in any bucket the caller's key can
 * reach and have the contents read back to them through the draft.
 */
export const isBrandKitPath = (p: string) => p.length <= 300 && !p.includes("..") && /^[a-z0-9][a-z0-9_-]*\/[a-z0-9][a-z0-9._-]*\.pdf$/i.test(p);

const numberRepeats = <T extends { name: string }>(colors: T[]) =>
    colors.map((c, i, all) => {
        const before = all.slice(0, i).filter((x) => x.name === c.name).length;
        return before ? { ...c, name: `${c.name} ${before + 1}` } : c;
    });

/* ── the guidelines PDF ─────────────────────────────────────────────────── */

const KIT_TOOL: Anthropic.Tool = {
    name: "brand_kit",
    description: "Record the palette and typefaces a brand guidelines document specifies.",
    input_schema: {
        type: "object",
        properties: {
            colors: {
                type: "array",
                description: `The brand's palette, most important first, at most ${MAX_COLORS}. Each entry picks a code from the list you were given.`,
                items: {
                    type: "object",
                    properties: {
                        code: { type: "string", description: "The code's ID from the list, e.g. 'c3'. Never a hex." },
                        name: {
                            type: "string",
                            description:
                                "What the document calls this colour or its role — 'Moss', 'Primary', 'Sand'. The document's own word where it has one.",
                        },
                        evidence: { type: "string", description: "Where the document says so, in a few words: 'page 4, listed first as the primary colour'." },
                    },
                    required: ["code", "name", "evidence"],
                },
            },
            unlisted: {
                type: "array",
                description: "Brand colours the document SHOWS as a swatch or names as part of the palette but prints no code for. Empty if none.",
                items: {
                    type: "object",
                    properties: { name: { type: "string" }, page: { type: "integer" } },
                    required: ["name", "page"],
                },
            },
            heading_font: { type: "string", description: "The typeface the document gives for headings or display. Empty string if it does not say." },
            body_font: { type: "string", description: "The typeface the document gives for body copy. Empty string if it does not say." },
        },
        required: ["colors", "unlisted", "heading_font", "body_font"],
    },
};

const KIT_SYSTEM = `You read brand guidelines documents for HiddenGem Media, a marketing agency for short-term rental and boutique hospitality businesses. An account manager reviews what you return, and then it becomes the client's official Brand Kit — the colours and typefaces their website, emails and social posts are built in.

You get the client's brand guidelines PDF and a numbered list of every colour code printed in it, read out of the file mechanically. Your job is to decide which of those codes make up the brand palette, in what order, and what the document calls each one. You cannot add a colour: you answer with code IDs from the list, and the hex comes from the list.

How to read it:
- Order the palette the way the document does: the primary colour first, then secondary, then accents, then neutrals. Where the document says which colour leads ("our primary colour", "use sparingly"), follow that over the order codes happen to appear in.
- Leave out codes that are not part of the palette: a grey that is only page furniture (the list marks codes printed on nearly every page), a colour inside an example photo, mockup or chart, a code for a tint the document shows only as a percentage of another colour.
- Name each colour with the document's own word where it has one ("Moss", "Harbour Blue"); otherwise use its role (Primary, Secondary, Accent, Neutral).
- When the document shows a brand colour as a swatch but prints no code for it, don't pick another code to stand in for it — list it under "unlisted" so the account manager can add it by hand.
- For the fonts, name a typeface only if the document assigns it to that role. One typeface for everything goes in both fields. None named: empty strings — never a well-known typeface because it looks similar.

A short, honest answer beats a padded one. Two colours the document actually specifies is a good result.`;

export interface PdfKit {
    colors: Swatch[];
    fonts: string;
    pages: number;
    codes: number;
    named: boolean;
    vision: boolean;
    notes: string[];
}

/** The one call the PDF pass makes; injectable so the check script can drive it offline. */
export type KitModel = (req: Anthropic.MessageCreateParamsNonStreaming) => Promise<Anthropic.Message>;

const liveModel =
    (apiKey: string): KitModel =>
    (req) =>
        new Anthropic({ apiKey, maxRetries: 1 }).messages.create(req, { timeout: MODEL_MS });

async function readPdfKit(path: string, supabaseUrl: string, anonKey: string, apiKey?: string): Promise<PdfKit> {
    // Downloaded with the PUBLISHABLE key: the brandkits bucket is public-read, so a
    // service-role key would only widen what a malformed path could reach.
    const { data: blob, error } = await createClient(supabaseUrl, anonKey).storage.from("brandkits").download(path);
    if (error || !blob) throw new KitError("That PDF couldn't be read back from storage — try uploading it again.");
    if (blob.size > PDF_CAP) {
        throw new KitError(
            `That PDF is ${Math.round(blob.size / 1_000_000)}MB, which is too big to read. Export a lighter copy — or just the colour and type pages — and upload that.`,
        );
    }
    return kitFromPdf(new Uint8Array(await blob.arrayBuffer()), apiKey ? liveModel(apiKey) : undefined);
}

/** Everything after the download. Exported for scripts/brand-kit-eval/pdf-check.mts. */
export async function kitFromPdf(bytes: Uint8Array, model?: KitModel): Promise<PdfKit> {
    // readBrandPdf hands its array to pdf.js, which detaches it — keep our own copy for the model.
    const forModel = Buffer.from(bytes);
    // readBrandPdf's own errors ("couldn't be opened as a PDF…") are written for the AM.
    const pdf = await readBrandPdf(bytes).catch((err: unknown) => {
        throw new KitError(err instanceof Error ? err.message : "That PDF couldn't be read.");
    });
    const notes: string[] = [];

    const embedded = pdf.fontCandidates.filter((f) => !GENERIC_FONT.test(f) && !/^liberation/i.test(f));
    if (!pdf.codes.length && !embedded.length && !pdf.text) {
        throw new KitError(
            "That PDF has no readable text layer — it's likely a scan or an exported image. Add the colours by hand, or upload a version exported from the design file.",
        );
    }

    // Furniture: a code printed on (nearly) every page of a multi-page document is the
    // footer or page-number colour, not the palette.
    const furniture = (c: PdfCode) => pdf.pages >= 3 && c.pages.length >= Math.max(3, Math.ceil(pdf.pages * 0.75));
    const ordered = [...pdf.codes.filter((c) => !furniture(c)), ...pdf.codes.filter(furniture)];

    // The floor: what ships when the model can't or won't. Positional names, flagged.
    let colors: Swatch[] = numberRepeats(
        ordered
            .filter((c) => !furniture(c))
            .slice(0, MAX_COLORS)
            .map((c, i) => ({ name: ROLES[i] ?? `Colour ${i + 1}`, hex: c.hex, source: `printed "${c.raw}" on page ${c.page}` })),
    );
    let fonts = embedded.slice(0, 2).join(", ");
    let named = false;
    const vision = forModel.byteLength <= VISION_CAP && pdf.pages <= VISION_PAGES;

    if (model && (pdf.text || vision)) {
        try {
            const list = ordered.length
                ? ordered
                      .map(
                          (c, i) =>
                              `c${i + 1}  ${c.hex}  printed as "${c.raw}" on page ${c.page}${furniture(c) ? `  (printed on ${c.pages.length} of ${pdf.pages} pages)` : ""}`,
                      )
                      .join("\n")
                : "(the document prints no colour codes)";
            const content: Anthropic.ContentBlockParam[] = [];
            if (vision) content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: forModel.toString("base64") } });
            content.push({
                type: "text",
                text: `COLOUR CODES PRINTED IN THE DOCUMENT (pick from these by ID):
${list}

TYPEFACES THE FILE IS EMBEDDED WITH:
${embedded.join("\n") || "(none the file admits to)"}
${vision ? "" : `\nDOCUMENT TEXT (the file was too large to attach whole):\n${pdf.text}\n`}
Record this client's brand kit.`,
            });

            const message = await model({
                model: MODEL,
                max_tokens: 4096,
                output_config: { effort: "medium" },
                system: KIT_SYSTEM,
                tools: [KIT_TOOL],
                tool_choice: { type: "tool", name: KIT_TOOL.name },
                messages: [{ role: "user", content }],
            });

            const block = message.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
            const input = (block?.input ?? {}) as {
                colors?: { code?: unknown; name?: unknown; evidence?: unknown }[];
                unlisted?: { name?: unknown; page?: unknown }[];
                heading_font?: unknown;
                body_font?: unknown;
            };

            /* THE CHECK THIS DESIGN RESTS ON: the model names a code by ID; the hex is ours. An
               ID that isn't on the list is dropped, so it can reorder and rename the palette
               but cannot put a colour in it. */
            const picked: Swatch[] = [];
            for (const c of input.colors ?? []) {
                const idx = Number(String(c?.code ?? "").replace(/^c/i, "")) - 1;
                const code = ordered[idx];
                if (!code || picked.some((p) => p.hex === code.hex)) continue;
                const name =
                    String(c?.name ?? "")
                        .trim()
                        .slice(0, 40) ||
                    ROLES[picked.length] ||
                    `Colour ${picked.length + 1}`;
                const why = String(c?.evidence ?? "")
                    .trim()
                    .slice(0, 120);
                picked.push({ name, hex: code.hex, source: `printed "${code.raw}" on page ${code.page}${why ? ` — ${why}` : ""}` });
                if (picked.length >= MAX_COLORS) break;
            }
            // Same rule for typefaces: kept only if written in the document or embedded in it.
            const said = `${pdf.text}\n${embedded.join("\n")}`.toLowerCase();
            const chosen: string[] = [];
            for (const key of ["heading_font", "body_font"] as const) {
                const t = String(input[key] ?? "").trim();
                if (t && t.length <= 40 && said.includes(t.toLowerCase()) && !chosen.some((x) => x.toLowerCase() === t.toLowerCase())) chosen.push(t);
            }
            if (picked.length) {
                colors = numberRepeats(picked);
                named = true;
            }
            if (chosen.length) fonts = chosen.join(", ");
            const unlisted = (input.unlisted ?? [])
                .map((u) => ({ name: String(u?.name ?? "").trim(), page: Number(u?.page) || 0 }))
                .filter((u) => u.name && !picked.some((p) => p.name.toLowerCase() === u.name.toLowerCase()))
                .slice(0, 6);
            if (unlisted.length) {
                notes.push(
                    `The guide shows ${unlisted.map((u) => `${u.name}${u.page ? ` (page ${u.page})` : ""}`).join(", ")} without a printed colour code — add ${unlisted.length === 1 ? "it" : "them"} by hand from the design file.`,
                );
            }
        } catch (err) {
            // Never fatal: the extracted palette is already in `colors`.
            console.warn("[brand-kit] naming pass skipped:", err instanceof Error ? err.message : err);
        }
    }

    if (!pdf.codes.length) {
        notes.push(
            pdf.printOnly
                ? "The guide gives its colours as CMYK or Pantone only. Those don't convert to an exact screen colour, so ask the client's designer for the hex codes."
                : "The guide prints no colour codes, so its swatches have to be added by hand.",
        );
    } else if (!named) {
        notes.push("Role names follow the order the codes appear in the guide — rename any that are wrong.");
    }
    return { colors, fonts, pages: pdf.pages, codes: pdf.codes.length, named, vision, notes };
}

/* ── the whole kit ──────────────────────────────────────────────────────── */

export async function buildKit(input: KitInput, env: { supabaseUrl: string; anonKey: string; apiKey?: string }): Promise<Kit> {
    const notes: string[] = [];

    /* The PDF first, on its own error budget. It is the better source, so a site that fails
       to load must not take the guidelines down with it — and a PDF that can't be read must
       not silently yield a website-only kit that looks like it came from the document. */
    const pdfKit = input.pdfPath ? await readPdfKit(input.pdfPath, env.supabaseUrl, env.anonKey, env.apiKey) : null;
    if (pdfKit) notes.push(...pdfKit.notes);

    let site: URL | null = null;
    let siteRead: Awaited<ReturnType<typeof readSiteBrand>> | null = null;
    if (input.url) {
        try {
            site = await assertPublicUrl(input.url);
        } catch (err) {
            if (!pdfKit) throw new KitError((err as Error).message);
            notes.push(`The website address didn't work (${(err as Error).message.replace(/\.$/, "")}), so logos weren't pulled.`);
        }
    }
    if (site) {
        const page = await grab(site.href, PAGE_CAP, 12_000);
        if (!page) {
            if (!pdfKit) throw new KitError(`Couldn't load ${site.hostname}. Is the address right, and the site public?`);
            notes.push(`Couldn't load ${site.hostname}, so logos weren't pulled.`);
        } else {
            siteRead = await readSiteBrand(site, asText(page.body), { sheetMs: 10_000 });
        }
    }

    const usePdfColors = !!pdfKit?.colors.length;
    const colors = usePdfColors ? pdfKit!.colors : (siteRead?.colors ?? []);
    const fonts = pdfKit?.fonts || siteRead?.fonts || "";
    const logos = siteRead?.logos ?? [];
    const confident = usePdfColors ? pdfKit!.named : (siteRead?.confident ?? false);

    if (!usePdfColors && siteRead && !siteRead.confident && colors.length) {
        notes.push(
            `${site!.hostname} builds most of its styling in JavaScript, so this palette rests on thin evidence. Check it against the live site before saving.`,
        );
    }
    if (!colors.length && !fonts && !logos.length) {
        throw new KitError(
            site
                ? `Nothing usable found on ${site.hostname} — the site builds its styles in JavaScript, which this reader can't see. Add the colours by hand, or upload the brand guidelines PDF.`
                : "Nothing usable found in that PDF. Add the colours by hand.",
        );
    }
    return {
        colors,
        fonts,
        logos,
        notes,
        confident,
        source: {
            site: site?.href ?? "",
            stylesheets: siteRead?.stylesheets ?? 0,
            pdf: pdfKit && { pages: pdfKit.pages, codes: pdfKit.codes, named: pdfKit.named, vision: pdfKit.vision },
        },
    };
}
