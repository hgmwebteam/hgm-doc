import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import {
    NOT_CONFIGURED,
    blankIfPlaceholder,
    callerEmail,
    isDashboardSlug,
    isTeamEmail,
    readAuthEnv,
    readClientSources,
    readEnv,
    sourceBlocks,
} from "../lib/client-sources.mts";

/**
 * Drafts ONE group of a client's Overview Document from what they have already told us.
 *
 * Reads both client-input forms — the Onboarding Form (client_onboarding_pages) and the
 * Brand Vision Form (host_onboarding_pages) — plus any transcripts we've already made of
 * their recorded answers, and returns that group's fields.
 *
 * GROUPED, for the same reason the Master Document is (see generate-master-section.mts). The
 * original shape here was one call for all twenty fields, with a comment claiming it "fits a
 * regular function's ~10s budget". It does not: twenty fields of prose is more output than
 * any single Master Document group, the model thinks before it answers on top of that, and a
 * regular Netlify function is killed at ~10 seconds. The call ran long every time and
 * the AM got a retry message that retrying could never fix.
 *
 * So the work is cut into three groups the dashboard loops. `basics` is near-pure extraction
 * and runs at low effort; the two prose groups run at medium. A group that fails leaves the
 * other two landed.
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

/**
 * The three groups, and their budgets.
 *
 * `maxTokens` has to cover thinking as well as the answer — Fable 5 always thinks, with no
 * way to turn it off, and it spends from the same allowance. These are sized like the Master
 * Document's groups: generous enough that the tool call can't be cut off mid-field. Effort is
 * the only lever left, so a group that starts reporting "ran past its token budget" wants a
 * bigger allowance here rather than a retry.
 */
type Effort = "low" | "medium";
const GROUPS: Record<string, { keys: string[]; maxTokens: number; effort: Effort; instruction: string }> = {
    basics: {
        keys: ["client_name", "business_name", "email", "business_type", "locations", "instagram", "tiktok", "direct_booking_website", "airbnb"],
        maxTokens: 2000,
        // Extraction, not writing: the answers are already on the page in the words we want.
        effort: "low",
        instruction: "Record who this client is and where to find them. Copy their own answers; do not rewrite them.",
    },
    goals: {
        keys: ["short_term_goals", "long_term_goals", "success_metrics", "target_audience", "unique_selling_points"],
        maxTokens: 3500,
        effort: "medium",
        instruction: "Draft what this client wants and who they want it from.",
    },
    brand: {
        keys: ["branding", "competitor_inspiration", "market_insights", "communication_style", "concerns", "other_notes"],
        maxTokens: 4000,
        effort: "medium",
        instruction: "Draft how this client presents themselves and how they want to be handled.",
    },
};

const SYSTEM_PROMPT = `You draft internal client briefs for HiddenGem Media, a marketing agency for short-term rental and boutique hospitality businesses.

You are given everything a new client has told us: their onboarding form, their brand vision form, and transcripts of any answers they recorded rather than typed. Turn it into the account manager's working brief. You are drafting one part of that brief at a time; fill only the fields you are asked for.

The single rule that matters: every field must come from what the client actually said. This brief is what the account manager will act on, so a plausible invention is worse than a blank. If the source material doesn't cover a field, return an empty string for it. Do not infer a business type from a business name, do not guess a location from an area code, and do not fill "competitor inspiration" with well-known brands the client never mentioned.

Write in plain, specific prose, not marketing language — this is read by a colleague, not the client. Prefer the client's own words for anything about their voice or positioning. Keep each field to a few sentences; the brief is scanned, not studied.

Handles keep their @. URLs stay as the client gave them.

A key ending in "__user" is the account NAME the client uses on that platform — "instagramLogin__user" is their Instagram account name, "tiktokLogin__user" their TikTok one. Use those to fill the matching platform fields. Passwords are deliberately not given to you; never ask for one, never guess one, and never put one in a field.`;

/**
 * What actually went wrong, in a sentence an AM can act on.
 *
 * The previous version answered every failure with "try again in a moment", which is true of
 * roughly one cause and useless for the rest — a rejected key, an exhausted quota and a
 * malformed request all read the same, and the only real explanation sat in a Netlify log
 * nobody was going to open. API error text never contains the key, so it is safe to pass on.
 */
const explain = (err: unknown): string => {
    if (err instanceof Anthropic.AuthenticationError) return "Anthropic rejected our API key — the web team needs to check ANTHROPIC_API_KEY in Netlify.";
    if (err instanceof Anthropic.RateLimitError) return "Anthropic is rate-limiting us right now — wait a minute and try again.";
    if (err instanceof Anthropic.APIError) {
        /* err.message on a 4xx is the whole response body, braces and request id included.
           The parsed body carries the same sentence on its own, so prefer it — the first real
           failure this reported put 200 characters of raw JSON in front of an AM. */
        const body = err.error as { error?: { message?: string } } | undefined;
        const detail = String(body?.error?.message ?? err.message).slice(0, 300);
        // Worth naming, because it is the one API failure the web team fixes somewhere else
        // entirely and no amount of retrying or redeploying touches.
        if (/credit balance is too low/i.test(detail)) {
            return "The Anthropic account is out of credits — top it up under Plans & Billing at console.anthropic.com, then try again.";
        }
        return `Anthropic returned ${err.status ?? "an error"}: ${detail}`;
    }
    if (err instanceof Error) return err.message.slice(0, 300);
    return "Couldn't draft this part — try again in a moment.";
};

export default async (req: Request) => {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

    // Team-only on the server, not just in the UI: this reads a client's private onboarding
    // answers and spends money on a model call, and the button that calls it lives in a
    // JavaScript bundle anyone can read. Matches generate-master-section and generate-brand-kit.
    const auth = readAuthEnv();
    if (!auth) return Response.json({ error: NOT_CONFIGURED }, { status: 500 });
    if (!isTeamEmail(await callerEmail(req, auth.supabaseUrl, auth.anonKey))) {
        return Response.json({ error: "Team sign-in required." }, { status: 401 });
    }

    const env = readEnv();
    if (!env) return Response.json({ error: NOT_CONFIGURED }, { status: 500 });

    let slug: string;
    let group: string;
    try {
        const body = await req.json();
        slug = String(body.slug ?? "").trim();
        group = String(body.group ?? "").trim();
    } catch {
        return Response.json({ error: "Bad request." }, { status: 400 });
    }
    if (!isDashboardSlug(slug)) return Response.json({ error: "Bad slug." }, { status: 400 });
    const spec = GROUPS[group];
    if (!spec) return Response.json({ error: "Unknown group." }, { status: 400 });

    try {
        const supabaseAdmin = createClient(env.supabaseUrl, env.serviceKey);
        const sources = await readClientSources(supabaseAdmin, slug);

        if (!sources.hasAny) {
            return Response.json({ error: "There's nothing to draft from yet — this client hasn't submitted either form." }, { status: 400 });
        }

        const tool: Anthropic.Tool = {
            name: "client_overview",
            description: "Record this part of the Client Overview Document, drafted from the client's own answers.",
            input_schema: {
                type: "object",
                properties: Object.fromEntries(spec.keys.map((key) => [key, { type: "string", description: FIELDS[key] }])),
                required: spec.keys,
            },
        };

        const anthropic = new Anthropic({ apiKey: env.apiKey });
        const message = await anthropic.messages.create({
            model: MODEL,
            max_tokens: spec.maxTokens,
            output_config: { effort: spec.effort },
            system: SYSTEM_PROMPT,
            tools: [tool],
            tool_choice: { type: "tool", name: tool.name },
            messages: [{ role: "user", content: `${sourceBlocks(sources)}\n\n${spec.instruction}` }],
        });

        const block = message.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
        if (!block) {
            console.error(`[generate-overview] ${group}: no tool_use block`, message.stop_reason);
            // Worth naming separately: this is the shape a too-small budget fails in, and it
            // is fixed by raising maxTokens above, not by the AM clicking again.
            const why = message.stop_reason === "max_tokens" ? "the draft ran past its token budget" : "the draft came back in an unexpected shape";
            return Response.json({ error: `Couldn't draft this part — ${why}.` }, { status: 502 });
        }

        // Only fields this group owns are passed on. If the schema and the form drift apart,
        // the extra keys are dropped here rather than saved into the row forever.
        const raw = block.input as Record<string, unknown>;
        const doc = Object.fromEntries(spec.keys.map((k) => [k, blankIfPlaceholder(String(raw[k] ?? ""))]));

        // Literal form answers don't need a model — copy them verbatim when the model left
        // the field blank. The model is (rightly) told never to guess, so it skips e.g.
        // "direct_booking_website" when the form only says "Website URL"; the client's own
        // typed answer is always the better value for these.
        const literal = (docKey: string, formKey: string) => {
            if (docKey in doc && !String(doc[docKey] ?? "").trim()) doc[docKey] = String(sources.intakeAnswers[formKey] ?? "").trim();
        };
        literal("direct_booking_website", "websiteUrl");
        literal("email", "email");
        // The client's answer to "Link to Your Airbnb Profile" — kept even when it's
        // actually an Expedia/VRBO link, because it's the listing they chose to give us.
        literal("airbnb", "airbnbUrl");
        // Public @handles from the login steps (asked since 2026-08-24).
        literal("instagram", "instagramLogin__handle");
        literal("tiktok", "tiktokLogin__handle");

        return Response.json({ group, doc, sources: { intake: !!sources.intakeText, brandVision: !!sources.visionText, recordings: !!sources.spokenText } });
    } catch (err) {
        console.error(`[generate-overview] ${group}`, err);
        return Response.json({ error: explain(err) }, { status: 502 });
    }
};
