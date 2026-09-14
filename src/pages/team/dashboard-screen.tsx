import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
    ArrowUpRight,
    Award01,
    BookOpen01,
    Briefcase01,
    Camera01,
    Check,
    ChevronDown,
    ClipboardCheck,
    Code02,
    Edit01,
    FilePlus02,
    FolderClosed,
    Grid01,
    Home02,
    Image01,
    LayoutAlt01,
    List,
    Lock01,
    LockUnlocked01,
    Mail01,
    MarkerPin01,
    MessageChatCircle,
    Plus,
    SearchSm,
    Share07,
    Star01,
    Trash01,
    Trophy01,
    Users01,
    XClose,
} from "@untitledui/icons";
import { AnimatePresence, motion } from "motion/react";
import { useNavigate, useSearchParams } from "react-router";
import { HelpMenu } from "@/components/application/help-menu";
import { AppShell, CollapsedTopBar, HeaderAvatar, IconRail, NavCollapseButton, useNavCollapsed } from "@/components/application/icon-rail";
import { SignInBackdrop } from "@/components/application/sign-in-backdrop";
import { Select } from "@/components/base/select/select";
import { useAuthUser } from "@/hooks/use-auth-user";
import { useEditShortcuts } from "@/hooks/use-edit-shortcuts";
import {
    type ClientPageData,
    type ClientRecord,
    type HostOnboardingPageData,
    type LeadCapturePageData,
    type OverviewCard,
    type OverviewTab,
    type OwnerGuideMeta,
    filterPrivateClients,
    supabase,
} from "@/lib/supabase";
// Aliased rather than reusing the slugify above: this must match the slug the dashboard's
// own "+ New Page" wizard produces, so it uses the same function that wizard does.
import { createDefaultContent, slugify as dashboardSlugify, genSharePassword } from "@/pages/client/dashboard/dashboard-model";
import { createBlankTemplateData, isReservedSlug, slugify } from "@/pages/templates/template-one-screen";
import { useTheme } from "@/providers/theme-provider";
import { compressImageFile } from "@/utils/compress-image";
import { cx } from "@/utils/cx";
import { teamPhoto } from "@/utils/team-photos";

// Shared team passwords for the sign-in gate — any one of them unlocks viewing.
// They carry no identity, so they never grant OWNER_EMAIL edit rights below.
const PASSWORDS = ["ANHTUAN", "HGTEAM", "Zingdema07<3"];
const ALLOWED_DOMAIN = "hiddengem.media";
// Only this account can UNLOCK edit mode (add/edit/delete cards & clients). Everyone
// else can view. Requires a real Supabase session — the password bypass has no user.
const OWNER_EMAIL = "anhtuan@hiddengem.media";

/* Google "G" mark (official multicolor). */
const GoogleIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
        <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
        />
        <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
        <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
        />
    </svg>
);

/* ── Login gate — Google (@hiddengem.media) OR team password ──────── */

interface PasswordGateProps {
    onUnlock: () => void;
    onGoogle: () => void;
    googleError?: string;
    googleLoading?: boolean;
}

const PasswordGate = ({ onUnlock, onGoogle, googleError, googleLoading }: PasswordGateProps) => {
    const [value, setValue] = useState("");
    const [error, setError] = useState(false);
    const [success, setSuccess] = useState(false);

    const attempt = () => {
        if (PASSWORDS.includes(value)) {
            setSuccess(true);
            setTimeout(onUnlock, 600);
        } else {
            setError(true);
            setValue("");
        }
    };

    return (
        <SignInBackdrop>
            <div
                className={cx(
                    "w-full max-w-sm rounded-2xl bg-primary p-8 shadow-2xl ring-1 ring-secondary transition-all duration-500",
                    success && "scale-95 opacity-0",
                )}
            >
                <img src="/hgm logo/Logo ON LIGHT.svg" alt="HiddenGem Media" className="h-14 dark:hidden" draggable={false} />
                <img src="/hgm logo/LOGO ON Dark.svg" alt="HiddenGem Media" className="hidden h-14 dark:block" draggable={false} />

                <div className="mt-6">
                    <h1 className="text-lg font-semibold text-primary">Dashboard Access</h1>
                    <p className="mt-1 text-sm text-tertiary">
                        Sign in with your <span className="font-medium text-secondary">@{ALLOWED_DOMAIN}</span> Google account, or enter the team password.
                    </p>
                </div>

                {/* Option 1 — Google sign-in (domain-restricted) */}
                <button
                    type="button"
                    onClick={onGoogle}
                    disabled={googleLoading}
                    className="mt-5 flex w-full items-center justify-center gap-2.5 rounded-lg border border-secondary bg-primary px-4 py-2.5 text-sm font-semibold text-secondary transition duration-100 ease-linear hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <GoogleIcon className="size-5" />
                    {googleLoading ? "Redirecting…" : "Continue with Google"}
                </button>
                {googleError && (
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-error-primary">
                        <XClose className="size-3.5 shrink-0" />
                        {googleError}
                    </p>
                )}

                {/* Divider */}
                <div className="my-5 flex items-center gap-3">
                    <span className="h-px flex-1 bg-border-secondary" />
                    <span className="text-xs font-medium tracking-wide text-quaternary uppercase">or</span>
                    <span className="h-px flex-1 bg-border-secondary" />
                </div>

                {/* Option 2 — Team master password */}
                <div>
                    <input
                        type="password"
                        placeholder="Team password"
                        value={value}
                        onChange={(e) => {
                            setValue(e.target.value);
                            setError(false);
                        }}
                        onKeyDown={(e) => e.key === "Enter" && attempt()}
                        className={cx(
                            "w-full rounded-lg border px-3 py-2.5 text-sm text-primary transition duration-100 ease-linear outline-none placeholder:text-placeholder",
                            error ? "border-error-primary ring-error-primary ring-1" : "border-secondary focus:border-brand focus:ring-1 focus:ring-brand",
                        )}
                    />
                    {error && (
                        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-error-primary">
                            <XClose className="size-3.5" />
                            Incorrect password. Please try again.
                        </p>
                    )}
                </div>

                <button
                    type="button"
                    onClick={attempt}
                    className="mt-4 w-full rounded-lg bg-brand-solid px-4 py-2.5 text-sm font-semibold text-white transition duration-100 ease-linear hover:opacity-90"
                >
                    {success ? "Unlocking…" : "Unlock with password"}
                </button>
            </div>
        </SignInBackdrop>
    );
};

/* ── Helpers ──────────────────────────────────────────────────────── */

function formatDate(iso: string): string {
    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    }).format(new Date(iso));
}

function getInitials(name: string): string {
    return name
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? "")
        .join("");
}

/* ── Sidebar ──────────────────────────────────────────────────────── */

interface DeptTab {
    id: string;
    label: string;
    icon: typeof Share07;
    /** Set ⇒ the row is a link to its own page rather than a card grid inside this one. */
    to?: string;
}

interface Department {
    id: string;
    short: string;
    header: string;
    icon: typeof Share07;
    sectionLabel: string;
    kind: "docs" | "cards" | "empty" | "clientlist";
    tabs: DeptTab[];
    /** Extra static nav groups rendered above the main section (with a divider),
        e.g. a "Client Input" group linking out to shared docs like Owner Guides. */
    extraGroups?: { label: string; tabs: DeptTab[] }[];
}

/** Fixed client tiers for the Client List page (grouped in the sidebar). */
const TIERS: { id: string; label: string; icon: typeof Share07 }[] = [
    { id: "tier-0", label: "Tier 0", icon: Trophy01 },
    { id: "tier-1", label: "Tier 1", icon: Award01 },
    { id: "tier-2", label: "Tier 2", icon: Star01 },
];
const tierLabel = (id: string) => TIERS.find((t) => t.id === id)?.label ?? "Tier 0";

/** Client lifecycle + onboarding phases — drive the /home Mission Control page. */
const CLIENT_STATUSES = [
    { id: "existing", label: "Existing" },
    { id: "onboarding", label: "Onboarding" },
    { id: "offboarding", label: "Offboarding" },
];
export const ONBOARDING_PHASES = [
    { emoji: "✍️", label: "Signing On" },
    { emoji: "🧠", label: "Marketing Strategy" },
    { emoji: "⚙️", label: "Technical Setup" },
    { emoji: "📸", label: "Content Creation" },
    { emoji: "🎨", label: "Funnel Setup" },
    { emoji: "🚀", label: "Marketing Launch" },
];

/** The real HGM roster (hiddengem.media/team) — canonical names for the client
    assignment dropdowns so per-person counts never fragment on typos. AMs pair
    with a Marketing Assistant to handle each client. */
// Gillian Conley is Operations Manager, not an AM — deliberately not listed.
export const ACCOUNT_MANAGERS = ["Makenna Moran", "Alicia Morin", "Charlotte Pickering", "Ananya Arora", "Nicole Araya", "Chiara Henry", "Kristal Puguan"];
export const MARKETING_ASSISTANTS = ["Vicky Si", "Lily Phanthavong", "Lucca Maggiolo"];
export const WEB_TEAM = ["AnhTuan Bui", "Brandon Nguyen", "Leshan Patterson", "Kyle Zinger"];

const DEPARTMENTS: Department[] = [
    {
        id: "clients",
        short: "Clients",
        header: "Client List",
        icon: Users01,
        sectionLabel: "By Tiers",
        kind: "clientlist",
        tabs: [],
    },
    {
        id: "website",
        short: "Website",
        header: "Web Team",
        icon: Code02,
        sectionLabel: "Workflow",
        kind: "cards",
        tabs: [{ id: "overview", label: "Overview", icon: LayoutAlt01 }],
        extraGroups: [{ label: "Client Input", tabs: [{ id: "owner-guides", label: "Owner Guides", icon: BookOpen01 }] }],
    },
    {
        id: "am",
        short: "AM",
        header: "Account Managers",
        icon: Briefcase01,
        sectionLabel: "Account Managers",
        kind: "cards",
        tabs: [{ id: "overview", label: "Overview", icon: LayoutAlt01 }],
    },
    {
        id: "docs",
        short: "Docs",
        header: "Client Docs",
        icon: BookOpen01,
        sectionLabel: "Create Docs",
        kind: "docs",
        tabs: [
            // The manual is the site's own reference and now carries the live project-log
            // status too, which is what the "Project Logs" card grid used to be for — so it
            // sits first and that tab is gone. The log pages themselves are untouched and
            // still reachable from the manual (and by their own URLs).
            { id: "manual", label: "Manual", icon: BookOpen01, to: "/manual" },
            { id: "owner-guides", label: "Owner Guides", icon: BookOpen01 },
            { id: "host-onboarding", label: "Brand Vision Form", icon: Home02 },
            { id: "popups", label: "Popups", icon: Mail01 },
            { id: "meta-pixel", label: "Meta Pixel", icon: Share07 },
            // Scratch bench for device mockups and drawn backdrops — a reference
            // surface, so it links out rather than rendering a card grid here.
            { id: "mockups", label: "Mockups & backdrops", icon: Image01, to: "/test" },
        ],
    },
];

const SunIcon = () => (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
);
const MoonIcon = () => (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
);

/* ── Rail bottom controls (dashboard: lock + theme toggle) ────────── */

const RailBottom = ({ editing, onToggleEditing }: { editing: boolean; onToggleEditing: () => void }) => {
    const { theme, setTheme } = useTheme();
    const isDark = theme === "dark" || (theme === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);

    return (
        <>
            {/* Lock / unlock (edit mode) */}
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

            {/* Theme toggle */}
            <button
                type="button"
                onClick={() => setTheme(isDark ? "light" : "dark")}
                title={isDark ? "Switch to light mode" : "Switch to dark mode"}
                className="flex size-10 items-center justify-center rounded-full border border-secondary bg-primary text-secondary transition duration-100 ease-linear hover:bg-tertiary hover:text-primary"
            >
                {isDark ? <SunIcon /> : <MoonIcon />}
            </button>

            {/* Help menu — docked here (not floating) so the AI chat widget can take the bottom-right corner. */}
            <HelpMenu variant="rail" />
        </>
    );
};

/** One nav row shared by every sidebar group (static "extra" groups and the
    main per-department tab list). */
const NavRow = ({
    item,
    active,
    onSelect,
    editing,
    isCustom,
    onDelete,
}: {
    item: DeptTab;
    active: boolean;
    onSelect: () => void;
    editing: boolean;
    isCustom: boolean;
    onDelete: () => void;
}) => (
    <motion.div
        variants={{ hidden: { opacity: 0, x: -10 }, show: { opacity: 1, x: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } } }}
        className={cx(
            "group flex items-center gap-1 rounded-lg pr-1 transition-colors duration-100 ease-linear",
            active ? "bg-brand-50 dark:bg-brand-950/50" : "hover:bg-secondary",
        )}
    >
        <button
            type="button"
            onClick={onSelect}
            className={cx(
                "flex flex-1 items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-sm font-medium transition duration-100 ease-linear",
                active ? "text-brand-700 dark:text-brand-300" : "text-secondary group-hover:text-primary",
            )}
        >
            <item.icon className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{item.label}</span>
        </button>
        {editing && isCustom && (
            <button
                type="button"
                onClick={onDelete}
                title="Delete tab"
                className="flex size-6 shrink-0 items-center justify-center rounded-md text-quaternary opacity-0 transition group-hover:opacity-100 hover:bg-primary hover:text-error-primary"
            >
                <Trash01 className="size-3.5" />
            </button>
        )}
    </motion.div>
);

const Sidebar = ({
    department,
    tabs,
    activeSection,
    onSelect,
    editing,
    canEditTabs,
    customTabIds,
    onAddTab,
    onDeleteTab,
    onCollapse,
}: {
    department: Department;
    tabs: DeptTab[];
    activeSection: string;
    onSelect: (id: string) => void;
    editing: boolean;
    canEditTabs: boolean;
    customTabIds: string[];
    onAddTab: (label: string) => void;
    onDeleteTab: (id: string) => void;
    onCollapse?: () => void;
}) => {
    const [adding, setAdding] = useState(false);
    const [newLabel, setNewLabel] = useState("");

    const submitTab = () => {
        if (newLabel.trim()) onAddTab(newLabel.trim());
        setNewLabel("");
        setAdding(false);
    };

    return (
        <aside className="flex h-full w-60 shrink-0 flex-col overflow-hidden rounded-lg bg-primary shadow-sm">
            {/* Department header */}
            <div className="flex h-[73px] shrink-0 items-center justify-between border-b border-secondary px-5">
                <h2 className="text-md font-semibold text-primary">{department.header}</h2>
                {onCollapse && <NavCollapseButton onClick={onCollapse} />}
            </div>

            {/* Nav */}
            <nav className="flex-1 px-3 py-4">
                {/* Extra static groups (e.g. "Client Input") rendered above the main
                section, each separated by a divider. */}
                {department.extraGroups?.map((group) => (
                    <div key={group.label} className="mb-4">
                        <p className="mb-1 px-2 text-xs font-semibold tracking-widest text-quaternary uppercase">{group.label}</p>
                        <motion.div
                            className="flex flex-col gap-1"
                            initial="hidden"
                            animate="show"
                            variants={{ show: { transition: { staggerChildren: 0.05 } } }}
                        >
                            {group.tabs.map((item) => (
                                <NavRow
                                    key={item.id}
                                    item={item}
                                    active={activeSection === item.id}
                                    onSelect={() => onSelect(item.id)}
                                    editing={editing}
                                    isCustom={false}
                                    onDelete={() => {}}
                                />
                            ))}
                        </motion.div>
                        <div className="mt-3 border-t border-secondary" />
                    </div>
                ))}

                <p className="mb-1 px-2 text-xs font-semibold tracking-widest text-quaternary uppercase">{department.sectionLabel}</p>
                <motion.div
                    key={department.id}
                    className="flex flex-col gap-1"
                    initial="hidden"
                    animate="show"
                    variants={{ show: { transition: { staggerChildren: 0.05 } } }}
                >
                    {tabs.map((item) => {
                        const isCustom = customTabIds.includes(item.id);
                        return (
                            <NavRow
                                key={item.id}
                                item={item}
                                active={activeSection === item.id}
                                onSelect={() => onSelect(item.id)}
                                editing={editing}
                                isCustom={isCustom}
                                onDelete={() => onDeleteTab(item.id)}
                            />
                        );
                    })}

                    {/* Add tab (edit mode, card departments) */}
                    {editing &&
                        canEditTabs &&
                        (adding ? (
                            <input
                                type="text"
                                value={newLabel}
                                onChange={(e) => setNewLabel(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") submitTab();
                                    if (e.key === "Escape") {
                                        setAdding(false);
                                        setNewLabel("");
                                    }
                                }}
                                onBlur={submitTab}
                                placeholder="Tab name…"
                                autoFocus
                                className="mt-1 w-full rounded-lg border border-secondary bg-primary px-2.5 py-2 text-sm text-primary outline-none placeholder:text-placeholder focus:border-brand focus:ring-1 focus:ring-brand"
                            />
                        ) : (
                            <button
                                type="button"
                                onClick={() => setAdding(true)}
                                className="mt-1 flex w-full items-center gap-2 rounded-lg border border-dashed border-primary px-2.5 py-2 text-sm font-medium text-tertiary transition duration-100 ease-linear hover:border-brand hover:text-brand-secondary"
                            >
                                <Plus className="size-4 shrink-0" aria-hidden="true" />
                                Add tab
                            </button>
                        ))}
                </motion.div>
            </nav>
        </aside>
    );
};

/* ── Page row ─────────────────────────────────────────────────────── */

const PageRow = ({
    page,
    index,
    onStar,
    onDelete,
}: {
    page: ClientPageData & { created_at?: string };
    index: number;
    onStar: (slug: string, starred: boolean) => void;
    onDelete: (slug: string) => void;
}) => {
    const navigate = useNavigate();
    const [confirmDelete, setConfirmDelete] = useState(false);
    const initials = getInitials(page.client_name || page.slug);

    const colors = [
        "bg-brand-100 text-brand-700",
        "bg-success-secondary text-success-primary",
        "bg-warning-secondary text-warning-primary",
        "bg-error-secondary text-error-primary",
    ];
    const colorClass = colors[index % colors.length];

    return (
        <motion.tr
            onClick={() => !confirmDelete && navigate(`/${page.slug}`)}
            className="group border-b border-secondary transition duration-100 ease-linear last:border-0 hover:bg-secondary"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.4), ease: [0.22, 1, 0.36, 1] }}
        >
            {/* Star indicator + client info */}
            <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                    {page.starred && <Star01 className="size-3.5 shrink-0 fill-current text-yellow-400" aria-hidden="true" />}
                    <span className={cx("flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold", colorClass)}>
                        {initials || "?"}
                    </span>
                    <div className="min-w-0 cursor-pointer">
                        <p className="truncate text-sm font-medium text-primary">{page.client_name || "(no name)"}</p>
                        <p className="truncate text-xs text-tertiary">{page.client_website || "—"}</p>
                    </div>
                </div>
            </td>

            {/* URL */}
            <td className="px-6 py-4">
                <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 font-mono text-xs text-tertiary">
                    docs-hgm.netlify.app/{page.slug}
                </span>
            </td>

            {/* Date */}
            <td className="px-6 py-4 text-sm text-tertiary">{page.created_at ? formatDate(page.created_at) : "—"}</td>

            {/* Actions */}
            <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                {confirmDelete ? (
                    <div className="flex items-center justify-end gap-2">
                        <span className="text-xs text-tertiary">Delete?</span>
                        <button
                            type="button"
                            onClick={() => setConfirmDelete(false)}
                            className="rounded-md px-2 py-1 text-xs font-medium text-secondary transition duration-100 ease-linear hover:bg-primary"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={() => onDelete(page.slug)}
                            className="rounded-md bg-error-solid px-2 py-1 text-xs font-semibold text-white transition duration-100 ease-linear hover:bg-error-solid_hover"
                        >
                            Delete
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center justify-end gap-1 opacity-0 transition duration-100 ease-linear group-hover:opacity-100">
                        {/* Star */}
                        <button
                            type="button"
                            title={page.starred ? "Unstar" : "Star"}
                            onClick={() => onStar(page.slug, !page.starred)}
                            className={cx(
                                "flex size-7 items-center justify-center rounded-md transition duration-100 ease-linear hover:bg-primary",
                                page.starred ? "text-yellow-400" : "text-tertiary hover:text-yellow-400",
                            )}
                        >
                            <Star01 className={cx("size-3.5", page.starred && "fill-current")} aria-hidden="true" />
                        </button>

                        {/* Delete */}
                        <button
                            type="button"
                            title="Delete"
                            onClick={() => setConfirmDelete(true)}
                            className="flex size-7 items-center justify-center rounded-md text-tertiary transition duration-100 ease-linear hover:bg-primary hover:text-error-primary"
                        >
                            <Trash01 className="size-3.5" aria-hidden="true" />
                        </button>

                        {/* Open */}
                        <button
                            type="button"
                            title="Open page"
                            onClick={() => navigate(`/${page.slug}`)}
                            className="flex size-7 items-center justify-center rounded-md text-tertiary transition duration-100 ease-linear hover:bg-primary hover:text-brand-secondary"
                        >
                            <ArrowUpRight className="size-3.5" aria-hidden="true" />
                        </button>
                    </div>
                )}
            </td>
        </motion.tr>
    );
};

/* ── Main content ─────────────────────────────────────────────────── */

type PageRow = ClientPageData & { created_at?: string };

const MetaPixelContent = () => {
    const navigate = useNavigate();
    const [pages, setPages] = useState<PageRow[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        supabase
            .from("client_pages")
            .select("*")
            .order("created_at", { ascending: false })
            .then(({ data, error }) => {
                if (!error && data) setPages(data as PageRow[]);
                setLoading(false);
            });
    }, []);

    const handleStar = async (slug: string, starred: boolean) => {
        setPages((prev) => prev.map((p) => (p.slug === slug ? { ...p, starred } : p)));
        await supabase.from("client_pages").update({ starred }).eq("slug", slug);
    };

    const handleDelete = async (slug: string) => {
        setPages((prev) => prev.filter((p) => p.slug !== slug));
        await supabase.from("client_pages").delete().eq("slug", slug);
    };

    const sortedPages = [...pages].sort((a, b) => {
        if (a.starred === b.starred) return 0;
        return a.starred ? -1 : 1;
    });

    return (
        <div className="flex h-full flex-1 flex-col overflow-hidden rounded-lg bg-secondary shadow-sm">
            {/* Top bar */}
            <header className="flex h-[73px] shrink-0 items-center justify-between border-b border-secondary bg-primary px-6">
                <div>
                    <h1 className="text-md font-semibold text-primary">Meta Pixel Pages</h1>
                    <p className="text-sm text-tertiary">{loading ? "Loading…" : `${pages.length} page${pages.length !== 1 ? "s" : ""} created`}</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => navigate("/metapixel")}
                        className="rounded-lg border border-secondary bg-primary px-3.5 py-2 text-sm font-semibold text-secondary transition duration-100 ease-linear hover:bg-secondary hover:text-primary"
                    >
                        View Template
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate("/metapixel?create=1")}
                        className="flex items-center gap-1.5 rounded-lg bg-brand-solid px-3.5 py-2 text-sm font-semibold text-white transition duration-100 ease-linear hover:opacity-90"
                    >
                        <Plus className="size-4" aria-hidden="true" />
                        New Page
                    </button>
                </div>
            </header>

            {/* Table */}
            <div className="flex-1 overflow-y-auto">
                <div className="mx-auto w-full max-w-[900px] px-6">
                    {loading ? (
                        <div className="flex h-48 items-center justify-center">
                            <div className="size-6 animate-spin rounded-full border-2 border-brand border-t-transparent opacity-60" />
                        </div>
                    ) : pages.length === 0 ? (
                        <motion.div
                            className="flex h-64 flex-col items-center justify-center gap-3 text-center"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, ease: "easeOut" }}
                        >
                            <div className="flex size-12 items-center justify-center rounded-full bg-brand-50">
                                <Share07 className="size-5 text-fg-brand-primary" aria-hidden="true" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-primary">No pages yet</p>
                                <p className="mt-0.5 text-sm text-tertiary">Create your first Meta Pixel page to get started.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => navigate("/metapixel?create=1")}
                                className="mt-1 flex items-center gap-1.5 rounded-lg bg-brand-solid px-3.5 py-2 text-sm font-semibold text-white transition duration-100 ease-linear hover:opacity-90"
                            >
                                <Plus className="size-4" aria-hidden="true" />
                                New Page
                            </button>
                        </motion.div>
                    ) : (
                        <div className="my-6 overflow-hidden rounded-xl bg-primary shadow-sm ring-1 ring-secondary">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-secondary bg-secondary">
                                        <th className="px-6 py-3 text-left text-xs font-semibold tracking-wider text-quaternary uppercase">Client</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold tracking-wider text-quaternary uppercase">Page URL</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold tracking-wider text-quaternary uppercase">Created</th>
                                        <th className="px-6 py-3" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedPages.map((page, i) => (
                                        <PageRow key={page.slug} page={page} index={i} onStar={handleStar} onDelete={handleDelete} />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

/* ── Owner Guides content ─────────────────────────────────────────── */

const formatGuideDate = (iso?: string) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

const EyeToggle = ({ off }: { off: boolean }) =>
    off ? (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M1 1l22 22" />
        </svg>
    ) : (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    );

const OwnerGuideCard = ({
    guide,
    index,
    onOpen,
    onDelete,
}: {
    guide: OwnerGuideMeta;
    index: number;
    onOpen: (slug: string) => void;
    onDelete: (slug: string) => void;
}) => {
    const [showPw, setShowPw] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1], delay: index * 0.03 }}
            className="group flex flex-col rounded-xl bg-primary p-4 shadow-sm ring-1 ring-secondary transition duration-100 ease-linear hover:ring-brand"
        >
            <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-fg-brand-primary dark:bg-brand-950/40">
                    <BookOpen01 className="size-[18px]" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold text-primary">{guide.client_name}</h3>
                    <p className="truncate text-xs text-tertiary">/owner-guide/{guide.slug}</p>
                </div>
            </div>

            <div className="mt-3 flex items-center gap-2 text-xs text-tertiary">
                <span>Created {formatGuideDate(guide.created_at)}</span>
                {guide.share_password ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-tertiary">
                        {showPw ? guide.share_password : "••••"}
                        <button
                            type="button"
                            onClick={() => setShowPw((s) => !s)}
                            title={showPw ? "Hide" : "Show password"}
                            className="flex size-5 items-center justify-center rounded text-quaternary hover:text-primary"
                        >
                            <EyeToggle off={!showPw} />
                        </button>
                    </span>
                ) : (
                    <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[11px] text-quaternary">No password</span>
                )}
            </div>

            <div className="mt-4 flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => onOpen(guide.slug)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-solid px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
                >
                    Open <ArrowUpRight className="size-3.5" />
                </button>
                {confirmDelete ? (
                    <>
                        <button
                            type="button"
                            onClick={() => onDelete(guide.slug)}
                            className="rounded-lg bg-error-solid px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-error-solid_hover"
                        >
                            Delete
                        </button>
                        <button
                            type="button"
                            onClick={() => setConfirmDelete(false)}
                            className="rounded-lg border border-secondary px-2.5 py-1.5 text-xs font-medium text-secondary transition hover:bg-secondary"
                        >
                            Cancel
                        </button>
                    </>
                ) : (
                    <button
                        type="button"
                        onClick={() => setConfirmDelete(true)}
                        title="Delete guide"
                        className="flex size-8 items-center justify-center rounded-lg text-quaternary transition hover:bg-secondary hover:text-error-primary"
                    >
                        <Trash01 className="size-4" />
                    </button>
                )}
            </div>
        </motion.div>
    );
};

const OwnerGuidesContent = ({ editing, isOwner }: { editing: boolean; isOwner: boolean }) => {
    const navigate = useNavigate();
    const [guides, setGuides] = useState<OwnerGuideMeta[]>([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState("");

    // The "Ai Website Setup" template card — a regular overview_cards row (department
    // "website", tab "owner-guides") so it keeps the same star/lock/edit controls as
    // every other overview card, just surfaced here instead of a generic cards grid.
    const [templateCards, setTemplateCards] = useState<OverviewCard[]>([]);
    const [templateLoading, setTemplateLoading] = useState(true);
    const [editTemplateCard, setEditTemplateCard] = useState<OverviewCard | null>(null);

    useEffect(() => {
        supabase
            .from("overview_cards")
            .select("*")
            .eq("department", "website")
            .eq("tab", "owner-guides")
            .order("created_at", { ascending: true })
            .then(({ data, error }) => {
                if (!error && data) setTemplateCards(data as OverviewCard[]);
                setTemplateLoading(false);
            });
    }, []);

    const handleStarTemplate = async (id: string, starred: boolean) => {
        setTemplateCards((prev) => prev.map((c) => (c.id === id ? { ...c, starred } : c)));
        await supabase.from("overview_cards").update({ starred }).eq("id", id);
    };
    const handleDeleteTemplate = async (id: string) => {
        setTemplateCards((prev) => prev.filter((c) => c.id !== id));
        await supabase.from("overview_cards").delete().eq("id", id);
    };
    const handleToggleLockTemplate = async (id: string, locked: boolean) => {
        setTemplateCards((prev) => prev.map((c) => (c.id === id ? { ...c, locked } : c)));
        await supabase.from("overview_cards").update({ locked }).eq("id", id);
    };
    const handleRenameTemplate = async (id: string, title: string) => {
        setTemplateCards((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
        await supabase.from("overview_cards").update({ title }).eq("id", id);
    };
    const handleUpdateTemplate = async (c: { title: string; description: string; link: string; cover: string }) => {
        if (!editTemplateCard) return;
        const patch = { title: c.title, description: c.description, link: c.link, cover_url: c.cover };
        const { error } = await supabase.from("overview_cards").update(patch).eq("id", editTemplateCard.id);
        if (error) {
            console.error("[template card update] Supabase error:", error);
            throw new Error(error.message);
        }
        setTemplateCards((prev) => prev.map((x) => (x.id === editTemplateCard.id ? { ...x, ...patch } : x)));
        setEditTemplateCard(null);
    };

    useEffect(() => {
        supabase
            .from("owner_guides")
            .select("*")
            .order("created_at", { ascending: false })
            .then(({ data, error }) => {
                if (!error && data) setGuides(data as OwnerGuideMeta[]);
                setLoading(false);
            });
    }, []);

    const openGuide = (slug: string) => {
        try {
            sessionStorage.setItem(`og_unlock_${slug}`, "1");
        } catch {
            /* ignore */
        }
        navigate(`/owner-guide/${slug}`);
    };

    const deleteGuide = async (slug: string) => {
        setGuides((prev) => prev.filter((g) => g.slug !== slug));
        await supabase.from("owner_guides").delete().eq("slug", slug);
    };

    const filtered = guides.filter((g) => {
        const q = query.trim().toLowerCase();
        if (!q) return true;
        return g.client_name.toLowerCase().includes(q) || g.slug.toLowerCase().includes(q);
    });

    return (
        <div className="flex h-full flex-1 flex-col overflow-hidden rounded-lg bg-secondary shadow-sm">
            <header className="flex h-[73px] shrink-0 items-center justify-between border-b border-secondary bg-primary px-6">
                <div>
                    <h1 className="text-md font-semibold text-primary">Owner Guides</h1>
                    <p className="text-sm text-tertiary">{loading ? "Loading…" : `${guides.length} guide${guides.length !== 1 ? "s" : ""} created`}</p>
                </div>
                <button
                    type="button"
                    onClick={() => navigate("/owner-guide?create=1")}
                    className="flex items-center gap-1.5 rounded-lg bg-brand-solid px-3.5 py-2 text-sm font-semibold text-white transition duration-100 ease-linear hover:opacity-90"
                >
                    <Plus className="size-4" aria-hidden="true" />
                    New Guide
                </button>
            </header>

            <div className="flex-1 overflow-y-auto">
                <div className="mx-auto w-full max-w-[900px] px-6">
                    {/* ── Section 1 — Template ── */}
                    <div className="mt-6">
                        <p className="mb-3 text-xs font-semibold tracking-widest text-quaternary uppercase">Template</p>
                        {templateLoading ? (
                            <div className="flex h-24 items-center justify-center">
                                <div className="size-5 animate-spin rounded-full border-2 border-brand border-t-transparent opacity-60" />
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                {templateCards.map((card, i) => (
                                    <OverviewCard
                                        key={card.id}
                                        card={card}
                                        index={i}
                                        editing={editing}
                                        isOwner={isOwner}
                                        onStar={handleStarTemplate}
                                        onDelete={handleDeleteTemplate}
                                        onEdit={setEditTemplateCard}
                                        onToggleLock={handleToggleLockTemplate}
                                        onRename={handleRenameTemplate}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="my-6 border-t border-secondary" />

                    {/* ── Section 2 — every client guide already used ── */}
                    <p className="mb-3 text-xs font-semibold tracking-widest text-quaternary uppercase">Client Guides</p>
                    <div className="relative">
                        <SearchSm className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-quaternary" aria-hidden="true" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search owner guides by client name…"
                            className="w-full rounded-lg border border-secondary bg-primary py-2.5 pr-3 pl-10 text-sm text-primary transition duration-100 ease-linear outline-none placeholder:text-placeholder focus:border-brand focus:ring-1 focus:ring-brand"
                        />
                    </div>

                    {loading ? (
                        <div className="flex h-48 items-center justify-center">
                            <div className="size-6 animate-spin rounded-full border-2 border-brand border-t-transparent opacity-60" />
                        </div>
                    ) : guides.length === 0 ? (
                        <motion.div
                            className="flex h-64 flex-col items-center justify-center gap-3 text-center"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, ease: "easeOut" }}
                        >
                            <div className="flex size-12 items-center justify-center rounded-full bg-brand-50">
                                <BookOpen01 className="size-5 text-fg-brand-primary" aria-hidden="true" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-primary">No owner guides yet</p>
                                <p className="mt-0.5 text-sm text-tertiary">Create one from the template to share with a client.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => navigate("/owner-guide?create=1")}
                                className="mt-1 flex items-center gap-1.5 rounded-lg bg-brand-solid px-3.5 py-2 text-sm font-semibold text-white transition duration-100 ease-linear hover:opacity-90"
                            >
                                <Plus className="size-4" aria-hidden="true" /> New Guide
                            </button>
                        </motion.div>
                    ) : filtered.length === 0 ? (
                        <div className="py-16 text-center">
                            <p className="text-sm font-medium text-secondary">No guides match “{query}”</p>
                        </div>
                    ) : (
                        <div className="my-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                            {filtered.map((g, i) => (
                                <OwnerGuideCard key={g.slug} guide={g} index={i} onOpen={openGuide} onDelete={deleteGuide} />
                            ))}
                        </div>
                    )}
                    <div className="h-6" />
                </div>
            </div>

            {editTemplateCard && (
                <AddCardModal
                    key={editTemplateCard.id}
                    onClose={() => setEditTemplateCard(null)}
                    onSubmit={handleUpdateTemplate}
                    initial={{
                        title: editTemplateCard.title,
                        description: editTemplateCard.description,
                        link: editTemplateCard.link,
                        cover: editTemplateCard.cover_url ?? "",
                    }}
                />
            )}
        </div>
    );
};

/* ── Host Onboarding Form content ───────────────────────────────────── */

const HostOnboardingCard = ({
    page,
    index,
    onOpen,
    onDelete,
}: {
    page: HostOnboardingPageData;
    index: number;
    onOpen: (slug: string) => void;
    onDelete: (slug: string) => void;
}) => {
    const [confirmDelete, setConfirmDelete] = useState(false);
    const submitted = !!page.data?.submittedAt;
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1], delay: index * 0.03 }}
            className="group flex flex-col rounded-xl bg-primary p-4 shadow-sm ring-1 ring-secondary transition duration-100 ease-linear hover:ring-brand"
        >
            <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-fg-brand-primary dark:bg-brand-950/40">
                    <Home02 className="size-[18px]" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold text-primary">{page.client_name || page.slug}</h3>
                    <p className="truncate text-xs text-tertiary">/{page.slug}</p>
                </div>
            </div>

            <div className="mt-3 flex items-center gap-2 text-xs text-tertiary">
                <span>Created {formatGuideDate(page.created_at)}</span>
                {submitted ? (
                    <span className="rounded-md bg-success-secondary px-1.5 py-0.5 text-[11px] font-medium text-success-primary">Submitted</span>
                ) : (
                    <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[11px] text-quaternary">In progress</span>
                )}
            </div>

            <div className="mt-4 flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => onOpen(page.slug)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-solid px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
                >
                    Open <ArrowUpRight className="size-3.5" />
                </button>
                {confirmDelete ? (
                    <>
                        <button
                            type="button"
                            onClick={() => onDelete(page.slug)}
                            className="rounded-lg bg-error-solid px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-error-solid_hover"
                        >
                            Delete
                        </button>
                        <button
                            type="button"
                            onClick={() => setConfirmDelete(false)}
                            className="rounded-lg border border-secondary px-2.5 py-1.5 text-xs font-medium text-secondary transition hover:bg-secondary"
                        >
                            Cancel
                        </button>
                    </>
                ) : (
                    <button
                        type="button"
                        onClick={() => setConfirmDelete(true)}
                        title="Delete form"
                        className="flex size-8 items-center justify-center rounded-lg text-quaternary transition hover:bg-secondary hover:text-error-primary"
                    >
                        <Trash01 className="size-4" />
                    </button>
                )}
            </div>
        </motion.div>
    );
};

const HostOnboardingContent = () => {
    const navigate = useNavigate();
    const [pages, setPages] = useState<HostOnboardingPageData[]>([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState("");

    useEffect(() => {
        supabase
            .from("host_onboarding_pages")
            .select("*")
            .order("created_at", { ascending: false })
            .then(({ data, error }) => {
                if (!error && data) setPages(data as HostOnboardingPageData[]);
                setLoading(false);
            });
    }, []);

    const deletePage = async (slug: string) => {
        setPages((prev) => prev.filter((p) => p.slug !== slug));
        await supabase.from("host_onboarding_pages").delete().eq("slug", slug);
    };

    const filtered = pages.filter((p) => {
        const q = query.trim().toLowerCase();
        if (!q) return true;
        return (p.client_name ?? "").toLowerCase().includes(q) || p.slug.toLowerCase().includes(q);
    });

    return (
        <div className="flex h-full flex-1 flex-col overflow-hidden rounded-lg bg-secondary shadow-sm">
            <header className="flex h-[73px] shrink-0 items-center justify-between border-b border-secondary bg-primary px-6">
                <div>
                    <h1 className="text-md font-semibold text-primary">Brand Vision Form</h1>
                    <p className="text-sm text-tertiary">{loading ? "Loading…" : `${pages.length} form${pages.length !== 1 ? "s" : ""} sent`}</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => navigate("/brand-vision-form")}
                        className="rounded-lg border border-secondary bg-primary px-3.5 py-2 text-sm font-semibold text-secondary transition duration-100 ease-linear hover:bg-secondary hover:text-primary"
                    >
                        View Template
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate("/brand-vision-form?create=1")}
                        className="flex items-center gap-1.5 rounded-lg bg-brand-solid px-3.5 py-2 text-sm font-semibold text-white transition duration-100 ease-linear hover:opacity-90"
                    >
                        <Plus className="size-4" aria-hidden="true" />
                        New Form
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto">
                <div className="mx-auto w-full max-w-[900px] px-6">
                    <div className="relative mt-6">
                        <SearchSm className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-quaternary" aria-hidden="true" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search host onboarding forms by client name…"
                            className="w-full rounded-lg border border-secondary bg-primary py-2.5 pr-3 pl-10 text-sm text-primary transition duration-100 ease-linear outline-none placeholder:text-placeholder focus:border-brand focus:ring-1 focus:ring-brand"
                        />
                    </div>

                    {loading ? (
                        <div className="flex h-48 items-center justify-center">
                            <div className="size-6 animate-spin rounded-full border-2 border-brand border-t-transparent opacity-60" />
                        </div>
                    ) : pages.length === 0 ? (
                        <motion.div
                            className="flex h-64 flex-col items-center justify-center gap-3 text-center"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, ease: "easeOut" }}
                        >
                            <div className="flex size-12 items-center justify-center rounded-full bg-brand-50">
                                <Home02 className="size-5 text-fg-brand-primary" aria-hidden="true" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-primary">No host onboarding forms yet</p>
                                <p className="mt-0.5 text-sm text-tertiary">Create one from the template to send to a new host.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => navigate("/brand-vision-form?create=1")}
                                className="mt-1 flex items-center gap-1.5 rounded-lg bg-brand-solid px-3.5 py-2 text-sm font-semibold text-white transition duration-100 ease-linear hover:opacity-90"
                            >
                                <Plus className="size-4" aria-hidden="true" /> New Form
                            </button>
                        </motion.div>
                    ) : filtered.length === 0 ? (
                        <div className="py-16 text-center">
                            <p className="text-sm font-medium text-secondary">No forms match “{query}”</p>
                        </div>
                    ) : (
                        <div className="my-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                            {filtered.map((p, i) => (
                                <HostOnboardingCard key={p.slug} page={p} index={i} onOpen={(slug) => navigate(`/${slug}`)} onDelete={deletePage} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

/* ── Popups content ───────────────────────────────────────────────── */

const PopupRow = ({ page, index, onDelete }: { page: LeadCapturePageData; index: number; onDelete: (slug: string) => void }) => {
    const navigate = useNavigate();
    const [confirmDelete, setConfirmDelete] = useState(false);
    const initials = getInitials(page.client_name || page.slug);

    const colors = [
        "bg-brand-100 text-brand-700",
        "bg-success-secondary text-success-primary",
        "bg-warning-secondary text-warning-primary",
        "bg-error-secondary text-error-primary",
    ];
    const colorClass = colors[index % colors.length];

    return (
        <motion.tr
            onClick={() => !confirmDelete && navigate(`/${page.slug}`)}
            className="group border-b border-secondary transition duration-100 ease-linear last:border-0 hover:bg-secondary"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.4), ease: [0.22, 1, 0.36, 1] }}
        >
            <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                    <span className={cx("flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold", colorClass)}>
                        {initials || "?"}
                    </span>
                    <div className="min-w-0 cursor-pointer">
                        <p className="truncate text-sm font-medium text-primary">{page.client_name || "(no name)"}</p>
                        <p className="truncate text-xs text-tertiary">{page.client_website || "—"}</p>
                    </div>
                </div>
            </td>
            <td className="px-6 py-4">
                <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 font-mono text-xs text-tertiary">
                    docs-hgm.netlify.app/{page.slug}
                </span>
            </td>
            <td className="px-6 py-4 text-sm text-tertiary">{page.created_at ? formatDate(page.created_at) : "—"}</td>
            <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                {confirmDelete ? (
                    <div className="flex items-center justify-end gap-2">
                        <span className="text-xs text-tertiary">Delete?</span>
                        <button
                            type="button"
                            onClick={() => setConfirmDelete(false)}
                            className="rounded-md px-2 py-1 text-xs font-medium text-secondary transition duration-100 ease-linear hover:bg-primary"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={() => onDelete(page.slug)}
                            className="rounded-md bg-error-solid px-2 py-1 text-xs font-semibold text-white transition duration-100 ease-linear hover:bg-error-solid_hover"
                        >
                            Delete
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center justify-end gap-1 opacity-0 transition duration-100 ease-linear group-hover:opacity-100">
                        <button
                            type="button"
                            title="Delete"
                            onClick={() => setConfirmDelete(true)}
                            className="flex size-7 items-center justify-center rounded-md text-tertiary transition duration-100 ease-linear hover:bg-primary hover:text-error-primary"
                        >
                            <Trash01 className="size-3.5" aria-hidden="true" />
                        </button>
                        <button
                            type="button"
                            title="Open page"
                            onClick={() => navigate(`/${page.slug}`)}
                            className="flex size-7 items-center justify-center rounded-md text-tertiary transition duration-100 ease-linear hover:bg-primary hover:text-brand-secondary"
                        >
                            <ArrowUpRight className="size-3.5" aria-hidden="true" />
                        </button>
                    </div>
                )}
            </td>
        </motion.tr>
    );
};

const PopupsContent = () => {
    const navigate = useNavigate();
    const [pages, setPages] = useState<LeadCapturePageData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        supabase
            .from("leadcapture_pages")
            .select("slug, client_name, client_website, created_at")
            .order("created_at", { ascending: false })
            .then(({ data, error }) => {
                if (!error && data) setPages(data as LeadCapturePageData[]);
                setLoading(false);
            });
    }, []);

    const handleDelete = async (slug: string) => {
        setPages((prev) => prev.filter((p) => p.slug !== slug));
        await supabase.from("leadcapture_pages").delete().eq("slug", slug);
    };

    return (
        <div className="flex h-full flex-1 flex-col overflow-hidden rounded-lg bg-secondary shadow-sm">
            <header className="flex h-[73px] shrink-0 items-center justify-between border-b border-secondary bg-primary px-6">
                <div>
                    <h1 className="text-md font-semibold text-primary">Popup Pages</h1>
                    <p className="text-sm text-tertiary">{loading ? "Loading…" : `${pages.length} popup${pages.length !== 1 ? "s" : ""} created`}</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => navigate("/popup")}
                        className="rounded-lg border border-secondary bg-primary px-3.5 py-2 text-sm font-semibold text-secondary transition duration-100 ease-linear hover:bg-secondary hover:text-primary"
                    >
                        View Template
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate("/popup?create=1")}
                        className="flex items-center gap-1.5 rounded-lg bg-brand-solid px-3.5 py-2 text-sm font-semibold text-white transition duration-100 ease-linear hover:opacity-90"
                    >
                        <Plus className="size-4" aria-hidden="true" />
                        New Popup
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto">
                <div className="mx-auto w-full max-w-[900px] px-6">
                    {loading ? (
                        <div className="flex h-48 items-center justify-center">
                            <div className="size-6 animate-spin rounded-full border-2 border-brand border-t-transparent opacity-60" />
                        </div>
                    ) : pages.length === 0 ? (
                        <motion.div
                            className="flex h-64 flex-col items-center justify-center gap-3 text-center"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, ease: "easeOut" }}
                        >
                            <div className="flex size-12 items-center justify-center rounded-full bg-brand-50">
                                <Mail01 className="size-5 text-fg-brand-primary" aria-hidden="true" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-primary">No popups yet</p>
                                <p className="mt-0.5 text-sm text-tertiary">Create your first popup lead-capture page to get started.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => navigate("/popup?create=1")}
                                className="mt-1 flex items-center gap-1.5 rounded-lg bg-brand-solid px-3.5 py-2 text-sm font-semibold text-white transition duration-100 ease-linear hover:opacity-90"
                            >
                                <Plus className="size-4" aria-hidden="true" />
                                New Popup
                            </button>
                        </motion.div>
                    ) : (
                        <div className="my-6 overflow-hidden rounded-xl bg-primary shadow-sm ring-1 ring-secondary">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-secondary bg-secondary">
                                        <th className="px-6 py-3 text-left text-xs font-semibold tracking-wider text-quaternary uppercase">Client</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold tracking-wider text-quaternary uppercase">Page URL</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold tracking-wider text-quaternary uppercase">Created</th>
                                        <th className="px-6 py-3" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {pages.map((page, i) => (
                                        <PopupRow key={page.slug} page={page} index={i} onDelete={handleDelete} />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

/* ── Overview cards ───────────────────────────────────────────────── */

/** Resolve a card link to an in-app path or external URL. */
function resolveLink(link: string): { external: boolean; to: string } {
    const raw = link.trim();
    if (raw.startsWith("/")) return { external: false, to: raw };
    try {
        const u = new URL(raw);
        if (u.hostname.includes("docs-hgm.netlify.app") || u.hostname === window.location.hostname) {
            return { external: false, to: u.pathname + u.search };
        }
        return { external: true, to: raw };
    } catch {
        return { external: false, to: "/" + raw.replace(/^\/+/, "") };
    }
}

/** Deterministic gradient cover generated from a title when no image is uploaded. */
function gradientFor(title: string): string {
    let h = 0;
    for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) % 360;
    const h2 = (h + 40) % 360;
    return `linear-gradient(135deg, hsl(${h} 55% 55%), hsl(${h2} 60% 42%))`;
}

/** Big colorful "folder" tile (Spotify Browse-style) — used for both the Docs
    overview cards and the Client list grid. Title lives inside the tile over
    a bottom scrim so it reads on any cover photo or gradient; while unlocked,
    clicking the title renames it in place instead of opening the full editor. */
const FolderTile = ({
    title,
    description,
    coverUrl,
    logoUrl,
    editing,
    wide,
    index,
    icon: Icon = FolderClosed,
    onOpen,
    onRename,
    topLeft,
    topRight,
    solidFooter,
}: {
    title: string;
    description?: string;
    coverUrl?: string;
    /** Brand logo — shown as a floating chip above the title (client cards). */
    logoUrl?: string;
    editing: boolean;
    wide?: boolean;
    /** Grid position — staggers the entrance animation. */
    index: number;
    /** Decorative icon shown when there's no cover photo — pick one that matches what the tile links to. */
    icon?: typeof Share07;
    onOpen: () => void;
    onRename: (title: string) => void;
    /** Always-visible badge (e.g. "Protected"), top-left. */
    topLeft?: React.ReactNode;
    /** Star / edit / delete controls, top-right. */
    topRight?: React.ReactNode;
    /** Put the title/description on a solid panel below the cover (dark text, most readable)
        instead of white text overlaid on the gradient. */
    solidFooter?: boolean;
}) => {
    const [renaming, setRenaming] = useState(false);
    const [draftTitle, setDraftTitle] = useState(title);

    const startRename = (e: React.MouseEvent) => {
        e.stopPropagation();
        setDraftTitle(title);
        setRenaming(true);
    };
    const submitRename = () => {
        setRenaming(false);
        const trimmed = draftTitle.trim();
        if (trimmed && trimmed !== title) onRename(trimmed);
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.35, delay: Math.min(index * 0.05, 0.4), ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ y: -6, scale: 1.015, transition: { type: "spring", stiffness: 300, damping: 22 } }}
            whileTap={{ scale: 0.985 }}
            onClick={onOpen}
            className={cx(
                "group relative w-full cursor-pointer overflow-hidden rounded-2xl shadow-sm ring-1 ring-secondary transition-shadow duration-300 hover:shadow-xl",
                // Overview cards (solid footer): 1-col tiles are square; the wide/starred card spans two
                // columns ONLY in the 3-col (lg) grid — where the leftover 3rd column holds a square
                // sibling — and drops its aspect so it stretches to that sibling's height (grid rows
                // stretch by default), keeping the row uniform. Below lg it stays a plain square so it
                // never spans a full row alone (which would collapse). The lg:min-h is a floor for the
                // case where the wide card IS alone in its row (e.g. the only card on a page) so it
                // still shows a proper cover instead of collapsing to the footer. Client cards keep 16/10.
                solidFooter ? "flex aspect-square flex-col bg-primary" : "aspect-[16/10]",
                wide && (solidFooter ? "lg:col-span-2 lg:aspect-auto lg:min-h-[240px]" : "sm:col-span-2 sm:aspect-[33/10]"),
            )}
        >
            {/* Cover — uploaded photo, or a deterministic gradient "folder" tile with a watermark icon.
                In solid-footer mode the cover is the top region; otherwise it fills the whole tile. */}
            <div className={cx("overflow-hidden", solidFooter ? "relative min-h-0 flex-1" : "absolute inset-0")}>
                {coverUrl ? (
                    <img
                        src={coverUrl}
                        alt={title}
                        className="absolute inset-0 size-full object-cover transition duration-500 ease-out group-hover:scale-[1.06]"
                        draggable={false}
                    />
                ) : (
                    <>
                        <div
                            className="absolute inset-0 transition duration-500 ease-out group-hover:scale-[1.06]"
                            style={{ background: gradientFor(title) }}
                        />
                        <Icon className="pointer-events-none absolute -right-4 -bottom-4 size-28 rotate-6 text-white/15" aria-hidden="true" />
                    </>
                )}
                {/* Overlay mode only: scrim so the white title stays legible over any photo or gradient */}
                {!solidFooter && <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />}
            </div>

            {topLeft && <div className="absolute top-3 left-3 z-10">{topLeft}</div>}
            {topRight && <div className="absolute top-3 right-3 z-10 flex items-center gap-2">{topRight}</div>}

            {/* Title + description — inline-renameable while unlocked. Solid footer (dark text on a
                solid panel, most readable) or white text overlaid on the cover scrim. */}
            {solidFooter ? (
                <div className="shrink-0 border-t border-secondary bg-primary px-4 py-3">
                    {renaming ? (
                        <input
                            type="text"
                            value={draftTitle}
                            onChange={(e) => setDraftTitle(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    submitRename();
                                } else if (e.key === "Escape") {
                                    e.preventDefault();
                                    setRenaming(false);
                                }
                            }}
                            onBlur={submitRename}
                            ref={(el) => el?.focus({ preventScroll: true })}
                            className="w-full rounded-lg border border-brand bg-primary px-2 py-1 text-sm font-semibold text-primary outline-none"
                        />
                    ) : (
                        <h3
                            onClick={editing ? startRename : undefined}
                            title={editing ? "Click to rename" : undefined}
                            className={cx("truncate text-[15px] font-bold text-primary", editing && "cursor-text hover:underline")}
                        >
                            {title}
                        </h3>
                    )}
                    {description && <p className="mt-0.5 line-clamp-1 text-xs text-tertiary">{description}</p>}
                </div>
            ) : (
                <div className="absolute inset-x-0 bottom-0 p-4">
                    {/* Brand logo chip — floats above the title, lifts slightly on hover */}
                    {logoUrl && (
                        <div className="mb-2.5 inline-flex size-12 items-center justify-center overflow-hidden rounded-xl bg-white/95 shadow-md ring-1 ring-black/10 backdrop-blur transition-transform duration-300 ease-out group-hover:-translate-y-0.5">
                            <img src={logoUrl} alt={`${title} logo`} className="size-full object-contain p-1.5" draggable={false} />
                        </div>
                    )}
                    {renaming ? (
                        <input
                            type="text"
                            value={draftTitle}
                            onChange={(e) => setDraftTitle(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    submitRename();
                                } else if (e.key === "Escape") {
                                    e.preventDefault();
                                    setRenaming(false);
                                }
                            }}
                            onBlur={submitRename}
                            ref={(el) => el?.focus({ preventScroll: true })}
                            className="w-full rounded-lg border border-brand bg-primary px-2 py-1 text-sm font-semibold text-primary outline-none"
                        />
                    ) : (
                        <h3
                            onClick={editing ? startRename : undefined}
                            title={editing ? "Click to rename" : undefined}
                            className={cx("truncate text-lg font-bold text-white drop-shadow-sm", editing && "cursor-text hover:underline")}
                        >
                            {title}
                        </h3>
                    )}
                    {description && <p className="mt-0.5 line-clamp-1 text-xs text-white/80">{description}</p>}
                </div>
            )}
        </motion.div>
    );
};

/** Decorative folder-tile icon that matches what a card actually links to, instead of a generic folder. */
function iconForOverviewCard(card: OverviewCard): typeof Share07 {
    const text = `${card.link} ${card.title}`.toLowerCase();
    if (text.includes("chat")) return MessageChatCircle;
    if (text.includes("email") || text.includes("mail")) return Mail01;
    if (text.includes("dashboard")) return LayoutAlt01;
    if (text.includes("pixel")) return Share07;
    if (text.includes("popup") || text.includes("lead")) return Mail01;
    if (text.includes("guide")) return BookOpen01;
    if (text.includes("roadmap") || text.includes("project") || text.includes("log")) return ClipboardCheck;
    return FolderClosed;
}

const OverviewCard = ({
    card,
    index,
    editing,
    isOwner,
    onStar,
    onDelete,
    onEdit,
    onToggleLock,
    onRename,
}: {
    card: OverviewCard;
    index: number;
    editing: boolean;
    isOwner: boolean;
    onStar: (id: string, starred: boolean) => void;
    onDelete: (id: string) => void;
    onEdit: (card: OverviewCard) => void;
    onToggleLock: (id: string, locked: boolean) => void;
    onRename: (id: string, title: string) => void;
}) => {
    const navigate = useNavigate();
    const open = () => {
        const { external, to } = resolveLink(card.link);
        if (external) window.open(to, "_blank", "noopener,noreferrer");
        else navigate(to);
    };

    return (
        <FolderTile
            title={card.title}
            description={card.description}
            coverUrl={card.cover_url}
            editing={editing}
            wide={card.starred}
            index={index}
            icon={iconForOverviewCard(card)}
            solidFooter
            onOpen={open}
            onRename={(title) => onRename(card.id, title)}
            topLeft={
                card.locked && (
                    <span className="flex items-center gap-1 rounded-full bg-black/45 px-2.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
                        <Lock01 className="size-3" aria-hidden="true" /> Protected
                    </span>
                )
            }
            topRight={
                <>
                    {(card.starred || editing) && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onStar(card.id, !card.starred);
                            }}
                            title={card.starred ? "Unstar" : "Star"}
                            className={cx(
                                "flex size-8 items-center justify-center rounded-full backdrop-blur transition duration-100 ease-linear",
                                card.starred ? "bg-black/40 text-yellow-300" : "bg-black/40 text-white opacity-0 group-hover:opacity-100",
                            )}
                        >
                            <Star01 className={cx("size-4", card.starred && "fill-current")} />
                        </button>
                    )}
                    {editing && (
                        <>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onEdit(card);
                                }}
                                title="Edit card"
                                className="flex size-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur transition duration-100 ease-linear hover:bg-brand-solid"
                            >
                                <Edit01 className="size-4" />
                            </button>
                            {isOwner && (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onToggleLock(card.id, !card.locked);
                                    }}
                                    title={card.locked ? "Protected — only you can delete. Click to unprotect." : "Protect this card (only you can delete it)"}
                                    className="flex size-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur transition duration-100 ease-linear hover:bg-brand-solid"
                                >
                                    {card.locked ? <Lock01 className="size-4" /> : <LockUnlocked01 className="size-4" />}
                                </button>
                            )}
                            {(isOwner || !card.locked) && (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDelete(card.id);
                                    }}
                                    title="Delete card"
                                    className="flex size-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur transition duration-100 ease-linear hover:bg-error-solid"
                                >
                                    <Trash01 className="size-4" />
                                </button>
                            )}
                        </>
                    )}
                </>
            }
        />
    );
};

const AddCardModal = ({
    onClose,
    onSubmit,
    initial,
}: {
    onClose: () => void;
    onSubmit: (c: { title: string; description: string; link: string; cover: string }) => Promise<void>;
    initial?: { title: string; description: string; link: string; cover: string };
}) => {
    const isEdit = !!initial;
    const [title, setTitle] = useState(initial?.title ?? "");
    const [description, setDescription] = useState(initial?.description ?? "");
    const [link, setLink] = useState(initial?.link ?? "");
    const [cover, setCover] = useState(initial?.cover ?? "");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const { user } = useAuthUser();

    // "Create a new page" — spins up a blank /template-1-style document (3 empty
    // sections, 3 empty notes each) in template_docs and links this card to it.
    const [creatingPage, setCreatingPage] = useState(false);
    const [newPageName, setNewPageName] = useState("");
    const [newPageSlug, setNewPageSlug] = useState("");
    const [pageSlugTouched, setPageSlugTouched] = useState(false);
    const [pageBusy, setPageBusy] = useState(false);
    const [pageError, setPageError] = useState("");

    const effectivePageSlug = slugify(newPageSlug || newPageName);

    const onNewPageNameChange = (v: string) => {
        setNewPageName(v);
        if (!pageSlugTouched) setNewPageSlug(slugify(v));
    };

    const handleCreatePage = async () => {
        if (!newPageName.trim() || pageBusy) return;
        if (!user) {
            setPageError("Sign in with your team Google account to create pages.");
            return;
        }
        const slug = effectivePageSlug;
        if (!slug) {
            setPageError("Enter a name with at least one letter or number.");
            return;
        }
        if (isReservedSlug(slug)) {
            setPageError("That name is reserved — please pick another.");
            return;
        }
        setPageBusy(true);
        setPageError("");
        const { error: insertError } = await supabase
            .from("template_docs")
            .insert({ slug, name: newPageName.trim(), data: createBlankTemplateData(), updated_at: new Date().toISOString() });
        setPageBusy(false);
        if (insertError) {
            setPageError(insertError.code === "23505" ? "A page with that name already exists — pick another." : insertError.message);
            return;
        }
        setLink(`/${slug}`);
        if (!title.trim()) setTitle(newPageName.trim());
        setCreatingPage(false);
        setNewPageName("");
        setNewPageSlug("");
        setPageSlugTouched(false);
    };

    const valid = title.trim() && description.trim() && link.trim();

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        void compressImageFile(file).then(setCover);
        e.target.value = "";
    };

    const submit = async () => {
        if (!valid) return;
        setSaving(true);
        setError("");
        try {
            await onSubmit({ title: title.trim(), description: description.trim(), link: link.trim(), cover });
        } catch (e) {
            setError(e instanceof Error ? e.message : "Could not save — check your connection.");
        }
        setSaving(false);
    };

    return (
        <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
        >
            <motion.div
                className="max-h-full w-full max-w-md overflow-y-auto rounded-2xl bg-primary p-6 shadow-2xl ring-1 ring-secondary"
                initial={{ opacity: 0, scale: 0.94, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 10 }}
                transition={{ type: "spring", stiffness: 300, damping: 26 }}
            >
                <div className="flex items-start justify-between">
                    <div>
                        <h3 className="text-md font-semibold text-primary">{isEdit ? "Edit Card" : "Add Card"}</h3>
                        <p className="mt-1 text-sm text-tertiary">{isEdit ? "Update this overview card." : "Link a page to this overview."}</p>
                    </div>
                    <button type="button" onClick={onClose} className="flex size-8 items-center justify-center rounded-lg text-tertiary hover:bg-secondary">
                        <XClose className="size-4" />
                    </button>
                </div>

                <div className="mt-4 flex flex-col gap-4">
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-secondary">
                            Cover image <span className="font-normal text-quaternary">(optional)</span>
                        </label>
                        {cover ? (
                            <div className="relative overflow-hidden rounded-lg ring-1 ring-secondary">
                                <img src={cover} alt="cover" className="aspect-[16/10] w-full object-cover" />
                                <button
                                    type="button"
                                    onClick={() => setCover("")}
                                    className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-lg bg-black/60 text-white hover:bg-black/80"
                                >
                                    <XClose className="size-3.5" />
                                </button>
                            </div>
                        ) : (
                            <label className="flex aspect-[16/10] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-primary bg-secondary text-tertiary transition hover:border-brand hover:text-brand-secondary">
                                <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
                                <Image01 className="size-6" />
                                <span className="text-xs font-medium">Upload cover (auto-generated if empty)</span>
                            </label>
                        )}
                    </div>
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-secondary">
                            Heading <span className="text-error-primary">*</span>
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g. Website AI Setup"
                            autoFocus
                            className="w-full rounded-lg border border-secondary px-3 py-2 text-sm text-primary transition duration-100 ease-linear outline-none placeholder:text-placeholder focus:border-brand focus:ring-1 focus:ring-brand"
                        />
                    </div>
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-secondary">
                            Description <span className="text-error-primary">*</span> <span className="font-normal text-quaternary">(max 20 words)</span>
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            placeholder="Short description"
                            className="w-full resize-none rounded-lg border border-secondary px-3 py-2 text-sm text-primary transition duration-100 ease-linear outline-none placeholder:text-placeholder focus:border-brand focus:ring-1 focus:ring-brand"
                        />
                    </div>
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-secondary">
                            Page link <span className="text-error-primary">*</span>
                        </label>
                        <input
                            type="text"
                            value={link}
                            onChange={(e) => setLink(e.target.value)}
                            placeholder="https://docs-hgm.netlify.app/…"
                            className="w-full rounded-lg border border-secondary px-3 py-2 text-sm text-primary transition duration-100 ease-linear outline-none placeholder:text-placeholder focus:border-brand focus:ring-1 focus:ring-brand"
                        />

                        {!creatingPage ? (
                            <button
                                type="button"
                                onClick={() => {
                                    setCreatingPage(true);
                                    setPageError("");
                                }}
                                className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-brand-secondary transition duration-100 ease-linear hover:text-brand-secondary_hover"
                            >
                                <FilePlus02 className="size-3.5" aria-hidden="true" />
                                Or create a new page
                            </button>
                        ) : (
                            <div className="mt-2 flex flex-col gap-2 rounded-lg border border-secondary bg-secondary p-3">
                                <p className="text-xs text-tertiary">Spins up a blank page (3 sections, 3 empty notes each) and links it here.</p>
                                <input
                                    type="text"
                                    value={newPageName}
                                    onChange={(e) => onNewPageNameChange(e.target.value)}
                                    placeholder="Page name, e.g. Ideation Notes"
                                    autoFocus
                                    className="w-full rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-primary transition duration-100 ease-linear outline-none placeholder:text-placeholder focus:border-brand focus:ring-1 focus:ring-brand"
                                />
                                {newPageName.trim() && (
                                    <p className="text-[11px] text-quaternary">Will live at docs-hgm.netlify.app/{effectivePageSlug || "…"}</p>
                                )}
                                {pageError && <p className="text-xs text-error-primary">{pageError}</p>}
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setCreatingPage(false);
                                            setNewPageName("");
                                            setNewPageSlug("");
                                            setPageSlugTouched(false);
                                            setPageError("");
                                        }}
                                        disabled={pageBusy}
                                        className="flex-1 rounded-lg border border-secondary px-3 py-1.5 text-xs font-semibold text-secondary transition hover:bg-primary disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleCreatePage}
                                        disabled={!newPageName.trim() || pageBusy}
                                        className="flex-1 rounded-lg bg-brand-solid px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
                                    >
                                        {pageBusy ? "Creating…" : "Create page"}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {error && <p className="mt-3 text-xs text-error-primary">{error}</p>}

                <div className="mt-5 flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="flex-1 rounded-lg border border-secondary px-4 py-2 text-sm font-semibold text-secondary transition hover:bg-secondary disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={submit}
                        disabled={!valid || saving}
                        className="flex-1 rounded-lg bg-brand-solid px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
                    >
                        {saving ? (isEdit ? "Saving…" : "Adding…") : isEdit ? "Save changes" : "Add Card"}
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
};

const OverviewContent = ({ department, tab, editing, isOwner }: { department: Department; tab: string; editing: boolean; isOwner: boolean }) => {
    const [cards, setCards] = useState<OverviewCard[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [editCard, setEditCard] = useState<OverviewCard | null>(null);

    useEffect(() => {
        setLoading(true);
        supabase
            .from("overview_cards")
            .select("*")
            .eq("department", department.id)
            .eq("tab", tab)
            .order("created_at", { ascending: true })
            .then(({ data, error }) => {
                if (!error && data) setCards(data as OverviewCard[]);
                setLoading(false);
            });
    }, [department.id, tab]);

    const handleStar = async (id: string, starred: boolean) => {
        setCards((prev) => prev.map((c) => (c.id === id ? { ...c, starred } : c)));
        await supabase.from("overview_cards").update({ starred }).eq("id", id);
    };

    const handleDelete = async (id: string) => {
        setCards((prev) => prev.filter((c) => c.id !== id));
        await supabase.from("overview_cards").delete().eq("id", id);
    };

    const handleToggleLock = async (id: string, locked: boolean) => {
        setCards((prev) => prev.map((c) => (c.id === id ? { ...c, locked } : c)));
        await supabase.from("overview_cards").update({ locked }).eq("id", id);
    };

    const handleRename = async (id: string, title: string) => {
        setCards((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
        await supabase.from("overview_cards").update({ title }).eq("id", id);
    };

    const handleCreate = async (c: { title: string; description: string; link: string; cover: string }) => {
        const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
        const row: OverviewCard = {
            id,
            department: department.id,
            tab,
            title: c.title,
            description: c.description,
            link: c.link,
            cover_url: c.cover,
            starred: false,
        };
        const { error } = await supabase.from("overview_cards").insert(row);
        if (error) {
            console.error("[overview card insert] Supabase error:", error);
            throw new Error(error.message);
        }
        setCards((prev) => [...prev, row]);
        setShowAdd(false);
    };

    const handleUpdate = async (c: { title: string; description: string; link: string; cover: string }) => {
        if (!editCard) return;
        const patch = { title: c.title, description: c.description, link: c.link, cover_url: c.cover };
        const { error } = await supabase.from("overview_cards").update(patch).eq("id", editCard.id);
        if (error) {
            console.error("[overview card update] Supabase error:", error);
            throw new Error(error.message);
        }
        setCards((prev) => prev.map((x) => (x.id === editCard.id ? { ...x, ...patch } : x)));
        setEditCard(null);
    };

    const sorted = [...cards].sort((a, b) => (a.starred === b.starred ? 0 : a.starred ? -1 : 1));

    return (
        <div className="flex h-full flex-1 flex-col overflow-hidden rounded-lg bg-secondary shadow-sm">
            <header className="flex h-[73px] shrink-0 items-center justify-between border-b border-secondary bg-primary px-6">
                <div>
                    <h1 className="text-md font-semibold text-primary">Overview</h1>
                    <p className="text-sm text-tertiary">
                        {loading ? "Loading…" : `${cards.length} ${cards.length === 1 ? "page" : "pages"}`}
                        {editing && " · editing"}
                    </p>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto">
                <div className="mx-auto w-full max-w-[1100px] px-6 py-6">
                    {loading ? (
                        <div className="flex h-48 items-center justify-center">
                            <div className="size-6 animate-spin rounded-full border-2 border-brand border-t-transparent opacity-60" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                            <AnimatePresence mode="popLayout">
                                {sorted.map((card, i) => (
                                    <OverviewCard
                                        key={card.id}
                                        card={card}
                                        index={i}
                                        editing={editing}
                                        isOwner={isOwner}
                                        onStar={handleStar}
                                        onDelete={handleDelete}
                                        onEdit={setEditCard}
                                        onToggleLock={handleToggleLock}
                                        onRename={handleRename}
                                    />
                                ))}
                            </AnimatePresence>

                            {editing && (
                                <motion.button
                                    layout
                                    type="button"
                                    onClick={() => setShowAdd(true)}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    whileHover={{ y: -4 }}
                                    className="flex aspect-[16/10] min-h-[220px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary text-tertiary transition duration-100 ease-linear hover:border-brand hover:bg-brand-50 hover:text-brand-secondary dark:hover:bg-brand-950/30"
                                >
                                    <Plus className="size-7" />
                                    <span className="text-sm font-semibold">Add Card</span>
                                </motion.button>
                            )}
                        </div>
                    )}

                    {!loading && !editing && cards.length === 0 && (
                        <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
                            <p className="text-sm font-medium text-primary">No cards yet</p>
                            <p className="text-sm text-tertiary">Unlock editing (rail, bottom-left) to add cards.</p>
                        </div>
                    )}
                </div>
            </div>

            <AnimatePresence>
                {showAdd && <AddCardModal onClose={() => setShowAdd(false)} onSubmit={handleCreate} />}
                {editCard && (
                    <AddCardModal
                        key={editCard.id}
                        onClose={() => setEditCard(null)}
                        onSubmit={handleUpdate}
                        initial={{ title: editCard.title, description: editCard.description, link: editCard.link, cover: editCard.cover_url ?? "" }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

/* ── Clients (Client List) ────────────────────────────────────────── */

/** `all` is the unfiltered view (every tier); `value` is unused for it. */
type ClientFilter = { type: "all" | "tier" | "am" | "ma"; value: string };

/** Create/edit modal for a client record. Mirrors AddCardModal. */
/** Dropdown options for a person field: None + the canonical roster, plus the
    currently-saved name when it isn't on the roster (legacy free-typed values
    stay visible instead of silently reading as unassigned). */
const NONE_KEY = "__none__";
const personItems = (roster: string[], current: string) => {
    const names = [...roster];
    const cur = current.trim();
    if (cur && !names.includes(cur)) names.push(cur);
    return [{ id: NONE_KEY, label: "None" }, ...names.map((n) => ({ id: n, label: n, avatarUrl: teamPhoto(n) }))];
};

const ClientModal = ({
    initial,
    onClose,
    onSave,
}: {
    initial?: ClientRecord;
    onClose: () => void;
    onSave: (c: Omit<ClientRecord, "id" | "created_at">) => Promise<void>;
}) => {
    const [name, setName] = useState(initial?.name ?? "");
    const [tier, setTier] = useState(initial?.tier ?? "tier-0");
    const [status, setStatus] = useState(initial?.status ?? "existing");
    const [phase, setPhase] = useState<number | null>(initial?.onboarding_phase ?? null);
    const [am, setAm] = useState(initial?.am ?? "");
    const [ma, setMa] = useState(initial?.marketing_assistant ?? "");
    const [location, setLocation] = useState(initial?.location ?? "");
    const [webProject, setWebProject] = useState(initial?.web_project ?? "");
    const [webManager, setWebManager] = useState(initial?.web_manager ?? "");
    const [link, setLink] = useState(initial?.link ?? "");
    const [cover, setCover] = useState(initial?.cover_url ?? "");
    const [logo, setLogo] = useState(initial?.logo_url ?? "");
    const [handle, setHandle] = useState(initial?.handle ?? "");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    /* Inline dashboard creation. Adding a client and giving them a dashboard used to be two
       unconnected steps in two different screens, which is how a client ends up on the board
       with no page — or with a page under a slightly different name. */
    const [creatingPage, setCreatingPage] = useState(false);
    const [pageBusy, setPageBusy] = useState(false);
    const [pageError, setPageError] = useState("");
    /* Sign-in details for the new dashboard, set at creation so the page is never live
       unprotected. The password follows the team's ABC-DEF-HGMS format; the alphabet
       drops I/L/O so a read-aloud password can't be mistyped. */
    const [pageEmail, setPageEmail] = useState("");
    const [pagePassword, setPagePassword] = useState(genSharePassword);

    const valid = name.trim().length > 0;
    /** The slug the client's dashboard will live at — derived from the name, as the wizard does. */
    const dashSlug = `${dashboardSlugify(name)}-dashboard`;

    /**
     * Create this client's dashboard and link it, without leaving the modal.
     *
     * INSERT, never upsert. A dashboard already at this address belongs to a real client, and
     * overwriting it would replace their content with an empty template — so a collision is
     * reported and the AM links to the existing page instead.
     */
    const createDashboardPage = async () => {
        const base = dashboardSlugify(name);
        if (!base) {
            setPageError("Enter the client name first — the address comes from it.");
            return;
        }
        setPageBusy(true);
        setPageError("");
        const { error: insErr } = await supabase.from("dashboard_pages").insert({
            slug: `${base}-dashboard`,
            client_name: name.trim(),
            client_website: "",
            data: {
                ...createDefaultContent(base),
                // The first person on the dashboard, with the password generated above as
                // their own. `sections: null` puts them on the dashboard-wide default, which
                // is what an AM narrows per person later in the dashboard's access panel.
                // allowed_emails is the derived mirror the Netlify suggestion function reads
                // — written here too so a brand-new row never has the two out of step.
                dashboard_users: pageEmail.trim() ? [{ email: pageEmail.trim(), password: pagePassword.trim(), sections: null }] : [],
                allowed_emails: pageEmail.trim() ? [pageEmail.trim()] : [],
                // Kept as the fallback for anyone added later without a password of their own.
                share_password: pagePassword.trim(),
            },
        });
        setPageBusy(false);
        if (insErr) {
            // 23505 = unique violation (slug taken); 42501 = RLS denied — dashboard_pages
            // writes need a Supabase session, which the team-password unlock doesn't create.
            setPageError(
                insErr.code === "23505"
                    ? `A dashboard already exists at /${base}-dashboard. Paste its link above rather than creating a second one.`
                    : insErr.code === "42501"
                      ? "Creating pages needs a Google sign-in — sign out and use your @hiddengem.media account."
                      : "Couldn't create the dashboard. Check your connection and try again.",
            );
            return;
        }
        setLink(`/${base}-dashboard`);
        setCreatingPage(false);
    };

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        void compressImageFile(file).then(setCover);
        e.target.value = "";
    };

    const handleLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        void compressImageFile(file).then(setLogo);
        e.target.value = "";
    };

    const submit = async () => {
        if (!valid) return;
        setSaving(true);
        setError("");
        try {
            await onSave({
                name: name.trim(),
                tier,
                status,
                // Phase only means something while onboarding — clear it otherwise.
                onboarding_phase: status === "onboarding" ? phase : null,
                am: am.trim(),
                marketing_assistant: ma.trim(),
                location: location.trim(),
                web_project: webProject.trim(),
                web_manager: webManager.trim(),
                link: link.trim(),
                cover_url: cover,
                logo_url: logo,
                handle: handle.trim().replace(/^@+/, ""),
                starred: initial?.starred ?? false,
            });
        } catch (e) {
            setError(e instanceof Error ? e.message : "Could not save — check your connection.");
        }
        setSaving(false);
    };

    return (
        <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
        >
            <motion.div
                className="max-h-full w-full max-w-md overflow-y-auto rounded-2xl bg-primary p-6 shadow-2xl ring-1 ring-secondary"
                initial={{ opacity: 0, scale: 0.94, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 10 }}
                transition={{ type: "spring", stiffness: 300, damping: 26 }}
            >
                <div className="flex items-start justify-between">
                    <div>
                        <h3 className="text-md font-semibold text-primary">{initial ? "Edit Client" : "New Client"}</h3>
                        <p className="mt-1 text-sm text-tertiary">{initial ? "Update this client's details." : "Add a client to the list."}</p>
                    </div>
                    <button
                        type="button"
                        aria-label="Close"
                        onClick={onClose}
                        className="flex size-8 items-center justify-center rounded-lg text-tertiary hover:bg-secondary"
                    >
                        <XClose className="size-4" aria-hidden="true" />
                    </button>
                </div>

                <div className="mt-4 flex flex-col gap-4">
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-secondary">
                            Cover image <span className="font-normal text-quaternary">(optional)</span>
                        </label>
                        {cover ? (
                            <div className="relative overflow-hidden rounded-lg ring-1 ring-secondary">
                                <img src={cover} alt="cover" className="aspect-[16/10] w-full object-cover" />
                                <button
                                    type="button"
                                    aria-label="Remove cover"
                                    onClick={() => setCover("")}
                                    className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-lg bg-black/60 text-white hover:bg-black/80"
                                >
                                    <XClose className="size-3.5" aria-hidden="true" />
                                </button>
                            </div>
                        ) : (
                            <label className="flex aspect-[16/10] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-primary bg-secondary text-tertiary transition hover:border-brand hover:text-brand-secondary">
                                <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
                                <Image01 className="size-6" aria-hidden="true" />
                                <span className="text-xs font-medium">Upload cover (auto-generated if empty)</span>
                            </label>
                        )}
                    </div>
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-secondary">
                            Client logo <span className="font-normal text-quaternary">(optional — floats on the card)</span>
                        </label>
                        <div className="flex items-center gap-3">
                            <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-secondary ring-1 ring-secondary">
                                {logo ? (
                                    <img src={logo} alt="Client logo" className="size-full object-contain p-1.5" draggable={false} />
                                ) : (
                                    <Image01 className="size-5 text-fg-quaternary" aria-hidden="true" />
                                )}
                            </div>
                            <label className="cursor-pointer rounded-lg border border-secondary px-3 py-2 text-sm font-semibold text-secondary transition duration-100 ease-linear hover:bg-secondary">
                                <input type="file" accept="image/*" className="hidden" onChange={handleLogoFile} />
                                {logo ? "Replace logo" : "Upload logo"}
                            </label>
                            {logo && (
                                <button
                                    type="button"
                                    onClick={() => setLogo("")}
                                    className="text-sm font-semibold text-fg-quaternary transition duration-100 ease-linear hover:text-fg-error-secondary"
                                >
                                    Remove
                                </button>
                            )}
                        </div>
                    </div>
                    <div>
                        <label htmlFor="client-name" className="mb-1.5 block text-sm font-medium text-secondary">
                            Client name <span className="text-error-primary">*</span>
                        </label>
                        <input
                            id="client-name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Acme Corp"
                            autoFocus
                            className="w-full rounded-lg border border-secondary px-3 py-2 text-sm text-primary transition duration-100 ease-linear outline-none placeholder:text-placeholder focus:border-brand focus:ring-1 focus:ring-brand"
                        />
                    </div>
                    <div>
                        <label htmlFor="client-handle" className="mb-1.5 block text-sm font-medium text-secondary">
                            Handle <span className="font-normal text-quaternary">(shown as @handle on the card)</span>
                        </label>
                        <input
                            id="client-handle"
                            type="text"
                            value={handle}
                            onChange={(e) => setHandle(e.target.value)}
                            placeholder="e.g. acmecorp"
                            className="w-full rounded-lg border border-secondary px-3 py-2 text-sm text-primary transition duration-100 ease-linear outline-none placeholder:text-placeholder focus:border-brand focus:ring-1 focus:ring-brand"
                        />
                    </div>
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-secondary">Tier</label>
                        <div className="flex flex-wrap gap-1.5">
                            {TIERS.map((t) => (
                                <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => setTier(t.id)}
                                    className={cx(
                                        "rounded-full px-3 py-1 text-xs font-medium transition duration-100 ease-linear",
                                        tier === t.id ? "bg-brand-solid text-white" : "bg-secondary text-tertiary ring-1 ring-secondary hover:text-secondary",
                                    )}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-secondary">Status</label>
                        <div className="flex flex-wrap gap-1.5">
                            {CLIENT_STATUSES.map((s) => (
                                <button
                                    key={s.id}
                                    type="button"
                                    onClick={() => setStatus(s.id)}
                                    className={cx(
                                        "rounded-full px-3 py-1 text-xs font-medium transition duration-100 ease-linear",
                                        status === s.id ? "bg-brand-solid text-white" : "bg-secondary text-tertiary ring-1 ring-secondary hover:text-secondary",
                                    )}
                                >
                                    {s.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    {status === "onboarding" && (
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-secondary">Onboarding phase</label>
                            <div className="flex flex-wrap gap-1.5">
                                {ONBOARDING_PHASES.map((p, i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        title={`Phase ${i} — ${p.label}`}
                                        onClick={() => setPhase(i)}
                                        className={cx(
                                            "rounded-full px-2.5 py-1 text-xs font-medium transition duration-100 ease-linear",
                                            phase === i ? "bg-brand-solid text-white" : "bg-secondary text-tertiary ring-1 ring-secondary hover:text-secondary",
                                        )}
                                    >
                                        {i} {p.emoji}
                                    </button>
                                ))}
                            </div>
                            <p className="mt-1.5 text-xs text-quaternary">
                                {phase != null ? `Phase ${phase} — ${ONBOARDING_PHASES[phase].label}` : "Pick where this client is in onboarding."}
                            </p>
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                        <Select
                            label="Account manager"
                            placeholder="Select AM"
                            items={personItems(ACCOUNT_MANAGERS, am)}
                            selectedKey={am.trim() || NONE_KEY}
                            onSelectionChange={(k) => setAm(k === NONE_KEY ? "" : String(k ?? ""))}
                        >
                            {(item) => (
                                <Select.Item id={item.id} avatarUrl={item.avatarUrl}>
                                    {item.label}
                                </Select.Item>
                            )}
                        </Select>
                        <Select
                            label="Marketing assistant"
                            placeholder="Select MA"
                            items={personItems(MARKETING_ASSISTANTS, ma)}
                            selectedKey={ma.trim() || NONE_KEY}
                            onSelectionChange={(k) => setMa(k === NONE_KEY ? "" : String(k ?? ""))}
                        >
                            {(item) => (
                                <Select.Item id={item.id} avatarUrl={item.avatarUrl}>
                                    {item.label}
                                </Select.Item>
                            )}
                        </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label htmlFor="client-webproject" className="mb-1.5 block text-sm font-medium text-secondary">
                                Web project <span className="font-normal text-quaternary">(optional)</span>
                            </label>
                            <input
                                id="client-webproject"
                                type="text"
                                value={webProject}
                                onChange={(e) => setWebProject(e.target.value)}
                                placeholder="e.g. Ai Website"
                                className="w-full rounded-lg border border-secondary px-3 py-2 text-sm text-primary transition duration-100 ease-linear outline-none placeholder:text-placeholder focus:border-brand focus:ring-1 focus:ring-brand"
                            />
                        </div>
                        <Select
                            label="Web manager"
                            placeholder="Select web manager"
                            items={personItems(WEB_TEAM, webManager)}
                            selectedKey={webManager.trim() || NONE_KEY}
                            onSelectionChange={(k) => setWebManager(k === NONE_KEY ? "" : String(k ?? ""))}
                        >
                            {(item) => (
                                <Select.Item id={item.id} avatarUrl={item.avatarUrl}>
                                    {item.label}
                                </Select.Item>
                            )}
                        </Select>
                    </div>
                    <div>
                        <label htmlFor="client-location" className="mb-1.5 block text-sm font-medium text-secondary">
                            Location
                        </label>
                        <input
                            id="client-location"
                            type="text"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            placeholder="e.g. Austin, TX"
                            className="w-full rounded-lg border border-secondary px-3 py-2 text-sm text-primary transition duration-100 ease-linear outline-none placeholder:text-placeholder focus:border-brand focus:ring-1 focus:ring-brand"
                        />
                    </div>
                    <div>
                        <label htmlFor="client-link" className="mb-1.5 block text-sm font-medium text-secondary">
                            Dashboard / page link <span className="font-normal text-quaternary">(optional)</span>
                        </label>
                        <input
                            id="client-link"
                            type="text"
                            value={link}
                            onChange={(e) => setLink(e.target.value)}
                            placeholder="/acme-dashboard or https://…"
                            className="w-full rounded-lg border border-secondary px-3 py-2 text-sm text-primary transition duration-100 ease-linear outline-none placeholder:text-placeholder focus:border-brand focus:ring-1 focus:ring-brand"
                        />

                        {!creatingPage ? (
                            <button
                                type="button"
                                onClick={() => {
                                    setCreatingPage(true);
                                    setPageError("");
                                }}
                                className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-brand-secondary transition duration-100 ease-linear hover:text-brand-secondary_hover"
                            >
                                <FilePlus02 className="size-3.5" aria-hidden="true" />
                                Or create a new page
                            </button>
                        ) : (
                            <div className="mt-2 flex flex-col gap-2 rounded-lg border border-secondary bg-secondary p-3">
                                <p className="text-xs text-tertiary">
                                    Creates {name.trim() || "this client"}&rsquo;s dashboard, ready for onboarding, and links it here.
                                </p>
                                {valid && <p className="text-[11px] text-quaternary">Will live at hgmportal.com/{dashSlug}</p>}
                                <input
                                    type="email"
                                    value={pageEmail}
                                    onChange={(e) => setPageEmail(e.target.value)}
                                    placeholder="Client sign-in email — e.g. info@client.com"
                                    aria-label="Client sign-in email"
                                    className="w-full rounded-lg border border-secondary bg-primary px-3 py-1.5 text-xs text-primary transition duration-100 ease-linear outline-none placeholder:text-placeholder focus:border-brand focus:ring-1 focus:ring-brand"
                                />
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={pagePassword}
                                        onChange={(e) => setPagePassword(e.target.value)}
                                        placeholder="Shared password"
                                        aria-label="Shared password"
                                        className="min-w-0 flex-1 rounded-lg border border-secondary bg-primary px-3 py-1.5 font-mono text-xs text-primary transition duration-100 ease-linear outline-none placeholder:text-placeholder focus:border-brand focus:ring-1 focus:ring-brand"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setPagePassword(genSharePassword())}
                                        className="shrink-0 text-xs font-semibold text-brand-secondary transition duration-100 ease-linear hover:text-brand-secondary_hover"
                                    >
                                        Regenerate
                                    </button>
                                </div>
                                <p className="text-[11px] text-quaternary">
                                    The page locks to this email + password from day one. Leave the email empty to keep it open — access can be set later on the
                                    dashboard itself.
                                </p>
                                {pageError && (
                                    <p className="text-[11px] text-error-primary" role="alert">
                                        {pageError}
                                    </p>
                                )}
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => void createDashboardPage()}
                                        disabled={!valid || pageBusy}
                                        className="rounded-lg bg-brand-solid px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {pageBusy ? "Creating…" : "Create dashboard"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setCreatingPage(false);
                                            setPageError("");
                                        }}
                                        disabled={pageBusy}
                                        className="rounded-lg border border-secondary bg-primary px-3 py-1.5 text-xs font-semibold text-secondary transition hover:bg-secondary disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {error && <p className="mt-3 text-xs text-error-primary">{error}</p>}

                <div className="mt-5 flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="flex-1 rounded-lg border border-secondary px-4 py-2 text-sm font-semibold text-secondary transition hover:bg-secondary disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={submit}
                        disabled={!valid || saving}
                        className="flex-1 rounded-lg bg-brand-solid px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
                    >
                        {saving ? "Saving…" : initial ? "Save" : "Add Client"}
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
};

/* Small avatar chip for the client's Account Manager / Marketing Assistant.
   Photo (or initial) + first name; the full name and role live in the tooltip. */
const RoleChip = ({ role, name }: { role: "am" | "ma"; name: string }) => {
    const photo = teamPhoto(name);
    const RoleIcon = role === "am" ? Users01 : Edit01;
    const first = name.trim().split(/\s+/)[0];
    return (
        <span
            title={`${role === "am" ? "Account Manager" : "Marketing Assistant"} — ${name}`}
            className="inline-flex items-center gap-1 rounded-full bg-secondary py-0.5 pr-2 pl-0.5 text-xs font-medium text-secondary ring-1 ring-secondary"
        >
            {photo ? (
                <img src={photo} alt={name} className="size-5 shrink-0 rounded-full object-cover ring-1 ring-secondary" draggable={false} />
            ) : (
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[10px] font-semibold text-brand-700 dark:bg-brand-950/50 dark:text-brand-300">
                    {name.trim().charAt(0).toUpperCase()}
                </span>
            )}
            <RoleIcon className="size-3 shrink-0 text-fg-quaternary" aria-hidden="true" />
            {first}
        </span>
    );
};

const ClientCard = ({
    client,
    editing,
    layout = "grid",
    filterType = "tier",
    onStar,
    onDelete,
    onEdit,
    onRename,
    onPatch,
}: {
    client: ClientRecord;
    editing: boolean;
    layout?: "grid" | "list";
    /** Active list filter — when filtered by one role, cards show only the
        counterpart's chip (AM view shows the MA, and vice versa). */
    filterType?: "all" | "tier" | "am" | "ma";
    onStar: (id: string, starred: boolean) => void;
    onDelete: (id: string) => void;
    onEdit: (client: ClientRecord) => void;
    onRename: (id: string, name: string) => void;
    /** Persist a partial update (logo, handle, …) straight to the clients table. */
    onPatch: (id: string, patch: Partial<ClientRecord>) => void;
}) => {
    const navigate = useNavigate();
    const open = () => {
        if (editing) {
            onEdit(client);
            return;
        }
        if (!client.link?.trim()) return;
        const { external, to } = resolveLink(client.link);
        if (external) window.open(to, "_blank", "noopener,noreferrer");
        else navigate(to);
    };

    const clickable = editing || !!client.link?.trim();

    // Pairing chips: viewing by AM hides the AM chip (the viewer already knows
    // who they are) and shows their MA — and vice versa. Tier views show both.
    const amName = (client.am ?? "").trim();
    const maName = (client.marketing_assistant ?? "").trim();
    const showAm = filterType !== "am" && !!amName;
    const showMa = filterType !== "ma" && !!maName;

    // Compact horizontal row for the list view.
    if (layout === "list") {
        return (
            <div
                onClick={open}
                className={cx(
                    "group flex items-center gap-4 rounded-xl bg-primary px-4 py-3 ring-1 ring-secondary transition-shadow duration-200",
                    clickable && "cursor-pointer hover:shadow-md",
                )}
            >
                <div className="relative size-12 shrink-0 overflow-hidden rounded-lg">
                    {client.logo_url ? (
                        <div className="flex size-full items-center justify-center bg-secondary ring-1 ring-secondary">
                            <img src={client.logo_url} alt={`${client.name} logo`} className="size-full object-contain p-1" draggable={false} />
                        </div>
                    ) : client.cover_url ? (
                        <img src={client.cover_url} alt={client.name} className="size-full object-cover" draggable={false} />
                    ) : (
                        <div className="flex size-full items-center justify-center" style={{ background: gradientFor(client.name || "Client") }}>
                            <span className="text-lg font-bold text-white/90">{(client.name || "C").charAt(0).toUpperCase()}</span>
                        </div>
                    )}
                </div>

                <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold text-primary">{client.name || "Untitled client"}</h3>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-tertiary">
                        {client.location && (
                            <span className="flex items-center gap-1">
                                <MarkerPin01 className="size-3.5 shrink-0" aria-hidden="true" />
                                <span className="truncate">{client.location}</span>
                            </span>
                        )}
                    </div>
                </div>

                {(showAm || showMa) && (
                    <div className="hidden shrink-0 items-center gap-1.5 md:flex">
                        {showAm && <RoleChip role="am" name={amName} />}
                        {showMa && <RoleChip role="ma" name={maName} />}
                    </div>
                )}

                <span className="hidden shrink-0 rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-semibold text-secondary sm:inline">
                    {tierLabel(client.tier)}
                </span>

                {(client.starred || editing) && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onStar(client.id, !client.starred);
                        }}
                        title={client.starred ? "Unstar" : "Star"}
                        className={cx(
                            "flex size-8 shrink-0 items-center justify-center rounded-lg transition duration-100 ease-linear",
                            client.starred ? "text-warning-primary" : "text-fg-quaternary opacity-0 group-hover:opacity-100 hover:text-fg-secondary",
                        )}
                    >
                        <Star01 className={cx("size-4", client.starred && "fill-current")} />
                    </button>
                )}

                {editing && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onEdit(client);
                        }}
                        title="Edit client"
                        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-fg-quaternary opacity-0 transition duration-100 ease-linear group-hover:opacity-100 hover:bg-secondary hover:text-fg-secondary"
                    >
                        <Edit01 className="size-4" />
                    </button>
                )}

                {editing && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(client.id);
                        }}
                        title="Delete client"
                        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-fg-quaternary opacity-0 transition duration-100 ease-linear group-hover:opacity-100 hover:bg-error-primary hover:text-fg-error-primary"
                    >
                        <Trash01 className="size-4" />
                    </button>
                )}
            </div>
        );
    }

    const description = client.location || "";
    // Instagram-style handle — falls back to a slug of the name until one is saved.
    const igHandle = (client.handle ?? "").trim() || (client.name || "client").toLowerCase().replace(/[^a-z0-9._]/g, "");
    const TierIcon = TIERS.find((t) => t.id === client.tier)?.icon;

    const onLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        void compressImageFile(file).then((url) => onPatch(client.id, { logo_url: url }));
        e.target.value = "";
    };

    // Channel-style card — centered logo, name and @handle (no cover art).
    return (
        <motion.div
            whileHover={clickable ? { y: -4 } : undefined}
            onClick={open}
            className={cx(
                // Always 1:1. The card's content is a fixed 304px tall (96 logo + name +
                // handle + tier + chips + location + padding), so the grid below only ever
                // hands out columns ≥304px — otherwise the square would be shorter than its
                // content and, because the text children are `truncate` (overflow-hidden and
                // therefore freely shrinkable), the name and handle would be squeezed away
                // rather than overflowing. min-h-[304px] is the belt-and-braces guard for
                // viewports too narrow for even one 304px column.
                "group relative flex aspect-square min-h-[304px] flex-col items-center justify-center rounded-2xl bg-primary p-5 text-center transition-shadow duration-200",
                // Private/template clients (only their owner sees them) get a blue ring so
                // they never read as a real client card.
                client.private_to ? "ring-2 ring-brand" : "ring-1 ring-secondary",
                clickable && "cursor-pointer hover:shadow-lg",
            )}
        >
            {/* Star — top-left, like the reference */}
            {(client.starred || editing) && (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onStar(client.id, !client.starred);
                    }}
                    title={client.starred ? "Unstar" : "Star"}
                    className={cx(
                        "absolute top-3 left-3 flex size-8 items-center justify-center rounded-lg transition duration-100 ease-linear",
                        client.starred ? "text-warning-primary" : "text-fg-quaternary opacity-0 group-hover:opacity-100 hover:text-fg-secondary",
                    )}
                >
                    <Star01 className={cx("size-4", client.starred && "fill-current")} />
                </button>
            )}

            {/* Edit-mode controls — top-right */}
            {editing && (
                <div className="absolute top-3 right-3 flex items-center gap-1">
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onEdit(client);
                        }}
                        title="Edit client"
                        className="flex size-8 items-center justify-center rounded-lg text-fg-quaternary transition duration-100 ease-linear hover:bg-secondary hover:text-fg-secondary"
                    >
                        <Edit01 className="size-4" />
                    </button>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(client.id);
                        }}
                        title="Delete client"
                        className="flex size-8 items-center justify-center rounded-lg text-fg-quaternary transition duration-100 ease-linear hover:bg-error-primary hover:text-fg-error-primary"
                    >
                        <Trash01 className="size-4" />
                    </button>
                </div>
            )}

            {/* Logo — centered circle; in edit mode click the badge to upload */}
            <div className="relative">
                <div className="flex size-24 items-center justify-center overflow-hidden rounded-full bg-secondary ring-1 ring-secondary">
                    {client.logo_url ? (
                        <img src={client.logo_url} alt={`${client.name} logo`} className="size-full object-contain p-2.5" draggable={false} />
                    ) : client.cover_url ? (
                        <img src={client.cover_url} alt={client.name} className="size-full object-cover" draggable={false} />
                    ) : (
                        <div className="flex size-full items-center justify-center" style={{ background: gradientFor(client.name || "Client") }}>
                            <span className="text-4xl font-bold text-white/90">{(client.name || "C").charAt(0).toUpperCase()}</span>
                        </div>
                    )}
                </div>
                {editing && (
                    <label
                        onClick={(e) => e.stopPropagation()}
                        title="Upload logo"
                        className="absolute -right-1 -bottom-1 flex size-7 cursor-pointer items-center justify-center rounded-full bg-brand-solid text-white shadow-md transition duration-100 ease-linear hover:bg-brand-solid_hover"
                    >
                        <input type="file" accept="image/*" className="hidden" onChange={onLogoFile} />
                        <Camera01 className="size-3.5" aria-hidden="true" />
                    </label>
                )}
            </div>

            {/* Name + @handle — inline-editable in edit mode */}
            {editing ? (
                <>
                    <input
                        key={`name-${client.id}`}
                        type="text"
                        defaultValue={client.name}
                        placeholder="Client name…"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") e.currentTarget.blur();
                        }}
                        onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (v && v !== client.name) onRename(client.id, v);
                        }}
                        className="mt-4 w-full max-w-[240px] rounded-lg border border-secondary bg-primary px-3 py-1.5 text-center text-lg font-semibold text-primary transition duration-100 ease-linear outline-none placeholder:text-placeholder focus:border-brand focus:ring-1 focus:ring-brand"
                    />
                    <input
                        key={`handle-${client.id}`}
                        type="text"
                        defaultValue={client.handle ? `@${client.handle}` : ""}
                        placeholder={`@${igHandle}`}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") e.currentTarget.blur();
                        }}
                        onBlur={(e) => {
                            const v = e.target.value.trim().replace(/^@+/, "");
                            if (v !== (client.handle ?? "")) onPatch(client.id, { handle: v });
                        }}
                        className="mt-1.5 w-full max-w-[200px] rounded-lg border border-secondary bg-primary px-3 py-1 text-center text-sm text-tertiary transition duration-100 ease-linear outline-none placeholder:text-placeholder focus:border-brand focus:ring-1 focus:ring-brand"
                    />
                </>
            ) : (
                <>
                    <h3 className="mt-4 w-full truncate text-lg font-semibold text-primary">{client.name || "Untitled client"}</h3>
                    <p className="mt-0.5 w-full truncate text-sm text-tertiary">@{igHandle}</p>
                </>
            )}

            {/* Tier — the "category" line of the reference card */}
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary">
                {TierIcon && <TierIcon className="size-3.5 text-fg-warning-secondary" aria-hidden="true" />}
                {tierLabel(client.tier)}
            </span>

            {/* Who runs this client — the AM/MA pairing at a glance */}
            {(showAm || showMa) && (
                <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
                    {showAm && <RoleChip role="am" name={amName} />}
                    {showMa && <RoleChip role="ma" name={maName} />}
                </div>
            )}

            {description && <p className="mt-2.5 w-full truncate text-xs text-quaternary">{description}</p>}
        </motion.div>
    );
};

/* Sidebar pieces live at module scope — defining them inside ClientListContent
   would mint new component types on every render, remounting the sidebar (and
   replaying its stagger animation) each time a filter is clicked. */
const SidebarGroup = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex flex-col gap-1">
        <p className="mb-1 px-2 text-xs font-semibold tracking-widest text-quaternary uppercase">{label}</p>
        {children}
    </div>
);

const NavItem = ({
    active,
    icon: Icon,
    photo,
    label,
    count,
    onClick,
}: {
    active: boolean;
    icon: typeof Share07;
    /** Team headshot — replaces the icon when we have one (people rows). */
    photo?: string;
    label: string;
    count: number;
    onClick: () => void;
}) => (
    <motion.button
        type="button"
        variants={{ hidden: { opacity: 0, x: -10 }, show: { opacity: 1, x: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } } }}
        onClick={onClick}
        className={cx(
            "group flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-sm font-medium transition duration-100 ease-linear",
            active ? "bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300" : "text-secondary hover:bg-secondary hover:text-primary",
        )}
    >
        {photo ? (
            <img src={photo} alt={label} className="size-5 shrink-0 rounded-full object-cover ring-1 ring-secondary" draggable={false} />
        ) : (
            <Icon className="size-4 shrink-0" aria-hidden="true" />
        )}
        <span className="flex-1 truncate">{label}</span>
        <span className={cx("text-xs tabular-nums", active ? "text-brand-700 dark:text-brand-300" : "text-quaternary")}>{count}</span>
    </motion.button>
);

const ClientListContent = ({ editing, navCollapsed = false, onCollapse }: { editing: boolean; navCollapsed?: boolean; onCollapse?: () => void }) => {
    const [allClients, setClients] = useState<ClientRecord[]>([]);
    const { user: viewer } = useAuthUser();
    // Private/test clients (private_to set) are only visible to their owner.
    const clients = useMemo(() => filterPrivateClients(allClients, viewer?.email), [allClients, viewer?.email]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<ClientFilter>({ type: "tier", value: "tier-0" });
    const [modal, setModal] = useState<{ mode: "new" } | { mode: "edit"; client: ClientRecord } | null>(null);
    const [view, setView] = useState<"grid" | "list">("grid");
    const [sortBy, setSortBy] = useState<"recent" | "name" | "tier">("recent");
    const [sortOpen, setSortOpen] = useState(false);
    const sortRef = useRef<HTMLDivElement>(null);

    // Close the sort menu on outside click.
    useEffect(() => {
        if (!sortOpen) return;
        const onDown = (e: MouseEvent) => {
            if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false);
        };
        document.addEventListener("mousedown", onDown);
        return () => document.removeEventListener("mousedown", onDown);
    }, [sortOpen]);

    useEffect(() => {
        setLoading(true);
        supabase
            .from("clients")
            .select("*")
            .order("created_at", { ascending: true })
            .then(({ data, error }) => {
                if (!error && data) setClients(data as ClientRecord[]);
                setLoading(false);
            });
    }, []);

    // Sidebar people groups: the full canonical roster first (so every AM/MA is
    // listed even with 0 clients), then any extra names found in the data
    // (legacy free-typed values like "Anna" stay reachable until normalized).
    const extraNames = (roster: string[], names: (string | undefined)[]) =>
        [...new Set(names.map((n) => (n ?? "").trim()).filter(Boolean))].filter((n) => !roster.includes(n)).sort((a, b) => a.localeCompare(b));
    const ams = [
        ...ACCOUNT_MANAGERS,
        ...extraNames(
            ACCOUNT_MANAGERS,
            clients.map((c) => c.am),
        ),
    ];
    const mas = [
        ...MARKETING_ASSISTANTS,
        ...extraNames(
            MARKETING_ASSISTANTS,
            clients.map((c) => c.marketing_assistant),
        ),
    ];

    const filtered = clients.filter((c) =>
        filter.type === "all"
            ? true
            : filter.type === "tier"
              ? c.tier === filter.value
              : filter.type === "am"
                ? c.am.trim() === filter.value
                : (c.marketing_assistant ?? "").trim() === filter.value,
    );
    // Starred clients always pin to the top; the dropdown decides the order within.
    const tierRank = (id: string) => {
        const i = TIERS.findIndex((t) => t.id === id);
        return i === -1 ? TIERS.length : i;
    };
    const sorted = [...filtered].sort((a, b) => {
        if (!!a.starred !== !!b.starred) return a.starred ? -1 : 1;
        if (sortBy === "name") return a.name.localeCompare(b.name);
        if (sortBy === "tier") return tierRank(a.tier) - tierRank(b.tier);
        return (b.created_at ?? "").localeCompare(a.created_at ?? ""); // recent first
    });

    const SORT_OPTIONS: { id: typeof sortBy; label: string }[] = [
        { id: "recent", label: "Recently added" },
        { id: "name", label: "Name (A–Z)" },
        { id: "tier", label: "Tier" },
    ];
    const sortLabel = SORT_OPTIONS.find((o) => o.id === sortBy)?.label ?? "Sort";

    const headerLabel = filter.type === "all" ? "All Clients" : filter.type === "tier" ? tierLabel(filter.value) : filter.value;

    const handleStar = async (id: string, starred: boolean) => {
        setClients((prev) => prev.map((c) => (c.id === id ? { ...c, starred } : c)));
        await supabase.from("clients").update({ starred }).eq("id", id);
    };

    const handleDelete = async (id: string) => {
        setClients((prev) => prev.filter((c) => c.id !== id));
        await supabase.from("clients").delete().eq("id", id);
    };

    const handleRename = async (id: string, name: string) => {
        setClients((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
        await supabase.from("clients").update({ name }).eq("id", id);
    };

    const handlePatch = async (id: string, patch: Partial<ClientRecord>) => {
        setClients((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
        await supabase.from("clients").update(patch).eq("id", id);
    };

    const handleCreate = async (data: Omit<ClientRecord, "id" | "created_at">) => {
        const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
        const row: ClientRecord = { id, ...data };
        const { error } = await supabase.from("clients").insert(row);
        if (error) {
            console.error("[client insert] Supabase error:", error);
            throw new Error(error.message);
        }
        setClients((prev) => [...prev, row]);
        // Jump to the group the new client landed in so it's visible.
        setFilter({ type: "tier", value: row.tier });
        setModal(null);
    };

    const handleUpdate = async (existing: ClientRecord, data: Omit<ClientRecord, "id" | "created_at">) => {
        const row: ClientRecord = { ...existing, ...data };
        setClients((prev) => prev.map((c) => (c.id === existing.id ? row : c)));
        const { error } = await supabase.from("clients").update(data).eq("id", existing.id);
        if (error) {
            console.error("[client update] Supabase error:", error);
            throw new Error(error.message);
        }
        setModal(null);
    };

    return (
        <>
            {/* Client List sidebar (tier + AM grouping) */}
            {!navCollapsed && (
                <aside className="flex h-full w-60 shrink-0 flex-col overflow-hidden rounded-lg bg-primary shadow-sm">
                    <div className="flex h-[73px] shrink-0 items-center justify-between border-b border-secondary px-5">
                        <h2 className="text-md font-semibold text-primary">Client List</h2>
                        {onCollapse && <NavCollapseButton onClick={onCollapse} />}
                    </div>
                    <nav className="flex-1 overflow-y-auto px-3 py-4">
                        <motion.div className="flex flex-col" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.05 } } }}>
                            {/* Tiers moved to the tab row at the top of the body — the
                            sidebar now only groups by people. */}
                            <SidebarGroup label="By Account Manager">
                                {ams.map((am) => (
                                    <NavItem
                                        key={am}
                                        active={filter.type === "am" && filter.value === am}
                                        icon={Users01}
                                        photo={teamPhoto(am)}
                                        label={am}
                                        count={clients.filter((c) => c.am.trim() === am && !c.private_to).length}
                                        onClick={() => setFilter({ type: "am", value: am })}
                                    />
                                ))}
                            </SidebarGroup>

                            <div className="mx-1 my-4 h-px bg-border-secondary" />

                            {/* MAs pair with AMs on each client — same grouping, own section. */}
                            <SidebarGroup label="By Marketing Assistant">
                                {mas.map((ma) => (
                                    <NavItem
                                        key={ma}
                                        active={filter.type === "ma" && filter.value === ma}
                                        icon={Edit01}
                                        photo={teamPhoto(ma)}
                                        label={ma}
                                        count={clients.filter((c) => (c.marketing_assistant ?? "").trim() === ma && !c.private_to).length}
                                        onClick={() => setFilter({ type: "ma", value: ma })}
                                    />
                                ))}
                            </SidebarGroup>
                        </motion.div>
                    </nav>
                </aside>
            )}

            {/* Main */}
            <div className="flex h-full flex-1 flex-col overflow-hidden rounded-lg bg-secondary shadow-sm">
                <header className="flex h-[73px] shrink-0 items-center justify-between border-b border-secondary bg-primary px-6">
                    <div>
                        <h1 className="text-md font-semibold text-primary">{headerLabel}</h1>
                        <p className="text-sm text-tertiary">
                            {/* Private/template clients show as cards but never count as clients. */}
                            {loading
                                ? "Loading…"
                                : `Total ${filtered.filter((c) => !c.private_to).length} ${filtered.filter((c) => !c.private_to).length === 1 ? "client" : "clients"}`}
                            {editing && " · editing"}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Sort dropdown */}
                        <div ref={sortRef} className="relative">
                            <button
                                type="button"
                                onClick={() => setSortOpen((o) => !o)}
                                className="flex items-center gap-2 rounded-lg border border-secondary bg-primary px-3 py-2 text-sm font-medium text-secondary transition duration-100 ease-linear hover:bg-secondary_hover"
                            >
                                {sortLabel}
                                <ChevronDown className="size-4 text-fg-quaternary" aria-hidden="true" />
                            </button>
                            <AnimatePresence>
                                {sortOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -4 }}
                                        transition={{ duration: 0.12 }}
                                        className="absolute right-0 z-20 mt-1.5 w-44 rounded-xl border border-secondary_alt bg-primary p-1.5 shadow-lg"
                                    >
                                        {SORT_OPTIONS.map((o) => (
                                            <button
                                                key={o.id}
                                                type="button"
                                                onClick={() => {
                                                    setSortBy(o.id);
                                                    setSortOpen(false);
                                                }}
                                                className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-secondary transition duration-100 ease-linear hover:bg-primary_hover hover:text-primary"
                                            >
                                                {o.label}
                                                {sortBy === o.id && <Check className="size-4 text-fg-brand-primary" aria-hidden="true" />}
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Grid / list view toggle */}
                        <div className="flex items-center rounded-lg border border-secondary bg-primary p-0.5">
                            {(
                                [
                                    { id: "grid", icon: Grid01, title: "Grid view" },
                                    { id: "list", icon: List, title: "List view" },
                                ] as const
                            ).map((v) => (
                                <button
                                    key={v.id}
                                    type="button"
                                    onClick={() => setView(v.id)}
                                    title={v.title}
                                    className={cx(
                                        "flex size-8 items-center justify-center rounded-md transition duration-100 ease-linear",
                                        view === v.id
                                            ? "bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300"
                                            : "text-fg-quaternary hover:text-fg-secondary",
                                    )}
                                >
                                    <v.icon className="size-4" aria-hidden="true" />
                                </button>
                            ))}
                        </div>

                        {editing && (
                            <button
                                type="button"
                                onClick={() => setModal({ mode: "new" })}
                                className="flex items-center gap-1.5 rounded-lg bg-brand-solid px-3.5 py-2 text-sm font-semibold text-white transition duration-100 ease-linear hover:opacity-90"
                            >
                                <Plus className="size-4" aria-hidden="true" />
                                New Client
                            </button>
                        )}
                    </div>
                </header>

                {/* Tier tabs — relocated from the sidebar so tiers read as the
                    primary way to slice the list. Pill style matches the
                    reference ("Channels" pill). */}
                <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-secondary bg-primary px-6 py-3">
                    {/* Unfiltered view — every tier at once. Sits left of the tiers,
                        separated by a rule so it reads as "no filter" rather than a
                        fourth tier. */}
                    <button
                        type="button"
                        onClick={() => setFilter({ type: "all", value: "" })}
                        className={cx(
                            "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition duration-100 ease-linear",
                            filter.type === "all" ? "bg-brand-solid text-white" : "text-tertiary hover:bg-secondary hover:text-secondary",
                        )}
                    >
                        <Users01 className="size-4" aria-hidden="true" />
                        All Clients
                        <span className={cx("text-xs tabular-nums", filter.type === "all" ? "text-white/70" : "text-quaternary")}>
                            {clients.filter((c) => !c.private_to).length}
                        </span>
                    </button>
                    <span className="mx-1 h-4 w-px shrink-0 bg-border-secondary" aria-hidden="true" />
                    {TIERS.map((t) => {
                        const active = filter.type === "tier" && filter.value === t.id;
                        return (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => setFilter({ type: "tier", value: t.id })}
                                className={cx(
                                    "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition duration-100 ease-linear",
                                    active ? "bg-brand-solid text-white" : "text-tertiary hover:bg-secondary hover:text-secondary",
                                )}
                            >
                                <t.icon className="size-4" aria-hidden="true" />
                                {t.label}
                                <span className={cx("text-xs tabular-nums", active ? "text-white/70" : "text-quaternary")}>
                                    {clients.filter((c) => c.tier === t.id && !c.private_to).length}
                                </span>
                            </button>
                        );
                    })}
                </div>

                <div className="flex-1 overflow-y-auto">
                    <div className="w-full px-6 py-6">
                        {loading ? (
                            <div className="flex h-48 items-center justify-center">
                                <div className="size-6 animate-spin rounded-full border-2 border-brand border-t-transparent opacity-60" />
                            </div>
                        ) : (
                            // Fluid grid — square cards, capped at 5 per row; beyond
                            // that the cards themselves grow instead of adding columns.
                            <div
                                className={cx(
                                    // Columns come from the space actually available, not from
                                    // viewport breakpoints: the icon rail + Client List sidebar eat
                                    // ~420px, so breakpoints kept handing out more columns than the
                                    // grid could afford (at 1536px the 5-column rule produced 206px
                                    // cards — narrower than at 1440px). auto-fill with a 310px floor
                                    // keeps every card square and roomy, and re-flows on its own
                                    // when the sidebar collapses.
                                    view === "grid" ? "grid grid-cols-[repeat(auto-fill,minmax(310px,1fr))] gap-5" : "flex flex-col gap-2.5",
                                )}
                            >
                                {sorted.map((client) => (
                                    <ClientCard
                                        key={client.id}
                                        client={client}
                                        editing={editing}
                                        layout={view}
                                        filterType={filter.type}
                                        onStar={handleStar}
                                        onDelete={handleDelete}
                                        onEdit={(c) => setModal({ mode: "edit", client: c })}
                                        onRename={handleRename}
                                        onPatch={handlePatch}
                                    />
                                ))}

                                {editing &&
                                    (view === "grid" ? (
                                        <motion.button
                                            type="button"
                                            onClick={() => setModal({ mode: "new" })}
                                            whileHover={{ y: -4 }}
                                            className="flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary text-tertiary transition duration-100 ease-linear hover:border-brand hover:bg-brand-50 hover:text-brand-secondary dark:hover:bg-brand-950/30"
                                        >
                                            <Plus className="size-7" />
                                            <span className="text-sm font-semibold">New Client</span>
                                        </motion.button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => setModal({ mode: "new" })}
                                            className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary px-4 py-3 text-sm font-semibold text-tertiary transition duration-100 ease-linear hover:border-brand hover:bg-brand-50 hover:text-brand-secondary dark:hover:bg-brand-950/30"
                                        >
                                            <Plus className="size-5" />
                                            New Client
                                        </button>
                                    ))}
                            </div>
                        )}

                        {!loading && filtered.length === 0 && !editing && (
                            <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
                                <p className="text-sm font-medium text-primary">No clients in {headerLabel} yet</p>
                                <p className="text-sm text-tertiary">Unlock editing (rail, bottom-left) to add clients.</p>
                            </div>
                        )}
                    </div>
                </div>

                <AnimatePresence>
                    {modal?.mode === "new" && <ClientModal onClose={() => setModal(null)} onSave={handleCreate} />}
                    {modal?.mode === "edit" && (
                        <ClientModal initial={modal.client} onClose={() => setModal(null)} onSave={(data) => handleUpdate(modal.client, data)} />
                    )}
                </AnimatePresence>
            </div>
        </>
    );
};

/* ── Dashboard layout ─────────────────────────────────────────────── */

const DashboardLayout = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const initialDeptId = (() => {
        const p = searchParams.get("dept");
        return p && DEPARTMENTS.some((d) => d.id === p) ? p : "clients";
    })();
    const [department, setDepartment] = useState(initialDeptId);
    const [activeSection, setActiveSection] = useState(() => {
        const d = DEPARTMENTS.find((x) => x.id === initialDeptId) ?? DEPARTMENTS[0];
        // Link rows (Manual) render no content of their own, so they can't be the landing tab.
        const fallback = (d.tabs.find((x) => !x.to) ?? d.tabs[0])?.id ?? "";
        // Restore the tab from the URL so the browser Back button lands on the same
        // section. Static tabs are validated; a card-department custom tab id is
        // accepted optimistically and matches once overview_tabs load.
        const t = searchParams.get("tab");
        if (t && (d.tabs.some((x) => x.id === t) || d.kind === "cards")) return t;
        return fallback;
    });
    const [editing, setEditing] = useState(false);
    // Anyone on the team can edit; a per-card lock (below) protects specific cards
    // so only the owner can delete them.
    const { user } = useAuthUser();
    const isOwner = (user?.email ?? "").toLowerCase() === OWNER_EMAIL;

    // Shift+E toggles edit mode; Shift+S locks (dashboard edits already save on change).
    useEditShortcuts({ onToggle: () => setEditing((v) => !v), onSave: () => setEditing(false) });

    // Hide/show the icon rail + side menu (persisted app-wide). Collapsed shows a slim top bar.
    const { collapsed: navCollapsed, toggle: toggleNav } = useNavCollapsed();
    const [customTabs, setCustomTabs] = useState<OverviewTab[]>([]);
    const dept = DEPARTMENTS.find((d) => d.id === department) ?? DEPARTMENTS[0];

    // Keep the URL query in sync with the current department + tab so the browser
    // Back button restores this exact view (e.g. returning from a card's linked
    // page) instead of the department we first arrived on. replace: true keeps
    // every in-page switch out of the history stack.
    useEffect(() => {
        const next = new URLSearchParams(searchParams);
        next.set("dept", department);
        if (activeSection) next.set("tab", activeSection);
        else next.delete("tab");
        if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
    }, [department, activeSection]);

    // Load custom tabs for card departments.
    useEffect(() => {
        if (dept.kind !== "cards") {
            setCustomTabs([]);
            return;
        }
        supabase
            .from("overview_tabs")
            .select("*")
            .eq("department", dept.id)
            .order("created_at", { ascending: true })
            .then(({ data, error }) => {
                if (!error && data) setCustomTabs(data as OverviewTab[]);
                else setCustomTabs([]);
            });
    }, [dept.id, dept.kind]);

    const tabs: DeptTab[] = dept.kind === "cards" ? [...dept.tabs, ...customTabs.map((t) => ({ id: t.id, label: t.label, icon: LayoutAlt01 }))] : dept.tabs;

    /** The first tab that actually renders something here — link rows (Manual) have no
     *  content of their own, so landing on one would show an empty department. */
    const firstContentTab = (d: Department) => (d.tabs.find((t) => !t.to) ?? d.tabs[0])?.id ?? "";

    const selectDept = (id: string) => {
        const d = DEPARTMENTS.find((x) => x.id === id) ?? DEPARTMENTS[0];
        setDepartment(id);
        setActiveSection(firstContentTab(d));
    };

    /** A tab either switches the section or, when it carries `to`, opens its own page. */
    const selectTab = (id: string) => {
        const t = tabs.find((x) => x.id === id);
        if (t?.to) navigate(t.to);
        else setActiveSection(id);
    };

    const addTab = async (label: string) => {
        const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
        const row: OverviewTab = { id, department: dept.id, label };
        setCustomTabs((prev) => [...prev, row]);
        setActiveSection(id);
        const { error } = await supabase.from("overview_tabs").insert(row);
        if (error) {
            console.error("[overview tab insert] Supabase error:", error);
            setCustomTabs((prev) => prev.filter((t) => t.id !== id));
            setActiveSection(dept.tabs[0].id);
            alert("Could not save tab: " + error.message);
        }
    };

    const deleteTab = async (id: string) => {
        setCustomTabs((prev) => prev.filter((t) => t.id !== id));
        if (activeSection === id) setActiveSection(dept.tabs[0].id);
        await supabase.from("overview_tabs").delete().eq("id", id);
        await supabase.from("overview_cards").delete().eq("department", dept.id).eq("tab", id);
    };

    return (
        <AppShell
            className="flex flex-col"
            rail={
                !navCollapsed && (
                    <IconRail
                        activeDept={department}
                        onSelectDept={selectDept}
                        bottom={<RailBottom editing={editing} onToggleEditing={() => setEditing((e) => !e)} />}
                    />
                )
            }
            headerRight={!navCollapsed && <HeaderAvatar />}
        >
            {/* Slim top bar when the rail + side menu are hidden */}
            {navCollapsed && <CollapsedTopBar title={dept.header} onExpand={toggleNav} />}

            <div className="flex min-h-0 flex-1 gap-2 bg-secondary p-2">
                {dept.kind === "clientlist" ? (
                    <ClientListContent editing={editing} navCollapsed={navCollapsed} onCollapse={toggleNav} />
                ) : (
                    <>
                        {!navCollapsed && (
                            <Sidebar
                                department={dept}
                                tabs={tabs}
                                activeSection={activeSection}
                                onSelect={selectTab}
                                editing={editing}
                                canEditTabs={dept.kind === "cards"}
                                customTabIds={customTabs.map((t) => t.id)}
                                onAddTab={addTab}
                                onDeleteTab={deleteTab}
                                onCollapse={toggleNav}
                            />
                        )}
                        {activeSection === "owner-guides" ? (
                            <OwnerGuidesContent editing={editing} isOwner={isOwner} />
                        ) : dept.kind === "docs" ? (
                            activeSection === "popups" ? (
                                <PopupsContent />
                            ) : activeSection === "host-onboarding" ? (
                                <HostOnboardingContent />
                            ) : (
                                <MetaPixelContent />
                            )
                        ) : (
                            <OverviewContent key={dept.id + ":" + activeSection} department={dept} tab={activeSection} editing={editing} isOwner={isOwner} />
                        )}
                    </>
                )}
            </div>
        </AppShell>
    );
};

/* ── Page export ──────────────────────────────────────────────────── */

/**
 * Team gate — Google (@hiddengem.media) OR team password. Shared by /dashboard
 * and /home: one unlock (sessionStorage flag) covers every gated page, and the
 * Google OAuth redirect returns to whichever page started the sign-in.
 */
export const TeamGate = ({ children }: { children: ReactNode }) => {
    const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem("hgm_dashboard_unlocked") === "1");
    const [googleError, setGoogleError] = useState("");
    const [googleLoading, setGoogleLoading] = useState(false);

    const handleUnlock = () => {
        sessionStorage.setItem("hgm_dashboard_unlocked", "1");
        setUnlocked(true);
    };

    // On load and on sign-in (incl. the async return from Google OAuth): if there's a
    // session, only let @hiddengem.media accounts in — otherwise sign out and show an
    // error. Subscribing to auth changes ensures we land on the page as soon as
    // the OAuth session is ready, instead of only checking once on mount.
    useEffect(() => {
        const admit = (email: string | undefined) => {
            if (sessionStorage.getItem("hgm_dashboard_unlocked") === "1") return;
            const normalized = email?.toLowerCase() ?? "";
            if (!normalized) return;
            if (normalized.endsWith(`@${ALLOWED_DOMAIN}`)) {
                handleUnlock();
            } else {
                supabase.auth.signOut();
                setGoogleError(`That account isn't allowed. Use an @${ALLOWED_DOMAIN} Google account.`);
            }
        };

        supabase.auth.getSession().then(({ data }) => admit(data.session?.user?.email));

        const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
            admit(session?.user?.email);
        });

        return () => sub.subscription.unsubscribe();
    }, []);

    const handleGoogle = async () => {
        setGoogleError("");
        setGoogleLoading(true);
        const { error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: `${window.location.origin}${window.location.pathname}`,
                // hd hints Google to prefer the workspace domain; real enforcement is the check above.
                queryParams: { hd: ALLOWED_DOMAIN, prompt: "select_account" },
            },
        });
        if (error) {
            setGoogleError("Couldn't start Google sign-in. Try again or use the team password.");
            setGoogleLoading(false);
        }
        // On success the browser redirects to Google, so no further handling here.
    };

    return unlocked ? (
        <>{children}</>
    ) : (
        <PasswordGate onUnlock={handleUnlock} onGoogle={handleGoogle} googleError={googleError} googleLoading={googleLoading} />
    );
};

export const DashboardScreen = () => (
    <TeamGate>
        <DashboardLayout />
    </TeamGate>
);
