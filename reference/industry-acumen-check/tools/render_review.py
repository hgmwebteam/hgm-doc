"""Renders check-bank.json as a readable review copy for Nicole and Kyle. Never edit the .md by hand."""
import json
def fm(a, u):
    if u == "$":
        return f"${a:,.2f}".replace(".00", "")
    return f"{a:g}{u}"
b = json.load(open("../data/check-bank.json"))
TYPE = {"wordproblem": "Word problem", "numeric": "Calculation (type the number)", "buckets": "Sort into boxes",
        "scenario": "Scenario", "mcq": "Multiple choice", "ordering": "Put in order", "matching": "Matching",
        "truefalse": "True or false"}
out = ["---", "title: Check question bank — review copy (Industry Acumen)", "status: draft for Nicole and Kyle's read",
       "source: generated from data/check-bank.json by tools/render_review.py — edit the builder, never this file", "---", "",
       "# The check — question bank, review copy", "",
       "> **Read first.** One check after both sessions (Kyle, 1 Oct). 90 terms: 30 core at 2 points, 60 reference at 1, total 120. "
       "Every calculation includes numbers you don't need (Kyle, 1 Oct). Each question has two versions; the second is what a retake serves. "
       "Answers marked **→**. Matching items pull their definitions and call lines from the dictionary by slug, so they're listed by term only.", ""]
n = 0
for it in b["items"]:
    n += 1
    out.append(f"## {n}. {TYPE[it['type']]} · `{it['id']}`")
    if it["type"] == "matching":
        out.append(f"Terms: {', '.join(it['terms'])}. Version 1 matches to definitions; version 2 to call lines with the term blanked.")
        out.append("")
        continue
    for v in it["variants"]:
        out.append(f"**{v['id'][-2:].upper()}**")
        if "prompt" in v: out.append(f"{v['prompt']}")
        if "statement" in v: out.append(f"*\"{v['statement']}\"* → **{'True' if v['answer'] else 'False'}**")
        if "table" in v:
            rows = v["table"]
            if len(rows[0]) == 3 and rows[0][0] == "":
                out += ["", "| | This year | Last year |", "|---|---|---|"] + [f"| {r[0]} | {r[1]} | {r[2]} |" for r in rows[1:]]
            else:
                out += ["", "| | |", "|---|---|"] + [f"| {r[0]} | {r[1]} |" for r in rows]
            out.append("")
        if "blanks" in v:
            for x in v["blanks"]:
                a = fm(x["answer"], x["unit"])
                out.append(f"- {x['label']} → **{a}** · {x['explanation']}")
        elif it["type"] == "numeric":
            a = fm(v["answer"], v["unit"])
            out.append(f"→ **{a}** · {v['explanation']}")
        elif "options" in v:
            out.append("Options: " + " · ".join(f"**{o}**" if o == v["answer"] else o for o in v["options"]))
            out.append(f"→ {v['explanation']}")
        elif "chips" in v:
            out += [f"- {c['text']} → **{c['box']}**" for c in v["chips"]]
            out.append(f"→ {v['explanation']}")
        elif "steps" in v:
            out.append("Order: " + " → ".join(v["steps"]))
            out.append(f"→ {v['explanation']}")
        elif "statement" in v:
            out.append(f"→ {v['explanation']}")
        out.append("")
out += ["## Flags before this replaces the fixture", "",
"- **Length.** 61 screens. My estimate, not a measurement, is 45–55 minutes for a first sitting. Time Nicole on five items to settle it. Proposed: the page saves progress so people can finish in two sittings.",
"- **Effective OTB (item `effective-otb`).** Both versions mix non-refundable and refundable bookings, which is the dictionary's \"common confusion\" but harder than session 1's all-refundable example. [CONFIRM, Nicole and Kyle: keep it this hard.]",
"- **Midweek (item `midweek-gap`).** It's a reference term, but \"midweek\" is out of session copy until the boundary with Dustin's training is agreed. The call lines for rate fence and date classes also say \"midweek\". [NEEDS INPUT, Dustin: the boundary; otherwise drop the item and the term's point.]",
"- **Time-sensitive facts.** The Airbnb fee, Genius and Mr & Mrs Smith statements come from the dictionary's sources, checked 29 Sep 2026. Re-check them if the check runs past November.",
"- **Who you're talking to.** Both versions lean on the dictionary entry whose scorecard detail is marked for Nicole to confirm. [CONFIRM, Nicole.]",
"- **No property names.** Every scenario uses an unnamed lodge or resort, so there's nothing to check against client contacts.", ""]
open("../spec/check-bank-review.md", "w").write("\n".join(out))
print(n, "items rendered")
