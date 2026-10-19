# SOPs in this repository

This folder is where Hidden Gem Media's SOPs are written, revised and published.
It replaces the "HGM SOP Studio" Claude Project. Everything that Project knew is
here: the house style, the two skills, the masters, and the rules below.

The SOP owner is Kyle Zinger (Web & Content Specialist). The quality bar is the
**new-hire test**: a competent new hire must be able to complete the task using
only the SOP, without asking anyone a question.

**There is no approval step (since 2026-10-15).** Every version that is merged is
published as it stands, and every earlier version stays published and linked from
the SOP's page. Where the house style or the skills talk about approval, the
Operations Manager signing off, `status: approved` or a draft marker, ignore it.

**Draft means unfinished, not unapproved.** An SOP is published as soon as its
skeleton and layout are right, even while it waits on screenshots or answers.
`meta.status` is `draft` until nothing is outstanding, then `live`. The portal
shows Draft, with what it is waiting on ("Waiting on 15 images and 34 answers"),
whenever the master says `draft` or still has a gap open: a figure whose file is
missing, an "Image to be added" panel, or a `[SCREENSHOT]` or `[NEEDS INPUT]`
flag. `build.py` fails an SOP marked `live` that still has one.

## Where things are

| What | Where |
|---|---|
| Masters, one JSON per SOP, current version only (the only source of truth) | `sops/masters/HGM-SOP-<DEPT>-###_v#_#.json` |
| Figures | `sops/figures/fig_HGM-SOP-<DEPT>-###_<name>.png` or `.jpg` (extension matches the bytes). The master's `figure.path` is the bare filename; the renderer finds it in `../figures/` (`renderer/figpath.py`) |
| House style | `sops/house-style/` — read v1.8, then the v1.9 addendum, which wins where they disagree |
| Authoring rules, template, interview | `.claude/skills/hgm-sop-author/` |
| Renderer, schema tool, annotator | `sops/renderer/`, the only copy (the skill no longer bundles one) |
| Build + automated gate | `python3 sops/tools/build.py <SOP-ID>` → `sops/dist/<SOP-ID>/` |
| Published pages and PDFs, one per version | `public/sops/html/<SOP-ID>_v#_#.html`, `public/sops/pdf/<SOP-ID>_v#_#.pdf` |
| Markdown review copies, one per version | `sops/markdown/<SOP-ID>_v#_#.md` |
| The SOP list the portal reads | `src/data/sops.json`, written by `sops/tools/build-index.py` (never by hand) |
| Build and gate on a pull request (report only) | `.github/workflows/sop-check.yml` |
| Publish after the merge, on main | `.github/workflows/sop-publish.yml` |

The skills were written for a Claude Project. Translate as you read them:
"project knowledge" and `masters/` mean `sops/masters/`; "deliver the four
files" means build them with `build.py` and open a pull request; "store the master"
means commit it. A master's filename carries its version
(`HGM-SOP-WEB-002_v1_4.json`, underscores), the convention `sops/tools/build-index.py`
and `sops/README.md` use. There is only ever one master per SOP: **a
revision writes the new version's file and deletes the old one (`git rm`) in the
same commit.** Git keeps every past master. The published page and PDF of every
version are never deleted: they are what the portal's version links open.

## How a change reaches hgmportal.com

```
request in VS Code → new sops/masters/<ID>_v#_#.json on a branch → build.py → pull request
   → "SOP check" builds it on GitHub (PDF included), runs the gate and posts the report
   → Kyle merges (no need to wait for the check)
   → "SOP publish" builds what the merge changed on main and commits the page, PDF,
     Markdown and updated src/data/sops.json → Netlify deploys → live at
     hgmportal.com/sop/<ID>, with the previous version at hgmportal.com/sop/<ID>/v<old version>
```

Nothing reaches the portal until a pull request is merged into `main`. Never push
to `main` directly and never merge a pull request yourself; Kyle merges. Publishing
happens after the merge, not on the pull request: publishing on the pull request
was tried first and lost both times Kyle merged within seconds of opening one.
If SOP publish ever fails, Actions → SOP publish → Run workflow rebuilds and
publishes every SOP.

PDFs are built on GitHub, so a Mac without WeasyPrint can still revise an SOP:
`build.py --no-pdf` checks the page and the Markdown locally, the pull request's
check attaches a PDF to look at, and SOP publish builds the one that goes live.
`build.py --publish` does locally what SOP publish does
(it needs WeasyPrint for the PDF; without it, `sops/tools/build-index.py` stops
because the new version's PDF is missing).

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
   content changes. Save the result as `<ID>_v<new>.json` and `git rm` the old
   version's master in the same commit (with no bump, keep the filename, and the
   published files of that version are rebuilt in place).
6. Add a revision-history row at the **bottom** of the table (rows are authored
   oldest first): date (today), version, author, one-line change summary. The
   last row's version must equal `meta.version`; `build.py` fails otherwise. That
   row's summary is what the portal shows for the version.
7. Run `sop_schema.py stamp` so new steps get ids (existing ids never change),
   then strip any id it put on an aside heading.
8. `python3 sops/tools/build.py <ID>` (add `--no-pdf` without WeasyPrint). If a PDF
   was built, rasterise it (`pdftoppm -png -r 60 <pdf> /tmp/page`) and **look at
   every page**; otherwise look at the PDF the check attaches to the pull request.
   Open the HTML. Fix anything the gate or your eyes catch.
9. Commit, push, and open the pull request with `gh pr create`. The body says
   what changed and why, lists anything you changed that was not asked for, and
   includes `sops/dist/REPORT.md`.
10. Tell Kyle the pull request link and anything a person still has to check.

## A new SOP (`/sop-new`)

Follow `hgm-sop-author` exactly: intake anything (notes, a Fireflies transcript,
a Scribe export, screenshots), interview once, draft in chat as Markdown for
review, then build the JSON master on approval of the draft. Number the ID
sequentially within its department; check `sops/masters/` for the last
one used and ask Kyle before using a number, because IDs have been consumed out
of order before.

## Rules that do not bend

- **Never invent** a tool name, menu label, path, URL or person's name. Write
  `[NEEDS INPUT: what is missing]`. A visible gap is correct; a plausible
  fabrication is a serious failure.
- **Screenshots come from Kyle.** Mark placeholders as
  `[SCREENSHOT n.m: what it shows, and what to circle]`. When he adds an image,
  open it and **check the whole frame for live credentials** before using it,
  crop it, and ring the click target with `annotate.py --find-blue`, by pixel.
  Every SOP is public on hgmportal.com, so a missed credential is published.
- **Never delete a published version's page or PDF** in `public/sops/`. Earlier
  versions stay linked from the SOP's page.
- **Never change the renderer to fix one document.** No per-document CSS. If a
  component genuinely does not exist, add it once in the renderer and say so.
  A renderer change rebuilds every SOP's current page in the check.
- **Tell Kyle about every change he did not ask for**, in the pull request and
  in your reply.
- Security findings about the portal itself go to Kyle to raise with AnhTuan
  and Gillian. Do not fix them inside an SOP change.

## Quality gate — run it and say that you ran it

`build.py` checks items 1, 7, 8, 10 and 12 and warns on 3 and 9. You check the
rest by reading the rendered output. From house style v1.8 §13 with the v1.9
changes:

1. `sop_schema.py validate` passes.
2. All seven sections present (Purpose and scope, Prerequisites, Procedure,
   Exceptions and edge cases, Final checklist, Related documents, Revision
   history), or marked "Not applicable — [reason]".
3. `[NEEDS INPUT]` flags are reported. They are published as visible gaps, so
   close every one you can before the pull request.
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
- Metadata cells (`duration`, `frequency`) do not wrap in the PDF: keep them under 40
  characters. There is no Approved by field (no approval step since 2026-10-15).
- Figures wider than about 2.5:1 are illegible in print. Some figures are JPEG
  bytes with a `.png` name; the renderer reads the bytes.
- Escaping is split: `table.headers`, `cards[].k`, `code.label` and `code.note`
  take a literal `&`; every other body field takes `&amp;`.
