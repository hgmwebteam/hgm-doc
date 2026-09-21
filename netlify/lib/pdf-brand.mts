import zlib from "node:zlib";
import { extractText, getDocumentProxy } from "unpdf";

/**
 * Reads a brand guidelines PDF down to the two things a Brand Kit needs: the hexes the
 * document actually prints, and the typefaces it is actually set in.
 *
 * Both are VERBATIM reads, and that is the whole point. generate-brand-kit deliberately
 * lifts a website's colours out of its CSS rather than asking a model for them, because a
 * plausible-but-wrong hex gets copied into emails and a website and is very hard to walk
 * back. A PDF gets the same treatment: everything here comes out of the file itself, and
 * `hexes` is the allow-list the caller checks a model's answer against — a colour that
 * isn't printed in the document cannot reach the kit, whatever a model says.
 *
 * Two different readers, because the two facts live in different places:
 *
 *  - TEXT goes through pdf.js (via unpdf). A hand-rolled content-stream scraper looked
 *    tempting and is a trap: kerned text arrives split across TJ arrays, and subset fonts
 *    encode glyph ids that only the font's own ToUnicode CMap can turn back into "#2C302C".
 *    pdf.js already does all of that correctly.
 *  - FONTS come from the PDF's own /BaseFont entries. A brand guide is typeset in the
 *    brand's typefaces, so the file's font table is a better answer than any reading of the
 *    page — it says "Canela-Regular" even on a page that only shows the word "Headings".
 */

/** Bytes we will pull out of storage. Comfortably above a real brand guide (a 40-page
 *  InDesign export with images runs 5–15MB) and far below anything that threatens the
 *  function's memory. */
export const PDF_CAP = 25_000_000;

const MAX_PAGES = 40;
const MAX_CHARS = 20_000;

export interface BrandPdf {
    /** Pages in the file (not the number read, which MAX_PAGES caps). */
    pages: number;
    /** Page text in reading order, each headed by its page number. Capped. */
    text: string;
    /** Every hex literally printed in the document, in document order, RAW — the caller
     *  normalises, so there is one normaliser rather than two that can drift. */
    hexes: string[];
    /** Typeface families the file embeds. Unfiltered: the caller owns the generic-font
     *  denylist, and it already has one for the website reader. */
    fontCandidates: string[];
}

/* ── fonts ──────────────────────────────────────────────────────────────── */

/** Subset prefix ("ABCDEF+Canela-Regular") and weight/style suffix stripped, so four
 *  embedded cuts of one typeface collapse to one family the AM can read.
 *
 *  Deliberately a short, conservative list: "Canela Deck" and "Söhne Buch" are family
 *  names, not styles, and stripping every trailing word would have eaten both. */
const STYLE = /^(regular|bold|italic|oblique|bolditalic|boldoblique|light|medium|semibold|demibold|demi|extrabold|ultrabold|black|heavy|thin|roman|mt|ps)$/i;

const familyOf = (baseFont: string): string => {
    const parts = baseFont
        .replace(/^[A-Z]{6}\+/, "")
        .split(/[-,]/)
        .filter(Boolean);
    while (parts.length > 1 && STYLE.test(parts[parts.length - 1])) parts.pop();
    return parts.join(" ").replace(/\s+/g, " ").trim();
};

/**
 * Every /BaseFont in the file, including the ones inside compressed object streams.
 *
 * PDF 1.5+ packs dictionaries into FlateDecoded /ObjStm streams, so a scan of the raw
 * bytes alone finds nothing on a modern InDesign or Canva export. Inflating every stream
 * we can and searching those too is what makes this work on real files.
 */
function baseFonts(buf: Buffer): string[] {
    const chunks: Buffer[] = [buf];
    const STREAM = Buffer.from("stream");
    const ENDSTREAM = Buffer.from("endstream");

    let i = 0;
    while ((i = buf.indexOf(STREAM, i)) !== -1) {
        let start = i + STREAM.length;
        if (buf[start] === 0x0d) start++;
        if (buf[start] === 0x0a) start++;
        const end = buf.indexOf(ENDSTREAM, start);
        if (end === -1) break;
        const slice = buf.subarray(start, end);
        // Most are Flate; a few are raw deflate. Anything else (images, fonts, JPX) simply
        // fails both and is skipped — we only care about streams that hold dictionaries.
        for (const inflate of [zlib.inflateSync, zlib.inflateRawSync]) {
            try {
                chunks.push(inflate(slice));
                break;
            } catch {
                /* not a deflate stream */
            }
        }
        i = end + ENDSTREAM.length;
    }

    const out: string[] = [];
    for (const chunk of chunks) {
        // latin1 so byte values survive the round trip — a PDF name is ASCII, but the
        // surrounding stream is binary and utf-8 decoding would mangle the offsets.
        for (const m of chunk.toString("latin1").matchAll(/\/BaseFont\s*\/([!-~]+)/g)) {
            const family = familyOf(m[1]);
            if (family && family.length <= 40 && !out.some((o) => o.toLowerCase() === family.toLowerCase())) out.push(family);
        }
    }
    return out;
}

/* ── the read ───────────────────────────────────────────────────────────── */

/** Throws with a message meant for an account manager — the caller passes it straight on. */
export async function readBrandPdf(bytes: Uint8Array): Promise<BrandPdf> {
    // Copied BEFORE pdf.js sees it. pdf.js takes ownership of the array it is handed and
    // detaches the underlying ArrayBuffer, so a /BaseFont scan run afterwards reads an
    // empty buffer and silently returns no fonts at all.
    const raw = Buffer.from(bytes);

    let pdf;
    try {
        pdf = await getDocumentProxy(bytes);
    } catch {
        throw new Error("That file couldn't be opened as a PDF — it may be corrupted or password-protected.");
    }

    const { text: pageTexts } = await extractText(pdf, { mergePages: false });

    const blocks: string[] = [];
    let chars = 0;
    for (let i = 0; i < pageTexts.length && i < MAX_PAGES && chars < MAX_CHARS; i++) {
        const body = (pageTexts[i] ?? "").replace(/[ \t ]+/g, " ").trim();
        if (!body) continue;
        const clipped = body.slice(0, MAX_CHARS - chars);
        blocks.push(`--- page ${i + 1} ---\n${clipped}`);
        chars += clipped.length;
    }
    const text = blocks.join("\n\n");

    // Document order, not frequency: a guidelines doc introduces its primary first, and
    // that ordering is a real signal the website reader never gets.
    const hexes: string[] = [];
    for (const m of text.matchAll(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi)) {
        if (!hexes.some((h) => h.toLowerCase() === m[0].toLowerCase())) hexes.push(m[0]);
    }

    return { pages: pdf.numPages, text, hexes, fontCandidates: baseFonts(raw) };
}
