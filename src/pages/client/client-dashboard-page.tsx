import { type ChangeEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
// Functional UI icons — Untitled UI PRO, line style (drop-in for the free set).
import {
    AlertTriangle,
    ArrowDown,
    ArrowRight,
    ArrowUp,
    ArrowUpRight,
    Calendar,
    Camera01,
    Check,
    CheckCircle,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ClipboardCheck,
    Copy01,
    Download01,
    Edit01,
    FileCheck02,
    HelpCircle,
    Image01,
    LinkExternal01,
    MessageChatCircle,
    Moon01,
    Palette,
    Plus,
    RefreshCw01,
    Stars02,
    Sun,
    Trash01,
    Type01,
    UploadCloud02,
    XClose,
} from "@untitledui-pro/icons/line";
import { motion } from "motion/react";
import { useNavigate, useSearchParams } from "react-router";
import { Bar, BarChart, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { ChartTooltipContent } from "@/components/application/charts/charts-base";
import { LandingPageSection } from "@/components/application/landing-page-section";
import { PinnedStoriesSection } from "@/components/application/pinned-stories-section";
import { VideoAttach, VideoEmbed } from "@/components/application/video-block";
import { WelcomeFlowSection } from "@/components/application/welcome-flow";
import { Badge, BadgeWithDot, BadgeWithIcon } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { ProgressBarCircle } from "@/components/base/progress-indicators/progress-circles";
import { ProgressBar } from "@/components/base/progress-indicators/progress-indicators";
import { FeaturedIcon } from "@/components/foundations/featured-icon/featured-icon";
import { Instagram } from "@/components/foundations/social-icons";
import { ImageLightbox } from "@/components/shared-assets/image-lightbox";
import { Reveal } from "@/components/shared-assets/reveal";
import { useAuthUser } from "@/hooks/use-auth-user";
import { useEditShortcuts } from "@/hooks/use-edit-shortcuts";
import { recordDashboardSave } from "@/lib/dashboard-updates";
import { type DashboardContent, type HostOnboardingData, type OverviewDoc, supabase } from "@/lib/supabase";
import {
    ACCESS_FORM,
    ACCESS_INTRO,
    AccessFormPage,
    CREDENTIAL_LABELS,
    CREDENTIAL_LIST,
    type ClientOnboardingData,
    ClientOnboardingFormPage,
    ESTIMATE_LABEL,
    ONBOARDING_INTRO,
    ONBOARDING_LEAD_TIME,
    ONBOARDING_SAVES_NOTE,
    TOTAL_QUESTIONS,
    clientOnboardingAnswers,
    clientOnboardingProgress,
    ensureAccessForm,
    ensureClientOnboardingForm,
    withLoginCleared,
} from "@/pages/client/client-onboarding-form-page";
import { AutomationBrandingCard } from "@/pages/client/dashboard/automation-branding-card";
import { type BrandKitDraft, BrandKitDraftReview } from "@/pages/client/dashboard/brand-kit-draft";
import { brandKitCss, brandKitFileName, brandKitHasContent } from "@/pages/client/dashboard/brand-kit-export";
import { BrandPreview } from "@/pages/client/dashboard/brand-kit-preview";
import { ShadeScales } from "@/pages/client/dashboard/brand-kit-shades";
import { TypeScale, TypographyCards } from "@/pages/client/dashboard/brand-kit-typography";
import { readableTextOn, rgbString, wcagLabel } from "@/pages/client/dashboard/color-scale";
import {
    ClientSearchBar,
    DashboardAccessGate,
    DashboardAccessPanel,
    EyeGlyph,
    EyeOffGlyph,
    SectionEyebrow,
    SectionHeading,
    SectionNavItem,
    StatTile,
    editInput,
} from "@/pages/client/dashboard/dashboard-chrome";
import {
    type BrandColor,
    DEFAULT_CLIENT_VISIBLE,
    DEFAULT_FOUNDATION,
    type DashboardUser,
    EMPTY_PINNED_POSTS,
    type ExampleReel,
    type FocusProperty,
    type Foundation,
    type GhlItem,
    type Highlight,
    type LocalFavorite,
    type Persona,
    type PinnedPosts,
    type QuickLink,
    REEL_SLOTS,
    type RevenueMonth,
    STATUS_OPTIONS,
    type SectionId,
    type VideoGuide,
    createDefaultContent,
    emptyFavorite,
    emptyFocusProperty,
    emptyPersona,
    emptyWebsiteLink,
    filled,
    findDashboardUser,
    handleFromProfileUrl,
    isTemplatePalette,
    isUntouchedBrandKit,
    mergeContent,
    mergeFoundationDraft,
    normEmail,
    passwordFor,
    readDashboardUsers,
    sectionsForViewer,
    slugify,
    statusColor,
    uid,
    usersToAllowedEmails,
} from "@/pages/client/dashboard/dashboard-model";
import {
    JOURNEY_BAR,
    JOURNEY_STAGES,
    JOURNEY_STEPS,
    type JourneyLink,
    type JourneyStepId,
    KICKOFF_CALENDLY,
    LINK_ONLY_SECTIONS,
    NAV_GROUPS,
    OVERVIEW_ITEM,
    type PhaseId,
    SECTIONS,
    SECTION_ETA,
    type SearchHit,
    TEAM_ONLY_SECTIONS,
    isJourneyItemDone,
    phaseOfSection,
    toggleJourneyItemDone,
    toggleJourneyStepDone,
} from "@/pages/client/dashboard/dashboard-navigation";
import { ExampleReelsSection } from "@/pages/client/dashboard/example-reels";
import { JourneyProgress } from "@/pages/client/dashboard/journey-progress";
import {
    FOUNDATION_SECTIONS,
    LEGACY_FOUNDATION_FIELDS,
    REVIEW_WORKING_PROMPT,
    compileMasterDocument,
    foundationProgress,
    masterDocumentHtml,
} from "@/pages/client/dashboard/master-brand-document";
import { DocField, DocRail, DocSection, DocStat, FavoriteTable, SourceBadge, WorkflowBadge } from "@/pages/client/dashboard/master-brand-fields";
import { OnboardingAnswers } from "@/pages/client/dashboard/onboarding-answers";
import {
    DEFAULT_OVERVIEW_DOC,
    OVERVIEW_BASELINE,
    OVERVIEW_COUNTED_FIELDS,
    OVERVIEW_RAIL,
    OVERVIEW_SECTIONS,
    compileOverviewDocument,
    overviewSectionNumber,
} from "@/pages/client/dashboard/overview-doc";
import { PinnedPostsSection, type PinnedProfileInputs, isPinnedKey } from "@/pages/client/dashboard/pinned-posts";
import { SuggestionBox, SuggestionContext, fetchSuggestions, sendSuggestions, withdrawSuggestion } from "@/pages/client/dashboard/suggestions";
import {
    LANDING_FEEDBACK_KEY,
    REELS_FEEDBACK_KEY,
    STORIES_FEEDBACK_KEY,
    type Suggestion,
    type SuggestionItem,
    applySuggestion,
    flowFeedbackKey,
    isFlowFeedbackKey,
    isLandingFeedbackKey,
    isReelsFeedbackKey,
    isSectionFeedbackKey,
    isStoriesFeedbackKey,
    labelForKey,
    valueForKey,
} from "@/pages/client/dashboard/suggestions-model";
import { mergeLiveContent, useDashboardLive } from "@/pages/client/dashboard/use-dashboard-live";
import { type WebsiteSetup, mergeWebsiteSetup, saveWebsiteSetup, websiteSetupProgress } from "@/pages/client/dashboard/website-setup";
import { type WebsiteSetupSaveState, WebsiteSetupSection } from "@/pages/client/dashboard/website-setup-section";
import { HostOnboardingFormPage, hostOnboardingAnswers, hostOnboardingProgress } from "@/pages/client/host-onboarding-form-page";
import { useSuppressFloatingThemeToggle, useTheme } from "@/providers/theme-provider";
import { compressImageFile } from "@/utils/compress-image";
import { cx } from "@/utils/cx";

const PASSWORD = "ANHTUAN";
const SUPPORT_EMAIL = "anhtuan@hiddengem.media";
const CONTACT_SUBJECT = "Client Dashboard — I'd like some help";
const CONTACT_BODY = `Hi HiddenGem Team,

I have a question about my client dashboard.

• What I'd like to know / update:
• Anything else you should know:

Thanks!`;
const CONTACT_MAILTO = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(CONTACT_SUBJECT)}&body=${encodeURIComponent(CONTACT_BODY)}`;

/** Read from the form itself so the copy never goes stale if a question is added. */

export interface ClientDashboardPageProps {
    /** Page slug — when set, locking persists edits to dashboard_pages (shared). */
    slug?: string;
    initialClientName?: string;
    initialClientWebsite?: string;
    initialData?: Partial<DashboardContent> | null;
    /** Only the template page (/client-dashboard) shows the “+” create button. */
    isTemplate?: boolean;
}

export const ClientDashboardPage = ({ slug, initialClientName = "", initialClientWebsite = "", initialData, isTemplate = false }: ClientDashboardPageProps) => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { theme, setTheme } = useTheme();
    const isDark = theme === "dark" || (theme === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    // This page has its own theme toggle in the side menu (below) — the global
    // floating one would sit at the same top-right corner as the client badge.
    useSuppressFloatingThemeToggle();

    // Team detection — the lock/create controls are only visible to signed-in
    // @hiddengem.media members; clients see a clean read-only dashboard.
    const { user, loading: authLoading } = useAuthUser();

    /* ── "View as client" preview ──
       ?preview=client makes a signed-in team member see exactly what the client sees:
       the same menu, the same SOON rows, no edit mode, none of the team-only controls.
       Every one of those behaviours already reads `isTeam`, so forcing that single value
       false IS the whole feature — nothing downstream needs to know a preview exists. */
    const signedInAsTeam = !!user?.email && user.email.toLowerCase().endsWith("@hiddengem.media");
    const previewAsClient = signedInAsTeam && searchParams.get("preview") === "client";
    const isTeam = signedInAsTeam && !previewAsClient;
    const exitClientPreview = () => {
        const next = new URLSearchParams(searchParams);
        next.delete("preview");
        setSearchParams(next, { replace: true });
    };
    /** Not `replace`, so the browser back button also leaves the preview. */
    const enterClientPreview = () => {
        const next = new URLSearchParams(searchParams);
        next.set("preview", "client");
        setSearchParams(next);
    };

    // Editable content
    const [clientName, setClientName] = useState(initialClientName);
    const [clientWebsite, setClientWebsite] = useState(initialClientWebsite);
    const [content, setContent] = useState<DashboardContent>(() => mergeContent(initialData));

    // Lock state
    const [isLocked, setIsLocked] = useState(true);
    const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error" | "conflict">("idle");
    /** The row's jsonb exactly as the server last handed it to this tab, so Save can tell
     *  whether someone else wrote the row since. Compared as the server's own serialization
     *  (jsonb re-orders keys, so stringifying local state would always mismatch). Null
     *  disables the check rather than blocking saves when a read fails. */
    const savedRowRef = useRef<string | null>(JSON.stringify(initialData ?? null));
    /** Set by a blocked save; the next Save press overwrites deliberately. */
    const overwriteArmedRef = useRef(false);

    /**
     * Follow this client's row, so an AM's tick reaches an open dashboard in about a second
     * instead of on the client's next page load. The launch meter is the reason — a client
     * is told to watch it move — but every shared field rides along: reveal a section, add a
     * link, change the status, and the client's screen catches up.
     *
     * Two things it must not do, and both have cost someone an afternoon elsewhere in this
     * file:
     *
     *  - Never while an AM has the page UNLOCKED. Edit mode holds the whole dashboard in
     *    local state, so applying a remote row mid-edit would silently discard everything
     *    typed since they unlocked. They are not left blind: the save-conflict check in
     *    persistAndLock re-reads the row and blocks the first Save when it has moved.
     *  - Never `website_setup` while the client is mid-answer. That is the one key on this
     *    row the client authors, written server-side by the website-setup function on an
     *    800ms debounce, so a row that arrives while they type carries a version older than
     *    what is on their screen. Replacing it would delete the sentence they are writing.
     *
     * Everything else is safe to take wholesale: no other part of `content` is edited
     * locally except in edit mode, which the first rule already excludes.
     */
    useDashboardLive({
        slug,
        enabled: !!slug && !isTemplate,
        onUpdate: (row) => {
            if (!isLocked) return;
            const incoming = mergeContent(row.data);
            setContent((c) => mergeLiveContent(incoming, c, setupDirtyRef.current));
            setClientName(row.client_name ?? "");
            setClientWebsite(row.client_website ?? "");
            // The baseline moves with it, so this tab's next save compares against the row
            // as it now stands rather than reporting a conflict with a change it already has.
            savedRowRef.current = JSON.stringify(row.data ?? null);
        },
    });

    /**
     * Clicking the client's logo or name enters the client preview — but only while locked.
     * In edit mode the logo is the upload target, so hijacking that click would steal one
     * the AM meant for something else. `isTeam` is already false inside a preview, so this
     * can't fire twice; leaving is the banner's job.
     */
    const canEnterPreview = isTeam && isLocked;

    /* ── Who may open this dashboard ──
       Gated on `signedInAsTeam`, NOT `isTeam`: `isTeam` is forced false inside
       ?preview=client, and gating on it would throw a team member out of their own preview.
       Preview should change what you SEE, never whether you're allowed in.

       The template page has no client and no allowlist, so it's team-only. */
    const dashboardUsers = useMemo(() => readDashboardUsers(content), [content.dashboard_users, content.allowed_emails]);
    const allowedEmails = useMemo(() => usersToAllowedEmails(dashboardUsers), [dashboardUsers]);
    const viewerEmail = user?.email ? normEmail(user.email) : "";
    const isAllowedClient = !!viewerEmail && allowedEmails.some((e) => normEmail(e) === viewerEmail);

    /**
     * The gate is armed PER CLIENT, by the AM filling in the allowlist.
     *
     * An empty allowlist means this dashboard behaves exactly as it does today — open by
     * URL. That is deliberate: all 49 existing dashboards start empty, and enforcing on an
     * empty list would black out every live client the moment this deploys. Adding one
     * address arms the gate for that client and nobody else.
     *
     * This is a staged rollout, not the finished state. Once every dashboard has a list,
     * the check becomes unconditional and the read-gating RLS policy lands with it.
     */
    const sharePassword = (content.share_password ?? "").trim();
    /**
     * Armed as soon as ONE listed person has a password they can get in with — their own,
     * or the shared one as a fallback.
     *
     * Deliberately not "every person has one". A second address added without a password
     * would then silently re-open the whole dashboard to the internet, which is far worse
     * than that one person having to ask for their password. The access panel flags anyone
     * stranded in red instead. For a row written before per-person passwords existed the
     * two rules agree exactly: everyone falls back to the shared one, so it arms on the
     * same condition it always did.
     */
    const gateArmed = dashboardUsers.some((u) => u.email.trim() && passwordFor(u, sharePassword));

    // Unlock survives navigation within the tab, not a new one — same lifetime as the
    // owner-guide share gate (sessionStorage, keyed per slug). Stored as JSON carrying
    // the email that cleared the gate: the client is `anon` to Supabase, so this typed
    // address is the only identity their suggestions can be stamped with. A legacy "1"
    // (written before suggestion mode) still counts as unlocked, just anonymous — the
    // suggest button stays hidden until their next fresh unlock.
    const unlockKey = `cd_unlock_${slug ?? ""}`;
    const readUnlock = (): { unlocked: boolean; email: string } => {
        try {
            const raw = sessionStorage.getItem(unlockKey);
            if (!raw) return { unlocked: false, email: "" };
            if (raw === "1") return { unlocked: true, email: "" };
            return { unlocked: true, email: normEmail(String(JSON.parse(raw)?.email ?? "")) };
        } catch {
            return { unlocked: false, email: "" };
        }
    };
    const [clientUnlock, setClientUnlock] = useState(readUnlock);
    const clientUnlocked = clientUnlock.unlocked;
    const unlockDashboard = (email: string) => {
        try {
            sessionStorage.setItem(unlockKey, JSON.stringify({ email }));
        } catch {
            /* private browsing — the unlock just won't persist past this render */
        }
        setClientUnlock({ unlocked: true, email });
    };
    /** Who the client viewer is, for suggestion authorship. Falls back to a Google-signed-in
     *  allowlisted client (they never see the gate). Empty ⇒ suggestion UI stays hidden. */
    const identityEmail = clientUnlock.email || (isAllowedClient ? viewerEmail : "");

    const hasAccess = signedInAsTeam || isTemplate || !gateArmed || clientUnlocked || isAllowedClient;

    /** Which listed person is looking, when we know. Null for the team, the template, an
     *  ungated dashboard, and a legacy `"1"` unlock that carries no address. */
    const viewerUser = identityEmail ? findDashboardUser(dashboardUsers, identityEmail) : null;

    /* ── Per-client section visibility ──
       Two separate ideas, deliberately not conflated:
         • notBuilt      — no section body exists yet. Nobody can open it, team included.
         • hiddenFromClient — the section works, but this viewer hasn't been shown it.
       The team always sees and can open everything that exists; the client sees "Soon"
       until it's revealed to them.

       Which list applies depends on WHO is looking. A person given their own list uses it;
       everyone else follows the dashboard-wide one an AM sets with the eye toggles. An
       empty own-list is a real answer ("Overview only") and must not fall through to the
       default — see sectionsForViewer, where that rule lives and is self-checked. */
    const clientVisible = sectionsForViewer(viewerUser, content.client_visible);

    /** Single writer for the access list. `allowed_emails` is written alongside as a derived
     *  mirror: the Netlify suggestion function and the read-gating RLS policy to come both
     *  read that flatter key, so the two must never be allowed to drift. */
    const updateDashboardUsers = (next: DashboardUser[]) => setContent((c) => ({ ...c, dashboard_users: next, allowed_emails: usersToAllowedEmails(next) }));
    const updateSharePassword = (next: string) => setContent((c) => ({ ...c, share_password: next }));

    // Side-menu logo + background uploads — click-to-upload in edit mode, compressed to WebP.
    const logoFileRef = useRef<HTMLInputElement>(null);
    const sidebarBgFileRef = useRef<HTMLInputElement>(null);
    const onPickLogo = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        try {
            const dataUrl = await compressImageFile(file);
            setContent((c) => ({ ...c, logo_url: dataUrl }));
        } catch {
            /* keep the current logo if compression fails */
        }
    };
    const onPickSidebarBg = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        try {
            const dataUrl = await compressImageFile(file);
            setContent((c) => ({ ...c, sidebar_bg_url: dataUrl }));
        } catch {
            /* keep the current background if compression fails */
        }
    };

    /** Brand Kit custom font upload — stored as a data URL like the logos. Fonts can't be
     *  compressed the way images can, so a 1.5MB cap keeps a stray 4MB TTF from bloating
     *  the row every dashboard load pulls down; .woff2 files are far under it. */
    const onPickFontFile = async (role: "heading" | "body", file: File) => {
        if (file.size > 1_500_000) {
            window.alert("That font file is over 1.5MB — export it as .woff2 (much smaller) and try again.");
            return;
        }
        const url = await new Promise<string>((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(String(r.result));
            r.onerror = () => reject(r.error);
            r.readAsDataURL(file);
        }).catch(() => "");
        if (!url) return;
        const name = file.name.replace(/\.[^.]+$/, "").trim() || "Custom font";
        patchBrand({ font_files: { ...content.brand.font_files, [role]: { name, url } } });
    };

    /** Brand Kit logo upload. compressImageFile passes SVG straight through, so a vector
     *  logo stays a vector; PNG/JPG get the usual WebP squeeze. Accepts several at once
     *  because a brand kit is normally a folder of marks, not one file. */
    const onPickLogos = async (e: ChangeEvent<HTMLInputElement>) => {
        const files = [...(e.target.files ?? [])];
        e.target.value = "";
        if (!files.length) return;
        const added = await Promise.all(
            files.map(async (f) => {
                try {
                    return { id: uid(), name: f.name.replace(/\.[^.]+$/, ""), url: await compressImageFile(f) };
                } catch {
                    return null; // one bad file shouldn't drop the rest of the selection
                }
            }),
        );
        const ok = added.filter((x): x is { id: string; name: string; url: string } => x !== null);
        if (ok.length) patchBrand({ logos: [...(content.brand.logos ?? []), ...ok] });
    };

    // Side-menu section — grouped by funnel stage (NAV_GROUPS, module scope above).
    // Overview is the client's main dashboard and is pinned at the top of the menu, so it
    // is where the page opens.
    const [activeSection, setActiveSection] = useState<SectionId>("overview");

    // Deep-link support: /client-dashboard#flow (or #overview) opens that side-menu
    // section on load — used by the Welcome Email Flow overview page's "live builder" link.
    useEffect(() => {
        const h = window.location.hash.replace("#", "");
        // "Soon" ids are in SECTIONS but have no section body yet, so honouring a hash
        // for one would render an empty page. Same exclusion the search index uses.
        //
        // LINK_ONLY_SECTIONS is excluded for the same reason and a second one: those rows
        // are links out (the content drive, the help centre), so there is nothing here to
        // deep-link INTO, and honouring the hash by following the link would mean a URL
        // ending "#help" silently threw the client off the dashboard on load.
        if (h && SECTIONS.some((s) => s.id === h && !("soon" in s && s.soon)) && !LINK_ONLY_SECTIONS.has(h as SectionId)) {
            setActiveSection(h as SectionId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Client Input → Onboarding Form ──
    // Every client's dashboard links to their own copy of the Account Access Form at
    // {base}-access, derived from this page's own slug ({base}-dashboard). This slot held
    // the Brand Vision Form until its questions moved into the Onboarding Form; the section
    // id stays "onboarding" so saved visibility and journey state keep working.
    // The row is provisioned on first visit to the section, so no one has to create
    // it by hand for each client. The template dashboard points at the master form.
    const clientBase = slug ? slug.replace(/-dashboard$/, "") : "";
    const onboardingSlug = clientBase ? `${clientBase}-access` : "";
    const onboardingHref = isTemplate || !onboardingSlug ? "/access-form" : `/${onboardingSlug}`;
    const [onboardingStatus, setOnboardingStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
    const [onboardingInfo, setOnboardingInfo] = useState<{ answered: number; total: number; submittedAt?: string }>({ answered: 0, total: 0 });
    const [copiedOnboardingLink, setCopiedOnboardingLink] = useState(false);
    const onboardingFetchRef = useRef(false);
    const onboardingReady = onboardingStatus === "ready";
    const onboardingSubmittedAt = onboardingReady ? onboardingInfo.submittedAt : undefined;
    const onboardingSubmitted = !!onboardingSubmittedAt;
    const onboardingStarted = onboardingReady && onboardingInfo.answered > 0;

    // Two things this has to get right:
    //  • The in-flight guard is a ref, not `status` — StrictMode double-invokes the
    //    effect in dev and both runs close over the same pre-update status, so a
    //    state-only guard fires the request twice. The ref is reset on failure so a
    //    failed attempt can be retried.
    //  • Nothing is cancelled on section change: switching tabs doesn't unmount this
    //    page (a slug change remounts it — client-screen keys on slug), so letting a
    //    mid-flight response land is what stops the card stranding on "Checking…".
    useEffect(() => {
        // Overview's setup panel needs this count too, not just the section itself.
        // Also refreshes while on "intake": that is now the landing section, and the Brand
        // Vision badge has to be right on first paint, not only after a visit to Overview.
        if (!["onboarding", "overview", "intake"].includes(activeSection) || isTemplate || !onboardingSlug) return;
        // "error" waits for the explicit Try again (which resets status to idle).
        if (onboardingFetchRef.current || onboardingStatus === "ready" || onboardingStatus === "error") return;
        onboardingFetchRef.current = true;
        setOnboardingStatus("loading");
        const failed = () => {
            onboardingFetchRef.current = false;
            setOnboardingStatus("error");
        };
        // Hard ceiling on the check: while Supabase is unreachable the request can
        // hang without ever rejecting, which would strand the card on "Checking…".
        const timedOut = new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 10_000));
        Promise.race([ensureAccessForm({ slug: onboardingSlug, clientName, clientWebsite }), timedOut])
            .then((answers) => {
                if (!answers) {
                    failed();
                    return;
                }
                const p = clientOnboardingProgress(answers, ACCESS_FORM);
                setOnboardingInfo({ answered: p.answered, total: p.total, submittedAt: p.submittedAt });
                setBrandData(answers as Partial<ClientOnboardingData>);
                setOnboardingStatus("ready");
            })
            .catch(failed);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeSection, isTemplate, onboardingSlug, onboardingStatus]);

    // ── Client Input → Onboarding Form ──
    // Same provision-on-first-visit pattern as the Account Access block above,
    // against client_onboarding_pages at {base}-onboarding.
    const intakeSlug = clientBase ? `${clientBase}-onboarding` : "";
    const intakeHref = isTemplate || !intakeSlug ? "/client-onboarding-form" : `/${intakeSlug}`;
    const [intakeStatus, setIntakeStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
    const [intakeInfo, setIntakeInfo] = useState<{ answered: number; total: number; submittedAt?: string }>({ answered: 0, total: 0 });
    const [copiedIntakeLink, setCopiedIntakeLink] = useState(false);
    const intakeFetchRef = useRef(false);
    const intakeReady = intakeStatus === "ready";
    const intakeSubmittedAt = intakeReady ? intakeInfo.submittedAt : undefined;
    const intakeSubmitted = !!intakeSubmittedAt;
    const intakeStarted = intakeReady && intakeInfo.answered > 0;

    useEffect(() => {
        // Overview's setup panel needs this count too, not just the section itself.
        if ((activeSection !== "intake" && activeSection !== "overview") || isTemplate || !intakeSlug) return;
        if (intakeFetchRef.current || intakeStatus === "ready" || intakeStatus === "error") return;
        intakeFetchRef.current = true;
        setIntakeStatus("loading");
        const failed = () => {
            intakeFetchRef.current = false;
            setIntakeStatus("error");
        };
        const timedOut = new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 10_000));
        Promise.race([ensureClientOnboardingForm({ slug: intakeSlug, clientName, clientWebsite }), timedOut])
            .then((answers) => {
                if (!answers) {
                    failed();
                    return;
                }
                const p = clientOnboardingProgress(answers);
                setIntakeInfo({ answered: p.answered, total: p.total, submittedAt: p.submittedAt });
                setIntakeData(answers as Partial<ClientOnboardingData>);
                setIntakeStatus("ready");
            })
            .catch(failed);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeSection, isTemplate, intakeSlug, intakeStatus]);

    /* ── Brand Vision Form — kept only for clients who already answered it ──
       Its questions now live in the Onboarding Form, so a new client never gets one. A
       client who already has answers keeps them readable and editable under the
       Onboarding Form section. Read-only lookup: unlike the two current forms this never
       provisions a row, which is what keeps it from appearing for new clients. */
    const visionSlug = clientBase ? `${clientBase}-hostonboarding` : "";
    const [visionData, setVisionData] = useState<Partial<HostOnboardingData> | null>(null);
    const [visionStatus, setVisionStatus] = useState<"idle" | "loading" | "ready">("idle");
    const [copiedVisionLink, setCopiedVisionLink] = useState(false);
    const visionFetchRef = useRef(false);
    const visionInfo = hostOnboardingProgress(visionData);
    const hasVision = visionStatus === "ready" && visionInfo.answered > 0;

    useEffect(() => {
        if (activeSection !== "intake" || isTemplate || !visionSlug) return;
        if (visionFetchRef.current || visionStatus === "ready") return;
        visionFetchRef.current = true;
        setVisionStatus("loading");
        supabase
            .from("host_onboarding_pages")
            .select("data")
            .eq("slug", visionSlug)
            .maybeSingle()
            .then(({ data: row, error }) => {
                // A failed lookup just shows no card; the answers still reach the Onboarding
                // Form through ensureClientOnboardingForm.
                if (error) console.error("[brand vision read]", error);
                setVisionData(((row as { data?: Partial<HostOnboardingData> } | null)?.data ?? null) || null);
                setVisionStatus("ready");
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeSection, isTemplate, visionSlug, visionStatus]);

    /* ── Client-input forms open in a modal over the dashboard ──
       Keeps the AM/host in context instead of navigating away to the form page and
       back. The client's own shared link (/{client}-onboarding, -access)
       still renders full-page — that's what the "Copy Link" button sends.
       The raw row data is kept so the embedded form hydrates from what we already
       fetched for the progress card, rather than re-querying on open. */
    const [formModal, setFormModal] = useState<null | "intake" | "access" | "brand">(null);
    /** When the modal was opened from a specific answer's Edit control, the question to land on. */
    const [formModalField, setFormModalField] = useState("");
    const [intakeData, setIntakeData] = useState<Partial<ClientOnboardingData> | null>(null);
    const [brandData, setBrandData] = useState<Partial<ClientOnboardingData> | null>(null);

    // Closing re-runs the progress fetch so the card reflects whatever they just answered.
    const closeFormModal = () => {
        const which = formModal;
        setFormModal(null);
        setFormModalField("");
        if (which === "intake") {
            intakeFetchRef.current = false;
            setIntakeStatus("idle");
        } else if (which === "brand") {
            visionFetchRef.current = false;
            setVisionStatus("idle");
        } else if (which === "access") {
            onboardingFetchRef.current = false;
            setOnboardingStatus("idle");
        }
    };

    /* ── Reset a client-input form ──
       Destructive and team-only: it throws away answers the client already gave,
       including any voice/video they recorded. Two-step by design — the first click
       only arms it — because there is no undo. Writing `{}` is enough to clear the
       row: both forms run their answers through mergeData(), which fills defaults
       from an empty object. */
    const [armedReset, setArmedReset] = useState<null | "intake" | "access">(null);
    const [resetting, setResetting] = useState(false);

    /* ── Delete one stored login once it is in 1Password ──
       The Onboarding Form's Account Setup section collects real passwords, and they sit in
       client_onboarding_pages until someone removes them. The team's working order is to
       copy a login into the client's 1Password vault and delete that one, then the next —
       so the control lives on each login row in the answers panel, not up here on the
       section, and it takes one login at a time.

       Only the password goes: the username, @handle and platform stay, because they say
       which account each login belongs to and are not the secret. Throws rather than
       swallowing, so a failed write leaves the row's confirm in place instead of reading
       as a password that is gone when it is still there. */
    const deleteLogin = async (field: string) => {
        if (!onboardingSlug) return;
        const cleared = withLoginCleared(brandData, field);
        const { error } = await supabase.from("client_onboarding_pages").update({ data: cleared }).eq("slug", onboardingSlug);
        if (error) {
            console.error("[delete login]", error);
            throw error;
        }
        setBrandData(cleared);
        // Logins used to live in the Onboarding row, and the Access row was seeded with a
        // copy. Clear that copy too, or "moved to 1Password" would leave the password behind.
        if (intakeSlug && (intakeData?.answers?.[`${field}__pass`] ?? "").trim()) {
            const oldCleared = withLoginCleared(intakeData, field);
            const { error: oldError } = await supabase.from("client_onboarding_pages").update({ data: oldCleared }).eq("slug", intakeSlug);
            if (oldError) {
                console.error("[delete login]", oldError);
                throw oldError;
            }
            setIntakeData(oldCleared);
        }
    };

    const resetForm = async (kind: "intake" | "access") => {
        const slugToClear = kind === "intake" ? intakeSlug : onboardingSlug;
        const table = "client_onboarding_pages";
        if (!slugToClear) return;
        setResetting(true);
        try {
            // Delete the recordings first. Wiping the row would otherwise strand the
            // files in the bucket with nothing referencing them.
            const paths = Object.entries((kind === "intake" ? intakeData : brandData)?.answers ?? {})
                .filter(([k, v]) => k.endsWith("__media") && (v ?? "").trim())
                .map(([, v]) => v as string);
            if (paths.length) await supabase.storage.from("recordings").remove(paths);

            const { error } = await supabase.from(table).update({ data: {} }).eq("slug", slugToClear);
            if (error) throw error;

            // Re-run the section's progress fetch so the card reflects the empty form.
            if (kind === "intake") {
                setIntakeData(null);
                intakeFetchRef.current = false;
                setIntakeStatus("idle");
            } else {
                setBrandData(null);
                onboardingFetchRef.current = false;
                setOnboardingStatus("idle");
            }
            setArmedReset(null);
        } catch (e) {
            console.error("[form reset]", e);
        } finally {
            setResetting(false);
        }
    };

    // Plus wizard
    const [showPlusModal, setShowPlusModal] = useState(false);
    const [plusStep, setPlusStep] = useState<"password" | "details">("password");
    const [plusPassword, setPlusPassword] = useState("");
    const [plusPasswordError, setPlusPasswordError] = useState(false);
    const [newClientName, setNewClientName] = useState("");
    const [newClientWebsite, setNewClientWebsite] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [createError, setCreateError] = useState("");

    // Master Document "Generate for AM review" modal (team-only).
    const [showMasterDocModal, setShowMasterDocModal] = useState(false);
    const [bookingOpen, setBookingOpen] = useState(false);
    const [justBooked, setJustBooked] = useState(false);
    // PDF export state: `pdfBusy` covers the dynamic import of jsPDF (a visible
    // pause on a cold cache), `pdfError` surfaces a failure the AM would otherwise
    // read as "the button does nothing".
    const [pdfBusy, setPdfBusy] = useState(false);
    const [pdfError, setPdfError] = useState(false);
    const [masterDocCopied, setMasterDocCopied] = useState(false);
    const [headerDocCopied, setHeaderDocCopied] = useState(false);
    const [overviewCopied, setOverviewCopied] = useState(false);
    /** "Copied" flash on the Reviews working prompt (team-only block). */
    const [promptCopied, setPromptCopied] = useState(false);
    /* ── Master Document drafting (team-only) ──
       `masterDraftStep` is the label of the group being drafted, shown live: the run takes
       around a minute across eight model calls, and a single spinner for that long reads as
       a hang. `masterDraftDone` collects what landed so the AM can see it was partial when
       a group fails, rather than being told only about the failure. */
    const [masterDraftStep, setMasterDraftStep] = useState("");
    const [masterDraftDone, setMasterDraftDone] = useState<string[]>([]);
    const [masterDraftError, setMasterDraftError] = useState("");
    /** Guest reviews the AM pastes in. Not persisted — it's raw input to the draft, and
     *  the useful output of it lives in the two Reviews fields. */
    const [reviewsPaste, setReviewsPaste] = useState("");
    /* ── Brand Kit from the client's own website and/or guidelines PDF (team-only) ── */
    const [brandKitUrl, setBrandKitUrl] = useState("");
    const [brandKitBusy, setBrandKitBusy] = useState(false);
    const [brandKitMsg, setBrandKitMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
    /** The guidelines PDF this draft should read, once it's in storage. Held as a path
     *  rather than bytes: the generator downloads it server-side, which keeps a 15MB file
     *  out of the request body entirely. */
    const [brandKitPdf, setBrandKitPdf] = useState<{ path: string; name: string } | null>(null);
    const [brandKitPdfBusy, setBrandKitPdfBusy] = useState(false);

    /** Put the client's brand guidelines PDF somewhere the generator can read it. Same
     *  bucket and path shape the onboarding form already uses for brand-kit uploads. */
    const onPickBrandKitPdf = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
            setBrandKitMsg({ kind: "err", text: "That needs to be a PDF — export the guidelines as one and try again." });
            return;
        }
        setBrandKitPdfBusy(true);
        setBrandKitMsg(null);
        try {
            const safe = file.name
                .toLowerCase()
                .replace(/[^a-z0-9.]+/g, "-")
                .slice(-80);
            const path = `${clientBase || "template"}/${Date.now()}-${safe}`;
            const { error } = await supabase.storage.from("brandkits").upload(path, file, { contentType: "application/pdf", cacheControl: "31536000" });
            if (error) throw error;
            setBrandKitPdf({ path, name: file.name });
        } catch (err) {
            console.error("[brand kit pdf upload]", err);
            setBrandKitMsg({ kind: "err", text: "That PDF didn't upload — check your connection and try again." });
        } finally {
            setBrandKitPdfBusy(false);
        }
    };

    /** Detach the PDF. The object is left in the bucket: it's the client's own guidelines
     *  and costs nothing to keep, whereas deleting it here would also delete it out from
     *  under any other draft that already read it. */
    const clearBrandKitPdf = () => {
        setBrandKitPdf(null);
        setBrandKitMsg(null);
    };

    /** The last draft the generator returned, awaiting the AM's Replace / Add / Discard. */
    const [brandKitDraft, setBrandKitDraft] = useState<BrandKitDraft | null>(null);
    /** Bumped to abandon an in-flight poll: a second click, or leaving the page. */
    const brandKitRun = useRef(0);
    useEffect(
        () => () => {
            brandKitRun.current++;
        },
        [],
    );

    /**
     * Start a draft and wait for it.
     *
     * The reading runs in generate-brand-kit-background — a Netlify background function with
     * minutes to work, where the old synchronous endpoint had ~10 seconds for the page, its
     * stylesheets and a model pass over the PDF together, and slow sites came back empty. The
     * browser names the job, starts it, and polls brand-kit-job until it's done.
     *
     * Nothing is merged here: the draft goes to the review card, and applyBrandKitDraft runs
     * only on the AM's choice.
     */
    const generateBrandKit = async () => {
        const url = (brandKitUrl.trim() || clientWebsite.trim()).trim();
        const pdfPath = brandKitPdf?.path ?? "";
        if (!url && !pdfPath) {
            setBrandKitMsg({ kind: "err", text: "Add the client's website address, or upload their brand guidelines PDF." });
            return;
        }
        const run = ++brandKitRun.current;
        setBrandKitBusy(true);
        setBrandKitMsg(null);
        setBrandKitDraft(null);
        try {
            // Team-only on the server too, so the session token travels with both requests.
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData.session?.access_token;
            if (!token) {
                setBrandKitMsg({ kind: "err", text: "Your sign-in has expired — reload the page and sign in again." });
                return;
            }
            const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
            const job = crypto.randomUUID();
            const start = await fetch("/.netlify/functions/generate-brand-kit-background", {
                method: "POST",
                headers,
                body: JSON.stringify({ job, url, pdf_path: pdfPath }),
            });
            if (!start.ok) {
                setBrandKitMsg({ kind: "err", text: "Couldn't reach the generator. Try again in a moment." });
                return;
            }

            // A site read takes a few seconds; a PDF with the model pass up to a couple of
            // minutes. "pending" past the grace period means the worker never started —
            // most often an expired sign-in, which it refuses without writing anything.
            const began = Date.now();
            for (;;) {
                await new Promise((r) => window.setTimeout(r, 2000));
                if (run !== brandKitRun.current) return;
                const res = await fetch(`/.netlify/functions/brand-kit-job?id=${job}`, { headers });
                const json = (await res.json().catch(() => ({}))) as { status?: string; error?: string; kit?: BrandKitDraft };
                if (run !== brandKitRun.current) return;
                if (!res.ok) {
                    setBrandKitMsg({ kind: "err", text: json.error || "Couldn't check on the draft. Try again." });
                    return;
                }
                if (json.status === "done" && json.kit) {
                    setBrandKitDraft(json.kit);
                    return;
                }
                if (json.status === "error") {
                    setBrandKitMsg({ kind: "err", text: json.error || "Couldn't read that." });
                    return;
                }
                const waited = Date.now() - began;
                if ((json.status === "pending" && waited > 25_000) || waited > 240_000) {
                    setBrandKitMsg({
                        kind: "err",
                        text:
                            json.status === "pending"
                                ? "The generator didn't start — reload the page, sign in again, and retry."
                                : "That's taking far longer than it should. Try again, or add the colours by hand.",
                    });
                    return;
                }
            }
        } catch {
            if (run === brandKitRun.current) setBrandKitMsg({ kind: "err", text: "Couldn't reach the generator. Try again in a moment." });
        } finally {
            if (run === brandKitRun.current) setBrandKitBusy(false);
        }
    };

    /**
     * Put a reviewed draft into the kit — still unsaved, like every other edit here.
     *
     * "replace" swaps the palette and takes the draft's fonts; "add" appends the colours
     * (skipping any hex already in the palette) and only fills a blank or template font.
     * Logos are appended either way, skipping exact duplicates. Swatch sources are review
     * aids, not part of the kit, so they're dropped here.
     */
    const applyBrandKitDraft = (mode: "replace" | "add") => {
        const draft = brandKitDraft;
        if (!draft) return;
        const found = draft.colors.map((c) => ({ name: c.name, hex: c.hex }));
        const have = new Set(content.brand.colors.map((c) => c.hex.toUpperCase()));
        const patch: Partial<DashboardContent["brand"]> = {};
        if (found.length) patch.colors = mode === "replace" ? found : [...content.brand.colors, ...found.filter((c) => !have.has(c.hex.toUpperCase()))];
        const fontsBlank = !content.brand.fonts.trim() || content.brand.fonts.trim() === "Inter";
        if (draft.fonts && (mode === "replace" || fontsBlank)) patch.fonts = draft.fonts;
        const logoUrls = new Set((content.brand.logos ?? []).map((l) => l.url));
        const newLogos = draft.logos.filter((l) => !logoUrls.has(l.url));
        if (newLogos.length) patch.logos = [...(content.brand.logos ?? []), ...newLogos.map((l) => ({ id: uid(), name: l.name, url: l.url }))];
        if (Object.keys(patch).length) patchBrand(patch);
        setBrandKitDraft(null);
        setBrandKitMsg({ kind: "ok", text: "Draft applied. Review it below, then Save changes — nothing is saved yet." });
    };

    /** Which Brand Kit value was just copied (a hex, an rgb() string, or "css" for the
     *  whole stylesheet), for the matching "Copied!" flash. */
    const [copiedHex, setCopiedHex] = useState("");
    const copyHex = (hex: string) => {
        void navigator.clipboard.writeText(hex).then(() => {
            setCopiedHex(hex);
            window.setTimeout(() => setCopiedHex((h) => (h === hex ? "" : h)), 1400);
        });
    };
    /** The kit as a stylesheet — copied, or handed to the browser as a .css download so a
     *  designer gets one file rather than retyping six hexes and two font names. */
    const copyBrandKitCss = () => {
        void navigator.clipboard.writeText(brandKitCss(content.brand, clientName)).then(() => {
            setCopiedHex("css");
            window.setTimeout(() => setCopiedHex((h) => (h === "css" ? "" : h)), 1400);
        });
    };
    const downloadBrandKitCss = () => {
        const blob = new Blob([brandKitCss(content.brand, clientName)], { type: "text/css;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = brandKitFileName(clientBase || clientName);
        a.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    /** Export needs at least one real colour or a font. And a client looking at a kit
     *  nobody has touched yet sees "on the way", never the placeholder purples as theirs;
     *  the template page itself is the one place the placeholders are the content. */
    const kitHasContent = brandKitHasContent(content.brand);
    const kitOnTheWay = isLocked && !isTemplate && isUntouchedBrandKit(content.brand);
    /** Swap a swatch with its neighbour — the first colour is what the preview and the
     *  CSS export treat as primary, so order is meaning, not decoration. */
    const moveColor = (i: number, dir: -1 | 1) => {
        const j = i + dir;
        if (j < 0 || j >= content.brand.colors.length) return;
        const next = [...content.brand.colors];
        [next[i], next[j]] = [next[j], next[i]];
        patchBrand({ colors: next });
    };

    // Auto-open the create wizard when arriving via "+ New Page" (?create=1).
    useEffect(() => {
        if (searchParams.get("create") === "1") {
            setShowPlusModal(true);
            setPlusStep("details");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Lock background scroll while a modal is open.
    useEffect(() => {
        document.body.style.overflow = showPlusModal || formModal ? "hidden" : "";
        return () => {
            document.body.style.overflow = "";
        };
    }, [showPlusModal, formModal]);

    /* ── Content updaters ── */
    const patchBrand = (patch: Partial<DashboardContent["brand"]>) => setContent((c) => ({ ...c, brand: { ...c.brand, ...patch } }));
    const patchInstagram = (patch: Partial<DashboardContent["instagram"]>) => setContent((c) => ({ ...c, instagram: { ...c.instagram, ...patch } }));
    const patchGhl = (patch: Partial<DashboardContent["ghl"]>) => setContent((c) => ({ ...c, ghl: { ...c.ghl, ...patch } }));
    const patchRevenue = (patch: Partial<DashboardContent["revenue"]>) => setContent((c) => ({ ...c, revenue: { ...c.revenue, ...patch } }));
    const patchFoundation = (patch: Partial<Foundation>) => setContent((c) => ({ ...c, foundation: { ...DEFAULT_FOUNDATION, ...c.foundation, ...patch } }));

    const foundation = content.foundation ?? DEFAULT_FOUNDATION;

    /* ── Master Brand Document — list editors ──
       Each repeated block (personas, focus properties, the two favourites tables, the
       sitemap rows) is patched by id rather than by index, so removing a row mid-list
       can't rewrite the one that slides up into its place. */
    const patchPersona = (id: string, patch: Partial<Persona>) =>
        patchFoundation({ personas: foundation.personas.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
    const patchFocus = (id: string, patch: Partial<FocusProperty>) =>
        patchFoundation({ focusProperties: foundation.focusProperties.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
    const patchFavorite = (list: "restaurants" | "activities") => (id: string, patch: Partial<LocalFavorite>) =>
        patchFoundation({ [list]: foundation[list].map((r) => (r.id === id ? { ...r, ...patch } : r)) });
    const addFavorite = (list: "restaurants" | "activities") => () => patchFoundation({ [list]: [...foundation[list], emptyFavorite()] });
    const removeFavorite = (list: "restaurants" | "activities") => (id: string) => patchFoundation({ [list]: foundation[list].filter((r) => r.id !== id) });

    /* ── Suggestion mode (Master Brand Document) ──
       A client proposes values; nothing touches the real document until an AM accepts
       and SAVES. Suggestions live in their own table (dashboard_suggestions) so they
       can never trip the whole-row conflict guard or be clobbered by an ordinary save.
       Clients reach the table only through the Netlify function, which re-validates
       their email against allowed_emails on every call. */
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [suggestMode, setSuggestMode] = useState(false);
    const [suggestDraft, setSuggestDraft] = useState<Record<string, string>>({});
    /** Accepted locally but not yet saved — flipped to accepted in the DB only after
     *  persistAndLock's upsert succeeds, so an abandoned tab leaves them pending. */
    const [queuedAccepts, setQueuedAccepts] = useState<ReadonlySet<string>>(new Set());
    const [sendState, setSendState] = useState<"idle" | "sending" | "sent" | "error">("idle");
    /** What actually went wrong, so a failed send says why instead of "try again". */
    const [sendError, setSendError] = useState("");
    // Each one reads the list that applies to THIS viewer, not the dashboard-wide one — a
    // person narrowed to their own sections must not be offered feedback on a section they
    // can't open. The Netlify function re-checks the same way.
    const foundationRevealed = clientVisible.includes("foundation");
    /** Every section that carries a feedback box shares the table the same way the document
     *  does, so each needs its own reveal test — and the Netlify function re-checks it. */
    const flowRevealed = clientVisible.includes("flow");
    const pinnedRevealed = clientVisible.includes("pinnedposts");
    const landingRevealed = clientVisible.includes("landing");
    const reelsRevealed = clientVisible.includes("reels");
    const storiesRevealed = clientVisible.includes("pinnedstories");
    /** Any of them is reason enough to load the table for a client. */
    const anyFeedbackRevealed = foundationRevealed || flowRevealed || pinnedRevealed || landingRevealed || reelsRevealed || storiesRevealed;

    const refreshSuggestions = useCallback(async () => {
        if (!slug || isTemplate) return;
        try {
            // Read straight from the table whenever the viewer holds a team session — that
            // includes ?preview=client, where RLS still recognises the JWT even though the
            // page is dressed as the client's.
            if (signedInAsTeam) {
                const { data, error } = await supabase.from("dashboard_suggestions").select("*").eq("slug", slug).order("created_at", { ascending: false });
                if (!error && data) setSuggestions(data as Suggestion[]);
            } else if (identityEmail && anyFeedbackRevealed) {
                setSuggestions(await fetchSuggestions(slug, identityEmail));
            }
        } catch {
            /* the section just shows no suggestions — nothing is lost, they're server-side */
        }
    }, [slug, isTemplate, signedInAsTeam, identityEmail, anyFeedbackRevealed]);
    useEffect(() => {
        void refreshSuggestions();
    }, [refreshSuggestions]);

    /* The table carries two kinds of row: Master Brand Document edits, and a client's note
       on a section — the welcome emails, the landing page, the example reels, the pinned
       stories (`isSectionFeedbackKey`) and a pinned post (`isPinnedKey`, per post rather
       than per section, so it lives beside that section). Split them here so no section
       counts, lists or orphans another's — a feedback key resolves to no document field, so
       one left in would show up as a pending edit and then as an orphan. */
    const pinnedFeedback = suggestions.filter((s) => isPinnedKey(s.field_key));
    const pendingSuggestions = suggestions.filter((s) => s.status === "pending" && !isPinnedKey(s.field_key) && !isSectionFeedbackKey(s.field_key));
    const pendingByKey = new Map<string, Suggestion[]>();
    for (const s of pendingSuggestions) pendingByKey.set(s.field_key, [...(pendingByKey.get(s.field_key) ?? []), s]);
    const resolvedByKey = new Map<string, Suggestion>();
    for (const s of suggestions) if (s.status !== "pending" && !resolvedByKey.has(s.field_key)) resolvedByKey.set(s.field_key, s);
    /** Pending rows whose key no longer resolves (their row was deleted) — surfaced to
     *  the team above the document, since no field exists to hang them on. */
    const orphanedPending = isTeam ? pendingSuggestions.filter((s) => valueForKey(foundation, s.field_key) === null) : [];

    const acceptSuggestion = (s: Suggestion) => {
        const patch = applySuggestion(foundation, s.field_key, s.suggested_value);
        if (!patch) return; // row deleted since — the orphan list offers Decline instead
        patchFoundation(patch);
        setQueuedAccepts((prev) => new Set(prev).add(s.id));
        if (isLocked) setIsLocked(false); // the existing Save button owns persistence
    };
    const declineSuggestion = (s: Suggestion) => {
        void supabase
            .from("dashboard_suggestions")
            .update({ status: "declined", resolved_by: user?.email ?? "", resolved_at: new Date().toISOString() })
            .eq("id", s.id)
            .eq("status", "pending") // a second tab that already resolved it wins
            .then(() => void refreshSuggestions());
    };
    const withdrawOwnSuggestion = (s: Suggestion) => {
        if (!slug) return;
        // A client withdraws through the function (it re-checks they own the row); a team
        // member previewing deletes their own test row directly.
        const done = () => void refreshSuggestions();
        if (identityEmail) {
            void withdrawSuggestion(slug, identityEmail, s.id)
                .then(done)
                .catch(() => undefined);
        } else if (signedInAsTeam) {
            void supabase.from("dashboard_suggestions").delete().eq("id", s.id).eq("status", "pending").then(done);
        }
    };
    const submitSuggestions = async () => {
        if (!slug || !suggestAuthor) return;
        // Only real changes travel: drafts equal to the live value (or on vanished keys) drop out.
        const items = Object.entries(suggestDraft)
            .filter(([key, value]) => {
                const live = valueForKey(foundation, key);
                return live !== null && value !== live;
            })
            .map(([key, value]) => ({
                fieldKey: key,
                fieldLabel: labelForKey(foundation, key),
                currentValue: valueForKey(foundation, key) ?? "",
                suggestedValue: value,
            }));
        if (items.length === 0) {
            setSuggestMode(false);
            setSuggestDraft({});
            return;
        }
        setSendState("sending");
        setSendError("");
        try {
            await fileSuggestions(items);
            await refreshSuggestions();
            // The drafts are only cleared once the server has them — a failed send keeps
            // everything typed so the client can just press Send again.
            setSuggestDraft({});
            setSuggestMode(false);
            setSendState("sent");
            window.setTimeout(() => setSendState((s) => (s === "sent" ? "idle" : s)), 6000);
        } catch (err) {
            setSendError(err instanceof Error ? err.message : "Something went wrong. Nothing was sent.");
            setSendState("error");
        }
    };
    /* ── Who is filing suggestions from this view, and by which route ──
       A client (identified by the gate, or signed in and on the allowlist) posts through
       the Netlify function, which re-checks their address against this dashboard's
       allowlist. A team member inside ?preview=client holds no client identity, so they
       write directly instead — authenticated as themselves, which means the suggestion is
       honestly stamped with their @hiddengem.media address rather than the client's. Both
       routes need somebody to attribute the suggestion to; without one there's no Send. */
    const suggestAsTeam = previewAsClient && !!viewerEmail;
    /** The address a suggestion sent from this view would carry. */
    const suggestAuthor = identityEmail || (suggestAsTeam ? viewerEmail : "");
    const canSuggest = !isTeam && !isTemplate && foundationRevealed && !!suggestAuthor;
    /** Same two identities, for approving or requesting changes on a pinned post. */
    const canReviewPinned = !isTeam && !isTemplate && pinnedRevealed && !!suggestAuthor;

    /**
     * Write suggestion rows by whichever route this viewer has: a client through the
     * Netlify function (which re-checks their address against the allowlist), a team member
     * previewing directly as themselves — their JWT satisfies the team-insert policy, so the
     * row is stamped with their real address. Shared by the Master Brand Document's Send and
     * the Pinned Posts feedback buttons; callers refresh afterwards.
     */
    const fileSuggestions = async (items: SuggestionItem[]) => {
        if (!slug) throw new Error("This dashboard isn't saved yet.");
        if (identityEmail) {
            await sendSuggestions(slug, identityEmail, items);
            return;
        }
        if (!suggestAuthor) throw new Error("Sign in to send feedback.");
        // The function replaces the author's own pending row for a re-filed key; do the same
        // here so a team member's test rows don't pile up.
        await supabase
            .from("dashboard_suggestions")
            .delete()
            .eq("slug", slug)
            .eq("suggested_by", suggestAuthor)
            .eq("status", "pending")
            .in(
                "field_key",
                items.map((i) => i.fieldKey),
            );
        const { error } = await supabase.from("dashboard_suggestions").insert(
            items.map((i) => ({
                slug,
                field_key: i.fieldKey,
                field_label: i.fieldLabel,
                current_value: i.currentValue,
                suggested_value: i.suggestedValue,
                suggested_by: suggestAuthor,
            })),
        );
        if (error) throw new Error(error.message);
    };
    /** Pinned Posts feedback: file, then refresh so the card shows it at once. */
    const sendPinnedFeedback = async (items: SuggestionItem[]) => {
        await fileSuggestions(items);
        await refreshSuggestions();
    };
    /** The team marks a change request addressed. Nothing to apply to the row — the fix is
     *  the re-uploaded slides — so the status flips straight in the table. */
    const resolvePinnedFeedback = (s: Suggestion) => {
        void supabase
            .from("dashboard_suggestions")
            .update({ status: "accepted", resolved_by: user?.email ?? "", resolved_at: new Date().toISOString() })
            .eq("id", s.id)
            .eq("status", "pending")
            .then(() => void refreshSuggestions());
    };

    /* ── Pinned Posts ── */
    const pinnedPosts: PinnedPosts = content.pinned_posts ?? EMPTY_PINNED_POSTS;
    const patchPinned = (patch: Partial<PinnedPosts>) =>
        setContent((c) => ({ ...c, pinned_posts: { ...EMPTY_PINNED_POSTS, ...(c.pinned_posts ?? {}), ...patch } }));

    /* The Instagram profile both phone mockups render — Pinned Posts (the grid) and Pinned
       Stories (the highlight tray) — built once so the two sections can never show the
       client two different accounts. */
    const igProfileInputs: PinnedProfileInputs = {
        handle: handleFromProfileUrl(content.instagram.profile_url) || slugify(clientName).replace(/-/g, "."),
        displayName: clientName,
        avatar: content.logo_url,
        // The bio is whatever the Master Brand has settled on: taglines first, then the
        // opening of the brand bio. Empty until then, and the mockup says so.
        bio: foundation.taglines.filter((t) => t.trim()).slice(0, 2).length
            ? foundation.taglines.filter((t) => t.trim()).slice(0, 2)
            : foundation.brandBio.trim()
              ? [foundation.brandBio.trim().split(/(?<=[.!?])\s/)[0]]
              : [],
        linkLabel: clientWebsite.replace(/^https?:\/\//, "").replace(/\/$/, ""),
        highlights: content.instagram.highlights.map((h) => ({ label: h.title, src: h.image_url || undefined })),
    };

    /* ── Client feedback on a section ──
       Same table, same function, same identity rules as suggestion mode, under one key per
       section (see suggestions-model.ts). The sections render the box; these do the reads
       and writes, and every family shares them — a fifth section is three lines below, not
       another copy of this.

       `currentValue` stays empty throughout: a note is written about a section, not about
       one value, so there is nothing for the team's staleness check to compare. */

    /** Sends (or replaces) this viewer's one open note under `fieldKey`. */
    const sendSectionFeedback = (fieldKey: string, fieldLabel: string) => async (text: string) => {
        if (!slug || !suggestAuthor) throw new Error("Sign in with your email to send feedback.");
        const item = { fieldKey, fieldLabel, currentValue: "", suggestedValue: text };
        if (identityEmail) {
            await sendSuggestions(slug, identityEmail, [item]);
        } else {
            // Team member previewing as the client — as themselves, like submitSuggestions.
            // The function replaces the author's own open comment; do the same here.
            await supabase
                .from("dashboard_suggestions")
                .delete()
                .eq("slug", slug)
                .eq("suggested_by", suggestAuthor)
                .eq("status", "pending")
                .eq("field_key", item.fieldKey);
            const { error } = await supabase.from("dashboard_suggestions").insert({
                slug,
                field_key: item.fieldKey,
                field_label: item.fieldLabel,
                current_value: item.currentValue,
                suggested_value: item.suggestedValue,
                suggested_by: suggestAuthor,
            });
            if (error) throw new Error(error.message);
        }
        await refreshSuggestions();
    };

    /** Who may send at all: a client, on a real dashboard, in a section they can open. */
    const canSectionFeedback = (revealed: boolean) => !isTeam && !isTemplate && revealed && !!suggestAuthor;

    /** The welcome emails — one note per person per EMAIL, so a note names the email it is
     *  about and the function can mirror it onto that email's row in the pipeline's table.
     *  The section binds the open tab's slot; legacy whole-flow notes are still read. */
    const flowFeedback = suggestions.filter((s) => isFlowFeedbackKey(s.field_key));
    const canFlowFeedback = canSectionFeedback(flowRevealed);
    const sendFlowFeedback = (slot: number, text: string) => sendSectionFeedback(flowFeedbackKey(slot), `Welcome email ${slot + 1} · feedback`)(text);

    /** Withdraw / resolve act on a row id, so every feedback family shares them. */
    const withdrawFeedback = async (s: Suggestion) => {
        if (!slug) return;
        if (identityEmail) await withdrawSuggestion(slug, identityEmail, s.id);
        else if (signedInAsTeam) await supabase.from("dashboard_suggestions").delete().eq("id", s.id).eq("status", "pending");
        await refreshSuggestions();
    };
    /** Feedback is never "applied" anywhere — done or dismissed is the whole outcome. */
    const resolveFeedback = async (s: Suggestion, status: "accepted" | "declined") => {
        await supabase
            .from("dashboard_suggestions")
            .update({ status, resolved_by: user?.email ?? "", resolved_at: new Date().toISOString() })
            .eq("id", s.id)
            .eq("status", "pending");
        await refreshSuggestions();
    };

    /** The landing page. Separate from the Approve / Request changes verdict in
     *  landing-page-section.tsx, which lives in landing_pages: that one closes, this one
     *  stays open either side of it. */
    const landingFeedback = suggestions.filter((s) => isLandingFeedbackKey(s.field_key));
    const canLandingFeedback = canSectionFeedback(landingRevealed);
    const sendLandingFeedback = sendSectionFeedback(LANDING_FEEDBACK_KEY, "Landing page · feedback");

    /** The example reels — the section's only channel, so it is where every reel note lands. */
    const reelsFeedback = suggestions.filter((s) => isReelsFeedbackKey(s.field_key));
    const canReelsFeedback = canSectionFeedback(reelsRevealed);
    const sendReelsFeedback = sendSectionFeedback(REELS_FEEDBACK_KEY, "Example reels · feedback");

    /** The pinned stories, beside their per-slide notes and Approve all (pinned_stories) —
     *  same relationship as the landing page's verdict above. */
    const storiesFeedback = suggestions.filter((s) => isStoriesFeedbackKey(s.field_key));
    const canStoriesFeedback = canSectionFeedback(storiesRevealed);
    const sendStoriesFeedback = sendSectionFeedback(STORIES_FEEDBACK_KEY, "Pinned stories · feedback");

    const suggestDraftCount = Object.entries(suggestDraft).filter(([key, value]) => {
        const live = valueForKey(foundation, key);
        return live !== null && value !== live;
    }).length;

    const foundationFilledMap = foundationProgress(foundation);
    /** v1 answers still sitting in the row — shown to the team so the redesign doesn't bury them. */
    const legacyFoundation = LEGACY_FOUNDATION_FIELDS.filter((f) => filled(foundation[f.key])).map((f) => ({
        ...f,
        value: foundation[f.key]!.trim(),
    }));
    const legacyFaqs = (foundation.faqs ?? []).filter((q) => q.question.trim() || q.answer.trim());

    /* ── Client Overview Document (team only) ── */
    const overviewDoc: OverviewDoc = { ...DEFAULT_OVERVIEW_DOC, ...(content.overview_doc ?? {}) };
    const patchOverviewDoc = (patch: Partial<OverviewDoc>) =>
        setContent((c) => ({ ...c, overview_doc: { ...DEFAULT_OVERVIEW_DOC, ...(c.overview_doc ?? {}), ...patch } }));
    const overviewFilled = OVERVIEW_COUNTED_FIELDS.filter((k) => String(overviewDoc[k] ?? "").trim()).length;
    // The Overview rail's per-section checks — a section counts once any of its fields has content.
    const overviewSectionFilled: Record<string, boolean> = {
        ...Object.fromEntries(OVERVIEW_SECTIONS.map((s) => [s.id, s.fields.some((f) => String(overviewDoc[f.key] ?? "").trim())])),
        properties: overviewDoc.properties.some((p) => p.name.trim() || p.link.trim()),
        baseline: [...OVERVIEW_BASELINE.map((f) => f.key), "direct_booking_split" as const, "instagram_screenshot" as const].some((k) =>
            String(overviewDoc[k] ?? "").trim(),
        ),
    };
    const [overviewBusy, setOverviewBusy] = useState(false);
    const [overviewStep, setOverviewStep] = useState("");
    const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
    const [overviewError, setOverviewError] = useState("");

    /**
     * Draft the document from what the client has already told us.
     *
     * Three model calls, run one at a time, for the same reason the Master Document is split
     * into seven: twenty fields in one call runs well past the ~10s a synchronous Netlify
     * function gets, so the single-call version this replaced failed every time it was asked
     * to draft a real client. See generate-overview.mts.
     *
     * Runs on the server so the client's form answers are read with the service-role key
     * rather than re-fetched here, and so the Anthropic key stays off the browser. It
     * returns the fields; nothing is saved until an AM saves the dashboard, which keeps a
     * bad draft from silently replacing an AM's own notes.
     */
    const generateOverview = async () => {
        if (!slug || isTemplate || overviewBusy) return;
        setOverviewBusy(true);
        setOverviewError("");

        try {
            // Team-only on the server too, so the session token travels with the request.
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData.session?.access_token;
            if (!token) {
                setOverviewError("Your sign-in has expired — reload the page and sign in again.");
                return;
            }

            const groups: { group: string; label: string }[] = [
                { group: "basics", label: "Who they are" },
                { group: "goals", label: "Goals & audience" },
                { group: "brand", label: "Brand & preferences" },
            ];

            const failed: string[] = [];
            let landed = false;

            for (const g of groups) {
                setOverviewStep(g.label);
                try {
                    const res = await fetch("/.netlify/functions/generate-overview", {
                        method: "POST",
                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ slug, group: g.group }),
                    });
                    /* Read as text and parse by hand. res.json() throws a raw
                       "Unexpected end of JSON input" when the reply isn't JSON, and that string then
                       lands in front of an account manager as the entire explanation. The two ways it
                       happens are the local dev server, which serves no functions at all, and Netlify
                       returning an HTML error page — so both get named instead. */
                    const body = await res.text();
                    let json: { doc?: Partial<OverviewDoc>; error?: string } | null = null;
                    try {
                        json = body ? JSON.parse(body) : null;
                    } catch {
                        json = null;
                    }
                    if (!json) {
                        throw new Error(
                            res.status === 404
                                ? "Drafting only runs on the live site — the local dev server doesn't serve it."
                                : `The server didn't send a usable reply (${res.status}).`,
                        );
                    }
                    if (!res.ok || json.error) throw new Error(json.error || `Request failed (${res.status})`);
                    // Merged per group, not batched at the end: a later failure then leaves
                    // the earlier fields on screen instead of discarding the whole run.
                    patchOverviewDoc({
                        // Drop the model's empty strings — a field it couldn't source must not
                        // blank out something an AM already typed on screen.
                        ...(Object.fromEntries(Object.entries(json.doc ?? {}).filter(([, v]) => String(v ?? "").trim())) as Partial<OverviewDoc>),
                        generated_at: new Date().toISOString(),
                        generated_by: user?.email ?? "",
                    });
                    landed = true;
                } catch (err) {
                    console.error(`[overview doc] ${g.group} failed`, err);
                    // One reason is worth more than three copies of it, so the first failure's
                    // message is the one shown — the rest are usually the same cause twice.
                    if (!failed.length) setOverviewError(err instanceof Error ? err.message : "Couldn't draft the document.");
                    failed.push(g.label);
                }
            }

            if (failed.length) {
                setOverviewError((e) =>
                    `Couldn't draft: ${failed.join(", ")}. ${e || ""}${landed ? " Everything else landed — try again for the rest." : ""}`.trim(),
                );
            }
        } finally {
            setOverviewStep("");
            setOverviewBusy(false);
        }
    };

    const onPickOverviewShot = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        try {
            patchOverviewDoc({ instagram_screenshot: await compressImageFile(file) });
        } catch {
            /* keep whatever is already there if compression fails */
        }
    };

    /* ── Website Setup Guide: this client's own owner guide ──
       Resolved by name from owner_guides rather than linked to the bare /owner-guide
       route, which is the SHARED MASTER TEMPLATE — sending a client there is how the
       2026-07-09 content incident happened. The section offers the guide as the place to
       hand over logins; no match ⇒ it tells the client the link is coming and the team to
       go and create one. */
    const [ownerGuideSlug, setOwnerGuideSlug] = useState("");
    useEffect(() => {
        const name = clientName.trim();
        if (!name) {
            setOwnerGuideSlug("");
            return;
        }
        let cancelled = false;
        supabase
            .from("owner_guides")
            .select("slug,client_name")
            .then(({ data, error }) => {
                if (cancelled || error || !data) return;
                const want = slugify(name);
                const hit = data.find((r) => slugify(String(r.client_name ?? "")) === want);
                setOwnerGuideSlug(hit?.slug ?? "");
            });
        return () => {
            cancelled = true;
        };
    }, [clientName]);

    /** True when a link-type nav row has nowhere to go yet — shown as "Soon". */
    const navTargetMissing = (id: SectionId) =>
        (id === "contentfolder" && !content.brand.folder_link.trim()) ||
        // The help centre is per-client and its URL is built from the slug, so the template
        // copy of this page (which has no client behind it) has nowhere to send anyone.
        (id === "help" && (!slug || isTemplate));

    /* ── Website Setup Guide answers ──
       Always merged, so the section and the badge never see a missing block. The team's
       edits ride along in `content` and land with the ordinary Save. A CLIENT can't write
       the row (anon has no UPDATE grant), so their edits also go to the website-setup
       function, debounced, which writes this one key server-side. Local state is updated
       first either way, so the page never waits on the network to reflect a tick. */
    const websiteSetup = useMemo(() => mergeWebsiteSetup(content.website_setup), [content.website_setup]);
    const [setupSave, setSetupSave] = useState<WebsiteSetupSaveState>("idle");
    const [setupSaveError, setSetupSaveError] = useState("");
    const setupSaveTimer = useRef<number | null>(null);
    /** True from the client's first keystroke in the Website Setup Guide until that answer
     *  is written. The one key on this row the client authors, so the one a live update
     *  must leave alone. Stays true on a failed save — the text is still only local. */
    const setupDirtyRef = useRef(false);
    const updateWebsiteSetup = (patch: Partial<WebsiteSetup>) => {
        const next = { ...websiteSetup, ...patch };
        setContent((c) => ({ ...c, website_setup: { ...mergeWebsiteSetup(c.website_setup), ...patch } }));
        if (isTeam || !slug || isTemplate) return;
        // Typed but not yet written — see the live-update handler, which must not replace
        // this key while it is true.
        setupDirtyRef.current = true;
        if (setupSaveTimer.current) window.clearTimeout(setupSaveTimer.current);
        setSetupSave("saving");
        setupSaveTimer.current = window.setTimeout(() => {
            saveWebsiteSetup(slug, identityEmail, next)
                .then(() => {
                    setupDirtyRef.current = false;
                    setSetupSave("saved");
                    setSetupSaveError("");
                })
                .catch((err: unknown) => {
                    setSetupSave("error");
                    setSetupSaveError(err instanceof Error ? err.message : "please try again.");
                });
        }, 800);
    };

    // Overview is the main dashboard — always visible, never hideable, so a client can
    // never end up with nowhere to land. Same reasoning as the owner guide, where the
    // Welcome and Review steps can't be hidden either.
    /**
     * Overview and the Help Centre are the two rows that are never behind the eye toggle.
     *
     * Every other row is a deliverable an AM reveals when it actually ships, which is why the
     * default is hidden. The help centre is not a deliverable: it is how a client tells us
     * something is wrong with one. Leaving it on the toggle would mean every dashboard that
     * already exists shows it as "Soon" and refuses to open, and the one client most in need
     * of it - someone whose work has not landed yet - is the one least likely to have been
     * granted it.
     *
     * It is safe to leave ungated here because this predicate only decides what is SHOWN.
     * The help centre re-proves the caller server-side on every single call (verifyCaller in
     * netlify/lib/reporting.mts) and refuses a dashboard whose access list is empty, saying
     * so on screen. An always-visible row therefore reveals a door, never what is behind it.
     */
    const revealedToClient = (id: SectionId) => id === "overview" || id === "help" || (!TEAM_ONLY_SECTIONS.has(id) && clientVisible.includes(id));
    const toggleClientVisible = (id: SectionId) =>
        setContent((c) => {
            const cur = c.client_visible ?? DEFAULT_CLIENT_VISIBLE;
            return { ...c, client_visible: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] };
        });

    /**
     * Single choke point: whatever route put a client on a section they can't see —
     * a hand-typed `#brand` hash, an Overview funnel card, state left over from before an
     * AM re-hid a row — bounce them to the landing row.
     *
     * The nav and search already filter, so this is the backstop rather than the primary
     * guard. It waits for `authLoading` because `isTeam` is false until the session
     * resolves, and firing early would bounce a team member off their own deep link.
     */
    useEffect(() => {
        if (authLoading || isTeam || isTemplate) return;
        if (!revealedToClient(activeSection)) setActiveSection("overview");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeSection, isTeam, authLoading, isTemplate, clientVisible]);

    type NavItem = (typeof NAV_GROUPS)[number]["items"][number];
    /** Nothing behind this row yet — unopenable for everyone, team included. */
    const navNotBuilt = (s: NavItem) => !!s.soon || navTargetMissing(s.id);
    /** Can this viewer open the row? */
    const navBlocked = (s: NavItem) => navNotBuilt(s) || (!isTeam && !revealedToClient(s.id));
    /**
     * Right-hand state on a nav row.
     *
     * The word depends on WHO is looking, never on why the row is unavailable — the two are
     * never mixed in one menu. "Soon" is the client's word for anything they can't open;
     * "Hidden" is ours for anything the client can't see. A team member therefore never
     * sees "Soon", and a client never sees "Hidden". Where the journey gives the row an
     * estimate, the client reads that ("Week 2") instead of "Soon", and the team reads
     * both ("Week 2 · Hidden") — the week alone would hide that the client can't see it.
     *
     * Whether a row is merely unrevealed or has no section built yet still reads clearly to
     * the team without a second label: unbuilt rows stay dimmed and unopenable and carry no
     * eye, revealed-able ones are full-contrast with an eye in edit mode.
     */
    const navBadge = (s: NavItem) => {
        if (s.teamOnly) {
            return <span className="ml-2 shrink-0 text-[10px] font-bold text-quaternary uppercase">Team</span>;
        }
        const clientCanSee = !navNotBuilt(s) && revealedToClient(s.id);
        if (clientCanSee) return sectionBadge(s.id);
        return (
            <span className="ml-2 shrink-0 text-[10px] font-bold text-quaternary uppercase" title={isTeam ? "Not shown to this client" : undefined}>
                {isTeam ? [SECTION_ETA[s.id], "Hidden"].filter(Boolean).join(" · ") : (SECTION_ETA[s.id] ?? "Soon")}
            </span>
        );
    };

    /** Nav rows number continuously across the whole menu — the second group starts
     *  where the first left off. Built from the rows actually rendered, so a team-only
     *  row hidden from a client doesn't leave a gap in their numbering. */
    const numberedNavItems = NAV_GROUPS.flatMap((g) => g.items.filter((s) => isTeam || !s.teamOnly));
    const navNumber = (id: SectionId) => numberedNavItems.findIndex((s) => s.id === id) + 1;

    /* ── Resizable side menu ──
       The divider IS the handle: a wide invisible hit strip centred on the border, so
       the thing you grab is the thing you see. Width lives in one place and the content
       is simply flex-1, so the two cannot drift apart.

       Clamp measured on this page rather than picked: below RAIL_MIN the longest rows
       (then "Pinned Posts / Story" and "Website Setup Guide", since shortened) start to
       truncate; past RAIL_MAX the reading column on a 1280px laptop is narrower than the
       menu beside it. Kept as the floor after those renames — it is now slack, not tight. */
    const RAIL_DEFAULT = 276;
    const RAIL_MIN = 240;
    const RAIL_MAX = 420;
    const RAIL_KEY = "hgm_dashboard_rail_width";
    const clampRail = (v: number) => Math.min(RAIL_MAX, Math.max(RAIL_MIN, Math.round(v)));

    const [railWidth, setRailWidth] = useState(RAIL_DEFAULT);
    const [dragging, setDragging] = useState(false);
    const railRef = useRef<HTMLElement>(null);

    // Read after mount only, never during render, and tolerate a blocked/empty store.
    useEffect(() => {
        try {
            const saved = Number(localStorage.getItem(RAIL_KEY));
            if (Number.isFinite(saved) && saved > 0) setRailWidth(clampRail(saved));
        } catch {
            /* private browsing — the default width is correct, just not remembered */
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* The listeners go on the WINDOW, not the handle. A pointer capture can be lost, and
       if the end of the drag were bound to the handle's own pointerup the page would stay
       stuck in `select-none` until a reload. Both are torn down in the same effect. */
    useEffect(() => {
        if (!dragging) return;
        const onMove = (e: PointerEvent) => {
            const left = railRef.current?.getBoundingClientRect().left ?? 0;
            setRailWidth(clampRail(e.clientX - left));
        };
        const stop = () => {
            setDragging(false);
            setRailWidth((w) => {
                try {
                    localStorage.setItem(RAIL_KEY, String(w));
                } catch {
                    /* nothing to do — the width still applies for this session */
                }
                return w;
            });
        };
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", stop);
        window.addEventListener("pointercancel", stop);
        return () => {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", stop);
            window.removeEventListener("pointercancel", stop);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dragging]);

    const nudgeRail = (delta: number) => {
        setRailWidth((w) => {
            const next = clampRail(w + delta);
            try {
                localStorage.setItem(RAIL_KEY, String(next));
            } catch {
                /* not persisted; still applied */
            }
            return next;
        });
    };

    /** True when the open section lives in this group — drives the group row's chip. */
    const groupHoldsActive = (phase: string) => (NAV_GROUPS.find((g) => g.phase === phase)?.items ?? []).some((s) => s.id === activeSection);

    /** Nav rows are section switches, bar the two link rows: Folder of Content and Help Centre. */
    const openNavItem = (id: SectionId) => {
        if (id === "contentfolder") {
            const url = content.brand.folder_link.trim();
            if (url) window.open(url, "_blank", "noopener,noreferrer");
            return;
        }
        if (id === "help") {
            // Guarded rather than trusting the caller: the menu row is already disabled when
            // there is no client behind this page (navTargetMissing), but search reaches the
            // same opener without that check, and an unguarded navigate would send the
            // template copy to "//help".
            if (!slug || isTemplate) return;
            // Same tab and an SPA navigate, unlike Folder of Content. The help centre is part
            // of the portal rather than somewhere else we are sending them, it reads the same
            // `cd_unlock_${slug}` this page wrote so the client is asked for one field instead
            // of two, and it has a Dashboard link straight back. Opening it in a new tab would
            // break all three.
            navigate(`/${slug}/help`);
            return;
        }
        setActiveSection(id);
    };

    const updateColor = (i: number, patch: Partial<BrandColor>) =>
        patchBrand({ colors: content.brand.colors.map((col, j) => (j === i ? { ...col, ...patch } : col)) });
    const updateHighlight = (i: number, patch: Partial<Highlight>) =>
        patchInstagram({ highlights: content.instagram.highlights.map((h, j) => (j === i ? { ...h, ...patch } : h)) });
    const updateGhlItem = (i: number, patch: Partial<GhlItem>) =>
        patchGhl({ items: content.ghl.items.map((item, j) => (j === i ? { ...item, ...patch } : item)) });
    const updateMonth = (i: number, patch: Partial<RevenueMonth>) =>
        patchRevenue({ months: content.revenue.months.map((m, j) => (j === i ? { ...m, ...patch } : m)) });
    // By object reference, not index — this array now renders as two filtered views
    // (Website / Chat Widget), so a positional index from one view can't safely
    // address the full array.
    const updateLink = (link: QuickLink, patch: Partial<QuickLink>) =>
        setContent((c) => ({ ...c, links: c.links.map((l) => (l === link ? { ...l, ...patch } : l)) }));
    const removeLink = (link: QuickLink) => setContent((c) => ({ ...c, links: c.links.filter((l) => l !== link) }));

    /* ── Custom Resources rows (side menu) — AM-added links, e.g. a Claude project.
       New rows start hidden so nothing internal leaks to a client by default; the eye
       toggle reveals a row once it's meant for them. Saved with the ordinary Save. */
    const resources = content.resources ?? [];
    const updateResource = (id: string, patch: Partial<(typeof resources)[number]>) =>
        setContent((c) => ({ ...c, resources: (c.resources ?? []).map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
    const addResource = () => setContent((c) => ({ ...c, resources: [...(c.resources ?? []), { id: uid(), label: "", url: "", hidden: true }] }));
    const removeResource = (id: string) => setContent((c) => ({ ...c, resources: (c.resources ?? []).filter((r) => r.id !== id) }));
    const updateVideo = (i: number, patch: Partial<VideoGuide>) =>
        setContent((c) => ({ ...c, videos: (c.videos ?? []).map((v, j) => (j === i ? { ...v, ...patch } : v)) }));
    // By id: the three slots are fixed (mergeContent pads them), so nothing is ever added
    // or removed here — a slot is filled, replaced, or cleared, and keeps its caption.
    const updateReel = (id: string, patch: Partial<ExampleReel>) =>
        setContent((c) => ({ ...c, reels: (c.reels ?? []).map((r) => (r.id === id ? { ...r, ...patch } : r)) }));

    /* ── Derived metrics ── */
    const months = content.revenue.months;
    const fmtMoney = (v: number) => {
        try {
            return new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: content.revenue.currency || "USD",
                maximumFractionDigits: 0,
            }).format(v);
        } catch {
            return `$${Math.round(v).toLocaleString()}`;
        }
    };
    const fmtCompact = (v: number) => new Intl.NumberFormat("en-US", { notation: "compact" }).format(v);
    const totalRevenue = months.reduce((s, m) => s + (m.revenue || 0), 0);
    const totalLeads = months.reduce((s, m) => s + (m.leads || 0), 0);
    const totalAppointments = months.reduce((s, m) => s + (m.appointments || 0), 0);
    const latest = months[months.length - 1];
    const prev = months[months.length - 2];
    const momChange = latest && prev && prev.revenue > 0 ? ((latest.revenue - prev.revenue) / prev.revenue) * 100 : null;

    const ghlDone = content.ghl.items.filter((i) => i.done).length;
    const ghlTotal = content.ghl.items.length;

    const videoGuides = content.videos ?? [];

    const websiteHref = clientWebsite && (clientWebsite.startsWith("http") ? clientWebsite : `https://${clientWebsite}`);

    // Split the shared `links` array by which funnel section it belongs on. The chat
    // widget's own setup guide is Middle of funnel (it's what nurtures/answers guests);
    // everything else (pixel tracking, lead-capture popup, and any custom link a team
    // member adds) is a Top-of-funnel, on-site tool — same array, two filtered views,
    // so nothing about the underlying data shape needs to change.
    const chatWidgetLinks = content.links.filter((l) => l.url.includes("-chatwidget"));
    const websiteLinks = content.links.filter((l) => !l.url.includes("-chatwidget"));

    // Client-scoped search index — sidebar sections, this client's own links, and their
    // FAQ questions. Nothing here reaches outside this one client's own content.
    const searchHits = useMemo<SearchHit[]>(() => {
        // Search must not be a back door. Every hit is filtered by the same rule the nav
        // rows use — a client can only reach a section revealed to them. Filtering on
        // "not built" alone would let a client search "Brand" (or one of their own FAQs,
        // which resolve to the Master Brand section) straight into a hidden section.
        // Exactly the rule the side menu uses, so search results and the menu can never
        // disagree — a client should be able to find everything they can see and nothing
        // they can't. Using the raw list here left Overview unsearchable despite being
        // pinned in their menu.
        // Goes through revealedToClient rather than reading clientVisible directly, so a
        // team-only section can't be surfaced by search even though it's absent from the menu.
        const canOpen = (id: SectionId) => isTeam || revealedToClient(id);
        const navHits = SECTIONS.filter((s) => !("soon" in s && s.soon) && canOpen(s.id)).map((s) => ({ id: s.id, label: s.label }));
        const linkHits = content.links
            .map((l) => ({
                id: (l.url.includes("-chatwidget") ? "chatwidget" : "website") as SectionId,
                label: l.title || "Untitled link",
                sub: "Link",
            }))
            .filter((h) => canOpen(h.id));
        // The Master Brand Document is eleven sections long, so its own headings — plus the
        // personas and focus properties an AM named inside it — are indexed plainly. This
        // replaces the old FAQ-question hits: the FAQ bank is gone, and without something
        // in its place the whole document collapsed to a single "Master Brand" result.
        const docHits = canOpen("foundation")
            ? [
                  ...FOUNDATION_SECTIONS.map((s) => ({ id: "foundation" as SectionId, label: s.label, sub: "Master Brand" })),
                  ...foundation.personas.filter((p) => p.name.trim()).map((p) => ({ id: "foundation" as SectionId, label: p.name, sub: "Persona" })),
                  ...foundation.focusProperties
                      .filter((p) => p.name.trim())
                      .map((p) => ({ id: "foundation" as SectionId, label: p.name, sub: "Focus property" })),
              ]
            : [];
        return [...navHits, ...linkHits, ...docHits];
    }, [content.links, foundation.personas, foundation.focusProperties, isTeam, clientVisible]);

    /* ── Lock / save ── */
    /** Persist edits to the shared dashboard_pages row, then lock. */
    /**
     * Save, then lock.
     *
     * Reports what happened via `saveState`, which the Save button reads. This used to log a
     * failed write to the console and lock anyway — survivable while the only way to trigger
     * it was a keyboard shortcut you had to know about, but not once there's a button marked
     * "Save": pressing it and getting a locked, apparently-finished dashboard is how an AM
     * loses an afternoon of notes without ever being told.
     *
     * On failure it stays UNLOCKED. The edits are still in state, so the AM can try again;
     * locking would hide the very fields that haven't been written yet.
     */
    const persistAndLock = async () => {
        if (slug && !isTemplate) {
            setSaveState("saving");
            /* A save writes the WHOLE row, last writer wins — so a tab left open since the
               morning silently erased an afternoon of other people's work three times on
               2026-08-24. Before writing, re-read the row: if it changed since this tab last
               saw it, someone else saved in between. Block once and say so; a second press
               overwrites deliberately. Stays unlocked either way, so nothing is lost. */
            if (savedRowRef.current !== null && !overwriteArmedRef.current) {
                const { data: row, error: readErr } = await supabase.from("dashboard_pages").select("data").eq("slug", slug).maybeSingle();
                if (!readErr && JSON.stringify(row?.data ?? null) !== savedRowRef.current) {
                    overwriteArmedRef.current = true;
                    setSaveState("conflict");
                    return;
                }
            }
            // What the row held before this write, read off the same baseline the conflict
            // guard uses. Captured BEFORE the upsert, because the baseline is replaced below.
            const before = savedRowRef.current === null ? null : (JSON.parse(savedRowRef.current) as Partial<DashboardContent> | null);

            const { error } = await supabase
                .from("dashboard_pages")
                .upsert({ slug, client_name: clientName.trim(), client_website: clientWebsite.trim(), data: content }, { onConflict: "slug" });
            overwriteArmedRef.current = false;
            if (error) {
                console.error("[client dashboard save] Supabase error:", error);
                setSaveState("error");
                return;
            }
            // The baseline must be the row as the SERVER now stores it, not our local copy —
            // jsonb re-orders keys, so only a re-read compares equal on the next save.
            const { data: fresh } = await supabase.from("dashboard_pages").select("data").eq("slug", slug).maybeSingle();
            savedRowRef.current = fresh ? JSON.stringify(fresh.data ?? null) : null;
            // Log who changed what, for the team's feed at /log. Deliberately not awaited and
            // never fatal: the dashboard is already saved, and an audit line that failed to
            // write must not read to the AM as a save that failed. Writes nothing when the
            // diff is empty, so re-locking an untouched page leaves no trace.
            void recordDashboardSave({ slug, clientName: clientName.trim(), before, after: content });
            // Accepted suggestions become "accepted" in the DB only now, after the values
            // they carry are really saved. On error they simply stay pending — re-accepting
            // applies the same value again, so nothing is lost either way.
            if (queuedAccepts.size) {
                const { error: flushErr } = await supabase
                    .from("dashboard_suggestions")
                    .update({ status: "accepted", resolved_by: user?.email ?? "", resolved_at: new Date().toISOString() })
                    .in("id", [...queuedAccepts]);
                if (!flushErr) {
                    setQueuedAccepts(new Set());
                    void refreshSuggestions();
                }
            }
            setSaveState("saved");
            window.setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 2500);
        }
        setIsLocked(true);
    };

    /* ── Master Document — generate for AM review (team-only) ── */
    const masterDoc = showMasterDocModal ? compileMasterDocument(clientName, clientWebsite, foundation) : null;
    const copyMasterDoc = () => {
        if (!masterDoc) return;
        void navigator.clipboard.writeText(masterDoc.doc).then(() => {
            setMasterDocCopied(true);
            setTimeout(() => setMasterDocCopied(false), 1600);
        });
    };
    const downloadMasterDoc = () => {
        if (!masterDoc) return;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([masterDoc.doc], { type: "text/markdown" }));
        a.download = `${(clientName.trim() || "client").toLowerCase().replace(/\s+/g, "-")}-master-document.md`;
        a.click();
        URL.revokeObjectURL(a.href);
    };

    /**
     * Copy the whole document from the section header, as rich text + plain text.
     *
     * The HTML flavor is what makes pasting into a Google Doc give real headings
     * instead of literal "##" markdown; plain text rides along for editors that
     * only take text. Compiles on demand — `masterDoc` only exists while the
     * review modal is open.
     */
    const copyMasterDocForDocs = async () => {
        const compiled = compileMasterDocument(clientName, clientWebsite, foundation);
        const html = masterDocumentHtml(clientName, clientWebsite, foundation, compiled.generatedOn);
        try {
            await navigator.clipboard.write([
                new ClipboardItem({
                    "text/html": new Blob([html], { type: "text/html" }),
                    "text/plain": new Blob([compiled.doc], { type: "text/plain" }),
                }),
            ]);
        } catch {
            // Older browsers without ClipboardItem: plain text still beats nothing.
            try {
                await navigator.clipboard.writeText(compiled.doc);
            } catch {
                return;
            }
        }
        setHeaderDocCopied(true);
        setTimeout(() => setHeaderDocCopied(false), 1600);
    };

    /** The Client Overview brief, copied the same way — rich text for Google Docs, plain text behind it. */
    const copyOverviewForDocs = async () => {
        const compiled = compileOverviewDocument(overviewDoc);
        try {
            await navigator.clipboard.write([
                new ClipboardItem({
                    "text/html": new Blob([compiled.html], { type: "text/html" }),
                    "text/plain": new Blob([compiled.markdown], { type: "text/plain" }),
                }),
            ]);
        } catch {
            try {
                await navigator.clipboard.writeText(compiled.markdown);
            } catch {
                return;
            }
        }
        setOverviewCopied(true);
        setTimeout(() => setOverviewCopied(false), 1600);
    };

    /**
     * Download the Master Document as a PDF for the AM to share.
     *
     * jsPDF arrives via dynamic import so it costs nothing until clicked.
     */
    const downloadMasterDocPdf = async () => {
        if (pdfBusy) return;
        setPdfBusy(true);
        try {
            const compiled = compileMasterDocument(clientName, clientWebsite, foundation);
            const { buildMasterDocumentPdf, masterDocumentFileName } = await import("@/utils/master-document-pdf");
            buildMasterDocumentPdf({
                clientName,
                clientWebsite,
                generatedOn: compiled.generatedOn,
                sections: compiled.sections,
            }).save(masterDocumentFileName(clientName));
        } catch (err) {
            console.error("[master-document] PDF export failed", err);
            setPdfError(true);
            setTimeout(() => setPdfError(false), 3200);
        } finally {
            setPdfBusy(false);
        }
    };

    /**
     * Draft the whole Master Brand Document from the client's own material.
     *
     * Eight model calls plus one website read, run one at a time. Each is a separate request
     * because the document is ~66 fields and a single call for all of them exceeds the ~10s
     * a synchronous Netlify function gets — see generate-master-section.mts for why that
     * beat making it a background function.
     *
     * Sequential rather than parallel on purpose: the groups are cheap individually, the AM
     * watches them tick past, and a burst of eight concurrent Opus calls is the kind of thing
     * that trips a rate limit at exactly the wrong moment.
     *
     * Nothing is saved. Every group merges through mergeFoundationDraft, which can only fill
     * empty boxes, so this is safe to run on a half-finished document and safe to re-run.
     */
    const draftMasterDocument = async () => {
        if (!slug || isTemplate || masterDraftStep) return;
        setMasterDraftError("");
        setMasterDraftDone([]);

        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) {
            setMasterDraftError("Your sign-in has expired — reload the page and sign in again.");
            return;
        }

        /** One request. Returns null and records the reason when the group fails. */
        const run = async (group: string, extra: Record<string, unknown> = {}): Promise<Record<string, unknown> | null> => {
            const res = await fetch("/.netlify/functions/generate-master-section", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ slug, group, ...extra }),
            });
            /* Read as text and parse by hand, same as the Overview draft: res.json() throws
               "Unexpected end of JSON input" when the reply isn't JSON, and that string is
               then the entire explanation an AM gets. The two ways it happens are nothing
               listening on the dev functions port, and Netlify returning an HTML error page. */
            const body = await res.text();
            let json: Record<string, unknown> | null = null;
            try {
                json = body ? JSON.parse(body) : null;
            } catch {
                json = null;
            }
            if (!json) {
                throw new Error(
                    res.status === 404 || res.status === 502
                        ? "No functions server on :9999 — run `netlify functions:serve --port 9999` alongside the dev server."
                        : `The server didn't send a usable reply (${res.status}).`,
                );
            }
            if (!res.ok || json.error) throw new Error(String(json.error || `Request failed (${res.status})`));
            return json;
        };

        try {
            // The website first, once: its text feeds two of the groups below, and the links
            // it finds are the ONLY source of URLs anywhere in the document.
            setMasterDraftStep("Reading their website");
            let siteText = "";
            let allowedLinks: string[] = [];
            let siteLinks: { page: string; url: string }[] = [];
            try {
                const site = await run("site");
                siteText = String(site?.siteText ?? "");
                siteLinks = (site?.links as { page: string; url: string }[] | undefined) ?? [];
                allowedLinks = siteLinks.map((l) => l.url);
                // Section 11 is pure extraction — the sitemap table is what the crawl found,
                // with no model in the loop to invent a page that doesn't exist.
                if (siteLinks.length) patchFoundation(mergeFoundationDraft(foundation, { websiteLinks: siteLinks }));
                setMasterDraftDone((d) => [...d, "Website links"]);
            } catch (err) {
                // A site we can't read shouldn't stop the sections that don't need it.
                console.warn("[master draft] website read failed", err);
                setMasterDraftError(err instanceof Error ? `${err.message} Drafting continued without the website.` : "");
            }

            const groups: { group: string; label: string; extra?: Record<string, unknown> }[] = [
                // Also optional website: the brief already tells it to lean on their own
                // About Us story, which only exists on the site.
                { group: "hosts", label: "Hosts & location", extra: { siteText } },
                { group: "properties", label: "The properties", extra: { siteText } },
                /* The three brand groups get the website and the pasted reviews as well as
                   the forms. The forms stay the source of truth (the system prompt ranks
                   them), but a UVP needs the concrete facts that only live on the site, and
                   the reviews are the only evidence of what guests actually value and the
                   words they use for it. Both are optional — unlike `properties` and
                   `focus` below, these groups draft fine without either. */
                { group: "brand", label: "Audience & UVP", extra: { siteText, reviewsText: reviewsPaste } },
                { group: "voice", label: "Brand voice, taglines & bio", extra: { siteText, reviewsText: reviewsPaste } },
                { group: "personas", label: "Personas", extra: { siteText, reviewsText: reviewsPaste } },
                { group: "focus", label: "Focus properties", extra: { siteText, allowedLinks } },
                { group: "favorites", label: "Local favorites" },
                { group: "reviews", label: "Reviews", extra: { reviewsText: reviewsPaste } },
            ];

            const failed: string[] = [];
            for (const g of groups) {
                // Groups whose only source is missing are skipped quietly rather than
                // reported as failures — no website on file and no pasted reviews are both
                // ordinary states, not errors.
                if (g.group === "reviews" && !reviewsPaste.trim()) continue;
                if ((g.group === "properties" || g.group === "focus") && !siteText) continue;

                setMasterDraftStep(g.label);
                try {
                    const out = await run(g.group, g.extra);
                    const fields = (out?.fields as Record<string, unknown> | undefined) ?? {};
                    // Merged per group, not batched at the end: a later failure then leaves
                    // the earlier sections in place instead of discarding the whole run.
                    setContent((c) => {
                        const current = { ...DEFAULT_FOUNDATION, ...c.foundation };
                        return { ...c, foundation: { ...current, ...mergeFoundationDraft(current, fields) } };
                    });
                    setMasterDraftDone((d) => [...d, g.label]);
                } catch (err) {
                    console.error(`[master draft] ${g.group} failed`, err);
                    failed.push(g.label);
                }
            }

            if (failed.length) setMasterDraftError(`Couldn't draft: ${failed.join(", ")}. Everything else landed — try again for the rest.`);
        } catch (err) {
            console.error("[master draft] failed", err);
            setMasterDraftError(err instanceof Error ? err.message : "Couldn't draft the document.");
        } finally {
            setMasterDraftStep("");
        }
    };

    // Shift+E toggles edit mode, Shift+S saves immediately and locks — team-only
    // (gated by isTeam) since clients also reach this page. No password step here:
    // isTeam already means a signed-in @hiddengem.media session, same precedent as
    // the Plus/create flow below skipping the password gate for signed-in team members.
    useEditShortcuts({
        enabled: isTeam,
        onToggle: () => {
            if (isLocked) setIsLocked(false);
            else void persistAndLock();
        },
        onSave: () => void persistAndLock(),
    });

    /* ── Create flow ── */
    const handlePlusClick = () => {
        setShowPlusModal(true);
        // Signed-in @hiddengem.media users are already authenticated — skip the password gate.
        setPlusStep(isTeam ? "details" : "password");
        setPlusPassword("");
        setPlusPasswordError(false);
        setNewClientName("");
        setNewClientWebsite("");
        setCreateError("");
    };

    const handlePlusPassword = () => {
        if (plusPassword === PASSWORD) {
            setPlusPasswordError(false);
            setPlusStep("details");
        } else {
            setPlusPasswordError(true);
        }
    };

    const handleCreatePage = async () => {
        const base = slugify(newClientName);
        if (!base) return;
        const newSlug = `${base}-dashboard`;
        setIsCreating(true);
        setCreateError("");
        const { error } = await supabase.from("dashboard_pages").upsert({
            slug: newSlug,
            client_name: newClientName.trim(),
            client_website: newClientWebsite.trim(),
            data: createDefaultContent(base),
        });
        setIsCreating(false);
        if (error) {
            setCreateError("Could not save — check your connection and try again.");
            return;
        }
        setShowPlusModal(false);
        navigate(`/${newSlug}`);
    };

    /* ── The journey timeline on Overview ── */
    /**
     * Calendly posts a message to the parent window as the booking completes. Listening for it is
     * what lets the dashboard react in the moment instead of waiting for an AM to notice.
     *
     * Only bookings made in this modal are seen — book from the confirmation email or another
     * device and nothing arrives here, which is why the AM tick stays available as a backstop.
     *
     * The origin check is not optional: `message` fires for anything any frame posts, so without it
     * any embedded or opener page could mark a client's step done by posting the right string.
     */
    useEffect(() => {
        if (!bookingOpen) return;
        const onMessage = (e: MessageEvent) => {
            if (e.origin !== "https://calendly.com") return;
            if (e.data?.event !== "calendly.event_scheduled") return;
            setJustBooked(true);
            setContent((c) => {
                const done = c.journey_done ?? [];
                return done.includes("kickoff") ? c : { ...c, journey_done: [...done, "kickoff"] };
            });
            // The browser can't write to Supabase itself (anon has no UPDATE grant), so the save
            // goes through the function. A failure here only costs the persisted tick — the client
            // still sees the confirmation, and their booking is real regardless.
            if (slug && !isTemplate) {
                void fetch("/.netlify/functions/mark-booked", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ slug }),
                }).catch((err) => console.error("[mark-booked] request failed", err));
            }
        };
        window.addEventListener("message", onMessage);
        return () => window.removeEventListener("message", onMessage);
    }, [bookingOpen, slug, isTemplate]);

    const journeyDone = content.journey_done ?? [];

    /** Reducers and the legacy-row rules live in dashboard-navigation.ts, beside the steps
     *  they encode and under dashboard-navigation.check.ts. These just bind them to state. */
    const journeyItemDone = (stepId: JourneyStepId, itemId: string) => isJourneyItemDone(journeyDone, stepId, itemId);
    const toggleJourneyStep = (id: JourneyStepId) => setContent((c) => ({ ...c, journey_done: toggleJourneyStepDone(c.journey_done ?? [], id) }));
    const toggleJourneyItem = (stepId: JourneyStepId, itemId: string) =>
        setContent((c) => ({ ...c, journey_done: toggleJourneyItemDone(c.journey_done ?? [], stepId, itemId) }));

    /* The three per-client links the journey points at. Pulled out as primitives so the
       memo below depends on the URLs themselves, not on the whole content object — which
       changes on every keystroke in edit mode. */
    const chatLink = content.chat_link;
    const folderLink = content.brand.folder_link;
    const onboardingCallUrl = content.onboarding_call_url;

    /**
     * Each step with its resolved state. The two form steps read their live answer counts;
     * everything else reflects an AM tick. `progress` is only shown where a real
     * denominator exists — a made-up fraction on "Onboarding Call" would be noise.
     */
    const journeySteps = useMemo(() => {
        /** A named per-client link, resolved off the row. Missing ⇒ "" — the caller
         *  renders the line without a button rather than a button that goes nowhere. */
        const linkFor = (key?: JourneyLink) =>
            key === "chat" ? (chatLink ?? "").trim() : key === "folder" ? folderLink.trim() : key === "onboarding_call" ? (onboardingCallUrl ?? "").trim() : "";

        return JOURNEY_STEPS.map((step) => {
            // Resolved once here so the renderer treats a static href (the Kick-off
            // Calendly) and a per-client one (the Onboarding Call) identically.
            const resolved = {
                ...step,
                href: step.href ?? (step.hrefFrom ? linkFor(step.hrefFrom) || undefined : undefined),
                items: step.items?.map((item) => ({
                    ...item,
                    url: linkFor(item.link),
                    // Only a tickable step's items carry state; everywhere else this stays
                    // false and the renderer draws no box, per JOURNEY_STEPS' items comment.
                    done: step.itemsTickable ? journeyItemDone(step.id, item.id ?? item.label) : false,
                })),
            };
            if (step.id === "form") {
                return {
                    ...resolved,
                    done: intakeSubmitted,
                    progress: intakeInfo.total ? { value: intakeInfo.answered, total: intakeInfo.total } : null,
                    // The submitted date is the honest start of the clock for both sides: it is
                    // when we actually had what we needed, so neither party has to reconstruct it
                    // later from memory. Already stored by the form itself — only shown here.
                    detail: intakeSubmittedAt
                        ? `Submitted ${new Date(intakeSubmittedAt).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })} — you can still update your answers.`
                        : intakeInfo.total
                          ? `${intakeInfo.answered} of ${intakeInfo.total} questions answered.`
                          : step.detail,
                };
            }
            if (step.id === "vision") {
                return {
                    ...resolved,
                    done: onboardingSubmitted,
                    progress: onboardingInfo.total ? { value: onboardingInfo.answered, total: onboardingInfo.total } : null,
                    detail: onboardingSubmittedAt
                        ? `Submitted ${new Date(onboardingSubmittedAt).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })} — thank you.`
                        : onboardingInfo.total
                          ? `${onboardingInfo.answered} of ${onboardingInfo.total} questions answered.`
                          : step.detail,
                };
            }
            // A step built from tickable items has no state of its own: it is done when
            // all of them are, and its progress is the count — which is what gives the
            // launch meter a cell per piece.
            if (step.itemsTickable && resolved.items?.length) {
                const total = resolved.items.length;
                const value = resolved.items.filter((item) => item.done).length;
                return {
                    ...resolved,
                    done: value === total,
                    progress: { value, total },
                    detail: value === total ? "Every piece reviewed — thank you." : `${value} of ${total} pieces reviewed.`,
                };
            }
            return { ...resolved, done: journeyDone.includes(step.id), progress: null };
        });
    }, [
        intakeSubmitted,
        intakeSubmittedAt,
        onboardingSubmitted,
        onboardingSubmittedAt,
        intakeInfo,
        onboardingInfo,
        journeyDone,
        chatLink,
        folderLink,
        onboardingCallUrl,
    ]);

    const journeyDoneCount = journeySteps.filter((s) => s.done).length;
    /** First unfinished step — highlighted so a client can see what's next at a glance. */
    const journeyCurrentId = journeySteps.find((s) => !s.done)?.id ?? null;

    /**
     * The launch meter's cells and the stages bracketing them.
     *
     * The bar is a summary, so its composition lives in JOURNEY_BAR rather than being read
     * off the step list — see the note there for what it leaves out and why. Here we only
     * resolve each declared cell against live step state.
     *
     * One cell per thing a client can finish: a cell over a step ticked piece by piece
     * becomes a cell per piece, which is what makes Marketing funnel the long stage and
     * what lets a single review move the bar. Every cell is worth the same, so the bar's
     * fill and the percentage above it are the same number.
     *
     * A cell fills fractionally wherever there is something real to count — a part-answered
     * form, a funnel piece reviewed. A made-up fraction is never invented: a cell with
     * nothing to count is 0 or 1.
     */
    const { journeyCells, journeyGroups } = useMemo(() => {
        const fractionOf = (step: (typeof journeySteps)[number]) =>
            step.done ? 1 : step.progress && step.progress.total > 0 ? step.progress.value / step.progress.total : 0;

        const byId = new Map(journeySteps.map((step) => [step.id, step]));

        const cellsFor = (bar: (typeof JOURNEY_BAR)[number], isLast: boolean) => {
            const steps = bar.steps.map((id) => byId.get(id)).filter((step): step is (typeof journeySteps)[number] => !!step);
            if (!steps.length) return [];

            // A cell standing over one tickable step is really that step's pieces.
            const [only] = steps;
            if (steps.length === 1 && only.itemsTickable && only.items?.length) {
                const nextUp = only.items.findIndex((item) => !item.done);
                return only.items.map((item, i) => ({
                    id: `${only.id}:${item.id ?? item.label}`,
                    label: item.label,
                    fraction: item.done ? 1 : 0,
                    // The piece a client is on, not the whole step: the beam in the list
                    // below marks the step, this marks the review inside it.
                    current: only.id === journeyCurrentId && i === nextUp,
                    rocket: false,
                }));
            }

            return [
                {
                    id: bar.id,
                    label: bar.label,
                    // Merged cells (the two forms) average their steps, so finishing one of
                    // two half-fills the cell instead of leaving it dark until both land.
                    fraction: steps.reduce((sum, step) => sum + fractionOf(step), 0) / steps.length,
                    current: steps.some((step) => step.id === journeyCurrentId),
                    // The bar's last cell IS the destination, so it wears the rocket rather
                    // than the bar growing an extra cell nobody can tick.
                    rocket: isLast,
                },
            ];
        };

        const cells: ReturnType<typeof cellsFor> = [];
        const counts = new Map<string, number>();
        JOURNEY_BAR.forEach((bar, i) => {
            const made = cellsFor(bar, i === JOURNEY_BAR.length - 1);
            cells.push(...made);
            counts.set(bar.stage, (counts.get(bar.stage) ?? 0) + made.length);
        });

        const groups = JOURNEY_STAGES.map((stage) => ({ id: stage.id, label: stage.label, cells: counts.get(stage.id) ?? 0 })).filter(
            (group) => group.cells > 0,
        );

        return { journeyCells: cells, journeyGroups: groups };
    }, [journeySteps, journeyCurrentId]);

    /** "Up next", named down to the piece where a step has several. */
    const journeyNextLabel = useMemo(() => {
        const step = journeySteps.find((s) => s.id === journeyCurrentId);
        if (!step) return null;
        const piece = step.itemsTickable ? step.items?.find((item) => !item.done) : undefined;
        return piece ? `${step.label} — ${piece.label}` : step.label;
    }, [journeySteps, journeyCurrentId]);
    /** Whatever now follows the Kick-off Call — named in the booking confirmation so that
     *  copy can't go stale the next time the order is reshuffled. It has twice already. */
    const stepAfterKickoff = journeySteps[journeySteps.findIndex((s) => s.id === "kickoff") + 1] ?? null;

    /* ── Collapsible phase groups ──
       Phases 1–5 start folded and Client Input starts open: the forms are the only
       thing we need from the client, so that group leads, and the five delivery
       phases stay out of the way until they're wanted.

       Two pieces of state on purpose. `collapsedGroups` is the client's explicit
       choice and is what persists. `autoOpenPhase` is transient — opening a section
       from outside the menu (Overview cards, the setup panel, search) unfolds its
       group for that visit without rewriting the saved preference, so the menu
       returns to its folded default next time rather than drifting fully open. */
    const collapseKey = `hgm_dash_nav_collapsed_${slug || "template"}`;
    const DEFAULT_COLLAPSED: Record<string, boolean> = { p1: true, p2: true, p3: true, p4: true, p5: true };
    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() => {
        try {
            const saved = localStorage.getItem(collapseKey);
            return saved ? JSON.parse(saved) : DEFAULT_COLLAPSED;
        } catch {
            return DEFAULT_COLLAPSED;
        }
    });
    useEffect(() => {
        try {
            localStorage.setItem(collapseKey, JSON.stringify(collapsedGroups));
        } catch {
            /* private mode — collapsing still works, it just won't persist */
        }
    }, [collapseKey, collapsedGroups]);

    const [autoOpenPhase, setAutoOpenPhase] = useState<PhaseId | null>(null);
    useEffect(() => {
        setAutoOpenPhase(phaseOfSection(activeSection));
    }, [activeSection]);

    /** Folded unless the client opened it, or it holds the section currently on screen. */
    const isGroupCollapsed = (phase: PhaseId) => !!collapsedGroups[phase] && autoOpenPhase !== phase;

    /** Toggle from the group header. Collapsing the group you're currently in has to
        work, so this also clears the transient auto-open. */
    const toggleGroup = (phase: PhaseId) => {
        const collapsing = !isGroupCollapsed(phase);
        if (collapsing && autoOpenPhase === phase) setAutoOpenPhase(null);
        setCollapsedGroups((c) => ({ ...c, [phase]: collapsing }));
    };

    /** Does this group still need something from the client? Collapsing must not hide that. */
    const groupHasTodo = (phase: PhaseId) => {
        const g = NAV_GROUPS.find((x) => x.phase === phase);
        if (!g) return false;
        return g.items.some((i) => {
            if (i.id === "intake") return intakeReady && !intakeSubmitted;
            if (i.id === "onboarding") return onboardingReady && !onboardingSubmitted;
            if (i.id === "foundation") {
                const f = content.foundation;
                if (!f) return false;
                return [f.propertyBasics, f.persona, f.toneOfVoice, f.amenities, f.localRecommendations, f.bookingLinks].some((v) => !(v ?? "").trim());
            }
            return false;
        });
    };

    /** Per-section badge for the side menu — real state, not decoration. Lets a client
        see at a glance what still needs them without opening every section. */
    const sectionBadge = (id: SectionId): ReactNode => {
        const pill = (text: string, tone: "done" | "todo" | "muted") => (
            <span
                className={cx(
                    "ml-2 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                    tone === "done" && "bg-utility-green-50 text-utility-green-700",
                    tone === "todo" && "bg-utility-brand-50 text-utility-brand-700",
                    tone === "muted" && "text-quaternary",
                )}
            >
                {text}
            </span>
        );
        if (id === "intake") {
            if (!intakeReady) return null;
            if (intakeSubmitted) return pill("Done", "done");
            return intakeInfo.total ? pill(`${intakeInfo.answered}/${intakeInfo.total}`, "todo") : null;
        }
        if (id === "onboarding") {
            if (!onboardingReady) return null;
            if (onboardingSubmitted) return pill("Done", "done");
            return onboardingInfo.total ? pill(`${onboardingInfo.answered}/${onboardingInfo.total}`, "todo") : null;
        }
        if (id === "foundation") {
            const f = content.foundation;
            if (!f) return null;
            const filled = [f.propertyBasics, f.persona, f.toneOfVoice, f.amenities, f.localRecommendations, f.bookingLinks].filter((v) =>
                (v ?? "").trim(),
            ).length;
            return filled ? pill(`${filled}/6`, filled === 6 ? "done" : "todo") : null;
        }
        if (id === "brand") {
            const n = content.brand?.colors?.length ?? 0;
            return n ? pill(String(n), "muted") : null;
        }
        if (id === "videos") {
            const n = content.videos?.length ?? 0;
            return n ? pill(String(n), "muted") : null;
        }
        if (id === "ownerguide") {
            const p = websiteSetupProgress(websiteSetup);
            return p.complete ? pill("Done", "done") : pill(`${p.done}/${p.total}`, "todo");
        }
        if (id === "reels") {
            const n = (content.reels ?? []).filter((r) => r.url).length;
            return n ? pill(`${n}/${REEL_SLOTS}`, "muted") : null;
        }
        if (id === "pinnedposts") {
            // Open change requests need the team; everything else is just a count.
            const open = pinnedFeedback.filter((s) => s.status === "pending" && s.field_key.endsWith(".feedback")).length;
            if (isTeam && open) return pill(String(open), "todo");
            // Three slots always exist; only the filled ones count.
            const n = pinnedPosts.posts.filter((p) => p.slides.length > 0).length;
            return n ? pill(`${n}/3`, "muted") : null;
        }
        return null;
    };

    const removeButton =
        "flex size-8 shrink-0 items-center justify-center rounded-lg text-fg-quaternary transition duration-100 ease-linear hover:bg-error-primary hover:text-fg-error-primary";

    /* ── Access gate ──
       After every hook, so the hook order never changes between renders. Waits for the auth
       lookup rather than flashing a sign-in screen at somebody who turns out to be allowed. */
    if (authLoading) {
        return (
            <main className="flex min-h-dvh items-center justify-center bg-tertiary">
                <div className="size-8 animate-spin rounded-full border-2 border-brand border-t-transparent opacity-60" />
            </main>
        );
    }
    if (!hasAccess)
        return <DashboardAccessGate users={dashboardUsers} sharePassword={sharePassword} onUnlock={unlockDashboard} backgroundUrl={content.login_bg_url} />;

    return (
        <>
            {/* Full-bleed shell: no page padding, no window, no cards. The side menu's
                right hairline is the only division, so the dashboard runs edge to edge
                the way an app does rather than sitting on a tray. */}
            <div className="flex h-dvh flex-col overflow-hidden bg-primary">
                {/* Preview banner — only ever rendered for a signed-in team member, so the
                    client can never see it. Without it the preview is a trap: Shift+E just
                    stops working and every team-only control disappears, which reads as
                    broken permissions rather than a deliberate mode. */}
                {previewAsClient && (
                    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 bg-brand-solid px-3.5 py-2 text-sm text-white">
                        <span className="flex items-center gap-2 font-semibold">
                            <EyeGlyph />
                            Viewing as client
                        </span>
                        <span className="flex-1 text-white/80">
                            This is exactly what {clientName.trim() || "the client"} sees. Editing and team-only controls are off.
                        </span>
                        <button
                            type="button"
                            onClick={exitClientPreview}
                            className="shrink-0 rounded-md bg-white/15 px-2.5 py-1 text-xs font-semibold text-white transition duration-100 ease-linear hover:bg-white/25"
                        >
                            Exit preview
                        </button>
                    </div>
                )}
                <div className="flex min-h-0 flex-1 overflow-hidden">
                    <div className="flex min-h-0 w-full flex-col overflow-hidden bg-primary md:flex-row">
                        {/* ── Client side menu (no icon rail — client-facing) ── */}
                        <aside
                            ref={railRef}
                            // Width is state, not a class: `md:w-[276px]` would be a lie the moment
                            // anyone dragged the divider. 276 matches MAIN_SIDEBAR_WIDTH in the
                            // Untitled UI sidebar kit and stays the default.
                            style={{ ["--rail" as string]: `${railWidth}px` } as React.CSSProperties}
                            className={cx(
                                // The rail sits on its own background, one step off the content — the
                                // hairline then separates two surfaces rather than splitting one.
                                "relative flex w-full shrink-0 flex-col overflow-visible border-secondary bg-secondary md:h-full md:w-[var(--rail)] md:border-r",
                                // Never transition width during a drag — it lags the pointer.
                                !dragging && "md:transition-[width] md:duration-100 md:ease-linear",
                            )}
                        >
                            {/* The divider doubles as the drag handle: a 12px invisible hit strip
                                centred on the 1px border, so the grab target is generous while the
                                thing you see stays a hairline. Desktop only — below md the menu is
                                full width and there is nothing to resize. */}
                            <div
                                role="separator"
                                aria-orientation="vertical"
                                aria-label="Resize side menu"
                                aria-valuenow={railWidth}
                                aria-valuemin={RAIL_MIN}
                                aria-valuemax={RAIL_MAX}
                                tabIndex={0}
                                onPointerDown={(e) => {
                                    e.preventDefault();
                                    setDragging(true);
                                }}
                                onDoubleClick={() => {
                                    setRailWidth(RAIL_DEFAULT);
                                    try {
                                        localStorage.setItem(RAIL_KEY, String(RAIL_DEFAULT));
                                    } catch {
                                        /* not persisted; still applied */
                                    }
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === "ArrowLeft") {
                                        e.preventDefault();
                                        nudgeRail(-16);
                                    }
                                    if (e.key === "ArrowRight") {
                                        e.preventDefault();
                                        nudgeRail(16);
                                    }
                                }}
                                className={cx(
                                    "absolute top-0 -right-1.5 z-20 hidden h-full w-3 cursor-col-resize md:block",
                                    "outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-0",
                                    "after:absolute after:inset-y-0 after:left-1/2 after:w-0.5 after:-translate-x-1/2 after:transition after:duration-100 after:ease-linear",
                                    dragging ? "after:bg-brand-solid" : "after:bg-transparent hover:after:bg-border-brand",
                                )}
                            />

                            {/* Client identity */}
                            <div className="flex items-center gap-3 border-b border-secondary px-4 py-4 md:px-5">
                                <button
                                    type="button"
                                    onClick={() => (canEnterPreview ? enterClientPreview() : logoFileRef.current?.click())}
                                    disabled={isLocked && !canEnterPreview}
                                    title={
                                        canEnterPreview
                                            ? "View this dashboard as the client sees it"
                                            : isLocked
                                              ? undefined
                                              : content.logo_url
                                                ? "Replace logo"
                                                : "Upload logo"
                                    }
                                    className={cx(
                                        "group relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-secondary ring-1 ring-secondary",
                                        (!isLocked || canEnterPreview) && "cursor-pointer",
                                        canEnterPreview && "transition duration-100 ease-linear hover:ring-brand",
                                    )}
                                >
                                    {content.logo_url ? (
                                        <img
                                            src={content.logo_url}
                                            alt={`${clientName || "Client"} logo`}
                                            className="size-full object-contain p-1"
                                            draggable={false}
                                        />
                                    ) : (
                                        <Image01 className="size-5 text-fg-quaternary" aria-hidden="true" />
                                    )}
                                    {!isLocked && (
                                        <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition duration-100 ease-linear group-hover:bg-black/50 group-hover:opacity-100">
                                            <Camera01 className="size-4" aria-hidden="true" />
                                        </span>
                                    )}
                                </button>
                                {!isLocked && <input ref={logoFileRef} type="file" accept="image/*" className="hidden" onChange={onPickLogo} />}
                                <div className="min-w-0">
                                    {canEnterPreview ? (
                                        <button
                                            type="button"
                                            onClick={enterClientPreview}
                                            title="View this dashboard as the client sees it"
                                            className="group/name flex max-w-full items-center gap-1.5 text-left"
                                        >
                                            <span className="truncate text-sm font-semibold text-primary transition duration-100 ease-linear group-hover/name:text-brand-secondary">
                                                {clientName || "Client Name"}
                                            </span>
                                            <span
                                                aria-hidden="true"
                                                className="shrink-0 text-fg-quaternary opacity-0 transition duration-100 ease-linear group-hover/name:opacity-100"
                                            >
                                                <EyeGlyph />
                                            </span>
                                        </button>
                                    ) : (
                                        <p className="truncate text-sm font-semibold text-primary">{clientName || "Client Name"}</p>
                                    )}
                                    <BadgeWithDot color={statusColor(content.status)} size="sm" type="pill-color">
                                        {content.status}
                                    </BadgeWithDot>
                                </div>
                            </div>

                            {/* Dashboard search — client-scoped, directly under the identity block */}
                            <div className="px-3 pt-3">
                                {/* openNavItem, not setActiveSection: two rows in the menu are links
                                    rather than sections (Folder of Content, Help Centre) and have no
                                    body to switch to. Selecting one here used to set activeSection to
                                    an id nothing renders, leaving a blank content area with no way
                                    back except the menu. Routed through the same opener the menu uses,
                                    a searched link opens the thing it names. */}
                                <ClientSearchBar hits={searchHits} onSelect={openNavItem} />
                            </div>

                            {/* Overview — pinned above the groups as the client's main dashboard. Never
                                hideable and never "Soon": it's the landing view, so a client always has
                                somewhere to arrive and somewhere to get back to. */}
                            <div className="p-3 pb-0 md:pb-0">
                                <SectionNavItem
                                    icon={OVERVIEW_ITEM.icon}
                                    label={OVERVIEW_ITEM.label}
                                    current={activeSection === "overview"}
                                    onClick={() => setActiveSection("overview")}
                                />
                            </div>

                            {/* Funnel groups — Foundation → Top → Middle → Bottom, the same mental model
                    Dustin walks every client through on the onboarding call. */}
                            <motion.nav
                                className="flex-1 overflow-y-auto p-3 md:overflow-y-auto"
                                initial="hidden"
                                animate="show"
                                variants={{ show: { transition: { staggerChildren: 0.04 } } }}
                            >
                                {NAV_GROUPS.map((group) => (
                                    <div key={group.label} role="group" aria-labelledby={`nav-group-${group.phase}`} className="mt-3 first:mt-1">
                                        {/* Finder-sidebar heading: small, semibold, secondary gray, sentence
                                            case. No uppercase and no colored number pill — the heading is a
                                            quiet label for the rows under it, not a badge competing with them. */}
                                        <button
                                            type="button"
                                            id={`nav-group-${group.phase}`}
                                            onClick={() => toggleGroup(group.phase)}
                                            aria-expanded={!isGroupCollapsed(group.phase)}
                                            aria-controls={`nav-list-${group.phase}`}
                                            className={cx(
                                                "mb-0.5 flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] font-medium transition duration-100 ease-linear",
                                                // Tier one of the active state: the group holding the open
                                                // section is a raised chip with a brand-coloured icon.
                                                groupHoldsActive(group.phase) ? "bg-primary text-primary shadow-xs" : "text-secondary hover:bg-primary",
                                            )}
                                        >
                                            {group.icon && (
                                                <group.icon
                                                    aria-hidden="true"
                                                    className={cx(
                                                        "size-4 shrink-0",
                                                        groupHoldsActive(group.phase) ? "text-fg-brand-primary" : "text-fg-quaternary",
                                                    )}
                                                />
                                            )}
                                            <span className="min-w-0 flex-1 truncate">{group.label}</span>
                                            {/* Fixed-width right-aligned slot, so the counts read as a column
                                                down the edge rather than as debris after each label. */}
                                            <span className="w-4 shrink-0 text-right font-mono text-[10px] text-quaternary tabular-nums">
                                                {group.items.filter((s) => isTeam || !s.teamOnly).length}
                                            </span>
                                            {/* Folded groups still flag outstanding work — otherwise collapsing
                                                could hide the one thing we need from the client. */}
                                            {isGroupCollapsed(group.phase) && groupHasTodo(group.phase) && (
                                                <span className="size-1.5 shrink-0 rounded-full bg-brand-solid" title="Still needs you" />
                                            )}
                                            <ChevronDown
                                                aria-hidden="true"
                                                className={cx(
                                                    "size-3.5 shrink-0 text-fg-quaternary transition-transform duration-150",
                                                    isGroupCollapsed(group.phase) && "-rotate-90",
                                                )}
                                            />
                                        </button>
                                        {!isGroupCollapsed(group.phase) && (
                                            <div id={`nav-list-${group.phase}`} className="ml-3 flex flex-col">
                                                {group.items
                                                    .filter((s) => isTeam || !s.teamOnly)
                                                    .map((s) => (
                                                        <motion.div
                                                            key={s.id}
                                                            variants={{ hidden: { opacity: 0, x: -8 }, show: { opacity: 1, x: 0 } }}
                                                            /* Tier two: the open section brightens its own segment
                                                               of the connector the children hang off. */
                                                            className={cx(
                                                                "flex items-stretch gap-1.5 border-l-2 pl-1",
                                                                activeSection === s.id ? "border-brand" : "border-secondary",
                                                            )}
                                                        >
                                                            <span
                                                                aria-hidden="true"
                                                                className={cx(
                                                                    "w-5 shrink-0 self-center text-right font-mono text-[10px] tabular-nums",
                                                                    activeSection === s.id ? "text-brand-secondary" : "text-quaternary",
                                                                )}
                                                            >
                                                                {String(navNumber(s.id)).padStart(2, "0")}
                                                            </span>
                                                            <div className="min-w-0 flex-1">
                                                                <SectionNavItem
                                                                    label={s.label}
                                                                    current={activeSection === s.id}
                                                                    // Team can open anything that exists; a client can only
                                                                    // open what's been revealed to them.
                                                                    disabled={navBlocked(s)}
                                                                    indent
                                                                    badge={navBadge(s)}
                                                                    action={
                                                                        // Every row gets the eye while editing, so the whole
                                                                        // menu can be set up in one pass. On a row with
                                                                        // nothing behind it yet the toggle is an APPROVAL
                                                                        // rather than an immediate reveal — the client keeps
                                                                        // seeing "Soon" either way — so the tooltip says so
                                                                        // instead of implying a change they'd look for.
                                                                        !isLocked && isTeam && !s.teamOnly ? (
                                                                            <button
                                                                                type="button"
                                                                                title={
                                                                                    navNotBuilt(s)
                                                                                        ? revealedToClient(s.id)
                                                                                            ? "Approved for this client — appears as soon as it's ready"
                                                                                            : "Approve for this client — will appear once it's ready"
                                                                                        : revealedToClient(s.id)
                                                                                          ? "Hide from this client"
                                                                                          : "Show to this client"
                                                                                }
                                                                                aria-label={
                                                                                    revealedToClient(s.id)
                                                                                        ? `Hide ${s.label} from this client`
                                                                                        : `Show ${s.label} to this client`
                                                                                }
                                                                                aria-pressed={revealedToClient(s.id)}
                                                                                onClick={() => toggleClientVisible(s.id)}
                                                                                className={cx(
                                                                                    "flex size-6 items-center justify-center rounded-md transition duration-100 ease-linear hover:bg-secondary",
                                                                                    revealedToClient(s.id)
                                                                                        ? "text-brand-secondary hover:text-brand-secondary_hover"
                                                                                        : "text-quaternary hover:text-primary",
                                                                                )}
                                                                            >
                                                                                {revealedToClient(s.id) ? <EyeGlyph /> : <EyeOffGlyph />}
                                                                            </button>
                                                                        ) : undefined
                                                                    }
                                                                    onClick={() => openNavItem(s.id)}
                                                                />
                                                            </div>
                                                        </motion.div>
                                                    ))}
                                                {/* ── Custom Resources rows — AM-added links (e.g. a Claude project). Clients
                                                    only see revealed rows with a real URL; hidden rows don't even show "Soon",
                                                    they're internal links, not roadmap promises. */}
                                                {group.phase === "resources" && (
                                                    <>
                                                        {resources
                                                            .filter((r) => isTeam || (!r.hidden && r.url.trim()))
                                                            .map((r) =>
                                                                isTeam && !isLocked ? (
                                                                    <div key={r.id} className="flex flex-col gap-1.5 rounded-md p-2 pl-4 ring-1 ring-secondary">
                                                                        <input
                                                                            placeholder="Resource name"
                                                                            value={r.label}
                                                                            onChange={(e) => updateResource(r.id, { label: e.target.value })}
                                                                            className={editInput("text-xs font-semibold")}
                                                                        />
                                                                        <input
                                                                            placeholder="https://"
                                                                            value={r.url}
                                                                            onChange={(e) => updateResource(r.id, { url: e.target.value })}
                                                                            className={editInput("font-mono text-xs")}
                                                                        />
                                                                        <div className="flex items-center justify-end gap-1">
                                                                            <button
                                                                                type="button"
                                                                                title={r.hidden ? "Show to this client" : "Hide from this client"}
                                                                                aria-pressed={!r.hidden}
                                                                                onClick={() => updateResource(r.id, { hidden: !r.hidden })}
                                                                                className={cx(
                                                                                    "flex size-6 items-center justify-center rounded-md transition duration-100 ease-linear hover:bg-secondary",
                                                                                    r.hidden
                                                                                        ? "text-quaternary hover:text-primary"
                                                                                        : "text-brand-secondary hover:text-brand-secondary_hover",
                                                                                )}
                                                                            >
                                                                                {r.hidden ? <EyeOffGlyph /> : <EyeGlyph />}
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                title={`Remove ${r.label.trim() || "resource"}`}
                                                                                onClick={() => removeResource(r.id)}
                                                                                className="flex size-6 items-center justify-center rounded-md text-fg-quaternary transition duration-100 ease-linear hover:bg-secondary hover:text-error-primary"
                                                                            >
                                                                                <Trash01 className="size-3.5" aria-hidden="true" />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <SectionNavItem
                                                                        key={r.id}
                                                                        label={r.label.trim() || "Untitled resource"}
                                                                        current={false}
                                                                        disabled={!r.url.trim()}
                                                                        indent
                                                                        badge={
                                                                            isTeam && r.hidden ? (
                                                                                <span className="ml-2 shrink-0 text-[10px] font-bold text-quaternary uppercase">
                                                                                    Hidden
                                                                                </span>
                                                                            ) : undefined
                                                                        }
                                                                        onClick={() => {
                                                                            const url = r.url.trim();
                                                                            if (url) window.open(url, "_blank", "noopener,noreferrer");
                                                                        }}
                                                                    />
                                                                ),
                                                            )}
                                                        {isTeam && !isLocked && (
                                                            <button
                                                                type="button"
                                                                onClick={addResource}
                                                                className="rounded-md p-2 pl-4 text-left text-sm font-semibold text-brand-secondary transition duration-100 ease-linear hover:bg-primary_hover hover:underline"
                                                            >
                                                                + Add resource
                                                            </button>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </motion.nav>

                            {/* Footer — website link + appearance + background upload. Wrapped so the
                    custom side-menu background (below) starts exactly at its top edge,
                    whatever this block's height ends up being, instead of a fixed guess. */}
                            <div className="relative isolate flex flex-col">
                                {/* Custom side-menu background — optional, uploaded in edit mode below.
                        The current solid color stays the default everywhere above the footer;
                        the image only shows behind the footer itself. */}
                                {content.sidebar_bg_url && (
                                    <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
                                        <img src={content.sidebar_bg_url} alt="" className="size-full object-cover object-bottom" draggable={false} />
                                        <div className="absolute inset-0 bg-gradient-to-t from-primary/30 to-primary" />
                                    </div>
                                )}

                                {/* Website link */}
                                {websiteHref && (
                                    <div className="hidden border-t border-secondary p-4 pb-0 md:block">
                                        <Button
                                            href={websiteHref}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            color="secondary"
                                            size="sm"
                                            iconTrailing={LinkExternal01}
                                            className="w-full"
                                        >
                                            Visit website
                                        </Button>
                                    </div>
                                )}

                                {/* Edit / Save — the visible counterpart to Shift+E and Shift+S.
                                    The shortcuts still work and still do exactly this; they were simply
                                    invisible, so an AM who had never been told about them had no way in.
                                    Full width with a label rather than an icon beside the theme toggle:
                                    a third circle down there truncated "HiddenGem Media", and the words
                                    are the part that makes it findable at all.

                                    Team only, and hidden on the template, which has no row to save to. */}
                                {isTeam && !isTemplate && (
                                    <div className="border-t border-secondary px-5 py-3">
                                        <button
                                            type="button"
                                            onClick={() => (isLocked ? setIsLocked(false) : void persistAndLock())}
                                            disabled={saveState === "saving"}
                                            title={isLocked ? "Shift+E" : "Shift+S"}
                                            className={cx(
                                                "flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition duration-100 ease-linear disabled:cursor-not-allowed disabled:opacity-50",
                                                saveState === "error" || saveState === "conflict"
                                                    ? "border-error bg-error-primary text-error-primary hover:bg-utility-red-100"
                                                    : isLocked
                                                      ? "border-secondary bg-primary text-secondary hover:bg-tertiary hover:text-primary"
                                                      : "border-brand bg-brand-solid text-white hover:opacity-90",
                                            )}
                                        >
                                            {saveState === "saving" ? (
                                                <span
                                                    className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                                                    aria-hidden="true"
                                                />
                                            ) : saveState === "error" || saveState === "conflict" ? (
                                                <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
                                            ) : isLocked ? (
                                                <Edit01 className="size-4 shrink-0" aria-hidden="true" />
                                            ) : (
                                                <Check className="size-4 shrink-0" aria-hidden="true" />
                                            )}
                                            {saveState === "saving"
                                                ? "Saving…"
                                                : saveState === "error"
                                                  ? "Try saving again"
                                                  : saveState === "conflict"
                                                    ? "Save anyway (overwrite)"
                                                    : isLocked
                                                      ? "Edit dashboard"
                                                      : "Save changes"}
                                        </button>
                                    </div>
                                )}

                                {/* Theme toggle — local to this side menu (the global floating toggle is
                        suppressed on client-dashboard pages since it overlapped the client badge). */}
                                <div className="flex items-center gap-3 border-t border-secondary px-5 py-3">
                                    {/* HGM logo — for signed-in team members a shortcut back to the internal
                                /dashboard; for clients (and inside a client preview) a link out to
                                hiddengem.media. New tab, so a client never loses their dashboard. */}
                                    {isTeam ? (
                                        <button
                                            type="button"
                                            onClick={() => navigate("/dashboard")}
                                            title="Go to team dashboard"
                                            className="shrink-0 rounded-lg transition duration-100 ease-linear hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                                        >
                                            <img src="/hgm logo/Favicon ON LIGHT.svg" alt="HiddenGem — team dashboard" className="size-8" draggable={false} />
                                        </button>
                                    ) : (
                                        <a
                                            href="https://hiddengem.media"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            title="Visit HiddenGem Media"
                                            className="shrink-0 rounded-lg transition duration-100 ease-linear hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                                        >
                                            <img src="/hgm logo/Favicon ON LIGHT.svg" alt="HiddenGem Media" className="size-8" draggable={false} />
                                        </a>
                                    )}
                                    {/* Same treatment as the client's own name at the top of the sidebar
                                (text-sm / font-semibold / text-primary) so the two lockups read as a
                                matched pair rather than a heading and a footnote. */}
                                    <span className="flex-1 truncate text-sm font-semibold text-primary">HiddenGem Media</span>
                                    <button
                                        type="button"
                                        onClick={() => setTheme(isDark ? "light" : "dark")}
                                        title={isDark ? "Switch to light mode" : "Switch to dark mode"}
                                        className="flex size-9 shrink-0 items-center justify-center rounded-full border border-secondary bg-primary text-secondary transition duration-100 ease-linear hover:bg-tertiary hover:text-primary"
                                    >
                                        {isDark ? <Sun className="size-[18px]" /> : <Moon01 className="size-[18px]" />}
                                    </button>
                                </div>

                                {/* Save outcome in words. The button's own colour change is not enough on
                                    its own — a failed write is the one state an AM must not misread as done. */}
                                {isTeam && !isTemplate && saveState !== "idle" && (
                                    <div className="border-t border-secondary px-5 py-2">
                                        <p
                                            className={cx(
                                                "text-xs",
                                                saveState === "error" || saveState === "conflict"
                                                    ? "text-error-primary"
                                                    : saveState === "saved"
                                                      ? "text-success-primary"
                                                      : "text-quaternary",
                                            )}
                                            role={saveState === "error" || saveState === "conflict" ? "alert" : undefined}
                                        >
                                            {saveState === "saving"
                                                ? "Saving…"
                                                : saveState === "saved"
                                                  ? "Saved"
                                                  : saveState === "conflict"
                                                    ? "Not saved — someone else (or another tab) saved this dashboard after this tab loaded. Refresh to see their version first, or press Save again to overwrite it."
                                                    : "Couldn't save — your changes are still here. Press save to try again."}
                                        </p>
                                    </div>
                                )}

                                {/* Sidebar background upload — edit mode only. The solid color above stays
                        the default until the team sets one; clients see whatever is set. */}
                                {!isLocked && (
                                    <div className="flex items-center justify-between gap-2 border-t border-secondary px-5 py-3">
                                        <span className="text-xs text-quaternary">Sidebar background</span>
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() => sidebarBgFileRef.current?.click()}
                                                title={content.sidebar_bg_url ? "Replace sidebar background" : "Upload sidebar background"}
                                                className="flex size-9 items-center justify-center rounded-full border border-secondary bg-primary text-secondary transition duration-100 ease-linear hover:bg-tertiary hover:text-primary"
                                            >
                                                <UploadCloud02 className="size-[18px]" />
                                            </button>
                                            {content.sidebar_bg_url && (
                                                <button
                                                    type="button"
                                                    onClick={() => setContent((c) => ({ ...c, sidebar_bg_url: "" }))}
                                                    title="Remove sidebar background"
                                                    className="flex size-9 items-center justify-center rounded-full border border-secondary bg-primary text-secondary transition duration-100 ease-linear hover:bg-error-primary hover:text-fg-error-primary"
                                                >
                                                    <Trash01 className="size-[18px]" />
                                                </button>
                                            )}
                                        </div>
                                        <input ref={sidebarBgFileRef} type="file" accept="image/*" className="hidden" onChange={onPickSidebarBg} />
                                    </div>
                                )}
                            </div>
                        </aside>

                        {/* ── Main (scrolls) ── */}
                        {/* `relative` makes this scroller the containing block for anything
                            absolutely positioned inside it — React Aria's visually-hidden
                            <input> in Checkbox/Radio/Switch is one. Without it those inputs
                            resolve against <body>, escape the overflow clip, and stretch the
                            document, so the window itself scrolls and the whole h-dvh shell
                            (side menu included) slides off the top of the viewport. */}
                        <div className="relative min-w-0 flex-1 overflow-y-auto">
                            {/* Fluid body — the card fills the canvas. Combined with the grey canvas's
                own p-2 (8px), md:px-6 (24px) yields a 32px gap to the side menu and the
                right edge; zero vertical padding keeps the card's top/bottom flush with
                the side menu's. */}
                            <div className="flex min-h-full w-full flex-col p-0.5 md:p-0.5">
                                {/* flex-1 + min-h-full wrapper: short sections still fill the canvas
                            height, so the card's bottom edge lines up with the side menu's. */}
                                <motion.article
                                    // Flat, borderless shell: the side menu's hairline is the only
                                    // division on the page, so the content is a plain column, not a card.
                                    className="w-full flex-1 bg-primary"
                                    initial={{ opacity: 0, y: 16 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                                >
                                    {/* Horizontal inset scales with the card (20 → 24 → 32 → 40px) rather
                                        than sitting flat, which looked pinched once the card got wide. The
                                        max-width is the important half: on a 2560px display the card is
                                        ~2200px, and uncapped that ran prose to ~270 characters a line —
                                        roughly four times a comfortable measure. Capping the content (not
                                        the card) keeps the card full-bleed against the canvas while the
                                        reading column stays sane. */}
                                    <div
                                        className={cx(
                                            "mx-auto w-full max-w-[1240px] px-5 py-8 sm:px-6 md:px-8 lg:px-10",
                                            activeSection === "flow" && !isLocked ? "md:py-10" : "md:py-12",
                                        )}
                                    >
                                        {/* ── Template banner — prompts the team to spin up a client copy. ── */}
                                        {isTemplate && (
                                            <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand/40 bg-brand-50 px-4 py-3 dark:bg-brand-950/30">
                                                <div className="flex items-center gap-2.5">
                                                    <span className="inline-flex items-center rounded-full bg-brand-600 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-white uppercase">
                                                        Template
                                                    </span>
                                                    <p className="text-[13px] font-medium text-brand-800 dark:text-brand-200">
                                                        This is the master template. Create a private copy to share with a client.
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={handlePlusClick}
                                                    className="flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-solid px-3.5 py-2 text-[13px] font-semibold text-white transition hover:opacity-90"
                                                >
                                                    <Plus className="size-4" aria-hidden="true" />
                                                    Create dashboard for a client
                                                </button>
                                            </div>
                                        )}

                                        {/* ── Hero (Client Overview only — the side menu carries identity elsewhere) ── */}
                                        {activeSection === "overview" && (
                                            <>
                                                <header className="flex flex-wrap items-center justify-between gap-4">
                                                    {/* Flat header — no logo tile (identity already lives in the side menu). */}
                                                    <div className="flex min-w-0 items-center gap-4">
                                                        <div className="min-w-0">
                                                            <div className="flex flex-wrap items-center gap-2.5">
                                                                {isLocked ? (
                                                                    <h1 className="truncate text-display-xs font-semibold tracking-tight text-primary md:text-display-sm">
                                                                        {clientName || "Client Name"}
                                                                    </h1>
                                                                ) : (
                                                                    <input
                                                                        type="text"
                                                                        placeholder="Client Name"
                                                                        value={clientName}
                                                                        onChange={(e) => setClientName(e.target.value)}
                                                                        className={editInput("max-w-60 text-md font-semibold")}
                                                                    />
                                                                )}
                                                                <BadgeWithDot color={statusColor(content.status)} size="md" type="pill-color">
                                                                    {content.status}
                                                                </BadgeWithDot>
                                                            </div>
                                                            <p className="mt-1 text-sm text-tertiary">Your business hub — prepared by the HiddenGem Team.</p>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        {isLocked ? (
                                                            websiteHref && (
                                                                <Button
                                                                    href={websiteHref}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    color="secondary"
                                                                    size="sm"
                                                                    iconTrailing={LinkExternal01}
                                                                >
                                                                    Visit website
                                                                </Button>
                                                            )
                                                        ) : (
                                                            <input
                                                                type="text"
                                                                placeholder="Client Website"
                                                                value={clientWebsite}
                                                                onChange={(e) => setClientWebsite(e.target.value)}
                                                                className={editInput("max-w-52")}
                                                            />
                                                        )}
                                                    </div>
                                                </header>

                                                {/* Edit-only hero controls: logo URL + status */}
                                                {!isLocked && (
                                                    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-secondary p-3">
                                                        <input
                                                            type="text"
                                                            placeholder="Logo image URL"
                                                            value={content.logo_url}
                                                            onChange={(e) => setContent((c) => ({ ...c, logo_url: e.target.value }))}
                                                            className={editInput("max-w-80")}
                                                        />
                                                        <div className="flex items-center gap-1.5">
                                                            {STATUS_OPTIONS.map((s) => (
                                                                <button
                                                                    key={s}
                                                                    type="button"
                                                                    onClick={() => setContent((c) => ({ ...c, status: s }))}
                                                                    className={cx(
                                                                        "rounded-full px-3 py-1 text-xs font-medium transition duration-100 ease-linear",
                                                                        content.status === s
                                                                            ? "bg-brand-solid text-white"
                                                                            : "bg-primary text-tertiary ring-1 ring-secondary hover:text-secondary",
                                                                    )}
                                                                >
                                                                    {s}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* ── Who can open this dashboard (team, edit mode) ──
                                                    Access is per person: each address carries its own password and its own
                                                    set of sections. Without a way to fill this in, turning on the sign-in
                                                    gate would lock every client out, so it lives right at the top of
                                                    Overview where an AM can't miss it. */}
                                                {isTeam && !isLocked && !isTemplate && (
                                                    <>
                                                        <DashboardAccessPanel
                                                            users={dashboardUsers}
                                                            sharePassword={sharePassword}
                                                            defaultSections={content.client_visible ?? DEFAULT_CLIENT_VISIBLE}
                                                            onChangeUsers={updateDashboardUsers}
                                                            onChangeSharePassword={updateSharePassword}
                                                        />

                                                        <div className="mt-4 rounded-xl bg-secondary p-5 ring-1 ring-secondary">
                                                            <div>
                                                                <p className="text-sm font-medium text-secondary">Sign-in background</p>
                                                                <p className="mt-1 text-xs text-pretty text-tertiary">
                                                                    Image or video URL shown behind this client's sign-in card, so each client can look
                                                                    different. Leave empty for the default leaf-shadow loop.
                                                                </p>
                                                                <input
                                                                    type="text"
                                                                    value={content.login_bg_url ?? ""}
                                                                    placeholder="https://… .jpg or .webm — empty for the default"
                                                                    onChange={(e) => setContent((c) => ({ ...c, login_bg_url: e.target.value }))}
                                                                    className="mt-2 w-full rounded-lg bg-primary px-3 py-2 text-sm text-primary ring-1 ring-secondary outline-none focus:ring-brand"
                                                                />
                                                            </div>

                                                            {/* ── Onboarding links ──
                                                            The three per-client URLs the journey hands the client, together and
                                                            next to the journey that consumes them. The content folder is also
                                                            editable inside Brand Kit — same field, and that section is a long
                                                            way from the step that asks for it, which is why nobody fills it in.
                                                            Empty is safe everywhere: the step drops the button, it never shows
                                                            a dead one. */}
                                                            <div className="mt-4 border-t border-secondary pt-4">
                                                                <p className="text-sm font-medium text-secondary">Onboarding links</p>
                                                                <p className="mt-1 text-xs text-pretty text-tertiary">
                                                                    What the client is sent to after the Kick-off Call. Each one appears on its journey step as
                                                                    soon as it's filled in.
                                                                </p>
                                                                <div className="mt-2 grid gap-2">
                                                                    {(
                                                                        [
                                                                            {
                                                                                key: "chat" as const,
                                                                                label: "Google Chat room",
                                                                                placeholder: "https://chat.google.com/room/…",
                                                                                value: content.chat_link ?? "",
                                                                                set: (v: string) => setContent((c) => ({ ...c, chat_link: v })),
                                                                            },
                                                                            {
                                                                                key: "folder" as const,
                                                                                label: "Content folder (photos & video)",
                                                                                placeholder: "https://drive.google.com/…",
                                                                                value: content.brand.folder_link,
                                                                                set: (v: string) => patchBrand({ folder_link: v }),
                                                                            },
                                                                            {
                                                                                key: "call" as const,
                                                                                label: "Onboarding Call booking page",
                                                                                placeholder: "https://calendly.com/your-name/onboarding",
                                                                                value: content.onboarding_call_url ?? "",
                                                                                set: (v: string) => setContent((c) => ({ ...c, onboarding_call_url: v })),
                                                                            },
                                                                        ] as const
                                                                    ).map((row) => (
                                                                        <label key={row.key} className="grid gap-1">
                                                                            <span className="text-xs text-tertiary">{row.label}</span>
                                                                            <input
                                                                                type="text"
                                                                                value={row.value}
                                                                                placeholder={row.placeholder}
                                                                                onChange={(e) => row.set(e.target.value)}
                                                                                className="w-full rounded-lg bg-primary px-3 py-2 text-sm text-primary ring-1 ring-secondary outline-none focus:ring-brand"
                                                                            />
                                                                        </label>
                                                                    ))}
                                                                </div>
                                                                <p className="mt-2 text-xs text-pretty text-quaternary">
                                                                    The booking page is this client's own Account Manager's — there's no shared default, since
                                                                    one would send every client to the same person.
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </>
                                                )}

                                                {/* ── Your journey ──
                                                    One ordered path from the first form to a finished website. Replaced a
                                                    "Your setup" tracker plus a funnel explainer: the tracker was a subset
                                                    of these steps, and two of the funnel cards jumped to Website and
                                                    GoHighLevel, which are no longer on the client's menu.

                                                    The two form steps read live form state. The rest are AM ticks — calls
                                                    and reviews happen off-platform, so there is nothing to infer them
                                                    from. Referred to by name, not number: the order has been reshuffled
                                                    twice and every numbered comment went stale. */}
                                                <div className="mt-10">
                                                    <div className="flex flex-wrap items-end justify-between gap-3">
                                                        <div>
                                                            <h2 className="text-lg font-semibold text-primary">Your journey</h2>
                                                            <p className="mt-1 text-sm text-tertiary">
                                                                {journeyDoneCount === journeySteps.length
                                                                    ? "Every step is done — you're fully set up."
                                                                    : "Where you are, and what happens next. Weeks are estimates, counted from your Kick-off Call."}
                                                            </p>
                                                        </div>
                                                        <span className="text-sm font-semibold text-secondary tabular-nums">
                                                            {journeyDoneCount} of {journeySteps.length}
                                                        </span>
                                                    </div>

                                                    {/* The launch meter. It replaces the small percentage ring that used to
                                                        sit beside the heading: two readings of the same number is one too
                                                        many, and the ring was the quieter of the two on the page a client
                                                        opens to find out how close they are to going live. */}
                                                    <JourneyProgress
                                                        cells={journeyCells}
                                                        groups={journeyGroups}
                                                        stepsDone={journeyDoneCount}
                                                        stepsTotal={journeySteps.length}
                                                        nextLabel={journeyNextLabel}
                                                    />

                                                    <ol className="mt-6 grid list-none gap-0 p-0">
                                                        {journeySteps.map((step, i) => {
                                                            const isCurrent = step.id === journeyCurrentId;
                                                            const isLast = i === journeySteps.length - 1;
                                                            // A client must not be offered a jump into a section they
                                                            // can't open — same rule the side menu uses.
                                                            const target = step.to;
                                                            const canJump = !!target && (isTeam || revealedToClient(target));
                                                            return (
                                                                <li key={step.id} className="relative flex gap-4 pb-5 last:pb-0">
                                                                    {/* Rail between nodes. Filled up to the last completed
                                                                        step so progress reads at a glance. */}
                                                                    {!isLast && (
                                                                        <span
                                                                            aria-hidden="true"
                                                                            className={cx(
                                                                                "absolute top-10 left-[17px] h-[calc(100%-2.5rem)] w-0.5 rounded-full",
                                                                                step.done ? "bg-brand-solid" : "bg-border-secondary",
                                                                            )}
                                                                        />
                                                                    )}
                                                                    <span
                                                                        className={cx(
                                                                            "relative z-10 grid size-9 shrink-0 place-items-center rounded-full text-[12px] font-bold tabular-nums transition duration-100 ease-linear",
                                                                            step.done
                                                                                ? "bg-brand-solid text-white"
                                                                                : isCurrent
                                                                                  ? "bg-utility-brand-50 text-utility-brand-700 ring-2 ring-brand"
                                                                                  : "bg-secondary text-quaternary",
                                                                        )}
                                                                    >
                                                                        {step.done ? <Check className="size-4" aria-hidden="true" /> : i + 1}
                                                                    </span>

                                                                    <div
                                                                        className={cx(
                                                                            "relative min-w-0 flex-1 rounded-xl bg-primary p-4 shadow-xs ring-1 transition duration-100 ease-linear",
                                                                            // The travelling beam marks where to start. It follows the
                                                                            // first unfinished step rather than being pinned to step 1,
                                                                            // so it's on step 1 for a new client and moves on with them
                                                                            // — a pulsing halo on a step they've already done would be
                                                                            // pointing at nothing.
                                                                            //
                                                                            // The ring stays neutral even here: a brand-coloured beam
                                                                            // travelling over a brand-coloured ring is invisible. The
                                                                            // beam is what carries the colour, and the numbered node and
                                                                            // "Up next" badge still mark the step while it passes.
                                                                            isCurrent ? "step-beam ring-secondary" : "ring-secondary",
                                                                        )}
                                                                    >
                                                                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                                                                            <span className="font-mono text-[11px] text-quaternary">Step {i + 1}</span>
                                                                            <h3 className="text-md font-semibold text-primary">{step.label}</h3>
                                                                            {step.done ? (
                                                                                <BadgeWithDot color="success" size="sm" type="pill-color">
                                                                                    Done
                                                                                </BadgeWithDot>
                                                                            ) : (
                                                                                isCurrent && (
                                                                                    <BadgeWithDot color="brand" size="sm" type="pill-color">
                                                                                        Up next
                                                                                    </BadgeWithDot>
                                                                                )
                                                                            )}
                                                                            {/* Dropped once done: an estimate on a finished thing is noise. */}
                                                                            {!step.done && step.eta && (
                                                                                <Badge color="gray" size="sm" type="pill-color">
                                                                                    {step.eta}
                                                                                </Badge>
                                                                            )}
                                                                        </div>
                                                                        {step.detail && (
                                                                            <p className="mt-1.5 text-sm text-pretty text-tertiary">{step.detail}</p>
                                                                        )}

                                                                        {!step.done && step.progress && step.progress.total > 0 && (
                                                                            <div className="mt-3">
                                                                                <ProgressBar
                                                                                    value={Math.round((step.progress.value / step.progress.total) * 100)}
                                                                                />
                                                                            </div>
                                                                        )}

                                                                        {/* Sub-items — the several separate things one step asks for.
                                                                            Tick boxes only where the step says its items are tickable:
                                                                            most of these aren't states we can observe, and an empty box
                                                                            against a job already done reads as a failure. The funnel
                                                                            reviews are the exception — the team ships each piece and
                                                                            knows when it's signed off, so there each item carries its
                                                                            own mark and its own jump into the section it names.
                                                                            An item whose link isn't filled in yet keeps its text and
                                                                            drops the button; only the team is told it's missing, since
                                                                            that's the team's job to fix, not the client's. */}
                                                                        {step.items && step.items.length > 0 && (
                                                                            <div className="mt-4">
                                                                                {step.itemsTitle && (
                                                                                    <p className="text-xs font-semibold tracking-wide text-quaternary uppercase">
                                                                                        {step.itemsTitle}
                                                                                    </p>
                                                                                )}
                                                                                <ul
                                                                                    className={cx(
                                                                                        "grid list-none gap-3 p-0",
                                                                                        step.itemsTitle ? "mt-2.5" : "mt-0",
                                                                                    )}
                                                                                >
                                                                                    {step.items.map((item) => {
                                                                                        // Same rule as the step-level jump: never offer a
                                                                                        // client a way into a section they can't open.
                                                                                        const itemTarget = item.to;
                                                                                        const canOpenItem =
                                                                                            !!itemTarget && (isTeam || revealedToClient(itemTarget));
                                                                                        return (
                                                                                            <li
                                                                                                key={item.label}
                                                                                                className="border-t border-secondary pt-3 first:border-t-0 first:pt-0"
                                                                                            >
                                                                                                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                                                                                                    <span className="flex min-w-0 items-center gap-2">
                                                                                                        {step.itemsTickable && (
                                                                                                            <span
                                                                                                                aria-hidden="true"
                                                                                                                className={cx(
                                                                                                                    "grid size-4.5 shrink-0 place-items-center rounded-full transition duration-100 ease-linear",
                                                                                                                    item.done
                                                                                                                        ? "bg-success-solid text-white"
                                                                                                                        : "ring-1 ring-secondary",
                                                                                                                )}
                                                                                                            >
                                                                                                                {item.done && <Check className="size-3" />}
                                                                                                            </span>
                                                                                                        )}
                                                                                                        <span
                                                                                                            className={cx(
                                                                                                                "text-sm font-semibold",
                                                                                                                step.itemsTickable && !item.done
                                                                                                                    ? "text-tertiary"
                                                                                                                    : "text-secondary",
                                                                                                            )}
                                                                                                        >
                                                                                                            {item.label}
                                                                                                        </span>
                                                                                                    </span>
                                                                                                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                                                                                                        {!item.done && item.eta && (
                                                                                                            <span className="text-xs text-quaternary">
                                                                                                                {item.eta}
                                                                                                            </span>
                                                                                                        )}
                                                                                                        {canOpenItem && itemTarget && (
                                                                                                            <Button
                                                                                                                size="sm"
                                                                                                                color="link-color"
                                                                                                                iconTrailing={ArrowRight}
                                                                                                                onClick={() => openNavItem(itemTarget)}
                                                                                                            >
                                                                                                                {item.action ?? "Open"}
                                                                                                            </Button>
                                                                                                        )}
                                                                                                        {/* The AM's mark, edit mode only — the client
                                                                                                            reads the tick, they don't set it. */}
                                                                                                        {step.itemsTickable && !isLocked && isTeam && (
                                                                                                            <Button
                                                                                                                size="sm"
                                                                                                                color="secondary"
                                                                                                                iconLeading={
                                                                                                                    item.done ? RefreshCw01 : CheckCircle
                                                                                                                }
                                                                                                                onClick={() =>
                                                                                                                    toggleJourneyItem(
                                                                                                                        step.id,
                                                                                                                        item.id ?? item.label,
                                                                                                                    )
                                                                                                                }
                                                                                                            >
                                                                                                                {item.done ? "Undo" : "Mark reviewed"}
                                                                                                            </Button>
                                                                                                        )}
                                                                                                        {item.url ? (
                                                                                                            <Button
                                                                                                                size="sm"
                                                                                                                color="secondary"
                                                                                                                href={item.url}
                                                                                                                target="_blank"
                                                                                                                rel="noopener noreferrer"
                                                                                                                iconTrailing={LinkExternal01}
                                                                                                            >
                                                                                                                {item.action ?? "Open"}
                                                                                                            </Button>
                                                                                                        ) : (
                                                                                                            item.link &&
                                                                                                            isTeam && (
                                                                                                                <span className="text-xs text-warning-primary">
                                                                                                                    No link set — add it under Onboarding links.
                                                                                                                </span>
                                                                                                            )
                                                                                                        )}
                                                                                                    </span>
                                                                                                </div>
                                                                                                {item.note && (
                                                                                                    <p className="mt-1 max-w-prose text-sm text-pretty text-tertiary">
                                                                                                        {item.note}
                                                                                                    </p>
                                                                                                )}
                                                                                            </li>
                                                                                        );
                                                                                    })}
                                                                                </ul>
                                                                            </div>
                                                                        )}

                                                                        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                                                                            {canJump && target && (
                                                                                <Button
                                                                                    size="sm"
                                                                                    color="link-color"
                                                                                    iconTrailing={ArrowRight}
                                                                                    onClick={() => openNavItem(target)}
                                                                                >
                                                                                    Open
                                                                                </Button>
                                                                            )}
                                                                            {/* External action (the Calendly booking link). Held back until
                                                                                its prerequisite step is done, with the reason shown instead
                                                                                of a link that would lead to an unprepared call. */}
                                                                            {step.href &&
                                                                                !step.done &&
                                                                                (step.requires && !journeySteps.find((x) => x.id === step.requires)?.done ? (
                                                                                    <span className="text-xs text-quaternary">
                                                                                        {step.blockedNote ?? (
                                                                                            <>
                                                                                                Available once{" "}
                                                                                                {journeySteps.find((x) => x.id === step.requires)?.label ??
                                                                                                    "the previous step"}{" "}
                                                                                                is done
                                                                                            </>
                                                                                        )}
                                                                                    </span>
                                                                                ) : step.href === KICKOFF_CALENDLY ? (
                                                                                    // Booking opens over the dashboard instead of in a new
                                                                                    // tab. Sending a client to calendly.com mid-journey costs
                                                                                    // them their place in the list and lands them on a page
                                                                                    // with no way back here.
                                                                                    <Button
                                                                                        size="sm"
                                                                                        iconTrailing={Calendar}
                                                                                        onClick={() => setBookingOpen(true)}
                                                                                    >
                                                                                        {step.hrefLabel ?? "Book your call"}
                                                                                    </Button>
                                                                                ) : (
                                                                                    <Button
                                                                                        size="sm"
                                                                                        href={step.href}
                                                                                        target="_blank"
                                                                                        rel="noopener noreferrer"
                                                                                        iconTrailing={LinkExternal01}
                                                                                    >
                                                                                        {step.hrefLabel ?? "Open link"}
                                                                                    </Button>
                                                                                ))}
                                                                            {/* Walkthrough for a step people get stuck on, beside the action
                                                                                itself rather than behind the Help menu — a client who can't
                                                                                work out how to join won't go looking for it elsewhere. */}
                                                                            {step.helpHref && !step.done && (
                                                                                <Button
                                                                                    size="sm"
                                                                                    color="link-color"
                                                                                    href={step.helpHref}
                                                                                    target="_blank"
                                                                                    rel="noopener noreferrer"
                                                                                    iconLeading={HelpCircle}
                                                                                >
                                                                                    {step.helpLabel ?? "How to do this"}
                                                                                </Button>
                                                                            )}
                                                                            {/* A step whose link comes off the row has nothing to offer until
                                                                                an AM pastes it in. The client is told to expect it; the team
                                                                                is told to go and set it. Worded for any link, not just a
                                                                                booking page — the Google Chat step comes through here too. */}
                                                                            {step.hrefFrom && !step.href && !step.done && (
                                                                                <span
                                                                                    className={cx(
                                                                                        "text-xs",
                                                                                        isTeam ? "text-warning-primary" : "text-quaternary",
                                                                                    )}
                                                                                >
                                                                                    {isTeam
                                                                                        ? "No link set — add it under Onboarding links."
                                                                                        : (step.pendingNote ?? "Your Account Manager will send you this link.")}
                                                                                </span>
                                                                            )}
                                                                            {/* AM tick, edit mode only. Auto steps get no tick:
                                                                                a manual override could contradict the answer
                                                                                count printed directly above it. */}
                                                                            {!isLocked &&
                                                                                isTeam &&
                                                                                (step.auto ? (
                                                                                    <span className="text-xs text-quaternary">
                                                                                        Tracked from the form itself
                                                                                    </span>
                                                                                ) : (
                                                                                    <Button
                                                                                        size="sm"
                                                                                        color="secondary"
                                                                                        iconLeading={step.done ? RefreshCw01 : CheckCircle}
                                                                                        onClick={() => toggleJourneyStep(step.id)}
                                                                                    >
                                                                                        {/* A step ticked piece by piece keeps this as the
                                                                                            all-at-once shortcut — "Mark done" would read as
                                                                                            a second, competing state beside the item marks. */}
                                                                                        {step.itemsTickable
                                                                                            ? step.done
                                                                                                ? "Undo all"
                                                                                                : "Mark all reviewed"
                                                                                            : step.done
                                                                                              ? "Mark not done"
                                                                                              : "Mark done"}
                                                                                    </Button>
                                                                                ))}
                                                                        </div>
                                                                    </div>
                                                                </li>
                                                            );
                                                        })}
                                                    </ol>
                                                </div>
                                            </>
                                        )}

                                        {/* ── Section content (driven by the side menu) ── */}
                                        <div className="mt-10">
                                            <div className="min-w-0">
                                                {activeSection === "landing" && (
                                                    <>
                                                        {/* Renders its own component (own heading included), same reasoning
                                                            as Welcome Flow just below it. */}
                                                        <SectionEyebrow section={activeSection} />
                                                        <div className="mt-6">
                                                            <LandingPageSection
                                                                slug={slug}
                                                                clientName={clientName}
                                                                isTeam={isTeam}
                                                                isLocked={isLocked}
                                                                isTemplate={isTemplate}
                                                                teamName={user?.name ?? user?.email ?? ""}
                                                                clientEmail={identityEmail}
                                                                feedback={{
                                                                    mode: isTeam ? "review" : canLandingFeedback ? "client" : "off",
                                                                    items: landingFeedback,
                                                                    author: suggestAuthor,
                                                                    send: sendLandingFeedback,
                                                                    withdraw: withdrawFeedback,
                                                                    resolve: resolveFeedback,
                                                                }}
                                                            />
                                                        </div>
                                                    </>
                                                )}

                                                {/* ── Example Reels — three phones, the team's reels playing inside ── */}
                                                {activeSection === "reels" && (
                                                    <Reveal>
                                                        <SectionEyebrow section={activeSection} />
                                                        <SectionHeading>Example Reels</SectionHeading>
                                                        <p className="mt-3 text-md text-tertiary">
                                                            {isLocked
                                                                ? "Three reels made for your property, shown the way they play on a phone."
                                                                : "Upload up to three 9:16 reels. The title and line under each phone are what the client reads — and what stands in for the footage when motion is off."}
                                                        </p>
                                                        <ExampleReelsSection
                                                            reels={content.reels ?? []}
                                                            isLocked={isLocked}
                                                            onChange={updateReel}
                                                            feedback={{
                                                                mode: isTeam ? "review" : canReelsFeedback ? "client" : "off",
                                                                items: reelsFeedback,
                                                                author: suggestAuthor,
                                                                send: sendReelsFeedback,
                                                                withdraw: withdrawFeedback,
                                                                resolve: resolveFeedback,
                                                            }}
                                                        />
                                                    </Reveal>
                                                )}

                                                {activeSection === "pinnedstories" && (
                                                    <>
                                                        {/* Own component, own heading — same shape as Landing Page above. */}
                                                        <SectionEyebrow section={activeSection} />
                                                        <div className="mt-6">
                                                            <PinnedStoriesSection
                                                                slug={slug}
                                                                clientName={clientName}
                                                                profile={igProfileInputs}
                                                                pinnedPosts={pinnedPosts.posts}
                                                                isTeam={isTeam}
                                                                isLocked={isLocked}
                                                                isTemplate={isTemplate}
                                                                teamName={user?.name ?? user?.email ?? ""}
                                                                clientEmail={identityEmail}
                                                                feedback={{
                                                                    mode: isTeam ? "review" : canStoriesFeedback ? "client" : "off",
                                                                    items: storiesFeedback,
                                                                    author: suggestAuthor,
                                                                    send: sendStoriesFeedback,
                                                                    withdraw: withdrawFeedback,
                                                                    resolve: resolveFeedback,
                                                                }}
                                                            />
                                                        </div>
                                                    </>
                                                )}

                                                {activeSection === "flow" && (
                                                    <>
                                                        {/* This section renders its own component, so it was the one
                                                            section without an eyebrow — visible now that they name the
                                                            phase, since its sibling Chat Widget shows "Phase 4". */}
                                                        <SectionEyebrow section={activeSection} />
                                                        <div className="mt-6">
                                                            <WelcomeFlowSection
                                                                slug={slug}
                                                                clientName={clientName}
                                                                isLocked={isLocked}
                                                                isTemplate={isTemplate}
                                                                isTeam={isTeam}
                                                                feedback={{
                                                                    mode: isTeam ? "review" : canFlowFeedback ? "client" : "off",
                                                                    items: flowFeedback,
                                                                    author: suggestAuthor,
                                                                    // Per-email: the section binds the open tab's slot before it sends.
                                                                    sendFor: sendFlowFeedback,
                                                                    withdraw: withdrawFeedback,
                                                                    resolve: resolveFeedback,
                                                                }}
                                                            />
                                                        </div>
                                                    </>
                                                )}

                                                {/* ── Pinned Posts — the three Canva carousels on top of the grid ── */}
                                                {activeSection === "pinnedposts" && (
                                                    <PinnedPostsSection
                                                        pinned={pinnedPosts}
                                                        onPatch={patchPinned}
                                                        isLocked={isLocked}
                                                        isTeam={isTeam}
                                                        isTemplate={isTemplate}
                                                        profile={igProfileInputs}
                                                        feedback={pinnedFeedback}
                                                        canReview={canReviewPinned}
                                                        reviewerEmail={suggestAuthor}
                                                        onSendFeedback={sendPinnedFeedback}
                                                        onWithdrawFeedback={withdrawOwnSuggestion}
                                                        onResolveFeedback={resolvePinnedFeedback}
                                                    />
                                                )}

                                                {/* ── Client Input — the Onboarding Form (the client's FIRST form) ── */}
                                                {activeSection === "intake" && (
                                                    <Reveal>
                                                        <SectionEyebrow section={activeSection} />
                                                        <SectionHeading>Onboarding Form</SectionHeading>
                                                        {/* The form's own welcome copy, imported rather than restated — this section
                                                            used to carry a shorter blurb, so there were two versions of what the
                                                            form asks for and two places to edit.

                                                            All of it is instructions for filling the form in, so it disappears once
                                                            the client has submitted: how long it takes and which logins to gather
                                                            are no longer things they can act on, and leaving them up makes a
                                                            finished task look outstanding. The status card below stays. */}
                                                        {!intakeSubmitted && (
                                                            <>
                                                                <p className="mt-3 max-w-2xl text-md text-tertiary">{ONBOARDING_INTRO}</p>
                                                                <p className="mt-3 max-w-2xl text-md text-tertiary">
                                                                    <span className="font-semibold text-secondary">Important:</span> {ONBOARDING_LEAD_TIME}
                                                                </p>
                                                                <p className="mt-4 text-sm text-quaternary">
                                                                    {TOTAL_QUESTIONS} questions · {ESTIMATE_LABEL}
                                                                </p>
                                                                <p className="mt-1 text-sm text-quaternary">{ONBOARDING_SAVES_NOTE}</p>
                                                            </>
                                                        )}

                                                        <div className="mt-6 rounded-2xl bg-primary p-5 ring-1 ring-secondary">
                                                            <div className="flex flex-wrap items-center justify-between gap-4">
                                                                <div className="flex items-center gap-3">
                                                                    <FeaturedIcon
                                                                        icon={intakeSubmitted ? CheckCircle : ClipboardCheck}
                                                                        color={intakeSubmitted ? "success" : intakeStarted ? "brand" : "gray"}
                                                                        theme="light"
                                                                        size="lg"
                                                                    />
                                                                    <div>
                                                                        <p className="text-md font-semibold text-primary">
                                                                            {isTemplate
                                                                                ? "Master template"
                                                                                : intakeStatus === "error"
                                                                                  ? "Couldn't load your form"
                                                                                  : !intakeReady
                                                                                    ? "Checking your form…"
                                                                                    : intakeSubmitted
                                                                                      ? "Submitted — thank you!"
                                                                                      : intakeStarted
                                                                                        ? "In progress"
                                                                                        : "Not started yet"}
                                                                        </p>
                                                                        <p className="mt-0.5 text-sm text-tertiary" aria-live="polite">
                                                                            {isTemplate ? (
                                                                                "Preview of the form every client completes during onboarding."
                                                                            ) : intakeStatus === "error" ? (
                                                                                "Check your connection and try again."
                                                                            ) : !intakeReady ? (
                                                                                "One moment…"
                                                                            ) : intakeSubmittedAt ? (
                                                                                <>
                                                                                    Sent{" "}
                                                                                    {new Date(intakeSubmittedAt).toLocaleDateString(undefined, {
                                                                                        month: "long",
                                                                                        day: "numeric",
                                                                                        year: "numeric",
                                                                                    })}{" "}
                                                                                    · you can still update your answers
                                                                                </>
                                                                            ) : (
                                                                                <>
                                                                                    {intakeInfo.answered} of {intakeInfo.total} questions answered
                                                                                </>
                                                                            )}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                {intakeReady && !intakeSubmitted && (
                                                                    <ProgressBarCircle
                                                                        value={intakeInfo.answered}
                                                                        max={Math.max(intakeInfo.total, 1)}
                                                                        size="xs"
                                                                        label="Form progress"
                                                                        valueFormatter={(_, pct) => `${pct}%`}
                                                                    />
                                                                )}
                                                            </div>

                                                            <div className="mt-5 flex flex-wrap items-center gap-3">
                                                                {intakeStatus === "error" ? (
                                                                    <Button color="secondary" onClick={() => setIntakeStatus("idle")}>
                                                                        Try again
                                                                    </Button>
                                                                ) : !isTemplate && !intakeReady ? (
                                                                    <Button isDisabled iconTrailing={ArrowRight}>
                                                                        Open the form
                                                                    </Button>
                                                                ) : (
                                                                    <Button
                                                                        iconTrailing={ArrowRight}
                                                                        {...(isTemplate ? { href: intakeHref } : { onClick: () => setFormModal("intake") })}
                                                                    >
                                                                        {intakeSubmitted
                                                                            ? "Review your answers"
                                                                            : intakeStarted
                                                                              ? "Continue the form"
                                                                              : "Start the form"}
                                                                    </Button>
                                                                )}
                                                                {isTeam && !isTemplate && intakeSlug && intakeReady && (
                                                                    <Button
                                                                        color="secondary"
                                                                        iconLeading={Copy01}
                                                                        onClick={() => {
                                                                            void navigator.clipboard.writeText(`${window.location.origin}/${intakeSlug}`);
                                                                            setCopiedIntakeLink(true);
                                                                            window.setTimeout(() => setCopiedIntakeLink(false), 2000);
                                                                        }}
                                                                    >
                                                                        {copiedIntakeLink ? "Link copied" : "Copy Link"}
                                                                    </Button>
                                                                )}
                                                                {/* Reset only appears once there is something to erase. On an
                                                                    untouched form it offered to wipe nothing, which is a
                                                                    destructive-looking button with no purpose. */}
                                                                {isTeam &&
                                                                    !isTemplate &&
                                                                    intakeSlug &&
                                                                    intakeReady &&
                                                                    (intakeStarted || intakeSubmitted) &&
                                                                    (armedReset === "intake" ? (
                                                                        <>
                                                                            <Button
                                                                                color="primary-destructive"
                                                                                isLoading={resetting}
                                                                                showTextWhileLoading
                                                                                onClick={() => void resetForm("intake")}
                                                                            >
                                                                                {resetting ? "Resetting…" : "Yes, erase all answers"}
                                                                            </Button>
                                                                            <Button
                                                                                color="secondary"
                                                                                isDisabled={resetting}
                                                                                onClick={() => setArmedReset(null)}
                                                                            >
                                                                                Cancel
                                                                            </Button>
                                                                        </>
                                                                    ) : (
                                                                        <Button
                                                                            color="tertiary-destructive"
                                                                            iconLeading={RefreshCw01}
                                                                            onClick={() => setArmedReset("intake")}
                                                                        >
                                                                            Reset form
                                                                        </Button>
                                                                    ))}
                                                            </div>

                                                            {isTeam && !isTemplate && intakeSlug && (
                                                                <p className="mt-4 border-t border-secondary pt-3 text-xs text-quaternary">
                                                                    Form page: <span className="font-medium text-tertiary">/{intakeSlug}</span>
                                                                </p>
                                                            )}

                                                            {/* Once it's in, the answers ARE the useful content — showing them
                                                        here saves a trip through the review screen. */}
                                                            {intakeSubmitted && intakeData && (
                                                                <OnboardingAnswers
                                                                    sections={clientOnboardingAnswers(intakeData)}
                                                                    isTeamView={isTeam}
                                                                    clientName={clientName}
                                                                    onEdit={(field) => {
                                                                        setFormModalField(field);
                                                                        setFormModal("intake");
                                                                    }}
                                                                />
                                                            )}
                                                        </div>

                                                        {/* Only for a client who answered the Brand Vision Form before its
                                                            questions moved into this one. Their answers also fill any empty
                                                            question above, so nothing has to be typed twice. */}
                                                        {hasVision && visionData && (
                                                            <div className="mt-4 rounded-2xl bg-primary p-5 ring-1 ring-secondary">
                                                                <div className="flex flex-wrap items-center justify-between gap-4">
                                                                    <div className="flex items-center gap-3">
                                                                        <FeaturedIcon
                                                                            icon={visionInfo.submittedAt ? CheckCircle : FileCheck02}
                                                                            color={visionInfo.submittedAt ? "success" : "brand"}
                                                                            theme="light"
                                                                            size="lg"
                                                                        />
                                                                        <div>
                                                                            <p className="text-md font-semibold text-primary">Brand Vision Form</p>
                                                                            <p className="mt-0.5 text-sm text-tertiary">
                                                                                {visionInfo.submittedAt
                                                                                    ? `Sent ${new Date(visionInfo.submittedAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })} · your earlier answers, kept as you gave them`
                                                                                    : `${visionInfo.answered} of ${visionInfo.total} answered · your earlier answers, kept as you gave them`}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="mt-5 flex flex-wrap items-center gap-3">
                                                                    <Button color="secondary" iconTrailing={ArrowRight} onClick={() => setFormModal("brand")}>
                                                                        {visionInfo.submittedAt ? "Review your answers" : "Continue the form"}
                                                                    </Button>
                                                                    {isTeam && (
                                                                        <Button
                                                                            color="secondary"
                                                                            iconLeading={Copy01}
                                                                            onClick={() => {
                                                                                void navigator.clipboard.writeText(`${window.location.origin}/${visionSlug}`);
                                                                                setCopiedVisionLink(true);
                                                                                window.setTimeout(() => setCopiedVisionLink(false), 2000);
                                                                            }}
                                                                        >
                                                                            {copiedVisionLink ? "Link copied" : "Copy Link"}
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                                {visionInfo.submittedAt && (
                                                                    <OnboardingAnswers
                                                                        sections={hostOnboardingAnswers(visionData)}
                                                                        isTeamView={isTeam}
                                                                        clientName={clientName}
                                                                        onEdit={() => setFormModal("brand")}
                                                                    />
                                                                )}
                                                            </div>
                                                        )}
                                                    </Reveal>
                                                )}

                                                {/* ── Client Input — the Account Access Form: logins and billing ── */}
                                                {activeSection === "onboarding" && (
                                                    <Reveal>
                                                        <SectionEyebrow section={activeSection} />
                                                        <SectionHeading>Account Access Form</SectionHeading>
                                                        {!onboardingSubmitted && (
                                                            <>
                                                                <p className="mt-3 max-w-2xl text-md text-tertiary">{ACCESS_INTRO}</p>
                                                                <p className="mt-4 text-sm text-quaternary">
                                                                    {ACCESS_FORM.total} questions · {ACCESS_FORM.estimate}
                                                                </p>
                                                                <p className="mt-1 text-sm text-quaternary">{ONBOARDING_SAVES_NOTE}</p>
                                                                {CREDENTIAL_LABELS.length > 0 && (
                                                                    <div className="mt-5 max-w-2xl rounded-xl bg-secondary px-4 py-3 ring-1 ring-secondary">
                                                                        <p className="text-sm text-secondary">
                                                                            <span className="font-semibold text-primary">Worth having on hand:</span> This form
                                                                            asks for a few account logins so we can set things up for you — {CREDENTIAL_LIST}.
                                                                        </p>
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}

                                                        <div className="mt-6 rounded-2xl bg-primary p-5 ring-1 ring-secondary">
                                                            <div className="flex flex-wrap items-center justify-between gap-4">
                                                                <div className="flex items-center gap-3">
                                                                    <FeaturedIcon
                                                                        icon={onboardingSubmitted ? CheckCircle : ClipboardCheck}
                                                                        color={onboardingSubmitted ? "success" : onboardingStarted ? "brand" : "gray"}
                                                                        theme="light"
                                                                        size="lg"
                                                                    />
                                                                    <div>
                                                                        <p className="text-md font-semibold text-primary">
                                                                            {isTemplate
                                                                                ? "Master template"
                                                                                : onboardingStatus === "error"
                                                                                  ? "Couldn't load your form"
                                                                                  : !onboardingReady
                                                                                    ? "Checking your form…"
                                                                                    : onboardingSubmitted
                                                                                      ? "Submitted — thank you!"
                                                                                      : onboardingStarted
                                                                                        ? "In progress"
                                                                                        : "Not started yet"}
                                                                        </p>
                                                                        <p className="mt-0.5 text-sm text-tertiary" aria-live="polite">
                                                                            {isTemplate ? (
                                                                                "Preview of the form every client fills in."
                                                                            ) : onboardingStatus === "error" ? (
                                                                                "Check your connection and try again."
                                                                            ) : !onboardingReady ? (
                                                                                "One moment…"
                                                                            ) : onboardingSubmittedAt ? (
                                                                                <>
                                                                                    Sent{" "}
                                                                                    {new Date(onboardingSubmittedAt).toLocaleDateString(undefined, {
                                                                                        month: "long",
                                                                                        day: "numeric",
                                                                                        year: "numeric",
                                                                                    })}{" "}
                                                                                    · you can still update your answers
                                                                                </>
                                                                            ) : (
                                                                                <>
                                                                                    {onboardingInfo.answered} of {onboardingInfo.total} questions answered
                                                                                </>
                                                                            )}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                {onboardingReady && !onboardingSubmitted && (
                                                                    <ProgressBarCircle
                                                                        value={onboardingInfo.answered}
                                                                        max={Math.max(onboardingInfo.total, 1)}
                                                                        size="xs"
                                                                        label="Form progress"
                                                                        valueFormatter={(_, pct) => `${pct}%`}
                                                                    />
                                                                )}
                                                            </div>

                                                            <div className="mt-5 flex flex-wrap items-center gap-3">
                                                                {onboardingStatus === "error" ? (
                                                                    <Button color="secondary" onClick={() => setOnboardingStatus("idle")}>
                                                                        Try again
                                                                    </Button>
                                                                ) : !isTemplate && !onboardingReady ? (
                                                                    // A disabled link renders an empty href — plain button until the check lands.
                                                                    <Button isDisabled iconTrailing={ArrowRight}>
                                                                        Open the form
                                                                    </Button>
                                                                ) : (
                                                                    <Button
                                                                        iconTrailing={ArrowRight}
                                                                        {...(isTemplate ? { href: onboardingHref } : { onClick: () => setFormModal("access") })}
                                                                    >
                                                                        {onboardingSubmitted
                                                                            ? "Review your answers"
                                                                            : onboardingStarted
                                                                              ? "Continue the form"
                                                                              : "Start the form"}
                                                                    </Button>
                                                                )}
                                                                {isTeam && !isTemplate && onboardingSlug && onboardingReady && (
                                                                    <Button
                                                                        color="secondary"
                                                                        iconLeading={Copy01}
                                                                        onClick={() => {
                                                                            void navigator.clipboard.writeText(`${window.location.origin}/${onboardingSlug}`);
                                                                            setCopiedOnboardingLink(true);
                                                                            window.setTimeout(() => setCopiedOnboardingLink(false), 2000);
                                                                        }}
                                                                    >
                                                                        {copiedOnboardingLink ? "Link copied" : "Copy Link"}
                                                                    </Button>
                                                                )}
                                                                {/* Same rule as the Onboarding Form: nothing answered, nothing
                                                                    to reset, so no button. */}
                                                                {isTeam &&
                                                                    !isTemplate &&
                                                                    onboardingSlug &&
                                                                    onboardingReady &&
                                                                    (onboardingStarted || onboardingSubmitted) &&
                                                                    (armedReset === "access" ? (
                                                                        <>
                                                                            <Button
                                                                                color="primary-destructive"
                                                                                isLoading={resetting}
                                                                                showTextWhileLoading
                                                                                onClick={() => void resetForm("access")}
                                                                            >
                                                                                {resetting ? "Resetting…" : "Yes, erase all answers"}
                                                                            </Button>
                                                                            <Button
                                                                                color="secondary"
                                                                                isDisabled={resetting}
                                                                                onClick={() => setArmedReset(null)}
                                                                            >
                                                                                Cancel
                                                                            </Button>
                                                                        </>
                                                                    ) : (
                                                                        <Button
                                                                            color="tertiary-destructive"
                                                                            iconLeading={RefreshCw01}
                                                                            onClick={() => setArmedReset("access")}
                                                                        >
                                                                            Reset form
                                                                        </Button>
                                                                    ))}
                                                            </div>

                                                            {/* Same inline review the Onboarding Form gets: once it's in, the
                                                        answers ARE the useful content, so don't make anyone open the
                                                        review screen to read them. */}
                                                            {onboardingSubmitted && brandData && (
                                                                <OnboardingAnswers
                                                                    sections={clientOnboardingAnswers(brandData, ACCESS_FORM)}
                                                                    isTeamView={isTeam}
                                                                    clientName={clientName}
                                                                    onDeleteLogin={isTeam && !isTemplate ? deleteLogin : undefined}
                                                                    onEdit={(field) => {
                                                                        setFormModalField(field);
                                                                        setFormModal("access");
                                                                    }}
                                                                />
                                                            )}

                                                            {/* Team-only: the exact form this dashboard is wired to, so a mismatched
                                                        copy created from the form's own wizard is visible instead of silent. */}
                                                            {isTeam && !isTemplate && onboardingSlug && (
                                                                <p className="mt-4 border-t border-secondary pt-3 text-xs text-quaternary">
                                                                    Form page: <span className="font-medium text-tertiary">/{onboardingSlug}</span>
                                                                </p>
                                                            )}
                                                        </div>
                                                    </Reveal>
                                                )}

                                                {/* ── Master Document — the Foundation everything downstream reads from ── */}
                                                {/* ── Client Overview Document — the AM's internal brief ──
                                                    Rendered only for the team. The nav row is filtered out for a
                                                    client and revealedToClient() refuses this id outright, so this
                                                    guard is the third of three rather than the only one. */}
                                                {activeSection === "overviewdoc" && isTeam && (
                                                    <Reveal>
                                                        <SectionEyebrow section={activeSection} />
                                                        <div className="flex flex-wrap items-center gap-3">
                                                            <SectionHeading>Client Overview</SectionHeading>
                                                            <BadgeWithDot color="warning" size="sm" type="pill-color">
                                                                Team only
                                                            </BadgeWithDot>
                                                        </div>
                                                        <p className="mt-3 text-md text-tertiary">
                                                            Your working brief on this client — what they sell, who they sell it to, and how they want to be
                                                            handled. The client never sees this section.
                                                        </p>

                                                        <div className="mt-4 flex flex-wrap items-center gap-3">
                                                            {!isTemplate && (
                                                                <Button
                                                                    size="sm"
                                                                    color="secondary"
                                                                    iconLeading={Stars02}
                                                                    isLoading={overviewBusy}
                                                                    showTextWhileLoading
                                                                    onClick={() => void generateOverview()}
                                                                >
                                                                    {overviewBusy
                                                                        ? `${overviewStep || "Reading their answers"}…`
                                                                        : "Draft from the onboarding form"}
                                                                </Button>
                                                            )}
                                                            <Button
                                                                size="sm"
                                                                color="secondary"
                                                                iconLeading={overviewCopied ? Check : Copy01}
                                                                onClick={() => void copyOverviewForDocs()}
                                                            >
                                                                {overviewCopied ? "Copied!" : "Copy document"}
                                                            </Button>
                                                            <span className="text-sm text-quaternary tabular-nums">
                                                                {OVERVIEW_SECTIONS.length + 2} sections · {overviewFilled} of {OVERVIEW_COUNTED_FIELDS.length}{" "}
                                                                fields filled
                                                            </span>
                                                            {overviewDoc.generated_at && (
                                                                <span className="text-xs text-quaternary">
                                                                    Drafted {new Date(overviewDoc.generated_at).toLocaleDateString()} — review before relying on
                                                                    it
                                                                </span>
                                                            )}
                                                        </div>
                                                        {overviewError && (
                                                            <p className="mt-2 flex items-start gap-1.5 text-sm text-error-primary" role="alert">
                                                                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                                                                {overviewError}
                                                            </p>
                                                        )}
                                                        {isLocked && <p className="mt-2 text-xs text-quaternary">Unlock the dashboard to edit these fields.</p>}

                                                        {/* Same two-column shape as the Master Brand Document: rail beside the
                                                            document on wide screens, above it on narrow ones. */}
                                                        <div className="mt-8 flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
                                                            <DocRail sections={OVERVIEW_RAIL} progress={overviewSectionFilled} />

                                                            <div className="flex min-w-0 flex-1 flex-col gap-8">
                                                                {OVERVIEW_SECTIONS.map((sec) => (
                                                                    <DocSection
                                                                        key={sec.id}
                                                                        id={sec.id}
                                                                        label={sec.title}
                                                                        number={overviewSectionNumber(sec.id)}
                                                                    >
                                                                        <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
                                                                            {sec.fields.map((f) => (
                                                                                <div key={String(f.key)} className={cx(!f.half && "sm:col-span-2")}>
                                                                                    <p className="text-sm font-medium text-secondary">{f.label}</p>
                                                                                    {isLocked ? (
                                                                                        <p
                                                                                            className={cx(
                                                                                                "mt-1 text-md whitespace-pre-wrap",
                                                                                                String(overviewDoc[f.key] ?? "").trim()
                                                                                                    ? "text-tertiary"
                                                                                                    : "text-quaternary italic",
                                                                                            )}
                                                                                        >
                                                                                            {String(overviewDoc[f.key] ?? "").trim() || "Not filled in"}
                                                                                        </p>
                                                                                    ) : f.long ? (
                                                                                        <textarea
                                                                                            rows={2}
                                                                                            placeholder={f.placeholder}
                                                                                            value={String(overviewDoc[f.key] ?? "")}
                                                                                            onChange={(e) =>
                                                                                                patchOverviewDoc({
                                                                                                    [f.key]: e.target.value,
                                                                                                } as Partial<OverviewDoc>)
                                                                                            }
                                                                                            className={cx(editInput(), "mt-1.5 resize-y")}
                                                                                        />
                                                                                    ) : (
                                                                                        <input
                                                                                            placeholder={f.placeholder}
                                                                                            value={String(overviewDoc[f.key] ?? "")}
                                                                                            onChange={(e) =>
                                                                                                patchOverviewDoc({
                                                                                                    [f.key]: e.target.value,
                                                                                                } as Partial<OverviewDoc>)
                                                                                            }
                                                                                            className={cx(editInput(), "mt-1.5")}
                                                                                        />
                                                                                    )}
                                                                                </div>
                                                                            ))}
                                                                        </div>

                                                                        {/* Properties sit between Platforms and Goals, matching the brief's order.
                                                                        Anchored + numbered like a section of its own so the rail can reach it. */}
                                                                        {sec.id === "platforms" && (
                                                                            <div
                                                                                id="mbd-properties"
                                                                                className="mt-8 scroll-mt-24 border-t border-secondary pt-8"
                                                                            >
                                                                                <div className="flex items-center justify-between gap-3">
                                                                                    <h3 className="text-xl font-semibold text-primary">
                                                                                        {overviewSectionNumber("properties")}. Properties
                                                                                    </h3>
                                                                                    {!isLocked && (
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() =>
                                                                                                patchOverviewDoc({
                                                                                                    properties: [
                                                                                                        ...overviewDoc.properties,
                                                                                                        { id: crypto.randomUUID(), name: "", link: "" },
                                                                                                    ],
                                                                                                })
                                                                                            }
                                                                                            className="text-sm font-semibold text-brand-secondary transition duration-100 ease-linear hover:underline"
                                                                                        >
                                                                                            + Add property
                                                                                        </button>
                                                                                    )}
                                                                                </div>
                                                                                <div className="mt-3 flex flex-col gap-2">
                                                                                    {overviewDoc.properties.map((prop, i) => (
                                                                                        <div
                                                                                            key={prop.id}
                                                                                            className="grid grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-3 rounded-xl bg-primary p-3 ring-1 ring-secondary"
                                                                                        >
                                                                                            <span className="font-mono text-xs text-quaternary tabular-nums">
                                                                                                {String(i + 1).padStart(2, "0")}
                                                                                            </span>
                                                                                            {isLocked ? (
                                                                                                <>
                                                                                                    <span className="truncate text-md text-tertiary">
                                                                                                        {prop.name || "—"}
                                                                                                    </span>
                                                                                                    <span className="truncate text-md text-tertiary">
                                                                                                        {prop.link || "—"}
                                                                                                    </span>
                                                                                                    <span />
                                                                                                </>
                                                                                            ) : (
                                                                                                <>
                                                                                                    <input
                                                                                                        placeholder="Property name"
                                                                                                        value={prop.name}
                                                                                                        onChange={(e) =>
                                                                                                            patchOverviewDoc({
                                                                                                                properties: overviewDoc.properties.map((x) =>
                                                                                                                    x.id === prop.id
                                                                                                                        ? { ...x, name: e.target.value }
                                                                                                                        : x,
                                                                                                                ),
                                                                                                            })
                                                                                                        }
                                                                                                        className={editInput()}
                                                                                                    />
                                                                                                    <input
                                                                                                        placeholder="Listing link"
                                                                                                        value={prop.link}
                                                                                                        onChange={(e) =>
                                                                                                            patchOverviewDoc({
                                                                                                                properties: overviewDoc.properties.map((x) =>
                                                                                                                    x.id === prop.id
                                                                                                                        ? { ...x, link: e.target.value }
                                                                                                                        : x,
                                                                                                                ),
                                                                                                            })
                                                                                                        }
                                                                                                        className={editInput()}
                                                                                                    />
                                                                                                    <button
                                                                                                        type="button"
                                                                                                        onClick={() =>
                                                                                                            patchOverviewDoc({
                                                                                                                properties: overviewDoc.properties.filter(
                                                                                                                    (x) => x.id !== prop.id,
                                                                                                                ),
                                                                                                            })
                                                                                                        }
                                                                                                        title="Remove this property"
                                                                                                        className="flex size-7 items-center justify-center rounded-lg text-fg-quaternary transition duration-100 ease-linear hover:bg-secondary hover:text-error-primary"
                                                                                                    >
                                                                                                        <Trash01 className="size-3.5" aria-hidden="true" />
                                                                                                    </button>
                                                                                                </>
                                                                                            )}
                                                                                        </div>
                                                                                    ))}
                                                                                    {!overviewDoc.properties.length && (
                                                                                        <p className="rounded-xl border border-dashed border-secondary px-4 py-3 text-sm text-quaternary italic">
                                                                                            No properties listed yet.
                                                                                        </p>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </DocSection>
                                                                ))}

                                                                {/* Baseline — the numbers as they stood at kickoff, so growth has a zero point. */}
                                                                <DocSection
                                                                    id="baseline"
                                                                    label="Baseline (snapshot)"
                                                                    number={overviewSectionNumber("baseline")}
                                                                    action={<span className="text-xs text-quaternary">Recorded at kickoff</span>}
                                                                >
                                                                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                                                                        {OVERVIEW_BASELINE.map((f) => (
                                                                            <div
                                                                                key={String(f.key)}
                                                                                className="rounded-xl bg-primary p-4 ring-1 ring-secondary"
                                                                            >
                                                                                <p className="text-sm font-medium text-secondary">{f.label}</p>
                                                                                {isLocked ? (
                                                                                    <p className="mt-1 text-md text-tertiary tabular-nums">
                                                                                        {String(overviewDoc[f.key] ?? "").trim() || "—"}
                                                                                    </p>
                                                                                ) : (
                                                                                    <input
                                                                                        placeholder="—"
                                                                                        value={String(overviewDoc[f.key] ?? "")}
                                                                                        onChange={(e) =>
                                                                                            patchOverviewDoc({
                                                                                                [f.key]: e.target.value,
                                                                                            } as Partial<OverviewDoc>)
                                                                                        }
                                                                                        className={cx(editInput(), "mt-1.5 tabular-nums")}
                                                                                    />
                                                                                )}
                                                                            </div>
                                                                        ))}
                                                                    </div>

                                                                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-primary p-4 ring-1 ring-secondary">
                                                                        <div>
                                                                            <p className="text-sm font-medium text-secondary">Current direct booking split</p>
                                                                            <p className="mt-0.5 text-xs text-quaternary">Fill out after gaining PMS access</p>
                                                                        </div>
                                                                        <div className="flex items-center gap-1.5">
                                                                            {isLocked ? (
                                                                                <span className="text-md text-tertiary tabular-nums">
                                                                                    {String(overviewDoc.direct_booking_split ?? "").trim() || "—"}
                                                                                </span>
                                                                            ) : (
                                                                                <input
                                                                                    placeholder="—"
                                                                                    value={overviewDoc.direct_booking_split}
                                                                                    onChange={(e) => patchOverviewDoc({ direct_booking_split: e.target.value })}
                                                                                    className={cx(editInput(), "w-20 text-right tabular-nums")}
                                                                                />
                                                                            )}
                                                                            <span className="text-md text-tertiary">%</span>
                                                                        </div>
                                                                    </div>

                                                                    <div className="mt-3 rounded-xl bg-primary p-4 ring-1 ring-secondary">
                                                                        <p className="text-sm font-medium text-secondary">Instagram profile screenshot</p>
                                                                        {overviewDoc.instagram_screenshot ? (
                                                                            <div className="mt-3 flex flex-wrap items-start gap-3">
                                                                                <button
                                                                                    type="button"
                                                                                    title="View full size"
                                                                                    onClick={() => setLightboxSrc(overviewDoc.instagram_screenshot)}
                                                                                    className="cursor-zoom-in"
                                                                                >
                                                                                    <img
                                                                                        src={overviewDoc.instagram_screenshot}
                                                                                        alt="Instagram profile at kickoff"
                                                                                        className="max-h-56 rounded-lg ring-1 ring-secondary"
                                                                                    />
                                                                                </button>
                                                                                <ImageLightbox
                                                                                    src={lightboxSrc}
                                                                                    onClose={() => setLightboxSrc(null)}
                                                                                    alt="Instagram profile at kickoff"
                                                                                />
                                                                                {!isLocked && (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => patchOverviewDoc({ instagram_screenshot: "" })}
                                                                                        className="text-sm font-medium text-tertiary transition duration-100 ease-linear hover:text-error-primary"
                                                                                    >
                                                                                        Remove
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        ) : isLocked ? (
                                                                            <p className="mt-1 text-md text-quaternary italic">Not added</p>
                                                                        ) : (
                                                                            <label className="mt-3 flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-secondary px-4 py-6 text-sm text-quaternary transition duration-100 ease-linear hover:border-brand hover:text-tertiary">
                                                                                <input
                                                                                    type="file"
                                                                                    accept="image/*"
                                                                                    className="hidden"
                                                                                    onChange={(e) => void onPickOverviewShot(e)}
                                                                                />
                                                                                Add an image — it's compressed before saving
                                                                            </label>
                                                                        )}
                                                                    </div>
                                                                </DocSection>
                                                            </div>
                                                        </div>
                                                    </Reveal>
                                                )}

                                                {activeSection === "foundation" && (
                                                    <SuggestionContext.Provider
                                                        value={{
                                                            mode: isTeam ? "review" : suggestMode ? "suggest" : "off",
                                                            pendingByKey,
                                                            resolvedByKey,
                                                            draft: suggestDraft,
                                                            setDraft: (k, v) => setSuggestDraft((d) => ({ ...d, [k]: v })),
                                                            queuedAccepts,
                                                            accept: acceptSuggestion,
                                                            decline: declineSuggestion,
                                                            withdraw: withdrawOwnSuggestion,
                                                            // Whoever this view would sign a suggestion as — so a team member
                                                            // previewing can withdraw their own test rows too.
                                                            viewerEmail: suggestAuthor,
                                                        }}
                                                    >
                                                        <Reveal>
                                                            <div className="flex flex-wrap items-center gap-3">
                                                                <div className="min-w-0 flex-1">
                                                                    <SectionEyebrow section={activeSection} />
                                                                </div>
                                                                {pendingSuggestions.length > 0 && (
                                                                    <Badge color="brand" size="md" type="pill-color">
                                                                        {pendingSuggestions.length} suggestion{pendingSuggestions.length === 1 ? "" : "s"}{" "}
                                                                        pending
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <SectionHeading>Master Brand Document</SectionHeading>
                                                            <p className="mt-3 text-md text-tertiary">
                                                                Everything you share here is what we build your deliverables from, so it's worth taking the time
                                                                to get it complete and correct. It's also what your emails and AI tools read from.
                                                                {!isTeam && " Spot something off? Suggest an edit and your account manager will review it."}
                                                            </p>

                                                            {/* Team-only: pending suggestions whose row was deleted since — no field exists
                                                            to hang them on, so they're listed here with Decline as the only exit. */}
                                                            {orphanedPending.length > 0 && (
                                                                <div className="mt-4 rounded-2xl bg-primary p-4 ring-1 ring-secondary">
                                                                    <p className="text-sm font-semibold text-primary">
                                                                        Suggestions on removed rows ({orphanedPending.length})
                                                                    </p>
                                                                    <div className="mt-2 flex flex-col gap-2">
                                                                        {orphanedPending.map((s) => (
                                                                            <div key={s.id} className="flex flex-wrap items-center justify-between gap-2">
                                                                                <p className="min-w-0 text-sm text-tertiary">
                                                                                    <span className="font-medium text-secondary">
                                                                                        {s.field_label || s.field_key}
                                                                                    </span>
                                                                                    {" — "}
                                                                                    {s.suggested_value.trim() || "(cleared)"}
                                                                                    <span className="text-quaternary"> · {s.suggested_by}</span>
                                                                                </p>
                                                                                <Button size="sm" color="secondary" onClick={() => declineSuggestion(s)}>
                                                                                    Decline
                                                                                </Button>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Team-only: draft it from the client's own material, compile it for review,
                                                            or export it. */}
                                                            {isTeam && (
                                                                <div className="mt-4 flex flex-wrap items-center gap-3">
                                                                    {!isTemplate && (
                                                                        <Button
                                                                            size="sm"
                                                                            color="primary"
                                                                            iconLeading={Stars02}
                                                                            isDisabled={isLocked}
                                                                            isLoading={!!masterDraftStep}
                                                                            showTextWhileLoading
                                                                            onClick={() => void draftMasterDocument()}
                                                                        >
                                                                            {masterDraftStep ? `${masterDraftStep}…` : "Draft from forms & website"}
                                                                        </Button>
                                                                    )}
                                                                    <Button
                                                                        size="sm"
                                                                        color="secondary"
                                                                        iconLeading={FileCheck02}
                                                                        onClick={() => setShowMasterDocModal(true)}
                                                                    >
                                                                        Generate for AM review
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        color="secondary"
                                                                        iconLeading={headerDocCopied ? Check : Copy01}
                                                                        onClick={() => void copyMasterDocForDocs()}
                                                                    >
                                                                        {headerDocCopied ? "Copied!" : "Copy document"}
                                                                    </Button>
                                                                </div>
                                                            )}
                                                            {/* What landed, as it lands. A run is ~7 calls over about a minute, so the
                                                            AM needs to see progress rather than one long spinner. */}
                                                            {isTeam && masterDraftDone.length > 0 && (
                                                                <p className="mt-2 flex items-start gap-1.5 text-sm text-success-primary">
                                                                    <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                                                                    Drafted {masterDraftDone.join(", ")}. Review it, then Save changes — nothing is saved yet.
                                                                </p>
                                                            )}
                                                            {isTeam && masterDraftError && (
                                                                <p className="mt-2 flex items-start gap-1.5 text-sm text-error-primary" role="alert">
                                                                    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                                                                    {masterDraftError}
                                                                </p>
                                                            )}
                                                            {isTeam && !isTemplate && isLocked && (
                                                                <p className="mt-2 text-xs text-quaternary">
                                                                    Unlock the dashboard to draft — a draft fills empty boxes and never changes what's already
                                                                    written.
                                                                </p>
                                                            )}
                                                            {/* Team-gated: a client can't unlock anything — their route is Suggest edits above. */}
                                                            {isTeam && isLocked && (
                                                                <p className="mt-2 text-xs text-quaternary">Unlock the dashboard to edit this document.</p>
                                                            )}

                                                            {/* Client-only: THE way in to suggesting. A small rail button used to do this
                                                            and was missed — hosts sent their edits as a Google Doc instead — so this
                                                            spans the page. It was the only button kept: two
                                                            buttons for one action read as two different things. Leaving suggest mode
                                                            is the sticky bar's Cancel, which shows whenever the mode is on. */}
                                                            {/* Pinned to the top of the scroller from tablet up, so the way in to
                                                            suggesting stays in view the whole way down the document. The bg-primary
                                                            band behind it hides text scrolling past its rounded corners. Not on
                                                            phones: stacked, the box is a third of the screen. */}
                                                            {canSuggest && (
                                                                <div className="z-20 mt-3 bg-primary py-3 md:sticky md:top-0">
                                                                    <div className="flex flex-col gap-4 rounded-2xl border border-brand bg-brand-primary p-5 sm:flex-row sm:items-center sm:justify-between">
                                                                        <div className="flex items-start gap-4">
                                                                            <FeaturedIcon icon={Edit01} color="brand" theme="light" size="lg" />
                                                                            <div className="min-w-0">
                                                                                <p className="text-md font-semibold text-primary">
                                                                                    {suggestMode
                                                                                        ? "You're suggesting — click into any field below and type your change"
                                                                                        : "Want to change something? Edit it right here"}
                                                                                </p>
                                                                                <p className="mt-1 text-sm text-tertiary">
                                                                                    {suggestMode
                                                                                        ? "Change as many fields as you like, then press Send at the bottom of the screen. Your account manager reviews every suggestion before it's saved."
                                                                                        : "Type your changes straight into this document and your account manager will review them."}
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                        {!suggestMode && (
                                                                            <Button
                                                                                size="lg"
                                                                                color="primary"
                                                                                iconLeading={Edit01}
                                                                                className="shrink-0"
                                                                                onClick={() => setSuggestMode(true)}
                                                                            >
                                                                                Suggest edits
                                                                            </Button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Rail beside the document on wide screens; above it on narrow ones, where a
                                                            sticky column would eat the reading width. */}
                                                            <div className="mt-8 flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
                                                                <DocRail
                                                                    sections={FOUNDATION_SECTIONS}
                                                                    progress={foundationFilledMap}
                                                                    belowPinnedBar={canSuggest}
                                                                />

                                                                {/* With the box pinned, a section jumped to would land under it. */}
                                                                <div
                                                                    className={cx(
                                                                        "flex min-w-0 flex-1 flex-col gap-8",
                                                                        canSuggest && "md:[&_[id^='mbd-']]:scroll-mt-48",
                                                                    )}
                                                                >
                                                                    {/* ── 1. About the hosts ── */}
                                                                    <DocSection
                                                                        id="hosts"
                                                                        label="About the hosts"
                                                                        badge={isTeam ? <SourceBadge>From onboarding form</SourceBadge> : undefined}
                                                                    >
                                                                        <DocField
                                                                            isLocked={isLocked}
                                                                            rows={3}
                                                                            value={foundation.hosts}
                                                                            placeholder="Who they are, how they came to hosting, what they care about."
                                                                            sKey="hosts"
                                                                            onChange={(v) => patchFoundation({ hosts: v })}
                                                                        />
                                                                    </DocSection>

                                                                    {/* ── 2. About the properties ── */}
                                                                    <DocSection
                                                                        id="properties"
                                                                        label="About the properties"
                                                                        badge={isTeam ? <SourceBadge>From onboarding form + website</SourceBadge> : undefined}
                                                                    >
                                                                        <p className="text-md text-tertiary">
                                                                            If it's a micro resort or separate properties, what type of properties they have
                                                                            (e.g. treehouses, cabins, domes), general amenities, shared resort amenities, etc.
                                                                        </p>
                                                                        <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
                                                                            <DocField
                                                                                isLocked={isLocked}
                                                                                label="Property type"
                                                                                value={foundation.propertyType}
                                                                                placeholder="e.g. treehouses, cabins, domes"
                                                                                sKey="propertyType"
                                                                                onChange={(v) => patchFoundation({ propertyType: v })}
                                                                            />
                                                                            <DocField
                                                                                isLocked={isLocked}
                                                                                label="Structure"
                                                                                value={foundation.structure}
                                                                                placeholder="Micro resort or separate properties"
                                                                                sKey="structure"
                                                                                onChange={(v) => patchFoundation({ structure: v })}
                                                                            />
                                                                            <DocField
                                                                                isLocked={isLocked}
                                                                                rows={2}
                                                                                label="General amenities"
                                                                                value={foundation.generalAmenities}
                                                                                placeholder="What every stay includes"
                                                                                sKey="generalAmenities"
                                                                                onChange={(v) => patchFoundation({ generalAmenities: v })}
                                                                            />
                                                                            <DocField
                                                                                isLocked={isLocked}
                                                                                rows={2}
                                                                                label="Shared resort amenities"
                                                                                value={foundation.sharedAmenities}
                                                                                placeholder="Anything guests share across the site"
                                                                                sKey="sharedAmenities"
                                                                                onChange={(v) => patchFoundation({ sharedAmenities: v })}
                                                                            />
                                                                        </div>
                                                                    </DocSection>

                                                                    {/* ── 3. Location ── */}
                                                                    <DocSection
                                                                        id="location"
                                                                        label="Location"
                                                                        badge={isTeam ? <SourceBadge>From onboarding form</SourceBadge> : undefined}
                                                                    >
                                                                        <DocField
                                                                            isLocked={isLocked}
                                                                            label="Exact location"
                                                                            value={foundation.exactLocation}
                                                                            placeholder="Address or coordinates"
                                                                            sKey="exactLocation"
                                                                            onChange={(v) => patchFoundation({ exactLocation: v })}
                                                                        />
                                                                        <div className="mt-5 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
                                                                            <DocField
                                                                                isLocked={isLocked}
                                                                                rows={2}
                                                                                label="Proximity to popular cities"
                                                                                value={foundation.proximityCities}
                                                                                placeholder="City — drive time"
                                                                                sKey="proximityCities"
                                                                                onChange={(v) => patchFoundation({ proximityCities: v })}
                                                                            />
                                                                            <DocField
                                                                                isLocked={isLocked}
                                                                                rows={2}
                                                                                label="Proximity to airports"
                                                                                value={foundation.proximityAirports}
                                                                                placeholder="Airport code — drive time"
                                                                                sKey="proximityAirports"
                                                                                onChange={(v) => patchFoundation({ proximityAirports: v })}
                                                                            />
                                                                        </div>
                                                                    </DocSection>

                                                                    {/* ── 4. Target audience profile ── */}
                                                                    <DocSection
                                                                        id="audience"
                                                                        label="Target audience profile"
                                                                        badge={isTeam ? <WorkflowBadge /> : undefined}
                                                                    >
                                                                        <DocField
                                                                            isLocked={isLocked}
                                                                            rows={3}
                                                                            value={foundation.targetAudience}
                                                                            placeholder={
                                                                                isTeam
                                                                                    ? "Paste the target audience profile from the workflow output."
                                                                                    : "Who your ideal guests are, as a group."
                                                                            }
                                                                            sKey="targetAudience"
                                                                            onChange={(v) => patchFoundation({ targetAudience: v })}
                                                                        />
                                                                    </DocSection>

                                                                    {/* ── 5. Unique value proposition ── */}
                                                                    <DocSection
                                                                        id="uvp"
                                                                        label="Unique value proposition"
                                                                        badge={isTeam ? <WorkflowBadge /> : undefined}
                                                                    >
                                                                        <DocField
                                                                            isLocked={isLocked}
                                                                            rows={3}
                                                                            value={foundation.uvp}
                                                                            placeholder={
                                                                                isTeam
                                                                                    ? "Paste the UVP from the workflow output."
                                                                                    : "What makes this stay worth choosing over any other."
                                                                            }
                                                                            sKey="uvp"
                                                                            onChange={(v) => patchFoundation({ uvp: v })}
                                                                        />
                                                                    </DocSection>

                                                                    {/* ── 6. About the brand ── */}
                                                                    <DocSection
                                                                        id="brand"
                                                                        label="About the brand"
                                                                        badge={isTeam ? <WorkflowBadge /> : undefined}
                                                                    >
                                                                        <DocField
                                                                            isLocked={isLocked}
                                                                            rows={2}
                                                                            label="Brand voice"
                                                                            value={foundation.brandVoice}
                                                                            placeholder="How the brand sounds, and what it never sounds like."
                                                                            sKey="brandVoice"
                                                                            onChange={(v) => patchFoundation({ brandVoice: v })}
                                                                        />

                                                                        <div className="mt-5">
                                                                            <p className="text-sm font-medium text-secondary">Taglines</p>
                                                                            <div className="mt-2 flex flex-col gap-2">
                                                                                {foundation.taglines.map((t, i) => (
                                                                                    <div key={i} className="flex items-start gap-3">
                                                                                        <span className="mt-1 w-6 shrink-0 font-mono text-xs text-quaternary tabular-nums">
                                                                                            {String(i + 1).padStart(2, "0")}
                                                                                        </span>
                                                                                        <div className="min-w-0 flex-1">
                                                                                            {suggestMode ? (
                                                                                                <input
                                                                                                    placeholder="2–6 words"
                                                                                                    value={suggestDraft[`taglines.${i}`] ?? t}
                                                                                                    onChange={(e) =>
                                                                                                        setSuggestDraft((d) => ({
                                                                                                            ...d,
                                                                                                            [`taglines.${i}`]: e.target.value,
                                                                                                        }))
                                                                                                    }
                                                                                                    className={editInput("border-brand")}
                                                                                                />
                                                                                            ) : isLocked ? (
                                                                                                <span
                                                                                                    className={cx(
                                                                                                        "text-md",
                                                                                                        filled(t) ? "text-tertiary" : "text-quaternary italic",
                                                                                                    )}
                                                                                                >
                                                                                                    {filled(t) ? t : "2–6 words"}
                                                                                                </span>
                                                                                            ) : (
                                                                                                <input
                                                                                                    placeholder="2–6 words"
                                                                                                    value={t}
                                                                                                    onChange={(e) =>
                                                                                                        patchFoundation({
                                                                                                            taglines: foundation.taglines.map((x, j) =>
                                                                                                                j === i ? e.target.value : x,
                                                                                                            ),
                                                                                                        })
                                                                                                    }
                                                                                                    className={editInput()}
                                                                                                />
                                                                                            )}
                                                                                            <SuggestionBox sKey={`taglines.${i}`} liveValue={t} />
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>

                                                                        <DocField
                                                                            className="mt-5"
                                                                            isLocked={isLocked}
                                                                            rows={3}
                                                                            label="Brand bio"
                                                                            value={foundation.brandBio}
                                                                            placeholder="The short paragraph that introduces the brand."
                                                                            sKey="brandBio"
                                                                            onChange={(v) => patchFoundation({ brandBio: v })}
                                                                        />
                                                                    </DocSection>

                                                                    {/* ── 7. Personas ── */}
                                                                    <DocSection
                                                                        id="personas"
                                                                        label="Personas"
                                                                        badge={isTeam ? <WorkflowBadge /> : undefined}
                                                                        action={
                                                                            !isLocked && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() =>
                                                                                        patchFoundation({
                                                                                            personas: [
                                                                                                ...foundation.personas,
                                                                                                emptyPersona(
                                                                                                    foundation.personas.length === 0 ? "Primary" : "Secondary",
                                                                                                ),
                                                                                            ],
                                                                                        })
                                                                                    }
                                                                                    className="text-sm font-semibold text-brand-secondary transition duration-100 ease-linear hover:underline"
                                                                                >
                                                                                    + Add persona
                                                                                </button>
                                                                            )
                                                                        }
                                                                    >
                                                                        <div className="flex flex-col gap-4">
                                                                            {foundation.personas.length === 0 && (
                                                                                <p className="rounded-xl border border-dashed border-secondary px-4 py-3 text-sm text-quaternary italic">
                                                                                    No personas yet.
                                                                                </p>
                                                                            )}
                                                                            {foundation.personas.map((p) => (
                                                                                <div
                                                                                    key={p.id}
                                                                                    className="overflow-hidden rounded-2xl bg-primary ring-1 ring-secondary"
                                                                                >
                                                                                    {/* Card head — who this persona is, and where they rank. */}
                                                                                    <div className="bg-secondary_subtle flex flex-wrap items-start justify-between gap-3 border-b border-secondary px-4 py-3">
                                                                                        <div className="min-w-0 flex-1">
                                                                                            {suggestMode ? (
                                                                                                <div className="flex flex-col gap-1.5">
                                                                                                    <input
                                                                                                        placeholder="Persona name"
                                                                                                        value={suggestDraft[`personas.${p.id}.name`] ?? p.name}
                                                                                                        onChange={(e) =>
                                                                                                            setSuggestDraft((d) => ({
                                                                                                                ...d,
                                                                                                                [`personas.${p.id}.name`]: e.target.value,
                                                                                                            }))
                                                                                                        }
                                                                                                        className={editInput("border-brand font-semibold")}
                                                                                                    />
                                                                                                    <input
                                                                                                        placeholder="One-line summary of who they are"
                                                                                                        value={
                                                                                                            suggestDraft[`personas.${p.id}.summary`] ??
                                                                                                            p.summary
                                                                                                        }
                                                                                                        onChange={(e) =>
                                                                                                            setSuggestDraft((d) => ({
                                                                                                                ...d,
                                                                                                                [`personas.${p.id}.summary`]: e.target.value,
                                                                                                            }))
                                                                                                        }
                                                                                                        className={editInput("border-brand")}
                                                                                                    />
                                                                                                </div>
                                                                                            ) : isLocked ? (
                                                                                                <>
                                                                                                    <p
                                                                                                        className={cx(
                                                                                                            "text-md font-semibold",
                                                                                                            filled(p.name)
                                                                                                                ? "text-primary"
                                                                                                                : "text-quaternary italic",
                                                                                                        )}
                                                                                                    >
                                                                                                        {filled(p.name) ? p.name : "Persona name"}
                                                                                                    </p>
                                                                                                    <p
                                                                                                        className={cx(
                                                                                                            "mt-0.5 text-sm",
                                                                                                            filled(p.summary)
                                                                                                                ? "text-tertiary"
                                                                                                                : "text-quaternary italic",
                                                                                                        )}
                                                                                                    >
                                                                                                        {filled(p.summary)
                                                                                                            ? p.summary
                                                                                                            : "One-line summary of who they are"}
                                                                                                    </p>
                                                                                                </>
                                                                                            ) : (
                                                                                                <div className="flex flex-col gap-1.5">
                                                                                                    <input
                                                                                                        placeholder="Persona name"
                                                                                                        value={p.name}
                                                                                                        onChange={(e) =>
                                                                                                            patchPersona(p.id, { name: e.target.value })
                                                                                                        }
                                                                                                        className={editInput("font-semibold")}
                                                                                                    />
                                                                                                    <input
                                                                                                        placeholder="One-line summary of who they are"
                                                                                                        value={p.summary}
                                                                                                        onChange={(e) =>
                                                                                                            patchPersona(p.id, { summary: e.target.value })
                                                                                                        }
                                                                                                        className={editInput()}
                                                                                                    />
                                                                                                </div>
                                                                                            )}
                                                                                            <SuggestionBox sKey={`personas.${p.id}.name`} liveValue={p.name} />
                                                                                            <SuggestionBox
                                                                                                sKey={`personas.${p.id}.summary`}
                                                                                                liveValue={p.summary}
                                                                                            />
                                                                                        </div>
                                                                                        <div className="flex shrink-0 items-center gap-1.5">
                                                                                            {isLocked ? (
                                                                                                filled(p.rank) && (
                                                                                                    <Badge
                                                                                                        color={
                                                                                                            p.rank.trim().toLowerCase() === "primary"
                                                                                                                ? "brand"
                                                                                                                : "gray"
                                                                                                        }
                                                                                                        size="sm"
                                                                                                        type="pill-color"
                                                                                                    >
                                                                                                        {p.rank}
                                                                                                    </Badge>
                                                                                                )
                                                                                            ) : (
                                                                                                <>
                                                                                                    <input
                                                                                                        placeholder="Primary"
                                                                                                        value={p.rank}
                                                                                                        onChange={(e) =>
                                                                                                            patchPersona(p.id, { rank: e.target.value })
                                                                                                        }
                                                                                                        className={editInput("w-28 text-center")}
                                                                                                    />
                                                                                                    <button
                                                                                                        type="button"
                                                                                                        title={`Remove ${p.name.trim() || "persona"}`}
                                                                                                        onClick={() =>
                                                                                                            patchFoundation({
                                                                                                                personas: foundation.personas.filter(
                                                                                                                    (x) => x.id !== p.id,
                                                                                                                ),
                                                                                                            })
                                                                                                        }
                                                                                                        className="flex size-7 items-center justify-center rounded-lg text-fg-quaternary transition duration-100 ease-linear hover:bg-secondary hover:text-error-primary"
                                                                                                    >
                                                                                                        <Trash01 className="size-3.5" aria-hidden="true" />
                                                                                                    </button>
                                                                                                </>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>

                                                                                    <div className="px-4 py-4">
                                                                                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                                                                            <DocStat
                                                                                                label="Age"
                                                                                                value={p.age}
                                                                                                isLocked={isLocked}
                                                                                                sKey={`personas.${p.id}.age`}
                                                                                                onChange={(v) => patchPersona(p.id, { age: v })}
                                                                                            />
                                                                                            <DocStat
                                                                                                label="Relationship status"
                                                                                                value={p.relationship}
                                                                                                isLocked={isLocked}
                                                                                                sKey={`personas.${p.id}.relationship`}
                                                                                                onChange={(v) => patchPersona(p.id, { relationship: v })}
                                                                                            />
                                                                                            <DocStat
                                                                                                label="Location"
                                                                                                value={p.location}
                                                                                                isLocked={isLocked}
                                                                                                sKey={`personas.${p.id}.location`}
                                                                                                onChange={(v) => patchPersona(p.id, { location: v })}
                                                                                            />
                                                                                        </div>

                                                                                        <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
                                                                                            <DocField
                                                                                                isLocked={isLocked}
                                                                                                rows={2}
                                                                                                label="Interests"
                                                                                                value={p.interests}
                                                                                                placeholder="What they follow, buy and care about"
                                                                                                sKey={`personas.${p.id}.interests`}
                                                                                                onChange={(v) => patchPersona(p.id, { interests: v })}
                                                                                            />
                                                                                            <DocField
                                                                                                isLocked={isLocked}
                                                                                                rows={2}
                                                                                                label="Pain points"
                                                                                                value={p.painPoints}
                                                                                                placeholder="What makes travel hard for them today"
                                                                                                sKey={`personas.${p.id}.painPoints`}
                                                                                                onChange={(v) => patchPersona(p.id, { painPoints: v })}
                                                                                            />
                                                                                            <DocField
                                                                                                className="sm:col-span-2"
                                                                                                isLocked={isLocked}
                                                                                                rows={2}
                                                                                                label="What they're seeking"
                                                                                                value={p.seeking}
                                                                                                placeholder="The stay they are actually shopping for"
                                                                                                sKey={`personas.${p.id}.seeking`}
                                                                                                onChange={(v) => patchPersona(p.id, { seeking: v })}
                                                                                            />
                                                                                            <DocField
                                                                                                className="sm:col-span-2"
                                                                                                isLocked={isLocked}
                                                                                                rows={2}
                                                                                                label="How they book"
                                                                                                value={p.howTheyBook}
                                                                                                placeholder="Where they discover, how far ahead, what tips the decision"
                                                                                                sKey={`personas.${p.id}.howTheyBook`}
                                                                                                onChange={(v) => patchPersona(p.id, { howTheyBook: v })}
                                                                                            />
                                                                                        </div>

                                                                                        {/* Keywords — the search terms this persona actually types. */}
                                                                                        <div className="mt-4">
                                                                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                                                                <p className="text-sm font-medium text-secondary">Keywords</p>
                                                                                                <span className="text-xs text-quaternary">
                                                                                                    Search terms this persona uses
                                                                                                </span>
                                                                                            </div>
                                                                                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                                                                                {p.keywords.length === 0 && isLocked && (
                                                                                                    <span className="text-sm text-quaternary italic">
                                                                                                        None yet.
                                                                                                    </span>
                                                                                                )}
                                                                                                {p.keywords.map((k, ki) =>
                                                                                                    isLocked ? (
                                                                                                        filled(k) && (
                                                                                                            <span
                                                                                                                key={ki}
                                                                                                                className="rounded-full px-3 py-1 text-sm text-tertiary ring-1 ring-secondary"
                                                                                                            >
                                                                                                                {k}
                                                                                                            </span>
                                                                                                        )
                                                                                                    ) : (
                                                                                                        <span
                                                                                                            key={ki}
                                                                                                            className="flex items-center gap-1 rounded-full py-0.5 pr-1 pl-2 ring-1 ring-secondary"
                                                                                                        >
                                                                                                            <input
                                                                                                                placeholder="keyword"
                                                                                                                value={k}
                                                                                                                onChange={(e) =>
                                                                                                                    patchPersona(p.id, {
                                                                                                                        keywords: p.keywords.map((x, j) =>
                                                                                                                            j === ki ? e.target.value : x,
                                                                                                                        ),
                                                                                                                    })
                                                                                                                }
                                                                                                                className="w-28 border-0 bg-transparent p-0 text-sm text-primary outline-none placeholder:text-placeholder"
                                                                                                            />
                                                                                                            <button
                                                                                                                type="button"
                                                                                                                title="Remove keyword"
                                                                                                                onClick={() =>
                                                                                                                    patchPersona(p.id, {
                                                                                                                        keywords: p.keywords.filter(
                                                                                                                            (_, j) => j !== ki,
                                                                                                                        ),
                                                                                                                    })
                                                                                                                }
                                                                                                                className="flex size-5 items-center justify-center rounded-full text-fg-quaternary transition duration-100 ease-linear hover:bg-secondary hover:text-error-primary"
                                                                                                            >
                                                                                                                <XClose className="size-3" aria-hidden="true" />
                                                                                                            </button>
                                                                                                        </span>
                                                                                                    ),
                                                                                                )}
                                                                                                {!isLocked && (
                                                                                                    <button
                                                                                                        type="button"
                                                                                                        onClick={() =>
                                                                                                            patchPersona(p.id, {
                                                                                                                keywords: [...p.keywords, ""],
                                                                                                            })
                                                                                                        }
                                                                                                        className="text-sm font-semibold text-brand-secondary transition duration-100 ease-linear hover:underline"
                                                                                                    >
                                                                                                        + Add
                                                                                                    </button>
                                                                                                )}
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>

                                                                        {/* The paragraph an AM reads out when presenting the personas back. */}
                                                                        <div className="mt-5 border-l-2 border-brand pl-4">
                                                                            <DocField
                                                                                isLocked={isLocked}
                                                                                rows={2}
                                                                                label="Why the brand resonates with this audience"
                                                                                value={foundation.personaResonance}
                                                                                placeholder="The tension these personas share, and how the brand resolves it."
                                                                                sKey="personaResonance"
                                                                                onChange={(v) => patchFoundation({ personaResonance: v })}
                                                                            />
                                                                        </div>
                                                                    </DocSection>

                                                                    {/* ── 8. Focus properties ── */}
                                                                    <DocSection
                                                                        id="focus"
                                                                        label="Focus properties"
                                                                        badge={isTeam ? <SourceBadge>From client's website</SourceBadge> : undefined}
                                                                        action={
                                                                            !isLocked && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() =>
                                                                                        patchFoundation({
                                                                                            focusProperties: [
                                                                                                ...foundation.focusProperties,
                                                                                                emptyFocusProperty(),
                                                                                            ],
                                                                                        })
                                                                                    }
                                                                                    className="text-sm font-semibold text-brand-secondary transition duration-100 ease-linear hover:underline"
                                                                                >
                                                                                    + Add focus property
                                                                                </button>
                                                                            )
                                                                        }
                                                                    >
                                                                        <div className="flex flex-col gap-4">
                                                                            {foundation.focusProperties.length === 0 && (
                                                                                <p className="rounded-xl border border-dashed border-secondary px-4 py-3 text-sm text-quaternary italic">
                                                                                    No focus properties yet.
                                                                                </p>
                                                                            )}
                                                                            {foundation.focusProperties.map((p, i) => (
                                                                                <div
                                                                                    key={p.id}
                                                                                    className="overflow-hidden rounded-2xl bg-primary ring-1 ring-secondary"
                                                                                >
                                                                                    <div className="bg-secondary_subtle flex items-center gap-3 border-b border-secondary px-4 py-3">
                                                                                        <span className="font-mono text-xs text-quaternary tabular-nums">
                                                                                            {String(i + 1).padStart(2, "0")}
                                                                                        </span>
                                                                                        {suggestMode ? (
                                                                                            <div className="min-w-0 flex-1">
                                                                                                <input
                                                                                                    placeholder="Property name"
                                                                                                    value={
                                                                                                        suggestDraft[`focusProperties.${p.id}.name`] ?? p.name
                                                                                                    }
                                                                                                    onChange={(e) =>
                                                                                                        setSuggestDraft((d) => ({
                                                                                                            ...d,
                                                                                                            [`focusProperties.${p.id}.name`]: e.target.value,
                                                                                                        }))
                                                                                                    }
                                                                                                    className={editInput("border-brand font-semibold")}
                                                                                                />
                                                                                                <SuggestionBox
                                                                                                    sKey={`focusProperties.${p.id}.name`}
                                                                                                    liveValue={p.name}
                                                                                                />
                                                                                            </div>
                                                                                        ) : isLocked ? (
                                                                                            <div className="min-w-0 flex-1">
                                                                                                <p
                                                                                                    className={cx(
                                                                                                        "text-md font-semibold",
                                                                                                        filled(p.name)
                                                                                                            ? "text-primary"
                                                                                                            : "text-quaternary italic",
                                                                                                    )}
                                                                                                >
                                                                                                    {filled(p.name) ? p.name : "Property name"}
                                                                                                </p>
                                                                                                <SuggestionBox
                                                                                                    sKey={`focusProperties.${p.id}.name`}
                                                                                                    liveValue={p.name}
                                                                                                />
                                                                                            </div>
                                                                                        ) : (
                                                                                            <>
                                                                                                <input
                                                                                                    placeholder="Property name"
                                                                                                    value={p.name}
                                                                                                    onChange={(e) => patchFocus(p.id, { name: e.target.value })}
                                                                                                    className={editInput("font-semibold")}
                                                                                                />
                                                                                                <button
                                                                                                    type="button"
                                                                                                    title={`Remove ${p.name.trim() || "property"}`}
                                                                                                    onClick={() =>
                                                                                                        patchFoundation({
                                                                                                            focusProperties: foundation.focusProperties.filter(
                                                                                                                (x) => x.id !== p.id,
                                                                                                            ),
                                                                                                        })
                                                                                                    }
                                                                                                    className="flex size-7 shrink-0 items-center justify-center rounded-lg text-fg-quaternary transition duration-100 ease-linear hover:bg-secondary hover:text-error-primary"
                                                                                                >
                                                                                                    <Trash01 className="size-3.5" aria-hidden="true" />
                                                                                                </button>
                                                                                            </>
                                                                                        )}
                                                                                    </div>

                                                                                    <div className="px-4 py-4">
                                                                                        <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
                                                                                            <DocField
                                                                                                isLocked={isLocked}
                                                                                                label="Link to property listing"
                                                                                                value={p.link}
                                                                                                placeholder="https://"
                                                                                                sKey={`focusProperties.${p.id}.link`}
                                                                                                onChange={(v) => patchFocus(p.id, { link: v })}
                                                                                            />
                                                                                            <DocField
                                                                                                isLocked={isLocked}
                                                                                                label="Location"
                                                                                                value={p.location}
                                                                                                placeholder="Where this one sits"
                                                                                                sKey={`focusProperties.${p.id}.location`}
                                                                                                onChange={(v) => patchFocus(p.id, { location: v })}
                                                                                            />
                                                                                        </div>

                                                                                        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                                                                                            <DocStat
                                                                                                label="Guests"
                                                                                                value={p.guests}
                                                                                                isLocked={isLocked}
                                                                                                sKey={`focusProperties.${p.id}.guests`}
                                                                                                onChange={(v) => patchFocus(p.id, { guests: v })}
                                                                                            />
                                                                                            <DocStat
                                                                                                label="Bedrooms"
                                                                                                value={p.bedrooms}
                                                                                                isLocked={isLocked}
                                                                                                sKey={`focusProperties.${p.id}.bedrooms`}
                                                                                                onChange={(v) => patchFocus(p.id, { bedrooms: v })}
                                                                                            />
                                                                                            <DocStat
                                                                                                label="Beds"
                                                                                                value={p.beds}
                                                                                                isLocked={isLocked}
                                                                                                sKey={`focusProperties.${p.id}.beds`}
                                                                                                onChange={(v) => patchFocus(p.id, { beds: v })}
                                                                                            />
                                                                                            <DocStat
                                                                                                label="Bathrooms"
                                                                                                value={p.bathrooms}
                                                                                                isLocked={isLocked}
                                                                                                sKey={`focusProperties.${p.id}.bathrooms`}
                                                                                                onChange={(v) => patchFocus(p.id, { bathrooms: v })}
                                                                                            />
                                                                                        </div>

                                                                                        <DocField
                                                                                            className="mt-4"
                                                                                            isLocked={isLocked}
                                                                                            rows={3}
                                                                                            label="Listing description"
                                                                                            value={p.description}
                                                                                            placeholder="Paste the live listing copy."
                                                                                            sKey={`focusProperties.${p.id}.description`}
                                                                                            onChange={(v) => patchFocus(p.id, { description: v })}
                                                                                        />

                                                                                        <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
                                                                                            <DocField
                                                                                                isLocked={isLocked}
                                                                                                rows={2}
                                                                                                label="Features & amenities"
                                                                                                value={p.features}
                                                                                                placeholder="What sets this property apart"
                                                                                                sKey={`focusProperties.${p.id}.features`}
                                                                                                onChange={(v) => patchFocus(p.id, { features: v })}
                                                                                            />
                                                                                            <DocField
                                                                                                isLocked={isLocked}
                                                                                                rows={2}
                                                                                                label="Terms & rules"
                                                                                                value={p.terms}
                                                                                                placeholder="Check-in, pets, quiet hours"
                                                                                                sKey={`focusProperties.${p.id}.terms`}
                                                                                                onChange={(v) => patchFocus(p.id, { terms: v })}
                                                                                            />
                                                                                        </div>

                                                                                        {/* Top reviews — trend evidence, not testimonials. */}
                                                                                        <div className="mt-4">
                                                                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                                                                <p className="text-sm font-medium text-secondary">
                                                                                                    Top reviews
                                                                                                </p>
                                                                                                <span className="text-xs text-quaternary">
                                                                                                    3–5, look for trends
                                                                                                </span>
                                                                                            </div>
                                                                                            <div className="mt-2 flex flex-col gap-2">
                                                                                                {p.reviews.map((r, ri) => (
                                                                                                    <div
                                                                                                        key={ri}
                                                                                                        className="flex items-start gap-2 rounded-xl px-3 py-2 ring-1 ring-secondary"
                                                                                                    >
                                                                                                        <span
                                                                                                            className="font-mono text-md leading-none text-quaternary"
                                                                                                            aria-hidden="true"
                                                                                                        >
                                                                                                            &ldquo;
                                                                                                        </span>
                                                                                                        {isLocked ? (
                                                                                                            <span
                                                                                                                className={cx(
                                                                                                                    "text-sm",
                                                                                                                    filled(r)
                                                                                                                        ? "text-tertiary"
                                                                                                                        : "text-quaternary italic",
                                                                                                                )}
                                                                                                            >
                                                                                                                {filled(r)
                                                                                                                    ? r
                                                                                                                    : "Paste review, note the trend it supports"}
                                                                                                            </span>
                                                                                                        ) : (
                                                                                                            <>
                                                                                                                <textarea
                                                                                                                    rows={1}
                                                                                                                    placeholder="Paste review, note the trend it supports"
                                                                                                                    value={r}
                                                                                                                    onChange={(e) =>
                                                                                                                        patchFocus(p.id, {
                                                                                                                            reviews: p.reviews.map((x, j) =>
                                                                                                                                j === ri ? e.target.value : x,
                                                                                                                            ),
                                                                                                                        })
                                                                                                                    }
                                                                                                                    className="w-full resize-y border-0 bg-transparent p-0 text-sm text-primary outline-none placeholder:text-placeholder"
                                                                                                                />
                                                                                                                <button
                                                                                                                    type="button"
                                                                                                                    title="Remove review"
                                                                                                                    onClick={() =>
                                                                                                                        patchFocus(p.id, {
                                                                                                                            reviews: p.reviews.filter(
                                                                                                                                (_, j) => j !== ri,
                                                                                                                            ),
                                                                                                                        })
                                                                                                                    }
                                                                                                                    className="flex size-5 shrink-0 items-center justify-center rounded-full text-fg-quaternary transition duration-100 ease-linear hover:bg-secondary hover:text-error-primary"
                                                                                                                >
                                                                                                                    <XClose
                                                                                                                        className="size-3"
                                                                                                                        aria-hidden="true"
                                                                                                                    />
                                                                                                                </button>
                                                                                                            </>
                                                                                                        )}
                                                                                                    </div>
                                                                                                ))}
                                                                                                {!isLocked && (
                                                                                                    <button
                                                                                                        type="button"
                                                                                                        onClick={() =>
                                                                                                            patchFocus(p.id, { reviews: [...p.reviews, ""] })
                                                                                                        }
                                                                                                        className="self-start text-sm font-semibold text-brand-secondary transition duration-100 ease-linear hover:underline"
                                                                                                    >
                                                                                                        + Add review
                                                                                                    </button>
                                                                                                )}
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </DocSection>

                                                                    {/* ── 9. Local favorites ── */}
                                                                    <DocSection
                                                                        id="favorites"
                                                                        label="Local favorites"
                                                                        badge={isTeam ? <SourceBadge>From onboarding form</SourceBadge> : undefined}
                                                                    >
                                                                        <div className="flex flex-col gap-6">
                                                                            <FavoriteTable
                                                                                title="Restaurants"
                                                                                note="Name + website address"
                                                                                rows={foundation.restaurants}
                                                                                isLocked={isLocked}
                                                                                sKeyBase="restaurants"
                                                                                onChange={patchFavorite("restaurants")}
                                                                                onAdd={addFavorite("restaurants")}
                                                                                onRemove={removeFavorite("restaurants")}
                                                                            />
                                                                            <FavoriteTable
                                                                                title="Activities / attractions"
                                                                                note="Name + website address"
                                                                                rows={foundation.activities}
                                                                                isLocked={isLocked}
                                                                                sKeyBase="activities"
                                                                                onChange={patchFavorite("activities")}
                                                                                onAdd={addFavorite("activities")}
                                                                                onRemove={removeFavorite("activities")}
                                                                            />
                                                                        </div>
                                                                    </DocSection>

                                                                    {/* ── 10. Reviews ── */}
                                                                    <DocSection
                                                                        id="reviews"
                                                                        label="Reviews"
                                                                        badge={isTeam ? <SourceBadge>From guest reviews</SourceBadge> : undefined}
                                                                    >
                                                                        {/* The team's line is an instruction — it tells an AM what to go and do,
                                                                            and the Paste guest reviews box below acts on it. A client reading that
                                                                            is being handed someone else's to-do list, so they get the finding
                                                                            instead: the work is done, and this is what it turned up. */}
                                                                        <p className="text-md text-tertiary">
                                                                            {isTeam
                                                                                ? "Pull guest reviews and analyze them to identify recurring themes in what guests love about their stays. The goal is to gain deeper insights into the brand's strengths and use these findings to inform and enhance future marketing efforts."
                                                                                : "We read through your guest reviews to understand what people love most about staying with you. These are the strengths that came up again and again — the details guests single out, and the way a stay makes them feel — and they shape how we market you."}
                                                                        </p>

                                                                        <DocField
                                                                            className="mt-4"
                                                                            isLocked={isLocked}
                                                                            rows={3}
                                                                            label="Core brand pillars & key selling points"
                                                                            value={foundation.corePillars}
                                                                            placeholder="Top 5–7 praised amenities, features or design elements."
                                                                            sKey="corePillars"
                                                                            onChange={(v) => patchFoundation({ corePillars: v })}
                                                                        />
                                                                        <DocField
                                                                            className="mt-4"
                                                                            isLocked={isLocked}
                                                                            rows={3}
                                                                            label="Emotional & experiential themes"
                                                                            value={foundation.emotionalThemes}
                                                                            placeholder="Top 5–7 themes, plus the taglines they suggest."
                                                                            sKey="emotionalThemes"
                                                                            onChange={(v) => patchFoundation({ emotionalThemes: v })}
                                                                        />

                                                                        {/* Paste the reviews and the Draft button fills the two fields above, which
                                                                        replaces the copy-into-ChatGPT-and-paste-back round trip the working
                                                                        prompt below describes. Team only, and deliberately not persisted: the
                                                                        raw reviews are somebody else's copy, and the useful distillation of
                                                                        them is the two fields. Airbnb is not fetched for these — it serves
                                                                        bot-protection to datacenter IPs, so pasting is the reliable route. */}
                                                                        {isTeam && !isTemplate && !isLocked && (
                                                                            <div className="mt-5 rounded-2xl bg-primary p-4 ring-1 ring-secondary">
                                                                                <label htmlFor="reviews-paste" className="text-sm font-medium text-secondary">
                                                                                    Paste guest reviews
                                                                                </label>
                                                                                <p className="mt-1 text-xs text-tertiary">
                                                                                    30 or more works best. Drafting reads these to fill both fields above —
                                                                                    their Airbnb profile link is in the onboarding form.
                                                                                </p>
                                                                                <textarea
                                                                                    id="reviews-paste"
                                                                                    rows={4}
                                                                                    value={reviewsPaste}
                                                                                    onChange={(e) => setReviewsPaste(e.target.value)}
                                                                                    placeholder="Paste the review text here — one after another is fine."
                                                                                    className={cx(editInput(), "mt-2.5 resize-y font-mono text-[12px]")}
                                                                                />
                                                                                {reviewsPaste.trim() && (
                                                                                    <p className="mt-1.5 text-xs text-quaternary tabular-nums">
                                                                                        {reviewsPaste.trim().length.toLocaleString()} characters pasted — not
                                                                                        saved, only used for drafting.
                                                                                    </p>
                                                                                )}
                                                                            </div>
                                                                        )}

                                                                        {/* The working prompt is internal process, not something a client should be
                                                                        handed — it tells whoever reads it to go and run the analysis. Team only. */}
                                                                        {isTeam && (
                                                                            <div className="mt-5 overflow-hidden rounded-2xl bg-primary ring-1 ring-secondary">
                                                                                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-secondary px-4 py-3">
                                                                                    <div className="flex flex-wrap items-center gap-2.5">
                                                                                        <p className="font-mono text-[11px] font-semibold tracking-[0.08em] text-quaternary uppercase">
                                                                                            Working prompt
                                                                                        </p>
                                                                                        <BadgeWithDot color="warning" size="sm" type="pill-color">
                                                                                            Delete once filled
                                                                                        </BadgeWithDot>
                                                                                    </div>
                                                                                    <div className="flex items-center gap-3">
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => {
                                                                                                void navigator.clipboard
                                                                                                    .writeText(REVIEW_WORKING_PROMPT)
                                                                                                    .then(() => {
                                                                                                        setPromptCopied(true);
                                                                                                        window.setTimeout(() => setPromptCopied(false), 1600);
                                                                                                    });
                                                                                            }}
                                                                                            className="text-sm font-semibold text-brand-secondary transition duration-100 ease-linear hover:underline"
                                                                                        >
                                                                                            {promptCopied ? "Copied" : "Copy"}
                                                                                        </button>
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() =>
                                                                                                patchFoundation({ promptHidden: !foundation.promptHidden })
                                                                                            }
                                                                                            className="text-sm font-semibold text-tertiary transition duration-100 ease-linear hover:text-secondary"
                                                                                        >
                                                                                            {foundation.promptHidden ? "Show" : "Hide"}
                                                                                        </button>
                                                                                    </div>
                                                                                </div>
                                                                                {!foundation.promptHidden && (
                                                                                    <div className="px-4 py-4">
                                                                                        <pre className="font-mono text-xs leading-relaxed whitespace-pre-wrap text-secondary">
                                                                                            {REVIEW_WORKING_PROMPT}
                                                                                        </pre>
                                                                                        <p className="mt-3 text-xs text-quaternary">
                                                                                            Once complete, replace the two fields above with the insight from
                                                                                            ChatGPT / Gemini.
                                                                                        </p>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </DocSection>

                                                                    {/* ── 11. Website links ── */}
                                                                    <DocSection
                                                                        id="links"
                                                                        label="Website links"
                                                                        badge={isTeam ? <SourceBadge>From website sitemap</SourceBadge> : undefined}
                                                                        action={
                                                                            <a
                                                                                href="https://www.xml-sitemaps.com"
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                className="text-sm font-semibold text-brand-secondary transition duration-100 ease-linear hover:underline"
                                                                            >
                                                                                xml-sitemaps.com
                                                                            </a>
                                                                        }
                                                                    >
                                                                        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_auto] items-center gap-3 border-b border-secondary pb-2">
                                                                            <span className="text-xs font-medium text-quaternary">Page</span>
                                                                            <span className="text-xs font-medium text-quaternary">URL</span>
                                                                            <span />
                                                                        </div>
                                                                        {foundation.websiteLinks.length === 0 && (
                                                                            <p className="mt-2 rounded-xl border border-dashed border-secondary px-4 py-3 text-sm text-quaternary italic">
                                                                                No pages listed yet.
                                                                            </p>
                                                                        )}
                                                                        {foundation.websiteLinks.map((l) => (
                                                                            <div
                                                                                key={l.id}
                                                                                className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_auto] items-start gap-3 border-b border-secondary py-2.5"
                                                                            >
                                                                                {suggestMode ? (
                                                                                    <>
                                                                                        <div className="min-w-0">
                                                                                            <input
                                                                                                placeholder="Page name"
                                                                                                value={suggestDraft[`websiteLinks.${l.id}.page`] ?? l.page}
                                                                                                onChange={(e) =>
                                                                                                    setSuggestDraft((d) => ({
                                                                                                        ...d,
                                                                                                        [`websiteLinks.${l.id}.page`]: e.target.value,
                                                                                                    }))
                                                                                                }
                                                                                                className={editInput("border-brand")}
                                                                                            />
                                                                                            <SuggestionBox
                                                                                                sKey={`websiteLinks.${l.id}.page`}
                                                                                                liveValue={l.page}
                                                                                            />
                                                                                        </div>
                                                                                        <div className="min-w-0">
                                                                                            <input
                                                                                                placeholder="https://"
                                                                                                value={suggestDraft[`websiteLinks.${l.id}.url`] ?? l.url}
                                                                                                onChange={(e) =>
                                                                                                    setSuggestDraft((d) => ({
                                                                                                        ...d,
                                                                                                        [`websiteLinks.${l.id}.url`]: e.target.value,
                                                                                                    }))
                                                                                                }
                                                                                                className={editInput("border-brand")}
                                                                                            />
                                                                                            <SuggestionBox
                                                                                                sKey={`websiteLinks.${l.id}.url`}
                                                                                                liveValue={l.url}
                                                                                            />
                                                                                        </div>
                                                                                        <span />
                                                                                    </>
                                                                                ) : isLocked ? (
                                                                                    <>
                                                                                        <div className="min-w-0">
                                                                                            <span
                                                                                                className={cx(
                                                                                                    "block truncate text-md",
                                                                                                    filled(l.page) ? "text-primary" : "text-quaternary italic",
                                                                                                )}
                                                                                            >
                                                                                                {filled(l.page) ? l.page : "Page name"}
                                                                                            </span>
                                                                                            <SuggestionBox
                                                                                                sKey={`websiteLinks.${l.id}.page`}
                                                                                                liveValue={l.page}
                                                                                            />
                                                                                        </div>
                                                                                        <div className="min-w-0">
                                                                                            {filled(l.url) ? (
                                                                                                <a
                                                                                                    href={l.url}
                                                                                                    target="_blank"
                                                                                                    rel="noopener noreferrer"
                                                                                                    className="block truncate text-md text-brand-secondary transition duration-100 ease-linear hover:underline"
                                                                                                >
                                                                                                    {l.url}
                                                                                                </a>
                                                                                            ) : (
                                                                                                <span className="text-md text-quaternary italic">https://</span>
                                                                                            )}
                                                                                            <SuggestionBox
                                                                                                sKey={`websiteLinks.${l.id}.url`}
                                                                                                liveValue={l.url}
                                                                                            />
                                                                                        </div>
                                                                                        <span />
                                                                                    </>
                                                                                ) : (
                                                                                    <>
                                                                                        <div className="min-w-0">
                                                                                            <input
                                                                                                placeholder="Page name"
                                                                                                value={l.page}
                                                                                                onChange={(e) =>
                                                                                                    patchFoundation({
                                                                                                        websiteLinks: foundation.websiteLinks.map((x) =>
                                                                                                            x.id === l.id ? { ...x, page: e.target.value } : x,
                                                                                                        ),
                                                                                                    })
                                                                                                }
                                                                                                className={editInput()}
                                                                                            />
                                                                                            <SuggestionBox
                                                                                                sKey={`websiteLinks.${l.id}.page`}
                                                                                                liveValue={l.page}
                                                                                            />
                                                                                        </div>
                                                                                        <div className="min-w-0">
                                                                                            <input
                                                                                                placeholder="https://"
                                                                                                value={l.url}
                                                                                                onChange={(e) =>
                                                                                                    patchFoundation({
                                                                                                        websiteLinks: foundation.websiteLinks.map((x) =>
                                                                                                            x.id === l.id ? { ...x, url: e.target.value } : x,
                                                                                                        ),
                                                                                                    })
                                                                                                }
                                                                                                className={editInput()}
                                                                                            />
                                                                                            <SuggestionBox
                                                                                                sKey={`websiteLinks.${l.id}.url`}
                                                                                                liveValue={l.url}
                                                                                            />
                                                                                        </div>
                                                                                        <button
                                                                                            type="button"
                                                                                            title={`Remove ${l.page.trim() || "row"}`}
                                                                                            onClick={() =>
                                                                                                patchFoundation({
                                                                                                    websiteLinks: foundation.websiteLinks.filter(
                                                                                                        (x) => x.id !== l.id,
                                                                                                    ),
                                                                                                })
                                                                                            }
                                                                                            className="flex size-7 items-center justify-center rounded-lg text-fg-quaternary transition duration-100 ease-linear hover:bg-secondary hover:text-error-primary"
                                                                                        >
                                                                                            <Trash01 className="size-3.5" aria-hidden="true" />
                                                                                        </button>
                                                                                    </>
                                                                                )}
                                                                            </div>
                                                                        ))}
                                                                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                                                                            <p className="text-xs text-quaternary">
                                                                                Paste the full sitemap export, one row per page.
                                                                            </p>
                                                                            {!isLocked && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() =>
                                                                                        patchFoundation({
                                                                                            websiteLinks: [...foundation.websiteLinks, emptyWebsiteLink()],
                                                                                        })
                                                                                    }
                                                                                    className="text-sm font-semibold text-brand-secondary transition duration-100 ease-linear hover:underline"
                                                                                >
                                                                                    + Add row
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </DocSection>

                                                                    {/* ── Answers from the previous Master Document ──
                                                                    The redesign replaced six free-text fields and the FAQ bank with the
                                                                    eleven sections above. Rows written before it still hold whatever the
                                                                    client typed, and mergeContent keeps saving it, so it is shown here
                                                                    read-only rather than left invisible in the JSON. Team-only: it's
                                                                    migration debris, not part of the document. Disappears by itself once
                                                                    an AM has moved the content up and cleared the old fields. */}
                                                                    {isTeam && (legacyFoundation.length > 0 || legacyFaqs.length > 0) && (
                                                                        <section className="bg-secondary_subtle rounded-2xl p-5 ring-1 ring-secondary">
                                                                            <div className="flex flex-wrap items-center gap-2.5">
                                                                                <p className="font-mono text-[11px] font-semibold tracking-[0.08em] text-quaternary uppercase">
                                                                                    Earlier Master Document
                                                                                </p>
                                                                                <BadgeWithDot color="gray" size="sm" type="pill-color">
                                                                                    Team only
                                                                                </BadgeWithDot>
                                                                            </div>
                                                                            <p className="mt-2 text-sm text-tertiary">
                                                                                Answers this client gave against the previous version of this page. Move
                                                                                anything worth keeping into the sections above — nothing here feeds the exports
                                                                                or the chat widget.
                                                                            </p>
                                                                            <div className="mt-4 flex flex-col gap-4">
                                                                                {legacyFoundation.map((f) => (
                                                                                    <div key={f.key}>
                                                                                        <p className="text-sm font-medium text-secondary">{f.label}</p>
                                                                                        <p className="mt-1 text-md whitespace-pre-wrap text-tertiary">
                                                                                            {f.value}
                                                                                        </p>
                                                                                    </div>
                                                                                ))}
                                                                                {legacyFaqs.length > 0 && (
                                                                                    <div>
                                                                                        <p className="text-sm font-medium text-secondary">
                                                                                            FAQ bank ({legacyFaqs.length})
                                                                                        </p>
                                                                                        <div className="mt-2 flex flex-col gap-2">
                                                                                            {legacyFaqs.map((q) => (
                                                                                                <div key={q.id}>
                                                                                                    <p className="text-sm font-semibold text-primary">
                                                                                                        {q.question.trim() || "Untitled question"}
                                                                                                    </p>
                                                                                                    <p className="text-sm whitespace-pre-wrap text-tertiary">
                                                                                                        {q.answer.trim() || "No answer given."}
                                                                                                    </p>
                                                                                                </div>
                                                                                            ))}
                                                                                        </div>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </section>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Sticky bar — the send controls, and the outcome of a send.
                                                                It reports success and failure IN PLACE: the button is pinned to the
                                                                bottom of the viewport, so a message rendered up beside the section
                                                                heading is off-screen exactly when it's needed, and a failed send
                                                                looks like nothing happened. */}
                                                            {(suggestMode || sendState === "sent" || sendState === "error") && (
                                                                <div className="fixed bottom-5 left-1/2 z-40 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-2xl bg-primary px-4 py-3 shadow-lg ring-1 ring-secondary">
                                                                    {sendState === "sent" ? (
                                                                        <p className="flex items-center gap-1.5 text-sm font-medium text-success-primary">
                                                                            <Check className="size-4 shrink-0" aria-hidden="true" />
                                                                            Sent! Your account manager will review your suggestions.
                                                                        </p>
                                                                    ) : (
                                                                        <>
                                                                            <p
                                                                                className={cx(
                                                                                    "min-w-0 text-sm tabular-nums",
                                                                                    sendState === "error" ? "text-error-primary" : "text-tertiary",
                                                                                )}
                                                                                role={sendState === "error" ? "alert" : undefined}
                                                                            >
                                                                                {sendState === "error"
                                                                                    ? sendError || "Nothing was sent — please try again."
                                                                                    : suggestDraftCount === 0
                                                                                      ? "No changes yet — type into any field"
                                                                                      : `${suggestDraftCount} change${suggestDraftCount === 1 ? "" : "s"}`}
                                                                            </p>
                                                                            {/* Buttons share one non-shrinking row: letting them wrap put Cancel
                                                                                on a second line, which read as a broken bar. */}
                                                                            <div className="flex shrink-0 items-center gap-2">
                                                                                <Button
                                                                                    size="sm"
                                                                                    color="primary"
                                                                                    isDisabled={suggestDraftCount === 0}
                                                                                    isLoading={sendState === "sending"}
                                                                                    showTextWhileLoading
                                                                                    onClick={() => void submitSuggestions()}
                                                                                >
                                                                                    {sendState === "error"
                                                                                        ? "Try again"
                                                                                        : `Send suggestion${suggestDraftCount === 1 ? "" : "s"}`}
                                                                                </Button>
                                                                                <Button
                                                                                    size="sm"
                                                                                    color="secondary"
                                                                                    onClick={() => {
                                                                                        setSuggestMode(false);
                                                                                        setSuggestDraft({});
                                                                                        setSendState("idle");
                                                                                        setSendError("");
                                                                                    }}
                                                                                >
                                                                                    Cancel
                                                                                </Button>
                                                                            </div>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </Reveal>
                                                    </SuggestionContext.Provider>
                                                )}

                                                {/* ── Brand Kit ── */}
                                                {activeSection === "brand" && (
                                                    <Reveal>
                                                        <SectionEyebrow section={activeSection} />
                                                        <div className="flex flex-wrap items-end justify-between gap-3">
                                                            <SectionHeading>Brand Kit</SectionHeading>
                                                            {isLocked ? (
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    {/* The kit as one stylesheet — hexes, shade scales, fonts and the
                                                                        type scale as CSS variables. A brand kit you can only look at
                                                                        gets retyped, and retyped hexes drift. */}
                                                                    {kitHasContent && !kitOnTheWay && (
                                                                        <>
                                                                            <Button size="sm" color="secondary" iconLeading={Copy01} onClick={copyBrandKitCss}>
                                                                                {copiedHex === "css" ? "Copied!" : "Copy CSS"}
                                                                            </Button>
                                                                            <Button
                                                                                size="sm"
                                                                                color="secondary"
                                                                                iconLeading={Download01}
                                                                                onClick={downloadBrandKitCss}
                                                                            >
                                                                                Download .css
                                                                            </Button>
                                                                        </>
                                                                    )}
                                                                    {content.brand.folder_link && (
                                                                        <Button
                                                                            href={content.brand.folder_link}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            color="link-color"
                                                                            size="md"
                                                                            iconTrailing={LinkExternal01}
                                                                        >
                                                                            Open brand folder
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <input
                                                                    type="text"
                                                                    placeholder="Brand folder link (Drive / Canva)"
                                                                    value={content.brand.folder_link}
                                                                    onChange={(e) => patchBrand({ folder_link: e.target.value })}
                                                                    className={editInput("max-w-80")}
                                                                />
                                                            )}
                                                        </div>
                                                        <p className="mt-3 text-md text-tertiary">
                                                            Your official colors, typography and logo files. Use these everywhere — website, emails, social — so
                                                            your brand stays consistent.
                                                        </p>

                                                        {/* Nothing built yet: say so, instead of presenting the template purples
                                                            as the client's colours. Same tile the Instagram section uses. */}
                                                        {kitOnTheWay && (
                                                            <div className="mt-6 flex items-center gap-3 rounded-xl bg-secondary px-4 py-5">
                                                                <Palette className="size-5 shrink-0 text-fg-quaternary" aria-hidden="true" />
                                                                <p className="text-sm text-tertiary">
                                                                    Your brand kit is on the way — the HiddenGem team will add your colours, fonts and logo
                                                                    files here once your Master Brand is in place.
                                                                </p>
                                                            </div>
                                                        )}

                                                        {/* Team-only: draft the kit from the client's live site and/or the brand
                                                            guidelines PDF they sent, then review. The PDF wins where both are
                                                            given — a guidelines doc names its own primary. */}
                                                        {isTeam && !isLocked && (
                                                            <div className="mt-4">
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <input
                                                                        type="url"
                                                                        placeholder={clientWebsite.trim() || "clientwebsite.com"}
                                                                        value={brandKitUrl}
                                                                        onChange={(e) => setBrandKitUrl(e.target.value)}
                                                                        onKeyDown={(e) => e.key === "Enter" && !brandKitBusy && void generateBrandKit()}
                                                                        className={editInput("max-w-72")}
                                                                    />
                                                                    {brandKitPdf ? (
                                                                        <span className="inline-flex max-w-72 items-center gap-2 rounded-lg border border-secondary px-2.5 py-1.5 text-sm text-secondary">
                                                                            <FileCheck02 className="size-4 shrink-0 text-fg-quaternary" aria-hidden="true" />
                                                                            <span className="truncate">{brandKitPdf.name}</span>
                                                                            <button
                                                                                type="button"
                                                                                onClick={clearBrandKitPdf}
                                                                                aria-label={`Remove ${brandKitPdf.name}`}
                                                                                className="shrink-0 cursor-pointer text-fg-quaternary transition duration-100 ease-linear hover:text-fg-secondary"
                                                                            >
                                                                                <XClose className="size-3.5" aria-hidden="true" />
                                                                            </button>
                                                                        </span>
                                                                    ) : (
                                                                        <label
                                                                            className={cx(
                                                                                "inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-secondary px-2.5 py-1.5 text-sm font-medium text-tertiary transition duration-100 ease-linear hover:border-brand hover:text-brand-secondary",
                                                                                brandKitPdfBusy && "cursor-not-allowed opacity-50",
                                                                            )}
                                                                        >
                                                                            <input
                                                                                type="file"
                                                                                accept="application/pdf,.pdf"
                                                                                disabled={brandKitPdfBusy}
                                                                                className="hidden"
                                                                                onChange={(e) => void onPickBrandKitPdf(e)}
                                                                            />
                                                                            <UploadCloud02 className="size-4" aria-hidden="true" />
                                                                            {brandKitPdfBusy ? "Uploading…" : "Brand guidelines PDF"}
                                                                        </label>
                                                                    )}
                                                                    <Button
                                                                        size="sm"
                                                                        color="secondary"
                                                                        iconLeading={Stars02}
                                                                        isLoading={brandKitBusy}
                                                                        isDisabled={brandKitPdfBusy}
                                                                        showTextWhileLoading
                                                                        onClick={() => void generateBrandKit()}
                                                                    >
                                                                        {brandKitBusy
                                                                            ? brandKitPdf
                                                                                ? "Reading the PDF… up to 2 min"
                                                                                : "Reading the site…"
                                                                            : "Generate brand kit"}
                                                                    </Button>
                                                                </div>
                                                                {brandKitMsg && (
                                                                    <p
                                                                        className={cx(
                                                                            "mt-2 text-sm",
                                                                            brandKitMsg.kind === "ok" ? "text-success-primary" : "text-error-primary",
                                                                        )}
                                                                        role={brandKitMsg.kind === "err" ? "alert" : "status"}
                                                                    >
                                                                        {brandKitMsg.text}
                                                                    </p>
                                                                )}
                                                                {brandKitDraft && (
                                                                    <BrandKitDraftReview
                                                                        draft={brandKitDraft}
                                                                        canAdd={!isTemplatePalette(content.brand.colors)}
                                                                        onReplace={() => applyBrandKitDraft("replace")}
                                                                        onAdd={() => applyBrandKitDraft("add")}
                                                                        onDiscard={() => setBrandKitDraft(null)}
                                                                    />
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* The kit composed — logo, heading, body and colours on one canvas, so the
                                                            pieces below are seen as a brand before they're seen as parts. Live in edit
                                                            mode too: it's the fastest way to judge a palette change. */}
                                                        {!kitOnTheWay && (
                                                            <div className="mt-8">
                                                                <BrandPreview brand={content.brand} clientName={clientName} tagline={foundation.taglines[0]} />
                                                            </div>
                                                        )}

                                                        {/* Same numbered-document treatment as Master Brand and the Overview. */}
                                                        {!kitOnTheWay && (
                                                            <div className="mt-8 flex flex-col gap-8">
                                                                <DocSection id="colors" label="Colors" icon={Palette}>
                                                                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                                                                        {content.brand.colors.map((color, i) => {
                                                                            const readable = readableTextOn(color.hex);
                                                                            const rgb = rgbString(color.hex);
                                                                            return (
                                                                                <div key={i} className="overflow-hidden rounded-xl ring-1 ring-secondary">
                                                                                    {/* "Aa" in whichever of white / near-black reads on this colour —
                                                                                the answer to "what text goes on my primary?" at a glance. */}
                                                                                    <div className="relative h-28" style={{ backgroundColor: color.hex }}>
                                                                                        {readable && (
                                                                                            <span
                                                                                                className="absolute right-3 bottom-2 text-lg font-semibold"
                                                                                                style={{ color: readable.text }}
                                                                                                aria-hidden="true"
                                                                                            >
                                                                                                Aa
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                    <div className="p-3">
                                                                                        {isLocked ? (
                                                                                            <>
                                                                                                <p className="text-sm font-semibold text-primary">
                                                                                                    {color.name}
                                                                                                </p>
                                                                                                {/* The hex is the thing people actually come here for — one click
                                                                                    beats selecting six characters by hand. RGB for the tools that
                                                                                    want it (Canva, print). */}
                                                                                                <button
                                                                                                    type="button"
                                                                                                    onClick={() => copyHex(color.hex)}
                                                                                                    title="Copy hex"
                                                                                                    className="mt-0.5 block font-mono text-xs text-tertiary uppercase transition duration-100 ease-linear hover:text-brand-secondary"
                                                                                                >
                                                                                                    {copiedHex === color.hex ? "Copied!" : color.hex}
                                                                                                </button>
                                                                                                {rgb && (
                                                                                                    <button
                                                                                                        type="button"
                                                                                                        onClick={() => copyHex(rgb)}
                                                                                                        title="Copy rgb()"
                                                                                                        className="mt-0.5 block font-mono text-[11px] text-quaternary transition duration-100 ease-linear hover:text-brand-secondary"
                                                                                                    >
                                                                                                        {copiedHex === rgb ? "Copied!" : rgb}
                                                                                                    </button>
                                                                                                )}
                                                                                                {readable && (
                                                                                                    <p
                                                                                                        className="mt-1.5 text-xs text-quaternary"
                                                                                                        title={`${readable.ratio.toFixed(2)}:1 contrast with ${readable.light ? "white" : "dark"} text`}
                                                                                                    >
                                                                                                        {readable.light ? "White" : "Dark"} text ·{" "}
                                                                                                        {wcagLabel(readable.ratio)}
                                                                                                    </p>
                                                                                                )}
                                                                                            </>
                                                                                        ) : (
                                                                                            <div className="flex flex-col gap-1.5">
                                                                                                <input
                                                                                                    type="text"
                                                                                                    placeholder="Name"
                                                                                                    value={color.name}
                                                                                                    onChange={(e) => updateColor(i, { name: e.target.value })}
                                                                                                    className={editInput("px-2 py-1 text-xs")}
                                                                                                />
                                                                                                <div className="flex items-center gap-1">
                                                                                                    {/* Native picker — no dependency, and it stops hand-typed hex typos. */}
                                                                                                    <input
                                                                                                        type="color"
                                                                                                        aria-label={`${color.name || "Colour"} picker`}
                                                                                                        value={
                                                                                                            /^#[0-9a-f]{6}$/i.test(color.hex)
                                                                                                                ? color.hex
                                                                                                                : "#888888"
                                                                                                        }
                                                                                                        onChange={(e) =>
                                                                                                            updateColor(i, { hex: e.target.value })
                                                                                                        }
                                                                                                        className="size-7 shrink-0 cursor-pointer rounded-md border border-secondary bg-transparent p-0.5"
                                                                                                    />
                                                                                                    <input
                                                                                                        type="text"
                                                                                                        placeholder="#000000"
                                                                                                        value={color.hex}
                                                                                                        onChange={(e) =>
                                                                                                            updateColor(i, { hex: e.target.value })
                                                                                                        }
                                                                                                        className={editInput("px-2 py-1 font-mono text-xs")}
                                                                                                    />
                                                                                                </div>
                                                                                                {/* Order matters: the first swatch is "primary" everywhere the
                                                                                            kit is used, so it can be moved rather than deleted and retyped. */}
                                                                                                <div className="flex items-center gap-1">
                                                                                                    <button
                                                                                                        type="button"
                                                                                                        title="Move earlier"
                                                                                                        disabled={i === 0}
                                                                                                        onClick={() => moveColor(i, -1)}
                                                                                                        className="flex size-7 items-center justify-center rounded-md text-fg-quaternary transition duration-100 ease-linear hover:bg-secondary hover:text-brand-secondary disabled:cursor-not-allowed disabled:opacity-50"
                                                                                                    >
                                                                                                        <ChevronLeft className="size-4" aria-hidden="true" />
                                                                                                    </button>
                                                                                                    <button
                                                                                                        type="button"
                                                                                                        title="Move later"
                                                                                                        disabled={i === content.brand.colors.length - 1}
                                                                                                        onClick={() => moveColor(i, 1)}
                                                                                                        className="flex size-7 items-center justify-center rounded-md text-fg-quaternary transition duration-100 ease-linear hover:bg-secondary hover:text-brand-secondary disabled:cursor-not-allowed disabled:opacity-50"
                                                                                                    >
                                                                                                        <ChevronRight className="size-4" aria-hidden="true" />
                                                                                                    </button>
                                                                                                    {readable && (
                                                                                                        <span className="min-w-0 flex-1 truncate text-[11px] text-quaternary">
                                                                                                            {readable.light ? "White" : "Dark"} text ·{" "}
                                                                                                            {wcagLabel(readable.ratio)}
                                                                                                        </span>
                                                                                                    )}
                                                                                                    <button
                                                                                                        type="button"
                                                                                                        title="Remove color"
                                                                                                        onClick={() =>
                                                                                                            patchBrand({
                                                                                                                colors: content.brand.colors.filter(
                                                                                                                    (_, j) => j !== i,
                                                                                                                ),
                                                                                                            })
                                                                                                        }
                                                                                                        className={cx(removeButton, "ml-auto size-7")}
                                                                                                    >
                                                                                                        <Trash01 className="size-4" aria-hidden="true" />
                                                                                                    </button>
                                                                                                </div>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                        {!isLocked && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() =>
                                                                                    patchBrand({
                                                                                        colors: [
                                                                                            ...content.brand.colors,
                                                                                            { name: "New color", hex: "#888888" },
                                                                                        ],
                                                                                    })
                                                                                }
                                                                                className="flex min-h-32 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-secondary text-sm font-medium text-tertiary transition duration-100 ease-linear hover:border-brand hover:text-brand-secondary"
                                                                            >
                                                                                <Plus className="size-5" aria-hidden="true" />
                                                                                Add color
                                                                            </button>
                                                                        )}
                                                                    </div>

                                                                    {/* Tailwind-style shade scales, generated live from the swatches above. */}
                                                                    {content.brand.colors.length > 0 && (
                                                                        <div className="mt-8">
                                                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                                                <p className="text-sm font-semibold text-primary">Shade scales</p>
                                                                                <span className="text-xs text-quaternary">
                                                                                    Generated from each color — click a shade to copy its hex
                                                                                </span>
                                                                            </div>
                                                                            <div className="mt-3">
                                                                                <ShadeScales
                                                                                    colors={content.brand.colors}
                                                                                    onRemove={
                                                                                        isLocked
                                                                                            ? undefined
                                                                                            : (i) =>
                                                                                                  patchBrand({
                                                                                                      colors: content.brand.colors.filter((_, j) => j !== i),
                                                                                                  })
                                                                                    }
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </DocSection>

                                                                {/* ── Typography — the fonts, previewed in the typefaces themselves. ── */}
                                                                <DocSection id="typography" label="Typography" icon={Type01}>
                                                                    <TypographyCards
                                                                        fonts={content.brand.fonts}
                                                                        files={content.brand.font_files}
                                                                        isLocked={isLocked}
                                                                        onFonts={(v) => patchBrand({ fonts: v })}
                                                                        onUpload={(role, file) => void onPickFontFile(role, file)}
                                                                        onClearUpload={(role) =>
                                                                            patchBrand({ font_files: { ...content.brand.font_files, [role]: undefined } })
                                                                        }
                                                                    />

                                                                    {/* The Untitled UI type scale in the brand's own fonts, px + fluid clamp(). */}
                                                                    {(content.brand.fonts.trim() ||
                                                                        content.brand.font_files?.heading ||
                                                                        content.brand.font_files?.body) && (
                                                                        <div className="mt-8">
                                                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                                                <p className="text-sm font-semibold text-primary">Type scale</p>
                                                                                <span className="text-xs text-quaternary">
                                                                                    Untitled UI scale · size / line-height · click the clamp() to copy
                                                                                </span>
                                                                            </div>
                                                                            <div className="mt-2">
                                                                                <TypeScale fonts={content.brand.fonts} files={content.brand.font_files} />
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </DocSection>

                                                                {/* ── Logo files ──
                                                            Each mark previews on a light AND a dark tile so a white or
                                                            transparent logo is actually visible on both grounds. Download is
                                                            a plain <a download> on the data URL — no server round-trip, and
                                                            a brand kit you can't download is decor. */}
                                                                {(!!(content.brand.logos ?? []).length || !isLocked) && (
                                                                    <DocSection
                                                                        id="logos"
                                                                        label="Logo files"
                                                                        icon={Image01}
                                                                        action={
                                                                            <span className="text-xs text-quaternary">
                                                                                SVG keeps its vector quality — PNG and JPG are compressed
                                                                            </span>
                                                                        }
                                                                    >
                                                                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                                                                            {(content.brand.logos ?? []).map((logo) => (
                                                                                <div key={logo.id} className="overflow-hidden rounded-xl ring-1 ring-secondary">
                                                                                    {/* Fixed white / near-black tiles on purpose (not theme tokens):
                                                                                the point is to prove the mark reads on both grounds. */}
                                                                                    <div className="grid h-24 grid-cols-2">
                                                                                        <div
                                                                                            className="flex items-center justify-center p-3"
                                                                                            style={{ background: "#FFFFFF" }}
                                                                                        >
                                                                                            <img
                                                                                                src={logo.url}
                                                                                                alt={logo.name}
                                                                                                className="max-h-full max-w-full object-contain"
                                                                                                draggable={false}
                                                                                            />
                                                                                        </div>
                                                                                        <div
                                                                                            className="flex items-center justify-center p-3"
                                                                                            style={{ background: "#0C111D" }}
                                                                                        >
                                                                                            <img
                                                                                                src={logo.url}
                                                                                                alt=""
                                                                                                aria-hidden="true"
                                                                                                className="max-h-full max-w-full object-contain"
                                                                                                draggable={false}
                                                                                            />
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="flex items-center gap-1 p-3">
                                                                                        {isLocked ? (
                                                                                            <p className="min-w-0 flex-1 truncate text-sm font-medium text-secondary">
                                                                                                {logo.name}
                                                                                            </p>
                                                                                        ) : (
                                                                                            <input
                                                                                                type="text"
                                                                                                placeholder="Logo name"
                                                                                                value={logo.name}
                                                                                                onChange={(e) =>
                                                                                                    patchBrand({
                                                                                                        logos: (content.brand.logos ?? []).map((x) =>
                                                                                                            x.id === logo.id
                                                                                                                ? { ...x, name: e.target.value }
                                                                                                                : x,
                                                                                                        ),
                                                                                                    })
                                                                                                }
                                                                                                className={editInput("px-2 py-1 text-xs")}
                                                                                            />
                                                                                        )}
                                                                                        <a
                                                                                            href={logo.url}
                                                                                            download={logo.name || "logo"}
                                                                                            title={`Download ${logo.name || "logo"}`}
                                                                                            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-fg-quaternary transition duration-100 ease-linear hover:bg-secondary hover:text-brand-secondary"
                                                                                        >
                                                                                            <Download01 className="size-4" aria-hidden="true" />
                                                                                        </a>
                                                                                        {!isLocked && (
                                                                                            <button
                                                                                                type="button"
                                                                                                title="Remove logo"
                                                                                                onClick={() =>
                                                                                                    patchBrand({
                                                                                                        logos: (content.brand.logos ?? []).filter(
                                                                                                            (x) => x.id !== logo.id,
                                                                                                        ),
                                                                                                    })
                                                                                                }
                                                                                                className={removeButton}
                                                                                            >
                                                                                                <Trash01 className="size-4" aria-hidden="true" />
                                                                                            </button>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                            {!isLocked && (
                                                                                <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-secondary text-sm font-medium text-tertiary transition duration-100 ease-linear hover:border-brand hover:text-brand-secondary">
                                                                                    <input
                                                                                        type="file"
                                                                                        accept="image/svg+xml,image/png,image/jpeg,image/webp"
                                                                                        multiple
                                                                                        className="hidden"
                                                                                        onChange={(e) => void onPickLogos(e)}
                                                                                    />
                                                                                    <UploadCloud02 className="size-5" aria-hidden="true" />
                                                                                    Upload logos
                                                                                </label>
                                                                            )}
                                                                        </div>
                                                                    </DocSection>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* ── Automation branding (internal) ──
                                                            The fonts and colours the reel, carousel and email automations
                                                            read, kept beside the kit they come from. Team-only, and the
                                                            table refuses anon besides — see automation-branding-card.tsx. */}
                                                        {isTeam && (
                                                            <AutomationBrandingCard
                                                                slug={slug}
                                                                clientName={clientName}
                                                                editorEmail={user?.email ?? ""}
                                                                prefillFrom={{
                                                                    colors: content.brand.colors,
                                                                    fonts: content.brand.fonts,
                                                                    instagramUrl: content.instagram.profile_url,
                                                                    websiteUrl: clientWebsite,
                                                                    brandBio: foundation.brandBio,
                                                                }}
                                                            />
                                                        )}
                                                    </Reveal>
                                                )}

                                                {/* ── Instagram Highlights ── */}
                                                {activeSection === "instagram" && (
                                                    <Reveal>
                                                        <SectionEyebrow section={activeSection} />
                                                        <div className="flex flex-wrap items-end justify-between gap-3">
                                                            <SectionHeading>Instagram Highlights</SectionHeading>
                                                            {isLocked ? (
                                                                content.instagram.profile_url && (
                                                                    <Button
                                                                        href={content.instagram.profile_url}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        color="link-color"
                                                                        size="md"
                                                                        iconTrailing={LinkExternal01}
                                                                    >
                                                                        View profile
                                                                    </Button>
                                                                )
                                                            ) : (
                                                                <input
                                                                    type="text"
                                                                    placeholder="Instagram profile URL"
                                                                    value={content.instagram.profile_url}
                                                                    onChange={(e) => patchInstagram({ profile_url: e.target.value })}
                                                                    className={editInput("max-w-80")}
                                                                />
                                                            )}
                                                        </div>
                                                        <p className="mt-3 text-md text-tertiary">
                                                            Your highlight covers, ready to download and add to your Instagram profile.
                                                        </p>

                                                        {content.instagram.highlights.length === 0 && isLocked ? (
                                                            <div className="mt-6 flex items-center gap-3 rounded-xl bg-secondary px-4 py-5">
                                                                <Instagram className="size-5 shrink-0 text-fg-quaternary" aria-hidden="true" />
                                                                <p className="text-sm text-tertiary">
                                                                    Highlight covers are on the way — the HiddenGem team will add them here.
                                                                </p>
                                                            </div>
                                                        ) : (
                                                            <div className="mt-6 flex flex-wrap gap-5">
                                                                {content.instagram.highlights.map((h, i) => (
                                                                    <div key={i} className="flex w-24 flex-col items-center gap-2">
                                                                        <div className="flex size-20 items-center justify-center overflow-hidden rounded-full bg-secondary p-0.5 ring-2 ring-secondary">
                                                                            {h.image_url ? (
                                                                                <img
                                                                                    src={h.image_url}
                                                                                    alt={h.title}
                                                                                    className="size-full rounded-full object-cover"
                                                                                    draggable={false}
                                                                                />
                                                                            ) : (
                                                                                <Image01 className="size-6 text-fg-quaternary" aria-hidden="true" />
                                                                            )}
                                                                        </div>
                                                                        {isLocked ? (
                                                                            <p className="w-full truncate text-center text-xs font-medium text-secondary">
                                                                                {h.title}
                                                                            </p>
                                                                        ) : (
                                                                            <div className="flex w-full flex-col gap-1">
                                                                                <input
                                                                                    type="text"
                                                                                    placeholder="Title"
                                                                                    value={h.title}
                                                                                    onChange={(e) => updateHighlight(i, { title: e.target.value })}
                                                                                    className={editInput("px-2 py-1 text-center text-xs")}
                                                                                />
                                                                                <input
                                                                                    type="text"
                                                                                    placeholder="Image URL"
                                                                                    value={h.image_url}
                                                                                    onChange={(e) => updateHighlight(i, { image_url: e.target.value })}
                                                                                    className={editInput("px-2 py-1 text-xs")}
                                                                                />
                                                                                <button
                                                                                    type="button"
                                                                                    title="Remove highlight"
                                                                                    onClick={() =>
                                                                                        patchInstagram({
                                                                                            highlights: content.instagram.highlights.filter((_, j) => j !== i),
                                                                                        })
                                                                                    }
                                                                                    className={cx(removeButton, "self-center")}
                                                                                >
                                                                                    <Trash01 className="size-4" aria-hidden="true" />
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                                {!isLocked && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            patchInstagram({
                                                                                highlights: [...content.instagram.highlights, { title: "New", image_url: "" }],
                                                                            })
                                                                        }
                                                                        className="flex size-20 items-center justify-center rounded-full border border-dashed border-secondary text-tertiary transition duration-100 ease-linear hover:border-brand hover:text-brand-secondary"
                                                                        title="Add highlight"
                                                                    >
                                                                        <Plus className="size-5" aria-hidden="true" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </Reveal>
                                                )}

                                                {/* ── GoHighLevel Setup ── */}
                                                {activeSection === "ghl" && (
                                                    <Reveal>
                                                        <SectionEyebrow section={activeSection} />
                                                        <div className="flex flex-wrap items-end justify-between gap-3">
                                                            <SectionHeading>GoHighLevel Setup</SectionHeading>
                                                            {isLocked ? (
                                                                content.ghl.login_url && (
                                                                    <Button
                                                                        href={content.ghl.login_url}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        color="link-color"
                                                                        size="md"
                                                                        iconTrailing={LinkExternal01}
                                                                    >
                                                                        Log in to GoHighLevel
                                                                    </Button>
                                                                )
                                                            ) : (
                                                                <input
                                                                    type="text"
                                                                    placeholder="GHL login URL"
                                                                    value={content.ghl.login_url}
                                                                    onChange={(e) => patchGhl({ login_url: e.target.value })}
                                                                    className={editInput("max-w-80")}
                                                                />
                                                            )}
                                                        </div>
                                                        <p className="mt-3 text-md text-tertiary">
                                                            Everything we're configuring in your CRM. Ticked items are live.
                                                        </p>

                                                        <div className="mt-6 flex flex-col items-center gap-8 rounded-xl p-6 ring-1 ring-secondary md:flex-row md:items-start">
                                                            <div className="shrink-0 pt-1">
                                                                <ProgressBarCircle
                                                                    value={ghlDone}
                                                                    max={Math.max(ghlTotal, 1)}
                                                                    size="xs"
                                                                    label="Setup progress"
                                                                    valueFormatter={(_, pct) => `${pct}%`}
                                                                />
                                                                <p className="mt-2 text-center text-xs font-medium text-tertiary">
                                                                    {ghlDone} of {ghlTotal} complete
                                                                </p>
                                                            </div>

                                                            <ul className="grid w-full gap-2.5 md:grid-cols-2">
                                                                {content.ghl.items.map((item, i) => (
                                                                    <li key={i} className="flex items-center gap-3">
                                                                        <button
                                                                            type="button"
                                                                            disabled={isLocked}
                                                                            onClick={() => updateGhlItem(i, { done: !item.done })}
                                                                            title={isLocked ? undefined : "Toggle status"}
                                                                            className={cx(
                                                                                "flex size-5 shrink-0 items-center justify-center rounded-full transition duration-100 ease-linear",
                                                                                item.done
                                                                                    ? "bg-brand-solid text-white"
                                                                                    : "text-transparent ring-1 ring-primary ring-inset",
                                                                                isLocked ? "cursor-default" : "cursor-pointer hover:opacity-80",
                                                                            )}
                                                                        >
                                                                            <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
                                                                        </button>
                                                                        {isLocked ? (
                                                                            <span className={cx("text-sm", item.done ? "text-primary" : "text-tertiary")}>
                                                                                {item.label}
                                                                            </span>
                                                                        ) : (
                                                                            <>
                                                                                <input
                                                                                    type="text"
                                                                                    value={item.label}
                                                                                    onChange={(e) => updateGhlItem(i, { label: e.target.value })}
                                                                                    className={editInput("px-2 py-1 text-sm")}
                                                                                />
                                                                                <button
                                                                                    type="button"
                                                                                    title="Remove item"
                                                                                    onClick={() =>
                                                                                        patchGhl({ items: content.ghl.items.filter((_, j) => j !== i) })
                                                                                    }
                                                                                    className={removeButton}
                                                                                >
                                                                                    <Trash01 className="size-4" aria-hidden="true" />
                                                                                </button>
                                                                            </>
                                                                        )}
                                                                    </li>
                                                                ))}
                                                                {!isLocked && (
                                                                    <li>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() =>
                                                                                patchGhl({
                                                                                    items: [...content.ghl.items, { label: "New setup item", done: false }],
                                                                                })
                                                                            }
                                                                            className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-medium text-tertiary transition duration-100 ease-linear hover:text-brand-secondary"
                                                                        >
                                                                            <Plus className="size-4" aria-hidden="true" />
                                                                            Add item
                                                                        </button>
                                                                    </li>
                                                                )}
                                                            </ul>
                                                        </div>
                                                    </Reveal>
                                                )}

                                                {/* ── Revenue & Results ── */}
                                                {activeSection === "revenue" && (
                                                    <Reveal>
                                                        <SectionEyebrow section={activeSection} />
                                                        <div className="flex flex-wrap items-end justify-between gap-3">
                                                            <SectionHeading>Revenue &amp; Results</SectionHeading>
                                                            {!isLocked && (
                                                                <input
                                                                    type="text"
                                                                    placeholder="Currency (e.g. USD)"
                                                                    value={content.revenue.currency}
                                                                    onChange={(e) => patchRevenue({ currency: e.target.value.toUpperCase() })}
                                                                    className={editInput("max-w-36 uppercase")}
                                                                />
                                                            )}
                                                        </div>
                                                        <p className="mt-3 text-md text-tertiary">
                                                            Results from your campaigns, updated monthly by the HiddenGem team.
                                                        </p>

                                                        {months.length === 0 && isLocked ? (
                                                            <div className="mt-6 rounded-xl bg-secondary px-4 py-6 text-center">
                                                                <p className="text-sm text-tertiary">
                                                                    No results yet — your first month's numbers will appear here.
                                                                </p>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                {/* Stat tiles */}
                                                                <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
                                                                    <StatTile
                                                                        label="This month"
                                                                        value={latest ? fmtMoney(latest.revenue) : "—"}
                                                                        change={
                                                                            momChange !== null ? (
                                                                                <BadgeWithIcon
                                                                                    iconLeading={momChange >= 0 ? ArrowUp : ArrowDown}
                                                                                    color={momChange >= 0 ? "success" : "error"}
                                                                                    size="md"
                                                                                >
                                                                                    {`${Math.abs(momChange).toFixed(0)}%`}
                                                                                </BadgeWithIcon>
                                                                            ) : undefined
                                                                        }
                                                                    />
                                                                    <StatTile label="Total revenue" value={fmtMoney(totalRevenue)} />
                                                                    <StatTile label="Leads captured" value={totalLeads.toLocaleString()} />
                                                                    <StatTile label="Appointments booked" value={totalAppointments.toLocaleString()} />
                                                                </div>

                                                                {/* Revenue bar chart — single series, brand hue, tooltip on hover */}
                                                                {months.length > 0 && (
                                                                    <div className="mt-6 rounded-xl p-5 ring-1 ring-secondary">
                                                                        <p className="text-sm font-semibold text-primary">Monthly revenue</p>
                                                                        <div className="mt-4 h-72 w-full text-quaternary">
                                                                            <ResponsiveContainer width="100%" height="100%">
                                                                                <BarChart data={months} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                                                                                    <CartesianGrid
                                                                                        vertical={false}
                                                                                        stroke="currentColor"
                                                                                        className="text-border-tertiary"
                                                                                    />
                                                                                    <XAxis
                                                                                        dataKey="month"
                                                                                        axisLine={false}
                                                                                        tickLine={false}
                                                                                        tick={{ fill: "currentColor", fontSize: 12 }}
                                                                                        dy={6}
                                                                                    />
                                                                                    <YAxis
                                                                                        axisLine={false}
                                                                                        tickLine={false}
                                                                                        width={44}
                                                                                        tick={{ fill: "currentColor", fontSize: 12 }}
                                                                                        tickFormatter={(v: number) => fmtCompact(v)}
                                                                                    />
                                                                                    <RechartsTooltip
                                                                                        cursor={{ fill: "currentColor", opacity: 0.06 }}
                                                                                        content={
                                                                                            <ChartTooltipContent
                                                                                                formatter={(value) => fmtMoney(Number(value))}
                                                                                            />
                                                                                        }
                                                                                    />
                                                                                    <Bar
                                                                                        dataKey="revenue"
                                                                                        name="Revenue"
                                                                                        className="fill-utility-brand-600"
                                                                                        radius={[4, 4, 0, 0]}
                                                                                        maxBarSize={32}
                                                                                    />
                                                                                </BarChart>
                                                                            </ResponsiveContainer>
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Edit-only data table */}
                                                                {!isLocked && (
                                                                    <div className="mt-6 overflow-x-auto rounded-xl p-4 ring-1 ring-secondary">
                                                                        <div className="grid min-w-120 grid-cols-[1fr_1fr_1fr_1fr_2.5rem] items-center gap-2">
                                                                            {["Month", "Revenue", "Leads", "Appointments", ""].map((h) => (
                                                                                <span key={h} className="px-1 text-xs font-semibold text-quaternary">
                                                                                    {h}
                                                                                </span>
                                                                            ))}
                                                                            {months.map((m, i) => (
                                                                                <div key={i} className="col-span-5 grid grid-cols-subgrid items-center">
                                                                                    <input
                                                                                        type="text"
                                                                                        placeholder="Jul"
                                                                                        value={m.month}
                                                                                        onChange={(e) => updateMonth(i, { month: e.target.value })}
                                                                                        className={editInput()}
                                                                                    />
                                                                                    <input
                                                                                        type="number"
                                                                                        value={m.revenue}
                                                                                        onChange={(e) =>
                                                                                            updateMonth(i, { revenue: Number(e.target.value) || 0 })
                                                                                        }
                                                                                        className={editInput()}
                                                                                    />
                                                                                    <input
                                                                                        type="number"
                                                                                        value={m.leads}
                                                                                        onChange={(e) => updateMonth(i, { leads: Number(e.target.value) || 0 })}
                                                                                        className={editInput()}
                                                                                    />
                                                                                    <input
                                                                                        type="number"
                                                                                        value={m.appointments}
                                                                                        onChange={(e) =>
                                                                                            updateMonth(i, { appointments: Number(e.target.value) || 0 })
                                                                                        }
                                                                                        className={editInput()}
                                                                                    />
                                                                                    <button
                                                                                        type="button"
                                                                                        title="Remove month"
                                                                                        onClick={() =>
                                                                                            patchRevenue({ months: months.filter((_, j) => j !== i) })
                                                                                        }
                                                                                        className={removeButton}
                                                                                    >
                                                                                        <Trash01 className="size-4" aria-hidden="true" />
                                                                                    </button>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() =>
                                                                                patchRevenue({
                                                                                    months: [...months, { month: "", revenue: 0, leads: 0, appointments: 0 }],
                                                                                })
                                                                            }
                                                                            className="mt-3 flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-medium text-tertiary transition duration-100 ease-linear hover:text-brand-secondary"
                                                                        >
                                                                            <Plus className="size-4" aria-hidden="true" />
                                                                            Add month
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}
                                                    </Reveal>
                                                )}

                                                {/* ── Website Setup Guide — the required Netlify account and the AI website opt-in ── */}
                                                {activeSection === "ownerguide" && (
                                                    <Reveal>
                                                        <SectionEyebrow section={activeSection} />
                                                        <SectionHeading>Setup Guide</SectionHeading>
                                                        <WebsiteSetupSection
                                                            setup={websiteSetup}
                                                            onChange={updateWebsiteSetup}
                                                            // A client types straight in; the team types only in edit mode, so a
                                                            // locked dashboard reads the same to both — answers, not boxes.
                                                            editable={!isTeam || !isLocked}
                                                            isTeam={isTeam}
                                                            ownerGuideSlug={ownerGuideSlug}
                                                            saveState={setupSave}
                                                            saveError={setupSaveError}
                                                        />
                                                    </Reveal>
                                                )}

                                                {/* ── Website — top-of-funnel tools embedded on your own site ── */}
                                                {activeSection === "website" && (
                                                    <Reveal>
                                                        <SectionEyebrow section={activeSection} />
                                                        <SectionHeading>Website</SectionHeading>
                                                        <p className="mt-3 text-md text-tertiary">
                                                            Your site is the first real impression — these are the tools we've set up on it to turn visitors
                                                            into leads.
                                                        </p>

                                                        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                                            {websiteLinks.map((link, i) =>
                                                                isLocked ? (
                                                                    <a
                                                                        key={i}
                                                                        href={link.url}
                                                                        target={link.url.startsWith("/") ? undefined : "_blank"}
                                                                        rel={link.url.startsWith("/") ? undefined : "noopener noreferrer"}
                                                                        className="group rounded-xl p-5 ring-1 ring-secondary transition duration-100 ease-linear hover:ring-brand"
                                                                    >
                                                                        <div className="flex items-start justify-between gap-2">
                                                                            <FeaturedIcon icon={ArrowUpRight} size="sm" color="brand" theme="light" />
                                                                            <ArrowUpRight
                                                                                className="size-4 text-fg-quaternary opacity-0 transition duration-100 ease-linear group-hover:opacity-100"
                                                                                aria-hidden="true"
                                                                            />
                                                                        </div>
                                                                        <p className="mt-3 text-sm font-semibold text-primary">{link.title}</p>
                                                                        <p className="mt-1 text-sm text-tertiary">{link.description}</p>
                                                                    </a>
                                                                ) : (
                                                                    <div key={i} className="flex flex-col gap-1.5 rounded-xl p-4 ring-1 ring-secondary">
                                                                        <div className="flex items-center gap-1.5">
                                                                            <input
                                                                                type="text"
                                                                                placeholder="Title"
                                                                                value={link.title}
                                                                                onChange={(e) => updateLink(link, { title: e.target.value })}
                                                                                className={editInput("font-semibold")}
                                                                            />
                                                                            <button
                                                                                type="button"
                                                                                title="Remove link"
                                                                                onClick={() => removeLink(link)}
                                                                                className={removeButton}
                                                                            >
                                                                                <Trash01 className="size-4" aria-hidden="true" />
                                                                            </button>
                                                                        </div>
                                                                        <input
                                                                            type="text"
                                                                            placeholder="Description"
                                                                            value={link.description}
                                                                            onChange={(e) => updateLink(link, { description: e.target.value })}
                                                                            className={editInput("text-xs")}
                                                                        />
                                                                        <input
                                                                            type="text"
                                                                            placeholder="/acme-metapixel or https://…"
                                                                            value={link.url}
                                                                            onChange={(e) => updateLink(link, { url: e.target.value })}
                                                                            className={editInput("font-mono text-xs")}
                                                                        />
                                                                    </div>
                                                                ),
                                                            )}
                                                            {!isLocked && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setContent((c) => ({
                                                                            ...c,
                                                                            links: [...c.links, { title: "New page", description: "", url: "" }],
                                                                        }))
                                                                    }
                                                                    className="flex min-h-28 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-secondary text-sm font-medium text-tertiary transition duration-100 ease-linear hover:border-brand hover:text-brand-secondary"
                                                                >
                                                                    <Plus className="size-5" aria-hidden="true" />
                                                                    Add link
                                                                </button>
                                                            )}
                                                        </div>
                                                    </Reveal>
                                                )}

                                                {/* ── Chat Widget — middle-of-funnel, answers guest questions from the Master Document ── */}
                                                {activeSection === "chatwidget" && (
                                                    <Reveal>
                                                        <SectionEyebrow section={activeSection} />
                                                        <SectionHeading>Chat Widget</SectionHeading>
                                                        <p className="mt-3 text-md text-tertiary">
                                                            An AI chat on your website that answers guest questions instantly, straight from your Master Brand
                                                            Document — the properties, amenities, location and local favorites you've filled in there — so no
                                                            question goes unanswered while you're offline.
                                                        </p>

                                                        <div className="mt-6 grid gap-4 sm:grid-cols-2">
                                                            {chatWidgetLinks.length === 0 && isLocked && (
                                                                <p className="rounded-xl border border-dashed border-secondary px-4 py-5 text-sm text-quaternary italic sm:col-span-2">
                                                                    Your chat widget setup guide will appear here once it's ready.
                                                                </p>
                                                            )}
                                                            {chatWidgetLinks.map((link, i) =>
                                                                isLocked ? (
                                                                    <a
                                                                        key={i}
                                                                        href={link.url}
                                                                        target={link.url.startsWith("/") ? undefined : "_blank"}
                                                                        rel={link.url.startsWith("/") ? undefined : "noopener noreferrer"}
                                                                        className="group rounded-xl p-5 ring-1 ring-secondary transition duration-100 ease-linear hover:ring-brand"
                                                                    >
                                                                        <div className="flex items-start justify-between gap-2">
                                                                            <FeaturedIcon icon={MessageChatCircle} size="sm" color="brand" theme="light" />
                                                                            <ArrowUpRight
                                                                                className="size-4 text-fg-quaternary opacity-0 transition duration-100 ease-linear group-hover:opacity-100"
                                                                                aria-hidden="true"
                                                                            />
                                                                        </div>
                                                                        <p className="mt-3 text-sm font-semibold text-primary">{link.title}</p>
                                                                        <p className="mt-1 text-sm text-tertiary">{link.description}</p>
                                                                    </a>
                                                                ) : (
                                                                    <div key={i} className="flex flex-col gap-1.5 rounded-xl p-4 ring-1 ring-secondary">
                                                                        <div className="flex items-center gap-1.5">
                                                                            <input
                                                                                type="text"
                                                                                placeholder="Title"
                                                                                value={link.title}
                                                                                onChange={(e) => updateLink(link, { title: e.target.value })}
                                                                                className={editInput("font-semibold")}
                                                                            />
                                                                            <button
                                                                                type="button"
                                                                                title="Remove link"
                                                                                onClick={() => removeLink(link)}
                                                                                className={removeButton}
                                                                            >
                                                                                <Trash01 className="size-4" aria-hidden="true" />
                                                                            </button>
                                                                        </div>
                                                                        <input
                                                                            type="text"
                                                                            placeholder="Description"
                                                                            value={link.description}
                                                                            onChange={(e) => updateLink(link, { description: e.target.value })}
                                                                            className={editInput("text-xs")}
                                                                        />
                                                                        <input
                                                                            type="text"
                                                                            placeholder="/acme-chatwidget"
                                                                            value={link.url}
                                                                            onChange={(e) => updateLink(link, { url: e.target.value })}
                                                                            className={editInput("font-mono text-xs")}
                                                                        />
                                                                    </div>
                                                                ),
                                                            )}
                                                            {!isLocked && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setContent((c) => ({
                                                                            ...c,
                                                                            links: [
                                                                                ...c.links,
                                                                                {
                                                                                    title: "Chat Widget",
                                                                                    description: "",
                                                                                    url: slug ? `/${slug}-chatwidget` : "",
                                                                                },
                                                                            ],
                                                                        }))
                                                                    }
                                                                    className="flex min-h-28 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-secondary text-sm font-medium text-tertiary transition duration-100 ease-linear hover:border-brand hover:text-brand-secondary"
                                                                >
                                                                    <Plus className="size-5" aria-hidden="true" />
                                                                    Add link
                                                                </button>
                                                            )}
                                                        </div>
                                                    </Reveal>
                                                )}

                                                {/* ── Video Guides ── */}
                                                {activeSection === "videos" && (
                                                    <Reveal>
                                                        <SectionEyebrow section={activeSection} />
                                                        <SectionHeading>Video Guides</SectionHeading>
                                                        <p className="mt-3 text-md text-tertiary">
                                                            Short walkthrough videos recorded for you by the HiddenGem team.
                                                        </p>

                                                        {isLocked ? (
                                                            videoGuides.some((v) => v.url) ? (
                                                                <div className="mt-6 grid gap-6 sm:grid-cols-2">
                                                                    {videoGuides
                                                                        .filter((v) => v.url)
                                                                        .map((v) => (
                                                                            <div key={v.id}>
                                                                                <p className="text-sm font-semibold text-primary">{v.title}</p>
                                                                                <VideoEmbed url={v.url} className="mt-3" />
                                                                            </div>
                                                                        ))}
                                                                </div>
                                                            ) : (
                                                                <p className="mt-6 rounded-xl border border-dashed border-secondary px-4 py-5 text-sm text-quaternary italic">
                                                                    No videos yet.
                                                                </p>
                                                            )
                                                        ) : (
                                                            <div className="mt-6 flex flex-col gap-4">
                                                                {videoGuides.map((v, i) => (
                                                                    <div key={v.id} className="flex flex-col gap-1.5 rounded-xl p-4 ring-1 ring-secondary">
                                                                        <div className="flex items-center gap-1.5">
                                                                            <input
                                                                                type="text"
                                                                                placeholder="Video title"
                                                                                value={v.title}
                                                                                onChange={(e) => updateVideo(i, { title: e.target.value })}
                                                                                className={editInput("font-semibold")}
                                                                            />
                                                                            <button
                                                                                type="button"
                                                                                title="Remove video"
                                                                                onClick={() =>
                                                                                    setContent((c) => ({
                                                                                        ...c,
                                                                                        videos: (c.videos ?? []).filter((_, j) => j !== i),
                                                                                    }))
                                                                                }
                                                                                className={removeButton}
                                                                            >
                                                                                <Trash01 className="size-4" aria-hidden="true" />
                                                                            </button>
                                                                        </div>
                                                                        <VideoAttach
                                                                            value={v.url || undefined}
                                                                            onChange={(url) => updateVideo(i, { url: url ?? "" })}
                                                                        />
                                                                    </div>
                                                                ))}
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setContent((c) => ({
                                                                            ...c,
                                                                            videos: [...(c.videos ?? []), { id: crypto.randomUUID(), title: "", url: "" }],
                                                                        }))
                                                                    }
                                                                    className="flex min-h-28 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-secondary text-sm font-medium text-tertiary transition duration-100 ease-linear hover:border-brand hover:text-brand-secondary"
                                                                >
                                                                    <Plus className="size-5" aria-hidden="true" />
                                                                    Add video
                                                                </button>
                                                            </div>
                                                        )}
                                                    </Reveal>
                                                )}

                                                {/* ── Communication Log — not built yet, nav item is disabled ── */}
                                                {activeSection === "comms" && (
                                                    <Reveal>
                                                        <SectionEyebrow section={activeSection} />
                                                        <SectionHeading>Communication Log</SectionHeading>
                                                        <p className="mt-3 text-md text-tertiary">
                                                            Coming soon — a shared log of calls and updates between you and your Account Manager.
                                                        </p>
                                                    </Reveal>
                                                )}

                                                {/* ── Still need support? (Overview only) ── */}
                                                {activeSection === "overview" && (
                                                    <Reveal className="mt-16">
                                                        {/* Simple, left-aligned contact panel (approved template-lab layout) */}
                                                        <div className="rounded-2xl bg-secondary px-6 py-8 md:px-10 md:py-10">
                                                            <h2 className="text-display-xs font-semibold text-primary">Questions about your dashboard?</h2>
                                                            <h3 className="mt-3 text-sm font-semibold text-brand-secondary">Contact us</h3>
                                                            <p className="mt-1.5 max-w-xl text-sm text-tertiary">
                                                                Our team is here to help. Reach out to HiddenGem about your brand, setup or results anytime.
                                                            </p>
                                                            <div className="mt-5">
                                                                <Button href={CONTACT_MAILTO} size="lg" color="primary" iconTrailing={ArrowRight}>
                                                                    Contact HiddenGem Team
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </Reveal>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </motion.article>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════
                Plus Wizard Modal
            ════════════════════════════════════════════════ */}
            {/* Master Document — compiled doc the AM reviews, copies or downloads. */}
            {showMasterDocModal && masterDoc && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8"
                    onClick={(e) => e.target === e.currentTarget && setShowMasterDocModal(false)}
                >
                    <div className="flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-primary shadow-2xl ring-1 ring-secondary">
                        <div className="flex items-start justify-between gap-3 border-b border-secondary px-6 py-4">
                            <div>
                                <h3 className="text-md font-semibold text-primary">Master Brand Document — ready for review</h3>
                                <p className="mt-0.5 text-sm text-tertiary">
                                    Compiled from {clientName.trim() || "the client"}'s answers. Review it, then copy or download for welcome emails, the chat
                                    widget, and onboarding.
                                </p>
                            </div>
                            <button
                                type="button"
                                aria-label="Close"
                                onClick={() => setShowMasterDocModal(false)}
                                className="flex size-8 shrink-0 items-center justify-center rounded-lg text-tertiary hover:bg-secondary"
                            >
                                <XClose className="size-4" aria-hidden="true" />
                            </button>
                        </div>

                        {masterDoc.missing.length > 0 && (
                            <div className="mx-6 mt-4 rounded-lg bg-utility-yellow-50 px-3 py-2 text-xs font-medium text-utility-yellow-700">
                                Still empty: {masterDoc.missing.join(", ")} — marked “Not provided yet” below. Ask the client to fill these in.
                            </div>
                        )}

                        <pre className="flex-1 overflow-y-auto px-6 py-4 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap text-secondary">
                            {masterDoc.doc}
                        </pre>

                        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-secondary px-6 py-4">
                            {pdfError && (
                                <span className="text-sm text-error-primary" role="alert">
                                    Couldn't build the PDF. Please try again.
                                </span>
                            )}
                            <Button size="sm" color="secondary" iconLeading={Download01} onClick={downloadMasterDoc}>
                                Download .md
                            </Button>
                            <Button
                                size="sm"
                                color="secondary"
                                iconLeading={Download01}
                                isLoading={pdfBusy}
                                showTextWhileLoading
                                onClick={() => void downloadMasterDocPdf()}
                            >
                                {pdfBusy ? "Preparing…" : "Download PDF"}
                            </Button>
                            <Button size="sm" color="primary" iconLeading={masterDocCopied ? Check : Copy01} onClick={copyMasterDoc}>
                                {masterDocCopied ? "Copied!" : "Copy document"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Client-input form modal ──
                The form keeps its own Typeform-style chrome (progress bar, counter,
                Enter-to-advance) and autosaves as normal — the modal only replaces the
                full-page navigation. Backdrop click closes; nothing is lost because the
                answer and the resume position are both already saved. */}
            {formModal && (
                <div
                    // Matches the shared ModalOverlay treatment (modals/modal.tsx): semantic
                    // bg-overlay so it adapts in dark mode, plus a backdrop blur so the
                    // dashboard behind recedes and the question has the room to itself.
                    className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/70 p-4 backdrop-blur-[6px] duration-300 ease-out animate-in fade-in sm:p-8"
                    onClick={(e) => e.target === e.currentTarget && closeFormModal()}
                >
                    <div className="h-full max-h-[900px] w-full max-w-5xl overflow-hidden rounded-2xl shadow-2xl ring-1 ring-secondary">
                        {formModal === "intake" ? (
                            <ClientOnboardingFormPage
                                slug={intakeSlug}
                                initialClientName={clientName}
                                initialData={intakeData}
                                embedded
                                onClose={closeFormModal}
                                startAtField={formModalField}
                            />
                        ) : formModal === "brand" ? (
                            <HostOnboardingFormPage
                                slug={visionSlug}
                                initialClientName={clientName}
                                initialClientWebsite={clientWebsite}
                                initialData={visionData}
                                embedded
                                onClose={closeFormModal}
                            />
                        ) : (
                            <AccessFormPage
                                slug={onboardingSlug}
                                initialClientName={clientName}
                                initialData={brandData}
                                embedded
                                onClose={closeFormModal}
                                startAtField={formModalField}
                            />
                        )}
                    </div>
                </div>
            )}

            {/* Kick-off booking, embedded rather than linked out. Calendly serves this URL with
                x-frame-options: ALLOWALL, so a plain iframe works and no third-party script has to
                run on the dashboard. The escape hatch below covers the case where an extension or
                a locked-down network blocks the frame — without it, a blocked iframe would leave
                the client staring at an empty box with no way to book at all. */}
            {bookingOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/70 p-4 backdrop-blur-[6px] duration-300 ease-out animate-in fade-in sm:p-8"
                    onClick={(e) => e.target === e.currentTarget && setBookingOpen(false)}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Book your Kick-off Call"
                >
                    <div className="flex h-full max-h-[880px] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-primary shadow-2xl ring-1 ring-secondary">
                        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-secondary px-5 py-4">
                            <div className="min-w-0">
                                <h2 className="text-md font-semibold text-primary">Book your Kick-off Call</h2>
                                <p className="mt-0.5 text-sm text-tertiary">With Dustin and your Account Manager.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setBookingOpen(false)}
                                aria-label="Close"
                                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-fg-quaternary transition duration-100 ease-linear hover:bg-secondary hover:text-fg-secondary"
                            >
                                <XClose className="size-5" aria-hidden="true" />
                            </button>
                        </div>
                        <iframe
                            src={`${KICKOFF_CALENDLY}?embed_domain=${encodeURIComponent(window.location.hostname)}&embed_type=Inline&hide_gdpr_banner=1`}
                            title="Calendly booking"
                            className="min-h-0 w-full flex-1 border-0"
                        />
                        {/* Confirmation in our own voice. Calendly shows its own success screen inside
                            the frame, but that screen knows nothing about the journey — this is what
                            tells the client the step is ticked and where they go next. */}
                        {justBooked && (
                            <div className="flex shrink-0 items-start gap-3 border-t border-secondary bg-success-secondary px-5 py-4">
                                <CheckCircle className="mt-0.5 size-5 shrink-0 text-fg-success-secondary" aria-hidden="true" />
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-primary">Booked — that's your Kick-off Call.</p>
                                    <p className="mt-0.5 text-sm text-pretty text-tertiary">
                                        Check your email for the invite.
                                        {stepAfterKickoff ? ` Next up: ${stepAfterKickoff.label}.` : ""}
                                    </p>
                                </div>
                                <Button size="sm" color="secondary" className="ml-auto shrink-0" onClick={() => setBookingOpen(false)}>
                                    Close
                                </Button>
                            </div>
                        )}
                        <div className="shrink-0 border-t border-secondary px-5 py-3">
                            <p className="text-xs text-quaternary">
                                Calendar not loading?{" "}
                                <a
                                    href={KICKOFF_CALENDLY}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-semibold text-brand-secondary transition duration-100 ease-linear hover:underline"
                                >
                                    Open it in a new tab
                                </a>
                                .
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {showPlusModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
                    onClick={(e) => e.target === e.currentTarget && setShowPlusModal(false)}
                >
                    <div className="w-full max-w-sm rounded-2xl bg-primary p-6 shadow-2xl ring-1 ring-secondary">
                        {/* Step 1 — Password */}
                        {plusStep === "password" && (
                            <>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h3 className="text-md font-semibold text-primary">Create Client Dashboard</h3>
                                        <p className="mt-1 text-sm text-tertiary">Enter the admin password to continue.</p>
                                    </div>
                                    <button
                                        type="button"
                                        aria-label="Close"
                                        onClick={() => setShowPlusModal(false)}
                                        className="flex size-8 items-center justify-center rounded-lg text-tertiary hover:bg-secondary"
                                    >
                                        <XClose className="size-4" aria-hidden="true" />
                                    </button>
                                </div>

                                <div className="mt-4">
                                    <input
                                        type="password"
                                        placeholder="Password"
                                        value={plusPassword}
                                        onChange={(e) => {
                                            setPlusPassword(e.target.value);
                                            setPlusPasswordError(false);
                                        }}
                                        onKeyDown={(e) => e.key === "Enter" && handlePlusPassword()}
                                        ref={(el) => el?.focus({ preventScroll: true })}
                                        className={cx(
                                            "w-full rounded-lg border px-3 py-2 text-sm text-primary transition duration-100 ease-linear outline-none placeholder:text-placeholder",
                                            plusPasswordError
                                                ? "border-error-primary ring-error-primary ring-1"
                                                : "border-secondary focus:border-brand focus:ring-1 focus:ring-brand",
                                        )}
                                    />
                                    {plusPasswordError && <p className="mt-1.5 text-xs text-error-primary">Incorrect password. Please try again.</p>}
                                </div>

                                <div className="mt-4 flex gap-3">
                                    <Button color="secondary" size="sm" className="flex-1" onClick={() => setShowPlusModal(false)}>
                                        Cancel
                                    </Button>
                                    <Button color="primary" size="sm" className="flex-1" onClick={handlePlusPassword}>
                                        Continue
                                    </Button>
                                </div>
                            </>
                        )}

                        {/* Step 2 — Client details */}
                        {plusStep === "details" && (
                            <>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h3 className="text-md font-semibold text-primary">Create Client Dashboard</h3>
                                        <p className="mt-1 text-sm text-tertiary">Enter the client details. Sections can be filled in after.</p>
                                    </div>
                                    <button
                                        type="button"
                                        aria-label="Close"
                                        onClick={() => setShowPlusModal(false)}
                                        className="flex size-8 items-center justify-center rounded-lg text-tertiary hover:bg-secondary"
                                    >
                                        <XClose className="size-4" aria-hidden="true" />
                                    </button>
                                </div>

                                <div className="mt-4 flex flex-col gap-3">
                                    <div>
                                        <label htmlFor="new-dashboard-client-name" className="mb-1.5 block text-sm font-medium text-secondary">
                                            Client Name
                                        </label>
                                        <input
                                            id="new-dashboard-client-name"
                                            type="text"
                                            placeholder="e.g. Acme Corp"
                                            value={newClientName}
                                            onChange={(e) => setNewClientName(e.target.value)}
                                            autoFocus
                                            className="w-full rounded-lg border border-secondary px-3 py-2 text-sm text-primary transition duration-100 ease-linear outline-none placeholder:text-placeholder focus:border-brand focus:ring-1 focus:ring-brand"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="new-dashboard-client-website" className="mb-1.5 block text-sm font-medium text-secondary">
                                            Client Website URL
                                        </label>
                                        <input
                                            id="new-dashboard-client-website"
                                            type="text"
                                            placeholder="e.g. acmecorp.com"
                                            value={newClientWebsite}
                                            onChange={(e) => setNewClientWebsite(e.target.value)}
                                            className="w-full rounded-lg border border-secondary px-3 py-2 text-sm text-primary transition duration-100 ease-linear outline-none placeholder:text-placeholder focus:border-brand focus:ring-1 focus:ring-brand"
                                        />
                                    </div>
                                    {newClientName.trim() && (
                                        <p className="text-xs text-tertiary">
                                            Page URL:{" "}
                                            <span className="font-medium text-brand-secondary">docs-hgm.netlify.app/{slugify(newClientName)}-dashboard</span>
                                        </p>
                                    )}
                                    {createError && <p className="text-xs text-error-primary">{createError}</p>}
                                </div>

                                <div className="mt-4 flex gap-3">
                                    <Button color="secondary" size="sm" className="flex-1" onClick={() => setShowPlusModal(false)} isDisabled={isCreating}>
                                        Cancel
                                    </Button>
                                    <Button
                                        color="primary"
                                        size="sm"
                                        className="flex-1"
                                        onClick={handleCreatePage}
                                        isDisabled={!newClientName.trim()}
                                        isLoading={isCreating}
                                        showTextWhileLoading
                                    >
                                        {isCreating ? "Creating…" : "Create Dashboard"}
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};
