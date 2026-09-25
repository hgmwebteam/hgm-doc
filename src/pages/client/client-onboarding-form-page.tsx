import { type ChangeEvent, type ReactNode, useEffect, useRef, useState } from "react";
import {
    AlertCircle,
    ArrowLeft,
    ArrowRight,
    Check,
    Eye,
    EyeOff,
    Heart,
    Lock01,
    Mail01,
    MarkerPin01,
    Microphone01,
    Palette,
    Plus,
    Receipt,
    Settings01,
    Star01,
    Target04,
    Users01,
    VideoRecorder,
    XClose,
} from "@untitledui/icons";
import { AnimatePresence, motion } from "motion/react";
import { Checkbox as AriaCheckbox, CheckboxGroup as AriaCheckboxGroup } from "react-aria-components";
import { MediaAnswer, type MediaKind, RecordingPlayer } from "@/components/application/media-answer";
import { supabase } from "@/lib/supabase";
import { KICKOFF_CALENDLY } from "@/pages/client/dashboard/dashboard-navigation";
import { cx } from "@/utils/cx";

/**
 * The two client-input forms, on one Typeform-style engine: one question per screen,
 * Enter to advance, autosave, review-of-answers after submit.
 *
 * - Onboarding Form (/{client}-onboarding) — the business and the brand. It absorbed the
 *   Brand Vision Form, which is now legacy; see ONBOARDING_SECTIONS.
 * - Account Access Form (/{client}-access) — logins and billing, split out because the
 *   person who holds the passwords is rarely the one who can describe the brand.
 *
 * Both persist to client_onboarding_pages, one row per form, keyed by slug. The final
 * step links the client to Dustin's Calendly for the Kick-Off Call.
 */

/* The Kick-off booking page is one URL, owned by dashboard-navigation.ts — the journey
   step and this form's thank-you screen both link it, and it used to be written out
   twice. Two copies of a booking URL is one wrong booking URL waiting to happen. */
const CALENDLY_URL = KICKOFF_CALENDLY;

/* ── Form content ── */

type Question = {
    field: string;
    label: string;
    hint?: string;
    required?: boolean;
    long?: boolean;
    placeholder?: string;
    email?: boolean;
    /** Shows a PDF-upload button under the field; the file's public URL is appended to the answer. */
    upload?: boolean;
    /** Renders two inputs (username + password, stored as {field}__user / {field}__pass) plus a trust note. */
    credentials?: boolean;
    /** How this login reads inside the "Worth having on hand" sentence. The field label is a
        heading ("Domain Host"), which is not how it reads mid-sentence; set this to override
        it. Which logins appear in the list is still derived from `credentials`, so the two
        cannot drift apart. */
    credentialLabel?: string;
    /** Adds a public-handle input above the login fields (stored as {field}__handle) —
        the @name guests see, distinct from the login username which is often an email. */
    handle?: { label: string; placeholder: string };
    /** Puts a platform picker above the login fields — chips for the common choices plus
        an "Other" free-text escape hatch — so "which system" and "the login for it" are
        one screen instead of two. The pick keeps its own field key (e.g. domainPlatform),
        so answers written before the two questions were merged still read back. */
    platform?: { field: string; label: string; options: string[]; otherPlaceholder?: string };
    /** Turns the answer into a repeatable set of rows instead of one free-text blob.
        For "list your top 4–6…" questions, a single textarea makes the host invent a
        format and leaves us parsing prose. Rows are stored as plain lines of text, so
        old free-text answers still read back and downstream consumers are unaffected. */
    list?: { itemPlaceholder: string; linkPlaceholder?: string; addLabel?: string; rows?: number };
    /** Multiple choice: pick any of `options` (up to `maxPick`), plus a free "Other". Stored
        as one picked option per line in the field, and the Other text in {field}__other. */
    choice?: { options: string[]; maxPick?: number };
};

/** The PMS pick that means there is no login to ask for. */
const NO_PMS = "No PMS";

/** One row of a list answer: a name plus an optional link. */
type ListRow = { text: string; link: string };

const URL_RE = /(https?:\/\/\S+|www\.\S+)/i;

/** Lines → rows. Handles both the "Name — link" we write and whatever a host typed
    before this question became a list (bullets, numbering and blank lines included). */
const parseRows = (value: string, min: number): ListRow[] => {
    const rows = value
        .split("\n")
        .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
        .filter(Boolean)
        .map((line) => {
            const [, sep] = line.split(/\s+—\s+/);
            if (sep !== undefined) {
                const i = line.indexOf(" — ");
                return { text: line.slice(0, i).trim(), link: line.slice(i + 3).trim() };
            }
            const m = line.match(URL_RE);
            if (m && m.index !== undefined) return { text: line.slice(0, m.index).trim(), link: m[0].trim() };
            return { text: line, link: "" };
        });
    while (rows.length < min) rows.push({ text: "", link: "" });
    return rows;
};

/** Rows → lines. Empty rows are dropped so trailing blanks never reach the answer. */
const serializeRows = (rows: ListRow[]) =>
    rows
        .filter((r) => r.text.trim() || r.link.trim())
        .map((r) => (r.link.trim() ? `${r.text.trim()} — ${r.link.trim()}` : r.text.trim()))
        .join("\n");
type SectionDef = { id: string; title: string; subtitle: string; icon: typeof Mail01; intro?: string; questions: Question[] };

/**
 * The Onboarding Form — one form for everything we need to know about the client's
 * business and brand. It merges what used to be two forms: this one and the Brand
 * Vision Form (host-onboarding-form-page.tsx, now legacy). Field keys are the ones
 * each question had in its old form, so answers already given still land here, and
 * the Master Brand Document and Client Overview drafts keep reading them.
 *
 * Deliberately short: anything the team can research itself (property type,
 * amenities, listings, follower counts) or ask on the Kick-Off Call is not asked.
 * Logins and billing are the separate Account Access form below.
 */
const ONBOARDING_SECTIONS: SectionDef[] = [
    {
        id: "basics",
        title: "The Basics",
        subtitle: "Who you are and where to find you",
        icon: Mail01,
        questions: [
            { field: "email", label: "Email", required: true, email: true, placeholder: "you@email.com" },
            { field: "businessName", label: "Business Name", required: true },
            { field: "websiteUrl", label: "Website URL", required: true, placeholder: "https://…" },
            {
                // Was "Business Address". The property's own address is what the brand and
                // listings need; billing asks for its own address on the Account Access form.
                field: "businessAddress",
                label: "Property Address",
                hint: "The address guests arrive at — street number & name, city, state and ZIP code.",
                required: true,
                long: true,
            },
            { field: "guestContactEmail", label: "Guest Contact Email", email: true, required: true, placeholder: "guests@yourbusiness.com" },
        ],
    },
    {
        id: "story",
        title: "Your Story",
        subtitle: "Where the property came from, and who you are",
        icon: Heart,
        questions: [
            {
                field: "purpose",
                label: "Why did you create this property? What's the deeper reason beyond income?",
                required: true,
                choice: {
                    options: [
                        "To reconnect people with nature",
                        "To offer escape from busy city life",
                        "To create meaningful family memories",
                        "To showcase sustainable living",
                        "To provide romantic getaways",
                        "To inspire adventure and exploration",
                        "To preserve/share a unique location",
                    ],
                },
            },
            {
                // Public: this is the raw material for the website's About Us. Its label and
                // hint say so, and share no wording with aboutYou below, so the two never
                // read as the same question asked twice.
                field: "story",
                label: "Your story: how would you tell it to a guest?",
                hint: "This becomes the “About Us” on your website, so write it the way you'd want guests to read it. How did the property come to be, and what do you care about? Rough notes are fine; we'll polish them.",
                required: true,
                long: true,
            },
            {
                // Private: for the team only, never for anything a guest reads.
                field: "aboutYou",
                label: "Getting to know you (just for our team)",
                hint: "This stays between us and won't appear anywhere public. Tell us what helps us work well with you: your long-term vision, what you're great at, where you'd like support, and how you like to work with a partner.",
                long: true,
            },
        ],
    },
    {
        id: "guests",
        title: "Your Guests",
        subtitle: "Who stays, and what they leave with",
        icon: Users01,
        questions: [
            {
                field: "idealGuest",
                label: "Who is your ideal guest?",
                required: true,
                choice: {
                    options: [
                        "Couples seeking romance",
                        "Families with kids",
                        "Friend groups",
                        "Solo travellers",
                        "Remote workers",
                        "Adventure seekers",
                        "Luxury travellers",
                    ],
                },
            },
            {
                field: "guestFeelings",
                label: "How should guests FEEL when they leave your property?",
                required: true,
                choice: {
                    options: [
                        "Refreshed and recharged",
                        "Connected to nature",
                        "Closer to their partner/family",
                        "Inspired and creative",
                        "Adventurous and alive",
                        "Peaceful and grounded",
                        "Pampered and luxurious",
                    ],
                },
            },
            {
                field: "experienceType",
                label: "What type of experience are you offering?",
                required: true,
                choice: { options: ["Budget-friendly getaway", "Mid-range comfort", "Premium experience", "Luxury escape"] },
            },
        ],
    },
    {
        id: "different",
        title: "What Makes It Different",
        subtitle: "Why guests pick you",
        icon: Star01,
        questions: [
            {
                field: "differentiators",
                label: "What makes your property DIFFERENT from other rentals?",
                required: true,
                choice: {
                    options: [
                        "Unique architecture/design",
                        "Stunning natural location",
                        "Luxury amenities (hot tub, sauna, etc.)",
                        "Off-grid/sustainable features",
                        "Privacy and seclusion",
                        "Instagram-worthy interiors",
                        "Pet-friendly",
                        "Adventure activities nearby",
                        // The three the old "What do you want your brand to be known for?"
                        // offered that this list didn't. That question was cut as a
                        // duplicate; these keep what only it asked.
                        "Best value for price",
                        "Most romantic spot",
                        "Perfect family destination",
                    ],
                },
            },
            { field: "threeWords", label: "Describe your property in exactly 3 words", required: true, placeholder: "e.g. Quiet, wild, restorative" },
            { field: "reviewMention", label: "What's the ONE thing guests always mention in reviews?", required: true },
            {
                field: "locationDescription",
                label: "How do you describe your location to potential guests?",
                hint: "E.g. “Smoky Mountains,” “Emerald Coast,” “Downtown Scottsdale,” etc.",
                required: true,
            },
        ],
    },
    {
        id: "voice",
        title: "Voice & Look",
        subtitle: "How the brand sounds and looks",
        icon: Palette,
        questions: [
            {
                field: "personaVoice",
                label: "If your property was a person, how would they talk to guests?",
                required: true,
                choice: {
                    options: [
                        "Warm and welcoming (like a friendly host)",
                        "Sophisticated and elegant (like a luxury concierge)",
                        "Adventurous and bold (like an expedition guide)",
                        "Calm and zen (like a wellness retreat)",
                        "Playful and fun (like a creative friend)",
                        "Down-to-earth and authentic (like a local neighbor)",
                    ],
                },
            },
            {
                field: "aesthetic",
                label: "Choose the aesthetic styles that fit your property",
                hint: "Pick up to 3",
                required: true,
                choice: {
                    maxPick: 3,
                    options: [
                        "Rustic / Cabin Vibes",
                        "Modern Minimalist",
                        "Boho / Free-Spirited",
                        "Luxe Boutique Hotel",
                        "Scandinavian / Light & Airy",
                        "Desert / Southwest",
                        "Coastal / Beachy",
                        "Industrial / Urban",
                        "Vintage / Retro",
                        "Dark & Moody",
                    ],
                },
            },
            {
                field: "competitors",
                label: "Which hospitality brands or competitors do you admire?",
                hint: "Share 2–4 examples and explain what stands out (branding, pricing, positioning, design, guest experience, etc.).",
                required: true,
                long: true,
            },
            {
                field: "brandKitLinks",
                label: "Brand kit",
                hint: "If you have logos, brand guidelines, fonts, or color palettes, paste a folder link here (Google Drive, Dropbox, …) or upload a PDF below — or share them in the Drive folder we'll provide after the Kick-Off Call.",
                long: true,
                upload: true,
            },
        ],
    },
    {
        id: "area",
        title: "Your Area",
        subtitle: "Seasons and local favorites",
        icon: MarkerPin01,
        questions: [
            {
                // New key: this used to be the broader "insights about your market", so an
                // old answer to that would read wrong under this label.
                field: "seasons",
                label: "When are your busy and slow seasons?",
                hint: "Which months fill up on their own, and which ones you'd most like help with.",
                required: true,
                long: true,
            },
            {
                field: "favoritesRestaurants",
                label: "Local Favorites — Restaurants & Cafés",
                hint: "List your top 3–6 go-to recommendations. If possible, include a link to each to ensure accuracy.",
                required: true,
                list: { itemPlaceholder: "Restaurant or café name", linkPlaceholder: "Link (optional)", addLabel: "Add another", rows: 3 },
            },
            {
                field: "favoritesActivities",
                label: "Local Favorites — Activities & Attractions",
                hint: "List your top 3–6 go-to recommendations. If possible, include a link to each to ensure accuracy.",
                required: true,
                list: { itemPlaceholder: "Activity or attraction", linkPlaceholder: "Link (optional)", addLabel: "Add another", rows: 3 },
            },
        ],
    },
    {
        id: "together",
        title: "Working Together",
        subtitle: "Goals, people and anything else",
        icon: Target04,
        intro: "We use Google Chat as our primary channel for updates, approvals, and coordination.",
        questions: [
            {
                field: "businessGoals",
                label: "What are your primary business goals over the next 6–12 months?",
                hint: "E.g., increase occupancy in slow season, reduce OTA dependency, increase average daily rate, expand to new properties.",
                required: true,
                long: true,
            },
            {
                field: "decisionMakers",
                label: "Who are the key decision-makers?",
                hint: "Outline your team structure and identify who has final approval authority.",
                required: true,
                long: true,
            },
            {
                field: "chatEmails",
                label: "Email addresses to add to our Google Chat group",
                hint: "Please list the email addresses of any team members who should be involved in ongoing communication, updates, or approvals.",
                required: true,
                list: { itemPlaceholder: "name@company.com", addLabel: "Add another person", rows: 3 },
            },
            { field: "notes", label: "Additional Notes (optional)", hint: "Anything else we should know before we begin?", long: true },
        ],
    },
];

/**
 * The Account Access form — logins and billing, split from onboarding because the
 * person who holds the passwords is rarely the person who can describe the brand.
 * Stored in its own row ({client}-access) so the two forms never overwrite each other.
 */
const ACCESS_SECTIONS: SectionDef[] = [
    {
        id: "accounts",
        title: "Account Logins",
        subtitle: "Logins we need before the call",
        icon: Settings01,
        intro: "By sharing your business account login details in advance, we can smoothly navigate any Two-Factor Authentication during your Onboarding Call.",
        questions: [
            {
                field: "instagramLogin",
                label: "Instagram Login",
                hint: "(If applicable)",
                credentials: true,
                handle: { label: "Instagram handle", placeholder: "@yourbusiness" },
            },
            {
                field: "tiktokLogin",
                label: "TikTok Login",
                hint: "(If applicable)",
                credentials: true,
                handle: { label: "TikTok handle", placeholder: "@yourbusiness" },
            },
            {
                field: "pmsLogin",
                label: "Your Property Management System (PMS)",
                hint: "Your booking system, and the login we use to connect calendar, rates and availability to the new website.",
                required: true,
                credentials: true,
                credentialLabel: "your Property Management System (PMS)",
                platform: {
                    field: "pms",
                    label: "Which PMS do you use?",
                    options: ["Guesty", "Hostaway", "Hospitable", "OwnerRez", "Lodgify", "Streamline", "Track", "Mews", "Cloudbeds", "Oracle Opera", NO_PMS],
                    otherPlaceholder: "Name your PMS",
                },
            },
            {
                field: "domainLogin",
                label: "Domain Host",
                hint: "Where your domain is registered, and the login we use for DNS configuration and technical setup.",
                required: true,
                credentials: true,
                credentialLabel: "your domain host",
                platform: {
                    field: "domainPlatform",
                    label: "Where is your domain registered?",
                    options: ["GoDaddy", "Namecheap", "Squarespace", "Wix", "Cloudflare", "Google Domains", "Hostinger"],
                    otherPlaceholder: "Name your domain host",
                },
            },
        ],
    },
    {
        id: "billing",
        title: "Billing",
        subtitle: "What we need to invoice you",
        icon: Receipt,
        intro: "The last bit of admin — the details we need to invoice you correctly.",
        questions: [
            {
                field: "billingAddress",
                label: "Full Billing Address",
                hint: "Street, city, state, ZIP and country. If it's the property address you gave on the Onboarding Form, just write “Same as property address”.",
                required: true,
                long: true,
            },
            {
                // Not required — "if applicable", and plenty of hosts operate without one.
                field: "taxId",
                label: "Tax ID (if applicable)",
                hint: "EIN, VAT number or local equivalent. Leave blank if you don't have one.",
            },
            {
                field: "otherAccess",
                label: "Anything else we need access to? (optional)",
                hint: "Any other account you think we'll need — your website builder, booking engine, Google Business Profile, Meta Business Manager, and so on.",
                long: true,
            },
        ],
    },
];

type Step =
    | { kind: "welcome" }
    | { kind: "question"; q: Question; sectionTitle: string; sectionIntro?: string; icon: typeof Mail01; num: number }
    | { kind: "thankyou" };

/**
 * Which logins a question set asks for, derived from the questions themselves so the
 * "Worth having on hand" warning cannot drift from what is actually asked.
 *
 * Said up front on purpose: a host who meets the first password screen unprepared goes
 * to find it, loses the thread, and abandons a half-finished form. Better to send them
 * to their password manager before they start.
 */
const credentialLabelsOf = (sections: SectionDef[]) =>
    sections.flatMap((sec) =>
        sec.questions.filter((q) => q.credentials).map((q) => q.credentialLabel ?? q.label.replace(/\s*Login$/i, "").replace(/^Your\s+/i, "")),
    );

/** Labels as one sentence fragment — commas with "and" before the last, no Oxford comma,
    matching the rest of the site ("look, sound and feel"). */
const listPhrase = (labels: string[]) => (labels.length > 1 ? `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}` : labels.join(""));

export type FormKind = "onboarding" | "access";

/** Everything the engine below needs to run one question set. */
export interface FormDef {
    kind: FormKind;
    title: string;
    /** Slug suffix of this form's row in client_onboarding_pages. */
    slugSuffix: string;
    sections: SectionDef[];
    intro: string;
    /**
     * Stated, not derived. The honest sum of every question's typing time reads as a wall
     * and puts hosts off before they start, so this is an editorial claim. Because it is a
     * fixed string it does NOT follow the question list: revisit it by hand when questions
     * are added or removed.
     */
    estimate: string;
    questionSteps: { q: Question; sectionTitle: string; sectionIntro?: string; icon: typeof Mail01 }[];
    steps: Step[];
    total: number;
    credentialLabels: string[];
    credentialList: string;
}

const buildForm = (def: Pick<FormDef, "kind" | "title" | "slugSuffix" | "sections" | "intro" | "estimate">): FormDef => {
    const questionSteps = def.sections.flatMap((s) =>
        s.questions.map((q, i) => ({ q, sectionTitle: s.title, sectionIntro: i === 0 ? s.intro : undefined, icon: s.icon })),
    );
    const steps: Step[] = [{ kind: "welcome" }, ...questionSteps.map((x, i) => ({ kind: "question" as const, ...x, num: i + 1 })), { kind: "thankyou" }];
    const credentialLabels = credentialLabelsOf(def.sections);
    return { ...def, questionSteps, steps, total: questionSteps.length, credentialLabels, credentialList: listPhrase(credentialLabels) };
};

/**
 * The welcome copy, exported so the client dashboard's form sections show the SAME words.
 * They used to carry their own shorter blurbs, which meant two places to edit and two
 * versions of the truth about what the form asks for.
 */
export const ONBOARDING_INTRO =
    "To ensure a smooth and efficient launch of your marketing funnel, please complete this form with as much detail as possible. Your responses help our team understand your business, branding and target audience so we can get started promptly.";
export const ACCESS_INTRO =
    "The account logins and billing details we need to set everything up. Your answers go only to your dedicated HiddenGem team, and you can hand this form to whoever on your team holds the passwords.";
export const ONBOARDING_LEAD_TIME =
    "Please complete this form at least 12 hours before our scheduled call so our team can review your responses and prepare a customised strategy.";
export const ONBOARDING_SAVES_NOTE = "Your answers save as you go, so you can stop and come back to it.";

export const ONBOARDING_FORM = buildForm({
    kind: "onboarding",
    title: "Onboarding Form",
    slugSuffix: "-onboarding",
    sections: ONBOARDING_SECTIONS,
    intro: ONBOARDING_INTRO,
    estimate: "about 15 minutes",
});

export const ACCESS_FORM = buildForm({
    kind: "access",
    title: "Account Access Form",
    slugSuffix: "-access",
    sections: ACCESS_SECTIONS,
    intro: ACCESS_INTRO,
    estimate: "about 5 minutes",
});

/* Kept as named exports for the pages that already read them (manual, dashboard). */
export const TOTAL_QUESTIONS = ONBOARDING_FORM.total;
export const ESTIMATE_LABEL = ONBOARDING_FORM.estimate;
/** The logins the Account Access form asks for. The Onboarding Form asks for none. */
export const CREDENTIAL_LABELS = ACCESS_FORM.credentialLabels;
export const CREDENTIAL_LIST = ACCESS_FORM.credentialList;

export interface ClientOnboardingData {
    answers: Record<string, string>;
    submittedAt?: string;
    /** Field key of the question the host was last on, so "Continue the form" resumes
        there instead of restarting at question 1. Stored as the field name rather than
        a step index so adding or reordering questions can't resume on the wrong screen. */
    lastField?: string;
}

const mergeData = (partial?: Partial<ClientOnboardingData> | null): ClientOnboardingData => ({
    answers: { ...(partial?.answers ?? {}) },
    submittedAt: partial?.submittedAt,
    lastField: partial?.lastField,
});

/** Which questions offer a recorded answer: the long narrative ones, where the
    host is being asked for paragraphs rather than a fact. Short factual fields
    (email, URLs, logins) stay typed. */
const canRecordAnswer = (q: Question) => !!q.long && !q.credentials && !q.list;

/** A recorded answer satisfies a question just as a typed one does. */
const hasMedia = (q: Question, data: ClientOnboardingData) => !!(data.answers[`${q.field}__media`] ?? "").trim();

/* Choice answers are stored as plain strings, one picked option per line, with the free
   "Other" text beside them — so every answer in the row stays a string, and the document
   drafts (netlify/lib/client-sources.mts) read them without knowing about choices. */
const pickedOf = (data: ClientOnboardingData, field: string) =>
    (data.answers[field] ?? "")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
const otherOf = (data: ClientOnboardingData, field: string) => (data.answers[`${field}__other`] ?? "").trim();

const isAnswered = (q: Question, data: ClientOnboardingData) =>
    q.credentials
        ? !!(
              (data.answers[`${q.field}__user`] ?? "").trim() ||
              (data.answers[`${q.field}__pass`] ?? "").trim() ||
              (q.platform && (data.answers[q.platform.field] ?? "").trim())
          )
        : !!(data.answers[q.field] ?? "").trim() || (!!q.choice && !!otherOf(data, q.field)) || hasMedia(q, data);

const DEFAULT_DATA: ClientOnboardingData = { answers: {} };

/**
 * Where a returning host picks back up. Prefers the question they were last on
 * (matched by field name, so a reordered questionnaire can't land them on the
 * wrong screen), then the first unanswered question, then question 1.
 */
const resumeStepIndex = (form: FormDef, data: ClientOnboardingData) => {
    if (data.lastField) {
        const i = form.steps.findIndex((s) => s.kind === "question" && s.q.field === data.lastField);
        if (i > 0) return i;
    }
    const firstGap = form.steps.findIndex((s) => s.kind === "question" && !isAnswered(s.q, data));
    return firstGap > 0 ? firstGap : 1;
};

/** Progress summary for the dashboard's form cards. */
export const clientOnboardingProgress = (partial?: Partial<ClientOnboardingData> | null, form: FormDef = ONBOARDING_FORM) => {
    const data = mergeData(partial);
    const answered = form.questionSteps.filter(({ q }) => isAnswered(q, data)).length;
    return { answered, total: form.total, submittedAt: data.submittedAt };
};

export type OnboardingAnswerLine = { text: string; secret?: boolean };
export type OnboardingAnswerRow = { field: string; label: string; lines: OnboardingAnswerLine[]; mediaPath: string; mediaKind: MediaKind | "" };
/** `icon` is the same one the form itself shows for the section, so the answers read back with the
    landmarks the client filled them in under. */
export type OnboardingAnswerSection = { id: string; title: string; icon: typeof Mail01; rows: OnboardingAnswerRow[] };

/**
 * Every answer, grouped by section — so the dashboard can show the filled-in form
 * inline instead of making the reader open the review screen. Built from the same
 * section definition the form renders from, so a question added there can never go
 * missing here. Password lines are flagged `secret` so the caller can mask them.
 */
export const clientOnboardingAnswers = (partial?: Partial<ClientOnboardingData> | null, form: FormDef = ONBOARDING_FORM): OnboardingAnswerSection[] => {
    const data = mergeData(partial);
    return form.sections.map((s) => ({
        id: s.id,
        title: s.title,
        icon: s.icon,
        rows: s.questions.map((q) => {
            const lines: OnboardingAnswerLine[] = [];
            if (q.credentials) {
                const platform = q.platform ? (data.answers[q.platform.field] ?? "").trim() : "";
                const handle = (data.answers[`${q.field}__handle`] ?? "").trim();
                const user = (data.answers[`${q.field}__user`] ?? "").trim();
                const pass = (data.answers[`${q.field}__pass`] ?? "").trim();
                const cleared = (data.answers[`${q.field}__cleared`] ?? "").trim();
                if (platform) lines.push({ text: platform });
                if (handle) lines.push({ text: `Handle: ${handle}` });
                if (user) lines.push({ text: `Username: ${user}` });
                if (pass) lines.push({ text: pass, secret: true });
                // Said rather than left blank: a deleted password and an unanswered
                // question look identical otherwise, and someone would chase the client
                // for a login they already gave us.
                else if (cleared)
                    lines.push({
                        text: `Password moved to 1Password on ${new Date(cleared).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`,
                    });
            } else if (q.choice) {
                pickedOf(data, q.field).forEach((t) => lines.push({ text: t }));
                const other = otherOf(data, q.field);
                if (other) lines.push({ text: `Other: ${other}` });
            } else {
                const v = (data.answers[q.field] ?? "").trim();
                if (v) v.split("\n").forEach((t) => lines.push({ text: t }));
            }
            return {
                field: q.field,
                label: q.label,
                lines,
                mediaPath: (data.answers[`${q.field}__media`] ?? "").trim(),
                mediaKind: (data.answers[`${q.field}__mediaKind`] ?? "") as MediaKind | "",
            };
        }),
    }));
};

/* ── Clearing a stored login once it is in 1Password ──────────────────────── */

/**
 * The row with ONE login's password removed and the removal dated.
 *
 * One at a time, not all at once, because that is how the work is actually done: an
 * account manager copies a login into the client's 1Password vault and deletes that one
 * before moving to the next. A bulk clear would force them to finish every login in a
 * sitting or leave the lot behind.
 *
 * Only `__pass` goes. The username, @handle and platform stay: they say WHICH account a
 * login belongs to, which the team still reads at a glance, and they are not the secret.
 *
 * The date is kept so the answers panel can say the password was deleted on purpose.
 * Without it a cleared login is indistinguishable from one the client never filled in,
 * and someone would go chasing the client for an answer they already gave.
 */
export const withLoginCleared = (
    partial: Partial<ClientOnboardingData> | null | undefined,
    field: string,
    at = new Date().toISOString(),
): ClientOnboardingData => {
    const data = mergeData(partial);
    if (!(data.answers[`${field}__pass`] ?? "").trim()) return data;
    const answers = { ...data.answers };
    delete answers[`${field}__pass`];
    answers[`${field}__cleared`] = at;
    return { ...data, answers };
};

/* ── Carrying answers over from the forms this replaces ──────────────────── */

/**
 * The Onboarding Form now asks what the Brand Vision Form used to. A client who already
 * answered that form must not be asked again, so its answers fill any question here that
 * is still empty. Nothing already typed here is ever overwritten, and nothing is written
 * back to the old row.
 *
 * Exported for the self-check beside this file.
 */
export const withBrandVisionAnswers = (partial: Partial<ClientOnboardingData> | null | undefined, vision: Record<string, unknown> | null | undefined) => {
    const data = mergeData(partial);
    if (!vision) return data;
    const answers = { ...data.answers };
    const empty = (k: string) => !(answers[k] ?? "").trim();
    for (const q of ONBOARDING_SECTIONS.flatMap((s) => s.questions)) {
        const v = vision[q.field];
        if (typeof v === "string") {
            if (empty(q.field) && v.trim()) answers[q.field] = v.trim();
        } else if (q.choice && v && typeof v === "object") {
            const { picked, other } = v as { picked?: unknown; other?: unknown };
            const picks = Array.isArray(picked) ? picked.filter((p): p is string => typeof p === "string" && !!p.trim()) : [];
            if (empty(q.field) && empty(`${q.field}__other`)) {
                if (picks.length) answers[q.field] = picks.join("\n");
                if (typeof other === "string" && other.trim()) answers[`${q.field}__other`] = other.trim();
            }
        }
    }
    // The cut "known for" question's three options now live under differentiators.
    const knownFor = vision.brandKnownFor as { picked?: unknown } | undefined;
    const differentiators = ONBOARDING_SECTIONS.flatMap((s) => s.questions).find((q) => q.field === "differentiators");
    if (Array.isArray(knownFor?.picked) && differentiators?.choice) {
        const current = answers.differentiators ? answers.differentiators.split("\n") : [];
        const extra = knownFor.picked.filter((p): p is string => typeof p === "string" && differentiators.choice!.options.includes(p) && !current.includes(p));
        if (extra.length) answers.differentiators = [...current, ...extra].join("\n");
    }
    return { ...data, answers };
};

/** The answer keys one question owns in the row. */
const keysOf = (q: Question) =>
    q.credentials
        ? [`${q.field}__user`, `${q.field}__pass`, `${q.field}__handle`, `${q.field}__cleared`, ...(q.platform ? [q.platform.field] : [])]
        : [q.field, `${q.field}__other`, `${q.field}__media`, `${q.field}__mediaKind`];

/**
 * The Account Access form's first row, seeded from the old single Onboarding Form.
 *
 * Logins and billing used to live in the {client}-onboarding row. A client who already
 * gave them keeps them: they are copied into the new {client}-access row the first time
 * it is created, and the old submitted date comes too, since those answers were
 * submitted. Exported for the self-check beside this file.
 */
export const accessSeedFrom = (onboarding: Partial<ClientOnboardingData> | null | undefined): ClientOnboardingData => {
    const old = mergeData(onboarding);
    const answers: Record<string, string> = {};
    for (const q of ACCESS_SECTIONS.flatMap((s) => s.questions)) for (const k of keysOf(q)) if ((old.answers[k] ?? "").trim()) answers[k] = old.answers[k];
    const carried = Object.keys(answers).length > 0;
    return { answers, submittedAt: carried ? old.submittedAt : undefined };
};

type RowRead = { ok: true; data: Partial<ClientOnboardingData> | null } | { ok: false };

const readRow = async (slug: string): Promise<RowRead> => {
    const { data: row, error } = await supabase.from("client_onboarding_pages").select("data").eq("slug", slug).maybeSingle();
    if (error) {
        console.error("[client onboarding read]", error);
        return { ok: false };
    }
    return { ok: true, data: (row as { data: Partial<ClientOnboardingData> | null } | null)?.data ?? null };
};

/** Read a form's row, creating it on first visit with `seed` as its starting answers. */
const provisionRow = async (
    args: { slug: string; clientName?: string; clientWebsite?: string },
    seed: () => Promise<ClientOnboardingData>,
): Promise<Partial<ClientOnboardingData> | null> => {
    try {
        const existing = await readRow(args.slug);
        if (!existing.ok) return null; // don't insert over a row we simply failed to read
        if (existing.data) return existing.data;

        const initial = await seed();
        const { error } = await supabase.from("client_onboarding_pages").insert({
            slug: args.slug,
            client_name: args.clientName?.trim() ?? "",
            client_website: args.clientWebsite?.trim() ?? "",
            data: initial,
        });
        if (error) {
            if (error.code !== "23505") {
                console.error("[client onboarding provision]", error);
                return null;
            }
            const raced = await readRow(args.slug); // someone else created it first
            return raced.ok ? (raced.data ?? {}) : null;
        }
        return initial;
    } catch (e) {
        console.error("[client onboarding provision]", e);
        return null;
    }
};

/**
 * The client's Onboarding Form row, provisioned on first visit. A new row opens with the
 * business name and website already filled in from the dashboard, so the form starts on
 * a real question. Brand Vision answers the client already gave fill any empty question.
 */
export const ensureClientOnboardingForm = async (args: {
    slug: string;
    clientName?: string;
    clientWebsite?: string;
}): Promise<Partial<ClientOnboardingData> | null> => {
    const data = await provisionRow(args, async () => ({
        answers: {
            ...(args.clientName?.trim() ? { businessName: args.clientName.trim() } : {}),
            ...(args.clientWebsite?.trim() ? { websiteUrl: args.clientWebsite.trim() } : {}),
        },
    }));
    if (!data) return data;
    const base = args.slug.replace(/-onboarding$/, "");
    const { data: vision } = await supabase.from("host_onboarding_pages").select("data").eq("slug", `${base}-hostonboarding`).maybeSingle();
    return withBrandVisionAnswers(data, (vision as { data?: Record<string, unknown> } | null)?.data);
};

/** The client's Account Access row, provisioned on first visit from the old Onboarding row. */
export const ensureAccessForm = (args: { slug: string; clientName?: string; clientWebsite?: string }) =>
    provisionRow(args, async () => {
        const base = args.slug.replace(/-access$/, "");
        const old = await readRow(`${base}-onboarding`);
        return old.ok ? accessSeedFrom(old.data) : DEFAULT_DATA;
    });

function validateStep(step: Step, data: ClientOnboardingData): string | null {
    if (step.kind !== "question") return null;
    if (step.q.credentials) {
        if (!step.q.required) return null;
        // Merged platform+login screens: the platform pick was its own required
        // question before the merge, so it stays required here.
        const platform = step.q.platform ? (data.answers[step.q.platform.field] ?? "").trim() : "";
        if (step.q.platform && !platform) return "Please pick one";
        // Nothing to log in to.
        if (platform === NO_PMS) return null;
        const user = (data.answers[`${step.q.field}__user`] ?? "").trim();
        const pass = (data.answers[`${step.q.field}__pass`] ?? "").trim();
        if (!user || !pass) return "Please fill in both the username and password";
        return null;
    }
    if (step.q.choice) {
        if (step.q.required && !pickedOf(data, step.q.field).length && !otherOf(data, step.q.field)) return "Please make a selection";
        return null;
    }
    const v = (data.answers[step.q.field] ?? "").trim();
    // A recording counts: required questions can be answered by voice or video.
    if (step.q.list && step.q.required && !v) return "Please add at least one";
    if (step.q.required && !v && !hasMedia(step.q, data)) return "Please fill this in, or record your answer";
    if (step.q.email && v && !/^\S+@\S+\.\S+$/.test(v)) return "Hmm… that email doesn't look right";
    return null;
}

/* ── Small presentational pieces (mirrors the Brand Vision Form) ── */

const stepVariants = {
    enter: (dir: 1 | -1) => ({ opacity: 0, y: dir === 1 ? 40 : -40 }),
    center: { opacity: 1, y: 0 },
    exit: (dir: 1 | -1) => ({ opacity: 0, y: dir === 1 ? -24 : 24 }),
};

const Kbd = ({ children }: { children: ReactNode }) => (
    <kbd className="rounded-md border border-secondary bg-secondary px-1.5 py-0.5 font-sans text-[11px] font-semibold text-secondary">{children}</kbd>
);

const okBtnCls =
    "flex items-center gap-2 rounded-lg bg-brand-solid px-5 py-2.5 text-md font-semibold text-white shadow-sm outline-brand transition duration-100 ease-linear hover:bg-brand-solid_hover focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

const underlineCls =
    "w-full border-b-2 border-secondary bg-transparent pb-2 text-primary outline-none transition duration-100 ease-linear placeholder:text-placeholder focus:border-brand";

const ErrorShake = ({ msg }: { msg: string }) => (
    <motion.div
        role="alert"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, x: [0, -8, 8, -5, 5, 0] }}
        transition={{ duration: 0.4 }}
        className="mt-5 flex w-max max-w-full items-center gap-2 rounded-lg bg-error-primary px-3 py-2 text-sm font-medium text-error-primary"
    >
        <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
        {msg}
    </motion.div>
);

const TextQuestion = ({
    q,
    value,
    onChange,
    slug,
    mediaPath,
    mediaKind,
}: {
    q: Question;
    value: string;
    onChange: (field: string, value: string) => void;
    slug?: string;
    mediaPath?: string;
    mediaKind?: MediaKind | "";
}) => {
    const placeholder = q.placeholder ?? "Type your answer here…";
    const cls = cx(underlineCls, "mt-8 text-xl font-medium md:text-display-xs");
    if (q.long) {
        return (
            <div>
                <textarea
                    data-step-autofocus
                    rows={3}
                    placeholder={placeholder}
                    value={value}
                    onChange={(e) => onChange(q.field, e.target.value)}
                    className={cx(cls, "field-sizing-content resize-none")}
                />
                <p className="mt-2 text-xs text-tertiary">
                    <Kbd>Cmd/Ctrl + Enter ↵</Kbd> to continue
                </p>
                {/* Long narrative questions accept a spoken answer too — talking is far
                    easier than typing several paragraphs, and it's these answers that
                    feed the Master Brand Document. Typing still works exactly as before. */}
                {canRecordAnswer(q) && (
                    <MediaAnswer
                        slug={slug}
                        field={q.field}
                        path={mediaPath ?? ""}
                        kind={mediaKind ?? ""}
                        onChange={(p, k) => {
                            onChange(`${q.field}__media`, p);
                            onChange(`${q.field}__mediaKind`, k);
                        }}
                    />
                )}
            </div>
        );
    }
    return (
        <input
            data-step-autofocus
            type={q.email ? "email" : "text"}
            inputMode={q.email ? "email" : undefined}
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(q.field, e.target.value)}
            className={cls}
        />
    );
};

/** Reassurance shown under credential questions — clients are sharing real logins. */
const SafeNote = () => (
    <div className="mt-6 flex max-w-xl items-start gap-2.5 rounded-xl bg-secondary px-4 py-3">
        <Lock01 className="mt-0.5 size-4 shrink-0 text-fg-quaternary" aria-hidden="true" />
        <p className="text-sm text-tertiary">
            <span className="font-semibold text-secondary">Your details are safe.</span> Everything you enter is sent over an encrypted connection, stored
            privately, and used only by your dedicated HiddenGem team to set up your accounts — never shared with anyone else.
        </p>
    </div>
);

/**
 * Platform picker — one tap for the common choices, free text for anything else.
 * The value is stored as a plain string in the platform's own field, so a name
 * typed before the chips existed simply reads back as the "Other" selection.
 */
const PlatformChips = ({ platform, value, onChange }: { platform: NonNullable<Question["platform"]>; value: string; onChange: (v: string) => void }) => {
    const isPreset = platform.options.includes(value);
    // Anything non-empty that isn't a preset is a custom answer — keep Other open on it.
    const [otherOpen, setOtherOpen] = useState(!!value && !isPreset);

    return (
        <div className="block">
            <span className="text-xs font-semibold tracking-wide text-quaternary uppercase">{platform.label}</span>
            <div className="mt-3 flex flex-wrap gap-2">
                {platform.options.map((opt) => {
                    const active = value === opt;
                    return (
                        <button
                            key={opt}
                            type="button"
                            onClick={() => {
                                setOtherOpen(false);
                                onChange(active ? "" : opt);
                            }}
                            className={cx(
                                "rounded-full px-4 py-2 text-sm font-medium transition duration-100 ease-linear",
                                active ? "bg-brand-solid text-white" : "bg-primary text-secondary ring-1 ring-secondary hover:bg-secondary hover:text-primary",
                            )}
                        >
                            {opt}
                        </button>
                    );
                })}
                <button
                    type="button"
                    onClick={() => {
                        setOtherOpen(true);
                        if (isPreset) onChange("");
                    }}
                    className={cx(
                        "rounded-full px-4 py-2 text-sm font-medium transition duration-100 ease-linear",
                        otherOpen && !isPreset
                            ? "bg-brand-solid text-white"
                            : "bg-primary text-secondary ring-1 ring-secondary hover:bg-secondary hover:text-primary",
                    )}
                >
                    Other
                </button>
            </div>
            {otherOpen && !isPreset && (
                <input
                    autoFocus
                    type="text"
                    placeholder={platform.otherPlaceholder ?? "Type it here"}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className={cx(underlineCls, "mt-4 text-lg font-medium")}
                />
            )}
        </div>
    );
};

/**
 * Repeatable-row answer. One row per recommendation, with an optional link
 * beside it, so the host fills in blanks rather than inventing a format — and
 * the team gets one item per line instead of a paragraph to unpick.
 */
const ListQuestion = ({ q, value, onChange }: { q: Question; value: string; onChange: (field: string, value: string) => void }) => {
    const cfg = q.list!;
    const minRows = cfg.rows ?? 3;
    // Rows live in local state so a half-typed row stays on screen; serialization
    // drops empty rows, which would otherwise make them vanish mid-typing.
    const [rows, setRows] = useState<ListRow[]>(() => parseRows(value, minRows));

    const push = (next: ListRow[]) => {
        setRows(next);
        onChange(q.field, serializeRows(next));
    };
    const setAt = (i: number, patch: Partial<ListRow>) => push(rows.map((r, n) => (n === i ? { ...r, ...patch } : r)));
    const removeAt = (i: number) => push(rows.filter((_, n) => n !== i));
    const filled = rows.filter((r) => r.text.trim() || r.link.trim()).length;

    return (
        <div className="mt-8 flex max-w-xl flex-col gap-2.5">
            {rows.map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                    <span className="w-5 shrink-0 text-sm text-quaternary tabular-nums">{i + 1}.</span>
                    <input
                        {...(i === 0 ? { "data-step-autofocus": true } : {})}
                        type="text"
                        placeholder={cfg.itemPlaceholder}
                        value={row.text}
                        onChange={(e) => setAt(i, { text: e.target.value })}
                        onKeyDown={(e) => {
                            // Enter walks down the list instead of skipping the question.
                            if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
                                e.preventDefault();
                                e.stopPropagation();
                                if (i === rows.length - 1) setRows([...rows, { text: "", link: "" }]);
                            }
                        }}
                        className={cx(underlineCls, "flex-1 text-lg font-medium")}
                    />
                    {cfg.linkPlaceholder && (
                        <input
                            type="url"
                            inputMode="url"
                            placeholder={cfg.linkPlaceholder}
                            value={row.link}
                            onChange={(e) => setAt(i, { link: e.target.value })}
                            className={cx(underlineCls, "w-[38%] shrink-0 text-sm")}
                        />
                    )}
                    <button
                        type="button"
                        onClick={() => removeAt(i)}
                        title="Remove"
                        aria-label={`Remove row ${i + 1}`}
                        className={cx(
                            "flex size-8 shrink-0 items-center justify-center rounded-lg text-fg-quaternary transition duration-100 ease-linear hover:bg-secondary hover:text-error-primary",
                            rows.length <= 1 && "invisible",
                        )}
                    >
                        <XClose className="size-4" aria-hidden="true" />
                    </button>
                </div>
            ))}
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
                <button
                    type="button"
                    onClick={() => setRows([...rows, { text: "", link: "" }])}
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-sm font-medium text-secondary ring-1 ring-secondary transition duration-100 ease-linear hover:bg-secondary hover:text-primary"
                >
                    <Plus className="size-4 text-fg-quaternary" aria-hidden="true" />
                    {cfg.addLabel ?? "Add another"}
                </button>
                <span className="text-xs text-quaternary">
                    {filled} added · <Kbd>Enter ↵</Kbd> next row · <Kbd>Cmd/Ctrl + Enter ↵</Kbd> to continue
                </span>
            </div>
        </div>
    );
};

/**
 * Masked password with a show/hide toggle. Masked by default so a password isn't left on
 * screen for anyone passing; the toggle is there because a login mistyped blind is a login
 * that fails on the call.
 */
const PasswordField = ({ value, onChange, className }: { value: string; onChange: (v: string) => void; className: string }) => {
    const [shown, setShown] = useState(false);
    return (
        <label className="block">
            <span className="text-xs font-semibold tracking-wide text-quaternary uppercase">Password</span>
            <div className="relative">
                <input
                    type={shown ? "text" : "password"}
                    autoComplete="off"
                    placeholder="Password"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className={cx(className, "pr-11")}
                />
                <button
                    type="button"
                    onClick={() => setShown((s) => !s)}
                    aria-label={shown ? "Hide password" : "Show password"}
                    aria-pressed={shown}
                    className="absolute right-0 bottom-2 flex size-9 items-center justify-center rounded-lg text-fg-quaternary transition duration-100 ease-linear hover:bg-secondary hover:text-fg-secondary"
                >
                    {shown ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}
                </button>
            </div>
        </label>
    );
};

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Multiple choice — the Brand Vision Form's choice cards, brought over with its questions.
 * Real checkboxes via React Aria. Picks are written back as one option per line, and the
 * "Other" box to {field}__other.
 */
const ChoiceQuestion = ({ q, picked, other, onChange }: { q: Question; picked: string[]; other: string; onChange: (field: string, value: string) => void }) => {
    const cfg = q.choice!;
    const atMax = !!cfg.maxPick && picked.length >= cfg.maxPick;
    return (
        <div className="mt-8">
            <AriaCheckboxGroup
                value={picked}
                // Kept in the options' own order, so the answer reads the same way the list does.
                onChange={(next) =>
                    onChange(
                        q.field,
                        cfg.options
                            .filter((o) => next.includes(o))
                            .concat(next.filter((o) => !cfg.options.includes(o)))
                            .join("\n"),
                    )
                }
                aria-labelledby="question-heading"
            >
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {cfg.options.map((opt, i) => (
                        <AriaCheckbox
                            key={opt}
                            value={opt}
                            isDisabled={!picked.includes(opt) && atMax}
                            className={({ isSelected, isDisabled, isFocusVisible }) =>
                                cx(
                                    "relative flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition duration-100 ease-linear",
                                    isSelected
                                        ? "border-brand bg-brand-primary_alt shadow-sm"
                                        : "border-secondary bg-primary hover:border-brand hover:bg-secondary",
                                    isDisabled && "cursor-not-allowed opacity-50",
                                    isFocusVisible && "outline-2 outline-offset-2 outline-focus-ring",
                                )
                            }
                        >
                            {({ isSelected }) => (
                                <>
                                    <span
                                        aria-hidden="true"
                                        className={cx(
                                            "flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold ring-1 transition duration-100 ease-linear",
                                            isSelected ? "bg-brand-solid text-white ring-transparent" : "bg-primary text-tertiary ring-secondary",
                                        )}
                                    >
                                        {LETTERS[i]}
                                    </span>
                                    <span className={cx("flex-1 text-sm leading-snug font-medium", isSelected ? "text-brand-secondary" : "text-secondary")}>
                                        {opt}
                                    </span>
                                    <Check
                                        className={cx(
                                            "size-4 shrink-0 text-fg-brand-primary transition duration-100 ease-linear",
                                            isSelected ? "opacity-100" : "opacity-0",
                                        )}
                                        strokeWidth={3}
                                        aria-hidden="true"
                                    />
                                </>
                            )}
                        </AriaCheckbox>
                    ))}
                </div>
            </AriaCheckboxGroup>
            <input
                type="text"
                placeholder="Other…"
                aria-label="Other, please specify"
                value={other}
                onChange={(e) => onChange(`${q.field}__other`, e.target.value)}
                className={cx(underlineCls, "mt-4 pb-1.5 text-md")}
            />
        </div>
    );
};

/** Login question — optional platform picker, then username + password stored as separate answers. */
const CredentialsQuestion = ({
    q,
    user,
    pass,
    handleValue,
    platformValue,
    onChange,
}: {
    q: Question;
    user: string;
    pass: string;
    handleValue: string;
    platformValue: string;
    onChange: (field: string, value: string) => void;
}) => {
    const cls = cx(underlineCls, "mt-2 text-xl font-medium md:text-display-xs");
    return (
        <div className="mt-8 flex max-w-xl flex-col gap-7">
            {q.platform && <PlatformChips platform={q.platform} value={platformValue} onChange={(v) => onChange(q.platform!.field, v)} />}
            {q.handle && (
                <label className="block">
                    <span className="text-xs font-semibold tracking-wide text-quaternary uppercase">{q.handle.label}</span>
                    <input
                        data-step-autofocus
                        type="text"
                        placeholder={q.handle.placeholder}
                        value={handleValue}
                        onChange={(e) => onChange(`${q.field}__handle`, e.target.value)}
                        className={cls}
                    />
                </label>
            )}
            <label className="block">
                <span className="text-xs font-semibold tracking-wide text-quaternary uppercase">Username or email</span>
                <input
                    data-step-autofocus={!q.handle}
                    type="text"
                    placeholder="Username"
                    value={user}
                    onChange={(e) => onChange(`${q.field}__user`, e.target.value)}
                    className={cls}
                />
            </label>
            <PasswordField value={pass} onChange={(v) => onChange(`${q.field}__pass`, v)} className={cls} />
            <SafeNote />
        </div>
    );
};

/** Playback of a recorded answer on the review page. The bucket is private, so
    the signed URL is resolved per render rather than stored with the answer. */
const RecordedAnswer = ({ path, kind }: { path: string; kind: MediaKind | "" }) => {
    const [url, setUrl] = useState("");
    useEffect(() => {
        let live = true;
        supabase.storage
            .from("recordings")
            .createSignedUrl(path, 60 * 60)
            .then(({ data }) => {
                if (live && data?.signedUrl) setUrl(data.signedUrl);
            });
        return () => {
            live = false;
        };
    }, [path]);

    return (
        <div className="mt-2 flex flex-col gap-2">
            <p className="flex items-center gap-1.5 text-xs font-medium text-tertiary">
                {kind === "video" ? <VideoRecorder className="size-3.5" aria-hidden="true" /> : <Microphone01 className="size-3.5" aria-hidden="true" />}
                {kind === "video" ? "Video answer" : "Voice answer"}
            </p>
            {!url ? (
                <p className="text-xs text-quaternary">Loading…</p>
            ) : (
                <RecordingPlayer
                    src={url}
                    kind={kind}
                    className={kind === "video" ? "aspect-video w-full max-w-md rounded-lg bg-secondary" : "w-full max-w-md"}
                />
            )}
        </div>
    );
};

/* ── Review — every answer on one page, Edit jumps into its question ── */

const ReviewScreen = ({
    form,
    data,
    clientName,
    onEdit,
    onClose,
}: {
    form: FormDef;
    data: ClientOnboardingData;
    clientName: string;
    onEdit: (questionNum: number) => void;
    onClose: () => void;
}) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const answeredCount = form.questionSteps.filter(({ q }) => isAnswered(q, data)).length;
    let questionNum = 0;

    return (
        <div ref={scrollRef} className="absolute inset-0 overflow-y-auto">
            <div className="mx-auto w-full max-w-3xl px-5 pt-16 pb-20 md:px-8">
                <p className="text-sm font-medium text-brand-secondary">{clientName || "Your submission"}</p>
                <h1 data-step-heading tabIndex={-1} className="mt-3 text-display-xs font-semibold text-primary outline-none md:text-display-sm">
                    Your answers
                </h1>
                <p className="mt-2 text-sm text-tertiary">
                    <span className="font-semibold text-primary tabular-nums">
                        {answeredCount} of {form.total}
                    </span>{" "}
                    answered
                    {data.submittedAt && (
                        <> · submitted {new Date(data.submittedAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}</>
                    )}
                </p>

                {form.sections.map((s) => (
                    <section key={s.id} className="mt-10">
                        <p className="flex items-center gap-2 text-sm font-semibold text-brand-secondary">
                            <s.icon className="size-4" aria-hidden="true" />
                            {s.title}
                        </p>
                        <div className="mt-3 flex flex-col gap-3">
                            {s.questions.map((q) => {
                                questionNum += 1;
                                const num = questionNum;
                                const v = q.credentials
                                    ? [
                                          q.platform && (data.answers[q.platform.field] ?? "").trim() && (data.answers[q.platform.field] ?? "").trim(),
                                          (data.answers[`${q.field}__user`] ?? "").trim() && `Username: ${(data.answers[`${q.field}__user`] ?? "").trim()}`,
                                          (data.answers[`${q.field}__pass`] ?? "").trim() && `Password: ${(data.answers[`${q.field}__pass`] ?? "").trim()}`,
                                      ]
                                          .filter(Boolean)
                                          .join("\n")
                                    : q.choice
                                      ? [...pickedOf(data, q.field), otherOf(data, q.field) && `Other: ${otherOf(data, q.field)}`].filter(Boolean).join("\n")
                                      : (data.answers[q.field] ?? "").trim();
                                return (
                                    <div key={q.field} className="group rounded-xl p-4 ring-1 ring-secondary">
                                        <div className="flex items-start justify-between gap-3">
                                            <p className="text-sm font-semibold text-primary">{q.label}</p>
                                            <button
                                                type="button"
                                                onClick={() => onEdit(num)}
                                                className="shrink-0 text-sm font-semibold text-brand-secondary transition duration-100 ease-linear hover:text-brand-secondary_hover"
                                            >
                                                Edit
                                            </button>
                                        </div>
                                        {v && <p className="mt-1.5 text-sm whitespace-pre-wrap text-tertiary">{v}</p>}
                                        {hasMedia(q, data) && (
                                            <RecordedAnswer
                                                path={data.answers[`${q.field}__media`] ?? ""}
                                                kind={(data.answers[`${q.field}__mediaKind`] as MediaKind | "") ?? ""}
                                            />
                                        )}
                                        {!v && !hasMedia(q, data) && <p className="mt-1.5 text-sm text-quaternary italic">Not answered yet.</p>}
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                ))}

                <div className="mt-10 flex items-center gap-3">
                    <button type="button" onClick={onClose} className={okBtnCls}>
                        Close
                        <Check className="size-5" strokeWidth={3} aria-hidden="true" />
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ── Page ── */

export interface ClientOnboardingFormPageProps {
    /** Which question set to run. Defaults to the Onboarding Form. */
    form?: FormDef;
    slug?: string;
    initialClientName?: string;
    initialData?: Partial<ClientOnboardingData> | null;
    /** Rendered inside the dashboard's form modal rather than as a standalone page:
        fills its container instead of the viewport. The client's own shared link
        (/{client}-onboarding) always renders full-page. */
    embedded?: boolean;
    /** Shown as a close control when embedded. */
    onClose?: () => void;
    /** Open directly on this question's field instead of resuming where they left off.
        Used by the dashboard's per-answer Edit control. Takes precedence over the
        submitted-goes-to-review rule: someone who clicked Edit on a specific answer
        wants that question, not the summary. */
    startAtField?: string;
}

export const ClientOnboardingFormPage = ({
    form = ONBOARDING_FORM,
    slug,
    initialClientName = "",
    initialData,
    embedded = false,
    onClose,
    startAtField,
}: ClientOnboardingFormPageProps) => {
    const isTemplate = !slug;
    const STEPS = form.steps;
    const TOTAL_QUESTIONS = form.total;
    const THANKYOU_INDEX = STEPS.length - 1;
    const [data, setData] = useState<ClientOnboardingData>(() => mergeData(initialData));
    const hydratedRef = useRef(false);
    // A returning host lands straight on the review of their answers.
    const alreadySubmittedOnLoad = useRef(Boolean(slug && data.submittedAt));

    // Client copies open straight on question 1 (welcome stays reachable via Back;
    // the template still opens on it so the team can preview the intro).
    const [[stepIndex, direction], setStep] = useState<[number, 1 | -1]>(() => {
        const target = startAtField ? STEPS.findIndex((s) => s.kind === "question" && s.q.field === startAtField) : -1;
        if (target > 0) return [target, 1];
        return alreadySubmittedOnLoad.current ? [THANKYOU_INDEX, 1] : [slug ? resumeStepIndex(form, data) : 0, 1];
    });
    const [error, setError] = useState<{ msg: string; nonce: number } | null>(null);
    const [submitState, setSubmitState] = useState<"idle" | "saving" | "error">("idle");
    const [showReview, setShowReview] = useState(alreadySubmittedOnLoad.current && !startAtField);
    const [editingFromReview, setEditingFromReview] = useState(false);
    const step = STEPS[stepIndex];

    /* Remember the question they're on so "Continue the form" resumes here. Folded
       into `data` so it rides along on the existing debounced autosave rather than
       issuing a second write per step. */
    useEffect(() => {
        if (!slug) return;
        const current = STEPS[stepIndex];
        if (current?.kind !== "question") return;
        setData((d) => (d.lastField === current.q.field ? d : { ...d, lastField: current.q.field }));
    }, [stepIndex, slug]);

    /* Autosave — debounced, client copies only. */
    useEffect(() => {
        if (!slug) return;
        if (!hydratedRef.current) {
            hydratedRef.current = true;
            return;
        }
        const t = setTimeout(() => {
            supabase
                .from("client_onboarding_pages")
                .update({ data })
                .eq("slug", slug)
                .then(({ error: dbError }) => {
                    if (dbError) console.error("[client onboarding autosave]", dbError);
                });
        }, 900);
        return () => clearTimeout(t);
    }, [data, slug]);

    const onText = (field: string, value: string) => {
        setError(null);
        setData((d) => ({ ...d, answers: { ...d.answers, [field]: value } }));
    };

    /* Brand-kit PDF upload — file goes to the public "brandkits" bucket; only its
       URL is appended to the answer text (never base64 in the row). */
    const brandKitFileRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<{ msg: string; nonce: number } | null>(null);
    const onBrandKitFile = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file || step.kind !== "question" || !step.q.upload) return;
        if (file.size > 25 * 1024 * 1024) {
            setUploadError((er) => ({
                msg: "That file is over 25 MB — please upload a smaller PDF or paste a folder link instead.",
                nonce: (er?.nonce ?? 0) + 1,
            }));
            return;
        }
        setUploadError(null);
        setUploading(true);
        try {
            const path = `${slug || "template"}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
            const { error: upErr } = await supabase.storage.from("brandkits").upload(path, file, { contentType: "application/pdf", cacheControl: "31536000" });
            if (upErr) throw upErr;
            const url = supabase.storage.from("brandkits").getPublicUrl(path).data.publicUrl;
            const field = step.q.field;
            const cur = (data.answers[field] ?? "").trim();
            onText(field, cur ? `${cur}\n${url}` : url);
        } catch (err) {
            console.error("[brand kit upload]", err);
            setUploadError((er) => ({ msg: "Upload failed — try again, or paste a folder link instead.", nonce: (er?.nonce ?? 0) + 1 }));
        } finally {
            setUploading(false);
        }
    };

    /* Navigation */
    const focusCurrentStep = () => {
        const el = document.querySelector<HTMLElement>("[data-step-autofocus]") ?? document.querySelector<HTMLElement>("[data-step-heading]");
        el?.focus({ preventScroll: true });
    };
    const goBack = () => {
        if (stepIndex === 0) return;
        setError(null);
        setStep([stepIndex - 1, -1]);
    };
    const [savingClose, setSavingClose] = useState(false);

    /**
     * Write immediately rather than waiting on the 900ms autosave debounce.
     * Closing the modal straight after typing would otherwise drop the last
     * keystrokes — the row would still hold the previous answer.
     */
    const saveNow = async () => {
        if (!slug) return;
        const { error: dbError } = await supabase.from("client_onboarding_pages").update({ data }).eq("slug", slug);
        if (dbError) throw dbError;
    };

    /** Save & close: validate this question like OK does, flush, then hand back. */
    const saveAndClose = async () => {
        const msg = validateStep(step, data);
        if (msg) {
            setError((er) => ({ msg, nonce: (er?.nonce ?? 0) + 1 }));
            return;
        }
        setSavingClose(true);
        try {
            await saveNow();
            onClose?.();
        } catch {
            setSavingClose(false);
            setError((er) => ({ msg: "Couldn't save — check your connection and try again.", nonce: (er?.nonce ?? 0) + 1 }));
        }
    };

    const goNext = () => {
        if (step.kind === "thankyou") return;
        const msg = validateStep(step, data);
        if (msg) {
            setError((er) => ({ msg, nonce: (er?.nonce ?? 0) + 1 }));
            return;
        }
        setError(null);
        if (editingFromReview) {
            setEditingFromReview(false);
            setShowReview(true);
            return;
        }
        if (stepIndex === THANKYOU_INDEX - 1) {
            void handleSubmit();
            return;
        }
        setStep([stepIndex + 1, 1]);
    };
    const backToReview = () => {
        setError(null);
        setEditingFromReview(false);
        setShowReview(true);
    };
    const closeReview = () => {
        setError(null);
        setShowReview(false);
        setStep([THANKYOU_INDEX, 1]);
    };
    const editFromReview = (num: number) => {
        setError(null);
        setShowReview(false);
        setEditingFromReview(true);
        // Step index of a question is its running number (welcome is step 0).
        setStep([num, -1]);
    };

    const handleSubmit = async () => {
        if (submitState === "saving") return;
        for (let i = 0; i < STEPS.length; i++) {
            const msg = validateStep(STEPS[i], data);
            if (msg) {
                setStep([i, -1]);
                setError((er) => ({ msg, nonce: (er?.nonce ?? 0) + 1 }));
                return;
            }
        }
        const submittedAt = new Date().toISOString();
        if (slug) {
            setSubmitState("saving");
            const { error: dbError } = await supabase
                .from("client_onboarding_pages")
                .update({ data: { ...data, submittedAt } })
                .eq("slug", slug);
            if (dbError) {
                console.error("[client onboarding submit]", dbError);
                setSubmitState("error");
                return;
            }
        }
        setSubmitState("idle");
        setError(null);
        setData((d) => ({ ...d, submittedAt }));
        setStep([THANKYOU_INDEX, 1]);
        // Land on the answers review right after submitting.
        setEditingFromReview(false);
        setShowReview(true);
    };

    /* Keyboard: Enter advances (Cmd/Ctrl+Enter inside textareas) */
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (showReview) return;
            if (e.key !== "Enter") return;
            const target = e.target as HTMLElement | null;
            if (target instanceof HTMLTextAreaElement && !(e.metaKey || e.ctrlKey)) return;
            e.preventDefault();
            goNext();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stepIndex, data, showReview, editingFromReview, submitState]);

    const progressPct = showReview ? 100 : step.kind === "welcome" ? 0 : step.kind === "question" ? (step.num / TOTAL_QUESTIONS) * 100 : 100;

    return (
        <main className={cx("relative flex min-h-0 min-w-0 flex-col overflow-hidden bg-primary", embedded ? "h-full rounded-2xl" : "h-dvh")}>
            {embedded && onClose && (
                <button
                    type="button"
                    onClick={() =>
                        void saveNow()
                            .catch(() => {})
                            .then(() => onClose())
                    }
                    title="Close"
                    className="absolute top-2.5 right-3 z-30 flex size-9 items-center justify-center rounded-lg text-fg-quaternary transition duration-100 ease-linear hover:bg-secondary hover:text-fg-secondary"
                >
                    <XClose className="size-5" aria-hidden="true" />
                </button>
            )}
            {/* ── Top bar — title, counter, slim progress ── */}
            <header className="absolute inset-x-0 top-0 z-20 bg-primary">
                <div className="flex items-center justify-between gap-3 py-3 pr-16 pl-5 md:pl-8">
                    <p className="truncate text-xs font-medium text-tertiary">
                        {form.title}
                        {initialClientName && <span className="text-quaternary"> · {initialClientName}</span>}
                    </p>
                    {showReview ? (
                        <p className="shrink-0 text-xs font-medium text-tertiary">Your answers</p>
                    ) : (
                        step.kind === "question" && (
                            <p className="shrink-0 text-xs font-medium text-tertiary tabular-nums">
                                {step.num} of {TOTAL_QUESTIONS}
                            </p>
                        )
                    )}
                </div>
                <div
                    className="h-1 w-full bg-quaternary"
                    role="progressbar"
                    aria-label="Form progress"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(progressPct)}
                >
                    <motion.div
                        className="h-full bg-brand-solid"
                        initial={false}
                        animate={{ width: `${progressPct}%` }}
                        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    />
                </div>
            </header>

            {/* ── Review summary ── */}
            {showReview && (
                <div className="relative min-h-0 flex-1">
                    <motion.div
                        className="absolute inset-0"
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <ReviewScreen form={form} data={data} clientName={initialClientName} onEdit={editFromReview} onClose={closeReview} />
                    </motion.div>
                </div>
            )}

            {/* ── Step viewport — one screen at a time ── */}
            <div className={cx("relative min-h-0 flex-1", showReview && "hidden")}>
                <AnimatePresence mode="wait" custom={direction} initial={false}>
                    <motion.div
                        key={stepIndex}
                        custom={direction}
                        variants={stepVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                        onAnimationComplete={(definition) => definition === "center" && focusCurrentStep()}
                        className="absolute inset-0 flex flex-col overflow-y-auto"
                    >
                        <div className="mx-auto my-auto w-full max-w-2xl px-5 py-20 md:px-8">
                            {step.kind === "welcome" && (
                                <div>
                                    {isTemplate && (
                                        <div className="mb-8 rounded-xl border border-brand_alt bg-brand-primary_alt px-4 py-3">
                                            <p className="text-[13px] font-medium text-brand-secondary">
                                                Master template — answers here won't be saved. Each client dashboard opens its own private copy.
                                            </p>
                                        </div>
                                    )}
                                    <p className="text-sm font-medium text-brand-secondary">{initialClientName || "Welcome to HiddenGem Media"}</p>
                                    <h1
                                        data-step-heading
                                        tabIndex={-1}
                                        className="mt-3 text-display-sm font-semibold text-primary outline-none md:text-display-lg"
                                    >
                                        {form.title}
                                    </h1>
                                    <p className="mt-4 max-w-xl text-md text-tertiary">{form.intro}</p>
                                    <p className="mt-4 max-w-xl text-md text-tertiary">
                                        <span className="font-semibold text-secondary">Important:</span> {ONBOARDING_LEAD_TIME}
                                    </p>
                                    <div className="mt-8 flex items-center gap-3">
                                        <button type="button" onClick={goNext} className={cx(okBtnCls, "rounded-xl px-7 py-3")}>
                                            Start
                                            <ArrowRight className="size-5" aria-hidden="true" />
                                        </button>
                                        <span className="hidden text-xs text-tertiary md:inline">
                                            press <Kbd>Enter ↵</Kbd>
                                        </span>
                                    </div>
                                    <p className="mt-6 text-sm text-quaternary">
                                        {TOTAL_QUESTIONS} questions · {form.estimate}
                                    </p>
                                    <p className="mt-1 text-sm text-quaternary">{ONBOARDING_SAVES_NOTE}</p>
                                    {form.credentialLabels.length > 0 && (
                                        <div className="mt-6 max-w-xl rounded-xl bg-secondary px-4 py-3 ring-1 ring-secondary">
                                            <p className="text-sm text-secondary">
                                                <span className="font-semibold text-primary">Worth having on hand:</span> This form asks for a few account
                                                logins so we can set things up for you — {form.credentialList}.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {step.kind === "question" && (
                                <div>
                                    {editingFromReview && (
                                        <button
                                            type="button"
                                            onClick={backToReview}
                                            className="mb-5 flex items-center gap-1.5 text-sm font-semibold text-tertiary transition duration-100 ease-linear hover:text-secondary"
                                        >
                                            <ArrowLeft className="size-4" aria-hidden="true" />
                                            Back to summary
                                        </button>
                                    )}
                                    <p className="flex items-center gap-2 text-sm font-medium text-brand-secondary">
                                        <step.icon className="size-4" aria-hidden="true" />
                                        {step.sectionTitle}
                                        <span className="flex items-center gap-1 text-tertiary tabular-nums">
                                            · {step.num} <ArrowRight className="size-4" aria-hidden="true" />
                                        </span>
                                    </p>
                                    {step.sectionIntro && <p className="mt-2 max-w-xl text-sm text-tertiary">{step.sectionIntro}</p>}
                                    <h1
                                        id="question-heading"
                                        data-step-heading
                                        tabIndex={-1}
                                        className="mt-3 text-display-xs font-semibold text-primary outline-none md:text-display-sm"
                                    >
                                        {step.q.label}
                                        {step.q.required && (
                                            <span className="text-error-primary" aria-hidden="true">
                                                {" "}
                                                *
                                            </span>
                                        )}
                                    </h1>
                                    {step.q.hint && <p className="mt-2 max-w-xl text-sm text-tertiary">{step.q.hint}</p>}

                                    {step.q.credentials ? (
                                        <CredentialsQuestion
                                            q={step.q}
                                            user={data.answers[`${step.q.field}__user`] ?? ""}
                                            pass={data.answers[`${step.q.field}__pass`] ?? ""}
                                            handleValue={data.answers[`${step.q.field}__handle`] ?? ""}
                                            platformValue={step.q.platform ? (data.answers[step.q.platform.field] ?? "") : ""}
                                            onChange={onText}
                                        />
                                    ) : step.q.choice ? (
                                        <ChoiceQuestion
                                            q={step.q}
                                            picked={pickedOf(data, step.q.field)}
                                            other={data.answers[`${step.q.field}__other`] ?? ""}
                                            onChange={onText}
                                        />
                                    ) : step.q.list ? (
                                        <ListQuestion q={step.q} value={data.answers[step.q.field] ?? ""} onChange={onText} />
                                    ) : (
                                        <TextQuestion
                                            q={step.q}
                                            value={data.answers[step.q.field] ?? ""}
                                            onChange={onText}
                                            slug={slug}
                                            mediaPath={data.answers[`${step.q.field}__media`] ?? ""}
                                            mediaKind={(data.answers[`${step.q.field}__mediaKind`] as MediaKind | "") ?? ""}
                                        />
                                    )}

                                    {step.q.upload && (
                                        <div className="mt-5 flex flex-wrap items-center gap-3">
                                            <button
                                                type="button"
                                                onClick={() => brandKitFileRef.current?.click()}
                                                disabled={uploading}
                                                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-secondary ring-1 ring-secondary transition duration-100 ease-linear hover:bg-secondary_hover disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                {uploading && <span className="size-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />}
                                                {uploading ? "Uploading…" : "Upload a PDF"}
                                            </button>
                                            <span className="text-xs text-quaternary">PDF up to 25 MB — its link is added to your answer above.</span>
                                            <input
                                                ref={brandKitFileRef}
                                                type="file"
                                                accept="application/pdf"
                                                className="hidden"
                                                onChange={(e) => void onBrandKitFile(e)}
                                            />
                                        </div>
                                    )}
                                    {step.q.upload && uploadError && <ErrorShake key={uploadError.nonce} msg={uploadError.msg} />}

                                    {error && <ErrorShake key={error.nonce} msg={error.msg} />}

                                    <div className="mt-8 flex items-center gap-3">
                                        <button type="button" onClick={goNext} className={okBtnCls} disabled={submitState === "saving"}>
                                            {editingFromReview
                                                ? "Save"
                                                : step.num === TOTAL_QUESTIONS
                                                  ? submitState === "saving"
                                                      ? "Submitting…"
                                                      : "Submit"
                                                  : "OK"}
                                            <Check className="size-5" strokeWidth={3} aria-hidden="true" />
                                        </button>
                                        {embedded && onClose && step.kind === "question" && (
                                            <button
                                                type="button"
                                                onClick={() => void saveAndClose()}
                                                disabled={savingClose}
                                                className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-md font-semibold text-secondary ring-1 ring-secondary transition duration-100 ease-linear hover:bg-secondary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                {savingClose ? "Saving…" : "Save & close"}
                                            </button>
                                        )}
                                        {/* On list and long questions plain Enter belongs to the field
                                            (next row / newline), so advertise the modifier instead. */}
                                        <span className="hidden text-xs text-tertiary md:inline">
                                            press <Kbd>{step.q.list || step.q.long ? "Cmd/Ctrl + Enter ↵" : "Enter ↵"}</Kbd>
                                        </span>
                                    </div>
                                    {submitState === "error" && <ErrorShake msg="Couldn't save — check your connection and try again." />}
                                </div>
                            )}

                            {step.kind === "thankyou" && (
                                <div>
                                    <p className="text-sm font-medium text-brand-secondary">{initialClientName || "All set"}</p>
                                    <h1
                                        data-step-heading
                                        tabIndex={-1}
                                        className="mt-3 text-display-sm font-semibold text-primary outline-none md:text-display-lg"
                                    >
                                        {form.kind === "access" ? "Thank you — your logins are in" : "Final step — book your Kick-Off Call 🚀"}
                                    </h1>
                                    <p className="mt-4 max-w-xl text-md text-tertiary">
                                        {form.kind === "access"
                                            ? "Your answers are submitted and go only to your HiddenGem team. If you haven't already, finish the Onboarding Form and schedule your Kick-Off Call."
                                            : "Your answers are submitted. If you haven't already, schedule your Kick-Off Call — we recommend having all key decision-makers present so we can move quickly and decisively."}
                                    </p>
                                    <div className="mt-8 flex flex-wrap items-center gap-3">
                                        <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer" className={cx(okBtnCls, "rounded-xl px-7 py-3")}>
                                            Book My Kick-Off Call
                                            <ArrowRight className="size-5" aria-hidden="true" />
                                        </a>
                                        <button
                                            type="button"
                                            onClick={backToReview}
                                            className="rounded-lg px-4 py-2.5 text-md font-semibold text-secondary ring-1 ring-secondary transition duration-100 ease-linear hover:bg-secondary_hover"
                                        >
                                            Review your answers
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </AnimatePresence>

                {/* ── Back / next arrows — bottom right ── */}
                {!showReview && !editingFromReview && step.kind === "question" && (
                    <div className="absolute right-5 bottom-5 z-20 flex overflow-hidden rounded-lg shadow-sm ring-1 ring-secondary">
                        <button
                            type="button"
                            onClick={goBack}
                            title="Previous question"
                            className="flex size-10 items-center justify-center bg-brand-solid text-white transition duration-100 ease-linear hover:bg-brand-solid_hover"
                        >
                            <ArrowLeft className="size-4" aria-hidden="true" />
                        </button>
                        <span className="w-px bg-white/25" aria-hidden="true" />
                        <button
                            type="button"
                            onClick={goNext}
                            title="Next question"
                            className="flex size-10 items-center justify-center bg-brand-solid text-white transition duration-100 ease-linear hover:bg-brand-solid_hover"
                        >
                            <ArrowRight className="size-4" aria-hidden="true" />
                        </button>
                    </div>
                )}
            </div>
        </main>
    );
};

/** The Account Access Form — the same engine running the logins-and-billing questions. */
export const AccessFormPage = (props: Omit<ClientOnboardingFormPageProps, "form">) => <ClientOnboardingFormPage {...props} form={ACCESS_FORM} />;
