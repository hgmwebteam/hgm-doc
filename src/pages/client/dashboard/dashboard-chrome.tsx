/**
 * Shared chrome for the client dashboard: the sign-in gate, the section heading and its
 * phase eyebrow, the side-menu row, the search bar and the small shared primitives.
 *
 * These draw the frame around a section rather than any section's own content, so they
 * take plain props and hold none of the dashboard's state.
 */
import { type FC, type ReactNode, useEffect, useRef, useState } from "react";
import { ChevronDown, Copy01, Plus, SearchLg, Trash01 } from "@untitledui-pro/icons/line";
import { AnimatePresence, motion } from "motion/react";
import { SignInBackdrop } from "@/components/application/sign-in-backdrop";
import { Button } from "@/components/base/buttons/button";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { type DashboardUser, type SectionId, findDashboardUser, genSharePassword, normEmail, passwordFor } from "@/pages/client/dashboard/dashboard-model";
import { ASSIGNABLE_SECTION_GROUPS, PHASES, type SearchHit, phaseOfSection } from "@/pages/client/dashboard/dashboard-navigation";
import { cx } from "@/utils/cx";

/**
 * Sign-in / no-access screen for a client dashboard.
 *
 * Two states, because they need different words: nobody signed in yet, versus signed in as
 * someone this dashboard isn't shared with. The second is the one people actually hit —
 * Google silently reuses whichever account is already active — so it names the address and
 * offers to switch rather than just refusing.
 *
 * The client's name is deliberately absent: a stranger who lands here learns nothing about
 * whose dashboard it is.
 */
export const DashboardAccessGate = ({
    users,
    sharePassword,
    onUnlock,
    backgroundUrl,
}: {
    /** Everyone this dashboard is shared with. The typed email picks the row; that row's
     *  own password is what must match, so the address is no longer interchangeable. */
    users: DashboardUser[];
    /** Fallback password, used by anyone without one of their own. */
    sharePassword: string;
    /** Receives the (normalized) email that cleared the gate — the client's identity
     *  for the suggestion feature and for which sections they see, since to Supabase
     *  they are just `anon`. */
    onUnlock: (email: string) => void;
    /** Per-client override (image or video). Falls back to the shared leaf loop. */
    backgroundUrl?: string;
}) => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPw, setShowPw] = useState(false);
    const [error, setError] = useState("");

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const match = findDashboardUser(users, email);
        const expected = match ? passwordFor(match, sharePassword) : "";
        // One message for either failure. Saying "that email isn't on the list" would let
        // someone probe which addresses a dashboard is shared with. `expected` is checked
        // for emptiness too: a person with no password of their own on a dashboard with no
        // shared one must not be let in by typing nothing.
        if (!match || !expected || password !== expected) {
            setError("That email and password don't match this dashboard.");
            return;
        }
        setError("");
        onUnlock(normEmail(email));
    };

    return (
        <SignInBackdrop backgroundUrl={backgroundUrl}>
            <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-primary p-8 shadow-2xl ring-1 ring-secondary">
                <img src="/hgm logo/Favicon ON LIGHT.svg" alt="HiddenGem Media" className="mx-auto size-11" draggable={false} />
                <h1 className="mt-5 text-center text-lg font-semibold text-primary">This dashboard is private</h1>
                <p className="mt-2 text-center text-sm text-pretty text-tertiary">Enter the email and password your HiddenGem team shared with you.</p>

                <div className="mt-6 flex flex-col gap-3">
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@yourbusiness.com"
                        autoComplete="username"
                        autoFocus
                        className="w-full rounded-lg bg-primary px-3 py-2.5 text-sm text-primary ring-1 ring-secondary outline-none focus:ring-brand"
                    />
                    <div className="flex items-center gap-2">
                        <input
                            type={showPw ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Password"
                            autoComplete="current-password"
                            className="min-w-0 flex-1 rounded-lg bg-primary px-3 py-2.5 text-sm text-primary ring-1 ring-secondary outline-none focus:ring-brand"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPw((v) => !v)}
                            aria-label={showPw ? "Hide password" : "Show password"}
                            className="shrink-0 rounded-lg px-2 py-2 text-xs font-semibold text-brand-secondary transition duration-100 ease-linear hover:bg-secondary"
                        >
                            {showPw ? "Hide" : "Show"}
                        </button>
                    </div>
                </div>

                {error && (
                    <p className="mt-3 text-sm text-error-primary" role="alert">
                        {error}
                    </p>
                )}

                <Button size="md" type="submit" className="mt-5 w-full" isDisabled={!email.trim() || !password}>
                    Open my dashboard
                </Button>
                <p className="mt-4 text-center text-xs text-quaternary">Lost your details? Reply to your HiddenGem email and we'll resend them.</p>
            </form>
        </SignInBackdrop>
    );
};

/* ── The team's access panel ─────────────────────────────────────────────────
   Lives beside the gate it configures rather than in the page, so the rules the
   gate enforces and the controls that set them read together. */

const panelInput = (extra?: string) =>
    cx("min-w-0 flex-1 rounded-lg bg-primary px-3 py-2 text-sm text-primary ring-1 ring-secondary outline-none focus:ring-brand", extra);

/** Matches the status pills at the top of Overview, so the two read as one language. */
const choiceChip = (active: boolean) =>
    cx(
        "rounded-full px-3 py-1 text-xs font-medium transition duration-100 ease-linear",
        active ? "bg-brand-solid text-white" : "bg-secondary text-tertiary ring-1 ring-secondary hover:text-secondary",
    );

/** What one person is allowed to see, in a few words, for the collapsed row. */
const summariseAccess = (u: DashboardUser) => {
    if (!u.sections) return "The dashboard default";
    if (u.sections.length === 0) return "Overview only";
    return `${u.sections.length} section${u.sections.length === 1 ? "" : "s"}`;
};

/**
 * "Who can open this dashboard" — the team's access panel, top of Overview in edit mode.
 *
 * One card per person: the address they sign in with, the password that goes with it, and
 * which sections they land on. Per person rather than per dashboard because a bookkeeper
 * and an owner can be sent the same link without being shown the same thing.
 *
 * Without this, arming the sign-in gate would lock every client out, so it sits where an
 * AM can't miss it.
 */
export const DashboardAccessPanel = ({
    users,
    sharePassword,
    defaultSections,
    onChangeUsers,
    onChangeSharePassword,
}: {
    users: DashboardUser[];
    sharePassword: string;
    /** The dashboard-wide list (the eye toggles), used to seed a fresh custom list so an
     *  AM starts from what this person would have seen and takes things away. */
    defaultSections: string[];
    onChangeUsers: (next: DashboardUser[]) => void;
    onChangeSharePassword: (next: string) => void;
}) => {
    /** Which person's section list is open. One at a time — the checklist is long enough
     *  that two expanded turns the panel into a wall. */
    const [openRow, setOpenRow] = useState<number | null>(null);

    const patch = (i: number, next: Partial<DashboardUser>) => onChangeUsers(users.map((u, j) => (j === i ? { ...u, ...next } : u)));
    const remove = (i: number) => {
        onChangeUsers(users.filter((_, j) => j !== i));
        setOpenRow(null);
    };
    const add = () => {
        // A new person starts with a password of their own already generated. Making that
        // the default is what keeps per-person passwords from being something an AM has to
        // remember — a shared one everybody reuses puts every view back within reach of
        // anyone who can type someone else's address.
        onChangeUsers([...users, { email: "", password: genSharePassword(), sections: null }]);
        setOpenRow(users.length);
    };
    const toggleSection = (i: number, id: SectionId) => {
        const cur = users[i].sections ?? [];
        patch(i, { sections: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] });
    };

    const named = users.filter((u) => u.email.trim());
    const armed = named.some((u) => passwordFor(u, sharePassword));
    const stranded = named.filter((u) => !passwordFor(u, sharePassword)).length;

    return (
        <div className="mt-8 rounded-xl bg-secondary p-5 ring-1 ring-secondary">
            {/* Sized to match "Your journey" further down Overview — at text-sm it was the
                same size as its own description and read as another line of body copy. */}
            <h2 className="text-lg font-semibold text-primary">Who can open this dashboard</h2>
            <p className="mt-1 text-sm text-pretty text-tertiary">
                Anyone at @hiddengem.media always has access. Add each person who should see this dashboard — they sign in with their own email and password,
                and you choose which sections each one lands on.
            </p>

            <div className="mt-4 flex flex-col gap-3">
                {users.map((u, i) => {
                    const usable = passwordFor(u, sharePassword);
                    const custom = !!u.sections;
                    const expanded = openRow === i;
                    return (
                        // Keyed by index, not by the address: the email is edited in place, so a
                        // key derived from it would remount the input on every keystroke and drop
                        // focus. Removal resets openRow rather than trying to follow the shift.
                        <div key={i} className="rounded-lg bg-primary p-3 ring-1 ring-secondary">
                            <div className="flex items-center gap-2">
                                <input
                                    type="email"
                                    value={u.email}
                                    placeholder="client@example.com"
                                    aria-label="Email address"
                                    onChange={(e) => patch(i, { email: e.target.value })}
                                    className={panelInput()}
                                />
                                <button
                                    type="button"
                                    aria-label={`Remove ${u.email || "this person"}`}
                                    onClick={() => remove(i)}
                                    className="flex size-8 shrink-0 items-center justify-center rounded-lg text-fg-quaternary transition duration-100 ease-linear hover:bg-error-primary hover:text-fg-error-primary"
                                >
                                    <Trash01 className="size-4" aria-hidden="true" />
                                </button>
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                <input
                                    type="text"
                                    value={u.password ?? ""}
                                    placeholder={sharePassword ? "Empty — uses the shared password" : "Set a password"}
                                    aria-label={`Password for ${u.email || "this person"}`}
                                    onChange={(e) => patch(i, { password: e.target.value })}
                                    className={panelInput("font-mono")}
                                />
                                <Button size="sm" color="secondary" onClick={() => patch(i, { password: genSharePassword() })}>
                                    New
                                </Button>
                                <Button
                                    size="sm"
                                    color="secondary"
                                    iconLeading={Copy01}
                                    isDisabled={!usable}
                                    onClick={() => void navigator.clipboard.writeText(usable)}
                                >
                                    Copy
                                </Button>
                            </div>
                            {/* NOT AN ERROR. This used to read "No password - this person can't get
                                in", in red, and it was wrong about half of what the list now does.
                                A listed address with no password opens the HELP CENTRE, by Google
                                sign-in, without arming the dashboard's own password gate - which
                                is exactly the state that lets a client raise requests while their
                                dashboard stays open by URL for everyone else. 48 of 54 dashboards
                                have nobody listed, and this sentence was talking account managers
                                out of the one zero-cost way to change that. Said plainly instead. */}
                            {!usable && (
                                <p className="mt-1.5 text-xs text-tertiary">
                                    No password: they can raise and follow requests in the help centre by signing in with Google, but
                                    cannot open a password-protected dashboard. Give them one only if the dashboard itself should be
                                    locked.
                                </p>
                            )}

                            <button
                                type="button"
                                onClick={() => setOpenRow(expanded ? null : i)}
                                aria-expanded={expanded}
                                className="mt-2 flex w-full items-center gap-2 rounded-lg px-1 py-1.5 text-left transition duration-100 ease-linear hover:bg-secondary"
                            >
                                <span className="shrink-0 text-xs font-medium text-secondary">Can see</span>
                                <span className="min-w-0 flex-1 truncate text-xs text-tertiary">{summariseAccess(u)}</span>
                                <ChevronDown
                                    aria-hidden="true"
                                    className={cx("size-4 shrink-0 text-fg-quaternary transition-transform duration-150", !expanded && "-rotate-90")}
                                />
                            </button>

                            {expanded && (
                                <div className="mt-1 border-t border-secondary pt-3">
                                    <div className="flex flex-wrap gap-2">
                                        <button type="button" onClick={() => patch(i, { sections: null })} className={choiceChip(!custom)}>
                                            Same as everyone
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => patch(i, { sections: u.sections ?? [...defaultSections] })}
                                            className={choiceChip(custom)}
                                        >
                                            Choose sections
                                        </button>
                                    </div>
                                    <p className="mt-2 text-xs text-pretty text-tertiary">
                                        {custom
                                            ? "Only the ticked sections, whatever the eye toggles in the side menu say. Overview is always shown."
                                            : "Follows the eye toggles in the side menu, like everyone else on this dashboard."}
                                    </p>
                                    {custom && (
                                        <div className="mt-3 flex flex-col gap-3">
                                            {ASSIGNABLE_SECTION_GROUPS.map((g) => (
                                                <div key={g.label}>
                                                    <p className="text-[11px] font-bold tracking-wide text-quaternary uppercase">{g.label}</p>
                                                    <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
                                                        {g.items.map((s) => (
                                                            <Checkbox
                                                                key={s.id}
                                                                size="sm"
                                                                label={s.soon ? `${s.label} — not built yet` : s.label}
                                                                isSelected={(u.sections ?? []).includes(s.id)}
                                                                onChange={() => toggleSection(i, s.id)}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="mt-3">
                <Button size="sm" color="secondary" iconLeading={Plus} onClick={add}>
                    Add a person
                </Button>
            </div>

            <div className="mt-4 border-t border-secondary pt-4">
                <p className="text-sm font-medium text-secondary">Shared password</p>
                <p className="mt-1 text-xs text-pretty text-tertiary">
                    The fallback for anyone above who has no password of their own. Dashboards created before per-person passwords rely on it, so clearing it is
                    only safe once everyone listed has their own.
                </p>
                <div className="mt-2 flex items-center gap-2">
                    <input
                        type="text"
                        value={sharePassword}
                        placeholder="Set a password"
                        aria-label="Shared password"
                        onChange={(e) => onChangeSharePassword(e.target.value)}
                        className={panelInput("font-mono")}
                    />
                    <Button size="sm" color="secondary" iconLeading={Copy01} onClick={() => void navigator.clipboard.writeText(sharePassword)}>
                        Copy
                    </Button>
                </div>
                {/* Say which half is missing rather than leaving an AM wondering why nothing is locked. */}
                {!armed && (
                    <p className="mt-2 text-xs text-warning-primary">
                        {named.length === 0 ? "Not locked yet — add a person." : "Not locked yet — give at least one person a password."}
                    </p>
                )}
                {armed && (
                    <p className="mt-2 text-xs text-success-primary">Locked. Only the people above can open this dashboard, each with their own password.</p>
                )}
                {armed && stranded > 0 && (
                    <p className="mt-1 text-xs text-warning-primary">
                        {stranded === 1 ? "One person has" : `${stranded} people have`} no password and can&apos;t get in.
                    </p>
                )}
            </div>
        </div>
    );
};

export const SectionEyebrow = ({ section }: { section: SectionId }) => {
    const phase = phaseOfSection(section);
    if (!phase) return null;
    const p = PHASES[phase];
    return (
        <div className="flex items-center gap-3">
            <span
                className={cx("inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold tracking-wide uppercase", p.bg, p.text)}
            >
                {p.num !== null && <span className="tabular-nums opacity-70">Phase {p.num}</span>}
                {p.label}
            </span>
            <span className="h-px flex-1 bg-border-secondary" />
        </div>
    );
};

export const SectionHeading = ({ children }: { children: ReactNode }) => (
    <h2 className="mt-4 text-xl font-semibold text-primary md:text-display-xs">{children}</h2>
);

/** Shared chrome for every editable field on the dashboard. Module scope (it closes over
 *  nothing) so the Master Brand Document's sub-components below can reach it too. */
export const editInput = (extra?: string) =>
    cx(
        "w-full rounded-lg border border-secondary bg-transparent px-2.5 py-1.5 text-sm text-primary transition duration-100 ease-linear outline-none placeholder:text-placeholder focus:border-brand focus:ring-1 focus:ring-brand",
        extra,
    );

/* ═══════════════════════════════════════════════════════════════════════
   Master Brand Document — the eleven-section brand foundation.
   Small presentational pieces, kept at module scope so the section's JSX
   below reads as the document it renders rather than as nested divs.
   ═══════════════════════════════════════════════════════════════════════ */

export const StatTile = ({ label, value, change }: { label: string; value: string; change?: ReactNode }) => (
    <div className="rounded-xl p-5 ring-1 ring-secondary">
        <p className="text-sm font-medium text-tertiary">{label}</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
            <p className="text-display-xs font-semibold text-primary md:text-display-sm">{value}</p>
            {change}
        </div>
    </div>
);

export const EyeGlyph = () => (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
    </svg>
);
export const EyeOffGlyph = () => (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M1 1l22 22" />
    </svg>
);

/**
 * Header search — client-scoped, NOT the internal team's sitewide search. It only
 * searches this one client's own sidebar sections, links and FAQs (passed in as
 * `hits`) — never other clients, internal team pages, or admin routes. Purely local
 * filtering over already-loaded props; no network calls.
 */
export const ClientSearchBar = ({ hits, onSelect }: { hits: SearchHit[]; onSelect: (id: SectionId) => void }) => {
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
        };
        window.addEventListener("mousedown", onDown);
        return () => window.removeEventListener("mousedown", onDown);
    }, [open]);

    const q = query.trim().toLowerCase();
    const results = q ? hits.filter((h) => h.label.toLowerCase().includes(q) || h.sub?.toLowerCase().includes(q)) : hits;

    const go = (id: SectionId) => {
        onSelect(id);
        setQuery("");
        setOpen(false);
        inputRef.current?.blur();
    };

    return (
        <div ref={containerRef} className="relative flex flex-1 items-center justify-center px-1">
            <div
                className={cx(
                    "flex w-full max-w-md items-center gap-2.5 rounded-full border bg-primary px-4 py-2 transition duration-100 ease-linear",
                    open ? "border-brand ring-2 ring-brand/15" : "border-secondary hover:border-primary",
                )}
            >
                <SearchLg
                    className={cx("size-4 shrink-0 transition duration-100 ease-linear", open ? "text-fg-brand-primary" : "text-quaternary")}
                    aria-hidden="true"
                />
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setOpen(true);
                    }}
                    onFocus={() => setOpen(true)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && results[0]) go(results[0].id);
                        else if (e.key === "Escape") {
                            setOpen(false);
                            inputRef.current?.blur();
                        }
                    }}
                    placeholder="Search your dashboard…"
                    className="min-w-0 flex-1 bg-transparent text-sm text-primary outline-none placeholder:text-placeholder"
                />
            </div>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.14 }}
                        className="absolute top-full left-1/2 z-30 mt-2 w-full max-w-md -translate-x-1/2 overflow-hidden rounded-2xl bg-primary shadow-2xl ring-1 ring-secondary"
                    >
                        <div className="max-h-[50vh] overflow-y-auto p-2">
                            {results.length === 0 ? (
                                <p className="px-4 py-6 text-center text-sm text-tertiary">No matches for “{query}”</p>
                            ) : (
                                results.map((h, i) => (
                                    <button
                                        key={`${h.id}-${i}`}
                                        type="button"
                                        onClick={() => go(h.id)}
                                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-secondary transition duration-100 ease-linear hover:bg-secondary hover:text-primary"
                                    >
                                        <span className="flex-1 truncate">{h.label}</span>
                                        {h.sub && <span className="shrink-0 truncate text-xs text-quaternary">{h.sub}</span>}
                                    </button>
                                ))
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

/**
 * Side-menu item. Matches the Untitled UI nav language from
 * components/application/app-navigation (h-9 target, rounded-md, semibold label,
 * focus-visible ring) but renders a real <button>: these switch an in-page
 * section, not a route, and NavItemBase renders an <a role="link"> which would
 * announce navigation that never happens.
 */
export const SectionNavItem = ({
    icon: Icon,
    label,
    current,
    disabled,
    badge,
    indent,
    onClick,
    action,
}: {
    /** Optional: numbered rows in the funnel groups carry a number instead, and an
     *  icon beside it is one redundant marker too many. */
    icon?: FC<{ className?: string }>;
    label: string;
    current: boolean;
    disabled?: boolean;
    /** Real state for this section — a count, "Done", etc. */
    badge?: ReactNode;
    indent?: boolean;
    onClick: () => void;
    /** Edit-mode control (the per-client eye toggle), rendered OUTSIDE the row button:
     *  a <button> nested in a <button> is invalid HTML and its click would bubble into
     *  the row's own handler, switching section on every toggle. */
    action?: ReactNode;
}) => (
    <div className="relative flex items-center">
        <button
            type="button"
            onClick={disabled ? undefined : onClick}
            disabled={disabled}
            aria-current={current ? "page" : undefined}
            className={cx(
                "group/item relative flex min-h-9 w-full cursor-pointer items-center rounded-md p-2 text-left outline-focus-ring transition duration-100 ease-linear select-none focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2",
                indent && "pl-4",
                action && "pr-8",
                // The rail sits on bg-secondary, so a row lifts by moving TOWARD the
                // content colour. bg-secondary here would be invisible — same value as
                // the rail — which is what it was before the rail was darkened.
                current ? "bg-primary" : "hover:bg-primary",
                disabled && "cursor-not-allowed opacity-60 hover:bg-transparent",
            )}
        >
            {Icon && (
                <Icon
                    aria-hidden="true"
                    className={cx(
                        "mr-2 size-5 shrink-0 transition-inherit-all",
                        current ? "text-fg-brand-primary" : "text-fg-quaternary group-hover/item:text-fg-quaternary_hover",
                    )}
                />
            )}
            <span
                className={cx(
                    // Weight carries the state, not just colour: only the open row is
                    // semibold. Everything semibold means nothing is emphasised.
                    "flex-1 truncate text-sm transition-inherit-all",
                    current ? "font-semibold text-primary" : "font-normal text-secondary group-hover/item:text-secondary_hover",
                )}
            >
                {label}
            </span>
            {badge}
        </button>
        {action && <div className="absolute right-1 flex shrink-0 items-center">{action}</div>}
    </div>
);
