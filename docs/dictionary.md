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
(`/dictionary#cap-rate`). Each `related` entry is another entry's slug. `tier` A shows a "Core
term" badge and B "On the check". `origin` "HGM" shows an "HGM term" badge. `core` is read only
on tier A entries.

## Where the code is

| File | What it holds |
| :--- | :------------ |
| `src/pages/team/dictionary/dictionary-model.ts` | Types, section and badge labels, text normalising, **the ranking** (`scoreEntry`, `search`), edit distance and no-match suggestions. No React. Start here when a search returns the wrong thing. |
| `src/pages/team/dictionary/dictionary-model.check.ts` | The self-check: the master's shape plus every search the brief promised. |
| `src/pages/team/dictionary/dictionary-screen.tsx` | The page: lazy loading, the search box and keys, results, the browse view, `#slug` links, scrolling. |
| `src/pages/team/dictionary/dictionary-entry.tsx` | One entry, as a compact card or in full. |
| `src/main.tsx` | The `/dictionary` route. |
| `src/pages/team/dashboard-screen.tsx` | The dashboard's Docs menu row (`DEPARTMENTS`, `docs`). |
| `src/pages/team/manual-screen.tsx` | The same menu as `DOCS_MENU`. It is exported, and `/dictionary` renders it with its own row current. |

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

Ties go to Core terms first, then "On the check", then the rest, then A–Z.

Two refinements stop nonsense matches:

- A substring match (rules 4–5) must start at a word, or stay inside one word. Without this,
  `adt` would match "Lead time" once the spaces are ignored.
- Filler words (and, the, per…) are never typo targets.

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
- **Phones:** below 768 px the page hides the icon rail and header row, and below 1024 px the Docs
  menu, so the search box comes first.
- **Tracking:** none. Nothing records what people search.
