# SOP library — sources

The repo is the record for every SOP. Nothing in this folder is bundled or served.
What the portal reads is built from it: `src/data/sops.json` (the list) and, one
pair per version, `public/sops/html/<id>_v#_#.html` and `public/sops/pdf/<id>_v#_#.pdf`.
Every SOP is public, and there is no approval step (since 2026-10-15).

```
reference/sop/
  masters/    HGM-SOP-WEB-002_v1_4.json          current version only — the source of truth (see masters/README.md)
  figures/    fig_HGM-SOP-WEB-002_f1-….jpg       screenshots, annotated and credential-swept; extension matches the bytes
  markdown/   HGM-SOP-WEB-002_v1_4.md            review copy of each version, what a diff is taken against
  renderer/   to_html.py hgm_doc.py to_markdown.py sop_schema.py …   the only renderer in this repo
```

The `html/` and `pdf/` folders that used to sit here (copies of what was uploaded to
the private `sops` bucket) were folded into `public/sops/` on 2026-10-15. The bucket
is no longer read.

## Building and publishing

```bash
python3 sops/tools/build.py HGM-SOP-WEB-002              # build + gate into sops/dist/
python3 sops/tools/build.py HGM-SOP-WEB-002 --no-pdf     # without WeasyPrint
python3 sops/tools/build.py HGM-SOP-WEB-002 --publish    # also into public/sops/, markdown/ and sops.json
```

The "SOP check" pull-request workflow runs `--changed --publish` on GitHub, PDF
included, and commits the result to the pull request, so publishing is merging.
How SOPs are written and revised is in `sops/CLAUDE.md`.

Figure paths in a master are bare filenames. The renderer looks beside the master
first, then in `../figures/`, so the same master renders from flat project knowledge
and from this layout without editing. The HTML build must print `Brand fonts
embedded: OK`; anything else is a failed build. `renderer/` here is the only copy in
this repo: the repo's `hgm-doc-render` skill bundles none. The claude.ai copy of that
skill still bundles its own, so when this one changes, update that one from here.

Earlier versions' pages in `public/sops/html/` are kept exactly as they were
published, so they carry the renderer of their day (a draft marker, for one). Never
delete or rebuild them.

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
- The pre-existing `CleanShot 2026-07-29 at 13.45.21.png` in this folder is an Asana
  onboarding-template capture unrelated to SOPs. Left in place; AnhTuan's call.
