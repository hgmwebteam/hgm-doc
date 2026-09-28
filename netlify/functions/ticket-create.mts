import { createClient } from "@supabase/supabase-js";
import { cleanNotifyEmail, cleanUrls, completionEmailOpen } from "../../src/pages/client/help/request-rules.ts";
import {
    BRAIN_API_KEY,
    BRAIN_TICKET_URL,
    ConfigError,
    cleanDate,
    cleanText,
    jsonError,
    isListedOn,
    portalDb,
    readJson,
    reportingDb,
    accessTokenFrom, verifyCaller,
} from "../lib/reporting.mts";
import { isStaffEmail } from "../lib/staff.mts";
import { CLIENT_TICKET_COLUMNS, NOTIFY_COLUMNS, asNote, completionEmailModeNow, isMissingColumn, withPages } from "../lib/ticket-columns.mts";
import { type VerifiedFile, claimUploads, recordAttachments, ticketFiles, verifyUploads } from "../lib/ticket-files.mts";

/**
 * A client raises a request.
 *
 * This is the only way a row ever enters `tickets`, and it is the one endpoint in the help
 * centre where being wrong costs a client their words rather than a screen refresh. The
 * shape of it follows from that: everything that can be done before the row exists is done
 * first and can refuse the call; everything after the row exists is best effort and can
 * only ever ADD to it.
 *
 *   verify the caller -> validate the request -> the same request, a minute ago? ->
 *   prove the files -> resolve who they are -> INSERT the ticket -> INSERT the
 *   "received" event -> claim and list the files -> tell the brain
 *
 * Past the insert, nothing is allowed to turn into an error the client sees. A storage hiccup
 * or a platform deploy must not cost somebody the paragraph they just typed, and a sweep
 * over anything still `received` picks up what the handoff missed. That rule is the whole
 * reason the brain is told LAST and told only `{ ticket_id }`: the row is the single copy of
 * the truth, so a retry can never deliver a stale version of it.
 *
 * ── THREE DATABASES, AND WHY NONE OF THEM IS TRUSTED ALONE ──────────────────
 * Clients live in two other projects: the portal's own (`clients`, `dashboard_pages`) and
 * the platform's (`tenants`). A ticket cannot carry a foreign key to either, so it carries
 * three identifiers and records honestly which of them it could not resolve. A mapping gap
 * of OURS must never stop a client raising a request, so an unresolved identifier is a note
 * for a human, never a refusal. See resolveIdentity() for what is resolvable today, and
 * what is not.
 *
 * ── WHY A REPEAT SUBMISSION IS RETURNED, NOT INSERTED ───────────────────────
 * The slow work (the files, the platform handoff) happens after the row exists, so an
 * invocation that runs out of time leaves a real ticket behind and shows the client a
 * network error. The obvious thing for them to do next is press the button again. Without
 * the "the same request, a minute ago" check below that produces two tickets, two Asana
 * tasks and two people chasing the same job, which is precisely the mess this exists to end.
 *
 * ── FILES ARRIVE AS IDS, NEVER AS BYTES ─────────────────────────────────────
 * The browser uploads each file straight to the private ticket-files bucket through a signed
 * URL (ticket-upload-url) while the person is still typing, and sends only `upload_id` and
 * the `file_id`s. Every file is proved against the ledger before the row exists (this
 * caller's, still nobody's, really in the bucket, the size and type it was minted as), so a
 * refusal costs nothing; it is claimed and listed after. The old base64 `images` field is
 * refused with a sentence that asks for a reload: only a tab opened before this change
 * sends it. See netlify/lib/ticket-files.mts.
 *
 * ── PAGES AND THE COMPLETION EMAIL ADDRESS ──────────────────────────────────
 * `urls` are the pages the request is about (request-rules.ts cleans them). `notify_email` is
 * the one address HiddenGem Media emails when the request is completed; it is validated and
 * stored ONLY while the completion email switch lets this caller store one
 * (VITE_TICKET_COMPLETION_EMAIL: off by default, staff, on), and otherwise ignored entirely:
 * not validated, not stored, not returned, only counted in the log. The address is never
 * logged, never an Asana follower, and never returned by any other endpoint.
 * `notify_email_listed` records whether the address could open the request page when it was
 * raised; the platform uses it only when its send-time read of the list cannot run.
 * Either column set may be missing (the SQL is applied by hand): the insert retries without
 * them and notes that they were not stored, and the request still goes.
 *
 * POST application/json + Authorization: Bearer <session token>
 *   { slug, topic, title, detail, priority?, property?, needed_by?, urls?, notify_email?,
 *     upload_id?, files?: [{ file_id }] }
 *   -> 201 { ticket, files: [{ name, mime, bytes }] }   (the insert path and the duplicate path)
 */

/* ── caps ────────────────────────────────────────────────────────────────── */

const MAX_TITLE = 140;
const MAX_DETAIL = 5000;
const MAX_PROPERTY = 160;

/** The handoff is best effort and the client is waiting, so it gets a budget rather than the
 *  whole invocation. Anything still `received` is the sweep's job. */
const BRAIN_TIMEOUT_MS = 5_000;

/** How long two identical requests from one person count as one. Long enough to cover a
 *  timed-out invocation and the retry it invites, short enough that a client who genuinely
 *  raises the same thing twice in an afternoon gets two tickets. */
const DUPLICATE_WINDOW_MS = 5 * 60 * 1000;

/** A tab opened before files moved to direct uploads still posts base64 `images`. */
const RELOAD_FOR_FILES = "This page was updated while it was open. Copy your description, reload the page, and attach the files again.";

/** The note a request carries when the three columns are not in the database yet. */
const COLUMNS_MISSING_NOTE = "The request carried page addresses and/or a completion email address, but the reporting database has no columns for them yet, so they were not stored.";

/* ── cleaning what a person typed ────────────────────────────────────────── */

/**
 * The client's own words, kept as words.
 *
 * cleanText() from ../lib/reporting.mts is deliberately NOT used here. It collapses every
 * run of whitespace to one space, which is right for a title or a property name and wrong
 * for a body: it would weld a four-paragraph description of a broken booking form into a
 * single line. Rule 5 of the design document puts the client's own words on the Asana task
 * verbatim underneath our derived subject, and a wall of text is not verbatim.
 *
 * So line breaks survive, runs of blank lines collapse to one, trailing spaces go, and the
 * whole thing is capped.
 */
const cleanBody = (v: unknown, max: number): string =>
    String(v ?? "")
        .replace(/\r\n?/g, "\n")
        .replace(/[^\S\n]+/g, " ")
        .replace(/ *\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
        .slice(0, max);

/**
 * A client or company name reduced to the key two of them are compared on.
 *
 * BYTE FOR BYTE the normalizer in the platform's src/lib/capacity/client-map.ts, and copied
 * rather than shared because that module lives in the other repository. It is copied with
 * its rule attached: EXACT matches only. PLAN section 7 over there records what a fuzzy name
 * join cost once already (Anna on our client records is Ananya Arora in Asana; the join
 * produced two rows that both looked fine and were both wrong). Attaching a client's request
 * to the wrong company is that mistake with a customer watching, so a name that answers
 * twice resolves to nothing and says so.
 */
const normalizeName = (s: string): string =>
    s
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");

/** The one row whose name matches exactly, or null when none or more than one does. */
const matchOne = <T extends { name?: string | null }>(rows: T[], name: string): T | null => {
    const key = normalizeName(name);
    if (!key) return null;
    const hits = rows.filter((r) => normalizeName(String(r.name ?? "")) === key);
    return hits.length === 1 ? hits[0] : null;
};

const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/* ── who the client is, in three databases ───────────────────────────────── */

/**
 * The platform's own Supabase project, when this site has been given a key for it.
 *
 * It has not been, today: docs-hgm holds REPORTING_*, BRAIN_TICKETS_RECEIVED_URL and
 * BRAIN_API_KEY and no platform database credential at all. Reading the variables anyway
 * costs nothing and means tenant_id starts resolving the moment somebody sets them, with no
 * deploy. Until then every ticket records that the tenant was not looked up, which is the
 * truth, and the brain - which reads the row and CAN see `tenants` - is the right place for
 * that gap to be closed permanently.
 */
const BRAIN_DB_URL = process.env.BRAIN_SUPABASE_URL;
const BRAIN_DB_KEY = process.env.BRAIN_SUPABASE_SERVICE_ROLE_KEY;

interface Identity {
    /** The company as a person would write it. Never a slug if a real name can be found. */
    clientName: string;
    portalClientId: string | null;
    tenantId: string | null;
    /** Plain sentences for a human, empty when everything resolved. Never shown to a client. */
    notes: string[];
}

/**
 * Resolves the client against the portal and the platform, and never refuses.
 *
 * ── WHY THE NAME IS READ AGAIN HERE ─────────────────────────────────────────
 * verifyCaller() takes its clientName from `data.client_name` INSIDE the dashboard row's
 * jsonb, and falls back to the slug stem when that is missing. Measured against the live
 * portal project on 11 Sep 2026: of 54 dashboard rows, 0 carry `data.client_name` and 54
 * carry the top-level `client_name` COLUMN, which is also the one the help screen reads
 * (fetchClientRow in help-api.ts). So every caller would otherwise arrive here called
 * "paradise-pointe", and that string would become the client_name on the ticket and the key
 * both name matches below are tried on ("a person reading the task should see 'Paradise
 * Pointe', not a slug"). One read of the column fixes all three. The fallback chain stays, so
 * the day reporting.mts prefers the column this becomes belt and braces rather than a
 * behaviour change.
 *
 * ── THE PORTAL ID PROBLEM, MEASURED ─────────────────────────────────────────
 * `tickets.portal_client_id` is `uuid`. The portal's `clients.id` is `text` and holds a
 * slug: every one of the twenty rows sampled against the live project on 11 Sep 2026 parsed
 * as a slug and none as a uuid, and no other table in that project carries a uuid that
 * identifies a client. So the column as typed cannot hold the value it is named after. The
 * code below looks the client up anyway and writes the id only if it is uuid-shaped, which
 * is never today and costs one small read: the alternative is hard-coding "this is always
 * null", which hides the defect the day somebody fixes the column type. The defect is
 * reported rather than papered over - see the note this leaves on the row.
 */
const resolveIdentity = async (slug: string, fallbackName: string): Promise<Identity> => {
    const notes: string[] = [];
    let clientName = fallbackName;
    let portalClientId: string | null = null;
    let tenantId: string | null = null;

    try {
        const { data } = await portalDb().from("dashboard_pages").select("client_name").eq("slug", slug).maybeSingle();
        const named = cleanText(data?.client_name, 200);
        if (named) clientName = named;
    } catch (err) {
        console.error("[ticket-create] dashboard name lookup failed", err instanceof Error ? err.message : String(err));
    }

    if (!clientName) {
        notes.push("The dashboard row carries no client name, so neither the portal client nor the platform tenant could be matched.");
        return { clientName, portalClientId, tenantId, notes };
    }

    try {
        const { data, error } = await portalDb().from("clients").select("id, name").limit(1000);
        if (error) throw new Error(error.message);
        const hit = matchOne(data ?? [], clientName);
        if (!hit) {
            notes.push(`No single portal client is named "${clientName}", so portal_client_id is unset.`);
        } else if (isUuid(hit.id)) {
            portalClientId = hit.id;
        } else {
            notes.push(
                `The portal client for "${clientName}" is "${String(hit.id)}", which is not a uuid and cannot go in tickets.portal_client_id. The column type needs a decision.`,
            );
        }
    } catch (err) {
        notes.push("The portal client list could not be read, so portal_client_id is unset.");
        console.error("[ticket-create] portal client lookup failed", err instanceof Error ? err.message : String(err));
    }

    if (!BRAIN_DB_URL || !BRAIN_DB_KEY) {
        notes.push("This site holds no platform database credential, so tenant_id was not looked up. Routing has to resolve the tenant itself.");
        return { clientName, portalClientId, tenantId, notes };
    }

    try {
        const brain = createClient(BRAIN_DB_URL, BRAIN_DB_KEY, { auth: { persistSession: false } });
        const { data, error } = await brain.from("tenants").select("id, name").eq("is_active", true).limit(1000);
        if (error) throw new Error(error.message);
        const hit = matchOne(data ?? [], clientName);
        if (hit && isUuid(hit.id)) tenantId = hit.id;
        else notes.push(`No single active platform tenant is named "${clientName}", so tenant_id is unset and needs a human.`);
    } catch (err) {
        notes.push("The platform tenant list could not be read, so tenant_id is unset.");
        console.error("[ticket-create] tenant lookup failed", err instanceof Error ? err.message : String(err));
    }

    return { clientName, portalClientId, tenantId, notes };
};

/* ── the platform handoff ────────────────────────────────────────────────── */

/**
 * Tells the brain a ticket arrived. Never throws, never fails the submission.
 *
 * Carries the id and nothing else on purpose: the brain reads the row itself, so there is
 * one copy of the truth and a retry cannot deliver a stale version. Idempotency is the
 * brain's side of that contract (`routed_at` is its guard), which is why calling this twice
 * is safe and why the sweep can call it again for anything still `received`.
 */
const tellTheBrain = async (ticketId: string): Promise<void> => {
    if (!BRAIN_TICKET_URL || !BRAIN_API_KEY) {
        console.error("[ticket-create] BRAIN_TICKETS_RECEIVED_URL / BRAIN_API_KEY are not set - ticket left for the sweep", ticketId);
        return;
    }
    try {
        const res = await fetch(BRAIN_TICKET_URL, {
            method: "POST",
            headers: { "content-type": "application/json", "x-api-key": BRAIN_API_KEY },
            body: JSON.stringify({ ticket_id: ticketId }),
            signal: AbortSignal.timeout(BRAIN_TIMEOUT_MS),
        });
        // Status only. The body can carry our own internals and none of it changes what
        // happens next, which is always "leave it for the sweep".
        if (!res.ok) console.error("[ticket-create] the brain refused the handoff", res.status, ticketId);
    } catch (err) {
        console.error("[ticket-create] the brain could not be reached", err instanceof Error ? err.message : String(err), ticketId);
    }
};

/* ── the endpoint ────────────────────────────────────────────────────────── */

interface CreateBody {
    slug?: unknown;
    accessToken?: unknown;
    topic?: unknown;
    title?: unknown;
    detail?: unknown;
    property?: unknown;
    needed_by?: unknown;
    /** Everyone sets one since 13 Sep 2026: the client's form carries the same four levels. */
    priority?: unknown;
    urls?: unknown;
    notify_email?: unknown;
    upload_id?: unknown;
    files?: unknown;
    /** The retired base64 path. Only a tab opened before 28 Sep 2026 sends it. */
    images?: unknown;
}

const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
type Priority = (typeof PRIORITIES)[number];
const cleanPriority = (v: unknown): Priority | null => {
    const s = String(v ?? "").trim().toLowerCase();
    return (PRIORITIES as readonly string[]).includes(s) ? (s as Priority) : null;
};

const sameList = (a: unknown, b: string[]): boolean => {
    const x = Array.isArray(a) ? (a as unknown[]) : [];
    return x.length === b.length && x.every((v, i) => v === b[i]);
};

/** The row as the caller may see it: the internal note and the listed flag never leave. */
const forCaller = (row: Record<string, unknown>, showAddress: boolean): Record<string, unknown> => {
    const { intake_notes: _notes, notify_email_listed: _listed, notify_email, ...rest } = row;
    void _notes;
    void _listed;
    return showAddress && typeof notify_email === "string" && notify_email ? { ...rest, notify_email } : rest;
};

export default async (req: Request) => {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

    const parsed = await readJson<CreateBody>(req);
    if (!parsed.ok) return parsed.response;
    const body = parsed.body;

    try {
        const gate = await verifyCaller(String(parsed.body.slug ?? ""), accessTokenFrom(req, parsed.body));
        if (!gate.ok) return jsonError(gate.status, gate.error, gate.reason);
        // THE TEAM RAISES REQUESTS TOO. The first cut refused via: "staff" here on
        // the argument that a ticket is the client's own record; the owner's call
        // is that the team submits as well, from a client's help centre or from
        // the team's own form. So a staff-raised ticket is recorded under the
        // staff address in submitted_by, the client's screens say it was raised
        // for them by HiddenGem, and the person who raised it may withdraw it -
        // the same rule as for a client. Priority was staff-only at first; the
        // owner opened it to clients on 13 Sep 2026, with the legend as the guide.
        const caller = gate.caller;
        const priority = cleanPriority(body.priority);

        /* ── what they typed ─────────────────────────────────────────────── */

        // An open tab from before files moved to direct uploads. Its files would be
        // silently dropped, so it is told to reload rather than half-accepted.
        if (Array.isArray(body.images) && body.images.length > 0) return jsonError(422, RELOAD_FOR_FILES);

        const title = cleanText(body.title, MAX_TITLE);
        const detail = cleanBody(body.detail, MAX_DETAIL);
        const property = cleanText(body.property, MAX_PROPERTY);
        const topicKey = cleanText(body.topic, 60);

        if (!title) return jsonError(422, "Give the request a short title so it can be found again.");
        if (!detail) return jsonError(422, "Tell us what you need, in your own words. That text goes to whoever picks the request up.");

        // A `date` column takes null, not "". An unparseable date is treated as none given
        // rather than guessed at: needed_by is the client's own wish and inventing one would
        // be the first invented date in a system built not to have any.
        const neededBy = cleanDate(body.needed_by);
        if (neededBy !== null) {
            // One day of slack, because the browser's min= is the CLIENT's today and this
            // check runs on a UTC clock. A client in Los Angeles picking their own today
            // would otherwise be told it had already passed.
            const floor = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
            if (neededBy < floor) return jsonError(422, "That date has already passed. Pick a date from today onwards, or leave it blank.");
        }

        const pages = cleanUrls(body.urls);
        if (!pages.ok) return jsonError(422, pages.error);
        const urls = pages.urls;

        // THE SWITCH DECIDES WHETHER AN ADDRESS EXISTS AT ALL. Until the platform can send,
        // nobody may be promised an email, so an address sent anyway (an old tab, a hand-made
        // call) is not validated, not stored and not returned. Counted, never logged.
        const emailOpen = completionEmailOpen(completionEmailModeNow(), gate.via === "staff");
        let notify: string | null = null;
        if (emailOpen) {
            const cleaned = cleanNotifyEmail(body.notify_email);
            if (!cleaned.ok) return jsonError(422, cleaned.error);
            notify = cleaned.email;
        } else if (body.notify_email !== undefined && body.notify_email !== null && body.notify_email !== "") {
            console.log("[ticket-create] completion email address ignored: the switch is off for this caller", 1);
        }

        // The files, as ids. Both or neither: a file id means nothing without its upload.
        const fileIds = Array.isArray(body.files) ? body.files.map((f) => (f && typeof f === "object" ? (f as { file_id?: unknown }).file_id : undefined)) : [];
        if (body.files !== undefined && !Array.isArray(body.files)) return jsonError(400, "Bad request.");
        if (fileIds.length && (body.upload_id === undefined || body.upload_id === null)) return jsonError(400, "Bad request.");

        /* ── the topic, as it is right now ───────────────────────────────── */

        const db = reportingDb();
        const { data: topicRow, error: topicErr } = await db.from("ticket_topics").select("key").eq("key", topicKey).eq("is_active", true).maybeSingle();
        if (topicErr) {
            console.error("[ticket-create] topic read failed", topicErr.message);
            return jsonError(500, "Could not check the request type. Nothing was saved - try again in a moment.");
        }
        if (!topicRow) return jsonError(422, "That request type is not available. Reload the page and pick one from the list.");

        /* ── the same request, a minute ago ──────────────────────────────── */

        // intake_notes as well, for the writes this path can make below; the new columns so
        // a retry can be reconciled. Both are stripped from the answer (forCaller). Without
        // the new columns in the database yet, the base list, and nothing new is written.
        const since = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString();
        const recentQuery = (cols: string) =>
            db.from("tickets").select(cols).eq("client_slug", caller.slug).eq("submitted_by", caller.email).eq("title", title).eq("detail", detail).gte("created_at", since).order("created_at", { ascending: false }).limit(1);
        let columnsMissing = false;
        let recentRes = await recentQuery(`${withPages(CLIENT_TICKET_COLUMNS)}, ${NOTIFY_COLUMNS}, intake_notes`);
        if (recentRes.error && isMissingColumn(recentRes.error)) {
            columnsMissing = true;
            recentRes = await recentQuery(`${CLIENT_TICKET_COLUMNS}, intake_notes`);
        }
        if (recentRes.error) console.error("[ticket-create] duplicate lookup failed, treating the request as new", recentRes.error.message);
        const recent = (recentRes.data ?? []) as unknown as Array<Record<string, unknown>>;

        if (recent.length) {
            // The first attempt landed; only the answer was lost. Handing back the ticket it
            // made is both true and what the client wanted, and it creates no second task.
            const existing = recent[0] as Record<string, unknown> & { id: string; reference: string; status: string; intake_notes: string | null };
            console.warn("[ticket-create] repeat submission inside the window, returning the existing ticket", existing.reference);
            const priorNotes = typeof existing.intake_notes === "string" && existing.intake_notes ? [existing.intake_notes.replace(/^Unresolved on receipt: /, "")] : [];

            // WHAT THE RETRY CARRIES. Between the attempt that died and this one the
            // person may have changed the chip, the pages or the address; the row keeps the
            // first values and the task would be filed under them. Reconciled only while the
            // ticket is still received: once routed, the Asana task holds the values and a
            // silent change here would leave the two disagreeing.
            const patch: Record<string, unknown> = {};
            if (priority && existing.priority !== priority) patch.priority = priority;
            if (!columnsMissing && !sameList(existing.urls, urls)) patch.urls = urls.length ? urls : null;
            if (!columnsMissing && emailOpen && (existing.notify_email ?? null) !== notify) {
                patch.notify_email = notify;
                patch.notify_email_listed = notify ? isStaffEmail(notify) || (await isListedOn(caller.slug, notify)) : null;
            }
            if (Object.keys(patch).length && existing.status === "received") {
                // The answer shows the new values only when the guarded update matched the row:
                // routing can claim the ticket between the read above and this write, and the
                // success card must not say an email goes to an address that was never stored.
                const { data: patched, error: patchErr } = await db.from("tickets").update(patch).eq("id", existing.id).eq("status", "received").is("routed_at", null).select("id");
                if (patchErr) console.warn("[ticket-create] could not carry the retry's values onto the existing ticket", existing.reference, patchErr.message);
                else if ((patched ?? []).length) Object.assign(existing, patch);
                else console.warn("[ticket-create] the existing ticket was routed before the retry's values could be carried onto it", existing.reference);
            }

            // THE FILES THE FIRST ATTEMPT LOST. The attempt most likely to have died is the
            // one that got past the insert and not past the listing. Proved against THIS
            // ticket, so rows the dead attempt already claimed for it pass; then claimed and
            // listed, skipping what is already on it, so a partial first attempt is finished
            // rather than left short.
            if (fileIds.length) {
                const verified = await verifyUploads({ caller, via: gate.via, uploadId: body.upload_id, fileIds, ticketId: existing.id });
                if (!verified.ok) return jsonError(verified.status, verified.error);
                const claimed = await claimUploads(existing.id, verified.files);
                const { recorded, total } = await recordAttachments(existing.id, claimed, priorNotes, verified.files.length);
                if (total !== null) existing.image_count = total;
                // Idempotent on the brain's side, so telling it again costs nothing if it had.
                if (recorded > 0) await tellTheBrain(existing.id);
            }
            const files = await ticketFiles(existing.id);
            return Response.json({ ticket: forCaller(existing, emailOpen), files }, { status: 201 });
        }

        /* ── the files, proved before the row exists ─────────────────────── */

        let verified: VerifiedFile[] = [];
        if (fileIds.length) {
            const check = await verifyUploads({ caller, via: gate.via, uploadId: body.upload_id, fileIds });
            if (!check.ok) return jsonError(check.status, check.error);
            verified = check.files;
        }

        /* ── who they are ────────────────────────────────────────────────── */

        const identity = await resolveIdentity(caller.slug, caller.clientName);
        const notifyListed = notify ? isStaffEmail(notify) || (await isListedOn(caller.slug, notify)) : null;

        /* ── the row ─────────────────────────────────────────────────────── */

        // image_count starts at 0 and is set to the number of files actually listed. It
        // counts every file now, not only images; the name predates PDFs. Understating is
        // survivable; a client told six files are attached when none are reachable is not.
        // `reference` and `status` are left to their column defaults so "REQ-nnnn" and
        // "received" have exactly one definition, in the database.
        const base = {
            client_slug: caller.slug,
            portal_client_id: identity.portalClientId,
            tenant_id: identity.tenantId,
            client_name: identity.clientName,
            submitted_by: caller.email,
            submitted_by_name: caller.name,
            topic: topicRow.key,
            title,
            detail,
            property: property || null,
            needed_by: neededBy,
            priority,
            image_count: 0,
        };
        // Only named when there is something to store, so a request with no pages and no
        // address inserts exactly as it did before the columns existed.
        const carriesNew = urls.length > 0 || notify !== null;
        const extra = carriesNew ? { urls: urls.length ? urls : null, ...(notify ? { notify_email: notify, notify_email_listed: notifyListed } : {}) } : {};
        const insert = (withNew: boolean, notes: string[]) =>
            db
                .from("tickets")
                .insert({
                    ...base,
                    ...(withNew ? extra : {}),
                    // Intake observations, NOT a routing failure. route_error belongs to the
                    // brain, and its sweep finds new arrivals with route_error IS NULL, so a
                    // note written there put every ticket in the wrong half of that triage.
                    intake_notes: asNote(notes),
                })
                .select(withNew && carriesNew ? `${withPages(CLIENT_TICKET_COLUMNS)}, ${NOTIFY_COLUMNS}` : CLIENT_TICKET_COLUMNS)
                .single();

        let notes = identity.notes;
        let { data: ticket, error: insertErr } = await insert(true, notes);
        if (insertErr && carriesNew && isMissingColumn(insertErr)) {
            // The SQL has not been pasted yet. The request still goes; the team is told what
            // it carried that could not be kept, and the client is promised nothing about it.
            console.warn("[ticket-create] the pages / completion email columns are missing, storing the request without them");
            notes = [...identity.notes, COLUMNS_MISSING_NOTE];
            ({ data: ticket, error: insertErr } = await insert(false, notes));
        }

        if (insertErr || !ticket) {
            console.error("[ticket-create] insert failed", insertErr?.message);
            return jsonError(500, "We could not save your request. Nothing was sent - try again in a moment.");
        }

        const row = ticket as unknown as Record<string, unknown> & { id: string; reference: string };

        /* ── everything past here is best effort ─────────────────────────── */

        // The timeline's first entry. No body: the client's own words are already on the
        // ticket, and repeating them here would show them twice on the detail screen and
        // double what gets mirrored into Asana.
        const { error: eventErr } = await db.from("ticket_events").insert({
            ticket_id: row.id,
            kind: "received",
            actor_email: caller.email,
            actor_name: caller.name,
        });
        if (eventErr) console.error("[ticket-create] received event failed", eventErr.message, row.reference);

        // Claimed and listed BEFORE the brain is told, so routing's notes line and the
        // task's attachments see every file.
        let files: Array<{ name: string; mime: string; bytes: number | null }> = [];
        if (verified.length) {
            const claimed = await claimUploads(row.id, verified);
            const { total } = await recordAttachments(row.id, claimed, notes, verified.length);
            if (total !== null) row.image_count = total;
            files = await ticketFiles(row.id);
        }

        await tellTheBrain(row.id);

        return Response.json({ ticket: forCaller(row, emailOpen), files }, { status: 201 });
    } catch (err) {
        if (err instanceof ConfigError) {
            console.error("[ticket-create] not configured", err.message);
            return jsonError(500, "The help centre is not configured. Ask your account manager to tell the web team.");
        }
        console.error("[ticket-create] unexpected failure", err instanceof Error ? err.message : String(err));
        return jsonError(500, "Something went wrong at our end.");
    }
};
