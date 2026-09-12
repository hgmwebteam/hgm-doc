import { createClient } from "@supabase/supabase-js";
import { type TicketImage, uploadTicketImages } from "../lib/drive.mts";
import {
    BRAIN_API_KEY,
    BRAIN_TICKET_URL,
    ConfigError,
    cleanDate,
    cleanText,
    jsonError,
    portalDb,
    readJson,
    reportingDb,
    accessTokenFrom, verifyCaller,
} from "../lib/reporting.mts";

/**
 * A client raises a request.
 *
 * This is the only way a row ever enters `tickets`, and it is the one endpoint in the help
 * centre where being wrong costs a client their words rather than a screen refresh. The
 * shape of it follows from that: everything that can be done before the row exists is done
 * first and can refuse the call; everything after the row exists is best effort and can
 * only ever ADD to it.
 *
 *   verify the caller -> validate the request -> resolve who they are ->
 *   INSERT the ticket -> INSERT the "received" event -> store the images ->
 *   tell the brain
 *
 * Past the insert, nothing is allowed to turn into an error the client sees. A Drive outage
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
 * The slow work (images, the platform handoff) happens after the row exists, so an
 * invocation that runs out of time leaves a real ticket behind and shows the client a
 * network error. The obvious thing for them to do next is press the button again. Without
 * the "the same request, a minute ago" check below that produces two tickets, two Asana
 * tasks and two people chasing the same job, which is precisely the mess this exists to end.
 *
 * POST application/json
 *   { slug, topic, title, detail, property?, needed_by?, images? } + Authorization: Bearer <session token>
 *   -> 201 { ticket }
 */

/* ── caps ────────────────────────────────────────────────────────────────── */

const MAX_TITLE = 140;
const MAX_DETAIL = 5000;
const MAX_PROPERTY = 160;
const MAX_FILE_NAME = 200;

/** Both mirror src/pages/client/help/help-api.ts, which enforces them in the browser first.
 *  Repeated here because the browser's copy is advice: this one is the rule. The payload cap
 *  counts BASE64 characters, the same measure the browser counts, so the two can never
 *  disagree about which file was the one over the line. */
const MAX_IMAGES = 6;
const MAX_IMAGE_PAYLOAD_CHARS = 4_000_000;

/** What may be attached to a request. Deliberately the same list netlify/lib/drive.mts
 *  accepts, HEIC included: an iPhone hands over HEIC by default and a client photographing a
 *  property is on a phone. Anything not on it is refused here, before a byte is decoded. */
const ALLOWED_IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/heic", "image/heif"]);

/** The handoff is best effort and the client is waiting, so it gets a budget rather than the
 *  whole invocation. Anything still `received` is the sweep's job. */
const BRAIN_TIMEOUT_MS = 5_000;

/** How long two identical requests from one person count as one. Long enough to cover a
 *  timed-out invocation and the retry it invites, short enough that a client who genuinely
 *  raises the same thing twice in an afternoon gets two tickets. */
const DUPLICATE_WINDOW_MS = 5 * 60 * 1000;

/** Kept in step with ticket-detail.mts and ticket-withdraw.mts, which hand back the same row.
 *  Everything a client has no business seeing is absent by construction rather than deleted
 *  afterwards: tenant_id, portal_client_id, asana_task_gid, asana_task_url, asana_project_gid,
 *  derived_subject, routed_at and route_error are all internal routing state. derived_subject
 *  in particular is OUR summary of their words, not theirs. */
const TICKET_COLUMNS =
    "id, reference, topic, title, status, created_at, detail, property, needed_by, priority, image_count, drive_folder_url, client_slug, client_name, submitted_by, submitted_by_name, assignee_name, assignee_email, account_manager_email, promised_date, completed_at, completed_by, withdrawn_at, withdrawn_by";

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
 * "paradise-pointe", and that string would become the client_name on the ticket, the key
 * both name matches below are tried on, and the Drive folder name - which netlify/lib/
 * drive.mts goes out of its way to keep human ("a person opening Drive should see 'Paradise
 * Pointe', not a slug"). One read of the column fixes all four. The fallback chain stays, so
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

/** One field, capped, for whoever picks the ticket up. `intake_notes` is the only free-text
 *  column on the row a human reads, and routing overwrites it with its own reason if it
 *  later fails, which is the right precedence: a live routing failure matters more than a
 *  mapping gap recorded on receipt. */
const asNote = (notes: string[]): string | null => {
    const joined = notes
        .map((n) => n.trim())
        .filter(Boolean)
        .join(" ");
    return joined ? `Unresolved on receipt: ${joined}`.slice(0, 900) : null;
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
/** How long into the request images may still be going to Drive. The rest of
 *  the 26s belongs to the write-back that records where they went, the handoff
 *  to the brain, and the response. Anything not uploaded by then is diverted to
 *  Supabase Storage, which is quick, and the note says so. */
const IMAGE_BUDGET_MS = 16_000;

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
    images?: unknown;
    /** Team only. A client has no priority control, and one is never inferred for them. */
    priority?: unknown;
}

const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
type Priority = (typeof PRIORITIES)[number];
const cleanPriority = (v: unknown): Priority | null => {
    const s = String(v ?? "").trim().toLowerCase();
    return (PRIORITIES as readonly string[]).includes(s) ? (s as Priority) : null;
};

export default async (req: Request) => {
    // One clock for the whole request. Netlify kills a synchronous function at
    // 26 seconds and everything below shares that budget, so the parts that can
    // overrun are measured from HERE rather than from wherever they happen to
    // start.
    const startedAt = Date.now();
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
        // the same rule as for a client. Priority is the one thing only staff may
        // set: a client marking everything urgent is what a triage field exists
        // to prevent, so a client's value is dropped rather than refused.
        const caller = gate.caller;
        const priority = gate.via === "staff" ? cleanPriority(body.priority) : null;

        /* ── what they typed ─────────────────────────────────────────────── */

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

        /* ── the attachments ─────────────────────────────────────────────── */

        const rawImages = Array.isArray(body.images) ? body.images : [];
        if (rawImages.length > MAX_IMAGES) return jsonError(422, `A request can carry at most ${MAX_IMAGES} images.`);

        const images: TicketImage[] = [];
        let payloadChars = 0;
        for (const raw of rawImages) {
            const item = (raw ?? {}) as { name?: unknown; mime?: unknown; dataBase64?: unknown };
            const mime = String(item.mime ?? "")
                .toLowerCase()
                .split(";")[0]
                .trim();
            const dataBase64 = typeof item.dataBase64 === "string" ? item.dataBase64 : "";
            if (!ALLOWED_IMAGE_MIME.has(mime)) return jsonError(422, "Only images can be attached to a request.");
            if (!dataBase64) return jsonError(422, "One of those images could not be read. Remove it and try again.");
            payloadChars += dataBase64.length;
            // 413 rather than 422: help-api.ts already has the sentence for it, and Netlify
            // rejects the whole body over 6MB anyway, so this is the limit that is real.
            if (payloadChars > MAX_IMAGE_PAYLOAD_CHARS) return jsonError(413, "Those images are too large to send together. Remove one and try again.");
            images.push({ name: cleanText(item.name, MAX_FILE_NAME) || "image", mime, dataBase64 });
        }

        /* ── the topic, as it is right now ───────────────────────────────── */

        const db = reportingDb();
        const { data: topicRow, error: topicErr } = await db.from("ticket_topics").select("key").eq("key", topicKey).eq("is_active", true).maybeSingle();
        if (topicErr) {
            console.error("[ticket-create] topic read failed", topicErr.message);
            return jsonError(500, "Could not check the request type. Nothing was saved - try again in a moment.");
        }
        if (!topicRow) return jsonError(422, "That request type is not available. Reload the page and pick one from the list.");

        /* ── the same request, a minute ago ──────────────────────────────── */

        const since = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString();
        const { data: recent } = await db
            .from("tickets")
            .select(TICKET_COLUMNS)
            .eq("client_slug", caller.slug)
            .eq("submitted_by", caller.email)
            .eq("title", title)
            .eq("detail", detail)
            .gte("created_at", since)
            .order("created_at", { ascending: false })
            .limit(1);
        if (recent && recent.length) {
            // The first attempt landed; only the answer was lost. Handing back the ticket it
            // made is both true and what the client wanted, and it creates no second task.
            console.warn("[ticket-create] repeat submission inside the window, returning the existing ticket", (recent[0] as { reference: string }).reference);
            return Response.json({ ticket: recent[0] }, { status: 201 });
        }

        /* ── who they are ────────────────────────────────────────────────── */

        const identity = await resolveIdentity(caller.slug, caller.clientName);

        /* ── the row ─────────────────────────────────────────────────────── */

        // image_count starts at 0 and is corrected once the images are actually somewhere.
        // Understating is survivable; a client told six screenshots are attached when none
        // are reachable is not. `reference` and `status` are left to their column defaults so
        // "REQ-nnnn" and "received" have exactly one definition, in the database.
        const { data: ticket, error: insertErr } = await db
            .from("tickets")
            .insert({
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
                // Intake observations, NOT a routing failure. route_error belongs to the
                // brain, and its sweep finds new arrivals with route_error IS NULL, so a
                // note written there put every ticket in the wrong half of that triage.
                intake_notes: asNote(identity.notes),
            })
            .select(TICKET_COLUMNS)
            .single();

        if (insertErr || !ticket) {
            console.error("[ticket-create] insert failed", insertErr?.message);
            return jsonError(500, "We could not save your request. Nothing was sent - try again in a moment.");
        }

        const row = ticket as Record<string, unknown> & { id: string; reference: string };

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

        if (images.length) {
            // uploadTicketImages never throws and says honestly where the images ended up.
            // The try/catch is for the module failing to load at all, not for its logic.
            try {
                const stored = await uploadTicketImages({
                    clientName: identity.clientName,
                    reference: row.reference,
                    images,
                    // Leaves room for the write-back below, the brain handoff and
                    // the response itself, all inside the platform's 26s.
                    deadline: startedAt + IMAGE_BUDGET_MS,
                });
                const patch: Record<string, unknown> = { image_count: stored.uploaded, updated_at: new Date().toISOString() };
                if (stored.folderUrl) patch.drive_folder_url = stored.folderUrl;
                // A human step is owed only when something is not where it should be. The
                // note joins whatever resolveIdentity already left, so one field answers
                // "what does somebody have to do about this ticket".
                if (stored.note) patch.intake_notes = asNote([...identity.notes, stored.note]);

                const { error: patchErr } = await db.from("tickets").update(patch).eq("id", row.id);
                if (patchErr) {
                    console.error("[ticket-create] could not record where the images went", patchErr.message, row.reference);
                } else {
                    // The answer has to match the row that is now stored, not the one that
                    // was inserted a moment ago. intake_notes stays off it: it is a note for
                    // the team and TICKET_COLUMNS has never carried it.
                    row.image_count = stored.uploaded;
                    if (stored.folderUrl) row.drive_folder_url = stored.folderUrl;
                }
            } catch (err) {
                console.error("[ticket-create] image storage failed outright", err instanceof Error ? err.message : String(err), row.reference);
            }
        }

        await tellTheBrain(row.id);

        return Response.json({ ticket: row }, { status: 201 });
    } catch (err) {
        if (err instanceof ConfigError) {
            console.error("[ticket-create] not configured", err.message);
            return jsonError(500, "The help centre is not configured. Ask your account manager to tell the web team.");
        }
        console.error("[ticket-create] unexpected failure", err instanceof Error ? err.message : String(err));
        return jsonError(500, "Something went wrong at our end.");
    }
};
