import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
    BookOpen01,
    Check,
    CheckCircle,
    CheckDone01,
    ChevronDown,
    ChevronRight,
    Flag05,
    HelpCircle,
    Hourglass01,
    Image01,
    LayoutAlt01,
    LinkExternal01,
    Plus,
    Rocket01,
    Star01,
    Trash01,
    XCircle,
    XClose,
    Zap,
} from "@untitledui/icons";
import { AnimatePresence, motion } from "motion/react";
import { AppShell, CollapsedTopBar, IconRail, NavCollapseButton, RailBottom, useNavCollapsed } from "@/components/application/icon-rail";
import { PageBanner } from "@/components/application/page-banner";
import { fetchDynamicSearchItems, STATIC_ITEMS, type SearchItem } from "@/components/application/search-modal";
import { PriorityFlag, type QuestionPriority } from "@/components/application/priority-flag";
import { VideoAttach, VideoEmbed } from "@/components/application/video-block";
import { Badge, BadgeWithDot } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { useEditShortcuts } from "@/hooks/use-edit-shortcuts";
import { readSopPage, writeSopPage } from "@/lib/db-sync";
import { compressImageFile } from "@/utils/compress-image";
import { cx } from "@/utils/cx";
import { HighlightPen, renderHighlights } from "@/utils/highlight";

const ROADMAP_SLUG = "roadmap";

type Tier = "in_progress" | "next" | "planned";

interface RoadmapItem {
    id: string;
    tier: Tier;
    title: string;
    description: string;
}

interface LogEntry {
    id: string;
    /** YYYY-MM-DD */
    date: string;
    title: string;
    description: string;
    /** Optional URL showing the shipped result. */
    link?: string;
    /** Optional video URL (Loom link or uploaded mp4). */
    video?: string;
}

interface TodoItem {
    id: string;
    text: string;
    done: boolean;
}

interface QuestionItem {
    id: string;
    question: string;
    answer: string;
    /** Optional screenshot/attachment, stored as a data URL (same pattern as owner-guide images). */
    image?: string;
    /** Optional video URL (Loom link or uploaded mp4). */
    video?: string;
    /** Explicit resolve flag — typing an answer no longer auto-resolves a question,
        so a half-formed idea can sit in Open until it's actually checked off. */
    resolved?: boolean;
    /** HIGH / MEDIUM / LOW answer-first flag — shared with the /questions inbox. */
    priority?: QuestionPriority;
}

interface FeatureItem {
    id: string;
    text: string;
    /** Detail panel fields (all optional so older saved rows still load). */
    about?: string;
    /** Comma-separated names, rendered as chips. */
    requestedBy?: string;
    ideation?: string;
    result?: string;
    approval?: "approved" | "rejected";
}

type FeatureCol = "internalFeatures" | "clientFeatures";

interface OverviewData {
    paragraph: string;
    internalFeatures: FeatureItem[];
    clientFeatures: FeatureItem[];
}

interface RoadmapData {
    overview: OverviewData;
    bannerUrl?: string;
    roadmap: RoadmapItem[];
    log: LogEntry[];
    todos: TodoItem[];
    questions: QuestionItem[];
    /** Links starred in editing mode so the important ones stand out (Links view). */
    starredLinks?: string[];
}

const TIERS: { id: Tier; label: string; badgeColor: "success" | "blue" | "gray"; blurb: string }[] = [
    { id: "in_progress", label: "In progress", badgeColor: "success", blurb: "Actively being built right now." },
    { id: "next", label: "Next", badgeColor: "blue", blurb: "Queued up once in-progress work ships." },
    { id: "planned", label: "Planned", badgeColor: "gray", blurb: "On the radar, not yet scheduled." },
];

const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `id-${Math.random().toString(36).slice(2)}`);

/** Format "2026-07-02" → "Jul 2, 2026" without timezone drift. */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const formatDate = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    if (!y || !m || !d) return iso;
    return `${MONTHS[m - 1]} ${d}, ${y}`;
};

const todayIso = () => {
    const now = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
};

/** Seed content (real project history) shown until the team saves its own. */
const DEFAULT_DATA: RoadmapData = {
    overview: {
        paragraph:
            "hgm-doc is HiddenGem Media's client guide & documentation site. The team creates per-client setup guides — Meta Pixel, lead-capture popups, owner guides — from master templates, edits them in place, and shares them with clients via private URLs. Content persists to Supabase, and the site auto-deploys to Netlify on every push to main.",
        internalFeatures: [
            { id: uid(), text: "Dashboard with department rails & client cards" },
            { id: uid(), text: "Sitewide search from the icon rail (Shift+F)" },
            { id: uid(), text: "Client requests queue (/requests)" },
            { id: uid(), text: "Design-system reference page (/designsystem)" },
            { id: uid(), text: "Settings with team login & theme defaults" },
            { id: uid(), text: "Progress & roadmap page (this page)" },
        ],
        clientFeatures: [
            { id: uid(), text: "Meta Pixel setup guide" },
            { id: uid(), text: "Lead-capture popup guide" },
            { id: uid(), text: "Owner guide with credentials & checklists" },
            { id: uid(), text: "Private per-client page copies" },
            { id: uid(), text: "Light & dark mode" },
        ],
    },
    roadmap: [
        { id: uid(), tier: "in_progress", title: "Progress & roadmap page", description: "This page — a living build log for the docs site." },
        { id: uid(), tier: "next", title: "Code-split the JS bundle", description: "Main bundle is ~1.5 MB unminified; split routes with dynamic imports." },
        { id: uid(), tier: "next", title: "Supabase resource review", description: "Investigate the resource-exhaustion warnings and optimize queries." },
        {
            id: uid(),
            tier: "planned",
            title: "More per-client guide templates",
            description: "Extend the template system beyond Meta Pixel and popups.",
        },
    ],
    log: [
        {
            id: uid(),
            date: "2026-07-02",
            title: "Automated deploys via GitHub Actions",
            description:
                "Push to main now builds and deploys to Netlify automatically. Also fixed the root cause of every remote build failure (three lib files were never committed).",
        },
        {
            id: uid(),
            date: "2026-07-01",
            title: "Firebase fallback layer",
            description:
                "Editable content dual-wrote to Supabase and Firestore, intended to survive Supabase outages. Removed 2026-08-06 — Firestore's rules denied the anon client, so the fallback never actually worked.",
        },
        {
            id: uid(),
            date: "2026-06-26",
            title: "Chat Widget installation guides",
            description: "New guide template with per-client copies; content switched from WordPress to Wix.",
        },
        {
            id: uid(),
            date: "2026-06-25",
            title: "Settings page + Supabase CLI baseline",
            description: "Account settings with theme defaults and owner-guide gating; schema now lives in versioned migrations.",
        },
        {
            id: uid(),
            date: "2026-06-24",
            title: "Dashboard login",
            description: "Google + password login for the team dashboard, PRO icons, design-system token sync.",
        },
        {
            id: uid(),
            date: "2026-06-22",
            title: "Icon-rail search & per-client owner guides",
            description: "Sitewide search from the rail (Shift+F), owner-guide copies per client, /designsystem page.",
        },
        {
            id: uid(),
            date: "2026-06-21",
            title: "Requests page + Supabase persistence",
            description: "Docs request form and /requests queue; SOP and owner-guide edits now persist to Supabase instead of being lost.",
        },
        {
            id: uid(),
            date: "2026-06-20",
            title: "Owner guide rebuilt + lead-capture popups",
            description: "Step content, credential forms, reordering, and the popup pages with the blue brand theme.",
        },
        {
            id: uid(),
            date: "2026-06-19",
            title: "Site launched",
            description: "Meta Pixel setup guide live on docs-hgm.netlify.app.",
            link: "https://docs-hgm.netlify.app",
        },
    ],
    todos: [
        { id: uid(), text: "Code-split routes with dynamic imports — the JS bundle is ~1.5 MB and slows first load", done: false },
        { id: uid(), text: "Gate internal pages (/dashboard, /roadmap, /settings) behind the team login", done: false },
        { id: uid(), text: "Review Supabase usage and resolve the resource-exhaustion warnings", done: false },
        { id: uid(), text: "Add loading skeletons to Supabase-backed pages so content doesn't flash in", done: false },
        { id: uid(), text: "Run a Lighthouse pass: image compression, lazy loading, contrast in both modes", done: false },
    ],
    questions: [
        { id: uid(), question: "Which guide template should we build next — Google Analytics, SEO setup, or email/domain?", answer: "" },
        { id: uid(), question: "Should client-facing guide pages stay public-by-URL, or get a password/access code?", answer: "" },
        { id: uid(), question: "Who besides you needs edit access — do we need per-person accounts and roles?", answer: "" },
        { id: uid(), question: "Do you want a notification (email/Slack) when a client submits a request on /requests?", answer: "" },
        { id: uid(), question: "What's the next priority: performance (code-splitting) or new features?", answer: "" },
    ],
    starredLinks: [],
};

/** Sidebar is grouped (macOS System Settings style) with dividers between groups.
    Order here IS the scroll order — keep it matching the section DOM order below. */
const NAV_GROUPS = [
    [
        { id: "overview", label: "Project Overview", icon: BookOpen01 },
        { id: "features", label: "Features", icon: Zap },
        { id: "links", label: "Links", icon: LinkExternal01 },
    ],
    [
        { id: "todo", label: "To-do", icon: CheckDone01 },
        { id: "questions", label: "Questions", icon: HelpCircle },
        { id: "roadmap", label: "Roadmap", icon: Flag05 },
    ],
    [
        { id: "timeline", label: "Timeline", icon: Hourglass01 },
    ],
];
// "Links" swaps the whole main pane to a separate directory view (see activeView
// below) instead of being a scroll-to section, so it's excluded from the
// scroll-spy's section list.
const SECTIONS = NAV_GROUPS.flat().filter((s) => s.id !== "links");

const inputCls =
    "w-full rounded-lg border border-primary bg-primary px-3 py-2 text-sm text-primary placeholder:text-placeholder focus:border-brand focus:outline-none";

/** Wraps a whole page section in its own bordered "topic" card with a corner
    label — so scrolling the page reads as moving through distinct blocks
    (Overview, Features, To-do, …) instead of continuously flowing text. */
const SectionCard = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex h-full flex-col">
        <span className="mb-8 inline-flex w-fit items-center rounded-full bg-primary-solid px-4 py-1.5 text-xs font-bold tracking-wide text-white uppercase shadow-sm">
            {label}
        </span>
        <div className="flex-1 rounded-2xl border border-secondary bg-[#FAFAFA] p-6 sm:p-8 dark:bg-secondary">{children}</div>
    </div>
);

/** Separate directory view (not a scroll section) listing every page/template/client
 * page ever created on this site — static routes plus everything sourced from
 * Supabase, reusing the same enumeration the sitewide search dropdown uses. */
const LinksView = ({
    items,
    loading,
    editing,
    starred,
    onToggleStar,
}: {
    items: SearchItem[];
    loading: boolean;
    editing: boolean;
    starred: string[];
    onToggleStar: (id: string) => void;
}) => {
    const navigate = useNavigate();

    const go = (item: SearchItem) => {
        const p = item.path;
        if (/^https?:\/\//i.test(p)) {
            window.open(p, "_blank", "noopener");
            return;
        }
        navigate(p.startsWith("/") ? p : "/" + p);
    };

    const groups = new Map<string, SearchItem[]>();
    for (const item of items) {
        if (!groups.has(item.kind)) groups.set(item.kind, []);
        groups.get(item.kind)!.push(item);
    }
    const starredItems = items.filter((item) => starred.includes(item.id));

    const LinkCard = ({ item }: { item: SearchItem }) => {
        const isStarred = starred.includes(item.id);
        return (
            <div className="group relative">
                <button
                    type="button"
                    onClick={() => go(item)}
                    className="flex w-full items-start gap-3 rounded-xl border border-secondary bg-primary p-3.5 text-left transition duration-100 ease-linear hover:border-brand/40 hover:bg-secondary"
                >
                    <item.icon className="mt-0.5 size-4 shrink-0 text-fg-quaternary" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-primary">{item.title}</p>
                        {item.subtitle && <p className="truncate text-xs text-tertiary">{item.subtitle}</p>}
                        <p className="mt-0.5 truncate text-xs text-quaternary">{item.path}</p>
                    </div>
                    <LinkExternal01 className="mt-0.5 size-3.5 shrink-0 text-fg-quaternary opacity-0 transition duration-100 ease-linear group-hover:opacity-100" aria-hidden="true" />
                </button>
                {editing ? (
                    <button
                        type="button"
                        title={isStarred ? "Unstar" : "Star as important"}
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleStar(item.id);
                        }}
                        className={cx(
                            "absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full border shadow-xs transition duration-100 ease-linear",
                            isStarred
                                ? "border-warning-primary bg-warning-solid text-white"
                                : "border-secondary bg-primary text-fg-quaternary opacity-0 group-hover:opacity-100 hover:text-fg-warning-primary",
                        )}
                    >
                        <Star01 className="size-3.5" fill={isStarred ? "currentColor" : "none"} aria-hidden="true" />
                    </button>
                ) : (
                    isStarred && (
                        <span className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full border border-warning-primary bg-warning-solid text-white shadow-xs">
                            <Star01 className="size-3.5" fill="currentColor" aria-hidden="true" />
                        </span>
                    )
                )}
            </div>
        );
    };

    return (
        <div className="mx-auto w-full max-w-3xl px-6 py-10">
            <h1 className="text-lg font-semibold text-primary">Links</h1>
            <p className="mt-1 text-sm text-tertiary">
                Every page, template, and client page created on this site — grouped by type.
                {editing && " Hover a card and click the star to mark it important."}
            </p>

            {loading ? (
                <div className="mt-8 flex h-32 items-center justify-center text-sm text-tertiary">Loading…</div>
            ) : (
                <div className="mt-8 flex flex-col gap-8">
                    {starredItems.length > 0 && (
                        <div>
                            <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold tracking-widest text-warning-primary uppercase">
                                <Star01 className="size-3.5" fill="currentColor" aria-hidden="true" /> Starred <span className="text-quaternary">({starredItems.length})</span>
                            </p>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                {starredItems.map((item) => (
                                    <LinkCard key={item.id} item={item} />
                                ))}
                            </div>
                        </div>
                    )}
                    {[...groups.entries()].map(([kind, kindItems]) => (
                        <div key={kind}>
                            <p className="mb-3 text-xs font-semibold tracking-widest text-quaternary uppercase">
                                {kind} <span className="text-quaternary">({kindItems.length})</span>
                            </p>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                {kindItems.map((item) => (
                                    <LinkCard key={item.id} item={item} />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export const RoadmapScreen = () => {
    const [data, setData] = useState<RoadmapData>(DEFAULT_DATA);
    const [editing, setEditing] = useState(false);
    const { collapsed: navCollapsed, toggle: toggleNav } = useNavCollapsed();
    const [loading, setLoading] = useState(true);
    const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
    const [activeSection, setActiveSection] = useState("overview");
    // "Links" swaps the main pane to a separate directory view instead of
    // scrolling to a section — everything else stays on the long-scroll doc.
    // Kept in the URL (?view=links) so the browser Back button restores it after
    // clicking through to a link instead of resetting to the top of the page.
    const [searchParams, setSearchParams] = useSearchParams();
    const [activeView, setActiveView] = useState<"scroll" | "links">(searchParams.get("view") === "links" ? "links" : "scroll");
    const [linkItems, setLinkItems] = useState<SearchItem[]>([]);
    const [linksLoaded, setLinksLoaded] = useState(false);
    const [linksLoading, setLinksLoading] = useState(false);
    const mainRef = useRef<HTMLDivElement>(null);
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Latest data for the Shift+S flush (the keydown listener is bound once).
    const dataRef = useRef(data);
    dataRef.current = data;

    useEffect(() => {
        let cancelled = false;
        readSopPage(ROADMAP_SLUG)
            .then((row: any) => {
                const stored = row?.data;
                if (!cancelled && stored?.roadmap && stored?.log) {
                    // Rows saved before newer sections existed fall back to the seed content.
                    setData({
                        ...stored,
                        overview: stored.overview ?? DEFAULT_DATA.overview,
                        todos: stored.todos ?? DEFAULT_DATA.todos,
                        questions: stored.questions ?? DEFAULT_DATA.questions,
                        starredLinks: stored.starredLinks ?? DEFAULT_DATA.starredLinks,
                    });
                }
            })
            .catch(() => {
                /* No saved row yet — keep the seed content. */
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    // Shift+E toggles edit mode; Shift+S flushes the pending save and locks.
    useEditShortcuts({
        onToggle: () => setEditing((v) => !v),
        onSave: () => {
            if (saveTimer.current) clearTimeout(saveTimer.current);
            setSaveState("saving");
            writeSopPage(ROADMAP_SLUG, dataRef.current)
                .then(() => setSaveState("saved"))
                .catch(() => setSaveState("error"));
            setEditing(false);
        },
    });

    /** Update state immediately, persist (debounced) to Supabase. */
    const persist = (next: RoadmapData) => {
        setData(next);
        setSaveState("saving");
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
            writeSopPage(ROADMAP_SLUG, next)
                .then(() => setSaveState("saved"))
                .catch(() => setSaveState("error"));
        }, 600);
    };

    const toggleStarLink = (id: string) => {
        const starred = data.starredLinks ?? [];
        persist({ ...data, starredLinks: starred.includes(id) ? starred.filter((x) => x !== id) : [...starred, id] });
    };

    // Overview ops
    const updateOverview = (patch: Partial<OverviewData>) => persist({ ...data, overview: { ...data.overview, ...patch } });
    const addFeature = (col: FeatureCol) => updateOverview({ [col]: [...data.overview[col], { id: uid(), text: "" }] });
    const updateFeature = (col: FeatureCol, id: string, patch: Partial<FeatureItem>) =>
        updateOverview({ [col]: data.overview[col].map((f) => (f.id === id ? { ...f, ...patch } : f)) });
    const deleteFeature = (col: FeatureCol, id: string) => updateOverview({ [col]: data.overview[col].filter((f) => f.id !== id) });

    // Feature detail panel
    const [openFeature, setOpenFeature] = useState<{ col: FeatureCol; id: string } | null>(null);
    const featureDetail = openFeature ? data.overview[openFeature.col].find((f) => f.id === openFeature.id) : null;

    // Answered questions collapse into "Resolved / History" so the open list stays focused.
    const [showResolvedQs, setShowResolvedQs] = useState(false);

    // Roadmap item ops
    const addItem = (tier: Tier) => persist({ ...data, roadmap: [...data.roadmap, { id: uid(), tier, title: "", description: "" }] });
    const updateItem = (id: string, patch: Partial<RoadmapItem>) =>
        persist({ ...data, roadmap: data.roadmap.map((it) => (it.id === id ? { ...it, ...patch } : it)) });
    const deleteItem = (id: string) => persist({ ...data, roadmap: data.roadmap.filter((it) => it.id !== id) });

    // Log entry ops
    const addEntry = () => persist({ ...data, log: [{ id: uid(), date: todayIso(), title: "", description: "" }, ...data.log] });
    const updateEntry = (id: string, patch: Partial<LogEntry>) => persist({ ...data, log: data.log.map((en) => (en.id === id ? { ...en, ...patch } : en)) });
    const deleteEntry = (id: string) => persist({ ...data, log: data.log.filter((en) => en.id !== id) });

    // Todo ops (checking off works even when locked; text edits need unlock)
    const toggleTodo = (id: string, done: boolean) => persist({ ...data, todos: data.todos.map((t) => (t.id === id ? { ...t, done } : t)) });
    const updateTodo = (id: string, text: string) => persist({ ...data, todos: data.todos.map((t) => (t.id === id ? { ...t, text } : t)) });
    const addTodo = () => persist({ ...data, todos: [...data.todos, { id: uid(), text: "", done: false }] });
    const deleteTodo = (id: string) => persist({ ...data, todos: data.todos.filter((t) => t.id !== id) });

    // Question ops
    const updateQuestion = (id: string, patch: Partial<QuestionItem>) =>
        persist({ ...data, questions: data.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)) });
    const addQuestion = () => persist({ ...data, questions: [...data.questions, { id: uid(), question: "", answer: "", resolved: false }] });
    const deleteQuestion = (id: string) => persist({ ...data, questions: data.questions.filter((q) => q.id !== id) });
    const handleQuestionImage = (id: string, e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        void compressImageFile(file).then((img) => updateQuestion(id, { image: img }));
        e.target.value = "";
    };

    // One question card — plain render helper (NOT a component) so it reconciles in
    // place and never remounts/loses input focus while typing. Reused for the open
    // list and the collapsed Resolved / History list. `resolved` tints answered ones.
    const renderQuestionCard = (q: RoadmapData["questions"][number], displayIndex: number, resolved: boolean) => (
        <div key={q.id} className={cx("rounded-xl border border-secondary p-4 shadow-xs", resolved ? "bg-secondary" : "bg-primary")}>
            <div className="flex items-start gap-3">
                <button type="button" title={resolved ? "Mark as unresolved" : "Mark as resolved"}
                    onClick={() => updateQuestion(q.id, { resolved: !resolved })}
                    className={cx(
                        "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border transition duration-100 ease-linear",
                        resolved ? "border-success bg-success-solid text-white" : "border-secondary bg-primary hover:border-brand",
                    )}>
                    {resolved && <Check className="size-3" aria-hidden="true" />}
                </button>
                <div className="min-w-0 flex-1">
            {editing ? (
                <div className="flex items-start gap-3">
                    <div className="flex flex-1 flex-col gap-2">
                        <input
                            className={inputCls}
                            value={q.question}
                            placeholder="Question"
                            onChange={(e) => updateQuestion(q.id, { question: e.target.value })}
                        />
                        <textarea
                            className={cx(inputCls, "resize-none")}
                            rows={2}
                            value={q.answer}
                            placeholder="Your answer…"
                            onChange={(e) => updateQuestion(q.id, { answer: e.target.value })}
                        />
                        {q.image ? (
                            <div className="relative w-fit">
                                <img src={q.image} alt="Attached" className="max-h-64 rounded-lg border border-secondary" />
                                <button
                                    type="button"
                                    title="Remove image"
                                    onClick={() => updateQuestion(q.id, { image: undefined })}
                                    className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full border border-secondary bg-primary text-fg-quaternary shadow-xs transition duration-100 ease-linear hover:bg-error-primary hover:text-fg-error-primary"
                                >
                                    <XClose className="size-3.5" aria-hidden="true" />
                                </button>
                            </div>
                        ) : (
                            <label className="flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-dashed border-primary px-3 py-1.5 text-xs font-medium text-tertiary transition duration-100 ease-linear hover:border-brand hover:text-brand-secondary">
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => handleQuestionImage(q.id, e)}
                                />
                                <Image01 className="size-4" aria-hidden="true" />
                                Add image
                            </label>
                        )}
                        <VideoAttach value={q.video} onChange={(v) => updateQuestion(q.id, { video: v })} />
                    </div>
                    <button
                        type="button"
                        title="Delete question"
                        onClick={() => deleteQuestion(q.id)}
                        className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg text-fg-quaternary transition duration-100 ease-linear hover:bg-error-primary hover:text-fg-error-primary"
                    >
                        <Trash01 className="size-4" aria-hidden="true" />
                    </button>
                </div>
            ) : (
                <>
                    <h3 className="text-sm font-semibold text-primary">
                        {displayIndex + 1}. {q.question ? renderHighlights(q.question) : "Untitled question"}
                    </h3>
                    <p className={cx("mt-1.5 text-sm", q.answer ? "text-tertiary" : "text-placeholder italic")}>
                        {q.answer ? renderHighlights(q.answer) : "No answer yet — unlock to answer"}
                    </p>
                    {q.image && <img src={q.image} alt="Attached" className="mt-3 max-h-64 rounded-lg border border-secondary" />}
                    {q.video && <VideoEmbed url={q.video} className="mt-3" />}
                </>
            )}
                </div>
                <PriorityFlag value={q.priority} onChange={(v) => updateQuestion(q.id, { priority: v })} />
            </div>
        </div>
    );

    const scrollTo = (id: string) => {
        const comingFromLinks = activeView === "links";
        setActiveView("scroll");
        setActiveSection(id);
        // Scroll ONLY the content container — scrollIntoView would also scroll the
        // overflow-hidden page root and drag the icon rail / side menu out of view.
        const doScroll = () => {
            const el = document.getElementById(`roadmap-section-${id}`);
            const container = mainRef.current;
            if (!el || !container) return;
            const top = el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - 24;
            container.scrollTo({ top: Math.max(0, top), behavior: comingFromLinks ? "auto" : "smooth" });
        };
        // Coming back from the Links view swaps the whole pane back in — the section
        // anchors don't exist in the DOM yet at click-time, so wait for the re-render
        // to commit and paint before measuring/scrolling.
        if (comingFromLinks) requestAnimationFrame(() => requestAnimationFrame(doScroll));
        else doScroll();
    };

    const openLinks = () => setActiveView("links");

    // Load the links directory whenever the Links view becomes active — covers
    // both the nav click and landing here directly via a restored ?view=links URL
    // (e.g. the browser Back button after following a link out).
    useEffect(() => {
        if (activeView !== "links" || linksLoaded) return;
        setLinksLoaded(true);
        setLinksLoading(true);
        fetchDynamicSearchItems()
            .then((dynamic) => setLinkItems([...STATIC_ITEMS, ...dynamic]))
            .finally(() => setLinksLoading(false));
    }, [activeView, linksLoaded]);

    // Keep the URL in sync with the Links view so the browser Back button restores
    // it after clicking through to a link, instead of resetting to the top of the
    // page. replace: true keeps every view switch out of the history stack.
    useEffect(() => {
        const next = new URLSearchParams(searchParams);
        if (activeView === "links") next.set("view", "links");
        else next.delete("view");
        if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeView]);

    // Scroll-spy: as the page scrolls, highlight the side-menu item for the section
    // currently in view (the last heading above the top ~40% of the pane; at the
    // very bottom the final section wins so it's reachable even when short).
    useEffect(() => {
        const main = mainRef.current;
        if (!main) return;
        const onScroll = () => {
            let current = SECTIONS[0].id;
            if (main.scrollTop + main.clientHeight >= main.scrollHeight - 8) {
                current = SECTIONS[SECTIONS.length - 1].id;
            } else {
                const mainTop = main.getBoundingClientRect().top;
                for (const s of SECTIONS) {
                    const el = document.getElementById(`roadmap-section-${s.id}`);
                    if (el && el.getBoundingClientRect().top - mainTop <= main.clientHeight * 0.4) current = s.id;
                }
            }
            setActiveSection(current);
        };
        main.addEventListener("scroll", onScroll, { passive: true });
        onScroll();
        return () => main.removeEventListener("scroll", onScroll);
    }, []);

    // Timeline grouped by date, newest first
    const sortedLog = [...data.log].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    const logByDate = sortedLog.reduce<Record<string, LogEntry[]>>((acc, en) => {
        (acc[en.date] ??= []).push(en);
        return acc;
    }, {});
    const shippedCount = data.log.length;
    const doneCount = data.todos.filter((t) => t.done).length;
    const answeredCount = data.questions.filter((q) => q.answer?.trim()).length;
    // Explicit `resolved` flag is the source of truth; questions saved before this
    // field existed fall back to "has an answer" so their current Resolved/Open
    // placement doesn't change until someone touches the checkbox.
    const isQuestionResolved = (q: QuestionItem) => q.resolved ?? !!q.answer?.trim();
    const openQuestions = data.questions.filter((q) => !isQuestionResolved(q));
    const resolvedQuestions = data.questions.filter(isQuestionResolved);

    return (
        <AppShell
            highlightScope
            className="flex flex-col"
            rail={!navCollapsed && <IconRail activeDept="docs" bottom={<RailBottom editing={editing} onToggleEditing={() => setEditing((e) => !e)} />} />}
            breadcrumb={[
                { label: "Dashboard", to: "/dashboard", icon: LayoutAlt01 },
                { label: "Manual", to: "/manual", icon: BookOpen01 },
                { label: "Project Management" },
            ]}
        >
            <HighlightPen enabled={editing} />
            {navCollapsed && <CollapsedTopBar title="Project Management" onExpand={toggleNav} />}
            <div className="flex min-h-0 flex-1 gap-2 bg-secondary p-2">
                {/* Side menu */}
                {!navCollapsed && (
                    <aside className="flex w-[240px] shrink-0 flex-col overflow-hidden rounded-lg bg-primary shadow-sm">
                        <div className="flex h-[73px] shrink-0 items-center justify-between border-b border-secondary px-5">
                            <h2 className="text-md font-semibold text-primary">Project Management</h2>
                            <NavCollapseButton onClick={toggleNav} />
                        </div>
                        <motion.nav
                            className="flex flex-col gap-1 p-3"
                            initial="hidden"
                            animate="show"
                            variants={{ show: { transition: { staggerChildren: 0.05 } } }}
                        >
                            {NAV_GROUPS.map((group, gi) => (
                                <div key={gi} className="flex flex-col gap-1">
                                    {/* Divider between groups (macOS System Settings style) */}
                                    {gi > 0 && <div className="mx-3 my-2 h-px bg-border-secondary" />}
                                    {group.map((s) => (
                                        <motion.div
                                            key={s.id}
                                            variants={{
                                                hidden: { opacity: 0, x: -10 },
                                                show: { opacity: 1, x: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
                                            }}
                                        >
                                            <button
                                                type="button"
                                                onClick={() => (s.id === "links" ? openLinks() : scrollTo(s.id))}
                                                className={cx(
                                                    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition duration-100 ease-linear",
                                                    (activeView === "links" ? s.id === "links" : activeSection === s.id)
                                                        ? "bg-secondary_hover text-primary"
                                                        : "text-secondary hover:bg-primary_hover hover:text-primary",
                                                )}
                                            >
                                                <s.icon className="size-4 text-fg-quaternary" aria-hidden="true" />
                                                {s.label}
                                            </button>
                                        </motion.div>
                                    ))}
                                </div>
                            ))}
                        </motion.nav>
                    </aside>
                )}

                {/* Main content */}
                <main className="flex min-w-0 flex-1 flex-col">
                    <div ref={mainRef} className="flex-1 overflow-y-auto overflow-x-hidden rounded-lg bg-primary shadow-sm">
                        <PageBanner
                            breadcrumb={[
                                { label: "Dashboard", to: "/dashboard", icon: LayoutAlt01 },
                                { label: "Manual", to: "/manual", icon: BookOpen01 },
                                { label: "Project Management" },
                            ]}
                            title="Project Management"
                            subtitle={loading ? "Loading…" : `${shippedCount} update${shippedCount !== 1 ? "s" : ""} shipped`}
                            imageUrl={data.bannerUrl}
                            editing={editing}
                            onImageChange={(url) => persist({ ...data, bannerUrl: url || undefined })}
                            actions={
                                saveState !== "idle" ? (
                                    <Badge size="md" type="pill-color" color={saveState === "error" ? "error" : saveState === "saving" ? "gray" : "success"}>
                                        {saveState === "saving" ? "Saving…" : saveState === "error" ? "Save failed" : "Saved"}
                                    </Badge>
                                ) : undefined
                            }
                        />
                        {activeView === "links" ? (
                            <LinksView items={linkItems} loading={linksLoading} editing={editing} starred={data.starredLinks ?? []} onToggleStar={toggleStarLink} />
                        ) : (
                        <div className="mx-auto w-full max-w-[1600px] px-6 py-10">
                            {/* ——— Row 1: Overview + Features (paired so the two shorter sections
                                sit side by side instead of leaving empty space) ——— */}
                            <div className="grid grid-cols-1 items-stretch justify-center gap-6 lg:grid-cols-[45%_45%]">
                            {/* ——— Project Overview ——— */}
                            <motion.section
                                initial={{ opacity: 0, y: 16 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: "-40px" }}
                                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                                id="roadmap-section-overview"
                                className="scroll-mt-6"
                            >
                                <SectionCard label="Overview">
                                    <div className="flex items-center gap-2.5">
                                        <BookOpen01 className="size-5 text-fg-brand-primary" aria-hidden="true" />
                                        <h2 className="text-display-xs font-semibold text-primary">Project Overview</h2>
                                    </div>

                                    <div className="mt-5 rounded-xl border border-secondary bg-primary p-5 shadow-xs">
                                        {editing ? (
                                            <textarea
                                                className={cx(inputCls, "resize-none")}
                                                rows={6}
                                                value={data.overview.paragraph}
                                                placeholder="What is this project? Who is it for? How does it work?"
                                                onChange={(e) => updateOverview({ paragraph: e.target.value })}
                                            />
                                        ) : (
                                            <p className="text-sm leading-6 whitespace-pre-line text-tertiary">{renderHighlights(data.overview.paragraph)}</p>
                                        )}
                                    </div>
                                </SectionCard>
                            </motion.section>

                            {/* ——— Features ——— */}
                            <motion.section
                                initial={{ opacity: 0, y: 16 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: "-40px" }}
                                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                                id="roadmap-section-features"
                                className="scroll-mt-6"
                            >
                                <SectionCard label="Features">
                                    <div className="flex items-center gap-2.5">
                                        <Zap className="size-5 text-fg-brand-primary" aria-hidden="true" />
                                        <h2 className="text-display-xs font-semibold text-primary">Features</h2>
                                    </div>
                                    <p className="mt-1 text-sm text-tertiary">Everything the site does — click a feature for details & approval.</p>

                                    <div className="mt-6 grid grid-cols-2 gap-6 max-md:grid-cols-1">
                                        {(
                                            [
                                                { col: "internalFeatures", title: "Internal Dashboard Features" },
                                                { col: "clientFeatures", title: "Client Dashboard Features" },
                                            ] as const
                                        ).map(({ col, title }) => (
                                            <div key={col}>
                                                <div className="flex items-center justify-between">
                                                    <h4 className="text-sm font-semibold text-secondary">{title}</h4>
                                                    {editing && (
                                                        <button
                                                            type="button"
                                                            onClick={() => addFeature(col)}
                                                            className="flex items-center gap-1 text-xs font-semibold text-brand-secondary transition duration-100 ease-linear hover:text-brand-secondary_hover"
                                                        >
                                                            <Plus className="size-3.5" aria-hidden="true" /> Add
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="mt-2 rounded-xl border border-secondary bg-primary p-4 shadow-xs">
                                                    <div className="flex flex-col gap-2.5">
                                                        {data.overview[col].length === 0 && !editing && (
                                                            <p className="text-sm text-quaternary">Nothing listed yet.</p>
                                                        )}
                                                        {data.overview[col].map((f) =>
                                                            editing ? (
                                                                <div key={f.id} className="flex items-center gap-2">
                                                                    <input
                                                                        className={cx(inputCls, "px-2.5 py-1.5 text-xs")}
                                                                        value={f.text}
                                                                        placeholder="Feature"
                                                                        onChange={(e) => updateFeature(col, f.id, { text: e.target.value })}
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        title="Open details"
                                                                        onClick={() => setOpenFeature({ col, id: f.id })}
                                                                        className="flex size-7 shrink-0 items-center justify-center rounded-md text-fg-quaternary transition duration-100 ease-linear hover:bg-primary_hover hover:text-fg-secondary"
                                                                    >
                                                                        <ChevronRight className="size-3.5" aria-hidden="true" />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        title="Delete feature"
                                                                        onClick={() => deleteFeature(col, f.id)}
                                                                        className="flex size-7 shrink-0 items-center justify-center rounded-md text-fg-quaternary transition duration-100 ease-linear hover:bg-error-primary hover:text-fg-error-primary"
                                                                    >
                                                                        <Trash01 className="size-3.5" aria-hidden="true" />
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    key={f.id}
                                                                    type="button"
                                                                    onClick={() => setOpenFeature({ col, id: f.id })}
                                                                    className={cx(
                                                                        "group -mx-2 flex items-start gap-2.5 rounded-lg px-2 py-1.5 text-left transition duration-100 ease-linear",
                                                                        f.approval === "approved"
                                                                            ? "bg-success-primary hover:opacity-80"
                                                                            : "hover:bg-primary_hover",
                                                                    )}
                                                                >
                                                                    {f.approval === "rejected" ? (
                                                                        <XCircle
                                                                            className="mt-0.5 size-4 shrink-0 text-fg-error-secondary"
                                                                            aria-hidden="true"
                                                                        />
                                                                    ) : (
                                                                        <CheckCircle
                                                                            className={cx(
                                                                                "mt-0.5 size-4 shrink-0",
                                                                                f.approval === "approved" ? "text-fg-success-primary" : "text-fg-quaternary",
                                                                            )}
                                                                            aria-hidden="true"
                                                                        />
                                                                    )}
                                                                    <span
                                                                        className={cx(
                                                                            "flex-1 text-sm",
                                                                            f.approval === "approved" ? "text-quaternary line-through" : "text-secondary",
                                                                        )}
                                                                    >
                                                                        {f.text ? renderHighlights(f.text) : "Untitled"}
                                                                    </span>
                                                                    <ChevronRight
                                                                        className="mt-0.5 size-4 shrink-0 text-fg-quaternary opacity-0 transition duration-100 ease-linear group-hover:opacity-100"
                                                                        aria-hidden="true"
                                                                    />
                                                                </button>
                                                            ),
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </SectionCard>
                            </motion.section>
                            </div>

                            {/* ——— Row 2: To-do + Questions ——— */}
                            <div className="mt-16 grid grid-cols-1 items-stretch justify-center gap-6 lg:grid-cols-[45%_45%]">
                            {/* ——— To-do ——— */}
                            <motion.section
                                initial={{ opacity: 0, y: 16 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: "-40px" }}
                                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                                id="roadmap-section-todo"
                                className="scroll-mt-6"
                            >
                                <SectionCard label="To-do">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="flex items-center gap-2.5">
                                                <CheckDone01 className="size-5 text-fg-brand-primary" aria-hidden="true" />
                                                <h2 className="text-display-xs font-semibold text-primary">To-do</h2>
                                                <Badge
                                                    size="md"
                                                    type="pill-color"
                                                    color={doneCount === data.todos.length && data.todos.length > 0 ? "success" : "gray"}
                                                >
                                                    {doneCount}/{data.todos.length} done
                                                </Badge>
                                            </div>
                                            <p className="mt-1 text-sm text-tertiary">Concrete actions to improve this site. Check them off as they ship.</p>
                                        </div>
                                        {editing && (
                                            <Button size="sm" color="secondary" iconLeading={Plus} onClick={addTodo}>
                                                Add
                                            </Button>
                                        )}
                                    </div>

                                    <div className="mt-6 flex flex-col gap-2">
                                        {data.todos.map((todo) => (
                                            <div key={todo.id} className="flex items-start gap-3 rounded-xl border border-secondary bg-primary p-4 shadow-xs">
                                                <Checkbox size="md" isSelected={todo.done} onChange={(v) => toggleTodo(todo.id, v)} />
                                                {editing ? (
                                                    <>
                                                        <textarea
                                                            className={cx(inputCls, "resize-none")}
                                                            rows={2}
                                                            value={todo.text}
                                                            placeholder="What needs doing?"
                                                            onChange={(e) => updateTodo(todo.id, e.target.value)}
                                                        />
                                                        <button
                                                            type="button"
                                                            title="Delete to-do"
                                                            onClick={() => deleteTodo(todo.id)}
                                                            className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg text-fg-quaternary transition duration-100 ease-linear hover:bg-error-primary hover:text-fg-error-primary"
                                                        >
                                                            <Trash01 className="size-4" aria-hidden="true" />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <p className={cx("text-sm leading-6", todo.done ? "text-quaternary line-through" : "text-secondary")}>
                                                        {todo.text ? renderHighlights(todo.text) : "Untitled"}
                                                    </p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </SectionCard>
                            </motion.section>

                            {/* ——— Questions to move forward ——— */}
                            <motion.section
                                initial={{ opacity: 0, y: 16 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: "-40px" }}
                                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                                id="roadmap-section-questions"
                                className="scroll-mt-6"
                            >
                                <SectionCard label="Questions">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="flex items-center gap-2.5">
                                                <HelpCircle className="size-5 text-fg-brand-primary" aria-hidden="true" />
                                                <h2 className="text-display-xs font-semibold text-primary">Questions to move forward</h2>
                                                <Badge
                                                    size="md"
                                                    type="pill-color"
                                                    color={answeredCount === data.questions.length && data.questions.length > 0 ? "success" : "gray"}
                                                >
                                                    {answeredCount}/{data.questions.length} answered
                                                </Badge>
                                            </div>
                                            <p className="mt-1 text-sm text-tertiary">
                                                Decisions we need from you before the next round of work. Unlock to answer.
                                            </p>
                                        </div>
                                        {editing && (
                                            <Button size="sm" color="secondary" iconLeading={Plus} onClick={addQuestion}>
                                                Add
                                            </Button>
                                        )}
                                    </div>

                                    {/* Open questions — the ones still needing a decision */}
                                    <div className="mt-6 flex flex-col gap-3">
                                        {openQuestions.length === 0 && !editing ? (
                                            <p className="rounded-xl border border-secondary bg-primary p-4 text-sm italic text-quaternary shadow-xs">
                                                All questions answered — nothing blocking the next round.
                                            </p>
                                        ) : (
                                            openQuestions.map((q) => renderQuestionCard(q, data.questions.findIndex((x) => x.id === q.id), false))
                                        )}
                                    </div>

                                    {/* Resolved / History — answered questions collapse here so the open list stays focused */}
                                    {resolvedQuestions.length > 0 && (
                                        <div className="mt-4">
                                            <button
                                                type="button"
                                                onClick={() => setShowResolvedQs((s) => !s)}
                                                aria-expanded={showResolvedQs || editing}
                                                className="flex w-full items-center gap-2.5 rounded-xl bg-secondary px-4 py-3 text-left text-sm font-semibold text-secondary transition duration-100 ease-linear hover:bg-secondary_hover"
                                            >
                                                <ChevronDown
                                                    className={cx("size-4 shrink-0 text-fg-quaternary transition-transform duration-200", (showResolvedQs || editing) && "rotate-180")}
                                                    aria-hidden="true"
                                                />
                                                <span className="flex-1">Resolved / History</span>
                                                <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-tertiary tabular-nums ring-1 ring-secondary">
                                                    {resolvedQuestions.length}
                                                </span>
                                            </button>
                                            <AnimatePresence initial={false}>
                                                {(showResolvedQs || editing) && (
                                                    <motion.div
                                                        key="resolved-qs"
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: "auto", opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                                                        className="overflow-hidden"
                                                    >
                                                        <div className="mt-3 flex flex-col gap-3">
                                                            {resolvedQuestions.map((q) => renderQuestionCard(q, data.questions.findIndex((x) => x.id === q.id), true))}
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    )}
                                </SectionCard>
                            </motion.section>
                            </div>

                            {/* ——— Row 3: Roadmap + Timeline ——— */}
                            <div className="mt-16 grid grid-cols-1 items-stretch justify-center gap-6 lg:grid-cols-[45%_45%]">
                            {/* ——— Roadmap ——— */}
                            <motion.section
                                initial={{ opacity: 0, y: 16 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: "-40px" }}
                                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                                id="roadmap-section-roadmap"
                                className="scroll-mt-6"
                            >
                                <SectionCard label="Roadmap">
                                    <div className="flex items-center gap-2.5">
                                        <Flag05 className="size-5 text-fg-brand-primary" aria-hidden="true" />
                                        <h2 className="text-display-xs font-semibold text-primary">Roadmap</h2>
                                    </div>
                                    <p className="mt-1 text-sm text-tertiary">What we're building for this site, in priority order.</p>

                                    <div className="mt-8 flex flex-col gap-10">
                                        {TIERS.map((tier) => {
                                            const items = data.roadmap.filter((it) => it.tier === tier.id);
                                            return (
                                                <div key={tier.id}>
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <BadgeWithDot color={tier.badgeColor} type="pill-color" size="md">
                                                                {tier.label}
                                                            </BadgeWithDot>
                                                            <span className="text-sm text-quaternary">{tier.blurb}</span>
                                                        </div>
                                                        {editing && (
                                                            <Button size="sm" color="secondary" iconLeading={Plus} onClick={() => addItem(tier.id)}>
                                                                Add
                                                            </Button>
                                                        )}
                                                    </div>

                                                    <div className="mt-3 flex flex-col gap-3">
                                                        {items.length === 0 && !editing && (
                                                            <p className="rounded-xl border border-dashed border-secondary px-4 py-3 text-sm text-quaternary">
                                                                Nothing here yet.
                                                            </p>
                                                        )}
                                                        {items.map((item) => (
                                                            <div key={item.id} className="rounded-xl border border-secondary bg-primary p-4 shadow-xs">
                                                                {editing ? (
                                                                    <div className="flex items-start gap-3">
                                                                        <div className="flex flex-1 flex-col gap-2">
                                                                            <input
                                                                                className={inputCls}
                                                                                value={item.title}
                                                                                placeholder="Title"
                                                                                onChange={(e) => updateItem(item.id, { title: e.target.value })}
                                                                            />
                                                                            <textarea
                                                                                className={cx(inputCls, "resize-none")}
                                                                                rows={2}
                                                                                value={item.description}
                                                                                placeholder="Short description"
                                                                                onChange={(e) => updateItem(item.id, { description: e.target.value })}
                                                                            />
                                                                        </div>
                                                                        <button
                                                                            type="button"
                                                                            title="Delete item"
                                                                            onClick={() => deleteItem(item.id)}
                                                                            className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg text-fg-quaternary transition duration-100 ease-linear hover:bg-error-primary hover:text-fg-error-primary"
                                                                        >
                                                                            <Trash01 className="size-4" aria-hidden="true" />
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <>
                                                                        <h3 className="text-sm font-semibold text-primary">
                                                                            {item.title ? renderHighlights(item.title) : "Untitled"}
                                                                        </h3>
                                                                        {item.description && (
                                                                            <p className="mt-1 text-sm text-tertiary">{renderHighlights(item.description)}</p>
                                                                        )}
                                                                    </>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </SectionCard>
                            </motion.section>

                            {/* ——— Timeline ——— */}
                            <motion.section
                                initial={{ opacity: 0, y: 16 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: "-40px" }}
                                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                                id="roadmap-section-timeline"
                                className="scroll-mt-6 pb-6"
                            >
                                <SectionCard label="Timeline">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="flex items-center gap-2.5">
                                                <Rocket01 className="size-5 text-fg-brand-primary" aria-hidden="true" />
                                                <h2 className="text-display-xs font-semibold text-primary">Timeline</h2>
                                            </div>
                                            <p className="mt-1 text-sm text-tertiary">Everything shipped on this site, newest first.</p>
                                        </div>
                                        {editing && (
                                            <Button size="sm" color="secondary" iconLeading={Plus} onClick={addEntry}>
                                                Add entry
                                            </Button>
                                        )}
                                    </div>

                                    <div className="relative mt-8 flex flex-col gap-10 border-l border-secondary pl-8">
                                        {Object.entries(logByDate).map(([date, entries]) => (
                                            <div key={date} className="relative">
                                                {/* Dot on the timeline */}
                                                <span className="absolute top-1 -left-[37.5px] flex size-5 items-center justify-center rounded-full bg-brand-secondary">
                                                    <span className="size-2 rounded-full bg-brand-solid" />
                                                </span>
                                                <h3 className="text-sm font-semibold text-secondary">{formatDate(date)}</h3>
                                                <div className="mt-3 flex flex-col gap-3">
                                                    {entries.map((entry) => (
                                                        <div key={entry.id} className="rounded-xl border border-secondary bg-primary p-4 shadow-xs">
                                                            {editing ? (
                                                                <div className="flex items-start gap-3">
                                                                    <div className="flex flex-1 flex-col gap-2">
                                                                        <div className="flex gap-2">
                                                                            <input
                                                                                type="date"
                                                                                className={cx(inputCls, "w-40")}
                                                                                value={entry.date}
                                                                                onChange={(e) => updateEntry(entry.id, { date: e.target.value })}
                                                                            />
                                                                            <input
                                                                                className={inputCls}
                                                                                value={entry.title}
                                                                                placeholder="What shipped?"
                                                                                onChange={(e) => updateEntry(entry.id, { title: e.target.value })}
                                                                            />
                                                                        </div>
                                                                        <textarea
                                                                            className={cx(inputCls, "resize-none")}
                                                                            rows={2}
                                                                            value={entry.description}
                                                                            placeholder="Details (optional)"
                                                                            onChange={(e) => updateEntry(entry.id, { description: e.target.value })}
                                                                        />
                                                                        <input
                                                                            className={inputCls}
                                                                            type="url"
                                                                            value={entry.link ?? ""}
                                                                            placeholder="Link to the result (optional) — https://…"
                                                                            onChange={(e) => updateEntry(entry.id, { link: e.target.value })}
                                                                        />
                                                                        <VideoAttach
                                                                            value={entry.video}
                                                                            onChange={(v) => updateEntry(entry.id, { video: v })}
                                                                        />
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        title="Delete entry"
                                                                        onClick={() => deleteEntry(entry.id)}
                                                                        className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg text-fg-quaternary transition duration-100 ease-linear hover:bg-error-primary hover:text-fg-error-primary"
                                                                    >
                                                                        <Trash01 className="size-4" aria-hidden="true" />
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-start gap-3">
                                                                    <CheckCircle
                                                                        className="mt-0.5 size-4 shrink-0 text-fg-success-primary"
                                                                        aria-hidden="true"
                                                                    />
                                                                    <div>
                                                                        <h4 className="text-sm font-semibold text-primary">
                                                                            {entry.title ? renderHighlights(entry.title) : "Untitled"}
                                                                        </h4>
                                                                        {entry.description && (
                                                                            <p className="mt-1 text-sm text-tertiary">{renderHighlights(entry.description)}</p>
                                                                        )}
                                                                        {entry.video && <VideoEmbed url={entry.video} className="mt-2" />}
                                                                        {entry.link?.trim() && (
                                                                            <Button
                                                                                href={entry.link}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                color="link-color"
                                                                                size="sm"
                                                                                iconTrailing={LinkExternal01}
                                                                                className="mt-1.5"
                                                                            >
                                                                                View result
                                                                            </Button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </SectionCard>
                            </motion.section>
                            </div>
                        </div>
                        )}
                    </div>
                </main>

                {/* ——— Feature detail slide-in panel ——— */}
                <AnimatePresence>
                    {openFeature && featureDetail && (
                        <motion.div
                            key="feature-backdrop"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            onClick={() => setOpenFeature(null)}
                            className="fixed inset-0 z-40 bg-overlay/40"
                        />
                    )}
                    {openFeature && featureDetail && (
                        <motion.aside
                            key="feature-panel"
                            initial={{ x: "100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "100%" }}
                            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                            className="fixed inset-y-0 right-0 z-50 flex w-[420px] max-w-full flex-col border-l border-secondary bg-primary shadow-xl"
                        >
                            <div className="flex h-[73px] shrink-0 items-center justify-between border-b border-secondary bg-primary px-5">
                                <div className="min-w-0">
                                    <h3 className="truncate text-md font-semibold text-primary">{featureDetail.text || "Untitled"}</h3>
                                    <p className="text-sm text-tertiary">About this feature</p>
                                </div>
                                <button
                                    type="button"
                                    title="Close"
                                    onClick={() => setOpenFeature(null)}
                                    className="flex size-9 shrink-0 items-center justify-center rounded-lg text-fg-quaternary transition duration-100 ease-linear hover:bg-primary_hover hover:text-fg-secondary"
                                >
                                    <XClose className="size-5" aria-hidden="true" />
                                </button>
                            </div>

                            <div className="flex flex-1 flex-col gap-4 overflow-y-auto bg-secondary p-4">
                                {/* Group 1 — About & Request by */}
                                <div className="divide-y divide-secondary rounded-xl border border-secondary bg-primary shadow-xs">
                                    <div className="p-4">
                                        <h4 className="text-xs font-semibold tracking-wide text-quaternary uppercase">About</h4>
                                        {editing ? (
                                            <textarea
                                                className={cx(inputCls, "mt-2 resize-none")}
                                                rows={4}
                                                value={featureDetail.about ?? ""}
                                                placeholder="What is this feature and why does it exist?"
                                                onChange={(e) => updateFeature(openFeature.col, openFeature.id, { about: e.target.value })}
                                            />
                                        ) : (
                                            <p className={cx("mt-1.5 text-sm leading-6", featureDetail.about ? "text-secondary" : "text-placeholder italic")}>
                                                {featureDetail.about ? renderHighlights(featureDetail.about) : "No description yet — unlock to edit"}
                                            </p>
                                        )}
                                    </div>
                                    <div className="p-4">
                                        <h4 className="text-xs font-semibold tracking-wide text-quaternary uppercase">Request by</h4>
                                        {editing ? (
                                            <input
                                                className={cx(inputCls, "mt-2")}
                                                value={featureDetail.requestedBy ?? ""}
                                                placeholder="Names, separated by commas"
                                                onChange={(e) => updateFeature(openFeature.col, openFeature.id, { requestedBy: e.target.value })}
                                            />
                                        ) : featureDetail.requestedBy?.trim() ? (
                                            <div className="mt-2 flex flex-wrap gap-1.5">
                                                {featureDetail.requestedBy
                                                    .split(",")
                                                    .map((n) => n.trim())
                                                    .filter(Boolean)
                                                    .map((name) => (
                                                        <Badge key={name} size="sm" type="pill-color" color="gray">
                                                            {name}
                                                        </Badge>
                                                    ))}
                                            </div>
                                        ) : (
                                            <p className="mt-1.5 text-sm text-placeholder italic">No one yet</p>
                                        )}
                                    </div>
                                </div>

                                {/* Group 2 — Ideation, Result & Approval */}
                                <div className="divide-y divide-secondary rounded-xl border border-secondary bg-primary shadow-xs">
                                    <div className="p-4">
                                        <h4 className="text-xs font-semibold tracking-wide text-quaternary uppercase">Ideation</h4>
                                        {editing ? (
                                            <textarea
                                                className={cx(inputCls, "mt-2 resize-none")}
                                                rows={5}
                                                value={featureDetail.ideation ?? ""}
                                                placeholder="Ideas, approaches, sketches…"
                                                onChange={(e) => updateFeature(openFeature.col, openFeature.id, { ideation: e.target.value })}
                                            />
                                        ) : (
                                            <p
                                                className={cx(
                                                    "mt-1.5 text-sm leading-6 whitespace-pre-line",
                                                    featureDetail.ideation ? "text-secondary" : "text-placeholder italic",
                                                )}
                                            >
                                                {featureDetail.ideation ? renderHighlights(featureDetail.ideation) : "Nothing yet"}
                                            </p>
                                        )}
                                    </div>
                                    <div className="p-4">
                                        <h4 className="text-xs font-semibold tracking-wide text-quaternary uppercase">Result</h4>
                                        {editing ? (
                                            <textarea
                                                className={cx(inputCls, "mt-2 resize-none")}
                                                rows={3}
                                                value={featureDetail.result ?? ""}
                                                placeholder="What was the outcome?"
                                                onChange={(e) => updateFeature(openFeature.col, openFeature.id, { result: e.target.value })}
                                            />
                                        ) : (
                                            <p
                                                className={cx(
                                                    "mt-1.5 text-sm leading-6 whitespace-pre-line",
                                                    featureDetail.result ? "text-secondary" : "text-placeholder italic",
                                                )}
                                            >
                                                {featureDetail.result ? renderHighlights(featureDetail.result) : "Nothing yet"}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between p-4">
                                        <h4 className="text-xs font-semibold tracking-wide text-quaternary uppercase">Approve?</h4>
                                        {editing ? (
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    color={featureDetail.approval === "approved" ? "primary" : "secondary"}
                                                    iconLeading={CheckCircle}
                                                    onClick={() =>
                                                        updateFeature(openFeature.col, openFeature.id, {
                                                            approval: featureDetail.approval === "approved" ? undefined : "approved",
                                                        })
                                                    }
                                                >
                                                    Approve
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    color={featureDetail.approval === "rejected" ? "primary-destructive" : "secondary"}
                                                    iconLeading={XClose}
                                                    onClick={() =>
                                                        updateFeature(openFeature.col, openFeature.id, {
                                                            approval: featureDetail.approval === "rejected" ? undefined : "rejected",
                                                        })
                                                    }
                                                >
                                                    Reject
                                                </Button>
                                            </div>
                                        ) : (
                                            <BadgeWithDot
                                                size="md"
                                                type="pill-color"
                                                color={
                                                    featureDetail.approval === "approved" ? "success" : featureDetail.approval === "rejected" ? "error" : "gray"
                                                }
                                            >
                                                {featureDetail.approval === "approved"
                                                    ? "Approved"
                                                    : featureDetail.approval === "rejected"
                                                      ? "Rejected"
                                                      : "Pending"}
                                            </BadgeWithDot>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </motion.aside>
                    )}
                </AnimatePresence>
            </div>
        </AppShell>
    );
};
