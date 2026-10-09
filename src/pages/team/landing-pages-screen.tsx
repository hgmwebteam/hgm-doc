import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, Globe01, MessageChatSquare, Star01 } from "@untitledui/icons";
import { useNavigate } from "react-router";
import { AppShell, CollapsedTopBar, HeaderAvatar, IconRail, RailBottom, useNavCollapsed } from "@/components/application/icon-rail";
import type { BadgeColors } from "@/components/base/badges/badge-types";
import { Badge } from "@/components/base/badges/badges";
import { readSopPage, writeSopPage } from "@/lib/db-sync";
import { type ClientRecord, supabase } from "@/lib/supabase";
import { clientForSlug } from "@/lib/team-roster";
import { LANDING_FEEDBACK_PREFIX } from "@/pages/client/dashboard/suggestions-model";
import { TeamGate } from "@/pages/team/dashboard-screen";
import { Card, ClientLogo, Stat, ago } from "@/pages/team/home-screen";
import { cx } from "@/utils/cx";

/**
 * /landingpages — the Web Team's view of every client landing page, for whoever builds
 * them (Brandon). Read-only and computed live, so it can't drift from the dashboards:
 *   - every client dashboard (`dashboard_pages`, `{client}-dashboard`) is one row
 *   - its landing page state comes from `landing_pages` (versions + the client's review)
 *   - client comments are the pending `landingPage.*` rows in `dashboard_suggestions`
 * Clicking a row or comment opens that client's Landing Page section, where the work is done.
 * Private/test clients (clients.private_to) are left out, as on /home.
 *
 * Stars and hidden rows are the team's shared choice, so they live in `sop_pages` under
 * BOARD_SLUG, not localStorage. Hiding only takes a dashboard off this page (test clients
 * like "client test"); it never touches the dashboard itself.
 */

const BOARD_SLUG = "landing-pages-board";
type Board = { starred: string[]; hidden: string[] };
type View = "all" | "onboarding" | "starred" | "hidden";

type Stage = "build" | "review" | "changes" | "approved";

const STAGES: Record<Stage, { label: string; note: string; dot: string; color: BadgeColors }> = {
    build: { label: "To build", note: "No version published yet", dot: "bg-fg-quaternary", color: "gray" },
    review: { label: "Awaiting client", note: "Published, not reviewed", dot: "bg-warning-solid", color: "warning" },
    changes: { label: "Changes requested", note: "Client asked for edits", dot: "bg-error-solid", color: "error" },
    approved: { label: "Approved", note: "Signed off by the client", dot: "bg-success-solid", color: "success" },
};

type LandingRow = { slug: string; review: { status?: string; note?: string } | null; live_at: string | null };
type Comment = { id: string; slug: string; suggested_value: string; suggested_by: string; created_at: string };

const stageOf = (l?: LandingRow): Stage =>
    !l?.live_at ? "build" : l.review?.status === "approved" ? "approved" : l.review?.status === "changes" ? "changes" : "review";

const LandingPagesContent = () => {
    const navigate = useNavigate();
    const { collapsed: navCollapsed, toggle: toggleNav } = useNavCollapsed();
    const [dashboards, setDashboards] = useState<{ slug: string; client_name: string }[] | null>(null);
    const [landing, setLanding] = useState<LandingRow[]>([]);
    const [clients, setClients] = useState<ClientRecord[]>([]);
    const [comments, setComments] = useState<Comment[]>([]);
    const [filter, setFilter] = useState<Stage | null>(null);
    const [view, setView] = useState<View>("all");
    const [board, setBoard] = useState<Board>({ starred: [], hidden: [] });
    const [saveError, setSaveError] = useState(false);

    useEffect(() => {
        supabase
            .from("dashboard_pages")
            .select("slug, client_name")
            .like("slug", "%-dashboard")
            .then(({ data, error }) => setDashboards(!error && data ? data : []));
        // Only the review and the live version's date: a legacy version holds its full HTML inline.
        supabase
            .from("landing_pages")
            .select("slug, review:data->review, live_at:data->versions->0->>publishedAt")
            .then(({ data, error }) => !error && data && setLanding(data as unknown as LandingRow[]));
        supabase
            .from("clients")
            .select("id, name, am, logo_url, link, private_to, status")
            .then(({ data, error }) => !error && data && setClients(data as ClientRecord[]));
        supabase
            .from("dashboard_suggestions")
            .select("id, slug, suggested_value, suggested_by, created_at")
            .eq("status", "pending")
            .like("field_key", `${LANDING_FEEDBACK_PREFIX}%`)
            .order("created_at", { ascending: false })
            .then(({ data, error }) => !error && data && setComments(data as Comment[]));
        // No row yet means nothing starred or hidden.
        readSopPage(BOARD_SLUG)
            .then((row) => setBoard({ starred: row?.data?.starred ?? [], hidden: row?.data?.hidden ?? [] }))
            .catch(() => {});
    }, []);

    /** Flip one slug in the starred or hidden list and save; on failure put it back and say so. */
    const toggle = (key: keyof Board, slug: string) => {
        const before = board;
        const list = board[key];
        const next = { ...board, [key]: list.includes(slug) ? list.filter((s) => s !== slug) : [...list, slug] };
        setBoard(next);
        setSaveError(false);
        writeSopPage(BOARD_SLUG, next).catch(() => {
            setBoard(before);
            setSaveError(true);
        });
    };

    const rows = useMemo(() => {
        const bySlug = new Map(landing.map((l) => [l.slug, l]));
        return (dashboards ?? [])
            .map((d) => {
                const client = clientForSlug(clients, d.slug);
                const l = bySlug.get(d.slug);
                return {
                    slug: d.slug,
                    name: client?.name || d.client_name || d.slug.replace(/-dashboard$/, ""),
                    client,
                    stage: stageOf(l),
                    liveAt: l?.live_at ?? null,
                    changeNote: l?.review?.status === "changes" ? (l.review.note ?? "") : "",
                    comments: comments.filter((c) => c.slug === d.slug).length,
                    starred: board.starred.includes(d.slug),
                    hidden: board.hidden.includes(d.slug),
                };
            })
            .filter((r) => !r.client?.private_to)
            .sort((a, b) => Number(b.starred) - Number(a.starred) || b.comments - a.comments || (b.liveAt ?? "").localeCompare(a.liveAt ?? "") || a.name.localeCompare(b.name));
    }, [dashboards, landing, clients, comments, board]);

    // Hidden rows drop out of every count and list except the Hidden view.
    const active = rows.filter((r) => !r.hidden);
    const visibleSlugs = new Set(active.map((r) => r.slug));
    const openComments = comments.filter((c) => visibleSlugs.has(c.slug));
    const views: { id: View; label: string; rows: typeof rows }[] = [
        { id: "all", label: "All", rows: active },
        { id: "onboarding", label: "Onboarding", rows: active.filter((r) => r.client?.status === "onboarding") },
        { id: "starred", label: "Starred", rows: active.filter((r) => r.starred) },
        { id: "hidden", label: "Hidden", rows: rows.filter((r) => r.hidden) },
    ];
    const inView = views.find((v) => v.id === view)!.rows;
    const shown = filter ? inView.filter((r) => r.stage === filter) : inView;
    const nameOf = (slug: string) => rows.find((r) => r.slug === slug)?.name ?? slug;
    const open = (slug: string) => navigate(`/${slug}#landing`);

    return (
        <AppShell
            className="flex flex-col"
            rail={!navCollapsed && <IconRail activeDept="website" bottom={<RailBottom editing={false} onToggleEditing={() => {}} />} />}
            breadcrumb={[{ label: "Landing pages", icon: Globe01 }]}
            headerRight={<HeaderAvatar />}
        >
            {navCollapsed && <CollapsedTopBar title="Landing pages" onExpand={toggleNav} />}
            <div className="flex min-h-0 flex-1 bg-secondary p-2">
                <main className="bg-secondary_subtle flex-1 overflow-y-auto rounded-lg shadow-sm">
                    <div className="mx-auto flex max-w-[1400px] flex-col gap-6 px-4 py-6 md:px-10 md:py-8">
                        <div>
                            <h1 className="text-display-xs font-semibold tracking-tight text-primary md:text-display-sm">Landing pages</h1>
                            <p className="mt-1.5 text-md text-tertiary">Every client's landing page, where it stands, and what clients are saying about it.</p>
                        </div>

                        <div className="grid grid-cols-2 divide-secondary overflow-hidden rounded-2xl bg-primary shadow-xs ring-1 ring-secondary md:grid-cols-4 md:divide-x">
                            {(Object.keys(STAGES) as Stage[]).map((s) => (
                                <div key={s} className={cx("flex flex-col [&>button]:flex-1", filter === s && "bg-primary_hover")}>
                                    <Stat
                                        label={STAGES[s].label}
                                        value={active.filter((r) => r.stage === s).length}
                                        note={STAGES[s].note}
                                        dot={STAGES[s].dot}
                                        onClick={() => setFilter((f) => (f === s ? null : s))}
                                    />
                                </div>
                            ))}
                        </div>

                        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                            <Card
                                title="Client comments"
                                icon={MessageChatSquare}
                                badge={
                                    <Badge type="pill-color" size="sm" color={openComments.length ? "purple" : "gray"}>
                                        {openComments.length}
                                    </Badge>
                                }
                                index={0}
                            >
                                {openComments.length === 0 ? (
                                    <p className="text-sm text-tertiary">No open comments on any landing page.</p>
                                ) : (
                                    <ul className="-mx-2 flex flex-col">
                                        {openComments.map((c) => (
                                            <li key={c.id}>
                                                <button
                                                    type="button"
                                                    onClick={() => open(c.slug)}
                                                    className="flex w-full flex-col gap-1 rounded-lg px-2 py-3 text-left transition duration-100 ease-linear hover:bg-primary_hover"
                                                >
                                                    <span className="flex items-center justify-between gap-2 text-sm">
                                                        <span className="font-semibold text-primary">{nameOf(c.slug)}</span>
                                                        <span className="shrink-0 text-xs text-quaternary">{ago(c.created_at)}</span>
                                                    </span>
                                                    <span className="text-xs text-tertiary">from {(c.suggested_by ?? "").split("@")[0]}</span>
                                                    <span className="line-clamp-3 text-sm text-secondary">{c.suggested_value}</span>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </Card>

                            <Card
                                title={filter ? STAGES[filter].label : "Landing pages"}
                                icon={Globe01}
                                badge={
                                    <Badge type="pill-color" size="sm" color="gray">
                                        {shown.length}
                                    </Badge>
                                }
                                action={filter ? { label: "Show all", onClick: () => setFilter(null) } : undefined}
                                index={1}
                            >
                                <div className="-mt-1 mb-3 flex flex-wrap gap-1" role="tablist" aria-label="Which landing pages">
                                    {views.map((v) => (
                                        <button
                                            key={v.id}
                                            type="button"
                                            role="tab"
                                            aria-selected={view === v.id}
                                            onClick={() => setView(v.id)}
                                            className={cx(
                                                "rounded-md px-2.5 py-1.5 text-sm font-semibold transition duration-100 ease-linear",
                                                view === v.id ? "bg-active text-secondary" : "text-quaternary hover:bg-primary_hover hover:text-secondary",
                                            )}
                                        >
                                            {v.label} <span className="font-medium text-quaternary tabular-nums">{v.rows.length}</span>
                                        </button>
                                    ))}
                                </div>
                                {saveError && <p className="mb-2 text-sm text-error-primary">Couldn't save that change. Try again.</p>}
                                {dashboards == null ? (
                                    <p className="text-sm text-tertiary">Loading…</p>
                                ) : shown.length === 0 ? (
                                    <p className="text-sm text-tertiary">
                                        {view === "hidden" ? "Nothing hidden." : view === "starred" ? "Star a landing page to keep it here." : "Nothing here."}
                                    </p>
                                ) : (
                                    <ul className="-mx-2 flex flex-col divide-y divide-secondary">
                                        {shown.map((r) => (
                                            <li key={r.slug} className="flex items-center gap-1 rounded-lg transition duration-100 ease-linear hover:bg-primary_hover">
                                                <button
                                                    type="button"
                                                    onClick={() => open(r.slug)}
                                                    className="flex min-w-0 flex-1 flex-wrap items-center gap-3 py-3 pl-2 text-left sm:flex-nowrap"
                                                >
                                                    <ClientLogo name={r.name} src={r.client?.logo_url} size="sm" />
                                                    <span className="flex min-w-0 flex-1 flex-col">
                                                        <span className="truncate text-sm font-semibold text-primary">{r.name}</span>
                                                        <span className="truncate text-xs text-tertiary">
                                                            {r.changeNote
                                                                ? `“${r.changeNote}”`
                                                                : [r.client?.am && `AM ${r.client.am}`, r.liveAt && `published ${ago(r.liveAt)}`]
                                                                      .filter(Boolean)
                                                                      .join(" · ") || r.slug}
                                                        </span>
                                                    </span>
                                                    {r.comments > 0 && (
                                                        <Badge type="pill-color" size="sm" color="purple">
                                                            {r.comments} comment{r.comments === 1 ? "" : "s"}
                                                        </Badge>
                                                    )}
                                                    <Badge type="pill-color" size="sm" color={STAGES[r.stage].color}>
                                                        {STAGES[r.stage].label}
                                                    </Badge>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => toggle("starred", r.slug)}
                                                    aria-pressed={r.starred}
                                                    aria-label={`${r.starred ? "Unstar" : "Star"} ${r.name}`}
                                                    title={r.starred ? "Unstar" : "Star"}
                                                    className="rounded-md p-1.5 text-fg-quaternary transition duration-100 ease-linear hover:bg-secondary_hover hover:text-fg-secondary"
                                                >
                                                    <Star01 className={cx("size-4", r.starred && "fill-current text-fg-warning-secondary")} aria-hidden="true" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => toggle("hidden", r.slug)}
                                                    aria-label={`${r.hidden ? "Show" : "Hide"} ${r.name} on this page`}
                                                    title={r.hidden ? "Show again" : "Hide from this page (test or not a real client)"}
                                                    className="mr-1 rounded-md p-1.5 text-fg-quaternary transition duration-100 ease-linear hover:bg-secondary_hover hover:text-fg-secondary"
                                                >
                                                    {r.hidden ? <Eye className="size-4" aria-hidden="true" /> : <EyeOff className="size-4" aria-hidden="true" />}
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </Card>
                        </div>
                    </div>
                </main>
            </div>
        </AppShell>
    );
};

export const LandingPagesScreen = () => (
    <TeamGate>
        <LandingPagesContent />
    </TeamGate>
);
