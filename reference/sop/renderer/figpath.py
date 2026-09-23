"""Where a figure lives, given the path written in the master.

The master says `fig_HGM-SOP-WEB-002_f1.png` and nothing more, because project
knowledge is flat and a master must not know about any repo layout. The repo keeps
masters and figures in sibling folders (`reference/sop/masters/`, `reference/sop/figures/`),
so a bare filename resolved against the master's directory finds nothing there.

Search order, first hit wins:
  1. the path as written, against the master's directory   (flat project knowledge, ad-hoc builds)
  2. just the filename, against the master's directory     (a master that carries a stale `fig/` prefix)
  3. ../figures/<filename>                                  (the repo layout)
  4. figures/<filename>                                     (master and figures folder side by side)
Shared by to_html.py and hgm_doc.py so the two renderers cannot disagree.
"""
import os


def find_figure(path, base):
    if os.path.isabs(path):
        return path if os.path.exists(path) else None
    name = os.path.basename(path)
    for cand in (
        os.path.join(base, path),
        os.path.join(base, name),
        os.path.join(base, os.pardir, "figures", name),
        os.path.join(base, "figures", name),
    ):
        if os.path.exists(cand):
            return os.path.normpath(cand)
    return None
