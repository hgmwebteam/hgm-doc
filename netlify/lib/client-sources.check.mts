/**
 * Self-check for grabResult's one retry under a second user agent. Run it:
 *   node --experimental-strip-types netlify/lib/client-sources.check.mts
 *
 * No network: fetch is swapped for a fake that refuses one user agent, the way the two real
 * sites behind this rule do. arcaroatan.com blocks the bare "Mozilla/5.0" and
 * gooseberrylodges.com blocks the self-identifying string, so both must load.
 */
import assert from "node:assert/strict";
import { grabResult } from "./client-sources.mts";

let seen: string[] = [];
/** A site that answers `status` to `blockedUa` (or to every agent, when "*") and a page to the rest. */
const site = (blockedUa: string, status = 403) => {
    seen = [];
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
        const ua = new Headers(init?.headers).get("user-agent") ?? "";
        seen.push(ua);
        return blockedUa === "*" || ua === blockedUa ? new Response("blocked", { status }) : new Response("<html>ok</html>", { status: 200 });
    }) as typeof fetch;
};

/* 1. arcaroatan.com: the bare agent is refused, the retry loads. */
site("Mozilla/5.0");
assert.equal((await grabResult("https://example.com/", 1000)).ok, true);
assert.equal(seen.length, 2, "a 403 earns exactly one retry");
assert.notEqual(seen[1], seen[0], "the retry goes out under the other agent");

/* 2. gooseberrylodges.com: the bare agent loads first time, so there is no second request. */
site(seen[1]);
assert.equal((await grabResult("https://example.com/", 1000)).ok, true);
assert.equal(seen.length, 1);

/* 3. A missing page is a wrong link, not a refusal. Asking again under another name is waste. */
site("*", 404);
assert.deepEqual(await grabResult("https://example.com/", 1000), { ok: false, reason: "refused", status: 404 });
assert.equal(seen.length, 1);

/* 4. Refused under both names: still one retry, and the caller still sees the refusal. */
site("*", 403);
assert.deepEqual(await grabResult("https://example.com/", 1000), { ok: false, reason: "refused", status: 403 });
assert.equal(seen.length, 2);

console.log("client-sources.check: all assertions passed");
