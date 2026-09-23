#!/usr/bin/env python3
"""Build src/data/sops.json from the masters in reference/sop/masters/.

The index is hand-maintainable — this script just makes it reproducible, and
makes "current version only" a rule the code enforces rather than one someone
has to remember.

    python3 tools/build-sops-index.py

Rules it applies:

  * One entry per SOP ID. masters/ keeps every version; the index carries only
    the highest. An older master sitting in the folder is ignored, never
    emitted, and never overwrites the current one.
  * html/ and pdf/ paths are checked to exist. A missing file is a hard error,
    not a silently broken card on the dashboard.
  * next_review is null while status is draft. A review date only means
    something once a document has been approved and has an effective date.
  * change_summary is the first sentence of the newest revision-history row.
  * Fields are exactly the twelve the dashboard reads. Adding a thirteenth here
    without adding it to the sops table too puts the two out of sync.
"""

import html as _html
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MASTERS = os.path.join(ROOT, "reference", "sop", "masters")
SOPROOT = os.path.join(ROOT, "reference", "sop")
OUT = os.path.join(ROOT, "src", "data", "sops.json")

FIELDS = ["id", "dept", "title", "version", "status", "owner_role", "owner",
          "updated", "next_review", "html", "pdf", "change_summary"]


def plain(s):
    """Master body fields carry inline HTML and entities; the index is data."""
    s = re.sub(r"<[^>]+>", "", str(s or ""))
    return _html.unescape(s).strip()


def vkey(v):
    return tuple(int(x) for x in re.findall(r"\d+", str(v))) or (0,)


def split_owner(s):
    """'Web & Content Specialist (Kyle Zinger)' -> role, person."""
    s = plain(s)
    m = re.match(r"^(.*?)\s*\(([^)]*)\)\s*$", s)
    return (m.group(1).strip(), m.group(2).strip()) if m else (s, None)


def revisions(doc):
    """Newest revision-history row, as (date, version, summary)."""
    best = None
    for b in doc.get("blocks", []):
        if b.get("type") != "table":
            continue
        heads = [str(h).strip().lower() for h in b.get("headers", [])]
        if not ("date" in heads and "version" in heads):
            continue
        di, vi = heads.index("date"), heads.index("version")
        si = next((i for i, h in enumerate(heads) if "summary" in h or "change" in h), None)
        for row in b.get("rows", []):
            cand = (plain(row[di]), plain(row[vi]),
                    plain(row[si]) if si is not None and si < len(row) else "")
            if best is None or vkey(cand[1]) > vkey(best[1]):
                best = cand
    return best


def first_sentence(s):
    """Match the house form: one clause, no trailing detail."""
    s = plain(s)
    s = re.split(r"\s+[—–-]{1,2}\s+", s)[0]
    m = re.match(r"^(.*?[.!?])(\s|$)", s)
    out = (m.group(1) if m else s).strip()
    return out if out.endswith((".", "!", "?")) or not out else out + "."


def entry(path):
    with open(path) as f:
        doc = json.load(f)
    meta = doc.get("meta", {})

    sid = meta.get("sop_id")
    if not sid:
        sys.exit(f"{os.path.basename(path)}: no meta.sop_id")

    dept = meta.get("dept")
    if not dept:
        m = re.match(r"^HGM-SOP-([A-Z]{3})-\d+$", sid)
        if not m:
            sys.exit(f"{sid}: no meta.dept and the ID does not parse")
        dept = m.group(1)

    version = str(meta.get("version", "")).strip()
    status = plain(meta.get("status", "")) or "draft"
    role, person = split_owner(meta.get("owner", ""))
    rev = revisions(doc)

    e = {
        "id": sid,
        "dept": dept,
        "title": plain(meta.get("title", "")),
        "version": version,
        "status": status,
        "owner_role": role,
        "owner": person,
        "updated": (rev[0] if rev else plain(meta.get("effective_date", ""))) or None,
        "next_review": None if status == "draft" else (plain(meta.get("next_review", "")) or None),
        "html": f"html/{sid}.html",
        "pdf": f"pdf/{sid}_v{version.replace('.', '_')}.pdf",
        "change_summary": first_sentence(rev[2]) if rev else "",
    }
    return {k: e[k] for k in FIELDS}


def main():
    if not os.path.isdir(MASTERS):
        sys.exit(f"no masters directory at {MASTERS}")

    newest = {}
    for fn in sorted(os.listdir(MASTERS)):
        if not fn.endswith(".json"):
            continue
        e = entry(os.path.join(MASTERS, fn))
        prev = newest.get(e["id"])
        if prev is None or vkey(e["version"]) > vkey(prev["version"]):
            newest[e["id"]] = e
        else:
            print(f"  skipped {fn} — superseded by v{prev['version']}")

    missing = []
    for e in newest.values():
        for key in ("html", "pdf"):
            if not os.path.exists(os.path.join(SOPROOT, e[key])):
                missing.append(f"{e['id']}: {e[key]} does not exist")
    if missing:
        sys.exit("index not written:\n  " + "\n  ".join(missing))

    rows = sorted(newest.values(), key=lambda e: (e["dept"], e["id"]))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(rows, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"Wrote {os.path.relpath(OUT, ROOT)} — {len(rows)} SOPs")
    for e in rows:
        print(f"  {e['id']}  v{e['version']}  {e['status']}")


if __name__ == "__main__":
    main()
