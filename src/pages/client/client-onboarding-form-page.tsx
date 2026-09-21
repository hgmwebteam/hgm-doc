import { type ChangeEvent, type ReactNode, useEffect, useRef, useState } from "react";
import {
    AlertCircle,
    ArrowLeft,
    ArrowRight,
    Check,
    Home02,
    Lock01,
    Mail01,
    Microphone01,
    Plus,
    Receipt,
    Settings01,
    Star01,
    Users01,
    VideoRecorder,
    XClose,
} from "@untitledui/icons";
import { AnimatePresence, motion } from "motion/react";
import { MediaAnswer, type MediaKind, RecordingPlayer } from "@/components/application/media-answer";
import { supabase } from "@/lib/supabase";
import { KICKOFF_CALENDLY } from "@/pages/client/dashboard/dashboard-navigation";
import { cx } from "@/utils/cx";

/**
 * Host Onboarding Form (/{client}-onboarding) — the FIRST form a new client
 * fills in, before the Brand Vision Form. In-app version of the team's
 * "Host Onboarding Form" Google Form (6 pages / 27 questions, all free-text),
 * same Typeform-style engine as the Brand Vision Form: one question per
 * screen, Enter to advance, autosave, review-of-answers after submit.
 * The final step links the client to Dustin's Calendly for the Kick-Off Call.
 * Persists to client_onboarding_pages (slug = "{client}-onboarding").
 */

/* The Kick-off booking page is one URL, owned by dashboard-navigation.ts — the journey
   step and this form's thank-you screen both link it, and it used to be written out
   twice. Two copies of a booking URL is one wrong booking URL waiting to happen. */
const CALENDLY_URL = KICKOFF_CALENDLY;

/* ── Form content — verbatim from the Google Form ── */

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
};

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

const SECTIONS: SectionDef[] = [
    {
        id: "basics",
        title: "The Basics",
        subtitle: "Email, business name & website",
        icon: Mail01,
        questions: [
            { field: "email", label: "Email", required: true, email: true, placeholder: "you@email.com" },
            { field: "businessName", label: "Business Name", required: true },
            { field: "websiteUrl", label: "Website URL", required: true, placeholder: "https://…" },
        ],
    },
    {
        id: "business",
        title: "About Your Business",
        subtitle: "Positioning, guest profile & growth objectives",
        icon: Star01,
        intro: "This section helps us understand your positioning, guest profile, and growth objectives.",
        questions: [
            {
                field: "targetGuest",
                label: "Describe your target guest",
                hint: "Who are they? Consider demographics, income level, travel motivations, lifestyle, and booking behavior. The clearer this is, the stronger our targeting and messaging will be.",
                required: true,
                long: true,
            },
            {
                field: "uniqueExperience",
                label: "What unique experience do your stays offer?",
                hint: "Why do guests choose you over other options? Think beyond amenities — what emotional or experiential outcome are they booking?",
                required: true,
                long: true,
            },
            {
                field: "locationDescription",
                label: "How do you describe your location to potential guests?",
                hint: "E.g. “Smoky Mountains,” “Emerald Coast,” “Downtown Scottsdale,” etc.",
                required: true,
            },
            {
                field: "competitors",
                label: "Which vacation rental brands or competitors do you admire?",
                hint: "Share 2–4 examples and explain what stands out (branding, pricing, positioning, design, guest experience, etc.).",
                required: true,
                long: true,
            },
            {
                field: "businessGoals",
                label: "What are your primary business goals over the next 6–12 months?",
                hint: "E.g., increase occupancy in slow season, reduce OTA dependency, increase average daily rate, expand to new properties.",
                required: true,
                long: true,
            },
            {
                field: "marketInsights",
                label: "Are there any insights about your market that would help us?",
                hint: "Seasonality trends, competitive pressure, pricing challenges, occupancy patterns, local regulations, etc.",
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
        id: "accounts",
        title: "Account Setup",
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
                    options: ["Guesty", "Hostaway", "Hospitable", "OwnerRez", "Lodgify", "Streamline", "No PMS"],
                    otherPlaceholder: "Name your PMS",
                },
            },
            { field: "airbnbUrl", label: "Link to Your Airbnb Profile", placeholder: "https://airbnb.com/…" },
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
            {
                field: "businessAddress",
                label: "Business Address",
                hint: "Full address required for account setup and platform integrations (street number & name, city, state, and ZIP code).",
                long: true,
            },
        ],
    },
    {
        id: "stays",
        title: "About Your Stays",
        subtitle: "The raw material for your Master Brand Document",
        icon: Home02,
        intro: "This section will contribute to our creation of your Master Brand Document — our internal source of truth for messaging, content, and user engagement.",
        questions: [
            {
                field: "story",
                label: "Your Story (“About Us”)",
                hint: "Share your background and why you started hosting. What do you value? What makes your approach different? What do you want guests to feel when they stay with you? We'll refine and elevate the messaging — we just need the raw material.",
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
            { field: "guestContactEmail", label: "Guest Contact Email", email: true, placeholder: "guests@yourbusiness.com" },
        ],
    },
    {
        id: "communication",
        title: "Communication",
        subtitle: "How we'll work together",
        icon: Users01,
        intro: "We believe the best results come from clear communication and strong collaboration. We use Google Chat as our primary channel for updates, approvals, and coordination.",
        questions: [
            {
                field: "chatEmails",
                label: "Email addresses to add to our Google Chat group",
                hint: "Please list the email addresses of any team members who should be involved in ongoing communication, updates, or approvals.",
                required: true,
                list: { itemPlaceholder: "name@company.com", addLabel: "Add another person", rows: 3 },
            },
            {
                field: "decisionMakers",
                label: "Who are the key decision-makers?",
                hint: "Outline your team structure and identify who has final approval authority.",
                required: true,
                long: true,
            },
            {
                field: "aboutYou",
                label: "About You (optional but encouraged)",
                hint: "We value long-term partnerships. Please share anything that helps us better understand you — your background, strengths/weaknesses, values, long-term vision, or personal motivations behind your business.",
                long: true,
            },
            { field: "notes", label: "Additional Notes (optional)", hint: "Anything else we should know before we begin?", long: true },
        ],
    },
    {
        // Last section on purpose: this is invoicing admin, not something that blocks the
        // Kick-Off Call, and the team's own ask for it says "no rush".
        id: "billing",
        title: "Billing & Legal",
        subtitle: "What we need to invoice you",
        icon: Receipt,
        intro: "The last bit of admin — the details we need to invoice you correctly. Nothing here blocks your Kick-Off Call.",
        questions: [
            {
                field: "legalBusinessName",
                label: "Legal Business Name",
                hint: "The registered entity name, exactly as it appears on your incorporation or tax documents. This is often different from the trading name you gave in The Basics.",
                required: true,
            },
            {
                field: "billingPhone",
                label: "Phone Number",
                hint: "The best number for billing and account questions.",
                required: true,
                placeholder: "+1 555 123 4567",
            },
            {
                field: "billingAddress",
                label: "Full Billing Address",
                // Deliberately separate from `businessAddress` in Account Setup: that one
                // exists for platform/account integrations and doesn't ask for country.
                // Cross-referenced so nobody has to retype the same address.
                hint: "Street, city, state, ZIP and country. If it's the same address you gave under Account Setup, just write “Same as business address”.",
                required: true,
                long: true,
            },
            {
                // Not required — "if applicable" in the team's ask, and plenty of hosts
                // operate without one.
                field: "taxId",
                label: "Tax ID (if applicable)",
                hint: "EIN, VAT number or local equivalent. Leave blank if you don't have one.",
            },
        ],
    },
];

type Step =
    | { kind: "welcome" }
    | { kind: "question"; q: Question; sectionTitle: string; sectionIntro?: string; icon: typeof Mail01; num: number }
    | { kind: "thankyou" };

const QUESTION_STEPS = SECTIONS.flatMap((s) =>
    s.questions.map((q, i) => ({ q, sectionTitle: s.title, sectionIntro: i === 0 ? s.intro : undefined, icon: s.icon })),
);
const STEPS: Step[] = [{ kind: "welcome" }, ...QUESTION_STEPS.map((x, i) => ({ kind: "question" as const, ...x, num: i + 1 })), { kind: "thankyou" }];
export const TOTAL_QUESTIONS = QUESTION_STEPS.length;

/**
 * Which logins the form is going to ask for, derived from the questions themselves so
 * the warning cannot drift from what is actually asked — three credential questions
 * were removed the day this was written.
 *
 * Said up front on purpose: a host who meets the first password screen unprepared goes
 * to find it, loses the thread, and abandons a half-finished form. Better to send them
 * to their password manager before they start.
 */
export const CREDENTIAL_LABELS = SECTIONS.flatMap((sec) =>
    sec.questions
        .filter((q) => q.credentials)
        .map((q) => q.credentialLabel ?? q.label.replace(/\s*Login$/i, "").replace(/^Your\s+/i, "")),
);

/**
 * The same labels as one sentence fragment — commas with "and" before the last, no
 * Oxford comma, matching the rest of the site ("look, sound and feel").
 */
export const CREDENTIAL_LIST =
    CREDENTIAL_LABELS.length > 1
        ? `${CREDENTIAL_LABELS.slice(0, -1).join(", ")} and ${CREDENTIAL_LABELS[CREDENTIAL_LABELS.length - 1]}`
        : CREDENTIAL_LABELS.join("");

/**
 * The welcome copy, exported so the client dashboard's Onboarding Form section shows the
 * SAME words. It used to carry its own shorter blurb, which meant two places to edit and
 * two versions of the truth about what the form asks for.
 */
export const ONBOARDING_INTRO =
    "To ensure a smooth and efficient launch of your marketing funnel, please complete this form with as much detail as possible. Your responses help our team understand your business, branding and target audience so we can get started promptly.";
export const ONBOARDING_LEAD_TIME =
    "Please complete this form at least 12 hours before our scheduled call so our team can review your responses and prepare a customised strategy.";
export const ONBOARDING_SAVES_NOTE = "Your answers save as you go, so you can stop and come back to it.";

/**
 * Stated, not derived. An earlier version weighted each question by shape and came out
 * at 25–35 minutes, which is the honest figure for 28 questions including four
 * long-form answers — but it reads as a wall and puts hosts off before they start.
 * 10–15 is the deliberate editorial claim.
 *
 * Because it is a fixed string, it does NOT follow the question list: add or remove
 * questions and this has to be revisited by hand.
 */
export const ESTIMATE_LABEL = "about 10–15 minutes";

const THANKYOU_INDEX = STEPS.length - 1;
/** Step index of a question by its running number (welcome is step 0). */
const stepIndexOfQuestion = (num: number) => num;

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

const isAnswered = (q: Question, data: ClientOnboardingData) =>
    q.credentials
        ? !!(
              (data.answers[`${q.field}__user`] ?? "").trim() ||
              (data.answers[`${q.field}__pass`] ?? "").trim() ||
              (q.platform && (data.answers[q.platform.field] ?? "").trim())
          )
        : !!(data.answers[q.field] ?? "").trim() || hasMedia(q, data);

const DEFAULT_DATA: ClientOnboardingData = { answers: {} };

/**
 * Where a returning host picks back up. Prefers the question they were last on
 * (matched by field name, so a reordered questionnaire can't land them on the
 * wrong screen), then the first unanswered question, then question 1.
 */
const resumeStepIndex = (data: ClientOnboardingData) => {
    if (data.lastField) {
        const i = STEPS.findIndex((s) => s.kind === "question" && s.q.field === data.lastField);
        if (i > 0) return i;
    }
    const firstGap = STEPS.findIndex((s) => s.kind === "question" && !isAnswered(s.q, data));
    return firstGap > 0 ? firstGap : 1;
};

/** Progress summary for the dashboard's Onboarding Form card. */
export const clientOnboardingProgress = (partial?: Partial<ClientOnboardingData> | null) => {
    const data = mergeData(partial);
    const answered = QUESTION_STEPS.filter(({ q }) => isAnswered(q, data)).length;
    return { answered, total: TOTAL_QUESTIONS, submittedAt: data.submittedAt };
};

export type OnboardingAnswerLine = { text: string; secret?: boolean };
export type OnboardingAnswerRow = { field: string; label: string; lines: OnboardingAnswerLine[]; mediaPath: string; mediaKind: MediaKind | "" };
/** `icon` is the same one the form itself shows for the section, so the answers read back with the
    landmarks the client filled them in under. */
export type OnboardingAnswerSection = { id: string; title: string; icon: typeof Mail01; rows: OnboardingAnswerRow[] };

/**
 * Every answer, grouped by section — so the dashboard can show the filled-in form
 * inline instead of making the reader open the review screen. Built from the same
 * SECTIONS definition the form renders from, so a question added here can never go
 * missing there. Password lines are flagged `secret` so the caller can mask them.
 */
export const clientOnboardingAnswers = (partial?: Partial<ClientOnboardingData> | null): OnboardingAnswerSection[] => {
    const data = mergeData(partial);
    return SECTIONS.map((s) => ({
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
                if (platform) lines.push({ text: platform });
                if (handle) lines.push({ text: `Handle: ${handle}` });
                if (user) lines.push({ text: `Username: ${user}` });
                if (pass) lines.push({ text: pass, secret: true });
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

/** Read the client's row, provisioning it on first visit (mirrors ensureHostOnboardingForm). */
export const ensureClientOnboardingForm = async (args: {
    slug: string;
    clientName?: string;
    clientWebsite?: string;
}): Promise<Partial<ClientOnboardingData> | null> => {
    const read = async (): Promise<{ ok: true; data: Partial<ClientOnboardingData> | null } | { ok: false }> => {
        const { data: row, error } = await supabase.from("client_onboarding_pages").select("data").eq("slug", args.slug).maybeSingle();
        if (error) {
            console.error("[client onboarding read]", error);
            return { ok: false };
        }
        return { ok: true, data: (row as { data: Partial<ClientOnboardingData> | null } | null)?.data ?? null };
    };

    try {
        const existing = await read();
        if (!existing.ok) return null; // don't insert over a row we simply failed to read
        if (existing.data) return existing.data;

        const { error } = await supabase.from("client_onboarding_pages").insert({
            slug: args.slug,
            client_name: args.clientName?.trim() ?? "",
            client_website: args.clientWebsite?.trim() ?? "",
            data: DEFAULT_DATA,
        });
        if (error) {
            if (error.code !== "23505") {
                console.error("[client onboarding provision]", error);
                return null;
            }
            const raced = await read(); // someone else created it first
            return raced.ok ? (raced.data ?? {}) : null;
        }
        return DEFAULT_DATA;
    } catch (e) {
        console.error("[client onboarding provision]", e);
        return null;
    }
};

function validateStep(step: Step, data: ClientOnboardingData): string | null {
    if (step.kind !== "question") return null;
    if (step.q.credentials) {
        if (!step.q.required) return null;
        // Merged platform+login screens: the platform pick was its own required
        // question before the merge, so it stays required here.
        if (step.q.platform && !(data.answers[step.q.platform.field] ?? "").trim()) return "Please pick one";
        const user = (data.answers[`${step.q.field}__user`] ?? "").trim();
        const pass = (data.answers[`${step.q.field}__pass`] ?? "").trim();
        if (!user || !pass) return "Please fill in both the username and password";
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
            <label className="block">
                <span className="text-xs font-semibold tracking-wide text-quaternary uppercase">Password</span>
                <input type="text" placeholder="Password" value={pass} onChange={(e) => onChange(`${q.field}__pass`, e.target.value)} className={cls} />
            </label>
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
    data,
    clientName,
    onEdit,
    onClose,
}: {
    data: ClientOnboardingData;
    clientName: string;
    onEdit: (questionNum: number) => void;
    onClose: () => void;
}) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const answeredCount = QUESTION_STEPS.filter(({ q }) => isAnswered(q, data)).length;
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
                        {answeredCount} of {TOTAL_QUESTIONS}
                    </span>{" "}
                    answered
                    {data.submittedAt && (
                        <> · submitted {new Date(data.submittedAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}</>
                    )}
                </p>

                {SECTIONS.map((s) => (
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
    slug,
    initialClientName = "",
    initialData,
    embedded = false,
    onClose,
    startAtField,
}: ClientOnboardingFormPageProps) => {
    const isTemplate = !slug;
    const [data, setData] = useState<ClientOnboardingData>(() => mergeData(initialData));
    const hydratedRef = useRef(false);
    // A returning host lands straight on the review of their answers.
    const alreadySubmittedOnLoad = useRef(Boolean(slug && data.submittedAt));

    // Client copies open straight on question 1 (welcome stays reachable via Back;
    // the template still opens on it so the team can preview the intro).
    const [[stepIndex, direction], setStep] = useState<[number, 1 | -1]>(() => {
        const target = startAtField ? STEPS.findIndex((s) => s.kind === "question" && s.q.field === startAtField) : -1;
        if (target > 0) return [target, 1];
        return alreadySubmittedOnLoad.current ? [THANKYOU_INDEX, 1] : [slug ? resumeStepIndex(data) : 0, 1];
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
        setStep([stepIndexOfQuestion(num), -1]);
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
                        Host Onboarding Form
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
                        <ReviewScreen data={data} clientName={initialClientName} onEdit={editFromReview} onClose={closeReview} />
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
                                        Host Onboarding Form
                                    </h1>
                                    <p className="mt-4 max-w-xl text-md text-tertiary">{ONBOARDING_INTRO}</p>
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
                                        {TOTAL_QUESTIONS} questions · {ESTIMATE_LABEL}
                                    </p>
                                    <p className="mt-1 text-sm text-quaternary">{ONBOARDING_SAVES_NOTE}</p>
                                    {CREDENTIAL_LABELS.length > 0 && (
                                        <div className="mt-6 max-w-xl rounded-xl bg-secondary px-4 py-3 ring-1 ring-secondary">
                                            <p className="text-sm text-secondary">
                                                <span className="font-semibold text-primary">Worth having on hand:</span> This form asks for a few account
                                                logins so we can set things up for you — {CREDENTIAL_LIST}.
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
                                        Final step — book your Kick-Off Call 🚀
                                    </h1>
                                    <p className="mt-4 max-w-xl text-md text-tertiary">
                                        Your answers are submitted. If you haven't already, schedule your Kick-Off Call — we recommend having all key
                                        decision-makers present so we can move quickly and decisively.
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
