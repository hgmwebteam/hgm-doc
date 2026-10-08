# Industry Acumen Dictionary

`hgmportal.com/dictionary`: 253 hotel, resort and marketing terms that account managers search
live on client calls. It sits behind the same team sign-in as `/dashboard` (`TeamGate`). The
sign-in hides the page, not the data. The JSON ships as a public file of the site, the same way
every other page's content does.

## The data file

- **Where:** `src/data/ref_dictionary-v2-253.json`
- **What it is:** a copy of a master that is maintained outside this repo. **Never edit it here**,
  not even to fix a typo. Fix the master, then drop the new copy in.

### Updating it

1. Replace `src/data/ref_dictionary-v2-253.json` with the new master. Keep exactly the same file
   name; the code imports it by that name.
2. Optional, but it takes two seconds: run the self-check (see below).
3. Commit, push, and merge to `main`. Netlify rebuilds and deploys. No code changes are needed.

### What can and can't change

**The build fails, and the live site keeps its last good version, if** the new file:

- isn't valid JSON, or
- loses a field the page depends on: `slug`, `term`, `tier`, `section` or `gloss`.

**These are fine with no code change:**

- New entries.
- Empty or `null` optional fields. Anything empty is simply left off the entry.
- Extra fields. They're ignored.
- A new section number. It shows as "Section 10" until someone adds its name to `SECTION_NAMES`
  in `dictionary-model.ts`. The nine names come from the brief; the file stores numbers only.

**Rules the file has to follow:** `slug` stays unique and URL-safe, because it is the link
(`/dictionary#cap-rate`). Each `related` entry is another entry's slug. `tier` (A, B or C) shows
as a "Tier A" / "Tier B" / "Tier C" badge and drives the tier filters. `core` is read only on
tier A entries. `origin` is not shown.

## Where the code is

| File                                                  | What it holds                                                                                                                                                                                    |
| :---------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/pages/team/dictionary/dictionary-model.ts`       | Types, section and badge labels, text normalising, **the ranking** (`scoreEntry`, `search`), edit distance and no-match suggestions. No React. Start here when a search returns the wrong thing. |
| `src/pages/team/dictionary/dictionary-model.check.ts` | The self-check: the master's shape plus every search the brief promised.                                                                                                                         |
| `src/pages/team/dictionary/dictionary-screen.tsx`     | The page: the search box and keys, results, the browse view, Resources, `#slug` links, scrolling.                                                                                                |
| `src/pages/team/dictionary/dictionary-data.ts`        | `loadDictionary()`, the one way to load the file — shared by the page and the header's global search, so it is fetched once.                                                                     |
| `src/pages/team/dictionary/dictionary-resources.ts`   | The Resources list (see below).                                                                                                                                                                  |
| `src/components/application/search-modal.tsx`         | The header search on every team page; its Terms tab and term results use this dictionary's ranking.                                                                                              |
| `src/pages/team/dictionary/dictionary-entry.tsx`      | One entry, as a compact card or in full. The check's results page reuses it, without the tier and with the question's explanation.                                                               |
| `src/pages/team/dictionary/dictionary-layout.tsx`     | The Docs frame (rail, header row, Docs menu) shared with the check's pages.                                                                                                                      |
| `src/pages/team/dictionary/check/`                    | The check, its results and the flashcards. See [dictionary-check.md](dictionary-check.md).                                                                                                       |
| `src/main.tsx`                                        | The `/dictionary` route.                                                                                                                                                                         |
| `src/pages/team/dashboard-screen.tsx`                 | The Docs menu (`DEPARTMENTS`, `docs`) and `DocsSideMenu`: the dashboard's own side menu, which `/dictionary` renders so the menu never moves between Docs pages.                                 |
| `src/pages/team/manual-screen.tsx`                    | The manual's copy of the Docs menu (`DOCS_MENU`), which also lists Dictionary.                                                                                                                   |

## How search works

The whole file loads once, as its own ~45 KB (gzipped) chunk, and is searched in the browser.
Each search takes well under a millisecond. Results update 80 ms after the last keystroke, and
the best match opens in full. Matching ignores case, accents and punctuation, spaces included, so
`revpar`, `Rev PAR` and `rev-par` are the same query.

Ranking, best first:

1. Exact match on the term, its acronym, an alias, or the text in its brackets.
2. The term or an alias starts with the query.
3. A later word of the term starts with the query.
4. The query is inside the term or an alias.
5. The query is inside the definition.
6. A typo of the term: 1 edit for queries of 4–6 characters, 2 edits for 7 or more.

Ties go to Tier A first, then Tier B, then Tier C, then A–Z.

Two refinements stop nonsense matches:

- A substring match (rules 4–5) must start at a word, or stay inside one word. Without this,
  `adt` would match "Lead time" once the spaces are ignored.
- Filler words (and, the, per…) are never typo targets.

## Resources (PDF and slide downloads)

The browse view (an empty search box) opens with **Resources**: the Acumen Dictionary PDF, the
call sheet cheat sheet (the Tier A terms) and the client tech stack guide, then **Training
session slides**: the decks from the two Industry Acumen sessions, each as a PDF (View, Download
PDF) and a PowerPoint (Download PowerPoint, with the speaker notes). To publish one, drop the
file into `src/assets/dictionary-resources/` under its name in that folder's README, then
commit. Its buttons switch on by themselves; until then they show disabled, beside "Coming
soon". **The files are public**: anyone with a file's link can open it, signed in or not, and
the repository is public on GitHub — so only documents that are fine to share outside HGM. The
decks' speaker notes go with them (Kyle agreed, 8 Oct 2026). Replacing a file is overwriting it
under the same name. The decks are copies of the Google Slides masters: export the PDF and the
.pptx together so they match, and never edit them here. The list, its titles and the download
file names are in `dictionary-resources.ts`.

## Debugging a search

Run the self-check:

```bash
npx esbuild src/pages/team/dictionary/dictionary-model.check.ts --bundle \
  --platform=node --format=cjs --alias:@=./src --outfile=/tmp/hgm-check/dictionary.cjs \
  && node /tmp/hgm-check/dictionary.cjs
```

To see why a query ranks the way it does, add a line such as
`console.log(search(index, "your query").map((h) => [h.entry.term, h.rule]))` to the check file
and run it. The rule number tells you which step matched.

If a search check fails right after a new master, read the failure before you change the ranking.
The master may simply have renamed or removed a term.

## Behaviour worth knowing

- **Keys:** `/` focuses search from anywhere. `↑` / `↓` move through results, `Enter` opens one,
  and `Esc` clears.
- **Links:** opening an entry writes `#slug` into the URL with `history.replaceState`, so the
  browser history doesn't fill up. "Copy link" copies `…/dictionary#slug`.
- **Signing in from a link:** Google sign-in normally drops the `#slug`. The page parks it in
  `sessionStorage` for 15 minutes and reopens the entry after sign-in.
- **Layout:** from 768 px up the page is laid out exactly like a Docs tab on `/dashboard` — same
  rail, header row and Docs menu in the same place, the dictionary in the pane beside it. Below
  768 px the rail, header row and menu drop out so the search box comes first.
- **Header search:** every team page's "Search pages, clients, cards, terms…" finds terms too, with
  the same ranking. Picking one opens it on `/dictionary`.
- **Tracking:** none. Nothing records what people search. The check under the dictionary does
  save each person's own results (see [dictionary-check.md](dictionary-check.md)), visible only
  to them in the portal.

## The check and flashcards

"Take the check" and "Practise the terms", under the heading, lead to `/dictionary/check`,
its results page and `/dictionary/practice`. They have their own doc:
[dictionary-check.md](dictionary-check.md).
