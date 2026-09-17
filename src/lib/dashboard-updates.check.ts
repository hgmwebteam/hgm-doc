/**
 * Self-check for the dashboard activity feed's diff — the two guarantees /log rests on:
 * an entry appears only when a person really changed something, and no value a client or an
 * AM typed is ever carried into it.
 *
 * Same no-framework pattern as dashboard-model.check.ts. Run it:
 *   npx tsc src/lib/dashboard-updates.check.ts src/lib/dashboard-updates-model.ts \
 *     --outDir /tmp/hgm-check --module commonjs --moduleResolution node \
 *     --target es2022 --skipLibCheck --esModuleInterop --types node \
 *   ; node /tmp/hgm-check/dashboard-updates.check.js
 *
 * The compile prints two TS2307s for the aliased `@/lib/supabase` type import (one per file)
 * — type-only and erased, so the emitted JS runs. Ignore those lines. On TypeScript 6+ add
 * `--ignoreConfig`: it refuses files on the command line while a tsconfig.json is present.
 */
import assert from "node:assert/strict";
import type { DashboardContent } from "@/lib/supabase";
import { diffDashboardContent, humaniseField } from "./dashboard-updates-model";

type Content = Partial<DashboardContent>;

const SECRET = "hunter2-the-share-password";
const CLIENT_WORDS = "Two sisters who inherited the lodge from their grandmother.";

const base = (over: Content = {}): Content => ({
    status: "Active",
    logo_url: "",
    sidebar_bg_url: "",
    brand: { colors: [{ name: "Sand", hex: "#E8D9C0" }], fonts: "Inter", folder_link: "" },
    links: [],
    ...over,
});

/* 1. An unchanged row produces nothing. Pressing Save to re-lock the page is routine — if
      that wrote a line, the feed would be mostly noise within a day. */
{
    const row = base();
    assert.deepEqual(diffDashboardContent(row, structuredClone(row)), []);
}

/* 2. Key order never counts as a change. jsonb re-orders keys, so the "before" read back
      from Supabase rarely matches the order the browser sent — comparing whole objects
      would report every section changed on the save after a reload. */
{
    const before: Content = { status: "Active", brand: { colors: [], fonts: "Inter", folder_link: "x" } };
    const after: Content = { brand: { folder_link: "x", fonts: "Inter", colors: [] }, status: "Active" };
    assert.deepEqual(diffDashboardContent(before, after), []);
}

/* 3. A real edit names its section and its fields — and nothing else. */
{
    const before = base();
    const after = base({ brand: { colors: [{ name: "Sand", hex: "#E8D9C0" }], fonts: "Söhne", folder_link: "" } });
    const changes = diffDashboardContent(before, after);
    assert.deepEqual(changes, [{ section: "Brand Kit", fields: ["Fonts"] }]);
}

/* 4. Two sections at once, reported in side-menu order (Master Brand before Brand Kit). */
{
    const before = base({ foundation: { hosts: "" } as DashboardContent["foundation"] });
    const after = base({
        foundation: { hosts: CLIENT_WORDS } as DashboardContent["foundation"],
        brand: { colors: [], fonts: "Inter", folder_link: "" },
    });
    const changes = diffDashboardContent(before, after);
    assert.deepEqual(
        changes.map((c) => c.section),
        ["Master Brand", "Brand Kit"],
    );
}

/* 5. THE ONE THAT MATTERS: no value ever reaches the entry. Every string in the result is
      compared against what was typed — a persona's words, and the share password. */
{
    const before = base({ share_password: "old-one", foundation: { hosts: "" } as DashboardContent["foundation"] });
    const after = base({
        share_password: SECRET,
        foundation: { hosts: CLIENT_WORDS } as DashboardContent["foundation"],
    });
    const printed = JSON.stringify(diffDashboardContent(before, after));
    assert.ok(!printed.includes(SECRET), "a share password must never reach the activity feed");
    assert.ok(!printed.includes(CLIENT_WORDS), "a client's own words must never reach the activity feed");
    assert.ok(!printed.includes("old-one"), "the previous value must never reach the activity feed either");
}

/* 6. The access keys collapse to one label, with no field breakdown — naming the keys would
      only point at where the passwords are kept. */
{
    const before = base({ share_password: "a", allowed_emails: ["one@example.com"] });
    const after = base({ share_password: "b", allowed_emails: ["one@example.com", "two@example.com"] });
    assert.deepEqual(diffDashboardContent(before, after), [{ section: "Client access", fields: [] }]);
}

/* 7. A shape upgrade is not an edit. An older row gains `resources: []` the first time a
      newer build opens it; nobody did anything, so nothing is logged. */
{
    const before = base();
    const after = base({ resources: [] });
    assert.deepEqual(diffDashboardContent(before, after), []);
}

/* 8. …but the same key arriving with content in it IS an edit. */
{
    const before = base();
    const after = base({ resources: [{ id: "r1", label: "Claude project", url: "https://claude.ai" }] });
    assert.deepEqual(diffDashboardContent(before, after), [{ section: "Resources", fields: [] }]);
}

/* 9. A first save (no prior row) reports what the dashboard was set up with. */
{
    const changes = diffDashboardContent(null, base());
    assert.ok(changes.some((c) => c.section === "Brand Kit"));
    assert.ok(changes.some((c) => c.section === "Status"));
}

/* 10. Field names are readable — this is what a colleague actually reads in the feed. */
{
    assert.equal(humaniseField("focusProperties"), "Focus properties");
    assert.equal(humaniseField("folder_link"), "Folder link");
    assert.equal(humaniseField("uvp"), "UVP");
    assert.equal(humaniseField("brandVoice"), "Brand voice");
}

console.log("dashboard-updates.check.ts — all checks passed");
