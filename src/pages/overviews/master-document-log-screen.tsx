import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, ArrowUpRight, BookOpen01, Check, CheckDone01, ChevronDown, Database01, FileCheck02, Flag05, HelpCircle, Hourglass01, LayoutAlt01, Plus, Send01, Shield01, Stars02, Trash01, Users01 } from "@untitledui/icons";
import { MilestonesPanel, type Milestone, type WaitingItem } from "@/components/application/milestones-panel";
import { PageBanner } from "@/components/application/page-banner";
import { AppShell, CollapsedTopBar, IconRail, NavCollapseButton, RailBottom, useNavCollapsed } from "@/components/application/icon-rail";
import { PriorityFlag, type QuestionPriority } from "@/components/application/priority-flag";
import { VideoAttach, VideoEmbed } from "@/components/application/video-block";
import { useEditShortcuts } from "@/hooks/use-edit-shortcuts";
import { supabase } from "@/lib/supabase";
import { cx } from "@/utils/cx";
import { HighlightPen, renderHighlights } from "@/utils/highlight";

/**
 * Living reference page for the Master Brand Document — the eleven-section
 * brand document on every client dashboard and the AI pipeline that drafts it
 * from the client's own material for AM review. Content persists to sop_pages
 * (slug below), mirroring the other project-log pages.
 */
const SLUG = "master-document-log";

/* ── Types ───────────────────────────────────────────────────────── */

type Stage = { label: string; detail: string };
type Todo = { id: string; text: string; done: boolean };
type QA = { id: string; question: string; answer: string; video?: string; resolved?: boolean; priority?: QuestionPriority };
type LogEntry = { id: string; date: string; title: string; description: string; video?: string };

type PageData = {
    overview: string;
    bannerUrl?: string;
    milestones: Milestone[];
    waiting: WaitingItem[];
    stages: Stage[];
    /** The seven draft groups and what each one needs. */
    groups: string[];
    rules: string[];
    todos: Todo[];
    questions: QA[];
    log: LogEntry[];
};

const uid = () => "id" + Math.random().toString(36).slice(2, 9);

function seed(): PageData {
    return {
        overview:
            "The Master Brand Document is the eleven-section, ~66-field brand document in the Brand Foundation group of every client dashboard. " +
            "It's the single source the Welcome Emails, chat widget and every future AI feature read from, so the goal is to get it complete with as little AM typing as possible. " +
            "Three team-only buttons sit on its header: \"Draft from forms & website\" (AI-drafts the document from the client's own material), \"Generate for AM review\" (compiles the answers into one readable document, with .md and PDF export), and \"Copy document\" (copies the compiled document as rich text, so pasting into a Google Doc gives real headings). " +
            "The document lives inside the dashboard's row in dashboard_pages (Supabase); drafting runs through the Netlify function generate-master-section using Claude (Fable 5).",
        milestones: [
            { id: uid(), label: "M1 · Eleven-section document live on every dashboard — completion model, AM review modal, PDF export", status: "done" },
            { id: uid(), label: "M2 · Auto-draft from the client's own material — the seven-call pipeline with live progress", status: "done" },
            { id: uid(), label: "M3 · Copy document — rich-text copy that pastes into Google Docs with real headings", status: "done" },
            { id: uid(), label: "M4 · Recorded answers join the sources — /log-script transcripts (Deepgram) feed the draft automatically", status: "done" },
        ],
        waiting: [],
        stages: [
            { label: "Client's material", detail: "Onboarding + Brand Vision forms, recordings, their website" },
            { label: "AM clicks Draft", detail: "Team-only, on an unlocked dashboard" },
            { label: "Seven Claude calls", detail: "One per field group, progress shown live" },
            { label: "Review & Save", detail: "Fills empty boxes only — AM reviews, then Save changes" },
        ],
        groups: [
            "Hosts & location — from the forms",
            "The properties — needs the client's website on file (skipped quietly without it)",
            "Audience, UVP & brand — from the forms",
            "Personas — two ranked personas with keywords, from the forms",
            "Focus properties — needs the website; listing links must be copied verbatim from the allowed links or left empty",
            "Local favorites — restaurants and activities, from the forms",
            "Reviews — only from reviews the AM pastes in (skipped when none)",
        ],
        rules: [
            "A draft fills EMPTY fields only — it never overwrites anything a person wrote. Re-running is always safe.",
            "Nothing is saved until the AM clicks Save changes. A draft lives in unsaved state on screen; closing the tab discards it.",
            "Sources are the client's own material only: the onboarding form, the Brand Vision form, transcripts of recorded answers, and their website. The model is instructed to leave a field blank rather than invent — verbatim-only for review quotes and listing links.",
            "Login credentials from the form's Account Setup section are filtered out before anything is sent to the AI.",
            "The website is read once (a no-model \"site\" step) and shared across the groups that need it. No website on file → those groups are skipped and a red warning says drafting continued without the website.",
            "The server endpoint only answers signed-in @hiddengem.media callers — a client (or anyone with the URL) can't run drafts or spend model credit.",
            "The run is seven small calls, not one big one: a synchronous Netlify function is killed at ~10 seconds, and small groups also mean better per-field quality and a failed group never spoils the other six.",
            "\"Generate for AM review\" is a deterministic compile of what's in the boxes — no AI involved — so what the AM reviews is exactly what's stored.",
        ],
        todos: [
            { id: uid(), text: "Run real client recordings through /log-script — each finished transcript automatically joins that client's draft sources", done: false },
            { id: uid(), text: "Add missing website URLs on existing client dashboards, then re-run their drafts (the property sections depend on it)", done: false },
        ],
        questions: [
            {
                id: uid(),
                question: "Should \"Generate for AM review\" stay a deterministic compile, or become a model-written narrative once the shared server-function pattern is decided?",
                answer: "",
            },
            {
                id: uid(),
                question: "When a client updates their forms after a draft, should the dashboard flag that newer source material exists?",
                answer: "",
            },
        ],
        log: [
            {
                id: uid(),
                date: "2026-08-12",
                title: "PDF export for AMs",
                description: "First shareable export of the Master Document, built client-side with jsPDF (loaded on demand so it costs nothing until clicked).",
            },
            {
                id: uid(),
                date: "2026-08-15",
                title: "Recording summaries live (/log-script)",
                description:
                    "Deepgram (nova-3, diarized) transcribes a client's recorded answer from a signed URL, Claude summarises it, and the transcript lands in script_logs — the same table the Master Document draft reads its spoken-answer sources from.",
            },
            {
                id: uid(),
                date: "2026-08-17",
                title: "Rebuilt as the eleven-section brand document",
                description:
                    "The document became the full Brand Foundation structure — hosts, properties, location, audience, UVP, brand, personas, focus properties, local favorites, reviews, website links — with a completion model and the AM review modal.",
            },
            {
                id: uid(),
                date: "2026-08-20",
                title: "Auto-draft from the client's own material",
                description:
                    "\"Draft from forms & website\" shipped: seven sequential Claude calls through generate-master-section, drafting from the forms, recordings and website with a credential filter and fill-empty-only merging. The endpoints were locked to team sign-in the same day.",
            },
            {
                id: uid(),
                date: "2026-08-20",
                title: "Copy document replaced Download PDF on the header",
                description:
                    "One click copies the whole compiled document as rich text + plain text, so pasting into a Google Doc gives a real title and numbered headings instead of raw markdown. PDF export still lives in the AM review modal. This log page was created.",
            },
        ],
    };
}

/* ── Small editable primitives ───────────────────────────────────── */

const EditArea = ({
    value,
    editing,
    onChange,
    placeholder,
    rows = 4,
    mono = false,
}: {
    value: string;
    editing: boolean;
    onChange: (v: string) => void;
    placeholder?: string;
    rows?: number;
    mono?: boolean;
}) =>
    editing ? (
        <textarea
            value={value}
            rows={rows}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            className={cx(
                "w-full resize-y rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-primary placeholder:text-placeholder outline-none transition duration-100 ease-linear focus:border-brand focus:ring-1 focus:ring-brand",
                mono && "font-mono text-xs leading-relaxed",
            )}
        />
    ) : value ? (
        <p className={cx("whitespace-pre-wrap text-sm text-tertiary", mono && "font-mono text-xs leading-relaxed")}>{renderHighlights(value)}</p>
    ) : (
        <p className="text-sm italic text-quaternary">{placeholder ?? "Empty — unlock editing to fill this in."}</p>
    );

const EditLine = ({
    value,
    editing,
    onChange,
    placeholder,
    className,
}: {
    value: string;
    editing: boolean;
    onChange: (v: string) => void;
    placeholder?: string;
    className?: string;
}) =>
    editing ? (
        <input
            type="text"
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            className={cx(
                "w-full rounded-lg border border-secondary bg-primary px-3 py-1.5 text-sm text-primary placeholder:text-placeholder outline-none transition duration-100 ease-linear focus:border-brand focus:ring-1 focus:ring-brand",
                className,
            )}
        />
    ) : (
        <span className={cx("text-sm text-secondary", !value && "italic text-quaternary", className)}>{value ? renderHighlights(value) : placeholder}</span>
    );

const SectionHeader = ({ id, number, title, hint }: { id: string; number: string; title: string; hint?: string }) => (
    <div id={id} className="scroll-mt-6">
        <div className="flex items-center gap-3">
            <span className="flex size-7 items-center justify-center rounded-md bg-brand-solid text-xs font-semibold text-white tabular-nums">{number}</span>
            <span className="h-px flex-1 bg-border-secondary" />
        </div>
        <h2 className="mt-4 text-xl font-semibold text-primary">{title}</h2>
        {hint && <p className="mt-1 text-sm text-tertiary">{hint}</p>}
    </div>
);

/** A single question card — reused for both Open and Resolved/History lists. */
const QuestionCard = ({
    q,
    number,
    editing,
    resolved,
    onQuestion,
    onAnswer,
    onVideo,
    onRemove,
    onToggleResolved,
    onPriority,
}: {
    q: QA;
    /** Position in the full questions array (1-based) — stable across the Open/Resolved
     * split and across new questions appended later, so numbering never gets reused. */
    number: number;
    editing: boolean;
    resolved?: boolean;
    onQuestion: (v: string) => void;
    onAnswer: (v: string) => void;
    onVideo: (v: string | undefined) => void;
    onRemove: () => void;
    onToggleResolved: (v: boolean) => void;
    onPriority: (v: QuestionPriority | undefined) => void;
}) => (
    <div className={cx("rounded-2xl p-5 ring-1 ring-secondary", resolved ? "bg-secondary" : "bg-primary")}>
        <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-start gap-2">
                <button type="button" title={resolved ? "Mark as unresolved" : "Mark as resolved"}
                    onClick={() => onToggleResolved(!resolved)}
                    className={cx(
                        "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border transition duration-100 ease-linear",
                        resolved ? "border-success bg-success-solid text-white" : "border-secondary bg-primary hover:border-brand",
                    )}>
                    {resolved && <Check className="size-3" aria-hidden="true" />}
                </button>
                <span className="mt-0.5 shrink-0 text-sm font-semibold text-quaternary tabular-nums">{number}.</span>
                <div className="min-w-0 flex-1">
                    <EditLine value={q.question} editing={editing} onChange={onQuestion} placeholder="Question…" className="font-medium text-primary" />
                </div>
            </div>
            <PriorityFlag value={q.priority} onChange={onPriority} />
            {editing && (
                <button type="button" title="Remove question" onClick={onRemove} className="shrink-0 text-fg-quaternary hover:text-fg-error-secondary">
                    <Trash01 className="size-4" />
                </button>
            )}
        </div>
        <div className={cx("mt-3 border-l-2 pl-3", resolved ? "border-success" : "border-brand")}>
            <EditArea value={q.answer} editing={editing} onChange={onAnswer} placeholder="Type your notes/decision here — check the box above when it's actually resolved." rows={2} />
        </div>
        {editing ? <VideoAttach value={q.video} onChange={onVideo} className="mt-3" /> : q.video && <VideoEmbed url={q.video} className="mt-3" />}
    </div>
);

/* ── Page ────────────────────────────────────────────────────────── */

/** Sidebar is grouped (macOS System Settings style) with dividers between groups.
    Order here IS the scroll order — keep it matching the section DOM order below. */
const NAV_GROUPS = [
    [
        { id: "s-overview", label: "Overview", icon: BookOpen01 },
        { id: "s-milestones", label: "Milestones", icon: Flag05 },
        { id: "s-flow", label: "How drafting works", icon: Send01 },
        { id: "s-groups", label: "The 7 draft groups", icon: FileCheck02 },
        { id: "s-rules", label: "Rules & Safeguards", icon: Shield01 },
    ],
    [
        { id: "s-todos", label: "Build To-dos", icon: CheckDone01 },
        { id: "s-questions", label: "Open Questions", icon: HelpCircle },
    ],
    [
        { id: "s-log", label: "Timeline", icon: Hourglass01 },
    ],
];
const SECTIONS = NAV_GROUPS.flat();

const STAGE_ICONS = [Users01, Stars02, Send01, Database01];

export const MasterDocumentLogScreen = () => {
    const [data, setData] = useState<PageData>(seed);
    const [editing, setEditing] = useState(false);
    const { collapsed: navCollapsed, toggle: toggleNav } = useNavCollapsed();
    const [activeSection, setActiveSection] = useState(SECTIONS[0].id);
    const [showResolved, setShowResolved] = useState(false);
    const navigate = useNavigate();
    const mainRef = useRef<HTMLElement>(null);
    const hydratedRef = useRef(false);

    // Shift+E toggles edit mode; Shift+S saves immediately and locks — same
    // shortcuts as the other project-log pages.
    useEditShortcuts({
        onToggle: () => setEditing((e) => !e),
        onSave: () => {
            supabase
                .from("sop_pages")
                .upsert({ slug: SLUG, data, updated_at: new Date().toISOString() }, { onConflict: "slug" })
                .then(({ error }) => {
                    if (error) console.error("[master-document-log save]", error);
                });
            setEditing(false);
        },
    });

    // Load the saved row; fall back to the seed for a fresh page.
    useEffect(() => {
        supabase
            .from("sop_pages")
            .select("data")
            .eq("slug", SLUG)
            .maybeSingle()
            .then(({ data: row, error }) => {
                const d = row?.data as PageData | undefined;
                // Merge over the seed so rows saved before newer sections existed
                // still get those sections' defaults.
                if (!error && d && Array.isArray(d.todos)) setData({ ...seed(), ...d });
                hydratedRef.current = true;
            });
    }, []);

    // Debounced autosave so edits are never trapped in one browser.
    useEffect(() => {
        if (!hydratedRef.current) return;
        const t = setTimeout(() => {
            supabase
                .from("sop_pages")
                .upsert({ slug: SLUG, data, updated_at: new Date().toISOString() }, { onConflict: "slug" })
                .then(({ error }) => {
                    if (error) console.error("[master-document-log autosave]", error);
                });
        }, 1000);
        return () => clearTimeout(t);
    }, [data]);

    const update = (mutator: (draft: PageData) => void) =>
        setData((prev) => {
            const next = JSON.parse(JSON.stringify(prev)) as PageData;
            mutator(next);
            return next;
        });

    const goTo = (id: string) => {
        setActiveSection(id);
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    // Scroll-spy: highlight the table-of-contents item for the section in view.
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
                    const el = document.getElementById(s.id);
                    if (el && el.getBoundingClientRect().top - mainTop <= main.clientHeight * 0.4) current = s.id;
                }
            }
            setActiveSection(current);
        };
        main.addEventListener("scroll", onScroll, { passive: true });
        onScroll();
        return () => main.removeEventListener("scroll", onScroll);
    }, []);

    /* list helpers */
    const setLine = (list: "groups" | "rules", i: number, v: string) => update((d) => void (d[list][i] = v));
    const addLine = (list: "groups" | "rules") => update((d) => void d[list].push(""));
    const rmLine = (list: "groups" | "rules", i: number) => update((d) => void d[list].splice(i, 1));

    /* questions — edited by id so the open / resolved split stays stable across renders */
    const setQuestion = (id: string, patch: Partial<QA>) =>
        update((d) => {
            const q = d.questions.find((x) => x.id === id);
            if (q) Object.assign(q, patch);
        });
    const rmQuestion = (id: string) => update((d) => void (d.questions = d.questions.filter((x) => x.id !== id)));
    const addQuestion = () => update((d) => void d.questions.push({ id: uid(), question: "", answer: "", resolved: false }));

    const isAnswered = (q: QA) => q.resolved ?? !!(q.answer || "").trim();
    const openQuestions = data.questions.filter((q) => !isAnswered(q));
    const resolvedQuestions = data.questions.filter(isAnswered);

    return (
        <AppShell
            highlightScope
            className="flex flex-col"
            rail={!navCollapsed && <IconRail activeDept="docs" bottom={<RailBottom editing={editing} onToggleEditing={() => setEditing((e) => !e)} />} />}
            breadcrumb={[
                { label: "Dashboard", to: "/dashboard", icon: LayoutAlt01 },
                { label: "Manual", to: "/manual", icon: BookOpen01 },
                { label: "Master Document" },
            ]}
        >
            <HighlightPen enabled={editing} />
            {navCollapsed && <CollapsedTopBar title="Master Document" onExpand={toggleNav} />}
            <div className="flex min-h-0 flex-1 gap-2 bg-secondary p-2">

            {/* Section nav */}
            {!navCollapsed && (
            <aside className="hidden h-full w-60 shrink-0 flex-col overflow-hidden rounded-lg bg-primary shadow-sm md:flex">
                <div className="flex h-[73px] shrink-0 items-center justify-between border-b border-secondary px-5">
                    <h2 className="text-md font-semibold text-primary">Master Document</h2>
                    <NavCollapseButton onClick={toggleNav} />
                </div>
                <motion.nav
                    className="flex-1 overflow-y-auto px-3 py-4"
                    initial="hidden"
                    animate="show"
                    variants={{ show: { transition: { staggerChildren: 0.05 } } }}
                >
                    {NAV_GROUPS.map((group, gi) => (
                        <div key={gi} className="space-y-1">
                            {gi > 0 && <div className="mx-3 my-3 h-px bg-border-secondary" />}
                            {group.map((s) => (
                                <motion.button
                                    key={s.id}
                                    type="button"
                                    onClick={() => goTo(s.id)}
                                    variants={{ hidden: { opacity: 0, x: -8 }, show: { opacity: 1, x: 0 } }}
                                    className={cx(
                                        "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition duration-100 ease-linear",
                                        activeSection === s.id
                                            ? "bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300"
                                            : "text-secondary hover:bg-secondary_hover hover:text-primary",
                                    )}
                                >
                                    <s.icon className="size-4 shrink-0 text-fg-quaternary" aria-hidden="true" />
                                    {s.label}
                                </motion.button>
                            ))}
                        </div>
                    ))}
                </motion.nav>
            </aside>
            )}

            {/* Content */}
            <main ref={mainRef} className="flex-1 overflow-y-auto overflow-x-hidden rounded-lg bg-primary shadow-sm">
                <PageBanner
                    breadcrumb={[
                        { label: "Dashboard", to: "/dashboard", icon: LayoutAlt01 },
                        { label: "Manual", to: "/manual", icon: BookOpen01 },
                        { label: "Master Document" },
                    ]}
                    title="Master Brand Document — Log"
                    subtitle="How the document drafts itself from the client's own material — technical reference for AMs"
                    imageUrl={data.bannerUrl}
                    editing={editing}
                    onImageChange={(url) => update((d) => void (d.bannerUrl = url || undefined))}
                    actions={
                        <span
                            className={cx(
                                "inline-flex shrink-0 items-center rounded-full border px-3 py-1.5 text-xs font-semibold whitespace-nowrap backdrop-blur",
                                editing ? "border-white/40 bg-white/15 text-white" : "border-white/25 bg-white/10 text-white/90",
                            )}
                        >
                            {editing ? "Editing — autosaves" : "Locked — read only"}
                        </span>
                    }
                />
                <div className="mx-auto flex max-w-[840px] flex-col gap-14 px-6 py-10 pb-24 md:px-10">
                    {/* Intro */}
                    <div>
                        <p className="text-md text-tertiary">
                            Living reference for the Master Brand Document and its auto-drafting pipeline. What the buttons do, where the
                            information comes from, and the guarantees that make a draft safe to run — Claude reads this page when working
                            on the feature.
                        </p>
                        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
                            <button
                                type="button"
                                onClick={() => navigate("/client-dashboard")}
                                className="inline-flex items-center gap-2 rounded-lg bg-brand-solid px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition duration-100 ease-linear hover:bg-brand-solid_hover"
                            >
                                <BookOpen01 className="size-4" aria-hidden="true" />
                                Open the dashboard template
                                <ArrowUpRight className="size-4" aria-hidden="true" />
                            </button>
                            <span className="text-xs text-tertiary">
                                The document lives under Brand foundation → Master Brand on every client dashboard.
                            </span>
                        </div>
                    </div>

                    {/* 01 Overview */}
                    <section>
                        <SectionHeader id="s-overview" number="01" title="Overview" hint="What the Master Brand Document is and what reads from it." />
                        <div className="mt-4 rounded-2xl bg-primary p-5 ring-1 ring-secondary">
                            <EditArea value={data.overview} editing={editing} onChange={(v) => update((d) => void (d.overview = v))} rows={7} />
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                            {[
                                ["Lives on", "Every client dashboard"],
                                ["Drafted by", "Claude (Fable 5) via Netlify functions"],
                                ["Saved to", "dashboard_pages (Supabase)"],
                            ].map(([k, v]) => (
                                <div key={k} className="rounded-xl bg-primary px-4 py-3 ring-1 ring-secondary">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-quaternary">{k}</p>
                                    <p className="mt-1 text-sm font-medium text-primary">{v}</p>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* 02 Milestones */}
                    <section>
                        <SectionHeader id="s-milestones" number="02" title="Milestones" hint="The build at a glance — what's shipped, in flight, and what it's waiting on." />
                        <div className="mt-4">
                            <MilestonesPanel
                                milestones={data.milestones}
                                waiting={data.waiting}
                                editing={editing}
                                onMilestones={(m) => update((d) => void (d.milestones = m))}
                                onWaiting={(w) => update((d) => void (d.waiting = w))}
                            />
                        </div>
                    </section>

                    {/* 03 How drafting works */}
                    <section>
                        <SectionHeader id="s-flow" number="03" title="How drafting works" hint="From the client's own material to a reviewed, saved document." />
                        <div className="mt-5 flex flex-col items-stretch gap-3 md:flex-row md:items-center">
                            {data.stages.map((s, i) => {
                                const StageIcon = STAGE_ICONS[i % STAGE_ICONS.length];
                                return (
                                    <div key={i} className="flex flex-1 flex-col gap-2 md:contents">
                                        <div className="flex flex-1 flex-col items-center gap-2 rounded-2xl bg-primary px-4 py-5 text-center ring-1 ring-secondary">
                                            <span className="flex size-9 items-center justify-center rounded-full bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300">
                                                <StageIcon className="size-4" aria-hidden="true" />
                                            </span>
                                            {editing ? (
                                                <>
                                                    <EditLine
                                                        value={s.label}
                                                        editing={editing}
                                                        onChange={(v) => update((d) => void (d.stages[i].label = v))}
                                                        placeholder="Stage…"
                                                        className="text-center font-semibold"
                                                    />
                                                    <EditLine
                                                        value={s.detail}
                                                        editing={editing}
                                                        onChange={(v) => update((d) => void (d.stages[i].detail = v))}
                                                        placeholder="Detail…"
                                                        className="text-center text-xs"
                                                    />
                                                </>
                                            ) : (
                                                <>
                                                    <p className="text-sm font-semibold text-primary">{renderHighlights(s.label)}</p>
                                                    <p className="text-xs text-tertiary">{renderHighlights(s.detail)}</p>
                                                </>
                                            )}
                                        </div>
                                        {i < data.stages.length - 1 && (
                                            <div className="flex items-center justify-center md:px-1">
                                                <ArrowRight className="size-4 shrink-0 rotate-90 text-fg-quaternary md:rotate-0" aria-hidden="true" />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                    {/* 04 The 7 draft groups */}
                    <section>
                        <SectionHeader
                            id="s-groups"
                            number="04"
                            title="The 7 draft groups"
                            hint="Each is one Claude call. The website is read once up front and shared with the groups that need it."
                        />
                        <div className="mt-4 rounded-2xl bg-primary p-5 ring-1 ring-secondary">
                            <ul className="flex flex-col gap-2">
                                {data.groups.map((item, i) => (
                                    <li key={i} className="flex items-center gap-2">
                                        <span className="size-1.5 shrink-0 rounded-full bg-brand-solid" />
                                        <div className="min-w-0 flex-1">
                                            <EditLine value={item} editing={editing} onChange={(v) => setLine("groups", i, v)} placeholder="Group…" />
                                        </div>
                                        {editing && (
                                            <button type="button" title="Remove group" onClick={() => rmLine("groups", i)} className="text-fg-quaternary hover:text-fg-error-secondary">
                                                <Trash01 className="size-4" />
                                            </button>
                                        )}
                                    </li>
                                ))}
                            </ul>
                            {editing && (
                                <button type="button" onClick={() => addLine("groups")} className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-brand-secondary hover:underline">
                                    <Plus className="size-4" /> Add group
                                </button>
                            )}
                        </div>
                    </section>

                    {/* 05 Rules & Safeguards */}
                    <section>
                        <SectionHeader id="s-rules" number="05" title="Rules & Safeguards" hint="The guarantees that make a draft safe to run on a live client dashboard." />
                        <div className="mt-4 rounded-2xl bg-primary p-5 ring-1 ring-secondary">
                            <ol className="flex flex-col gap-2.5">
                                {data.rules.map((rule, i) => (
                                    <li key={i} className="flex items-start gap-3">
                                        <span className="mt-px flex size-5 shrink-0 items-center justify-center rounded-md bg-brand-50 text-xs font-semibold text-brand-700 tabular-nums dark:bg-brand-950/50 dark:text-brand-300">
                                            {i + 1}
                                        </span>
                                        <div className="flex min-w-0 flex-1 items-center gap-2">
                                            <div className="min-w-0 flex-1">
                                                <EditLine value={rule} editing={editing} onChange={(v) => setLine("rules", i, v)} placeholder="Rule…" />
                                            </div>
                                            {editing && (
                                                <button type="button" title="Remove rule" onClick={() => rmLine("rules", i)} className="text-fg-quaternary hover:text-fg-error-secondary">
                                                    <Trash01 className="size-4" />
                                                </button>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ol>
                        </div>
                        {editing && (
                            <button type="button" onClick={() => addLine("rules")} className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-brand-secondary hover:underline">
                                <Plus className="size-4" /> Add rule
                            </button>
                        )}
                    </section>

                    {/* 06 To-dos */}
                    <section>
                        <SectionHeader id="s-todos" number="06" title="Build To-dos" hint="Checklist to finish the feature. Tick items as they land." />
                        <div className="mt-4 flex flex-col gap-1.5">
                            {data.todos.map((t, i) => (
                                <div key={t.id} className="flex items-center gap-3 rounded-xl bg-primary px-4 py-2.5 ring-1 ring-secondary">
                                    <button
                                        type="button"
                                        onClick={() => update((d) => void (d.todos[i].done = !d.todos[i].done))}
                                        className={cx(
                                            "flex size-5 shrink-0 items-center justify-center rounded-md border transition duration-100 ease-linear",
                                            t.done ? "border-brand bg-brand-solid text-white" : "border-primary bg-primary hover:border-brand",
                                        )}
                                        title={t.done ? "Mark not done" : "Mark done"}
                                    >
                                        {t.done && <Check className="size-3.5" />}
                                    </button>
                                    <div className={cx("min-w-0 flex-1", t.done && "opacity-60")}>
                                        <EditLine
                                            value={t.text}
                                            editing={editing}
                                            onChange={(v) => update((d) => void (d.todos[i].text = v))}
                                            placeholder="To-do…"
                                            className={t.done ? "line-through" : undefined}
                                        />
                                    </div>
                                    {editing && (
                                        <button type="button" title="Remove to-do" onClick={() => update((d) => void d.todos.splice(i, 1))} className="text-fg-quaternary hover:text-fg-error-secondary">
                                            <Trash01 className="size-4" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        {editing && (
                            <button
                                type="button"
                                onClick={() => update((d) => void d.todos.push({ id: uid(), text: "", done: false }))}
                                className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-brand-secondary hover:underline"
                            >
                                <Plus className="size-4" /> Add to-do
                            </button>
                        )}
                    </section>

                    {/* 07 Questions */}
                    <section>
                        <SectionHeader
                            id="s-questions"
                            number="07"
                            title="Open Questions"
                            hint="Answer inline — decisions live here so nothing gets lost in chat. Answered questions move to Resolved / History below (nothing is deleted)."
                        />
                        <div className="mt-4 flex flex-col gap-4">
                            {openQuestions.length === 0 ? (
                                <p className="rounded-2xl bg-primary p-5 text-sm italic text-quaternary ring-1 ring-secondary">
                                    No open questions right now — everything's been answered.
                                </p>
                            ) : (
                                openQuestions.map((q) => (
                                    <QuestionCard
                                        key={q.id}
                                        q={q}
                                        number={data.questions.findIndex((x) => x.id === q.id) + 1}
                                        editing={editing}
                                        onQuestion={(v) => setQuestion(q.id, { question: v })}
                                        onAnswer={(v) => setQuestion(q.id, { answer: v })}
                                        onVideo={(v) => setQuestion(q.id, { video: v })}
                                        onRemove={() => rmQuestion(q.id)}
                                        onToggleResolved={(v) => setQuestion(q.id, { resolved: v })}
                                        onPriority={(v) => setQuestion(q.id, { priority: v })}
                                    />
                                ))
                            )}
                        </div>
                        {editing && (
                            <button
                                type="button"
                                onClick={addQuestion}
                                className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-brand-secondary hover:underline"
                            >
                                <Plus className="size-4" /> Add question
                            </button>
                        )}

                        {/* Resolved / History — answered questions collapse here so the open list stays focused. */}
                        {resolvedQuestions.length > 0 && (
                            <div className="mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowResolved((s) => !s)}
                                    aria-expanded={showResolved || editing}
                                    className="flex w-full items-center gap-2.5 rounded-xl bg-secondary px-4 py-3 text-left text-sm font-semibold text-secondary transition duration-100 ease-linear hover:bg-secondary_hover"
                                >
                                    <ChevronDown
                                        className={cx("size-4 shrink-0 text-fg-quaternary transition-transform duration-200", (showResolved || editing) && "rotate-180")}
                                        aria-hidden="true"
                                    />
                                    <span className="flex-1">Resolved / History</span>
                                    <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-tertiary tabular-nums ring-1 ring-secondary">
                                        {resolvedQuestions.length}
                                    </span>
                                </button>
                                <AnimatePresence initial={false}>
                                    {(showResolved || editing) && (
                                        <motion.div
                                            key="resolved"
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                                            className="overflow-hidden"
                                        >
                                            <div className="mt-3 flex flex-col gap-4">
                                                {resolvedQuestions.map((q) => (
                                                    <QuestionCard
                                                        key={q.id}
                                                        q={q}
                                                        number={data.questions.findIndex((x) => x.id === q.id) + 1}
                                                        editing={editing}
                                                        resolved
                                                        onQuestion={(v) => setQuestion(q.id, { question: v })}
                                                        onAnswer={(v) => setQuestion(q.id, { answer: v })}
                                                        onVideo={(v) => setQuestion(q.id, { video: v })}
                                                        onRemove={() => rmQuestion(q.id)}
                                                        onToggleResolved={(v) => setQuestion(q.id, { resolved: v })}
                                                        onPriority={(v) => setQuestion(q.id, { priority: v })}
                                                    />
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}
                    </section>

                    {/* 08 Timeline */}
                    <section>
                        <SectionHeader id="s-log" number="08" title="Timeline" hint="Build log — updated as the feature progresses." />
                        <div className="mt-4 flex flex-col gap-3">
                            <AnimatePresence>
                                {data.log.map((e) => (
                                    <motion.div key={e.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-primary p-5 ring-1 ring-secondary">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-quaternary">{e.date}</p>
                                        <p className="mt-1 text-sm font-semibold text-primary">{renderHighlights(e.title)}</p>
                                        <p className="mt-1 text-sm text-tertiary">{renderHighlights(e.description)}</p>
                                        {e.video && <VideoEmbed url={e.video} className="mt-3" />}
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    </section>
                </div>
            </main>
            </div>
        </AppShell>
    );
};
