"""
hgm_doc.py — HGM branded document renderer.

Renders a JSON content file to a PDF using the same toolchain as the HGM
security cheat sheet and session outline: HTML + hgm-doc.css -> WeasyPrint.

    python3 hgm_doc.py content.json out.pdf

Layout lives in hgm-doc.css. This file only maps content blocks to markup.
Never write per-document CSS; if a document needs a component that does not
exist, add it to hgm-doc.css once so every future document inherits it.

Block types:
  section   {label, num?}          mono uppercase section label + rule
  sub       {text}                 sub-heading
  para      {text}
  lead      {text}                 large intro paragraph
  bullets   {items[]}
  cards     {items[{k?,t,d?}], cols?, style?}   card grid
  numcards  {items[{t,d}], columns?}            numbered cards, 1 or 2 columns
  rows      {items[{gutter?,t,d?,expect?}], numbered?}  agenda / step rows
  panel     {kind?, t?, text}      tinted panel (brand|note|warning|critical|success)
  table     {headers[], rows[[]], boxed?}
  figure    {path, caption}
  band      {pill?, quote, aside_t?, aside_d?}  closing dark band

Inline HTML is allowed in text fields: <strong>, <em>, <code>,
<strong class="hl"> for brand-blue emphasis.
"""

import base64
import html
import json
import os
from figpath import find_figure  # noqa: E402  (same directory)
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
CSS_PATH = os.path.join(HERE, "hgm-doc.css")
LOGO = os.path.join(HERE, "assets", "logo-wordmark-light.svg")


import sys as _sys
_sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from icons import icon as _icon, PRINT_COLOR as _IC  # noqa: E402
from picker import blocks_for_print  # noqa: E402


def ic(name):
    """Icon for a callout or route kind. WeasyPrint resolves currentColor from
    the svg's own colour only, so the colour is passed in rather than inherited."""
    return _icon(name, _IC.get(name))


def esc(s):
    return html.escape(str(s), quote=False)


def logo_tag():
    """Inline the wordmark as a data URI.

    Prefers the embedded base64 constant in brand_assets.py so the renderer
    works with no asset files present at all. Falls back to assets/ only if
    that module is missing."""
    b64 = None
    try:
        from brand_assets import LOGO_LIGHT_B64
        b64 = LOGO_LIGHT_B64
    except ImportError:
        if os.path.exists(LOGO):
            with open(LOGO, "rb") as f:
                b64 = base64.b64encode(f.read()).decode()
    if not b64:
        sys.stderr.write("*** Wordmark unavailable; header will show text only.\n")
        return ""
    return f'<img src="data:image/svg+xml;base64,{b64}" alt="Hidden Gem Media">'


# ------------------------------------------------------------------ blocks

def b_section(b):
    num = f'<span class="num">{esc(b["num"])}</span>' if b.get("num") else ""
    return (f'<div class="section-label">{num}'
            f'<span>{esc(b["label"])}</span><span class="rule"></span></div>')


def b_sub(b):
    """A phase heading, with its intro inside the same box.

    The intro used to be a separate `para` block after the heading. A standalone
    paragraph between the heading and the first task stops the run of tasks from
    fragmenting at all, so a phase that does not fit entirely moves whole and
    strands most of a page — 84% of one, in WEB-001. Keeping the pair in one
    small unbreakable box lets the tasks flow again.
    """
    intro = f'<p class="phd">{b["d"]}</p>' if b.get("d") else ""
    return f'<div class="phasehd"><h3 class="sub">{b["text"]}</h3>{intro}</div>'


def b_para(b):
    return f'<p>{b["text"]}</p>'


def b_lead(b):
    return f'<p class="lead">{b["text"]}</p>'


def b_bullets(b):
    li = "".join(f"<li>{i}</li>" for i in b["items"])
    return f'<ul class="plain">{li}</ul>'


def _card(it, style=""):
    k = f'<div class="k">{esc(it["k"])}</div>' if it.get("k") else ""
    t = (f'<div class="t">{ic(it.get("icon", ""))}{it["t"]}</div>'
         if it.get("t") else "")
    d = f'<div class="d">{it["d"]}</div>' if it.get("d") else ""
    cls = f"card {style}".strip()
    return f'<div class="{cls}">{k}{t}{d}</div>'


def b_cards(b):
    style = b.get("style", "")
    cards = "".join(_card(i, style) for i in b["items"])
    cols = f' cols-{b["cols"]}' if b.get("cols") else ""
    return f'<div class="grid{cols}">{cards}</div>'


def b_numcards(b):
    items = b["items"]
    out = []
    for n, it in enumerate(items, start=b.get("start", 1)):
        t = f'<div class="t">{it["t"]}</div>' if it.get("t") else ""
        d = f'<div class="d">{it["d"]}</div>' if it.get("d") else ""
        out.append(f'<div class="card numbered"><div class="n">{n}</div>'
                   f'<div class="body">{t}{d}</div></div>')
    if b.get("columns") == 2:
        half = (len(out) + 1) // 2
        left = f'<div class="stack">{"".join(out[:half])}</div>'
        right = f'<div class="stack">{"".join(out[half:])}</div>'
        return f'<div class="columns">{left}{right}</div>'
    return f'<div class="stack">{"".join(out)}</div>'


def b_rows(b):
    out = []
    n = b.get("start", 1)
    for it in b["items"]:
        gut = it.get("gutter")
        if gut is None and b.get("numbered", True):
            gut = f"{n}."
            n += 1
        gutter = f'<div class="gutter">{esc(gut) if gut else ""}</div>'
        t = f'<div class="t">{it["t"]}</div>' if it.get("t") else ""
        d = f'<div class="d">{it["d"]}</div>' if it.get("d") else ""
        e = (f'<div class="expect">Expected result: {it["expect"]}</div>'
             if it.get("expect") else "")
        out.append(f'<div class="row">{gutter}<div class="body">{t}{d}{e}</div></div>')
    return f'<div class="rows">{"".join(out)}</div>'


def b_panel(b):
    kind = b.get("kind", "brand")
    t = f'<div class="t">{b["t"]}</div>' if b.get("t") else ""
    return (f'<div class="panel {kind}">{ic(kind)}'
            f'<div class="pbody">{t}<div>{b["text"]}</div></div></div>')


def b_table(b):
    th = "".join(f"<th>{esc(h)}</th>" for h in b["headers"])
    trs = "".join("<tr>" + "".join(f"<td>{c}</td>" for c in r) + "</tr>"
                  for r in b["rows"])
    cls = "boxed" if b.get("boxed") else ""
    return f'<table class="{cls}"><thead><tr>{th}</tr></thead><tbody>{trs}</tbody></table>'


# Figure paths resolve against the content JSON's directory, the same rule
# to_html.py uses. Set by render(); falls back to the working directory.
FIG_BASE = "."


def b_figure(b):
    path = b["path"]
    full = find_figure(path, FIG_BASE)
    if not full:
        return b_panel({"kind": "warning", "t": "Missing screenshot",
                        "text": f'Expected an image at <code>{esc(path)}</code> — '
                                f'{esc(b.get("caption", "no caption"))}'})
    cap = (f'<figcaption>{b["caption"]}</figcaption>'
           if b.get("caption") else "")
    # Absolute file:// so WeasyPrint does not resolve it against base_url,
    # which points at the renderer's own folder for the fonts. A bare relative
    # src passed the existence check and then loaded nothing, silently.
    src = "file://" + os.path.abspath(full)
    return f'<figure><img src="{esc(src)}">{cap}</figure>'


def b_rules(b):
    """A short set of non-negotiables on the dark ground — the counterpart to
    a card grid, for the rules that hold on every run of the procedure."""
    k = f'<p class="k">{esc(b.get("k", "Always true"))}</p>'
    t = f'<h2>{b["t"]}</h2>' if b.get("t") else ""
    d = f'<p class="rlead">{b["d"]}</p>' if b.get("d") else ""
    # Two per row, as explicit table rows. A flex or grid container cannot be
    # fragmented by WeasyPrint, so a slab that does not fit jumps whole to the
    # next page and strands half of this one; a table fragments cleanly.
    items = list(enumerate(b["items"], start=int(b.get("start", 1))))
    rows = ""
    for i in range(0, len(items), 2):
        cells = ""
        for n, it in items[i:i + 2]:
            cells += (f'<div class="rcell"><div class="rcard">'
                      f'<div class="n">{n}</div>'
                      f'<div class="t">{it.get("t","")}</div>'
                      f'<div class="d">{it.get("d","")}</div></div></div>')
        if len(items[i:i + 2]) == 1:
            cells += '<div class="rcell"></div>'
        rows += f'<div class="rrow">{cells}</div>'
    return f'<div class="rules">{k}{t}{d}<div class="rgrid">{rows}</div></div>'


def b_band(b):
    pill = f'<div class="pill">{esc(b["pill"])}</div>' if b.get("pill") else ""
    aside = ""
    if b.get("aside_t") or b.get("aside_d"):
        at = f'<div class="t">{b.get("aside_t","")}</div>'
        ad = f'<div class="d">{b.get("aside_d","")}</div>'
        aside = f'<div class="aside">{at}{ad}</div>'
    return (f'<div class="band"><div>{pill}'
            f'<p class="quote">{b["quote"]}</p></div>{aside}</div>')



def b_code(b):
    """Preformatted terminal command or Claude prompt, with an optional label bar."""
    kind = b.get("kind", "terminal")
    lbl = ""
    if b.get("label") or b.get("note"):
        left = esc(b.get("label", ""))
        right = f'<span class="r">{esc(b["note"])}</span>' if b.get("note") else ""
        lbl = (f'<div class="lbl"><span class="ll">{ic(kind)}'
               f'<span>{left}</span></span>{right}</div>')
    return f'<div class="code {kind}">{lbl}<pre>{esc(b["text"])}</pre></div>'


def b_step(b):
    """One numbered task: badge + instruction + its own screenshots and boxes,
    all inside a single card. Mirrors how Scribe and the owner guides lay a
    walkthrough out — the picture belongs to the step, not to the page."""
    n = f'<span class="n">{esc(b["n"])}</span>' if b.get("n") else ""
    t = f'<span class="t">{b["t"]}</span>' if b.get("t") else ""
    d = f'<div class="d">{b["d"]}</div>' if b.get("d") else ""
    x = ""
    if b.get("expect"):
        x = (f'<div class="expect">{ic("expect")}<div class="xb">'
             f'<div class="lb">Expected result</div>{b["expect"]}</div></div>')
    inner = "".join(BLOCKS[i["type"]](i) for i in b.get("body", [])
                    if i.get("type") in BLOCKS)
    body = f'<div class="sbody">{inner}</div>' if inner else ""

    # A short card stays whole: splitting one strands the instruction on a page
    # away from its result, and a split prompt drags the page footer into the
    # clipboard. A card carrying a screenshot or a long prompt is too tall for
    # that — forcing it whole pushes it to the next page and leaves most of one
    # blank, which is worse. Measured both ways on WEB-001 and WEB-002.
    tall = any(i.get("type") == "figure"
               or (i.get("type") == "code" and i.get("text", "").count("\n") > 12)
               for i in b.get("body", []))
    cls = "step tall" if tall else "step"
    return f'<div class="{cls}"><div class="hd">{n}{t}</div>{d}{body}{x}</div>'


def b_checklist(b):
    """Print checklist with drawn boxes. Items accept inline HTML."""
    lis = "".join(f"<li>{it}</li>" for it in b["items"])
    return f'<ul class="checklist">{lis}</ul>'


BLOCKS = {
    "section": b_section, "sub": b_sub, "para": b_para, "lead": b_lead,
    "bullets": b_bullets, "cards": b_cards, "numcards": b_numcards,
    "rows": b_rows, "panel": b_panel, "table": b_table, "figure": b_figure,
    "band": b_band,
    "rules": b_rules, "code": b_code, "checklist": b_checklist, "step": b_step,
}


# ------------------------------------------------------------------ document

META_ORDER = [
    ("SOP ID", "sop_id", True), ("Version", "version", True),
    ("Owner", "owner", False), ("Approved by", "approved_by", False),
    ("Effective", "effective_date", True), ("Next review", "next_review", True),
    ("Trigger", "frequency", False), ("Duration", "duration", False),
]


def meta_table(meta):
    """Two side-by-side metadata tables so the cover stays compact."""
    rows = [(lbl, meta[k], mono) for lbl, k, mono in META_ORDER if meta.get(k)]
    half = (len(rows) + 1) // 2

    def one(chunk):
        trs = "".join(
            f'<tr><td class="k">{esc(l)}</td>'
            f'<td class="v{" mono" if m else ""}">{esc(v)}</td></tr>'
            for l, v, m in chunk)
        return f'<table class="meta">{trs}</table>'

    return f'<div class="columns">{one(rows[:half])}{one(rows[half:])}</div>'


def build_html(content):
    meta = content.get("meta", {})
    parts = [
        '<!DOCTYPE html><html><head><meta charset="utf-8">',
        f'<title>{esc(meta.get("title",""))}</title></head><body>',
        '<div class="doc-head">',
        f'<div class="lockup">{logo_tag()}</div>',
        f'<div class="eyebrow">{esc(meta.get("eyebrow","standard operating procedure"))}</div>',
        '</div>',
    ]
    if meta.get("title"):
        parts.append(f'<h1 class="doc-title">{esc(meta["title"])}</h1>')
    if meta.get("lead"):
        parts.append(f'<p class="lead">{meta["lead"]}</p>')
    if any(meta.get(k) for _, k, _ in META_ORDER):
        parts.append(meta_table(meta))

    for b in blocks_for_print(content):
        kind = b.get("type")
        if kind not in BLOCKS:
            raise ValueError(
                f"Unknown block type {kind!r}. Add it to hgm-doc.css and "
                f"BLOCKS in hgm_doc.py rather than inlining custom markup.")
        parts.append(BLOCKS[kind](b))

    parts.append("</body></html>")
    return "".join(parts)


def render(content, out_path, fig_base=None):
    global FIG_BASE
    if fig_base:
        FIG_BASE = fig_base
    from weasyprint import HTML, CSS
    from weasyprint.text.fonts import FontConfiguration
    meta = content.get("meta", {})
    sop_id = meta.get("sop_id", "")
    # The running footer carries the version too, so a printed page is never
    # mistaken for an earlier release: "HGM-SOP-WEB-002 · v1.2".
    if meta.get("version"):
        sop_id = f"{sop_id} \u00b7 v{meta['version']}"
    css = open(CSS_PATH).read()
    # footer left slot: WeasyPrint has no string-set here, so inject literally
    css = css.replace("content: string(sop-id);", f'content: "{sop_id}";')
    # Resolve @font-face and asset URLs to absolute file:// paths. A bare
    # directory base_url is not reliably treated as a directory, which silently
    # drops the brand fonts to a system fallback.
    css = css.replace("url('fonts/", f"url('file://{HERE}/fonts/")
    missing = [f for f in os.listdir(os.path.join(HERE, "fonts"))] if os.path.isdir(os.path.join(HERE, "fonts")) else []
    if not missing:
        sys.stderr.write("*** FONT DIRECTORY MISSING — output will not use brand fonts.\n")
    html_str = build_html(content)
    base = HERE + os.sep
    # WeasyPrint silently ignores @font-face unless an explicit
    # FontConfiguration is passed to BOTH the CSS and write_pdf. Omitting it
    # falls back to a system face with no warning.
    fc = FontConfiguration()
    HTML(string=html_str, base_url=base).write_pdf(
        out_path,
        stylesheets=[CSS(string=css, base_url=base, font_config=fc)],
        font_config=fc)
    _verify_fonts(out_path)


def _verify_fonts(path):
    """Fail loudly if the PDF did not embed Inter. A silent fallback to a
    system face is the single most likely way to ship an off-brand document."""
    import subprocess
    try:
        out = subprocess.run(["pdffonts", path], capture_output=True,
                             text=True, timeout=30).stdout
    except Exception:
        sys.stderr.write("*** Could not verify fonts (pdffonts unavailable).\n")
        return
    if "Inter" not in out:
        sys.stderr.write(
            "\n*** FONT FALLBACK: Inter is NOT embedded. This PDF is not brand\n"
            "*** compliant. Check doc/fonts/ and rerun before delivering.\n\n")
    else:
        print("Brand fonts embedded: OK")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit("usage: python3 hgm_doc.py content.json out.pdf")
    with open(sys.argv[1]) as f:
        data = json.load(f)
    render(data, sys.argv[2], fig_base=os.path.dirname(os.path.abspath(sys.argv[1])))
    print(f"Wrote {sys.argv[2]}")
