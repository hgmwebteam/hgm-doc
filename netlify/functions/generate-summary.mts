import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

/**
 * Turns one client recording into a summary an AM can act on.
 *
 * Two steps, because Claude has no audio input — the Messages API takes text, images and
 * PDFs only. So: Deepgram transcribes, then Claude summarises the transcript.
 *
 * A BACKGROUND function, which is not a detail. A regular Netlify function is killed at
 * ~10 seconds; transcribing three minutes of audio and writing a summary takes far longer
 * than that. Background functions get 15 minutes, but they answer the caller 202
 * immediately and can never return a result to it. Progress is therefore reported by
 * writing `status` onto the row, and the page watches the row. Don't "simplify" this into
 * a synchronous function that returns the summary — it will work on a 20-second voice memo
 * in testing and time out on every real recording.
 *
 * Deepgram is handed a signed URL rather than the audio bytes. That matters: it keeps
 * megabytes of video out of this function entirely, so a long AM-uploaded call recording
 * can't blow the request or memory limits.
 *
 * The AM's browser inserts the row; this only ever advances one that already exists. It
 * cannot create rows and cannot be told which client to write to — the worst a stranger
 * POSTing a guessed id can do is start a run an AM had already queued.
 */

export const config = { background: true };

const MODEL = "claude-fable-5";

/** Forcing a tool call is how the output shape is guaranteed. Free-text asking for
 *  "JSON please" gets prose wrapped around it often enough to matter, and this is
 *  rendered as fixed sections rather than a blob. Mirrors RecordingSummary in
 *  src/lib/script-logs.ts — change both together. */
const SUMMARY_TOOL: Anthropic.Tool = {
    name: "record_summary",
    description: "Record the structured summary of a client's recorded answer.",
    input_schema: {
        type: "object",
        properties: {
            headline: { type: "string", description: "One line, under 12 words, saying what this recording is actually about. Scannable in a list." },
            context: { type: "string", description: "Two or three sentences of plain-English context: who is speaking and what they were asked." },
            key_points: { type: "array", items: { type: "string" }, description: "The substance of what they said, as short bullets. Facts and opinions they actually expressed — never filler." },
            action_items: { type: "array", items: { type: "string" }, description: "Concrete things the account manager now has to do. Empty array if the client asked for nothing." },
            quotes: { type: "array", items: { type: "string" }, description: "Word-for-word pull quotes worth reusing in marketing copy. Must appear verbatim in the transcript. Empty array if none stand out." },
            flags: { type: "array", items: { type: "string" }, description: "Requests, worries, complaints, or anything that contradicts what the agency already has on file. Empty array if nothing." },
        },
        required: ["headline", "context", "key_points", "action_items", "quotes", "flags"],
    },
};

const SYSTEM_PROMPT = `You summarise recordings for HiddenGem Media, a marketing agency for short-term rental and boutique hospitality businesses.

The recording is a client (a property owner or host) answering an onboarding question in their own words — the questions feed their Master Brand Document, so the answers cover their property, their ideal guest, their tone of voice, amenities, and local recommendations.

Write for the account manager who has to act on this, not for the client. Be concrete and specific to what was actually said. Never invent detail that is not in the transcript: if the client was vague, say the answer was vague rather than filling the gap. Transcripts are machine-generated, so proper nouns and place names may be misspelled — if a word is clearly a garbled property or place name, use your best reading and don't remark on it.

If the transcript is too short or too garbled to summarise, say exactly that in the context field and leave the arrays empty rather than padding them.`;

const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

export default async (req: Request) => {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    // Trimmed because these are pasted into a web form by hand, and a trailing newline is
    // invisible in the Netlify UI but produces a header Deepgram rejects as INVALID_AUTH —
    // indistinguishable, from the outside, from simply having the wrong key.
    const deepgramKey = process.env.DEEPGRAM_API_KEY?.trim();
    const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();

    if (!supabaseUrl || !serviceKey) {
        console.error("[generate-summary] Supabase env missing — cannot even record the failure.");
        return Response.json({ error: "Not configured." }, { status: 500 });
    }

    let id: string;
    try {
        const body = await req.json();
        id = String(body.id ?? "").trim();
    } catch {
        return Response.json({ error: "Bad request." }, { status: 400 });
    }
    if (!isUuid(id)) return Response.json({ error: "Bad id." }, { status: 400 });

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    const { data: row, error: readErr } = await supabaseAdmin
        .from("script_logs")
        .select("id,status,updated_at,source_path,source_label,client_name,media_kind")
        .eq("id", id)
        .single();
    if (readErr || !row) return Response.json({ error: "Not found." }, { status: 404 });

    /**
     * Which rows may (re)start.
     *
     * This guard exists because Netlify retries a failed background function after 1 minute
     * and again after 2, and the endpoint is publicly reachable — without it, one hiccup
     * transcribes and bills the same recording three times and overwrites a good result.
     *
     * It originally shipped as `status !== "queued"`, which was too strict: it silently
     * killed the Retry button, because a failed row is `error`, not `queued`. The button
     * called this, this skipped, and the page showed no change at all. Found on the first
     * real failure in production.
     *
     * So: `error` restarts (a person clicked Retry, and the auto-retry path can't reach
     * here because every failure returns 200). `done` never restarts. A row mid-flight
     * restarts only once it's stale enough that the run that claimed it is clearly gone —
     * the same 5-minute threshold the page uses to label it "Stalled", so the button and
     * the function can't disagree about what is retryable.
     */
    const STALE_MS = 5 * 60 * 1000;
    const ageMs = Date.now() - new Date(row.updated_at as string).getTime();
    const restartable =
        row.status === "queued" ||
        row.status === "error" ||
        ((row.status === "transcribing" || row.status === "summarising") && ageMs > STALE_MS);

    if (!restartable) {
        console.log(`[generate-summary] ${id} is ${row.status} (${Math.round(ageMs / 1000)}s old) — skipping.`);
        return Response.json({ ok: true, skipped: true });
    }

    const fail = async (message: string) => {
        await supabaseAdmin.from("script_logs").update({ status: "error", error: message, updated_at: new Date().toISOString() }).eq("id", id);
        // Deliberately 200: a non-2xx makes Netlify retry, which would re-run a job we
        // have just recorded as failed. The row carries the real outcome.
        return Response.json({ ok: false, error: message });
    };

    const advance = (patch: Record<string, unknown>) =>
        supabaseAdmin.from("script_logs").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);

    if (!deepgramKey) return fail("DEEPGRAM_API_KEY isn't set in Netlify — ask the web team to add it under Site settings → Environment variables.");
    if (!anthropicKey) return fail("ANTHROPIC_API_KEY isn't set in Netlify.");

    try {
        // Clear the previous error: a Retry that leaves the old message on the row reads as
        // "failed again" for the whole minute it's actually working.
        await advance({ status: "transcribing", error: null });

        // An hour is far longer than the job needs, but Deepgram fetches the URL itself
        // and a queue on their side must not expire the link mid-download.
        const { data: signed, error: signErr } = await supabaseAdmin.storage.from("recordings").createSignedUrl(row.source_path, 60 * 60);
        if (signErr || !signed?.signedUrl) return fail("That recording could not be read from storage — it may have been deleted.");

        // diarize labels who spoke, which is what makes this usable on a two-person call
        // rather than only on a single client answering a question.
        const dgUrl =
            "https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&punctuate=true&paragraphs=true&diarize=true";
        const dgRes = await fetch(dgUrl, {
            method: "POST",
            headers: { Authorization: `Token ${deepgramKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ url: signed.signedUrl }),
        });

        if (!dgRes.ok) {
            const detail = await dgRes.text().catch(() => "");
            console.error("[generate-summary] Deepgram rejected the request", dgRes.status, detail.slice(0, 500));
            // 401 is the one failure a non-technical reader can act on, so it gets plain
            // words instead of Deepgram's JSON. The key length is a safe hint: a truncated
            // paste is the usual cause and the number gives it away without exposing the key.
            if (dgRes.status === 401) {
                return fail(
                    `Deepgram rejected the API key (${deepgramKey.length} characters). Check DEEPGRAM_API_KEY in Netlify → Site settings → Environment variables — a Deepgram key is normally 40 characters. Regenerating it in the Deepgram console and pasting it again fixes a truncated or revoked key.`,
                );
            }
            return fail(`Transcription failed (Deepgram ${dgRes.status}). ${detail.slice(0, 200)}`);
        }

        const dg = await dgRes.json();
        const alt = dg?.results?.channels?.[0]?.alternatives?.[0];
        // paragraphs.transcript carries the speaker labels and line breaks; the flat
        // `transcript` is one unbroken block, so it is only the fallback.
        const transcript: string = (alt?.paragraphs?.transcript || alt?.transcript || "").trim();
        const duration = dg?.metadata?.duration;

        if (!transcript) {
            return fail("Nothing could be transcribed — the recording appears to be silent or empty.");
        }

        await advance({
            status: "summarising",
            transcript,
            duration_seconds: typeof duration === "number" ? Math.round(duration) : null,
        });

        const anthropic = new Anthropic({ apiKey: anthropicKey });
        const message = await anthropic.messages.create({
            model: MODEL,
            max_tokens: 2048,
            system: SYSTEM_PROMPT,
            tools: [SUMMARY_TOOL],
            tool_choice: { type: "tool", name: SUMMARY_TOOL.name },
            messages: [
                {
                    role: "user",
                    content: `Client: ${row.client_name || "(not on file)"}
Question this answers: ${row.source_label || "(unlabelled recording)"}
Recorded as: ${row.media_kind || "audio"}

Transcript:
"""
${transcript}
"""

Summarise this for the account manager.`,
                },
            ],
        });

        const block = message.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
        if (!block) {
            console.error("[generate-summary] model returned no tool_use block", message.stop_reason);
            return fail("The summary came back in an unexpected shape — try again.");
        }

        await advance({ status: "done", summary: block.input, error: null });
        return Response.json({ ok: true });
    } catch (err) {
        console.error("[generate-summary]", err);
        return fail(err instanceof Error ? err.message : "Something went wrong generating the summary.");
    }
};
