import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, BookOpen01, ClipboardCheck, Code02, Flag05, FolderClosed, Home02, Inbox01, LayoutAlt01, Mail01, MessageChatCircle, SearchLg, Share07 } from "@untitledui/icons";
import type { FC } from "react";
import { supabase, type ClientPageData, type HostOnboardingPageData, type LeadCapturePageData, type OverviewCard } from "@/lib/supabase";
import { cx } from "@/utils/cx";

export interface SearchItem {
    id: string;
    title: string;
    subtitle?: string;
    path: string; // internal path or full URL
    kind: string;
    icon: FC<{ className?: string }>;
}

/** Static, always-available destinations. */
export const STATIC_ITEMS: SearchItem[] = [
    { id: "s-home", title: "Home", subtitle: "Mission Control — company at a glance", path: "/home", kind: "Page", icon: Home02 },
    { id: "s-projectmgmt", title: "Project Management", subtitle: "Overview, to-dos, roadmap & timeline", path: "/roadmap", kind: "Page", icon: Flag05 },
    { id: "s-dashboard", title: "Dashboard", subtitle: "Client Support overview", path: "/dashboard", kind: "Page", icon: LayoutAlt01 },
    { id: "s-setup", title: "AI Website Setup", subtitle: "Web Team workflow", path: "/webteam/ai-website-setup", kind: "Page", icon: Code02 },
    { id: "s-owner", title: "Owner Guide", subtitle: "Client owner guide", path: "/owner-guide", kind: "Page", icon: BookOpen01 },
    { id: "s-requests", title: "Requests", subtitle: "Docs request queue", path: "/requests", kind: "Page", icon: Inbox01 },
    { id: "s-metapixel", title: "Meta Pixel template", subtitle: "New client pixel page", path: "/metapixel", kind: "Template", icon: Share07 },
    { id: "s-popup", title: "Popup template", subtitle: "New lead-capture page", path: "/popup", kind: "Template", icon: Mail01 },
    { id: "s-hostonboarding", title: "Brand Vision Form template", subtitle: "New brand vision form", path: "/brand-vision-form", kind: "Template", icon: Home02 },
    { id: "s-template1", title: "Template 1", subtitle: "Copyable document template", path: "/template-1", kind: "Page", icon: Code02 },
    { id: "s-emailflow", title: "Welcome Email Flow — Overview", subtitle: "AM email-flow builder project reference", path: "/welcome-email-flow-overview", kind: "Page", icon: Mail01 },
    { id: "s-chatoverview", title: "AI Chat Widget — Overview", subtitle: "Claude-powered chat project reference", path: "/chat-widget-overview", kind: "Page", icon: MessageChatCircle },
    { id: "s-dashoverview", title: "Client Dashboard — Overview", subtitle: "Master Document project reference", path: "/client-dashboard-overview", kind: "Page", icon: LayoutAlt01 },
    { id: "s-ownerguideoverview", title: "Owner Guide — Overview", subtitle: "Client onboarding guide project reference", path: "/owner-guide-overview", kind: "Page", icon: BookOpen01 },
    { id: "s-homepageoverview", title: "Homepage — Overview", subtitle: "Company-wide home screen project reference", path: "/homepage-overview", kind: "Page", icon: Home02 },
    { id: "s-questions", title: "Questions", subtitle: "Every log page's questions in one inbox", path: "/questions", kind: "Page", icon: ClipboardCheck },
    { id: "s-promptlib", title: "Prompt & Pattern Library", subtitle: "Your private prompt/pattern vault", path: "/prompt-library", kind: "Page", icon: BookOpen01 },
];

/** Client/card/template rows that only exist in Supabase — fetched once, the first time the dropdown opens. */
export async function fetchDynamicSearchItems(): Promise<SearchItem[]> {
    const [clients, leads, hostForms, cards, docs] = await Promise.all([
        supabase.from("client_pages").select("slug, client_name, client_website"),
        supabase.from("leadcapture_pages").select("slug, client_name"),
        supabase.from("host_onboarding_pages").select("slug, client_name"),
        supabase.from("overview_cards").select("id, title, description, link, department, tab"),
        supabase.from("template_docs").select("slug, name"),
    ]);
    const items: SearchItem[] = [];
    (clients.data as ClientPageData[] | null)?.forEach((c) => {
        if (c.slug === "metapixel") return;
        items.push({ id: "c-" + c.slug, title: c.client_name || c.slug, subtitle: `Meta Pixel · /${c.slug}`, path: `/${c.slug}`, kind: "Meta Pixel", icon: Share07 });
    });
    (leads.data as LeadCapturePageData[] | null)?.forEach((l) => {
        items.push({ id: "l-" + l.slug, title: l.client_name || l.slug, subtitle: `Lead capture · /${l.slug}`, path: `/${l.slug}`, kind: "Lead Capture", icon: Mail01 });
    });
    (hostForms.data as HostOnboardingPageData[] | null)?.forEach((h) => {
        items.push({ id: "h-" + h.slug, title: h.client_name || h.slug, subtitle: `Host Onboarding · /${h.slug}`, path: `/${h.slug}`, kind: "Host Onboarding", icon: Home02 });
    });
    (cards.data as OverviewCard[] | null)?.forEach((card) => {
        if (!card.link) return;
        // Cards on the Docs → Project Logs tab are the active project pages —
        // they get their own rail category in the search panel.
        const isLog = card.department === "docs" && card.tab === "project-logs";
        items.push({
            id: "card-" + card.id,
            title: card.title,
            subtitle: card.description,
            path: card.link,
            kind: isLog ? "Project Log" : "Card",
            icon: isLog ? ClipboardCheck : LayoutAlt01,
        });
    });
    // Documents created from /template-1 (or the dashboard's "Create a new page")
    // are regular pages, NOT templates — the only templates are the three
    // client-page starters (Meta Pixel, Popup).
    (docs.data as { slug: string; name?: string }[] | null)?.forEach((d) => {
        if (d.slug === "template-1") return; // the master is a static item
        items.push({ id: "tpl-" + d.slug, title: d.name || d.slug, subtitle: `Page · /${d.slug}`, path: `/${d.slug}`, kind: "Page", icon: Code02 });
    });
    return items;
}

/* ── Category rail (Godly-style browse filters) ──────────────────── */

type CatId = "all" | "Log" | "Page" | "Client" | "Template" | "Card";

// "Card" items stay searchable (typing in Browse finds them) but don't get
// their own rail tab — the team browses cards from the dashboard itself.
const CATEGORIES: { id: CatId; label: string; icon: FC<{ className?: string }> }[] = [
    { id: "all", label: "Browse", icon: SearchLg },
    { id: "Log", label: "Project Logs", icon: ClipboardCheck },
    { id: "Page", label: "Pages", icon: LayoutAlt01 },
    { id: "Template", label: "Templates", icon: FolderClosed },
];

const categoryOf = (item: SearchItem): Exclude<CatId, "all"> => {
    if (item.kind === "Project Log") return "Log";
    if (item.kind === "Page") return "Page";
    if (item.kind === "Template") return "Template";
    if (item.kind === "Card") return "Card";
    return "Client"; // Meta Pixel / Lead Capture client pages
};


/**
 * Global search — an inline combobox, not a modal. At rest it shows the
 * bordered pill; focusing it drops a rich browse panel below the input:
 * a category rail on the left (Browse / Pages / Clients / Templates / Cards)
 * and, while the query is empty, a visual browse view — quick-access tiles
 * for pages plus chip clouds for templates and clients. Typing (or picking
 * a category) switches to the flat result list.
 */
export const SearchBar = () => {
    const navigate = useNavigate();
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const [dynamic, setDynamic] = useState<SearchItem[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [activeIdx, setActiveIdx] = useState(0);
    const [cat, setCat] = useState<CatId>("all");

    const openDropdown = () => {
        setOpen(true);
        if (!loaded) {
            setLoaded(true);
            fetchDynamicSearchItems().then(setDynamic);
        }
    };

    // Global shortcut: Shift + F focuses the bar (ignored while typing in a field).
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const el = document.activeElement as HTMLElement | null;
            const typing = !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
            if (e.shiftKey && (e.key === "F" || e.key === "f") && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
                e.preventDefault();
                inputRef.current?.focus();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    // Close the dropdown on outside click.
    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
        };
        window.addEventListener("mousedown", onDown);
        return () => window.removeEventListener("mousedown", onDown);
    }, [open]);

    // Fresh browse view every time the panel reopens.
    useEffect(() => {
        if (!open) setCat("all");
    }, [open]);

    const all = useMemo(() => [...STATIC_ITEMS, ...dynamic], [dynamic]);

    const results = useMemo(() => {
        const q = query.trim().toLowerCase();
        let pool = cat === "all" ? all : all.filter((i) => categoryOf(i) === cat);
        if (!q) return pool;
        return pool.filter((i) =>
            i.title.toLowerCase().includes(q) ||
            i.subtitle?.toLowerCase().includes(q) ||
            i.path.toLowerCase().includes(q) ||
            i.kind.toLowerCase().includes(q),
        );
    }, [query, cat, all]);

    useEffect(() => { setActiveIdx(0); }, [query, cat]);

    const counts = useMemo(() => {
        const c: Record<Exclude<CatId, "all">, number> = { Log: 0, Page: 0, Client: 0, Template: 0, Card: 0 };
        all.forEach((i) => { c[categoryOf(i)]++; });
        return c;
    }, [all]);

    const go = (item?: SearchItem) => {
        if (!item) return;
        setOpen(false);
        setQuery("");
        inputRef.current?.blur();
        const p = item.path;
        if (/^https?:\/\//i.test(p)) {
            try {
                const u = new URL(p);
                if (u.host === window.location.host) { navigate(u.pathname + u.search); return; }
            } catch { /* fall through */ }
            window.open(p, "_blank", "noopener");
            return;
        }
        navigate(p.startsWith("/") ? p : "/" + p);
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, results.length - 1)); }
        else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
        else if (e.key === "Enter") { e.preventDefault(); go(results[activeIdx]); }
        else if (e.key === "Escape") { e.preventDefault(); setOpen(false); inputRef.current?.blur(); }
    };

    // Browse view (empty query, "Browse" category): visual, grouped like a
    // design-gallery launcher. Otherwise: the classic flat result list.
    const browsing = !query.trim() && cat === "all";
    // Quick access sticks to the static destinations — user-created doc pages
    // live under the Pages tab instead of crowding the tile row.
    const pages = STATIC_ITEMS.filter((i) => i.kind === "Page");
    const templates = all.filter((i) => categoryOf(i) === "Template");

    const SectionLabel = ({ children }: { children: string }) => (
        <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-quaternary">{children}</p>
    );

    const Chip = ({ item }: { item: SearchItem }) => {
        const Icon = item.kind === "Template" ? FolderClosed : item.icon;
        return (
            <button
                type="button"
                onClick={() => go(item)}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-[12.5px] font-semibold text-secondary ring-1 ring-transparent transition duration-100 ease-linear hover:bg-brand-50 hover:text-brand-secondary hover:ring-brand dark:hover:bg-brand-950/30"
            >
                <Icon className="size-3.5 shrink-0 text-quaternary" aria-hidden="true" />
                <span className="truncate">{item.title}</span>
            </button>
        );
    };

    const ResultRow = ({ item, idx }: { item: SearchItem; idx: number }) => {
        // Templates are copyable "folders" you duplicate for a new client — a
        // folder icon reads clearer there than each template's own page icon.
        const Icon = item.kind === "Template" ? FolderClosed : item.icon;
        return (
            <button
                type="button"
                onClick={() => go(item)}
                onMouseEnter={() => setActiveIdx(idx)}
                className={cx(
                    "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition duration-100 ease-linear",
                    idx === activeIdx ? "bg-secondary" : "hover:bg-secondary",
                )}
            >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-quaternary ring-1 ring-secondary">
                    <Icon className="size-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-primary">{item.title}</span>
                    {item.subtitle && <span className="block truncate text-xs text-tertiary">{item.subtitle}</span>}
                </span>
                <span className="shrink-0 rounded-md bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-tertiary group-hover:bg-primary">
                    {item.kind}
                </span>
                <ArrowRight className="size-4 shrink-0 text-quaternary opacity-0 transition group-hover:opacity-100" />
            </button>
        );
    };

    return (
        <div ref={containerRef} className="relative flex flex-1 items-center justify-center px-1">
            <div
                className={cx(
                    "flex w-full max-w-xl items-center gap-2.5 rounded-full border bg-primary px-4 py-2.5 transition duration-100 ease-linear",
                    open ? "border-brand ring-2 ring-brand/15" : "border-secondary hover:border-primary hover:shadow-xs",
                )}
            >
                <SearchLg className={cx("size-4 shrink-0 transition duration-100 ease-linear", open ? "text-fg-brand-primary" : "text-quaternary")} aria-hidden="true" />
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); openDropdown(); }}
                    onFocus={openDropdown}
                    onKeyDown={onKeyDown}
                    placeholder="Search pages, clients, cards…"
                    className="flex-1 bg-transparent text-sm text-primary placeholder:text-placeholder outline-none"
                />
                {!open && (
                    <span className="hidden shrink-0 items-center gap-1 sm:flex">
                        <kbd className="rounded border border-secondary bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-tertiary">Shift</kbd>
                        <kbd className="rounded border border-secondary bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-tertiary">F</kbd>
                    </span>
                )}
            </div>

            {/* Browse panel — anchored directly below the bar, not an overlay */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.99 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.99 }}
                        transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                        className="absolute left-1/2 top-full z-30 mt-2 w-[min(720px,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-2xl bg-primary shadow-2xl ring-1 ring-secondary"
                    >
                        <div className="flex min-h-[400px] max-h-[min(560px,65vh)]">
                            {/* Category rail */}
                            <div className="hidden w-44 shrink-0 flex-col gap-0.5 border-r border-secondary p-2.5 sm:flex">
                                {CATEGORIES.map((c) => {
                                    const active = cat === c.id;
                                    const count = c.id === "all" ? all.length : counts[c.id];
                                    return (
                                        <button
                                            key={c.id}
                                            type="button"
                                            onClick={() => { setCat(c.id); inputRef.current?.focus(); }}
                                            className={cx(
                                                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition duration-100 ease-linear",
                                                active ? "bg-secondary text-primary" : "text-tertiary hover:bg-secondary hover:text-secondary",
                                            )}
                                        >
                                            <c.icon className={cx("size-4 shrink-0", active ? "text-fg-brand-primary" : "text-quaternary")} aria-hidden="true" />
                                            {c.label}
                                            <span className="ml-auto text-[11px] font-medium text-quaternary">{count}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Content */}
                            <div className="min-w-0 flex-1 overflow-y-auto">
                                {browsing ? (
                                    <div className="flex flex-col gap-6 p-5">
                                        {/* Quick access — app-launcher tiles, one scrollable row.
                                            Bleeds to the panel edge (-mx-5/px-5) so tiles scroll under
                                            it with padding instead of clipping at the content inset. */}
                                        <div>
                                            <SectionLabel>Quick access</SectionLabel>
                                            <div className="-mx-5 flex gap-3 overflow-x-auto px-5 py-1">
                                                {pages.map((item) => (
                                                    <button
                                                        key={item.id}
                                                        type="button"
                                                        onClick={() => go(item)}
                                                        title={item.subtitle}
                                                        className="group flex w-[88px] shrink-0 flex-col items-center gap-1.5"
                                                    >
                                                        <span className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-secondary ring-1 ring-secondary transition duration-100 ease-linear group-hover:bg-brand-50 group-hover:text-brand-secondary group-hover:ring-brand dark:group-hover:bg-brand-950/30">
                                                            <item.icon className="size-5" aria-hidden="true" />
                                                        </span>
                                                        <span className="line-clamp-2 max-w-full text-center text-[11px] font-medium leading-tight text-tertiary group-hover:text-secondary">
                                                            {item.title}
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Templates — curated pair; the full list is under the Templates tab */}
                                        {templates.length > 0 && (
                                            <div>
                                                <SectionLabel>Templates</SectionLabel>
                                                <div className="flex flex-wrap gap-2">
                                                    {templates.map((item) => <Chip key={item.id} item={item} />)}
                                                </div>
                                            </div>
                                        )}

                                    </div>
                                ) : (
                                    <div className="p-2">
                                        {results.length === 0 ? (
                                            <div className="px-4 py-10 text-center">
                                                <p className="text-sm font-medium text-secondary">No matches{query.trim() && <> for “{query}”</>}</p>
                                                <p className="mt-1 text-xs text-tertiary">Try a client name, page name, or “meta pixel”.</p>
                                            </div>
                                        ) : (
                                            results.map((item, idx) => <ResultRow key={item.id} item={item} idx={idx} />)
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer hints */}
                        <div className="flex items-center gap-4 border-t border-secondary px-4 py-2 text-[11px] font-medium text-quaternary">
                            <span className="flex items-center gap-1"><kbd className="rounded border border-secondary bg-secondary px-1 py-px text-[10px] font-semibold">↑↓</kbd> navigate</span>
                            <span className="flex items-center gap-1"><kbd className="rounded border border-secondary bg-secondary px-1 py-px text-[10px] font-semibold">↵</kbd> open</span>
                            <span className="flex items-center gap-1"><kbd className="rounded border border-secondary bg-secondary px-1 py-px text-[10px] font-semibold">esc</kbd> close</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
