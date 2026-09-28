import { ConfigError, accessTokenFrom, jsonError, readJson, verifyCaller, verifyStaff } from "../lib/reporting.mts";
import { mintUploads } from "../lib/ticket-files.mts";

/**
 * One signed upload URL per file a person is about to attach to a request.
 *
 * The browser asks as soon as a file is picked, uploads it straight to the private
 * `ticket-files` bucket with the token it gets back, and sends ticket-create only the ids.
 * So a 25 MB PDF never passes through a function (Netlify caps a request body at about
 * 6 MB), and uploads while the person is still typing. What makes that safe is in
 * netlify/lib/ticket-files.mts: every URL is recorded against the VERIFIED caller before it
 * is minted, writes exactly one key (no upsert), lives two hours, and ticket-create accepts
 * a file only by proving it against that record.
 *
 * ── WHO MAY ASK ─────────────────────────────────────────────────────────────
 * With a slug: verifyCaller, the same gate as ticket-create (a listed client, or staff
 * viewing that client's help centre). Without one: verifyStaff, for the team's own form,
 * where the client may not be chosen yet. The row records the slug, or null.
 *
 * POST application/json + Authorization: Bearer <session token>
 *   { slug?, upload_id?, files: [{ name, mime, bytes }] }   1 to 10 per call
 *   -> 200 { upload_id, bucket, files: [{ file_id, name, mime, path, token }] }
 *      400 bad body; 401 no session; 403 not listed, or an upload_id that is someone else's;
 *      422 a type, a size or a count the rules refuse; 429 over the day's 100 files;
 *      503 the ledger or the bucket is not there yet (the request still sends without files)
 *
 * Logs name counts and the upload id only; never a file name or an address.
 *
 * House style: no em or en dashes anywhere.
 */

interface UploadBody {
    slug?: unknown;
    accessToken?: unknown;
    upload_id?: unknown;
    files?: unknown;
}

export default async (req: Request) => {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

    const parsed = await readJson<UploadBody>(req);
    if (!parsed.ok) return parsed.response;
    const body = parsed.body;

    try {
        const token = accessTokenFrom(req, body);
        const slug = typeof body.slug === "string" && body.slug.trim() ? body.slug.trim() : null;
        const gate = slug ? await verifyCaller(slug, token) : await verifyStaff(token);
        if (!gate.ok) return jsonError(gate.status, gate.error, gate.reason);

        const uploadId = body.upload_id === undefined || body.upload_id === null || body.upload_id === "" ? null : String(body.upload_id);
        const result = await mintUploads({ caller: gate.caller, via: gate.via, slug, uploadId, files: body.files });
        if (!result.ok) return jsonError(result.status, result.error);
        return Response.json({ upload_id: result.upload_id, bucket: result.bucket, files: result.files });
    } catch (err) {
        if (err instanceof ConfigError) {
            console.error("[ticket-upload-url] not configured", err.message);
            return jsonError(500, "The help centre is not configured. Ask your account manager to tell the web team.");
        }
        console.error("[ticket-upload-url] unexpected failure", err instanceof Error ? err.message : String(err));
        return jsonError(500, "Something went wrong at our end.");
    }
};
