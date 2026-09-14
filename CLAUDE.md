# hgm-doc

A client-facing **guide / documentation site** (Meta Pixel setup, website popups, owner guides) built on the **Untitled UI React** component system. Deployed as a static Vite SPA to Netlify, serving at `hgmportal.com`.

> Detailed reference is split into path-scoped rules that load on demand:
> - **Components & patterns** → [.claude/rules/components.md](.claude/rules/components.md) (loads for `src/components/**`, `src/pages/**`)
> - **Color tokens** → [.claude/rules/colors.md](.claude/rules/colors.md) (loads for `src/**/*.tsx`, `src/**/*.css`)
> - **Icons** → [.claude/rules/icons.md](.claude/rules/icons.md) (loads for `src/**`)

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

**Named routes** — templates and internal team pages: `/popup`, `/owner-guide(/:slug)` (templates); `/dashboard`, `/roadmap` (the "Project Management" page), `/requests`, `/settings`, `/designsystem`, `/webteam/ai-website-setup` (team-internal). A `PAGES_WITHOUT_FLOATING_CHROME` array in `main.tsx` suppresses the global floating theme toggle on internal pages (their icon-rail chrome has its own).

**Client slugs** — the catch-all `/:clientSlug` route goes to `src/pages/client/client-screen.tsx`, which dispatches on the slug suffix to a page component + Supabase table:
- `/{client}-leadcapture` → `PopupPage`, table `leadcapture_pages`
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

## Commands
```bash
npm run dev     # Vite dev server (defaults to :5173 — use the /dev skill to avoid port collisions)
npm run build   # tsc -b && vite build (production build + type-check)
npm run preview # Preview production build locally
npx prettier --write .  # Format code (no npm script; Prettier configured in .prettierrc)
```
**Note:** No ESLint, test, or dedicated typecheck scripts exist. Type-checking happens inside `npm run build` via `tsc -b`. No test runner is configured.

**Project skills:** `/dev` (start dev server on a clean port), `/ship` (build → commit → push → verify deploy), `/startworking` (start-of-day: sync branch, dev server, plan), `/wrapup` (end-of-day: log work on `/roadmap`, merge to `main`, verify deploy).

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

| Module | Holds |
| :-- | :-- |
| `dashboard-model.ts` | Stored shapes, `TEMPLATE_CONTENT`, `mergeContent`, `SectionId`, pure helpers. No React. |
| `overview-doc.ts` | The team-only Client Overview brief's field list. |
| `master-brand-document.ts` | The eleven sections, completion model, working prompt, AM/PDF compiler. |
| `dashboard-navigation.ts` | `NAV_GROUPS`, phases, `JOURNEY_STEPS`, team-only section set. |
| `dashboard-chrome.tsx` | Sign-in gate, section headings, side-menu row, search bar. |
| `master-brand-fields.tsx` | `DocField` / `DocRail` / … the document's own inputs. |
| `onboarding-answers.tsx` | Submitted form answers and recording summaries. |
| `pinned-stories-model.ts` | Pinned Stories shapes (`pinned_stories.data`), Canva link parsing, arrange helpers, the North Star sample. No React. |

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

`client-dashboard-page.tsx` itself is still ~4,700 lines of one component. That
body has not been split — doing so needs real prop-threading, so treat it as a
deliberate separate change rather than something to start mid-task.

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

> Firebase Firestore was a dual-write fallback here until 2026-08-06. It was removed because Firestore's rules denied the anon client both reads and writes — every fallback read failed and every backup write was silently swallowed, so it could not have survived an outage. Don't reintroduce a second database without rules that actually permit the client.

**Local offline dev:** Run `supabase start` (Docker) to spin up a local Supabase stack on ports 54321 (API) / 54322 (DB). Update `.env.local` to point `VITE_SUPABASE_URL` to `http://127.0.0.1:54321`.

The Supabase CLI is linked; schema lives in `supabase/migrations/`. Local dev reads `.env.local`.

Production `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` are set in `netlify.toml`'s
`[build.environment]` — Netlify runs the production build, so that file is what reaches the live
bundle — it is the only place a production value needs changing. CI (`ci.yml`) deliberately builds
without them, because it discards its bundle and `src/lib/supabase.ts` falls back to placeholders.

## Deploy
Netlify is connected to the GitHub repo (`AnhTuan-hgm/hgm-doc`) — pushing `main` auto-builds and
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



## Project facts for agents

The `ui-*` agents (designer, motion, mockup, media, artwork, inspiration) live at
user level in `~/.claude/agents/` and carry no project paths of their own. This
block is the contract. A row that isn't here doesn't exist — the agent should say
so rather than invent a location. Machine-wide shared assets are declared in
`~/.claude/CLAUDE.md`; rows here override those.

| fact | this project |
| --- | --- |
| Brand / sector / audience | HiddenGem Media — marketing agency for short-term-rental / vacation-property hosts. Two audiences on one site: the internal team (account managers, web team) and the hosts themselves. Client-facing surfaces are calm and plain-spoken; internal ones are dense and tool-like |
| Public site routes | Registered flat in `src/main.tsx`. Client-facing: `/{client}-dashboard`, `/{client}-metapixel`, `/{client}-leadcapture`, `/owner-guide/:slug`, and the three intake forms (`/brand-vision-form`, `/client-onboarding-form`, `/host-onboarding-form`). Team-only behind the sign-in gate: `/dashboard`, `/home`, `/roadmap`, `/manual`, `/questions`, `/requests`, `/settings`, `/designsystem`, `/deployment`, `/fix`, `/log-script`, the `*-overview` project logs, and `/webteam/*`. Page components live in `src/pages/{client,team,overviews,templates}/` |
| Shared UI primitives | `src/components/base/**` (Button, Input, Select, Badge, Avatar…), `application/**` (Modal, Table, DatePicker, icon-rail…), `foundations/**` (FeaturedIcon), `marketing/**` |
| Project-written components | Not kept in a separate tree — hand-written and vendored share `src/components/**`. `shared-assets/` holds the hand-written ones (`reveal.tsx`, `image-lightbox.tsx`, `section-divider.tsx`). Check `git log` on a file before assuming which it is, because a CLI sync can overwrite a vendored path |
| Component system | Untitled UI React (React Aria Components + Tailwind v4), vendored under `src/components/{base,application,marketing,foundations}`. The licence is saved machine-wide in `~/.untitledui/config.json`, not in the repo, so `npx untitledui@latest add` **does** work on this machine — prefer it over hand-writing a component. PRO packages resolve through `UNTITLEDUI_PRO_TOKEN`, read by `.npmrc` — `~/.npmrc` locally, a **Netlify UI env var** for the production build (it is *not* in `netlify.toml`, yet Netlify's `npm ci` installs `@untitledui-pro` fine, so it must be set under Site settings → Environment variables), and a **GitHub Actions secret** for `ci.yml` (which trims whitespace off it, because a trailing newline surfaces as an indistinguishable `401 Invalid API key`). A fresh Claude Code web container needs it in the environment config too, or setup fails at `npm ci`. There is no Link component: `Button` takes `href` |
| Icon package | `@untitledui/icons` (free, line-only) and `@untitledui-pro/icons` (PRO, subpath per style — `line`, `duocolor`, `duotone`, `solid`; there is no bare root export). Verify a name exists in `node_modules/@untitledui-pro/icons/dist/line/index.d.ts` (or `node_modules/@untitledui/icons/dist/<Name>.d.ts`) before importing |
| Semantic colour tokens | Full list in `.claude/rules/colors.md`; values in `src/styles/theme.css` — the alias layer utilities actually read. Brand is blue: `--color-brand-600: rgb(0 102 222)` / `#0066DE`. Never use raw palette utilities (`text-gray-900`, `bg-blue-700`) — they break dark mode |
| Canvas | Both. `ThemeProvider` (`src/providers/theme-provider.tsx`) toggles a `dark-mode` class on `<html>`, defaults to `system`, and persists to localStorage `ui-theme` — so **every surface must work in light and dark**, and contrast is checked in both before shipping |
| Generated / raster assets | `public/` for static brand files (`hgm logo/`, `hgm video/`). Client-uploaded images are **not** files: they go through `compressImageFile()` (`src/utils/compress-image.ts`, ≤1600px, WebP ~0.82, SVG/GIF pass through) and are stored base64 in Supabase. Larger media uses Supabase Storage buckets `videos`, `brandkits`, `recordings`. Existing `public/` folders have spaces and capitals (`Section 3 Images`, `hgm video`) — use lowercase hyphenated names for anything new, since a capital will 404 on Netlify |
| Device bezels (prepared) | `public/device-mockups/` — six committed frames: three iPhones, a MacBook Air 13 and an iPad Pro 11 in both orientations. They are COPIES: the canonical files and their screen insets live in `~/Documents/For_You_Claude/device-bezels/prepared/` (`manifest.json`), shared with the hiddengem-media repo. Pull them in with `node ~/Documents/For_You_Claude/device-bezels/prepared/sync.mjs --into public/device-mockups <id…>`, which prints the insets to record. Never re-measure per project, and never re-crop here — re-crop in the library so both repos move together. They must stay committed: Netlify builds from the clone, so nothing outside the repo exists at build time. The screen is a true cut-out (alpha 0 at its centre), so screen content goes BEHIND the frame. `/test` (`src/pages/team/test-screen.tsx`) is the working example. `src/components/shared-assets/iphone-mockup.tsx` is a separate, unused Untitled UI SVG frame, imported nowhere |
| Video | `public/hgm video/` holds the committed sign-in backdrop (a 4K leaf-shadow `.webm` loop plus a `.webp` poster, 556K total). `.gitignore` does **not** block video, so check the weight before adding more — git keeps every version forever. Client video guides are Loom URLs or mp4s in the Supabase `videos` bucket, never committed |
| Motion library | `motion` v12 (`motion/react`), plus `tailwindcss-animate`. House micro-transition is `transition duration-100 ease-linear`. Side-menu nav items stagger at 0.05s (icon rails do not animate). Scroll reveals go through `src/components/shared-assets/reveal.tsx` (fade + 24px rise, fires once, 120px pre-trigger) — copy its idiom rather than hand-rolling |
| Text effects | `src/components/marketing/text-effects/text-fx.tsx` — `TextFx`, ported from the HiddenGem marketing site. Five presets (`fade-up`, `mask-rise`, `blur-in`, `scale-in`, `scramble`), reduced-motion and `aria-label` handled inside. Headings and short lines only; never hand-roll a split-text animation beside it. The `/textfx` skill carries the catalog and the extension rule |
| No-animation routes | `/manual` and every sign-in gate (`DashboardAccessGate`, `TeamGate`, the owner-guide share gate) take NO entrance animation. The three client intake forms (`/brand-vision-form`, `/client-onboarding-form`, `/host-onboarding-form`) allow micro-interactions only — a form that moves mid-answer is hostile. Everything else is open. `/animation` audits against this |
| Dev server | `npm run dev -- --port 5180 --strictPort` → `http://localhost:5180`. The `/dev` skill pins that port; `vite.config.ts` pins none, so a bare `npm run dev` lands on Vite's default 5173. Vite proxies `/.netlify/functions/*` to `http://localhost:9999`, which is **not** started by `npm run dev` — run `netlify functions:serve --port 9999` alongside it or every function call 502s |

Not declared, deliberately: no light-section-inverting classes (the whole app themes
at once), no inspiration library, no owed-asset convention. Device bezel **sources** come from the shared
library in `~/.claude/CLAUDE.md`. Add a row when one of these becomes true.
