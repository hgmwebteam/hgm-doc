/**
 * Offline self-check for the Brand Kit PDF reader (netlify/lib/pdf-brand.mts and the PDF
 * half of netlify/lib/brand-kit.mts). No test runner exists in this project; this is a
 * plain assert script, and it needs no network or API key: the model is a stub.
 *
 * Run:  node --experimental-strip-types scripts/brand-kit-eval/pdf-check.mts
 *
 * The three PDFs in ./pdfs were printed from HTML in headless Chromium, so they have a real
 * text layer, and they cover the three ways a guide writes its palette:
 *   codes-without-hash   "HEX 2C3B2A", "HEX: e9dfcc", "Hex code B5623B", RGB lines, a footer
 *                        grey "#9A9A9A" on every page, and an "Ember" swatch with no code
 *   hash-codes-and-cmyk  "#1F4E79" plus CMYK, one page
 *   swatches-only        colour blocks, no codes at all
 */
import type Anthropic from "@anthropic-ai/sdk";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { type KitModel, kitFromPdf } from "../../netlify/lib/brand-kit.mts";
import { readCodes } from "../../netlify/lib/pdf-brand.mts";

const pdf = (name: string) => new Uint8Array(readFileSync(new URL(`./pdfs/${name}.pdf`, import.meta.url)));

/* ── code parsing ───────────────────────────────────────────────────────── */

const codes = readCodes(["Moss HEX 2C3B2A  RGB 44 59 42", "Sand Hex: e9dfcc R233 G223 B204 · page 12 · 404 · #abc · price $120", "footer #9A9A9A"]);
assert.deepEqual(
    codes.map((c) => c.hex),
    ["#2C3B2A", "#E9DFCC", "#AABBCC", "#9A9A9A"],
    "reads HEX without #, RGB triples (merged with the same hex), and 3-digit only with #",
);
assert.deepEqual(codes[0].pages, [1], "an RGB restatement on the same page doesn't add a page");
assert.equal(readCodes(["Call 555 123456 or see page 101"]).length, 0, "bare numbers are not colour codes");

/* ── no model: extracted order, furniture last and left out ─────────────── */

const bare = await kitFromPdf(pdf("codes-without-hash"));
assert.deepEqual(
    bare.colors.map((c) => c.hex),
    ["#2C3B2A", "#E9DFCC", "#B5623B"],
    "footer grey printed on every page is page furniture, not the palette",
);
assert.equal(bare.named, false);
assert.match(bare.notes.join(" "), /order the codes appear/, "positional names are flagged to the AM");
assert.match(bare.colors[0].source, /HEX 2C3B2A.*page 2/, "each swatch says where it was printed");

/* ── stub model: it may only choose codes by ID ─────────────────────────── */

let sent: Anthropic.MessageCreateParamsNonStreaming | undefined;
const stub =
    (input: unknown): KitModel =>
    async (req) => {
        sent = req;
        return { content: [{ type: "tool_use", id: "t", name: "brand_kit", input }] } as unknown as Anthropic.Message;
    };

const named = await kitFromPdf(
    pdf("codes-without-hash"),
    stub({
        colors: [
            { code: "c1", name: "Moss", evidence: "page 2, the primary colour" },
            { code: "#7A1F12", name: "Ember", evidence: "made up — not an ID" },
            { code: "c9", name: "Ghost", evidence: "no such code" },
            { code: "c3", name: "Clay", evidence: "page 2, calls to action" },
            { code: "c1", name: "Moss again", evidence: "duplicate" },
            { code: "c2", name: "Sand", evidence: "page 2, the ground" },
        ],
        unlisted: [{ name: "Ember", page: 2 }],
        heading_font: "Playfair Display",
        body_font: "Helvetica",
    }),
);
assert.deepEqual(
    named.colors.map((c) => `${c.name} ${c.hex}`),
    ["Moss #2C3B2A", "Clay #B5623B", "Sand #E9DFCC"],
    "a hex or an unknown ID from the model never reaches the palette; duplicates collapse",
);
assert.equal(named.named, true);
assert.equal(named.fonts, "Playfair Display", "a typeface the document never names is dropped");
assert.match(named.notes.join(" "), /Ember \(page 2\) without a printed colour code/);
const docBlock = (sent!.messages[0].content as Anthropic.ContentBlockParam[])[0];
assert.equal(docBlock.type, "document", "the model is shown the PDF itself, not just its text");
assert.match(JSON.stringify(sent!.messages[0].content), /c4  #9A9A9A .*printed on 4 of 4 pages/, "furniture is marked, and listed last");

/* ── a model failure never blocks the draft ─────────────────────────────── */

const failed = await kitFromPdf(pdf("codes-without-hash"), async () => {
    throw new Error("overloaded");
});
assert.deepEqual(
    failed.colors.map((c) => c.hex),
    bare.colors.map((c) => c.hex),
);

/* ── the other two shapes ───────────────────────────────────────────────── */

const hash = await kitFromPdf(pdf("hash-codes-and-cmyk"));
assert.deepEqual(
    hash.colors.map((c) => c.hex),
    ["#1F4E79", "#F2EDE4", "#E07A5F", "#8C7B6B"],
);

const swatches = await kitFromPdf(pdf("swatches-only"));
assert.equal(swatches.colors.length, 0);
assert.match(swatches.notes.join(" "), /prints no colour codes/, "a codeless guide says so instead of guessing");

console.log("pdf-check: all assertions passed");
