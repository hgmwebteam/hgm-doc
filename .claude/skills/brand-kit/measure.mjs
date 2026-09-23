#!/usr/bin/env node
/**
 * Render a site in headless Chromium and measure its brand: `node measure.mjs <url> [out.png]`.
 *
 * Prints the measure-in-page.js report as JSON and saves a full-viewport screenshot next to
 * it, so the colours can be checked by eye against the page they came from.
 *
 * Needs Playwright. It resolves the project's copy first, then a global one; if neither
 * exists, the skill falls back to the browser tool with the same measure-in-page.js.
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
let playwright;
for (const from of [
    process.cwd(),
    here,
    (() => {
        try {
            return execSync("npm root -g").toString().trim();
        } catch {
            return "";
        }
    })(),
]) {
    try {
        playwright = require(require.resolve("playwright", { paths: [from] }));
        break;
    } catch {
        /* try the next place */
    }
}
if (!playwright) {
    console.error("Playwright isn't installed. Use the browser tool with measure-in-page.js instead (see SKILL.md).");
    process.exit(2);
}

const url = process.argv[2];
if (!url) {
    console.error("usage: node measure.mjs <url> [screenshot.png]");
    process.exit(1);
}
const shot = process.argv[3] ?? `brand-kit-${new URL(url.startsWith("http") ? url : `https://${url}`).hostname}.png`;

const launch = { headless: true };
if (process.env.PLAYWRIGHT_CHROMIUM_PATH) launch.executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
if (process.env.HTTPS_PROXY) launch.proxy = { server: process.env.HTTPS_PROXY };
const browser = await playwright.chromium.launch(launch);
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: !!process.env.HTTPS_PROXY });
try {
    await page.goto(url.startsWith("http") ? url : `https://${url}`, { waitUntil: "load", timeout: 45_000 });
} catch (e) {
    console.error(`(load didn't finish: ${e.message.split("\n")[0]} — measuring what rendered)`);
}
// Fonts and late CSS land after "load" on most builders; an early read reports fallbacks.
await page.waitForTimeout(5000);
await page.evaluate(() => document.fonts.ready);
const report = await page.evaluate(readFileSync(join(here, "measure-in-page.js"), "utf8"));
await page.screenshot({ path: shot });
await browser.close();
console.log(JSON.stringify({ ...report, screenshot: shot }, null, 2));
