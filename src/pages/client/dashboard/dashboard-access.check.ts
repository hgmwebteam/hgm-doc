/**
 * Self-check for per-person dashboard access — the rules the sign-in gate and the section
 * menu both rest on. These decide who gets in and what they are shown, and every one of
 * them fails silently in the wrong direction: a bad fallback either strands a paying client
 * outside their own dashboard or shows a bookkeeper the whole thing.
 *
 * Same no-framework pattern as dashboard-model.check.ts. Run it:
 *   npx tsc src/pages/client/dashboard/dashboard-access.check.ts \
 *     src/pages/client/dashboard/dashboard-model.ts \
 *     src/pages/client/dashboard/website-setup.ts \
 *     --outDir /tmp/hgm-check --module commonjs --moduleResolution node \
 *     --target es2022 --skipLibCheck --esModuleInterop --types node \
 *   ; sed -i 's#@/pages/client/dashboard/#./#g' /tmp/hgm-check/*.js \
 *   ; node /tmp/hgm-check/dashboard-access.check.js
 *
 * dashboard-model.ts pulls in website-setup.ts at runtime, so it has to be compiled
 * alongside; add any further runtime import it grows to that list. tsc doesn't rewrite
 * the `@/` alias on emit, hence the sed.
 *
 * The compile prints one TS2307 for the aliased `@/lib/supabase` type import in
 * dashboard-model.ts — type-only and erased, the emitted JS runs. Ignore that line.
 */
import assert from "node:assert/strict";
import {
    DEFAULT_CLIENT_VISIBLE,
    type DashboardUser,
    findDashboardUser,
    genSharePassword,
    passwordFor,
    readDashboardUsers,
    sectionsForViewer,
    usersToAllowedEmails,
} from "./dashboard-model";

/* 1. A row written before per-person access upgrades on read, and every address on it
      still opens with the shared password. This is the whole backward-compatibility
      promise — 49 live dashboards depend on it. */
{
    const legacy = { allowed_emails: ["Owner@Example.com", "bookkeeper@example.com"], share_password: "ABC-DEF-HGMS" };
    const users = readDashboardUsers(legacy);
    assert.equal(users.length, 2, "a legacy row upgrades to one user per allowed address");
    for (const u of users) {
        assert.equal(u.password, undefined, "a legacy user has no password of their own");
        assert.equal(passwordFor(u, legacy.share_password), "ABC-DEF-HGMS", "a legacy user falls back to the shared password");
        assert.equal(u.sections, undefined, "a legacy user follows the dashboard default");
    }
}

/* 2. dashboard_users wins over the mirror whenever it is present — otherwise an edit to
      the real list could be silently overridden by a stale allowed_emails. */
{
    const row = { dashboard_users: [{ email: "only@example.com" }], allowed_emails: ["stale@example.com", "older@example.com"] };
    assert.deepEqual(
        readDashboardUsers(row).map((u) => u.email),
        ["only@example.com"],
        "dashboard_users is the source of truth when set",
    );
}

/* 3. An own password REPLACES the shared one rather than joining it. If the shared
      password still opened a person who has their own, every per-person view would be
      reachable by anyone holding it — which is the whole reason this exists. */
{
    const shared = "SHARED-PW";
    const owner: DashboardUser = { email: "owner@example.com", password: "OWNER-PW" };
    const guest: DashboardUser = { email: "guest@example.com" };
    assert.equal(passwordFor(owner, shared), "OWNER-PW", "an own password wins");
    assert.notEqual(passwordFor(owner, shared), shared, "the shared password must not also open a person who has their own");
    assert.equal(passwordFor(guest, shared), shared, "a person without one falls back to the shared password");
    // Whitespace-only is not a password: it must fall back rather than become an
    // unguessable-but-blank credential nobody can type.
    assert.equal(passwordFor({ email: "x@example.com", password: "   " }, shared), shared, "a blank own password falls back");
}

/* 4. No password anywhere ⇒ no way in. The gate also refuses an empty `expected`, so
      this must never come back as something an empty form field would match. */
{
    assert.equal(passwordFor({ email: "nobody@example.com" }, ""), "", "no own and no shared password means no credential");
    assert.equal(passwordFor({ email: "nobody@example.com", password: "" }, "  "), "", "a whitespace-only shared password is no credential");
}

/* 5. Matching an address ignores case and surrounding space — a client typing
      " Owner@Example.com " on a phone keyboard is the same person. */
{
    const users: DashboardUser[] = [{ email: "Owner@Example.com" }];
    assert.ok(findDashboardUser(users, "  owner@example.com "), "lookup normalizes both sides");
    assert.equal(findDashboardUser(users, "someoneelse@example.com"), null, "a stranger matches nobody");
    assert.equal(findDashboardUser([], "owner@example.com"), null, "an empty list matches nobody");
}

/* 6. The derived mirror: trimmed, blanks dropped (the panel keeps an empty row while an
      AM is typing, and that must never reach allowed_emails as an entry). */
{
    const users: DashboardUser[] = [{ email: "  a@example.com " }, { email: "" }, { email: "   " }, { email: "b@example.com" }];
    assert.deepEqual(usersToAllowedEmails(users), ["a@example.com", "b@example.com"], "the mirror trims and drops blanks");
}

/* 7. Section resolution — the rule this whole feature turns on.
      `undefined`/null sections follow the dashboard default; `[]` does NOT. */
{
    const dashboardDefault = ["intake", "onboarding", "foundation"];
    assert.deepEqual(sectionsForViewer({ email: "a@example.com" }, dashboardDefault), dashboardDefault, "no own list ⇒ the dashboard default");
    assert.deepEqual(sectionsForViewer({ email: "a@example.com", sections: null }, dashboardDefault), dashboardDefault, "null ⇒ the dashboard default");
    assert.deepEqual(sectionsForViewer({ email: "a@example.com", sections: [] }, dashboardDefault), [], "an empty own list is Overview only, NOT the default");
    assert.deepEqual(sectionsForViewer({ email: "a@example.com", sections: ["flow"] }, dashboardDefault), ["flow"], "an own list replaces the default");
    assert.deepEqual(sectionsForViewer(null, dashboardDefault), dashboardDefault, "an unidentified viewer gets the dashboard default");
    assert.deepEqual(sectionsForViewer(null, undefined), DEFAULT_CLIENT_VISIBLE, "a row with no default at all falls back to the intake forms");
}

/* 8. Generated passwords are the team's read-aloud format and don't repeat. */
{
    const pw = genSharePassword();
    assert.match(pw, /^[ABCDEFGHJKMNPQRSTUVWXYZ]{3}-[ABCDEFGHJKMNPQRSTUVWXYZ]{3}-HGMS$/, "ABC-DEF-HGMS, no I/L/O");
    assert.ok(new Set(Array.from({ length: 50 }, genSharePassword)).size > 40, "generated passwords are not all the same");
}

console.log("dashboard-access.check.ts — all assertions passed");
