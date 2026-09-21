import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, BookOpen01, Check, ChevronDown, Flag05, HelpCircle, Home02, LayoutAlt01, Mail01, MessageChatCircle } from "@untitledui/icons";
import { AppShell, CollapsedTopBar, IconRail, NavCollapseButton, RailBottom, useNavCollapsed } from "@/components/application/icon-rail";
import { PriorityFlag, priorityRank, type QuestionPriority } from "@/components/application/priority-flag";
import { VideoEmbed } from "@/components/application/video-block";
import { supabase } from "@/lib/supabase";
import { cx } from "@/utils/cx";
import { renderHighlights } from "@/utils/highlight";

/**
 * /questions — one inbox for every "Questions" list across the log pages
 * (roadmap + all project-log pages), INCLUDING already-answered ones. Answers
 * and the resolve checkbox save straight back to each source page's own
 * sop_pages row, so this is just another view of the same data — nothing is
 * duplicated. Built for the morning review: answer everything here and every
 * project keeps moving.
 */

type QA = { id: string; question: string; answer: string; video?: string; image?: string; resolved?: boolean; priority?: QuestionPriority };
/** Loose row payload — each source page has extra fields we must preserve untouched. */
type PageData = { questions?: QA[] } & Record<string, unknown>;

const SOURCES = [
    { slug: "roadmap", label: "Project Management", path: "/roadmap", icon: Flag05 },
    { slug: "welcome-email-flow-overview", label: "Welcome Email Flow", path: "/welcome-email-flow-overview", icon: Mail01 },
    { slug: "client-dashboard-overview", label: "Client Dashboard", path: "/client-dashboard-overview", icon: LayoutAlt01 },
    { slug: "chat-widget-overview", label: "AI Chat Widget", path: "/chat-widget-overview", icon: MessageChatCircle },
    { slug: "owner-guide-overview", label: "Owner Guide", path: "/owner-guide-overview", icon: BookOpen01 },
    { slug: "homepage-overview", label: "Homepage", path: "/homepage-overview", icon: Home02 },
];

// Same fallback rule as the source pages: explicit `resolved` wins; legacy
// questions saved before the flag existed count as resolved when answered.
const isResolved = (q: QA) => q.resolved ?? !!(q.answer || "").trim();

export const QuestionsScreen = () => {
    const [pages, setPages] = useState<Record<string, PageData>>({});
    const [loading, setLoading] = useState(true);
    const [showResolved, setShowResolved] = useState<Record<string, boolean>>({});
    const [activeSection, setActiveSection] = useState(SOURCES[0].slug);
    const { collapsed: navCollapsed, toggle: toggleNav } = useNavCollapsed();
    const navigate = useNavigate();
    const mainRef = useRef<HTMLElement>(null);
    const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

    useEffect(() => {
        supabase
            .from("sop_pages")
            .select("slug, data")
            .in("slug", SOURCES.map((s) => s.slug))
            .then(({ data: rows, error }) => {
                if (!error && rows) {
                    const bySlug: Record<string, PageData> = {};
                    for (const r of rows) bySlug[r.slug as string] = r.data as PageData;
                    setPages(bySlug);
                }
                setLoading(false);
            });
    }, []);

    /** Mutate one source page's questions and debounce-save that row back —
        the whole `data` blob is written so nothing else on the page is lost. */
    const mutateQuestions = (slug: string, mutator: (qs: QA[]) => void) =>
        setPages((prev) => {
            const next = JSON.parse(JSON.stringify(prev)) as Record<string, PageData>;
            if (!next[slug]?.questions) return prev;
            mutator(next[slug].questions as QA[]);
            const rowData = next[slug];
            clearTimeout(saveTimers.current[slug]);
            saveTimers.current[slug] = setTimeout(() => {
                supabase
                    .from("sop_pages")
                    .upsert({ slug, data: rowData, updated_at: new Date().toISOString() }, { onConflict: "slug" })
                    .then(({ error }) => {
                        if (error) console.error(`[questions save ${slug}]`, error);
                    });
            }, 800);
            return next;
        });

    const setQuestion = (slug: string, id: string, patch: Partial<QA>) =>
        mutateQuestions(slug, (qs) => {
            const q = qs.find((x) => x.id === id);
            if (q) Object.assign(q, patch);
        });

    const goTo = (id: string) => {
        setActiveSection(id);
        document.getElementById(`q-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    // Scroll-spy — highlight the source whose section is currently in view.
    useEffect(() => {
        const main = mainRef.current;
        if (!main) return;
        const onScroll = () => {
            let current = SOURCES[0].slug;
            if (main.scrollTop + main.clientHeight >= main.scrollHeight - 8) {
                current = SOURCES[SOURCES.length - 1].slug;
            } else {
                const mainTop = main.getBoundingClientRect().top;
                for (const s of SOURCES) {
                    const el = document.getElementById(`q-${s.slug}`);
                    if (el && el.getBoundingClientRect().top - mainTop <= main.clientHeight * 0.4) current = s.slug;
                }
            }
            setActiveSection(current);
        };
        main.addEventListener("scroll", onScroll, { passive: true });
        onScroll();
        return () => main.removeEventListener("scroll", onScroll);
    }, [loading]);

    const questionsOf = (slug: string): QA[] => (pages[slug]?.questions as QA[] | undefined) ?? [];
    const totalOpen = SOURCES.reduce((n, s) => n + questionsOf(s.slug).filter((q) => !isResolved(q)).length, 0);
    const totalAll = SOURCES.reduce((n, s) => n + questionsOf(s.slug).length, 0);

    return (
        <AppShell
            className="flex flex-col"
            rail={!navCollapsed && <IconRail activeDept="docs" bottom={<RailBottom editing={false} onToggleEditing={() => {}} />} />}
            breadcrumb={[
                { label: "Dashboard", to: "/dashboard", icon: LayoutAlt01 },
                { label: "Questions" },
            ]}
        >
            {navCollapsed && <CollapsedTopBar title="Questions" onExpand={toggleNav} />}
            <div className="flex min-h-0 flex-1 gap-2 bg-secondary p-2">

            {/* Source nav */}
            {!navCollapsed && (
            <aside className="hidden h-full w-64 shrink-0 flex-col overflow-hidden rounded-lg bg-primary shadow-sm md:flex">
                <div className="flex h-[73px] shrink-0 items-center justify-between border-b border-secondary px-5">
                    <h2 className="text-md font-semibold text-primary">Questions</h2>
                    <NavCollapseButton onClick={toggleNav} />
                </div>
                <motion.nav
                    className="flex-1 space-y-1 overflow-y-auto px-3 py-4"
                    initial="hidden"
                    animate="show"
                    variants={{ show: { transition: { staggerChildren: 0.05 } } }}
                >
                    {SOURCES.map((s) => {
                        const open = questionsOf(s.slug).filter((q) => !isResolved(q)).length;
                        return (
                            <motion.button
                                key={s.slug}
                                type="button"
                                onClick={() => goTo(s.slug)}
                                variants={{ hidden: { opacity: 0, x: -8 }, show: { opacity: 1, x: 0 } }}
                                className={cx(
                                    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition duration-100 ease-linear",
                                    activeSection === s.slug
                                        ? "bg-utility-brand-50 text-utility-brand-700"
                                        : "text-secondary hover:bg-secondary_hover hover:text-primary",
                                )}
                            >
                                <s.icon className="size-4 shrink-0 text-fg-quaternary" aria-hidden="true" />
                                <span className="min-w-0 flex-1 truncate">{s.label}</span>
                                {open > 0 && (
                                    <span className="shrink-0 rounded-full bg-brand-solid px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums">{open}</span>
                                )}
                            </motion.button>
                        );
                    })}
                </motion.nav>
            </aside>
            )}

            {/* Content */}
            <main ref={mainRef} className="flex-1 overflow-y-auto overflow-x-hidden rounded-lg bg-primary shadow-sm">
                <div className="mx-auto flex max-w-[840px] flex-col gap-12 px-6 py-10 pb-24 md:px-10">
                    {/* Header */}
                    <div>
                        <div className="flex items-center gap-3">
                            <span className="flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300">
                                <HelpCircle className="size-5" aria-hidden="true" />
                            </span>
                            <div>
                                <h1 className="text-display-xs font-semibold text-primary">Questions</h1>
                                <p className="text-sm text-tertiary">
                                    {loading ? "Loading…" : `${totalOpen} open · ${totalAll} total across every log page`}
                                </p>
                            </div>
                        </div>
                        <p className="mt-4 text-md text-tertiary">
                            Every question from every log page in one place — including the answered ones. Type an answer or tick the
                            checkbox and it saves straight back to the source page. Clear this list and every project keeps moving.
                        </p>
                    </div>

                    {loading ? (
                        <div className="flex h-48 items-center justify-center">
                            <div className="size-6 animate-spin rounded-full border-2 border-brand border-t-transparent opacity-60" />
                        </div>
                    ) : (
                        SOURCES.map((src) => {
                            const all = questionsOf(src.slug);
                            // High first, then Medium, Low, unflagged — sort is stable so
                            // equal-priority questions keep their original page order.
                            const open = all.filter((q) => !isResolved(q)).sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
                            const resolved = all.filter(isResolved);
                            const expanded = showResolved[src.slug] ?? false;
                            return (
                                <section key={src.slug} id={`q-${src.slug}`} className="scroll-mt-6">
                                    {/* Section header — source name + open count + jump-to-page */}
                                    <div className="flex items-center gap-3">
                                        <src.icon className="size-5 shrink-0 text-fg-brand-primary" aria-hidden="true" />
                                        <h2 className="text-xl font-semibold text-primary">{src.label}</h2>
                                        <span className={cx(
                                            "rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                                            open.length > 0 ? "bg-utility-brand-50 text-utility-brand-700" : "bg-utility-green-50 text-utility-green-700",
                                        )}>
                                            {open.length > 0 ? `${open.length} open` : "all answered"}
                                        </span>
                                        <span className="h-px flex-1 bg-border-secondary" />
                                        <button
                                            type="button"
                                            onClick={() => navigate(src.path)}
                                            className="flex shrink-0 items-center gap-1 text-sm font-semibold text-brand-secondary hover:underline"
                                        >
                                            Open page <ArrowUpRight className="size-3.5" aria-hidden="true" />
                                        </button>
                                    </div>

                                    {/* Open questions */}
                                    <div className="mt-4 flex flex-col gap-4">
                                        {open.length === 0 ? (
                                            <p className="rounded-2xl bg-primary p-5 text-sm italic text-quaternary ring-1 ring-secondary">
                                                No open questions — everything's been answered here.
                                            </p>
                                        ) : (
                                            open.map((q) => (
                                                <QuestionRow
                                                    key={q.id}
                                                    q={q}
                                                    number={all.findIndex((x) => x.id === q.id) + 1}
                                                    onAnswer={(v) => setQuestion(src.slug, q.id, { answer: v })}
                                                    onToggleResolved={(v) => setQuestion(src.slug, q.id, { resolved: v })}
                                                    onPriority={(v) => setQuestion(src.slug, q.id, { priority: v })}
                                                />
                                            ))
                                        )}
                                    </div>

                                    {/* Resolved — collapsed by default so the open list stays focused */}
                                    {resolved.length > 0 && (
                                        <div className="mt-4">
                                            <button
                                                type="button"
                                                onClick={() => setShowResolved((s) => ({ ...s, [src.slug]: !expanded }))}
                                                aria-expanded={expanded}
                                                className="flex w-full items-center gap-2.5 rounded-xl bg-secondary px-4 py-3 text-left text-sm font-semibold text-secondary transition duration-100 ease-linear hover:bg-secondary_hover"
                                            >
                                                <ChevronDown
                                                    className={cx("size-4 shrink-0 text-fg-quaternary transition-transform duration-200", expanded && "rotate-180")}
                                                    aria-hidden="true"
                                                />
                                                <span className="flex-1">Resolved / History</span>
                                                <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-tertiary tabular-nums ring-1 ring-secondary">
                                                    {resolved.length}
                                                </span>
                                            </button>
                                            <AnimatePresence initial={false}>
                                                {expanded && (
                                                    <motion.div
                                                        key="resolved"
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: "auto", opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                                                        className="overflow-hidden"
                                                    >
                                                        <div className="mt-3 flex flex-col gap-4">
                                                            {resolved.map((q) => (
                                                                <QuestionRow
                                                                    key={q.id}
                                                                    q={q}
                                                                    resolved
                                                                    number={all.findIndex((x) => x.id === q.id) + 1}
                                                                    onAnswer={(v) => setQuestion(src.slug, q.id, { answer: v })}
                                                                    onToggleResolved={(v) => setQuestion(src.slug, q.id, { resolved: v })}
                                                                    onPriority={(v) => setQuestion(src.slug, q.id, { priority: v })}
                                                                />
                                                            ))}
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    )}
                                </section>
                            );
                        })
                    )}
                </div>
            </main>
            </div>
        </AppShell>
    );
};

/** One question — the answer box and resolve checkbox are ALWAYS live here (no
    edit-lock): this page exists specifically to answer things, so the usual
    unlock step would just be friction. Question text stays read-only — wording
    is edited on the source page. */
const QuestionRow = ({
    q,
    number,
    resolved,
    onAnswer,
    onToggleResolved,
    onPriority,
}: {
    q: QA;
    number: number;
    resolved?: boolean;
    onAnswer: (v: string) => void;
    onToggleResolved: (v: boolean) => void;
    onPriority: (v: QuestionPriority | undefined) => void;
}) => (
    <div className={cx("rounded-2xl p-5 ring-1 ring-secondary", resolved ? "bg-secondary" : "bg-primary")}>
        <div className="flex items-start gap-2">
            <button type="button" title={resolved ? "Mark as unresolved" : "Mark as resolved"}
                onClick={() => onToggleResolved(!resolved)}
                className={cx(
                    "mt-1 flex size-4 shrink-0 items-center justify-center rounded border transition duration-100 ease-linear",
                    resolved ? "border-success bg-success-solid text-white" : "border-secondary bg-primary hover:border-brand",
                )}>
                {resolved && <Check className="size-3" aria-hidden="true" />}
            </button>
            <span className="mt-1 shrink-0 text-sm font-semibold text-quaternary tabular-nums">{number}.</span>
            <p className="min-w-0 flex-1 text-lg leading-[1.4] font-medium text-primary">{renderHighlights(q.question || "Untitled question")}</p>
            <PriorityFlag value={q.priority} onChange={onPriority} />
        </div>
        <div className={cx("mt-3 border-l-2 pl-3", resolved ? "border-success" : "border-brand")}>
            <textarea
                value={q.answer}
                rows={2}
                placeholder="Type your answer/decision here — check the box above when it's actually resolved."
                onChange={(e) => onAnswer(e.target.value)}
                className="w-full resize-y rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-primary placeholder:text-placeholder outline-none transition duration-100 ease-linear focus:border-brand focus:ring-1 focus:ring-brand"
            />
        </div>
        {q.image && <img src={q.image} alt="Attached" className="mt-3 max-h-64 rounded-lg border border-secondary" />}
        {q.video && <VideoEmbed url={q.video} className="mt-3" />}
    </div>
);
