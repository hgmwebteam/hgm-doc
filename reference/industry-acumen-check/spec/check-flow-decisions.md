---
title: Check, results page and flashcards — flow (Industry Acumen)
status: draft — Kyle's flow recorded 1 Oct 2026; open items below
owner: nicole, kyle
last_reviewed: 2026-10-01
sources: [Kyle, chat 2026-10-01; sessions_industry-acumen-plan.md "The check — design"; sessions_industry-acumen-decisions.md]
---

> **Read first.** This file records the flow Kyle described on 1 October for the check, the results page and the flashcards. It adds to "The check — design" in the plan and does not replace it. Where the two differ, this file wins for the results page and the flashcards. Items marked *Proposed* are Claude's suggestions and are not decided. When the open items are answered, fold the decisions into the decisions log and delete this banner.

# Check, results page and flashcards — flow

## The loop (Kyle, 1 Oct)

1. **Take the check.** It lives in the dictionary area of hgmportal.com, behind the same sign-in.
2. **Results page.** It thanks you for completing the check and shows your percentage and a letter grade, plus your missed terms as cards.
3. **Practise.** A button reading "Practise the terms you missed" opens the flashcard game with only those terms.
4. **Retake.** Retake the check, and keep going round. Each round, fewer words come back and the score goes up. The goal is fluency, not a single pass.

## 1. The check

Lives in the dictionary area of hgmportal.com (Kyle, 1 Oct). This closes the "check hosting" open item. Everything else follows "The check — design" in the plan: one mixed grade, open book, the item types, the word problem, and each item mapped to one term.

Team-facing name: "the check". *Proposed:* avoid "check-in quiz". "Check-in" is a hotel term in the dictionary, and "quiz" is the word the session 2 notes avoid.

## 2. Results page (Kyle, 1 Oct)

- **Heading:** thanks you for completing the check.
- **Score:** the percentage and a letter grade with + and −, for fun.
- **Missed terms:** every term you didn't get right (wrong or skipped), shown as cards in the same style as the dictionary. Click a card to open the rest of the entry in place. Card content is pulled from `ref_dictionary-v2-253.json` by slug, never retyped.
- **Buttons:**
  - **Practise the terms you missed** (main button) opens the flashcards with only these terms.
  - **Retake the check**. See open item 1 for what it serves.
- **Unchanged from the plan:** no tier labels, no item numbers, no "you got question 7 wrong".
- **If nothing was missed** — *proposed:* no practice button. Instead, a line pointing to the full dictionary deck.

### Letter grade — *proposed scale, not decided*

| Grade | % | Grade | % | Grade | % |
|---|---|---|---|---|---|
| A+ | 90–100 | B+ | 77–79 | C+ | 67–69 |
| A | 85–89 | B | 73–76 | C | 63–66 |
| A− | 80–84 | B− | 70–72 | C− | 60–62 |
| D+ | 57–59 | D | 53–56 | D− | 50–52 |
| F | 0–49 | | | | |

This is a common Canadian university-style scale, offered as a starting point. The pass mark is still with Gillian and Dustin, and the grade has to agree with it (see open item 3).

## 3. Flashcards (Kyle, 1 Oct)

- **Opening screen:** "Time to practise your words."
- **Toggle — Word first / Definition first.** It can be changed at any point in the deck.
  - Word first: the front shows the term, and you click to flip to the definition.
  - Definition first: the front shows the definition, and you click to flip to the term.
- **Order:** random. You go through until every card has been seen, then you can keep going if you want.
- **End of deck** — *proposed:* "You've been through all N." Then three buttons: Shuffle again, Retake the check on these terms, and Back to the dictionary.

### *Proposed* details, for Kyle and Nicole to accept or strike

- **Got it / Not yet** under each flipped card. "Not yet" puts the card back later in the deck. The deck counts as complete when every card is "Got it". This is the simplest way to make "until you've completed them all" mean something.
- **Back of formula terms:** the definition plus the formula, since the check asks you to calculate (ADR, RevPAR, NOI, effective commission, CPM…). Also a "See the full entry" link to the dictionary page.
- **Definition-first masking:** where a definition contains the term or one of its aliases, that word is blanked ("___") on the front. Otherwise the card gives away its own answer.
- **Acronyms:** the term side shows the expansion too, e.g. "ADR (average daily rate)".
- **Practise all terms:** the same game opened from the dictionary page with the whole check set (Tier A and B), for study before the first sitting.
- **Flip:** click, tap, or Space/Enter. Reduced motion means a fade instead of a flip.

## Decided — 1 October, second pass (Kyle)

These win over the proposals above.

- **No pass mark.** The score is a percentage plus a letter grade, for fun, never framed as a problem. The grade uses the Ontario provincial scale: A+ 90–100, A 85–89, A− 80–84, B+ 77–79, B 73–76, B− 70–72, C+ 67–69, C 63–66, C− 60–62, D+ 57–59, D 53–56, D− 50–52, R below 50 (scale as shown by Upper Grand DSB, ugdsb.ca). R gets friendly copy.
- **Both retakes offered:** the missed terms only, and the whole check.
- **Score over time (Claude's choice, Kyle asked for the best option):** each term's status is the person's most recent answer for it. The score is the weighted share of terms currently correct, with core worth 2 and reference worth 1, set in the bank file.
- **Progress saved to the person's portal sign-in** (Supabase, Google sign-in). Row-level security limits each person to their own rows. The roll-up is aggregate only. *Confirm with Gillian that per-person check history on the portal is fine — it was her and Dustin's named-or-anonymous call.*
- **Proposals accepted into the build prompt:** Got it / Not yet, formula on the back, definition-first masking, Practise all terms.
- **Build prompt** for Claude Code: `claude/claude-code-prompt_dictionary-check-and-flashcards.md`. The portal is a React + Vite app with Supabase at api.hgmportal.com. The dictionary page bundles `ref_dictionary-v2-253.json`, and slugs are long (`adr-average-daily-rate`).
- **Still to write here:** the real `check-bank.json` (90 terms, two variants each). The build uses a fixture bank until then.
- **Noticed on the live page (1 Oct):** /dictionary shows Tier A/B/C chips and filters, and the cheat-sheet card says "Tier A terms". The 19 Sep decision said the team never sees tier labels. The check, results and flashcards hide them regardless. Whether the dictionary page keeps them is Kyle's call.

## Decided — 1 October, third pass (Kyle)

- **One check, after both sessions,** covering all 90 tier A and B terms. It isn't split per session.
- **Every calculation includes numbers you don't need,** so knowing which figures matter is part of the question.
- **Bank v1.0 draft written:** `claude/check-bank.json`, built by `claude/build_check_bank.py`. Review copy: `claude/sessions_industry-acumen-check-bank-review.md`. 61 items, 120 points. Its flags list what needs Nicole, Kyle or Dustin before it replaces the fixture.

## Open items (from the first pass — 1–4 answered above)

| # | Item | Who |
|---|---|---|
| 1 | **What "retake" serves.** (a) Only the missed terms, with fresh variants, about a minute each time (the plan's design), or (b) the whole check every time, about 30 minutes or more at 90 terms. *Proposed:* (a) as the main retake and (b) as a secondary link. | Kyle, Nicole |
| 2 | **How the score rises across retakes.** If a retake covers only the missed terms, the percentage shown is the whole-check score so far: each term counts as right once you've got it right. *Proposed:* yes. | Kyle, Nicole |
| 3 | **Grade and pass mark together.** Does the letter grade sit alongside a pass/fail state or replace it? What scale? | Gillian, Dustin |
| 4 | **Where a person's progress is kept** between visits, so the missed list and score carry over. (a) In their own browser only: no per-person data leaves the device, but it's lost on another device or if they clear it. (b) Against their portal sign-in: this is per-person data, so it follows the named-or-anonymous decision and lives somewhere Gillian owns. | Kyle; Gillian, Dustin for (b) |
| 5 | Weighting at A 30 / B 60 and the completion deadline — already open in the decisions log. | Gillian, Dustin |
