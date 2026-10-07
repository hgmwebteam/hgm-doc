# hgm-doc

A client-facing **guide / documentation site** (Meta Pixel setup, website popups, owner guides) built on the **Untitled UI React** component system. Deployed as a static Vite SPA to Netlify, serving at `hgmportal.com`.

> This file is the shared, tool-neutral brief read by every coding agent (Codex, Cursor, Copilot,
> Claude Code via `CLAUDE.md`). Claude-only material — skills and the `ui-*` agents' facts table — is in
> [CLAUDE.md](CLAUDE.md).

> Detailed reference lives in `.claude/rules/` — read the matching file before editing `src/`:
>
> - **Components & patterns** → [.claude/rules/components.md](.claude/rules/components.md) (`src/components/**`, `src/pages/**`)
> - **Color tokens** → [.claude/rules/colors.md](.claude/rules/colors.md) (`src/**/*.tsx`, `src/**/*.css`)
> - **Icons** → [.claude/rules/icons.md](.claude/rules/icons.md) (`src/**`)

## Stack

- **React 19** + **TypeScript 5.9**
- **Vite 8** — build tool & dev server (not Next.js; SPA, no SSR)
- **react-router 7** — client-side routing (`src/main.tsx`)
- **Tailwind CSS v4.2** — styling via a CSS-variable theme
- **React Aria Components 1.16** — accessibility/behavior foundation
- **Supabase** — the only persistence for editable page content (never localStorage-only)
- **motion** (Framer Motion) — animation

## How pages work

Routes are registered as a flat list in `src/main.tsx` (not nested). There are two kinds:

**Named routes** — templates and internal team pages: `/popup`, `/owner-guide(/:slug)`, `/chat-widget` (templates); `/dashboard`, `/roadmap` (the "Project Management" page), `/requests`, `/settings`, `/designsystem`, `/webteam/ai-website-setup` (team-internal). A `PAGES_WITHOUT_FLOATING_CHROME` array in `main.tsx` suppresses the global floating theme toggle on internal pages (their icon-rail chrome has its own).

**Client slugs** — the catch-all `/:clientSlug` route goes to `src/pages/client/client-screen.tsx`, which dispatches on the slug suffix to a page component + Supabase table:

- `/{client}-leadcapture` → `PopupPage`, table `leadcapture_pages`
- `/{client}-chatwidget` → `ChatWidgetScreen`, table `chatwidget_pages`
- anything else (e.g. `/{client}-metapixel`) → `PixelPage`, table `client_pages`; the bare slug `metapixel` is the template and renders without a DB row

The team creates a private per-client copy from a template, which saves a row to the matching table under its own slug. Content is edited in place (lock/unlock) and persisted to Supabase. Global chrome mounted above all routes in `main.tsx`: the floating theme toggle and `HelpMenu`; global edit-mode keyboard shortcuts live in `src/hooks/use-edit-shortcuts.ts`.

## Critical conventions

### React Aria imports — prefix with `Aria*`

All imports from `react-aria-components` MUST be aliased with an `Aria*` prefix (prevents conflicts with our custom components):

```typescript
// ✅
import { Button as AriaButton, TextField as AriaTextField } from "react-aria-components";
// ❌
import { Button, TextField } from "react-aria-components";
```

### File naming — kebab-case

All files use kebab-case (components, ts/js, css, tests, configs): `date-picker.tsx`, `api-client.ts` — never `DatePicker.tsx` or `apiClient.ts`.

### Colors — semantic tokens only

Never use raw Tailwind palette utilities (`text-gray-900`, `bg-blue-700`, `border-red-300`, `hover:bg-red-50`). Use semantic tokens (`text-primary`, `bg-primary`, `border-error`, `hover:bg-error-primary`) so light/dark mode works. Full token list in [.claude/rules/colors.md](.claude/rules/colors.md).

### Disabled states — `opacity-50`

Use `disabled:cursor-not-allowed disabled:opacity-50`. Do NOT use the v7 pattern (`disabled:bg-disabled_subtle`, etc.).

### Image uploads — always compress to WebP

Every image-upload handler MUST go through `compressImageFile()` from `src/utils/compress-image.ts` (resizes to ≤1600px + WebP ~0.82 quality, JPEG fallback, SVG/GIF pass through) — never raw `FileReader.readAsDataURL` on the original file. Images are stored as base64 in Supabase, so uncompressed uploads bloat the DB and slow every page load.

### Components — React Aria foundation

All UI is built on React Aria Components using the compound pattern (`Select.Item`, `Select.ComboBox`). Match existing component structure and add size/color variants. Reference: [.claude/rules/components.md](.claude/rules/components.md).

### Untitled UI PRO first — research before you build

Before building or redesigning any page, section or component, check Untitled UI PRO. This machine has a
PRO licence (`~/.untitledui/config.json`), so PRO components, page templates and `@untitledui-pro/icons`
are all available. Hand-write only what PRO has no match for.

1. **Search** — `npx untitledui@latest search "<what you need>"`. It returns components and full page
   templates (e.g. `dashboards-02/10`, `informational-02/06`).
2. **Preview templates outside the repo.** `npx untitledui@latest example <template>` writes files and
   installs packages. Run it in a scratch copy of the project, read the template there, and bring over only
   the parts you use.
3. **Add one component at a time** — `npx untitledui@latest add <component> --yes`.
4. **Run `git diff` after every `add`.** The CLI quietly overwrites shared vendored files with newer
   versions. It has rewritten `src/components/base/buttons/button.tsx` (a different props API that every
   page depends on), `tooltip.tsx`, `src/utils/is-react-component.ts` and `package.json`. Revert any shared
   file it touched (`git checkout -- <file>`) and keep only the new component's folder, unless a site-wide
   Untitled upgrade was asked for.
5. **Say what you used** — name the PRO components or template behind a change, or why none fit.

Outside references (Mobbin, other sites) come after PRO: for layout ideas, not for components.

## Commands

```bash
npm run dev     # Vite dev server (defaults to :5173 — use the /dev skill to avoid port collisions)
npm run build   # tsc -b && vite build (production build + type-check)
npm run preview # Preview production build locally
npx prettier --write .  # Format code (no npm script; Prettier configured in .prettierrc)
```

**Note:** No ESLint, test, or dedicated typecheck scripts exist. Type-checking happens inside `npm run build` via `tsc -b`. No test runner is configured.

## Project structure

```
src/
├── components/
│   ├── base/           # Core UI (Button, Input, Select, …)
│   ├── application/     # Complex patterns (Modal, Table, DatePicker, …)
│   ├── foundations/     # Design tokens & foundational elements (FeaturedIcon)
│   ├── marketing/       # Marketing components
│   └── shared-assets/   # Reusable assets & illustrations
├── hooks/               # Custom React hooks
├── lib/                 # supabase.ts, db-sync.ts, db-logger.ts, requests.ts
├── pages/               # Route components, grouped by who may see them
│   ├── client/          # Reached at a client's own slug (client-screen.tsx fans these out)
│   │   └── dashboard/   # client-dashboard-page.tsx's model, nav, chrome & document fields
│   ├── team/            # Internal tools behind the dashboard gate
│   ├── overviews/       # Internal explainer docs (*-overview-screen.tsx)
│   ├── templates/       # Shareable templates (template-screen, template-one-screen)
│   ├── landing-screen.tsx   # `/` entry
│   └── not-found.tsx        # fallback
├── providers/           # React context (theme-provider, router-provider)
├── styles/              # globals.css, theme.css (brand color vars), typography.css
├── types/               # TS type definitions
└── utils/               # cx(), is-react-component(), …
```

Import pages by their aliased path (`@/pages/team/dashboard-screen`), never
relatively — a page can then change group without editing its neighbours.

The client dashboard is the one page big enough to have its own folder. Put new
shared constants, types and presentational pieces in `src/pages/client/dashboard/`
rather than at the top of `client-dashboard-page.tsx`:

| Module                     | Holds                                                                                                                                                                                                                                                                                                                                                                |
| :------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dashboard-model.ts`       | Stored shapes, `TEMPLATE_CONTENT`, `mergeContent`, `SectionId`, pure helpers. No React.                                                                                                                                                                                                                                                                              |
| `overview-doc.ts`          | The team-only Client Overview brief's field list.                                                                                                                                                                                                                                                                                                                    |
| `master-brand-document.ts` | The eleven sections, completion model, working prompt, AM/PDF compiler.                                                                                                                                                                                                                                                                                              |
| `dashboard-navigation.ts`  | `NAV_GROUPS`, phases, `JOURNEY_STEPS`, `JOURNEY_STAGES`, `JOURNEY_BAR`, team-only section set, and the pure reducers for `journey_done` (checked by `dashboard-navigation.check.ts`).                                                                                                                                                                                |
| `journey-progress.tsx`     | The launch meter under "Your journey": leaning cells under four named stages (Get started · Brand foundation · Marketing funnel · Live), ending in a rocket. One cell per thing a client can finish, so a step ticked piece by piece is worth a cell per piece. `JOURNEY_BAR` declares which cells the bar shows — it is a summary, not a mirror of `JOURNEY_STEPS`. |
| `dashboard-chrome.tsx`     | Sign-in gate, section headings, side-menu row, search bar.                                                                                                                                                                                                                                                                                                           |
| `master-brand-fields.tsx`  | `DocField` / `DocRail` / … the document's own inputs.                                                                                                                                                                                                                                                                                                                |
| `onboarding-answers.tsx`   | Submitted form answers and recording summaries.                                                                                                                                                                                                                                                                                                                      |
| `use-dashboard-live.ts`    | Subscribes an open dashboard to its own `dashboard_pages` row, so an AM's tick reaches the client in about a second instead of on their next load. Holds `mergeLiveContent` — the rule for what a live row may overwrite (checked by `use-dashboard-live.check.ts`). Needs the table in the `supabase_realtime` publication (migration `20260914120000`).            |
| `pinned-stories-model.ts`  | Pinned Stories shapes (`pinned_stories.data`), Canva link parsing, arrange helpers, the North Star sample. No React.                                                                                                                                                                                                                                                 |

Two Marketing sections render their own component instead of a block in the page body:
`src/components/application/landing-page-section.tsx` (table `landing_pages`) and
`pinned-stories-section.tsx` + `story-player.tsx` (table `pinned_stories`, bucket `stories`).
Pinned Posts and Pinned Stories render the same Instagram profile surface from
`src/pages/team/mockup-ig/` (`IgProfileScreen`, fed by `buildProfile` in `pinned-posts.tsx`
and the page's one `igProfileInputs`), so the two phones always show one account.
Both follow the same access model: team writes go straight to Supabase under a
team-only policy; the client's review goes through a Netlify function that checks their
email against the dashboard's `allowed_emails` (`landing-page-review.mts`,
`pinned-stories-review.mts`). `canva-import.mts` pulls a Canva design's pages into the
`stories` bucket using the token pair `canva-auth.mts` stores in `canva_connection` (a
service-role-only table, like `ghl_integrations`) when a team member presses Connect
Canva; `netlify/lib/canva.mts` refreshes it before its 4-hour expiry. Netlify needs
`CANVA_CLIENT_ID` / `CANVA_CLIENT_SECRET` from the Canva Developer Portal integration,
whose redirect URL is `https://hgmportal.com/.netlify/functions/canva-auth`. Without a
connection the section falls back to uploading Canva's exported pages, same result.

The Brand Kit's **Generate brand kit** button drafts a palette, fonts and logos from the
client's website, a brand guidelines PDF uploaded to the `brandkits` bucket, or both — the
PDF wins outright where both are given. **No hex is ever invented**, and every part of it
follows from that. The logic is `netlify/lib/brand-kit.mts`; it runs as a job:
`generate-brand-kit-background.mts` (a Netlify background function, 15-minute budget) builds
the draft and stores it in Netlify Blobs (`netlify/lib/brand-kit-jobs.mts`, store
`brand-kit-jobs`), and the dashboard polls `brand-kit-job.mts` for it under a job id it made
itself; only the team member who started a job can read it.

- **Website** (`netlify/lib/site-brand.mts`) runs no model. It scores the colours the site's
  CSS declares by **where they're used** — button and header backgrounds, heading text,
  `<meta name="theme-color">`, `var()` references resolved — and discounts rules whose classes
  appear nowhere on the page, framework palettes (`--tw-*`, `--bs-*`, stock Bootstrap), hover
  and disabled states. Counting occurrences, the first approach, returned black/white/greys on
  every site. It says when evidence is thin (`confident: false` → "Check before saving"): a
  site styled by JavaScript at runtime can't be read without rendering it.
- **PDF** (`netlify/lib/pdf-brand.mts`) reads every printed code verbatim — `#2C302C`,
  `HEX 2C302C`, RGB triples (CMYK/Pantone are never converted) — then shows Claude the PDF
  itself. The model answers with **code IDs from that list, never a hex**, so it can rank and
  name the palette but not add to it; swatches with no printed code come back as a note.

The draft lands in a review card (`src/pages/client/dashboard/brand-kit-draft.tsx`) showing
each swatch's evidence; nothing reaches the kit until the AM picks Replace or Add. The browser
uploads the PDF to storage and sends only its path; never POST the file itself, since
Netlify's request body cap is far smaller than a real brand guide.

Accuracy is measured, not asserted: `scripts/brand-kit-eval/run.mts` scores the site reader
against reference kits measured in a real browser (`fixtures.json`), and
`scripts/brand-kit-eval/pdf-check.mts` is an offline self-check of the PDF path. Run both
before changing either reader. The `/brand-kit` skill measures a site in a real browser for
the cases the button flags, and is how fixtures get (re-)measured.

`client-dashboard-page.tsx` itself is still ~4,700 lines of one component. That
body has not been split — doing so needs real prop-threading, so treat it as a
deliberate separate change rather than something to start mid-task.

The Web Team's **Landing Page** section (`/dashboard?dept=website&tab=landing-page`) is
`src/pages/team/landing-page-directory/`: its **Directory** row holds every client's landing-page
setup and channel links, and its **Prompt Library** row (`tab=landing-page-prompts`) the prompts the
team builds those pages with — two pages of one component, picked by its `page` prop. It is a port of the team's standalone
Landing Page Directory page. The whole directory is one JSON document in `sop_pages` under the
slug `landing-page-directory`, read and rewritten whole through `db-sync.ts`; `directory-seed.ts`
is what shows until the first save writes that row. `directory-model.ts` holds the shapes and
every derived rule (channel links from the domain and the current slugs, the four "needs
attention" checks, live/tags status) with no React, and the rest are the screens: picker, cards,
overview, table, editor, peek, prompt library. Editing rides the dashboard's own edit mode.

Its third row, **Client Asset Collection** (`tab=asset-collection`), is `src/pages/team/asset-collection/`:
the team's standalone `media-collection-form.html` (the Media Collection Form, which saves a new client's
landing-page photos and text to Google Drive through a Google Apps Script web app), copied verbatim and
shown in an unsandboxed `srcDoc` iframe by `asset-collection-screen.tsx`, loaded lazily with `?raw` so it
is its own chunk. It posts to Apps Script, not Supabase, and stays light in dark mode by its own choice.
To update it, copy the new file over under the same name; it is in `.prettierignore` so `prettier --write .`
leaves it alone. Never edit it here.

The **Industry Acumen Dictionary** (`/dictionary`, behind `TeamGate`) is `src/pages/team/dictionary/`:
`dictionary-model.ts` holds the shape, labels and the in-browser search (pure; `dictionary-model.check.ts`
pins the brief's searches), `dictionary-screen.tsx` the page. Its data, `src/data/ref_dictionary-v2-253.json`,
is a master maintained OUTSIDE this repo: replace it whole under the same name, never edit it here. Load it
only through `loadDictionary()` (`dictionary-data.ts`) — the page and the header `SearchBar`'s terms share it,
and a static import would put ~45 KB on every page. The page renders the dashboard's own Docs menu
(`DocsSideMenu`, exported from `dashboard-screen.tsx`) in the dashboard's layout, so the menu doesn't move
between Docs pages. Its Resources PDFs are dropped into `src/assets/dictionary-resources/`. See
`docs/dictionary.md`.

Under it, the **check** (`/dictionary/check`), its **results** (`/dictionary/check/results`) and
**flashcards** (`/dictionary/practice`) live in `src/pages/team/dictionary/check/`, all in the shared
`dictionary-layout.tsx`. The question bank is `src/data/check-bank.json`, a byte-for-byte copy of
`reference/industry-acumen-check/data/check-bank.json` (generated by that folder's builder; never edit
either by hand), loaded only through `loadCheckBank()`. Every scored unit is one dictionary slug, and
the tier comes from the dictionary. Run `check-bank.check.ts` after changing either JSON. Results go to
`check_attempts` / `check_answers` / the `check_term_status` view (migration `20261001120000`): right
or wrong per term only, never the typed answer, and each person sees only their own. **It's a learning
aid with no pass mark: don't add any cross-person view or roll-up without asking.** The check needs a
Google session (the team password has none). "Reset your results" deletes a person's own rounds; it needs
migration `20261006120000_check_reset.sql`, run by hand in the SQL editor. See `docs/dictionary-check.md`.

Beside it, the **tools** pages in `src/pages/team/dictionary/tools/`: **Sort the stack**
(`/dictionary/tools/review`), a three-round drag-and-drop sort for the team training session that doubles
as the **tools check**, its results (`/dictionary/tools/review/results`), and the tools training
(`/dictionary/tools/practice`), all behind `TeamGate`. `/acumen-sort` is the same game with no
sign-in, as the session's backup: public, so its route stays above the client-slug catch-all and
`acumen-sort` is in `RESERVED_SLUGS`. The game is built from `src/data/industry-acumen-sort-cards.json`,
whose master is in the Claude project (replace it whole; never edit its wording here), and refuses
to play while any card says `"verify": true`, as `sort-model.check.ts` does. The training doesn't wait on
verify: it's one flashcard per vendor in the icon manifest `src/data/vendor-icons.json` (also a Claude
project copy, replaced whole), with what the vendor is known for (`main`) and everything else it sells on the back.
The training and the game give **one answer per vendor**: a box counts when the vendor sells that job under its
own name, in a plan or as a paid add-on, and `vendor-icons.check.ts` fails (`boxClashes`) unless a card's box
and `also` (or a suite's `does`) are exactly its vendor's manifest boxes, so change both files together. Every
box in the card list is a **pool**: each run deals three cards a box and three of round 3's six suites
(`drawRun`), so no two runs match. A finished run on `/dictionary/tools/review` is kept in this browser only
(`tools-results-model.ts`, key `hgm_tools_check`; never Supabase, so slide 44's "Nothing leaves your device"
holds), with its score, the tools to refresh and a reset on the results page. Both portal copies lead their
masters: on 6 Oct, at Kyle's request, card list 2.1 to 3.0 and manifest 1.1 to 1.3 were edited here from the
5 Oct vendor check (`reference/industry-acumen-sort/verification-2026-10-05.md`), and 1.3 follows the Client
Tech Stack Guide PDF where the two differed. The rule, the answer key and everything the Claude project still
needs are in `reference/industry-acumen-sort/slide-corrections-2026-10-06.md`. The Claude
project needs these copies before another comes in, so compare any new copy before replacing. Both draw the icons
from `public/vendor-icons/{128,512}/`: the game finds a card's icon by vendor name through the manifest's
`card_name_to_slug` (never a logo field in the card list), the training by the manifest's own slugs, as
`vendor-icons.check.ts` checks. The game sends nothing (the plain frame's theme button keeps the
portal's usual `ui-theme`, as the floating toggle does).
The check and the game share `dictionary/drag-board.tsx` (drag, tap-then-tap and keyboard placing),
and the two decks share `dictionary/flashcards.tsx`. See `docs/dictionary-tools.md`.

`reference/` at the repo root is team material (design mockups, SOP screenshots,
design-tool exports) and is **not** read by the app; only `src/` is bundled and only
`public/` is served. See [reference/README.md](reference/README.md).

## State & key files

- Theme context: `src/providers/theme-provider.tsx`; router: `src/providers/router-provider.tsx`.
- Use React Aria's built-in state; local state for component-specific data; context for shared state.
- Utilities: `src/utils/cx.ts`, `src/utils/is-react-component.ts`; hooks in `src/hooks/`.
- Styles: `src/styles/globals.css`, `theme.css` (edit `--color-brand-*` to rebrand), `typography.css`.

## Persistence (Supabase)

Editable page content persists to **Supabase** — the single source of truth. There is no secondary database.

**Client:** `src/lib/supabase.ts` — uses anon/publishable key (never `service_role`/secret in client code). When adding any `insert`/`update`/`delete`, ensure RLS policies cover BOTH `anon` and `authenticated` roles.

**`sop_pages` helpers:** for owner guides, templates and the project-log pages, use `src/lib/db-sync.ts` rather than calling `supabase.from("sop_pages")` directly, so the table name and error handling stay in one place:

- `readSopPage(slug)` — returns the row; **throws** when it's missing (callers rely on that to fall back to seed content or a master template)
- `writeSopPage(slug, data)` — upserts the row; **throws** on failure (callers render an unsaved/error state, so never swallow it)
- `src/lib/db-logger.ts` provides colored dev-console logging for these ops

**Who changed what:** every client-dashboard Save writes one row to `dashboard_updates` through
`src/lib/dashboard-updates.ts`, and `/log` (`src/pages/team/log-screen.tsx`) is the team-only feed
that reads them. The diff lives in `dashboard-updates-model.ts` — pure, with a self-check beside it.
Two rules when touching it: it records section and field **names only** (`dashboard_pages.data`
carries `share_password` and everything a client wrote, so a value copied here is a value leaked
twice), and every write is best-effort and never thrown — an audit line that fails must not read to
an AM as a dashboard that wouldn't save. Landing Page and Pinned Stories keep their own tables and
persist on every keystroke, so only their **publish** is logged, not each save.

**AM emails on form submit:** submitting the Onboarding Form (`/{base}-onboarding`) or the Account
Access Form (`/{base}-access`) calls `netlify/functions/form-submitted.mts`, which sends the client's
AM one email per form (cc `FORM_SUBMISSION_CC` — Dustin, Gillian, Makenna, Alicia) through Resend (`RESEND_API_KEY`, `RESEND_FROM`, set in the Netlify UI). The AM
is resolved as `clients.link` → `clients.am` (a name) → `netlify/lib/team-emails.mts`; keep that map
in step with `ACCOUNT_MANAGERS`. Each form row sends once (`client_onboarding_pages.am_notified_at`),
and the access email names which logins were shared, never their values.

> Firebase Firestore was a dual-write fallback here until 2026-08-06. It was removed because Firestore's rules denied the anon client both reads and writes — every fallback read failed and every backup write was silently swallowed, so it could not have survived an outage. Don't reintroduce a second database without rules that actually permit the client.

**Local offline dev:** Run `supabase start` (Docker) to spin up a local Supabase stack on ports 54321 (API) / 54322 (DB). Update `.env.local` to point `VITE_SUPABASE_URL` to `http://127.0.0.1:54321`.

The Supabase CLI is linked; schema lives in `supabase/migrations/`. Local dev reads `.env.local`.

Production `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` are set in `netlify.toml`'s
`[build.environment]` — Netlify runs the production build, so that file is what reaches the live
bundle — it is the only place a production value needs changing. CI (`ci.yml`) deliberately builds
without them, because it discards its bundle and `src/lib/supabase.ts` falls back to placeholders.

## Deploy

Netlify is connected to the GitHub repo (`hgmwebteam/hgm-doc`) — pushing `main` auto-builds and
deploys. Netlify runs the build itself from `netlify.toml`, so that file's `[build]` and
`[build.environment]` are what shape the live bundle. See the `/ship` skill for the full
build → commit → push → verify flow.

The site serves at **`hgmportal.com`**. `docs-hgm.netlify.app` is only the Netlify subdomain and
301s to the real domain via the host-scoped redirect in `netlify.toml` — so verify a deploy against
`hgmportal.com`, and don't treat the `.netlify.app` URL as the live site.

**`.github/workflows/ci.yml` does not deploy** — it is a type-check gate. It fires on the same push
to `main`, runs `npm ci` and `npm run build` (`tsc -b && vite build`), and stops there, so a red X
on `main` is a genuine build or type error, never a deploy problem.

It used to end in `netlify-cli deploy --prod --no-build` and was named `deploy.yml`. That step
failed on every run (`Unauthorized: could not retrieve project` — an invalid `NETLIFY_AUTH_TOKEN`)
while Netlify shipped the same commit seconds earlier, so every push to `main` carried a red X that
meant nothing. The step was removed rather than repaired: two live deploy paths would race, and they
build from different env sources (GitHub secrets vs. `netlify.toml`), so production could silently
flip backends. Deploys belong to Netlify; type-checking belongs here.
