import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, Bell01, BookOpen01, CheckCircle, ChevronLeft, ChevronRight, Code02, Edit05, HelpCircle, Home02, LayoutLeft, Lock01, LockUnlocked01, Moon01, Sun, Users01 } from "@untitledui/icons";
import { Avatar } from "@/components/base/avatar/avatar";
import { useAuthUser } from "@/hooks/use-auth-user";
import { fetchAttentionItems, type AttentionItem } from "@/lib/notifications";
import { teamPhoto } from "@/utils/team-photos";
import { SettingsDialog } from "@/pages/team/settings-screen";
import { useTheme } from "@/providers/theme-provider";
import { HelpMenu } from "@/components/application/help-menu";
import { SearchBar } from "@/components/application/search-modal";
import { PageBreadcrumb, type BreadcrumbItem } from "@/components/application/page-breadcrumb";
import { cx } from "@/utils/cx";

/**
 * Account avatar — opens the settings popup. Lives in the search-bar row
 * (top-right), not the icon rail, so it renders on any page that passes
 * `headerRight` to <AppShell>. Returns null while signed out.
 */
export const HeaderAvatar = () => {
    const { user } = useAuthUser();
    const [settingsOpen, setSettingsOpen] = useState(false);
    if (!user) return null;

    const initials = (user.name ?? "")
        .split(" ")
        .map((part) => part[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();

    return (
        <>
            <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                title="Settings"
                aria-label="Open settings"
                className="rounded-full outline-focus-ring transition duration-100 ease-linear hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2"
            >
                {/* Prefer the Google account photo, then the HGM team headshot, then initials. */}
                <Avatar size="md" src={user.avatarUrl ?? teamPhoto(user.name)} alt={user.name} initials={initials} />
            </button>
            <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        </>
    );
};

/**
 * Notification bell — sits in the top bar just left of the account avatar.
 * Shows everything that needs the team's attention: open Questions across the
 * project-log pages (HIGH count called out), open docs requests / bug reports,
 * and the Client List roster gap. Team-only (signed-in @hiddengem.media).
 */
const BELL_KIND_ICONS = { questions: HelpCircle, request: AlertCircle, roster: Users01, suggestions: Edit05 };

export const HeaderBell = () => {
    const { user } = useAuthUser();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<AttentionItem[] | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const isTeam = !!user?.email && user.email.toLowerCase().endsWith("@hiddengem.media");

    // Load on mount and refresh whenever the panel opens, so the badge is
    // roughly live without polling.
    useEffect(() => {
        if (isTeam) fetchAttentionItems().then(setItems);
    }, [isTeam]);
    useEffect(() => {
        if (open) fetchAttentionItems().then(setItems);
    }, [open]);

    // Close on outside click (same pattern as HelpMenu).
    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", onDown);
        return () => document.removeEventListener("mousedown", onDown);
    }, [open]);

    if (!isTeam) return null;

    const count = items?.length ?? 0;

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                title="Notifications"
                aria-label={count > 0 ? `Notifications — ${count} items need attention` : "Notifications"}
                className={cx(
                    "relative flex size-10 items-center justify-center rounded-full transition duration-100 ease-linear",
                    open ? "bg-secondary text-fg-secondary" : "bg-primary text-fg-quaternary ring-1 ring-secondary hover:bg-secondary hover:text-fg-secondary",
                )}
            >
                <Bell01 className="size-5" aria-hidden="true" />
                {count > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error-solid px-1 text-[10px] font-bold text-white ring-2 ring-bg-primary">
                        {count > 9 ? "9+" : count}
                    </span>
                )}
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.98 }}
                        transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
                        className="absolute right-0 top-12 z-50 w-96 overflow-hidden rounded-2xl bg-primary shadow-xl ring-1 ring-secondary"
                    >
                        <div className="flex items-center justify-between border-b border-secondary px-4 py-3">
                            <p className="text-sm font-semibold text-primary">Notifications</p>
                            {count > 0 && (
                                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-tertiary tabular-nums ring-1 ring-secondary">{count}</span>
                            )}
                        </div>
                        <div className="max-h-[420px] overflow-y-auto p-2">
                            {items == null ? (
                                <p className="px-3 py-6 text-center text-sm text-quaternary">Loading…</p>
                            ) : items.length === 0 ? (
                                <div className="flex flex-col items-center gap-2 px-3 py-8 text-center">
                                    <CheckCircle className="size-6 text-fg-success-primary" aria-hidden="true" />
                                    <p className="text-sm font-medium text-primary">All clear</p>
                                    <p className="text-sm text-tertiary">Nothing needs your attention right now.</p>
                                </div>
                            ) : (
                                items.map((item) => {
                                    const ItemIcon = BELL_KIND_ICONS[item.kind];
                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => {
                                                setOpen(false);
                                                navigate(item.to);
                                            }}
                                            className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition duration-100 ease-linear hover:bg-secondary"
                                        >
                                            <span
                                                className={cx(
                                                    "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
                                                    item.urgent ? "bg-error-secondary text-fg-error-secondary" : "bg-brand-secondary text-fg-brand-primary",
                                                )}
                                            >
                                                <ItemIcon className="size-4" aria-hidden="true" />
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-medium text-primary">{item.title}</span>
                                                <span className="block text-xs text-tertiary">{item.description}</span>
                                            </span>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

/**
 * Bottom controls for the icon rail: an edit lock toggle and a light/dark theme
 * toggle. Shared so every internal team page (dashboard, web team) renders the
 * same chrome. Pass it to <IconRail bottom={...} />.
 *
 * The lock is optional. A read-only page (the /log feed) still needs the theme
 * toggle and Help down here — it's in PAGES_WITHOUT_FLOATING_CHROME like every
 * other rail page, so without them there'd be no way to switch theme at all —
 * but a lock button there would promise an edit mode that doesn't exist.
 */
export const RailBottom = ({ editing, onToggleEditing }: { editing?: boolean; onToggleEditing?: () => void }) => {
    const { theme, setTheme } = useTheme();
    const isDark =
        theme === "dark" ||
        (theme === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);

    return (
        <>
            {/* Lock / unlock (edit mode) — omitted on pages that have nothing to edit. */}
            {onToggleEditing && (
                <button
                    type="button"
                    onClick={onToggleEditing}
                    title={editing ? "Lock editing" : "Unlock editing"}
                    className={cx(
                        "mb-2 flex size-10 items-center justify-center rounded-full border transition duration-100 ease-linear",
                        editing
                            ? "border-brand bg-brand-solid text-white hover:opacity-90"
                            : "border-secondary bg-primary text-secondary hover:bg-tertiary hover:text-primary",
                    )}
                >
                    {editing ? <LockUnlocked01 className="size-[18px]" /> : <Lock01 className="size-[18px]" />}
                </button>
            )}

            {/* Theme toggle */}
            <button
                type="button"
                onClick={() => setTheme(isDark ? "light" : "dark")}
                title={isDark ? "Switch to light mode" : "Switch to dark mode"}
                className="flex size-10 items-center justify-center rounded-full border border-secondary bg-primary text-secondary transition duration-100 ease-linear hover:bg-tertiary hover:text-primary"
            >
                {isDark ? <Sun className="size-[18px]" /> : <Moon01 className="size-[18px]" />}
            </button>

            {/* Help menu — docked here (not floating) so the AI chat widget can take the bottom-right corner. */}
            <HelpMenu variant="rail" />
        </>
    );
};

/* ── Collapsible navigation (hide/show the icon rail + side menu) ──
   Shared across all internal pages; the preference persists in localStorage
   so a hidden nav stays hidden everywhere until expanded again. */

const NAV_COLLAPSED_KEY = "hgm_nav_collapsed";

export const useNavCollapsed = () => {
    const [collapsed, setCollapsed] = useState(() => {
        try { return localStorage.getItem(NAV_COLLAPSED_KEY) === "1"; } catch { return false; }
    });
    const toggle = useCallback(() =>
        setCollapsed((v) => {
            const next = !v;
            try { localStorage.setItem(NAV_COLLAPSED_KEY, next ? "1" : "0"); } catch { /* ignore */ }
            return next;
        }), []);

    // Global shortcut: Shift + B shows/hides the menu (same convention as Shift + F
    // search / Shift + E edit — ignored while typing and when Cmd/Ctrl/Alt are held).
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const el = document.activeElement as HTMLElement | null;
            const typing = !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
            if (e.shiftKey && (e.key === "B" || e.key === "b") && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
                e.preventDefault();
                toggle();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [toggle]);

    return { collapsed, toggle };
};

/* ── Collapsible department icon rail (hide/show just the left icon strip) ──
   Independent of useNavCollapsed: Shift + B hides the whole menu (rail + side
   menu), Shift + R hides only the icon rail. Owned by AppShell so no page needs
   to wire it up. Persists in localStorage. */

const RAIL_COLLAPSED_KEY = "hgm_rail_collapsed";

export const useRailCollapsed = () => {
    const [collapsed, setCollapsed] = useState(() => {
        try { return localStorage.getItem(RAIL_COLLAPSED_KEY) === "1"; } catch { return false; }
    });
    const toggle = useCallback(() =>
        setCollapsed((v) => {
            const next = !v;
            try { localStorage.setItem(RAIL_COLLAPSED_KEY, next ? "1" : "0"); } catch { /* ignore */ }
            return next;
        }), []);

    // Global shortcut: Shift + R shows/hides the department icon rail.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const el = document.activeElement as HTMLElement | null;
            const typing = !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
            if (e.shiftKey && (e.key === "R" || e.key === "r") && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
                e.preventDefault();
                toggle();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [toggle]);

    return { collapsed, toggle };
};

/** Panel toggle — place in a side-menu header (hide) or the collapsed top bar (show). */
export const NavCollapseButton = ({ onClick, label = "Hide menu" }: { onClick: () => void; label?: string }) => (
    <button
        type="button"
        title={label}
        onClick={onClick}
        className="flex size-8 items-center justify-center rounded-lg text-fg-quaternary transition duration-100 ease-linear hover:bg-secondary hover:text-fg-secondary"
    >
        <LayoutLeft className="size-[18px]" aria-hidden="true" />
    </button>
);

/**
 * Floating app shell — wraps a page's side menu + content in one rounded card
 * sitting on the page canvas, like a native macOS window (Finder, System
 * Settings): margin around the edges, one continuous rounded shape instead of
 * a flush square panel touching the browser edges.
 *
 * The department icon rail is deliberately kept OUTSIDE the rounded card (pass
 * it as `rail`) — folding it in made the whole shell read as one busy block.
 * It renders as a bare strip directly on the canvas (no background, no card
 * margins): when a rail is present the shell drops its left padding and the
 * rail sits flush against the viewport edge, left of the card.
 *
 * `className` carries the card's own inner layout (e.g. "flex flex-col" so a
 * CollapsedTopBar can stack above the row, or "flex md:flex-row" for a
 * side-menu-only client page) — AppShell only owns the canvas + card chrome.
 */
export const AppShell = ({
    children,
    rail,
    className,
    highlightScope,
    headerRight,
    breadcrumb,
}: {
    children: ReactNode;
    /** The department icon rail (or any left-of-shell rail) — rendered outside the rounded card. */
    rail?: ReactNode;
    className?: string;
    /** Marks the card as the highlight-pen's field scope (see utils/highlight.tsx). */
    highlightScope?: boolean;
    /** Optional right-aligned content in the search-bar row (e.g. account avatar). */
    headerRight?: ReactNode;
    /** Optional breadcrumb trail shown between the back/forward arrows and the
        search bar (e.g. Dashboard › Project Logs › Welcome Email Flow). */
    breadcrumb?: BreadcrumbItem[];
}) => {
    const navigate = useNavigate();
    // Shift + R hides just the icon rail. The search/back-forward row still shows on
    // pages that HAVE a rail (gated on `rail`); only the left icon strip toggles, and
    // the card reclaims its left padding when the strip is hidden.
    const { collapsed: railCollapsed } = useRailCollapsed();
    const showRail = !!rail && !railCollapsed;
    return (
    <div className={cx("flex h-dvh gap-2.5 overflow-hidden bg-tertiary pt-1 pr-2.5 pb-2.5 sm:gap-3 sm:pr-3 sm:pb-3 print:h-auto print:overflow-visible print:bg-primary print:p-0", showRail ? "pl-0" : "pl-2.5 sm:pl-3")}>
        {showRail && rail}
        <div className="flex min-h-0 flex-1 flex-col gap-1 sm:gap-1.5 print:min-h-0">
            {/* Global search + back/forward — only on pages with the department rail.
                Row height matches the rail's favicon header (64px) so the two line up. */}
            {rail && (
                <div className="flex h-16 shrink-0 items-center gap-1 px-1 print:hidden">
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        title="Back"
                        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-fg-quaternary ring-1 ring-secondary transition duration-100 ease-linear hover:bg-secondary hover:text-fg-secondary"
                    >
                        <ChevronLeft className="size-4" aria-hidden="true" />
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate(1)}
                        title="Forward"
                        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-fg-quaternary ring-1 ring-secondary transition duration-100 ease-linear hover:bg-secondary hover:text-fg-secondary"
                    >
                        <ChevronRight className="size-4" aria-hidden="true" />
                    </button>
                    {breadcrumb && breadcrumb.length > 0 && (
                        <PageBreadcrumb items={breadcrumb} className="ml-1 mr-3 shrink-0" />
                    )}
                    <SearchBar />
                    <div className="ml-2 flex shrink-0 items-center gap-2 pr-1">
                        <HeaderBell />
                        {headerRight}
                    </div>
                </div>
            )}
            <div
                {...(highlightScope ? { "data-highlight-scope": true } : {})}
                className={cx("min-h-0 flex-1 overflow-hidden rounded-2xl shadow-xl ring-1 ring-secondary print:h-auto print:min-h-0 print:overflow-visible print:rounded-none print:shadow-none print:ring-0", className)}
            >
                {children}
            </div>
        </div>
    </div>
    );
};

/** Slim replacement header shown while the rail + side menu are hidden. */
export const CollapsedTopBar = ({ title, onExpand }: { title: string; onExpand: () => void }) => (
    <div className="flex h-14 shrink-0 items-center gap-3 border-b border-secondary bg-primary pl-2 pr-4">
        <img src="/hgm logo/Favicon ON LIGHT.svg" alt="HiddenGem" className="size-9" draggable={false} />
        <h2 className="text-md font-semibold text-primary">{title}</h2>
        <NavCollapseButton onClick={onExpand} label="Show menu" />
    </div>
);

/** Department rail shown on every internal HiddenGem team page (not on client-facing pages).
    "home" is not a department — it always navigates to the /home Mission Control page. */
export const RAIL_ITEMS = [
    { id: "home", short: "Home", icon: Home02 },
    { id: "clients", short: "Clients", icon: Users01 },
    { id: "website", short: "Website", icon: Code02 },
    { id: "docs", short: "Docs", icon: BookOpen01 },
];

export const IconRail = ({
    activeDept,
    onSelectDept,
    bottom,
}: {
    /** Which rail item is highlighted. */
    activeDept: string;
    /** In-page department switch (dashboard). When omitted, items navigate to /dashboard?dept=id. */
    onSelectDept?: (id: string) => void;
    /** Optional bottom controls (e.g. dashboard lock + theme toggle). */
    bottom?: ReactNode;
}) => {
    const navigate = useNavigate();

    const handle = (id: string) => {
        // Home is a standalone page, not a dashboard department — always navigate,
        // even when the host page (dashboard) does in-page dept switching.
        if (id === "home") navigate("/home");
        else if (onSelectDept) onSelectDept(id);
        else navigate(`/dashboard?dept=${id}`);
    };

    return (
        <aside className="flex h-full w-[88px] shrink-0 flex-col items-center pb-4">
            {/* Favicon — matches the global search row's height (icon-rail.tsx) so they line up */}
            <div className="flex h-16 w-full shrink-0 items-center justify-center">
                <img
                    src="/hgm logo/Favicon ON LIGHT.svg"
                    alt="HiddenGem"
                    className="size-9"
                    draggable={false}
                />
            </div>

            <span className="mt-4 h-px w-8 bg-border-secondary" />

            {/* Departments */}
            <div className="mt-4 flex flex-1 flex-col items-center gap-1">
                {RAIL_ITEMS.map((d) => {
                    const active = activeDept === d.id;
                    return (
                        <button
                            key={d.id}
                            type="button"
                            onClick={() => handle(d.id)}
                            title={d.short}
                            className="group flex w-full flex-col items-center gap-1 rounded-xl px-1 py-1.5"
                        >
                            <span
                                className={cx(
                                    "flex size-11 items-center justify-center rounded-xl border transition duration-100 ease-linear",
                                    active
                                        ? "border-brand bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300"
                                        : "border-transparent text-tertiary group-hover:bg-primary group-hover:text-secondary",
                                )}
                            >
                                <d.icon className="size-5" aria-hidden="true" />
                            </span>
                            <span className={cx("text-[11px] font-semibold", active ? "text-primary" : "text-tertiary")}>{d.short}</span>
                        </button>
                    );
                })}
            </div>

            {bottom}
        </aside>
    );
};
