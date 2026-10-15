#!/usr/bin/env python3
"""
HGM SOP content schema v2 — validate and stamp.

v2 is PURELY ADDITIVE over the renderer's existing content format. Every field
it introduces is ignored by hgm_doc.py, so a v2 file renders to a byte-identical
PDF. The additions exist for the portal: routing, filing, run state, and the
task picker.

  python3 sop_schema.py validate content.json
  python3 sop_schema.py stamp    content.json [out.json]

`stamp` assigns step ids ONCE and never renumbers. An id already present is
never touched, so editing the wording of step 4 — or inserting a new step above
it — leaves every existing id, and therefore everyone's saved run progress,
intact. Deleting a step retires its id permanently; it is never reissued.
"""

import json
import re
import sys

SCHEMA_VERSION = 2
DEPTS = ("WEB", "CON", "OPS", "FIN", "SEC", "CLI")
STATUSES = ("draft", "in_review", "live", "archived")
SOURCE_KINDS = ("manual", "scribe", "transcript", "imported")

BLOCK_TYPES = ("section", "sub", "lead", "para", "bullets", "cards",
               "numcards", "rows", "panel", "table", "figure", "band",
               "code", "checklist", "step", "rules")

# Grounds a section may declare. Omitted means "alternate" — the renderer
# assigns off-white / a shade darker so consecutive sections separate.
SECTION_TONES = ("a", "b", "dark")

# The callout vocabulary. Five meanings, one icon and one colour each, the same
# in every SOP. A sixth kind is a decision to make in the design system, not a
# choice to make inside a document.
PANEL_KINDS = ("brand", "note", "warning", "critical", "success")

# Icons a card may carry. The three route icons exist so the cards that explain
# the routes and the code blocks that use them read as the same thing.
CARD_ICONS = PANEL_KINDS + ("click", "terminal", "prompt", "message", "vscode", "desktop")

# Label bars. `kind` picks the icon and the tint.
CODE_KINDS = ("terminal", "prompt", "click", "message")

SOP_ID_RE = re.compile(r"^HGM-SOP-(%s)-(\d{3})$" % "|".join(DEPTS))
SLUG_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
PROC_RE = re.compile(r"^\d+(\.\d+)*$")

# Fields the renderer already consumes. Anything else in meta is portal-only.
RENDERER_META = ("eyebrow", "title", "lead", "sop_id", "version", "owner",
                 "approved_by", "effective_date", "next_review", "frequency",
                 "duration")

PORTAL_META = ("schema_version", "slug", "dept", "number", "status",
               "updated_at", "updated_by", "source", "tasks")


# ----------------------------------------------------------------- validate

def validate(doc):
    """Return a list of human-readable problems. Empty list means valid."""
    errs = []
    meta = doc.get("meta")
    blocks = doc.get("blocks")

    if not isinstance(meta, dict):
        return ["meta: missing or not an object"]
    if not isinstance(blocks, list):
        return ["blocks: missing or not a list"]

    # --- identity
    sop_id = meta.get("sop_id", "")
    m = SOP_ID_RE.match(sop_id or "")
    if not m:
        errs.append(
            f"meta.sop_id: {sop_id!r} does not match HGM-SOP-[{'|'.join(DEPTS)}]-###")
    else:
        if meta.get("dept") and meta["dept"] != m.group(1):
            errs.append(
                f"meta.dept: {meta['dept']!r} disagrees with sop_id ({m.group(1)})")
        if meta.get("number") and int(meta["number"]) != int(m.group(2)):
            errs.append(
                f"meta.number: {meta['number']!r} disagrees with sop_id ({m.group(2)})")

    if meta.get("slug") and not SLUG_RE.match(meta["slug"]):
        errs.append(f"meta.slug: {meta['slug']!r} must be lowercase-hyphenated")

    if meta.get("status") and meta["status"] not in STATUSES:
        errs.append(
            f"meta.status: {meta['status']!r} not one of {', '.join(STATUSES)}")

    for f in ("effective_date", "next_review"):
        if meta.get(f) and not DATE_RE.match(meta[f]):
            errs.append(f"meta.{f}: {meta[f]!r} must be YYYY-MM-DD")

    for f in RENDERER_META:
        if f in ("eyebrow", "lead", "frequency", "duration"):
            continue
        if not meta.get(f):
            errs.append(f"meta.{f}: required, and empty")

    src = meta.get("source")
    if src is not None:
        if not isinstance(src, dict):
            errs.append("meta.source: must be an object")
        elif src.get("kind") not in SOURCE_KINDS:
            errs.append(
                f"meta.source.kind: must be one of {', '.join(SOURCE_KINDS)}")
        elif src["kind"] == "scribe" and not src.get("url"):
            errs.append("meta.source.url: required when kind is 'scribe'")

    # --- blocks
    proc_ids, step_ids = set(), set()
    for i, b in enumerate(blocks):
        if not isinstance(b, dict):
            errs.append(f"blocks[{i}]: not an object")
            continue
        t = b.get("type")
        if t not in BLOCK_TYPES:
            errs.append(f"blocks[{i}].type: {t!r} is not a known block type")
            continue

        if t == "section" and b.get("tone") not in (None,) + SECTION_TONES:
            errs.append(f"blocks[{i}].tone: {b['tone']!r} is not one of "
                        f"{', '.join(SECTION_TONES)}")

        if t == "panel" and b.get("kind", "brand") not in PANEL_KINDS:
            errs.append(f"blocks[{i}].kind: {b.get('kind')!r} is not one of "
                        f"{', '.join(PANEL_KINDS)}")

        if t == "code" and b.get("kind", "terminal") not in CODE_KINDS:
            errs.append(f"blocks[{i}].kind: {b.get('kind')!r} is not one of "
                        f"{', '.join(CODE_KINDS)}")

        if t in ("cards", "numcards"):
            for j, it in enumerate(b.get("items", [])):
                if isinstance(it, dict) and it.get("icon") not in (None,) + CARD_ICONS:
                    errs.append(f"blocks[{i}].items[{j}].icon: {it['icon']!r} is not "
                                f"one of {', '.join(CARD_ICONS)}")

        if t == "rules":
            if not b.get("items"):
                errs.append(f"blocks[{i}]: rules needs items")
            for j, it in enumerate(b.get("items", [])):
                if not it.get("t"):
                    errs.append(f"blocks[{i}].items[{j}]: rule needs a t")

        if t == "sub" and b.get("id"):
            if not PROC_RE.match(str(b["id"])):
                errs.append(
                    f"blocks[{i}].id: {b['id']!r} must be a dotted number like 6.1")
            elif b["id"] in proc_ids:
                errs.append(f"blocks[{i}].id: duplicate procedure id {b['id']!r}")
            else:
                proc_ids.add(b["id"])

        if t == "step":
            sid = b.get("id")
            if sid:
                if sid in step_ids:
                    errs.append(f"blocks[{i}].id: duplicate step id {sid!r}")
                step_ids.add(sid)
            if not b.get("n"):
                errs.append(f"blocks[{i}]: step needs an n like '1.2'")
            for j, ib in enumerate(b.get("body", [])):
                if ib.get("type") not in BLOCK_TYPES:
                    errs.append(f"blocks[{i}].body[{j}].type: "
                                f"{ib.get('type')!r} is not a known block type")

        if t == "rows":
            for j, it in enumerate(b.get("items", [])):
                sid = it.get("id")
                if not sid:
                    continue
                if sid in step_ids:
                    errs.append(
                        f"blocks[{i}].items[{j}].id: duplicate step id {sid!r}")
                step_ids.add(sid)

        if t == "figure":
            if not b.get("path"):
                errs.append(f"blocks[{i}]: figure needs a path")
            if not b.get("caption"):
                errs.append(f"blocks[{i}]: figure needs a caption")

    # --- task picker
    for k, task in enumerate(meta.get("tasks", []) or []):
        if not task.get("label"):
            errs.append(f"meta.tasks[{k}].label: required")
        tgt = task.get("proc")
        if not tgt:
            errs.append(f"meta.tasks[{k}].proc: required")
        elif proc_ids and tgt not in proc_ids:
            errs.append(
                f"meta.tasks[{k}].proc: {tgt!r} matches no sub block id")

    if not blocks or blocks[-1].get("type") != "band":
        errs.append("blocks: the last block must be a band")

    return errs


# -------------------------------------------------------------------- stamp

def stamp(doc):
    """Assign missing ids in place. Idempotent. Returns (n_procs, n_steps)."""
    meta = doc.setdefault("meta", {})
    meta["schema_version"] = SCHEMA_VERSION

    m = SOP_ID_RE.match(meta.get("sop_id", "") or "")
    prefix = f"{m.group(1)}-{m.group(2)}" if m else "SOP"
    meta.setdefault("dept", m.group(1) if m else None)
    meta.setdefault("number", int(m.group(2)) if m else None)
    meta.setdefault("status", "draft")

    if not meta.get("slug") and meta.get("title"):
        slug = re.sub(r"[^a-z0-9]+", "-", meta["title"].lower()).strip("-")
        meta["slug"] = slug

    new_procs = new_steps = 0
    current = None                      # procedure id the rows belong to
    auto_proc = 0                       # fallback counter for unlabelled subs
    used = {b["id"] for b in doc.get("blocks", [])
            if b.get("type") == "sub" and b.get("id")}

    # A document whose rows blocks declare `start` is numbered continuously
    # across the whole procedure section (steps 1..14), so the procedure
    # segment would be noise. A document without `start` restarts its numbering
    # inside each sub, so the segment is what makes the id unique.
    rows_blocks = [b for b in doc.get("blocks", []) if b.get("type") == "rows"]
    flat = any("start" in b for b in rows_blocks)

    # counters live per procedure and CONTINUE across rows blocks — steps are
    # routinely split by figures and code blocks between them.
    counters = {}
    all_ids = {it["id"] for b in rows_blocks for it in b.get("items", []) if it.get("id")}

    for b in doc.get("blocks", []):
        if b.get("type") == "sub":
            if not b.get("id"):
                auto_proc += 1
                cand = str(auto_proc)
                while cand in used:
                    auto_proc += 1
                    cand = str(auto_proc)
                b["id"] = cand
                used.add(cand)
                new_procs += 1
            current = b["id"]

        elif b.get("type") == "rows":
            key = current or "_"
            if "start" in b:
                counters[key] = int(b["start"]) - 1
            n = counters.get(key, 0)
            for it in b.get("items", []):
                n += 1
                if it.get("id"):
                    continue
                base = f"{prefix}." if flat else f"{prefix}.{current}." if current else f"{prefix}."
                cand = f"{base}{n}"
                while cand in all_ids:
                    n += 1
                    cand = f"{base}{n}"
                it["id"] = cand
                all_ids.add(cand)
                new_steps += 1
            counters[key] = n

    return new_procs, new_steps


# ---------------------------------------------------------------------- cli

def main():
    if len(sys.argv) < 3 or sys.argv[1] not in ("validate", "stamp"):
        sys.exit(__doc__.strip())

    cmd, path = sys.argv[1], sys.argv[2]
    with open(path) as f:
        doc = json.load(f)

    if cmd == "validate":
        errs = validate(doc)
        if errs:
            print(f"{len(errs)} problem(s) in {path}:")
            for e in errs:
                print(f"  - {e}")
            sys.exit(1)
        print(f"{path}: valid against schema v{SCHEMA_VERSION}")
        return

    procs, steps = stamp(doc)
    errs = validate(doc)
    out = sys.argv[3] if len(sys.argv) > 3 else path
    with open(out, "w") as f:
        json.dump(doc, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"Stamped {procs} procedure id(s) and {steps} step id(s) -> {out}")
    if errs:
        print(f"{len(errs)} validation problem(s) remain:")
        for e in errs:
            print(f"  - {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
