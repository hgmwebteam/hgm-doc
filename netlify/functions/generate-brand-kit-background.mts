import { isJobId, writeJob } from "../lib/brand-kit-jobs.mts";
import { KitError, buildKit, isBrandKitPath } from "../lib/brand-kit.mts";
import { callerEmail, isTeamEmail, readAuthEnv } from "../lib/client-sources.mts";

/**
 * Builds a Brand Kit draft for the dashboard's Generate brand kit button. The reading
 * itself is netlify/lib/brand-kit.mts; this file is only the job around it.
 *
 * A BACKGROUND function (the "-background" suffix): Netlify answers the browser 202 at once
 * and gives this up to 15 minutes. The synchronous version had ~10 seconds for a page fetch,
 * its stylesheets and a model call together, so a slow site came back empty and the PDF's
 * naming pass was routinely cut off. The result goes to Netlify Blobs under the job id the
 * browser chose, and the browser polls brand-kit-job for it.
 *
 * Team-only, checked before anything is written: without it, anyone who finds the URL can
 * make our server fetch any public site and hand back its images. A caller that fails the
 * check gets no job at all — the poll then times out into "didn't start", which is the
 * honest answer.
 *
 * Like generate-overview it RETURNS a draft rather than writing it into the dashboard — the
 * AM reviews it in unsaved state first.
 */
export default async (req: Request) => {
    if (req.method !== "POST") return;
    const auth = readAuthEnv();
    if (!auth) return;
    const owner = await callerEmail(req, auth.supabaseUrl, auth.anonKey);
    if (!isTeamEmail(owner)) return;

    let job = "";
    let url = "";
    let pdfPath = "";
    try {
        const body = (await req.json()) as { job?: unknown; url?: unknown; pdf_path?: unknown };
        job = String(body.job ?? "").trim();
        url = String(body.url ?? "").trim();
        pdfPath = String(body.pdf_path ?? "").trim();
    } catch {
        return;
    }
    if (!isJobId(job)) return;

    const started = Date.now();
    const fail = (error: string) => writeJob(job, { status: "error", owner: owner!, started, error });
    await writeJob(job, { status: "running", owner: owner!, started });

    if (url.length > 500) return fail("That website address is too long.");
    if (pdfPath && !isBrandKitPath(pdfPath)) return fail("That uploaded file couldn't be found — try uploading it again.");
    if (!url && !pdfPath) return fail("Add the client's website address, or upload their brand guidelines PDF.");

    try {
        const kit = await buildKit({ url, pdfPath }, { ...auth, apiKey: process.env.ANTHROPIC_API_KEY?.trim() });
        await writeJob(job, { status: "done", owner: owner!, started, kit });
    } catch (err) {
        // A KitError is an expected answer ("couldn't load that site"), not a crash.
        if (err instanceof KitError) return fail(err.message);
        console.error("[generate-brand-kit-background]", err);
        await fail("Something went wrong reading that — try again, or add the colours by hand.");
    }
};
