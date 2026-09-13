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
import { supabase } from "@/lib/supabase";
import type { Priority, Ticket, TicketCounts, TicketEvent, TicketTopic } from "@/pages/client/help/help-model";
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
 * Messages for 403 and 422 are passed through from the server verbatim, and a 403 also
 * carries a reason code the screen keys its next action on (a sentence alone cannot tell
 * "not on the list" from "may read, may not act"). Everything else gets one plain line,
 * because a raw 500 body is noise to a client and can carry internals.
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
        if ((res.status === 403 || res.status === 422 || res.status === 400) && fromServer) throw new HelpApiError(res.status, fromServer, reason);
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

/** One request and its full history. */
export const fetchTicket = (proof: CallerProof, reference: string): Promise<{ viewer: Viewer; ticket: Ticket; events: TicketEvent[] }> =>
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

/** Closes a request and marks it withdrawn. The row is never deleted. */
export const withdrawTicket = (proof: CallerProof, reference: string): Promise<{ ticket: Ticket }> =>
    callFunction("ticket-withdraw", { slug: proof.slug, reference, confirm: true });

export interface NewTicketInput {
    topic: string;
    title: string;
    detail: string;
    property?: string;
    needed_by?: string;
    images?: TicketImage[];
    /** Team only; the server drops it from anyone else. */
    priority?: Priority;
}

export const createTicket = (proof: CallerProof, input: NewTicketInput): Promise<{ ticket: Ticket }> =>
    callFunction("ticket-create", {
        slug: proof.slug,
        topic: input.topic,
        title: input.title,
        detail: input.detail,
        // Omitted rather than sent empty: a `date` column takes null, not "", and an empty
        // property string would show as a blank PROPERTY row on the detail screen.
        ...(input.property?.trim() ? { property: input.property.trim() } : {}),
        ...(input.needed_by ? { needed_by: input.needed_by } : {}),
        ...(input.images?.length ? { images: input.images } : {}),
        ...(input.priority ? { priority: input.priority } : {}),
    });

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

/* ── Attachments ─────────────────────────────────────────────────────────── */

export interface TicketImage {
    name: string;
    mime: string;
    dataBase64: string;
}

/**
 * The form's file rules, as the Field/Upload component states them: "PNG, JPG or WEBP ·
 * up to 10 MB each · up to 5 files". The server allows six and more formats; the form
 * promises five and three, so the promise on the screen is the one that is enforced.
 *
 * A Netlify synchronous function rejects a request body over 6MB outright, and the JSON
 * wrapper plus base64's 4/3 expansion means the real ceiling on raw bytes is well under
 * that. 4MB of encoded payload leaves comfortable headroom for the rest of the body, and
 * every image has already been squeezed to WebP by compressImageFile before it is counted,
 * so hitting this at all takes an unusual number of large files rather than one phone photo.
 */
export const MAX_IMAGES = 5;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_PAYLOAD_BYTES = 4_000_000;
const IMAGE_MIMES = new Set(["image/png", "image/jpeg", "image/webp"]);
const IMAGE_EXTENSIONS = /\.(png|jpe?g|webp)$/i;

/**
 * Field caps, held EQUAL to the ones ticket-create.mts enforces rather than merely below
 * them.
 *
 * Capping tighter in the browser looks like the safe direction and is not: it silently
 * stops a client's sentence at a limit the server would have accepted, with no message,
 * mid-word. Capping looser lets them write something that is then truncated after they
 * press send. Equal is the only setting where the field stops where the rule is. If the
 * server's numbers move, move these with them.
 */
export const MAX_TITLE = 140;
export const MAX_DETAIL = 5000;
export const MAX_PROPERTY = 160;

/** Split a data URL into the mime and base64 halves the contract asks for. */
const splitDataUrl = (dataUrl: string): { mime: string; dataBase64: string } | null => {
    const m = /^data:([^;,]+)(?:;[^,]*)?;base64,(.*)$/s.exec(dataUrl);
    if (!m) return null;
    return { mime: m[1], dataBase64: m[2] };
};

/** True for a file the drop zone's rules line admits: PNG, JPG or WEBP, by type or, when the browser gives none, by extension. */
export const isAllowedImage = (file: File): boolean => (file.type ? IMAGE_MIMES.has(file.type) : IMAGE_EXTENSIONS.test(file.name));

/**
 * Compresses one picked file and shapes it for ticket-create. The name sent is the
 * original file name (the thumbnail shows the same name and the ORIGINAL byte size, which
 * the caller keeps from the File itself); only the bytes are re-encoded. Throws when the
 * file cannot be read at all, so the form can say which one.
 */
export const prepareImage = async (file: File): Promise<TicketImage> => {
    const dataUrl = await compressImageFile(file);
    const parts = splitDataUrl(dataUrl);
    if (!parts) throw new Error(`${file.name} could not be read.`);
    return { name: file.name.slice(0, 120), mime: parts.mime, dataBase64: parts.dataBase64 };
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
