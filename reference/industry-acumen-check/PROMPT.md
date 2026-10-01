# Prompt — paste this into Claude Code with the hgmportal repo open

---

You're adding three connected features to the HGM portal's dictionary area (`/dictionary`): **the check** (a self-check on the industry terms), **a results page**, and **a flashcard game**. Everything you need is in `reference/industry-acumen-check/`. Read `reference/industry-acumen-check/README.md` first.

I'm Kyle. I'm self-taught, and I want to understand this well enough to debug it myself. Explain your decisions as you go: why a component lives where it does, how the data flows, and what each database table and policy is for.

## Before you write any code

1. Read these files in `reference/industry-acumen-check/`:
   - `data/check-bank.json`: the real question bank (61 items, 90 terms, 120 points). It's the content and the source of truth. Don't edit the questions. If one looks wrong, tell me.
   - `spec/check-flow-decisions.md`: the flow and the decisions behind it.
   - `spec/check-bank-review.md`: a human-readable copy of the bank, useful for checking your rendering against.
2. Read the repo and tell me what you find:
   - the `/dictionary` page and its term card component (the card that expands to show the formula, worked example, owner line, "On a call" and related terms);
   - how it loads `ref_dictionary-v2-253.json` (currently bundled as an asset);
   - routing;
   - the Supabase client (`api.hgmportal.com`) and the auth/session hook (Google sign-in);
   - how existing pages handle styling, dark mode (`ui-theme`) and phone width.
3. Validate the bank against the repo's dictionary (see "Bank validator" below) and show me the output.
4. Propose a short plan: the files you'll add or change, routes, tables, and the order you'll build in. **Wait for my OK before building.**
5. Work on a new branch. Don't deploy to production. I'll review and merge.

## The flow

1. **Take the check:** one check covering all 90 terms, run after both training sessions.
2. **Results page:** percentage, letter grade, and the missed terms shown as cards.
3. **Practise:** "Practise the terms you missed" opens the flashcards.
4. **Retake:** just the missed terms, or the whole check. Then repeat.

Each round, fewer words should come back and the score should go up. **There's no pass mark.** The score is just for fun and must never read as a problem.

## Wording rules (all three screens)

- Call it **"the check"**. Never "quiz", "test" or "exam".
- Sentence case, warm and plain, no exclamation marks.
- **Never show tier labels (A/B/C)**, item numbers, or "you got question 7 wrong".

## Routes and entry points

- `/dictionary/check`: the check. Query `?mode=full` (default) or `?mode=missed`.
- `/dictionary/check/results`: the results page for the signed-in user's latest attempt.
- `/dictionary/practice`: flashcards. Query `?set=missed` (default from results) or `?set=all`.
- On `/dictionary`, add **Take the check** and **Practise the terms** near the top. Once the person has an attempt on record, show "Retake the check" and a line like "12 terms to review".

## Data

### Dictionary (already in the repo; reuse it, never copy it)

`ref_dictionary-v2-253.json` is an array of 253 entries with: `slug, term, tier, section, origin, gloss, formula, source, usage, aliases, owner, example, related, core`. `gloss` is the definition and `usage` is the "on a call" line. `slug` is the permanent ID, and the page already uses slugs as anchors (e.g. `#adr-average-daily-rate`). Read every definition and call line shown in the check, results or flashcards from this file by slug.

### Check bank (`reference/industry-acumen-check/data/check-bank.json`)

Move or copy it to wherever the repo keeps data (next to the dictionary JSON is fine) and import it from there. The structure:

- Top level: `version`, `weights` (`{"A": 2, "B": 1}`), `masking_rule`, `items`.
- Each item has an `id`, a `type`, and at least two `variants`. A sitting shows one variant per item. A retake prefers a variant the person didn't see most recently.
- **The rule that makes everything work:** every *scored unit* maps to exactly one term slug. The term's tier comes from the dictionary, not the bank.

| `type` | Where the term(s) are | Variant fields | Scoring |
|---|---|---|---|
| `wordproblem` | each `blanks[].term` | `prompt`, `table`, `blanks[]` (`label`, `answer`, `unit`, `tolerance`, `explanation`) | each blank on its own |
| `numeric` | item `term` | `prompt`, `table`, `answer`, `unit`, `tolerance`, `explanation` | one unit |
| `mcq`, `scenario` | item `term` | `prompt`, `options` (4), `answer` (**the option text**, not an index), `explanation` | one unit; shuffle options |
| `buckets` | each `chips[].term` | `prompt`, `boxes`, `chips[]` (`text`, `term`, `box`), `explanation` | each chip on its own |
| `matching` | item `terms` (up to 6) | `prompt`, `match_on`: `gloss` or `usage` | each pair on its own |
| `ordering` | item `term` | `prompt`, `steps` (**in the correct order**), `explanation` | all-or-nothing; shuffle for display |
| `truefalse` | item `term` | `statement`, `answer` (bool), `explanation` | one unit |

- **Tables.** If a table's first row starts with an empty cell, it's a header row (e.g. "This year / Last year"). Tables deliberately include rows you don't need, which is part of the question. Show every row.
- **Numeric input.** Accept commas, `$` and `%`. Mark correct if within ± `tolerance` of `answer`.
- **Matching v2 (`usage`).** Blank the term out of each call line using the top-level `masking_rule` plus the item's `mask_extra` words for that slug.
- **Word problem retakes.** A missed blank is served alone, as a standalone numeric question using the *other* variant's table and that blank.
- **Explanations** show on the results page (inside the card for that term), never during the check.

### Bank validator

Add a script (and a test) that fails if:

- any `term` / `terms` / `blanks[].term` / `chips[].term` slug isn't in the dictionary;
- any tier A or B term is missing, or appears in more than one scored unit (expect exactly 30 A and 60 B, total 120 points);
- a tier A term sits in a `matching` or `truefalse` item;
- an item has fewer than two variants;
- an mcq `answer` isn't one of its `options`, or a chip's `box` isn't in `boxes`.

## The check

- One continuous run. Items in random order with no sections. Put the word problems after the first few items, never first or last.
- A line at the top: "Open book: the dictionary and cheat sheet are allowed, and a calculator is welcome. Every figure is illustrative."
- Progress shown as "14 of 61". The person can go back and change an answer before submitting. Unanswered counts as missed.
- **Save progress after every answer** so someone can leave and finish later. A first sitting may run 45 minutes or more.
- No feedback during the check.
- `mode=missed` serves only items for terms the person currently has wrong.

## Scoring

- Each person has a **current status per term**: correct or not, taken from their **most recent answer** for that term.
- A full check updates every term. A missed-terms retake updates only the terms it served.
- **Score = sum of weights of terms currently correct ÷ total weight × 100**, rounded to the nearest whole number. Read the weights from the bank.
- Letter grade from the rounded percentage, using the Ontario provincial scale:

| % | Grade | % | Grade | % | Grade |
|---|---|---|---|---|---|
| 90–100 | A+ | 77–79 | B+ | 67–69 | C+ |
| 85–89 | A | 73–76 | B | 63–66 | C |
| 80–84 | A− | 70–72 | B− | 60–62 | C− |
| 57–59 | D+ | 53–56 | D | 50–52 | D− |
| below 50 | R | | | | |

- Write the scorer and the grade function as plain functions with **unit tests**: boundaries (49, 50, 69, 70, 79, 80, 89, 90, 100), rounding (79.5 → 80 → A−), a missed-only retake raising the score, and a full retake lowering a term that was previously right.

## Results page

1. **Heading:** "Thanks for completing the check."
2. **Score:** the percentage and letter grade, large. If there's a previous attempt, add one quiet line, e.g. "Up 9% since last time · 7 fewer terms to review". Never say "fail". For R: "These words take a few rounds. Practise the ones below and try again."
3. **Terms to review:** every term currently not correct, as cards that **reuse the dictionary's term card component**, collapsed by default. Clicking one expands it in place exactly like on `/dictionary`, plus the question's explanation. "Copy link" goes to `/dictionary#<slug>`. No tier chip.
4. **Buttons:**
   - **Practise the terms you missed** (main) → `/dictionary/practice?set=missed`
   - **Retake the terms you missed** → `/dictionary/check?mode=missed`
   - **Retake the whole check** → `/dictionary/check?mode=full`
   - **Back to the dictionary**
5. **Nothing missed:** say so plainly. Hide the missed-term buttons and offer "Practise all the terms".

## Flashcards

- **Intro screen:** "Time to practise your words." Show the card count, the toggle and a Start button.
- **Toggle: Word first / Definition first.** It can be changed at any time, even mid-deck. Remember the choice in localStorage, wrapped in try/catch.
  - **Word first:** the front shows the term (with its expansion, e.g. "ADR (average daily rate)"). The back shows `gloss`, plus `formula` if there is one, and a "See the full entry" link.
  - **Definition first:** the front shows `gloss` with the term and its aliases blanked to "___" (same masking rule). The back shows the term.
- **Flip:** click or tap, or press Space or Enter. Use a 3D flip, or a fade under `prefers-reduced-motion`.
- **Under the flipped card:** **Got it** and **Not yet**. "Not yet" puts the card back a few places later in the deck. Show progress as "8 of 12 got".
- **Shuffled order.** End screen: "You've been through all 12." Then **Shuffle and keep going**, **Retake the terms you missed**, and **Back to the dictionary**.
- `set=missed` uses the current missed terms. `set=all` uses every tier A and B term. No database writes.

## Supabase (signed-in users only)

Give me SQL migration files in the repo's `supabase/` folder. I'll apply them myself, so explain each one.

- `check_attempts`: `id, user_id (auth.uid), mode ('full'|'missed'), bank_version, started_at, completed_at, score_pct, grade`.
- `check_answers`: `id, attempt_id, user_id, item_id, variant_id, term_slug, correct (bool), answered_at`. Also save in-progress answers here, so resume works.
- A view or function for each user's **current status per term** (latest answer per `term_slug`).
- **Row-level security:** a user can insert and read **only their own rows**.
- `check_rollup()`: **aggregates only**. The number of people who've completed a full check, and the ten weakest terms by % currently correct. No names, emails or per-person scores. Restrict who can call it to admins, or tell me the options if the portal has no admin role.
- Store nothing else: no answer text beyond correct/incorrect, no analytics, nothing sent to third parties.

## Look and feel

Match the existing portal exactly: fonts, spacing, card styles, light and dark themes, and the left Docs nav (keep "Dictionary" highlighted on all three routes). It must work at phone width and be fully keyboard-usable, including ordering, buckets and matching. Never show right and wrong by colour alone: use an icon and a word.

## When you're done

- Run the tests and the bank validator, and show me the output.
- Give me a manual test script: sign in, start the check, leave halfway and resume, get some wrong, open results, expand a card, practise, retake missed terms and see the score rise, retake the whole check, then switch to dark mode and phone width.
- List anything you weren't sure about and the choices you made.
- Put the SQL migrations in the repo's existing `supabase/` folder, following its conventions. Leave `reference/industry-acumen-check/` where it is: it stays as the record of what was built.
