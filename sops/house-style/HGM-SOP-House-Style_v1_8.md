# HGM SOP house style — v1.8

The settled way an HGM SOP is written, built and delivered. This one document replaces
the former house style (v1.7) and the document design system (v2.2); everything in either
that still applies is here, and nothing else has to be read before building.

> **Repo note (2026-10-15):** this file was written for the Claude Project workflow. In
> this repository, "project knowledge" means `sops/masters/`, and the v1.9
> addendum beside this file overrides §4, §5, §11 and gate items 2, 6 and 11. §3's
> versioned master still holds: a revision writes `<ID>_v#_#.json` and deletes the old
> version's file in the same commit, so there is one file per SOP and every past
> version is in the git history.

Approved by: Kyle Zinger (Web & Content Specialist), 2026-09-01.
v1.8 — 2026-09-11. Merged the design system into this document. Screen copy: side menu
replaces the sticky chip rows above 960px, phases are collapsed rows, finished tasks fold,
jump card closes section 01, version shown beside the SOP ID everywhere. Markdown copy
now renders `step` blocks. Plain-word-first rule for task wording. Revisions read the
master from `masters/`.
v1.7 — picker built from `meta.tasks`; route selector; a heading never sits alone on a band.
v1.2–1.6 — callout vocabulary, Portal radius scale, neutral dark theme, table hierarchy,
`message` code kind, expected-result title, masters stored in project knowledge.

Reference implementation: `masters_HGM-SOP-WEB-002_v1_2.json`. Design reference for print:
`hgmsecuritycheatsheet.pdf` and `hgmsecuritysessionoutline.pdf` — when a print question
is not answered here, open them and match what they do.

---

## 1. The two skills do the work

| Skill | Job |
|---|---|
| `hgm-sop-author` | Interviews, drafts to the template (bundled in `references/template.md`), flags gaps, decides phases and task numbering |
| `hgm-doc-render` | Bundles the renderer, the schema tool, the annotator, the fonts and all three output renderers |

Neither needs anything attached to the chat. If a chat starts by asking for
`hgm-doc-renderer.zip`, the skill is not saved — save it and start again.

## 2. One source, three outputs

```
content.json  →  hgm_doc.py      →  HTML + hgm-doc.css  →  WeasyPrint  →  PDF   print / distribution
              →  to_html.py      →  the portal page                            followable on screen
              →  to_markdown.py  →  the review copy                            diff target
```

Always deliver all three plus the JSON. Never a PDF alone. **Do not build HGM documents
with reportlab and never write per-document CSS.** All layout lives in `hgm-doc.css` and
`to_html.py`; a missing component is added there once, registered in `BLOCKS` and
`sop_schema.BLOCK_TYPES`, and reported so the skill can be updated.

## 3. Where the master lives

`masters_HGM-SOP-<DEPT>-###_v#_#.json` in project knowledge. **Store it on every
delivery** and remove the version it supersedes — two masters for one SOP is a retrieval
conflict. The PDF, HTML and Markdown are outputs and are not stored in the project;
losing them costs a re-render. Losing the JSON costs a rebuild (WEB-001's was never
stored and its restyle became a 37-task reconstruction from Markdown).

**Figures have a lossless home and a reference copy.** The renderers consume the annotated
originals, so those live where nothing re-encodes them: the GitHub repo the portal plan
names as the machine-layer record, `masters/` and `figures/` side by side (a local folder
until that repo exists). Project knowledge re-samples every uploaded image — to 1120px
wide, padded to a multiple of 28px, recompressed — so the `fig_HGM-SOP-<DEPT>-###_<n>.png`
copies stored there are for reference and quick screen renders only, never for the
distribution PDF. The master's `figure.path` is the bare `fig_…` filename; all three
renderers resolve it against the JSON's own directory, so put the originals beside the
JSON (a zip dropped into the chat, about 400 KB, costs no context) and render. Never
annotate or store a figure showing a live credential. Long-term the portal plan moves
figures into Supabase storage at intake.

**Revising:** read the master from project knowledge, keep its `fig_` files beside it, write it to disk, edit the blocks,
increment the version, add a revision-history row, strip any id `sop_schema.py stamp`
puts on an aside heading, rerun the gate, re-render all four outputs, store the new
master. Do not ask the user for the file and do not rebuild from the Markdown.

## 4. Structure

Procedures are **phases containing numbered tasks** — never a flat 1..14 list.

```
Phase 1 — Set up a machine        tasks 1.1, 1.2, 1.3 …
Phase 2 — Start a new request     tasks 2.1, 2.2
```

- Ten sections, `01`–`10`, as the template lists them. A section that does not apply is
  present and marked "Not applicable — [reason]".
- A `sub` block carrying `id: "1"`, `"2"` … opens each phase. Only the `sub` blocks that
  `meta.tasks` routes to carry an id.
- Each task is a `step` block with `n`, `t`, `d`, `expect`, and a `body` holding its own
  figures, code blocks and panels. **One action, one screenshot, one task.** The
  screenshot lives inside the task card, never floating after it.
- Alternate routes that replace a run of tasks sit at the end of the phase they replace,
  labelled as the one-go alternative. Offer only the routes that genuinely exist — `click`,
  `terminal`, `prompt` — never invent a button to complete the set.
- The **task picker** is drawn by the renderers from `meta.tasks` (`{badge, label, hint,
  proc}`) at the head of the Procedure section. It is never authored into the blocks.
- The three-to-five things true on every run go in one `rules` block on the dark ground
  at the end of 01, not in three repeated warning panels.

## 5. Wording

- Imperative, one action per task, bold exact UI labels, exact paths and URLs. Never passive.
- State the expected result wherever success is not visible on screen.
- Ban vague words — "regularly", "as needed", "the usual place" — give a schedule, a
  condition or a path, or flag `[NEEDS INPUT]`. Never invent a tool name, menu label,
  path, URL or person's name; a visible gap is correct, a plausible fabrication is the one
  failure that makes an SOP dangerous.
- Branch decision points explicitly: "If X → task 3.2. If Y → task 3.4."
- **Plain word first, term in parentheses, term in Definitions.** Task titles and
  instructions lead with the everyday word ("the live site", "your own private copy of
  the site") and give the technical term once, in parentheses, on first use — then it
  gets a card in Definitions. Commands, prompts and UI labels stay exact; never soften
  those. The reader who only needs to finish never opens the second layer; the reader who
  wants to learn can.
- Voice: plain, direct, second person; confident, never hype; sentence case throughout;
  no exclamation marks, no emoji. Open on a single framing line ("If you remember one
  thing…") and close on a quote in the dark band.

## 6. Metadata

SOP ID `HGM-SOP-[DEPT]-###`, DEPT one of WEB, CON, OPS, FIN, SEC, CLI, numbered
sequentially within the department. Version `1.0` new, `+0.1` wording, whole number when
the process changes; an unapproved draft is `0.x` with `status: draft`. Effective date =
approval date; next review = six months out. Owner = role (current person). Filename
`HGM-SOP-[DEPT]-###_short-title_v#.#`. Show the version beside the SOP ID everywhere the
ID appears — page footer, screen top bar, screen footer.

## 7. Screenshots

- The user captures them; the renderer never generates them. Placeholders are
  `[SCREENSHOT n.m: what it shows, and what to circle]`.
- Crop to the relevant region first. A full-window capture is unreadable at print size.
  Normalise to 1100px wide. Figures cap at 300pt tall in print.
- **Annotate the click target on every screenshot** with `renderer/annotate.py` — solid
  orange ring `#F8943D`, translucent orange interior, Scribe's treatment. **Locate the
  target by pixel** (`--find-blue`), not by eye; eyeballing put the ring in empty space
  twice on WEB-002.
- **Never annotate or publish a screenshot showing a live credential.** A Gemini API key
  was visible in a 1Password list screenshot supplied for WEB-002. Check the whole frame —
  sidebar, tab bar, other windows — before using. Build a throwaway demo item when the
  subject is a credential store.

## 8. Colour, type, geometry

Inter (400/500/600/700 + italic) and Roboto Mono (400/500 + italic). Sentence case for
every heading and title; the only uppercase is the mono label class.

| Hex | Token | Used for |
|---|---|---|
| `#FFFFFF` | white | page, card fills |
| `#FAFAFA` | neutral-50 | tinted cards, meta label column (print) |
| `#F6F9FF` | brand-50 | information panels (print) |
| `#001534` | brand-950 | the closing band, the rules slab, a dark section |
| `#E5E5E5` | neutral-200 | every hairline border and rule (print) |
| `#171717` / `#525252` | neutral-900 / 600 | primary / secondary text (print) |
| `#004FAA` | brand-700 | mono labels, inline emphasis, screen accent |
| `#FAFBFD` / `#F5F7FA` | ground a / b | alternating section grounds on screen |
| `#F8943D` | — | screenshot click marker only; annotation, not document colour |
| `#FFD602` | gem yellow | **wordmark only. Never a document colour.** |

- **Mono uppercase labels carry the structure**: small Roboto Mono, `0.18em`, brand-700,
  hairline rule filling the width, dim `01` numeral. The strongest brand signal.
- **Content lives in cards, not running prose.** A content card has a real title (`t`),
  a short brand rule, then body — never a mono micro-label. Mono uppercase is for phase
  badges, table headers, code label bars and section labels only.
- **On screen, nothing but a card is white.** Grounds alternate a / b by section, first
  change at 01, so the masthead and the picker share a ground. Print keeps white pages.
- **One section may go dark** (`"tone": "dark"`) — once, twice at most. Inside it every
  component inverts because the section redefines the tokens. The section holding the
  closing `band` is forced light.
- **Radius is a token, measured off the HGM Portal**: 8px controls / 12px cards / 16px
  band on screen; 6 / 10 / 14px in print. Never a literal px.
- **Dark mode is neutral grey, never navy.** Brand blue is the accent, never the ground.
- **Blue is structural, never decorative.** Nothing else on a page is a solid dark fill
  except the rules slab, a dark section and the closing band.
- **The first column of a table is the thing you look up** — full ink, weight 500; every
  other cell steps back to the muted tone.
- **The type scale is generous on purpose** — an SOP is used on page fourteen, not page
  one. Print: body 10pt/1.58, title 30pt, phase 13.5pt, task title 12pt, card body 9.5pt.
  Screen (measure 1040px): body 16.5px/1.7, `h1` clamp(33–54px), section `h2` clamp
  (28–40px), phase `h3` clamp(22–30px), task title 18.5px, card body 15px; section rhythm
  68/72px.
- Print geometry: US Letter, margins 32pt top / 40pt sides / 30pt bottom, content width
  533pt, 1px neutral-200 borders, no shadows.

## 9. Callouts — five kinds, and only five

| kind | means |
|---|---|
| `brand` | the rule to carry out of this document — violet, with the HGM gem |
| `note` | context — why the step is the way it is; nothing to do |
| `warning` | you can get this wrong; slow down |
| `critical` | breaks the live site, costs money, or cannot be undone |
| `success` | the recommended default; what good looks like |

Each carries its own icon and colour, identical in every SOP; the schema rejects a sixth.
Choosing a kind is about **meaning**, not colour — two `warning` panels in a row usually
means one is a `note`. Expected-result boxes are brand blue with an eye and a real title;
the key rule is violet with the gem, so the two never read as the same component. The
route icons — `click`, `terminal`, `prompt`, `message` — appear on the route cards and on
every code label bar. `message` is exact wording to post to a person; it has a copy button.

## 10. Component vocabulary

| Block | Use for |
|---|---|
| `section` (`num`, `label`, `tone`) | every top-level section |
| `sub` (`text`, `id`, `d`) | a phase (with id) or an aside heading (without) |
| `lead` · `para` · `bullets` | the framing line; connective prose, sparingly; short lists |
| `cards` (`cols`, `items[{t, d, icon}]`) | 2–4 parallel concepts, definitions, edge cases |
| `numcards` | prerequisites, red flags |
| `step` (`n`, `t`, `d`, `expect`, `body[]`) | **one numbered task with its own figures, code and panels** |
| `rows` | flat step list — older form; prefer `step` |
| `panel` (`kind`, `t`, `text`) | one of the five callouts |
| `code` (`kind`, `label`, `note`, `text`) | terminal / prompt / click / message |
| `table` (`headers`, `rows`, `boxed`) | roles, troubleshooting, routing, revision history |
| `checklist` | the pre-merge gate |
| `figure` (`path`, `caption`) | screenshots |
| `rules` (`k`, `t`, `d`, `items`) | the standing rules, dark slab |
| `band` (`pill`, `quote`, `aside_t`, `aside_d`) | the last block of every document |

Inline HTML allowed in body text: `<strong>`, `<em>`, `<code>`, `<strong class="hl">`.

## 11. The screen copy

- **Side menu** from 960px up: a sticky card in the left margin listing the sections
  under five headings — Before you start (01–04) · Procedure (05, phases nested with a
  done-count each) · When things go wrong (06–07) · Finish (08) · Reference (09–10) —
  with progress and **Reset progress** at its foot. Both columns are fluid: the menu
  narrows 236→172px with the viewport and the content column gives up the 1040px measure
  before the margins give up padding. Below 960px the menu snaps away and a **chip row in
  the top bar** takes over, clipped exactly to the content width. Override grouping with
  `meta.nav_groups`.
- **Top bar**: `SOP-ID · vX.Y`, where-you-are, task count, theme toggle; Reset on narrow screens.
- **Phases are collapsed rows** (`<details>`) on one ground with hairlines between — not
  alternating bands, which read as stripes under six closed rows. Closed: title, intro,
  count, chevron. Any link to a phase opens it; finishing a phase's last task opens the
  next; a returning reader lands with their current phase open. Expand all / Collapse all
  above the first phase.
- **Finished tasks fold** to their title line; the chevron peeks the detail back open;
  unticking unfolds.
- **Jump card** closes section 01 — dark ground, white button — to the Procedure.
- **Task picker** at the head of the Procedure, one card per phase, "Read the steps →".
- **Route selector** ("How do you want to work?") under the route cards in Prerequisites.
  Pick a route and each task shows only that kind of block; a task without that kind shows
  its alternatives with a one-line hint. Remembered per browser.
- Copy button on every code and prompt block. Follow-along checkboxes saved per person.
  Light by default for every viewer; dark only via the toggle, remembered. Images inlined
  into one file. **No horizontal scrollers** anywhere — grid, not carousel.
- **A heading never sits alone on a band.**

## 12. Traps that have already bitten

- **Fonts fail silently.** WeasyPrint drops to DejaVu unless `FontConfiguration` is passed
  to both `CSS()` and `write_pdf()`. `hgm_doc.py` handles it and prints `Brand fonts
  embedded: OK`. No line, no compliance.
- **Escaping is split.** Mono label fields — `table.headers`, `cards[].k`, `code.label`/
  `note` — are escaped, so write a literal `&`. Every other body field is not, so `&amp;`
  is correct there. Backwards prints `&AMP;`.
- **Flex containers do not paginate — and it repeats.** It bit `figure`, then the `rules`
  grid. Any new multi-item block is stacked blocks with `break-inside: avoid` per item.
- **Unbreakable blocks orphan pages.** Figures cap at 300pt (380 left two-thirds of a page
  blank). Prompts are deliberately unbreakable so a copy never drags the footer along.
  Task cards stay breakable — making them atomic was measured and cost three pages.
- **The picker cannot split**, so a Procedure whose picker does not fit the remaining
  page pushes whole; the Definitions page before it can sit around 40% empty. Known,
  accepted, not per-document tunable.
- **`hgm_doc.py` never actually embedded a figure** until v1.8. It checked the path against
  the working directory, then handed WeasyPrint a relative `src` that resolved against the
  renderer's own folder — so the image passed the check and silently loaded nothing. Every
  PDF before v1.8 had captions with no pictures; the "unexplained 20% page" in WEB-001 was
  this. Figures now resolve against the JSON's directory and are passed as absolute paths.
  `pdfimages -list out.pdf` is the check: the count must equal the number of `figure` blocks.
- **`to_markdown.py` skipped `step` blocks** until v1.8. If a phased SOP's Markdown has
  no `####` task lines, the renderer is stale — do not deliver it.
- **A block never used before is probably broken.** Rasterise and look.

## 13. Quality gate — run it, and say so

1. `sop_schema.py validate` passes.
2. Every template section present, or marked "Not applicable — [reason]".
3. Zero `[NEEDS INPUT]` flags.
4. Every task imperative, single-action, verifiable.
5. No vague time, place or frequency words.
6. Escalation names a role, a person and a channel.
7. All header metadata filled, including next review date; revision history present.
8. The build printed `Brand fonts embedded: OK`.
9. Every page rasterised and looked at; none more than about a third empty (see §12 for
   the accepted exceptions). `pdfimages -list` counts one image per `figure` block.
10. No gem yellow in document colour; headings sentence case; document ends in a `band`.
11. Screen copy: no section heading alone on a band; one picker, in the Procedure; route
    selector under the route cards; every phase closed on first load; side menu present
    from 960px and the chip row clipped to the content edge below it.
12. Markdown copy contains every task as a `####` line.
13. All three outputs plus the JSON delivered; master stored, superseded master removed.
