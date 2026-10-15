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
             → writes reference/sop/masters/HGM-SOP-WEB-002_v1_5.json, removes
             _v1_4, adds a revision row → build.py renders HTML/MD and runs the gate
             → looks at every page → opens a pull request
        │
        ▼
GitHub "SOP check" (on the pull request): rebuilds with the PDF, posts the gate
             report as a comment, and commits the new version's page, PDF,
             Markdown and the updated SOP list back to the pull request
        │
        ▼
You: read the report, open the PDF or HTML, merge
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
- **Git replaces "store the master".** One file per SOP in `reference/sop/masters/`,
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

Screenshots: drop the image into `reference/sop/figures/` named
`fig_HGM-SOP-<DEPT>-###_<what-it-shows>.png` (`.jpg` for a JPEG: the extension matches
the bytes) and tell Claude which task it belongs to.
Claude checks it for credentials, crops it, and rings the click target. SOPs are
public, so nothing secret may be in a screenshot.

## Install (once)

1. Copy the contents of the kit into the root of your local `hgm-doc` clone, keeping
   the folder structure (`.claude/`, `.github/`, `sops/`). The `.claude` and `.github`
   folders are hidden in Finder; press **Cmd + Shift + .** to show them, or copy in
   the terminal with `cp -R`.
2. Nothing to download: the masters are already in `reference/sop/masters/` and
   their figures in `reference/sop/figures/` (done at setup, 2026-10-15).
3. Open `hgm-doc` in VS Code, open Claude Code, and paste `sops/SETUP-PROMPT.md`.
   (Done 2026-10-15; its secrets and publish switch are no longer needed.)

## Keeping the skills current

The skills in `.claude/skills/` are this repo's copies, used by anyone who opens the
repo in Claude Code. When a skill changes, change it here in a pull request, not only
in claude.ai settings. The copies saved to your claude.ai account are older than the
2026-10-09 versions (they still describe ten sections and Definitions) and are no
longer needed for SOP work.
