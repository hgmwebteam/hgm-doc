"""Renders check-bank.json as a readable review copy for Nicole and Kyle. Never edit the .md by hand."""
import json
def fm(a, u):
    if u == "$":
        return f"${a:,.2f}".replace(".00", "")
    return f"{a:g}{u}"
b = json.load(open("../data/check-bank.json"))
# The reverse questions' options are dictionary slugs. In the portal repo the dictionary sits three
# levels up, so the review copy can print the definitions players actually see; elsewhere, slugs.
try:
    ENTRY = {e["slug"]: e for e in json.load(open("../../../src/data/ref_dictionary-v2-253.json"))}
except OSError:
    ENTRY = {}
GLOSS = {k: e["gloss"] for k, e in ENTRY.items()}
TYPE = {"wordproblem": "Word problem", "numeric": "Calculation (type the number)", "buckets": "Sort into boxes",
        "scenario": "Scenario", "mcq": "Multiple choice", "ordering": "Put in order", "matching": "Matching",
        "truefalse": "True or false"}
out = ["---", "title: Check question bank — review copy (Industry Acumen)", "status: draft for Nicole and Kyle's read",
       "source: generated from data/check-bank.json by tools/render_review.py — edit the builder, never this file", "---", "",
       "# The check — question bank, review copy", "",
       "> **Read first.** One check after both sessions (Kyle, 1 Oct). 90 terms: 30 core at 2 points, 60 reference at 1, total 120. "
       "Every calculation includes numbers you don't need (Kyle, 1 Oct). Each question has two versions, and eight have a third, shown first: "
       "a reverse question (a term, and four of the dictionary's definitions to choose from; Kyle, 2 Oct). A retake serves the version not seen last time. "
       "Answers marked **→**. Matching items are grouped by theme (Kyle, 2 Oct) and pull their definitions and call lines from the dictionary by slug, "
       "so they're listed by term only.", ""]
n = 0
for it in b["items"]:
    n += 1
    out.append(f"## {n}. {TYPE[it['type']]} · `{it['id']}`")
    if it["type"] == "matching":
        theme = it["variants"][0]["prompt"].split(". ")[0]
        out.append(f"{theme}. Version 1 matches to definitions; version 2 to call lines. The term is blanked in both (the page shows exactly which words).")
        for t in it["terms"]:
            e = ENTRY.get(t)
            if e:
                out.append(f"- **{e['term']}** — {e['gloss']} / *\"{e.get('usage') or ''}\"*")
            else:
                out.append(f"- `{t}`")
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
        elif v.get("format") == "define":
            out.append(f"Term shown: **{it['term']}**. Options (each slug's definition from the dictionary):")
            for o in v["options"]:
                text = GLOSS.get(o, "")
                out.append(f"- {'**→** ' if o == v['answer'] else ''}`{o}`{': ' + text if text else ''}")
            out.append(f"→ {v['explanation']}")
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
"- **Who you're talking to.** Now a card in the matching item about who owns and runs a property; its definition's scorecard detail is still marked for Nicole to confirm. [CONFIRM, Nicole.]",
"- **No property names.** Every scenario uses an unnamed lodge or resort, so there's nothing to check against client contacts.",
"- **Reverse questions (new, 2 Oct).** Eight items now open with a term and four definitions: pace, denial, metasearch, incrementality, dynamic pricing, rate shopping, pre-arrival sequence, opportunity cost. The wrong options are neighbouring terms' definitions, close in topic and length; where a scored term's definition would cue another question in the same sitting, the wrong option is an unscored tier C term instead. [CONFIRM, Nicole: the distractors and explanations.]",
"- **Denial and regret (for the dictionary master).** Regret's definition ends \"usually on price or restriction\", while the denial entry treats demand blocked by a restriction as a denial. The Denial reverse question shows both definitions side by side, so settle the wording in the master.",
"- **Matching regrouped by theme (2 Oct).** Five items: who owns and runs a property, rates and fees, rooms and how they're sold, demand and the calendar, measuring marketing. Flag stays a true/false item, and Keys, rooms and units has a new one: both read too close to a neighbour (or to themselves) in matching. Definitions are blanked like call lines.",
"- **No \"illustrative\" line on questions (2 Oct).** The check's intro says it once.", ""]
open("../spec/check-bank-review.md", "w").write("\n".join(out))
print(n, "items rendered")
