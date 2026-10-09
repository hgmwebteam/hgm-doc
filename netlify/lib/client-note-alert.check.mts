/**
 * Self-check for the client-note alert's wording. Run it:
 *   node --experimental-strip-types netlify/lib/client-note-alert.check.mts
 *
 * Two jobs. It pins the subject, the email and the Chat message, so a wording change is a
 * deliberate edit here and not a surprise in an AM's inbox. And by importing the builder it
 * loads suggestions-model.ts the way the function does — so a `@/` import added to that
 * file one day fails here, on a laptop, before it fails every client's send in production.
 */
import assert from "node:assert/strict";
import { sectionForKey } from "../../src/pages/client/dashboard/suggestions-model.ts";
import { CHAT_CLIP, CHAT_ITEMS, CHAT_MAX, EMAIL_CLIP, buildClientNoteMessages } from "./client-note-alert.mts";

const SLUG = "alpine-lodge-dashboard";
const BY = "host@alpinelodge.com";
const ctx = { clientName: "Alpine Lodge", amFirstName: "Alicia" };

/* 1. Every key family lands in its section; anything unprefixed is a document edit. */
const sec = (key: string) => sectionForKey(key);
assert.deepEqual(sec("welcomeFlow.2"), { anchor: "flow", label: "Welcome email comment" });
assert.deepEqual(sec("welcomeFlow.all"), { anchor: "flow", label: "Welcome email comment" }, "the legacy whole-flow note is still a flow note");
assert.deepEqual(sec("landingPage.all"), { anchor: "landing", label: "Landing page comment" });
assert.deepEqual(sec("landingPage.review"), { anchor: "landing", label: "Landing page comment" }, "the synthetic Request-changes key");
assert.deepEqual(sec("exampleReels.all"), { anchor: "reels", label: "Example reels comment" });
assert.deepEqual(sec("pinnedStories.all"), { anchor: "pinnedstories", label: "Pinned stories comment" });
assert.deepEqual(sec("pinnedStories.review"), { anchor: "pinnedstories", label: "Pinned stories comment" }, "the synthetic per-slide key");
assert.deepEqual(sec("pinnedposts.abc123.feedback"), { anchor: "pinnedposts", label: "Pinned post note" }, "Home used to file these under #foundation");
for (const k of ["hosts", "taglines.0", "personas.x9.age", ""]) assert.deepEqual(sec(k), { anchor: "foundation", label: "Brand doc edit" }, k);

/* 2. One document edit: section · field in the heading, the section's link, the note itself. */
const one = buildClientNoteMessages({ slug: SLUG, by: BY, items: [{ key: "brandVoice", label: "Brand voice", text: "Warmer, less corporate." }] }, ctx);
assert.equal(one.subject, "Alpine Lodge · Brand doc edit");
assert.match(one.text, /^Hi Alicia,\n/);
assert.ok(one.text.includes("Alpine Lodge (host@alpinelodge.com) left a note on their dashboard."));
assert.ok(one.text.includes("\nBrand doc edit · Brand voice\nWarmer, less corporate.\nhttps://hgmportal.com/alpine-lodge-dashboard#foundation\n"));
assert.ok(one.text.endsWith("Everything waiting for the team: https://hgmportal.com/home"));
assert.ok(one.html.includes("<strong>Brand doc edit · Brand voice</strong>"));
assert.ok(one.html.includes('<a href="https://hgmportal.com/alpine-lodge-dashboard#foundation">'));
assert.equal(
    one.chat,
    [
        "*Alpine Lodge* · Brand doc edit · by host@alpinelodge.com",
        "*Brand doc edit · Brand voice* · <https://hgmportal.com/alpine-lodge-dashboard#foundation|Open>",
        "```",
        "Warmer, less corporate.",
        "```",
    ].join("\n"),
);

/* 3. Twelve edits in one send: one alert, every item in the email, eight in Chat then "and 4 more". */
const twelve = buildClientNoteMessages(
    { slug: SLUG, by: BY, items: Array.from({ length: 12 }, (_, i) => ({ key: `taglines.${i}`, label: `Tagline ${i + 1}`, text: `Option ${i + 1}` })) },
    ctx,
);
assert.equal(twelve.subject, "Alpine Lodge · 12 Brand doc edits");
assert.ok(twelve.text.includes("left 12 notes on their dashboard."));
for (let i = 1; i <= 12; i++) assert.ok(twelve.text.includes(`Brand doc edit · Tagline ${i}\n`), `email lists tagline ${i}`);
assert.equal((twelve.chat.match(/\|Open>/g) ?? []).length, CHAT_ITEMS);
assert.ok(twelve.chat.endsWith("_and 4 more · <https://hgmportal.com/home|Home>_"));

/* 4. Mixed sections: a neutral subject, and each item keeps its own link. */
const mixed = buildClientNoteMessages(
    {
        slug: SLUG,
        by: BY,
        items: [
            { key: "welcomeFlow.2", label: "Welcome email 3 · feedback", text: "Too long." },
            { key: "landingPage.all", label: "", text: "Love the hero." },
            { key: "exampleReels.all", label: "", text: "More daytime shots." },
        ],
    },
    ctx,
);
assert.equal(mixed.subject, "Alpine Lodge · 3 dashboard notes");
assert.ok(
    mixed.text.includes("\nWelcome email 3 · feedback\nToo long.\nhttps://hgmportal.com/alpine-lodge-dashboard#flow\n"),
    "a section note uses its own label",
);
assert.ok(
    mixed.text.includes("\nLanding page comment\nLove the hero.\nhttps://hgmportal.com/alpine-lodge-dashboard#landing\n"),
    "no label falls back to the section's name",
);
assert.ok(mixed.text.includes("#reels\n"));

/* 5. Same section twice reads as a count of that section, not "dashboard notes". */
const twoFlow = buildClientNoteMessages(
    {
        slug: SLUG,
        by: BY,
        items: [
            { key: "welcomeFlow.0", label: "Welcome email 1 · feedback", text: "a" },
            { key: "welcomeFlow.1", label: "Welcome email 2 · feedback", text: "b" },
        ],
    },
    ctx,
);
assert.equal(twoFlow.subject, "Alpine Lodge · 2 Welcome email comments");

/* 6. Clipping: the email shows EMAIL_CLIP characters, Chat CHAT_CLIP, both with an ellipsis. */
const long = "x".repeat(2_000);
const clipped = buildClientNoteMessages({ slug: SLUG, by: BY, items: [{ key: "hosts", label: "About the hosts", text: long }] }, ctx);
assert.ok(clipped.text.includes("x".repeat(EMAIL_CLIP) + "…"));
assert.ok(!clipped.text.includes("x".repeat(EMAIL_CLIP + 1)));
assert.ok(clipped.chat.includes("x".repeat(CHAT_CLIP) + "…"));
assert.ok(!clipped.chat.includes("x".repeat(CHAT_CLIP + 1)));

/* 7. Sixty long notes never push Chat past its limit, and never cut a fence in half. */
const sixty = buildClientNoteMessages(
    {
        slug: SLUG,
        by: BY,
        items: Array.from({ length: 60 }, (_, i) => ({ key: `personas.r${i}.summary`, label: `Persona “Guest ${i}” · Summary`, text: long })),
    },
    ctx,
);
assert.ok(sixty.chat.length <= CHAT_MAX, `chat is ${sixty.chat.length} chars`);
assert.equal((sixty.chat.match(/```/g) ?? []).length % 2, 0, "fences are balanced");
assert.match(sixty.chat, /_and \d+ more · <https:\/\/hgmportal\.com\/home\|Home>_$/);
assert.equal(sixty.text.split("\nhttps://hgmportal.com/alpine-lodge-dashboard#foundation").length - 1, 60, "the email lists all sixty");
assert.ok(sixty.text.endsWith("Everything waiting for the team: https://hgmportal.com/home"));

/* 8. A note is data, never markup: HTML is escaped, and a backtick can't close the Chat fence. */
const hostile = buildClientNoteMessages(
    { slug: SLUG, by: "a&b@x.com", items: [{ key: "hosts", label: "About the hosts", text: "<script>alert(1)</script> and `code` here" }] },
    { clientName: "O'Neil & Sons", amFirstName: null },
);
assert.ok(!hostile.html.includes("<script>"));
assert.ok(hostile.html.includes("&lt;script&gt;"));
assert.ok(hostile.html.includes("O&#39;Neil &amp; Sons"));
assert.ok(hostile.html.includes("a&amp;b@x.com"));
assert.equal((hostile.chat.match(/```/g) ?? []).length, 2, "only the fence's own backticks survive");
assert.ok(hostile.chat.includes("and 'code' here"));

/* 9. No AM resolves → "Hi team,"; a cleared field says so instead of showing nothing. */
assert.match(hostile.text, /^Hi team,\n/);
const cleared = buildClientNoteMessages({ slug: SLUG, by: BY, items: [{ key: "uvp", label: "Unique value proposition", text: "   " }] }, ctx);
assert.ok(cleared.text.includes("\nBrand doc edit · Unique value proposition\n(cleared)\n"));

/* 10. Pure: the event is not touched. */
const ev = { slug: SLUG, by: BY, items: [{ key: "hosts", label: "About the hosts", text: "  padded  " }] };
const before = JSON.stringify(ev);
buildClientNoteMessages(ev, ctx);
assert.equal(JSON.stringify(ev), before);

console.log("client-note-alert.check: all assertions passed");
