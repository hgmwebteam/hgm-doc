import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { NOT_CONFIGURED, blankIfPlaceholder, isDashboardSlug, readClientSources, readEnv, sourceBlocks } from "../lib/client-sources.mts";

/**
 * Drafts a client's Overview Document from what they have already told us.
 *
 * Reads both client-input forms — the Onboarding Form (client_onboarding_pages) and the
 * Brand Vision Form (host_onboarding_pages) — plus any transcripts we've already made of
 * their recorded answers, and returns the Overview Document's fields.
 *
 * Synchronous, unlike generate-summary: there is no transcription step here, just one model
 * call over text that already exists, which comfortably fits a regular function's ~10s
 * budget. The AM is watching a spinner and wants the fields back, not a status column.
 *
 * It RETURNS the draft rather than writing it. The dashboard merges it into unsaved state
 * so an AM reviews before it lands — a model's read of a client must never overwrite a
 * person's own notes without them seeing it happen first.
 *
 * Service-role is used to read the two form tables and script_logs. Nothing is written.
 */

const MODEL = "claude-fable-5";

/** Mirrors OverviewDoc in src/lib/supabase.ts, minus properties/screenshot/generated_*.
 *  Change both together, or the model will fill fields the form doesn't render. */
const FIELDS: Record<string, string> = {
    client_name: "The person's own name — the individual we deal with, not the business.",
    business_name: "The business or brand name.",
    email: "Their contact email address.",
    business_type: "What kind of property business this is, e.g. 'cabins', 'beach houses', 'boutique hotel'.",
    locations: "Where the properties are — town, region, state.",
    instagram: "Instagram handle, including the @.",
    tiktok: "TikTok handle, including the @.",
    direct_booking_website: "Their own booking website URL.",
    airbnb: "Their Airbnb listing or profile URL.",
    short_term_goals: "What they want in the next few months, in their terms.",
    long_term_goals: "Where they want the business to go over years.",
    success_metrics: "How they judge whether it is working — the numbers they actually watch.",
    target_audience: "Who books with them, and why those people specifically.",
    unique_selling_points: "What they have that comparable properties don't.",
    branding: "How the brand presents itself — tone, look, the feeling they are going for.",
    competitor_inspiration: "Competitors or brands they admire or named.",
    market_insights: "Anything they said about their market, season, or local demand.",
    communication_style: "How they want us to communicate with them.",
    concerns: "Worries, requests or conditions they raised.",
    other_notes: "Anything an account manager should know that doesn't fit above.",
};

const DOC_TOOL: Anthropic.Tool = {
    name: "client_overview",
    description: "Record the Client Overview Document drafted from the client's own answers.",
    input_schema: {
        type: "object",
        properties: Object.fromEntries(
            Object.entries(FIELDS).map(([key, description]) => [key, { type: "string", description }]),
        ),
        required: Object.keys(FIELDS),
    },
};

const SYSTEM_PROMPT = `You draft internal client briefs for HiddenGem Media, a marketing agency for short-term rental and boutique hospitality businesses.

You are given everything a new client has told us: their onboarding form, their brand vision form, and transcripts of any answers they recorded rather than typed. Turn it into the account manager's working brief.

The single rule that matters: every field must come from what the client actually said. This brief is what the account manager will act on, so a plausible invention is worse than a blank. If the source material doesn't cover a field, return an empty string for it. Do not infer a business type from a business name, do not guess a location from an area code, and do not fill "competitor inspiration" with well-known brands the client never mentioned.

Write in plain, specific prose, not marketing language — this is read by a colleague, not the client. Prefer the client's own words for anything about their voice or positioning. Keep each field to a few sentences; the brief is scanned, not studied.

Handles keep their @. URLs stay as the client gave them.

A key ending in "__user" is the account NAME the client uses on that platform — "instagramLogin__user" is their Instagram account name, "tiktokLogin__user" their TikTok one. Use those to fill the matching platform fields. Passwords are deliberately not given to you; never ask for one, never guess one, and never put one in a field.`;

export default async (req: Request) => {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

    const env = readEnv();
    if (!env) return Response.json({ error: NOT_CONFIGURED }, { status: 500 });

    let slug: string;
    try {
        const body = await req.json();
        slug = String(body.slug ?? "").trim();
    } catch {
        return Response.json({ error: "Bad request." }, { status: 400 });
    }
    if (!isDashboardSlug(slug)) return Response.json({ error: "Bad slug." }, { status: 400 });

    const supabaseAdmin = createClient(env.supabaseUrl, env.serviceKey);
    const sources = await readClientSources(supabaseAdmin, slug);

    if (!sources.hasAny) {
        return Response.json(
            { error: "There's nothing to draft from yet — this client hasn't submitted either form." },
            { status: 400 },
        );
    }

    const parts = [sourceBlocks(sources)];

    try {
        const anthropic = new Anthropic({ apiKey: env.apiKey });
        const message = await anthropic.messages.create({
            model: MODEL,
            max_tokens: 4096,
            system: SYSTEM_PROMPT,
            tools: [DOC_TOOL],
            tool_choice: { type: "tool", name: DOC_TOOL.name },
            messages: [{ role: "user", content: `${parts.join("\n\n")}\n\nDraft the Client Overview Document.` }],
        });

        const block = message.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
        if (!block) {
            console.error("[generate-overview] no tool_use block", message.stop_reason);
            return Response.json({ error: "The draft came back in an unexpected shape — try again." }, { status: 502 });
        }

        // Only fields the form actually renders are passed on. If the schema and the form drift
        // apart, the extra keys are dropped here rather than saved into the row forever.
        const raw = block.input as Record<string, unknown>;
        const doc = Object.fromEntries(Object.keys(FIELDS).map((k) => [k, blankIfPlaceholder(String(raw[k] ?? ""))]));

        // Literal form answers don't need a model — copy them verbatim when the model left
        // the field blank. The model is (rightly) told never to guess, so it skips e.g.
        // "direct_booking_website" when the form only says "Website URL"; the client's own
        // typed answer is always the better value for these.
        const literal = (docKey: string, formKey: string) => {
            if (!String(doc[docKey] ?? "").trim()) doc[docKey] = String(sources.intakeAnswers[formKey] ?? "").trim();
        };
        literal("direct_booking_website", "websiteUrl");
        literal("email", "email");
        // The client's answer to "Link to Your Airbnb Profile" — kept even when it's
        // actually an Expedia/VRBO link, because it's the listing they chose to give us.
        literal("airbnb", "airbnbUrl");
        // Public @handles from the login steps (asked since 2026-08-24).
        literal("instagram", "instagramLogin__handle");
        literal("tiktok", "tiktokLogin__handle");

        return Response.json({ doc, sources: { intake: !!sources.intakeText, brandVision: !!sources.visionText, recordings: !!sources.spokenText } });
    } catch (err) {
        console.error("[generate-overview]", err);
        return Response.json({ error: "Couldn't draft the document — try again in a moment." }, { status: 502 });
    }
};
