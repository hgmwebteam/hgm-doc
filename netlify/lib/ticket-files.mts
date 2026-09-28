import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
    DAILY_FILES_REACHED,
    FILES_UNAVAILABLE,
    MAX_FILES,
    MAX_FILE_BYTES,
    TOO_MANY_FILES,
    fileCountError,
    fileSizeError,
    fileTypeError,
    storedFileName,
    uploadTypeFor,
} from "../../src/pages/client/help/request-rules.ts";
import { type Caller, type Via, portalDb, reportingDb } from "./reporting.mts";
import { asNote, isMissingTable } from "./ticket-columns.mts";

/**
 * The files a request carries: the private bucket they are uploaded into, and the ledger
 * that says whose each one is.
 *
 * Lives in netlify/lib rather than netlify/functions on purpose: Netlify routes every
 * top-level file in the functions directory as its own endpoint, so a helper put there
 * would be publicly callable.
 *
 * ── WHY THE BYTES NEVER PASS THROUGH A FUNCTION ─────────────────────────────
 * A Netlify function takes a request body of about 6 MB, and files used to ride inside
 * ticket-create's JSON as base64: one uncompressible 3 MB PDF filled it. Now the browser
 * uploads each file straight to Storage through a single-object signed upload URL minted by
 * ticket-upload-url, and ticket-create receives only ids. A 25 MB PDF costs a function
 * nothing.
 *
 * ── WHY A LEDGER (ticket_uploads) ───────────────────────────────────────────
 * Without it ticket-create would have to trust a storage path sent by the browser, and a
 * path is just a string: anyone could name another person's upload. Every signed URL is
 * minted with a row here, bound to the VERIFIED caller, so at submit time the server looks
 * the paths up by id and proves each file is this caller's (and, for a client, this
 * dashboard's), exists, and is the size and type it says. A row belongs to exactly one
 * request (claimUploads is a compare-and-set). And a file that was uploaded and never sent
 * is findable without listing the bucket, which is what the daily cleanup
 * (ticket-uploads-cleanup.mts) removes.
 *
 * ── THE SQL, APPLIED BY HAND ────────────────────────────────────────────────
 * Nothing here is migrated on deploy, and the PORTAL must not deploy before both blocks are
 * applied and read back: its only file path needs them, and the old base64 path is gone.
 *
 * (1) HGM Reporting (ytewxihtllthqkvnmlex), SQL editor. Safe to run twice.
 *
 *   create table if not exists public.ticket_uploads (
 *     file_id uuid primary key,
 *     upload_id uuid not null,
 *     submitted_by text not null,
 *     client_slug text,
 *     bucket text not null,
 *     path text not null unique,
 *     file_name text not null,
 *     mime text not null,
 *     declared_bytes bigint not null,
 *     ticket_id uuid references public.tickets(id) on delete set null,
 *     claimed_at timestamptz,
 *     removed_at timestamptz,
 *     created_at timestamptz not null default now()
 *   );
 *   create index if not exists ticket_uploads_upload_idx on public.ticket_uploads (upload_id);
 *   create index if not exists ticket_uploads_caller_idx on public.ticket_uploads (submitted_by, created_at);
 *   create index if not exists ticket_uploads_open_idx on public.ticket_uploads (created_at) where ticket_id is null and removed_at is null;
 *   alter table public.ticket_uploads enable row level security;
 *   revoke all on public.ticket_uploads from anon, authenticated;
 *   notify pgrst, 'reload schema';
 *
 *   Read-back: select tablename, rowsecurity from pg_tables where schemaname = 'public'
 *   and tablename = 'ticket_uploads';  (one row, true)
 *
 * (2) The PORTAL project (iymhjrmmgwrxdggcvmjn, behind api.hgmportal.com), SQL editor. Also
 *     supabase/migrations/20260928120000_ticket_files_bucket.sql in this repo.
 *
 *   insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
 *   values (
 *     'ticket-files', 'ticket-files', false, 26214400,
 *     array[
 *       'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/avif',
 *       'application/pdf',
 *       'application/msword',
 *       'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 *       'application/vnd.ms-excel',
 *       'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
 *       'text/csv',
 *       'text/plain'
 *     ]
 *   )
 *   on conflict (id) do update
 *     set public = excluded.public,
 *         file_size_limit = excluded.file_size_limit,
 *         allowed_mime_types = excluded.allowed_mime_types;
 *
 *   Read-back: select id, public, file_size_limit, allowed_mime_types from storage.buckets
 *   where id = 'ticket-files';  (false, 26214400, 14 types). Storage settings: the project's
 *   upload limit is at least 25 MB.
 *
 * PRIVATE and with NO storage.objects policies on purpose: the browser writes only through
 * single-object signed upload URLs minted here with the service key, nobody reads from the
 * browser, and the platform downloads with the service key. A new bucket rather than
 * widening `ticket-images`: that one holds files a server wrote, which existing
 * ticket_attachments rows still point at, and the orphan cleanup must never touch them.
 *
 * Until (1) exists, ticket-upload-url answers 503 with FILES_UNAVAILABLE and the request
 * still sends without files. Files are kept as long as the request exists (owner, 28 Sep
 * 2026); only a file nobody sent is removed.
 *
 * House style: no em or en dashes anywhere.
 */

export const TICKET_FILES_BUCKET = "ticket-files";
/** An upload nobody sent within this long is an orphan. Signed upload URLs live two hours. */
export const ORPHAN_AFTER_HOURS = 24;
/** Files one caller may mint in 24 hours (owner, 28 Sep 2026: 100 a day, plus 10 per request). */
export const DAILY_FILE_CAP = 100;
const ORPHAN_BATCH = 500;
const REMOVE_CHUNK = 100;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

/** The first 20 hex characters of sha256(lowercased verified email), so no address is ever part of an object key. */
export const callerKey = (email: string): string => createHash("sha256").update(String(email).trim().toLowerCase()).digest("hex").slice(0, 20);
/** Everything one form session uploaded, under one prefix. */
export const uploadPrefix = (key: string, uploadId: string): string => `uploads/${key}/${uploadId}`;
/** No client-typed text is ever part of a key; the human name lives in the ledger. */
export const uploadPath = (key: string, uploadId: string, fileId: string, ext: string): string => `${uploadPrefix(key, uploadId)}/${fileId}.${ext}`;

/** Where the clients come from. Swapped for fakes by ticket-files.check.mts; nothing else passes one. */
export type FileDeps = { reporting: () => SupabaseClient; portal: () => SupabaseClient; now: () => number; uuid: () => string };
const LIVE: FileDeps = { reporting: reportingDb, portal: portalDb, now: () => Date.now(), uuid: () => randomUUID() };

export type Refusal = { ok: false; status: number; error: string };
const refuse = (status: number, error: string): Refusal => ({ ok: false, status, error });
const UNAVAILABLE = refuse(503, FILES_UNAVAILABLE);
const OUR_END = refuse(500, "Something went wrong at our end. Nothing was lost. Try again in a moment.");
/** A ledger error: the table not there yet is the 503 sentence; anything else is ours, logged with the upload id only. */
const ledgerFailed = (what: string, error: { code?: string | null; message: string }, uploadId: string): Refusal => {
    if (isMissingTable(error)) return UNAVAILABLE;
    console.error(`[ticket-files] ${what} failed`, error.message, uploadId);
    return OUR_END;
};

/* ── minting ─────────────────────────────────────────────────────────────── */

export type PlannedFile = { name: string; storedName: string; mime: string; ext: string; bytes: number };

/**
 * The decision on one call's files, before anything is written: 1 to 10 of them, each a type
 * uploadTypeFor accepts under the mime the browser is about to send, and at most 25 MB.
 * Pure, so the check can pin it.
 */
export const planMint = (files: unknown): { ok: true; planned: PlannedFile[] } | Refusal => {
    if (!Array.isArray(files) || files.length === 0) return refuse(400, "Bad request.");
    if (files.length > MAX_FILES) {
        const over = files[MAX_FILES] as { name?: unknown } | null;
        return refuse(422, fileCountError(typeof over?.name === "string" ? over.name : "another file"));
    }
    const planned: PlannedFile[] = [];
    for (const raw of files) {
        const f = (raw ?? {}) as { name?: unknown; mime?: unknown; bytes?: unknown };
        if (typeof f.name !== "string" || typeof f.mime !== "string" || typeof f.bytes !== "number" || !Number.isInteger(f.bytes) || f.bytes < 0) return refuse(400, "Bad request.");
        const type = uploadTypeFor(f.name, f.mime);
        if (!type) return refuse(422, fileTypeError(f.name));
        if (f.bytes > MAX_FILE_BYTES) return refuse(422, fileSizeError(f.name));
        planned.push({ name: f.name, storedName: storedFileName(f.name, type), mime: type.mime, ext: type.ext, bytes: f.bytes });
    }
    return { ok: true, planned };
};

export type MintedFile = { file_id: string; name: string; mime: string; path: string; token: string };
export type MintResult = { ok: true; upload_id: string; bucket: string; files: MintedFile[] } | Refusal;

/**
 * One signed upload URL per file, each recorded in the ledger first.
 *
 * Order: validate everything, check the upload id is this caller's and the day's cap, insert
 * every row in one insert, then mint. A URL that cannot be minted (the bucket is missing)
 * marks the rows just written as removed, so the cleanup never goes looking for them.
 *
 * There is NO cap on the rows of one upload_id: removing a file in the form never marks its
 * row, and re-adding a failed file mints a new one, so a per-upload cap would refuse "add
 * 10, remove 1, add 1" until a reload. Ten per request is held at ticket-create.
 */
export async function mintUploads(
    input: { caller: Caller; via: Via; slug: string | null; uploadId: string | null; files: unknown },
    deps: FileDeps = LIVE,
): Promise<MintResult> {
    const plan = planMint(input.files);
    if (!plan.ok) return plan;
    if (input.uploadId !== null && !isUuid(input.uploadId)) return refuse(400, "Bad request.");
    const uploadId = input.uploadId ?? deps.uuid();
    const email = input.caller.email;
    const db = deps.reporting();

    if (input.uploadId !== null) {
        const { data, error } = await db.from("ticket_uploads").select("submitted_by").eq("upload_id", uploadId).limit(1000);
        if (error) return ledgerFailed("upload owner read", error, uploadId);
        if ((data ?? []).some((r: { submitted_by: string }) => r.submitted_by !== email)) return refuse(403, "That upload belongs to someone else.");
    }

    const since = new Date(deps.now() - 24 * 3600_000).toISOString();
    const { count, error: countErr } = await db.from("ticket_uploads").select("file_id", { count: "exact", head: true }).eq("submitted_by", email).gte("created_at", since);
    if (countErr) return ledgerFailed("daily count", countErr, uploadId);
    if ((count ?? 0) + plan.planned.length > DAILY_FILE_CAP) return refuse(429, DAILY_FILES_REACHED);

    const key = callerKey(email);
    const rows = plan.planned.map((p) => {
        const fileId = deps.uuid();
        return {
            file_id: fileId,
            upload_id: uploadId,
            submitted_by: email,
            client_slug: input.slug,
            bucket: TICKET_FILES_BUCKET,
            path: uploadPath(key, uploadId, fileId, p.ext),
            file_name: p.storedName,
            mime: p.mime,
            declared_bytes: p.bytes,
        };
    });
    const { error: insErr } = await db.from("ticket_uploads").insert(rows);
    if (insErr) return ledgerFailed("ledger insert", insErr, uploadId);

    const bucket = deps.portal().storage.from(TICKET_FILES_BUCKET);
    const signed = await Promise.all(
        rows.map(async (r) => {
            try {
                const { data, error } = await bucket.createSignedUploadUrl(r.path, { upsert: false });
                return error || !data?.token ? null : data.token;
            } catch {
                return null;
            }
        }),
    );
    if (signed.some((t) => t === null)) {
        const { error } = await db
            .from("ticket_uploads")
            .update({ removed_at: new Date(deps.now()).toISOString() })
            .in(
                "file_id",
                rows.map((r) => r.file_id),
            );
        if (error) console.error("[ticket-files] could not mark unminted rows", error.message, uploadId);
        console.error("[ticket-files] signed upload URLs could not be minted", rows.length, uploadId);
        return UNAVAILABLE;
    }
    console.log("[ticket-files] minted", rows.length, uploadId);
    return {
        ok: true,
        upload_id: uploadId,
        bucket: TICKET_FILES_BUCKET,
        files: rows.map((r, i) => ({ file_id: r.file_id, name: r.file_name, mime: r.mime, path: r.path, token: signed[i]! })),
    };
}

/* ── verifying at submit ─────────────────────────────────────────────────── */

export const NOT_FOUND = "One of those files was not found. Remove it and add it again.";
export const ON_ANOTHER_REQUEST = "One of those files is already on another request. Add it again.";
export const notFinished = (name: string): string => `${name} did not finish uploading. Remove it and add it again.`;

export type LedgerRow = { file_id: string; upload_id: string; submitted_by: string; client_slug: string | null; bucket: string; path: string; file_name: string; mime: string; ticket_id: string | null };
export type StoredObject = { name: string; metadata?: { size?: number; mimetype?: string } | null };
export type VerifiedFile = { file_id: string; path: string; bucket: string; file_name: string; mime: string; bytes: number };
export type VerifyResult = { ok: true; files: VerifiedFile[] } | Refusal;

/**
 * The decision on the ledger rows, before the bucket is listed, so a caller naming someone
 * else's ids learns nothing about what is stored: a missing or someone else's row, a row on
 * another dashboard for a client, a row already on another request. Pure.
 */
export const decideRows = (input: { caller: Caller; via: Via; fileIds: string[]; ticketId?: string; rows: LedgerRow[] }): { ok: true; rows: LedgerRow[] } | Refusal => {
    const byId = new Map(input.rows.map((r) => [r.file_id, r]));
    const ordered: LedgerRow[] = [];
    for (const id of input.fileIds) {
        const row = byId.get(id);
        if (!row || row.submitted_by !== input.caller.email) return refuse(422, NOT_FOUND);
        if (input.via === "allowlist" && row.client_slug !== input.caller.slug) return refuse(422, NOT_FOUND);
        if (row.ticket_id && row.ticket_id !== input.ticketId) return refuse(422, ON_ANOTHER_REQUEST);
        ordered.push(row);
    }
    return { ok: true, rows: ordered };
};

/**
 * The decision on the objects: each row's object is there, at most 25 MB, and of the row's
 * type. The stored size is the OBJECT's, never the one the browser declared. Pure.
 */
export const decideObjects = (rows: LedgerRow[], objects: StoredObject[], prefix: string): VerifyResult => {
    const byName = new Map(objects.map((o) => [o.name, o]));
    const files: VerifiedFile[] = [];
    for (const row of rows) {
        const name = row.path.startsWith(`${prefix}/`) ? row.path.slice(prefix.length + 1) : "";
        const obj = name ? byName.get(name) : undefined;
        const size = obj?.metadata?.size;
        if (!obj || typeof size !== "number" || size > MAX_FILE_BYTES || obj.metadata?.mimetype !== row.mime) return refuse(422, notFinished(row.file_name));
        files.push({ file_id: row.file_id, path: row.path, bucket: row.bucket, file_name: row.file_name, mime: row.mime, bytes: size });
    }
    return { ok: true, files };
};

/**
 * Proves each file is the caller's, this request's (or still nobody's), and really in the
 * bucket. Paths come from the ledger, never from the body. On the duplicate path ticketId is
 * the existing request's, so files a dead first attempt already claimed for it pass.
 */
export async function verifyUploads(input: { caller: Caller; via: Via; uploadId: unknown; fileIds: unknown; ticketId?: string }, deps: FileDeps = LIVE): Promise<VerifyResult> {
    if (!isUuid(input.uploadId) || !Array.isArray(input.fileIds) || !input.fileIds.every(isUuid)) return refuse(422, NOT_FOUND);
    const fileIds = [...new Set(input.fileIds.map((id) => id.toLowerCase()))];
    if (fileIds.length > MAX_FILES) return refuse(422, TOO_MANY_FILES);
    if (fileIds.length === 0) return { ok: true, files: [] };
    const uploadId = input.uploadId.toLowerCase();

    const { data, error } = await deps
        .reporting()
        .from("ticket_uploads")
        .select("file_id, upload_id, submitted_by, client_slug, bucket, path, file_name, mime, ticket_id")
        .in("file_id", fileIds)
        .eq("upload_id", uploadId)
        .is("removed_at", null);
    if (error) return ledgerFailed("ledger read", error, uploadId);

    const rows = decideRows({ caller: input.caller, via: input.via, fileIds, ticketId: input.ticketId, rows: (data ?? []) as LedgerRow[] });
    if (!rows.ok) return rows;

    const prefix = uploadPrefix(callerKey(input.caller.email), uploadId);
    const { data: listed, error: listErr } = await deps.portal().storage.from(TICKET_FILES_BUCKET).list(prefix, { limit: 1000 });
    if (listErr) {
        console.error("[ticket-files] bucket list failed", listErr.message, uploadId);
        return UNAVAILABLE;
    }
    return decideObjects(rows.rows, (listed ?? []) as StoredObject[], prefix);
}

/* ── claiming and recording ──────────────────────────────────────────────── */

/** The claim's filter: nobody's yet, or already this request's (a dead first attempt claimed it and never recorded it). */
export const claimFilter = (ticketId: string): string => `ticket_id.is.null,ticket_id.eq.${ticketId}`;

/**
 * A compare-and-set: each row goes to this request only if it is still nobody's, or already
 * this request's. Without the second arm, an attempt that died between the claim and the
 * record would leave its files claimed and unrecorded, and the retry would claim nothing.
 * Returns the files that are now this request's. Past the insert, so it never throws.
 */
export async function claimUploads(ticketId: string, verified: VerifiedFile[], deps: FileDeps = LIVE): Promise<VerifiedFile[]> {
    if (!verified.length) return [];
    try {
        const { data, error } = await deps
            .reporting()
            .from("ticket_uploads")
            .update({ ticket_id: ticketId, claimed_at: new Date(deps.now()).toISOString() })
            .in(
                "file_id",
                verified.map((f) => f.file_id),
            )
            .or(claimFilter(ticketId))
            .is("removed_at", null)
            .select("file_id, path");
        if (error) {
            console.error("[ticket-files] claim failed", error.message, ticketId);
            return [];
        }
        const won = new Set(((data ?? []) as Array<{ file_id: string }>).map((r) => r.file_id));
        return verified.filter((f) => won.has(f.file_id));
    } catch (err) {
        console.error("[ticket-files] claim threw", err instanceof Error ? err.message : String(err), ticketId);
        return [];
    }
}

/**
 * One ticket_attachments row per claimed file whose path is not already on the ticket, then
 * image_count set to the ticket's TOTAL row count (the column counts every file now; its
 * name predates PDFs). Rows are written before the brain is told, so routing's notes line
 * sees them. A shortfall (fewer recorded than the request carried) goes into intake_notes,
 * joined to whatever is already there, for the team. Never throws.
 */
export async function recordAttachments(
    ticketId: string,
    claimed: VerifiedFile[],
    priorNotes: string[],
    expected: number = claimed.length,
    deps: FileDeps = LIVE,
): Promise<{ recorded: number; total: number | null }> {
    const db = deps.reporting();
    let recorded = 0;
    let onTicket = 0;
    try {
        const { data: existing, error: readErr } = await db.from("ticket_attachments").select("path").eq("ticket_id", ticketId);
        // A failed read is taken as "none yet": a file attached twice is a smaller harm than a
        // file lost, and on the insert path the ticket is seconds old.
        if (readErr) console.error("[ticket-files] could not read the ticket's attachments", readErr.message, ticketId);
        const have = new Set(((existing ?? []) as Array<{ path: string | null }>).map((r) => r.path));
        const fresh = claimed.filter((f) => !have.has(f.path));
        onTicket = claimed.length - fresh.length;
        if (fresh.length) {
            const { error } = await db.from("ticket_attachments").insert(
                fresh.map((f) => ({ ticket_id: ticketId, store: "portal", bucket: f.bucket, path: f.path, file_name: f.file_name, mime: f.mime, bytes: f.bytes })),
            );
            if (error) console.error("[ticket-files] could not record the attachments", error.message, ticketId);
            else recorded = fresh.length;
        }

        const { count } = await db.from("ticket_attachments").select("id", { count: "exact", head: true }).eq("ticket_id", ticketId);
        const shortfall = expected - (recorded + onTicket);
        const patch: Record<string, unknown> = { updated_at: new Date(deps.now()).toISOString() };
        if (typeof count === "number") patch.image_count = count;
        if (shortfall > 0) {
            patch.intake_notes = asNote([...priorNotes, `${shortfall} attached file(s) could not be listed on the ticket, so the Asana task will not carry them; ask the client to send them to their account manager.`]);
        }
        const { error: patchErr } = await db.from("tickets").update(patch).eq("id", ticketId);
        if (patchErr) console.error("[ticket-files] could not record the file count", patchErr.message, ticketId);
        return { recorded, total: typeof count === "number" ? count : null };
    } catch (err) {
        console.error("[ticket-files] recording threw", err instanceof Error ? err.message : String(err), ticketId);
        return { recorded, total: null };
    }
}

/** The files as the success card and the request page list them, oldest first. A read error is an empty list. */
export async function ticketFiles(ticketId: string, deps: FileDeps = LIVE): Promise<Array<{ name: string; mime: string; bytes: number | null }>> {
    try {
        const { data, error } = await deps.reporting().from("ticket_attachments").select("file_name, mime, bytes").eq("ticket_id", ticketId).order("created_at", { ascending: true });
        if (error) {
            console.error("[ticket-files] file list read failed", error.message, ticketId);
            return [];
        }
        return ((data ?? []) as Array<{ file_name: string; mime: string; bytes: number | null }>).map((r) => ({ name: r.file_name, mime: r.mime, bytes: r.bytes }));
    } catch (err) {
        console.error("[ticket-files] file list read threw", err instanceof Error ? err.message : String(err), ticketId);
        return [];
    }
}

/* ── the daily cleanup ───────────────────────────────────────────────────── */

/**
 * Removes files that were uploaded and never sent. MARKS FIRST and removes only what it
 * marked, so a row claimed between the two steps can never lose its object:
 *   1. up to 500 ids nobody claimed, older than 24 hours (this includes a row whose request
 *      was later deleted: the foreign key sets ticket_id null);
 *   2. a compare-and-set on exactly those ids re-checking the same conditions, returning
 *      the paths it marked (a row claimed after step 1 no longer matches);
 *   3. storage.remove() only those paths, 100 at a time;
 *   4. a chunk whose removal failed is un-marked (guarded ticket_id is null) so the next run
 *      tries again; a claim cannot land on it meanwhile, because claims require
 *      removed_at is null.
 * Logs counts only.
 */
export async function removeOrphans(nowMs: number, deps: FileDeps = LIVE): Promise<{ removed: number; failed: number }> {
    const db = deps.reporting();
    const cutoff = new Date(nowMs - ORPHAN_AFTER_HOURS * 3600_000).toISOString();
    const { data: found, error: findErr } = await db.from("ticket_uploads").select("file_id").is("removed_at", null).is("ticket_id", null).lt("created_at", cutoff).limit(ORPHAN_BATCH);
    if (findErr) {
        console.error("[ticket-files] orphan read failed", isMissingTable(findErr) ? "ticket_uploads does not exist yet" : findErr.message);
        return { removed: 0, failed: 0 };
    }
    const ids = ((found ?? []) as Array<{ file_id: string }>).map((r) => r.file_id);
    if (!ids.length) return { removed: 0, failed: 0 };

    const { data: marked, error: markErr } = await db
        .from("ticket_uploads")
        .update({ removed_at: new Date(nowMs).toISOString() })
        .in("file_id", ids)
        .is("ticket_id", null)
        .is("removed_at", null)
        .lt("created_at", cutoff)
        .select("file_id, path");
    if (markErr) {
        console.error("[ticket-files] orphan mark failed", markErr.message);
        return { removed: 0, failed: 0 };
    }
    const rows = (marked ?? []) as Array<{ file_id: string; path: string }>;
    const bucket = deps.portal().storage.from(TICKET_FILES_BUCKET);
    let removed = 0;
    let failed = 0;
    for (let i = 0; i < rows.length; i += REMOVE_CHUNK) {
        const chunk = rows.slice(i, i + REMOVE_CHUNK);
        let ok = false;
        try {
            const { error } = await bucket.remove(chunk.map((r) => r.path));
            ok = !error;
        } catch {
            ok = false;
        }
        if (ok) {
            removed += chunk.length;
            continue;
        }
        failed += chunk.length;
        const { error: unmarkErr } = await db
            .from("ticket_uploads")
            .update({ removed_at: null })
            .in(
                "file_id",
                chunk.map((r) => r.file_id),
            )
            .is("ticket_id", null);
        if (unmarkErr) console.error("[ticket-files] could not un-mark a failed chunk", unmarkErr.message, chunk.length);
    }
    console.log("[ticket-files] orphans", { found: ids.length, marked: rows.length, removed, failed });
    return { removed, failed };
}
