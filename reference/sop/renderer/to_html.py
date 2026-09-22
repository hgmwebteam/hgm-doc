#!/usr/bin/env python3
"""
Render an HGM content JSON to a self-contained portal page.

  python3 to_html.py content.json out.html

The third rendering of the same source. The PDF is the print/distribution copy
and keeps the print design language; this is the screen copy, and it carries the
interaction patterns print cannot have:

  - a task picker at the top ("what are you trying to do?")
  - sticky step navigation with a scroll progress bar
  - a copy button on every command and prompt block
  - follow-along checkboxes, saved per person in the browser

Colour, type and geometry stay HGM's: Inter + Roboto Mono, brand-700 #004FAA,
brand-950 band, 8px radii, mono uppercase labels with hairline rules.

Images are inlined as data URIs so the output is one file.
"""

import base64
import html
import json
import mimetypes
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from icons import icon  # noqa: E402  (same directory)
from figpath import find_figure  # noqa: E402
from picker import procedure_index, picker_span, manual_picker_present, PICKER_H, PICKER_D  # noqa: E402

# The three ways a reader can do a machine task. A code block whose kind is
# one of these is a *route*; the route bar lets the reader show only theirs.
# `message` is not a route (it is wording to post to a person), so it always shows.
# The reader picks WHERE they work; a platform is the set of instruction
# kinds that place can run. Block kinds (`prompt`, `terminal`, `click`) are
# the data model and never change; only the selector groups them. Author the
# route cards in Prerequisites in this order, with the `icon` of each platform.
PLATFORMS = [
    ("vscode",   "VS Code",           "vscode",   {"prompt", "terminal", "click"}),
    ("terminal", "Terminal",          "terminal", {"terminal"}),
    ("desktop",  "Claude Desktop app", "desktop",  {"prompt"}),
]
ROUTE_KINDS = {"click", "terminal", "prompt"}

# ─────────────────────────────────────────────────────────────── helpers

def esc(s):
    return html.escape(str(s or ""), quote=True)


def inline_image(path, base):
    full = find_figure(path, base)
    if not full:
        return None
    with open(full, "rb") as f:
        data = f.read()
    # Trust the bytes, not the extension: a JPEG saved as .png is still a JPEG,
    # and a wrong mime in a data: URI is a bug even when the browser forgives it.
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        mime = "image/png"
    elif data[:2] == b"\xff\xd8":
        mime = "image/jpeg"
    elif data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        mime = "image/webp"
    else:
        mime = mimetypes.guess_type(full)[0] or "image/png"
    return f"data:{mime};base64,{base64.b64encode(data).decode()}"


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", re.sub(r"<[^>]+>", "", str(s)).lower()).strip("-")[:60]


# ─────────────────────────────────────────────────────────────── styles


# ---------------------------------------------------------------------------
# Brand fonts, embedded.  The portal serves this page from a private storage
# bucket inside an iframe, so it must not reach out to Google Fonts: a page that
# depends on the network is not self-contained, and the font swap would also
# reflow the picker after first paint.  Each face is subset to the Latin ranges
# the documents use, written as woff2 and inlined as a data: URI - roughly
# 20-30 KB per face instead of 400 KB.  Falls back to the Google link only if
# fonttools/brotli are missing, and says so on stderr.
FONTS = [
    ("Inter", 400, "normal", "Inter-Regular.ttf"),
    ("Inter", 400, "italic", "Inter-Italic.ttf"),
    ("Inter", 500, "normal", "Inter-Medium.ttf"),
    ("Inter", 600, "normal", "Inter-SemiBold.ttf"),
    ("Inter", 700, "normal", "Inter-Bold.ttf"),
    ("Roboto Mono", 400, "normal", "RobotoMono-Regular.ttf"),
    ("Roboto Mono", 500, "normal", "RobotoMono-Medium.ttf"),
]
LATIN = "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"
_FONT_CACHE = {}

def font_head():
    """Return the <head> markup for the brand fonts: embedded if possible."""
    try:
        from fontTools import subset  # noqa: F401
        from fontTools.ttLib import TTFont
        import brotli  # noqa: F401
    except ImportError:
        print("Brand fonts embedded: NO (fonttools/brotli missing; linking Google Fonts)", file=sys.stderr)
        return ('<link rel="preconnect" href="https://fonts.googleapis.com">\n'
                '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
                '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Roboto+Mono:wght@400;500&display=swap">')
    import io
    from fontTools import subset
    from fontTools.ttLib import TTFont
    fdir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fonts")
    faces = []
    for family, weight, style, fname in FONTS:
        path = os.path.join(fdir, fname)
        if fname not in _FONT_CACHE:
            font = TTFont(path)
            opts = subset.Options()
            opts.flavor = "woff2"
            opts.layout_features = ["*"]
            opts.name_IDs = ["*"]
            opts.notdef_outline = True
            sub = subset.Subsetter(opts)
            sub.populate(unicodes=subset.parse_unicodes(LATIN))
            sub.subset(font)
            font.flavor = "woff2"
            buf = io.BytesIO()
            font.save(buf)
            _FONT_CACHE[fname] = base64.b64encode(buf.getvalue()).decode("ascii")
        b64 = _FONT_CACHE[fname]
        faces.append(
            f"@font-face{{font-family:'{family}';font-style:{style};font-weight:{weight};"
            f"font-display:swap;src:url(data:font/woff2;base64,{b64}) format('woff2')}}")
    print("Brand fonts embedded: OK")
    return "<style>" + "".join(faces) + "</style>"


def draft_strip(meta):
    """A visible draft marker on every copy that has not been approved.
    House rule: no SOP appears in the portal without one until the Operations
    Manager approves.  Anything other than status "approved" is a draft."""
    st = (meta.get("status") or "draft").strip().lower()
    if st == "approved":
        return ""
    label = "Draft" if st == "draft" else esc(st.replace("_", " ").capitalize())
    return (f'<p class="draft"><b>{label}</b> · v{esc(str(meta.get("version","")))}'
            f'<span class="dsub">Not yet approved. Follow with care and tell the owner what is wrong.</span></p>')

CSS = """
:root{
  /* Section grounds. The step between them is deliberately small — one is a
     hair off white, the next a hair darker. Enough that the eye registers a
     new section; not enough to look like a coloured band. Cards stay pure
     white, which is what puts them at the top of the hierarchy. */
  --ground-a:#FAFBFD; --ground-b:#F5F7FA;
  --card:#FFFFFF; --card-edge:#E3E7ED;
  --surface:#F2F4F8;
  --hairline:#E3E7ED; --hairline-soft:#EDF0F4;
  --ink:#14171C; --ink-2:#3A424D; --ink-muted:#5C646E; --ink-faint:#98A0AA;
  --accent:#004FAA; --accent-soft:rgba(0,79,170,.10);

  /* the deep ground: the closing band, the jump card, a dark section */
  --deep:#001534; --deep-card:#0A2149; --deep-accent:#8FBEF8;
  --on-deep:#fff; --on-deep-muted:rgba(255,255,255,.64); --on-deep-edge:rgba(255,255,255,.12);

  /* Standing rules sit one step above a white card and one step below the
     dark jump card: a brand-tinted slab carrying white cards. Deep navy put
     them at the top of the page hierarchy, which is louder than a set of
     background rules needs to be. */
  --rules-bg:#E7F0FF; --rules-edge:#CBDDF8;

  /* callouts — one family, five meanings. Same lightness, different hue, so
     they read as siblings rather than five unrelated boxes. */
  --key-bg:#F3EFFC;  --key-edge:#DED3F5;  --key-ink:#5B3FBF;
  --xp-bg:#EDF3FF;   --xp-edge:#D3E2FA;   --xp-ink:#004FAA;
  --note-bg:#EEF1F5; --note-edge:#DCE1E9; --note-ink:#3A424D;
  --warn-bg:#FEF8E9; --warn-edge:#F2DFAB; --warn-ink:#A16207;
  --bad-bg:#FDF0EF;  --bad-edge:#F7CEC9;  --bad-ink:#DC2626;
  --ok-bg:#EDF8F1;   --ok-edge:#C2E6CF;   --ok-ink:#15803D;

  --shadow:0 1px 2px rgba(20,23,28,.05);
  --shadow-lift:0 2px 4px rgba(20,23,28,.05),0 18px 34px -22px rgba(20,23,28,.30);
  /* The HGM Portal's own scale, measured off it: 8px on controls, 12px on
     cards and larger surfaces. One scale, two steps — not two conventions. */
  --r-ctl:8px; --r:12px; --r-band:16px;
  /* The measure is a function of the menu, not a constant it has to fit
     around. `--side` and `--edge` are 0 until a menu exists, so the measure is
     the plain 1040px cap; where one does exist it is whatever is left after
     the menu and a margin have been paid for. The menu therefore takes its
     width from the page margin first and only borrows from the measure once
     the margin has run out — neither can squash the other, at any width.
     Above about 1430px the subtraction never bites and the page is identical
     to one with no menu at all. */
  --side:0px; --sgap:28px; --edge:0px;
  --measure:min(1040px, calc(100vw - 2*(var(--side) + var(--edge))));
  --pad:28px;
  --top-h:60px;
}
/* Light is the default for every viewer, regardless of OS setting.
   Dark applies only when the toggle stamps data-theme="dark", and it is a
   neutral grey — the brand blue stays for accents, never for the ground. */
:root[data-theme="dark"]{
  --ground-a:#1B1F24; --ground-b:#22272E;
  --card:#282E36; --card-edge:rgba(255,255,255,.09);
  --surface:#20252B;
  --hairline:rgba(255,255,255,.11); --hairline-soft:rgba(255,255,255,.06);
  --ink:#EDEFF2; --ink-2:#C8CDD4; --ink-muted:#A2A9B2; --ink-faint:#767E88;
  --accent:#7FB3F5; --accent-soft:rgba(127,179,245,.15);

  --deep:#121518; --deep-card:#1D2228; --deep-accent:#8FBEF8;
  --rules-bg:#1E262F; --rules-edge:rgba(127,179,245,.20);

  --key-bg:#2C2740;  --key-edge:rgba(178,155,247,.24); --key-ink:#B79BF7;
  --xp-bg:#20303F;   --xp-edge:rgba(127,179,245,.22);  --xp-ink:#8FBEF8;
  --note-bg:#2A3038; --note-edge:rgba(255,255,255,.10); --note-ink:#C8CDD4;
  --warn-bg:#332C1C;  --warn-edge:rgba(232,196,110,.24); --warn-ink:#E8C46E;
  --bad-bg:#382422;   --bad-edge:rgba(240,154,128,.24);  --bad-ink:#F09A80;
  --ok-bg:#1D3229;    --ok-edge:rgba(111,211,166,.24);   --ok-ink:#6FD3A6;

  --shadow:none; --shadow-lift:0 18px 34px -22px rgba(0,0,0,.65);
}
*{box-sizing:border-box}
body{background:var(--ground-a);color:var(--ink);margin:0;
  font-family:'Inter',system-ui,-apple-system,'Segoe UI',sans-serif;
  font-size:16.5px;line-height:1.7;-webkit-font-smoothing:antialiased;text-wrap:pretty}
.mono{font-family:'Roboto Mono',ui-monospace,monospace}
.wrap{max-width:var(--measure);margin:0 auto;padding:0 var(--pad)}
svg.ic{width:1.15em;height:1.15em;flex:0 0 auto;display:block}

/* ── sections ─────────────────────────────────────────────────────────────
   Every band of the page is a <section class="sct tone-a|tone-b|dark">.
   A dark section redefines the tokens, so every component inside it — cards,
   panels, tables, checkboxes — inverts without needing its own dark rules. */
.sct{padding:68px 0 72px;scroll-margin-top:calc(var(--top-h) + 28px);background:var(--ground-a)}
.sct.tone-b{background:var(--ground-b)}
.sct.dark{
  --ink:#FFFFFF; --ink-2:rgba(255,255,255,.86); --ink-muted:rgba(255,255,255,.66);
  --ink-faint:rgba(255,255,255,.46);
  --card:var(--deep-card); --card-edge:rgba(255,255,255,.11);
  --surface:rgba(255,255,255,.05);
  --hairline:rgba(255,255,255,.13); --hairline-soft:rgba(255,255,255,.08);
  --accent:var(--deep-accent); --accent-soft:rgba(143,190,248,.18);
  --key-bg:rgba(183,155,247,.14); --key-edge:rgba(183,155,247,.30); --key-ink:#B79BF7;
  --xp-bg:rgba(143,190,248,.12);  --xp-edge:rgba(143,190,248,.26);  --xp-ink:#8FBEF8;
  --note-bg:rgba(255,255,255,.06); --note-edge:rgba(255,255,255,.12); --note-ink:rgba(255,255,255,.8);
  --warn-bg:rgba(232,196,110,.13); --warn-edge:rgba(232,196,110,.28); --warn-ink:#E8C46E;
  --bad-bg:rgba(240,154,128,.13); --bad-edge:rgba(240,154,128,.28); --bad-ink:#F09A80;
  --ok-bg:rgba(111,211,166,.13); --ok-edge:rgba(111,211,166,.28); --ok-ink:#6FD3A6;
  --rules-bg:rgba(143,190,248,.09); --rules-edge:rgba(143,190,248,.22);
  --shadow:none;
  background:var(--deep);color:var(--ink)}
.sct.mast{padding:52px 0 60px}
.sct:first-of-type{padding-top:44px}

/* ── sticky chrome ────────────────────────────────────────────────────────
   The bar is the light surface and the chips are tinted, so an active chip
   can be the brightest thing in the bar. The chip row sits under the id row
   on every width, clipped to the same left and right edges as the body. */
.top{position:sticky;top:0;z-index:50;background:color-mix(in srgb,var(--card) 90%,transparent);
  backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-bottom:1px solid var(--hairline)}
/* Three cells: id left, current section centred, count + toggle right. */
.topin{max-width:var(--measure);margin:0 auto;padding:0 var(--pad);height:60px;display:grid;
  grid-template-columns:1fr auto 1fr;align-items:center;gap:18px}
.topl{display:flex;align-items:center;gap:14px;min-width:0;justify-self:start}
.topr{display:flex;align-items:center;gap:14px;min-width:0;justify-self:end}
.topid{font-family:'Roboto Mono',ui-monospace,monospace;font-size:11px;letter-spacing:.14em;
  text-transform:uppercase;color:var(--accent);white-space:nowrap}
.topid .topv{color:var(--ink-faint);letter-spacing:.1em}
.topnow{font-size:14px;color:var(--ink-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  text-align:center;min-width:0;max-width:40vw}
@media (max-width:620px){.topin{grid-template-columns:auto 1fr auto}.topnow{display:none}}
button.toprst{font:inherit;font-size:12.5px;padding:5px 11px;border-radius:999px;border:1px solid var(--hairline);
  background:var(--ground-b);color:var(--ink-muted);cursor:pointer;white-space:nowrap;flex:0 0 auto;
  transition:border-color .14s,color .14s}
button.toprst:hover{border-color:var(--accent);color:var(--accent)}
button.toprst:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.tgl{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;
  border:1px solid var(--hairline);border-radius:999px;background:var(--ground-b);color:var(--ink-muted);
  cursor:pointer;padding:0;flex:0 0 auto;transition:border-color .15s ease,color .15s ease}
.tgl:hover{border-color:var(--accent);color:var(--accent)}
.tgl:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.tgl svg{width:16px;height:16px;display:block}
.tgl .moon{display:none}
:root[data-theme="dark"] .tgl .moon{display:block}
:root[data-theme="dark"] .tgl .sun{display:none}
/* The chip row scrolls inside a clip that is exactly the content width, so a
   chip never shows in the page margin. Shown only below the wide breakpoint;
   the side menu replaces it above. */
.navclip{max-width:var(--measure);margin:0 auto;padding:0 var(--pad);min-width:0}
.secnav{display:flex;gap:6px;overflow-x:auto;padding:0 0 10px;margin:0;scrollbar-width:none}
.secnav::-webkit-scrollbar{display:none}
a.chip{flex:0 0 auto;display:inline-flex;align-items:center;gap:7px;padding:7px 13px;
  border:1px solid var(--hairline);border-radius:999px;background:var(--ground-b);
  font-size:13.5px;color:var(--ink-muted);text-decoration:none;white-space:nowrap;
  transition:border-color .15s ease,color .15s ease,background-color .15s ease}
a.chip:hover{border-color:var(--accent);color:var(--accent);background:var(--card)}
a.chip:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
a.chip.on{background:var(--accent);border-color:var(--accent);color:#fff;font-weight:600}
a.chip.on .cn{color:rgba(255,255,255,.72)}
a.chip .cn{font-family:'Roboto Mono',ui-monospace,monospace;font-size:10.5px;color:var(--ink-faint)}
.secnav{padding-top:2px}
.prog{height:2px;background:transparent}
.prog i{display:block;height:2px;width:0;background:var(--accent);transition:width .12s linear}

/* masthead */
.eyebrow{font-family:'Roboto Mono',ui-monospace,monospace;font-size:11px;font-weight:500;
  letter-spacing:.18em;text-transform:uppercase;color:var(--accent);margin:0}
/* draft marker: shown when meta.status is not "approved"; warning tint, never gem yellow */
.draft{display:inline-flex;align-items:center;gap:8px;margin:14px 0 0;padding:6px 12px;max-width:none;white-space:nowrap;
  border:1px solid var(--warn-edge);background:var(--warn-bg);color:var(--warn-ink);
  border-radius:999px;font-family:'Roboto Mono',ui-monospace,monospace;font-size:11px;
  font-weight:500;letter-spacing:.12em;text-transform:uppercase}
.draft b{font-weight:700}
.draft .dsub{font-family:Inter,system-ui,sans-serif;font-size:12px;letter-spacing:0;text-transform:none;font-weight:400;margin-left:4px}
@media(max-width:640px){.draft{white-space:normal;flex-wrap:wrap}}
@media print{.draft{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
h1{font-size:clamp(33px,4.7vw,54px);line-height:1.07;letter-spacing:-.022em;font-weight:700;
  margin:26px 0 0;max-width:19ch;text-wrap:balance}
.lead{font-size:20px;line-height:1.62;color:var(--ink-muted);margin:26px 0 0;max-width:60ch}
.lead .hl,.hl{color:var(--accent);font-weight:600}
.spec{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));margin:42px 0 0;
  border:1px solid var(--card-edge);border-radius:var(--r);overflow:hidden;background:var(--card);
  box-shadow:var(--shadow)}
.spec>div{padding:16px 18px;border-right:1px solid var(--hairline);
  border-bottom:1px solid var(--hairline)}
.spec>div:nth-child(4n){border-right:0}
.spec>div:nth-last-child(-n+4){border-bottom:0}
@media (max-width:760px){.spec{grid-template-columns:repeat(2,minmax(0,1fr))}
  .spec>div:nth-child(4n){border-right:1px solid var(--hairline)}
  .spec>div:nth-child(2n){border-right:0}
  .spec>div:nth-last-child(-n+4){border-bottom:1px solid var(--hairline)}
  .spec>div:nth-last-child(-n+2){border-bottom:0}}
.spec dt{font-family:'Roboto Mono',ui-monospace,monospace;font-size:10px;letter-spacing:.14em;
  text-transform:uppercase;color:var(--ink-faint);margin:0;line-height:1.4}
.spec dd{margin:8px 0 0;font-size:15px;font-weight:500;line-height:1.45}

/* task picker */
.picker h2{margin:0;font-size:clamp(28px,3.4vw,40px);line-height:1.12;letter-spacing:-.015em;
  font-weight:600;margin:14px 0 0;max-width:22ch;text-wrap:balance}
.picker .plead{color:var(--ink-muted);font-size:17.5px;margin:14px 0 0;max-width:56ch}
.pgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(258px,1fr));gap:16px;margin:34px 0 0}
a.pcard{display:flex;flex-direction:column;gap:13px;padding:26px 26px 22px;
  border:1px solid var(--card-edge);border-radius:var(--r);background:var(--card);
  text-decoration:none;color:inherit;box-shadow:var(--shadow);
  transition:border-color .18s ease,transform .22s cubic-bezier(.23,1,.32,1),box-shadow .22s ease}
a.pcard:hover{border-color:var(--accent);transform:translateY(-3px);box-shadow:var(--shadow-lift)}
a.pcard:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
a.pcard .n{align-self:flex-start;font-family:'Roboto Mono',ui-monospace,monospace;font-size:10px;
  letter-spacing:.1em;text-transform:uppercase;color:var(--accent);background:var(--accent-soft);
  padding:5px 10px;border-radius:999px}
a.pcard .t{font-weight:600;font-size:19px;line-height:1.35;letter-spacing:-.006em}
a.pcard .d{color:var(--ink-muted);font-size:15px;line-height:1.6;flex:1}
a.pcard .cta{font-size:14px;font-weight:500;color:var(--ink-faint);line-height:1;
  transition:color .18s ease}
a.pcard:hover .cta{color:var(--accent)}
a.pcard .cta i{font-style:normal;display:inline-block;transition:transform .22s cubic-bezier(.23,1,.32,1)}
a.pcard:hover .cta i{transform:translateX(3px)}

/* section label + heading */
.slab{display:flex;align-items:center;gap:14px;margin:0}
.slab .num{font-family:'Roboto Mono',ui-monospace,monospace;font-size:11px;color:var(--ink-faint)}
.slab .lbl{font-family:'Roboto Mono',ui-monospace,monospace;font-size:11px;font-weight:500;
  letter-spacing:.18em;text-transform:uppercase;color:var(--accent);white-space:nowrap}
.slab .rule{flex:1;height:1px;background:var(--hairline)}
h2.sec{font-size:clamp(28px,3.4vw,40px);line-height:1.12;letter-spacing:-.015em;font-weight:600;
  margin:14px 0 0;max-width:22ch;text-wrap:balance}
h3.sub{font-size:clamp(22px,2.5vw,30px);line-height:1.22;letter-spacing:-.012em;font-weight:600;
  margin:56px 0 0;scroll-margin-top:calc(var(--top-h) + 28px);max-width:26ch;text-wrap:balance}
h3.sub:first-child{margin-top:0}
.phasehd{margin:56px 0 0}
.phasehd:first-child{margin-top:0}
.phasehd h3.sub{margin:0}
.phasehd .phd{margin:14px 0 0;font-size:17.5px;color:var(--ink-muted);max-width:56ch}
p{margin:20px 0 0;max-width:68ch;color:var(--ink-2)}

/* cards */
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(252px,1fr));gap:16px;margin:30px 0 0}
.grid.c3{grid-template-columns:repeat(auto-fit,minmax(238px,1fr))}
.card{border:1px solid var(--card-edge);border-radius:var(--r);padding:26px 26px 24px;
  background:var(--card);box-shadow:var(--shadow)}
.card .k{font-family:'Roboto Mono',ui-monospace,monospace;font-size:10px;letter-spacing:.14em;
  text-transform:uppercase;color:var(--accent);margin-bottom:12px;line-height:1.4}
/* The title is a block, not a flex row — the brand rule below it is an
   ::after, and a flex ::after becomes a sibling column instead of a rule. */
.card .t{font-weight:600;font-size:17px;line-height:1.4;letter-spacing:-.004em}
.card .t .ic{display:inline-block;vertical-align:-.18em;margin-right:9px;color:var(--accent)}
.card .t::after{content:"";display:block;width:22px;height:2px;border-radius:2px;
  background:var(--accent);margin:14px 0 14px}
.card .t:last-child::after{display:none}
.card .d{color:var(--ink-muted);font-size:15px;line-height:1.7}
.card p{margin:12px 0 0}

/* standing rules — a brand-tinted slab of numbered non-negotiables.
   Deliberately the middle weight on the page: louder than the white cards it
   sits among, quieter than the dark jump card and the closing band, which are
   the only two places the deep navy ground is used. */
.rules{background:var(--rules-bg);border:1px solid var(--rules-edge);border-radius:var(--r-band);
  padding:38px 34px 40px;margin:36px 0 0;color:var(--ink)}
.rules .rk{font-family:'Roboto Mono',ui-monospace,monospace;font-size:10.5px;font-weight:500;
  letter-spacing:.18em;text-transform:uppercase;color:var(--accent);margin:0}
.rules h2{font-size:clamp(25px,2.9vw,33px);line-height:1.14;letter-spacing:-.015em;font-weight:600;
  margin:12px 0 0;color:var(--ink);max-width:22ch}
.rules .rlead{font-size:17px;line-height:1.7;color:var(--ink-muted);margin:12px 0 0;max-width:52ch}
.rgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(340px,100%),1fr));
  gap:14px;margin:28px 0 0}
.rcard{background:var(--card);border:1px solid var(--card-edge);border-radius:var(--r);
  padding:24px 24px 26px;box-shadow:var(--shadow)}
.rcard .rn{font-family:'Roboto Mono',ui-monospace,monospace;font-size:12px;font-weight:500;
  color:var(--accent);background:var(--accent-soft);border-radius:999px;padding:5px 11px;
  display:inline-block;line-height:1.3}
.rcard .rt{margin-top:14px;font-size:17.5px;line-height:1.4;font-weight:600;color:var(--ink)}
.rcard .rd{margin-top:9px;font-size:15px;line-height:1.7;color:var(--ink-muted)}
.rules a{color:var(--accent)}

/* task card: checkbox + number badge + instruction + its own screenshot */
.tstep{border:1px solid var(--card-edge);border-radius:var(--r);padding:24px 26px 26px;
  background:var(--card);margin:16px 0 0;scroll-margin-top:calc(var(--top-h) + 28px);box-shadow:var(--shadow);
  transition:border-color .16s ease,background-color .16s ease}
.tstep.done{background:var(--surface);border-color:var(--hairline-soft);box-shadow:none}
.tstep.done .th{color:var(--ink-faint);text-decoration:line-through;text-decoration-thickness:1px}
.tstep .hd{display:grid;grid-template-columns:22px auto 1fr auto;gap:13px;align-items:center}
/* A finished task folds to its title line. The chevron re-opens it (.peek)
   for anyone who wants to look back; unticking it unfolds it again. */
.tstep.done>.td,.tstep.done>.tb,.tstep.done>.xp{display:none}
.tstep.done.peek>.td,.tstep.done.peek>.tb,.tstep.done.peek>.xp{display:block}
.tstep.done.peek>.xp{display:grid}
button.tp{display:none;width:28px;height:28px;border:1px solid var(--hairline);border-radius:999px;
  background:var(--card);cursor:pointer;padding:0;position:relative;transition:border-color .14s}
button.tp::after{content:"";position:absolute;left:10px;top:8px;width:6px;height:6px;
  border-right:1.5px solid var(--ink-muted);border-bottom:1.5px solid var(--ink-muted);
  transform:rotate(45deg);transition:transform .16s}
button.tp:hover{border-color:var(--accent)}
button.tp:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.tstep.done button.tp{display:block}
.tstep.done.peek button.tp::after{transform:rotate(-135deg);top:11px}
.tstep input[type=checkbox]{appearance:none;-webkit-appearance:none;width:21px;height:21px;
  border:1.5px solid var(--hairline);border-radius:var(--r-ctl);background:var(--card);cursor:pointer;
  display:grid;place-content:center;transition:background-color .14s,border-color .14s}
.tstep input[type=checkbox]:hover{border-color:var(--accent)}
.tstep input[type=checkbox]:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.tstep input[type=checkbox]::after{content:"";width:9px;height:5px;border-left:2px solid #fff;
  border-bottom:2px solid #fff;transform:rotate(-45deg) scale(0);transition:transform .14s;margin-top:-2px}
.tstep input[type=checkbox]:checked{background:var(--accent);border-color:var(--accent)}
.tstep input[type=checkbox]:checked::after{transform:rotate(-45deg) scale(1)}
.tstep .tn{font-family:'Roboto Mono',ui-monospace,monospace;font-size:12px;font-weight:500;
  color:var(--accent);background:var(--accent-soft);border-radius:999px;padding:5px 11px;white-space:nowrap}
.tstep .th{font-weight:600;font-size:18.5px;line-height:1.42;letter-spacing:-.008em}
.tstep .td{color:var(--ink-muted);font-size:16px;line-height:1.7;margin:12px 0 0;padding-left:35px}
.tstep .tb{margin:18px 0 0;padding-left:35px}
.tstep figure{margin:0}
@media (max-width:620px){.tstep .td,.tstep .tb{padding-left:0}.tstep .xp{margin-left:0}}

/* expected result — the same shape wherever it appears */
.xp{display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:start;
  margin:18px 0 0;padding:22px 24px;border:1px solid var(--xp-edge);background:var(--xp-bg);
  border-radius:var(--r);font-size:15.5px;line-height:1.68;color:var(--ink-2)}
.tstep .xp{margin-left:35px}
.xp .ic{color:var(--xp-ink);margin-top:3px}
/* Same title treatment as every other callout. It was a 10px mono micro-label,
   which read as broken sitting directly under a 17px panel title. */
.xp b{display:block;font-weight:600;font-size:17px;line-height:1.4;color:var(--xp-ink);
  margin-bottom:6px}

/* step rows with follow-along checkbox */
.rows{margin:24px 0 0;display:flex;flex-direction:column;gap:10px}
.row{display:grid;grid-template-columns:26px 32px 1fr;gap:14px;align-items:start;
  border:1px solid var(--card-edge);border-radius:var(--r);padding:20px 22px;background:var(--card);
  scroll-margin-top:calc(var(--top-h) + 28px);box-shadow:var(--shadow);
  transition:background-color .16s ease,border-color .16s ease}
.row.done{background:var(--surface);border-color:var(--hairline-soft);box-shadow:none}
.row.done .rt{color:var(--ink-faint);text-decoration:line-through;text-decoration-thickness:1px}
.row input[type=checkbox]{appearance:none;-webkit-appearance:none;margin:3px 0 0;width:20px;height:20px;
  border:1.5px solid var(--hairline);border-radius:var(--r-ctl);background:var(--card);cursor:pointer;
  display:grid;place-content:center;transition:background-color .14s,border-color .14s}
.row input[type=checkbox]:hover{border-color:var(--accent)}
.row input[type=checkbox]:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.row input[type=checkbox]::after{content:"";width:9px;height:5px;border-left:2px solid #fff;
  border-bottom:2px solid #fff;transform:rotate(-45deg) scale(0);transition:transform .14s;margin-top:-2px}
.row input[type=checkbox]:checked{background:var(--accent);border-color:var(--accent)}
.row input[type=checkbox]:checked::after{transform:rotate(-45deg) scale(1)}
.row .g{font-family:'Roboto Mono',ui-monospace,monospace;font-size:13px;font-weight:500;
  color:var(--accent);padding-top:3px}
.rt{font-weight:500;font-size:17px;line-height:1.6}
.rd{color:var(--ink-muted);font-size:16px;line-height:1.7;margin-top:6px}

/* code + copy button. The label bar's icon says which route this is, matching
   the three route cards in the prerequisites section. */
.code{border:1px solid var(--card-edge);border-radius:var(--r);margin:20px 0 0;overflow:hidden;
  background:var(--card);box-shadow:var(--shadow)}
.code .bar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 14px;
  background:var(--surface);border-bottom:1px solid var(--hairline)}
.code .bl{display:flex;align-items:center;gap:8px;
  font-family:'Roboto Mono',ui-monospace,monospace;font-size:10px;letter-spacing:.14em;
  text-transform:uppercase;color:var(--note-ink)}
.code .bl .ic{color:var(--note-ink)}
.code.prompt .bar{background:var(--xp-bg);border-bottom-color:var(--xp-edge)}
.code.prompt .bl,.code.prompt .bl .ic{color:var(--xp-ink)}
.code.click .bar{background:var(--ok-bg);border-bottom-color:var(--ok-edge)}
.code.click .bl,.code.click .bl .ic{color:var(--ok-ink)}
/* `message` shares the neutral ground with `terminal` — both are exact text to
   reuse verbatim. The icon carries the difference: a terminal, or a person. */
.code.message .bar{background:var(--note-bg);border-bottom-color:var(--note-edge)}
.code.message .bl,.code.message .bl .ic{color:var(--note-ink)}
.code.message pre{white-space:pre-wrap;font-family:'Inter',system-ui,sans-serif;font-size:15px}
.code pre{margin:0;padding:17px 18px;font-family:'Roboto Mono',ui-monospace,monospace;font-size:13.5px;
  line-height:1.65;white-space:pre-wrap;overflow-wrap:break-word;color:var(--ink)}
button.cp{font:inherit;font-family:'Roboto Mono',ui-monospace,monospace;font-size:10px;letter-spacing:.1em;
  text-transform:uppercase;padding:5px 12px;border-radius:999px;border:1px solid var(--hairline);
  background:var(--card);color:var(--ink-muted);cursor:pointer;white-space:nowrap;
  transition:border-color .14s,color .14s}
button.cp:hover{border-color:var(--accent);color:var(--accent)}
button.cp:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
button.cp.ok{color:var(--ok-ink);border-color:var(--ok-ink)}

/* callouts — icon in a gutter, title on the icon's line, body beneath */
.panel{display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:start;
  border-radius:var(--r);padding:22px 24px;margin:24px 0 0;
  background:var(--key-bg);border:1px solid var(--key-edge)}
.panel .ic{color:var(--key-ink);margin-top:3px}
.panel .pt{font-weight:600;font-size:17px;line-height:1.4;color:var(--key-ink);margin:0}
.panel p{margin:7px 0 0;max-width:none;font-size:15.5px;line-height:1.68;color:var(--ink-2)}
.panel .pt+p{margin-top:7px}
.panel.note{background:var(--note-bg);border-color:var(--note-edge)}
.panel.note .ic,.panel.note .pt{color:var(--note-ink)}
.panel.warning{background:var(--warn-bg);border-color:var(--warn-edge)}
.panel.warning .ic,.panel.warning .pt{color:var(--warn-ink)}
.panel.critical{background:var(--bad-bg);border-color:var(--bad-edge)}
.panel.critical .ic,.panel.critical .pt{color:var(--bad-ink)}
.panel.success{background:var(--ok-bg);border-color:var(--ok-edge)}
.panel.success .ic,.panel.success .pt{color:var(--ok-ink)}

/* tables — the first column is the thing you look up, so it stays dominant
   and everything else steps back */
.tw{overflow-x:auto;margin:26px 0 0;border:1px solid var(--card-edge);border-radius:var(--r);
  background:var(--card);box-shadow:var(--shadow)}
table{border-collapse:collapse;width:100%;min-width:560px;font-size:15.5px}
th{font-family:'Roboto Mono',ui-monospace,monospace;font-size:10px;letter-spacing:.14em;
  text-transform:uppercase;color:var(--accent);text-align:left;padding:15px 20px;
  border-bottom:1px solid var(--hairline);vertical-align:bottom;background:var(--surface);line-height:1.5}
td{padding:17px 20px;border-bottom:1px solid var(--hairline-soft);vertical-align:top;
  line-height:1.65;color:var(--ink-muted);font-size:15px}
td:first-child{color:var(--ink);font-weight:500;font-size:15.5px}
tr:last-child td{border-bottom:0}

/* figures */
figure{margin:22px 0 0}
figure img{display:block;width:100%;height:auto;border:1px solid var(--card-edge);border-radius:var(--r)}
figcaption{font-size:14px;line-height:1.6;color:var(--ink-muted);margin-top:11px}

/* bullets + checklist */
ul.b{margin:20px 0 0;padding-left:22px;max-width:68ch;color:var(--ink-2)}
ul.b li{margin:10px 0 0}
ul.ck{list-style:none;margin:26px 0 0;padding:0;border:1px solid var(--card-edge);
  border-radius:var(--r);background:var(--card);box-shadow:var(--shadow)}
ul.ck li{display:grid;grid-template-columns:30px 1fr;gap:13px;align-items:start;padding:17px 20px;
  border-top:1px solid var(--hairline-soft);font-size:16px;line-height:1.6}
ul.ck li:first-child{border-top:0}
ul.ck input[type=checkbox]{appearance:none;-webkit-appearance:none;width:19px;height:19px;margin:2px 0 0;
  border:1.5px solid var(--hairline);border-radius:var(--r-ctl);background:var(--card);cursor:pointer;
  display:grid;place-content:center}
ul.ck input[type=checkbox]:checked{background:var(--accent);border-color:var(--accent)}
ul.ck input[type=checkbox]::after{content:"";width:8px;height:5px;border-left:2px solid #fff;
  border-bottom:2px solid #fff;transform:rotate(-45deg) scale(0);margin-top:-2px;transition:transform .14s}
ul.ck input[type=checkbox]:checked::after{transform:rotate(-45deg) scale(1)}
ul.ck li.done span{color:var(--ink-faint);text-decoration:line-through}

/* code inline */
code{font-family:'Roboto Mono',ui-monospace,monospace;font-size:.86em;background:var(--surface);
  border:1px solid var(--hairline);border-radius:var(--r-ctl);padding:2px 6px}

/* band */
.band{background:var(--deep);border-radius:var(--r-band);padding:46px 42px;margin:0;
  display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:32px;align-items:end}
.band .pill{display:inline-block;font-family:'Roboto Mono',ui-monospace,monospace;font-size:10px;
  letter-spacing:.16em;text-transform:uppercase;color:var(--on-deep-muted);background:var(--on-deep-edge);
  border-radius:999px;padding:6px 12px}
.band .q{color:var(--on-deep);font-size:clamp(20px,2.5vw,27px);line-height:1.34;font-weight:500;
  margin:20px 0 0;text-wrap:balance;max-width:none}
.band .at{color:var(--on-deep);font-weight:600;font-size:16px;margin:0}
.band .ad{color:var(--on-deep-muted);font-size:15px;margin:5px 0 0}
footer{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;padding:26px 0 0;
  font-family:'Roboto Mono',ui-monospace,monospace;font-size:10px;letter-spacing:.12em;
  text-transform:uppercase;color:var(--ink-faint)}
/* Sits inside the last section, under the closing band, at the same 34px the
   band itself takes above — one block rhythm, not a detached page footer. */
.resetbar{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin:34px 0 0;
  padding-top:22px;border-top:1px solid var(--hairline);font-size:14.5px;color:var(--ink-muted)}
button.rst{font:inherit;font-size:14px;padding:9px 16px;border-radius:var(--r-ctl);
  border:1px solid var(--hairline);background:var(--card);color:var(--ink);cursor:pointer}
button.rst:hover{border-color:var(--accent);color:var(--accent)}
@media (max-width:620px){
  :root{--pad:18px}
  .sct{padding:48px 0 52px}
  .band{padding:30px 24px}.rules{padding:30px 24px 32px}
  .row{grid-template-columns:24px 28px 1fr;gap:11px;padding:16px 16px}
  .card,a.pcard{padding:20px 20px 19px}
  .tstep{padding:18px 18px 20px}
}
.picker{margin-top:34px}
.grid.c4{grid-template-columns:repeat(auto-fit,minmax(200px,1fr))}

/* ── route bar ─────────────────────────────────────────────────────────────
   Show only the kind of instruction the reader works in. html[data-route]
   carries the choice; a task with no block of that kind keeps all of its
   blocks and gets a .rhint, so nothing ever goes blank. */
.routebar{display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;margin:26px 0 0;
  padding:16px 18px;border:1px solid var(--card-edge);border-radius:var(--r);background:var(--card)}
.routebar .rq{font-size:14.5px;color:var(--ink-muted);margin-right:auto}
.routebar .rq strong{color:var(--ink);font-weight:600}
.rbtns{display:flex;flex-wrap:wrap;gap:6px}
button.rb{display:inline-flex;align-items:center;gap:7px;padding:7px 13px;border:1px solid var(--hairline);
  border-radius:999px;background:var(--ground-b);font:inherit;font-size:13.5px;color:var(--ink-muted);
  cursor:pointer;transition:border-color .15s ease,color .15s ease,background-color .15s ease}
button.rb .ic{width:14px;height:14px;display:block}
button.rb:hover{border-color:var(--accent);color:var(--accent);background:var(--card)}
button.rb:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
button.rb.on{background:var(--accent);border-color:var(--accent);color:#fff;font-weight:600}
button.rb.on .ic{color:#fff}
/* The repeat inside the procedure: same control, sitting between the picker
   cards and the phase tools, so it needs its own rhythm rather than the 26px
   that follows a run of route cards. */
.routebar.repeat{margin:36px 0 22px}
.code.rhide{display:none}
.rhint{font-size:13px;color:var(--ink-faint);margin:18px 0 -8px;padding-left:2px}
/* ── phases as collapsed rows ─────────────────────────────────────────────
   One ground, hairlines between rows. Closed: title, intro, count, chevron.
   Open: the tasks. Links to a phase open it; finishing a phase opens the next. */
details.phase{border-top:1px solid var(--hairline);margin:0;scroll-margin-top:calc(var(--top-h) + 24px)}
details.phase:first-of-type{border-top:0}
.pwrap{margin:40px 0 0}
/* The three tools are pills cut to the same pattern as the phase badges on
   the picker cards above them: mono, uppercase, tinted, 999px. */
.ptools{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:8px;margin:0 0 18px}
button.pt-all{font:inherit;font-family:'Roboto Mono',ui-monospace,monospace;font-size:10px;letter-spacing:.1em;
  text-transform:uppercase;color:var(--accent);background:var(--accent-soft);border:1px solid transparent;
  border-radius:999px;padding:6px 12px;cursor:pointer;line-height:1.5;
  transition:background-color .15s ease,border-color .15s ease,color .15s ease}
button.pt-all:hover{background:var(--card);border-color:var(--accent)}
button.pt-all:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
button.pt-all[data-reset]{color:var(--ink-muted);background:var(--surface)}
button.pt-all[data-reset]:hover{color:var(--accent);background:var(--card)}
details.phase>summary{list-style:none;display:grid;grid-template-columns:auto 1fr auto;gap:20px;
  align-items:start;padding:30px 8px 30px 0;cursor:pointer;border-radius:var(--r-ctl)}
/* Same tick box as a task, at the phase's scale: the gesture a reader already
   knows, one level up. */
input.pchk{appearance:none;-webkit-appearance:none;width:22px;height:22px;margin:7px 0 0;
  border:1.5px solid var(--hairline);border-radius:var(--r-ctl);background:var(--card);cursor:pointer;
  display:grid;place-content:center;flex:0 0 auto;transition:background-color .14s,border-color .14s}
input.pchk:hover{border-color:var(--accent)}
input.pchk:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
input.pchk::after{content:"";width:10px;height:5px;border-left:2px solid #fff;border-bottom:2px solid #fff;
  transform:rotate(-45deg) scale(0);transition:transform .14s;margin-top:-2px}
input.pchk:checked{background:var(--accent);border-color:var(--accent)}
input.pchk:checked::after{transform:rotate(-45deg) scale(1)}
/* A finished phase settles back the way a finished task does. */
details.phase.complete>summary h3.sub{color:var(--ink-faint);text-decoration:line-through;
  text-decoration-thickness:1px}
details.phase.complete>summary:hover h3.sub{color:var(--accent)}
details.phase.complete>summary .phd{color:var(--ink-faint)}
details.phase>summary::-webkit-details-marker{display:none}
details.phase>summary:hover h3.sub{color:var(--accent)}
details.phase>summary:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
details.phase>summary .phasehd{margin:0}
details.phase>summary .phd{margin-top:10px;font-size:16.5px}
details.phase h3.sub{margin:0;transition:color .15s}
.pmeta{display:flex;align-items:center;gap:14px;padding-top:6px}
.pmeta .pc{font-family:'Roboto Mono',ui-monospace,monospace;font-size:11px;letter-spacing:.1em;
  color:var(--ink-faint);white-space:nowrap}
details.phase.complete .pmeta .pc{color:var(--ok-ink)}
.pmeta .chev{width:30px;height:30px;border:1px solid var(--hairline);border-radius:999px;position:relative;
  background:var(--card);transition:transform .2s cubic-bezier(.23,1,.32,1),border-color .15s}
.pmeta .chev::after{content:"";position:absolute;left:11px;top:9px;width:6px;height:6px;
  border-right:1.5px solid var(--ink-muted);border-bottom:1.5px solid var(--ink-muted);transform:rotate(45deg)}
details.phase[open]>summary .chev{transform:rotate(180deg);border-color:var(--accent)}
details.phase>summary:hover .chev{border-color:var(--accent)}
details.phase>.pbody{padding:0 0 44px}
details.phase>.pbody>.tstep:first-child,details.phase>.pbody>p:first-child{margin-top:0}

/* ── jump card — closes section 01 ────────────────────────────────────────── */
a.jump{display:grid;grid-template-columns:1fr auto;gap:28px;align-items:center;margin:20px 0 0;
  padding:30px 34px;background:var(--deep);border-radius:var(--r-band);color:var(--on-deep);
  text-decoration:none;transition:transform .22s cubic-bezier(.23,1,.32,1),box-shadow .22s}
a.jump:hover{transform:translateY(-2px);box-shadow:var(--shadow-lift)}
a.jump:focus-visible{outline:2px solid var(--deep-accent);outline-offset:3px}
a.jump .jk{font-family:'Roboto Mono',ui-monospace,monospace;font-size:10.5px;letter-spacing:.18em;
  text-transform:uppercase;color:var(--deep-accent);margin:0}
a.jump .jt{margin:10px 0 0;font-size:20px;line-height:1.35;font-weight:600;color:var(--on-deep);max-width:30ch;text-wrap:balance}
a.jump .jd{margin:8px 0 0;font-size:15px;line-height:1.6;color:var(--on-deep-muted);max-width:56ch}
a.jump .jbtn{display:inline-flex;align-items:center;gap:8px;padding:13px 20px;border-radius:var(--r-ctl);
  background:#fff;color:#004FAA;font-weight:600;font-size:15px;white-space:nowrap;line-height:1}
a.jump .jbtn i{font-style:normal;transition:transform .22s cubic-bezier(.23,1,.32,1)}
a.jump:hover .jbtn i{transform:translateX(3px)}
@media (max-width:620px){a.jump{grid-template-columns:1fr;padding:24px 22px}}

/* ── phase menu ────────────────────────────────────────────────────────────
   A Procedure-only object. It hangs in the left margin, outside the content
   column, so the content keeps exactly the left and right edges it has in
   every other section and nothing shifts as the reader scrolls into the
   procedure. `.sidecol` is absolutely positioned and spans the section, so the
   card inside it is sticky for the length of the Procedure and releases at its
   end — no script, and no way for it to float over a section it does not list.

   It appears from 1100px up. Below that the margin cannot hold a legible menu
   at any measure worth reading, and the chip row in the top bar is the
   navigation. */
.sidecol{display:none}
@media (min-width:1100px){
  :root{--side:clamp(132px,12.5vw,190px); --edge:16px}
  .sct.hasmenu>.wrap{position:relative}
  /* left:-side puts the card's left edge exactly `--side` outside the content
     column, which is the same quantity the measure subtracts — the two stay
     in step by construction rather than by a matched pair of magic numbers. */
  .sidecol{display:block;position:absolute;top:0;bottom:0;
    left:calc(var(--pad) - var(--side) - var(--sgap));width:var(--side)}
  .side{position:sticky;top:calc(var(--top-h) + 16px);
    max-height:calc(100vh - var(--top-h) - 32px);overflow:auto;
    background:var(--card);border:1px solid var(--card-edge);border-radius:var(--r);
    box-shadow:var(--shadow);padding:16px 12px 14px;scrollbar-width:thin}
}
.side .st{font-family:'Roboto Mono',ui-monospace,monospace;font-size:10.5px;letter-spacing:.16em;
  text-transform:uppercase;color:var(--ink-faint);margin:0 0 10px 8px}
.side ul{list-style:none;margin:0;padding:0}
.side a.pl{display:grid;grid-template-columns:1fr auto;gap:2px 8px;padding:9px 8px;
  border-radius:var(--r-ctl);text-decoration:none;color:var(--ink-2);font-size:14px;
  line-height:1.35;transition:background-color .14s,color .14s}
.side a.pl:hover{background:var(--ground-b);color:var(--accent)}
.side a.pl:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
.side a.pl.on{background:var(--accent-soft);color:var(--accent)}
.side a.pl.on .pt{font-weight:600}
/* The badge sits on its own line above the title, so the title gets the card's
   full width and can break where it needs to rather than being truncated. */
.side a.pl .pn{font-family:'Roboto Mono',ui-monospace,monospace;font-size:10.5px;
  letter-spacing:.1em;text-transform:uppercase;color:var(--ink-faint)}
.side a.pl .pd{font-family:'Roboto Mono',ui-monospace,monospace;font-size:10.5px;
  color:var(--ink-faint);justify-self:end}
.side a.pl.on .pn{color:var(--accent)}
.side a.pl .pt{grid-column:1/-1;overflow-wrap:anywhere;color:inherit}
.side a.pl.complete .pd{color:var(--ok-ink)}
.side a.pl.complete .pt{color:var(--ink-faint);text-decoration:line-through;
  text-decoration-thickness:1px}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
@media print{.top,.sidecol,.jump,.picker,.resetbar,.routebar,button.cp,button.tp{display:none}
  .row input,input.pchk{display:none}
  details.phase{border:0}details.phase>summary .pmeta{display:none}details.phase>.pbody{display:block}
  details.phase.complete>summary h3.sub{color:inherit;text-decoration:none}
  .tstep.done>.td,.tstep.done>.tb,.tstep.done>.xp{display:block}
  .sct,.sct.tone-b{background:#fff}}
"""

JS = """
(function(){
  var KEY='hgm-sop-'+document.body.dataset.sopId;
  var st={};
  try{st=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){st={}}

  function save(){try{localStorage.setItem(KEY,JSON.stringify(st))}catch(e){}}
  function paint(){
    document.querySelectorAll('[data-step]').forEach(function(el){
      var on=!!st[el.dataset.step];
      var cb=el.querySelector('input[type=checkbox]');
      if(cb)cb.checked=on;
      el.classList.toggle('done',on);
    });
    var all=document.querySelectorAll('.row[data-step],.tstep[data-step]');
    var n=0; all.forEach(function(el){if(st[el.dataset.step])n++});
    document.querySelectorAll('[data-count-long]').forEach(function(c){c.textContent=n+' of '+all.length+' tasks done'});
    // per-phase counts, in the summary and in the side menu
    document.querySelectorAll('details.phase').forEach(function(ph){
      var ts=ph.querySelectorAll('.tstep[data-step]'),d=0;
      ts.forEach(function(el){if(st[el.dataset.step])d++});
      var full=ts.length>0&&d===ts.length;
      ph.classList.toggle('complete',full);
      var pc=ph.querySelector('[data-count]');if(pc)pc.textContent=(full?'Done \u00b7 ':'')+d+' / '+ts.length;
      var pk=ph.querySelector('input.pchk');if(pk)pk.checked=full;
      var sl=document.querySelector('[data-phase-count="'+ph.id+'"]');
      if(sl){sl.textContent=d+'/'+ts.length;sl.closest('a').classList.toggle('complete',full)}
    });
  }
  // a finished task folds to its title; the chevron peeks it open again
  document.addEventListener('click',function(e){
    var b=e.target.closest('button.tp');if(!b)return;
    b.closest('.tstep').classList.toggle('peek');
  });
  document.addEventListener('change',function(e){
    var cb=e.target.closest('input[type=checkbox]');
    if(!cb)return;
    var host=cb.closest('[data-step]');
    if(!host)return;
    if(cb.checked)st[host.dataset.step]=1; else {delete st[host.dataset.step];host.classList.remove('peek')}
    save();paint();
    // finishing the last task of a phase opens the next one
    var ph=host.closest('details.phase');
    if(ph&&cb.checked&&ph.classList.contains('complete')){
      var nx=ph.nextElementSibling;
      while(nx&&!(nx.tagName==='DETAILS'&&nx.classList.contains('phase')))nx=nx.nextElementSibling;
      if(nx)nx.open=true;
    }
  });
  // Ticking a phase ticks its tasks. Bound directly rather than delegated:
  // the click has to stop at the input, or <summary> takes it as an activation
  // and the phase opens and closes under the reader's hand.
  document.querySelectorAll('input.pchk').forEach(function(p){
    p.addEventListener('click',function(e){e.stopPropagation()});
    p.addEventListener('change',function(){
      var ph=p.closest('details.phase');if(!ph)return;
      var ts=[].slice.call(ph.querySelectorAll('.tstep[data-step]'));
      if(p.checked){ts.forEach(function(t){st[t.dataset.step]=1})}
      else{
        var any=ts.some(function(t){return st[t.dataset.step]});
        if(any&&!confirm('Clear every tick in this phase?')){p.checked=true;return}
        ts.forEach(function(t){delete st[t.dataset.step];t.classList.remove('peek')});
      }
      save();paint();
    });
  });

  document.querySelectorAll('[data-reset]').forEach(function(r){
    r.addEventListener('click',function(){
      if(!confirm('Clear your progress on this SOP in this browser?'))return;
      st={};save();paint();
      document.querySelectorAll('.tstep.peek').forEach(function(t){t.classList.remove('peek')});
    });
  });

  // Every in-page anchor eases to its target rather than jumping. Progress
  // is eased in and out over a distance-scaled duration (short hops are quick,
  // long ones never drag), and the hash is set afterwards so the browser does
  // not jump on its own. Reduced-motion readers get the plain jump.
  var RM=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function topOf(el){
    var sm=parseFloat(getComputedStyle(el).scrollMarginTop)||0;
    return el.getBoundingClientRect().top+(window.scrollY||document.documentElement.scrollTop)-sm;
  }
  function glide(el,hash){
    var from=window.scrollY||document.documentElement.scrollTop;
    var max=document.documentElement.scrollHeight-window.innerHeight;
    var to=Math.max(0,Math.min(max,topOf(el)));
    var dist=Math.abs(to-from);
    if(RM||dist<2){window.scrollTo(0,to);if(hash)history.replaceState(null,'',hash);return}
    var dur=Math.min(720,Math.max(320,240+dist*0.18)),t0=null;
    function ease(x){return x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2}
    function frame(ts){
      if(t0===null)t0=ts;
      var k=Math.min(1,(ts-t0)/dur);
      window.scrollTo(0,from+(to-from)*ease(k));
      if(k<1)requestAnimationFrame(frame);
      else{window.scrollTo(0,to);if(hash)history.replaceState(null,'',hash)}
    }
    requestAnimationFrame(frame);
  }
  document.addEventListener('click',function(e){
    var a=e.target.closest('a[href^="#"]');if(!a)return;
    var id=a.getAttribute('href').slice(1);if(!id)return;
    var el=document.getElementById(id);if(!el)return;
    e.preventDefault();
    openPhaseFor('#'+id);
    // let a just-opened <details> lay out before measuring the target
    requestAnimationFrame(function(){glide(el,'#'+id)});
  });

  // phases: closed until you reach them. Any link to a phase opens it, the
  // two tools open or close them all, and a returning reader lands with the
  // phase holding their next task already open.
  var phaseEls=[].slice.call(document.querySelectorAll('details.phase'));
  function openPhaseFor(hash){
    if(!hash)return;var el=document.getElementById(hash.replace(/^#/,''));
    if(!el)return;var ph=el.closest?el.closest('details.phase'):null;
    if(ph)ph.open=true;
  }
  window.addEventListener('hashchange',function(){openPhaseFor(location.hash)});
  openPhaseFor(location.hash);
  document.querySelectorAll('[data-phases]').forEach(function(b){
    b.addEventListener('click',function(){var o=b.dataset.phases==='open';phaseEls.forEach(function(p){p.open=o})});
  });
  if(Object.keys(st).length&&!location.hash){
    for(var pi=0;pi<phaseEls.length;pi++){
      var open=[].some.call(phaseEls[pi].querySelectorAll('.tstep[data-step]'),function(t){return !st[t.dataset.step]});
      if(open){phaseEls[pi].open=true;break}
    }
  }

  // light / dark toggle — light is the default, the choice is remembered
  var tg=document.getElementById('theme');
  if(tg)tg.addEventListener('click',function(){
    var dark=document.documentElement.getAttribute('data-theme')==='dark';
    if(dark)document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme','dark');
    try{localStorage.setItem('hgm-theme',dark?'light':'dark')}catch(e){}
  });

  // route filter — show only the kind of instruction the reader works in.
  // Groups are the task card (.tstep) or, outside a card, the block's parent.
  // A platform is a set of block kinds (data-kinds on its button). A task
  // that has none of them keeps every block and gets a .rhint.
  var RKEY='hgm-route', PLAT={};
  document.querySelectorAll('button.rb[data-kinds]').forEach(function(b){
    PLAT[b.dataset.route]={name:b.textContent.trim(),kinds:b.dataset.kinds.split(' ')};
  });
  function groupOf(el){return el.closest('.tstep')||el.parentElement}
  function applyRoute(r){
    document.querySelectorAll('.rhint').forEach(function(h){h.remove()});
    var blocks=[].slice.call(document.querySelectorAll('.code[data-route]'));
    blocks.forEach(function(b){b.classList.remove('rhide')});
    document.querySelectorAll('button.rb').forEach(function(b){b.classList.toggle('on',b.dataset.route===(r||'all'))});
    if(!r||!PLAT[r]){document.documentElement.removeAttribute('data-route');return}
    document.documentElement.setAttribute('data-route',r);
    var ok=PLAT[r].kinds,groups=new Map();
    blocks.forEach(function(b){var g=groupOf(b);if(!groups.has(g))groups.set(g,[]);groups.get(g).push(b)});
    groups.forEach(function(bs,g){
      var has=bs.some(function(b){return ok.indexOf(b.dataset.route)>=0});
      if(has){bs.forEach(function(b){if(ok.indexOf(b.dataset.route)<0)b.classList.add('rhide')})}
      else if(bs.length){
        var h=document.createElement('div');h.className='rhint';
        h.textContent='Nothing for '+PLAT[r].name+' on this task \u2014 showing every route.';
        bs[0].parentNode.insertBefore(h,bs[0]);
      }
    });
  }
  var saved=null;try{saved=localStorage.getItem(RKEY)}catch(e){}
  if(document.querySelector('.routebar')){
    applyRoute(saved&&PLAT[saved]?saved:null);
    document.querySelectorAll('button.rb').forEach(function(b){
      b.addEventListener('click',function(){
        var r=b.dataset.route==='all'?null:b.dataset.route;
        try{if(r)localStorage.setItem(RKEY,r);else localStorage.removeItem(RKEY)}catch(e){}
        applyRoute(r);
      });
    });
  }

  // copy buttons
  document.querySelectorAll('button.cp').forEach(function(b){
    b.addEventListener('click',function(){
      var pre=b.closest('.code').querySelector('pre');
      var txt=pre.innerText;
      var done=function(){b.textContent='Copied';b.classList.add('ok');
        setTimeout(function(){b.textContent='Copy';b.classList.remove('ok')},1400)};
      if(navigator.clipboard&&navigator.clipboard.writeText){
        navigator.clipboard.writeText(txt).then(done,fallback);
      } else fallback();
      function fallback(){
        var ta=document.createElement('textarea');ta.value=txt;
        ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);
        ta.select();try{document.execCommand('copy');done()}catch(e){}
        document.body.removeChild(ta);
      }
    });
  });

  // scroll progress + current section
  var bar=document.querySelector('.prog i');
  var now=document.getElementById('now');
  var marks=[].slice.call(document.querySelectorAll('h3.sub,.sct > .wrap > .slab .lbl'));
  var slabs=[].slice.call(document.querySelectorAll('section.sct[id]'));
  var chips=[].slice.call(document.querySelectorAll('a.chip'));
  var topbar=document.querySelector('.top');
  function setTopH(){if(topbar)document.documentElement.style.setProperty('--top-h',topbar.offsetHeight+'px')}
  setTopH();window.addEventListener('resize',setTopH);
  var lastChip=null;
  // A section anchors under the sticky bar with scroll-margin-top, so the
  // "you are here" line has to sit BELOW that or a section you just clicked
  // never counts as current and the previous chip stays lit.
  function line(){return (topbar?topbar.offsetHeight:100)+30}
  function onScroll(){
    var y=window.scrollY||document.documentElement.scrollTop;
    var max=document.documentElement.scrollHeight-window.innerHeight;
    var L=line();
    if(bar)bar.style.width=(max>0?Math.min(100,Math.max(0,y/max*100)):0)+'%';
    if(now){var cur='';
      for(var i=0;i<marks.length;i++){if(marks[i].getBoundingClientRect().top<=L)cur=marks[i].textContent}
      now.textContent=cur;}
    var act=null;
    for(var j=0;j<slabs.length;j++){if(slabs[j].getBoundingClientRect().top<=L)act=slabs[j].id}
    if(act!==lastChip){
      lastChip=act;
      chips.forEach(function(c){
        var on=c.dataset.sec===act;
        c.classList.toggle('on',on);
        if(on&&c.scrollIntoView)c.scrollIntoView({block:'nearest',inline:'nearest'});
      });
    }
  }
  // side menu: light the phase the reader is in
  var pls=[].slice.call(document.querySelectorAll('.side a.pl'));
  var lastP=null;
  function onPhase(){
    if(!pls.length)return;
    var L=line(),act=null;
    for(var i=0;i<phaseEls.length;i++){var r=phaseEls[i].getBoundingClientRect();
      if(r.top<=L&&r.bottom>L)act=phaseEls[i].id}
    if(act!==lastP){lastP=act;
      pls.forEach(function(c){c.classList.toggle('on',c.dataset.phase===act)})}
  }
  window.addEventListener('scroll',function(){onScroll();onPhase()},{passive:true});
  onPhase();
  paint();onScroll();
})();
"""


# ─────────────────────────────────────────────────────────── block render

SIDE_SLOT = "<!--HGM-PHASE-MENU-->"


def _band_section(blocks):
    """Index of the section that holds the closing band, or None.

    That section is forced light: a dark band on a dark ground is invisible.
    """
    at, idx = None, -1
    for b in blocks:
        if b.get("type") == "section":
            idx += 1
        elif b.get("type") == "band" and idx >= 0:
            at = idx
    return at


def render(doc, base=".", wrap=True, picker_html="", routebar_html="", jump_html="", tail_html=""):
    """wrap=False renders a bare run of blocks — used for the body of a step,
    which must not open sections of its own."""
    out = []
    w = out.append
    step_seen = []
    sections = []
    phases = []          # (id, text, task_count) for the side menu
    blocks = doc.get("blocks", [])
    band_at = _band_section(blocks) if wrap else None
    # Grounds alternate off-white / a shade darker so consecutive bands separate
    # without a rule between them, and a white card stays the brightest thing on
    # the page. Sections alternate. Phases no longer take their own band: each
    # is a collapsed <details> row on the Procedure ground, separated by a
    # hairline, so the closed list reads as one list and not as stripes.
    sec_n, prev = -1, "a"   # masthead and picker are tone-a; 01 is the first change
    open_sec = False
    open_phase = False
    open_pwrap = False

    def close_phase():
        nonlocal open_phase
        if open_phase:
            w("</div></details>")
            open_phase = False

    def close():
        nonlocal open_sec, open_pwrap
        close_phase()
        if open_sec:
            if open_pwrap:
                w("</div>")
                open_pwrap = False
            w("</div></section>")
            open_sec = False

    def open_band(tone, sid=None, menu=False):
        nonlocal open_sec
        close()
        cls = "sct dark" if tone == "dark" else f"sct tone-{tone}"
        if menu:
            cls += " hasmenu"
        idattr = f' id="{sid}"' if sid else ""
        w(f'<section class="{cls}"{idattr}>')
        w('<div class="wrap">')
        if menu:
            w(SIDE_SLOT)
        open_sec = True

    def next_tone():
        nonlocal prev
        prev = "a" if prev == "b" else "b"
        return prev

    proc_i = procedure_index(blocks)
    span = picker_span(blocks) if manual_picker_present(blocks) else None
    # Route bar goes under the run of panels that follows the route cards.
    route_after = None
    for i, b in enumerate(blocks):
        if b.get("type") == "cards" and any(it.get("icon") for it in b.get("items", [])):
            route_after = i
            while route_after + 1 < len(blocks) and blocks[route_after + 1].get("type") == "panel":
                route_after += 1
            break

    # A phase band may only open once its section has content. Otherwise the
    # section heading is left alone on a band of its own.
    since_slab = False

    for bi, b in enumerate(blocks):
        t = b.get("type")

        # A hand-built picker (older files) is dropped on screen: the built-in
        # picker is drawn at the head of the Procedure section instead.
        if span and span[0] <= bi < span[1] and t in ("cards", "para") or \
           (span and span[0] <= bi < span[1] and t == "sub" and not b.get("id")):
            continue

        if routebar_html and route_after is not None and bi == route_after + 1:
            w(routebar_html)
            since_slab = True
        if t not in ("section", "sub"):
            since_slab = True

        if t == "section":
            num = f'<span class="num">{esc(b["num"])}</span>' if b.get("num") else ""
            sid = f'sec-{slug(b.get("num") or b["label"])}'
            sections.append((b.get("num", ""), b["label"], sid))
            if wrap:
                # The jump card closes section 01: a reader who knows the
                # background goes straight to the procedure from here.
                sec_n += 1
                if b.get("tone") == "dark" and sec_n != band_at:
                    tone, prev = "dark", "b"   # come out of dark on the lighter ground
                else:
                    tone = next_tone()
                open_band(tone, sid, menu=(bi == proc_i))
                w(f'<div class="slab">{num}'
                  f'<span class="lbl">{esc(b["label"])}</span>'
                  f'<span class="rule"></span></div>')
                since_slab = False
                if bi == proc_i and picker_html:
                    w(picker_html)
                    since_slab = True
            else:
                w(f'<div class="slab" id="{sid}">{num}'
                  f'<span class="lbl">{esc(b["label"])}</span>'
                  f'<span class="rule"></span></div>')

        elif t == "sub":
            sid = f'proc-{b["id"]}' if b.get("id") else slug(b["text"])
            since_slab = True
            intro = f'<p class="phd">{b["d"]}</p>' if b.get("d") else ""
            if wrap and b.get("id"):
                # A numbered phase is a collapsed row. Everything up to the
                # next numbered phase or section — its tasks, its panels, its
                # one-go alternative — lives inside it.
                close_phase()
                ntask = 0
                for nb in blocks[bi + 1:]:
                    if nb.get("type") == "section" or (nb.get("type") == "sub" and nb.get("id")):
                        break
                    if nb.get("type") == "step":
                        ntask += 1
                if not open_pwrap:
                    open_pwrap = True
                    # The choice is made once in the prerequisites, but the
                    # reader who jumped straight to the procedure never saw it,
                    # and the reader who came back to a phase should be able to
                    # change it without scrolling up four sections. Both bars
                    # drive the same state.
                    w('<div class="pwrap">')
                    if routebar_html:
                        w(routebar_html.replace('class="routebar"',
                                                'class="routebar repeat"', 1))
                    w('<div class="ptools">'
                      '<button class="pt-all" type="button" data-phases="open">Expand all phases</button>'
                      '<button class="pt-all" type="button" data-phases="close">Collapse all</button>'
                      '<button class="pt-all" type="button" data-reset>Reset progress</button></div>')
                phases.append((sid, html.unescape(re.sub(r"<[^>]+>", "", b["text"])), ntask))
                # Ticking the phase ticks its tasks — one source of truth, so a
                # struck-through phase can never sit above a count that says
                # otherwise.
                pchk = (f'<input class="pchk" type="checkbox" data-phase-check="{sid}" '
                        f'aria-label="Mark every task in phase {esc(b["id"])} done">') if ntask else ""
                w(f'<details class="phase" id="{sid}" data-phase="{sid}">'
                  f'<summary>{pchk}<div class="phasehd"><h3 class="sub">{b["text"]}</h3>{intro}</div>'
                  f'<span class="pmeta"><span class="pc" data-count>0 / {ntask}</span>'
                  f'<span class="chev" aria-hidden="true"></span></span></summary>'
                  f'<div class="pbody">')
                open_phase = True
            else:
                w(f'<div class="phasehd"><h3 class="sub" id="{sid}">{b["text"]}</h3>{intro}</div>')

        elif t in ("para", "lead"):
            since_slab = True
            w(f'<p>{b["text"]}</p>')

        elif t == "bullets":
            w('<ul class="b">' + "".join(f"<li>{i}</li>" for i in b["items"]) + "</ul>")

        elif t == "cards":
            cls = " c3" if b.get("cols") == 3 else ""
            cs = ""
            for it in b["items"]:
                k = f'<div class="k">{esc(it["k"])}</div>' if it.get("k") else ""
                ic = icon(it.get("icon", ""))
                ti = f'<div class="t">{ic}{it["t"]}</div>' if it.get("t") else ""
                d = f'<div class="d">{it["d"]}</div>' if it.get("d") else ""
                cs += f'<div class="card">{k}{ti}{d}</div>'
            w(f'<div class="grid{cls}">{cs}</div>')

        elif t == "numcards":
            cs = ""
            for n, it in enumerate(b["items"], start=int(b.get("start", 1))):
                cs += (f'<div class="card"><div class="k">{n}</div>'
                       f'<div class="t">{it.get("t","")}</div>'
                       f'<div class="d">{it.get("d","")}</div></div>')
            w(f'<div class="grid">{cs}</div>')

        elif t == "rules":
            k = f'<p class="rk">{esc(b.get("k","Always true"))}</p>'
            h = f'<h2>{b["t"]}</h2>' if b.get("t") else ""
            ld = f'<p class="rlead">{b["d"]}</p>' if b.get("d") else ""
            cs = ""
            for n, it in enumerate(b["items"], start=int(b.get("start", 1))):
                cs += (f'<div class="rcard"><div class="rn">{n}</div>'
                       f'<div class="rt">{it.get("t","")}</div>'
                       f'<div class="rd">{it.get("d","")}</div></div>')
            w(f'<div class="rules">{k}{h}{ld}<div class="rgrid">{cs}</div></div>')

        elif t == "rows":
            w('<div class="rows">')
            n = int(b.get("start", 1))
            for it in b["items"]:
                sid = esc(it.get("id", f"s{n}"))
                step_seen.append(sid)
                x = ""
                if it.get("expect"):
                    x = (f'<div class="xp">{icon("expect")}'
                         f'<div><b>Expected result</b>{it["expect"]}</div></div>')
                d = f'<div class="rd">{it["d"]}</div>' if it.get("d") else ""
                w(f'<div class="row" data-step="{sid}" id="step-{n}">'
                  f'<input type="checkbox" aria-label="Mark step {n} done">'
                  f'<span class="g">{n}</span>'
                  f'<div><div class="rt">{it.get("t","")}</div>{d}{x}</div></div>')
                n += 1
            w("</div>")

        elif t == "step":
            sid = esc(b.get("id", b.get("n", "")))
            step_seen.append(sid)
            d = f'<div class="td">{b["d"]}</div>' if b.get("d") else ""
            inner = ""
            for ib in b.get("body", []):
                sub_html, _, _, _ = render({"blocks": [ib]}, base, wrap=False)
                inner += sub_html
            bd = f'<div class="tb">{inner}</div>' if inner else ""
            x = ""
            if b.get("expect"):
                x = (f'<div class="xp">{icon("expect")}'
                     f'<div><b>Expected result</b>{b["expect"]}</div></div>')
            w(f'<div class="tstep" data-step="{sid}" id="task-{esc(b.get("n",""))}">'
              f'<div class="hd">'
              f'<input type="checkbox" aria-label="Mark task {esc(b.get("n",""))} done">'
              f'<span class="tn">{esc(b.get("n",""))}</span>'
              f'<span class="th">{b.get("t","")}</span>'
              f'<button class="tp" type="button" aria-label="Show or hide the details of this task"></button></div>'
              f'{d}{bd}{x}</div>')

        elif t == "panel":
            kind = b.get("kind", "brand")
            cls = "" if kind == "brand" else f" {kind}"
            ti = f'<div class="pt">{b["t"]}</div>' if b.get("t") else ""
            w(f'<div class="panel{cls}">{icon(kind)}'
              f'<div>{ti}<p>{b["text"]}</p></div></div>')

        elif t == "code":
            kind = b.get("kind", "terminal")
            left = esc(b.get("label", ""))
            note = f' &middot; {esc(b["note"])}' if b.get("note") else ""
            route = f' data-route="{kind}"' if kind in ROUTE_KINDS else ""
            w(f'<div class="code {kind}"{route}>'
              f'<div class="bar"><span class="bl">{icon(kind)}'
              f'<span>{left}{note}</span></span>'
              f'<button class="cp" type="button">Copy</button></div>'
              f'<pre>{esc(b["text"])}</pre></div>')

        elif t == "table":
            th = "".join(f"<th>{esc(h)}</th>" for h in b["headers"])
            tr = "".join("<tr>" + "".join(f"<td>{c}</td>" for c in r) + "</tr>"
                         for r in b["rows"])
            w(f'<div class="tw"><table><thead><tr>{th}</tr></thead>'
              f"<tbody>{tr}</tbody></table></div>")

        elif t == "checklist":
            lis = ""
            for i, it in enumerate(b["items"]):
                lis += (f'<li data-step="ck{i}"><input type="checkbox" '
                        f'aria-label="Checklist item {i+1}"><span>{it}</span></li>')
            w(f'<ul class="ck">{lis}</ul>')

        elif t == "figure":
            src_uri = inline_image(b["path"], base)
            cap = b.get("caption", "")
            if src_uri:
                w(f'<figure><img src="{src_uri}" alt="{esc(re.sub(chr(60)+"[^>]+"+chr(62), "", cap))}">'
                  f"<figcaption>{cap}</figcaption></figure>")
            else:
                w(f'<div class="panel warning">{icon("warning")}'
                  f'<div><div class="pt">Missing screenshot</div>'
                  f'<p>Expected an image at <code>{esc(b["path"])}</code> — {cap}</p>'
                  f'</div></div>')

        elif t == "band":
            pill = f'<span class="pill">{esc(b["pill"])}</span>' if b.get("pill") else ""
            q = f'<p class="q">{b["quote"]}</p>' if b.get("quote") else ""
            a = ""
            if b.get("aside_t") or b.get("aside_d"):
                a = (f'<div><p class="at">{b.get("aside_t","")}</p>'
                     f'<p class="ad">{b.get("aside_d","")}</p></div>')
            w(f'<div class="band" style="margin-top:34px"><div>{pill}{q}</div>{a}</div>')

    # The progress line and the footer close the last section rather than
    # opening one of their own. A separate band gave them their own ground and
    # a full section's padding, which read as a detached page footer sitting
    # below the document instead of the end of it.
    if wrap and tail_html:
        if not open_sec:
            open_band(next_tone())
        close_phase()
        if open_pwrap:
            w("</div>")
            open_pwrap = False
        w(tail_html)

    close()
    return "\n".join(out), step_seen, sections, phases


def build(doc, base="."):
    meta = doc.get("meta", {})
    blocks = doc.get("blocks", [])
    proc_i = procedure_index(blocks)
    proc_sid = (f'sec-{slug(blocks[proc_i].get("num") or blocks[proc_i]["label"])}' if proc_i is not None else "")

    spec = ""
    for label, key in [("SOP ID", "sop_id"), ("Version", "version"), ("Owner", "owner"),
                       ("Approved by", "approved_by"), ("Effective", "effective_date"),
                       ("Next review", "next_review"), ("Trigger", "frequency"),
                       ("Duration", "duration")]:
        if meta.get(key):
            spec += f"<div><dt>{label}</dt><dd>{esc(meta[key])}</dd></div>"

    picker = ""
    if meta.get("tasks"):
        cards = ""
        for tk in meta["tasks"]:
            href = f'#proc-{tk["proc"]}' if tk.get("proc") else f'#{slug(tk["label"])}'
            badge = (f'<span class="n">{esc(tk["badge"])}</span>'
                     if tk.get("badge") else "")
            cta = esc(tk.get("cta", "Read the steps"))
            cards += (f'<a class="pcard" href="{href}">{badge}'
                      f'<span class="t">{esc(tk["label"])}</span>'
                      f'<span class="d">{esc(tk.get("hint",""))}</span>'
                      f'<span class="cta">{cta} <i>&rarr;</i></span></a>')
        picker = ('<div class="picker">'
                  f'<h2>{esc(meta.get("picker_h", PICKER_H))}</h2>'
                  f'<p class="plead">{esc(meta.get("picker_d", PICKER_D))}</p>'
                  f'<div class="pgrid">{cards}</div></div>')

    # Route bar: only when the document actually offers a choice.
    def _kinds(blocks, acc):
        for b in blocks:
            if b.get("type") == "code" and b.get("kind", "terminal") in ROUTE_KINDS:
                acc.add(b.get("kind", "terminal"))
            if b.get("type") == "step":
                _kinds(b.get("body", []), acc)
        return acc
    present = _kinds(doc.get("blocks", []), set())
    routebar = ""
    if len(present) >= 2:
        btns = '<button class="rb on" type="button" data-route="all">Show all</button>'
        for pid, name, ic, kinds in PLATFORMS:
            if kinds & present:
                btns += (f'<button class="rb" type="button" data-route="{pid}" '
                         f'data-kinds="{" ".join(sorted(kinds))}">{icon(ic)}{esc(name)}</button>')
        routebar = ('<div class="routebar" role="group" aria-label="Choose where you work">'
                    '<span class="rq"><strong>Where are you working?</strong> '
                    'Pick your platform and each task shows only the instructions that run there.</span>'
                    f'<div class="rbtns">{btns}</div></div>')
    # Place the picker at the head of the Procedure section and the route bar
    # under the route cards. If a document has no Procedure section, the picker
    # falls back to its own band under the masthead; if it has no route cards,
    # the route bar sits inside the picker.
    has_route_cards = any(b.get("type") == "cards" and any(it.get("icon") for it in b.get("items", []))
                          for b in blocks)
    inline_route = routebar if has_route_cards else ""
    if routebar and not has_route_cards and picker:
        picker = picker.replace('</div></div>', routebar + '</div></div>', 1) if picker.endswith('</div></div>') else picker + routebar
    jump = ""
    if proc_i is not None:
        jump = (f'<a class="jump" href="#{proc_sid}">'
                '<div><p class="jk">Skip ahead</p>'
                '<p class="jt">Already know the background? Go straight to the procedure.</p>'
                '<p class="jd">Pick the phase you need, then work through its tasks and tick '
                'them off as you go. Your progress is saved in this browser.</p></div>'
                '<span class="jbtn">Go to the procedure <i>&rarr;</i></span></a>')
    tail = ('<div class="resetbar">'
            '<span>Your progress is saved in this browser only.</span>'
            '<button class="rst" type="button" data-reset>Reset progress</button></div>'
            '<footer>'
            f'<span>{esc(meta.get("sop_id",""))} &middot; v{esc(meta.get("version",""))}</span>'
            '<span>Internal — Hidden Gem Media</span></footer>')
    body, steps, sections, phases = render(doc, base, picker_html=picker if proc_i is not None else "",
                                           routebar_html=inline_route, tail_html=tail)
    top_picker = ""
    if picker and proc_i is None:
        top_picker = f'<section class="sct tone-a" id="sec-start"><div class="wrap">{picker}</div></section>'

    # Phase menu: the Procedure's phases and nothing else, slotted into the
    # Procedure section so it hangs in the margin beside it.
    side = ""
    for pid, ptext, ntask in phases:
        title = re.sub(r"^\s*Phase\s+\d+\s*[\u2014\u2013-]\s*", "", ptext)
        m = re.match(r"\s*(Phase\s+\d+)", ptext)
        badge = m.group(1) if m else ""
        side += (f'<li><a class="pl" href="#{pid}" data-phase="{pid}">'
                 f'<span class="pn">{esc(badge)}</span>'
                 f'<span class="pd" data-phase-count="{pid}">0/{ntask}</span>'
                 f'<span class="pt">{esc(title)}</span></a></li>')
    if side:
        side = ('<div class="sidecol"><aside class="side" aria-label="Phases of this procedure">'
                f'<p class="st">Phases</p><ul>{side}</ul></aside></div>')
    body = body.replace(SIDE_SLOT, side)

    chips = "".join(
        f'<a class="chip" href="#{sid}" data-sec="{sid}">'
        f'<span class="cn">{esc(num)}</span>{esc(label)}</a>'
        for num, label, sid in sections)
    navrow = f'<div class="navclip"><div class="secnav" id="secnav">{chips}</div></div>' if chips else ""
    ver = f' <span class="topv">&middot; v{esc(meta["version"])}</span>' if meta.get("version") else ""

    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(meta.get('title','HGM SOP'))} — {esc(meta.get('sop_id',''))}</title>
{font_head()}
<style>{CSS}</style>
<script>
/* Applied before first paint so the page never flashes the wrong theme.
   Light is the default; only an explicit choice turns dark on. */
(function(){{try{{var t=localStorage.getItem('hgm-theme');
  if(t==='dark')document.documentElement.setAttribute('data-theme','dark');}}catch(e){{}}}})();
</script>
</head>
<body data-sop-id="{esc(meta.get('sop_id','sop'))}" data-proc-sec="{proc_sid}">
<div class="top">
  <div class="topin">
    <div class="topl"><span class="topid">{esc(meta.get('sop_id',''))}{ver}</span></div>
    <span class="topnow" id="now"></span>
    <div class="topr">
    <span class="topid" id="count" data-count-long></span>
    <button class="toprst" type="button" data-reset>Reset</button>
    <button class="tgl" id="theme" type="button" aria-label="Switch between light and dark">
      <svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
           stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
      <svg class="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
    </button>
    </div>
  </div>
  {navrow}
  <div class="prog"><i></i></div>
</div>
<section class="sct mast tone-a">
  <div class="wrap">
    <p class="eyebrow">{esc(meta.get('eyebrow',''))}</p>
    {draft_strip(meta)}
    <h1>{esc(meta.get('title',''))}</h1>
    <p class="lead">{meta.get('lead','')}</p>
    <dl class="spec">{spec}</dl>
    {jump}
  </div>
</section>
{top_picker}
{body}
<script>{JS}</script>
</body>
</html>
"""


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit("usage: python3 to_html.py content.json out.html")
    with open(sys.argv[1]) as f:
        doc = json.load(f)
    base = os.path.dirname(os.path.abspath(sys.argv[1]))
    with open(sys.argv[2], "w") as f:
        f.write(build(doc, base))
    kb = os.path.getsize(sys.argv[2]) // 1024
    print(f"Wrote {sys.argv[2]} ({kb} KB)")
