/**
 * Scores the Brand Kit website reader (netlify/lib/site-brand.mts) against reference kits.
 *
 * No test runner exists in this project; this is a plain script. It fetches live sites, so
 * a site that redesigns will start failing for honest reasons — re-measure it (the
 * /brand-kit skill does that in a real browser) rather than loosening the check.
 *
 * Run:  node --experimental-strip-types scripts/brand-kit-eval/run.mts [url-filter]
 *
 * A site passes COLOUR when one of its reference primaries is within a just-noticeable
 * difference of the kit's first two swatches, and FONT when the kit's heading and body
 * families are the reference's, in that order. Either miss prints the whole kit so the cause is visible.
 */
import { readFileSync } from "node:fs";
import { PAGE_CAP, asText, grab } from "../../netlify/lib/client-sources.mts";
import { oklab, readSiteBrand } from "../../netlify/lib/site-brand.mts";

const { sites } = JSON.parse(readFileSync(new URL("./fixtures.json", import.meta.url), "utf8")) as {
    sites: { url: string; primary: string[]; fonts: string[] }[];
};
const near = (x: string, y: string) => {
    const p = oklab(x);
    const q = oklab(y);
    return Math.hypot(p.L - q.L, p.a - q.a, p.b - q.b) < 0.05;
};

const filter = process.argv[2] ?? "";
let colourHits = 0;
let fontHits = 0;
let fontTotal = 0;
let ran = 0;
for (const s of sites.filter((x) => x.url.includes(filter))) {
    const t0 = Date.now();
    const page = await grab(s.url, PAGE_CAP, 12000);
    if (!page) {
        console.log(`SKIP  ${s.url} (couldn't load)`);
        continue;
    }
    ran++;
    const kit = await readSiteBrand(new URL(s.url), asText(page.body), { logos: false });
    const lead = kit.colors.slice(0, 2).map((c) => c.hex);
    const cOk = s.primary.some((p) => lead.some((h) => near(h, p)));
    // Heading first, body second — the order the dashboard's Fonts field reads them in. A
    // one-entry reference checks the heading only.
    const [kh = "", kb = kh] = kit.fonts.split(",").map((f) => f.trim().toLowerCase());
    const [wh = "", wb] = s.fonts.map((f) => f.toLowerCase());
    const fOk = !s.fonts.length || (kh === wh && (wb === undefined || kb === wb));
    colourHits += +cOk;
    if (s.fonts.length) {
        fontTotal++;
        fontHits += +fOk;
    }
    console.log(
        `${cOk ? "ok  " : "MISS"} colour  ${fOk ? "ok  " : "MISS"} font  ${kit.confident ? "      " : "unsure"}  ${s.url}  ${Date.now() - t0}ms  sheets=${kit.stylesheets}`,
    );
    if (!cOk || !fOk || process.env.VERBOSE) {
        for (const c of kit.colors) console.log(`        ${c.name.padEnd(10)} ${c.hex}  ${c.source}`);
        console.log(`        fonts: ${kit.fonts || "(none)"}   want: ${s.primary.join(" ")} / ${s.fonts.join(", ")}`);
    }
}
console.log(`\ncolour ${colourHits}/${ran}   fonts ${fontHits}/${fontTotal}`);
