# The tools: the tools check (Sort the stack) and the tools training

Four pages next to the Industry Acumen Dictionary's check. The game is built from Sort the stack's
card list; the training from the vendor icons' manifest, worded with the card list's boxes:

| Route                              | Sign-in | What it is                                                                                                                                                       |
| :--------------------------------- | :------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/dictionary/tools/review`         | Team    | The tools check: Sort the stack, the three-round drag-and-drop sort, in the dictionary's Docs frame. A finished run is kept in this browser.                     |
| `/dictionary/tools/review/results` | Team    | The tools check's results: this browser's latest run, its score and grade, the tools to refresh on, and "Reset your tools results".                              |
| `/dictionary/tools/practice`       | Team    | "Practise the tools": the tools training, flashcards of the vendors on the session 2 tools slides (43; Google is left out). `?set=missed`: the tools to refresh. |
| `/acumen-sort`                     | None    | The same game with no sign-in: the live training session's backup, in a plain frame with no team chrome. It keeps nothing.                                       |

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
`reference/industry-acumen-sort/verification-2026-10-02.md`. The icons' handoff record is
`reference/industry-acumen-sort/vendor-icons.md`.

## Decisions that shape it

- **No card plays until it's checked.** While any card or suite in the card list says
  `"verify": true`, both game routes show "Some cards are still being checked" with the list of what's
  waiting (and each entry's `verify_what`), and `sort-model.check.ts` fails. This is the brief's "Refuse
  to build if any card in the data has verify: true". There is no bypass in the pages, on purpose. The
  training doesn't wait (Kyle, 5 Oct 2026): it's built from the manifest, not the unchecked cards.
  Since card list 2.1 (6 Oct 2026) nothing is waiting and the game plays (see "The card list since 2.1").
- **Nothing is sent.** The game and the deck live in component state; a refresh starts clean. The
  one thing kept is the tools check's record, in this browser only (`localStorage`, key
  `hgm_tools_check`; Kyle, 6 Oct 2026), so slide 44's "Nothing leaves your device" stays true and
  team-password visitors can use it too. `/acumen-sort` and `?present` keep nothing. After the page
  itself the only requests are two lazy chunks (the card list and the icon manifest) and the icons,
  which are static files on this site. On the gated routes the Docs frame is
  shared chrome: its header search reads client lists from Supabase when someone focuses it, as on
  every Docs page. `/acumen-sort` and `?present` have no such chrome.
- **The wording is the card list's.** Titles, round titles, box names and job lines, notes, the
  intro, the finish line and the made-up line all come from the JSON; the training's vendor names and
  products come from the manifest. The few UI strings the code adds are listed at the end, so they can
  move into the data.
- **An also counts as right**, with the line "also right: it's sold as more than one of these" and
  the card's own box. An also may name another round's box (RateGain, in round 2, is also sold as a
  channel manager); it can't fire in the game.
- **Phones first.** The tray is pinned to the bottom of the pane with the round's buttons, so the
  next card is always in reach while the boxes scroll. On a phone, or a window too short for a
  wrapping tray (a phone on its side), it's one row you swipe sideways, as in the check, so it
  covers a strip of the screen rather than half of it. It stays on the board, with its **Tray**
  button, until the round is checked, so picking up a placed card never changes its height under
  the finger. Each box shows three empty places the height of a vendor card (52 px), so it never
  grows (and moves the boxes below it) as cards go in. That needs every placed name on one line
  beside its icon and grip, so the boxes go into columns only where the narrowest box still has room
  for the longest name in today's list, "Canary Technologies": two columns from a 608 px board. In
  `?present` it's two from 672 px and four from 1152 px, because a presenter has to see all four boxes:
  from 1152 to 1440 px a long name may take two lines once placed and grow its row a little. A longer
  name needs those widths moved (`ICON_CARD` in `sort-stack.tsx`).
  One column on a phone fits it from 320 px in the plain frame and from 354 px in the Docs frame.
- **Touch.** Round 3's jobs, and the cards in a wrapping tray, drag in any direction. In the
  one-row tray (phones, short windows) a sideways swipe scrolls the row and starts no drag; a card
  drags up out of it. A vendor card already in a box (rounds 1 and 2) lets a vertical swipe scroll
  the page (`touch-action: pan-y`), because a thumb scrolling past three full-width cards would
  otherwise keep dragging one off; a finger drags it by the grip at its right end. Tap, mouse and
  keyboard move any card from anywhere on it, the icon included.
- **Focus is never hidden under the pinned bar.** A box's heading and the cards in it keep the bar's
  height clear below them (`scroll-margin-bottom`, from the bar's measured height), so Tab and a
  keyboard move scroll them out from under it.
- **After "Check my stack"** cards are locked until "Try again" (which reshuffles). Round 3's jobs
  left in the tray stay on the page under **Left out**, marked: a job the suite does left out is
  wrong, a distractor left out is right. Each job left out, and each wrong one put in, also says
  whether the suite does it ("SiteMinder does this" / "SiteMinder doesn't do this", `jobFact`): a mark
  alone on a job left out read backwards, "CRM ✓ Right" as "SiteMinder does CRM" (Kyle, 6 Oct). Every
  mark is an icon and a word, never colour alone, and never a vendor icon's colour.

## How it plays

The rules are `sort-model.ts`; the gestures are the shared `drag-board.tsx`.

- **No two runs are the same** (card list 3.0). Each box's cards in the card list are a pool, and so
  are round 3's suites: every run deals `per_box` (three) from each box's pool and `per_run` (three)
  of the suites (`drawRun`), and the game plays that drawn copy as if it were the whole list. Pools
  today: PMS 6, Channel manager 6, Booking engine 5, Dynamic pricing 6, Rate shopping 5, CRM 6, Guest
  messaging 6, Upsell 4, and 6 suites. A box's pool takes any vendor that sells the job, so a suite
  can be dealt as a channel manager (Guesty, Cloudbeds); it's right in every box it sells either way.
  **Start over** deals a new run; **Try again** and `?present`'s round tabs reshuffle the same one.
- **Rounds 1 and 2** (`mode: "vendors"`): twelve vendor cards in a shuffled tray, four boxes that
  each take exactly `per_box` (three). A full box refuses a fourth card, visibly and aloud, and
  while a card from elsewhere is carried it doesn't show the "can go here" outline.
- **Round 3** (`mode: "jobs"`): one board per suite, in the list's order. The suite is the only box;
  the tray is its `does` mixed with its `distractors`. "Check my stack" wakes up once one job is in.
  A suite may have no distractors (the brief asked for two; Cloudbeds sells all eight jobs), and then
  every job in its tray goes in.
- **Placing a card**: tap it, then tap a box (or the tray's **Tray** button to send a placed card
  back); or drag it; or Tab to it, Enter, and the box's number key (Backspace sends it back, Escape
  puts it down). Every move is announced. The Tray button is how a screen reader on a phone, with
  no Backspace, takes a card back out; it's marked unavailable until a placed card is in hand.
- **Focus**: the round's heading takes focus on every new board (Next, Try again, Start over, and a
  round tab chosen from the keyboard or by touch; a mouse click leaves focus on the tab) and on Show
  answers; the tally ("10 of 12") takes it after Check my stack. The heading carries where the board
  is ("Round 3 of 3 · Suite 2 of 3", as its description) and, in round 3, the suite's name, since
  the three suites share one title.
- **Show answers** (`?present`): every card the run dealt, in its box with its note; in round 3,
  the run's suites with their jobs and notes, and the finish line.

## The tools check's results

On `/dictionary/tools/review` (not `?present`, not `/acumen-sort`), a run is the tools check. When
the last board is checked it's kept in this browser (`tools-results-model.ts`) and **See your
results** opens `/dictionary/tools/review/results`, laid out like the terms check's results.

- **The score**: each vendor card a point, right or not; each suite a point shared over its jobs (5
  of 7 right is 5/7 of a point). The grade is the terms check's Ontario scale, for fun and never a
  pass mark; an R comes with "These names take a few rounds. Practise the ones below and try again."
  Under it, "Up 4% since last time · 2 fewer tools to refresh" against the run before.
- **The tools to refresh on**: each vendor's latest result across runs (a suite counts as right only
  with every job right; a name shown twice in a run takes the later board). Each shows its logo, what
  it falls under, what else it sells, and the game's note. Since every run deals different tools, the
  list shrinks as they come round again right. `?set=missed` on the training deals just these.
- **Checking the last board again** (Try again, then Check my stack) replaces the run it saved rather
  than adding one. The latest 20 runs are kept.
- **Reset your tools results**, at the bottom, behind a second press, clears this browser's record.
- **A browser that won't keep it** (a private window, storage turned off) gets a line saying there's
  no results page this time, and the game plays as before.
- The dictionary's buttons follow it: "Take the tools check", then "Retake the tools check" and "3
  tools to refresh" (to the results) once this browser has a run, and "Practise the tools" opens the
  missed set while there are any.

## The tools training

`/dictionary/tools/practice`, on the check's shared deck (`../flashcards.tsx`). It goes one way round,
"Logo and name: what it falls under" (Kyle, 5 Oct 2026; it replaced the old Vendor first and Box first
sides), so it shows no "Show first" picker.

- **One card per vendor in the manifest**: all 43 (Google is left out, below), keyed by slug, not only
  the 25 in the game.
- **Front**: the logo (the 512 px file, drawn at 112 px) and the vendor's name from the manifest.
  Where the slides name more than one product for a vendor (`deck_card_names`), those names are under
  it: today only Amadeus, "Amadeus iHotelier · Amadeus Demand360".
- **Back**: what it's known for (the manifest's `main`), each matched by id to the card list's box and
  shown with its name and job line, then **Also sells**: the rest of its `categories`, by name only.
  Both in the slides' order (slide 36, PMS, to slide 43, Upsell). These are exactly the boxes the game
  accepts for it (below).
- **Not behind the verify gate.** It pauses only if the card list fails `sortProblems` (which pauses
  the game too) or the manifest fails `trainingProblems` (a vendor with no name, alt or box, or a box
  the card list doesn't have; the game still plays), with "The tools are being updated", a line saying
  which of the two is broken, and the problems.
- **On a phone**, a vendor under many boxes (Cloudbeds sells all eight) can make a card taller than the
  screen, so after the turn the Got it / Not yet row pins itself to the bottom of the pane until the
  card's end scrolls into view (`flashcards.tsx`'s `pinActions`, which only this deck turns on; the
  terms deck keeps its row under the card). Both faces share one size, so a tall front still hints at
  a vendor under many boxes. While a card is up the next two cards' logos load; the first card's loads
  when Start is pressed.
- **One answer per vendor (since 6 Oct 2026, manifest 1.2 and card list 2.2).** Kyle found the
  training, the slides and the game disagreeing. On 6 Oct the game had taken the 5 Oct vendor check
  (`reference/industry-acumen-sort/verification-2026-10-05.md`), while the training kept the slides'
  boxes. Now both read one table under one rule: a box counts when the vendor sells that job under its
  own name, in a plan or as a paid add-on. Partners' products and sister brands don't count. The rule,
  where each box's line falls, the answer key and the slide changes still owed in the Claude project's
  deck are in `reference/industry-acumen-sort/slide-corrections-2026-10-06.md`. The open points from the
  5 Oct check were settled by a second look on 6 Oct.
- **The portal's manifest (1.2) leads the master (1.0).** It leaves out Google (Google Hotels is
  metasearch, which none of the eight boxes covers) and Mews' CRM (Mews sends hotels to other companies'
  CRMs). Google's icons are gone from `public/vendor-icons/`. Mews' pink tile is marked identified. It
  also adds `main` to every vendor and completes every vendor's `categories`. Upload this copy to the
  Claude project in place of its master before the next copy comes in, or that copy will undo all of it.
- **The Tech Stack Guide wins (manifest 1.3).** The guide PDF (v2.1, on `/dictionary` under
  Resources) left out four boxes that rested on thin evidence: WebRezPro's dynamic pricing, Lodgify's
  upsell, Lighthouse's PMS and HubSpot's guest messaging. Kyle chose the guide (6 Oct), so 1.3 drops
  them, and the training, the game and the guide agree.
- **The game and the training can't disagree.** `boxClashes` (`vendor-icons.ts`) lists every card or
  suite whose accepted boxes (box plus `also`, or `does`) aren't exactly its vendor's `categories`,
  and every distractor its vendor sells. A card's box is only the pool it's dealt from, so it needn't
  be the vendor's `main`.
  `vendor-icons.check.ts` fails on any of them, so a vendor is corrected in both files at once. The
  Amadeus entry covers two products, so its iHotelier card may accept fewer boxes than the entry. The
  pages don't run it: a clash is a content question, caught by the check before it ships.

## The card list since 3.0

3.0 (6 Oct 2026) makes every box a pool and round 3 a pool of suites, dealt per run (above): 23 cards
in round 1, 21 in round 2, 6 suites with `per_run: 3`. The new cards and suites (RMS Cloud, Little
Hotelier, Hostaway, Guesty, Cloudbeds, WebRezPro, Beyond, Duetto, RoomPriceGenie, Atomize, KeyData,
STR, Amadeus Demand360, HubSpot, Mailchimp, Klaviyo, Akia, Enso Connect, Kipsu, Plusgrade; suites
Little Hotelier, Newbook and Revinate) take their boxes from the manifest and their notes from the 5
Oct vendor check, with the vendor's own pages as sources. RateGain moved to round 1's channel-manager
pool. Rate shopping's job line became "Shows what nearby properties charge, and how the market is
doing", so it's true for the benchmarking tools too (STR, KeyData, Demand360). `sortProblems` now asks
for at least `per_box` cards a box, and `per_run` no more than the suites there are.

## The card list since 2.2

2.2 (6 Oct 2026) gives every card in rounds 1 and 2 an `also` of everything its vendor sells, other
rounds' boxes included. A box from another round can't fire in the game, but it keeps the card and the
training on one list. Four answers that were marked wrong became right, and none went the other way:
Oracle OPERA Cloud and Sabre SynXis in Channel manager, and Revinate and Whistle in Upsell. The notes of
the cards whose boxes changed now say what else the vendor sells. Round 3 didn't change.

## The card list since 2.1

On 6 Oct 2026 Kyle asked for the verify flags, round 3 and round 1 to be settled from the 5 Oct vendor
check, and the renames left for later. So **2.1 was edited here, not in the master**, and the Claude
project's master needs it before its next copy comes in (`source_of_copy` says so too).

- **One rule for what counts**: a box is right when the vendor sells that job under the card's name,
  in a plan or as a paid add-on (the report's "a paid add-on counts"), so the game never marks a true
  answer wrong. A sister product under another name doesn't count: SiteMinder's PMS is Little
  Hotelier, so PMS is wrong for SiteMinder in round 1 and round 3 alike.
- **Round 1 and 2 alsos added**: Mews (channel manager, dynamic pricing), Newbook (booking engine,
  dynamic pricing), Lodgify (PMS, dynamic pricing), SiteMinder and STAAH (dynamic pricing), Amadeus
  iHotelier (channel manager), GoHighLevel and Revinate (guest messaging). Mews, Newbook and Lodgify
  are now right in any round 1 box: all-in-one systems, which is the lesson. Each note says what else
  it sells.
- **Left as they were, on the researcher's advice**: Oracle OPERA Cloud (its channel manager is a
  separate product, OPERA Cloud Distribution), RateGain (its upsells are a feature of its booking
  engine) and Lighthouse (messaging and upsells through KITT, a side product). Sabre SynXis (channel
  manager) and Whistle (upsell) wait with their renames. 2.2 accepts Oracle's and SynXis' channel
  managers and Whistle's upsells under the one rule above. RateGain and Lighthouse stay as they were:
  their upsells happen only during booking.
- **Round 3**: Cloudbeds does all eight jobs, with no distractors; SiteMinder does six (PMS and CRM are
  wrong); Mews does six (CRM is wrong). Mews' tray leaves out rate shopping, as the report advised:
  Mews RMS tracks competitors' rates, but it isn't taught as a rate shopper.
- **The seven verify flags** (DerbySoft, Amadeus iHotelier, Lodgify, AirDNA, GoHighLevel, UpsellGuru
  and the SiteMinder suite) were settled from the report's vendor pages, `checked` 2026-10-05.
  UpsellGuru's source is its own page, which is safe only because sources are never shown to players.
- **Still to do, with the renames**: SynXis by Aven Hospitality (formerly Sabre), Whistle as Cloudbeds
  Guest Experience, Oaky as Oaky by Plusgrade, and the third-party sources on cards this change didn't
  touch (the report lists each one's own page).

## The vendor icons

43 icons here, one design (a rounded square; white tiles carry their own hairline border, so they read
on white and in dark mode), made in the Claude project on 5 Oct 2026: the kit's 44 less Google's.

- **Where they live**: `public/vendor-icons/128/<slug>.png` and `public/vendor-icons/512/<slug>.png`,
  and the manifest `src/data/vendor-icons.json`. The manifest's own `file` paths describe the Claude
  project's unpacked folder and are ignored; the URLs come from the slug (`iconUrl` in `vendor-icons.ts`).
- **How a vendor finds its icon**: by its name exactly as the slides and the card list write it,
  through the manifest's `card_name_to_slug` ("Sabre SynXis" is `sabre`), in code. The card list has no
  logo field, and mustn't get one: its master is in the Claude project.
- **Where they show**: the game puts the 40 px icon on the left of every vendor card (tray, boxes,
  marked cards, Show answers) and the 96 px icon above round 3's suite box (a card dropped or tapped
  onto that icon goes into the box); the training draws the 112 px logo on each card's front.
- **The two sizes**: in the game the image offers both files with a `sizes` that matches the drawn
  size, so the browser fetches the 128 px file unless the screen needs more (the 96 px suite icon on a
  2x screen gets the 512). `?present` works the same way: its icons are drawn at the same sizes, so
  the 512 px files there would only add weight (about 1 MB a run-through instead of 174 KB) for no
  sharper picture. The handoff record says "`?present` view: the 512 px files"; this is the departure,
  on purpose. The training's logo uses the 512 px file outright. Each board starts loading the next
  board's icons, so round 2's cards and each suite's icon are there when Next is pressed.
- **Alt text**: every icon here has its vendor's name printed beside it, so its alt is empty and a
  screen reader doesn't hear the name twice. An icon shown on its own would take the manifest's `alt`
  ("Mews logo").
- **To update them**: unpack the Claude project's set with `claude/vendor_icons_unpack.py` (the
  handoff record says how), then replace `public/vendor-icons/512/` with its `logos/`,
  `public/vendor-icons/128/` with its `logos-128/` and `src/data/vendor-icons.json` with its
  `logos.json`, each whole. Never edit the manifest here (1.1's and 1.2's changes, above, were Kyle's
  call), and check a new copy still leaves out Google and Mews' CRM and has every vendor's `main`. Run
  both checks below.
- **Mews' pink tile** is genuine: it's Mews' own site icon, though its header logo is a black wordmark.
  It was the last icon marked "check by eye", and is now identified.
- **Trademarks**: these are the vendors' trademarks, used only to identify their products on internal
  training pages. Don't use them on client-facing material or in marketing (Google's is the Google
  Shopping tag mark: if it ever leaves an internal page, follow Google's brand rules). The files are
  served to anyone who asks for them, and `/acumen-sort` shows them without a sign-in.

## Where the code is

Everything is in `src/pages/team/dictionary/tools/` unless a path is given.

| File                                       | What it holds                                                                                                                                                                                      |
| :----------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sort-model.ts`                            | The card list's shape, `sortProblems` (the validator, in plain sentences), `unverified` (the gate), `drawRun` (a run's deal), the boards, moving and marking, the tally. No React. **Start here.** |
| `sort-model.check.ts`                      | The brief's `check-cards.js`: the real list's shape, a run's draw, the rules on a drawn run, and the gate last.                                                                                    |
| `tools-results-model.ts`                   | The tools check's results: a board's result, the score, the tools to refresh, this browser's record (read, write, clear). Pinned by `tools-results-model.check.ts`.                                |
| `tools-results-screen.tsx`                 | `/dictionary/tools/review/results`: the score and grade, the tools to refresh on, "Reset your tools results".                                                                                      |
| `vendor-icons.ts`                          | The manifest's shape, `iconUrl` and `iconSlug` (a vendor's icon by name), and the training: `trainingProblems` and `trainingCards`. No React.                                                      |
| `vendor-icons.check.ts`                    | The icons and the training against the card list, the files on disk, and the slides-versus-game notes. Never reads verify.                                                                         |
| `tools-data.ts`                            | `useToolsData()`: the card list and the manifest as two lazy chunks. Never import either JSON statically.                                                                                          |
| `sort-stack.tsx`                           | The game (`SortStack`), its gate (`SortCardsGate`: loading, broken, waiting on verify), `VendorIcon` and `preloadIcon`, and the plain frame (`StandaloneFrame`).                                   |
| `tools-review-screen.tsx`                  | `/dictionary/tools/review`: TeamGate and the Docs frame, or TeamGate and the plain frame for `?present`.                                                                                           |
| `acumen-sort-screen.tsx`                   | `/acumen-sort`: the plain frame, no gate. `"acumen-sort"` is in `RESERVED_SLUGS` (`src/pages/templates/template-one-screen.tsx`).                                                                  |
| `tools-practice-screen.tsx`                | `/dictionary/tools/practice`: the training's faces, on `FlashcardDeck` (`../flashcards.tsx`), with its own pause for a broken list or manifest.                                                    |
| `../drag-board.tsx`                        | The shared drag and drop (also the check's matching and sorting questions).                                                                                                                        |
| `src/data/industry-acumen-sort-cards.json` | The card list. Its master is the Claude project file named in `source_of_copy`: edit there, then copy it in. 2.1 to 3.0 were edited here (above).                                                  |
| `src/data/vendor-icons.json`               | The icon manifest, a copy of the Claude project's `vendor-icons-manifest.json`, replaced whole. 1.1 to 1.3 lead the master (above).                                                                |
| `public/vendor-icons/`                     | The icons: `128/` and `512/`, one PNG per slug.                                                                                                                                                    |

## Changing the card list

1. Edit the master (see `source_of_copy`), then copy it over `src/data/industry-acumen-sort-cards.json`
   whole. Don't hand-edit the copy. (2.1 to 3.0 are the exceptions, made here at Kyle's request: until the
   master has them, a new copy would undo them, so compare before replacing.) A vendor's boxes live in
   both files: change its card's `also` (or suite's `does`) and its manifest `categories` together.
2. To clear a card for play: check its box and note against the vendor's own site, set `verify` to
   `false` (or remove it) and fill in `checked` (`YYYY-MM-DD`) and `sources`.
3. Run both checks below. `sort-model.check.ts` must end in `sort-model: PASS`; a new vendor needs its
   name in the manifest's `card_name_to_slug`, or `vendor-icons.check.ts` fails.

If a list that fails `sortProblems` ever reaches the site, all three pages pause themselves ("The tools
are being updated", with the problems under "What needs fixing"); a manifest that fails
`trainingProblems` pauses only the training. A card whose vendor has no icon still plays, without one.

## Checks

```bash
# The card list and the rules. Passes today; fails, listing them, if any entry says verify: true.
npx esbuild src/pages/team/dictionary/tools/sort-model.check.ts --bundle \
  --platform=node --format=cjs --alias:@=./src --outfile=/tmp/hgm-check/sort-model.cjs \
  --log-level=warning && node /tmp/hgm-check/sort-model.cjs

# The icons and the training, from the repo root (it reads public/vendor-icons/). Passes today.
npx esbuild src/pages/team/dictionary/tools/vendor-icons.check.ts --bundle \
  --platform=node --format=cjs --alias:@=./src --outfile=/tmp/hgm-check/vendor-icons.cjs \
  --log-level=warning && node /tmp/hgm-check/vendor-icons.cjs

# The tools check's score, tools to refresh and this browser's record.
npx esbuild src/pages/team/dictionary/tools/tools-results-model.check.ts --bundle \
  --platform=node --format=cjs --alias:@=./src --outfile=/tmp/hgm-check/tools-results-model.cjs \
  --log-level=warning && node /tmp/hgm-check/tools-results-model.cjs

npx tsc -b
```

The rule tests work by role (the first card of the first box, the first suite, the first vendor) on
copies of the data (the game's rules on one drawn run), so correcting cards doesn't break them. `vendor-icons.check.ts` fails when the
manifest's eight boxes aren't exactly the card list's (in any order: the card list's order is the
game's number keys, the slides' is the training's), a vendor has no name, alt or box, an icon's PNG
is missing or the wrong size, a `card_name_to_slug` entry names no vendor, or a card or suite in the
card list has no icon, a vendor has no main box, or the game and the training disagree about a vendor
(`boxClashes`). It prints, without failing, any icon still to check by eye (none today).

## For the session

- QR codes: `reference/industry-acumen-sort/qr-acumen-sort.png` (https://hgmportal.com/acumen-sort, no
  sign-in, for the room) and `qr-acumen-sort-team.png` (https://hgmportal.com/dictionary/tools/review).
- Present from `/dictionary/tools/review?present` or `/acumen-sort?present`. Every run is dealt fresh,
  so the room and the presenter see different cards; slide 46's fixed answers no longer match a run
  (`reference/industry-acumen-sort/slide-corrections-2026-10-06.md`).

## UI strings the code adds

Everything else is the data's, or the brief's own words ("Round 1 of 3", "3 of 3", "n jobs", "Check my
stack", "Try again", "Next", "Start over", "Show answers", "Round 1 / 2 / 3", the also line, "10 of
12"), or Kyle's ("Practise the tools", "Does:", "Back to the dictionary").

- On the board: "Suite 1 of 3"; "Right" and "Wrong", and after them in round 3 "SiteMinder does this"
  / "SiteMinder doesn't do this" (the suite's name); "Box: …" (the right box on a card that isn't in
  it); "1 job" (the singular of "n jobs"); "PMS already has 3 cards. Move one out first."; "Tray"
  (the tray's button and name); "Left out" (the label over round 3's marked jobs left out).
- Read to a screen reader only: "Mews in PMS, 2 of 3.", "PMS in Cloudbeds.", "Mews back in the tray.",
  and round 3's heading with its suite, "One suite, many jobs: Cloudbeds" (the card list's title and
  suite name, joined by a colon). drag-board.tsx, shared with the check, adds its own: picked up, put
  down, stays where it is, went back where it was, and "Pick a card up first, then choose the box."
- The plain frame's theme button reuses the portal's own "Switch to light mode" / "Switch to dark
  mode".
- The pages' states: "Some cards are still being checked", its paragraph ("… the game stays closed.
  …"), and its list's lines ("DerbySoft · Round 1, The four systems"); "The tools are being updated" /
  "The card list has a problem, so these pages are paused until it's fixed." (or, on the training,
  "The vendor icons' manifest has a problem, so the training is paused until it's fixed.") / "What
  needs fixing"; "The cards couldn't load" (with the check's reload line and button); "Loading…".
- The plain frame's logo, whose alt text is "HiddenGem Media".
- The tools check: "Take the tools check" / "Retake the tools check", "3 tools to refresh"; on the last
  board "See your results" and, when storage is blocked, "This browser won't keep your results (a
  private window, or storage turned off), so there's no results page this time."; on the results page
  "Your tools results", "Thanks for completing the tools check.", "Score", "Grade", the R line,
  "Kept in this browser only.", "Practise the tools to refresh" / "Practise all the tools", "Retake
  the tools check", "Tools to refresh on" / "Nothing to refresh", its count line, "Falls under:",
  "Also sells:", "You've got every tool you've been dealt right.", "You haven't finished the tools
  check yet", "Reset your tools results", "Reset your tools results?", its line, "Reset them" / "Keep
  them"; on the training's missed set its intro, "See your results", and "Nothing to refresh on".
- The training: the title "Time to practise the tools."; the intro "43 cards: a tool's logo and name,
  then what it falls under and what else it sells." (the count is the manifest's); the face labels
  "Vendor" and "Falls under"; "Also sells" over the rest of a vendor's boxes;
  " · " between a vendor's products; and, read to a screen reader only, ": " after each box name and
  ". " after each job line on the back, so the boxes don't run together.
