# The check, results and flashcards

Three pages under the Industry Acumen Dictionary, behind the same team sign-in:

| Route                       | What it is                                                                                               |
| :-------------------------- | :------------------------------------------------------------------------------------------------------- |
| `/dictionary/check`         | The check. `?mode=full` (default) or `?mode=missed`.                                                     |
| `/dictionary/check/results` | The signed-in person's latest finished round: score, grade, and the terms to review as dictionary cards. |
| `/dictionary/practice`      | Flashcards. `?set=missed` (default) or `?set=all`.                                                       |

The loop: take the check → see the results → practise the missed terms → retake the missed terms
(or the whole check) → repeat. Each round, fewer terms come back and the score goes up.

The brief and the question bank are in `reference/industry-acumen-check/`, the record of what was
built. Start with its `README.md`.

## Decisions that shape it

- **It's for learning.** There is no pass mark. The score and letter grade (Ontario scale, R
  below 50) are for fun, and nothing on the pages may read as a problem. The words are "the
  check", never quiz, test or exam, and the pages never show tier labels, item numbers, or "you
  got question 7 wrong".
- **Nobody sees anyone else's results.** Each person sees only their own sittings and answers.
  A team roll-up (how many people finished, the weakest terms) was specified, then dropped
  (Kyle, 1 Oct 2026): any view across people turns a study aid into something people are
  measured by. Don't add one without asking.
- **What someone types never leaves their browser** (decision 1a). Supabase stores right or
  wrong per term, and the question and version shown, and nothing else. The typed answers live in
  `localStorage` while a round is open, so resuming on the same device restores everything. On
  another device, answered questions show as answered and can be answered again.
- **A missed-terms retake can only raise the score** (decision 2a). An item where only some terms
  were missed (2 of a matching item's 6 pairs, say) comes back whole, on its other version, but
  only the missed terms count. Taking pairs out would make the rest trivial.
- **Flashcards blank a little more than the bank's masking rule** (decision 3a). Under the rule,
  four definitions gave their own answer away (EBITDA, Flag, Keys/rooms/units, Booking.com
  Genius). Flag and Keys moved into the bank's `mask_extra` on 2 Oct; EBITDA's bracket and Genius
  stay in `FLASHCARD_MASK_EXTRA` in `check-model.ts`.

Revised 2 Oct 2026 (Kyle):

- **The copy.** The intro says once that every figure is illustrative and a calculator is
  welcome. It never says "open book" or "no pass mark" (the score is still for fun), and no
  question carries an "illustrative" line.
- **Matching and sorting are drag and drop**, not dropdowns: each definition is a card with one
  slot above it, every slot the same size so its width gives nothing away, and the terms wait
  jumbled in a tray (pinned to the bottom of the screen on a phone, on the right on a laptop).
  Drag a card, or tap it and then a slot, or Enter on it and a number key; Backspace sends it
  back. `src/pages/team/dictionary/drag-board.tsx` does this for the check and for Sort the stack.
- **Matching groups are themed**, with the theme in the prompt ("These are all about a
  property's brand."): brand, rates, rooms and how they're sold, demand and the calendar, measuring
  marketing. A definition that names its own term is blanked too, in both versions.
- **Eight reverse questions**: a term and four definitions to choose from, the first version of
  pace, denial, metasearch, incrementality, dynamic pricing, pre-arrival sequence, creative fatigue
  index and opportunity cost. The options are dictionary slugs (`format: "define"`), so no
  definition is retyped; the wrong ones are neighbouring terms' definitions of similar length.
- **"Not yet" sets a card aside for the next pass.** Every card you haven't seen this pass comes up
  before any you sent back. It used to put a card three places later, which cycled the same four
  cards for anyone who kept saying "Not yet".

**What can't be promised:** anyone with the Supabase dashboard can read the tables directly.
The dashboard's SQL editor bypasses row-level security. Rows carry a user id, never a name or
email, but an admin could look the id up. Say "only you can see it in the portal", not "nobody
can ever see it".

## Where the code is

Everything is in `src/pages/team/dictionary/check/` unless a path is given. The `*-model.ts` and
`check-score.ts` files have no React and no Supabase, and each has a `.check.ts` beside it.

| File                                              | What it holds                                                                                                                                                                                                                                  |
| :------------------------------------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check-model.ts`                                  | The bank's shape, `itemTerms` (the rule: one scored unit, one slug), `bankProblems` (the validator), masking, building a round (`buildPlan`), marking (`markEntry`), what to save (`rowsToSave`), finishing (`finishSitting`). **Start here.** |
| `check-score.ts`                                  | Weights, `applyResults` ("latest answer wins"), `scorePct`, `grade`, the "Up 9% since last time" line.                                                                                                                                         |
| `practice-model.ts`                               | The flashcard deck: passes, Got it, Not yet (set aside for the next pass).                                                                                                                                                                     |
| `check-bank-data.ts`                              | `loadCheckBank()`: the bank as a lazy chunk. Never import the JSON statically.                                                                                                                                                                 |
| `use-check-session.ts`                            | One hook that loads the bank, the dictionary, the session and the person's history, and says when it's ready.                                                                                                                                  |
| `check-chrome.tsx`                                | The page frame, the notice card, the "Continue with Google" card, loading and error states.                                                                                                                                                    |
| `check-screen.tsx`                                | The check: intro, resume, the round itself, saving, finishing.                                                                                                                                                                                 |
| `check-questions.tsx`                             | One screen's question and inputs, for all seven item types.                                                                                                                                                                                    |
| `check-results-screen.tsx`                        | The results page.                                                                                                                                                                                                                              |
| `practice-screen.tsx`                             | The flashcards.                                                                                                                                                                                                                                |
| `check-links.tsx`                                 | The buttons under the dictionary's heading.                                                                                                                                                                                                    |
| `src/lib/check-attempts.ts`                       | Every Supabase call the check makes.                                                                                                                                                                                                           |
| `src/data/check-bank.json`                        | The question bank: a byte-for-byte copy of `reference/industry-acumen-check/data/check-bank.json`.                                                                                                                                             |
| `src/pages/team/dictionary/dictionary-layout.tsx` | The Docs frame shared by `/dictionary` and these three pages.                                                                                                                                                                                  |
| `src/pages/team/dictionary/drag-board.tsx`        | Drag and drop for cards, slots and boxes (pointer drag, tap-then-tap, keyboard), shared with Sort the stack.                                                                                                                                   |
| `src/pages/team/dictionary/flashcards.tsx`        | The flashcard game (intro, the 3D card, Got it / Not yet, end screen), shared by the terms and tools decks.                                                                                                                                    |

The results page reuses the dictionary's own card (`dictionary-entry.tsx`) with `showTier={false}`
and the question's `explanation`. Matching items have no explanation, so their cards show the
dictionary entry only.

## Changing a question

1. In `reference/industry-acumen-check/tools/`, edit `build_check_bank.py` (never the JSON) and
   run `python3 build_check_bank.py`. Bump `version` while you're there.
2. Copy `reference/industry-acumen-check/data/check-bank.json` to `src/data/check-bank.json`.
3. Run the checks below. `check-bank.check.ts` fails if the two copies differ, or if the bank no
   longer fits the dictionary.

If a bank that doesn't fit the dictionary ever reaches the site, the check pauses itself ("The
check is being updated", with the list of problems under "What needs fixing"). The dictionary
keeps working.

**A new dictionary master** can break the bank too: a renamed slug, or a term moved between tiers.
Run `check-bank.check.ts` whenever `ref_dictionary-v2-253.json` changes.

## Running the checks

From the repo root:

```bash
for f in check-bank check-model check-score practice-model; do
  npx esbuild src/pages/team/dictionary/check/$f.check.ts --bundle --platform=node --format=cjs \
    --alias:@=./src --outfile=/tmp/hgm-check/$f.cjs --log-level=warning \
  && node /tmp/hgm-check/$f.cjs || break
done
```

`check-bank` prints the bank's totals and every matching call line as it will look with its term
blanked. Then it prints `PASS`, or the list of problems.

## Supabase

One migration: `supabase/migrations/20261001120000_dictionary_check.sql`. Its opening comment
explains every rule. In short:

- **`check_attempts`**: one row per round: mode, bank version, the plan (the questions and
  versions in order, so a resumed round looks the same on any device), and the score it left
  you with. You can read and start your own. You can finish your own while it's open, and only
  the four columns that finish it. You can delete your own while it's open ("Start again"). A
  unique index allows one open round per person.
- **`check_answers`**: one row per term per answer: question, version, right or wrong. Rows are
  only ever added. Changing an answer adds a newer row, and the newest wins. You can add rows
  only to your own open round.
- **`check_term_status`**: a view of your latest answer per term, from finished rounds only.
  It's `security_invoker`, so the row-level security above applies to it. Without that, the
  view would show everyone's rows.

The database fills in `user_id`, `answered_at` and `started_at`, and the browser can't send
them. Every policy also requires an `@hiddengem.media` session.

Two triggers do what a policy can't:

- `check_attempts_stamp_finish` sets `completed_at` to the database's clock, whatever the
  browser sent. Rounds are ordered by it, and two devices' clocks can disagree.
- `check_answers_open_only` share-locks the round before an answer is added. Without it, a
  save from a second tab at the same instant as Finish could land just after it.

The policies were tested before they shipped, against the migration file in real Postgres
(PGlite), with two users, a non-team Google account and anon. 37 cases passed, and a copy of
the migration without `security_invoker` correctly failed the "B can't see A's status" case.

## When something's wrong

- **"Sign in to keep your progress" for someone already in.** They came in with the team
  password, which gives the dictionary but no Supabase session. The check needs their Google
  sign-in, because results are saved to their own account. Flashcards for all terms work
  either way.
- **"Not saved yet · Try again".** A save to Supabase failed, usually the connection. What they
  typed is still in the browser, and the next save (or Try again) sends it. Finishing waits
  until everything is saved.
- **"You have a check in progress" when they asked for the other kind.** One round can be open
  at a time. They can resume it, or clear it and start the one they asked for.
- **The score looks wrong.** The status for each term is the latest answer to it in a finished
  round. To see a person's own status in the SQL editor:
  `select term_slug, correct, item_id, variant_id, answered_at from check_term_status where user_id = '…';`
  (as an admin you'll see everyone's rows unless you filter).
