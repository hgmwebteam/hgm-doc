/**
 * Self-check for the stay-page picker.
 *
 * Section 8 is drafted one page at a time from whatever this returns, so a wrong pick costs
 * a page fetch and a model call each — and, worse, puts a "focus property" in a client's
 * brand document that is really their About page. The rule is one regex against one path
 * segment; this pins down which URLs it takes and which it leaves.
 *
 * Same no-framework pattern as its siblings: a plain assert script, no test runner, no new
 * dependency. Run it:
 *   npx esbuild src/pages/client/dashboard/stay-pages.check.ts --bundle \
 *     --platform=node --format=cjs --alias:@=./src --outfile=/tmp/hgm-check/stays.cjs \
 *   && node /tmp/hgm-check/stays.cjs
 */
import assert from "node:assert";
import { stayPageLinks } from "@/pages/client/dashboard/stay-pages";

const urls = (links: { page: string; url: string }[]) => stayPageLinks(links).map((l) => l.url);
const table = (...u: string[]) => u.map((url) => ({ page: "", url }));

/* The case this was written for: Cabin Collective's sitemap, where thirteen cabins sit
   under /properties/ beside the ordinary pages of a website. */
assert.deepEqual(
    urls(
        table(
            "https://www.cabincollectivebb.com/",
            "https://www.cabincollectivebb.com/about",
            "https://www.cabincollectivebb.com/properties",
            "https://www.cabincollectivebb.com/properties/coach-house",
            "https://www.cabincollectivebb.com/properties/wild-blue",
            "https://www.cabincollectivebb.com/contact",
        ),
    ),
    ["https://www.cabincollectivebb.com/properties/coach-house", "https://www.cabincollectivebb.com/properties/wild-blue"],
);

/* The folder is read whatever it's called, and however deep the page sits. */
for (const parent of ["cabins", "stays", "cottage", "villas", "rentals", "room", "listings", "accommodation"])
    assert.deepEqual(urls(table(`https://x.com/${parent}/blue-ridge`)), [`https://x.com/${parent}/blue-ridge`], parent);
assert.deepEqual(urls(table("https://x.com/en/properties/wild-blue")), ["https://x.com/en/properties/wild-blue"]);

/* A word that merely appears in the path is not a stay — only the segment directly above
   the page counts. This is the whole reason the parent is what's tested. */
assert.deepEqual(urls(table("https://x.com/about-the-property", "https://x.com/our-cabins", "https://x.com/blog/best-cabins-in-maine")), []);

/* The folder's own index and its plumbing pages sit under it but are not stays. */
assert.deepEqual(urls(table("https://x.com/properties/all", "https://x.com/properties/booking", "https://x.com/properties/faq")), []);

/* Same page twice — trailing slash, different case — is one row. */
assert.deepEqual(urls(table("https://x.com/properties/wild-blue", "https://x.com/Properties/Wild-Blue/")), ["https://x.com/properties/wild-blue"]);

/* Rows with nothing usable in the URL column are skipped, not guessed at. */
assert.deepEqual(urls(table("", "https://", "not a url", "mailto:host@x.com", "javascript:alert(1)")), []);

/* Capped: the cap is what keeps a draft from becoming a twenty-minute run. */
const many = table(...Array.from({ length: 30 }, (_, i) => `https://x.com/cabins/cabin-${i}`));
assert.equal(stayPageLinks(many).length, 12);
assert.equal(stayPageLinks(many, 3).length, 3);
assert.deepEqual(
    stayPageLinks(many, 3).map((l) => l.url),
    ["https://x.com/cabins/cabin-0", "https://x.com/cabins/cabin-1", "https://x.com/cabins/cabin-2"],
);

/* The page name comes through for the progress readout, trimmed. */
assert.deepEqual(stayPageLinks([{ page: "  Coach House  ", url: "https://x.com/properties/coach-house" }]), [
    { page: "Coach House", url: "https://x.com/properties/coach-house" },
]);

console.log("stay-pages.check.ts — all assertions passed");
