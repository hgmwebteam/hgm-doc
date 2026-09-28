import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Plus } from "@untitledui/icons";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { BadgeWithDot } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { cx } from "@/utils/cx";
import { ClientCard } from "./client-card";
import { ClientEditor } from "./client-editor";
import { ClientPeek } from "./client-peek";
import { ClientPicker } from "./client-picker";
import { ClientsTable, TableSearch } from "./clients-table";
import {
    CHANNELS,
    type DirectoryClient,
    type EditorTab,
    type PromptSection,
    TEAM,
    byName,
    clientId,
    managerOf,
    managersOf,
    matchesQuery,
} from "./directory-model";
import { CollapsibleOverview, DirectoryOverview } from "./directory-overview";
import { EASE_SOFT, EditFrame, Eyebrow, FAST, Initial, PopScope, SOFT, Segmented, popIn, popProps, settleProps } from "./directory-ui";
import { PromptLibrary } from "./prompt-library";
import { useDirectoryData } from "./use-directory-data";

/* Per-person conveniences (what's picked, who you're viewing as, which page) live in
   localStorage, as the standalone page kept them. Nothing here is shared state. */
const store = {
    get: (k: string) => {
        try {
            return localStorage.getItem(k);
        } catch {
            return null;
        }
    },
    set: (k: string, v: string) => {
        try {
            localStorage.setItem(k, v);
        } catch {
            // A private window that refuses storage just forgets between visits.
        }
    },
};

const readSelected = (): string[] => {
    try {
        const v: unknown = JSON.parse(store.get("lpd.selected") || "[]");
        return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
    } catch {
        return [];
    }
};

export type DirectoryPage = "directory" | "prompts";
type Section = DirectoryPage;
type View = "client" | "all";

/** "Viewing as": everyone, or one account manager's clients. */
const ScopeMenu = ({
    clients,
    managers,
    scope,
    onChange,
}: {
    clients: DirectoryClient[];
    managers: string[];
    scope: string;
    onChange: (scope: string) => void;
}) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onDown = (e: PointerEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("pointerdown", onDown);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("pointerdown", onDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const count = (m: string) => clients.filter((c) => managerOf(c) === m).length;
    const extra = TEAM.filter((m) => !managers.includes(m));

    const item = (m: string, n: number) => (
        <button
            key={m || "__all"}
            type="button"
            role="option"
            aria-selected={scope === m}
            onClick={() => {
                onChange(m);
                setOpen(false);
            }}
            className={cx(
                "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition duration-100 ease-linear hover:bg-secondary",
                scope === m && "bg-secondary",
            )}
        >
            <span className="flex min-w-0 items-center gap-2.5">
                {m ? (
                    <Initial name={m} size="md" />
                ) : (
                    <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-secondary text-[10px] font-bold text-secondary">
                        All
                    </span>
                )}
                <span className={cx("truncate text-sm text-primary", scope === m && "font-semibold")}>{m || "Full Overview"}</span>
            </span>
            <span className="shrink-0 text-xs text-tertiary">
                {n} client{n === 1 ? "" : "s"}
            </span>
        </button>
    );

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={open}
                title="Switch account manager"
                onClick={() => setOpen((v) => !v)}
                className={cx(
                    "flex h-10 items-center gap-2.5 rounded-lg border bg-primary py-1 pr-3 pl-1.5 shadow-xs transition duration-100 ease-linear hover:bg-secondary",
                    open ? "border-brand ring-1 ring-brand" : "border-secondary",
                )}
            >
                {scope ? (
                    <Initial name={scope} size="md" />
                ) : (
                    <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-secondary text-[10px] font-bold text-secondary">
                        All
                    </span>
                )}
                <span className="hidden flex-col items-start leading-tight sm:flex">
                    <span className="text-[10px] font-semibold tracking-wider text-quaternary uppercase">Viewing as</span>
                    <span className="text-sm font-semibold text-primary">{scope || "Full Overview"}</span>
                </span>
                <ChevronDown
                    className={cx("size-4 text-fg-quaternary transition-transform duration-300 ease-[cubic-bezier(.2,.8,.2,1)]", open && "rotate-180")}
                    aria-hidden="true"
                />
            </button>
            <AnimatePresence>
                {open && (
                    <motion.div
                        key="menu"
                        role="listbox"
                        aria-label="Switch view"
                        {...popProps("top right")}
                        className="absolute top-full right-0 z-30 mt-2 w-72 rounded-xl border border-secondary bg-primary p-2 shadow-lg"
                    >
                        {item("", clients.length)}
                        {managers.map((m) => item(m, count(m)))}
                        {extra.length > 0 && (
                            <>
                                <p className="mt-1 border-t border-secondary px-3 pt-2 pb-1 text-[11px] font-medium text-quaternary">No clients yet</p>
                                {extra.map((m) => item(m, 0))}
                            </>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

/**
 * The Landing Page Directory: the Web Team's Landing Page → Directory row. Every client's
 * landing-page setup and links on one page, plus the prompt library the team builds those
 * pages with. Edit mode (the dashboard's Shift+E / rail lock) unlocks adding and changing.
 *
 * Motion follows the standalone page: the toolbar and content rise in, pages and views
 * crossfade, the overview folds into its summary bar, cards settle with their rows in turn,
 * and the page steps back while the client list is open. MotionConfig honours the OS
 * reduced-motion setting for all of it.
 */
/** `page` is chosen by the dashboard's side menu (Landing Page → Directory / Prompt Library). */
export const LandingPageDirectoryContent = ({ editing, page = "directory" }: { editing: boolean; page?: DirectoryPage }) => {
    const { data, loading, save, saveState, saveError } = useDirectoryData();
    const [scope, setScope] = useState(() => store.get("lpd.scope") ?? "");
    const [view, setView] = useState<View>(() => (store.get("lpd.view") === "all" ? "all" : "client"));
    const [selected, setSelected] = useState<string[]>(readSelected);
    const [overviewOpen, setOverviewOpen] = useState(() => store.get("lpd.overview") === "1");
    const [editor, setEditor] = useState<{ id?: string; tab?: EditorTab } | null>(null);
    const [peek, setPeek] = useState<{ id: string; alertId?: string } | null>(null);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [tableQuery, setTableQuery] = useState("");
    const rootRef = useRef<HTMLDivElement>(null);
    // The first time each page shows in a visit its blocks pop in; after that, switching is a quick crossfade.
    const popped = useRef(new Set<Section>());
    const sectionMotion = (s: Section) => (popped.current.has(s) ? settleProps : { exit: settleProps.exit });

    // Pressing Directory: the header and the slug strip pop in straight away; the page's own blocks
    // follow the moment the data lands (PopScope, below).
    useLayoutEffect(() => {
        const root = rootRef.current;
        popIn(root?.querySelector("header"));
        popIn(root?.querySelector("footer"), { start: 160, stagger: 35 });
    }, []);

    useEffect(() => store.set("lpd.scope", scope), [scope]);
    useEffect(() => store.set("lpd.view", view), [view]);
    useEffect(() => store.set("lpd.selected", JSON.stringify(selected)), [selected]);
    useEffect(() => store.set("lpd.overview", overviewOpen ? "1" : ""), [overviewOpen]);
    useEffect(() => setPickerOpen(false), [view, page]);

    const clients = data?.clients ?? [];
    const sections = data?.sections ?? [];
    const byId = useMemo(() => new Map(clients.map((c) => [clientId(c), c])), [clients]);
    const managers = useMemo(() => managersOf(clients), [clients]);
    // A saved scope for someone no longer on the roster or any client falls back to everyone.
    const activeScope = scope && (managers.includes(scope) || TEAM.includes(scope)) ? scope : "";
    const scoped = useMemo(() => (activeScope ? clients.filter((c) => managerOf(c) === activeScope) : clients), [clients, activeScope]);
    const scopedIds = useMemo(() => new Set(scoped.map(clientId)), [scoped]);
    const selectedClients = selected
        .filter((id) => scopedIds.has(id))
        .map((id) => byId.get(id))
        .filter((c): c is DirectoryClient => !!c);
    const scopeLabel = activeScope || "Full Overview";
    const activeSection: Section = page;
    const promptCount = sections.reduce((n, s) => n + s.prompts.length, 0);
    const peekClient = peek ? byId.get(peek.id) : undefined;

    const toggleSelect = (id: string) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

    const saveClient = async (next: DirectoryClient) => {
        const prevId = editor?.id;
        const nextId = clientId(next);
        const rest = clients.filter((c) => clientId(c) !== prevId);
        await save({ clients: [...rest, next].sort(byName), sections });
        // A renamed client keeps its place in the selection; a new one joins it.
        setSelected((prev) => (prevId ? prev.map((x) => (x === prevId ? nextId : x)) : [...prev, nextId]));
        setEditor(null);
    };

    const deleteClient = async () => {
        const id = editor?.id;
        if (!id) return;
        await save({ clients: clients.filter((c) => clientId(c) !== id), sections });
        setSelected((prev) => prev.filter((x) => x !== id));
        setEditor(null);
    };

    const saveSections = (next: PromptSection[]) => save({ clients, sections: next });

    const status = loading ? "Loading…" : `${clients.length} client${clients.length === 1 ? "" : "s"} · ${promptCount} prompt${promptCount === 1 ? "" : "s"}`;

    const overviewProps = {
        clients: scoped,
        scopeLabel,
        onOpen: (id: string) => setPeek({ id }),
        onOpenAlert: (id: string, alertId: string) => setPeek({ id, alertId }),
    };

    return (
        <MotionConfig reducedMotion="user">
            {/* Tailwind v4 gives buttons the plain arrow cursor; everything pressable here shows the hand. */}
            <div
                ref={rootRef}
                className="relative flex h-full flex-1 flex-col overflow-hidden rounded-lg bg-secondary shadow-sm [&_button:not(:disabled)]:cursor-pointer"
            >
                {/* An overlay rather than a ring on the panel itself, which the header and footer would paint over. */}
                <EditFrame on={editing} />
                <header className="flex min-h-[73px] shrink-0 flex-wrap items-center justify-between gap-3 border-b border-secondary bg-primary px-6 py-3">
                    <div data-pop className="min-w-0">
                        <div className="flex items-center gap-2.5">
                            <h1 className="text-md font-semibold text-primary">
                                {page === "prompts" ? "Landing Page Prompt Library" : "Landing Page Directory"}
                            </h1>
                            <AnimatePresence initial={false}>
                                {editing && (
                                    <motion.span
                                        key="editing"
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        transition={FAST}
                                        className="inline-flex"
                                    >
                                        <BadgeWithDot type="pill-color" size="sm" color="warning">
                                            Editing
                                        </BadgeWithDot>
                                    </motion.span>
                                )}
                            </AnimatePresence>
                        </div>
                        <p className="text-sm text-tertiary">
                            {status}
                            {saveState === "saving" && " · saving…"}
                            {saveState === "saved" && " · saved"}
                            {saveState === "error" && <span className="text-error-primary"> · not saved: {saveError}</span>}
                        </p>
                    </div>
                    <div data-pop className="flex items-center gap-3">
                        {/* The prompt library is team-wide, so viewing as one manager only applies to the directory. */}
                        {page === "directory" && <ScopeMenu clients={clients} managers={managers} scope={activeScope} onChange={setScope} />}
                    </div>
                </header>

                <motion.div layoutScroll className="flex-1 overflow-y-auto">
                    <div className="mx-auto w-full max-w-[1100px] px-6 py-6">
                        {loading || !data ? (
                            <div className="flex h-48 items-center justify-center">
                                <div className="size-6 animate-spin rounded-full border-2 border-brand border-t-transparent opacity-60" />
                            </div>
                        ) : (
                            <AnimatePresence mode="wait" initial={false}>
                                {activeSection === "prompts" ? (
                                    <motion.div key="prompts" {...sectionMotion("prompts")}>
                                        <PopScope play={!popped.current.has("prompts")} onPlayed={() => popped.current.add("prompts")}>
                                            <PromptLibrary sections={sections} editing={editing} onChange={saveSections} />
                                        </PopScope>
                                    </motion.div>
                                ) : (
                                    <motion.div key="directory" {...sectionMotion("directory")}>
                                        <PopScope
                                            play={!popped.current.has("directory")}
                                            onPlayed={() => popped.current.add("directory")}
                                            className="flex flex-col gap-5"
                                        >
                                            <motion.div
                                                className="relative z-10 flex flex-col gap-3 md:flex-row md:items-center"
                                                initial={{ opacity: 0, y: 8 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ ...SOFT, delay: 0.06 }}
                                            >
                                                <div data-pop className="min-w-0 flex-1">
                                                    {view === "client" ? (
                                                        <ClientPicker
                                                            clients={scoped}
                                                            selectedClients={selectedClients}
                                                            onToggle={toggleSelect}
                                                            onClear={() => setSelected([])}
                                                            scoped={!!activeScope}
                                                            onOpenChange={setPickerOpen}
                                                        />
                                                    ) : (
                                                        <TableSearch
                                                            query={tableQuery}
                                                            onChange={setTableQuery}
                                                            shown={scoped.filter((c) => matchesQuery(c, tableQuery)).length}
                                                            total={scoped.length}
                                                        />
                                                    )}
                                                </div>
                                                <div data-pop className="flex shrink-0 items-center gap-2">
                                                    <Segmented
                                                        size="md"
                                                        value={view}
                                                        onChange={setView}
                                                        options={[
                                                            { id: "client", label: "Overview" },
                                                            { id: "all", label: "View All Clients" },
                                                        ]}
                                                        ariaLabel="View"
                                                    />
                                                    {editing && (
                                                        <Button size="md" iconLeading={Plus} onClick={() => setEditor({})}>
                                                            Add client
                                                        </Button>
                                                    )}
                                                </div>
                                            </motion.div>

                                            {/* While the client list is open the page steps back behind it, as the original did. */}
                                            <motion.div
                                                className={cx("flex flex-col gap-5", pickerOpen && "pointer-events-none")}
                                                initial={{ opacity: 0, y: 8 }}
                                                animate={pickerOpen ? { opacity: 0.28, y: 12, scale: 0.99 } : { opacity: 1, y: 0, scale: 1 }}
                                                transition={pickerOpen ? { duration: 0.48, ease: EASE_SOFT } : { ...SOFT, delay: 0.06 }}
                                            >
                                                <AnimatePresence mode="wait" initial={false}>
                                                    {view === "all" ? (
                                                        <motion.div key="all" {...settleProps}>
                                                            <ClientsTable
                                                                clients={scoped}
                                                                scoped={!!activeScope}
                                                                query={tableQuery}
                                                                onOpen={(id) => setPeek({ id })}
                                                            />
                                                        </motion.div>
                                                    ) : selectedClients.length === 0 ? (
                                                        <motion.div key="overview" {...settleProps}>
                                                            <DirectoryOverview {...overviewProps} />
                                                        </motion.div>
                                                    ) : (
                                                        <motion.div key="cards" {...settleProps} className="flex flex-col gap-5">
                                                            <CollapsibleOverview {...overviewProps} open={overviewOpen} onToggle={setOverviewOpen} />
                                                            <motion.div layout className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                                                                <AnimatePresence>
                                                                    {selectedClients.map((c, i) => {
                                                                        const id = clientId(c);
                                                                        // An odd last card takes the full row rather than leaving a hole.
                                                                        const lone = selectedClients.length % 2 === 1 && i === selectedClients.length - 1;
                                                                        return (
                                                                            <ClientCard
                                                                                key={id}
                                                                                client={c}
                                                                                editing={editing}
                                                                                onEdit={() => setEditor({ id })}
                                                                                onRemove={() => toggleSelect(id)}
                                                                                onOpen={() => setPeek({ id })}
                                                                                className={lone ? "xl:col-span-2" : undefined}
                                                                            />
                                                                        );
                                                                    })}
                                                                </AnimatePresence>
                                                            </motion.div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </motion.div>
                                        </PopScope>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        )}
                    </div>
                </motion.div>

                <footer className="flex shrink-0 flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-secondary bg-primary px-6 py-2.5">
                    <div data-pop>
                        <Eyebrow>Slug reference</Eyebrow>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {CHANNELS.map((ch) => (
                            <span
                                key={ch.key}
                                data-pop
                                className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full border border-tertiary px-2.5 text-xs whitespace-nowrap text-quaternary"
                            >
                                {ch.label} <span className="font-medium text-tertiary">{ch.slug}</span>
                            </span>
                        ))}
                    </div>
                </footer>

                <AnimatePresence>
                    {peek && peekClient && (
                        <ClientPeek
                            key={`peek-${peek.id}`}
                            client={peekClient}
                            alertId={peek.alertId}
                            editing={editing}
                            onClose={() => setPeek(null)}
                            onEdit={(tab) => {
                                setPeek(null);
                                setEditor({ id: peek.id, tab });
                            }}
                        />
                    )}
                    {editor && (
                        <ClientEditor
                            key={`editor-${editor.id ?? "new"}`}
                            initial={editor.id ? byId.get(editor.id) : undefined}
                            existingIds={clients.map(clientId).filter((id) => id !== editor.id)}
                            managers={[...new Set([...TEAM, ...managers])].sort((a, b) => a.localeCompare(b))}
                            initialTab={editor.tab}
                            onClose={() => setEditor(null)}
                            onSave={saveClient}
                            onDelete={editor.id ? deleteClient : undefined}
                        />
                    )}
                </AnimatePresence>
            </div>
        </MotionConfig>
    );
};
