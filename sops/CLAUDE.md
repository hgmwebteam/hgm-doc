# SOPs in this repository

This folder is where Hidden Gem Media's SOPs are written, revised and published.
It replaces the "HGM SOP Studio" Claude Project. Everything that Project knew is
here: the house style, the two skills, the masters, and the rules below.

The SOP owner is Kyle Zinger (Web & Content Specialist). The approver is the
Operations Manager (currently Gillian). The quality bar is the **new-hire test**:
a competent new hire must be able to complete the task using only the SOP,
without asking anyone a question.

## Where things are

| What | Where |
|---|---|
| Masters, one JSON per SOP, current version only (the only source of truth) | `reference/sop/masters/HGM-SOP-<DEPT>-###_v#_#.json` |
| Figures | `reference/sop/figures/fig_HGM-SOP-<DEPT>-###_<name>.png` or `.jpg` (extension matches the bytes). The master's `figure.path` is the bare filename; the renderer finds it in `../figures/` (`renderer/figpath.py`) |
| House style | `sops/house-style/` — read v1.8, then the v1.9 addendum, which wins where they disagree |
| Authoring rules, template, interview | `.claude/skills/hgm-sop-author/` |
| Renderer, schema tool, annotator | `reference/sop/renderer/`, the only copy (the skill no longer bundles one) |
| Build + automated gate | `python3 sops/tools/build.py <SOP-ID>` → `sops/dist/<SOP-ID>/` |
| What the portal reads | `src/data/sops.json` (the list, bundled into the site, written by `tools/build-sops-index.py`); `reference/sop/html/`, `pdf/`, `markdown/` (record copies, and the bucket's layout); `public/sops/` for the public SOPs (WEB-003, 004, 005) |
| Publish to the portal | `.github/workflows/sop-publish.yml`, after a merge to `main`. **Switched off**: see below |

The skills were written for a Claude Project. Translate as you read them:
"project knowledge" and `masters/` mean `reference/sop/masters/`; "deliver the four
files" means build them with `build.py` and open a pull request; "store the master"
means commit it. A master's filename carries its version
(`HGM-SOP-WEB-002_v1_4.json`, underscores), the convention `tools/build-sops-index.py`
and `reference/sop/README.md` use. There is only ever one file per SOP: **a revision
writes the new version's file and deletes the old one (`git rm`) in the same
commit.** Git keeps every past version.

## How a change reaches hgmportal.com

```
request in VS Code → new reference/sop/masters/<ID>_v#_#.json on a branch → build.py → pull request
   → "SOP check" Action posts the gate report and the rendered files
   → Kyle merges → "SOP publish" Action uploads to Supabase → live on hgmportal.com
```

Nothing reaches the portal until a pull request is merged into `main`. Never push
to `main` directly and never merge a pull request yourself; Kyle merges.

**Not wired end to end yet (2026-10-15).** `SOP publish` is off and
`sops/publish.config.json` is unconfirmed, because a bucket upload alone changes
nothing the portal shows: the SOP list is `src/data/sops.json`, bundled into the
site, and WEB-003, 004 and 005 load from `public/sops/`, not the bucket. Until Kyle
decides how that is automated, a revision's pull request also carries the copies
the portal reads (`reference/sop/README.md`): the HTML over
`reference/sop/html/<ID>.html`, the PDF and Markdown into `reference/sop/pdf/` and
`markdown/` as `<ID>_v#_#`, the same HTML and PDF in `public/sops/` for a public
SOP, and `src/data/sops.json` regenerated with `python3 tools/build-sops-index.py`.
That script rewrites every `change_summary` from the newest revision row, so keep
the committed ones, write only the new one, then `npx prettier --write
src/data/sops.json`. Private SOPs' HTML and PDF still go into the `sops` bucket by
hand.

## Revising an existing SOP (`/sop-update`)

1. Pull `main`, then create a branch `sop/<ID>-v<new version>` (for example
   `sop/WEB-002-v1.5`).
2. Read the master and the house style. Do not ask for the file. Do not rebuild
   from Markdown or a PDF.
3. If the request leaves a real gap, ask **one batched round** of questions, then
   proceed. Never drip-feed follow-ups.
4. Edit the JSON blocks with a short script (read, modify, write), never by
   retyping the whole file. Keep 1-space JSON indentation as the masters use.
5. Version: **+0.1** for wording or clarity; **next whole number** when the
   process itself changes; **no bump** for a presentation-only change where no
   content changes. A draft stays `0.x` with `status: draft`. Save the result as
   `<ID>_v<new>.json` and `git rm` the old version's file in the same commit
   (with no bump, keep the filename).
6. Add a revision-history row at the **bottom** of the table (rows are authored
   oldest first): date (today), version, author, one-line change summary. The
   last row's version must equal `meta.version`; `build.py` fails otherwise.
7. Run `sop_schema.py stamp` so new steps get ids (existing ids never change),
   then strip any id it put on an aside heading.
8. `python3 sops/tools/build.py <ID>`. Then rasterise the PDF
   (`pdftoppm -png -r 60 <pdf> /tmp/page`) and **look at every page**, and open
   the HTML. Fix anything the gate or your eyes catch.
9. Commit, push, and open the pull request with `gh pr create`. The body says
   what changed and why, lists anything you changed that was not asked for, and
   includes `sops/dist/REPORT.md`.
10. Tell Kyle the pull request link and anything a person still has to check.

## A new SOP (`/sop-new`)

Follow `hgm-sop-author` exactly: intake anything (notes, a Fireflies transcript,
a Scribe export, screenshots), interview once, draft in chat as Markdown for
review, then build the JSON master on approval. Number the ID sequentially
within its department; check `reference/sop/masters/` for the last one used and ask Kyle
before using a number, because IDs have been consumed out of order before.

## Rules that do not bend

- **Never invent** a tool name, menu label, path, URL or person's name. Write
  `[NEEDS INPUT: what is missing]`. A visible gap is correct; a plausible
  fabrication is a serious failure.
- **Screenshots come from Kyle.** Mark placeholders as
  `[SCREENSHOT n.m: what it shows, and what to circle]`. When he adds an image,
  open it and **check the whole frame for live credentials** before using it,
  crop it, and ring the click target with `annotate.py --find-blue`, by pixel.
- **Never set `status: approved`** unless Kyle says the Operations Manager has
  approved that version. On approval (`/sop-approve`): a `0.x` draft becomes
  `1.0`; `effective_date` is the approval date; `next_review` is six months later.
- **Never change the renderer to fix one document.** No per-document CSS. If a
  component genuinely does not exist, add it once in the renderer and say so.
- **Tell Kyle about every change he did not ask for**, in the pull request and
  in your reply.
- Security findings about the portal itself go to Kyle to raise with AnhTuan
  and Gillian. Do not fix them inside an SOP change.

## Quality gate — run it and say that you ran it

`build.py` checks items 1, 3, 7, 8, 10 and 12 and warns on 9. You check the rest
by reading the rendered output. From house style v1.8 §13 with the v1.9 changes:

1. `sop_schema.py validate` passes.
2. All seven sections present (Purpose and scope, Prerequisites, Procedure,
   Exceptions and edge cases, Final checklist, Related documents, Revision
   history), or marked "Not applicable — [reason]".
3. Zero `[NEEDS INPUT]` flags before approval (a draft may carry them).
4. Every task imperative, single-action, verifiable.
5. No vague time, place or frequency words.
6. The **If you are stuck** note names a role, a person and a channel.
7. All header metadata filled, including next review; revision history present.
8. The PDF build printed `Brand fonts embedded: OK`.
9. Every page looked at; none more than about a third empty; one PDF image per
   `figure` block.
10. No gem yellow; headings sentence case; the document ends in a `band`.
11. Screen copy: no platform selector; one picker, in the Procedure; no details
    grid in the masthead; every phase closed on first load.
12. The Markdown copy has every task as a `####` line.

Do not open a pull request for a document that fails a hard check, even if asked
to hurry. Say what failed instead.

## Renderer traps worth knowing

- `band.pill` is one word; `band.aside_d` a short phrase. Longer values clip.
- Metadata cells (`approved_by`, `duration`, `frequency`) overflow at ~40 characters.
- Figures wider than about 2.5:1 are illegible in print. Some figures are JPEG
  bytes with a `.png` name; the renderer reads the bytes.
- Escaping is split: `table.headers`, `cards[].k`, `code.label` and `code.note`
  take a literal `&`; every other body field takes `&amp;`.
