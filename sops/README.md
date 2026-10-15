# HGM SOPs — how this works

SOPs are written and revised in VS Code with Claude Code, inside the `hgm-doc` repo,
and published to hgmportal.com by GitHub Actions. The Claude Project ("HGM SOP Studio")
is retired: everything it knew lives in this repo.

## The flow

```
You, in VS Code:  /sop-update WEB-002 make task 6.1's approver table add Brandon for design
        │
        ▼
Claude Code: reads sops/CLAUDE.md + the skills + the master → makes a branch
             → writes reference/sop/masters/HGM-SOP-WEB-002_v1_5.json, removes
             _v1_4, adds a revision row → build.py renders HTML/PDF/MD and runs the gate
             → looks at every page → opens a pull request
        │
        ▼
GitHub "SOP check" (on the pull request): rebuilds, posts the gate report as a
             comment, attaches the HTML/PDF/MD under the run's Artifacts
        │
        ▼
You: read the report, open the PDF or HTML, merge
        │
        ▼
GitHub "SOP publish" (on main): rebuilds every SOP and uploads to the Supabase
             `sops` bucket. SWITCHED OFF for now: the portal's SOP list is
             src/data/sops.json and WEB-003/004/005 load from public/sops/, so
             an upload alone shows nothing new (see sops/CLAUDE.md)
```

Your part is two things: typing the request, and merging. Nothing goes live until
you merge, and nothing is published by Claude Code directly.

## Why it is built this way

- **The JSON master is the only source.** HTML, PDF and Markdown are rebuilt from it
  every time, by a script, so they can never drift from each other or from the master.
- **Git replaces "store the master".** One file per SOP in `reference/sop/masters/`,
  named with its version in underscores (`HGM-SOP-WEB-002_v1_4.json`, never `_v1.4`).
  A revision adds the new version's file and deletes the old one in the same commit, so
  every past version is in the history and never in the folder.
- **The merge is the approval step for publishing.** It is a deliberate human click,
  and branch protection can require the gate to pass first. Gillian's approval of an
  SOP's *content* is still separate: that is `meta.status: approved`, set only with
  `/sop-approve` after she says yes.
- **The service role key never touches your laptop or Claude.** It lives in GitHub
  Actions secrets and is only used by the publish job.

## Commands

| Command | What it does |
|---|---|
| `/sop-update <ID> <change>` | Revise an SOP, open a pull request |
| `/sop-new <DEPT> <title>` + material | Interview, draft for review, then build v0.1 |
| `/sop-approve <ID>` | Gillian said yes: mark approved, 0.x → 1.0, set dates |
| `python3 sops/tools/build.py [ID]` | Build and gate by hand; outputs in `sops/dist/` |

Screenshots: drop the image into `reference/sop/figures/` named
`fig_HGM-SOP-<DEPT>-###_<what-it-shows>.png` (`.jpg` for a JPEG: the extension matches
the bytes) and tell Claude which task it belongs to.
Claude checks it for credentials, crops it, and rings the click target.

## Install (once)

1. Copy the contents of the kit into the root of your local `hgm-doc` clone, keeping
   the folder structure (`.claude/`, `.github/`, `sops/`). The `.claude` and `.github`
   folders are hidden in Finder; press **Cmd + Shift + .** to show them, or copy in
   the terminal with `cp -R`.
2. Nothing to download: the masters are already in `reference/sop/masters/` and
   their figures in `reference/sop/figures/` (done at setup, 2026-10-15).
3. Open `hgm-doc` in VS Code, open Claude Code, and paste `sops/SETUP-PROMPT.md`.
4. Do the GitHub settings it lists at the end (secrets, the publish switch, branch
   protection). Check with AnhTuan before adding the Supabase service role key to
   GitHub, since it is the portal's key.

## Keeping the skills current

The skills in `.claude/skills/` are this repo's copies, used by anyone who opens the
repo in Claude Code. When a skill changes, change it here in a pull request, not only
in claude.ai settings. The copies saved to your claude.ai account are older than the
2026-10-09 versions (they still describe ten sections and Definitions) and are no
longer needed for SOP work.
