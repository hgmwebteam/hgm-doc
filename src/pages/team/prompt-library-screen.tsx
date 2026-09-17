import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Code02, Copy01, Edit01, Lightbulb02, Moon01, Plus, SearchSm, Stars01, Sun, Tag01, Trash01, XClose } from "@untitledui/icons";
import { AppShell, CollapsedTopBar, IconRail, NavCollapseButton, useNavCollapsed } from "@/components/application/icon-rail";
import { useAuthUser } from "@/hooks/use-auth-user";
import { useTheme } from "@/providers/theme-provider";
import { supabase, type PromptLibraryEntry } from "@/lib/supabase";
import { cx } from "@/utils/cx";

/**
 * Personal Prompt & Pattern Library (/prompt-library).
 * A PRIVATE vault for the owner only — gated in the UI to anhtuan@hiddengem.media
 * and locked at the database (owner-authenticated RLS; see migration). One
 * searchable collection; each entry is a Prompt or a Pattern with a category,
 * body, "when to use" note, tags, and {{placeholders}} highlighted for reuse.
 */

const OWNER_EMAIL = "anhtuan@hiddengem.media";
const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "id" + Math.random().toString(36).slice(2));

type TypeFilter = "all" | "prompt" | "pattern";
const TYPE_META = {
    prompt: { label: "Prompt", icon: Stars01, chip: "bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300" },
    pattern: { label: "Pattern", icon: Code02, chip: "bg-utility-purple-50 text-utility-purple-700 dark:bg-utility-purple-500/15 dark:text-utility-purple-300" },
} as const;

/** Render body/preview text with {{placeholders}} highlighted as amber chips. */
const withPlaceholders = (text: string): ReactNode =>
    text.split(/(\{\{[^}]+\}\})/g).map((part, i) =>
        /^\{\{[^}]+\}\}$/.test(part) ? (
            <span key={i} className="rounded bg-utility-yellow-50 px-1 text-utility-yellow-700">
                {part}
            </span>
        ) : (
            <span key={i}>{part}</span>
        ),
    );

/* ── Editor modal ────────────────────────────────────────────────── */

const inputCls =
    "w-full rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-primary placeholder:text-placeholder outline-none transition duration-100 ease-linear focus:border-brand focus:ring-1 focus:ring-brand";
const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wide text-quaternary";

const EntryModal = ({
    initial,
    categories,
    onClose,
    onSave,
}: {
    initial: PromptLibraryEntry | null;
    categories: string[];
    onClose: () => void;
    onSave: (e: PromptLibraryEntry) => Promise<void>;
}) => {
    const [title, setTitle] = useState(initial?.title ?? "");
    const [type, setType] = useState<"prompt" | "pattern">(initial?.type ?? "prompt");
    const [category, setCategory] = useState(initial?.category ?? "");
    const [body, setBody] = useState(initial?.body ?? "");
    const [whenToUse, setWhenToUse] = useState(initial?.when_to_use ?? "");
    const [tags, setTags] = useState((initial?.tags ?? []).join(", "));
    const [saving, setSaving] = useState(false);

    const submit = async () => {
        if (!title.trim() || !body.trim() || saving) return;
        setSaving(true);
        await onSave({
            id: initial?.id ?? uid(),
            title: title.trim(),
            type,
            category: category.trim(),
            body,
            when_to_use: whenToUse.trim(),
            tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
            created_at: initial?.created_at,
        });
        setSaving(false);
    };

    return (
        <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4 py-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onMouseDown={(e) => e.target === e.currentTarget && !saving && onClose()}
        >
            <motion.div
                className="flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-primary shadow-2xl ring-1 ring-secondary"
                initial={{ opacity: 0, scale: 0.95, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: 10 }}
                transition={{ type: "spring", stiffness: 300, damping: 26 }}
            >
                <div className="flex items-center justify-between border-b border-secondary px-5 py-3.5">
                    <h3 className="text-md font-semibold text-primary">{initial ? "Edit entry" : "New entry"}</h3>
                    <button type="button" title="Close" onClick={onClose} className="flex size-8 items-center justify-center rounded-lg text-fg-quaternary hover:bg-secondary hover:text-fg-secondary">
                        <XClose className="size-5" aria-hidden="true" />
                    </button>
                </div>

                <div className="flex flex-col gap-4 overflow-y-auto p-5">
                    <div>
                        <label className={labelCls} htmlFor="pl-title">Title</label>
                        <input id="pl-title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Adversarial code review" className={inputCls} />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <span className={labelCls}>Type</span>
                            <div className="flex gap-2">
                                {(["prompt", "pattern"] as const).map((t) => {
                                    const M = TYPE_META[t];
                                    return (
                                        <button
                                            key={t}
                                            type="button"
                                            onClick={() => setType(t)}
                                            className={cx(
                                                "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold ring-1 transition duration-100 ease-linear",
                                                type === t ? "bg-brand-solid text-white ring-transparent" : "bg-primary text-secondary ring-secondary hover:bg-secondary_hover",
                                            )}
                                        >
                                            <M.icon className="size-4" aria-hidden="true" />
                                            {M.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <div>
                            <label className={labelCls} htmlFor="pl-cat">Category</label>
                            <input id="pl-cat" list="pl-cats" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Coding, Design, Outreach" className={inputCls} />
                            <datalist id="pl-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
                        </div>
                    </div>

                    <div>
                        <label className={labelCls} htmlFor="pl-body">Body</label>
                        <textarea
                            id="pl-body"
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            rows={9}
                            placeholder={"The prompt or pattern text.\nUse {{placeholders}} for things you fill in each time."}
                            className={cx(inputCls, "resize-y font-mono text-[13px] leading-relaxed")}
                        />
                        <p className="mt-1 text-xs text-quaternary">Wrap variables in {"{{double braces}}"} — they're highlighted so you know what to fill in.</p>
                    </div>

                    <div>
                        <label className={labelCls} htmlFor="pl-when">When to use <span className="font-normal normal-case text-quaternary">(optional)</span></label>
                        <input id="pl-when" value={whenToUse} onChange={(e) => setWhenToUse(e.target.value)} placeholder="A quick note on when this is the right one to reach for." className={inputCls} />
                    </div>

                    <div>
                        <label className={labelCls} htmlFor="pl-tags">Tags <span className="font-normal normal-case text-quaternary">(comma-separated)</span></label>
                        <input id="pl-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="review, claude, refactor" className={inputCls} />
                    </div>
                </div>

                <div className="flex justify-end gap-2 border-t border-secondary px-5 py-3.5">
                    <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-secondary bg-primary px-3.5 py-2 text-sm font-semibold text-secondary hover:bg-secondary_hover disabled:opacity-50">
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={submit}
                        disabled={saving || !title.trim() || !body.trim()}
                        className="flex items-center gap-2 rounded-lg bg-brand-solid px-3.5 py-2 text-sm font-semibold text-white transition duration-100 ease-linear hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {saving && <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                        {initial ? "Save changes" : "Add entry"}
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
};

/* ── Entry card ──────────────────────────────────────────────────── */

const EntryCard = ({ entry, index, onEdit, onDelete }: { entry: PromptLibraryEntry; index: number; onEdit: () => void; onDelete: () => void }) => {
    const [copied, setCopied] = useState(false);
    const M = TYPE_META[entry.type] ?? TYPE_META.prompt;
    const copy = () =>
        navigator.clipboard.writeText(entry.body).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
        });
    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.25), ease: [0.22, 1, 0.36, 1] }}
            className="group flex flex-col rounded-2xl bg-primary p-5 ring-1 ring-secondary transition-shadow duration-200 hover:shadow-md"
        >
            <div className="flex items-center gap-2">
                <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold", M.chip)}>
                    <M.icon className="size-3" aria-hidden="true" />
                    {M.label}
                </span>
                {entry.category && <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-medium text-tertiary">{entry.category}</span>}
                <span className="flex-1" />
                <div className="flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                    <button type="button" title="Copy" onClick={copy} className="flex size-8 items-center justify-center rounded-lg text-fg-quaternary hover:bg-secondary hover:text-fg-secondary">
                        {copied ? <Check className="size-4 text-fg-success-primary" /> : <Copy01 className="size-4" />}
                    </button>
                    <button type="button" title="Edit" onClick={onEdit} className="flex size-8 items-center justify-center rounded-lg text-fg-quaternary hover:bg-secondary hover:text-fg-secondary">
                        <Edit01 className="size-4" />
                    </button>
                    <button type="button" title="Delete" onClick={onDelete} className="flex size-8 items-center justify-center rounded-lg text-fg-quaternary hover:bg-error-primary hover:text-fg-error-primary">
                        <Trash01 className="size-4" />
                    </button>
                </div>
            </div>

            <h3 className="mt-3 text-md font-semibold text-primary">{entry.title}</h3>
            {entry.when_to_use && <p className="mt-1 text-sm italic text-tertiary">{entry.when_to_use}</p>}

            <div className="relative mt-3 flex-1">
                <pre className="max-h-44 overflow-hidden whitespace-pre-wrap rounded-xl bg-secondary p-3.5 font-mono text-[12.5px] leading-relaxed text-secondary">
                    {withPlaceholders(entry.body)}
                </pre>
                <button
                    type="button"
                    onClick={copy}
                    className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-primary/90 px-2 py-1 text-xs font-medium text-brand-secondary opacity-0 ring-1 ring-secondary backdrop-blur transition group-hover:opacity-100 hover:bg-primary"
                >
                    {copied ? <Check className="size-3.5" /> : <Copy01 className="size-3.5" />}
                    {copied ? "Copied!" : "Copy"}
                </button>
            </div>

            {entry.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                    {entry.tags.map((t) => (
                        <span key={t} className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-tertiary">
                            <Tag01 className="size-3" aria-hidden="true" />
                            {t}
                        </span>
                    ))}
                </div>
            )}
        </motion.div>
    );
};

/* ── Auth gate ───────────────────────────────────────────────────── */

const PrivateGate = ({ signedIn }: { signedIn: boolean }) => {
    const [signingIn, setSigningIn] = useState(false);
    const signIn = async () => {
        setSigningIn(true);
        const { error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo: window.location.href, queryParams: { prompt: "select_account" } },
        });
        if (error) setSigningIn(false);
    };
    return (
        <main className="flex min-h-dvh flex-col items-center justify-center bg-secondary px-4 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-brand-50 dark:bg-brand-950/40">
                <Lightbulb02 className="size-7 text-fg-brand-primary" aria-hidden="true" />
            </div>
            <h1 className="mt-5 text-display-xs font-semibold text-primary">Private library</h1>
            <p className="mt-2 max-w-sm text-sm text-tertiary">
                {signedIn
                    ? "This prompt & pattern library is private to its owner. Your account doesn't have access."
                    : "This prompt & pattern library is private. Sign in with the owner account to open it."}
            </p>
            {!signedIn && (
                <button
                    type="button"
                    onClick={signIn}
                    disabled={signingIn}
                    className="mt-6 flex items-center justify-center gap-2.5 rounded-lg border border-secondary bg-primary px-4 py-2.5 text-sm font-semibold text-primary transition duration-100 ease-linear hover:bg-secondary_hover disabled:opacity-50"
                >
                    {signingIn ? (
                        <span className="size-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />
                    ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" /><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" /><path fill="#EA4335" d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.46 14.97.5 12 .5A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 6.68 9.14 4.75 12 4.75z" /></svg>
                    )}
                    Sign in with Google
                </button>
            )}
        </main>
    );
};

/* ── Page ────────────────────────────────────────────────────────── */

export const PromptLibraryScreen = () => {
    const { user, loading: authLoading } = useAuthUser();
    const isOwner = (user?.email ?? "").toLowerCase() === OWNER_EMAIL;
    const { theme, setTheme } = useTheme();
    const { collapsed: navCollapsed, toggle: toggleNav } = useNavCollapsed();
    const isDark =
        theme === "dark" || (theme === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);

    const [entries, setEntries] = useState<PromptLibraryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState("");
    const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
    const [category, setCategory] = useState<string>("__all");
    const [modal, setModal] = useState<{ entry: PromptLibraryEntry | null } | null>(null);
    const loadedRef = useRef(false);

    // Load once the owner session is confirmed.
    useEffect(() => {
        if (!isOwner || loadedRef.current) return;
        loadedRef.current = true;
        supabase
            .from("prompt_library")
            .select("*")
            .order("updated_at", { ascending: false })
            .then(({ data, error }) => {
                if (!error && data) setEntries(data as PromptLibraryEntry[]);
                setLoading(false);
            });
    }, [isOwner]);

    const categories = useMemo(
        () => [...new Set(entries.map((e) => e.category.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
        [entries],
    );

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return entries.filter((e) => {
            if (typeFilter !== "all" && e.type !== typeFilter) return false;
            if (category !== "__all" && e.category.trim() !== category) return false;
            if (!q) return true;
            return (
                e.title.toLowerCase().includes(q) ||
                e.body.toLowerCase().includes(q) ||
                e.when_to_use.toLowerCase().includes(q) ||
                e.category.toLowerCase().includes(q) ||
                e.tags.some((t) => t.toLowerCase().includes(q))
            );
        });
    }, [entries, query, typeFilter, category]);

    const counts = useMemo(
        () => ({
            all: entries.length,
            prompt: entries.filter((e) => e.type === "prompt").length,
            pattern: entries.filter((e) => e.type === "pattern").length,
        }),
        [entries],
    );

    const handleSave = async (entry: PromptLibraryEntry) => {
        const now = new Date().toISOString();
        const row = { ...entry, updated_at: now, created_at: entry.created_at ?? now };
        setEntries((prev) => {
            const exists = prev.some((e) => e.id === entry.id);
            const next = exists ? prev.map((e) => (e.id === entry.id ? row : e)) : [row, ...prev];
            return next;
        });
        setModal(null);
        const { error } = await supabase.from("prompt_library").upsert(row, { onConflict: "id" });
        if (error) console.error("[prompt_library save]", error);
    };

    const handleDelete = async (id: string) => {
        setEntries((prev) => prev.filter((e) => e.id !== id));
        await supabase.from("prompt_library").delete().eq("id", id);
    };

    if (authLoading) {
        return (
            <main className="flex min-h-dvh items-center justify-center bg-secondary">
                <div className="size-8 animate-spin rounded-full border-2 border-brand border-t-transparent opacity-60" />
            </main>
        );
    }
    if (!isOwner) return <PrivateGate signedIn={!!user} />;

    return (
        <AppShell className="flex flex-col" rail={!navCollapsed && <IconRail activeDept="" />}>
            {navCollapsed && <CollapsedTopBar title="Prompt Library" onExpand={toggleNav} />}
            <div className="flex min-h-0 flex-1 gap-2 bg-secondary p-2">
                {/* Filter sidebar */}
                {!navCollapsed && (
                    <aside className="flex h-full w-64 shrink-0 flex-col overflow-hidden rounded-lg bg-primary shadow-sm">
                        <div className="flex h-[73px] shrink-0 items-center justify-between border-b border-secondary px-5">
                            <h2 className="text-md font-semibold text-primary">Prompt Library</h2>
                            <NavCollapseButton onClick={toggleNav} />
                        </div>

                        <div className="flex-1 overflow-y-auto px-3 py-4">
                            {/* Search */}
                            <div className="relative">
                                <SearchSm className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-quaternary" aria-hidden="true" />
                                <input
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Search…"
                                    className="w-full rounded-lg border border-secondary bg-primary py-2 pl-9 pr-3 text-sm text-primary placeholder:text-placeholder outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                                />
                            </div>

                            {/* Type filter */}
                            <p className="mb-1.5 mt-5 px-2 text-xs font-semibold uppercase tracking-wide text-quaternary">Type</p>
                            <motion.div className="flex flex-col gap-1" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.05 } } }}>
                                {([
                                    { id: "all" as const, label: "All entries", n: counts.all },
                                    { id: "prompt" as const, label: "Prompts", n: counts.prompt },
                                    { id: "pattern" as const, label: "Patterns", n: counts.pattern },
                                ]).map((t) => (
                                    <motion.button
                                        key={t.id}
                                        type="button"
                                        variants={{ hidden: { opacity: 0, x: -8 }, show: { opacity: 1, x: 0 } }}
                                        onClick={() => setTypeFilter(t.id)}
                                        className={cx(
                                            "flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition duration-100 ease-linear",
                                            typeFilter === t.id ? "bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300" : "text-secondary hover:bg-secondary_hover hover:text-primary",
                                        )}
                                    >
                                        <span className="flex-1">{t.label}</span>
                                        <span className="text-xs tabular-nums text-quaternary">{t.n}</span>
                                    </motion.button>
                                ))}
                            </motion.div>

                            {/* Categories */}
                            {categories.length > 0 && (
                                <>
                                    <p className="mb-1.5 mt-5 px-2 text-xs font-semibold uppercase tracking-wide text-quaternary">Categories</p>
                                    <div className="flex flex-col gap-1">
                                        <button
                                            type="button"
                                            onClick={() => setCategory("__all")}
                                            className={cx(
                                                "rounded-lg px-3 py-2.5 text-left text-sm font-medium transition duration-100 ease-linear",
                                                category === "__all" ? "bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300" : "text-secondary hover:bg-secondary_hover hover:text-primary",
                                            )}
                                        >
                                            All categories
                                        </button>
                                        {categories.map((c) => (
                                            <button
                                                key={c}
                                                type="button"
                                                onClick={() => setCategory(c)}
                                                className={cx(
                                                    "flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition duration-100 ease-linear",
                                                    category === c ? "bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300" : "text-secondary hover:bg-secondary_hover hover:text-primary",
                                                )}
                                            >
                                                <span className="flex-1 truncate">{c}</span>
                                                <span className="text-xs tabular-nums text-quaternary">{entries.filter((e) => e.category.trim() === c).length}</span>
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Theme toggle */}
                        <div className="flex items-center justify-between border-t border-secondary px-5 py-3">
                            <span className="text-xs text-quaternary">Private to you</span>
                            <button
                                type="button"
                                onClick={() => setTheme(isDark ? "light" : "dark")}
                                title={isDark ? "Switch to light mode" : "Switch to dark mode"}
                                className="flex size-9 items-center justify-center rounded-full border border-secondary bg-primary text-secondary transition duration-100 ease-linear hover:bg-tertiary hover:text-primary"
                            >
                                {isDark ? <Sun className="size-[18px]" /> : <Moon01 className="size-[18px]" />}
                            </button>
                        </div>
                    </aside>
                )}

                {/* Main */}
                <div className="flex h-full flex-1 flex-col overflow-hidden rounded-lg bg-secondary shadow-sm">
                    <header className="flex h-[73px] shrink-0 items-center justify-between border-b border-secondary bg-primary px-6">
                        <div>
                            <h1 className="text-md font-semibold text-primary">Personal Prompt &amp; Pattern Library</h1>
                            <p className="text-sm text-tertiary">
                                {loading ? "Loading…" : `${filtered.length} ${filtered.length === 1 ? "entry" : "entries"}${filtered.length !== entries.length ? ` of ${entries.length}` : ""}`}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setModal({ entry: null })}
                            className="flex items-center gap-1.5 rounded-lg bg-brand-solid px-3.5 py-2 text-sm font-semibold text-white transition duration-100 ease-linear hover:opacity-90"
                        >
                            <Plus className="size-4" aria-hidden="true" />
                            New entry
                        </button>
                    </header>

                    <div className="flex-1 overflow-y-auto">
                        <div className="mx-auto w-full max-w-[1200px] px-6 py-6">
                            {loading ? (
                                <div className="flex h-48 items-center justify-center">
                                    <div className="size-6 animate-spin rounded-full border-2 border-brand border-t-transparent opacity-60" />
                                </div>
                            ) : filtered.length === 0 ? (
                                <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
                                    <div className="flex size-12 items-center justify-center rounded-2xl bg-brand-50 dark:bg-brand-950/40">
                                        <Lightbulb02 className="size-6 text-fg-brand-primary" aria-hidden="true" />
                                    </div>
                                    <p className="mt-2 text-sm font-medium text-primary">
                                        {entries.length === 0 ? "Your library is empty" : "No entries match your filters"}
                                    </p>
                                    <p className="text-sm text-tertiary">
                                        {entries.length === 0 ? "Add your first prompt or pattern to get started." : "Try a different search, type, or category."}
                                    </p>
                                    {entries.length === 0 && (
                                        <button type="button" onClick={() => setModal({ entry: null })} className="mt-3 flex items-center gap-1.5 rounded-lg bg-brand-solid px-3.5 py-2 text-sm font-semibold text-white hover:opacity-90">
                                            <Plus className="size-4" /> New entry
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                                    <AnimatePresence mode="popLayout">
                                        {filtered.map((entry, i) => (
                                            <EntryCard
                                                key={entry.id}
                                                entry={entry}
                                                index={i}
                                                onEdit={() => setModal({ entry })}
                                                onDelete={() => handleDelete(entry.id)}
                                            />
                                        ))}
                                    </AnimatePresence>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {modal && <EntryModal initial={modal.entry} categories={categories} onClose={() => setModal(null)} onSave={handleSave} />}
            </AnimatePresence>
        </AppShell>
    );
};
