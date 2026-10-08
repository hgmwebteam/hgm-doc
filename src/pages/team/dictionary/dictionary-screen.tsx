import { type KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";
import { ChevronDown, Download01, Eye, File06, PresentationChart01, SearchLg, XClose } from "@untitledui/icons";
import { useLocation } from "react-router";
import { Button } from "@/components/base/buttons/button";
import { TeamGate } from "@/pages/team/dashboard-screen";
import { CheckLinks } from "@/pages/team/dictionary/check/check-links";
import { type DictionaryData, loadDictionary } from "@/pages/team/dictionary/dictionary-data";
import { DictionaryEntryCard, entryElementId } from "@/pages/team/dictionary/dictionary-entry";
import { DictionaryLayout } from "@/pages/team/dictionary/dictionary-layout";
import { type DictionaryFilter, FILTERS, type Hit, compact, groupBySection, matchesFilter, search, suggest } from "@/pages/team/dictionary/dictionary-model";
import { DICTIONARY_RESOURCES, type DictionaryResource, type ResourceFile } from "@/pages/team/dictionary/dictionary-resources";
import { cx } from "@/utils/cx";

/**
 * `/dictionary` — the HiddenGem Industry Acumen Dictionary: 253 hotel, resort and
 * marketing terms, searched as you type. Account managers use it live on client calls,
 * so everything leans towards fewer clicks: the box has focus on arrival, `/` returns to
 * it from anywhere, and the best match opens in full without a click.
 *
 * It is laid out exactly like a Docs tab on /dashboard — the same icon rail, header row
 * and Docs side menu (DictionaryLayout, shared with the check's pages) in the same place,
 * with the dictionary in the pane to its right — so moving between Docs pages leaves the
 * menu where it is. It keeps its own route so /dictionary#term links work. Below md, where
 * that layout doesn't fit, the rail and menu drop out and the search box comes first.
 *
 * Under the heading, CheckLinks is the way into the check and the flashcards
 * (src/pages/team/dictionary/check/).
 *
 * Behind TeamGate, like /dashboard. The gate hides the page, not the data: the JSON is a
 * public chunk of the site like every other page's content (agreed 2026-10-01).
 *
 * Search, ranking and labels live in dictionary-model.ts; loading in dictionary-data.ts.
 */

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
 * Scrolls the pane's own scroller. Never scrollIntoView here: AppShell's root is
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

/* ── Resources ──────────────────────────────────────────────────── */

/** One file's button: View opens it in a new tab, the others download it. Disabled until the file is dropped in. */
const ResourceButton = ({
    file,
    view,
    label,
    color,
    noteId,
}: {
    file: ResourceFile;
    view?: boolean;
    label: string;
    color: "primary" | "secondary";
    noteId: string;
}) =>
    file.url ? (
        view ? (
            <Button size="sm" color={color} iconLeading={Eye} href={file.url} target="_blank" rel="noopener noreferrer">
                {label}
            </Button>
        ) : (
            <Button size="sm" color={color} iconLeading={Download01} href={file.url} download={file.downloadName}>
                {label}
            </Button>
        )
    ) : (
        <Button size="sm" color={color} iconLeading={view ? Eye : Download01} isDisabled aria-describedby={noteId}>
            {label}
        </Button>
    );

const ResourceCard = ({ r, Heading }: { r: DictionaryResource; Heading: "h3" | "h4" }) => {
    const noteId = `dict-res-${r.id}`;
    const Icon = r.pptx ? PresentationChart01 : File06;
    return (
        <li className="flex flex-col rounded-xl bg-primary p-4 ring-1 ring-secondary">
            <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-primary_alt text-fg-brand-secondary ring-1 ring-brand">
                    <Icon className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                    <Heading className="text-sm font-semibold break-words text-primary">{r.title}</Heading>
                    <p className="mt-0.5 text-sm text-tertiary">{r.description}</p>
                </div>
            </div>
            <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
                <ResourceButton file={r.pdf} view label="View" color="secondary" noteId={noteId} />
                <ResourceButton file={r.pdf} label={r.pptx ? "Download PDF" : "Download"} color="primary" noteId={noteId} />
                {r.pptx && <ResourceButton file={r.pptx} label="Download PowerPoint" color="secondary" noteId={noteId} />}
                {(!r.pdf.url || (r.pptx && !r.pptx.url)) && (
                    <span id={noteId} className="text-xs font-medium text-quaternary">
                        Coming soon
                    </span>
                )}
            </div>
        </li>
    );
};

const RESOURCE_GRID = "mt-3 grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-3";

/**
 * The PDFs that go with the dictionary, then the slides from the two training sessions,
 * shown in the browse view (an empty search box): one click from the Docs menu, and out
 * of the way while searching on a call. Each deck is a PDF to read and a PowerPoint to
 * present or edit, speaker notes included. A file not dropped in yet keeps its button,
 * disabled, beside "Coming soon". The columns fit the pane (auto-fit), not the window:
 * beside the rail and menu the pane is narrow.
 */
const Resources = () => (
    <section aria-labelledby="dict-resources" className="mt-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-1">
            <h2 id="dict-resources" className="text-md font-semibold text-primary">
                Resources
            </h2>
            <p className="text-sm text-tertiary">PDFs and slides to view, download or print</p>
        </div>
        <ul className={RESOURCE_GRID}>
            {DICTIONARY_RESOURCES.filter((r) => r.group === "reference").map((r) => (
                <ResourceCard key={r.id} r={r} Heading="h3" />
            ))}
        </ul>
        <div className="mt-6 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-1">
            <h3 id="dict-resources-slides" className="text-sm font-semibold text-secondary">
                Training session slides
            </h3>
            <p className="text-sm text-tertiary">The PowerPoint has the speaker notes</p>
        </div>
        <ul aria-labelledby="dict-resources-slides" className={RESOURCE_GRID}>
            {DICTIONARY_RESOURCES.filter((r) => r.group === "slides").map((r) => (
                <ResourceCard key={r.id} r={r} Heading="h4" />
            ))}
        </ul>
    </section>
);

/* ── The page ───────────────────────────────────────────────────── */

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const Dictionary = () => {
    const location = useLocation();

    const [data, setData] = useState<DictionaryData | null>(null);
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
    /** Marks where the pinned search box sits before it pins: "back to the top" scrolls here. */
    const barAnchorRef = useRef<HTMLDivElement>(null);
    const dataRef = useRef<DictionaryData | null>(null);
    const timer = useRef<number | undefined>(undefined);
    // What to scroll to after the next render: an entry's top, or the results' top. Each
    // request forces its own render, so it is never left over for an unrelated later one.
    type ScrollTarget = { slug: string; mode: "start" | "nearest" } | "top";
    const pendingScroll = useRef<ScrollTarget | null>(null);
    const [, bumpScroll] = useReducer((n: number) => n + 1, 0);
    const requestScroll = useCallback((target: ScrollTarget) => {
        pendingScroll.current = target;
        bumpScroll();
    }, []);

    const searching = compact(settled) !== "";
    const hits = useMemo(() => (data && searching ? search(data.index, settled) : []), [data, searching, settled]);
    const visible = showAll ? hits : hits.slice(0, SHOWN);
    const suggestions = useMemo(() => (data && searching && hits.length === 0 ? suggest(data.index, settled) : []), [data, searching, hits.length, settled]);

    /** Run a query now: the best match opens in full and the list returns to the top. */
    const applySearch = useCallback(
        (q: string, open?: string): Hit[] => {
            window.clearTimeout(timer.current);
            setSettled(q);
            setShowAll(false);
            const d = dataRef.current;
            if (!d) return []; // picked up when the data arrives
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
            requestScroll("top");
            return found;
        },
        [requestScroll],
    );

    const clearSearch = useCallback(() => {
        window.clearTimeout(timer.current);
        setQuery("");
        setSettled("");
        setOpenSlug(null);
        setActive(0);
    }, []);

    /** Browse view, scrolled to one entry and opened: a deep link, a pasted #slug, or the header search. */
    const goToEntry = useCallback(
        (slug: string) => {
            const entry = dataRef.current?.bySlug.get(slug);
            if (!entry) return;
            window.clearTimeout(timer.current);
            setQuery("");
            setSettled("");
            setFilter((f) => (matchesFilter(entry, f) ? f : "all"));
            setOpenSections((s) => new Set(s).add(entry.section));
            setOpenSlug(slug);
            requestScroll({ slug, mode: "start" });
        },
        [requestScroll],
    );

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
        requestScroll({ slug, mode: "nearest" });
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

    // A term picked in the header's global search while already here: React Router
    // navigates to /dictionary#slug, which changes the location but fires no hashchange.
    const firstLocation = useRef(true);
    useEffect(() => {
        if (firstLocation.current) {
            firstLocation.current = false; // the load above handles the address we arrived on
            return;
        }
        const slug = slugFromHash(location.hash);
        if (slug) goToEntry(slug);
        else clearSearch(); // e.g. Back to the bare /dictionary: nothing open, as the address says
    }, [location.key, location.hash, goToEntry, clearSearch]);

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
            const anchor = barAnchorRef.current;
            const start = anchor ? anchor.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop : 0;
            if (scroller.scrollTop > start) scroller.scrollTo({ top: start, behavior: "instant" });
            return;
        }
        const el = document.getElementById(entryElementId(target.slug));
        if (el) scrollWithin(scroller, el, target.mode, (stickyRef.current?.offsetHeight ?? 0) + 12);
    });

    // The arrow keys keep the highlighted result in view.
    const revealActive = (i: number) => {
        const slug = visible[i]?.entry.slug;
        if (slug && i !== active) requestScroll({ slug, mode: "nearest" });
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
            // A key pressed inside the debounce acts on what is in the box: run that search now
            // (its best match opens, so Enter is done), then let ↓ move on to the second result.
            e.preventDefault();
            const found = applySearch(query);
            if (e.key === "ArrowDown" && found.length > 1) {
                setActive(1);
                requestScroll({ slug: found[1].entry.slug, mode: "nearest" });
            }
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
        <DictionaryLayout scrollRef={scrollRef}>
            <div className="mx-auto w-full max-w-4xl px-4 pt-6 pb-12 sm:px-8 sm:pt-8">
                <header>
                    <h1 className="text-display-xs font-semibold text-primary md:text-display-sm">The HiddenGem Industry Acumen Dictionary</h1>
                    <p className="mt-2 max-w-2xl text-md text-pretty text-tertiary">
                        {total ? `${total} hotel, resort and marketing terms` : "Hotel, resort and marketing terms"}, with what each means for an owner and how
                        to say it on a call. Press{" "}
                        <kbd className="rounded bg-secondary px-1.5 py-0.5 text-xs font-semibold text-secondary ring-1 ring-secondary">/</kbd> to search from
                        anywhere.
                    </p>
                    <CheckLinks />
                </header>

                <div ref={barAnchorRef} className="mt-6" aria-hidden="true" />
                {/* The search box stays put while the results scroll under it. */}
                <div ref={stickyRef} className="sticky top-0 z-20 -mx-4 bg-primary px-4 pt-2 pb-3 sm:-mx-8 sm:px-8">
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
                        Results update as you type and the best match opens below. Use the up and down arrows to move through results, Enter to open one, Escape
                        to clear.
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
                        <Resources />

                        <section aria-labelledby="dict-browse" className="mt-8">
                            <h2 id="dict-browse" className="px-1 text-md font-semibold text-primary">
                                Browse by section
                            </h2>
                            <div role="group" aria-label="Filter terms by tier" className="mt-3 flex flex-wrap gap-2 px-1">
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
                                            <h3>
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
                                            </h3>
                                            {isOpen && (
                                                <ul id={listId} className="flex flex-col gap-2 border-t border-secondary bg-secondary p-2 sm:p-3">
                                                    {group.entries.map((entry) => (
                                                        <li key={entry.slug}>
                                                            <DictionaryEntryCard
                                                                entry={entry}
                                                                open={openSlug === entry.slug}
                                                                bySlug={data.bySlug}
                                                                onToggle={toggleEntry}
                                                                onRelated={searchFor}
                                                                headingLevel={4}
                                                            />
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </section>
                                    );
                                })}
                            </div>
                        </section>
                    </>
                )}
            </div>
        </DictionaryLayout>
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
