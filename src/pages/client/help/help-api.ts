/**
 * The only place the help centre talks to a server.
 *
 * Every ticket read and write goes through a Netlify Function, never through the browser's
 * Supabase client. That is not a style preference: tickets live in a THIRD Supabase project
 * (HGM Reporting) whose tables have RLS on with no permissive policy, so the service key is
 * the only way in and it can only live on the server. There is deliberately no reporting
 * client in this bundle to reach for. See netlify/lib/reporting.mts, which is the other half
 * of this file.
 *
 * ── WHO THE CALLER IS ───────────────────────────────────────────────────────
 * A Supabase session, and nothing else. Every request carries the live access
 * token as a bearer header and the server asks the auth server who it belongs
 * to.
 *
 * An earlier version of this file kept the dashboard's share password in
 * sessionStorage and sent it as proof. Its own comment argued that stored
 * nothing which was not already reachable, "since anyone able to read this
 * entry can already read the password from the row itself". That was true, and
 * it was the problem rather than the defence: measured 12 Sep 2026, the public
 * anon key returns all 54 dashboard_pages rows and seven carry share_password
 * in plaintext. A secret everybody can read cannot establish who anybody is.
 *
 * That comment ended by naming its own successor: "If the portal ever moves to
 * a real session, this record and the gate that fills it are the two things to
 * delete." Both are deleted. The email below is carried only to autofill the
 * form and to show whose request is whose; it is never what authorises
 * anything.
 */
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabase } from "@/lib/supabase";
import type { Priority, Ticket, TicketCounts, TicketEvent, TicketFile, TicketTopic } from "@/pages/client/help/help-model";
import { FILE_TYPES, type FileType, fileUploadFailed } from "@/pages/client/help/request-rules";
import { compressImageFile } from "@/utils/compress-image";

/* ── Slugs ───────────────────────────────────────────────────────────────── */

/**
 * The full dashboard slug for whatever was in the URL.
 *
 * A dashboard is reachable both at `/paradise-pointe-dashboard` and at the short
 * `/paradise-pointe` (client-screen.tsx resolves the short form as a last chance before a
 * 404), so `/paradise-pointe/help` has to work too. Everything downstream - the unlock key,
 * the proof key and verifyCaller's `isDashboardSlug` check - expects the full form, so the
 * normalisation happens once, here, rather than being remembered at four call sites.
 */
export const fullDashboardSlug = (slug: string): string => {
    const s = slug.trim().toLowerCase();
    return s.endsWith("-dashboard") ? s : `${s}-dashboard`;
};

/* ── The caller ─────────────────────────────────────────────────────────── */

/**
 * Who the screen thinks it is acting for. The slug addresses the dashboard; the
 * email is for display and autofill only. Neither authorises anything: the
 * server derives identity from the session token on every call and ignores
 * whatever this says.
 */
export interface CallerProof {
    slug: string;
    email: string;
}

/** Matches dashboard-model.ts, so the two agree on what counts as the same address. */
const normEmail = (e: string) => e.trim().toLowerCase();

/**
 * The signed-in address, from the session itself rather than from storage.
 * Returns null when nobody is signed in, which is what shows the sign-in panel.
 */
export const currentCaller = async (slug: string): Promise<CallerProof | null> => {
    const { data } = await supabase.auth.getSession();
    const email = normEmail(data.session?.user?.email ?? "");
    return email ? { slug, email } : null;
};

/* ── Calling a function ──────────────────────────────────────────────────── */

/**
 * Why a 403 happened, from the server, so the screen can pick a next action.
 *
 *   not_listed       the session is fine and this address is not on this
 *                    dashboard's list. The server says exactly this for an
 *                    unlisted address, an empty list AND a dashboard that does
 *                    not exist, on purpose: telling them apart would let anyone
 *                    with a session learn which slugs exist. The screen's words
 *                    are written to be true in all three cases.
 */
export type RefusalReason = "not_listed";

export class HelpApiError extends Error {
    readonly status: number;
    /** True when the session was rejected, so the caller knows to re-show the gate. */
    readonly unauthorised: boolean;
    /** Set on a 403 the server explained by code. Undefined on every other error. */
    readonly reason?: RefusalReason;

    constructor(status: number, message: string, reason?: RefusalReason) {
        super(message);
        this.name = "HelpApiError";
        this.status = status;
        this.unauthorised = status === 401;
        this.reason = reason;
    }
}

/**
 * Who the server decided is looking, and how they got in. Comes back on every
 * successful read so the screen can announce a staff view, and on an empty
 * dashboard say that no client can use it yet.
 */
export interface Viewer {
    via: "allowlist" | "staff";
    email: string;
    /** The name the account manager listed them under, or the mailbox name. */
    name: string;
    clientName: string;
    accessListEmpty: boolean;
}

const FUNCTIONS_BASE = "/.netlify/functions";

/**
 * POSTs JSON to one portal function and returns its parsed body.
 *
 * Messages for 400, 403, 422, 429 and 503 are passed through from the server verbatim (each
 * is a sentence written for the person: a file the team cannot open, the day's file limit,
 * files that cannot be attached right now), and a 403 also carries a reason code the screen
 * keys its next action on (a sentence alone cannot tell "not on the list" from "may read,
 * may not act"). Everything else gets one plain line, because a raw 500 body is noise to a
 * client and can carry internals.
 */
const callFunction = async <T>(name: string, body: Record<string, unknown>): Promise<T> => {
    // The session token is read at CALL TIME, never stored by this module. Supabase
    // refreshes it in the background, so a copy kept anywhere would go stale, and a
    // token is a bearer credential: the fewer places it rests, the better. It travels
    // in the Authorization header rather than the body so it stays out of referrers
    // and out of anything that logs a request payload.
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token ?? "";
    if (!token) {
        throw new HelpApiError(401, "Your session has expired. Sign in again to use the help centre.");
    }

    let res: Response;
    try {
        res = await fetch(`${FUNCTIONS_BASE}/${name}`, {
            method: "POST",
            headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
            body: JSON.stringify(body),
        });
    } catch {
        // fetch only rejects on a transport failure, so this is genuinely the network and
        // not an error status. Saying so stops a client retrying a request that did land.
        throw new HelpApiError(0, "We could not reach HiddenGem Media just then. Check your connection and try again.");
    }

    const payload = (await res.json().catch(() => null)) as { error?: string; reason?: string } | null;

    if (!res.ok) {
        const fromServer = typeof payload?.error === "string" ? payload.error.trim() : "";
        const reason = payload?.reason === "not_listed" ? payload.reason : undefined;
        if (res.status === 401) throw new HelpApiError(401, "Your session has expired. Sign in again to use the help centre.");
        if ([400, 403, 422, 429, 503].includes(res.status) && fromServer) throw new HelpApiError(res.status, fromServer, reason);
        if (res.status === 413) throw new HelpApiError(413, "Those files are too large to send together. Remove one and try again.");
        throw new HelpApiError(res.status, "Something went wrong at our end. Nothing was lost - try again in a moment.");
    }

    return payload as T;
};

/* ── The five endpoints ──────────────────────────────────────────────────── */

/** The topics a client may raise a request against. */
export const fetchTopics = (proof: CallerProof): Promise<{ viewer: Viewer; topics: TicketTopic[] }> => callFunction("ticket-topics", { slug: proof.slug });

/** Every request this client has raised, newest first, withdrawn ones included. */
export const fetchTickets = (proof: CallerProof): Promise<{ viewer: Viewer; tickets: Ticket[]; counts: TicketCounts }> =>
    callFunction("ticket-list", { slug: proof.slug });

/** One request, its full history and the names of its files. */
export const fetchTicket = (proof: CallerProof, reference: string): Promise<{ viewer: Viewer; ticket: Ticket; events: TicketEvent[]; files?: TicketFile[] }> =>
    callFunction("ticket-detail", { slug: proof.slug, reference });

/**
 * Sign out, then start Google again with the account chooser forced.
 *
 * This is the one thing a refused client can do for themselves: they signed in
 * with the wrong Google account, and the right one is a click away. Without an
 * exit there was no way to reach it - the help centre had no sign-out at all,
 * and a session from another surface of the portal skipped the sign-in panel
 * entirely. prompt=select_account is what makes Google show the list rather
 * than silently reusing the account it just used.
 */
export const useDifferentAccount = async (): Promise<void> => {
    await supabase.auth.signOut();
    await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.href, queryParams: { prompt: "select_account" } },
    });
};

/** Signs out and reloads the page, which brings up the sign-in panel. The avatar menu's
 *  "Sign out": nothing else is prompted, unlike useDifferentAccount. */
export const signOutHere = async (): Promise<void> => {
    await supabase.auth.signOut();
    window.location.assign(window.location.pathname);
};

/** Closes a request and marks it withdrawn. The row is never deleted. */
export const withdrawTicket = (proof: CallerProof, reference: string): Promise<{ ticket: Ticket }> =>
    callFunction("ticket-withdraw", { slug: proof.slug, reference, confirm: true });

export interface NewTicketInput {
    topic: string;
    /** The Submitted by name, cleaned by request-rules.ts. Required: the server refuses a request without one. */
    submitted_by_name: string;
    title: string;
    detail: string;
    property?: string;
    needed_by?: string;
    /** Everyone sets one since 13 Sep 2026. */
    priority?: Priority;
    /** The pages the request is about, already cleaned by request-rules.ts. */
    urls?: string[];
    /** The completion email address; sent only while the field is shown, and required then. */
    notify_email?: string;
    /** The form session's upload id and the files uploaded under it (ticket-upload-url). */
    upload_id?: string;
    files?: Array<{ file_id: string }>;
}

export const createTicket = async (proof: CallerProof, input: NewTicketInput): Promise<{ ticket: Ticket; files: TicketFile[] }> => {
    const res = await callFunction<{ ticket: Ticket; files?: TicketFile[] }>("ticket-create", {
        slug: proof.slug,
        topic: input.topic,
        submitted_by_name: input.submitted_by_name,
        title: input.title,
        detail: input.detail,
        // Omitted rather than sent empty: a `date` column takes null, not "", and an empty
        // property string would show as a blank PROPERTY row on the detail screen.
        ...(input.property?.trim() ? { property: input.property.trim() } : {}),
        ...(input.needed_by ? { needed_by: input.needed_by } : {}),
        ...(input.priority ? { priority: input.priority } : {}),
        ...(input.urls?.length ? { urls: input.urls } : {}),
        ...(input.notify_email ? { notify_email: input.notify_email } : {}),
        ...(input.upload_id && input.files?.length ? { upload_id: input.upload_id, files: input.files } : {}),
    });
    // An older function answered without `files`; the success card must not throw on it.
    return { ticket: res.ticket, files: res.files ?? [] };
};

/* ── The team's own reads ────────────────────────────────────────────────── */

/**
 * Every client's requests, newest first, for the team. Staff only on the server
 * (verifyStaff); a client session gets the same 403 as an unlisted address.
 * Pass `before` from the previous page's next_before to keep going.
 */
export const fetchAllTickets = (opts: { before?: string | null; status?: string; client_slug?: string } = {}): Promise<{ viewer: Viewer; tickets: Ticket[]; total: number; next_before: string | null }> =>
    callFunction("ticket-list-all", {
        ...(opts.before ? { before: opts.before } : {}),
        ...(opts.status ? { status: opts.status } : {}),
        ...(opts.client_slug ? { client_slug: opts.client_slug } : {}),
    });

/** The clients a team member may raise a request for: every dashboard, by name. */
export interface ClientOption {
    slug: string;
    name: string;
}
export const fetchClientOptions = async (): Promise<ClientOption[]> => {
    const { data } = await supabase.from("dashboard_pages").select("slug, client_name, data").order("client_name", { ascending: true });
    return ((data ?? []) as Array<{ slug: string; client_name: string | null; data: { client_name?: string } | null }>)
        .filter((r) => /-dashboard$/.test(r.slug))
        .map((r) => ({ slug: r.slug, name: (r.client_name ?? r.data?.client_name ?? "").trim() || r.slug.replace(/-dashboard$/, "") }))
        .sort((a, b) => a.name.localeCompare(b.name));
};

/* ── Files ───────────────────────────────────────────────────────────────── */

/**
 * Field caps, held EQUAL to the ones ticket-create.mts enforces rather than merely below
 * them.
 *
 * Capping tighter in the browser looks like the safe direction and is not: it silently
 * stops a client's sentence at a limit the server would have accepted, with no message,
 * mid-word. Capping looser lets them write something that is then truncated after they
 * press send. Equal is the only setting where the field stops where the rule is. If the
 * server's numbers move, move these with them. The file, page and address rules live in
 * request-rules.ts, which the server imports too.
 */
export const MAX_TITLE = 140;
export const MAX_DETAIL = 5000;
export const MAX_PROPERTY = 160;

/** What ticket-upload-url grants for one file: where to put it, as what, under which token. */
export interface UploadGrant {
    file_id: string;
    /** The stored name (request-rules.ts storedFileName). */
    name: string;
    mime: string;
    path: string;
    token: string;
}

/**
 * Signed upload URLs for files about to be uploaded. The first call of a form session
 * passes no upload id and gets one back; later calls pass it, so every file of one request
 * sits under one upload. `slug` is the client's own help centre (a client, or staff viewing
 * it); null is the team's form, where the server checks for staff.
 */
export const requestUploadUrls = (slug: string | null, uploadId: string | null, files: Array<{ name: string; mime: string; bytes: number }>): Promise<{ upload_id: string; bucket: string; files: UploadGrant[] }> =>
    callFunction("ticket-upload-url", { ...(slug ? { slug } : {}), ...(uploadId ? { upload_id: uploadId } : {}), files });

/**
 * fetch, carried over XMLHttpRequest, because only XHR reports how much of a request body
 * has gone (fetch has no upload progress). Handed ONLY to the upload's own storage client
 * below, which builds the request exactly as supabase-js does (same class, same URL, same
 * form body); this changes how the bytes travel, not what is sent. A transport failure
 * rejects with a TypeError, as fetch does.
 */
const xhrFetch =
    (onProgress?: (sent: number, total: number) => void): typeof fetch =>
    (input, init) =>
        new Promise<Response>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
            xhr.open(init?.method ?? "GET", url);
            new Headers(init?.headers).forEach((value, key) => xhr.setRequestHeader(key, value));
            if (onProgress) xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded, e.total);
            xhr.onload = () => {
                const headers = new Headers();
                for (const line of xhr.getAllResponseHeaders().trim().split(/[\r\n]+/)) {
                    const at = line.indexOf(":");
                    if (at > 0) headers.append(line.slice(0, at).trim(), line.slice(at + 1).trim());
                }
                const empty = xhr.status === 204 || xhr.status === 205 || xhr.status === 304;
                resolve(new Response(empty ? null : xhr.responseText, { status: xhr.status, statusText: xhr.statusText, headers }));
            };
            xhr.onerror = () => reject(new TypeError("Failed to fetch"));
            xhr.onabort = () => reject(new DOMException("The upload was stopped.", "AbortError"));
            init?.signal?.addEventListener("abort", () => xhr.abort());
            xhr.send((init?.body ?? null) as XMLHttpRequestBodyInit | null);
        });

/**
 * Uploads one file's bytes straight to storage with its grant. Never through a function: a
 * Netlify function takes about 6 MB, a brief can be 25. The Blob's type is the type the
 * object is stored as (the multipart part carries it), so the caller builds the Blob with
 * the grant's mime.
 *
 * A storage client of its own, of the same class supabase-js builds (taken from the live
 * client, so the request cannot differ), on the same /storage/v1 base, with the same two
 * headers supabase-js adds (apikey, and the session's bearer or the public key), but
 * carried over XHR so `onProgress` hears each chunk leave: a 25 MB PDF shows how far it has
 * got rather than only that it is going.
 */
export const uploadTicketFile = async (
    grant: { bucket: string; path: string; token: string; mime: string; name: string },
    blob: Blob,
    onProgress?: (sent: number, total: number) => void,
): Promise<void> => {
    let failed = false;
    try {
        const { data } = await supabase.auth.getSession();
        const bearer = data.session?.access_token ?? SUPABASE_ANON_KEY;
        const base = new URL(SUPABASE_URL.trim().endsWith("/") ? SUPABASE_URL.trim() : `${SUPABASE_URL.trim()}/`);
        const Storage = supabase.storage.constructor as new (url: string, headers: Record<string, string>, fetch: typeof globalThis.fetch) => typeof supabase.storage;
        const storage = new Storage(new URL("storage/v1", base).href, { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${bearer}` }, xhrFetch(onProgress));
        const { error } = await storage.from(grant.bucket).uploadToSignedUrl(grant.path, grant.token, blob, { contentType: grant.mime, upsert: false });
        failed = !!error;
    } catch {
        failed = true;
    }
    if (failed) throw new HelpApiError(0, fileUploadFailed(grant.name));
};

/** A data URL's bytes and declared type, decoded by hand (a fetch of a data URL is refused by some content security policies). */
const decodeDataUrl = (dataUrl: string): { mime: string; bytes: Uint8Array<ArrayBuffer> } | null => {
    const m = /^data:([^;,]*)(?:;[^,]*)?;base64,(.*)$/s.exec(dataUrl);
    if (!m) return null;
    const bin = atob(m[2]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { mime: m[1].toLowerCase(), bytes };
};

/**
 * The bytes a picked file is uploaded as.
 *
 * An image goes through compressImageFile (the house rule for every image upload: at most
 * 1600px, WebP), and the Blob takes the encoder's type, WebP or JPEG, or the original's
 * own for a GIF. When the browser cannot draw it (a HEIC in Chrome, whose fallback reads
 * application/octet-stream) the original bytes go under the picked type's own mime, so the
 * file still arrives as what it is. A document is the original File re-wrapped with its
 * type's mime, so a CSV Windows called an Excel file is stored as text/csv.
 */
export const prepareUploadBlob = async (file: File, picked: FileType): Promise<Blob> => {
    if (picked.kind === "document") return new Blob([file], { type: picked.mime });
    const decoded = decodeDataUrl(await compressImageFile(file));
    if (!decoded) throw new HelpApiError(0, fileUploadFailed(file.name));
    const isImageMime = FILE_TYPES.some((t) => t.kind === "image" && t.mime === decoded.mime);
    return new Blob([decoded.bytes], { type: isImageMime ? decoded.mime : picked.mime });
};

/* ── The portal row ──────────────────────────────────────────────────────────
   Not a ticket, so it is not behind a function: this is the same `dashboard_pages` read the
   dashboard itself does with the public anon key, for the client's own name and the sign-in
   backdrop their AM chose. Nothing here is used to decide access - the server does that, on
   every single call - so a tampered answer changes a heading and nothing else. */

export interface HelpClientRow {
    clientName: string;
    backgroundUrl: string;
}

export const fetchClientRow = async (slug: string): Promise<HelpClientRow | null> => {
    const { data, error } = await supabase.from("dashboard_pages").select("client_name, data").eq("slug", slug).maybeSingle();
    if (error || !data) return null;
    const content = (data.data ?? {}) as { sidebar_bg_url?: string };
    return {
        clientName: String(data.client_name ?? "").trim(),
        backgroundUrl: String(content.sidebar_bg_url ?? "").trim(),
    };
};
