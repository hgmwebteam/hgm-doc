import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (import.meta.env.DEV && (!supabaseUrl || !supabaseAnonKey)) {
    console.warn("[HGM Docs] Supabase env vars not set. Copy .env.example to .env.local and add your credentials.");
}

// Fall back to a syntactically-valid placeholder when env vars are missing (e.g. a
// fresh local checkout with no .env.local). createClient throws on an empty URL,
// which — now that the client is imported at the app root — would blank every page.
// With a placeholder the app still renders; auth calls simply resolve to no session.
const FALLBACK_URL = "https://placeholder.supabase.co";
const FALLBACK_KEY = "placeholder-anon-key";

export const supabase = createClient(supabaseUrl || FALLBACK_URL, supabaseAnonKey || FALLBACK_KEY, {
    // persistSession + detectSessionInUrl are required for the dashboard Google OAuth
    // gate so the session survives the redirect back from Google.
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export interface ClientPageData {
    slug: string;
    client_name: string;
    client_website: string;
    pixel_code: string;
    starred?: boolean;
}

export interface OverviewCard {
    id: string;
    department: string;
    tab?: string;
    title: string;
    description: string;
    link: string;
    cover_url?: string;
    starred?: boolean;
    locked?: boolean; // protected card — only the owner can delete it
    created_at?: string;
}

/** A client record shown on the dashboard "Clients" (Client List) page. */
export interface ClientRecord {
    id: string;
    name: string;
    tier: string; // tier-0 | tier-1 | tier-2
    am: string; // account manager name
    location: string;
    cover_url?: string;
    logo_url?: string; // client brand logo shown on the card (separate from cover)
    handle?: string; // Instagram-style handle shown under the name on the client card (stored without the @)
    link?: string; // optional link to their dashboard / any page
    starred?: boolean;
    created_at?: string;
    /** Homepage (Mission Control) fields — see migration 20260712090000. */
    status?: string; // existing | onboarding | offboarding (missing = existing)
    onboarding_phase?: number | null; // 0–5, only meaningful while onboarding
    web_project?: string; // website project name (set = Web Team has it in flight)
    web_manager?: string; // Web Team member managing that project
    marketing_assistant?: string; // MA paired with the AM on this client
    /** When set, only this team email sees the client anywhere in the UI
        (private/test clients — e.g. HGM TEST). See filterPrivateClients(). */
    private_to?: string | null;
}

/** Hide private clients (private_to set) from everyone except that email.
 *  Apply wherever the clients roster is listed (Client List, /home, …). */
export function filterPrivateClients<T extends { private_to?: string | null }>(rows: T[], viewerEmail?: string | null): T[] {
    const email = (viewerEmail ?? "").trim().toLowerCase();
    return rows.filter((r) => !r.private_to || r.private_to.trim().toLowerCase() === email);
}

/** An entry in the private Prompt & Pattern Library (/prompt-library). */
export interface PromptLibraryEntry {
    id: string;
    title: string;
    type: "prompt" | "pattern";
    category: string;
    body: string;
    when_to_use: string;
    tags: string[];
    created_at?: string;
    updated_at?: string;
}

export interface OverviewTab {
    id: string;
    department: string;
    label: string;
    created_at?: string;
}

export interface OwnerGuideMeta {
    slug: string;
    client_name: string;
    share_password?: string;
    created_at?: string;
    /** credSections hidden from this specific client's guide (e.g. they don't use
        Cloudflare) — never affects the shared master template or other clients. */
    hidden_steps?: string[];
}

export interface DocsRequest {
    id: string;
    requester: string;
    title: string;
    request_for: string; // clients | webteam | am | ma
    priority: string; // low | medium | high | urgent
    details?: string;
    status?: string; // open | done
    created_at?: string;
}

/**
 * The Client Overview Document — an internal brief the account manager works from.
 *
 * TEAM ONLY. This is our reading of the client, not the client's own words: it carries
 * competitor notes, market read and account-handling remarks that would be awkward at best
 * shown back to the person they describe. The dashboard never renders it for a client and
 * never offers to reveal it, unlike every other section.
 *
 * Kept flat and all-strings on purpose. Every field is either typed by an AM or written by
 * the model from the client's onboarding answers, and a flat shape means the tool schema
 * the model fills, the form on screen, and the row in Supabase are the same shape.
 */
export interface OverviewDocProperty {
    id: string;
    name: string;
    link: string;
}

export interface OverviewDoc {
    // Client information
    client_name: string;
    business_name: string;
    email: string;
    business_type: string;
    locations: string;
    // Platforms
    instagram: string;
    tiktok: string;
    direct_booking_website: string;
    airbnb: string;
    // Properties (repeatable — not counted in the 26 fields)
    properties: OverviewDocProperty[];
    // Business goals & objectives
    short_term_goals: string;
    long_term_goals: string;
    success_metrics: string;
    // Brand & positioning
    target_audience: string;
    unique_selling_points: string;
    branding: string;
    competitor_inspiration: string;
    market_insights: string;
    // Client preferences & notes
    communication_style: string;
    concerns: string;
    other_notes: string;
    // Baseline snapshot, recorded at kickoff
    instagram_followers: string;
    facebook_followers: string;
    tiktok_followers: string;
    email_list_size: string;
    direct_booking_split: string;
    /** Compressed WebP data URL — see compressImageFile(). */
    instagram_screenshot: string;
    /** Set when the model last wrote this, so an AM can tell drafted-by-AI from typed-by-hand. */
    generated_at?: string;
    generated_by?: string;
}

/** Section content for per-client dashboards (dashboard_pages.data jsonb). */
export interface DashboardContent {
    status: string; // Onboarding | Active | Paused
    logo_url: string;
    /** Side-menu background image (client dashboard). Empty string = the default solid color. */
    sidebar_bg_url: string;
    brand: {
        colors: { name: string; hex: string }[];
        fonts: string;
        folder_link: string;
        /** Logo files the AM uploads — SVG stays vector (compressImageFile passes it
         *  through), raster is compressed to WebP. Optional: older rows predate it. */
        logos?: { id: string; name: string; url: string }[];
        /** Uploaded font files (data URLs), one per role. When set, the upload overrides
         *  the typed name for that role. Optional: older rows predate it. */
        font_files?: { heading?: { name: string; url: string }; body?: { name: string; url: string } };
    };
    instagram: {
        profile_url: string;
        highlights: { title: string; image_url: string }[];
    };
    ghl: {
        login_url: string;
        items: { label: string; done: boolean }[];
    };
    revenue: {
        currency: string;
        months: { month: string; revenue: number; leads: number; appointments: number }[];
    };
    links: { title: string; description: string; url: string }[];
    videos?: { id: string; title: string; url: string }[]; // Video guides (Loom link or uploaded mp4) — optional so older rows load unchanged
    /** Marketing → Example Reels: three fixed phone-mockup slots. `url` is a public
     *  `videos`-bucket file (never base64 — reels are tens of MB). The description doubles
     *  as the text alternative for a silent loop. Optional: older rows predate it. */
    reels?: { id: string; title: string; description: string; url: string }[];
    /**
     * The Pinned Posts the team designs for the client's Instagram grid — up to three
     * carousels, each a Canva design exported page by page. Slide images are compressed
     * WebP data URLs (see compressImageFile), first slide = the grid tile. `canva_url` is
     * the design the AM pasted, kept so the team can jump straight back to editing it.
     * Client feedback and approvals live in dashboard_suggestions under the
     * `pinnedposts.{postId}.*` keys, never in this row. Optional: older rows predate it.
     */
    pinned_posts?: {
        canva_url: string;
        /** Instagram handle shown on the phone mockup, without the "@". */
        handle: string;
        posts: { id: string; title: string; caption: string; slides: { id: string; url: string }[] }[];
    };
    /** AM-added rows in the side menu's Resources group (e.g. a Claude project link).
     *  `hidden` keeps a row team-only — new rows start hidden so nothing internal
     *  leaks to a client by default. Optional: older rows predate it. */
    resources?: { id: string; label: string; url: string; hidden?: boolean }[];
    /** This client's Google Chat room, offered by the "Add your resources" journey step.
     *  Empty renders that line with no button. Optional: older rows predate it. */
    chat_link?: string;
    /** Booking page for the Onboarding Call, offered by that journey step. Per-client
     *  rather than a shared constant because it is the client's own Account Manager's
     *  Calendly — one hardcoded URL would route every client to the same person. Empty
     *  renders the step without a booking button. Optional: older rows predate it. */
    onboarding_call_url?: string;
    /** The Master Brand Document — the Foundation feeding the funnel. Optional so older
     * dashboard rows (saved before this section existed) still load unchanged.
     *
     * v2 (the eleven-section brand document) is the live shape. The v1 fields below it are
     * DEPRECATED but still declared, and mergeContent still round-trips them: rows written
     * before the redesign hold real client answers in those keys, and dropping them from the
     * type would mean the next save silently wrote them out of existence. They are read-only
     * now, surfaced to the team through the "Earlier Master Document" panel so nothing a
     * client typed becomes invisible. Delete them only after the rows have been migrated. */
    foundation?: {
        /* ── v2 — Master Brand Document ── */
        hosts: string;
        propertyType: string;
        structure: string;
        generalAmenities: string;
        sharedAmenities: string;
        exactLocation: string;
        proximityCities: string;
        proximityAirports: string;
        targetAudience: string;
        uvp: string;
        brandVoice: string;
        /** Three tagline slots — fixed length so the numbered 01/02/03 rail stays stable. */
        taglines: string[];
        brandBio: string;
        personas: {
            id: string;
            name: string;
            summary: string;
            /** "Primary" | "Secondary" | free text — an AM may rank more than two. */
            rank: string;
            age: string;
            relationship: string;
            location: string;
            interests: string;
            painPoints: string;
            seeking: string;
            howTheyBook: string;
            keywords: string[];
        }[];
        /** The paragraph an AM reads out when presenting the personas back. */
        personaResonance: string;
        focusProperties: {
            id: string;
            name: string;
            link: string;
            location: string;
            guests: string;
            bedrooms: string;
            beds: string;
            bathrooms: string;
            description: string;
            features: string;
            terms: string;
            reviews: string[];
        }[];
        restaurants: { id: string; name: string; description: string }[];
        activities: { id: string; name: string; description: string }[];
        corePillars: string;
        emotionalThemes: string;
        /** The team collapses the ChatGPT/Gemini working prompt once the insight is pasted in. */
        promptHidden: boolean;
        websiteLinks: { id: string; page: string; url: string }[];

        /* ── v1 — DEPRECATED, preserved for migration. See the note above. ── */
        propertyBasics?: string;
        persona?: string;
        toneOfVoice?: string;
        amenities?: string;
        localRecommendations?: string;
        bookingLinks?: string;
        faqs?: { id: string; question: string; answer: string }[];
    };
    /** Side-menu sections this client is allowed to see (an allowlist of SectionId).
     *  The team always sees every section; a client only sees what an AM has revealed
     *  with the eye toggle in edit mode, so nothing half-built is presented as finished.
     *  Absent (older rows) falls back to the intake forms only — see
     *  DEFAULT_CLIENT_VISIBLE in client-dashboard-page.tsx. Typed as string[] rather
     *  than SectionId to keep this module free of page imports. */
    client_visible?: string[];
    /** Journey steps an AM has ticked off (JourneyStepId values). Only the steps that
     *  can't be derived live here — the two form steps read their real answer counts
     *  instead, so a tick can never disagree with what the dashboard shows. */
    journey_done?: string[];
    /**
     * Emails allowed to open this client's dashboard, entered by the AM.
     *
     * Signing in proves identity; this list grants access. Anyone with a Google account
     * can authenticate, so the check is always "is this address on THIS row's list", never
     * merely "is this person signed in".
     *
     * Currently enforced in the UI only. Real enforcement needs the read-gating RLS policy
     * that reads this same field — until that lands, the row is still fetchable with the
     * public anon key.
     */
    allowed_emails?: string[];
    /**
     * The access list proper: one row per person, each with their own password and their
     * own set of sections. `allowed_emails` above is the derived mirror of the addresses
     * here, kept in step on every write because the Netlify suggestion function and the
     * read-gating RLS policy to come both read that flatter key.
     *
     * Absent on rows written before per-person access existed — those upgrade on read from
     * `allowed_emails`, so an old row keeps behaving exactly as it did. Typed structurally
     * rather than as DashboardUser to keep this module free of page imports.
     */
    dashboard_users?: { email: string; password?: string; sections?: string[] | null }[];
    /**
     * Shared password the client types alongside their email to open this dashboard.
     *
     * Now the FALLBACK: a person with their own password uses theirs, and this covers
     * everyone who hasn't been given one. Clearing it is safe only once every listed
     * person has a password of their own.
     *
     * Same mechanism as owner_guides.share_password, which is already in production: the
     * value is compared in the browser, so it gates the UI rather than the data. Anyone who
     * can reach the row with the public anon key can also read this password. It stops a
     * shared link being forwarded around; it does not make the row private. That still needs
     * the read-gating RLS policy.
     */
    share_password?: string;
    /**
     * Background behind this client's sign-in card — an image or video URL. Empty falls back
     * to the shared leaf-shadow loop, so a client never lands on a bare page.
     */
    login_bg_url?: string;
    /** The team's internal Client Overview Document. Never rendered for a client — see OverviewDoc. */
    overview_doc?: Partial<OverviewDoc>;
    /**
     * The Website Setup Guide section — what the client has done towards hosting and, if they
     * opted in, the AI website. Written by the client through the website-setup function
     * (they are `anon`, so they can't write this row directly) and by the team through the
     * ordinary Save. Optional: older rows predate it. See WebsiteSetup for the rule on what
     * may live here.
     */
    website_setup?: WebsiteSetup;
}

/**
 * Website Setup Guide answers.
 *
 * NEVER a password or an API key. This row is readable with the public anon key (see
 * share_password above), so a secret stored here is a secret published. Account emails and
 * provider names only — the logins themselves are handed over in the client's own
 * password-gated owner guide (/owner-guide/{slug}), which is what the section links to.
 */
export interface WebsiteSetup {
    /** The email the client registered their Netlify account under. */
    netlify_email: string;
    /** The client has confirmed the Netlify account exists. Required for every client. */
    netlify_done: boolean;
    /** "" = not answered yet, "yes" = wants the AI website, "no" = declined for now. */
    ai_website: "" | "yes" | "no";
    /** Per-service account details for the AI website, keyed by WebsiteSetupAccountId. */
    accounts: Record<string, { value: string; done: boolean }>;
    /** The web address the site should live at. */
    domain: string;
    /** Anything else the client wants the web team to know. */
    notes: string;
    /** ISO time of the client's last save through the function; absent for team edits. */
    updated_at?: string;
}

export interface DashboardPageData {
    slug: string;
    client_name: string;
    client_website: string;
    data: Partial<DashboardContent> | null;
    created_at?: string;
}

/** A checkbox-group answer: the picked options plus free-text for "Other". */
export interface CheckboxAnswer {
    picked: string[];
    other: string;
}

/** Per-client Host Onboarding Form (host_onboarding_pages.data jsonb) — mirrors the
 * "Brand Vision Form" the team already sends new hosts via Google Forms, brought
 * in-app so answers land straight in the client's own dashboard ecosystem. */
export interface HostOnboardingData {
    email: string;
    businessName: string;
    // Section 2 — The WHY (Purpose)
    purpose: CheckboxAnswer;
    guestFeelings: CheckboxAnswer;
    // Section 3 — The HOW (Your Unique Approach)
    threeWords: string;
    differentiators: CheckboxAnswer;
    reviewMention: string;
    // Section 4 — The WHAT (Your Offering)
    idealGuest: CheckboxAnswer;
    experienceType: CheckboxAnswer;
    // Section 5 — Brand Personality & Voice
    personaVoice: CheckboxAnswer;
    tone: CheckboxAnswer;
    aesthetic: CheckboxAnswer;
    // Section 6 — Brand Ambition
    brandKnownFor: CheckboxAnswer;
    completeSentence: string;
    /** Optional personal-touch video intro (Loom/YouTube link or uploaded file) — never required. */
    video?: string;
    submittedAt?: string;
    /** Field key of the question the host was last on, so "Continue the form" resumes
        there instead of restarting at question 1. Stored as the field name rather than
        a step index so adding or reordering questions can't resume on the wrong screen. */
    lastField?: string;
    /** Voice / video answers, keyed by question field. Only the storage path is kept —
        the media itself lives in the private `recordings` bucket. A map rather than a
        field per question so enabling recording on another question needs no migration. */
    mediaAnswers?: Record<string, { path: string; kind: "audio" | "video" }>;
}

export interface HostOnboardingPageData {
    slug: string;
    client_name: string;
    client_website: string;
    data: Partial<HostOnboardingData> | null;
    created_at?: string;
}

export interface LeadCapturePageData {
    slug: string;
    client_name: string;
    client_website: string;
    popup_code: string;
    inline_form_code: string;
    promo_header: string;
    promo_desc: string;
    form_option?: string; // both | a | b — which Task-2 option(s) the client sees
    option_b_intro?: string; // Option B intro paragraph (editable; **bold** markers)
    option_b_steps?: string[]; // Option B step list (editable; **bold** markers)
    before_img_1?: string;
    after_img_1?: string;
    before_img_2?: string;
    after_img_2?: string;
    created_at?: string;
}
