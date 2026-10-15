# HGM SOP content schema — v2

v2 is **purely additive** over the format `hgm_doc.py` already reads. Every field
below is ignored by the renderer, so a v2 file produces a byte-identical PDF —
verified pixel-by-pixel across all three pages of the approved reference SOP.

A v1 file is a valid v2 file. `sop_schema.py stamp` upgrades one in place.

## What v2 adds, and why the portal needs it

### meta

| Field | Example | Why |
|---|---|---|
| `schema_version` | `2` | Lets the portal reject files it cannot read |
| `slug` | `env-files-in-1password` | The URL segment |
| `dept` | `WEB` | Sidebar tree; must agree with `sop_id` |
| `number` | `1` | Sequence within the department |
| `status` | `draft` | `draft` / `in_review` / `live` / `archived` |
| `updated_at`, `updated_by` | | Review queue and revision history |
| `source` | `{"kind":"scribe","url":"https://…"}` | Where the procedure came from. `kind`: `manual`, `scribe`, `transcript`, `imported` |
| `tasks` | `[{"label":"Get a file onto my machine","hint":"…","proc":"6.1"}]` | The "What are you trying to do?" picker, on the SOP and on the dashboard |

### blocks

| Block | Added | Why |
|---|---|---|
| `sub` | `id` (`"6.1"`), `task` | Gives each procedure identity so tasks can route to it |
| `rows` items | `id` (`"WEB-001.6.1.4"`) | **The one that matters** — what a checkmark is saved against |
| `figure` | `alt` | Accessibility in the portal; the PDF uses `caption` |

## Step ids

Format: `{DEPT}-{NUMBER}.{PROC}.{N}` — for example `WEB-001.6.1.4`.

`sop_schema.py stamp` assigns ids **once and never renumbers**:

- An id already present is never touched.
- Rewording step 4, or inserting a step above it, leaves every existing id alone —
  so nobody's saved run progress moves.
- A deleted step retires its id permanently. It is never reissued, so a stale run
  referencing it resolves to "this step no longer exists" rather than silently
  pointing at a different instruction.

This is why the master is structured content and not HTML. In HTML a checkmark can
only be saved against a DOM position, which changes whenever anyone edits a
paragraph above it.

## Usage

```bash
python3 sop_schema.py validate content.json     # exits non-zero on problems
python3 sop_schema.py stamp    content.json     # assigns ids in place
python3 sop_schema.py stamp    in.json out.json # or to a new file
```

`stamp` is idempotent — running it twice assigns nothing the second time.

`validate` checks: SOP id format and agreement with `dept`/`number`, slug shape,
status enum, date formats, required renderer fields, `source.url` present when the
kind is `scribe`, duplicate procedure and step ids, figures having both a path and
a caption, every task routing to a real procedure, and the document ending in a
`band`.

## What the portal reads

- **Route** — `slug`, `dept`, `number`, `status`
- **Sidebar tree** — `dept`, with `status = live`
- **Task picker** — `meta.tasks`, routing to `sub.id`
- **Page body** — `blocks`, rendered by the same vocabulary as the PDF
- **Run state** — `rows[].id`, joined against `sop_runs.checked_step_ids`
- **Review queue** — `next_review`, `status`, `updated_at`
- **Provenance** — `source`
