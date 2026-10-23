import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Clock, LayoutAlt01, LinkExternal01, RefreshCw01, Rocket02, Users01, XCircle } from "@untitledui/icons";
import { AppShell, CollapsedTopBar, IconRail, RailBottom, useNavCollapsed } from "@/components/application/icon-rail";
import { SignInBackdrop } from "@/components/application/sign-in-backdrop";
import { Avatar } from "@/components/base/avatar/avatar";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Select } from "@/components/base/select/select";
import { useAuthUser } from "@/hooks/use-auth-user";
import { type DashboardUpdate, listDashboardUpdates } from "@/lib/dashboard-updates";
import {
    ALL,
    type BugEvent,
    type BugTicket,
    LOG_TYPES,
    type LogEntry,
    type LogFilters,
    type LogPerson,
    buildFeed,
    filterFeed,
    portalPages,
} from "@/lib/portal-log-model";
import type { Release } from "@/lib/portal-releases";
import { supabase } from "@/lib/supabase";
import { fetchBugLog } from "@/pages/client/help/help-api";
import { STATUS_META, displayUrl } from "@/pages/client/help/help-model";
import { requestHref } from "@/pages/team/client-requests/client-requests-model";
import { cx } from "@/utils/cx";

/**
 * /log — the portal change log: who changed what, newest first.
 *
 * The page exists to answer one question the team asked every morning: what did anyone else
 * change yesterday? A client dashboard is worked on by whoever is free — an AM in the
 * morning, the web team that afternoon — and nothing recorded it, so the only way to find
 * out was to open the dashboard and try to spot the difference. The portal itself changes
 * the same way, so the log also carries its releases and the problems the team reported on
 * its pages (src/lib/portal-log-model.ts has the three sources and the rules).
 *
 * Read-only by design. Every entry is written by something else — the dashboard as people
 * save, git as changes merge, the Help Center as requests move — and nothing on this page can
 * add, edit or remove one. A feed you can write by hand is a feed you can't trust.
 */

const ALLOWED_DOMAIN = "hiddengem.media";
const REPO_URL = "https://github.com/hgmwebteam/hgm-doc";

/* Google "G" mark (official multicolor) — same as the dashboard and /log-script gates. */
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

/* ── Sign-in gate ─────────────────────────────────────────────────────
   Team-only, like /log-script: the table's RLS policy checks the session's own email, so a
   password-unlocked visitor with no Supabase session would see an empty feed and no reason
   why. Better to say what's needed than to render nothing. */

const SignInGate = ({ email }: { email?: string }) => {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    const signIn = async () => {
        setBusy(true);
        setError("");
        const { error: err } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo: `${window.location.origin}/log`, queryParams: { hd: ALLOWED_DOMAIN } },
        });
        if (err) {
            setError(err.message);
            setBusy(false);
        }
    };

    const wrongAccount = !!email;

    return (
        <SignInBackdrop>
            <div className="w-full max-w-sm rounded-2xl bg-primary p-8 shadow-2xl ring-1 ring-secondary">
                <img src="/hgm logo/Logo ON LIGHT.svg" alt="HiddenGem Media" className="h-14 dark:hidden" draggable={false} />
                <img src="/hgm logo/LOGO ON Dark.svg" alt="HiddenGem Media" className="hidden h-14 dark:block" draggable={false} />

                <h1 className="mt-6 text-lg font-semibold text-primary">Change log</h1>
                <p className="mt-1 text-sm text-tertiary">
                    {wrongAccount ? (
                        <>
                            You're signed in as <span className="font-medium text-secondary">{email}</span>. This is the team's record of who changed what on
                            the portal, so it's limited to <span className="font-medium text-secondary">@{ALLOWED_DOMAIN}</span> accounts.
                        </>
                    ) : (
                        <>
                            Sign in with your <span className="font-medium text-secondary">@{ALLOWED_DOMAIN}</span> Google account to see what everyone has
                            changed on the portal.
                        </>
                    )}
                </p>

                <button
                    type="button"
                    onClick={signIn}
                    disabled={busy}
                    className="mt-5 flex w-full items-center justify-center gap-2.5 rounded-lg border border-secondary bg-primary px-4 py-2.5 text-sm font-semibold text-secondary transition duration-100 ease-linear hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <GoogleIcon className="size-5" />
                    {busy ? "Redirecting…" : wrongAccount ? "Switch account" : "Continue with Google"}
                </button>
                {error && (
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-error-primary">
                        <XCircle className="size-3.5 shrink-0" />
                        {error}
                    </p>
                )}
            </div>
        </SignInBackdrop>
    );
};

/* ── Dates ────────────────────────────────────────────────────────────
   Entries are grouped by the reader's own calendar day, not by a stored date: "today" has to
   mean today where the person reading is sitting, and the team is spread across time zones. */

const dayKey = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

const dayLabel = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (dayKey(iso) === dayKey(today.toISOString())) return "Today";
    if (dayKey(iso) === dayKey(yesterday.toISOString())) return "Yesterday";
    return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
};

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

const initialsOf = (name: string) =>
    name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() ?? "")
        .join("") || "?";

/* ── One entry ────────────────────────────────────────────────────── */

/** The frame every kind shares: who, what they did, when, and where to look. */
const EntryRow = ({
    who,
    action,
    at,
    href,
    external,
    children,
}: {
    who: LogPerson;
    action: ReactNode;
    at: string;
    href: string;
    external?: boolean;
    children: ReactNode;
}) => (
    <li className="flex gap-3 rounded-xl bg-primary p-4 ring-1 ring-secondary">
        <Avatar size="md" src={who.avatar || undefined} alt={who.name} initials={initialsOf(who.name)} className="mt-0.5 shrink-0" />

        <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-sm font-semibold text-primary">{who.name}</span>
                <span className="text-sm text-tertiary">{action}</span>
                <span className="ml-auto flex shrink-0 items-center gap-1.5 text-xs text-quaternary">
                    <Clock className="size-3.5" aria-hidden="true" />
                    {fmtTime(at)}
                </span>
            </div>
            {children}
        </div>

        <Button
            href={href}
            {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
            color="link-color"
            size="sm"
            iconTrailing={LinkExternal01}
            className="mt-0.5 shrink-0 self-start"
        >
            Open
        </Button>
    </li>
);

const ClientName = ({ name, show }: { name: string; show: boolean }) => (show ? <span className="font-medium text-secondary"> {name}</span> : null);

const UpdateRow = ({ entry, update, showClient }: { entry: LogEntry; update: DashboardUpdate; showClient: boolean }) => {
    // Fields are the detail under the section badges — "Colours, Fonts". Sections with no
    // breakdown (the access keys, plain links) contribute nothing rather than an empty pair
    // of brackets.
    const fieldLine = update.detail
        .filter((d) => d.fields.length)
        .map((d) => `${d.section}: ${d.fields.join(", ")}`)
        .join("  ·  ");

    return (
        <EntryRow
            who={entry.who}
            at={entry.at}
            href={`/${update.slug}`}
            action={
                <>
                    {update.kind === "publish" ? "published to" : "updated"}
                    <ClientName name={entry.client?.name ?? update.slug} show={showClient} />
                </>
            }
        >
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {update.summary && (
                    <Badge color="brand" size="sm">
                        {update.summary}
                    </Badge>
                )}
                {!update.summary &&
                    update.sections.map((section) => (
                        <Badge key={section} color="gray" size="sm">
                            {section}
                        </Badge>
                    ))}
            </div>

            {fieldLine && <p className="mt-2 text-xs text-pretty text-quaternary">{fieldLine}</p>}
        </EntryRow>
    );
};

const ReleaseRow = ({ entry, release }: { entry: LogEntry; release: Release }) => (
    <EntryRow
        who={entry.who}
        at={entry.at}
        href={release.pr ? `${REPO_URL}/pull/${release.pr}` : `${REPO_URL}/commit/${release.sha}`}
        external
        action="released a change to the portal"
    >
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge color="success" size="sm">
                Release
            </Badge>
            <Badge color="gray" size="sm">
                {release.pr ? `#${release.pr}` : release.sha}
            </Badge>
        </div>
        <p className="mt-2 text-sm text-pretty text-secondary">{release.title}</p>
    </EntryRow>
);

const BugRow = ({ entry, ticket, moved, showClient }: { entry: LogEntry; ticket: BugTicket; moved: BugTicket["status"] | null; showClient: boolean }) => {
    const page = portalPages(ticket.urls)[0];
    return (
        <EntryRow
            who={entry.who}
            at={entry.at}
            href={requestHref(ticket)}
            action={
                moved ? (
                    <>
                        moved {ticket.reference} to <span className="font-medium text-secondary">{STATUS_META[moved].label}</span>
                    </>
                ) : (
                    <>
                        reported a problem on
                        <ClientName name={entry.client?.name ?? ticket.client_slug} show={showClient} />
                        {!showClient && " this dashboard"}
                    </>
                )
            }
        >
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge color="warning" size="sm">
                    Bug
                </Badge>
                <Badge color="gray" size="sm">
                    {ticket.reference}
                </Badge>
                {!moved && (
                    <Badge color="gray" size="sm">
                        Now: {STATUS_META[ticket.status]?.label ?? ticket.status}
                    </Badge>
                )}
            </div>
            <p className="mt-2 text-sm text-pretty text-secondary">{ticket.title}</p>
            {!moved && page && <p className="mt-1 truncate text-xs text-quaternary">{displayUrl(page)}</p>}
        </EntryRow>
    );
};

const Entry = ({ entry, showClient }: { entry: LogEntry; showClient: boolean }) =>
    entry.type === "dashboard" ? (
        <UpdateRow entry={entry} update={entry.update} showClient={showClient} />
    ) : entry.type === "release" ? (
        <ReleaseRow entry={entry} release={entry.release} />
    ) : (
        <BugRow entry={entry} ticket={entry.ticket} moved={entry.moved} showClient={showClient} />
    );

/** Supabase rejects with a plain object carrying `message`, not an Error, so the usual
 *  instanceof check would swallow the one useful part ("permission denied for table
 *  dashboard_updates", the case most worth naming). */
const messageOf = (err: unknown, fallback: string) =>
    err && typeof err === "object" && typeof (err as { message?: unknown }).message === "string" ? (err as { message: string }).message : fallback;

/* ── The feed ─────────────────────────────────────────────────────── */

const Feed = () => {
    const { collapsed: navCollapsed, toggle: toggleNav } = useNavCollapsed();
    const [updates, setUpdates] = useState<DashboardUpdate[]>([]);
    const [releases, setReleases] = useState<Release[]>([]);
    const [bugLog, setBugLog] = useState<{ bugs: BugTicket[]; events: BugEvent[] }>({ bugs: [], events: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [bugError, setBugError] = useState("");
    const [type, setType] = useState<LogFilters["type"]>(ALL);
    const [who, setWho] = useState<string>(ALL);
    const [which, setWhich] = useState<string>(ALL);

    // Three sources, each allowed to fail alone: the Help Center's function being down must
    // not hide the dashboard saves, and the other way round. Releases are this build's own
    // list, in a chunk of their own so no other page carries them.
    const refresh = useCallback(async () => {
        const [u, b, r] = await Promise.allSettled([listDashboardUpdates(), fetchBugLog(), import("@/lib/portal-releases").then((m) => m.RELEASES)]);
        if (u.status === "fulfilled") setUpdates(u.value);
        setError(u.status === "rejected" ? messageOf(u.reason, "Couldn't load the dashboard updates.") : "");
        if (b.status === "fulfilled") setBugLog({ bugs: b.value.bugs ?? [], events: b.value.events ?? [] });
        setBugError(b.status === "rejected" ? messageOf(b.reason, "Couldn't load the bug reports.") : "");
        if (r.status === "fulfilled") setReleases(r.value);
        setLoading(false);
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    // Re-read when the tab comes back to the front. This page is read while colleagues are
    // still working, so coming back to it should show their last hour, not the state it had
    // when it was opened. No interval: the feed is not urgent enough to poll all day.
    useEffect(() => {
        const onFocus = () => void refresh();
        window.addEventListener("focus", onFocus);
        return () => window.removeEventListener("focus", onFocus);
    }, [refresh]);

    const entries = useMemo(() => buildFeed(updates, releases, bugLog.bugs, bugLog.events), [updates, releases, bugLog]);

    /** Everyone who appears in the feed, most active first. */
    const people = useMemo(() => {
        const by = new Map<string, { key: string; name: string; count: number }>();
        for (const e of entries) {
            const row = by.get(e.who.key) ?? { key: e.who.key, name: e.who.name, count: 0 };
            row.count += 1;
            by.set(e.who.key, row);
        }
        return [...by.values()].sort((a, b) => b.count - a.count);
    }, [entries]);

    /** Every client touched, most recently first (the feed is already newest-first). */
    const clients = useMemo(() => {
        const by = new Map<string, { slug: string; name: string }>();
        for (const e of entries) if (e.client && !by.has(e.client.slug)) by.set(e.client.slug, e.client);
        return [...by.values()];
    }, [entries]);

    const filtered = useMemo(() => filterFeed(entries, { type, who, client: which }), [entries, type, who, which]);

    /** Filtered entries in calendar-day buckets, newest day first. */
    const days = useMemo(() => {
        const out: { key: string; label: string; items: LogEntry[] }[] = [];
        for (const e of filtered) {
            const key = dayKey(e.at);
            const last = out[out.length - 1];
            if (last && last.key === key) last.items.push(e);
            else out.push({ key, label: dayLabel(e.at), items: [e] });
        }
        return out;
    }, [filtered]);

    const todayCount = days[0]?.label === "Today" ? days[0].items.length : 0;
    const todayPeople = days[0]?.label === "Today" ? new Set(days[0].items.map((e) => e.who.key)).size : 0;

    const changes = (n: number) => `${n} change${n === 1 ? "" : "s"}`;
    const typeItems = [
        { id: ALL, label: "Everything", supportingText: changes(entries.length) },
        ...LOG_TYPES.map((t) => ({ id: t.id, label: t.label, supportingText: changes(entries.filter((e) => e.type === t.id).length) })),
    ];
    const peopleItems = [
        { id: ALL, label: "Everyone", supportingText: changes(entries.length) },
        ...people.map((p) => ({ id: p.key, label: p.name, supportingText: changes(p.count) })),
    ];
    const clientItems = [
        { id: ALL, label: "All clients", supportingText: `${clients.length} dashboard${clients.length === 1 ? "" : "s"}` },
        ...clients.map((c) => ({ id: c.slug, label: c.name, supportingText: c.slug })),
    ];
    const filtering = type !== ALL || who !== ALL || which !== ALL;

    return (
        <AppShell
            className="flex flex-col"
            rail={!navCollapsed && <IconRail activeDept="clients" bottom={<RailBottom />} />}
            breadcrumb={[
                { label: "Dashboard", to: "/dashboard", icon: LayoutAlt01 },
                { label: "Clients", to: "/dashboard?dept=clients", icon: Users01 },
                { label: "Change log" },
            ]}
        >
            {navCollapsed && <CollapsedTopBar title="Change log" onExpand={toggleNav} />}

            <div className="min-h-0 flex-1 overflow-y-auto bg-secondary p-2">
                <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
                    <header>
                        <h1 className="text-display-xs font-semibold text-primary">Portal change log</h1>
                        <p className="mt-2 max-w-2xl text-sm text-pretty text-tertiary">
                            Every save on a client dashboard, every release of the portal, and every problem the team reported on a portal page, with who did
                            it. Written automatically as people work, so you can see what changed today without going to look for it.
                        </p>
                        <p className="mt-3 text-sm text-secondary">
                            {loading ? (
                                "Loading…"
                            ) : todayCount ? (
                                <>
                                    <span className="font-semibold text-primary">{changes(todayCount)}</span> today, from {todayPeople}{" "}
                                    {todayPeople === 1 ? "person" : "people"}.
                                </>
                            ) : (
                                "Nothing changed yet today."
                            )}
                        </p>
                    </header>

                    {/* ── Filters ── */}
                    <section className="mt-6 rounded-2xl bg-primary p-5 ring-1 ring-secondary">
                        <div className="grid gap-4 sm:grid-cols-3">
                            <Select
                                label="Type"
                                placeholder="Everything"
                                items={typeItems}
                                selectedKey={type}
                                onSelectionChange={(k) => setType((k ?? ALL) as LogFilters["type"])}
                            >
                                {(item) => (
                                    <Select.Item id={item.id} supportingText={item.supportingText}>
                                        {item.label}
                                    </Select.Item>
                                )}
                            </Select>

                            <Select
                                label="Who"
                                placeholder="Everyone"
                                items={peopleItems}
                                selectedKey={who}
                                onSelectionChange={(k) => setWho(String(k ?? ALL))}
                            >
                                {(item) => (
                                    <Select.Item id={item.id} supportingText={item.supportingText}>
                                        {item.label}
                                    </Select.Item>
                                )}
                            </Select>

                            <Select
                                label="Client"
                                placeholder="All clients"
                                items={clientItems}
                                selectedKey={which}
                                onSelectionChange={(k) => setWhich(String(k ?? ALL))}
                            >
                                {(item) => (
                                    <Select.Item id={item.id} supportingText={item.supportingText}>
                                        {item.label}
                                    </Select.Item>
                                )}
                            </Select>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-3">
                            <Button size="sm" color="secondary" iconLeading={RefreshCw01} onClick={() => void refresh()}>
                                Refresh
                            </Button>
                            {filtering && (
                                <Button
                                    size="sm"
                                    color="tertiary"
                                    onClick={() => {
                                        setType(ALL);
                                        setWho(ALL);
                                        setWhich(ALL);
                                    }}
                                >
                                    Clear filters
                                </Button>
                            )}
                            <span className="text-xs text-quaternary">
                                {filtered.length} of {entries.length} shown
                            </span>
                        </div>
                    </section>

                    {[error && `Dashboard updates: ${error}`, bugError && `Bugs: ${bugError}`].filter(Boolean).map((msg) => (
                        <p key={msg} className="mt-6 flex items-start gap-2 rounded-xl bg-error-primary p-4 text-sm text-error-primary ring-1 ring-error">
                            <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                            {msg}
                        </p>
                    ))}

                    {/* ── The feed ── */}
                    {!loading && !error && !filtered.length && (
                        <div className="mt-6 rounded-2xl bg-primary p-10 text-center ring-1 ring-secondary">
                            <Rocket02 className="mx-auto size-6 text-fg-quaternary" aria-hidden="true" />
                            <p className="mt-3 text-sm font-medium text-secondary">{entries.length ? "Nothing matches those filters." : "Nothing recorded yet."}</p>
                            <p className="mx-auto mt-1 max-w-md text-sm text-pretty text-tertiary">
                                {type === "release" && !releases.length
                                    ? "This build was made without its git history, so it has no releases to list."
                                    : entries.length
                                      ? "Try clearing them. The log keeps the latest 300 dashboard updates and releases, and 100 bug reports."
                                      : "The next time anyone saves a client dashboard, ships a change or reports a problem, it shows up here with their name on it."}
                            </p>
                        </div>
                    )}

                    {days.map((day) => (
                        <section key={day.key} className="mt-8">
                            <div className="flex items-center gap-3">
                                <h2 className={cx("text-sm font-semibold", day.label === "Today" ? "text-brand-secondary" : "text-secondary")}>{day.label}</h2>
                                <span className="text-xs text-quaternary">{changes(day.items.length)}</span>
                                <span className="h-px flex-1 bg-border-secondary" aria-hidden="true" />
                            </div>

                            <ul className="mt-3 flex flex-col gap-2">
                                {day.items.map((e) => (
                                    <Entry key={e.key} entry={e} showClient={which === ALL} />
                                ))}
                            </ul>
                        </section>
                    ))}
                </div>
            </div>
        </AppShell>
    );
};

export const LogScreen = () => {
    const { user, loading } = useAuthUser();
    const isTeam = !!user?.email && user.email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`);

    // Render nothing until the session resolves: flashing the sign-in card at someone who is
    // already signed in reads as being logged out.
    if (loading) return null;
    if (!isTeam) return <SignInGate email={user?.email} />;
    return <Feed />;
};
