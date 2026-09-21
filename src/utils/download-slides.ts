/**
 * Hand a set of slides to the account manager as files they can post.
 *
 * Slides live in the dashboard row as WebP data URLs (see compressImageFile) because that
 * is the lightest thing to store and serve. Instagram's uploader, though, wants JPG or PNG,
 * so every download re-encodes through a canvas as a high-quality JPEG first — the
 * conversion runs in the browser in a few milliseconds per slide.
 *
 * A whole post downloads as ONE zip rather than a burst of files: browsers prompt or block
 * on the second automatic download, and a zip lands cleanly in a phone's Files app too.
 * The zip is written here by hand in "store" mode — JPEGs don't compress, so a library
 * would buy nothing but a dependency.
 */

const JPEG_QUALITY = 0.92;

/** Load any image URL (data: or http) and return it as a JPEG blob. */
export async function toJpegBlob(url: string): Promise<Blob> {
    const img = new Image();
    img.decoding = "async";
    // Cross-origin only matters for http(s) sources; a tainted canvas can't export.
    if (!url.startsWith("data:")) img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Couldn't load a slide."));
        img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Couldn't draw a slide.");
    // JPEG has no alpha: flatten onto white rather than onto black, which is what most
    // encoders do with transparent pixels.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    if (!blob) throw new Error("Couldn't encode a slide.");
    return blob;
}

/** Safe, readable file stem: "Follow us to win a free stay" → "follow-us-to-win-a-free-stay". */
export const fileStem = (s: string, fallback: string) =>
    s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 60) || fallback;

/** Trigger a browser download of `blob` under `filename`. */
export function saveBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Give the browser a moment to open the stream before the URL goes away.
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/* ── Zip (store only) ─────────────────────────────────────────────────────── */

const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0;
    }
    return t;
})();

const crc32 = (bytes: Uint8Array) => {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
};

/** MS-DOS date/time pair, which is all the zip format knows. */
const dosDateTime = (d: Date) => ({
    time: ((d.getHours() & 0x1f) << 11) | ((d.getMinutes() & 0x3f) << 5) | ((d.getSeconds() >> 1) & 0x1f),
    date: (((d.getFullYear() - 1980) & 0x7f) << 9) | (((d.getMonth() + 1) & 0xf) << 5) | (d.getDate() & 0x1f),
});

export interface ZipEntry {
    name: string;
    data: Uint8Array;
}

/**
 * Build a zip archive holding `entries` uncompressed. Plain PKZIP 2.0 structures: a local
 * header before each file, then the central directory, then the end record. Readable by
 * every unzip tool, Finder, and the iOS and Android Files apps.
 */
export function buildZip(entries: ZipEntry[], now = new Date()): Uint8Array {
    const enc = new TextEncoder();
    const { time, date } = dosDateTime(now);
    const locals: Uint8Array[] = [];
    const centrals: Uint8Array[] = [];
    let offset = 0;

    for (const e of entries) {
        const name = enc.encode(e.name);
        const crc = crc32(e.data);
        const local = new DataView(new ArrayBuffer(30 + name.length));
        local.setUint32(0, 0x04034b50, true); // local file header
        local.setUint16(4, 20, true); // version needed: 2.0
        local.setUint16(6, 0x0800, true); // flags: UTF-8 names
        local.setUint16(8, 0, true); // method: store
        local.setUint16(10, time, true);
        local.setUint16(12, date, true);
        local.setUint32(14, crc, true);
        local.setUint32(18, e.data.length, true);
        local.setUint32(22, e.data.length, true);
        local.setUint16(26, name.length, true);
        local.setUint16(28, 0, true);
        new Uint8Array(local.buffer).set(name, 30);

        const central = new DataView(new ArrayBuffer(46 + name.length));
        central.setUint32(0, 0x02014b50, true); // central directory header
        central.setUint16(4, 20, true); // made by
        central.setUint16(6, 20, true); // needed
        central.setUint16(8, 0x0800, true);
        central.setUint16(10, 0, true);
        central.setUint16(12, time, true);
        central.setUint16(14, date, true);
        central.setUint32(16, crc, true);
        central.setUint32(20, e.data.length, true);
        central.setUint32(24, e.data.length, true);
        central.setUint16(28, name.length, true);
        central.setUint16(30, 0, true); // extra
        central.setUint16(32, 0, true); // comment
        central.setUint16(34, 0, true); // disk
        central.setUint16(36, 0, true); // internal attrs
        central.setUint32(38, 0, true); // external attrs
        central.setUint32(42, offset, true);
        new Uint8Array(central.buffer).set(name, 46);

        locals.push(new Uint8Array(local.buffer), e.data);
        centrals.push(new Uint8Array(central.buffer));
        offset += local.byteLength + e.data.length;
    }

    const centralSize = centrals.reduce((n, c) => n + c.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); // end of central directory
    end.setUint16(4, 0, true);
    end.setUint16(6, 0, true);
    end.setUint16(8, entries.length, true);
    end.setUint16(10, entries.length, true);
    end.setUint32(12, centralSize, true);
    end.setUint32(16, offset, true);
    end.setUint16(20, 0, true);

    const parts = [...locals, ...centrals, new Uint8Array(end.buffer)];
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let at = 0;
    for (const p of parts) {
        out.set(p, at);
        at += p.length;
    }
    return out;
}

/**
 * Download every slide of a post as `{stem}-01.jpg … -NN.jpg` inside `{stem}.zip`.
 * Re-encodes to JPEG on the way, so what the AM gets is what Instagram takes.
 */
export async function downloadSlidesZip(slides: { url: string }[], stem: string) {
    const entries: ZipEntry[] = [];
    for (const [i, s] of slides.entries()) {
        const jpeg = await toJpegBlob(s.url);
        entries.push({ name: `${stem}-${String(i + 1).padStart(2, "0")}.jpg`, data: new Uint8Array(await jpeg.arrayBuffer()) });
    }
    const zip = buildZip(entries);
    saveBlob(new Blob([zip as BlobPart], { type: "application/zip" }), `${stem}.zip`);
}

/** Download one slide as `{stem}-{n}.jpg`. */
export async function downloadSlideJpeg(url: string, stem: string, n: number) {
    saveBlob(await toJpegBlob(url), `${stem}-${String(n).padStart(2, "0")}.jpg`);
}
