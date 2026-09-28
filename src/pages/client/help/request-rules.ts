/**
 * THE REQUEST RULES, one copy for the browser and the portal functions.
 *
 * What a request may carry besides its words: the name of the person submitting it, the pages
 * it is about, the one address that gets the completion email, and the files attached to it. The
 * form checks these before it
 * sends anything (so a person is told at once, beside the field), and the functions check
 * them again (the browser's copy is advice; the server's is the rule). Both import THIS
 * file, so the two can never disagree about which file or address was the one over the line.
 *
 * ── NO IMPORTS, ON PURPOSE ──────────────────────────────────────────────────
 * It is imported by the browser as `@/pages/client/help/request-rules` and by Netlify
 * functions as `../../src/pages/client/help/request-rules.ts`. The functions bundler has no
 * alias config, and `import.meta.env` does not exist there, so this module imports nothing
 * and reads no environment. The switch that turns the completion email on is PARSED here
 * and READ elsewhere: completion-email-mode.ts in the browser, ticket-columns.mts in the
 * functions.
 *
 * ── FILES ───────────────────────────────────────────────────────────────────
 * A picked file is recognised by its NAME first (fileTypeFor), because the declared type
 * is the least reliable thing about it: Windows reports a .csv as application/vnd.ms-excel
 * and Chrome on Windows gives a HEIC no type at all. A present extension that is not on the
 * list is refused whatever the declared type says, so "invoice.pdf.exe" and "x.html"
 * declared text/plain never get in. The type a file is STORED as (uploadTypeFor) is decided
 * from the bytes actually sent: an image compressed to WebP is stored as WebP, under a name
 * whose extension says so.
 *
 * House style: no em or en dashes anywhere.
 */

export type FileKind = "image" | "document";
export type FileType = { mime: string; ext: string; also?: readonly string[]; kind: FileKind; label: string };

export const FILE_TYPES: readonly FileType[] = [
    { mime: "image/png", ext: "png", kind: "image", label: "PNG" },
    { mime: "image/jpeg", ext: "jpg", also: ["jpeg"], kind: "image", label: "JPG" },
    { mime: "image/webp", ext: "webp", kind: "image", label: "WEBP" },
    { mime: "image/gif", ext: "gif", kind: "image", label: "GIF" },
    { mime: "image/heic", ext: "heic", kind: "image", label: "HEIC" },
    { mime: "image/heif", ext: "heif", kind: "image", label: "HEIF" },
    { mime: "image/avif", ext: "avif", kind: "image", label: "AVIF" },
    { mime: "application/pdf", ext: "pdf", kind: "document", label: "PDF" },
    { mime: "application/msword", ext: "doc", kind: "document", label: "DOC" },
    { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ext: "docx", kind: "document", label: "DOCX" },
    { mime: "application/vnd.ms-excel", ext: "xls", kind: "document", label: "XLS" },
    { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ext: "xlsx", kind: "document", label: "XLSX" },
    { mime: "text/csv", ext: "csv", kind: "document", label: "CSV" },
    { mime: "text/plain", ext: "txt", kind: "document", label: "TXT" },
];

export const MAX_FILES = 10;
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_URLS = 10;
export const MAX_URL_CHARS = 2048;
export const MAX_EMAIL_CHARS = 254;

/** The drop zone's rules line. Must stay ONE line at 512px and TWO at 310px (Inter 13/20). The
 *  number and its unit are joined by no-break spaces, so a narrow phone never splits "25 MB". */
export const FILE_RULES_LINE = "Images, PDF, Word, Excel, CSV or text · 25\u00a0MB each · up to 10\u00a0files";

/** The picker's accept attribute: every extension (with its dot, "also" included) and every mime above, comma-joined. */
export const FILE_ACCEPT: string = [...FILE_TYPES.flatMap((t) => [t.ext, ...(t.also ?? [])].map((e) => `.${e}`)), ...FILE_TYPES.map((t) => t.mime)].join(",");

/* ── The sentences a person reads ────────────────────────────────────────── */

/** The server answers these with 422 and the form shows the same words, so a refusal reads the same wherever it is caught. */
export const urlError = (input: string): string => `"${Array.from(stripInvisible(String(input)).trim()).slice(0, 60).join("")}" is not a web address. Use one that starts with https://.`;
export const TOO_MANY_URLS = "Up to 10 pages. Remove one.";
export const EMAIL_ERROR = "That email address does not look right. Check it.";
/** The field is required wherever it is shown (owner, 28 Sep 2026), so an empty one is refused with this. */
export const EMAIL_MISSING = "Add the email address for the completion notice.";
export const NAME_MISSING = "Add the name of the person raising this request.";
export const NAME_TOO_SHORT = "Write the name in full: at least 2 characters.";
export const NAME_TOO_LONG = "Keep the name to 120 characters or fewer.";
export const fileTypeError = (name: string): string => `${displayName(name)} is not a file the team can open. Use an image, PDF, Word, Excel, CSV or text file.`;
export const fileSizeError = (name: string): string => `${displayName(name)} is over 25 MB.`;
export const fileCountError = (name: string): string => `Up to 10 files. Remove one to add ${displayName(name)}.`;
/** The count refusal when there is no one file to name (the server, counting a whole request). */
export const TOO_MANY_FILES = "Up to 10 files on one request. Remove one.";
export const fileUploadFailed = (name: string): string => `${displayName(name)} did not upload. Add it again to retry.`;
/** The one sentence for "the file store is not there": a missing ledger table, a missing bucket. */
export const FILES_UNAVAILABLE = "Files cannot be attached right now. Send the request without them and send the files to your account manager.";
export const DAILY_FILES_REACHED = "That is more files than a day allows. Send the rest to your account manager.";

/** A name as it may appear in a sentence: invisible characters gone, at most 80 characters. */
const displayName = (name: string): string => Array.from(stripInvisible(String(name)).replace(/\s+/g, " ").trim()).slice(0, 80).join("") || "That file";

/* ── Files ───────────────────────────────────────────────────────────────── */

/** The extension as the rule reads it, or null: after the last dot, that dot not first, 1 to 10 of [a-z0-9]. */
const extensionOf = (name: string): string | null => {
    const at = name.lastIndexOf(".");
    if (at <= 0) return null;
    const ext = name.slice(at + 1).toLowerCase();
    return /^[a-z0-9]{1,10}$/.test(ext) ? ext : null;
};

const byMime = (mime: string): FileType | null => FILE_TYPES.find((t) => t.mime === mime) ?? null;

/**
 * What a PICKED file is, decided before anything else touches it (this is also how a file is
 * recognised as an image before the image rule applies). The extension is the text after the
 * last dot when that dot is not the first character and the text is 1 to 10 of [a-z0-9]
 * (lowercased).
 *  - An extension is present: it must be on FILE_TYPES (`ext` or `also`), and that type is the
 *    answer whatever the declared mime says (Windows reports .csv as application/vnd.ms-excel).
 *    A present extension NOT on the list is refused, whatever the declared mime says: "x.html"
 *    declared text/plain and "invoice.pdf.exe" declared application/pdf are both null.
 *  - No extension: the declared mime, exact, when it is on FILE_TYPES; otherwise null (a
 *    declared "" with no extension is null).
 * A HEIC picked in Chrome on Windows arrives with type "" and is an image here by its .heic.
 */
export function fileTypeFor(name: string, declaredMime: string): FileType | null {
    const ext = extensionOf(String(name ?? ""));
    if (ext) return FILE_TYPES.find((t) => t.ext === ext || (t.also ?? []).includes(ext)) ?? null;
    return byMime(String(declaredMime ?? "").trim().toLowerCase());
}

/**
 * The type a file is UPLOADED and stored as, given the picked name and the mime of the bytes
 * about to be sent. The browser and ticket-upload-url both call it, so they cannot disagree.
 *  - fileTypeFor(name, uploadMime) is null: null.
 *  - An image: the upload mime when it is an IMAGE mime on FILE_TYPES (compressImageFile's
 *    encoder output, image/webp or image/jpeg, or the original's own, e.g. image/gif);
 *    otherwise null.
 *  - A document: that type, and only when uploadMime equals its mime (the browser re-wraps
 *    the bytes with it); otherwise null.
 */
export function uploadTypeFor(name: string, uploadMime: string): FileType | null {
    const picked = fileTypeFor(name, uploadMime);
    if (!picked) return null;
    const mime = String(uploadMime ?? "").trim().toLowerCase();
    if (picked.kind === "image") {
        const sent = byMime(mime);
        return sent && sent.kind === "image" ? sent : null;
    }
    return mime === picked.mime ? picked : null;
}

/** stripInvisible's characters, written as escapes: the characters themselves are invisible in
 *  an editor, and a bidi override in source is what code review tools warn about. */
const INVISIBLE = /[\p{Cc}\u061C\u200B\u200E\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/gu;

/**
 * Removes every character that must never reach a subject, a file name or an email: \p{Cc}
 * (C0 and C1 controls, CR and LF included) and the invisible format characters U+061C,
 * U+200B, U+200E, U+200F, U+202A to U+202E (bidi embeddings and overrides), U+2060 to U+2064,
 * U+2066 to U+2069 (bidi isolates) and U+FEFF. Keeps U+200C and U+200D, which scripts and
 * emoji need. The platform has its own copy for the email, held to this list by the
 * completion email proof.
 */
export function stripInvisible(s: string): string {
    return String(s ?? "").replace(INVISIBLE, "");
}

/**
 * The stored name: the original stem made safe (stripInvisible, slashes and backslashes
 * removed, whitespace collapsed, at most 80 characters, "file" if nothing is left) plus "."
 * and the canonical extension of the STORED type (uploadTypeFor), so the name's extension
 * always matches the stored mime ("photo.png" compressed to webp is stored as "photo.webp").
 */
export function storedFileName(name: string, type: FileType): string {
    const raw = String(name ?? "");
    const ext = extensionOf(raw);
    const stem = ext ? raw.slice(0, raw.length - ext.length - 1) : raw;
    const safe = Array.from(
        stripInvisible(stem)
            .replace(/[/\\]/g, "")
            .replace(/\s+/g, " ")
            .trim(),
    )
        .slice(0, 80)
        .join("")
        .trim();
    return `${safe || "file"}.${type.ext}`;
}

/* ── Pages ───────────────────────────────────────────────────────────────── */

/**
 * One page address: trimmed; "https://" prefixed when the input does not start with a
 * scheme, decided by /^[a-z][a-z0-9+.-]*:\/\//i and never by parsing ("staysaluda.com:443/book"
 * parses with the scheme "staysaluda.com:", so a parse-based test would refuse it); must
 * parse; http: or https: only; no username or password; hostname contains a dot and does not
 * end with one; the result is URL.href, at most MAX_URL_CHARS.
 */
export function cleanUrl(raw: string): { ok: true; url: string } | { ok: false; error: string } {
    const input = String(raw ?? "").trim();
    const bad = { ok: false as const, error: urlError(input) };
    if (!input) return bad;
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(input) ? input : `https://${input}`;
    let parsed: URL;
    try {
        parsed = new URL(withScheme);
    } catch {
        return bad;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return bad;
    if (parsed.username || parsed.password) return bad;
    const host = parsed.hostname;
    if (!host.includes(".") || host.endsWith(".")) return bad;
    if (parsed.href.length > MAX_URL_CHARS) return bad;
    return { ok: true, url: parsed.href };
}

/** A list: non-strings refused; empty entries dropped; de-duplicated on href, first kept; more than MAX_URLS refused. */
export function cleanUrls(raw: unknown): { ok: true; urls: string[] } | { ok: false; error: string } {
    if (raw === undefined || raw === null) return { ok: true, urls: [] };
    if (!Array.isArray(raw)) return { ok: false, error: urlError(String(raw)) };
    // A list far past the cap is refused before any of it is parsed.
    if (raw.length > MAX_URLS * 4) return { ok: false, error: TOO_MANY_URLS };
    const urls: string[] = [];
    for (const entry of raw) {
        if (typeof entry !== "string") return { ok: false, error: urlError(String(entry)) };
        if (!entry.trim()) continue;
        const one = cleanUrl(entry);
        if (!one.ok) return one;
        if (!urls.includes(one.url)) urls.push(one.url);
    }
    if (urls.length > MAX_URLS) return { ok: false, error: TOO_MANY_URLS };
    return { ok: true, urls };
}

/* ── The completion email address ────────────────────────────────────────── */

const EMAIL_SHAPE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[a-z0-9-]{2,}$/i;

/** A control or invisible character (stripInvisible's list) anywhere in an address: never part of
 *  a real one, and a NUL would fail the insert (Postgres text refuses it) with a 500. */
const hasInvisible = (s: string): boolean => stripInvisible(s) !== s;

/** Whether a string, as given, is one address and nothing else. */
export function isEmailShape(s: string): boolean {
    const v = String(s ?? "");
    return v.length > 0 && v.length <= MAX_EMAIL_CHARS && !hasInvisible(v) && EMAIL_SHAPE.test(v);
}

/**
 * The completion email address, required wherever the field is shown: trimmed and lowercased;
 * missing or empty is EMAIL_MISSING; at most MAX_EMAIL_CHARS; no whitespace, CR or LF, and no
 * control or invisible character; the shape above. Called only while the switch is open for this
 * person (completionEmailOpen); with it closed an address is never read at all.
 */
export function cleanNotifyEmail(raw: unknown): { ok: true; email: string } | { ok: false; error: string } {
    if (raw === undefined || raw === null) return { ok: false, error: EMAIL_MISSING };
    if (typeof raw !== "string") return { ok: false, error: EMAIL_ERROR };
    const email = raw.trim().toLowerCase();
    if (!email) return { ok: false, error: EMAIL_MISSING };
    if (email.length > MAX_EMAIL_CHARS || /[\s\r\n]/.test(email) || hasInvisible(email) || !EMAIL_SHAPE.test(email)) return { ok: false, error: EMAIL_ERROR };
    return { ok: true, email };
}

/* ── Who is submitting ───────────────────────────────────────────────────── */

/**
 * The Submitted by field (owner, 28 Sep 2026): the name of the person raising the request,
 * required on both forms. The signed-in address stays the account of record (submitted_by); this
 * is the person, which matters when one login is shared by a front desk.
 */
export const MIN_NAME_CHARS = 2;
export const MAX_NAME_CHARS = 120;

/**
 * Whitespace of every kind (tabs and line breaks included) becomes one space, stripInvisible
 * removes every other control and invisible character, and the ends are trimmed; then 2 to 120
 * characters, counted by character so an accent or an emoji is one. Missing, not a string, or
 * nothing left is NAME_MISSING. Stripped rather than refused: a name pasted with a stray
 * zero-width space is still the name, and the person cannot see what to delete.
 */
export function cleanSubmitterName(raw: unknown): { ok: true; name: string } | { ok: false; error: string } {
    if (typeof raw !== "string") return { ok: false, error: NAME_MISSING };
    const name = stripInvisible(raw.replace(/\s+/g, " ")).replace(/\s+/g, " ").trim();
    if (!name) return { ok: false, error: NAME_MISSING };
    const length = Array.from(name).length;
    if (length < MIN_NAME_CHARS) return { ok: false, error: NAME_TOO_SHORT };
    if (length > MAX_NAME_CHARS) return { ok: false, error: NAME_TOO_LONG };
    return { ok: true, name };
}

/**
 * What the Submitted by field starts with: the first candidate that is a clean name and is not
 * just the mailbox of `email`, else empty. The servers fall back to the mailbox ("marcus") when
 * they hold no name, and a field prefilled with that would read as a name somebody chose.
 */
export function submitterNamePrefill(candidates: ReadonlyArray<string | null | undefined>, email: string): string {
    const mailbox = (String(email ?? "").trim().toLowerCase().split("@")[0] ?? "").trim();
    for (const candidate of candidates) {
        const checked = cleanSubmitterName(candidate);
        if (checked.ok && checked.name.toLowerCase() !== mailbox) return checked.name;
    }
    return "";
}

/* ── The completion email switch ─────────────────────────────────────────── */

/**
 * VITE_TICKET_COMPLETION_EMAIL, parsed from whichever place the caller reads it: "staff" and
 * "on" exactly (trimmed, lowercased); anything else, unset included, is "off". The owner turns it
 * on before the platform can send (28 Sep 2026: "I do not see the email field, and make it
 * required"), so every sentence about the address says where the completion notice goes and
 * never that one was sent; whether one went is the account manager's DM's to say.
 */
export type CompletionEmailMode = "off" | "staff" | "on";

export function completionEmailMode(raw: string | null | undefined): CompletionEmailMode {
    const v = String(raw ?? "").trim().toLowerCase();
    return v === "staff" || v === "on" ? v : "off";
}

/** Whether the completion email field is shown to, required of, and stored for this person: "on" for everyone, "staff" for staff only, "off" for nobody. */
export function completionEmailOpen(mode: CompletionEmailMode, isStaff: boolean): boolean {
    return mode === "on" || (mode === "staff" && isStaff);
}
