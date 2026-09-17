#!/usr/bin/env node
/**
 * Generates src/styles/help-centre.css from src/styles/help-centre-tokens.json.
 *
 * The JSON is the "HGM Portal Tokens" variable collection of the Figma file
 * "Reporting System" (key rdig9bGu5N0KogiBW8H2CF), dumped with both modes, plus its
 * nine text styles and the elevation/card effect. The help centre and the team's
 * "Report a ticket" form are held against that file node for node by an automated
 * proof, so the stylesheet is generated rather than typed: a token can only be wrong
 * in the JSON, never in a hand-edited copy of it.
 *
 *   node scripts/gen-help-centre-css.mjs            # writes src/styles/help-centre.css
 *   node scripts/gen-help-centre-css.mjs --check    # exits 1 if the file is stale
 *
 * What comes out, and why it is shaped that way:
 *
 *   - Every variable becomes a CSS custom property `--hc-<name with / as ->`, for
 *     example `--hc-text-primary`, `--hc-bg-brand-solid`, `--hc-radius-lg`,
 *     `--hc-space-24`. Light values sit on `.hc`; Dark values on `.dark-mode .hc`,
 *     because the portal flips its theme by toggling `dark-mode` on <html>
 *     (theme-provider). Hex is written as the JSON resolves it, never as an alias to
 *     a portal token, so a screen matches the frame even if theme.css moves.
 *   - The elevation/card effect becomes `--hc-elevation-card`, ready for box-shadow.
 *   - `--hc-font-mono` is the Geist Mono stack the mono/id style needs. Inter is the
 *     portal's own `--font-body`.
 *   - Each text style becomes a Tailwind `@utility` named `hc-t-<style with / as ->`
 *     (`hc-t-label-field`, `hc-t-mono-id`, ...) setting family, size, line height in
 *     px, weight and tracking in px exactly as the style has them. A utility rather
 *     than a plain class so it takes variants: `hc-t-display-title sm:hc-t-display-hero`
 *     is how a heading is 28/32 on a phone and 40/44 on a desktop with ONE text node.
 *   - A short hand-maintained tail (BASE_RULES below): the `.hc` scope's font and
 *     colour, the focus ring the build notes require on everything, the spinner, and
 *     the reduced-motion collapse.
 *
 * House style: no em or en dashes anywhere, including this output.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const TOKENS = join(here, "..", "src", "styles", "help-centre-tokens.json");
const OUT = join(here, "..", "src", "styles", "help-centre.css");

const tokens = JSON.parse(readFileSync(TOKENS, "utf8"));
const collection = tokens.collections.find((c) => c.collection === "HGM Portal Tokens");
if (!collection) throw new Error("help-centre-tokens.json has no 'HGM Portal Tokens' collection");

/** `bg/brand-solid_hover` -> `bg-brand-solid_hover`; the underscore is part of the name. */
const cssName = (name) => name.replace(/\//g, "-");

/** A FLOAT token is a length in px (spacing, radius); a COLOR is hex as dumped. */
const cssValue = (variable, mode) => {
    const v = variable.values[mode];
    if (variable.type === "COLOR") return String(v).toLowerCase();
    if (variable.type === "FLOAT") return `${v}px`;
    throw new Error(`unhandled token type ${variable.type} on ${variable.name}`);
};

/** "#1717170a" -> "rgba(23,23,23,0.04)": the effect colour carries its alpha in the last byte. */
const rgba = (hex8) => {
    const h = hex8.replace("#", "");
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return `rgba(${r},${g},${b},${Number(a.toFixed(2))})`;
};

const shadow = (effect) =>
    effect.effects
        .filter((e) => e.type === "DROP_SHADOW")
        .map((e) => `${e.offset.x}px ${e.offset.y}px ${e.radius}px ${e.spread}px ${rgba(e.color)}`)
        .join(", ");

/** "Inter Semi Bold" -> { family: var(--font-body), weight: 600 }. */
const WEIGHTS = { Thin: 100, "Extra Light": 200, Light: 300, Regular: 400, Medium: 500, "Semi Bold": 600, Bold: 700, "Extra Bold": 800, Black: 900 };
const font = (name) => {
    const m = name.match(/^(Inter|Geist Mono) (.+)$/);
    if (!m) throw new Error(`unknown font "${name}"`);
    const weight = WEIGHTS[m[2]];
    if (!weight) throw new Error(`unknown weight "${m[2]}" in "${name}"`);
    return { family: m[1] === "Inter" ? "var(--font-body)" : "var(--hc-font-mono)", weight };
};

/** Trailing float noise from Figma (-0.20000000298023224) rounds to what the designer typed. */
const px = (n) => `${Number(Number(n).toFixed(2))}px`;

const MONO_STACK = '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

/* ── the hand-maintained tail ────────────────────────────────────────────── */

const BASE_RULES = `
/* ── Base ────────────────────────────────────────────────────────────────────
   Hand-maintained inside the generator (BASE_RULES); everything above is data. */

/* The scope. Any help centre or reporting form screen sits inside one .hc so the
   tokens above resolve; HelpFrame (help-atoms.tsx) is the element that carries it. */
.hc {
    font-family: var(--font-body);
    color: var(--hc-text-primary);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
}

/* Focus is visible on everything (build notes): a 2px border/brand ring with a 2px gap
   of the page ground, outside the control, never removed. Written unlayered on purpose
   so a Tailwind outline-none utility on the same element cannot win. Controls whose
   frame draws the focus state as a thicker brand BORDER instead (Field/Select,
   Field/Textarea, the filter and priority chips) carry hc-focus-border and paint
   that border themselves; the outline would double it. */
.hc :focus-visible {
    outline: 2px solid var(--hc-border-brand);
    outline-offset: 2px;
}
.hc .hc-focus-border:focus-visible,
.hc .hc-focus-border:focus-within {
    outline: none;
}
/* A landmark the skip link jumps to is a target, not a control: no ring on the page. */
.hc [tabindex="-1"]:focus-visible {
    outline: none;
}

/* The upload drop zone's focus (Field/Upload state=focus): the ring is drawn as two
   shadows around the zone, 2px of page ground then 2px of border/brand. */
.hc .hc-focus-halo:focus-within {
    outline: none;
    box-shadow:
        0 0 0 2px var(--hc-bg-page),
        0 0 0 4px var(--hc-border-brand);
}

/* The spinner inside a loading Button. A 20px arc turning once a second. */
@keyframes hc-spin {
    to {
        transform: rotate(360deg);
    }
}
.hc-spin {
    animation: hc-spin 1s linear infinite;
}

/* Motion: nothing moves except a 120ms hover and a 200ms state change, and both
   collapse under prefers-reduced-motion (build notes). */
.hc-hover {
    transition-property: background-color, border-color, color, box-shadow, opacity;
    transition-duration: 120ms;
    transition-timing-function: ease-out;
}
.hc-state {
    transition-property: background-color, border-color, color, box-shadow, opacity;
    transition-duration: 200ms;
    transition-timing-function: ease-out;
}
@media (prefers-reduced-motion: reduce) {
    .hc-spin {
        animation: none;
    }
    .hc-hover,
    .hc-state {
        transition-property: opacity;
    }
}
`;

/* ── assemble ────────────────────────────────────────────────────────────── */

const lines = [];
lines.push("/*");
lines.push(" * GENERATED by scripts/gen-help-centre-css.mjs from src/styles/help-centre-tokens.json.");
lines.push(" * Do not edit by hand: change the JSON (or the generator) and run the script.");
lines.push(" *");
lines.push(` * Source: Figma "Reporting System", collection "${collection.collection}", modes ${collection.modes.join(" and ")}.`);
lines.push(` * ${collection.variables.length} variables, ${tokens.styles.text.length} text styles, ${tokens.styles.effects.length} effect style.`);
lines.push(" */");
lines.push("");

const emitMode = (selector, mode, includeFloats) => {
    lines.push(`/* ${mode} values */`);
    lines.push(`${selector} {`);
    for (const variable of collection.variables) {
        if (variable.type === "FLOAT" && !includeFloats) continue;
        lines.push(`    --hc-${cssName(variable.name)}: ${cssValue(variable, mode)}; /* ${variable.name} */`);
    }
    if (includeFloats) {
        lines.push("");
        for (const effect of tokens.styles.effects) {
            lines.push(`    --hc-${cssName(effect.name)}: ${shadow(effect)}; /* ${effect.name} */`);
        }
        lines.push(`    --hc-font-mono: ${MONO_STACK};`);
    }
    lines.push("}");
    lines.push("");
};

// Light is the default; Dark rides on the portal's own theme class. Spacing and radius
// are the same in both modes so they are written once.
emitMode(".hc", "Light", true);
emitMode(".dark-mode .hc", "Dark", false);

lines.push("/* ── Text styles ───────────────────────────────────────────────────────────");
lines.push("   Tailwind utilities so they take variants (sm:hc-t-display-hero). Family, size,");
lines.push("   line height in px, weight and tracking in px exactly as the style has them. */");
for (const style of tokens.styles.text) {
    const f = font(style.font);
    lines.push(`@utility hc-t-${cssName(style.name)} {`);
    lines.push(`    /* ${style.name}: ${style.font} ${style.size}/${style.lineHeight}, tracking ${px(style.letterSpacing)} */`);
    lines.push(`    font-family: ${f.family};`);
    lines.push(`    font-size: ${style.size}px;`);
    lines.push(`    line-height: ${style.lineHeight}px;`);
    lines.push(`    font-weight: ${f.weight};`);
    lines.push(`    letter-spacing: ${px(style.letterSpacing)};`);
    if (style.case && style.case !== "ORIGINAL") lines.push(`    text-transform: ${style.case === "UPPER" ? "uppercase" : style.case === "LOWER" ? "lowercase" : "none"};`);
    if (style.decoration && style.decoration !== "NONE") lines.push(`    text-decoration-line: ${style.decoration.toLowerCase()};`);
    lines.push("}");
}
lines.push("");
lines.push(BASE_RULES.trimStart());

const css = lines.join("\n");
if (/[\u2013\u2014]/.test(css)) throw new Error("an em or en dash slipped into the stylesheet");

if (process.argv.includes("--check")) {
    const current = readFileSync(OUT, "utf8");
    if (current !== css) {
        console.error(`${OUT} is stale; run node scripts/gen-help-centre-css.mjs`);
        process.exit(1);
    }
    console.log("help-centre.css is current");
} else {
    writeFileSync(OUT, css);
    console.log(`wrote ${OUT}: ${collection.variables.length} tokens, ${tokens.styles.text.length} text styles`);
}
