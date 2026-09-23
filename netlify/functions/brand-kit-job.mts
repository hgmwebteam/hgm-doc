import { isJobId, readJob } from "../lib/brand-kit-jobs.mts";
import { NOT_CONFIGURED, callerEmail, isTeamEmail, readAuthEnv } from "../lib/client-sources.mts";

/**
 * Status of a Brand Kit draft started by generate-brand-kit-background. The dashboard polls
 * this every couple of seconds until it reads "done" or "error".
 *
 * "pending" means no job row yet — the worker hasn't started, or refused the caller. The
 * browser gives that a short grace period before saying the generator didn't start.
 */
export default async (req: Request) => {
    const auth = readAuthEnv();
    if (!auth) return Response.json({ error: NOT_CONFIGURED }, { status: 500 });
    const email = await callerEmail(req, auth.supabaseUrl, auth.anonKey);
    if (!isTeamEmail(email)) return Response.json({ error: "Team sign-in required." }, { status: 401 });

    const id = new URL(req.url).searchParams.get("id") ?? "";
    if (!isJobId(id)) return Response.json({ error: "Bad request." }, { status: 400 });

    const job = await readJob(id);
    // Someone else's job reads exactly like one that doesn't exist.
    if (!job || job.owner !== email) return Response.json({ status: "pending" }, { headers: { "cache-control": "no-store" } });
    const { owner: _owner, ...rest } = job;
    return Response.json(rest, { headers: { "cache-control": "no-store" } });
};
