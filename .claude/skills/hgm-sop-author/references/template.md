# HGM-SOP-Template.md — v2.1

Every HGM SOP contains these sections, in this order, numbered `01`–`10`. No section may be deleted; sections that don't apply are marked "Not applicable — [reason]."

`HGM-SOP-WEB-002` is the reference implementation of this template. Where the two ever disagree, the reference implementation is right and this file is stale — say so rather than splitting the difference.

**Changed in v2.0:** the procedure is now phases containing numbered tasks, not a flat list of steps. See section 05.

**Changed in v2.1:** the section list now matches `HGM-SOP-WEB-002`, the reference implementation. Purpose and scope are one section, and a final checklist is a standard optional section. Before this, the template said ten sections and the reference implementation had a different ten — a new SOP could satisfy one and fail the other.

---

## Document header

| Field | Value |
|---|---|
| SOP Title | Verb-first, specific: "Publish a client blog post in WordPress" |
| SOP ID | HGM-SOP-[DEPT]-### |
| Version | #.# |
| Owner | Role (Current person) |
| Effective date | YYYY-MM-DD |
| Next review date | YYYY-MM-DD (default: effective date + 6 months) |
| Frequency / trigger | e.g. "Every Monday by 10:00 a.m." or "When a new client signs" |
| Time to complete | e.g. "~25 minutes" |

## 01. Purpose and scope

Three cards: **Purpose** (the outcome this produces and why it matters), **In scope** (the clients, tools and situations covered), **Out of scope** (what this explicitly does not cover). Real card titles, not mono micro-labels.

Then, where the procedure has non-negotiables, the **standing rules** — a `rules` block of three to five numbered rules that hold on every single run, on the dark ground.

Finding them: if the same warning is about to appear in the lead, again as a panel here, and again in a later section, that is one standing rule being said three times weakly. Say it once, hard, and cut the repeats to pointers. More than five and none of them is standing.

## 02. Roles and responsibilities

| Role | Responsibility |
|---|---|
| e.g. Anyone taking a website change request | Performs tasks 1.1 to 6.3 |
| e.g. Approver (routed by what the change is) | Approves before it goes live |

## 03. Prerequisites

Everything needed before task 1.1: accounts, access permissions, tools, files, links, information. If access must be requested from someone, name the role and channel.

## 04. Definitions

Only if unavoidable jargon appears. One card per term, with a real title and the plain-language meaning beneath — the same card typography as Purpose and scope. If no jargon, write "Not applicable — no specialized terms used."

## 05. Procedure

Open with a **task picker**: one card per phase, naming the tasks it covers, so a reader lands on the part they need instead of reading from the top.

Then **phases containing numbered tasks**:

```
Phase 1 — Set up a machine        tasks 1.1, 1.2, 1.3 …
Phase 2 — Start a new request     tasks 2.1, 2.2
Phase 3 — Plan before building    tasks 3.1, 3.2
```

Rules:

- A `sub` block carrying `id: "1"`, `"2"` … opens each phase. Each task is a `step` block with `n`, `t`, `d`, `expect`, and a `body`.
- **One action, one screenshot, one task.** If a task needs five screenshots it is five tasks. This is what keeps a task card from splitting across a page.
- The screenshot lives **inside** the task card, in `body` — never floating after it.
- Imperative voice, one action per task: "Click **Publish**."
- Bold every exact UI label. Give exact paths and URLs.
- State the expected result wherever success is not visible: "You should now see a green **Synced** badge."
- Decision points branch explicitly: "If the post includes video → task 3.4. Otherwise → task 3.6."
- Insert `[SCREENSHOT n.m: what it should show, and what to circle]` wherever a visual prevents confusion.
- Alternate routes (a terminal command, a Claude prompt that does the whole phase in one go) sit at the end of the phase they replace, labelled as the alternative.

## 06. Exceptions and edge cases

Known deviations from the happy path and exactly what to do in each: "If the client is on the legacy hosting plan, skip tasks 2.2–2.4 and instead…"

## 07. Troubleshooting and escalation

| Symptom | Fix | If unresolved, contact |
|---|---|---|
| e.g. Export fails with error X | Do Y | Role (person) via Google Chat |

Every SOP names at least one escalation contact as role + person + channel.

## 08. Final checklist

A `checklist` block: everything that must be true before the point of no return — the merge, the publish, the send. One line per item, each independently verifiable.

Only for procedures that have a point of no return. Where there isn't one, write "Not applicable — no irreversible step."

## 09. Related documents

Other SOPs, templates, folders, or dashboards connected to this task, with their IDs or exact locations.

## 10. Revision history

| Date | Version | Author | Change summary |
|---|---|---|---|
| YYYY-MM-DD | 1.0 | Name | Initial release |

---

## Quality bar (applies to the whole document)

The finished SOP passes the **new-hire test**: a competent new hire completes the task using only this document, with zero questions. Any sentence a new hire could misread is rewritten. Any word like "regularly," "as needed," or "the usual folder" is replaced with a schedule, a condition, or a path.
