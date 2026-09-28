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
    FILES_UNAVAILABLE,
    FILE_ACCEPT,
    FILE_RULES_LINE,
    FILE_TYPES,
    MAX_EMAIL_CHARS,
    MAX_FILES,
    MAX_FILE_BYTES,
    MAX_URLS,
    MAX_URL_CHARS,
    TOO_MANY_URLS,
    cleanNotifyEmail,
    cleanUrl,
    cleanUrls,
    completionEmailMode,
    completionEmailOpen,
    fileCountError,
    fileSizeError,
    fileTypeError,
    fileTypeFor,
    isEmailShape,
    storedFileName,
    stripInvisible,
    uploadTypeFor,
    urlError,
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
assert.deepEqual(cleanNotifyEmail(""), { ok: true, email: null });
assert.deepEqual(cleanNotifyEmail(undefined), { ok: true, email: null });
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

/* 9. The switch. */
assert.equal(completionEmailMode(" ON "), "on");
assert.equal(completionEmailMode("staff"), "staff");
assert.equal(completionEmailMode("yes"), "off");
assert.equal(completionEmailMode(undefined), "off");
assert.equal(completionEmailMode(""), "off");
assert.equal(completionEmailOpen("staff", false), false);
assert.equal(completionEmailOpen("staff", true), true);
assert.equal(completionEmailOpen("on", false), true);
assert.equal(completionEmailOpen("off", true), false);

/* 10. House style: no en or em dash in the rules or their sentences. */
const dashes = new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`);
assert.ok(!dashes.test(readFileSync(new URL("./request-rules.ts", import.meta.url), "utf8")), "no en or em dash in request-rules.ts");
assert.ok(!/[\p{Cc}\p{Cf}]/u.test(readFileSync(new URL("./request-rules.ts", import.meta.url), "utf8").replace(/[\n\t]/g, "")), "no invisible character written as itself in request-rules.ts (stripInvisible spells them as escapes)");

console.log("request-rules: all checks passed");
