#!/usr/bin/env python3
"""Build HGM SOPs from their JSON masters and run the automated quality gate.

    python3 sops/tools/build.py                    # every SOP in sops/masters/
    python3 sops/tools/build.py HGM-SOP-WEB-002    # one SOP (ID, short ID or path)
    python3 sops/tools/build.py --changed          # masters changed vs origin/main (all, if the renderer changed)
    python3 sops/tools/build.py --no-pdf ...       # skip the PDF (no WeasyPrint needed)
    python3 sops/tools/build.py --publish ...      # also publish the outputs into the site (see below)

For each master it:
  1. validates the JSON against schema v2 (sop_schema.py validate)
  2. renders HTML, PDF and Markdown into sops/dist/<SOP-ID>/
  3. runs the checks a machine can run (see GATE below) and writes
     sops/dist/REPORT.md, which the pull-request check posts as a comment.

Masters are named <SOP-ID>_v<major>_<minor>.json (HGM-SOP-WEB-002_v1_4.json),
the convention sops/tools/build-index.py and sops/README.md use. If
more than one version of an SOP is in the folder, only the highest is built.

The renderer is sops/renderer/. This script never changes how a
page looks; it only calls the renderer.

With --publish, each SOP that passes is also copied to where the portal reads
it, under its version: public/sops/html/<SOP-ID>_v#_#.html,
public/sops/pdf/<SOP-ID>_v#_#.pdf and sops/markdown/<SOP-ID>_v#_#.md.
Then sops/tools/build-index.py rewrites src/data/sops.json. Earlier versions'
files are never touched: they are the portal's links to past versions. The
"SOP build" pull-request check runs this and commits the result.

Exit code is non-zero if any SOP fails a hard check. Warnings (open
[NEEDS INPUT] flags, a sparse page) never fail the build.
"""
import glob
import json
import os
import re
import shutil
import subprocess
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
MASTERS = os.path.join(ROOT, "sops", "masters")
FIGURES = os.path.join(ROOT, "sops", "figures")
DIST = os.path.join(ROOT, "sops", "dist")
PUBLISH_TO = {
    "html": os.path.join(ROOT, "public", "sops", "html"),
    "pdf": os.path.join(ROOT, "public", "sops", "pdf"),
    "md": os.path.join(ROOT, "sops", "markdown"),
}
# One renderer only: the portal repo's copy. The skill no longer bundles one.
RENDERER = os.path.join(ROOT, "sops", "renderer")

GEM_YELLOW = re.compile(r"#?ffd602", re.I)
NEEDS_INPUT = re.compile(r"\[NEEDS INPUT", re.I)
SCREENSHOT_TODO = re.compile(r"\[SCREENSHOT \d", re.I)
IMAGE_TODO = re.compile(r"image to be added|screenshot to be added", re.I)


def run(args):
    p = subprocess.run([sys.executable] + args, capture_output=True, text=True, cwd=ROOT)
    return p.returncode, (p.stdout + p.stderr).strip()


def file_stem(meta):
    """HGM-SOP-WEB-002_take-a-website-change_v1_4 (underscores in the version)."""
    words = (meta.get("short") or meta.get("slug") or meta.get("title", "sop")).lower()
    words = re.sub(r"[^a-z0-9]+", "-", words).strip("-").split("-")
    short = "-".join(words[:5])
    version = str(meta.get("version", "0.0")).replace(".", "_")
    return f"{meta['sop_id']}_{short}_v{version}"


def page_emptiness(pdf_path):
    """Fraction of each page below the last inked row. Needs pdftoppm + Pillow."""
    try:
        from PIL import Image
    except ImportError:
        return None
    tmp = pdf_path + ".pages"
    os.makedirs(tmp, exist_ok=True)
    r = subprocess.run(["pdftoppm", "-png", "-r", "30", pdf_path, os.path.join(tmp, "p")],
                       capture_output=True)
    if r.returncode != 0:
        return None
    result = []
    for png in sorted(glob.glob(os.path.join(tmp, "p-*.png"))):
        im = Image.open(png).convert("L")
        w, h = im.size
        px = im.load()
        last = 0
        # ignore the bottom 8% (page footer) when looking for the last inked row
        for y in range(int(h * 0.92)):
            if any(px[x, y] < 235 for x in range(0, w, 2)):
                last = y
        result.append(round(1 - last / (h * 0.92), 2))
        os.remove(png)
    os.rmdir(tmp)
    return result


def count_figures(blocks):
    n = 0
    for b in blocks:
        n += b.get("type") == "figure"
        n += count_figures(b.get("body") or [])
    return n


def count_image_todos(blocks):
    """Panels that stand in for a screenshot not taken yet."""
    n = 0
    for b in blocks:
        n += b.get("type") == "panel" and bool(IMAGE_TODO.search(f"{b.get('t', '')} {b.get('text', '')}"))
        n += count_image_todos(b.get("body") or [])
    return n


def pdf_image_count(pdf_path):
    r = subprocess.run(["pdfimages", "-list", pdf_path], capture_output=True, text=True)
    if r.returncode != 0:
        return None
    return max(0, len(r.stdout.strip().splitlines()) - 2)


def gate(data, raw, pdf_log, emptiness, md_text=None, pdf_images=None):
    """Return (fails, warns) — the machine-checkable part of the quality gate."""
    meta, blocks = data.get("meta", {}), data.get("blocks", [])
    fails, warns = [], []
    # "live" says the SOP is finished, so an open gap is a failure; a draft
    # is published while it waits on images or answers, so it is a warning.
    finished = str(meta.get("status", "")).lower() in ("live", "approved")

    flags = len(NEEDS_INPUT.findall(raw))
    shots = len(SCREENSHOT_TODO.findall(raw)) + count_image_todos(blocks)
    if flags:
        (fails if finished else warns).append(f"{flags} [NEEDS INPUT] flag(s) open")
    if shots:
        (fails if finished else warns).append(f"{shots} image placeholder(s) open")

    for k in ("sop_id", "title", "version", "owner", "approved_by",
              "effective_date", "next_review", "frequency", "duration"):
        if not str(meta.get(k, "")).strip():
            fails.append(f"meta.{k} is empty")
    for k in ("approved_by", "duration", "frequency"):
        if len(str(meta.get(k, ""))) > 40:
            warns.append(f"meta.{k} is over 40 characters and may overflow its grid cell")

    if not blocks or blocks[-1].get("type") != "band":
        fails.append("document does not end in a band block")
    band = next((b for b in reversed(blocks) if b.get("type") == "band"), None)
    if band and len(str(band.get("pill", "")).split()) > 1:
        fails.append("band.pill must be a single word")

    if GEM_YELLOW.search(raw):
        fails.append("gem yellow #FFD602 appears in document content")

    # revision history: last row's version must equal meta.version
    rev = None
    for i, b in enumerate(blocks):
        if b.get("type") == "section" and "revision" in str(b.get("label", "")).lower():
            rev = next((x for x in blocks[i + 1:] if x.get("type") == "table"), None)
    if not rev:
        fails.append("no revision history table")
    else:
        last = (rev.get("rows") or [[None, None]])[-1]
        if len(last) > 1 and str(last[1]).strip() != str(meta.get("version")):
            fails.append(f"last revision row is v{last[1]} but meta.version is {meta.get('version')}")

    if not meta.get("tasks"):
        warns.append("meta.tasks is empty, so no task picker will render")

    figs = count_figures(blocks)
    if pdf_images is not None and pdf_images < figs:
        warns.append(f"PDF holds {pdf_images} image(s) for {figs} figure block(s); "
                     "a figure file is missing or did not embed")
    has_steps = '"type": "step"' in raw or '"type":"step"' in raw
    if md_text is not None and has_steps and "\n#### " not in md_text:
        fails.append("Markdown copy has no #### task lines; the renderer is stale")

    if pdf_log is not None and "Brand fonts embedded: OK" not in pdf_log:
        fails.append("PDF build did not print 'Brand fonts embedded: OK'")
    if emptiness:
        sparse = [i + 1 for i, e in enumerate(emptiness[:-1]) if e > 0.4]
        if sparse:
            warns.append(f"page(s) {sparse} are more than ~40% empty; look at them")
    return fails, warns


def vkey(v):
    """'1.4' -> (1, 4), so 1.10 sorts above 1.9. Same rule as build-index.py."""
    return tuple(int(x) for x in re.findall(r"\d+", str(v))) or (0,)


def master_version(path):
    """(sop_id, version) from the master itself, not its filename."""
    with open(path, encoding="utf-8") as f:
        meta = json.load(f).get("meta", {})
    return meta.get("sop_id", ""), vkey(meta.get("version", ""))


def newest(paths):
    """One master per SOP ID: the highest meta.version."""
    best = {}
    for p in paths:
        sop_id, v = master_version(p)
        if sop_id not in best or v > best[sop_id][0]:
            best[sop_id] = (v, p)
    return sorted(p for _, p in best.values())


def changed_files(path):
    """Files under path that differ from origin/main, committed or not."""
    rel = os.path.relpath(path, ROOT)
    try:
        out = subprocess.run(["git", "diff", "--name-only", "origin/main...HEAD", "--", rel],
                             capture_output=True, text=True, cwd=ROOT).stdout
        out += subprocess.run(["git", "diff", "--name-only", "--", rel],
                              capture_output=True, text=True, cwd=ROOT).stdout
    except FileNotFoundError:
        return []
    return sorted({os.path.join(ROOT, p) for p in out.split()})


def changed_masters():
    """Masters changed vs origin/main; every master if the renderer or a figure
    changed, because then every current page has to be rebuilt."""
    if changed_files(RENDERER) or changed_files(FIGURES):
        return glob.glob(os.path.join(MASTERS, "*.json"))
    return [p for p in changed_files(MASTERS) if p.endswith(".json")]


def publish(sop_id, version, stem):
    """Copy one build into the site under its version; never touch other versions."""
    name = f"{sop_id}_v{str(version).replace('.', '_')}"
    for ext, folder in PUBLISH_TO.items():
        src = f"{stem}.{ext}"
        if not os.path.exists(src):
            print(f"  publish: no .{ext} built; public/sops keeps whatever {name}.{ext} it has")
            continue
        os.makedirs(folder, exist_ok=True)
        dst = os.path.join(folder, f"{name}.{ext}")
        shutil.copyfile(src, dst)
        print(f"  published {os.path.relpath(dst, ROOT)}")


def resolve(arg):
    """A path, or an ID (HGM-SOP-WEB-002 / WEB-002) -> its highest-version master."""
    if os.path.isfile(arg):
        return os.path.abspath(arg)
    sop_id = (arg if arg.upper().startswith("HGM-SOP-") else f"HGM-SOP-{arg}").upper()
    hits = glob.glob(os.path.join(MASTERS, f"{sop_id}_v*.json")) + \
        glob.glob(os.path.join(MASTERS, f"{sop_id}.json"))
    if not hits:
        sys.exit(f"No master for {arg!r} in {os.path.relpath(MASTERS, ROOT)}/")
    return newest(hits)[0]


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    no_pdf = "--no-pdf" in sys.argv
    do_publish = "--publish" in sys.argv
    if "--changed" in sys.argv:
        targets = newest(p for p in changed_masters() if os.path.exists(p))
    elif args:
        targets = [resolve(a) for a in args]
    else:
        targets = newest(glob.glob(os.path.join(MASTERS, "*.json")))
    if not os.path.isfile(os.path.join(RENDERER, "to_html.py")):
        sys.exit(f"No renderer in {os.path.relpath(RENDERER, ROOT)}/")
    print(f"Renderer: {os.path.relpath(RENDERER, ROOT)}")
    if not targets:
        print("No masters to build.")
        open_report([])
        return 0

    rows, any_fail = [], False
    for path in targets:
        raw = open(path, encoding="utf-8").read()
        data = json.loads(raw)
        meta = data["meta"]
        sop_id = meta["sop_id"]
        out_dir = os.path.join(DIST, sop_id)
        os.makedirs(out_dir, exist_ok=True)
        stem = os.path.join(out_dir, file_stem(meta))
        print(f"\n== {sop_id} v{meta.get('version')} ({meta.get('status', 'no status')})")

        code, log = run([os.path.join(RENDERER, "sop_schema.py"), "validate", path])
        print(log)
        fails = [] if code == 0 else ["sop_schema.py validate failed: " + log.splitlines()[-1]]

        for script, ext in (("to_html.py", "html"), ("to_markdown.py", "md")):
            c, l = run([os.path.join(RENDERER, script), path, f"{stem}.{ext}"])
            print(l)
            if c:
                fails.append(f"{script} failed")
        pdf_log, emptiness, pdf_images = None, None, None
        if not no_pdf:
            c, pdf_log = run([os.path.join(RENDERER, "hgm_doc.py"), path, f"{stem}.pdf"])
            print(pdf_log)
            if c:
                fails.append("hgm_doc.py (PDF) failed")
            else:
                emptiness = page_emptiness(f"{stem}.pdf")
                pdf_images = pdf_image_count(f"{stem}.pdf")
        # keep a copy of the exact master that produced these outputs
        with open(f"{stem}.json", "w", encoding="utf-8") as f:
            f.write(raw)

        md_text = open(f"{stem}.md", encoding="utf-8").read() if os.path.exists(f"{stem}.md") else None
        g_fail, g_warn = gate(data, raw, pdf_log, emptiness, md_text, pdf_images)
        fails += g_fail
        any_fail |= bool(fails)
        for m in fails:
            print("  FAIL", m)
        for m in g_warn:
            print("  warn", m)
        rows.append((sop_id, meta.get("version"), meta.get("status", ""), fails, g_warn))
        if do_publish and not fails:
            publish(sop_id, meta.get("version"), stem)

    if do_publish and rows:
        code, log = run([os.path.join(ROOT, "sops", "tools", "build-index.py")])
        print(log)
        if code:
            any_fail = True
            rows.append(("src/data/sops.json", "", "", ["index not written: " + log.splitlines()[-1]], []))

    open_report(rows)
    print("\nReport: sops/dist/REPORT.md")
    return 1 if any_fail else 0


def open_report(rows):
    os.makedirs(DIST, exist_ok=True)
    lines = ["## SOP build report", "", "| SOP | Version | Status | Result |", "|---|---|---|---|"]
    for sop_id, v, s, fails, warns in rows:
        result = "❌ " + "; ".join(fails) if fails else "✅ passes automated checks"
        if warns:
            result += "<br>⚠️ " + "; ".join(warns)
        lines.append(f"| {sop_id} | {v} | {s} | {result} |")
    if not rows:
        lines.append("| — | — | — | No SOP masters changed |")
    lines += ["", "Automated: gate items 1, 3, 7, 8, 10 and 12, plus sparse-page and figure-count warnings for item 9. "
              "Items 2, 4, 5, 6 and 11 still need a person to read the rendered page."]
    with open(os.path.join(DIST, "REPORT.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


if __name__ == "__main__":
    sys.exit(main())
