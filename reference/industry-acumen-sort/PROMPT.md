---
title: Sort the stack — prompt and card list for Claude Code
status: built into the portal, 2 Oct 2026 (see "How it was built here" at the end)
owner: kyle
date: 2026-10-02
supersedes: claude/industry-acumen-sort-cards.json (v1.0, 27 Sep, two rounds, 19 cards)
sources: claude/sessions_industry-acumen-master.md (Part 3, practice 6, slides 44–45), claude/sessions_industry-acumen-interactive.md (segment 6), claude/sessions_industry-acumen-build-walkthrough.md (§2)
---

> The record of what Kyle asked for, kept next to the code like `reference/industry-acumen-check/`.
> Nothing here is read by the app. The data file (Part B) lives at
> `src/data/industry-acumen-sort-cards.json`; its master is the Claude project file named in its
> `source_of_copy`. Edit there first, then copy it in.

# Sort the stack: the three-round build

This file has two parts. Part A is the prompt you paste into Claude Code in VS Code, with the Netlify site's code open. Part B is the data file the page is built from; save it as industry-acumen-sort-cards.json in the site before you paste the prompt. The page's wording lives in the data file, not in the code, so a card can be corrected without a rebuild.

What changed from the 27 September version: three cards in every box instead of two or three, so no box can be finished by elimination; a third round that turns the game around (pick a suite, drag in the jobs it does); and twelve wrong-answer "job" cards for round 3. The boxes, the also rule and the presenter view are unchanged.

Before you paste: the six cards marked "verify": true in the data (DerbySoft, Amadeus iHotelier, Lodgify, AirDNA, GoHighLevel's category line, UpsellGuru) were added on 2 October from the deck's tool slides and have not been checked against a vendor page in this project. Check each one's box and note against the vendor's own site, set verify to false and fill in checked, or swap the card for one that has been checked. The page should refuse to build if any card still has verify: true; that rule is in the prompt.

What I need from you, as in the walkthrough: the Netlify site and the path (for example /acumen-sort), where its code lives, two testers for the dry run (one phone in the room, one on the video call), and the time booked to Team Training.

## Part A: the prompt (paste into Claude Code)

You're building a static page for HGM's Netlify site at /<path>: a three-round drag-and-drop sort used live in an HGM training session. Everything on the page comes from industry-acumen-sort-cards.json, which is already in the site. Don't write or change any wording; if something in the data looks wrong, say so and stop. Use HGM's tokens from hgm-tokens.css, Inter for text and Roboto Mono for figures. Plain HTML, CSS and JS; no framework and no build step unless the site already has one. Sentence case throughout, no exclamation marks.

Refuse to build if any card in the data has "verify": true. List the cards and stop.

1. Phone-first. Works at 360 px wide with no sideways scroll and card text at least 16 px. Laptops work too.

2. Three rounds on one page, shown one at a time with a round indicator ("Round 1 of 3") and a Next button that appears once a round is checked.

    Rounds 1 and 2 (mode: "vendors"): a tray of twelve vendor cards and four boxes. Each box shows its name and job line. Every box takes exactly three cards; show "3 of 3" under each box as cards go in, and don't let a fourth in.

    Round 3 (mode: "jobs"): three sub-rounds, one per suite, in the order given. Each shows one suite as the single box, with its name, and a tray of job cards: the suite's own jobs mixed with the distractors for that suite, shuffled. Players drag in only the jobs the suite does and leave the rest in the tray. The suite box shows "n jobs" with no count given away. "Check my stack" marks every tray card too: a correct job left in the tray is wrong; a distractor left in the tray is right.

3. Placing cards. Tap a card, then tap a box. Drag also works with mouse and touch. A placed card can be moved back to the tray or to another box until the round is checked. In rounds 1 and 2, shuffle the tray on load.

4. "Check my stack" becomes active once every card is placed (rounds 1 and 2) or once at least one job is in the suite (round 3). It then marks each card right or wrong with an icon and a word, never colour alone, and shows the correct box and the card's note.

    - A card placed in any box listed in its also counts as right, with the line "also right: it's sold as more than one of these".
    - The round tally ("10 of 12") shows on the device only. "Try again" resets the round.
    - After round 3's third suite, show a plain finish line from the data (finish) and a "Start over" button. No score is kept across rounds, no total is shown.

5. ?present: a large-type layout for screen sharing with the same interactions, plus "Show answers", which places every card in its box with its note, and in round 3 shows each suite with its jobs. The presenter view also has "Round 1 / 2 / 3" tabs so Kyle can jump straight to the review.

6. Nothing is stored or sent: no analytics, no cookies, no localStorage, no calls after load, no sign-in. State lives in page memory only; a refresh starts clean.

7. Accessibility: light and dark themes from the tokens, prefers-reduced-motion respected, keyboard use (Tab to a card, Enter to pick it up, 1 to 4 to choose a box, Backspace to return it to the tray), visible focus, every mark readable by a screen reader.

8. Data integrity check at build time: a small script (check-cards.js, run with node) that confirms every round's cards resolve to a box, every vendor box has exactly three cards, every also names a real box, round 3 suites have at least two jobs and at least two distractors, and no card has verify: true. Fail loudly on any miss.

9. QR code: make a PNG for the final URL, at least 1000 px, dark on white, saved as qr-acumen-sort.png, and tell me the short link.

Deploy a preview and give me the URL, then run through the checklist: iPhone, Android, laptop, ?present, keyboard only, and one person finishing all three rounds from a link in a video-call chat.

## Part B: the data file

Saved as `src/data/industry-acumen-sort-cards.json` (not repeated here, so there is one copy). Vendor spellings are the vendors' own. The note lines are what the player sees after checking; they match the deck's tool slides (36 to 43) and the master's practice 6. Sources and checked dates carry over from the 27 September file where the card was already there; new cards carry verify: true until checked.

Notes on the data:

- Cloudbeds is deliberately not a card in round 1 any more; it is the first suite in round 3, where its many boxes are the point. The 27 September file had it in round 1 with three also boxes, which made the "also right" line fire on almost any placement.
- RateGain, Duve and Canary carry also because the deck's slides say they sit in two boxes. Mews' also matches round 3.
- SiteMinder's round 3 entry carries a verify_what line because the deck marks Little Hotelier as SiteMinder's PMS [VERIFY]. The check script treats verify: true as a block, so this has to be settled before the build, not after.
- Distractors are the jobs the suite does not do, drawn from the same eight boxes, so a player who thinks "Cloudbeds does everything" gets caught.

## Done when

The walkthrough's list, plus three for the new round: a tester finishes round 3 on a phone without being told how; "Show answers" on ?present shows each suite with its jobs; and check-cards.js passes with no card left on verify: true.

## How it was built here (2 Oct 2026, Kyle's answers)

- Built inside the portal (React, the site's own tokens and fonts), not as a separate static page.
- **Tools review** is this game, at `/dictionary/tools/review`, behind the team sign-in like the
  rest of the dictionary. **Tools practice** is a flashcard deck of the same vendors, at
  `/dictionary/tools/practice`. Both are reached from the right of the buttons under the
  dictionary's heading.
- A copy of the game needs no sign-in, at `/acumen-sort`, for the session in case the sign-in gets
  in the way. Same data, same game.
- The check script is `src/pages/team/dictionary/tools/sort-model.check.ts`, in the repo's
  `.check.ts` convention, instead of `check-cards.js`.
