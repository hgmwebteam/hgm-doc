import { type FC, type ReactNode, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, CheckCircle, HelpCircle, Home02, MessageChatSquare, Plus, Rocket02, Users01 } from "@untitledui/icons";
import { animate, motion } from "motion/react";
import { useNavigate } from "react-router";
import { AppShell, CollapsedTopBar, HeaderAvatar, IconRail, RailBottom, useNavCollapsed } from "@/components/application/icon-rail";
import { FeedItem } from "@/components/application/activity-feed/activity-feed";
import { Avatar } from "@/components/base/avatar/avatar";
import type { BadgeColors } from "@/components/base/badges/badge-types";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { ProgressBarBase } from "@/components/base/progress-indicators/progress-indicators";
import { FeaturedIcon } from "@/components/foundations/featured-icon/featured-icon";
import { setViewAs, useTeamRole } from "@/hooks/use-team-role";
import type { DashboardUpdate } from "@/lib/dashboard-updates";
import { type ClientRecord, supabase } from "@/lib/supabase";
import { ACCOUNT_MANAGERS, clientForSlug, isAmClient, teamRoleOf } from "@/lib/team-roster";
import { fetchAllTickets } from "@/pages/client/help/help-api";
import { STATUS_META, type Ticket, isOpen } from "@/pages/client/help/help-model";
import { isFlowFeedbackKey, isLandingFeedbackKey, isReelsFeedbackKey, isStoriesFeedbackKey } from "@/pages/client/dashboard/suggestions-model";
import { ONBOARDING_PHASES, TeamGate } from "@/pages/team/dashboard-screen";
import { cx } from "@/utils/cx";
import { teamPhoto } from "@/utils/team-photos";

/**
 * /home — "Mission Control": the team's landing view, computed live from the Client
 * List table (`clients`) so it can never drift from the dashboard. Team-gated (same
 * gate + unlock flag as /dashboard). Opened from the HOME icon at the top of the rail.
 *
 * Kept deliberately short — four blocks, nothing an AM has to decode:
 *   1. greeting, then one joined stat strip
 *   2. onboarding clients (logo, phase) beside "Needs attention": client edits on
 *      dashboards and open Help Centre requests (ticket-list-all) in one list
 *   3. the last five team saves from `dashboard_updates` (the full feed is /log)
 *   4. for the Operations Manager and the owner: one card per Account Manager
 * Tiers and Web Team projects live on the Client List and the Website dept, not here.
 *
 * Personal per signed-in teammate (lib/team-roster.ts teamRoleOf; the owner can preview
 * anyone through hooks/use-team-role.ts):
 *  - an Account Manager sees only their own clients, updates and activity
 *  - the open-questions and roster chips are the owner's project work, so only the owner
 */

/* ── Data helpers ────────────────────────────────────────────────── */

/** Lifecycle bucket — anything unset/unknown counts as an existing client. */
const statusOf = (c: ClientRecord): "existing" | "onboarding" | "offboarding" =>
    c.status === "onboarding" || c.status === "offboarding" ? c.status : "existing";

/** Log pages whose open questions feed the header chip (same set as /questions). */
const QUESTION_SLUGS = [
    "roadmap",
    "welcome-email-flow-overview",
    "client-dashboard-overview",
    "chat-widget-overview",
    "owner-guide-overview",
    "homepage-overview",
];

const DAY = 864e5;

type PendingRow = { id: string; slug: string; field_key: string; field_label: string; suggested_value: string; suggested_by: string; created_at: string };

/** Which part of the client dashboard a suggestion belongs to, and its anchor there (same anchors as lib/notifications.ts). */
const sectionOf = (key: string): { label: string; anchor: string } =>
    isFlowFeedbackKey(key)
        ? { label: "Welcome email comment", anchor: "flow" }
        : isLandingFeedbackKey(key)
          ? { label: "Landing page comment", anchor: "landing" }
          : isReelsFeedbackKey(key)
            ? { label: "Example reels comment", anchor: "reels" }
            : isStoriesFeedbackKey(key)
              ? { label: "Pinned stories comment", anchor: "pinnedstories" }
              : { label: "Brand doc edit", anchor: "foundation" };

type FeedRow = Pick<
    DashboardUpdate,
    "id" | "slug" | "client_name" | "author_email" | "author_name" | "author_avatar" | "kind" | "sections" | "summary" | "created_at"
>;

const initialsOf = (name: string) =>
    name
        .split(" ")
        .map((w) => w[0]?.toUpperCase() ?? "")
        .slice(0, 2)
        .join("");

/** "3h ago" / "2d ago" — coarse on purpose; the exact time is in the /log feed. */
export const ago = (iso: string) => {
    const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
    return `${Math.round(mins / 1440)}d ago`;
};

/** Badge colour per kind of item: edits brand, comments purple, Help Centre requests warning. */
const kindColor = (kind: string): BadgeColors => (kind.startsWith("Request") ? "warning" : kind.includes("comment") ? "purple" : "brand");

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/* ── Small pieces ────────────────────────────────────────────────── */

/** Animated integer — counts up on mount/refresh (kept subtle and fast). */
const CountUp = ({ value }: { value: number }) => {
    const [display, setDisplay] = useState(0);
    useEffect(() => {
        const controls = animate(0, value, { duration: 0.8, ease: "easeOut", onUpdate: (v) => setDisplay(Math.round(v)) });
        return () => controls.stop();
    }, [value]);
    return <>{display}</>;
};

const rise = (i: number) => ({
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: 0.05 * i, duration: 0.3, ease: "easeOut" as const },
});

/** One cell of the joined stat strip. */
export const Stat = ({ label, value, note, dot, onClick }: { label: string; value: number; note: string; dot: string; onClick: () => void }) => (
    <button
        type="button"
        onClick={onClick}
        className="group flex flex-col gap-1 px-5 py-4 text-left transition duration-100 ease-linear hover:!bg-primary_hover sm:px-6 sm:py-5"
    >
        <span className="flex items-center gap-2 text-sm font-medium text-tertiary">
            <span className={cx("size-2 rounded-full", dot)} aria-hidden="true" />
            {label}
        </span>
        <span className="text-display-sm font-semibold tracking-tight text-primary tabular-nums">
            <CountUp value={value} />
        </span>
        <span className="text-xs text-quaternary">{note}</span>
    </button>
);

/** Card shell shared by every block below the stat strip. */
export const Card = ({
    title,
    icon,
    badge,
    action,
    index,
    className,
    children,
}: {
    title: string;
    icon: FC<{ className?: string }>;
    badge?: ReactNode;
    action?: { label: string; onClick: () => void };
    index: number;
    className?: string;
    children: ReactNode;
}) => (
    <motion.section {...rise(index)} className={cx("flex flex-col rounded-2xl bg-primary p-5 shadow-xs ring-1 ring-secondary", className)}>
        <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-3 text-md font-semibold text-primary">
                <FeaturedIcon icon={icon} size="sm" color="gray" theme="modern" />
                {title}
                {badge}
            </h2>
            {action && (
                <Button color="link-color" size="sm" iconTrailing={ArrowUpRight} onClick={action.onClick}>
                    {action.label}
                </Button>
            )}
        </div>
        <div className="mt-5 flex flex-1 flex-col">{children}</div>
    </motion.section>
);

const CountPill = ({ n, tone = "gray" }: { n: number; tone?: "gray" | "brand" | "warning" }) => (
    <Badge type="pill-color" size="sm" color={tone}>
        {n}
    </Badge>
);

/** A client's own logo (clients.logo_url, a compressed data URL), or its initials. */
export const ClientLogo = ({ name, src, size = "md" }: { name: string; src?: string | null; size?: "sm" | "md" }) => (
    <span
        className={cx(
            "flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary ring-1 ring-secondary",
            size === "md" ? "size-10" : "size-8",
        )}
    >
        {src ? (
            <img src={src} alt="" className="size-full object-contain p-1" />
        ) : (
            <span className="text-xs font-semibold text-tertiary">{initialsOf(name)}</span>
        )}
    </span>
);

/* ── Page ────────────────────────────────────────────────────────── */

const HomeContent = () => {
    const navigate = useNavigate();
    const { role, viewAs, displayName } = useTeamRole();
    const { collapsed: navCollapsed, toggle: toggleNav } = useNavCollapsed();
    const amName = role.kind === "am" ? role.amName : null;
    const isOwner = role.kind === "owner";
    const seesTeam = role.kind === "ops" || isOwner;
    const [allClients, setClients] = useState<ClientRecord[] | null>(null);
    // Mission Control is business reporting — private/template clients (private_to
    // set, e.g. HGM TEST) never appear here or count here, not even for their owner.
    const companyClients = useMemo(() => (allClients === null ? null : allClients.filter((c) => !c.private_to)), [allClients]);
    // An AM's home is their own book of clients.
    const clients = useMemo(
        () => (companyClients === null || !amName ? companyClients : companyClients.filter((c) => isAmClient(c.am, amName))),
        [companyClients, amName],
    );
    const [openQuestions, setOpenQuestions] = useState<number | null>(null);
    const [rosterCount, setRosterCount] = useState<number | null>(null);
    const [pending, setPending] = useState<PendingRow[]>([]);
    const [feed, setFeed] = useState<FeedRow[]>([]);
    // Open Help Centre requests; null while loading, "error" when the function is unreachable.
    const [tickets, setTickets] = useState<Ticket[] | null | "error">(null);

    useEffect(() => {
        // Everything but cover_url: Home never shows covers, and each is a ~100KB data URL.
        supabase
            .from("clients")
            .select("id, name, tier, am, location, logo_url, handle, link, starred, created_at, status, onboarding_phase, web_project, web_manager, marketing_assistant, private_to")
            .then(({ data, error }) => setClients(!error && data ? (data as ClientRecord[]) : []));

        // Client edits and comments awaiting the team — the "updates from clients".
        supabase
            .from("dashboard_suggestions")
            .select("id, slug, field_key, field_label, suggested_value, suggested_by, created_at")
            .eq("status", "pending")
            .then(({ data, error }) => !error && data && setPending(data as PendingRow[]));

        // The team's dashboard saves over the last week: the activity feed and the AM cards.
        supabase
            .from("dashboard_updates")
            .select("id, slug, client_name, author_email, author_name, author_avatar, kind, sections, summary, created_at")
            .gte("created_at", new Date(Date.now() - 7 * DAY).toISOString())
            .order("created_at", { ascending: false })
            .then(({ data, error }) => !error && data && setFeed(data as FeedRow[]));

        // Newest 200 requests across every client (staff-only function); open ones are kept below.
        fetchAllTickets()
            .then((res) => setTickets(res.tickets.filter(isOpen)))
            .catch(() => setTickets("error"));

        // One query feeds both the open-questions chip and the roster size
        // (the 47-client list recorded on /homepage-overview).
        supabase
            .from("sop_pages")
            .select("slug, data")
            .in("slug", QUESTION_SLUGS)
            .then(({ data, error }) => {
                if (error || !data) return;
                type QA = { answer?: string; resolved?: boolean };
                let open = 0;
                for (const row of data) {
                    const qs = (row.data?.questions ?? []) as QA[];
                    open += qs.filter((q) => !(q.resolved ?? !!(q.answer || "").trim())).length;
                    if (row.slug === "homepage-overview" && Array.isArray(row.data?.clients)) setRosterCount(row.data.clients.length);
                }
                setOpenQuestions(open);
            });
    }, []);

    /* Derived — everything computes from the Client List rows. */
    const list = clients ?? [];
    const total = list.length;
    const existing = list.filter((c) => statusOf(c) === "existing").length;
    const onboarding = list.filter((c) => statusOf(c) === "onboarding").length;
    const offboarding = list.filter((c) => statusOf(c) === "offboarding").length;
    const pct = (n: number) => (total ? `${Math.round((n / total) * 100)}% of ${amName ? "your book" : "clients"}` : "—");

    // Onboarding clients with no phase filed land in Phase 0 (Signing On).
    const phases = ONBOARDING_PHASES.map((p, i) => ({
        ...p,
        n: i,
        clients: list.filter((c) => statusOf(c) === "onboarding" && (c.onboarding_phase ?? 0) === i),
    }));

    // Pending client updates, per client on this home (an AM's own; everyone else's all).
    // A dashboard with no Client List row can't be placed, so it only counts for non-AMs.
    const updateRows = (() => {
        const bySlug = new Map<string, { slug: string; name: string; count: number; latest: string; am?: string }>();
        for (const p of pending) {
            const client = clientForSlug(list, p.slug);
            if (amName && !client) continue;
            const row = bySlug.get(p.slug) ?? { slug: p.slug, name: client?.name ?? p.slug.replace(/-dashboard$/, ""), count: 0, latest: "", am: client?.am };
            row.count++;
            if (p.created_at > row.latest) row.latest = p.created_at;
            bySlug.set(p.slug, row);
        }
        return [...bySlug.values()].sort((a, b) => b.latest.localeCompare(a.latest));
    })();
    const updateTotal = updateRows.reduce((n, r) => n + r.count, 0);

    // Open requests on this home's clients: the ticket names its AM; fall back to the client row.
    const requests =
        tickets === null || tickets === "error"
            ? tickets
            : tickets.filter(
                  (t) =>
                      !amName ||
                      isAmClient(t.account_manager_name, amName) ||
                      isAmClient(clientForSlug(list, t.client_slug ?? "")?.am, amName),
              );

    const onboardingClients = phases.flatMap((p) => p.clients.map((c) => ({ c, p })));

    // "Needs attention", grouped by client: each client edit or comment on their dashboard
    // (what was asked, by whom, linked to its section), then each open Help Centre request.
    const attention = (() => {
        type Item = { key: string; kind: string; text: string; who: string; at: string; to: string; tag?: string; due?: string | null };
        type Group = { key: string; client: string; logo?: string | null; am?: string; to: string; latest: string; items: Item[] };
        const groups = new Map<string, Group>();
        const groupFor = (slug: string, fallbackName: string, to: string): Group | null => {
            const client = clientForSlug(list, slug);
            if (amName && !client) return null;
            const g = groups.get(slug) ?? { key: slug, client: client?.name ?? fallbackName, logo: client?.logo_url, am: client?.am, to, latest: "", items: [] };
            groups.set(slug, g);
            return g;
        };
        for (const p of pending) {
            const g = groupFor(p.slug, p.slug.replace(/-dashboard$/, ""), `/${p.slug}`);
            if (!g) continue;
            const where = sectionOf(p.field_key);
            g.items.push({
                key: p.id,
                kind: where.anchor === "foundation" && p.field_label ? `${where.label} · ${p.field_label}` : where.label,
                text: p.suggested_value,
                who: (p.suggested_by ?? "").split("@")[0],
                at: p.created_at,
                to: `/${p.slug}#${where.anchor}`,
            });
        }
        for (const t of Array.isArray(requests) ? requests : []) {
            const slug = t.client_slug ?? "";
            const g = groupFor(slug, t.client_name || slug.replace(/-dashboard$/, ""), "/team/tickets");
            if (!g) continue;
            g.items.push({
                key: t.id,
                kind: `Request${t.topic ? ` · ${t.topic}` : ""}`,
                text: t.title,
                who: t.submitted_by_name || (t.submitted_by ?? "").split("@")[0],
                at: t.created_at,
                to: "/team/tickets",
                tag: STATUS_META[t.status].label,
                due: t.needed_by,
            });
        }
        for (const g of groups.values()) {
            g.items.sort((a, b) => b.at.localeCompare(a.at));
            g.latest = g.items[0]?.at ?? "";
        }
        return [...groups.values()].sort((a, b) => b.latest.localeCompare(a.latest));
    })();
    const attentionTotal = attention.reduce((n, g) => n + g.items.length, 0);
    // Flattened newest-first for the feed; each entry carries its client so it reads on its own.
    const attentionItems = attention
        .flatMap((g) => g.items.map((it) => ({ ...it, client: g.client, logo: g.logo, am: g.am, color: kindColor(it.kind) })))
        .sort((a, b) => b.at.localeCompare(a.at));

    // Activity: an AM sees saves on their own clients (by anyone) and their own saves.
    const amOf = (r: { author_email: string; author_name: string }) => {
        const role = teamRoleOf({ email: r.author_email, name: r.author_name });
        return role.kind === "am" ? role.amName : null;
    };
    const myFeed = amName ? feed.filter((r) => amOf(r) === amName || !!clientForSlug(list, r.slug)) : feed;
    // One card per Account Manager: their book, what's waiting on them, and their week.
    const startOfToday = new Date().setHours(0, 0, 0, 0);
    const team = seesTeam
        ? ACCOUNT_MANAGERS.map((am) => {
              const mine = list.filter((c) => isAmClient(c.am, am));
              const theirSaves = feed.filter((r) => amOf(r) === am);
              // Saves per day, oldest → today, for the 7-bar sparkline.
              const days = Array.from({ length: 7 }, (_, i) => {
                  const from = startOfToday - (6 - i) * DAY;
                  return theirSaves.filter((r) => {
                      const t = new Date(r.created_at).getTime();
                      return t >= from && t < from + DAY;
                  }).length;
              });
              return {
                  am,
                  clients: mine.length,
                  onboarding: mine.filter((c) => statusOf(c) === "onboarding").length,
                  waiting: pending.filter((p) => isAmClient(clientForSlug(mine, p.slug)?.am, am)).length,
                  saves: theirSaves.length,
                  days,
                  last: theirSaves[0]?.created_at ?? "",
              };
          })
        : [];
    const maxDay = Math.max(1, ...team.flatMap((t) => t.days));

    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    const firstName = displayName.split(" ")[0];
    const dateStr = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date());
    const subline = amName
        ? updateTotal > 0
            ? `${plural(updateTotal, "client update")} waiting on you.`
            : "Your clients are all caught up."
        : "Here's Hidden Gem Media at a glance.";

    const goClients = () => navigate("/dashboard?dept=clients");

    return (
        <AppShell
            className="flex flex-col"
            rail={!navCollapsed && <IconRail activeDept="home" bottom={<RailBottom editing={false} onToggleEditing={() => {}} />} />}
            breadcrumb={[{ label: "Home", icon: Home02 }]}
            headerRight={<HeaderAvatar />}
        >
            {navCollapsed && <CollapsedTopBar title="Home" onExpand={toggleNav} />}
            <div className="flex min-h-0 flex-1 bg-secondary p-2">
                <main className="bg-secondary_subtle flex-1 overflow-y-auto rounded-lg shadow-sm">
                    <div className="mx-auto flex max-w-[1400px] flex-col gap-6 px-4 py-6 md:px-10 md:py-8">
                        {viewAs && (
                            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-warning-primary px-4 py-2.5 text-sm text-warning-primary ring-1 ring-secondary">
                                <span>
                                    Previewing as <span className="font-semibold">{viewAs}</span> — this is what they see.
                                </span>
                                <button type="button" onClick={() => setViewAs(null)} className="font-semibold underline-offset-2 hover:underline">
                                    Back to my view
                                </button>
                            </div>
                        )}

                        {/* Greeting + quick actions */}
                        <div className="flex flex-wrap items-end justify-between gap-4">
                            <div>
                                <p className="text-sm font-medium text-tertiary">{dateStr}</p>
                                <h1 className="mt-1 text-display-xs font-semibold tracking-tight text-primary md:text-display-sm">
                                    {greeting}
                                    {firstName ? `, ${firstName}` : ""}
                                </h1>
                                <p className="mt-1.5 text-md text-tertiary">{subline}</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                {isOwner && openQuestions != null && openQuestions > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => navigate("/questions")}
                                        className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-2 text-xs font-semibold text-secondary ring-1 ring-secondary transition duration-100 ease-linear hover:bg-primary_hover"
                                    >
                                        <HelpCircle className="size-3.5 text-fg-quaternary" aria-hidden="true" />
                                        {plural(openQuestions, "open question")}
                                    </button>
                                )}
                                {isOwner && rosterCount != null && clients != null && total < rosterCount && (
                                    <button
                                        type="button"
                                        onClick={goClients}
                                        title="The roster on the Homepage project page lists more clients than the Client List has filed."
                                        className="flex items-center gap-1.5 rounded-full bg-warning-primary px-3 py-2 text-xs font-semibold text-warning-primary ring-1 ring-secondary transition duration-100 ease-linear hover:opacity-80"
                                    >
                                        {total} of {rosterCount} roster clients filed
                                        <ArrowUpRight className="size-3.5" aria-hidden="true" />
                                    </button>
                                )}
                                <Button size="md" iconLeading={Plus} onClick={goClients}>
                                    New Client
                                </Button>
                            </div>
                        </div>

                        {clients == null ? (
                            <div className="flex flex-col gap-4">
                                <div className="h-28 animate-pulse rounded-2xl bg-primary ring-1 ring-secondary" />
                                <div className="grid gap-4 lg:grid-cols-3">
                                    <div className="h-72 animate-pulse rounded-2xl bg-primary ring-1 ring-secondary lg:col-span-2" />
                                    <div className="h-72 animate-pulse rounded-2xl bg-primary ring-1 ring-secondary" />
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Stat strip — one surface, four cells */}
                                <motion.div
                                    {...rise(0)}
                                    className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-border-secondary ring-1 ring-secondary lg:grid-cols-4 [&>*]:bg-primary"
                                >
                                    <Stat
                                        label={amName ? "Your clients" : "Total clients"}
                                        value={total}
                                        note={amName ? "Assigned to you" : "On the Client List"}
                                        dot="bg-brand-solid"
                                        onClick={goClients}
                                    />
                                    <Stat label="Existing" value={existing} note={pct(existing)} dot="bg-success-solid" onClick={goClients} />
                                    <Stat label="Onboarding" value={onboarding} note={pct(onboarding)} dot="bg-warning-solid" onClick={goClients} />
                                    <Stat label="Offboarding" value={offboarding} note={pct(offboarding)} dot="bg-error-solid" onClick={goClients} />
                                </motion.div>

                                <div className="grid items-start gap-4 lg:grid-cols-5">
                                    <Card
                                        title={amName ? "Your onboarding clients" : "Onboarding clients"}
                                        icon={Rocket02}
                                        badge={<CountPill n={onboarding} />}
                                        action={{ label: "Client List", onClick: goClients }}
                                        index={1}
                                        className="lg:col-span-3"
                                    >
                                        {onboardingClients.length === 0 ? (
                                            <p className="text-sm text-tertiary">No clients onboarding right now.</p>
                                        ) : (
                                            <ul className="-mx-2 flex flex-col">
                                                {onboardingClients.map(({ c, p }) => (
                                                    <li key={c.id}>
                                                        <button
                                                            type="button"
                                                            onClick={() => (c.link?.trim() ? navigate(new URL(c.link, window.location.origin).pathname) : goClients())}
                                                            className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition duration-100 ease-linear hover:bg-primary_hover"
                                                        >
                                                            <ClientLogo name={c.name} src={c.logo_url} />
                                                            <span className="min-w-0 flex-1">
                                                                <span className="block truncate text-sm font-semibold text-primary">{c.name}</span>
                                                                <span className="block truncate text-xs text-tertiary">
                                                                    {p.label}
                                                                    {!amName && c.am ? ` · ${c.am.split(" ")[0]}` : ""}
                                                                </span>
                                                            </span>
                                                            {/* Untitled UI progress bar: phases 0–5, so Phase 0 already shows a sixth */}
                                                            <span className="hidden w-28 shrink-0 sm:block" aria-label={`Phase ${p.n} of 5`} role="img">
                                                                <ProgressBarBase value={p.n + 1} max={6} />
                                                            </span>
                                                            <span className="w-14 shrink-0 text-right text-xs font-medium text-quaternary tabular-nums">Phase {p.n}</span>
                                                        </button>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </Card>

                                    <Card
                                        title="Needs attention"
                                        icon={MessageChatSquare}
                                        badge={<CountPill n={attentionTotal} tone={attentionTotal ? "brand" : "gray"} />}
                                        index={2}
                                        className="lg:col-span-2"
                                    >
                                        {attentionItems.length === 0 ? (
                                            <p className="flex items-center gap-2 text-sm text-tertiary">
                                                <CheckCircle className="size-4 shrink-0 text-fg-success-primary" aria-hidden="true" />
                                                {requests === "error" ? "No client edits waiting. Requests couldn't load." : "All caught up."}
                                            </p>
                                        ) : (
                                            <div className="flex flex-col">
                                                {/* Untitled UI PRO activity feed: one entry per thing a client asked for */}
                                                {attentionItems.slice(0, 6).map((it, i, shown) => (
                                                    <FeedItem
                                                        key={it.key}
                                                        id={it.key}
                                                        size="sm"
                                                        connector={i < shown.length - 1}
                                                        user={{ name: it.client, avatarUrl: it.logo ?? "", href: it.to }}
                                                        date={ago(it.at)}
                                                        action={{
                                                            content: [it.who && `from ${it.who}`, it.due && `needed by ${shortDate(it.due)}`, !amName && it.am && `AM ${it.am.split(" ")[0]}`]
                                                                .filter(Boolean)
                                                                .join(" · "),
                                                        }}
                                                        labels={[{ name: it.kind, color: it.color }, ...(it.tag ? [{ name: it.tag, color: "gray" as const }] : [])]}
                                                        message={it.text || undefined}
                                                    />
                                                ))}
                                                {attentionItems.length > 6 && (
                                                    <Button color="link-color" size="sm" onClick={goClients} className="mt-1 self-start">
                                                        {`+${attentionItems.length - 6} more`}
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                    </Card>
                                </div>

                                <Card title="Recent activity" icon={Users01} action={{ label: "Full log", onClick: () => navigate("/log") }} index={3}>
                                    {myFeed.length === 0 ? (
                                        <p className="text-sm text-tertiary">No dashboard saves this week.</p>
                                    ) : (
                                        <div className="flex flex-col">
                                            {myFeed.slice(0, 5).map((r, i, shown) => (
                                                <FeedItem
                                                    key={r.id}
                                                    id={r.id}
                                                    size="sm"
                                                    connector={i < shown.length - 1}
                                                    user={{
                                                        name: r.author_name || r.author_email,
                                                        avatarUrl: r.author_avatar || teamPhoto(r.author_name) || "",
                                                        href: `/${r.slug}`,
                                                    }}
                                                    date={ago(r.created_at)}
                                                    action={{
                                                        content: `${r.kind === "publish" ? "published" : "updated"} ${r.summary || r.sections.slice(0, 2).join(", ") || "the dashboard"} on`,
                                                        target: r.client_name || r.slug,
                                                        href: `/${r.slug}`,
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </Card>

                                {/* Team — the Operations Manager's view: one card per Account Manager */}
                                {seesTeam && (
                                    <motion.section {...rise(4)}>
                                        <div className="flex items-end justify-between gap-2">
                                            <div>
                                                <h2 className="text-lg font-semibold text-primary">Account Managers</h2>
                                                <p className="text-sm text-tertiary">
                                                    Each AM's book, what's waiting on them, and their dashboard saves this week.
                                                </p>
                                            </div>
                                        </div>
                                        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                            {team.map((t) => (
                                                <div key={t.am} className="flex flex-col gap-4 rounded-2xl bg-primary p-4 ring-1 ring-secondary">
                                                    <div className="flex items-center gap-3">
                                                        <Avatar size="md" src={teamPhoto(t.am)} initials={initialsOf(t.am)} alt={t.am} />
                                                        <div className="min-w-0 flex-1">
                                                            <p className="truncate text-sm font-semibold text-primary">{t.am}</p>
                                                            <p className="text-xs text-tertiary">{t.last ? `Active ${ago(t.last)}` : "No saves this week"}</p>
                                                        </div>
                                                        {t.waiting > 0 && (
                                                            <span
                                                                title={`${plural(t.waiting, "client update")} waiting`}
                                                                className="rounded-full bg-warning-secondary px-2 py-0.5 text-xs font-semibold text-warning-primary tabular-nums"
                                                            >
                                                                {t.waiting} waiting
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-end justify-between gap-3">
                                                        <dl className="flex gap-5">
                                                            <div>
                                                                <dt className="text-xs text-tertiary">Clients</dt>
                                                                <dd className="text-lg font-semibold text-primary tabular-nums">{t.clients}</dd>
                                                            </div>
                                                            <div>
                                                                <dt className="text-xs text-tertiary">Onboarding</dt>
                                                                <dd className="text-lg font-semibold text-primary tabular-nums">{t.onboarding}</dd>
                                                            </div>
                                                            <div>
                                                                <dt className="text-xs text-tertiary">Saves</dt>
                                                                <dd className="text-lg font-semibold text-primary tabular-nums">{t.saves}</dd>
                                                            </div>
                                                        </dl>
                                                        {/* Saves per day, last 7 days */}
                                                        <div
                                                            className="flex h-8 items-end gap-0.5"
                                                            aria-label={`${plural(t.saves, "save")} in the last 7 days`}
                                                            role="img"
                                                        >
                                                            {t.days.map((d, i) => (
                                                                <span
                                                                    key={i}
                                                                    className={cx("w-1.5 rounded-sm", d > 0 ? "bg-brand-solid" : "bg-quaternary")}
                                                                    style={{ height: `${d > 0 ? 25 + (d / maxDay) * 75 : 12}%` }}
                                                                />
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </motion.section>
                                )}

                                <p className="pb-2 text-center text-xs text-quaternary">
                                    Live from the Client List — file or edit clients there and these numbers follow.
                                </p>
                            </>
                        )}
                    </div>
                </main>
            </div>
        </AppShell>
    );
};

export const HomeScreen = () => (
    <TeamGate>
        <HomeContent />
    </TeamGate>
);
