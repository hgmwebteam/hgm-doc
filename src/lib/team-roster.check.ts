/**
 * Self-check for who-sees-what: a wrong match here shows an AM someone else's clients.
 * Plain assert script, same pattern as the dashboard *.check.ts files. Run it:
 *   npx esbuild src/lib/team-roster.check.ts --bundle --platform=node --format=cjs \
 *     --alias:@=./src --outfile=/tmp/hgm-check/roster.cjs && node /tmp/hgm-check/roster.cjs
 */
import assert from "node:assert/strict";
import { clientForSlug, isAmClient, teamRoleOf } from "./team-roster";

assert.deepEqual(teamRoleOf(null), { kind: "team" });
assert.deepEqual(teamRoleOf({ email: "AnhTuan@hiddengem.media", name: "AnhTuan Bui" }), { kind: "owner" });
assert.deepEqual(teamRoleOf({ email: "gillian@hiddengem.media", name: "gillian" }), { kind: "ops" });
// Google full name, any casing/spacing
assert.deepEqual(teamRoleOf({ email: "x@hiddengem.media", name: " alicia  morin " }), { kind: "am", amName: "Alicia Morin" });
// Mailbox = first name, when the account carries no full name
assert.deepEqual(teamRoleOf({ email: "nicole@hiddengem.media", name: "nicole" }), { kind: "am", amName: "Nicole Araya" });
// Marketing assistants and web team are not AMs
assert.deepEqual(teamRoleOf({ email: "vicky@hiddengem.media", name: "Vicky Si" }), { kind: "team" });
assert.deepEqual(teamRoleOf({ email: "brandon@hiddengem.media", name: "Brandon Nguyen" }), { kind: "team" });

assert.equal(isAmClient("alicia morin", "Alicia Morin"), true);
assert.equal(isAmClient("", "Alicia Morin"), false);

const clients = [
    { name: "Abc", link: "https://hgmportal.com/abc-dashboard/" },
    { name: "Abcd", link: "/abcd-dashboard" },
];
assert.equal(clientForSlug(clients, "abc-dashboard")?.name, "Abc");
assert.equal(clientForSlug(clients, "abcd-dashboard")?.name, "Abcd");
assert.equal(clientForSlug(clients, "bc-dashboard"), undefined);

console.log("team-roster: all checks passed");
