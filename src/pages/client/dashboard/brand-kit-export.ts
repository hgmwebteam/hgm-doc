/**
 * The Brand Kit as a stylesheet — the one file a web designer, a Canva template or the
 * HGM web team can drop in and have the client's exact colours, shade scales, fonts and
 * type scale as CSS custom properties. Built from the saved kit on demand, so there is
 * nothing to store and it can never drift from what the dashboard shows.
 *
 * Pure: no React, no DOM. The dashboard copies the string to the clipboard or hands it to
 * the browser as a download.
 */
import type { DashboardContent } from "@/lib/supabase";
import { resolveRoles } from "@/pages/client/dashboard/brand-kit-typography";
import { makeShadeScale, normHex } from "@/pages/client/dashboard/color-scale";
import { TYPE_SCALE, clampFor, typeStepToken } from "@/pages/client/dashboard/type-scale";

type Brand = DashboardContent["brand"];

/** "Primary 2" → "primary-2"; anything unusable → "color". */
const tokenName = (name: string) =>
    name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "color";

/** Colour tokens, one `--color-<name>` per swatch plus its 50–950 scale. Duplicate
 *  names are numbered so two "Accent" swatches never overwrite each other. */
const colorLines = (colors: Brand["colors"]): string[] => {
    const seen = new Map<string, number>();
    const lines: string[] = [];
    for (const c of colors) {
        const hex = normHex(c.hex);
        if (!hex) continue; // a half-typed hex has no business in a stylesheet
        const base = tokenName(c.name);
        const n = (seen.get(base) ?? 0) + 1;
        seen.set(base, n);
        const name = n === 1 ? base : `${base}-${n}`;
        lines.push(`  --color-${name}: ${hex};`);
        for (const s of makeShadeScale(hex) ?? []) lines.push(`  --color-${name}-${s.step}: ${s.hex};`);
        lines.push("");
    }
    return lines;
};

const fontLines = (brand: Brand): string[] => {
    const { heading, heading2, hasHeading2, body } = resolveRoles(brand.fonts, brand.font_files, brand.heading2_font);
    if (!heading && !body) return [];
    const lines = ["  /* Typography */"];
    if (heading) lines.push(`  --font-heading: "${heading}", sans-serif;`);
    if (hasHeading2) lines.push(`  --font-heading-2: "${heading2}", sans-serif; /* Display 2xl & xl */`);
    if (body) lines.push(`  --font-body: "${body}", sans-serif;`);
    lines.push("");
    return lines;
};

const scaleLines = (): string[] => {
    const lines = ["  /* Type scale — Untitled UI, fluid between a 360px and 1280px viewport */"];
    for (const t of TYPE_SCALE) {
        const token = typeStepToken(t.label);
        lines.push(`  --text-${token}: ${clampFor(t.min, t.px)};`);
        lines.push(`  --leading-${token}: ${t.lh}px;`);
        if (t.ls) lines.push(`  --tracking-${token}: ${t.ls}px;`);
    }
    return lines;
};

/** True when there is something worth exporting — at least one real colour or a font. */
export const brandKitHasContent = (brand: Brand) => brand.colors.some((c) => normHex(c.hex)) || !!resolveRoles(brand.fonts, brand.font_files).heading;

/** The complete stylesheet. `clientName` only labels the header comment. */
export const brandKitCss = (brand: Brand, clientName: string, today = new Date()): string => {
    // "*/" in a name would close the header comment and break the whole file.
    const who = clientName.trim().replace(/\*\//g, "* /") || "Brand";
    const colors = colorLines(brand.colors);
    const header = [
        `/* ${who} — brand kit`,
        `   Exported from hgmportal.com on ${today.toISOString().slice(0, 10)}.`,
        `   Colours are the brand's exact values; each has a 50–950 shade scale generated from it. */`,
        "",
        ":root {",
    ];
    const body = [...(colors.length ? ["  /* Colours */", ...colors] : []), ...fontLines(brand), ...scaleLines(), "}", ""];
    return [...header, ...body].join("\n");
};

/** A safe filename for the download: "hgm-test-brand-kit.css". */
export const brandKitFileName = (base: string) => `${tokenName(base) === "color" ? "brand" : tokenName(base)}-brand-kit.css`;
