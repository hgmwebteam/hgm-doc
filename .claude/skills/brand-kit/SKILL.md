---
name: brand-kit
description: Measure a client's brand kit (colours, fonts, logo) from their live website in a real browser, or from their brand guidelines PDF, with every colour traced to where it was found. Use when the dashboard's Generate brand kit came back "Check before saving" or empty, when an AM wants a kit double-checked, or to re-measure the reference sites in scripts/brand-kit-eval/fixtures.json. Invoked as /brand-kit <url and/or pdf path>.
---

# Brand kit

The dashboard's **Generate brand kit** button (`netlify/lib/brand-kit.mts`) reads a site's
CSS without rendering it. That's right on most sites (13/15 on the eval set) but blind to
styling set by JavaScript at runtime — `getaway.house`, `homesteadmodern.com` — and it says
so with a **Check before saving** flag. This skill is the other half: it renders the page in
a real browser and measures what it actually paints.

**The one rule, same as the button: never invent a hex.** Every colour you report comes from
`measure.mjs` output (computed style of a real element) or from `pdf-codes.mts` output (a
code printed in the document). Never read a colour off a screenshot by eye, never "correct"
a hex to look more on-brand, never convert CMYK or Pantone. If the source doesn't give a
code, say it's missing.

## Steps

1. **Website — measure it.** From the repo root:
    ```bash
    node .claude/skills/brand-kit/measure.mjs https://client-site.com
    ```
    It prints JSON (`chromatic` / `neutral` colours with the on-screen `area` they cover and the
    `roles` painting them, `fonts.heading` / `fonts.body` from the real `<h1>` and paragraphs,
    `logo`, `themeColor`) and saves `brand-kit-<host>.png`.
    - **No Playwright** (exit code 2): open the site with the browser tool (Claude in Chrome),
      wait for it to finish loading, then run the contents of
      `.claude/skills/brand-kit/measure-in-page.js` in the page and use its return value, plus a
      screenshot, the same way.
2. **PDF — read its codes.** For a guidelines PDF:
    ```bash
    node --experimental-strip-types .claude/skills/brand-kit/pdf-codes.mts path/to/guide.pdf
    ```
    Then read the PDF itself (Read tool, the colour and typography pages) to see which code the
    document calls primary and what it names each one. A swatch with no printed code is
    reported as missing, not matched to the nearest code.
3. **Look at the screenshot** (Read tool) and decide the roles from the measurements:
    - **Primary** — the chromatic colour on the main buttons / header, usually the largest
      `button` + `header` area. **Secondary / Accent** — other chromatic colours with real area.
    - **Text** — the dark neutral under `heading`/`text`. **Background** — a light neutral with
      big `surface` area, only when it isn't plain white.
    - Drop anything whose only role is `icon`, a colour inside a photo, and hover shades.
    - A monochrome brand (only neutrals) is fine: its near-black is the Primary.
4. **Report** a table — name · hex · where it came from (role + element, or "printed 'HEX …' on
   page N") — plus heading and body fonts, the logo URL, and anything you couldn't find.
   Where the PDF and the site disagree, the PDF wins for colours and fonts.
5. **Getting it into the dashboard:** the AM opens the client's dashboard, Edit dashboard →
   Brand Kit, and types the hexes into the swatches (and the Fonts field as `Heading, Body`).
   This skill does not write to Supabase — dashboard edits go through the AM's own session.

## Keeping the button honest

If the site is (or should be) a reference in `scripts/brand-kit-eval/fixtures.json`, update its
entry from this measurement — `primary` gets the Primary (and any close alternates), `fonts`
gets `[heading, body]` — then run the eval:

```bash
node --experimental-strip-types scripts/brand-kit-eval/run.mts          # live sites
node --experimental-strip-types scripts/brand-kit-eval/pdf-check.mts    # offline PDF checks
```

When the button gets a site wrong that this skill gets right, add it to the fixtures before
changing `netlify/lib/site-brand.mts`, so the fix is measured and can't quietly regress
another site.
