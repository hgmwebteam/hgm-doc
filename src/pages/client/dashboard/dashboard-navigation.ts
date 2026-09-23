/**
 * The dashboard's side-menu taxonomy and the onboarding journey.
 *
 * NAV_GROUPS mirrors the funnel walked on the onboarding call — Brand foundation feeds
 * Top of funnel, then Middle, then Bottom — and is the single source for the menu, the
 * phase eyebrow above each section heading, and which sections are team-only.
 */
import type { FC } from "react";
import {
    Announcement02,
    BookOpen01,
    Calendar,
    Camera01,
    ClipboardCheck,
    FileCheck02,
    Folder,
    Globe01,
    HelpCircle,
    Image01,
    Image03,
    LayoutAlt01,
    Mail01,
    MessageChatCircle,
    PlayCircle,
    Rocket02,
    Target04,
    TrendUp01,
    Users01,
} from "@untitledui-pro/icons/line";
import type { SectionId } from "@/pages/client/dashboard/dashboard-model";

/**
 * Side-menu groups — what the client actually needs to see, in the order they meet it:
 * the two forms we need from them, the brand work those produce, the marketing built on
 * top, then the reference material they keep coming back to.
 *
 * `num` is null throughout on purpose. This replaced a numbered Phase 1–5 taxonomy that
 * mirrored the team's Asana project: useful to us, but it asked the client to learn our
 * internal process to find a page. Grouping is now by what a thing IS. The team's phase
 * tracking still lives on /home and the Client List, driven by clients.onboarding_phase —
 * this only changes what the client is shown.
 *
 * `bg`/`text` are kept because SectionEyebrow still renders a group pill above each
 * section body.
 */
export const PHASES = {
    // "Your forms", not "Client input": the client reading this dashboard would be looking at a
    // category named after their role in our process. Every label here is read by them first.
    input: { num: null, label: "Your forms", bg: "bg-utility-indigo-50", text: "text-utility-indigo-700" },
    brandwork: { num: null, label: "Brand foundation", bg: "bg-brand-secondary", text: "text-brand-secondary" },
    marketing: { num: null, label: "Marketing", bg: "bg-utility-purple-50", text: "text-utility-purple-700" },
    resources: { num: null, label: "Resources", bg: "bg-success-secondary", text: "text-success-primary" },
} as const;
export type PhaseId = keyof typeof PHASES;

/** Funnel model — still how the Overview explains the moving parts, independent of phases. */
/**
 * The client's journey, as Overview presents it — one ordered timeline from the first
 * form to a finished website. Replaced a "Your setup" tracker plus a funnel explainer:
 * the tracker was a subset of these steps, and two of the four funnel cards pointed at
 * Website and GoHighLevel, sections that are no longer on the client's menu.
 *
 * `auto` steps read their real state (submitted forms) and are never ticked by hand, so a
 * tick can't disagree with the answer count shown right next to it. Everything else is an
 * AM tick stored in content.journey_done — calls and reviews happen off-platform and
 * there is nothing to infer them from.
 */
export type JourneyStepId = "chat" | "form" | "kickoff" | "call" | "vision" | "masterdoc" | "brandkit" | "funnel" | "resources" | "launch";

/** Dustin's strategy-call booking page, linked from the Kick-off Call step. */
export const KICKOFF_CALENDLY = "https://calendly.com/dustin-d-baker/strategy";

/** Scribe walkthrough for the clients who can't work out how to join Google Chat on their own. */
const GOOGLE_CHAT_GUIDE = "https://scribehow.com/o/AYYQm0qaSdqzluh6vDb1dw/viewer/How_To_Use_Google_Chat__WhkIl2H5Rcaf4YUKBNzOZQ";

/**
 * A per-client URL a journey step points at, named rather than embedded so one step
 * definition serves every client. The dashboard resolves these from the row:
 * `chat` → content.chat_link, `folder` → content.brand.folder_link,
 * `onboarding_call` → content.onboarding_call_url.
 *
 * Unset resolves to "", and the step renders its line WITHOUT a button rather than a
 * button that goes nowhere. The Onboarding Call has no shared fallback on purpose: the
 * booking page belongs to the client's own Account Manager, so one hardcoded URL would
 * send every client to the same person.
 */
export type JourneyLink = "chat" | "folder" | "onboarding_call";

export const JOURNEY_STEPS: {
    id: JourneyStepId;
    label: string;
    /** Step-level summary line. Omit when the item(s) below already say everything needed. */
    detail?: string;
    icon: FC<{ className?: string }>;
    /** Section this step jumps to, when it has one. */
    to?: SectionId;
    /** Derived from real data instead of ticked. */
    auto?: boolean;
    /** External link this step offers (booking pages and the like). */
    href?: string;
    /** Per-client booking URL for this step's own button — see JourneyLink. */
    hrefFrom?: JourneyLink;
    hrefLabel?: string;
    /** Step that must be done before `href` is offered. */
    requires?: JourneyStepId;
    /** Overrides the generic "Available once {requires step} is done" line, when set. */
    blockedNote?: string;
    /** A how-to guide, offered beside the step's own action for clients who get stuck. */
    helpHref?: string;
    helpLabel?: string;
    /**
     * What the CLIENT reads while `hrefFrom` has no URL on their row yet. Per-step because
     * the generic line can't tell them what to do instead — that depends on the step.
     */
    pendingNote?: string;
    /**
     * Sub-items: the several separate things one step actually asks for.
     *
     * Tickable only where `itemsTickable` says so. The default is deliberate: most of
     * these are states the app cannot observe — whether a client is logged in to TikTok
     * is not ours to know — and an empty box against a job they already did reads as a
     * failure. A step only earns tick boxes when the team itself is the one doing the
     * observing, which today means the funnel reviews.
     */
    items?: {
        /**
         * Stable id, required once the step is `itemsTickable`. Stored as
         * `${stepId}:${itemId}` in content.journey_done, so an item keeps its tick
         * through a reorder or a relabel — the same reason steps are stored by id.
         */
        id?: string;
        label: string;
        note?: string;
        link?: JourneyLink;
        action?: string;
        /** Section this item opens, for items that ARE a section of the dashboard. */
        to?: SectionId;
        /** This piece's own estimate — see the step's `eta`. The funnel lands piece by piece. */
        eta?: string;
    }[];
    /**
     * When a client can expect this, counted from the Kick-off Call — "Week 1", "Week 4".
     *
     * Relative, never a date: a client who books their call three weeks late would read a
     * stored date as us being late, and nobody would remember to re-type it. Set only on
     * the things we deliver; a step waiting on the client has no estimate to give, and the
     * step drops it once done, since an estimate on a finished thing is noise.
     */
    eta?: string;
    /** Heading above `items`, when the list needs naming. */
    itemsTitle?: string;
    /**
     * Each item is ticked on its own by an AM, and the step is done when all of them are.
     * The launch meter weights such a step by its item count, so every single tick moves
     * the bar instead of five reviews landing as one jump at the end.
     */
    itemsTickable?: true;
}[] = [
    {
        id: "chat",
        label: "Join the Google Chat group",
        detail: "This is our primary channel for updates — please join as soon as possible to stay in the loop on progress.",
        icon: MessageChatCircle,
        hrefFrom: "chat",
        hrefLabel: "Open chat",
        helpHref: GOOGLE_CHAT_GUIDE,
        helpLabel: "Need help joining?",
        pendingNote: "Your Account Manager will add the link shortly — please continue to the next step and fill in the Onboarding Form.",
    },
    {
        id: "form",
        label: "Fill in the Onboarding Form",
        detail: "Your business details and the logins we need.",
        icon: ClipboardCheck,
        to: "intake",
        auto: true,
    },
    {
        id: "kickoff",
        label: "Kick-off Call",
        detail: "Pick a time that suits you and we'll take it from there.",
        icon: Calendar,
        // Booking opens only once the Onboarding form is in — the call is only useful if the
        // team has had time to read the answers, which is why the form says to complete it
        // at least 12 hours beforehand. Until then the step explains what's blocking it
        // rather than offering a link that leads to a wasted call.
        href: KICKOFF_CALENDLY,
        hrefLabel: "Book your call",
        requires: "form",
        blockedNote: "Available once the Onboarding Form is complete",
    },
    {
        id: "vision",
        label: "Fill in the Brand Vision Form",
        detail: "How your brand should look, sound and feel.",
        icon: FileCheck02,
        to: "onboarding",
        auto: true,
    },
    {
        // The one thing the post-Kick-off email still asks for beyond the Google Chat group,
        // which is now its own step at the top of the journey. The old detail line read
        // "Folder of content, plus the Brand Kit document" — but no Brand Kit document
        // link exists, and at this point in the journey the Brand Kit hasn't been built.
        //
        // No `to: "contentfolder"` any more: the folder is the item below, and a step-level
        // "Open" button pointing at the same URL just asks the client which of two identical
        // buttons to press.
        id: "resources",
        label: "Add your resources",
        icon: Folder,
        items: [
            {
                // Brand assets share the content folder rather than sitting in an item of their
                // own: a second item would carry a second "Open your folder" button to the very
                // same URL, and the client would have to guess which one to press.
                label: "Upload your photos, videos and brand assets",
                note: "Please upload your photos and videos, including listing photos, drone footage, and any other assets. Add any brand material you already have too — fonts, graphics, logos and colours. Our team will take it from there.",
                link: "folder",
                action: "Open your folder",
            },
        ],
    },
    {
        id: "call",
        label: "Onboarding Call",
        detail: "Book your onboarding call using the link below. Please join with a good Wi-Fi connection, and keep your phone and email handy so you can grab verification codes and approve access as your account manager walks you through it.",
        icon: Users01,
        hrefFrom: "onboarding_call",
        hrefLabel: "Book your onboarding call",
        requires: "vision",
        itemsTitle: "Have these ready before the call",
        // Every login here is already asked for by the Onboarding form, so the wording is
        // "logged in", not "have your password". Facebook especially: we need the client
        // signed in to their own business page so they can add us as a user on the call —
        // we never ask for their Facebook password, and the form no longer asks either.
        items: [
            { label: "Instagram", note: "Logged in on the laptop you'll join from." },
            {
                label: "Facebook",
                note: "Logged in to your business page, so you can add us as a user. We never ask for your Facebook password.",
            },
            { label: "TikTok", note: "Logged in, if you use it." },
            { label: "Domain", note: "Logged in wherever your domain is registered." },
            {
                label: "Credit card",
                note: "Have it on hand — we set up your Facebook ad account during the call and Meta requires a payment method.",
            },
            {
                label: "Netlify",
                note: "We'll walk you through creating an account on the call. Your landing page will be hosted there, which lets us set up proper tracking.",
            },
            { label: "Zoom", note: "Installed on your computer, so we can ask you to share your screen." },
        ],
    },
    {
        id: "masterdoc",
        label: "Review the Master Brand",
        detail: "Hosts, personas, properties and brand voice — the foundation everything else is built on.",
        icon: FileCheck02,
        to: "foundation",
        eta: "Week 1",
    },
    { id: "brandkit", label: "Review the Brand Kit", detail: "Colours, fonts and logo.", icon: Image01, to: "brand", eta: "Week 1" },
    {
        // No `detail` line: it listed the same five pieces the items below now name one
        // by one, so it only said everything twice.
        //
        // The one step that is really five. Each piece is built, sent and reviewed on its
        // own over several weeks, so a single tick at the end left a client watching the
        // longest stretch of their journey with nothing moving. Ticked per item instead,
        // and the step falls out of the five.
        //
        // No step-level `to` any more: every item now opens its own section, and a sixth
        // Open button landing on one arbitrary one of the five only asks the client which
        // button they were supposed to press. Item ids are the SectionIds on purpose —
        // these items ARE those sections.
        id: "funnel",
        label: "Review the marketing funnel",
        icon: Mail01,
        itemsTickable: true,
        items: [
            // Landing Page carries no estimate yet — the team has not set one, and an
            // invented week is a promise to a client. Add it here when they have.
            { id: "landing", label: "Landing Page", to: "landing" },
            { id: "flow", label: "Welcome Flow", to: "flow", eta: "Week 3" },
            { id: "pinnedposts", label: "Pinned Posts", to: "pinnedposts", eta: "Week 3" },
            { id: "pinnedstories", label: "Pinned Stories", to: "pinnedstories", eta: "Week 2" },
            { id: "reels", label: "Example Reels", to: "reels", eta: "Week 3" },
        ],
    },
    {
        // Closes the journey on what the client actually signed up for, rather than on a
        // task of theirs. Nothing on the dashboard can observe a launch, so an AM ticks it.
        //
        // Replaced "Set up the website", dropped in 2026-09: the AI website is no longer
        // offered to every client as a matter of course, the team approaches the ones they
        // want to build for. The Setup Guide section stays — its Netlify card is required
        // of everyone.
        //
        // Being last, this is the step the launch meter's rocket rides on, so it is the
        // one bar cell that wears no name at all.
        id: "launch",
        label: "Marketing Launch",
        detail: "It's go time! Ads running, content posting, emails sending. Now we let the data come in and optimize from there.",
        icon: Rocket02,
        eta: "Week 4",
    },
];

/**
 * The four stages the launch meter groups the journey under, and the steps in each.
 *
 * Not the same taxonomy as NAV_GROUPS: the menu is organised by where a thing LIVES on the
 * dashboard, this is organised by what a client is doing at the time. "Get started" is
 * deliberately wider than its name — it holds both calls and the asset upload as well as
 * the two forms, because those all happen in the same opening stretch and a client who has
 * booked their kick-off should not be looking at a stage still called "forms".
 *
 * Stage membership is by step id, so a reorder inside a stage costs nothing. Every journey
 * step must appear in exactly one stage — dashboard-navigation.check.ts enforces that,
 * since a step missing from here would quietly stop counting towards launch.
 */
export const JOURNEY_STAGES: { id: string; label: string; steps: JourneyStepId[] }[] = [
    { id: "start", label: "Get started", steps: ["chat", "form", "kickoff", "vision", "resources", "call"] },
    { id: "foundation", label: "Brand foundation", steps: ["masterdoc", "brandkit"] },
    { id: "funnel", label: "Marketing funnel", steps: ["funnel"] },
    { id: "live", label: "Live", steps: ["launch"] },
];

/**
 * ── The launch meter's own cells ──
 *
 * The bar is a summary of the journey, not a mirror of it. The step list below it is the
 * client's checklist and carries everything; the bar carries only what a client would call
 * a milestone, because fourteen cells across one bar left every name abbreviated to the
 * point of being a guess ("VISION", "POSTS", "MASTER").
 *
 * So two things differ from JOURNEY_STEPS on purpose:
 *
 *  - Joining the Google Chat group is not on the bar. It is a two-minute setup task, not
 *    a milestone, and it was taking a fourteenth of the run to launch.
 *  - The two intake forms share one cell. A client thinks of them as "the forms"; the cell
 *    fills through both, so answering half of either still moves the bar.
 *
 * Names are written out in full — no abbreviations. A cell over a single tickable step
 * expands instead into one cell per piece, named by the piece, which is what makes
 * Marketing funnel the long stage.
 *
 * `stage` is a JOURNEY_STAGES id; dashboard-navigation.check.ts holds every cell to a real
 * stage and every step named here to a real step, so a rename cannot quietly empty the bar.
 */
export const JOURNEY_BAR: { id: string; label: string; stage: string; steps: JourneyStepId[] }[] = [
    { id: "forms", label: "Forms", stage: "start", steps: ["form", "vision"] },
    { id: "kickoff", label: "Kickoff Call", stage: "start", steps: ["kickoff"] },
    { id: "resources", label: "Assets", stage: "start", steps: ["resources"] },
    { id: "call", label: "Onboarding Call", stage: "start", steps: ["call"] },
    { id: "masterdoc", label: "Master Brand", stage: "foundation", steps: ["masterdoc"] },
    { id: "brandkit", label: "Brand Kit", stage: "foundation", steps: ["brandkit"] },
    // Expands into its five reviews, each named by the item: Landing Page, Welcome Flow,
    // Pinned Posts, Pinned Stories, Example Reels.
    { id: "funnel", label: "Marketing Funnel", stage: "funnel", steps: ["funnel"] },
    // Last, so it wears the rocket and draws no name.
    { id: "launch", label: "Launch", stage: "live", steps: ["launch"] },
];

/**
 * ── Journey completion, as stored ──
 *
 * All of it is ids in `content.journey_done`, never positions: the journey has been
 * reordered twice, and a client's recorded progress has to survive the next one.
 *
 * A step ticked piece by piece stores one key per piece, `${stepId}:${itemId}`. The bare
 * step id is still honoured wherever those keys are read, because rows ticked before the
 * funnel was broken into five carry only "funnel" — reading it as "not started" would
 * un-finish a step for every client who already got there.
 *
 * Pure and free of React on purpose: dashboard-navigation.check.ts exercises these, and
 * the legacy-row cases below are exactly the kind that corrupt a client's progress
 * quietly if they ever drift.
 */
export const journeyItemKey = (stepId: JourneyStepId, itemId: string) => `${stepId}:${itemId}`;

/** A step's item ids, falling back to the label for an item that never needed one. */
export const journeyItemIds = (stepId: JourneyStepId): string[] =>
    (JOURNEY_STEPS.find((s) => s.id === stepId)?.items ?? []).map((item) => item.id ?? item.label);

export const isJourneyItemDone = (done: readonly string[], stepId: JourneyStepId, itemId: string) =>
    done.includes(stepId) || done.includes(journeyItemKey(stepId, itemId));

/**
 * The step-level tick.
 *
 * For a step made of tickable items this is only the all-at-once shortcut — the step has
 * no state of its own, so it writes the item keys rather than the step id. Clearing has to
 * drop the legacy bare id as well, or every item would read done again the moment it did.
 */
export const toggleJourneyStepDone = (done: readonly string[], stepId: JourneyStepId): string[] => {
    const step = JOURNEY_STEPS.find((s) => s.id === stepId);
    if (step?.itemsTickable && step.items?.length) {
        const keys = journeyItemIds(stepId).map((itemId) => journeyItemKey(stepId, itemId));
        const allDone = done.includes(stepId) || keys.every((k) => done.includes(k));
        const without = done.filter((x) => x !== stepId && !keys.includes(x));
        return allDone ? without : [...without, ...keys];
    }
    return done.includes(stepId) ? done.filter((x) => x !== stepId) : [...done, stepId];
};

/**
 * One item's tick.
 *
 * On a legacy row the bare step id is expanded into the other items' keys first: dropping
 * it alone would untick all five when the AM asked to untick one.
 */
export const toggleJourneyItemDone = (done: readonly string[], stepId: JourneyStepId, itemId: string): string[] => {
    const key = journeyItemKey(stepId, itemId);
    if (done.includes(stepId)) {
        const others = journeyItemIds(stepId)
            .map((id) => journeyItemKey(stepId, id))
            .filter((k) => k !== key);
        return [...done.filter((x) => x !== stepId), ...others];
    }
    return done.includes(key) ? done.filter((x) => x !== key) : [...done, key];
};

/** Sits above the funnel groups — not a funnel stage itself, just "home" (hero + the funnel explainer). */
export const OVERVIEW_ITEM = { id: "overview" as const, label: "Overview", icon: LayoutAlt01 };

/**
 * Side-menu groups: Client Input first, then the five onboarding phases.
 *
 * The phases mirror the team's Asana onboarding project and ONBOARDING_PHASES in
 * dashboard-screen.tsx (which /home tracks per client), so the client now sees the
 * same journey the team runs. Client Input stays pinned above them: those two forms
 * are what every phase is built from, and the client should never hunt for the one
 * thing we need from them.
 *
 * "Signing On" (phase 0) is deliberately absent — by the time this dashboard exists,
 * it's done.
 */
export const NAV_GROUPS: {
    label: string;
    phase: PhaseId;
    /** Shown on the group row, so a collapsed menu still says what each group is. */
    icon?: typeof LayoutAlt01;
    items: {
        id: SectionId;
        label: string;
        icon: typeof LayoutAlt01;
        soon?: boolean;
        to?: string;
        /**
         * Never rendered for a client — not as a row, not as "Soon", not as anything.
         *
         * Different from the eye-toggle reveal every other row uses. Those are things the
         * client will eventually see and are merely not ready; this is a row whose contents
         * are about the client rather than for them, so there is nothing to reveal later and
         * no eye offered in edit mode.
         */
        teamOnly?: boolean;
    }[];
}[] = [
    {
        label: "Your forms",
        phase: "input",
        icon: ClipboardCheck,
        items: [
            { id: "intake", label: "Onboarding Form", icon: ClipboardCheck },
            { id: "onboarding", label: "Brand Vision Form", icon: FileCheck02 },
        ],
    },
    {
        label: "Brand foundation",
        phase: "brandwork",
        icon: FileCheck02,
        items: [
            { id: "overviewdoc", label: "Overview Document", icon: ClipboardCheck, teamOnly: true },
            { id: "foundation", label: "Master Brand", icon: FileCheck02 },
            { id: "brand", label: "Brand Kit", icon: Image01 },
        ],
    },
    {
        label: "Marketing",
        phase: "marketing",
        icon: Announcement02,
        items: [
            { id: "landing", label: "Landing Page", icon: Globe01 },
            { id: "flow", label: "Welcome Flow", icon: Mail01 },
            { id: "pinnedposts", label: "Pinned Posts", icon: Camera01 },
            { id: "pinnedstories", label: "Pinned Stories", icon: Image03 },
            { id: "reels", label: "Example Reels", icon: PlayCircle },
        ],
    },
    {
        label: "Resources",
        phase: "resources",
        icon: Folder,
        items: [
            // A link, not a section: opens the client's own content drive, and falls
            // back to "Soon" until the folder link exists.
            { id: "contentfolder", label: "Folder of Content", icon: Folder },
            // A real section since 2026-09: the required Netlify account plus the AI
            // website opt-in (website-setup-section.tsx). It used to be a link straight
            // to the client's owner guide; the section now links there itself, once one
            // exists. Shortened twice for the 276px sidebar: "Website Setup — Owner guide"
            // truncated to "Website Setup — Ow…", then "Website Setup Guide" to
            // "Website Setup Gui…".
            { id: "ownerguide", label: "Setup Guide", icon: BookOpen01 },
            // A link, not a section: the client help centre at /{slug}/help, where a request
            // becomes a ticket with a named owner. Last row in the menu on purpose - it is
            // what a client reaches for when something is wrong with anything above it.
            { id: "help", label: "Help Centre", icon: HelpCircle },
        ],
    },
];

/**
 * Sections that still exist and render, but are deliberately off the side menu.
 *
 * Their data is untouched in Supabase and they stay in SECTIONS, so `#hash` deep links
 * and the sidebar search still reach them, and Overview's funnel cards still jump to
 * them. Moving one back onto the menu is a single line in NAV_GROUPS — nothing here is
 * a one-way door.
 */
export const HIDDEN_ITEMS: { id: SectionId; label: string; icon: typeof LayoutAlt01 }[] = [
    { id: "website", label: "Website", icon: Globe01 },
    { id: "instagram", label: "Instagram", icon: Camera01 },
    { id: "chatwidget", label: "Chat Widget", icon: MessageChatCircle },
    { id: "ghl", label: "GoHighLevel Setup", icon: Target04 },
    { id: "videos", label: "Video Guides", icon: PlayCircle },
    { id: "revenue", label: "Revenue & Results", icon: TrendUp01 },
    { id: "comms", label: "Communication Log", icon: MessageChatCircle },
];

/**
 * Menu rows that are links OUT rather than sections on this page.
 *
 * Both are in SECTIONS and in the search index, because a client should be able to find
 * them by name, but neither has a body to switch to: "contentfolder" opens the client's
 * drive and "help" navigates to /{slug}/help. Anything that turns a row into a view has to
 * ask about this set first - setting activeSection to one of these renders an empty content
 * area with no way back except the menu.
 */
export const LINK_ONLY_SECTIONS = new Set<SectionId>(["contentfolder", "help"]);

/** Which group a section belongs to — drives the eyebrow above each section body. */
export const phaseOfSection = (id: SectionId): PhaseId | null => NAV_GROUPS.find((g) => g.items.some((i) => i.id === id))?.phase ?? null;

export const SECTIONS = [OVERVIEW_ITEM, ...NAV_GROUPS.flatMap((g) => g.items), ...HIDDEN_ITEMS];

/**
 * Sections a client can never reach, by any route.
 *
 * Derived from the nav rather than hand-listed so adding a `teamOnly` row can't leave the
 * search box or a pasted deep link as a way in that somebody forgot to close.
 */
export const TEAM_ONLY_SECTIONS = new Set<SectionId>(NAV_GROUPS.flatMap((g) => g.items.filter((i) => i.teamOnly).map((i) => i.id)));

/**
 * The sections an AM can grant to one person, grouped as they appear in the side menu.
 *
 * Derived from the nav for the same reason TEAM_ONLY_SECTIONS is: a row added to the menu
 * shows up here automatically, and a `teamOnly` row can never be offered by mistake.
 *
 * HIDDEN_ITEMS is deliberately left out. Those sections aren't on anybody's menu, so an AM
 * choosing what one person sees has no reason to meet them — and the effect of omitting
 * them is the safe one: a person on a custom list simply never gets Revenue, Website or the
 * rest, by search or `#hash` either. They still reach anyone left on the dashboard default,
 * which is where `client_visible` and the eye toggles already govern them.
 */
export const ASSIGNABLE_SECTION_GROUPS: { label: string; items: { id: SectionId; label: string; soon?: boolean }[] }[] = NAV_GROUPS.map((g) => ({
    label: g.label,
    items: g.items.filter((i) => !i.teamOnly).map((i) => ({ id: i.id, label: i.label, soon: i.soon })),
}));

export type SearchHit = { id: SectionId; label: string; sub?: string };
