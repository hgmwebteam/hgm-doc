# HGM SOP house style — v1.9 addendum

Read this together with `HGM-SOP-House-Style_v1_8.md`. Where the two disagree, this
file wins. Decided 2026-10-09 from Kyle and AnhTuan's Loom walkthrough of WEB-004 and
WEB-005, following Gillian's direction against extra review layers. The reference
implementation of the new layout is `reference/sop/masters/HGM-SOP-WEB-004_v0_6.json` (v0.6). The skills that
carry this are `hgm-sop-author` and `hgm-doc-render`, both 2026-10-09.

## Replaces §4 "Ten sections"

Seven sections, `01`–`07`:

1. Purpose and scope
2. Prerequisites
3. Procedure
4. Exceptions and edge cases
5. Final checklist
6. Related documents
7. Revision history

**Removed:** Roles and responsibilities, Definitions, Troubleshooting, and the "Where are
you working?" platform cards.

**Standing rules stay, but short.** Each one is a title plus one line.

## Replaces §5 "term in Definitions"

Plain word first, technical term in parentheses with a few words of meaning, in the
sentence that first uses it. There is no Definitions section to send the reader to.

## Replaces the route rules in §4, §9 and §11

Everyone works in VS Code, where every block kind runs, so there is no platform selector
(`meta.route_selector: true` brings it back if ever needed). Still offer the
`prompt`, `terminal`, `click` and `message` blocks that genuinely exist.

## New rules

- **Prerequisites** are `numcards` with `"collapse": true, "columns": 1`. On screen they
  show titles only and open for detail. In print they are one column, because a two-column
  block cannot split across a page.
- **Escalation** moves to an **If you are stuck** note at the end of Exceptions: ask
  Claude first, then role, person and channel.
- **The final checklist** carries a `prompt` field, which gives it a "hand this checklist
  to Claude" copy button.
- **Links to other SOPs** use `https://hgmportal.com/sop/<ID>`. Never `href="#…"` to a
  section that isn't on the page.
- **The document details grid** is gone from the top of the screen copy. It sits closed at
  the end of the page. The PDF header is unchanged.
- **Asana is the build request only.** Pre-launch (WEB-005) starts when the account
  manager says the client approved. Post-launch hand-offs go in the client websites space
  in Google Chat. Missing API keys are recorded as blanks in the `.env.local` saved to
  1Password.

## New traps (§12)

- **`confirm()` does nothing in the portal.** The viewer's sandboxed iframe has no
  `allow-modals`, so Chrome ignores `confirm()` and returns false. Every confirm-gated
  action silently fails. Use a two-click confirmation instead.
- **A hash link in a `srcdoc` iframe resolves against the portal's URL.** If the browser
  follows one itself, the whole portal loads inside the SOP (the doubled header). The
  page's script now handles every `#` link.
- **The skill's renderer had drifted behind the repo's** `reference/sop/renderer/`, which
  embeds fonts and has `figpath.py`. The 2026-10-09 skill zip is the repo copy plus the
  fixes above. Keep the two identical.
- **Test portal-page changes inside an iframe with the portal's sandbox.** Opening the
  file directly hides both bugs above.

## Replaces gate items 2, 6 and 11 (§13)

- **Item 2:** all seven sections present, or marked not applicable. No Roles, Definitions,
  Troubleshooting or platform cards.
- **Item 6:** the **If you are stuck** note names a role, a person and a channel.
- **Item 11:** on the screen copy:
  - no platform selector
  - one picker, in the Procedure
  - no details grid in the masthead, and a closed Document details panel at the end
  - every phase closed on first load
  - Reset and the phase tick box tested inside a sandboxed iframe
