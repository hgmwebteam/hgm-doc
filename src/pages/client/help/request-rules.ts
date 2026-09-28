/**
 * THE REQUEST RULES, one copy for the browser and the portal functions.
 *
 * What a request may carry besides its words: the pages it is about, the one address that
 * gets the completion email, and the files attached to it. The form checks these before it
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

/** The drop zone's rules line. Must stay ONE line at 512px and TWO at 310px (Inter 13/20). */
export const FILE_RULES_LINE = "Images, PDF, Word, Excel, CSV or text · 25 MB each · up to 10 files";

/** The picker's accept attribute: every extension (with its dot, "also" included) and every mime above, comma-joined. */
export const FILE_ACCEPT: string = [...FILE_TYPES.flatMap((t) => [t.ext, ...(t.also ?? [])].map((e) => `.${e}`)), ...FILE_TYPES.map((t) => t.mime)].join(",");

/* ── The sentences a person reads ────────────────────────────────────────── */

/** The server answers these with 422 and the form shows the same words, so a refusal reads the same wherever it is caught. */
export const urlError = (input: string): string => `"${Array.from(stripInvisible(String(input)).trim()).slice(0, 60).join("")}" is not a web address. Use one that starts with https://.`;
export const TOO_MANY_URLS = "Up to 10 pages. Remove one.";
export const EMAIL_ERROR = "That email address does not look right. Check it, or leave the field empty.";
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

/**
 * Removes every character that must never reach a subject, a file name or an email: \p{Cc}
 * (C0 and C1 controls, CR and LF included) and the invisible format characters U+061C,
 * U+200B, U+200E, U+200F, U+202A to U+202E (bidi embeddings and overrides), U+2060 to U+2064,
 * U+2066 to U+2069 (bidi isolates) and U+FEFF. Keeps U+200C and U+200D, which scripts and
 * emoji need. The platform has its own copy for the email, held to this list by the
 * completion email proof.
 */
export function stripInvisible(s: string): string {
    return String(s ?? "").replace(/[\p{Cc}؜​‎‏‪-‮⁠-⁤⁦-⁩﻿]/gu, "");
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

/** Whether a string, as given, is one address and nothing else. */
export function isEmailShape(s: string): boolean {
    const v = String(s ?? "");
    return v.length > 0 && v.length <= MAX_EMAIL_CHARS && EMAIL_SHAPE.test(v);
}

/** Trimmed and lowercased; empty is null; at most MAX_EMAIL_CHARS; no whitespace, CR or LF; the shape above. */
export function cleanNotifyEmail(raw: unknown): { ok: true; email: string | null } | { ok: false; error: string } {
    if (raw === undefined || raw === null) return { ok: true, email: null };
    if (typeof raw !== "string") return { ok: false, error: EMAIL_ERROR };
    const email = raw.trim().toLowerCase();
    if (!email) return { ok: true, email: null };
    if (email.length > MAX_EMAIL_CHARS || /[\s\r\n]/.test(email) || !EMAIL_SHAPE.test(email)) return { ok: false, error: EMAIL_ERROR };
    return { ok: true, email };
}

/* ── The completion email switch ─────────────────────────────────────────── */

/**
 * VITE_TICKET_COMPLETION_EMAIL, parsed from whichever place the caller reads it: "staff" and
 * "on" exactly (trimmed, lowercased); anything else, unset included, is "off". Off until
 * the platform can actually send (Resend set up), staff for the owner's own test, then on.
 */
export type CompletionEmailMode = "off" | "staff" | "on";

export function completionEmailMode(raw: string | null | undefined): CompletionEmailMode {
    const v = String(raw ?? "").trim().toLowerCase();
    return v === "staff" || v === "on" ? v : "off";
}

/** Whether the completion email field is shown to, and its value stored for, this person: "on" for everyone, "staff" for staff only, "off" for nobody. */
export function completionEmailOpen(mode: CompletionEmailMode, isStaff: boolean): boolean {
    return mode === "on" || (mode === "staff" && isStaff);
}
