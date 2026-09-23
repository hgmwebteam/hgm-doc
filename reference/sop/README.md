# SOP library — record copy

The repo is the record for every SOP. Nothing here is bundled or served; the
portal reads `src/data/sops.json` for the index and the private `sops` storage
bucket for the pages and PDFs.

```
reference/sop/
  masters/    HGM-SOP-WEB-002_v1_4.json          every version, never deleted — the source of truth
  figures/    fig_HGM-SOP-WEB-002_f1-….jpg       screenshots, annotated and credential-swept; extension matches the bytes
  html/       HGM-SOP-WEB-002.html               current version only, self-contained; the copy in the bucket
  pdf/        HGM-SOP-WEB-002_v1_4.pdf           current version's print copy; the copy in the bucket
  markdown/   HGM-SOP-WEB-002_v1_4.md            review copy, what a diff is taken against
  renderer/   to_html.py hgm_doc.py to_markdown.py sop_schema.py …   the same renderer the Claude skill carries
```

## Rebuilding any output from its master (works from this folder)

```bash
pip install weasyprint fonttools brotli --break-system-packages
cd reference/sop
python3 renderer/sop_schema.py validate masters/HGM-SOP-WEB-002_v1_4.json
python3 renderer/to_html.py     masters/HGM-SOP-WEB-002_v1_4.json html/HGM-SOP-WEB-002.html
python3 renderer/hgm_doc.py     masters/HGM-SOP-WEB-002_v1_4.json pdf/HGM-SOP-WEB-002_v1_4.pdf
python3 renderer/to_markdown.py masters/HGM-SOP-WEB-002_v1_4.json markdown/HGM-SOP-WEB-002_v1_4.md
```

Figure paths in a master are bare filenames. The renderer looks beside the master
first, then in `../figures/`, so the same master renders from flat project knowledge
and from this layout without editing. The HTML build must print `Brand fonts
embedded: OK`; anything else is a failed build. `renderer/` here and the
`hgm-doc-render` Claude skill are the same code — when one changes, update the other.

## Adding or updating an SOP (until Create SOP ships in phase 2)

1. Author or revise the SOP in the SOP Claude Project. The quality gate runs there and
   four files come back plus figures.
2. Copy the master into `masters/` (new version number in the name), the HTML over
   `html/<id>.html`, the PDF into `pdf/`, the Markdown into `markdown/`, figures into
   `figures/`.
3. Upload the HTML and PDF to the `sops` bucket at the same relative paths
   (`html/<id>.html`, `pdf/<id>_v#_#.pdf`). Supabase Studio → Storage → sops.
4. Edit the SOP's entry in `src/data/sops.json`: `version`, `status`, `updated`, `pdf`,
   `change_summary`. New SOP → new entry.
5. Branch, commit, PR, merge. Netlify deploys `main`.
6. Post in the Web Team chat: ID, title, version, one-line change summary, link.

`status` is one of `draft`, `live`, `pending_approval`, `archived`. Only `live` counts
toward coverage on the dashboard. A master whose `meta.status` is anything other than
`approved` renders with a visible draft marker — that is the renderer's rule, not the
portal's.

## Checks before anything lands here

- `sop_schema.py validate` passes on the master.
- Every figure looked at for a credential value, an unblurred client password, or a
  personal address. Public business contact details are fine.
- Figure extension matches the bytes (`file figures/*`). The renderer labels the
  data: URI from the bytes regardless, but a mislabelled file is still wrong.
- The HTML has no external `<link>` or `<script src>` — the renderer embeds fonts and
  figures; a page that reaches out to the network will not load in the viewer.

## Known gaps in this drop
- WEB-001 references four screenshots not yet captured: `fig_HGM-SOP-WEB-001_f1-note`,
  `f2-newfile`, `f3-edit`, `f4-link` (.png or .jpg — match the bytes). The page shows a
  visible "Missing screenshot" panel for each until they exist.
- The pre-existing `CleanShot 2026-07-29 at 13.45.21.png` in this folder is an Asana
  onboarding-template capture unrelated to SOPs. Left in place; AnhTuan's call.
