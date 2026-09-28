import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ChevronDown, FilterLines, Users01, XClose } from "@untitledui/icons";
import { AnimatePresence, motion } from "motion/react";
import { CheckboxBase } from "@/components/base/checkbox/checkbox";
import { cx } from "@/utils/cx";
import { type DirectoryClient, type SortKey, clientId, managerOf, managersOf, matchesQuery, sortClients } from "./directory-model";
import { EASE_SOFT, HostingBadge, Initial, foldProps, popProps } from "./directory-ui";

type Filters = { platform: Set<string>; status: Set<string>; manager: Set<string> };
const emptyFilters = (): Filters => ({ platform: new Set(), status: new Set(), manager: new Set() });
const filterCount = (f: Filters) => f.platform.size + f.status.size + f.manager.size;
const passes = (c: DirectoryClient, f: Filters) => {
    if (f.platform.size && !f.platform.has(c.platform)) return false;
    if (f.status.has("live") && !c.live) return false;
    if (f.status.has("metaTags") && !c.metaTags) return false;
    if (f.manager.size && !f.manager.has(managerOf(c))) return false;
    return true;
};

/** How many picked clients show as chips before the rest fold into "+N". */
const MAX_CHIPS = 3;

/** The list's blocks arrive a beat apart once the list has opened. */
const block = (i: number) => ({
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.42, ease: EASE_SOFT, delay: 0.04 * i },
});

const FilterChip = ({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
        type="button"
        aria-pressed={pressed}
        onClick={onClick}
        className={cx(
            "inline-flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium whitespace-nowrap transition duration-100 ease-linear",
            pressed ? "border-brand bg-brand-primary_alt text-brand-secondary" : "border-secondary bg-primary text-secondary hover:bg-secondary",
        )}
    >
        {children}
    </button>
);

/**
 * The client picker: a search bar that holds the picked clients as chips and drops a list under
 * itself, with filters and sortable columns. Keyboard works throughout: arrows move, Enter
 * ticks, Escape clears then closes, Backspace on an empty search unpicks the last client, and
 * `/` anywhere on the page focuses it.
 */
export const ClientPicker = ({
    clients,
    selectedClients,
    onToggle,
    onClear,
    scoped,
    onOpenChange,
}: {
    /** The clients in scope, in any order. */
    clients: DirectoryClient[];
    /** The picked clients, in the order they were picked. */
    selectedClients: DirectoryClient[];
    onToggle: (id: string) => void;
    onClear: () => void;
    /** Viewing as one manager: the manager column and filter say nothing, so they go. */
    scoped: boolean;
    /** Told when the list opens and closes, so the page can step back behind it. */
    onOpenChange?: (open: boolean) => void;
}) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [filters, setFilters] = useState<Filters>(emptyFilters);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [sortKey, setSortKey] = useState<SortKey>("name");
    const [dir, setDir] = useState<1 | -1>(1);
    const [active, setActive] = useState(0);
    const rootRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const selectedIds = useMemo(() => new Set(selectedClients.map(clientId)), [selectedClients]);
    const managers = useMemo(() => managersOf(clients), [clients]);
    const options = useMemo(
        () =>
            sortClients(
                clients.filter((c) => matchesQuery(c, query) && passes(c, filters)),
                sortKey,
                dir,
            ),
        [clients, query, filters, sortKey, dir],
    );
    const activeFilters = filterCount(filters);

    useEffect(() => setActive(0), [options.length, query]);
    useEffect(() => {
        onOpenChange?.(open);
    }, [open, onOpenChange]);

    // Close on a click anywhere else.
    useEffect(() => {
        if (!open) return;
        const onDown = (e: PointerEvent) => {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
        };
        document.addEventListener("pointerdown", onDown);
        return () => document.removeEventListener("pointerdown", onDown);
    });

    // "/" from anywhere on the page lands in the search, as in the original page.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement | null)?.tagName;
            if (e.key !== "/" || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (e.target as HTMLElement | null)?.isContentEditable) return;
            e.preventDefault();
            setOpen(true);
            inputRef.current?.focus();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, []);

    useEffect(() => {
        const row = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
        row?.scrollIntoView({ block: "nearest" });
    }, [active]);

    const close = () => {
        setOpen(false);
        setQuery("");
        setFiltersOpen(false);
    };

    const toggleFilter = (kind: keyof Filters, value: string) =>
        setFilters((f) => {
            const next = new Set(f[kind]);
            if (next.has(value)) next.delete(value);
            else next.add(value);
            return { ...f, [kind]: next };
        });

    const toggleSort = (key: SortKey) => {
        if (key === sortKey) setDir((d) => (d === 1 ? -1 : 1));
        else {
            setSortKey(key);
            setDir(1);
        }
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!open) {
            if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter") {
                e.preventDefault();
                setOpen(true);
            }
            return;
        }
        if (e.key === "Backspace" && !query && selectedClients.length) {
            onToggle(clientId(selectedClients[selectedClients.length - 1]));
            return;
        }
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            if (!options.length) return;
            setActive((i) => (e.key === "ArrowDown" ? Math.min(i + 1, options.length - 1) : Math.max(i - 1, 0)));
        } else if (e.key === "Home" || e.key === "End") {
            if (!options.length) return;
            e.preventDefault();
            setActive(e.key === "Home" ? 0 : options.length - 1);
        } else if (e.key === "Enter") {
            e.preventDefault();
            const c = options[active];
            if (c) {
                onToggle(clientId(c));
                if (query) setQuery("");
            }
        } else if (e.key === "Escape") {
            e.preventDefault();
            if (query) setQuery("");
            else close();
        } else if (e.key === "Tab" && e.shiftKey) {
            close();
        }
    };

    const cols = scoped ? "grid-cols-[18px_minmax(0,1fr)_96px]" : "grid-cols-[18px_minmax(0,1fr)_150px_96px]";
    const visibleChips = selectedClients.slice(0, MAX_CHIPS);
    const hiddenChips = selectedClients.length - visibleChips.length;
    const groupLabel = (c: DirectoryClient) => (sortKey === "manager" ? managerOf(c) || "Unassigned" : c.platform);
    const grouped = !query && (sortKey === "manager" || sortKey === "platform");

    let lastGroup = "";
    return (
        <div ref={rootRef} className="relative">
            <div
                className={cx(
                    "flex h-10 w-full cursor-text items-center gap-2 rounded-lg border bg-primary pr-1 pl-3 shadow-xs transition duration-100 ease-linear",
                    open ? "border-brand ring-1 ring-brand" : "border-secondary",
                )}
                onClick={() => {
                    setOpen(true);
                    inputRef.current?.focus();
                }}
            >
                {selectedClients.length === 0 && <Users01 className="size-4 shrink-0 text-fg-quaternary" aria-hidden="true" />}
                {visibleChips.map((c) => (
                    <span
                        key={clientId(c)}
                        className="inline-flex h-7 max-w-52 shrink-0 items-center gap-1 rounded-md border border-secondary bg-secondary pl-2.5 text-sm font-medium text-primary"
                    >
                        <span className="truncate">{c.name}</span>
                        <button
                            type="button"
                            aria-label={`Remove ${c.name}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggle(clientId(c));
                            }}
                            className="flex size-6 items-center justify-center rounded-md text-quaternary transition duration-100 ease-linear hover:bg-primary hover:text-primary"
                        >
                            <XClose className="size-3.5" aria-hidden="true" />
                        </button>
                    </span>
                ))}
                {hiddenChips > 0 && (
                    <span className="inline-flex h-7 shrink-0 items-center rounded-lg bg-secondary px-2 text-xs font-semibold text-secondary">
                        +{hiddenChips}
                    </span>
                )}
                <input
                    ref={inputRef}
                    type="text"
                    role="combobox"
                    aria-expanded={open}
                    aria-controls="lpd-client-options"
                    aria-autocomplete="list"
                    aria-label="Choose clients"
                    autoComplete="off"
                    spellCheck={false}
                    value={query}
                    placeholder={selectedClients.length ? "" : "Choose clients"}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setOpen(true);
                    }}
                    onKeyDown={onKeyDown}
                    className="h-full min-w-[120px] flex-1 bg-transparent text-sm text-primary outline-none placeholder:text-placeholder"
                />
                <button
                    type="button"
                    aria-expanded={filtersOpen}
                    aria-label={activeFilters ? `Filter clients, ${activeFilters} active` : "Filter clients"}
                    onClick={(e) => {
                        e.stopPropagation();
                        setOpen(true);
                        setFiltersOpen((v) => !v);
                    }}
                    className={cx(
                        "relative flex size-8 shrink-0 items-center justify-center rounded-md transition duration-100 ease-linear",
                        filtersOpen ? "bg-brand-primary_alt text-brand-secondary" : "text-tertiary hover:bg-secondary hover:text-primary",
                    )}
                >
                    <FilterLines className="size-4" aria-hidden="true" />
                    {activeFilters > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-brand-solid px-1 text-[9px] font-semibold text-white">
                            {activeFilters}
                        </span>
                    )}
                </button>
                {selectedClients.length > 0 && (
                    <button
                        type="button"
                        aria-label="Clear selection"
                        onClick={(e) => {
                            e.stopPropagation();
                            onClear();
                        }}
                        className="flex size-8 shrink-0 items-center justify-center rounded-md text-tertiary transition duration-100 ease-linear hover:bg-secondary hover:text-primary"
                    >
                        <XClose className="size-4" aria-hidden="true" />
                    </button>
                )}
                <button
                    type="button"
                    tabIndex={-1}
                    aria-label="Show or hide the client list"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (open) close();
                        else {
                            setOpen(true);
                            inputRef.current?.focus();
                        }
                    }}
                    className="flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary transition duration-100 ease-linear hover:text-primary"
                >
                    <ChevronDown
                        className={cx("size-4 transition-transform duration-300 ease-[cubic-bezier(.2,.8,.2,1)]", open && "rotate-180")}
                        aria-hidden="true"
                    />
                </button>
            </div>

            <AnimatePresence>
                {open && (
                    <motion.div
                        key="list"
                        {...popProps("top left")}
                        className="absolute top-full right-0 left-0 z-30 mt-2 flex max-h-[min(50vh,440px)] flex-col overflow-hidden rounded-xl border border-secondary bg-primary shadow-lg"
                    >
                        <AnimatePresence initial={false}>
                            {filtersOpen && (
                                <motion.div key="filters" {...foldProps} className="shrink-0 overflow-hidden">
                                    <div className="flex flex-col gap-3 border-b border-secondary px-3 py-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-semibold tracking-wider text-quaternary uppercase">Filters</span>
                                            {activeFilters > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => setFilters(emptyFilters())}
                                                    className="text-xs font-medium text-brand-secondary hover:underline"
                                                >
                                                    Clear filters
                                                </button>
                                            )}
                                        </div>
                                        <div>
                                            <span className="mb-1.5 block text-xs text-tertiary">Hosting</span>
                                            <div className="flex flex-wrap gap-1.5">
                                                <FilterChip pressed={filters.platform.has("Netlify")} onClick={() => toggleFilter("platform", "Netlify")}>
                                                    Netlify sites
                                                </FilterChip>
                                                <FilterChip
                                                    pressed={filters.platform.has("GoHighLevel")}
                                                    onClick={() => toggleFilter("platform", "GoHighLevel")}
                                                >
                                                    GoHighLevel sites
                                                </FilterChip>
                                            </div>
                                        </div>
                                        <div>
                                            <span className="mb-1.5 block text-xs text-tertiary">Status</span>
                                            <div className="flex flex-wrap gap-1.5">
                                                <FilterChip pressed={filters.status.has("live")} onClick={() => toggleFilter("status", "live")}>
                                                    Live sites
                                                </FilterChip>
                                                <FilterChip pressed={filters.status.has("metaTags")} onClick={() => toggleFilter("status", "metaTags")}>
                                                    Meta tags added
                                                </FilterChip>
                                            </div>
                                        </div>
                                        {!scoped && (
                                            <div>
                                                <span className="mb-1.5 block text-xs text-tertiary">Account manager</span>
                                                {managers.length ? (
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {managers.map((m) => (
                                                            <FilterChip key={m} pressed={filters.manager.has(m)} onClick={() => toggleFilter("manager", m)}>
                                                                {m}
                                                            </FilterChip>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-tertiary">No account managers assigned yet. Add one when you edit a client.</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <motion.div
                            {...block(0)}
                            className={cx("grid h-10 shrink-0 items-center gap-3 border-b border-secondary bg-secondary px-4", cols)}
                            role="row"
                        >
                            <span />
                            {(scoped ? (["name", "platform"] as SortKey[]) : (["name", "manager", "platform"] as SortKey[])).map((key) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => toggleSort(key)}
                                    aria-sort={sortKey === key ? (dir === 1 ? "ascending" : "descending") : "none"}
                                    className={cx(
                                        "inline-flex items-center gap-1 text-xs font-medium transition duration-100 ease-linear hover:text-primary",
                                        sortKey === key ? "font-semibold text-primary" : "text-tertiary",
                                    )}
                                >
                                    {key === "name" ? "Client" : key === "manager" ? "Account manager" : "Hosting"}
                                    <ArrowDown
                                        className={cx(
                                            "size-3 transition duration-100",
                                            sortKey === key ? "opacity-100" : "opacity-0",
                                            sortKey === key && dir === -1 && "rotate-180",
                                        )}
                                        aria-hidden="true"
                                    />
                                </button>
                            ))}
                        </motion.div>

                        <motion.div
                            {...block(1)}
                            ref={listRef}
                            id="lpd-client-options"
                            role="listbox"
                            aria-label="Clients"
                            aria-multiselectable="true"
                            className="min-h-32 flex-1 overflow-y-auto p-2"
                        >
                            {options.length === 0 && (
                                <p className="px-3 py-3 text-sm text-secondary">
                                    {query.trim() ? (
                                        <>
                                            No clients match <b className="font-medium text-primary">{query.trim()}</b>.
                                        </>
                                    ) : (
                                        "No clients match these filters."
                                    )}
                                </p>
                            )}
                            {options.map((c, i) => {
                                const id = clientId(c);
                                const picked = selectedIds.has(id);
                                const label = groupLabel(c);
                                const header = grouped && label !== lastGroup;
                                if (header) lastGroup = label;
                                return (
                                    <div key={id}>
                                        {header && (
                                            <div className="sticky top-0 z-10 flex items-center justify-between bg-primary px-3 pt-3 pb-1.5 text-[11px] font-semibold tracking-wider text-quaternary uppercase">
                                                <span>{label}</span>
                                                <span className="font-medium tracking-normal normal-case">
                                                    {options.filter((o) => groupLabel(o) === label).length}
                                                </span>
                                            </div>
                                        )}
                                        <button
                                            type="button"
                                            role="option"
                                            aria-selected={picked}
                                            data-index={i}
                                            onMouseDown={(e) => e.preventDefault()}
                                            onMouseMove={() => i !== active && setActive(i)}
                                            onClick={() => {
                                                onToggle(id);
                                                if (query) setQuery("");
                                                inputRef.current?.focus();
                                            }}
                                            className={cx(
                                                "grid h-11 w-full items-center gap-3 rounded-lg px-2 text-left transition duration-100 ease-linear",
                                                cols,
                                                i === active && "bg-secondary",
                                            )}
                                        >
                                            <CheckboxBase isSelected={picked} />
                                            <span className={cx("truncate text-sm text-primary", picked ? "font-semibold" : "font-medium")}>{c.name}</span>
                                            {!scoped && (
                                                <span className="flex min-w-0 items-center gap-2 text-xs text-secondary">
                                                    {managerOf(c) ? (
                                                        <>
                                                            <Initial name={managerOf(c)} />
                                                            <span className="truncate">{managerOf(c)}</span>
                                                        </>
                                                    ) : (
                                                        <span className="text-quaternary">Unassigned</span>
                                                    )}
                                                </span>
                                            )}
                                            <span className="flex justify-start">
                                                <HostingBadge platform={c.platform} />
                                            </span>
                                        </button>
                                    </div>
                                );
                            })}
                        </motion.div>

                        <motion.div {...block(2)} className="flex shrink-0 items-center justify-between gap-3 border-t border-secondary px-3 py-2">
                            <span className="text-xs text-tertiary">
                                {selectedClients.length ? `${selectedClients.length} selected` : "None selected"}
                                {selectedClients.length > 0 && (
                                    <button type="button" onClick={onClear} className="ml-3 text-xs font-medium text-brand-secondary hover:underline">
                                        Clear
                                    </button>
                                )}
                            </span>
                            <button
                                type="button"
                                onClick={close}
                                className="rounded-lg bg-brand-solid px-3 py-1.5 text-xs font-semibold text-white transition duration-100 ease-linear hover:bg-brand-solid_hover"
                            >
                                Done
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
