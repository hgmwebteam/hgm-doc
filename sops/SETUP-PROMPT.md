> **Run on 2026-10-15** (branch `sop-workflow-setup`). Kept as a record. Two of its
> assumptions were corrected: masters stay in `reference/sop/masters/` with versioned
> names, and figures in `reference/sop/figures/`. `sops/CLAUDE.md` is current.

# One-time setup prompt

Copy the files from the kit into the root of your local `hgm-doc` clone first (see
`sops/README.md`, "Install"). Then open `hgm-doc` in VS Code, open the Claude Code
panel, and paste everything below the line. It does the parts that depend on what
is already in the portal repo, which could not be seen when the kit was made.

---

I've just added an SOP workflow kit to this repo: `sops/`, `.claude/skills/hgm-sop-author`,
`.claude/skills/hgm-doc-render`, `.claude/commands/sop-*.md`, and two workflows in
`.github/workflows/sop-*.yml`. Read `sops/CLAUDE.md` and `sops/README.md` first. Then
set it up against this repo. Work on a branch called `sop-workflow-setup`. Do the
steps in order and stop to ask me whenever a step says so.

1. **Wire in the instructions.** If a root `CLAUDE.md` exists, append a line
   `@sops/CLAUDE.md` under a heading "SOPs". If none exists, create one with just
   that heading and line. Add `sops/dist/` to `.gitignore`.

2. **One renderer.** Compare `reference/sop/renderer/` with
   `.claude/skills/hgm-doc-render/renderer/` (`diff -rq`, then read the differences).
   The house style says the repo copy is the newer one. If the repo copy has every
   file the skill copy has, delete the skill's `renderer/` folder so there is only one
   renderer, and change the skill's repo note to say it lives in
   `reference/sop/renderer/`. If the skill copy has anything the repo copy lacks,
   stop and show me before deleting anything.

3. **Find the existing masters.** Search the whole repo for SOP JSON masters
   (files containing `"sop_id"`), and list every one with its version and path.
   I am also dropping the latest masters from the old Claude Project into
   `sops/masters/`. Rename every master to `HGM-SOP-<DEPT>-###.json` with no version
   in the name. Where two copies of the same SOP exist, keep the higher version and
   show me the conflict before discarding anything.

4. **Figures.** For every `figure.path` in every master, check the file resolves
   from `sops/masters/`. Move or copy figures from wherever they are in the repo so
   they sit beside the masters. List any that are still missing; do not invent or
   generate any.

5. **Work out how the portal loads SOPs today.** Read the portal code that lists and
   opens SOPs (search for the `sops` storage bucket, `build-sops-index`, and the SOP
   dashboard and viewer components). Tell me, with file paths: the exact object path
   each file type is stored at in the bucket, how the dashboard finds the list of
   SOPs (an index file, a table, or a bucket listing), and what "live" depends on
   (`meta.status`). Then fill in `sops/publish.config.json` to match exactly, and set
   `after_publish` if the index has to be regenerated and uploaded after files
   change. Only set `"confirmed": true` if you are certain the paths match what the
   portal reads. Otherwise leave it false and tell me what is uncertain.

6. **Build everything.** Check my machine has what the build needs
   (`python3 -c "import weasyprint"`, `which pdftoppm pdfimages`, `gh auth status`) and
   tell me the exact install commands for anything missing (on macOS:
   `brew install weasyprint poppler gh`). Then run `python3 sops/tools/build.py` and
   show me `sops/dist/REPORT.md`. Run `python3 sops/tools/publish.py --dry-run` and
   show me where each file would go.

7. **Compare with what is live.** For one SOP that is already on hgmportal.com
   (WEB-002), compare the new HTML with the HTML the portal currently serves for it,
   if the repo holds a copy or you can find how it was produced. Report any
   difference. Do not change the renderer to make them match without asking me.

8. **Open a pull request** for `sop-workflow-setup` with a summary of every step,
   every decision, and every question still open. Do not merge it.

9. **Then tell me what I have to do by hand in GitHub**, and do not do any of it
   yourself, because it involves a secret you must not see:
   - Add repository secrets `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
     (I will run `gh secret set` myself, or use the GitHub website).
   - Add a repository variable `SOP_PUBLISH_ENABLED` = `true`, only once step 5 is
     confirmed.
   - Protect `main` so pull requests need a passing "SOP check" before merging.
