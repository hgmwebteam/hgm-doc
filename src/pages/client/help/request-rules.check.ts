/**
 * Self-check for the request rules: what a request may carry besides its words. These rules
 * decide which files reach a task and which addresses get an email, so each one is pinned
 * here with the case that made it a rule. Run it:
 *   node --experimental-strip-types src/pages/client/help/request-rules.check.ts
 *
 * Same no-framework pattern as its siblings: plain asserts, no test runner. `tsc -b` still
 * type-checks it because it lives under src/.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
    DAILY_FILES_REACHED,
    EMAIL_ERROR,
    EMAIL_MISSING,
    FILES_UNAVAILABLE,
    FILE_ACCEPT,
    FILE_RULES_LINE,
    FILE_TYPES,
    MAX_EMAIL_CHARS,
    MAX_FILES,
    MAX_FILE_BYTES,
    MAX_NAME_CHARS,
    MAX_URLS,
    MAX_URL_CHARS,
    MAX_WEBSITES,
    MAX_WEBSITE_NAME,
    MIN_NAME_CHARS,
    NAME_MISSING,
    NAME_TOO_LONG,
    NAME_TOO_SHORT,
    RELOAD_FOR_FORM,
    TOO_MANY_URLS,
    WEBSITES_CHANGED,
    WEBSITES_NONE,
    chooseWebsites,
    cleanNotifyEmail,
    cleanSubmitterName,
    cleanUrl,
    cleanUrls,
    completionEmailMode,
    completionEmailOpen,
    fileCountError,
    fileSizeError,
    fileTypeError,
    fileTypeFor,
    isEmailShape,
    offersChoice,
    storedFileName,
    storedWebsitesOf,
    stripInvisible,
    submitterNamePrefill,
    uploadTypeFor,
    urlError,
    websitesOnRow,
} from "./request-rules.ts";

const type = (name: string, mime: string) => fileTypeFor(name, mime)?.ext ?? null;
const upload = (name: string, mime: string) => uploadTypeFor(name, mime)?.ext ?? null;

/* 1. The owner's numbers. */
assert.equal(MAX_FILES, 10);
assert.equal(MAX_FILE_BYTES, 26_214_400, "25 MB, the bucket's own file_size_limit");
assert.equal(MAX_URLS, 10);
assert.equal(MAX_URL_CHARS, 2048);
assert.equal(MAX_EMAIL_CHARS, 254);
assert.equal(FILE_TYPES.length, 14, "the bucket SQL allows exactly these 14 types");
assert.equal(FILE_RULES_LINE, "Images, PDF, Word, Excel, CSV or text · 25\u00a0MB each · up to 10\u00a0files");
assert.equal(FILE_RULES_LINE.replace(/\s+/g, " "), "Images, PDF, Word, Excel, CSV or text · 25 MB each · up to 10 files", "the words the Figma frame is held to");
for (const t of FILE_TYPES) {
    assert.ok(FILE_ACCEPT.split(",").includes(`.${t.ext}`), `accept carries .${t.ext}`);
    assert.ok(FILE_ACCEPT.split(",").includes(t.mime), `accept carries ${t.mime}`);
}
assert.ok(FILE_ACCEPT.split(",").includes(".jpeg"), "the also-extension is accepted too");
for (const refused of [".svg", ".html", ".zip", ".exe", "image/svg+xml", "text/html"]) assert.ok(!FILE_ACCEPT.split(",").includes(refused), `${refused} is not offered`);

/* 2. What a picked file is: the name decides, the declared type only when there is no extension. */
assert.equal(type("photo.png", "image/png"), "png");
assert.equal(type("Photo.JPEG", "image/jpeg"), "jpg", "the also-extension, any case");
assert.equal(type("rates.csv", "application/vnd.ms-excel"), "csv", "Windows calls a CSV an Excel file");
assert.equal(type("IMG_1.HEIC", ""), "heic", "Chrome on Windows gives a HEIC no type");
assert.equal(fileTypeFor("IMG_1.HEIC", "")?.kind, "image");
assert.equal(type("notes", "text/plain"), "txt", "no extension: the declared type");
assert.equal(type("notes", ""), null, "no extension and no type: nothing to go on");
assert.equal(type("invoice.pdf.exe", "application/pdf"), null, "the last extension decides");
assert.equal(type("x.html", "text/plain"), null, "a listed type cannot launder an unlisted extension");
assert.equal(type("logo.svg", "image/svg+xml"), null);
assert.equal(type(".bashrc", "text/plain"), "txt", "a leading dot is not an extension");
assert.equal(type("brief.docx", ""), "docx");
assert.equal(type("sheet.xlsx", "application/octet-stream"), "xlsx");

/* 3. What it is stored as: the bytes actually sent decide. */
assert.equal(upload("photo.png", "image/webp"), "webp", "compressed to WebP");
assert.equal(storedFileName("photo.png", uploadTypeFor("photo.png", "image/webp")!), "photo.webp");
assert.equal(upload("photo.png", "image/png"), "png");
assert.equal(upload("anim.gif", "image/gif"), "gif", "a GIF passes through untouched");
assert.equal(upload("IMG_1.HEIC", "image/heic"), "heic", "the undecodable fallback keeps the picked type");
assert.equal(upload("IMG_1.HEIC", "application/octet-stream"), null, "an image must be sent as an image");
assert.equal(upload("photo.png", "application/pdf"), null);
assert.equal(upload("report.pdf", "application/pdf"), "pdf");
assert.equal(upload("report.pdf", "text/plain"), null, "a document's upload mime must be its own");
assert.equal(upload("rates.csv", "text/csv"), "csv");
assert.equal(upload("rates.csv", "application/vnd.ms-excel"), null, "the browser re-wraps a CSV as text/csv");
assert.equal(upload("notes", "text/plain"), "txt");
assert.equal(storedFileName("notes", uploadTypeFor("notes", "text/plain")!), "notes.txt");
assert.equal(upload("x.html", "text/plain"), null);

/* 4. Stored names: safe, short, and their extension always matches the stored type. */
const pdf = FILE_TYPES.find((t) => t.ext === "pdf")!;
assert.equal(storedFileName("../../etc/passwd.pdf", pdf), "....etcpasswd.pdf", "no slash survives");
assert.equal(storedFileName("a\\b.pdf", pdf), "ab.pdf");
assert.equal(storedFileName("  Q3   report \n final.pdf", pdf), "Q3 report final.pdf");
assert.equal(storedFileName("\u202Efdp.exe.pdf", pdf), "fdp.exe.pdf", "a right-to-left override is removed");
assert.equal(storedFileName(".pdf", pdf), ".pdf.pdf", "a leading dot is part of the stem");
assert.equal(storedFileName("\u200B.pdf", pdf), "file.pdf", "nothing left is 'file'");
assert.equal(storedFileName(`${"x".repeat(200)}.pdf`, pdf), `${"x".repeat(80)}.pdf`);
assert.equal(Array.from(storedFileName(`${"😀".repeat(100)}.pdf`, pdf)).length, 84, "cut by character, never inside one");

/* 5. Invisible characters. */
assert.equal(stripInvisible("a\u202Eb\u2066c\u200Dd"), "abc\u200Dd", "overrides and isolates go; the emoji joiner stays");
assert.equal(stripInvisible("a\r\nb\tc\u0000d\u0085e"), "abcde", "C0 and C1 controls go");
assert.equal(stripInvisible("a\u200Cb"), "a\u200Cb", "the non-joiner stays");
assert.equal(stripInvisible("\uFEFFa\u061Cb\u200Bc\u200Ed\u200Fe\u2060f\u2064g\u2069h"), "abcdefgh");

/* 6. File sentences name the file, and never carry an override. */
assert.equal(fileTypeError("x.html"), "x.html is not a file the team can open. Use an image, PDF, Word, Excel, CSV or text file.");
assert.equal(fileSizeError("big.pdf"), "big.pdf is over 25 MB.");
assert.equal(fileCountError("eleven.png"), "Up to 10 files. Remove one to add eleven.png.");
assert.ok(!fileTypeError("\u202Egnp.exe").includes("\u202E"));
assert.equal(FILES_UNAVAILABLE, "Files cannot be attached right now. Send the request without them and send the files to your account manager.");
assert.equal(DAILY_FILES_REACHED, "That is more files than a day allows. Send the rest to your account manager.");

/* 7. Pages. */
const url = (s: string) => {
    const r = cleanUrl(s);
    return r.ok ? r.url : null;
};
assert.equal(url("staysaluda.com/book"), "https://staysaluda.com/book");
assert.equal(url("staysaluda.com:443/book"), "https://staysaluda.com/book", "a port is not a scheme");
assert.equal(url("  https://staysaluda.com/book?x=1  "), "https://staysaluda.com/book?x=1");
assert.equal(url("http://staysaluda.com"), "http://staysaluda.com/");
assert.equal(url("javascript:alert(1)"), null);
assert.equal(url("mailto:x@y.com"), null, "it parses as a user name");
assert.equal(url("https://user:pw@x.com"), null);
assert.equal(url("ftp://x.com"), null);
assert.equal(url("http://localhost"), null);
assert.equal(url("https://x.com."), null, "a trailing dot is not a host");
assert.equal(url(""), null);
assert.equal(url(`https://x.com/${"a".repeat(2100)}`), null, "over 2,048 characters");
assert.deepEqual(cleanUrl("ftp://x.com"), { ok: false, error: '"ftp://x.com" is not a web address. Use one that starts with https://.' });
assert.equal(urlError("x".repeat(100)), `"${"x".repeat(60)}" is not a web address. Use one that starts with https://.`);
assert.deepEqual(cleanUrls(undefined), { ok: true, urls: [] });
assert.deepEqual(cleanUrls(["", "  "]), { ok: true, urls: [] }, "empty rows are dropped");
assert.deepEqual(cleanUrls(["staysaluda.com/book", "https://staysaluda.com/book", "staysaluda.com:443/book"]), { ok: true, urls: ["https://staysaluda.com/book"] }, "duplicates collapse, first kept");
const eleven = Array.from({ length: 11 }, (_, i) => `https://x${i}.com/`);
assert.deepEqual(cleanUrls(eleven), { ok: false, error: TOO_MANY_URLS });
assert.deepEqual(cleanUrls(eleven.slice(0, 10)), { ok: true, urls: eleven.slice(0, 10) });
assert.equal(cleanUrls([42]).ok, false, "a number is not a page");
assert.equal(cleanUrls("https://x.com").ok, false, "a list, not a string");

/* 8. The completion email address. */
assert.deepEqual(cleanNotifyEmail(" Marcus@Example.COM "), { ok: true, email: "marcus@example.com" });
assert.deepEqual(cleanNotifyEmail(""), { ok: false, error: EMAIL_MISSING }, "required wherever it is shown (owner, 28 Sep 2026)");
assert.deepEqual(cleanNotifyEmail("   "), { ok: false, error: EMAIL_MISSING });
assert.deepEqual(cleanNotifyEmail(undefined), { ok: false, error: EMAIL_MISSING }, "an old tab that never had the field");
assert.deepEqual(cleanNotifyEmail(null), { ok: false, error: EMAIL_MISSING });
assert.equal(EMAIL_ERROR, "That email address does not look right. Check it.", "no 'or leave the field empty': it cannot be left empty");
assert.deepEqual(cleanNotifyEmail("a@b"), { ok: false, error: EMAIL_ERROR });
assert.deepEqual(cleanNotifyEmail("x@hiddengem.media (HiddenGem Media)"), { ok: false, error: EMAIL_ERROR }, "the staff composer's display string");
assert.equal(cleanNotifyEmail("a@b.com\r\nBcc: x@y.com").ok, false, "no header injection");
assert.equal(cleanNotifyEmail(`${"a".repeat(250)}@b.com`).ok, false, "over 254");
assert.equal(cleanNotifyEmail(42).ok, false);
assert.equal(isEmailShape("marcus@example.com"), true);
assert.equal(isEmailShape("leshan@hiddengem.media (HiddenGem Media)"), false);
assert.equal(isEmailShape(""), false);
assert.equal(cleanNotifyEmail("a\u0000b@example.com").ok, false, "a NUL is refused here, not left to fail the insert with a 500");
assert.equal(cleanNotifyEmail("a\u202Eb@example.com").ok, false, "a bidi override is never part of an address");
assert.equal(cleanNotifyEmail("ab@exa\u200Bmple.com").ok, false, "nor a zero-width space");
assert.equal(isEmailShape("a\u0001b@example.com"), false, "the prefill uses the same test");

/* 9. Who is submitting. */
assert.equal(MIN_NAME_CHARS, 2);
assert.equal(MAX_NAME_CHARS, 120);
assert.deepEqual(cleanSubmitterName("  Marcus   Webb "), { ok: true, name: "Marcus Webb" });
assert.deepEqual(cleanSubmitterName("Marcus\tWebb\r\n"), { ok: true, name: "Marcus Webb" }, "a tab or a line break is a space, not glue");
assert.deepEqual(cleanSubmitterName("Mar\u200Bcus \u202EWebb"), { ok: true, name: "Marcus Webb" }, "invisible characters are stripped, not refused");
assert.deepEqual(cleanSubmitterName("A\u0000n"), { ok: true, name: "An" }, "a NUL never reaches the insert");
assert.deepEqual(cleanSubmitterName("Zoë"), { ok: true, name: "Zoë" });
assert.deepEqual(cleanSubmitterName(""), { ok: false, error: NAME_MISSING });
assert.deepEqual(cleanSubmitterName("  \u200B "), { ok: false, error: NAME_MISSING }, "nothing left is missing");
assert.deepEqual(cleanSubmitterName(undefined), { ok: false, error: NAME_MISSING });
assert.deepEqual(cleanSubmitterName(42), { ok: false, error: NAME_MISSING });
assert.deepEqual(cleanSubmitterName("J"), { ok: false, error: NAME_TOO_SHORT });
assert.deepEqual(cleanSubmitterName("x".repeat(120)), { ok: true, name: "x".repeat(120) });
assert.deepEqual(cleanSubmitterName("x".repeat(121)), { ok: false, error: NAME_TOO_LONG });
assert.equal(cleanSubmitterName("😀".repeat(120)).ok, true, "counted by character, not by UTF-16 unit");
assert.equal(submitterNamePrefill(["Marcus Webb"], "marcus@staysaluda.com"), "Marcus Webb");
assert.equal(submitterNamePrefill(["marcus", "Marcus Webb"], "marcus@staysaluda.com"), "Marcus Webb", "the mailbox fallback is not a name");
assert.equal(submitterNamePrefill(["Leshan"], "leshan@hiddengem.media (HiddenGem Media)"), "", "nor its capitalised form");
assert.equal(submitterNamePrefill([null, undefined, " "], "marcus@staysaluda.com"), "", "nothing known: the field starts empty");

/* 10. The switch. */
assert.equal(completionEmailMode(" ON "), "on");
assert.equal(completionEmailMode("staff"), "staff");
assert.equal(completionEmailMode("yes"), "off");
assert.equal(completionEmailMode(undefined), "off");
assert.equal(completionEmailMode(""), "off");
assert.equal(completionEmailOpen("staff", false), false);
assert.equal(completionEmailOpen("staff", true), true);
assert.equal(completionEmailOpen("on", false), true);
assert.equal(completionEmailOpen("off", true), false);

/* 11. Websites (Enjoy Unique Stays, 29 Sep 2026): the row's list, the choice, the stored value. */
assert.equal(MAX_WEBSITES, 12);
assert.equal(MAX_WEBSITE_NAME, 60);
assert.equal(WEBSITES_NONE, "Tick at least one website.");
assert.equal(WEBSITES_CHANGED, "The list of websites changed while this page was open. Copy your description, reload the page, and choose again.");
assert.equal(RELOAD_FOR_FORM, "This page was updated while it was open. Copy your description, reload the page, and send it again.", "ticket-create's words, moved here unchanged");

// The owner's six, as the hand SQL writes them, and as a person might type them (no slash).
const EUS = [
    { name: "Paradise Pointe", url: "https://stayparadisepointe.com/", tenant_slug: "paradise-pointe" },
    { name: "Ridge & Falls", url: "https://ridgeandfalls.com/", tenant_slug: "ridge-falls" },
    { name: "Treetop Escapes", url: "https://staytreetopescapes.com/", tenant_slug: "treetop-escapes" },
    { name: "Little River Landing", url: "https://staylittleriver.com/", tenant_slug: "little-river-landing" },
    { name: "Stay Saluda", url: "https://staysaluda.com/", tenant_slug: "stay-saluda" },
    { name: "Inspired Retreats", url: "https://stayinspiredretreats.com/", tenant_slug: "inspired-retreats" },
];
const bare = EUS.map((w) => ({ ...w, url: w.url.replace(/\/$/, "") }));
assert.deepEqual(websitesOnRow(EUS), { ok: true, websites: EUS }, "the six real entries pass as written");
assert.deepEqual(websitesOnRow(bare), { ok: true, websites: EUS }, "and come back as hrefs, so the row equals what a request stores");
assert.deepEqual(websitesOnRow(undefined), { ok: true, websites: [] }, "absent: no list");
assert.deepEqual(websitesOnRow(null), { ok: true, websites: [] }, "null: no list");
assert.deepEqual(websitesOnRow([]), { ok: true, websites: [] });
assert.deepEqual(websitesOnRow("Paradise Pointe"), { ok: false, problem: "data.websites is not a list" });
assert.deepEqual(websitesOnRow({ 0: EUS[0] }), { ok: false, problem: "data.websites is not a list" });
const thirteen = Array.from({ length: 13 }, (_, i) => ({ name: `Site ${i}`, url: `https://site${i}.com/`, tenant_slug: `site-${i}` }));
assert.deepEqual(websitesOnRow(thirteen), { ok: false, problem: "data.websites has 13 entries, more than 12" }, "13 entries are refused");
assert.equal(websitesOnRow(thirteen.slice(0, 12)).ok, true, "12 are fine");
const withEntry = (i: number, entry: unknown) => EUS.map((w, j) => (j === i ? entry : w));
const problemOf = (raw: unknown) => {
    const r = websitesOnRow(raw);
    return r.ok ? null : r.problem;
};
assert.equal(problemOf(withEntry(2, "Treetop Escapes")), "entry 3 is not an object", "an entry that is not an object, named by its position");
assert.equal(problemOf(withEntry(2, null)), "entry 3 is not an object");
assert.equal(problemOf(withEntry(2, [EUS[2]])), "entry 3 is not an object");
assert.equal(problemOf(withEntry(0, { ...EUS[0], name: 42 })), "entry 1 has no name");
assert.equal(problemOf(withEntry(0, { ...EUS[0], name: " \u200B\t" })), "entry 1 has no name", "empty after cleaning");
assert.equal(problemOf(withEntry(0, { ...EUS[0], name: "x".repeat(61) })), `the name of entry 1 (${"x".repeat(60)}) is longer than 60 characters`);
assert.equal(websitesOnRow(withEntry(0, { ...EUS[0], name: "😀".repeat(60) })).ok, true, "60 characters counted by character");
assert.equal(problemOf(withEntry(1, { ...EUS[1], name: "Ridge | Falls" })), "the name of entry 2 (Ridge | Falls) contains <, > or |", "a name with | is refused: it forms a link in Chat");
assert.equal(problemOf(withEntry(1, { ...EUS[1], name: "<b>Ridge</b>" })), "the name of entry 2 (<b>Ridge</b>) contains <, > or |");
assert.equal(problemOf(withEntry(1, { ...EUS[1], url: "http://ridgeandfalls.com/" })), "the url of entry 2 (Ridge & Falls) is not an https web address", "http: is refused");
assert.equal(problemOf(withEntry(1, { ...EUS[1], url: "javascript:alert(1)" })), "the url of entry 2 (Ridge & Falls) is not an https web address");
assert.equal(problemOf(withEntry(1, { ...EUS[1], url: 42 })), "the url of entry 2 (Ridge & Falls) is not an https web address");
assert.equal(problemOf(withEntry(1, { ...EUS[1], url: "https://ridgeandfalls.com/a|b" })), "the url of entry 2 (Ridge & Falls) is not an https web address", "a | survives URL.href and the platform refuses it, so the portal does too");
assert.equal(problemOf(withEntry(1, { ...EUS[1], tenant_slug: "Ridge-Falls" })), "the tenant_slug of entry 2 (Ridge & Falls) is not a platform tenant slug");
assert.equal(problemOf(withEntry(1, { ...EUS[1], tenant_slug: "ridge--falls" })), "the tenant_slug of entry 2 (Ridge & Falls) is not a platform tenant slug");
assert.equal(problemOf(withEntry(1, { ...EUS[1], tenant_slug: "a".repeat(81) })), "the tenant_slug of entry 2 (Ridge & Falls) is not a platform tenant slug");
assert.equal(problemOf(withEntry(1, { name: EUS[1].name, url: EUS[1].url })), "the tenant_slug of entry 2 (Ridge & Falls) is not a platform tenant slug", "a missing slug");
assert.equal(problemOf([...EUS.slice(0, 5), { ...EUS[5], name: "PARADISE POINTE" }]), "two entries are named PARADISE POINTE", "a duplicate name in another case is refused");
assert.equal(problemOf([...EUS.slice(0, 5), { ...EUS[5], url: "stayparadisepointe.com" }]), "two entries have the url https://stayparadisepointe.com/", "one href twice, however it was written");
assert.deepEqual(websitesOnRow([{ name: "  Paradise\u200B   Pointe ", url: " stayparadisepointe.com ", tenant_slug: "paradise-pointe" }]), { ok: true, websites: [EUS[0]] }, "cleaned: invisible characters out, spaces folded");
assert.equal(offersChoice(EUS), true);
assert.equal(offersChoice(EUS.slice(0, 2)), true, "two is a choice");
assert.equal(offersChoice(EUS.slice(0, 1)), false, "one website (FLOHOM) is not");
assert.equal(offersChoice([]), false);

// The choice: the server's rule.
const names = EUS.map((w) => w.name);
assert.deepEqual(chooseWebsites([], undefined), { ok: true, stored: null, ignored: false }, "no list, no field: nothing to do");
assert.deepEqual(chooseWebsites([], names), { ok: true, stored: null, ignored: true }, "no list, a field anyway: ignored and counted");
assert.deepEqual(chooseWebsites(EUS.slice(0, 1), ["Paradise Pointe"]), { ok: true, stored: null, ignored: true }, "one website offers no choice");
assert.deepEqual(chooseWebsites(EUS.slice(0, 1), []), { ok: true, stored: null, ignored: false }, "an empty list is not a value");
assert.deepEqual(chooseWebsites([], null), { ok: true, stored: null, ignored: false });
assert.deepEqual(chooseWebsites([], ""), { ok: true, stored: null, ignored: false });
assert.deepEqual(chooseWebsites([], "Paradise Pointe"), { ok: true, stored: null, ignored: true }, "not validated when there is no choice");
assert.deepEqual(chooseWebsites(EUS, undefined), { ok: false, kind: "missing", error: RELOAD_FOR_FORM }, "a tab from before the list existed");
const changedAnswer = { ok: false, kind: "changed", error: WEBSITES_CHANGED };
assert.deepEqual(chooseWebsites(EUS, null), changedAnswer, "not a list");
assert.deepEqual(chooseWebsites(EUS, "Paradise Pointe"), changedAnswer, "a string is not a list");
assert.deepEqual(chooseWebsites(EUS, [42]), changedAnswer, "an entry that is not a string");
assert.deepEqual(chooseWebsites(EUS, [{ name: "Paradise Pointe", url: "https://evil.example/" }]), changedAnswer, "objects: a url from the browser never reaches the task");
assert.deepEqual(chooseWebsites(EUS, Array.from({ length: 13 }, () => "Paradise Pointe")), changedAnswer, "more than twice the offer");
assert.equal(chooseWebsites(EUS, Array.from({ length: 12 }, () => "Paradise Pointe")).ok, true, "twice the offer is still read");
assert.deepEqual(chooseWebsites(EUS, ["Paradise Pointe", "Enjoy Unique Stays"]), changedAnswer, "a name that is not on the row");
assert.deepEqual(chooseWebsites(EUS, ["paradise pointe"]), changedAnswer, "names are the row's own, exactly");
assert.deepEqual(chooseWebsites(EUS, [""]), changedAnswer, "an empty name is not on the row");
assert.deepEqual(chooseWebsites(EUS, []), { ok: false, kind: "none", error: WEBSITES_NONE }, "nothing ticked");
assert.deepEqual(chooseWebsites(EUS, names), { ok: true, stored: { offered: 6, chosen: EUS }, ignored: false }, "all six");
assert.deepEqual(chooseWebsites(EUS, ["Stay Saluda", "Paradise Pointe"]), { ok: true, stored: { offered: 6, chosen: [EUS[0], EUS[4]] }, ignored: false }, "row order wins over click order");
assert.deepEqual(chooseWebsites(EUS, ["Stay Saluda", " Stay\u200B  Saluda ", "Stay Saluda"]), { ok: true, stored: { offered: 6, chosen: [EUS[4]] }, ignored: false }, "cleaned, then de-duplicated");
const tampered = chooseWebsites(EUS, ["Ridge & Falls"]);
assert.ok(tampered.ok && tampered.stored?.chosen[0] === EUS[1], "the stored entry is the row's own entry, never built from what was sent");

// The stored value, as a screen reads it.
assert.deepEqual(storedWebsitesOf({ offered: 6, chosen: EUS }), { offered: 6, chosen: EUS });
assert.deepEqual(storedWebsitesOf({ offered: 6, chosen: [EUS[0], EUS[4]] }), { offered: 6, chosen: [EUS[0], EUS[4]] });
assert.equal(storedWebsitesOf(null), null, "no choice was offered");
assert.equal(storedWebsitesOf(undefined), null, "the column is not there yet");
assert.equal(storedWebsitesOf(EUS), null, "a bare list is not the stored shape");
assert.equal(storedWebsitesOf({ offered: 1, chosen: [EUS[0]] }), null, "offered 1 is no choice");
assert.equal(storedWebsitesOf({ offered: 13, chosen: [EUS[0]] }), null);
assert.equal(storedWebsitesOf({ offered: 6.5, chosen: [EUS[0]] }), null);
assert.equal(storedWebsitesOf({ offered: "6", chosen: [EUS[0]] }), null);
assert.equal(storedWebsitesOf({ offered: 6, chosen: [] }), null, "chosen is never empty");
assert.equal(storedWebsitesOf({ offered: 2, chosen: EUS.slice(0, 3) }), null, "chosen never exceeds offered");
assert.equal(storedWebsitesOf({ offered: 6, chosen: [{ ...EUS[0], url: "http://stayparadisepointe.com/" }] }), null);
assert.equal(storedWebsitesOf({ offered: 6, chosen: [{ ...EUS[0], name: "A|B" }] }), null);
assert.equal(storedWebsitesOf({ offered: 6, chosen: [EUS[0], { ...EUS[1], name: "paradise pointe" }] }), null, "no duplicate names");
assert.equal(storedWebsitesOf({ offered: 6, chosen: [EUS[0], { ...EUS[0], name: "Other" }] }), null, "no duplicate hrefs");
assert.equal(storedWebsitesOf({ offered: 6, chosen: [{ ...EUS[0], tenant_slug: "Bad Slug" }] }), null);

/* 12. House style: no en or em dash in the rules or their sentences. */
const dashes = new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`);
assert.ok(!dashes.test(readFileSync(new URL("./request-rules.ts", import.meta.url), "utf8")), "no en or em dash in request-rules.ts");
for (const sentence of [WEBSITES_NONE, WEBSITES_CHANGED, RELOAD_FOR_FORM]) assert.ok(!dashes.test(sentence), `no en or em dash in "${sentence}"`);
assert.ok(!/[\p{Cc}\p{Cf}]/u.test(readFileSync(new URL("./request-rules.ts", import.meta.url), "utf8").replace(/[\n\t]/g, "")), "no invisible character written as itself in request-rules.ts (stripInvisible spells them as escapes)");

console.log("request-rules: all checks passed");
