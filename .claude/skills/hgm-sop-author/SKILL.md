---
name: hgm-sop-author
description: Write or revise a Hidden Gem Media (HGM) Standard Operating Procedure to the HGM template and house style. Use when someone wants to create, draft, revise, or clean up an SOP, standard operating procedure, process doc, or workflow document for HGM — starting from rough notes, a Fireflies meeting transcript, a Scribe walkthrough, an existing messy doc, or a verbal brain-dump. Produces the Markdown review copy with gaps flagged; pair with hgm-doc-render to produce the branded PDF.
---

> **In the hgm-doc repo:** read `sops/CLAUDE.md` first. The house style is in
> `sops/house-style/`; its v1.9 addendum overrides this skill and
> `references/template.md` where they disagree: seven sections, no Roles,
> Definitions or Troubleshooting sections. "Project knowledge" and `masters/`
> mean `reference/sop/masters/`: one file per SOP, named `<ID>_v#_#.json`. A
> revision writes the new version's file and deletes the old one in the same
> commit. Figures are in `reference/sop/figures/`. There is no approval step:
> ignore anything below about approval or `status: approved`; every merged
> version is published, and SOPs are public, so no screenshot may hold a secret.


# Authoring an HGM SOP

You produce SOPs for Hidden Gem Media, a digital marketing and web agency in Guelph, Ontario. SOP production is owned by the Web & Content Specialist. The approver is the Operations Manager.

## The quality bar

Every SOP must pass the **new-hire test**: a competent new hire completes the task using only this document, asking nobody a question. If any sentence could be misread by someone who has never done the task, rewrite it.

## Workflow

1. **Intake.** Accept any raw material — rough notes, a Fireflies transcript, a Scribe walkthrough, an existing messy doc, a verbal brain-dump. Do not ask for a particular format.

2. **Interview once.** If the material leaves gaps, ask **one batched round** of questions covering: trigger and frequency; tools and access required; the exact steps; decision points; known failure modes; escalation contact; time to complete. Never drip-feed follow-ups across many turns.

3. **Draft as Markdown** against the template in `references/template.md`. This is the review copy.

4. **Flag every gap** as `[NEEDS INPUT: what is missing]`. Never invent a tool name, menu label, file path, URL, or person's name. A visible gap is correct. A plausible fabrication is a serious failure — it is the one thing that makes an SOP actively dangerous, because a new hire will follow it.

5. **Mark every screenshot** as `[SCREENSHOT n.m: what it should show, and what to circle]` wherever a visual prevents confusion. The user captures these; never generate them. Say what the click target is — the annotation ring needs it.

6. **On approval,** run the quality gate below, then hand off for rendering.

## Structure: phases and numbered tasks

A procedure is **phases containing numbered tasks**, not a flat list of steps:

```
Phase 1 — Set up a machine        1.1, 1.2, 1.3 …
Phase 2 — Start a new request     2.1, 2.2
Phase 3 — Plan before building    3.1, 3.2
```

Three rules make the result readable:

- **One action, one screenshot, one task.** If a task needs five screenshots it is five
  tasks. This is what keeps a card from splitting across a page, and it is how Scribe
  and the HGM owner guides lay a walkthrough out.
- **The screenshot belongs to the task, inside its card** — never floating after it.
- **Alternate routes live inside the task they belong to.** A terminal command and a
  Claude prompt that do the same job as tasks 1.2–1.7 sit at the end of that phase,
  labelled as the one-go alternative.

Open the procedure with a **task picker** — a card per phase, saying which task numbers
it covers — so a reader lands on the part they need instead of reading from the top.
Each entry is `{badge, label, hint, proc}`; the renderer adds a "Read the steps →" call
to action. `badge` is the phase number, `hint` is the task range plus when to use it.

## Sections

Ten, numbered `01`–`10`, exactly as `references/template.md` lists them. Purpose and
scope are **one** section. `08. Final checklist` is for a procedure with a point of no
return — a merge, a publish, a credential rotation — and is marked
"Not applicable — no irreversible step" where there isn't one.

`HGM-SOP-WEB-002` is the reference implementation. If it and the template ever disagree,
the reference implementation is right and the template is stale — say so rather than
splitting the difference.

## Callouts carry meaning, not mood

Every aside is one of five kinds, and the kind is a decision about what the reader is
supposed to do with it:

| `kind` | means |
|---|---|
| `brand` | the rule to carry out of this document |   <!-- violet, HGM gem -->
| `note` | context — why the step is the way it is; nothing to do |
| `warning` | you can get this wrong; slow down |
| `critical` | breaks the live site, costs money, or cannot be undone |
| `success` | the recommended default; what good looks like |

Two `warning` panels in a row usually means one of them is a `note`. If a `critical`
would not actually break anything, it is a `warning`. Getting this right is what stops a
document reading as a pile of coloured boxes.

Content cards take a real title, not a mono micro-label — a definition, a scope
statement and an edge case all look the same as a result, which is the point.

## The standing rules

Before writing 01, ask: what three-to-five things are true on *every* run of this
procedure? Those go in a `rules` block on the dark ground at the end of 01 — numbered,
one line of title, two of explanation.

The test that you have found them: if the same warning is about to appear in the lead,
again as a panel in 01, and again in 02, it is a standing rule being said three times
weakly. Say it once, hard, in the rules block, and cut the repeats to pointers.

## Metadata rules

- **SOP ID** — `HGM-SOP-[DEPT]-###`. DEPT is one of `WEB`, `CON` (content), `OPS`, `FIN`, `SEC`, `CLI` (client-facing). Ask which department if unclear. Number sequentially within the department.
- **Version** — `1.0` for new. `+0.1` for wording and clarity fixes. Bump the whole number when the process itself changes.
- **Effective date** — the date of approval. **Next review date** — six months out unless told otherwise.
- **Owner** — the role responsible for keeping it current, with the current person in parentheses.
- **Filename** — `HGM-SOP-[DEPT]-###_short-title_v#.#`.

## Writing rules

- Imperative voice, one action per step: "Click **Export** in the top-right." Never passive.
- After any step whose success is not visible on screen, state the expected result: "You should now see…"
- Bold exact UI labels. Give exact file paths, exact URLs, exact role names.
- **Ban vague words.** Replace "regularly", "as needed", "the usual place", "recently" with a specific schedule, condition, or path — or flag with `[NEEDS INPUT]`.
- Define agency or tool jargon in Definitions the first time it appears.
- Branch decision points explicitly: "If X → go to step 12. If Y → go to step 15."
- As short as completeness allows. No warm-up prose, no filler.

## Voice

Plain, direct, second person. Confident, never hype. Sentence case for all headings — never Title Case. No exclamation marks. No emoji. Verb-first for anything actionable.

Open with a single framing line ("If you remember one thing…") and close on a quote. Both approved reference SOPs do this.

## Structure for rendering

Write so the content maps onto the HGM block vocabulary rather than running prose:
`section`, `sub`, `lead`, `para`, `cards`, `numcards`, `panel`, `table`, `figure`,
`code`, `checklist`, `step`, `band`.

**Procedure tasks are `step` blocks**, each carrying its own figures and code blocks in
`body`, with `expect` filled wherever the result is not visible on screen. A `sub` block
carrying `id: "1"`, `"2"` … opens each phase. `rows` is the older flat-list form — use it
only for a document that genuinely has no phases. Every document ends with a `band`.

## Revising an existing SOP

Read the content JSON from `masters/` in project knowledge (`masters_HGM-SOP-<DEPT>-###_v#_#.json`). Do not ask for it and do not rebuild from the Markdown or PDF — the JSON is the only file the other three outputs can be regenerated from. Edit the blocks, increment the version per the rules above, add a revision history row (date, version, author, one-line change summary), strip any id that `sop_schema.py stamp` puts on an aside heading, rerun the quality gate, then deliver a fresh set of all four files and store the new master. Only if no master exists may the Markdown be used as the source, and say so in the revision row.

**Plain word first, term in parentheses, term in Definitions.** Task titles and instructions lead with the everyday word ("the live site", "your own private copy of the site") and give the technical term once, in parentheses, the first time it appears — then it earns a card in Definitions. Commands, prompts and UI labels stay exact; never soften those. The reader who only needs to finish never has to open the second layer; the reader who wants to learn can.

## Quality gate

Run this before handing anything off, and say that you ran it.

1. Every template section present, or marked "Not applicable — [reason]".
2. Zero `[NEEDS INPUT]` flags remain.
3. Every procedure step is imperative, single-action, and verifiable.
4. No vague time, place, or frequency words survive.
5. Escalation names a specific role, person, and channel.
6. All header metadata filled, including next review date.
7. Revision history present.

If any item fails, fix it before delivering. Do not hand off a document that fails the gate, even if asked to hurry.

## Handoff

This skill produces the Markdown master. To produce the branded PDF, use the `hgm-doc-render` skill — build a JSON content file against the block schema and run the renderer. Never write layout code, reportlab, or per-document CSS by hand.

Deliver the Markdown source alongside any PDF. Never a PDF alone.
