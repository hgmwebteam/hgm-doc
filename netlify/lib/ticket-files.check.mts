/**
 * Self-check for the request files: the minting rules, the proof a file is the caller's and
 * this request's, the claim, the record, and the cleanup's order. No network: the database
 * and the bucket are an in-memory fake that runs the same query chains the module sends.
 * Run it:
 *   node --experimental-strip-types netlify/lib/ticket-files.check.mts
 *
 * The case that matters most is the cleanup's: a row claimed by a request between the
 * cleanup's read and its mark must keep its object.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Caller } from "./reporting.mts";
import {
    DAILY_FILE_CAP,
    type FileDeps,
    NOT_FOUND,
    ON_ANOTHER_REQUEST,
    TICKET_FILES_BUCKET,
    callerKey,
    claimFilter,
    claimUploads,
    mintUploads,
    notFinished,
    planMint,
    recordAttachments,
    removeOrphans,
    uploadPath,
    uploadPrefix,
    verifyUploads,
} from "./ticket-files.mts";
import { DAILY_FILES_REACHED, FILES_UNAVAILABLE, MAX_FILE_BYTES } from "../../src/pages/client/help/request-rules.ts";

/* ── the fake ────────────────────────────────────────────────────────────── */

type Row = Record<string, unknown>;
type Filter = (r: Row) => boolean;
type Err = { code?: string; message: string } | null;

class FakeDb {
    tables: Record<string, Row[]> = {};
    /** Runs before an update on a table executes: how a race is staged. */
    beforeUpdate: Record<string, (() => void) | undefined> = {};
    missing = new Set<string>();
    failInsert = new Set<string>();
    log: string[] = [];
    from(table: string) {
        return new FakeQuery(this, table);
    }
}

class FakeQuery implements PromiseLike<{ data: unknown; error: Err; count?: number | null }> {
    private filters: Filter[] = [];
    private op: "select" | "insert" | "update" = "select";
    private payload: unknown = null;
    private returning = false;
    private headCount = false;
    private max = Infinity;
    private db: FakeDb;
    private table: string;
    constructor(db: FakeDb, table: string) {
        this.db = db;
        this.table = table;
    }
    select(_cols?: string, opts?: { count?: string; head?: boolean }) {
        if (this.op === "select") this.headCount = !!opts?.head;
        else this.returning = true;
        return this;
    }
    insert(rows: Row | Row[]) {
        this.op = "insert";
        this.payload = Array.isArray(rows) ? rows : [rows];
        return this;
    }
    update(patch: Row) {
        this.op = "update";
        this.payload = patch;
        return this;
    }
    eq(c: string, v: unknown) {
        this.filters.push((r) => r[c] === v);
        return this;
    }
    in(c: string, vs: unknown[]) {
        this.filters.push((r) => vs.includes(r[c]));
        return this;
    }
    is(c: string, v: null) {
        this.filters.push((r) => (r[c] ?? null) === v);
        return this;
    }
    lt(c: string, v: string) {
        this.filters.push((r) => String(r[c]) < v);
        return this;
    }
    gte(c: string, v: string) {
        this.filters.push((r) => String(r[c]) >= v);
        return this;
    }
    or(expr: string) {
        const arms = expr.split(",").map((arm) => {
            const [c, o, ...rest] = arm.split(".");
            const v = rest.join(".");
            return o === "is" && v === "null" ? (r: Row) => (r[c] ?? null) === null : (r: Row) => String(r[c]) === v;
        });
        this.filters.push((r) => arms.some((a) => a(r)));
        return this;
    }
    limit(n: number) {
        this.max = n;
        return this;
    }
    order() {
        return this;
    }
    private run(): { data: unknown; error: Err; count?: number | null } {
        if (this.db.missing.has(this.table)) return { data: null, error: { code: "PGRST205", message: `Could not find the table 'public.${this.table}' in the schema cache` } };
        const rows = (this.db.tables[this.table] ??= []);
        const match = rows.filter((r) => this.filters.every((f) => f(r)));
        if (this.op === "insert") {
            this.db.log.push(`insert ${this.table}`);
            if (this.db.failInsert.has(this.table)) return { data: null, error: { message: "insert refused" } };
            rows.push(...(this.payload as Row[]).map((r) => ({ id: `row-${rows.length}`, created_at: new Date(NOW).toISOString(), ...r })));
            return { data: null, error: null };
        }
        if (this.op === "update") {
            this.db.beforeUpdate[this.table]?.();
            const now = rows.filter((r) => this.filters.every((f) => f(r)));
            this.db.log.push(`update ${this.table} ${now.length}`);
            for (const r of now) Object.assign(r, this.payload as Row);
            return { data: this.returning ? now.map((r) => ({ ...r })) : null, error: null };
        }
        if (this.headCount) return { data: null, error: null, count: match.length };
        return { data: match.slice(0, this.max).map((r) => ({ ...r })), error: null };
    }
    then<A, B>(ok?: ((v: { data: unknown; error: Err; count?: number | null }) => A | PromiseLike<A>) | null, bad?: ((e: unknown) => B | PromiseLike<B>) | null) {
        return Promise.resolve(this.run()).then(ok, bad);
    }
}

class FakeStorage {
    objects = new Map<string, { size: number; mimetype: string }>();
    failSign = false;
    failRemove = false;
    removed: string[] = [];
    log: string[] = [];
    from(bucket: string) {
        assert.equal(bucket, TICKET_FILES_BUCKET);
        return {
            createSignedUploadUrl: async (path: string, opts: { upsert: boolean }) => {
                assert.equal(opts.upsert, false, "a signed URL never overwrites");
                return this.failSign ? { data: null, error: { message: "Bucket not found" } } : { data: { token: `tok-${path}`, path, signedUrl: "x" }, error: null };
            },
            list: async (prefix: string) => ({
                data: [...this.objects.entries()].filter(([p]) => p.startsWith(`${prefix}/`)).map(([p, m]) => ({ name: p.slice(prefix.length + 1), metadata: m })),
                error: null,
            }),
            remove: async (paths: string[]) => {
                this.log.push(`remove ${paths.length}`);
                if (this.failRemove) return { data: null, error: { message: "storage down" } };
                for (const p of paths) {
                    this.objects.delete(p);
                    this.removed.push(p);
                }
                return { data: [], error: null };
            },
        };
    }
}

const NOW = Date.parse("2026-09-28T12:00:00Z");
let seq = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
const world = () => {
    const db = new FakeDb();
    const storage = new FakeStorage();
    const deps: FileDeps = {
        reporting: () => db as unknown as SupabaseClient,
        portal: () => ({ storage }) as unknown as SupabaseClient,
        now: () => NOW,
        uuid,
    };
    return { db, storage, deps };
};

const MARCUS: Caller = { slug: "stay-saluda-dashboard", clientName: "Stay Saluda", email: "marcus@example.com", name: "Marcus" };
const OTHER: Caller = { slug: "stay-saluda-dashboard", clientName: "Stay Saluda", email: "jo@example.com", name: "Jo" };
const pdf = (name = "brief.pdf", bytes = 1000) => ({ name, mime: "application/pdf", bytes });

/* 1. Keys and paths. */
assert.equal(callerKey("Marcus@Example.com "), callerKey("marcus@example.com"), "the same person, however typed");
assert.match(callerKey("marcus@example.com"), /^[0-9a-f]{20}$/);
assert.ok(!uploadPath(callerKey("marcus@example.com"), "u", "f", "pdf").includes("marcus"), "no address in a key");
assert.equal(uploadPath("k", "u", "f", "pdf"), "uploads/k/u/f.pdf");
assert.equal(claimFilter("T1"), "ticket_id.is.null,ticket_id.eq.T1");

/* 2. What one call may mint. */
assert.equal(planMint([]).ok, false);
assert.equal(planMint("x").ok, false);
assert.deepEqual(planMint(Array.from({ length: 11 }, (_, i) => pdf(`f${i}.pdf`))), { ok: false, status: 422, error: "Up to 10 files. Remove one to add f10.pdf." });
assert.equal((planMint([{ name: "x.html", mime: "text/plain", bytes: 5 }]) as { status: number }).status, 422);
assert.deepEqual(planMint([pdf("big.pdf", MAX_FILE_BYTES + 1)]), { ok: false, status: 422, error: "big.pdf is over 25 MB." });
assert.equal(planMint([{ name: "a.pdf", mime: "application/pdf", bytes: -1 }]).ok, false);
const planned = planMint([{ name: "photo.png", mime: "image/webp", bytes: 2000 }, pdf()]);
assert.ok(planned.ok);
if (planned.ok) {
    assert.deepEqual(
        planned.planned.map((p) => [p.storedName, p.mime, p.ext]),
        [
            ["photo.webp", "image/webp", "webp"],
            ["brief.pdf", "application/pdf", "pdf"],
        ],
    );
}

/* 3. Minting: rows first, then URLs; the day's cap; another person's upload id. */
{
    const { db, storage, deps } = world();
    const r = await mintUploads({ caller: MARCUS, via: "allowlist", slug: MARCUS.slug, uploadId: null, files: [pdf(), { name: "rates.csv", mime: "text/csv", bytes: 10 }] }, deps);
    assert.ok(r.ok);
    if (!r.ok) throw new Error("unreachable");
    assert.equal(db.tables.ticket_uploads.length, 2);
    assert.equal(r.files[0].path, uploadPath(callerKey(MARCUS.email), r.upload_id, r.files[0].file_id, "pdf"));
    assert.equal(r.files[0].token, `tok-${r.files[0].path}`);
    assert.equal(db.tables.ticket_uploads[0].client_slug, MARCUS.slug);
    assert.equal(db.tables.ticket_uploads[1].file_name, "rates.csv");

    // Ten more on the same upload id: no per-upload cap (remove one, add one).
    const more = await mintUploads({ caller: MARCUS, via: "allowlist", slug: MARCUS.slug, uploadId: r.upload_id, files: Array.from({ length: 10 }, (_, i) => pdf(`m${i}.pdf`)) }, deps);
    assert.ok(more.ok, "12 live rows on one upload id is fine");
    const once = await mintUploads({ caller: MARCUS, via: "allowlist", slug: MARCUS.slug, uploadId: r.upload_id, files: [pdf("one-more.pdf")] }, deps);
    assert.ok(once.ok);

    const theirs = await mintUploads({ caller: OTHER, via: "allowlist", slug: OTHER.slug, uploadId: r.upload_id, files: [pdf()] }, deps);
    assert.deepEqual(theirs, { ok: false, status: 403, error: "That upload belongs to someone else." });

    // The day's cap counts this caller's rows in the last 24 hours.
    db.tables.ticket_uploads.push(...Array.from({ length: DAILY_FILE_CAP - 13 }, (_, i) => ({ file_id: `old-${i}`, submitted_by: MARCUS.email, created_at: new Date(NOW - 3600_000).toISOString() })));
    const capped = await mintUploads({ caller: MARCUS, via: "allowlist", slug: MARCUS.slug, uploadId: null, files: [pdf(), pdf("b.pdf")] }, deps);
    assert.deepEqual(capped, { ok: false, status: 429, error: DAILY_FILES_REACHED });
    db.tables.ticket_uploads.forEach((row) => {
        if (String(row.file_id).startsWith("old-")) row.created_at = new Date(NOW - 25 * 3600_000).toISOString();
    });
    assert.ok((await mintUploads({ caller: MARCUS, via: "allowlist", slug: MARCUS.slug, uploadId: null, files: [pdf()] }, deps)).ok, "yesterday's files do not count");

    // The bucket is missing: the rows just written are marked, and the 503 sentence.
    storage.failSign = true;
    const before = db.tables.ticket_uploads.length;
    const unsigned = await mintUploads({ caller: MARCUS, via: "allowlist", slug: MARCUS.slug, uploadId: null, files: [pdf()] }, deps);
    assert.deepEqual(unsigned, { ok: false, status: 503, error: FILES_UNAVAILABLE });
    assert.equal(db.tables.ticket_uploads.length, before + 1);
    assert.ok(db.tables.ticket_uploads.at(-1)!.removed_at, "an unminted row is marked removed");
}
{
    const { db, deps } = world();
    db.missing.add("ticket_uploads");
    assert.deepEqual(await mintUploads({ caller: MARCUS, via: "allowlist", slug: null, uploadId: null, files: [pdf()] }, deps), { ok: false, status: 503, error: FILES_UNAVAILABLE }, "no ledger yet: the 503 sentence");
}
{
    // An upload id sent in capitals is the same upload, and its keys sit under the lowercase
    // prefix verifyUploads lists, so the file can still be proved at submit.
    const { storage, deps } = world();
    const first = await mintUploads({ caller: MARCUS, via: "allowlist", slug: MARCUS.slug, uploadId: "abcdef01-2345-4abc-8def-abcdefabcdef", files: [pdf()] }, deps);
    if (!first.ok) throw new Error("unreachable");
    const caps = await mintUploads({ caller: MARCUS, via: "allowlist", slug: MARCUS.slug, uploadId: first.upload_id.toUpperCase(), files: [pdf("caps.pdf")] }, deps);
    if (!caps.ok) throw new Error("a capitalised upload id is refused");
    assert.equal(caps.upload_id, first.upload_id);
    assert.ok(caps.files[0].path.startsWith(`${uploadPrefix(callerKey(MARCUS.email), first.upload_id)}/`), caps.files[0].path);
    storage.objects.set(caps.files[0].path, { size: 1000, mimetype: "application/pdf" });
    const proved = await verifyUploads({ caller: MARCUS, via: "allowlist", uploadId: first.upload_id.toUpperCase(), fileIds: [caps.files[0].file_id] }, deps);
    assert.ok(proved.ok, "and proved at submit");
}

/* 4. Verifying at submit. */
const seed = async () => {
    const w = world();
    const r = await mintUploads({ caller: MARCUS, via: "allowlist", slug: MARCUS.slug, uploadId: null, files: [pdf(), { name: "rates.csv", mime: "text/csv", bytes: 10 }] }, w.deps);
    if (!r.ok) throw new Error("seed failed");
    // The browser uploads both.
    w.storage.objects.set(r.files[0].path, { size: 999, mimetype: "application/pdf" });
    w.storage.objects.set(r.files[1].path, { size: 10, mimetype: "text/csv" });
    return { ...w, minted: r, ids: r.files.map((f) => f.file_id) };
};
{
    const { deps, minted, ids } = await seed();
    const ok = await verifyUploads({ caller: MARCUS, via: "allowlist", uploadId: minted.upload_id, fileIds: ids }, deps);
    assert.ok(ok.ok);
    if (ok.ok) {
        assert.deepEqual(
            ok.files.map((f) => [f.file_name, f.bytes]),
            [
                ["brief.pdf", 999],
                ["rates.csv", 10],
            ],
            "the stored size is the object's, not the declared one",
        );
    }
    assert.deepEqual(await verifyUploads({ caller: OTHER, via: "allowlist", uploadId: minted.upload_id, fileIds: ids }, deps), { ok: false, status: 422, error: NOT_FOUND }, "another caller's file");
    assert.deepEqual(
        await verifyUploads({ caller: { ...MARCUS, slug: "elsewhere-dashboard" }, via: "allowlist", uploadId: minted.upload_id, fileIds: ids }, deps),
        { ok: false, status: 422, error: NOT_FOUND },
        "a client's file on another dashboard",
    );
    assert.ok((await verifyUploads({ caller: { ...MARCUS, slug: "elsewhere-dashboard" }, via: "staff", uploadId: minted.upload_id, fileIds: ids }, deps)).ok, "staff are not held to the slug");
    assert.deepEqual(await verifyUploads({ caller: MARCUS, via: "allowlist", uploadId: minted.upload_id, fileIds: [uuid()] }, deps), { ok: false, status: 422, error: NOT_FOUND }, "an id that was never minted");
    assert.deepEqual(await verifyUploads({ caller: MARCUS, via: "allowlist", uploadId: minted.upload_id, fileIds: ["../x"] }, deps), { ok: false, status: 422, error: NOT_FOUND });
    assert.equal((await verifyUploads({ caller: MARCUS, via: "allowlist", uploadId: minted.upload_id, fileIds: Array.from({ length: 11 }, uuid) }, deps) as { status: number }).status, 422);
}
{
    const { deps, storage, minted, ids } = await seed();
    storage.objects.delete(minted.files[1].path);
    assert.deepEqual(await verifyUploads({ caller: MARCUS, via: "allowlist", uploadId: minted.upload_id, fileIds: ids }, deps), { ok: false, status: 422, error: notFinished("rates.csv") }, "never uploaded");
    storage.objects.set(minted.files[1].path, { size: MAX_FILE_BYTES + 1, mimetype: "text/csv" });
    assert.equal((await verifyUploads({ caller: MARCUS, via: "allowlist", uploadId: minted.upload_id, fileIds: ids }, deps) as { error: string }).error, notFinished("rates.csv"), "over the size");
    storage.objects.set(minted.files[1].path, { size: 10, mimetype: "text/html" });
    assert.equal((await verifyUploads({ caller: MARCUS, via: "allowlist", uploadId: minted.upload_id, fileIds: ids }, deps) as { error: string }).error, notFinished("rates.csv"), "not the type it was minted as");
}

/* 5. Claiming: exactly one request; a dead first attempt's claim is finished by its retry. */
{
    const { db, deps, minted, ids } = await seed();
    const verified = await verifyUploads({ caller: MARCUS, via: "allowlist", uploadId: minted.upload_id, fileIds: ids }, deps);
    if (!verified.ok) throw new Error("unreachable");
    const won = await claimUploads("T1", verified.files, deps);
    assert.equal(won.length, 2);
    assert.deepEqual(await claimUploads("T2", verified.files, deps), [], "another request cannot take them");
    assert.deepEqual(await verifyUploads({ caller: MARCUS, via: "allowlist", uploadId: minted.upload_id, fileIds: ids }, deps), { ok: false, status: 422, error: ON_ANOTHER_REQUEST }, "the insert path refuses any claimed row");
    const dup = await verifyUploads({ caller: MARCUS, via: "allowlist", uploadId: minted.upload_id, fileIds: ids, ticketId: "T1" }, deps);
    assert.ok(dup.ok, "the duplicate path accepts its own claimed rows");
    assert.equal((await claimUploads("T1", verified.files, deps)).length, 2, "and claims them again (ticket_id = this one)");
    assert.equal(db.tables.ticket_uploads.filter((r) => r.ticket_id === "T1").length, 2);

    /* 6. Recording: rows once, the total count, a shortfall noted. */
    db.tables.tickets = [{ id: "T1", image_count: 0 }];
    const first = await recordAttachments("T1", won.slice(0, 1), [], 2, deps);
    assert.deepEqual(first, { recorded: 1, total: 1 });
    assert.equal(db.tables.tickets[0].image_count, 1);
    assert.match(String(db.tables.tickets[0].intake_notes), /^Unresolved on receipt: 1 attached file\(s\) could not be listed/);
    const retry = await recordAttachments("T1", won, [], 2, deps);
    assert.deepEqual(retry, { recorded: 1, total: 2 }, "the retry records only what is missing");
    assert.equal(db.tables.ticket_attachments.length, 2);
    assert.deepEqual(db.tables.ticket_attachments.map((r) => [r.store, r.bucket, r.file_name, r.mime, r.bytes]), [
        ["portal", TICKET_FILES_BUCKET, "brief.pdf", "application/pdf", 999],
        ["portal", TICKET_FILES_BUCKET, "rates.csv", "text/csv", 10],
    ]);
    assert.equal(db.tables.tickets[0].image_count, 2);
    assert.deepEqual(await recordAttachments("T1", won, [], 2, deps), { recorded: 0, total: 2 }, "a third pass adds nothing");
}

/* 7. The cleanup marks first and removes only what it marked. */
{
    const { db, storage, deps } = world();
    const old = new Date(NOW - 30 * 3600_000).toISOString();
    const fresh = new Date(NOW - 3600_000).toISOString();
    const row = (id: string, created_at: string, ticket_id: string | null = null) => ({ file_id: id, path: `uploads/k/u/${id}.pdf`, created_at, ticket_id, removed_at: null });
    db.tables.ticket_uploads = [row("a", old), row("b", old), row("c", old, "T9"), row("d", fresh)];
    for (const r of db.tables.ticket_uploads) storage.objects.set(String(r.path), { size: 1, mimetype: "application/pdf" });
    // A request claims "b" between the cleanup's read and its mark.
    let raced = false;
    db.beforeUpdate.ticket_uploads = () => {
        if (raced) return;
        raced = true;
        db.tables.ticket_uploads.find((r) => r.file_id === "b")!.ticket_id = "T10";
    };
    const done = await removeOrphans(NOW, deps);
    assert.deepEqual(done, { removed: 1, failed: 0 });
    assert.deepEqual(storage.removed, ["uploads/k/u/a.pdf"], "only the unclaimed, old, marked row");
    assert.ok(storage.objects.has("uploads/k/u/b.pdf"), "the row claimed mid-run keeps its object");
    assert.ok(storage.objects.has("uploads/k/u/c.pdf") && storage.objects.has("uploads/k/u/d.pdf"));
    assert.ok(db.tables.ticket_uploads.find((r) => r.file_id === "a")!.removed_at);
    assert.equal(db.tables.ticket_uploads.find((r) => r.file_id === "b")!.removed_at, null);
    assert.deepEqual(db.log.slice(0, 1), ["update ticket_uploads 1"], "the mark comes before any removal");
}
{
    const { db, storage, deps } = world();
    const old = new Date(NOW - 30 * 3600_000).toISOString();
    db.tables.ticket_uploads = [{ file_id: "a", path: "uploads/k/u/a.pdf", created_at: old, ticket_id: null, removed_at: null }];
    storage.objects.set("uploads/k/u/a.pdf", { size: 1, mimetype: "application/pdf" });
    storage.failRemove = true;
    assert.deepEqual(await removeOrphans(NOW, deps), { removed: 0, failed: 1 });
    assert.equal(db.tables.ticket_uploads[0].removed_at, null, "a failed removal un-marks its rows for the next run");
    assert.ok(storage.objects.has("uploads/k/u/a.pdf"));
}
{
    const { db, deps } = world();
    db.missing.add("ticket_uploads");
    assert.deepEqual(await removeOrphans(NOW, deps), { removed: 0, failed: 0 }, "no ledger yet: nothing to do");
}

/* 8. Prefix shape the platform relies on (uploads/<20 hex>/<uuid>/<uuid>.<ext>). */
assert.match(uploadPath(callerKey("x@y.com"), uuid(), uuid(), "pdf"), /^uploads\/[0-9a-f]{20}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.pdf$/);
assert.equal(uploadPrefix("k", "u"), "uploads/k/u");

/* 9. House style. */
const dashes = new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`);
for (const f of ["./ticket-files.mts", "./ticket-columns.mts", "../functions/ticket-upload-url.mts", "../functions/ticket-uploads-cleanup.mts"]) {
    assert.ok(!dashes.test(readFileSync(new URL(f, import.meta.url), "utf8")), `no en or em dash in ${f}`);
}

console.log("ticket-files: all checks passed");
