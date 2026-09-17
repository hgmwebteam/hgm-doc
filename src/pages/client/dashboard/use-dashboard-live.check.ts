/**
 * Self-check for what a live row does to an open dashboard.
 *
 * The rule is four lines long and the failure mode is silent data loss — a client watching
 * their Website Setup answer vanish mid-sentence because an AM happened to press Save. That
 * is worth pinning down.
 *
 * Same no-framework pattern as its siblings: a plain assert script, no test runner, no new
 * dependency. Nothing imports it, so it costs nothing at runtime; `tsc -b` still type-checks
 * it because it lives under src/.
 *
 * Bundled rather than compiled file-by-file, for the reason given in
 * dashboard-navigation.check.ts. This one also needs `import.meta.env` stubbed, which its
 * siblings do not: the module under check imports the Supabase client, and that reads the
 * env at import time. Run it:
 *   npx esbuild src/pages/client/dashboard/use-dashboard-live.check.ts --bundle \
 *     --platform=node --format=cjs --alias:@=./src --define:import.meta.env='{}' \
 *     --outfile=/tmp/hgm-check/live.cjs \
 *   && node /tmp/hgm-check/live.cjs
 */
import assert from "node:assert/strict";
import type { DashboardContent } from "@/lib/supabase";
import { mergeLiveContent } from "./use-dashboard-live";

/** Only the keys these assertions read — the rest of DashboardContent is beside the point. */
const make = (status: string, journey: string[], domain: string) =>
    ({
        status,
        journey_done: journey,
        website_setup: { netlify_email: "", netlify_done: false, ai_website: "", accounts: {}, domain, notes: "" },
    }) as unknown as DashboardContent;

/* 1. Nothing unsaved locally: the incoming row wins outright. This is the ordinary case —
      an AM ticks a step, and the client's meter moves. */
{
    const local = make("Onboarding", ["chat"], "typed.example");
    const incoming = make("Active", ["chat", "kickoff"], "server.example");
    const merged = mergeLiveContent(incoming, local, false);
    assert.deepEqual(merged.journey_done, ["chat", "kickoff"], "a live tick must reach the bar");
    assert.equal(merged.status, "Active");
    assert.equal(merged.website_setup?.domain, "server.example", "with nothing unsaved, the server's copy is the truth");
}

/* 2. The client is mid-answer: their Website Setup text survives, and the team's fields
      still update around it. Both halves matter — keeping the text is the point, but
      freezing the whole row would stall the meter for anyone who ever typed there. */
{
    const local = make("Onboarding", ["chat"], "half-typed.exa");
    const incoming = make("Active", ["chat", "kickoff"], "stale.example");
    const merged = mergeLiveContent(incoming, local, true);
    assert.equal(merged.website_setup?.domain, "half-typed.exa", "an unsaved answer must never be replaced by an older row");
    assert.deepEqual(merged.journey_done, ["chat", "kickoff"], "the rest of the row must still update while they type");
    assert.equal(merged.status, "Active");
}

/* 3. The guard is scoped to that one key. If it ever grows to hold back more of the row,
      an AM's tick stops reaching a client who has typed in the setup guide — which is the
      bug this whole file exists to prevent, arriving by the back door. */
{
    const local = make("Onboarding", ["chat"], "half-typed.exa");
    const incoming = make("Active", ["chat", "kickoff", "launch"], "stale.example");
    const held = mergeLiveContent(incoming, local, true);
    const free = mergeLiveContent(incoming, local, false);
    const differing = (Object.keys({ ...held, ...free }) as (keyof DashboardContent)[]).filter((k) => held[k] !== free[k]);
    assert.deepEqual(differing, ["website_setup"], `the unsaved-answer guard must hold back website_setup and nothing else, held ${JSON.stringify(differing)}`);
}

/* 4. Pure: neither argument is mutated. The caller passes React state straight in, so a
      mutation here would be a state change React never hears about. */
{
    const local = make("Onboarding", ["chat"], "half-typed.exa");
    const incoming = make("Active", ["chat", "kickoff"], "stale.example");
    mergeLiveContent(incoming, local, true);
    assert.deepEqual(local.journey_done, ["chat"], "the local copy must not be mutated");
    assert.equal(incoming.website_setup?.domain, "stale.example", "the incoming row must not be mutated");
}

console.log("use-dashboard-live.check: all assertions passed");
