/**
 * Print every colour code and embedded typeface in a brand guidelines PDF, using the same
 * reader the Generate brand kit button does (netlify/lib/pdf-brand.mts).
 *
 *   node --experimental-strip-types .claude/skills/brand-kit/pdf-codes.mts <file.pdf>
 *
 * Run from the repo root. These codes are the ONLY hexes a PDF-drafted kit may contain.
 */
import { readFileSync } from "node:fs";
import { readBrandPdf } from "../../../netlify/lib/pdf-brand.mts";

const file = process.argv[2];
if (!file) {
    console.error("usage: pdf-codes.mts <file.pdf>");
    process.exit(1);
}
const pdf = await readBrandPdf(new Uint8Array(readFileSync(file)));
console.log(`${pdf.pages} pages · ${pdf.codes.length} colour codes · ${pdf.printOnly} CMYK/Pantone mentions\n`);
for (const c of pdf.codes) {
    const furniture = pdf.pages >= 3 && c.pages.length >= Math.max(3, Math.ceil(pdf.pages * 0.75));
    console.log(
        `${c.hex}  "${c.raw}"  page ${c.page}${c.pages.length > 1 ? ` (also ${c.pages.slice(1).join(", ")})` : ""}${furniture ? "  ← on nearly every page: likely footer" : ""}`,
    );
}
console.log(`\nEmbedded typefaces: ${pdf.fontCandidates.join(", ") || "(none)"}`);
