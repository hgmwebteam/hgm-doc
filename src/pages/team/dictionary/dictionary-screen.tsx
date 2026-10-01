import { type KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { BookClosed, ChevronDown, LayoutAlt01, SearchLg, XClose } from "@untitledui/icons";
import { useNavigate } from "react-router";
import { AppShell, CollapsedTopBar, IconRail, NavCollapseButton, RailBottom, useNavCollapsed } from "@/components/application/icon-rail";
import { Button } from "@/components/base/buttons/button";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { TeamGate } from "@/pages/team/dashboard-screen";
import { DictionaryEntryCard, entryElementId } from "@/pages/team/dictionary/dictionary-entry";
import {
    type DictionaryEntry,
    type DictionaryFilter,
    FILTERS,
    type IndexedEntry,
    buildIndex,
    compact,
    groupBySection,
    matchesFilter,
    search,
    suggest,
} from "@/pages/team/dictionary/dictionary-model";
import { DOCS_MENU } from "@/pages/team/manual-screen";
import { cx } from "@/utils/cx";

/**
 * `/dictionary` — the Industry Acumen Dictionary: 253 hotel, resort and marketing terms,
 * searched as you type. Account managers use it live on client calls, so everything here
 * leans towards fewer clicks: the box has focus on arrival, `/` returns to it from
 * anywhere, and the best match opens in full without a click.
 *
 * Behind TeamGate, like /dashboard. The gate hides the page, not the data: the JSON is a
 * public chunk of the site like every other page's content (agreed 2026-10-01).
 *
 * Search, ranking and labels live in dictionary-model.ts; this file is the page. The
 * master loads lazily, started at module load when the path is /dictionary, so it fetches
 * while the gate renders and never weighs on another page.
 */

type Loaded = { entries: DictionaryEntry[]; index: IndexedEntry[]; bySlug: Map<string, DictionaryEntry> };

let loading: Promise<Loaded> | null = null;
const loadDictionary = () =>
    (loading ??= import("@/data/ref_dictionary-v2-253.json")
        .then((mod) => {
            // An assignment, not a cast: a new master missing a field the page needs fails the build.
            const entries: DictionaryEntry[] = mod.default;
            return { entries, index: buildIndex(entries), bySlug: new Map(entries.map((e) => [e.slug, e])) };
        })
        .catch((error: unknown) => {
            loading = null; // let a retry try again
            throw error;
        }));

if (typeof window !== "undefined" && /^\/dictionary\/?$/i.test(window.location.pathname)) loadDictionary().catch(() => {});

const SHOWN = 25;
const DEBOUNCE_MS = 80;
const ANNOUNCE_MS = 450;

/* ── Links to one entry ─────────────────────────────────────────── */

/** `#cap-rate` → "cap-rate". Anything else (an OAuth return, a stray fragment) is ignored. */
const slugFromHash = (hash: string) => {
    try {
        const slug = decodeURIComponent(hash.replace(/^#/, ""));
        return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) ? slug : null;
    } catch {
        return null;
    }
};

// TeamGate sends Google sign-in back to the bare path and auth clears the hash, so a
// signed-out colleague opening a shared /dictionary#cap-rate would land at the top.
// The slug is parked here first and picked up once the page is through the gate.
const PARKED_KEY = "hgm_dictionary_link";
const PARK_TTL_MS = 15 * 60 * 1000;

const parkLink = () => {
    const slug = slugFromHash(window.location.hash);
    if (!slug) return;
    try {
        sessionStorage.setItem(PARKED_KEY, JSON.stringify({ slug, at: Date.now() }));
    } catch {
        /* storage unavailable: the password path keeps the hash anyway */
    }
};

const takeParkedLink = (): string | null => {
    try {
        const raw = sessionStorage.getItem(PARKED_KEY);
        sessionStorage.removeItem(PARKED_KEY);
        if (!raw) return null;
        const { slug, at } = JSON.parse(raw) as { slug?: unknown; at?: unknown };
        return typeof slug === "string" && typeof at === "number" && Date.now() - at < PARK_TTL_MS ? slug : null;
    } catch {
        return null;
    }
};

/** Writes the open entry into the URL without adding history, keeping React Router's own state. */
const writeHash = (slug: string | null) => {
    const want = slug ? `#${slug}` : "";
    if (window.location.hash === want) return;
    history.replaceState(history.state, "", slug ? want : `${window.location.pathname}${window.location.search}`);
};

/**
 * Scrolls the page's own scroller. Never scrollIntoView here: AppShell's root is
 * overflow-hidden, and scrollIntoView would scroll that too and drag the rail out of
 * view. Always instant — the site sets smooth scrolling globally, which would ignore a
 * reduced-motion preference.
 */
const scrollWithin = (scroller: HTMLElement, el: HTMLElement, mode: "start" | "nearest", topInset: number) => {
    const box = scroller.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const top = r.top - box.top - topInset;
    const bottom = r.bottom - box.bottom + 12;
    const delta = mode === "start" || top < 0 ? top : bottom > 0 ? Math.min(bottom, top) : 0;
    if (delta) scroller.scrollTo({ top: scroller.scrollTop + delta, behavior: "instant" });
};

/* ── The Docs menu, with Dictionary as the current row ──────────── */

/**
 * The same list /manual renders (DOCS_MENU, exported from manual-screen.tsx), so the two
 * cannot drift. The current row uses tokens that hold in both themes — the manual's own
 * current-row colours lose the icon in dark mode.
 */
const DocsMenu = ({ onCollapse }: { onCollapse?: () => void }) => {
    const navigate = useNavigate();
    return (
        <aside className="flex w-64 shrink-0 flex-col overflow-hidden rounded-lg bg-primary shadow-sm lg:sticky lg:top-2 lg:max-h-[calc(100vh-1rem)]">
            <div className="flex h-[73px] shrink-0 items-center justify-between gap-2 border-b border-secondary px-5">
                <h2 className="truncate text-md font-semibold text-primary">Client Docs</h2>
                {onCollapse && <NavCollapseButton onClick={onCollapse} />}
            </div>
            <nav aria-label="Client docs" className="flex-1 overflow-y-auto px-3 py-4">
                <p className="mb-1 px-2 text-xs font-semibold tracking-widest text-quaternary uppercase">Create Docs</p>
                <div className="flex flex-col gap-1">
                    {DOCS_MENU.map((item) => {
                        const current = item.id === "dictionary";
                        const Icon = item.icon;
                        return (
                            <button
                                key={item.id}
                                type="button"
                                aria-current={current ? "page" : undefined}
                                onClick={current ? undefined : () => navigate(item.to)}
                                className={cx(
                                    "flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-sm font-medium outline-focus-ring transition duration-100 ease-linear focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none",
                                    current
                                        ? "bg-brand-primary_alt text-brand-secondary ring-1 ring-brand ring-inset"
                                        : "text-secondary hover:bg-secondary hover:text-primary",
                                )}
                            >
                                <Icon className={cx("size-4 shrink-0", current ? "text-fg-brand-secondary" : "text-fg-quaternary")} aria-hidden="true" />
                                <span className="truncate">{item.label}</span>
                            </button>
                        );
                    })}
                </div>
            </nav>
            <div className="shrink-0 border-t border-secondary px-4 py-3">
                <a
                    href="/dashboard"
                    className="flex items-center gap-1.5 rounded text-xs font-semibold text-tertiary outline-focus-ring transition duration-100 ease-linear hover:text-brand-secondary focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
                >
                    <LayoutAlt01 className="size-3.5 shrink-0" aria-hidden="true" />
                    Back to the dashboard
                </a>
            </div>
        </aside>
    );
};

/* ── The page ───────────────────────────────────────────────────── */

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const Dictionary = () => {
    const { collapsed: navCollapsed, toggle: toggleNav } = useNavCollapsed();
    // The shared rail layout doesn't fit a phone (the live /manual renders 1,136px wide
    // at 400px and clips), so below md this page drops the rail and its header row, and
    // below lg the Docs menu, putting the search box first.
    const roomForRail = useBreakpoint("md");
    const roomForMenu = useBreakpoint("lg");

    const [data, setData] = useState<Loaded | null>(null);
    const [loadFailed, setLoadFailed] = useState(false);
    const [query, setQuery] = useState("");
    const [settled, setSettled] = useState("");
    const [openSlug, setOpenSlug] = useState<string | null>(null);
    const [active, setActive] = useState(0);
    const [showAll, setShowAll] = useState(false);
    const [filter, setFilter] = useState<DictionaryFilter>("all");
    const [openSections, setOpenSections] = useState<Set<number>>(() => new Set());
    const [announcement, setAnnouncement] = useState("");

    const inputRef = useRef<HTMLInputElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const stickyRef = useRef<HTMLDivElement>(null);
    const columnRef = useRef<HTMLDivElement>(null);
    const dataRef = useRef<Loaded | null>(null);
    const timer = useRef<number | undefined>(undefined);
    // What to scroll to after the next render: an entry's top, or the results' top.
    const pendingScroll = useRef<{ slug: string; mode: "start" | "nearest" } | "top" | null>(null);

    const searching = compact(settled) !== "";
    const hits = useMemo(() => (data && searching ? search(data.index, settled) : []), [data, searching, settled]);
    const visible = showAll ? hits : hits.slice(0, SHOWN);
    const suggestions = useMemo(() => (data && searching && hits.length === 0 ? suggest(data.index, settled) : []), [data, searching, hits.length, settled]);

    /** Run a query now: the best match opens in full and the list returns to the top. */
    const applySearch = useCallback((q: string, open?: string) => {
        window.clearTimeout(timer.current);
        setSettled(q);
        setShowAll(false);
        const d = dataRef.current;
        if (!d) return; // picked up when the data arrives
        const found = search(d.index, q);
        const at = open
            ? Math.max(
                  0,
                  found.findIndex((h) => h.entry.slug === open),
              )
            : 0;
        setOpenSlug(found[at]?.entry.slug ?? null);
        setActive(at);
        if (at >= SHOWN) setShowAll(true);
        pendingScroll.current = "top";
    }, []);

    const clearSearch = useCallback(() => {
        window.clearTimeout(timer.current);
        setQuery("");
        setSettled("");
        setOpenSlug(null);
        setActive(0);
    }, []);

    /** Browse view, scrolled to one entry and opened: a deep link, or a pasted #slug. */
    const goToEntry = useCallback((slug: string) => {
        const entry = dataRef.current?.bySlug.get(slug);
        if (!entry) return;
        window.clearTimeout(timer.current);
        setQuery("");
        setSettled("");
        setFilter((f) => (matchesFilter(entry, f) ? f : "all"));
        setOpenSections((s) => new Set(s).add(entry.section));
        setOpenSlug(slug);
        pendingScroll.current = { slug, mode: "start" };
    }, []);

    /** A related chip or a suggestion: search for that term, with it open at the top. */
    const searchFor = useCallback(
        (slug: string) => {
            const entry = dataRef.current?.bySlug.get(slug);
            if (!entry) return;
            setQuery(entry.term);
            applySearch(entry.term, slug);
            inputRef.current?.focus({ preventScroll: true });
        },
        [applySearch],
    );

    const toggleEntry = (slug: string) => {
        if (openSlug === slug) return setOpenSlug(null);
        setOpenSlug(slug);
        const i = visible.findIndex((h) => h.entry.slug === slug);
        if (i >= 0) setActive(i);
        pendingScroll.current = { slug, mode: "nearest" };
    };

    // Load the master; then open whatever the link pointed at.
    useEffect(() => {
        let live = true;
        loadDictionary().then(
            (d) => {
                if (!live) return;
                dataRef.current = d;
                setData(d);
                const parked = takeParkedLink();
                const slug = [slugFromHash(window.location.hash), parked].find((s): s is string => !!s && d.bySlug.has(s));
                if (slug) goToEntry(slug);
                else if (compact(inputRef.current?.value ?? "")) applySearch(inputRef.current!.value); // typed while it loaded
            },
            () => live && setLoadFailed(true),
        );
        return () => {
            live = false;
        };
    }, [applySearch, goToEntry]);

    // The hash always names the open entry.
    useEffect(() => {
        if (data) writeHash(openSlug);
    }, [data, openSlug]);

    // A #slug pasted into the address bar while the page is open.
    useEffect(() => {
        const onHash = () => {
            const slug = slugFromHash(window.location.hash);
            if (slug) goToEntry(slug);
        };
        window.addEventListener("hashchange", onHash);
        return () => window.removeEventListener("hashchange", onHash);
    }, [goToEntry]);

    // "/" from anywhere returns to the search box — unless typing elsewhere or a dialog is open.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey || e.isComposing || e.defaultPrevented) return;
            const el = e.target as HTMLElement | null;
            if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
            if (document.querySelector('[aria-modal="true"]')) return;
            e.preventDefault();
            inputRef.current?.focus({ preventScroll: true });
            inputRef.current?.select();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, []);

    useEffect(() => {
        inputRef.current?.focus({ preventScroll: true });
    }, []);

    useEffect(() => () => window.clearTimeout(timer.current), []);

    // Scroll after the render that changed what is shown.
    useLayoutEffect(() => {
        const target = pendingScroll.current;
        const scroller = scrollRef.current;
        if (!target || !scroller) return;
        pendingScroll.current = null;
        if (target === "top") {
            // Back to where the results start, just under the pinned search box.
            const column = columnRef.current;
            const start = column ? column.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop : 0;
            if (scroller.scrollTop > start) scroller.scrollTo({ top: start, behavior: "instant" });
            return;
        }
        const el = document.getElementById(entryElementId(target.slug));
        if (el) scrollWithin(scroller, el, target.mode, (stickyRef.current?.offsetHeight ?? 0) + 12);
    });

    // The arrow keys keep the highlighted result in view.
    const revealActive = (i: number) => {
        const slug = visible[i]?.entry.slug;
        if (slug) pendingScroll.current = { slug, mode: "nearest" };
    };

    // Tell screen readers what the search found, once typing pauses.
    useEffect(() => {
        if (!data) return;
        const q = settled.trim();
        const text = !searching
            ? ""
            : hits.length === 0
              ? `No terms match ${q}.`
              : `${plural(hits.length, "term matches", "terms match")}. ${hits[0].entry.term} is open.`;
        const t = window.setTimeout(() => setAnnouncement(text), ANNOUNCE_MS);
        return () => window.clearTimeout(t);
    }, [data, searching, settled, hits]);

    const onChange = (value: string) => {
        setQuery(value);
        window.clearTimeout(timer.current);
        if (!compact(value)) {
            setSettled("");
            setOpenSlug(null);
            return;
        }
        timer.current = window.setTimeout(() => applySearch(value), DEBOUNCE_MS);
    };

    const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Escape") {
            if (!query) return;
            e.preventDefault();
            clearSearch();
            return;
        }
        if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Enter") return;
        if (query !== settled && compact(query)) {
            // Keys pressed inside the debounce act on what is in the box, not the last result.
            e.preventDefault();
            applySearch(query);
            return;
        }
        if (!searching || visible.length === 0) return;
        e.preventDefault();
        if (e.key === "Enter") {
            const slug = visible[active]?.entry.slug;
            if (slug && slug !== openSlug) toggleEntry(slug);
            return;
        }
        const next = Math.min(visible.length - 1, Math.max(0, active + (e.key === "ArrowDown" ? 1 : -1)));
        setActive(next);
        revealActive(next);
    };

    const filtered = useMemo(() => (data ? data.entries.filter((e) => matchesFilter(e, filter)) : []), [data, filter]);
    const sections = useMemo(() => groupBySection(filtered), [filtered]);
    const filterCounts = useMemo(
        () =>
            Object.fromEntries(FILTERS.map((f) => [f.id, data ? data.entries.filter((e) => matchesFilter(e, f.id)).length : 0])) as Record<
                DictionaryFilter,
                number
            >,
        [data],
    );

    const total = data?.entries.length ?? 0;
    const activeSlug = searching ? visible[active]?.entry.slug : undefined;

    const toggleSection = (section: number) =>
        setOpenSections((s) => {
            const next = new Set(s);
            if (next.has(section)) next.delete(section);
            else next.add(section);
            return next;
        });

    return (
        <AppShell
            className="flex flex-col"
            rail={roomForRail && !navCollapsed && <IconRail activeDept="docs" bottom={<RailBottom />} />}
            breadcrumb={[
                { label: "Dashboard", to: "/dashboard", icon: LayoutAlt01 },
                { label: "Dictionary", icon: BookClosed },
            ]}
        >
            {roomForRail && navCollapsed && <CollapsedTopBar title="Dictionary" onExpand={toggleNav} />}

            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto bg-secondary p-2">
                <div className="mx-auto w-full max-w-7xl px-2 py-6 sm:px-6 sm:py-8">
                    <header>
                        <h1 className="text-display-xs font-semibold text-primary">Industry acumen dictionary</h1>
                        <p className="mt-2 max-w-2xl text-sm text-pretty text-tertiary">
                            {total ? `${total} hotel, resort and marketing terms` : "Hotel, resort and marketing terms"}, with what each means for an owner and
                            how to say it on a call. Press{" "}
                            <kbd className="rounded bg-primary px-1.5 py-0.5 text-xs font-semibold text-secondary ring-1 ring-secondary">/</kbd> to search from
                            anywhere.
                        </p>
                    </header>

                    <div className="mt-6 flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
                        {roomForMenu && <DocsMenu onCollapse={navCollapsed ? undefined : toggleNav} />}

                        <div ref={columnRef} className="max-w-4xl min-w-0 flex-1">
                            {/* The search box stays put while the results scroll under it. It sticks at the
                                scroller's padding edge (-top-2), so nothing shows through above it. */}
                            <div ref={stickyRef} className="sticky -top-2 z-20 -mx-2 bg-secondary px-2 pt-3 pb-3">
                                <label className="flex h-12 items-center gap-2.5 rounded-xl border border-secondary bg-primary pr-1.5 pl-3.5 shadow-xs transition duration-100 ease-linear focus-within:border-brand focus-within:ring-1 focus-within:ring-brand motion-reduce:transition-none">
                                    <SearchLg className="size-5 shrink-0 text-fg-quaternary" aria-hidden="true" />
                                    <input
                                        ref={inputRef}
                                        type="search"
                                        role="combobox"
                                        aria-label="Search the dictionary"
                                        aria-autocomplete="list"
                                        aria-haspopup="grid"
                                        aria-controls="dictionary-results"
                                        aria-expanded={searching && hits.length > 0}
                                        aria-activedescendant={activeSlug ? `dict-cell-${activeSlug}` : undefined}
                                        aria-describedby="dictionary-hint"
                                        autoComplete="off"
                                        autoCorrect="off"
                                        autoCapitalize="none"
                                        spellCheck={false}
                                        enterKeyHint="search"
                                        placeholder="Search terms, acronyms or definitions"
                                        value={query}
                                        onChange={(e) => onChange(e.target.value)}
                                        onKeyDown={onKeyDown}
                                        className="h-full min-w-0 flex-1 bg-transparent text-md text-primary outline-none placeholder:text-placeholder [&::-webkit-search-cancel-button]:hidden"
                                    />
                                    {query ? (
                                        <button
                                            type="button"
                                            aria-label="Clear search"
                                            onClick={() => {
                                                clearSearch();
                                                inputRef.current?.focus({ preventScroll: true });
                                            }}
                                            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-fg-quaternary outline-focus-ring transition duration-100 ease-linear hover:bg-secondary hover:text-fg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
                                        >
                                            <XClose className="size-5" aria-hidden="true" />
                                        </button>
                                    ) : (
                                        <kbd
                                            className="mr-1.5 hidden rounded bg-secondary px-1.5 py-0.5 text-xs font-semibold text-tertiary ring-1 ring-secondary md:inline"
                                            aria-hidden="true"
                                        >
                                            /
                                        </kbd>
                                    )}
                                </label>
                                <p id="dictionary-hint" className="sr-only">
                                    Results update as you type and the best match opens below. Use the up and down arrows to move through results, Enter to open
                                    one, Escape to clear.
                                </p>
                                <p role="status" aria-live="polite" className="sr-only">
                                    {announcement}
                                </p>
                                {searching && data && hits.length > 0 && (
                                    <p className="mt-2 px-1 text-sm text-tertiary">{plural(hits.length, "term matches", "terms match")}</p>
                                )}
                            </div>

                            {loadFailed ? (
                                <div className="rounded-xl bg-primary p-5 ring-1 ring-secondary">
                                    <p className="text-md font-semibold text-primary">The dictionary couldn't load</p>
                                    <p className="mt-1 text-sm text-tertiary">
                                        The portal may have been updated since this tab was opened. Reloading picks up the new version.
                                    </p>
                                    <Button className="mt-4" size="sm" onClick={() => window.location.reload()}>
                                        Reload
                                    </Button>
                                </div>
                            ) : !data ? (
                                <p className="px-1 py-6 text-sm text-tertiary">Loading the dictionary…</p>
                            ) : searching ? (
                                hits.length === 0 ? (
                                    <div className="rounded-xl bg-primary p-5 ring-1 ring-secondary">
                                        <p className="text-md font-semibold text-primary">No terms match ‘{settled.trim()}’.</p>
                                        {suggestions.length > 0 && (
                                            <>
                                                <p className="mt-3 text-sm text-tertiary">Closest terms</p>
                                                <ul className="mt-2 flex flex-wrap gap-2">
                                                    {suggestions.map((s) => (
                                                        <li key={s.slug}>
                                                            <button
                                                                type="button"
                                                                onClick={() => searchFor(s.slug)}
                                                                className="inline-flex rounded-full border border-secondary bg-primary px-3 py-1 text-left text-sm text-secondary outline-focus-ring transition duration-100 ease-linear hover:border-brand hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
                                                            >
                                                                {s.term}
                                                            </button>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </>
                                        )}
                                    </div>
                                ) : (
                                    <>
                                        <h2 className="sr-only">Matching terms</h2>
                                        <div id="dictionary-results" role="grid" aria-label="Matching terms" className="flex flex-col gap-2">
                                            {visible.map((h, i) => (
                                                <div role="row" key={h.entry.slug}>
                                                    <div
                                                        role="gridcell"
                                                        id={`dict-cell-${h.entry.slug}`}
                                                        aria-selected={i === active}
                                                        aria-labelledby={`dict-term-${h.entry.slug}`}
                                                    >
                                                        <DictionaryEntryCard
                                                            entry={h.entry}
                                                            open={openSlug === h.entry.slug}
                                                            highlighted={i === active}
                                                            bySlug={data.bySlug}
                                                            onToggle={toggleEntry}
                                                            onRelated={searchFor}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        {!showAll && hits.length > SHOWN && (
                                            <div className="mt-4 px-1">
                                                <Button color="link-color" size="sm" onClick={() => setShowAll(true)}>
                                                    {`Show all ${hits.length}`}
                                                </Button>
                                            </div>
                                        )}
                                    </>
                                )
                            ) : (
                                <>
                                    <div role="group" aria-label="Filter terms" className="flex flex-wrap gap-2 px-1">
                                        {FILTERS.map((f) => {
                                            const pressed = filter === f.id;
                                            return (
                                                <button
                                                    key={f.id}
                                                    type="button"
                                                    aria-pressed={pressed}
                                                    onClick={() => setFilter(f.id)}
                                                    className={cx(
                                                        "inline-flex h-11 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium outline-focus-ring transition duration-100 ease-linear focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none sm:h-9",
                                                        pressed
                                                            ? "border-brand bg-brand-primary_alt text-brand-secondary"
                                                            : "border-secondary bg-primary text-secondary hover:bg-secondary",
                                                    )}
                                                >
                                                    {f.label}
                                                    <span className={cx("tabular-nums", pressed ? "text-brand-secondary" : "text-quaternary")}>
                                                        {filterCounts[f.id]}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <div className="mt-4 flex flex-col gap-3">
                                        {sections.map((group) => {
                                            const isOpen = openSections.has(group.section);
                                            const listId = `dict-section-${group.section}`;
                                            return (
                                                <section key={group.section} className="rounded-xl bg-primary ring-1 ring-secondary">
                                                    <h2>
                                                        <button
                                                            type="button"
                                                            aria-expanded={isOpen}
                                                            aria-controls={listId}
                                                            onClick={() => toggleSection(group.section)}
                                                            className="flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2 sm:px-5"
                                                        >
                                                            <span className="min-w-0 flex-1 text-md font-semibold text-primary">{group.name}</span>
                                                            <span className="font-mono text-sm text-quaternary tabular-nums">{group.entries.length}</span>
                                                            <ChevronDown
                                                                className={cx(
                                                                    "size-5 shrink-0 text-fg-quaternary transition-transform duration-100 ease-linear motion-reduce:transition-none",
                                                                    !isOpen && "-rotate-90",
                                                                )}
                                                                aria-hidden="true"
                                                            />
                                                        </button>
                                                    </h2>
                                                    {isOpen && (
                                                        <ul id={listId} className="flex flex-col gap-2 border-t border-secondary bg-secondary/50 p-2 sm:p-3">
                                                            {group.entries.map((entry) => (
                                                                <li key={entry.slug}>
                                                                    <DictionaryEntryCard
                                                                        entry={entry}
                                                                        open={openSlug === entry.slug}
                                                                        bySlug={data.bySlug}
                                                                        onToggle={toggleEntry}
                                                                        onRelated={searchFor}
                                                                    />
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                </section>
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </AppShell>
    );
};

export const DictionaryScreen = () => {
    useEffect(parkLink, []);
    return (
        <TeamGate>
            <Dictionary />
        </TeamGate>
    );
};
