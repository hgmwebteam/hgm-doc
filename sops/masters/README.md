One JSON master per SOP, current version only, named `HGM-SOP-<DEPT>-###_v#_#.json`
(underscores, never `_v1.4`). A revision writes the new version's file and deletes
the old one (`git rm`) in the same commit; git keeps the history. Figures are in
`../figures/` as `fig_HGM-SOP-<DEPT>-###_<name>.png` or `.jpg`, extension matching the
bytes. `sops/tools/build-index.py` and `sops/tools/build.py` read every `.json` here
and use the highest `meta.version` per SOP.
