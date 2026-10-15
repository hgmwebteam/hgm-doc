#!/usr/bin/env python3
"""
Serialize an HGM content JSON to the Markdown review copy.

  python3 to_markdown.py content.json out.md

The third rendering of the same source: the portal page and the PDF are the
other two. This is the copy people read and comment on before approval, and the
copy a diff is taken against.
"""

import html
import json
import re
import sys
import os as _os; sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from picker import blocks_for_print  # noqa: E402

META_ROWS = [
    ("SOP ID", "sop_id"), ("Version", "version"), ("Owner", "owner"),
    ("Approved by", "approved_by"), ("Effective date", "effective_date"),
    ("Next review date", "next_review"), ("Frequency / trigger", "frequency"),
    ("Time to complete", "duration"), ("Status", "status"),
]


def txt(s):
    """Inline HTML -> Markdown."""
    if s is None:
        return ""
    s = str(s)
    s = re.sub(r"<br\s*/?>", "\n", s)
    s = re.sub(r"<strong[^>]*>(.*?)</strong>", r"**\1**", s, flags=re.S)
    s = re.sub(r"<em[^>]*>(.*?)</em>", r"*\1*", s, flags=re.S)
    s = re.sub(r"<code[^>]*>(.*?)</code>", r"`\1`", s, flags=re.S)
    s = re.sub(r"<[^>]+>", "", s)
    return html.unescape(s).strip()


def render(doc):
    meta = doc.get("meta", {})
    out = []
    w = out.append

    w(f"# {txt(meta.get('title', 'Untitled'))}\n")
    if meta.get("lead"):
        w(f"{txt(meta['lead'])}\n")

    w("## Document header\n")
    w("| Field | Value |")
    w("|---|---|")
    for label, key in META_ROWS:
        if meta.get(key):
            w(f"| {label} | {txt(meta[key])} |")
    w("")

    step_no = {}          # rows-block id -> displayed number, for readability

    def flat(bs):
        """A step is its heading line, then its body blocks in order."""
        for b in bs:
            if b.get("type") == "step":
                yield {"type": "_stephead", "n": b.get("n", ""), "t": b.get("t", ""),
                       "d": b.get("d", ""), "id": b.get("id", "")}
                yield from flat(b.get("body", []))
                if b.get("expect"):
                    yield {"type": "_expect", "text": b["expect"]}
            else:
                yield b

    for b in flat(blocks_for_print(doc)):
        t = b.get("type")

        if t == "_stephead":
            sid = f"  `{b['id']}`" if b.get("id") else ""
            w(f"\n#### {b['n']} {txt(b['t'])}{sid}\n")
            if b.get("d"):
                w(f"{txt(b['d'])}\n")
            continue
        if t == "_expect":
            w(f"> Expected result: {txt(b['text'])}\n")
            continue

        if t == "section":
            num = f"{b['num']}. " if b.get("num") else ""
            w(f"\n## {num}{txt(b['label'])}\n")

        elif t == "sub":
            w(f"\n### {txt(b['text'])}\n")

        elif t in ("lead", "para"):
            w(f"{txt(b['text'])}\n")

        elif t == "bullets":
            for it in b["items"]:
                w(f"- {txt(it)}")
            w("")

        elif t == "cards":
            for it in b["items"]:
                head = txt(it.get("k") or it.get("t") or "")
                w(f"**{head}** — {txt(it.get('d', ''))}\n")

        elif t == "numcards":
            for i, it in enumerate(b["items"], start=int(b.get("start", 1))):
                w(f"{i}. **{txt(it.get('t', ''))}** — {txt(it.get('d', ''))}")
            w("")

        elif t == "rules":
            w(f"### {txt(b.get('t', 'Standing rules'))}\n")
            if b.get("d"):
                w(f"{txt(b['d'])}\n")
            for i, it in enumerate(b["items"], start=int(b.get("start", 1))):
                w(f"{i}. **{txt(it.get('t', ''))}** — {txt(it.get('d', ''))}")
            w("")

        elif t == "rows":
            n = int(b.get("start", 1))
            for it in b["items"]:
                sid = f"  `{it['id']}`" if it.get("id") else ""
                w(f"**{n}. {txt(it.get('t', ''))}**{sid}\n")
                if it.get("d"):
                    w(f"{txt(it['d'])}\n")
                if it.get("expect"):
                    w(f"> Expected result: {txt(it['expect'])}\n")
                n += 1

        elif t == "panel":
            kind = b.get("kind", "brand").upper()
            w(f"> **[{kind}] {txt(b.get('t', ''))}**")
            for line in txt(b.get("text", "")).split("\n"):
                w(f"> {line}" if line else ">")
            w("")

        elif t == "code":
            label = " ".join(x for x in (b.get("label"), b.get("note")) if x)
            if label:
                w(f"*{txt(label)}*")
            w("```")
            w(b["text"])
            w("```\n")

        elif t == "table":
            w("| " + " | ".join(txt(h) or " " for h in b["headers"]) + " |")
            w("|" + "---|" * len(b["headers"]))
            for r in b["rows"]:
                w("| " + " | ".join(txt(c).replace("\n", " ") for c in r) + " |")
            w("")

        elif t == "checklist":
            for it in b["items"]:
                w(f"- [ ] {txt(it)}")
            w("")

        elif t == "figure":
            w(f"![{txt(b.get('caption', ''))}]({b['path']})")
            w(f"*{txt(b.get('caption', ''))}*\n")

        elif t == "band":
            w("\n---\n")
            if b.get("pill"):
                w(f"**{txt(b['pill'])}**\n")
            if b.get("quote"):
                w(f"> {txt(b['quote'])}\n")
            if b.get("aside_t"):
                w(f"**{txt(b['aside_t'])}** {txt(b.get('aside_d', ''))}")

    return "\n".join(out).replace("\n\n\n", "\n\n") + "\n"


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit("usage: python3 to_markdown.py content.json out.md")
    with open(sys.argv[1]) as f:
        doc = json.load(f)
    with open(sys.argv[2], "w") as f:
        f.write(render(doc))
    print(f"Wrote {sys.argv[2]}")
