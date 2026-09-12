import { createSign, randomUUID } from "node:crypto";
import { portalDb } from "./reporting.mts";

/**
 * Where a client's request images go.
 *
 * Lives in netlify/lib rather than netlify/functions on purpose: Netlify routes
 * every top-level file in the functions directory as its own endpoint, so a
 * helper put there would be publicly callable. Imported from a function, this is
 * just bundled.
 *
 * ── WHAT THE DESIGN ASKS FOR, AND WHAT EXISTS TODAY ─────────────────────────
 * The design says images land in Google Drive, in a folder named for the client,
 * inside the shared "client requests" folder. Nothing in this codebase can do
 * that today and no amount of code changes that: the platform's
 * google_drive_connections table is empty, and docs-hgm has no Google credential
 * of any kind in its environment (checked against the live Netlify site on
 * 11 Sep 2026: the only Google credential the team owns is
 * GOOGLE_CHAT_APP_CREDENTIALS, and it is set on the hiddengem-ai site, not this
 * one). Even once it is copied across, a service account can only write into
 * that folder after a human shares the folder with it.
 *
 * So there are two paths behind one signature, and the caller does not care
 * which ran:
 *
 *   1. A credential is present AND the shared parent folder is reachable: find
 *      or create the client's subfolder, upload, hand back its webViewLink.
 *   2. Anything else: the bytes go into the PORTAL project's Supabase Storage,
 *      private, under ticket-images/<client>/<REQ-nnnn>/, and the result says
 *      pending:true with a note naming the exact step a human must take.
 *
 * ── WHY AN IMAGE FAILURE NEVER FAILS THE TICKET ─────────────────────────────
 * A request with three photos attached is still a request. Losing the photos is
 * recoverable (the client can send them again, and the note tells the team to
 * ask); losing the ticket is not, because the client believes they have asked us
 * and nobody is holding anything. Nothing in here throws: every failure comes
 * back as a smaller `uploaded` count and a note that says what happened.
 *
 * ── WHY THE FALLBACK BUCKET IS PRIVATE AND folderUrl IS NULL ────────────────
 * The field this fills is `drive_folder_url` and it is rendered as a link. A
 * link that only the web team can open, or a signed URL that quietly dies in a
 * week on a ticket that lives forever, is a link that lies, so the pending path
 * returns null rather than something link-shaped. The bytes are still reachable:
 * signedTicketImageUrls() below mints short-lived URLs for a team surface that
 * wants to show them, and the Supabase path in the note tells a human exactly
 * where to look.
 *
 * Nothing here is ever shown to a client: the note is written for the team and
 * names our infrastructure.
 */

/* ── the shared Drive folder from the design document ────────────────────── */

/** "Client requests", the folder every client subfolder is created inside. */
const DRIVE_PARENT_FOLDER_ID = "1jFJgQKm8-g7HAENC1kOtXkvaJyB-8oGm";
const DRIVE_PARENT_URL = `https://drive.google.com/drive/folders/${DRIVE_PARENT_FOLDER_ID}`;

const DRIVE_FOLDER_MIME = "application/vnd.google-apps.folder";
const DRIVE_FILES = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

/**
 * Full drive scope, not drive.file.
 *
 * drive.file only ever sees files this app created. The client's subfolder may
 * already exist because a previous request made it, or because an account
 * manager made it by hand, and with drive.file that folder is invisible: every
 * request would create a second folder with the same name beside it. Drive
 * allows duplicate names, so nothing would error, it would just quietly
 * scatter one client's images across N folders.
 */
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

/** Preferred name first. GOOGLE_CHAT_APP_CREDENTIALS is the fallback because it is
 *  the one service account the team already owns, and reusing it costs only a
 *  scope grant and a folder share. */
const CRED_ENVS = ["GOOGLE_DRIVE_SERVICE_ACCOUNT", "GOOGLE_CHAT_APP_CREDENTIALS"] as const;

/* ── the fallback store ──────────────────────────────────────────────────── */

const BUCKET = "ticket-images";

/** Matches the bucket's own file_size_limit below, so the two can never disagree. */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;
const MAX_IMAGES = 12;

/**
 * What the bucket accepts, and what this module accepts. One list, used for both.
 * HEIC/HEIF are on it because that is what an iPhone hands over by default and a
 * client photographing a property is on a phone.
 */
const ALLOWED_MIME: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/avif": "avif",
    "image/heic": "heic",
    "image/heif": "heif",
};

/* ── the contract ────────────────────────────────────────────────────────── */

export interface TicketImage {
    name: string;
    mime: string;
    dataBase64: string;
}

/**
 * One stored file and exactly where it is.
 *
 * Written to `ticket_attachments` by ticket-create, one row each, and read by
 * the brain when it creates the Asana task: a Drive file goes on the task as a
 * link, a portal-bucket file is downloaded and uploaded. Before this the
 * ticket carried only a count, and the task said "Attachments: 1 image" over
 * nothing.
 */
export type StoredFile =
    | { store: "portal"; bucket: string; path: string; fileName: string; mime: string; bytes: number }
    | { store: "drive"; driveFileId: string; driveUrl: string; fileName: string; mime: string; bytes: number };

export interface TicketImageResult {
    /** The Drive folder, or null when the images are waiting in Storage. */
    folderUrl: string | null;
    /** How many images were persisted somewhere. Never a guess. Always files.length. */
    uploaded: number;
    /** Each persisted image, where it is. */
    files: StoredFile[];
    /** True when any image is somewhere other than Drive and a human step is owed. */
    pending: boolean;
    /** For the team, not the client. Empty when there is nothing to say. */
    note: string;
}

/* ── small helpers ───────────────────────────────────────────────────────── */

/** Lowercase, hyphenated, capped. Used for the Storage prefix, never for the Drive
 *  folder name: a person opening Drive should see "Paradise Pointe", not a slug. */
const slugify = (s: string, max = 60): string =>
    s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, max) || "unknown-client";

/** A reference is "REQ-nnnn" by the time it gets here, but it is still an input. */
const safeReference = (s: string): string => s.replace(/[^A-Za-z0-9-]/g, "").slice(0, 40) || "no-reference";

/**
 * A filename safe as a Storage key and readable in a Drive listing.
 *
 * Storage keys are URL path segments, and a name a client typed can contain a
 * slash, a control character or 300 characters of emoji. The extension is
 * rebuilt from the declared mime rather than trusted from the name, so a file
 * called invoice.pdf.jpg cannot claim to be something it is not.
 */
const safeFileName = (name: string, mime: string): string => {
    const ext = ALLOWED_MIME[mime];
    const stem =
        String(name ?? "")
            .replace(/\.[^.]*$/, "")
            .replace(/[^A-Za-z0-9 _-]+/g, "-")
            .replace(/\s+/g, " ")
            .replace(/^[-\s]+|[-\s]+$/g, "")
            .slice(0, 60) || "image";
    return `${stem}.${ext}`;
};

/**
 * base64 to bytes, or null.
 *
 * Accepts a bare base64 string or a data: URL, because browsers produce both and
 * FileReader.readAsDataURL is the obvious thing for a front end to reach for.
 * Buffer.from is deliberately lenient about junk, so the shape is checked first:
 * a truncated upload should be reported as a rejected image, not written as a
 * corrupt file nobody notices until the designer opens it.
 */
const decodeImage = (dataBase64: string): Buffer | null => {
    const raw = String(dataBase64 ?? "")
        .replace(/^data:[^;,]*;base64,/, "")
        .replace(/\s+/g, "");
    if (!raw || raw.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(raw)) return null;
    try {
        const bytes = Buffer.from(raw, "base64");
        return bytes.length > 0 ? bytes : null;
    } catch {
        return null;
    }
};

/** Keeps a note short enough to sit in a column and in an Asana comment. */
const trimNote = (s: string): string => s.replace(/\s+/g, " ").trim().slice(0, 500);

interface PreparedImage {
    fileName: string;
    mime: string;
    bytes: Buffer;
}

/* ── the Google credential ───────────────────────────────────────────────── */

interface ServiceAccount {
    client_email: string;
    private_key: string;
}

/**
 * Service-account JSON from the environment. Accepts raw JSON or base64, since a
 * multi-line private key pasted into a dashboard is easy to mangle either way.
 * Returns null when unset or unparseable, never throws, and never logs content.
 *
 * Deliberately the same shape as the platform's src/lib/ops-agent/chat-dm.ts, so
 * the same GOOGLE_CHAT_APP_CREDENTIALS value can be copied to this site and work
 * without being reformatted.
 */
const credentials = (): ServiceAccount | null => {
    for (const key of CRED_ENVS) {
        const raw = process.env[key];
        if (!raw || !raw.trim()) continue;
        const text = raw.trim().startsWith("{")
            ? raw
            : (() => {
                  try {
                      return Buffer.from(raw, "base64").toString("utf8");
                  } catch {
                      return "";
                  }
              })();
        try {
            const j = JSON.parse(text) as Partial<ServiceAccount>;
            if (!j.client_email || !j.private_key) continue;
            // A key pasted through a form often arrives with literal \n sequences.
            return { client_email: j.client_email, private_key: j.private_key.replace(/\\n/g, "\n") };
        } catch {
            continue;
        }
    }
    return null;
};

/**
 * Which Google address the shared Drive folder has to be shared with.
 *
 * Exported because "share the folder with the service account" is useless advice
 * without the address, and the address is inside a credential nobody should be
 * opening by hand. Null means there is no credential to read one from yet.
 *
 * Async to match the callers that will one day read this from a stored
 * connection rather than the environment; there is nothing to await today.
 */
export const serviceAccountEmail = async (): Promise<string | null> => credentials()?.client_email ?? null;

/** Cached per credential, so rotating the key cannot serve a token minted for the old one. */
let tokenCache: { email: string; token: string; expiresAt: number } | null = null;

/**
 * An access token for the service account, minted directly rather than through
 * googleapis: that package is not a dependency of this repo and pulling it in
 * for one signed assertion would add several megabytes to every function bundle
 * in the site, including the ones that have nothing to do with Drive.
 */
const accessToken = async (cred: ServiceAccount): Promise<string | null> => {
    const now = Math.floor(Date.now() / 1000);
    if (tokenCache && tokenCache.email === cred.client_email && tokenCache.expiresAt > now + 60) return tokenCache.token;

    const b64 = (b: Buffer) => b.toString("base64url");
    const header = b64(Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })));
    const claim = b64(
        Buffer.from(
            JSON.stringify({
                iss: cred.client_email,
                scope: DRIVE_SCOPE,
                aud: TOKEN_URL,
                iat: now,
                exp: now + 3600,
            }),
        ),
    );

    try {
        const signingInput = `${header}.${claim}`;
        const signature = b64(createSign("RSA-SHA256").update(signingInput).sign(cred.private_key));
        const res = await fetch(TOKEN_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
                assertion: `${signingInput}.${signature}`,
            }),
            signal: AbortSignal.timeout(10_000),
        });
        const body = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number };
        if (!res.ok || !body.access_token) return null;
        tokenCache = {
            email: cred.client_email,
            token: body.access_token,
            expiresAt: now + (body.expires_in ?? 3600),
        };
        return body.access_token;
    } catch {
        // A malformed private key throws inside createSign. That is a
        // configuration fault, and the fallback path handles it like any other
        // reason Drive is unavailable.
        return null;
    }
};

/* ── Drive ───────────────────────────────────────────────────────────────── */

const driveFetch = async (token: string, url: string, init?: RequestInit): Promise<{ status: number; json: Record<string, unknown> }> => {
    const res = await fetch(url, {
        ...init,
        headers: { Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
        signal: AbortSignal.timeout(20_000),
    });
    const text = await res.text();
    let json: Record<string, unknown> = {};
    try {
        json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
        json = {};
    }
    return { status: res.status, json };
};

/** Single quotes terminate a Drive query string, so a client called O'Neill's
 *  Retreat would otherwise produce a 400 rather than a folder. */
const escapeQuery = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

type DriveTarget =
    | { ok: true; token: string; folderId: string; folderUrl: string }
    | { ok: false; reason: "no_credential" | "credential_rejected" | "parent_unreachable" | "drive_error" };

/**
 * The client's folder inside the shared parent, created if it is not there.
 *
 * supportsAllDrives / includeItemsFromAllDrives are on every call because the
 * shared folder may well be in a shared drive, and without them Drive answers
 * 404 for a folder that plainly exists, which reads exactly like "not shared
 * with us" and would send the team chasing the wrong problem.
 */
const driveTarget = async (clientName: string): Promise<DriveTarget> => {
    const cred = credentials();
    if (!cred) return { ok: false, reason: "no_credential" };

    // A credential that exists and a credential that works are different facts,
    // and they need different advice: one says "set the variable", the other
    // says "the key you set is wrong". Collapsing them sends whoever reads the
    // note to check a variable that is already there.
    const token = await accessToken(cred);
    if (!token) return { ok: false, reason: "credential_rejected" };

    try {
        // Prove the parent is reachable before creating anything. Rule 1 of the
        // design is that nothing orphaned gets created; a subfolder made under a
        // parent we cannot see is the same class of mistake.
        const parent = await driveFetch(token, `${DRIVE_FILES}/${DRIVE_PARENT_FOLDER_ID}?fields=id&supportsAllDrives=true`);
        if (parent.status === 401 || parent.status === 403 || parent.status === 404) return { ok: false, reason: "parent_unreachable" };
        if (parent.status >= 400) return { ok: false, reason: "drive_error" };

        const name = clientName.trim().slice(0, 120) || "Unknown client";
        const q = [`'${DRIVE_PARENT_FOLDER_ID}' in parents`, `name = '${escapeQuery(name)}'`, `mimeType = '${DRIVE_FOLDER_MIME}'`, "trashed = false"].join(
            " and ",
        );
        const found = await driveFetch(
            token,
            `${DRIVE_FILES}?q=${encodeURIComponent(q)}&fields=${encodeURIComponent("files(id,webViewLink)")}&pageSize=1&supportsAllDrives=true&includeItemsFromAllDrives=true`,
        );
        if (found.status >= 400) return { ok: false, reason: "drive_error" };

        const existing = (found.json.files as { id?: string; webViewLink?: string }[] | undefined)?.[0];
        if (existing?.id) {
            return { ok: true, token, folderId: existing.id, folderUrl: existing.webViewLink ?? `https://drive.google.com/drive/folders/${existing.id}` };
        }

        const made = await driveFetch(token, `${DRIVE_FILES}?fields=${encodeURIComponent("id,webViewLink")}&supportsAllDrives=true`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, mimeType: DRIVE_FOLDER_MIME, parents: [DRIVE_PARENT_FOLDER_ID] }),
        });
        const id = made.json.id as string | undefined;
        if (made.status >= 400 || !id) return { ok: false, reason: made.status === 403 ? "parent_unreachable" : "drive_error" };
        return { ok: true, token, folderId: id, folderUrl: (made.json.webViewLink as string | undefined) ?? `https://drive.google.com/drive/folders/${id}` };
    } catch {
        return { ok: false, reason: "drive_error" };
    }
};

/**
 * One image into the client's folder.
 *
 * The filename carries the reference because the folder is per CLIENT, not per
 * request: without it, the fourth request's "kitchen.jpg" sits beside the first
 * request's "kitchen.jpg" with nothing to say which is which.
 */
const driveUpload = async (token: string, folderId: string, reference: string, index: number, image: PreparedImage): Promise<StoredFile | null> => {
    const boundary = `hgm-${randomUUID()}`;
    const name = `${reference}-${String(index + 1).padStart(2, "0")}-${image.fileName}`;
    const metadata = { name, parents: [folderId] };
    const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`, "utf8"),
        Buffer.from(`--${boundary}\r\nContent-Type: ${image.mime}\r\n\r\n`, "utf8"),
        image.bytes,
        Buffer.from(`\r\n--${boundary}--\r\n`, "utf8"),
    ]);

    try {
        const res = await driveFetch(token, `${DRIVE_UPLOAD}?uploadType=multipart&fields=${encodeURIComponent("id,webViewLink")}&supportsAllDrives=true`, {
            method: "POST",
            headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
            body: new Uint8Array(body),
        });
        if (res.status >= 400 || typeof res.json.id !== "string") return null;
        const id = res.json.id;
        return {
            store: "drive",
            driveFileId: id,
            driveUrl: typeof res.json.webViewLink === "string" ? res.json.webViewLink : `https://drive.google.com/file/d/${id}/view`,
            fileName: name,
            mime: image.mime,
            bytes: image.bytes.length,
        };
    } catch {
        return null;
    }
};

/* ── the fallback store ──────────────────────────────────────────────────── */

/** Checked once per warm container: the bucket is created on the first ticket
 *  that carries an image and never needs checking again after that. */
let bucketReady = false;

const ensureBucket = async (): Promise<boolean> => {
    if (bucketReady) return true;
    try {
        const storage = portalDb().storage;
        const got = await storage.getBucket(BUCKET);
        if (got.data) {
            bucketReady = true;
            return true;
        }
        const made = await storage.createBucket(BUCKET, {
            // PRIVATE. A client's request images can be anything from a room photo
            // to a screenshot of their own booking system with a guest's name in
            // it, and a public bucket is world-readable to anyone who guesses or
            // is forwarded the URL.
            public: false,
            fileSizeLimit: MAX_IMAGE_BYTES,
            allowedMimeTypes: Object.keys(ALLOWED_MIME),
        });
        // Two functions can race here on a cold start and one of them loses.
        // Losing means the bucket exists, which is the thing we wanted.
        if (made.error && !/exist/i.test(made.error.message)) return false;
        bucketReady = true;
        return true;
    } catch {
        return false;
    }
};

/** Where one client's images for one request live. Shared by the writer and the reader
 *  so a change to the layout cannot leave them looking in different places. */
const storagePrefix = (clientName: string, reference: string) => `${slugify(clientName)}/${safeReference(reference)}`;

const storeInPortal = async (clientName: string, reference: string, images: { index: number; image: PreparedImage }[]): Promise<StoredFile[]> => {
    if (images.length === 0) return [];
    if (!(await ensureBucket())) return [];

    const prefix = storagePrefix(clientName, reference);
    const stored: StoredFile[] = [];
    for (const { index, image } of images) {
        const path = `${prefix}/${String(index + 1).padStart(2, "0")}-${image.fileName}`;
        try {
            const { error } = await portalDb().storage.from(BUCKET).upload(path, image.bytes, {
                contentType: image.mime,
                // A retried ticket-create should overwrite its own bytes rather
                // than fail on a key that is already there.
                upsert: true,
            });
            if (!error) stored.push({ store: "portal", bucket: BUCKET, path, fileName: image.fileName, mime: image.mime, bytes: image.bytes.length });
        } catch {
            // Not in the list. The note says so.
        }
    }
    return stored;
};

/**
 * Short-lived URLs for the images held in the fallback store.
 *
 * The bucket is private, so without this the pending path would be a hole the
 * bytes go into. Intended for a TEAM surface only: an account manager looking at
 * a ticket that says its images are still waiting on Drive. Returns [] rather
 * than throwing, for the same reason as everything else here.
 */
export const signedTicketImageUrls = async (clientName: string, reference: string, expiresInSeconds = 3600): Promise<{ name: string; url: string }[]> => {
    try {
        const prefix = storagePrefix(clientName, reference);
        const listed = await portalDb().storage.from(BUCKET).list(prefix, { limit: MAX_IMAGES });
        const names = (listed.data ?? []).map((f) => f.name).filter(Boolean);
        if (names.length === 0) return [];
        const signed = await portalDb()
            .storage.from(BUCKET)
            .createSignedUrls(
                names.map((n) => `${prefix}/${n}`),
                Math.min(Math.max(expiresInSeconds, 60), 60 * 60 * 24),
            );
        return (signed.data ?? [])
            .filter((s) => s.signedUrl && s.path)
            .map((s) => ({ name: String(s.path).split("/").pop() ?? "image", url: s.signedUrl as string }));
    } catch {
        return [];
    }
};

/* ── the one entry point ─────────────────────────────────────────────────── */

/**
 * Persist a ticket's images and say honestly where they ended up.
 *
 * Never throws. A caller that gets `uploaded: 0` should still create the ticket
 * and should put `note` in front of the team, not the client.
 */
export const uploadTicketImages = async (opts: {
    clientName: string;
    reference: string;
    images: TicketImage[];
    /** Absolute epoch ms this must be finished by. The CALLER owns this clock,
     *  because by the time execution reaches here the request has already spent
     *  time on the auth round trip, the duplicate check and the insert, and a
     *  budget started at this line would be a budget that does not know how late
     *  it already is. Omitted, it falls back to a fixed window from now, which
     *  is the old behaviour and is only correct for a caller that has done
     *  nothing else. */
    deadline?: number;
}): Promise<TicketImageResult> => {
    const { clientName, reference } = opts;
    const incoming = Array.isArray(opts.images) ? opts.images : [];
    if (incoming.length === 0) return { folderUrl: null, uploaded: 0, files: [], pending: false, note: "" };

    /* What arrived, and what was not usable. Rejections are counted rather than
       thrown so one bad file cannot cost a client the other four. */
    const prepared: PreparedImage[] = [];
    const rejected: string[] = [];
    let total = 0;

    for (const raw of incoming.slice(0, MAX_IMAGES)) {
        const mime = String(raw?.mime ?? "")
            .toLowerCase()
            .split(";")[0]
            .trim();
        if (!ALLOWED_MIME[mime]) {
            rejected.push("unsupported file type");
            continue;
        }
        const bytes = decodeImage(raw?.dataBase64 ?? "");
        if (!bytes) {
            rejected.push("unreadable image data");
            continue;
        }
        if (bytes.length > MAX_IMAGE_BYTES) {
            rejected.push("over 10 MB");
            continue;
        }
        if (total + bytes.length > MAX_TOTAL_BYTES) {
            rejected.push("over the 20 MB total");
            continue;
        }
        total += bytes.length;
        prepared.push({ fileName: safeFileName(raw?.name ?? "", mime), mime, bytes });
    }
    if (incoming.length > MAX_IMAGES) rejected.push(`only the first ${MAX_IMAGES} were kept`);

    const rejectedNote = rejected.length ? ` ${rejected.length} image(s) were not stored: ${[...new Set(rejected)].join(", ")}.` : "";
    if (prepared.length === 0) {
        return { folderUrl: null, uploaded: 0, files: [], pending: false, note: trimNote(`No images could be stored.${rejectedNote}`) };
    }

    const target = await driveTarget(clientName);

    /* Path 2: no Drive. Everything goes to Storage and the note names the step. */
    if (!target.ok) {
        const files = await storeInPortal(
            clientName,
            reference,
            prepared.map((image, index) => ({ index, image })),
        );
        const stored = files.length;
        const where = `${BUCKET}/${storagePrefix(clientName, reference)}/ on the portal Supabase project`;
        const sa = await serviceAccountEmail();

        const why =
            target.reason === "parent_unreachable"
                ? `Google Drive is connected but the shared folder is not shared with us. Share ${DRIVE_PARENT_URL} with ${sa ?? "the service account"} as Editor.`
                : target.reason === "no_credential"
                  ? `Google Drive is not connected to the portal. Set GOOGLE_DRIVE_SERVICE_ACCOUNT on the docs-hgm site and share ${DRIVE_PARENT_URL} with that service account as Editor.`
                  : target.reason === "credential_rejected"
                    ? `Google refused the credential on this site${sa ? ` (${sa})` : ""}. Check the service account key and that the Drive API is enabled for its project.`
                    : "Google Drive did not answer, so the images were not filed there.";

        if (stored === 0) {
            return {
                folderUrl: null,
                uploaded: 0,
                files: [],
                pending: true,
                note: trimNote(
                    `${why} The ${prepared.length} image(s) could NOT be held in Supabase Storage either, so ask the client to resend them.${rejectedNote}`,
                ),
            };
        }
        return {
            folderUrl: null,
            uploaded: stored,
            files,
            pending: true,
            note: trimNote(`${why} The ${stored} image(s) are held privately at ${where} and nothing is lost.${rejectedNote}`),
        };
    }

    /* Path 1: Drive. Anything Drive refuses individually still gets caught by the
       fallback store rather than being dropped, and the note says how many. */
    const files: StoredFile[] = [];
    const leftovers: { index: number; image: PreparedImage }[] = [];
    // Netlify gives a synchronous function 26 seconds, ALL IN - the auth check,
    // the duplicate scan, the insert and the Drive handshake above all come out
    // of the same 26. That is why this takes the caller's deadline: measured
    // from here, an 18s window could not be met, because driveTarget() alone
    // exchanges a JWT for a token and resolves a folder before the first byte is
    // uploaded. Overrunning does not just lose the images, it kills the process
    // holding the response, so the client is told nothing was saved when in fact
    // the ticket exists.
    const deadline = opts.deadline ?? Date.now() + 18_000;

    for (let i = 0; i < prepared.length; i += 1) {
        if (Date.now() > deadline) {
            leftovers.push({ index: i, image: prepared[i] });
            continue;
        }
        const onDrive = await driveUpload(target.token, target.folderId, safeReference(reference), i, prepared[i]);
        if (onDrive) files.push(onDrive);
        else leftovers.push({ index: i, image: prepared[i] });
    }

    const held = leftovers.length ? await storeInPortal(clientName, reference, leftovers) : [];
    const heldBack = held.length;
    const lost = leftovers.length - heldBack;

    const parts: string[] = [];
    if (heldBack > 0) parts.push(`${heldBack} image(s) did not reach Drive and are held privately at ${BUCKET}/${storagePrefix(clientName, reference)}/.`);
    if (lost > 0) parts.push(`${lost} image(s) could not be stored at all, so ask the client to resend them.`);
    if (rejectedNote) parts.push(rejectedNote.trim());

    return {
        folderUrl: target.folderUrl,
        uploaded: files.length + heldBack,
        files: [...files, ...held],
        // Drive is the destination; anything sitting anywhere else is a job
        // somebody still owes, which is exactly what pending means.
        pending: heldBack > 0 || lost > 0,
        note: trimNote(parts.join(" ")),
    };
};
