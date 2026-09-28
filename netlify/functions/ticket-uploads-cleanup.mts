import type { Config } from "@netlify/functions";
import { ConfigError } from "../lib/reporting.mts";
import { removeOrphans } from "../lib/ticket-files.mts";

/**
 * Once a day, removes files that were uploaded for a request and never sent with one.
 *
 * The form uploads a file the moment it is picked, so a person who picks three files and
 * closes the tab leaves three objects in the `ticket-files` bucket that no request will ever
 * claim. Anything unclaimed after 24 hours goes. Files on a request are kept as long as the
 * request exists (owner, 28 Sep 2026); this never touches one.
 *
 * The order that makes it safe (mark first, remove only what was marked, un-mark a chunk
 * whose removal failed) is in removeOrphans, netlify/lib/ticket-files.mts, and proved by
 * ticket-files.check.mts. A scheduled function is not reachable by URL in production, so it
 * needs no secret. Logs counts only.
 *
 * House style: no em or en dashes anywhere.
 */
export default async () => {
    try {
        const result = await removeOrphans(Date.now());
        console.log("[ticket-uploads-cleanup] done", result);
    } catch (err) {
        if (err instanceof ConfigError) console.error("[ticket-uploads-cleanup] not configured", err.message);
        else console.error("[ticket-uploads-cleanup] failed", err instanceof Error ? err.message : String(err));
    }
};

/** Daily at 07:23 UTC, away from the platform's :14 and :44 ticket sweep. */
export const config: Config = { schedule: "23 7 * * *" };
