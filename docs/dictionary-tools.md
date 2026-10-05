# The tools: Sort the stack and its flashcards

Three pages next to the Industry Acumen Dictionary's check, all built from one card list:

| Route                        | Sign-in | What it is                                                                                               |
| :--------------------------- | :------ | :------------------------------------------------------------------------------------------------------- |
| `/dictionary/tools/review`   | Team    | "Review the tools": Sort the stack, the three-round drag-and-drop sort, in the dictionary's Docs frame.  |
| `/dictionary/tools/practice` | Team    | "Practise the tools": flashcards of the same vendors, on the check's shared deck.                        |
| `/acumen-sort`               | None    | The same game with no sign-in: the live training session's backup, in a plain frame with no team chrome. |

`?present` works on both game routes: large type, **Round 1 / 2 / 3** tabs and **Show answers**, full
width for screen sharing. On `/dictionary/tools/review?present` the Docs frame drops away but TeamGate
stays. The way in is the right-hand pair of buttons under the dictionary's heading
(`check/check-links.tsx`).

`/acumen-sort` and both `?present` pages use the plain frame (`StandaloneFrame`), which has its own
light/dark button beside the logo instead of the portal's floating one: floating over the page, that
one sat on top of the cards as the board scrolled under it and took their taps. Both routes are in
`main.tsx`'s `PAGES_WITHOUT_FLOATING_CHROME`, so it never draws, even for a frame. Like the floating
toggle, the button keeps the portal's own theme choice (`ui-theme`), and only when it's pressed.

The brief is `reference/industry-acumen-sort/PROMPT.md` (Part A, and "How it was built here" for
Kyle's decisions of 2 Oct 2026). The vendor check of the same day is
`reference/industry-acumen-sort/verification-2026-10-02.md`.

## Decisions that shape it

- **No card plays until it's checked.** While any card or suite in the card list says
  `"verify": true`, all three pages show "Some cards are still being checked" with the list of what's
  waiting (and each entry's `verify_what`), and `sort-model.check.ts` fails. This is the brief's "Refuse
  to build if any card in the data has verify: true". There is no bypass in the pages, on purpose.
- **Nothing is stored or sent.** The game and the deck live in component state; a refresh starts
  clean. The only request after the page itself is the card list's chunk. The flashcards' "Vendor
  first / Box first" choice lasts until you leave or reload the page (the terms deck remembers its
  side; this one doesn't). On the gated routes the Docs frame is shared chrome: its header search
  reads client lists from Supabase when someone focuses it, as on every Docs page. `/acumen-sort`
  and `?present` have no such chrome.
- **The wording is the card list's.** Titles, round titles, box names and job lines, notes, the
  intro, the finish line and the made-up line all come from the JSON. The few UI strings the code
  adds are listed at the end, so they can move into the card list.
- **An also counts as right**, with the line "also right: it's sold as more than one of these" and
  the card's own box. An also may name another round's box (RateGain, in round 2, is also sold as a
  channel manager): it can't fire in the game, but its flashcard shows it.
- **Phones first.** The tray is pinned to the bottom of the pane with the round's buttons, so the
  next card is always in reach while the boxes scroll. On a phone, or a window too short for a
  wrapping tray (a phone on its side), it's one row you swipe sideways, as in the check, so it
  covers a strip of the screen rather than half of it. It stays on the board, with its **Tray**
  button, until the round is checked, so picking up a placed card never changes its height under
  the finger. Each box shows three empty places, so it never grows (and moves the boxes below it)
  as cards go in.
- **Touch.** Round 3's jobs, and the cards in a wrapping tray, drag in any direction. In the
  one-row tray (phones, short windows) a sideways swipe scrolls the row and starts no drag; a card
  drags up out of it. A vendor card already in a box (rounds 1 and 2) lets a vertical swipe scroll
  the page (`touch-action: pan-y`), because a thumb scrolling past three full-width cards would
  otherwise keep dragging one off; a finger drags it by the grip at its right end. Tap, mouse and
  keyboard move any card from anywhere on it.
- **Focus is never hidden under the pinned bar.** A box's heading and the cards in it keep the bar's
  height clear below them (`scroll-margin-bottom`, from the bar's measured height), so Tab and a
  keyboard move scroll them out from under it.
- **After "Check my stack"** cards are locked until "Try again" (which reshuffles). Round 3's tray
  stays on the page, marked: a job the suite does left in the tray is wrong, a distractor left there
  is right. Every mark is an icon and a word, never colour alone.

## How it plays

The rules are `sort-model.ts`; the gestures are the shared `drag-board.tsx`.

- **Rounds 1 and 2** (`mode: "vendors"`): twelve vendor cards in a shuffled tray, four boxes that
  each take exactly `per_box` (three). A full box refuses a fourth card, visibly and aloud, and
  while a card from elsewhere is carried it doesn't show the "can go here" outline.
- **Round 3** (`mode: "jobs"`): one board per suite, in the list's order. The suite is the only box;
  the tray is its `does` mixed with its `distractors`. "Check my stack" wakes up once one job is in.
- **Placing a card**: tap it, then tap a box (or the tray's **Tray** button to send a placed card
  back); or drag it; or Tab to it, Enter, and the box's number key (Backspace sends it back, Escape
  puts it down). Every move is announced. The Tray button is how a screen reader on a phone, with
  no Backspace, takes a card back out; it's marked unavailable until a placed card is in hand.
- **Focus**: the round's heading takes focus on every new board (Next, Try again, Start over, and a
  round tab chosen from the keyboard or by touch; a mouse click leaves focus on the tab) and on Show
  answers; the tally ("10 of 12") takes it after Check my stack. The heading carries where the board
  is ("Round 3 of 3 · Suite 2 of 3", as its description) and, in round 3, the suite's name, since
  the three suites share one title.
- **Show answers** (`?present`): every card in its box with its note; in round 3, all the suites
  with their jobs and notes, and the finish line.

## Where the code is

Everything is in `src/pages/team/dictionary/tools/` unless a path is given.

| File                                       | What it holds                                                                                                                                                                                   |
| :----------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sort-model.ts`                            | The card list's shape, `sortProblems` (the validator, in plain sentences), `unverified` (the gate), the boards, moving and marking, the tally, the flashcards' cards. No React. **Start here.** |
| `sort-model.check.ts`                      | The brief's `check-cards.js`: the real list's shape, the rules on a verified copy, and the gate last.                                                                                           |
| `tools-data.ts`                            | `loadSortCards()` / `useSortCards()`: the card list as a lazy chunk. Never import the JSON statically.                                                                                          |
| `sort-stack.tsx`                           | The game (`SortStack`), the gate (`SortCardsGate`: loading, broken, waiting on verify) and the plain frame (`StandaloneFrame`).                                                                 |
| `tools-review-screen.tsx`                  | `/dictionary/tools/review`: TeamGate and the Docs frame, or TeamGate and the plain frame for `?present`.                                                                                        |
| `acumen-sort-screen.tsx`                   | `/acumen-sort`: the plain frame, no gate. `"acumen-sort"` is in `RESERVED_SLUGS` (`src/pages/templates/template-one-screen.tsx`).                                                               |
| `tools-practice-screen.tsx`                | `/dictionary/tools/practice`: the faces of each card, on `FlashcardDeck` (`../flashcards.tsx`).                                                                                                 |
| `../drag-board.tsx`                        | The shared drag and drop (also the check's matching and sorting questions).                                                                                                                     |
| `src/data/industry-acumen-sort-cards.json` | The card list. Its master is the Claude project file named in `source_of_copy`: edit there, then copy it in.                                                                                    |

## Changing the card list

1. Edit the master (see `source_of_copy`), then copy it over `src/data/industry-acumen-sort-cards.json`
   whole. Don't hand-edit the copy.
2. To clear a card for play: check its box and note against the vendor's own site, set `verify` to
   `false` (or remove it) and fill in `checked` (`YYYY-MM-DD`) and `sources`.
3. Run the check below. It must end in `sort-model: PASS`.

If a list that fails `sortProblems` ever reaches the site, the pages pause themselves ("The tools are
being updated", with the problems under "What needs fixing").

## Checks

```bash
# The card list and the rules. Fails, listing them, while any entry is still verify: true.
npx esbuild src/pages/team/dictionary/tools/sort-model.check.ts --bundle \
  --platform=node --format=cjs --alias:@=./src --outfile=/tmp/hgm-check/sort-model.cjs \
  --log-level=warning && node /tmp/hgm-check/sort-model.cjs

npx tsc -b
```

The rule tests work by role (the first card of the first box, the first suite) on a copy of the list
with verify switched off, so correcting cards doesn't break them. The script also prints, without
failing, Box first clues that still name part of a vendor (today: "Sabre" on Sabre SynXis, "Amadeus"
on Amadeus iHotelier).

## For the session

- QR codes: `reference/industry-acumen-sort/qr-acumen-sort.png` (https://hgmportal.com/acumen-sort, no
  sign-in, for the room) and `qr-acumen-sort-team.png` (https://hgmportal.com/dictionary/tools/review).
- Present from `/dictionary/tools/review?present` or `/acumen-sort?present`.

## UI strings the code adds

Everything else is the card list's, or the brief's own words ("Round 1 of 3", "3 of 3", "n jobs",
"Check my stack", "Try again", "Next", "Start over", "Show answers", "Round 1 / 2 / 3", the also line,
"10 of 12"), or Kyle's ("Review the tools", "Practise the tools", "Vendor first", "Box first", "Also:",
"Does:", "Back to the dictionary").

- On the board: "Suite 1 of 3"; "Right" and "Wrong"; "Box: …" (the right box on a card that isn't in
  it); "1 job" (the singular of "n jobs"); "PMS already has 3 cards. Move one out first."; "Tray"
  (the tray's button and name, and the label over round 3's marked tray).
- Read to a screen reader only: "Mews in PMS, 2 of 3.", "PMS in Cloudbeds.", "Mews back in the tray.",
  and round 3's heading with its suite, "One suite, many jobs: Cloudbeds" (the card list's title and
  suite name, joined by a colon). drag-board.tsx, shared with the check, adds its own: picked up, put
  down, stays where it is, went back where it was, and "Pick a card up first, then choose the box."
- The plain frame's theme button reuses the portal's own "Switch to light mode" / "Switch to dark
  mode".
- The pages' states: "Some cards are still being checked", its paragraph, and its list's lines
  ("DerbySoft · Round 1, The four systems"); "The tools are being updated" / "The card list has a
  problem, so these pages are paused until it's fixed." / "What needs fixing"; "The cards couldn't
  load" (with the check's reload line and button); "Loading…".
- The plain frame's logo, whose alt text is "HiddenGem Media".
- The flashcards: the title "Time to practise the tools."; the intro "25 cards, one for every vendor
  in Sort the stack."; the face labels "Vendor", "Box" and "Suite".
