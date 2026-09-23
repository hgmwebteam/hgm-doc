/*
 * Runs INSIDE a rendered page and reports what it actually paints: every solid colour,
 * weighted by the on-screen area it covers, tagged with the role of the element painting
 * it (button, header, heading, link…), plus the fonts the <h1> and body copy are set in and
 * the header logo.
 *
 * One file, two callers: measure.mjs hands it to Playwright's page.evaluate, and without
 * Playwright the same source is pasted into the browser tool's page-script runner. Keep it
 * a single self-contained function expression with no imports.
 *
 * Every hex it returns is read from computed style via a 1x1 canvas, so oklch()/lab()/named
 * colours all come back as the sRGB hex the browser really paints — measured, not guessed.
 */
(() => {
    const cv = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    cv.canvas.width = cv.canvas.height = 1;
    const toHex = (c) => {
        if (!c || c === "transparent" || c === "none") return null;
        cv.clearRect(0, 0, 1, 1);
        cv.fillStyle = "#000";
        cv.fillStyle = c;
        cv.fillRect(0, 0, 1, 1);
        const d = cv.getImageData(0, 0, 1, 1).data;
        if (d[3] < 150) return null; // a tint or an overlay, not a brand colour
        return (
            "#" +
            [d[0], d[1], d[2]]
                .map((n) => n.toString(16).padStart(2, "0"))
                .join("")
                .toUpperCase()
        );
    };
    const chroma = (h) => {
        const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
        return Math.max(r, g, b) - Math.min(r, g, b);
    };

    const vw = innerWidth;
    const vh = innerHeight;
    const colors = new Map();
    const add = (hex, area, role, el) => {
        if (!hex || area <= 0) return;
        const c = colors.get(hex) ?? { hex, area: 0, roles: {}, example: "" };
        c.area += area;
        c.roles[role] = (c.roles[role] ?? 0) + area;
        if (!c.example && role !== "surface" && role !== "text")
            c.example = `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : ""}`;
        colors.set(hex, c);
    };

    for (const el of document.querySelectorAll("body *")) {
        const b = el.getBoundingClientRect();
        // The first three screens: what a visitor actually sees of the brand.
        if (b.width < 2 || b.height < 2 || b.bottom < 0 || b.top > vh * 3) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) < 0.1) continue;
        const tag = el.tagName.toLowerCase();
        const area = (Math.min(b.width, vw) * Math.min(b.height, vh)) / 1000;
        const clickable =
            tag === "button" ||
            el.getAttribute("role") === "button" ||
            (tag === "a" && (/btn|button|cta/i.test(String(el.className)) || (cs.backgroundColor !== "rgba(0, 0, 0, 0)" && b.height < 80 && b.width < 420)));
        const inHeader = !!el.closest("header, nav, [class*=header i], [class*=navbar i]") && b.top < 220;
        add(toHex(cs.backgroundColor), area, clickable ? "button" : inHeader ? "header" : "surface", el);
        const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        if (ownText) add(toHex(cs.color), area * 0.3, /^h[1-3]$/.test(tag) ? "heading" : tag === "a" ? "link" : clickable ? "button text" : "text", el);
        if (tag === "svg" || tag === "path") add(toHex(cs.fill), area * 0.2, inHeader ? "logo/icon" : "icon", el);
    }

    const all = [...colors.values()].sort((a, b) => b.area - a.area);
    const round = (c) => ({
        hex: c.hex,
        area: Math.round(c.area),
        roles: Object.fromEntries(Object.entries(c.roles).map(([k, v]) => [k, Math.round(v)])),
        example: c.example,
    });
    const family = (el) => (el ? getComputedStyle(el).fontFamily.split(",")[0].replace(/["']/g, "").trim() : "");
    const paras = [...document.querySelectorAll("p")].filter((p) => p.textContent.trim().length > 40).slice(0, 20);
    const bodyCount = {};
    for (const p of paras) bodyCount[family(p)] = (bodyCount[family(p)] ?? 0) + 1;

    const logoEl = document.querySelector(
        'header a[href="/"] img, header a[href="/"] svg, [class*=logo i] img, [class*=logo i] svg, img[alt*=logo i], header img, header svg',
    );
    return {
        url: location.href,
        chromatic: all
            .filter((c) => chroma(c.hex) > 0.12)
            .slice(0, 8)
            .map(round),
        neutral: all
            .filter((c) => chroma(c.hex) <= 0.12)
            .slice(0, 5)
            .map(round),
        fonts: {
            heading: family(document.querySelector("h1")) || family(document.querySelector("h2")),
            body: Object.entries(bodyCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? family(document.body),
            loaded: [...new Set([...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replace(/["']/g, "")))],
        },
        logo: logoEl ? (logoEl.tagName.toLowerCase() === "img" ? logoEl.currentSrc || logoEl.src : "inline <svg> in the header") : null,
        themeColor: document.querySelector('meta[name="theme-color"]')?.content ?? null,
    };
})();
