/**
 * Self-check for deleting a client's stored login — the part that can lose the wrong
 * password, or silently KEEP one while telling someone it is gone.
 *
 * Same no-framework pattern as its siblings under dashboard/: a plain assert script, no
 * test runner, no new dependency. Nothing imports it, so it costs nothing at runtime;
 * `tsc -b` still type-checks it because it lives under src/.
 *
 * Bundled rather than compiled file-by-file, because the module under test is a .tsx that
 * imports icons from an ESM-only subpath. The `--define` is needed too: the form page
 * reaches src/lib/supabase.ts, which reads `import.meta.env` at module load and would
 * throw under node before a single assertion ran. Run it:
 *   npx esbuild src/pages/client/client-onboarding-form-page.check.ts --bundle \
 *     --platform=node --format=cjs --alias:@=./src --define:import.meta.env='{}' \
 *     --outfile=/tmp/hgm-check/logins.cjs \
 *   && node /tmp/hgm-check/logins.cjs
 */
import assert from "node:assert/strict";
import { CREDENTIAL_LABELS, clientOnboardingAnswers, withLoginCleared } from "@/pages/client/client-onboarding-form-page";

const filled = {
    answers: {
        email: "host@example.com",
        instagramLogin__handle: "@acme",
        instagramLogin__user: "acme",
        instagramLogin__pass: "ig-secret",
        pms: "Guesty",
        pmsLogin__user: "ops@acme.com",
        pmsLogin__pass: "pms-secret",
    },
    submittedAt: "2026-09-01T00:00:00.000Z",
};

const one = withLoginCleared(filled, "instagramLogin", "2026-09-18T12:00:00.000Z");

/* THE point of deleting one at a time: the login asked for goes, and NO other login is
   touched. Deleting Instagram must never take the PMS password with it. */
assert.equal(one.answers.instagramLogin__pass, undefined);
assert.equal(one.answers.pmsLogin__pass, "pms-secret");
assert.equal(one.answers.instagramLogin__cleared, "2026-09-18T12:00:00.000Z");
assert.equal(one.answers.pmsLogin__cleared, undefined);

/* What must NOT be lost: the answers that say which account the login belongs to, and
   every unrelated answer in the row. */
assert.equal(one.answers.instagramLogin__user, "acme");
assert.equal(one.answers.instagramLogin__handle, "@acme");
assert.equal(one.answers.pms, "Guesty");
assert.equal(one.answers.email, "host@example.com");
assert.equal(one.submittedAt, "2026-09-01T00:00:00.000Z");

/* The source row is untouched — the caller writes the returned copy to Supabase, and a
   failed write must leave what is on screen alone. */
assert.equal(filled.answers.instagramLogin__pass, "ig-secret");

/* Clearing the rest gets to the same place, one at a time. */
const both = withLoginCleared(one, "pmsLogin", "2026-09-19T09:00:00.000Z");
for (const key of Object.keys(both.answers)) assert.ok(!key.endsWith("__pass"), `password left behind: ${key}`);
/* Each login keeps ITS OWN date, not the date of the last deletion. */
assert.equal(both.answers.instagramLogin__cleared, "2026-09-18T12:00:00.000Z");
assert.equal(both.answers.pmsLogin__cleared, "2026-09-19T09:00:00.000Z");

/* Re-running on an already-cleared login changes nothing — no re-dating, no marker on a
   login that never held a password, no crash on a field that does not exist. */
assert.equal(withLoginCleared(both, "instagramLogin", "2026-12-25T00:00:00.000Z").answers.instagramLogin__cleared, "2026-09-18T12:00:00.000Z");
assert.equal(withLoginCleared(both, "tiktokLogin").answers.tiktokLogin__cleared, undefined);
assert.equal(withLoginCleared(both, "nonsenseField").answers.nonsenseField__cleared, undefined);
/* Whitespace is not a password: clearing one must not leave a marker claiming we deleted
   something real. */
assert.equal(withLoginCleared({ answers: { domainLogin__pass: "   " } }, "domainLogin").answers.domainLogin__cleared, undefined);

/* The answers panel says a password was deleted rather than showing a blank, so nobody
   chases the client for a login they already gave. */
const rows = clientOnboardingAnswers(one).flatMap((s) => s.rows);
const igLines = rows.find((r) => r.field === "instagramLogin")!.lines.map((l) => l.text);
assert.ok(
    igLines.some((t) => t.startsWith("Password moved to 1Password on")),
    `expected a cleared note, got ${JSON.stringify(igLines)}`,
);
assert.ok(igLines.includes("Username: acme"));

/* The row still holding a password is still marked secret — that flag is what draws the
   delete control and the mask, so losing it would strip both at once. */
const secretFields = clientOnboardingAnswers(one)
    .flatMap((s) => s.rows)
    .filter((r) => r.lines.some((l) => l.secret))
    .map((r) => r.field);
assert.deepEqual(secretFields, ["pmsLogin"]);
/* And once everything is cleared, nothing claims to be a secret any more. */
assert.equal(
    clientOnboardingAnswers(both)
        .flatMap((s) => s.rows)
        .flatMap((r) => r.lines)
        .filter((l) => l.secret).length,
    0,
);

/* A login the client never filled in still reads as unanswered, not as deleted. */
assert.equal(rows.find((r) => r.field === "tiktokLogin")!.lines.length, 0);

/* Sanity: the form really does collect the four logins this is written against. */
assert.equal(CREDENTIAL_LABELS.length, 4);

console.log("client-onboarding-form-page.check.ts — all assertions passed");
