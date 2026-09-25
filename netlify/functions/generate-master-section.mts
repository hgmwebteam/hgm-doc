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
    readWebsite,
    sourceBlocks,
} from "../lib/client-sources.mts";

/**
 * Drafts ONE group of the Master Brand Document from what the client has already told us.
 *
 * The Master Document is eleven sections and roughly 66 boxes, all typed by hand today. The
 * obvious design — one call that drafts all of it — does not fit: a regular Netlify function
 * is killed at ~10 seconds and a 66-field response takes far longer. Making it a background
 * function instead would drag in a status table, a migration, RLS and a polling state
 * machine (see generate-summary.mts for what that costs).
 *
 * So the work is cut into groups that each fit the synchronous budget, and the dashboard
 * loops them. That buys three things beyond just fitting: output too short to truncate,
 * better per-field quality because the model handles a handful of related fields instead of
 * sixty-six, and a failed group that leaves the others landed.
 *
 * The `site` group is the odd one out — no model call at all. It reads the client's website
 * once and hands the text back, so the groups that need it don't each re-fetch inside their
 * own 10s budget.
 *
 * It RETURNS fields rather than writing them. The dashboard merges them into unsaved state,
 * filling only empty boxes, so a draft can never overwrite what a person wrote and the AM
 * reviews everything before Save changes.
 */

const MODEL = "claude-fable-5";

/* ── the field groups ────────────────────────────────────────────────────── */

type Str = { type: "string"; description: string };
const str = (description: string): Str => ({ type: "string", description });

const PERSONA_PROPS = {
    name: str("A short label for the GROUP, not one individual, e.g. 'The Reconnectors' or 'Multi-Gen Family Organisers'."),
    rank: str("Either 'Primary' or 'Secondary'."),
    summary: str("Two or three sentences on who this person is and why they book this kind of stay."),
    age: str("An age range, e.g. '32-45'. Empty if the source gives no hint."),
    relationship: str("Relationship or group status, e.g. 'Couple, no kids' or 'Family with young children'."),
    location: str("Where they travel from — a city, region, or 'within a 3-hour drive'."),
    interests: str("What they're into, in a few comma-separated phrases."),
    painPoints: str("What frustrates them about booking or travelling — the problem this stay solves for them. Only what the source supports."),
    seeking: str("What they are actually looking for in a stay, in one or two sentences."),
    howTheyBook: str("How and when they book — where they first hear about a place, how long they research, lead time, and what decides it for them."),
    keywords: {
        type: "array",
        items: { type: "string" },
        description: "5-7 short search terms this persona would actually type. Empty array if the source gives nothing to work from.",
    },
};

const FOCUS_PROPS = {
    name: str("The property's own name as the site or listing calls it."),
    link: str("The listing or property page URL. MUST be copied verbatim from the allowed links given to you, or left empty."),
    location: str("Where this specific property is."),
    guests: str("Maximum guests, digits only, e.g. '8'."),
    bedrooms: str("Number of bedrooms, digits only."),
    beds: str("Number of beds, digits only."),
    bathrooms: str("Number of bathrooms, digits only, e.g. '2' or '2.5'."),
    description: str("The listing description, in the brand's own voice, 3-5 sentences."),
    features: str("Features and amenities, as a newline-separated list."),
    terms: str("House rules, check-in/out, pets, minimum stay — only what the source states."),
    reviews: { type: "array", items: { type: "string" }, description: "Up to 3 verbatim guest review quotes about THIS property. Empty array unless the source contains real quotes." },
};

/** Each group: which Foundation keys it fills, the tool that shapes them, and the brief. */
const GROUPS: Record<
    string,
    { keys: string[]; needsSite?: boolean; needsReviews?: boolean; maxTokens: number; instruction: string; properties: Record<string, unknown> }
> = {
    hosts: {
        keys: ["hosts", "exactLocation", "proximityCities", "proximityAirports"],
        maxTokens: 1600,
        instruction:
            "Draft the 'About the hosts' and 'Location' sections. The hosts field is the story of who they are and how they came to hosting — lean on their own About Us story and anything they said about why they created the property. Location fields are factual: where the properties actually are, and how far from the cities and airports guests fly into. Only state a distance the source gives you.",
        properties: {
            hosts: str("Who the hosts are, how they came to hosting, what they care about. 4-8 sentences in their own register."),
            exactLocation: str("The precise location — town, region, state."),
            proximityCities: str("Distance or drive time to the popular cities guests come from."),
            proximityAirports: str("Nearest airports and how far they are."),
        },
    },
    properties: {
        keys: ["propertyType", "structure", "generalAmenities", "sharedAmenities"],
        needsSite: true,
        maxTokens: 1800,
        instruction:
            "Draft the 'About the properties' section from the website text and the forms. This is about the portfolio as a whole, not one listing. Amenities should be concrete lists, not adjectives.",
        properties: {
            propertyType: str("What kind of properties these are — 'cabins', 'beach houses', 'boutique hotel suites'."),
            structure: str("How the portfolio is arranged — how many units, whether they sit on one site, how they differ."),
            generalAmenities: str("Amenities each property has, as a newline-separated list."),
            sharedAmenities: str("Shared or resort-wide amenities, as a newline-separated list. Empty if the properties are standalone."),
        },
    },
    brand: {
        keys: ["targetAudience", "uvp"],
        maxTokens: 1600,
        instruction: `Draft the audience and unique value proposition sections — 4 and 5 of the document.

Target audience: who actually books this place and why those people specifically. The segment as a whole, what they value, what they'll pay for, the occasions they book for, where they travel from, and what they're getting away from. The Brand Vision form's ideal-guest and experience-type answers are the spine; the onboarding form and the recorded answers fill in the rest, and any guest reviews you were given show who actually turns up and what they came for. One continuous block of prose — the Personas section carries the breakdown, so don't start listing personas here.

Unique value proposition: three or four things this property has that comparable ones don't. Each gets a short headline on its own line, then one sentence on what it means in practice and one on why it matters to the audience above, with a blank line between them. Concrete beats superlative — "1,500 feet of private river frontage" is a UVP, "stunning natural beauty" is not. Every claim has to be provable from the source; three real ones beat four with an invention in it.

Both sections are normally written by the account manager, so this is a starting draft they will rewrite — be specific enough to react to.`,
        properties: {
            targetAudience: str(
                "Who books with them and why those people specifically — the segment, what they value, what they come here for. 5-8 sentences of continuous prose.",
            ),
            uvp: str(
                "Three or four unique value propositions. Each: a short headline on its own line, then one sentence on what it means in practice and one on why it matters to this audience. Blank line between them.",
            ),
        },
    },
    voice: {
        keys: ["brandVoice", "taglines", "brandBio"],
        maxTokens: 1800,
        instruction: `Draft 'About the brand' — section 6. The Brand Vision form asks these almost directly: how the property would talk if it were a person, the tone they picked, their three words, what they want to be known for, and how they finished "we want to help guests ___". Use their own words wherever they gave you any.

Brand voice: four to six traits, one per line, each a word or a short phrase, none of them contradicting another. Then a blank line and two or three sentences on how that voice shows up in practice — a booking confirmation, a welcome note, a thank-you — and what it never sounds like.

Taglines: consider a wide set, then return only the three strongest, best first. The first one is used on its own on the site and in the Instagram bio, so it has to carry the brand by itself. Three to five words each, built from the feeling the client described. Nothing in the "Home Away From Home" / "Escape to Paradise" family.

Brand bio: the About-page paragraph. Third person, 150-200 words, a story rather than a list of features — why they created the place, how their approach differs, what a guest leaves with. End on an invitation, not a sales line.

All three are normally written by the account manager, so this is a starting draft they will rewrite — be specific enough to react to.`,
        properties: {
            brandVoice: str(
                "Four to six voice traits, one per line. Then a blank line and 2-3 sentences on how the voice comes through and what it never sounds like.",
            ),
            taglines: {
                type: "array",
                items: { type: "string" },
                description: "Exactly three taglines, strongest first — the first is used on its own as the headline tagline. 3-5 words each.",
            },
            brandBio: str(
                "The brand bio: third person, 150-200 words, a story that ends on an invitation. Empty if the source gives nothing to build one from.",
            ),
        },
    },
    personas: {
        keys: ["personas", "personaResonance"],
        maxTokens: 3500,
        instruction: `Draft two guest personas — one Primary, one Secondary — from what the client said about their ideal guest and their market, plus whatever the recorded answers and any guest reviews you were given reveal about who actually turns up. Make them specific enough to write an ad against: a real occasion, a real objection, a real booking habit. Name each one as a group rather than as a person.

Then say why this brand resonates with these two specifically — tie the property's actual offerings to what these people are short of.

Do not invent a demographic the source contradicts; leave a field empty rather than guessing.`,
        properties: {
            personas: {
                type: "array",
                items: { type: "object", properties: PERSONA_PROPS, required: Object.keys(PERSONA_PROPS) },
                description: "Exactly two personas: the first ranked 'Primary', the second 'Secondary'.",
            },
            personaResonance: str(
                "Why this brand resonates with these people specifically — the property's actual offerings against what these personas are short of. 3-4 sentences.",
            ),
        },
    },
    focus: {
        keys: ["focusProperties"],
        needsSite: true,
        maxTokens: 3500,
        instruction:
            "Draft the focus properties — the individual stays, one entry each, from the website text. Only include properties the source actually names. The `link` field must be copied verbatim from the allowed links or left empty; never construct a URL.",
        properties: {
            focusProperties: {
                type: "array",
                items: { type: "object", properties: FOCUS_PROPS, required: Object.keys(FOCUS_PROPS) },
                description: "One entry per property the source names, up to 4. Empty array if the source names none.",
            },
        },
    },
    favorites: {
        keys: ["restaurants", "activities"],
        maxTokens: 2000,
        instruction:
            "Split the client's local recommendations into rows. They typed these as free text in the onboarding form, often as 'Name — https://…'; keep their names exactly and carry each place's website address through verbatim. Do not add places they didn't mention, and never invent or guess a URL — an empty description is fine.",
        properties: {
            restaurants: {
                type: "array",
                items: { type: "object", properties: { name: str("The restaurant or café name, exactly as the client wrote it."), description: str("The website address the client gave for it, exactly as written. If they gave no link, one line on why they recommend it. Empty if neither.") }, required: ["name", "description"] },
                description: "One row per restaurant or café the client named. Empty array if they named none.",
            },
            activities: {
                type: "array",
                items: { type: "object", properties: { name: str("The activity or attraction name, exactly as the client wrote it."), description: str("The website address the client gave for it, exactly as written. If they gave no link, one line on why they recommend it. Empty if neither.") }, required: ["name", "description"] },
                description: "One row per activity or attraction the client named. Empty array if they named none.",
            },
        },
    },
    reviews: {
        keys: ["corePillars", "emotionalThemes"],
        needsReviews: true,
        maxTokens: 2000,
        instruction: `Analyse the pasted guest reviews as a hospitality marketing analyst.

For core brand pillars: the 5-7 amenities, property features or design elements guests praise most often. Where a pillar has a striking line in the reviews, quote it verbatim underneath — that raw language is what social hooks and subject lines get built from.

For emotional themes: the 5-7 emotional or experiential themes guests use to describe their stay ("peaceful escape", "perfect for families", "attention to detail"). These are the emotional heart of the brand.

Both as newline-separated lists. Base every line on the reviews in front of you — a pillar nobody mentioned is worse than a short list.`,
        properties: {
            corePillars: str("Core brand pillars and key selling points, as a newline-separated list, with verbatim guest quotes where they land."),
            emotionalThemes: str("Emotional and experiential themes, as a newline-separated list."),
        },
    },
};

const SYSTEM_PROMPT = `You draft the Master Brand Document for HiddenGem Media, a marketing agency for short-term rental and boutique hospitality businesses.

This document is the source everything downstream reads from — welcome emails, the chat widget, the website copy — so it is the one place a confident invention does the most damage.

The single rule that matters: every field must come from what the client actually said or what their own website says. If the source material doesn't cover a field, return an empty string (or an empty array) for it. A blank an account manager fills in later is a small cost; a plausible invention that nobody catches gets copied into a client's live marketing. Do not infer a property type from a business name, do not guess a location from an area code, and do not add amenities that "places like this usually have".

Use everything you are given, in this order of authority:

1. THE TWO FORMS — the onboarding form and the Brand Vision form. This is the client stating what they want, so it is the source of truth for anything about intent, positioning, audience or voice, and it wins any disagreement.
2. RECORDED ANSWERS — the same client's own words, spoken. Equal in authority to the forms and usually far richer, so prefer a specific detail from a recording over a general one from a checkbox. Where a recording contradicts a form answer outright, the form wins.
3. THE WEBSITE — their published copy. Authoritative for facts about the properties (names, amenities, rules, counts) and useful for register, but it can be out of date, so a form answer beats it wherever the two disagree.
4. GUEST REVIEWS — other people's words, not the client's. Best evidence for what guests actually value and the language they use for it, and the only place quotes may come from. Never state a review's opinion as the brand's own claim.

Where the sources genuinely conflict on something that matters, follow the order above and say so plainly in the field rather than blending them into a claim nobody made.

Never construct a URL. Links come only from the allowed list you are given, copied character for character, or not at all.

Write plain, specific prose in the brand's own register — this becomes client-facing copy, so prefer the client's own words for anything about their voice or positioning. No marketing filler, no "nestled", no "whether you're".

A key ending in "__user" is the account NAME the client uses on that platform, not a login. Passwords are deliberately not given to you; never ask for one and never put one in a field.`;

/* ── shaping the reply ───────────────────────────────────────────────────── */

/** Scrub every string in the tool output, at any depth, and drop rows that came back bare. */
function clean(value: unknown): unknown {
    if (typeof value === "string") return blankIfPlaceholder(value);
    if (Array.isArray(value)) {
        return value
            .map(clean)
            .filter((v) => (typeof v === "string" ? v : v && typeof v === "object" ? Object.values(v).some((x) => (Array.isArray(x) ? x.length : x)) : v));
    }
    if (value && typeof value === "object") {
        return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, clean(v)]));
    }
    return value;
}

export default async (req: Request) => {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

    // The button is team-only in the UI, but the UI is a JavaScript bundle anyone can read.
    // This is the check that actually holds — and it is here from the first commit rather
    // than added after the endpoint has been public for a while. It runs BEFORE the
    // service-key check below so rejecting a stranger needs no secret at all.
    const auth = readAuthEnv();
    if (!auth) return Response.json({ error: NOT_CONFIGURED }, { status: 500 });
    const email = await callerEmail(req, auth.supabaseUrl, auth.anonKey);
    if (!isTeamEmail(email)) return Response.json({ error: "Team sign-in required." }, { status: 401 });

    const env = readEnv();
    if (!env) return Response.json({ error: NOT_CONFIGURED }, { status: 500 });

    let slug = "";
    let group = "";
    let siteText = "";
    let reviewsText = "";
    let allowedLinks: string[] = [];
    try {
        const body = await req.json();
        slug = String(body.slug ?? "").trim();
        group = String(body.group ?? "").trim();
        siteText = String(body.siteText ?? "").slice(0, 40_000);
        reviewsText = String(body.reviewsText ?? "").slice(0, 60_000);
        allowedLinks = Array.isArray(body.allowedLinks) ? body.allowedLinks.map(String).slice(0, 40) : [];
    } catch {
        return Response.json({ error: "Bad request." }, { status: 400 });
    }
    if (!isDashboardSlug(slug)) return Response.json({ error: "Bad slug." }, { status: 400 });

    const admin = createClient(env.supabaseUrl, env.serviceKey);

    /* The website read — no model, its own request, so the groups that need the text don't
       each spend their budget re-fetching the same pages. */
    if (group === "site") {
        const sources = await readClientSources(admin, slug);
        const url = sources.clientWebsite || String(sources.intakeAnswers.websiteUrl ?? "").trim();
        if (!url) {
            return Response.json({ error: "No website on file for this client — add one on the dashboard or in the onboarding form." }, { status: 400 });
        }
        try {
            const read = await readWebsite(url);
            return Response.json({ group, site: read.site, siteText: read.text, links: read.links });
        } catch (err) {
            return Response.json({ error: (err as Error).message }, { status: 502 });
        }
    }

    const spec = GROUPS[group];
    if (!spec) return Response.json({ error: "Unknown section group." }, { status: 400 });

    // publicCopy: this document feeds what guests read, so team-only answers stay out.
    const sources = await readClientSources(admin, slug, { publicCopy: true });
    if (!sources.hasAny && !siteText && !reviewsText) {
        return Response.json({ error: "There's nothing to draft from yet — this client hasn't submitted either form." }, { status: 400 });
    }
    if (spec.needsReviews && !reviewsText.trim()) {
        return Response.json({ error: "Paste the guest reviews first — this section is drafted from them." }, { status: 400 });
    }
    if (spec.needsSite && !siteText.trim()) {
        return Response.json({ error: "The website hasn't been read yet." }, { status: 400 });
    }

    const airbnb = String(sources.intakeAnswers.airbnbUrl ?? "").trim();
    const links = [...new Set([...allowedLinks, airbnb].filter(Boolean))];

    const parts = [
        sourceBlocks(sources),
        siteText.trim() && `--- THE CLIENT'S WEBSITE ---\n${siteText.trim()}`,
        reviewsText.trim() && `--- GUEST REVIEWS (pasted by the account manager) ---\n${reviewsText.trim()}`,
        links.length && `--- ALLOWED LINKS (the only URLs you may use, copy verbatim) ---\n${links.join("\n")}`,
    ].filter(Boolean);

    try {
        const anthropic = new Anthropic({ apiKey: env.apiKey });
        const tool: Anthropic.Tool = {
            name: "master_document_section",
            description: "Record the drafted fields for this part of the Master Brand Document.",
            input_schema: { type: "object", properties: spec.properties as never, required: Object.keys(spec.properties) },
        };

        const message = await anthropic.messages.create({
            model: MODEL,
            max_tokens: spec.maxTokens,
            system: SYSTEM_PROMPT,
            tools: [tool],
            tool_choice: { type: "tool", name: tool.name },
            messages: [{ role: "user", content: `${parts.join("\n\n")}\n\n${spec.instruction}` }],
        });

        const block = message.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
        if (!block) {
            console.error(`[generate-master-section] ${group}: no tool_use block`, message.stop_reason);
            return Response.json({ error: "The draft came back in an unexpected shape — try again." }, { status: 502 });
        }

        const raw = clean(block.input as Record<string, unknown>) as Record<string, unknown>;
        // Only the keys this group owns are passed on, so a schema that drifts from the
        // document can't smuggle an unknown field into a client's row forever.
        const fields: Record<string, unknown> = {};
        for (const k of spec.keys) if (k in raw) fields[k] = raw[k];

        // A model-built URL is worse than a blank one (see internalLinks). Anything not in
        // the allowed list is dropped, whatever the prompt said.
        if (Array.isArray(fields.focusProperties)) {
            const ok = new Set(links.map((l) => l.replace(/\/+$/, "")));
            fields.focusProperties = (fields.focusProperties as { link?: string }[]).map((p) => ({
                ...p,
                link: p.link && ok.has(String(p.link).replace(/\/+$/, "")) ? p.link : "",
            }));
        }

        return Response.json({ group, fields });
    } catch (err) {
        console.error(`[generate-master-section] ${group}`, err);
        return Response.json({ error: "Couldn't draft this section — try again in a moment." }, { status: 502 });
    }
};
