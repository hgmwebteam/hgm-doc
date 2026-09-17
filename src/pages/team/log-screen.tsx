import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock, LayoutAlt01, LinkExternal01, RefreshCw01, Rocket02, Users01, XCircle } from "@untitledui/icons";
import { AppShell, CollapsedTopBar, IconRail, RailBottom, useNavCollapsed } from "@/components/application/icon-rail";
import { SignInBackdrop } from "@/components/application/sign-in-backdrop";
import { Avatar } from "@/components/base/avatar/avatar";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Select } from "@/components/base/select/select";
import { useAuthUser } from "@/hooks/use-auth-user";
import { type DashboardUpdate, listDashboardUpdates } from "@/lib/dashboard-updates";
import { supabase } from "@/lib/supabase";
import { cx } from "@/utils/cx";

/**
 * /log — who changed what on which client dashboard, newest first.
 *
 * The page exists to answer one question the team asked every morning: what did anyone else
 * change yesterday? A client dashboard is worked on by whoever is free — an AM in the
 * morning, the web team that afternoon — and nothing recorded it, so the only way to find
 * out was to open the dashboard and try to spot the difference.
 *
 * Read-only by design. Entries are written by the dashboard itself as people save (see
 * src/lib/dashboard-updates.ts); nothing on this page can add, edit or remove one. A feed
 * you can write by hand is a feed you can't trust.
 */

const ALLOWED_DOMAIN = "hiddengem.media";
const ALL = "__all__";

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

                <h1 className="mt-6 text-lg font-semibold text-primary">Dashboard updates</h1>
                <p className="mt-1 text-sm text-tertiary">
                    {wrongAccount ? (
                        <>
                            You're signed in as <span className="font-medium text-secondary">{email}</span>. This is the team's record of who changed what on
                            client dashboards, so it's limited to <span className="font-medium text-secondary">@{ALLOWED_DOMAIN}</span> accounts.
                        </>
                    ) : (
                        <>
                            Sign in with your <span className="font-medium text-secondary">@{ALLOWED_DOMAIN}</span> Google account to see what everyone has
                            changed on the client dashboards.
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

const UpdateRow = ({ update, showClient }: { update: DashboardUpdate; showClient: boolean }) => {
    const client = update.client_name.trim() || update.slug;
    // Fields are the detail under the section badges — "Colours, Fonts". Sections with no
    // breakdown (the access keys, plain links) contribute nothing rather than an empty pair
    // of brackets.
    const fieldLine = update.detail
        .filter((d) => d.fields.length)
        .map((d) => `${d.section}: ${d.fields.join(", ")}`)
        .join("  ·  ");

    return (
        <li className="flex gap-3 rounded-xl bg-primary p-4 ring-1 ring-secondary">
            <Avatar
                size="md"
                src={update.author_avatar || undefined}
                alt={update.author_name}
                initials={initialsOf(update.author_name)}
                className="mt-0.5 shrink-0"
            />

            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="text-sm font-semibold text-primary">{update.author_name}</span>
                    <span className="text-sm text-tertiary">
                        {update.kind === "publish" ? "published to" : "updated"}
                        {showClient && <span className="font-medium text-secondary"> {client}</span>}
                    </span>
                    <span className="ml-auto flex shrink-0 items-center gap-1.5 text-xs text-quaternary">
                        <Clock className="size-3.5" aria-hidden="true" />
                        {fmtTime(update.created_at)}
                    </span>
                </div>

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
            </div>

            <Button href={`/${update.slug}`} color="link-color" size="sm" iconTrailing={LinkExternal01} className="mt-0.5 shrink-0 self-start">
                Open
            </Button>
        </li>
    );
};

/* ── The feed ─────────────────────────────────────────────────────── */

const Feed = () => {
    const { collapsed: navCollapsed, toggle: toggleNav } = useNavCollapsed();
    const [updates, setUpdates] = useState<DashboardUpdate[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [who, setWho] = useState<string>(ALL);
    const [which, setWhich] = useState<string>(ALL);

    const refresh = useCallback(async () => {
        try {
            setUpdates(await listDashboardUpdates());
            setError("");
        } catch (err) {
            // Supabase rejects with a plain object carrying `message`, not an Error, so the
            // usual instanceof check would swallow the one useful part ("permission denied
            // for table dashboard_updates" — the case most worth naming).
            const msg =
                err && typeof err === "object" && typeof (err as { message?: unknown }).message === "string"
                    ? (err as { message: string }).message
                    : "Couldn't load the feed.";
            setError(msg);
        } finally {
            setLoading(false);
        }
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

    /** Everyone who appears in the feed, most active first. */
    const people = useMemo(() => {
        const by = new Map<string, { email: string; name: string; count: number }>();
        for (const u of updates) {
            const row = by.get(u.author_email) ?? { email: u.author_email, name: u.author_name, count: 0 };
            row.count += 1;
            by.set(u.author_email, row);
        }
        return [...by.values()].sort((a, b) => b.count - a.count);
    }, [updates]);

    /** Every client touched, most recently first (the feed is already newest-first). */
    const clients = useMemo(() => {
        const by = new Map<string, { slug: string; name: string; count: number }>();
        for (const u of updates) {
            const row = by.get(u.slug) ?? { slug: u.slug, name: u.client_name.trim() || u.slug, count: 0 };
            row.count += 1;
            by.set(u.slug, row);
        }
        return [...by.values()];
    }, [updates]);

    const filtered = useMemo(
        () => updates.filter((u) => (who === ALL || u.author_email === who) && (which === ALL || u.slug === which)),
        [updates, who, which],
    );

    /** Filtered entries in calendar-day buckets, newest day first. */
    const days = useMemo(() => {
        const out: { key: string; label: string; items: DashboardUpdate[] }[] = [];
        for (const u of filtered) {
            const key = dayKey(u.created_at);
            const last = out[out.length - 1];
            if (last && last.key === key) last.items.push(u);
            else out.push({ key, label: dayLabel(u.created_at), items: [u] });
        }
        return out;
    }, [filtered]);

    const todayCount = days[0]?.label === "Today" ? days[0].items.length : 0;
    const todayPeople = days[0]?.label === "Today" ? new Set(days[0].items.map((u) => u.author_email)).size : 0;

    const peopleItems = [
        { id: ALL, label: "Everyone", supportingText: `${updates.length} update${updates.length === 1 ? "" : "s"}` },
        ...people.map((p) => ({ id: p.email, label: p.name, supportingText: `${p.count} update${p.count === 1 ? "" : "s"}` })),
    ];
    const clientItems = [
        { id: ALL, label: "All clients", supportingText: `${clients.length} dashboard${clients.length === 1 ? "" : "s"}` },
        ...clients.map((c) => ({ id: c.slug, label: c.name, supportingText: c.slug })),
    ];

    return (
        <AppShell
            className="flex flex-col"
            rail={!navCollapsed && <IconRail activeDept="clients" bottom={<RailBottom />} />}
            breadcrumb={[
                { label: "Dashboard", to: "/dashboard", icon: LayoutAlt01 },
                { label: "Clients", to: "/dashboard?dept=clients", icon: Users01 },
                { label: "Dashboard updates" },
            ]}
        >
            {navCollapsed && <CollapsedTopBar title="Dashboard updates" onExpand={toggleNav} />}

            <div className="min-h-0 flex-1 overflow-y-auto bg-secondary p-2">
                <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
                    <header>
                        <h1 className="text-display-xs font-semibold text-primary">Dashboard updates</h1>
                        <p className="mt-2 max-w-2xl text-sm text-pretty text-tertiary">
                            Every save on a client dashboard, and who made it. Written automatically as people work, so you can see what a colleague changed
                            today without opening the dashboard to look for it.
                        </p>
                        <p className="mt-3 text-sm text-secondary">
                            {loading ? (
                                "Loading…"
                            ) : todayCount ? (
                                <>
                                    <span className="font-semibold text-primary">
                                        {todayCount} update{todayCount === 1 ? "" : "s"}
                                    </span>{" "}
                                    today, from {todayPeople} {todayPeople === 1 ? "person" : "people"}.
                                </>
                            ) : (
                                "Nothing saved yet today."
                            )}
                        </p>
                    </header>

                    {/* ── Filters ── */}
                    <section className="mt-6 rounded-2xl bg-primary p-5 ring-1 ring-secondary">
                        <div className="grid gap-4 sm:grid-cols-2">
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
                            {(who !== ALL || which !== ALL) && (
                                <Button
                                    size="sm"
                                    color="tertiary"
                                    onClick={() => {
                                        setWho(ALL);
                                        setWhich(ALL);
                                    }}
                                >
                                    Clear filters
                                </Button>
                            )}
                            <span className="text-xs text-quaternary">
                                {filtered.length} of {updates.length} shown
                            </span>
                        </div>
                    </section>

                    {error && (
                        <p className="mt-6 flex items-start gap-2 rounded-xl bg-error-primary p-4 text-sm text-error-primary ring-1 ring-error">
                            <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                            {error}
                        </p>
                    )}

                    {/* ── The feed ── */}
                    {!loading && !error && !filtered.length && (
                        <div className="mt-6 rounded-2xl bg-primary p-10 text-center ring-1 ring-secondary">
                            <Rocket02 className="mx-auto size-6 text-fg-quaternary" aria-hidden="true" />
                            <p className="mt-3 text-sm font-medium text-secondary">
                                {updates.length ? "Nothing matches those filters." : "No dashboard updates recorded yet."}
                            </p>
                            <p className="mx-auto mt-1 max-w-md text-sm text-pretty text-tertiary">
                                {updates.length
                                    ? "Try clearing them — the feed holds the last 300 updates."
                                    : "The next time anyone presses Save on a client dashboard, it shows up here with their name on it."}
                            </p>
                        </div>
                    )}

                    {days.map((day) => (
                        <section key={day.key} className="mt-8">
                            <div className="flex items-center gap-3">
                                <h2 className={cx("text-sm font-semibold", day.label === "Today" ? "text-brand-secondary" : "text-secondary")}>{day.label}</h2>
                                <span className="text-xs text-quaternary">
                                    {day.items.length} update{day.items.length === 1 ? "" : "s"}
                                </span>
                                <span className="h-px flex-1 bg-border-secondary" aria-hidden="true" />
                            </div>

                            <ul className="mt-3 flex flex-col gap-2">
                                {day.items.map((u) => (
                                    <UpdateRow key={u.id} update={u} showClient={which === ALL} />
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
