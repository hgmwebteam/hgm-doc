/**
 * Self-check for the column lists a client's request is read with, and the ladder that walks
 * them while the hand-applied columns are missing. No network: `read` is a stub that answers
 * the way PostgREST does when a select names a column the table does not have. Run it:
 *   node --experimental-strip-types netlify/lib/ticket-columns.check.mts
 *
 * The case that matters most: with `urls` present and `websites` absent, a read must keep the
 * pages. The fallback before the ladder went straight from the widest list to the base list.
 *
 * House style: no em or en dashes anywhere.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CLIENT_COLUMN_LADDER, CLIENT_HIDDEN_COLUMNS, CLIENT_TICKET_COLUMNS, clientView, readDownLadder, withPages, withWebsites } from "./ticket-columns.mts";

type Answer = { data: unknown; error: { code?: string; message?: string } | null };

/** A table with these columns: a select naming any other answers `missing` (42703 by default), as the database would. */
const table = (columns: string[], missing: { code?: string; message?: string } = { code: "42703", message: "column tickets.x does not exist" }) => {
    const reads: string[] = [];
    const read = async (cols: string): Promise<Answer> => {
        reads.push(cols);
        const named = cols.split(",").map((c) => c.trim());
        const absent = named.find((c) => !columns.includes(c));
        return absent ? { data: null, error: { ...missing, message: (missing.message ?? "").replace("x", absent) } } : { data: { cols: named }, error: null };
    };
    return { read, reads };
};
const base = CLIENT_TICKET_COLUMNS.split(",").map((c) => c.trim());

/* 1. The lists. */
assert.equal(withWebsites("a, b"), "a, b, websites");
assert.deepEqual([...CLIENT_COLUMN_LADDER], [`${CLIENT_TICKET_COLUMNS}, urls, websites`, `${CLIENT_TICKET_COLUMNS}, urls`, CLIENT_TICKET_COLUMNS], "widest first");
assert.equal(CLIENT_COLUMN_LADDER[0], withWebsites(withPages(CLIENT_TICKET_COLUMNS)));
for (let i = 1; i < CLIENT_COLUMN_LADDER.length; i++) {
    const wider = CLIENT_COLUMN_LADDER[i - 1].split(", ");
    const narrower = CLIENT_COLUMN_LADDER[i].split(", ");
    assert.deepEqual(wider.slice(0, -1), narrower, `step ${i} drops only the newest column`);
}
assert.ok(!(CLIENT_HIDDEN_COLUMNS as readonly string[]).includes("websites"), "a client may see which of their websites a request is for");
assert.deepEqual(clientView({ id: "t", websites: { offered: 6, chosen: [] }, assignee_name: "Kyle" }, "allowlist"), { id: "t", websites: { offered: 6, chosen: [] } }, "clientView keeps websites and still drops the assignee");

/* 2. The ladder stops at the first success. */
{
    const t = table([...base, "urls", "websites"]);
    const r = await readDownLadder(CLIENT_COLUMN_LADDER, t.read);
    assert.equal(r.error, null);
    assert.equal(r.columns, CLIENT_COLUMN_LADDER[0], "every column present: the widest list");
    assert.equal(t.reads.length, 1, "one read");
}

/* 3. Websites absent, pages present: the pages are kept. */
{
    const t = table([...base, "urls"]);
    const r = await readDownLadder(CLIENT_COLUMN_LADDER, t.read);
    assert.equal(r.error, null);
    assert.equal(r.columns, CLIENT_COLUMN_LADDER[1], "drops websites, keeps urls");
    assert.deepEqual(t.reads, [CLIENT_COLUMN_LADDER[0], CLIENT_COLUMN_LADDER[1]]);
    assert.ok((r.data as { cols: string[] }).cols.includes("urls"));
}

/* 4. Neither: down to the base list, one column per step. */
{
    const t = table(base);
    const r = await readDownLadder(CLIENT_COLUMN_LADDER, t.read);
    assert.equal(r.error, null);
    assert.equal(r.columns, CLIENT_TICKET_COLUMNS);
    assert.equal(t.reads.length, 3);
}

/* 5. PostgREST's schema cache says it its own way: PGRST204, and by message alone. */
{
    const t = table([...base, "urls"], { code: "PGRST204", message: "Could not find the 'x' column of 'tickets' in the schema cache" });
    const r = await readDownLadder(CLIENT_COLUMN_LADDER, t.read);
    assert.equal(r.columns, CLIENT_COLUMN_LADDER[1], "PGRST204 steps down");
    const m = table([...base, "urls"], { message: "column tickets.x does not exist" });
    assert.equal((await readDownLadder(CLIENT_COLUMN_LADDER, m.read)).columns, CLIENT_COLUMN_LADDER[1], "the message alone steps down");
}

/* 6. Any other error is never retried, and is returned as it came. */
{
    const reads: string[] = [];
    const r = await readDownLadder(CLIENT_COLUMN_LADDER, async (cols: string): Promise<Answer> => {
        reads.push(cols);
        return { data: null, error: { code: "57014", message: "canceling statement due to statement timeout" } };
    });
    assert.equal(reads.length, 1, "a timeout is not a missing column");
    assert.equal(r.error?.code, "57014");
    assert.equal(r.columns, CLIENT_COLUMN_LADDER[0]);
}

/* 7. The last step's answer is returned whatever it says: nothing past the base list. */
{
    const t = table([]);
    const r = await readDownLadder(CLIENT_COLUMN_LADDER, t.read);
    assert.equal(t.reads.length, 3, "no fourth read");
    assert.equal(r.error?.code, "42703", "the base list's own failure reaches the caller");
    assert.equal(r.columns, CLIENT_TICKET_COLUMNS);
}

/* 8. Any ladder, not only the client's: ticket-list walks a two-step one. */
{
    const t = table(["id", "title"]);
    const r = await readDownLadder(["id, title, websites", "id, title"], t.read);
    assert.equal(r.columns, "id, title");
    await assert.rejects(readDownLadder([], t.read), /at least one/);
}

/* 9. House style. */
const dashes = new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`);
for (const f of ["./ticket-columns.mts", "./ticket-columns.check.mts"]) assert.ok(!dashes.test(readFileSync(new URL(f, import.meta.url), "utf8")), `no en or em dash in ${f}`);

console.log("ticket-columns: all checks passed");
