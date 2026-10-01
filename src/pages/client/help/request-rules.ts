/**
 * THE REQUEST RULES, one copy for the browser and the portal functions.
 *
 * What a request may carry besides its words: the name of the person submitting it, the pages
 * it is about, the one address that gets the completion email, the files attached to it, and,
 * for a client with several brand websites, which of them it is for. The form checks these
 * before it sends anything (so a person is told at once, beside the field), and the functions check
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
 * The dashboard row's website list is parsed here as well (websitesOnRow), so the gate that
 * lets a caller in, the form that draws the checkboxes and ticket-create that stores the choice
 * all read the row by one rule.
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

/* ── A tab from before the form changed ──────────────────────────────────── */

/**
 * The answer to a body that lacks a field the form now always sends (the Submitted by name, the
 * completion email while it is shown, the websites while the dashboard offers them): a tab
 * opened before the change. Told to reload rather than refused as though the person had left
 * the field empty. One copy, so ticket-create and the websites rule say the same words.
 */
export const RELOAD_FOR_FORM = "This page was updated while it was open. Copy your description, reload the page, and send it again.";

/* ── Websites (Enjoy Unique Stays, 29 Sep 2026) ──────────────────────────── */

/**
 * A client with several brand websites raises one request and says which of them it is for
 * (the web ticket meeting, 28 Sep 2026: "most of the time every website, sometimes one or
 * two"). The list lives on the dashboard row as `data.websites`, ordered, set by hand for the
 * pilot: [{ name, url, tenant_slug }]. The order is the order the form, the task and the email
 * use. Each url is kept as its URL.href, so the row equals what a request stores.
 *
 * The browser sends NAMES and nothing else. ticket-create copies the chosen entries FROM THE
 * ROW (chooseWebsites), so a url a browser sends can never reach the task, and stores them in
 * tickets.websites as { offered, chosen }: `offered` is how many the row offered when the
 * request was raised, so "all" is chosen = offered, the list the person saw.
 *
 * The rule for a row is ALL OR NOTHING: one bad entry and the dashboard offers no choice at
 * all, with the reason, rather than silently dropping a brand out of "all". The platform holds
 * a copy of the entry rule (src/lib/tickets/ticket-websites.ts), held to MAX_WEBSITES and
 * MAX_WEBSITE_NAME here by its proof.
 */
export type Website = { name: string; url: string; tenant_slug: string };
export type StoredWebsites = { offered: number; chosen: Website[] };

export const MAX_WEBSITES = 12;
export const MAX_WEBSITE_NAME = 60;
const MAX_TENANT_SLUG = 80;

export const WEBSITES_NONE = "Tick at least one website.";
export const WEBSITES_CHANGED = "The list of websites changed while this page was open. Copy your description, reload the page, and choose again.";

/** A platform tenant slug: lowercase words joined by single hyphens. */
const TENANT_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** The https form of the platform's page rule (pagesOf): the href must also pass it, so a list the
 *  portal accepts is never one routing has to refuse. `|` survives URL.href and breaks a Chat link. */
const PLATFORM_URL = /^https:\/\/[^\s<>|]+$/;
/** Refused in a name because a name reaches Chat messages, where these form links. */
const NAME_REFUSED = /[<>|]/;

/** A name as the rule reads it: whitespace of every kind folded to one space, stripInvisible, trimmed. */
const cleanWebsiteName = (raw: string): string => stripInvisible(raw.replace(/\s+/g, " ")).replace(/\s+/g, " ").trim();

/** How a problem names an entry: its position, and its name when it has a readable one. */
const entryLabel = (at: number, name: string): string => (name ? `entry ${at + 1} (${Array.from(name).slice(0, MAX_WEBSITE_NAME).join("")})` : `entry ${at + 1}`);

/** One entry, cleaned, or the problem with it. `at` is its position, for the sentence. */
function websiteEntry(raw: unknown, at: number): { ok: true; website: Website } | { ok: false; problem: string } {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, problem: `entry ${at + 1} is not an object` };
    const { name, url, tenant_slug } = raw as { name?: unknown; url?: unknown; tenant_slug?: unknown };
    if (typeof name !== "string") return { ok: false, problem: `entry ${at + 1} has no name` };
    const clean = cleanWebsiteName(name);
    if (!clean) return { ok: false, problem: `entry ${at + 1} has no name` };
    const label = entryLabel(at, clean);
    if (Array.from(clean).length > MAX_WEBSITE_NAME) return { ok: false, problem: `the name of ${label} is longer than ${MAX_WEBSITE_NAME} characters` };
    if (NAME_REFUSED.test(clean)) return { ok: false, problem: `the name of ${label} contains <, > or |` };
    const checked = typeof url === "string" ? cleanUrl(url) : null;
    if (!checked || !checked.ok || !checked.url.startsWith("https:") || !PLATFORM_URL.test(checked.url)) return { ok: false, problem: `the url of ${label} is not an https web address` };
    if (typeof tenant_slug !== "string" || tenant_slug.length > MAX_TENANT_SLUG || !TENANT_SLUG.test(tenant_slug)) return { ok: false, problem: `the tenant_slug of ${label} is not a platform tenant slug` };
    return { ok: true, website: { name: clean, url: checked.url, tenant_slug } };
}

/** Every entry, cleaned, with no two named alike (case-insensitive) and no two at one href. */
function websiteList(entries: readonly unknown[]): { ok: true; websites: Website[] } | { ok: false; problem: string } {
    const websites: Website[] = [];
    for (let at = 0; at < entries.length; at++) {
        const one = websiteEntry(entries[at], at);
        if (!one.ok) return one;
        const { name, url } = one.website;
        if (websites.some((w) => w.name.toLowerCase() === name.toLowerCase())) return { ok: false, problem: `two entries are named ${name}` };
        if (websites.some((w) => w.url === url)) return { ok: false, problem: `two entries have the url ${url}` };
        websites.push(one.website);
    }
    return { ok: true, websites };
}

/**
 * The website list a dashboard row offers, from `data.websites`. Absent or null: none (every
 * dashboard but a multi-site client's). Not a list, more than MAX_WEBSITES, or ANY entry that
 * fails the rule: `{ ok: false, problem }`, and the form offers no choice. Otherwise the
 * entries cleaned, in the row's order.
 */
export function websitesOnRow(raw: unknown): { ok: true; websites: Website[] } | { ok: false; problem: string } {
    if (raw === undefined || raw === null) return { ok: true, websites: [] };
    if (!Array.isArray(raw)) return { ok: false, problem: "data.websites is not a list" };
    if (raw.length > MAX_WEBSITES) return { ok: false, problem: `data.websites has ${raw.length} entries, more than ${MAX_WEBSITES}` };
    return websiteList(raw);
}

/** Whether a list is a choice at all: one website (FLOHOM) or none is not. */
export const offersChoice = (websites: readonly Website[]): boolean => websites.length >= 2;

const isNonEmptyValue = (v: unknown): boolean => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0);

/**
 * The server's rule for the body's `websites` (the form applies the same before sending).
 *  - The row offers fewer than 2: nothing is validated or stored; `ignored` says the body
 *    carried a list anyway (an old tab, a hand-made call), for a count in the log.
 *  - The row offers 2 or more: the field is required. Absent is a tab from before it existed
 *    (RELOAD_FOR_FORM). Not a list of strings, more than twice the offer, or a name that is
 *    not on the row is WEBSITES_CHANGED (a browser that sends objects lands here too, so a url
 *    from the browser never reaches the task). Nothing left after de-duplication is
 *    WEBSITES_NONE. Otherwise the ROW's entries for the names picked, in ROW order.
 */
export function chooseWebsites(
    offered: readonly Website[],
    picked: unknown,
): { ok: true; stored: StoredWebsites | null; ignored: boolean } | { ok: false; kind: "missing" | "none" | "changed"; error: string } {
    if (!offersChoice(offered)) return { ok: true, stored: null, ignored: isNonEmptyValue(picked) };
    if (picked === undefined) return { ok: false, kind: "missing", error: RELOAD_FOR_FORM };
    const changed = { ok: false as const, kind: "changed" as const, error: WEBSITES_CHANGED };
    if (!Array.isArray(picked) || picked.length > offered.length * 2) return changed;
    const names = new Set<string>();
    for (const entry of picked) {
        if (typeof entry !== "string") return changed;
        const name = cleanWebsiteName(entry);
        if (!offered.some((w) => w.name === name)) return changed;
        names.add(name);
    }
    if (names.size === 0) return { ok: false, kind: "none", error: WEBSITES_NONE };
    return { ok: true, stored: { offered: offered.length, chosen: offered.filter((w) => names.has(w.name)) }, ignored: false };
}

/**
 * A stored tickets.websites value, as a screen may draw it, or null. Null (or absent) is a
 * request whose dashboard offered no choice; anything that is not the shape ticket-create
 * writes is null too, so a screen draws nothing rather than something wrong: an object;
 * `offered` an integer 2 to MAX_WEBSITES; `chosen` 1 to `offered` entries, each passing the
 * row's entry rule, no two alike.
 */
export function storedWebsitesOf(raw: unknown): StoredWebsites | null {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const { offered, chosen } = raw as { offered?: unknown; chosen?: unknown };
    if (typeof offered !== "number" || !Number.isInteger(offered) || offered < 2 || offered > MAX_WEBSITES) return null;
    if (!Array.isArray(chosen) || chosen.length < 1 || chosen.length > offered) return null;
    const list = websiteList(chosen);
    return list.ok ? { offered, chosen: list.websites } : null;
}
