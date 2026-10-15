#!/usr/bin/env python3
"""Build src/data/sops.json from the masters in reference/sop/masters/.

The index is hand-maintainable — this script just makes it reproducible, and
makes "current version only" a rule the code enforces rather than one someone
has to remember.

    python3 tools/build-sops-index.py

Rules it applies:

  * One entry per SOP ID, for the highest version in masters/. An older master
    sitting in the folder is ignored, never emitted, and never overwrites the
    current one.
  * Every version is published and stays published: public/sops/html/ and
    public/sops/pdf/ hold one page and one PDF per version, named
    <id>_v#_#.html / <id>_v#_#.pdf. The current version's two files are checked
    to exist; a missing one is a hard error, not a broken card on the dashboard.
  * versions lists every row of the master's revision history, newest first,
    with the page and PDF of each version that has them (versions from before
    the repo have neither, and are listed without links).
  * No approval step (since 2026-10-15): a published SOP is "live" unless its
    meta.status is "archived".
  * change_summary is the first sentence of the newest revision-history row,
    unless the index already carries a summary for this exact version, which
    is kept: those are often written by hand.
  * Fields are exactly the thirteen the dashboard reads. Adding another here
    without adding it to SopIndexEntry too puts the two out of sync.
"""

import html as _html
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MASTERS = os.path.join(ROOT, "reference", "sop", "masters")
PUBLISHED = os.path.join(ROOT, "public", "sops")
OUT = os.path.join(ROOT, "src", "data", "sops.json")

FIELDS = ["id", "dept", "title", "version", "status", "owner_role", "owner",
          "updated", "next_review", "html", "pdf", "change_summary", "versions"]


def plain(s):
    """Master body fields carry inline HTML and entities; the index is data."""
    s = re.sub(r"<[^>]+>", "", str(s or ""))
    return _html.unescape(s).strip()


def vkey(v):
    return tuple(int(x) for x in re.findall(r"\d+", str(v))) or (0,)


def files_for(sid, version):
    """The published page and PDF for one version: (html, pdf), None where absent."""
    u = str(version).lstrip("vV").replace(".", "_")
    page, pdf = f"html/{sid}_v{u}.html", f"pdf/{sid}_v{u}.pdf"
    exists = lambda rel: os.path.exists(os.path.join(PUBLISHED, rel))
    return (page if exists(page) else None), (pdf if exists(pdf) else None)


def split_owner(s):
    """'Web & Content Specialist (Kyle Zinger)' -> role, person."""
    s = plain(s)
    m = re.match(r"^(.*?)\s*\(([^)]*)\)\s*$", s)
    return (m.group(1).strip(), m.group(2).strip()) if m else (s, None)


def revisions(doc):
    """Every revision-history row as (date, version, summary), newest first."""
    rows = {}
    for b in doc.get("blocks", []):
        if b.get("type") != "table":
            continue
        heads = [str(h).strip().lower() for h in b.get("headers", [])]
        if not ("date" in heads and "version" in heads):
            continue
        di, vi = heads.index("date"), heads.index("version")
        si = next((i for i, h in enumerate(heads) if "summary" in h or "change" in h), None)
        for row in b.get("rows", []):
            cand = (plain(row[di]), plain(row[vi]).lstrip("vV"),
                    plain(row[si]) if si is not None and si < len(row) else "")
            rows.setdefault(cand[1], cand)
    return sorted(rows.values(), key=lambda r: vkey(r[1]), reverse=True)


def first_sentence(s):
    """Match the house form: one clause, no trailing detail."""
    s = plain(s)
    s = re.split(r"\s+[—–-]{1,2}\s+", s)[0]
    m = re.match(r"^(.*?[.!?])(\s|$)", s)
    out = (m.group(1) if m else s).strip()
    return out if out.endswith((".", "!", "?")) or not out else out + "."


def entry(path, kept):
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
    status = "archived" if plain(meta.get("status", "")).lower() == "archived" else "live"
    role, person = split_owner(meta.get("owner", ""))
    revs = revisions(doc)
    newest = revs[0] if revs else None
    page, pdf = files_for(sid, version)
    u = version.replace(".", "_")

    versions = []
    for date, v, summary in revs:
        vh, vp = files_for(sid, v)
        versions.append({"version": v, "date": date or None, "summary": first_sentence(summary),
                         "html": vh, "pdf": vp})

    prev = kept.get(sid)
    summary = (prev["change_summary"] if prev and prev.get("version") == version and prev.get("change_summary")
               else first_sentence(newest[2]) if newest else "")
    if versions and versions[0]["version"] == version:
        versions[0]["summary"] = summary

    e = {
        "id": sid,
        "dept": dept,
        "title": plain(meta.get("title", "")),
        "version": version,
        "status": status,
        "owner_role": role,
        "owner": person,
        "updated": (newest[0] if newest else plain(meta.get("effective_date", ""))) or None,
        "next_review": plain(meta.get("next_review", "")) or None,
        "html": page or f"html/{sid}_v{u}.html",
        "pdf": pdf or f"pdf/{sid}_v{u}.pdf",
        "change_summary": summary,
        "versions": versions,
    }
    return {k: e[k] for k in FIELDS}


def main():
    if not os.path.isdir(MASTERS):
        sys.exit(f"no masters directory at {MASTERS}")

    kept = {}
    if os.path.exists(OUT):
        with open(OUT) as f:
            kept = {e["id"]: e for e in json.load(f)}

    newest = {}
    for fn in sorted(os.listdir(MASTERS)):
        if not fn.endswith(".json"):
            continue
        e = entry(os.path.join(MASTERS, fn), kept)
        prev = newest.get(e["id"])
        if prev is None or vkey(e["version"]) > vkey(prev["version"]):
            newest[e["id"]] = e
        else:
            print(f"  skipped {fn} — superseded by v{prev['version']}")

    missing = []
    for e in newest.values():
        for key in ("html", "pdf"):
            if not os.path.exists(os.path.join(PUBLISHED, e[key])):
                missing.append(f"{e['id']}: public/sops/{e[key]} does not exist")
    if missing:
        sys.exit("index not written:\n  " + "\n  ".join(missing))

    rows = sorted(newest.values(), key=lambda e: (e["dept"], e["id"]))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        # 4-space indent: what Prettier writes, so the file needs no reformat.
        json.dump(rows, f, indent=4, ensure_ascii=False)
        f.write("\n")
    print(f"Wrote {os.path.relpath(OUT, ROOT)} — {len(rows)} SOPs")
    for e in rows:
        linked = sum(1 for v in e["versions"] if v["html"] or v["pdf"])
        print(f"  {e['id']}  v{e['version']}  {e['status']}  ({linked} of {len(e['versions'])} versions linked)")


if __name__ == "__main__":
    main()
