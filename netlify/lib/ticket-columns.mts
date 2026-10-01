import { type CompletionEmailMode, completionEmailMode } from "../../src/pages/client/help/request-rules.ts";

/**
 * The columns of a request a CLIENT may be handed, and the ones added by hand since.
 *
 * ticket-create, ticket-detail and ticket-withdraw hand back the same row, and until
 * 28 Sep 2026 each carried its own copy of the list; withdraw's had drifted (no priority, no
 * client_slug). Everything a client has no business seeing is absent by construction rather
 * than deleted afterwards: tenant_id, portal_client_id, asana_task_gid, asana_task_url,
 * asana_project_gid, derived_subject, routed_at, route_error and intake_notes are internal
 * routing state, and derived_subject in particular is OUR summary of their words, not
 * theirs. A new column has to be added here on purpose before a client can ever see it.
 * ticket-list and ticket-list-all keep their own narrower lists: a list shows no pages,
 * files or email.
 *
 * ── THE SQL, APPLIED BY HAND (HGM Reporting, ytewxihtllthqkvnmlex) ──────────
 * Nothing here is migrated on deploy. The owner pastes this into the SQL editor (the whole
 * reporting block, with ticket_uploads from ticket-files.mts and the completion email
 * ledger from the platform, is in the reporting v2 spec, section 2.1). Safe to run twice.
 *
 *   alter table public.tickets add column if not exists urls text[];
 *   alter table public.tickets add column if not exists notify_email text;
 *   alter table public.tickets add column if not exists notify_email_listed boolean;
 *   comment on column public.tickets.urls is 'Pages the request applies to: absolute http or https URLs, de-duplicated, at most 10, each at most 2048 characters. Null or empty means none.';
 *   comment on column public.tickets.notify_email is 'The one address that gets the completion email. Lowercased, at most 254 characters. Never an Asana follower, never logged, never returned by ticket-detail.';
 *   comment on column public.tickets.notify_email_listed is 'Whether notify_email could open the request page when the request was raised (on the dashboard access list, or a HiddenGem address). Only the fallback: the completion email decides its link at send time from the access list, and uses this when that read cannot run.';
 *   notify pgrst, 'reload schema';
 *
 * Read-back (expect 3 rows):
 *   select column_name, data_type from information_schema.columns
 *    where table_schema = 'public' and table_name = 'tickets'
 *      and column_name in ('urls', 'notify_email', 'notify_email_listed') order by 1;
 *
 * ── EITHER ORDER IS SAFE FOR A REQUEST ──────────────────────────────────────
 * Every reader and writer of the three columns works before they exist: a select that
 * names one fails with 42703 (Postgres) or PGRST204 (PostgREST's schema cache), and the
 * caller retries with CLIENT_TICKET_COLUMNS alone. A request is never a 500 for want of a
 * column. That is not a licence to deploy the portal first: its only file path needs the
 * ticket_uploads table and the ticket-files bucket (ticket-files.mts).
 *
 * `image_count` keeps its name and now counts ALL attached files, not only images: the
 * column is read on the platform too, and renaming it in two repositories for a word was
 * not worth a second hand-applied change.
 *
 * ── SUBMITTED BY (owner, 28 Sep 2026) ───────────────────────────────────────
 * The name the person typed in the form's required Submitted by field is stored in
 * tickets.submitted_by_name. The column is not new: it has held the signed-in account's
 * name since the first request (verified on the live project 28 Sep 2026: present, and set
 * on every row), so nothing has to be applied before this deploy and no order is imposed.
 * What changes is its meaning, recorded by hand in the same SQL editor (safe to run twice;
 * the first line does nothing where the column exists):
 *
 *   alter table public.tickets add column if not exists submitted_by_name text;
 *   comment on column public.tickets.submitted_by_name is 'The Submitted by name the person typed on the form (required since 28 Sep 2026: trimmed, 2 to 120 characters, no control or invisible character), prefilled with the account''s name. Before 28 Sep 2026 it was the signed-in account''s name. submitted_by (the address) stays the account of record.';
 *   notify pgrst, 'reload schema';
 *
 * Read-back (expect 1 row): select column_name from information_schema.columns
 *   where table_schema = 'public' and table_name = 'tickets' and column_name = 'submitted_by_name';
 *
 * ── WEBSITES (Enjoy Unique Stays, 29 Sep 2026) ──────────────────────────────
 * A multi-site client's request carries which of its brand websites it is for, copied by
 * ticket-create from the dashboard row's data.websites (request-rules.ts chooseWebsites).
 * Applied by the orchestrator BEFORE the portal deploy; safe to run twice:
 *
 *   alter table public.tickets add column if not exists websites jsonb;
 *   comment on column public.tickets.websites is 'The websites of a multi-site client that the request is for, chosen on the form: {"offered": n, "chosen": [{"name": text, "url": https URL, "tenant_slug": text}]}. The chosen entries are copied by ticket-create from the dashboard row''s data.websites at the time of the request, in the row''s order, never from what the browser sent; offered is how many the row offered (2 or more), so chosen = offered means every website. Null when the dashboard offers no choice.';
 *   notify pgrst, 'reload schema';
 *
 * Read-back (expect exactly 1 row: websites | jsonb | YES):
 *   select column_name, data_type, is_nullable from information_schema.columns
 *    where table_schema = 'public' and table_name = 'tickets' and column_name = 'websites';
 *
 * No CHECK constraint on purpose: a shape bug in our own writer must not make every such
 * request fail its insert and cost a client their words, so every reader validates instead
 * (storedWebsitesOf here, readWebsites on the platform). Every reader and writer walks a
 * ladder (readDownLadder below) that drops ONE column per "column does not exist", newest
 * first: with urls present and websites absent, the old two-step fallback would have dropped
 * the pages as well. A client may see the websites (they are theirs), so the column is not in
 * CLIENT_HIDDEN_COLUMNS; tenant_slug goes with it, the same value the anon-readable row holds.
 *
 * ── WHAT A CLIENT IS NOT HANDED (owner, 28 Sep 2026) ────────────────────────
 * A client never sees a promised or estimated date or who a request is assigned to, so the
 * answers a client's own call gets carry neither: clientView() drops promised_date,
 * assignee_name and assignee_email from the row, and completed_by too (the address of whoever
 * closed the Asana task, which is nearly always the assignee). ticket-detail leaves the events
 * that name them (CLIENT_HIDDEN_EVENTS) off the timeline, and clientEvents() sends a completion
 * without its "Completed by <name>" line and its actor: the page draws only its time. Staff keep
 * all of it: the team's success card polls ticket-detail for the assignee, and the team's list
 * reads its own columns.
 *
 * House style: no em or en dashes anywhere.
 */

/** Today's create/detail list, verbatim. */
export const CLIENT_TICKET_COLUMNS =
    "id, reference, topic, title, status, created_at, detail, property, needed_by, priority, image_count, drive_folder_url, client_slug, client_name, submitted_by, submitted_by_name, assignee_name, assignee_email, account_manager_email, account_manager_name, promised_date, completed_at, completed_by, withdrawn_at, withdrawn_by";

/** The list plus the pages the request is about. */
export const withPages = (cols: string): string => `${cols}, urls`;

/** The list plus the websites a multi-site client chose (the WEBSITES block above). */
export const withWebsites = (cols: string): string => `${cols}, websites`;

/** What create, detail and withdraw read, widest first: each step drops only the newest column. */
export const CLIENT_COLUMN_LADDER = [withWebsites(withPages(CLIENT_TICKET_COLUMNS)), withPages(CLIENT_TICKET_COLUMNS), CLIENT_TICKET_COLUMNS] as const;

/** Read only inside ticket-create (whose answer strips notify_email_listed) and ticket-detail's own read (which answers a boolean). Never in a list. */
export const NOTIFY_COLUMNS = "notify_email, notify_email_listed";

/** Kept from a client's answers (see the header); still read for staff. */
export const CLIENT_HIDDEN_COLUMNS = ["promised_date", "assignee_name", "assignee_email", "completed_by"] as const;

/** Events a client's timeline never receives: routing's internals, the assignee, the promised date. */
export const CLIENT_HIDDEN_EVENTS = ["route_failed", "assigned", "promised_date_set"] as const;

/** A row as a caller may see it: unchanged for staff, without CLIENT_HIDDEN_COLUMNS for a client. */
export const clientView = <T extends Record<string, unknown>>(row: T, via: "allowlist" | "staff"): T => {
    if (via === "staff") return row;
    const out: Record<string, unknown> = { ...row };
    for (const col of CLIENT_HIDDEN_COLUMNS) delete out[col];
    return out as T;
};

/**
 * A timeline as a caller may see it: unchanged for staff; for a client, a completion keeps its
 * kind and its time but not its body ("Completed by <name>") or who closed the task, which is
 * nearly always the assignee. Every other kind a client receives is theirs or signed for them:
 * received and withdrawn are their own, and a team update carries its writer's name on purpose.
 */
export const clientEvents = <T extends Record<string, unknown>>(events: T[], via: "allowlist" | "staff"): T[] =>
    via === "staff" ? events : events.map((e) => (e.kind === "completed" ? ({ ...e, body: null, actor_name: null, actor_email: null } as T) : e));

type DbError = { code?: string | null; message?: string | null } | null | undefined;

/** A column the query names does not exist yet (the SQL above not pasted, or the schema cache not reloaded). */
export const isMissingColumn = (error: DbError): boolean => {
    if (!error) return false;
    if (error.code === "42703" || error.code === "PGRST204") return true;
    return /column .* does not exist|could not find the '.*' column/i.test(error.message ?? "");
};

/**
 * Reads with the first list of `ladder` the database can answer, widest first. A step whose
 * error says a named column does not exist (isMissingColumn: 42703, PGRST204) moves to the
 * next; the first answer that is not that, success or any other error, is returned as it is,
 * with `columns` naming the list it used (a later write selects the same list back). Any
 * other error is never retried: it is not about a column, and a second read would only hide
 * it. The last step's answer is returned whatever it says.
 */
export async function readDownLadder<T extends { error: DbError }>(ladder: readonly string[], read: (cols: string) => PromiseLike<T>): Promise<T & { columns: string }> {
    if (ladder.length === 0) throw new Error("readDownLadder needs at least one column list");
    for (let at = 0; ; at++) {
        const columns = ladder[at];
        const result = await read(columns);
        if (at === ladder.length - 1 || !isMissingColumn(result.error)) return { ...result, columns };
    }
}

/** A table the query names does not exist yet. */
export const isMissingTable = (error: DbError): boolean => {
    if (!error) return false;
    if (error.code === "PGRST205" || error.code === "42P01") return true;
    return /could not find the table|relation .* does not exist/i.test(error.message ?? "");
};

/**
 * The completion email switch, read at CALL time from the same variable Vite inlines into
 * the browser (VITE_TICKET_COMPLETION_EMAIL on docs-hgm), the way reporting.mts reads
 * VITE_SUPABASE_URL. Read per call, not at load, so a proof can set it in-process. Unset is
 * "off": no address is stored and nothing promises an email.
 */
export const completionEmailModeNow = (): CompletionEmailMode => completionEmailMode(process.env.VITE_TICKET_COMPLETION_EMAIL);

/** One field, capped, for whoever picks the ticket up. `intake_notes` is the only free-text
 *  column on the row a human reads, and routing overwrites it with its own reason if it
 *  later fails, which is the right precedence: a live routing failure matters more than a
 *  mapping gap recorded on receipt. */
export const asNote = (notes: string[]): string | null => {
    const joined = notes
        .map((n) => n.trim())
        .filter(Boolean)
        .join(" ");
    return joined ? `Unresolved on receipt: ${joined}`.slice(0, 900) : null;
};
