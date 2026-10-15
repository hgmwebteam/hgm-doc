# HGM SOPs — how this works

SOPs are written and revised in VS Code with Claude Code, inside the `hgm-doc` repo,
and published to hgmportal.com when a pull request is merged. The Claude Project
("HGM SOP Studio") is retired: everything it knew lives in this repo.

## The flow

```
You, in VS Code:  /sop-update WEB-002 make task 6.1's table add Brandon for design
        │
        ▼
Claude Code: reads sops/CLAUDE.md + the skills + the master → makes a branch
             → writes sops/masters/HGM-SOP-WEB-002_v1_5.json, removes
             _v1_4, adds a revision row → build.py renders HTML/MD and runs the gate
             → looks at every page → opens a pull request
        │
        ▼
GitHub "SOP check" (on the pull request): rebuilds with the PDF and posts the
             gate report as a comment, with the files attached
        │
        ▼
You: read the report, open the PDF or HTML, merge (any time; nothing waits on it)
        │
        ▼
GitHub "SOP publish" (on main, after the merge): builds the new version's page,
             PDF and Markdown, updates the SOP list and commits them to main
        │
        ▼
Netlify deploys main: hgmportal.com/sop/HGM-SOP-WEB-002 shows v1.5, and
             v1.4 stays one click away under Versions
```

Your part is two things: typing the request, and merging. Nothing goes live until
you merge, and nothing is published by Claude Code directly.

## Why it is built this way

- **The JSON master is the only source.** HTML, PDF and Markdown are rebuilt from it
  every time, by a script, so they can never drift from each other or from the master.
- **Git replaces "store the master".** One file per SOP in `sops/masters/`,
  named with its version in underscores (`HGM-SOP-WEB-002_v1_4.json`, never `_v1.4`).
  A revision adds the new version's file and deletes the old one in the same commit, so
  every past master is in the history and never in the folder.
- **Every version stays published.** Each version's page and PDF are kept in
  `public/sops/` under their version number, and the SOP's page lists them all.
- **No approval step.** The merge is the only gate: a deliberate human click after
  reading the report.
- **No secrets.** Every SOP is a public file on the site, so nothing needs a Supabase
  key, in GitHub or anywhere else. The PDF is built on GitHub, so your Mac does not
  need WeasyPrint.

## Commands

| Command | What it does |
|---|---|
| `/sop-update <ID> <change>` | Revise an SOP, open a pull request |
| `/sop-new <DEPT> <title>` + material | Interview, draft for review, then build v0.1 |
| `python3 sops/tools/build.py [ID]` | Build and gate by hand; outputs in `sops/dist/` (`--no-pdf` without WeasyPrint) |

Screenshots: drop the image into `sops/figures/` named
`fig_HGM-SOP-<DEPT>-###_<what-it-shows>.png` (`.jpg` for a JPEG: the extension matches
the bytes) and tell Claude which task it belongs to.
Claude checks it for credentials, crops it, and rings the click target. SOPs are
public, so nothing secret may be in a screenshot.

## Where everything is

Every SOP source file is in this folder. Five other places hold SOP files only
because a tool requires it.

```
sops/
  CLAUDE.md, README.md   how SOPs are written and published (Claude Code reads CLAUDE.md)
  masters/      HGM-SOP-WEB-002_v1_5.json     current version only — the source of truth
  figures/      fig_HGM-SOP-WEB-002_f1-….jpg  screenshots, annotated and credential-swept
  markdown/     HGM-SOP-WEB-002_v1_5.md       review copy of every version, for diffs
  renderer/     to_html.py hgm_doc.py …       the only renderer in this repo
  house-style/  v1.8 and the v1.9 addendum (the Loom review)
  tools/        build.py (build + gate + --publish), build-index.py (writes the SOP list)
  dist/         build output, git-ignored
```

| Elsewhere, because a tool needs it there | |
|---|---|
| `public/sops/{html,pdf}/<id>_v#_#.*` | every published version's page and PDF (only `public/` is served) |
| `src/data/sops.json` | the SOP list the portal bundles, written by `tools/build-index.py` |
| `src/pages/team/sops/` | the portal's SOP dashboard and viewer |
| `.claude/skills/hgm-sop-author`, `.claude/skills/hgm-doc-render`, `.claude/commands/sop-*.md` | Claude Code only finds skills and commands there |
| `.github/workflows/sop-check.yml`, `sop-publish.yml` | the pull-request check, and publishing on main after the merge (GitHub only runs workflows from there) |

The private `sops` storage bucket (`supabase/migrations/20260920100000_sops_bucket.sql`)
is no longer read; it still holds the old private copies.

Figure paths in a master are bare filenames. The renderer looks beside the master
first, then in `../figures/` (`renderer/figpath.py`), so a master renders from flat
project knowledge and from this layout without editing. The claude.ai copy of the
`hgm-doc-render` skill bundles its own renderer; when `renderer/` changes, update it
from here.

## Checks before anything lands here

- `sop_schema.py validate` passes on the master.
- Every figure looked at for a credential value, an unblurred client password, or a
  personal address. Public business contact details are fine.
- Figure extension matches the bytes (`file figures/*`). The renderer labels the
  data: URI from the bytes regardless, but a mislabelled file is still wrong.
- The HTML has no external `<link>` or `<script src>` — the renderer embeds fonts and
  figures; a page that reaches out to the network will not load in the viewer.

## Known gaps
- WEB-001 references four screenshots not yet captured: `fig_HGM-SOP-WEB-001_f1-note`,
  `f2-newfile`, `f3-edit`, `f4-link` (.png or .jpg — match the bytes). The page shows a
  visible "Missing screenshot" panel for each until they exist.

## Keeping the skills current

The skills in `.claude/skills/` are this repo's copies, used by anyone who opens the
repo in Claude Code. When a skill changes, change it here in a pull request, not only
in claude.ai settings. The copies saved to your claude.ai account are older than the
2026-10-09 versions (they still describe ten sections and Definitions) and are no
longer needed for SOP work.
