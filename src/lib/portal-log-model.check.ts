/**
 * Self-check for /log's change log: the git reader behind Releases, the rule behind Bugs, and
 * the merged feed's order and filters. Run it:
 *   node --experimental-strip-types src/lib/portal-log-model.check.ts
 *
 * Plain asserts, no test runner, like its siblings. `tsc -b` type-checks it under src/.
 */
import assert from "node:assert/strict";
import type { DashboardUpdate } from "./dashboard-updates.ts";
import { ALL, type BugEvent, type BugTicket, buildFeed, filterFeed, isPortalReport } from "./portal-log-model.ts";
import { parseGitLog } from "./portal-releases.ts";

const US = "\x1f";
const RS = "\x1e";
const record = (...fields: string[]) => fields.join(US) + RS + "\n";

/* 1. Releases: a squash takes the PR title without "(#57)", a merge commit the body's first
      line, a direct commit its subject; syncing main into a branch is not a release. */
{
    const raw =
        record("b5184ce", "AnhTuan-HiddenGemMedia", "AnhTuan@hiddengem.media", "2026-10-22T17:36:06-04:00", "Report button: reporter's own address (#57)", "") +
        record("b1a86e9", "Kyle-HiddenGemMedia", "kyle@hiddengem.media", "2026-10-23T10:47:45-04:00", "Merge pull request #58 from hgmwebteam/sop/x", "\nSOP screen layout\n\nmore") +
        record("45ace36", "Alicia", "alicia@hiddengem.media", "2026-10-09T10:00:00-04:00", "Merge remote-tracking branch 'origin/main' into claude/x", "") +
        record("9f61d21", "Alicia", "alicia@hiddengem.media", "2026-10-01T10:00:00-04:00", "Merge origin/main", "") +
        record("974ca2a", "Claude", "noreply@anthropic.com", "2026-10-21T00:11:32Z", "Google Chat step: no help link", "Body line");
    const releases = parseGitLog(raw);
    assert.deepEqual(
        releases.map((r) => [r.sha, r.title, r.pr, r.author_email]),
        [
            ["b5184ce", "Report button: reporter's own address", 57, "anhtuan@hiddengem.media"],
            ["b1a86e9", "SOP screen layout", 58, "kyle@hiddengem.media"],
            ["974ca2a", "Google Chat step: no help link", null, "noreply@anthropic.com"],
        ],
    );
    assert.deepEqual(parseGitLog(""), []);
}

/* 2. Bugs: a team member's request about a portal page, and nothing else. */
{
    const page = "https://hgmportal.com/paradise-pointe-dashboard#welcome-flow";
    assert.equal(isPortalReport({ submitted_by: "alicia@hiddengem.media", urls: [page] }), true);
    assert.equal(isPortalReport({ submitted_by: "alicia@hiddengem.media", urls: ["https://deploy-preview-59--docs-hgm.netlify.app/x-dashboard"] }), true);
    assert.equal(isPortalReport({ submitted_by: "host@gmail.com", urls: [page] }), false, "a client's request is not a bug report");
    assert.equal(isPortalReport({ submitted_by: "alicia@hiddengem.media", urls: ["https://staysaluda.com/book"] }), false, "a client website is not the portal");
    assert.equal(isPortalReport({ submitted_by: "alicia@hiddengem.media", urls: null }), false);
    assert.equal(isPortalReport({ submitted_by: "alicia@hiddengem.media", urls: ["not a url", 4] }), false);
}

/* 3. The feed: newest first by instant across offsets, one person per address, status moves
      only (received is the report itself), and a client filter drops releases. */
{
    const update = {
        id: "u1",
        slug: "paradise-pointe-dashboard",
        client_name: "Paradise Pointe",
        author_email: "anhtuan@hiddengem.media",
        author_name: "AnhTuan Bui",
        author_avatar: "https://photo",
        kind: "save",
        sections: ["Brand Kit"],
        detail: [],
        summary: "",
        created_at: "2026-10-22T21:30:00+00:00", // 17:30 Toronto
    } satisfies DashboardUpdate;
    const [release] = parseGitLog(record("f3d5ae8", "AnhTuan-HiddenGemMedia", "anhtuan@hiddengem.media", "2026-10-22T17:35:00-04:00", "Report a problem button (#56)", "")); // 21:35 UTC
    const ticket: BugTicket = {
        id: "t1",
        reference: "REQ-1200",
        client_slug: "paradise-pointe-dashboard",
        client_name: "Paradise Pointe",
        title: "Welcome email shows the wrong logo",
        status: "assigned",
        submitted_by: "alicia@hiddengem.media",
        submitted_by_name: "Alicia",
        created_at: "2026-10-22T21:40:00+00:00",
        urls: ["https://hgmportal.com/paradise-pointe-dashboard#welcome-flow"],
    };
    const events: BugEvent[] = [
        { id: "e1", ticket_id: "t1", kind: "received", actor_name: "Alicia", actor_email: "alicia@hiddengem.media", created_at: "2026-10-22T21:40:00+00:00" },
        { id: "e2", ticket_id: "t1", kind: "team_update", actor_name: "Leshan", actor_email: "leshan@hiddengem.media", created_at: "2026-10-22T21:45:00+00:00" },
        { id: "e3", ticket_id: "t1", kind: "assigned", actor_name: null, actor_email: null, created_at: "2026-10-22T21:50:00+00:00" },
        { id: "e4", ticket_id: "other", kind: "completed", actor_name: "Leshan", actor_email: "leshan@hiddengem.media", created_at: "2026-10-22T22:00:00+00:00" },
    ];
    const feed = buildFeed([update], [release], [ticket], events);

    assert.deepEqual(
        feed.map((e) => e.key),
        ["e:e3", "b:t1", "r:f3d5ae8", "d:u1"],
        "17:35 -04:00 is after 21:30 UTC though its string sorts before it",
    );
    const releaseEntry = feed.find((e) => e.type === "release");
    assert.equal(releaseEntry?.who.name, "AnhTuan Bui", "the git name gives way to the Google one for the same address");
    assert.equal(releaseEntry?.who.avatar, "https://photo");
    const moved = feed[0];
    assert.ok(moved.type === "bug" && moved.moved === "assigned");
    assert.equal(moved.who.name, "HiddenGem Media team", "an event with no actor reads as the team, as the request page does");

    assert.deepEqual(
        filterFeed(feed, { type: "bug", who: ALL, client: ALL }).map((e) => e.key),
        ["e:e3", "b:t1"],
    );
    assert.deepEqual(
        filterFeed(feed, { type: ALL, who: "anhtuan@hiddengem.media", client: ALL }).map((e) => e.key),
        ["r:f3d5ae8", "d:u1"],
    );
    assert.equal(
        filterFeed(feed, { type: ALL, who: ALL, client: "paradise-pointe-dashboard" }).some((e) => e.type === "release"),
        false,
    );
}

console.log("portal-log-model.check: all passed");
