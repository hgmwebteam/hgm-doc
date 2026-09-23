import { getStore } from "@netlify/blobs";
import type { Kit } from "./brand-kit.mts";

/**
 * Where a Brand Kit draft waits between the background worker that builds it and the
 * dashboard that polls for it.
 *
 * Netlify Blobs rather than a Supabase table: the job is minutes-lived scratch state, it
 * holds nothing a client wrote, and it needs no migration or RLS policy to exist. Strong
 * consistency, because the poll that follows a write must see it.
 *
 * Each job records who started it; the status endpoint only answers that person, so a job
 * id seen in someone else's network tab reads back nothing.
 */

export type Job =
    | { status: "running"; owner: string; started: number }
    | { status: "done"; owner: string; started: number; kit: Kit }
    | { status: "error"; owner: string; started: number; error: string };

const store = () => getStore({ name: "brand-kit-jobs", consistency: "strong" });

/** A browser-made crypto.randomUUID(). Anything else is refused before it touches the store. */
export const isJobId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export const writeJob = (id: string, job: Job) => store().setJSON(id, job);

export const readJob = async (id: string): Promise<Job | null> => ((await store().get(id, { type: "json" })) as Job | null) ?? null;
