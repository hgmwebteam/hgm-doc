# reference/

Team reference material. **Nothing in here is read by the app** — not at build time,
not at runtime. Vite only bundles `src/`, and only `public/` is served as static files.
Deleting this folder would not change the deployed site.

It exists so the source material behind the UI stays next to the code that implements it.

| Folder                                 | What's in it                                                                                                                                                                                                                                                                                                                                                 |
| :------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `design/`                              | Design artifacts and mockups. `Master Brand Document.html` is the spec for the eleven-section brand document on the client dashboard. `HGMPortal-SOP-dashboard-wireframe_v0_1.html` is the SOP dashboard's wireframe. `globeloaderartifact.html` is the source of the globe loader (the shipped copy is `public/globe-loader.html`, which `/home2` iframes). |
| `ai-website-setup/`                    | Exports from the design tool used for the AI-website setup SOP — `.dc.html` project files, bundled design systems, screenshots. The largest thing in the repo (~18 MB).                                                                                                                                                                                      |
| `CleanShot 2026-07-29 at 13.45.21.png` | An Asana onboarding-template capture, unrelated to SOPs; moved here from the old `sop/` folder. Keep or delete: AnhTuan's call.                                                                                                                                                                                                                              |

SOP masters, figures and the renderer used to sit in `sop/`. They are sources the site is built from, not reference, so since 2026-10-15 they live in `sops/` at the repo root (see `sops/README.md`).

## If you add something here

Assets the **app** needs go in `public/`, not here. A file in both places is a file that
will drift. Team headshots used to live in both `HGM Team/HGM Images/` and
`public/hgm team/` as twenty byte-identical copies; only the `public/` set was ever
served, so the duplicates were removed. `src/utils/team-photos.ts` reads `public/hgm team/`.

## Weight

This folder dominates the repo's size. If clone times start to hurt, `ai-website-setup/`
is the thing to move to shared storage — removing it from the working tree does not
shrink `.git`, which keeps every version it has ever held, so that would need a history
rewrite to actually pay off.
