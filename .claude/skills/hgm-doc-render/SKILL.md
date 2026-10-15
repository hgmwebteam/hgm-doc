---
name: hgm-doc-render
description: Render a Hidden Gem Media (HGM) document — SOP, guide, or internal reference — to a brand-styled PDF using the bundled HGM renderer. Use whenever an HGM SOP or document needs to become a PDF, whenever someone asks for the branded or final or distribution copy, or when building the content JSON the renderer consumes. Bundles the renderer, the stylesheet, the Inter and Roboto Mono fonts, and a worked schema example, so nothing needs to be attached to the chat.
---

> **In the hgm-doc repo:** read `sops/CLAUDE.md` first. Build with
> `python3 sops/tools/build.py <SOP-ID>`, which calls the renderer for you and runs
> the automated gate. The renderer lives in `reference/sop/renderer/`; this repo's
> copy of the skill bundles none, so read every `renderer/` below as
> `reference/sop/renderer/`. Where this file says "store the JSON in project
> knowledge", commit `reference/sop/masters/<ID>_v#_#.json` and `git rm` the
> previous version's file in the same commit. There is no approval step and no
> draft marker: every merged version is published, and earlier ones stay linked.


# Rendering an HGM document

This skill contains the renderer. **Never rewrite it, never write reportlab code, and never write per-document CSS.** Retyped layout code is how HGM documents drift out of visual sync, and a hand-reproduced stylesheet introduces errors nobody can see.

## Setup

```bash
pip install weasyprint --break-system-packages
```

Everything else is in `renderer/` in this skill: `hgm_doc.py`, `hgm-doc.css`, `brand_assets.py` (the wordmark as base64 — no image file needed), the Inter and Roboto Mono TTFs, and `sop-001.json` as a worked example.

## Build and run

Write a JSON content file, then:

```bash
python3 renderer/hgm_doc.py content.json HGM-SOP-WEB-007_short-title_v1.0.pdf
```

Figure paths resolve against the directory the content JSON is in, in all three renderers, so it can be run from anywhere. Keep the SOP's figures beside its JSON. In project knowledge, which is flat, each is its own file — `fig_HGM-SOP-<DEPT>-###_<name>.png` — and `figure.path` is that exact filename.

## Content file shape

```json
{ "meta": { ... }, "blocks": [ ... ] }
```

**meta** — `eyebrow`, `title`, `lead`, `sop_id`, `version`, `owner`, `approved_by`, `effective_date`, `next_review`, `frequency`, `duration`. Meta values are escaped by the renderer, so write plain text: `&` not `&amp;`.

**blocks** — an ordered list, each with a `type`:

| type | fields | use for |
|---|---|---|
| `section` | `num`, `label`, `tone` | every top-level section |
| `sub` | `text`, `id`, `d` | a phase within a section; `d` is its intro, kept in the same box as the heading |
| `lead` | `text` | one-sentence framing under the title |
| `para` | `text` | connective prose — sparingly |
| `bullets` | `items[]` | short unordered lists |
| `cards` | `cols`, `style`, `items[{k, t, d, icon}]` | 2–4 parallel concepts |
| `numcards` | `columns`, `start`, `items[{t, d}]` | checklists, prerequisites, red flags |
| `rows` | `numbered`, `start`, `items[{t, d, expect}]` | procedure steps |
| `panel` | `kind`, `t`, `text` | one of five callouts — see below |
| `table` | `headers[]`, `rows[[]]` | metadata, troubleshooting, revision history |
| `figure` | `path`, `caption` | screenshots |
| `code` | `kind`, `label`, `note`, `text` | terminal commands and Claude prompts |
| `checklist` | `items[]` | a print checklist with drawn tick boxes |
| `step` | `n`, `t`, `d`, `expect`, `body[]` | **one numbered task, with its own screenshots and boxes inside the same card** |
| `rules` | `k`, `t`, `d`, `items[{t, d}]` | the three-to-five non-negotiables that hold on every run |
| `band` | `pill`, `quote`, `aside_t`, `aside_d` | the last block of every document |

`panel.kind` is one of `brand`, `note`, `warning`, `critical`, `success`.

`code.kind` is one of `terminal`, `prompt`, `click` — it tints the label bar only. `code.text` is escaped by the renderer and rendered preformatted; it is deliberately allowed to split across pages, because a forty-line prompt cannot fit on one.

**Escaping is split, and it is easy to get wrong.** The mono label fields — `table.headers`, `cards[].k`, and `code.label`/`code.note` — are escaped by the renderer, so write a literal `&` there, never `&amp;` (an entity double-escapes and prints as `&AMP;`). Every other body field is NOT escaped and accepts inline HTML, so `&amp;` is correct there.

Body text fields accept inline HTML — `<strong>`, `<em>`, `<code>`, and `<strong class="hl">` for brand-blue emphasis. Body fields are **not** escaped, so write `&amp;` there.

`renderer/sop-001.json` is the authoritative worked example — it renders the approved reference PDF. Read it before building anything new.

## Tasks: use `step`, not `rows`

A walkthrough SOP numbers its tasks `1.1`, `1.2`, `2.1` inside phases, and each task
card holds its own screenshot. That is what `step` is for:

```json
{"type":"step","n":"1.2","id":"WEB-002.1.2",
 "t":"Open a new VS Code window",
 "d":"Choose File → New Window.",
 "expect":"A second window opens.",
 "body":[{"type":"figure","path":"figa/f1.png","caption":"File → New Window."}]}
```

`body` accepts any block, so a task's figures, code blocks and panels live inside its
card rather than floating after it. Put a phase heading above each group with a `sub`
block carrying `id: "1"`, `"2"`, and so on, so `meta.tasks` can route to it.

**One action, one screenshot, one card.** A task with five screenshots is five tasks.
That is what keeps a card from splitting across a page, and it is how Scribe and the
HGM owner guides lay a walkthrough out.

## Callouts — five kinds, and only five

A `panel` is one of five, and the choice is about **meaning**, not colour. Each carries
its own icon and tint, identical in every SOP, so a reader learns them once.

| `kind` | means |
|---|---|
| `brand` | the rule to carry out of this document — violet, HGM gem |
| `note` | context — why the step is the way it is; nothing to do |
| `warning` | you can get this wrong; slow down |
| `critical` | breaks the live site, costs money, or cannot be undone |
| `success` | the recommended default; what good looks like |

`sop_schema.py` rejects a sixth kind. Two `warning` panels in a row usually means one of
them is a `note` — reach for the meaning, not the colour you feel like.

Three more icons carry the **route** vocabulary. `code.kind` is `terminal`, `prompt`,
`click` or `message` (exact wording to post to a person, with a copy button), and a `cards` item can take the matching `"icon"`, so the cards that introduce
the three routes and the label bar on every code block are visibly the same thing:

```json
{"type":"cards","cols":3,"items":[
  {"icon":"click","t":"Point & click","d":"Buttons and menus. No typing."},
  {"icon":"terminal","t":"Terminal / CLI","d":"Commands you type."},
  {"icon":"prompt","t":"Claude prompt","d":"A prompt to paste in."}]}
```

Every expected-result box carries the `expect` eye automatically — nothing to pass. It is
brand blue; the `brand` callout is violet, so the two never read as the same component.

Icons live in `renderer/icons.py`. **Do not invent a one-off icon inside a document.**
Adding a kind means `icons.py`, `hgm-doc.css`, the `to_html.py` stylesheet and
`sop_schema.PANEL_KINDS` — four places, on purpose.

**A content card uses a real title (`t`), not a mono micro-label (`k`).** `k` is for a
phase number and nothing else; mono uppercase is for table headers, code label bars,
section labels and expected-result labels.

## Standing rules and section tone

When the same warning keeps reappearing — a lead line, a panel in 01, a near-duplicate
in 02 — that is three weak statements of one rule. Consolidate them into a `rules` block:

```json
{"type":"rules","k":"Always true","t":"Four standing rules",
 "d":"These hold on every job.",
 "items":[{"t":"Never work directly on main","d":"A branch is a sandbox…"}]}
```

It renders as a brand-tinted slab carrying white cards, numbered two-up on screen and
stacked in print — deliberately the middle weight on the page, louder than the cards it
sits among and quieter than the jump card and the closing band, which are now the only
two places the deep navy ground is used. Three to five rules; more than that and none of
them is standing.

A `section` also takes `"tone": "dark"` to go full-bleed dark on the screen copy. Inside
it every component inverts automatically — cards, panels, tables, checkboxes — because
the section redefines the tokens rather than restyling each component. Use it once,
maybe twice, for the part that means *stop and pay attention*. The section holding the
closing `band` is forced light whatever it declares.

## Screenshots

Put every screenshot in a `figure` block with a real `caption`. If the file is missing at `path`, the renderer degrades to a visible warning panel naming the expected path rather than failing — so a missing image is loud, not silent.

Images are capped at **300pt** tall and scale to fit, preserving aspect ratio. That cap exists because a figure cannot split: a taller one cannot fit the remaining page, pushes whole, and strands most of a page. Do not raise it without re-running the pagination check below — 380pt was the original value and it left two-thirds of a page blank.

**Annotate the click target on every screenshot.** Use the bundled tool:

```bash
python3 renderer/annotate.py --find-blue shot.png 0.7 1.0   # locate the button
python3 renderer/annotate.py shot.png out.png 0.34 0.90 0.10
python3 renderer/annotate.py --batch targets.json           # all of them at once
```

The marker is a solid orange ring `#F8943D` with a translucent orange interior — the
same treatment Scribe uses, so a walkthrough reads the way people already expect. That
orange is a *screenshot annotation*, not a document accent; the design system's ban is
on gem yellow `#FFD602` in document colour, which nothing here uses.

**Find the target by pixel, not by eye.** Eyeballing a thumbnail routinely puts the ring
in empty space beside the button — it happened twice building WEB-002. `--find-blue`
masks for the saturated blue of UI accent buttons and highlighted menu rows and returns
the centre.

Crop screenshots to the relevant region before inserting. A full-window portrait capture scaled to fit is unreadable at print size.

## Schema, ids, and validation

`renderer/SCHEMA-v2.md` is the frozen content schema. v2 is purely additive over
what the renderer reads — it adds routing, filing and run-state fields the HGM
portal needs, all of which `hgm_doc.py` ignores. A v1 file is a valid v2 file.

```bash
python3 renderer/sop_schema.py validate content.json   # non-zero on problems
python3 renderer/sop_schema.py stamp    content.json   # assign ids, in place
```

**Always run `validate` before rendering, and `stamp` before handing a file to the
portal.** `stamp` assigns step ids once and never renumbers: rewording or inserting
a step leaves existing ids alone, so saved run progress in the portal never shifts
onto the wrong instruction. It is idempotent.

## Structure, not prose

Compose from the block vocabulary rather than running paragraphs. Procedure tasks belong in `step` blocks, with `expect` filled wherever the result is not visible on screen. Every document ends with a `band`.

## Consistency rules that are easy to break

- **Radius is a token, never a literal.** The scale is the HGM Portal's, measured off
  it: `--r-ctl` 8px for controls and `--r` 12px for cards on screen; `--radius-ctl` 6px,
  `--radius-card` 10px, `--radius-band` 14px in print, a step down because a print card
  is physically smaller. A stray literal px is visible next to a token one.
- **Dark mode is neutral grey, never navy.** Brand blue is the accent, not the ground.
- **The first column of a table is the thing you look up** — full ink, weight 500, and
  every other cell steps back to the muted tone.
- **Escaping is split.** Mono label fields — `table.headers`, `cards[].k`,
  `code.label`/`note` — are escaped, so write a literal `&`. Every other body field is
  not escaped, so `&amp;` is correct there. Getting this backwards prints `&AMP;`.
- **Prompts never split across pages.** `.code.prompt` is `break-inside: avoid`, because
  a split block drags the page footer into the clipboard when someone copies it.
- **Task cards stay breakable.** Making them atomic was measured on two documents and
  cost one of them three pages: a card with a 300pt screenshot that will not fit gets
  pushed whole and strands the page behind it. `b_step` still tags tall cards, so it can
  be revisited per-document, but the default does not change.
- **The screen copy defaults to light.** No `prefers-color-scheme` switch — dark only
  when the viewer presses the toggle, and the choice is remembered.
- **On screen, nothing but a card is white.** Section grounds alternate `#FAFBFD` /
  `#F5F7FA` automatically — a five-point step, enough that the eye registers a new
  section and not enough to look like a coloured band. The first change is at section
  01, so the masthead and the picker share one ground. Inside a procedure the phases are
  collapsed rows on one ground, separated by hairlines — alternating bands under six
  closed rows read as stripes. Print keeps white pages.
- **Flex containers do not paginate, and this trap repeats.** It bit `figure`, then bit
  the `rules` grid. Any new multi-item block is stacked blocks with `break-inside: avoid`
  per item, never flex, unless it is a single row that can never run long.
- **No horizontal scrollers on the screen copy.** Content parked off-screen breaks
  find-on-page, hides from anyone who misses the arrows, and prints clipped.

## Pre-delivery check

Run all four. Exit code zero says nothing about layout.

1. The run printed `Brand fonts embedded: OK`. A font fallback means the PDF is set in a substitute face and is **not** brand compliant — fix and rerun before sending.
2. Rasterize at least one page and look at it: `pdftoppm -png -r 100 -f 1 -l 1 out.pdf page`.
3. No page is more than about a third empty. That is a pagination problem, almost always an unbreakable element that cannot fit — usually a tall `figure`.
4. No gem yellow anywhere except the wordmark. Headings in sentence case; the only uppercase is mono labels.

## Extending it

If a needed component genuinely does not exist, add it to `hgm-doc.css` and to the `BLOCKS` dict in `hgm_doc.py` **once**, then tell the user so this skill can be updated. Otherwise the change is lost the next time someone uses the skill.

## The portal page

```bash
python3 renderer/to_html.py content.json out.html
```

The screen rendering, and the one that carries what print cannot:

- **A phase menu** in the left margin, from 1100px up, belonging to the
  Procedure and to nothing else. It lists the phases with a done-count
  each, hangs outside the content column, and is sticky for the length of
  the Procedure, releasing at its end. `.sidecol` is absolutely positioned
  and spans the section, so the release is CSS, not script, and the menu
  cannot float over a section it does not list. The content column keeps
  exactly the left and right edges it has in every other section, so
  nothing shifts as the reader scrolls in.
- **The measure is a function of the menu, not a constant it fits around.**
  `--measure` is `min(1040px, 100vw - 2*(--side + --edge))`, and `--side` is
  `0px` until a menu exists. The menu therefore takes its width from the
  page margin first and borrows from the measure only once the margin has
  run out, so neither can squash the other at any width. Above ~1430px the
  subtraction never bites and the page is identical to one with no menu.
  Measured: 1040px measure at 1440 and up, 993 at 1366, 928 at 1280, 793 at
  1100; menu 180 / 171 / 160 / 138; content aligned with the masthead at
  every one. Below 1100 the menu is gone and the chip row is the
  navigation.
- **Phases are collapsed rows** (`<details>`): title, intro, task count,
  chevron; tasks inside. Any link to a phase opens it; finishing a phase's last
  task opens the next; a returning reader lands with their current phase open.
  Expand all / Collapse all sit above the first phase. `meta.phase_bands` is
  now ignored.
- **Finished tasks fold** to their title line; the chevron on the card peeks
  the detail back open, and unticking unfolds it.
- **A jump card** sits in the masthead directly under the SOP details grid —
  dark ground, white button — straight to the Procedure and its picker. Drawn
  whenever the document has a Procedure.
- **The top bar** is two rows on every width: `SOP-ID · vX.Y` left, the
  current section centred, task count and theme toggle right; then the section
  chip row, clipped to the same left and right edges as the body grid (side
  menu edge to content edge). The bar's real height is written to `--top-h`
  by script, and every `scroll-margin-top` is derived from it.
- **Every in-page anchor eases** to its target (cubic ease-in-out, 320–720ms
  scaled to distance) and sets the hash afterwards; reduced-motion readers get
  the plain jump.
- **The platform selector appears twice** — under the route cards in the
  prerequisites, and again at the head of the Procedure between the picker
  cards and the phase tools. Both drive the same state. A reader who took
  the jump card never saw the first one.
- **A phase can be ticked whole.** The tick box in the phase summary ticks
  every task in the phase rather than holding a second state, so a
  struck-through phase can never sit above a count that disagrees. Its
  click handler is bound directly, not delegated: delegated, `<summary>`
  takes the click as an activation and the phase opens under the reader's
  hand. Complete phases strike through in the body and in the phase menu.
- **The progress line and footer close the last section** rather than
  opening one of their own, at the same 34px the closing band takes above
  itself. A section of their own gave them their own ground and a full
  section's padding, which read as a detached page footer.
- **Phase tools** — Expand all phases · Collapse all · Reset progress — are
  pills cut to the phase-badge pattern (mono, uppercase, tinted, 999px),
  right-aligned above the first phase. The phase list has no rule above the
  first phase or below the last.
- **The route selector is a platform choice, not an instruction-type choice.**
  Block kinds (`prompt`, `terminal`, `click`) are the data model and never
  change; `PLATFORMS` in `to_html.py` maps each place a reader works to the
  kinds it can run — VS Code → all three, Terminal → `terminal`, Claude
  Desktop app → `prompt`. A task with nothing for the chosen platform keeps
  every block and gets a hint. Author the route cards in that order with
  `icon: vscode | terminal | desktop`. The claude.ai website is not a
  platform: the prompts run git and deploys on the reader's machine.
- Unchanged: picker at the head of the Procedure, route bar under the route
  cards, copy button on every command and prompt, follow-along checkboxes
  saved per person, light default with a remembered dark toggle, images
  inlined into one file.

Print styles open every phase and every folded task, and hide the menu, the
jump card and the controls.

Quality-gate item 11 becomes: on the screen copy — no section heading alone
on a band; one picker, in the Procedure; the platform selector under the
route cards and repeated at the head of the Procedure, in VS Code ·
Terminal · Claude Desktop app order; every phase closed on first load; the
phase menu present only within the Procedure and only from 1100px, sticky
from the section top and released at its bottom, never overlapping the
content column at any width down to the breakpoint; the content column
aligned with the masthead at every width; the chip row present on every
width and clipped to the body edges; the jump card under the details grid.

A headless Chromium is usually available (`/opt/pw-browsers/.../chrome` with
playwright). Measure `.side` height against its `scrollHeight` and screenshot
at 1440 and 900 wide before delivering a portal-page change.

## The Markdown copy

```bash
python3 renderer/to_markdown.py content.json out.md
```

The third rendering of the same source — the portal page and the PDF are the other two. This is the copy people review and comment on, and the copy a diff is taken against.

Every `step` renders as a `####` heading (`#### 1.2 Open a new VS Code window  \`WEB-002.1.2\``), its instruction, its body blocks, then its expected result. If a phased SOP's Markdown has no `####` lines, the renderer is stale — do not deliver it.

## Deliverables

Always ship the Markdown source and the content JSON alongside the PDF. Never a PDF alone.

**Then store the JSON.** `masters/HGM-SOP-<DEPT>-###_v#.#.json` in project knowledge, on
every delivery. WEB-001's master was never stored, and restyling it became a 37-task
rebuild from its Markdown rather than a re-render. The other three outputs are
reproducible from the JSON; the JSON is not reproducible from them.
