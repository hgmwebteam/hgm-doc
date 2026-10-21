/**
 * Web Team → Client Input → Client Requests (/dashboard?dept=website&tab=client-requests):
 * every client's help-centre requests inside the dashboard (owner, 21 Oct 2026, phase 1).
 *
 * No backend of its own. It reads the staff-only ticket-list-all function through
 * fetchAllTickets, the same read the standalone list at /team/tickets uses, following
 * next_before page by page (200 a page) up to MAX_ROWS, then filters on the client. The
 * server decides who may read: a team-password unlock has no Google session, so the
 * function answers 401 and the screen asks for the hiddengem.media Google account.
 *
 * Built from Untitled UI PRO's dashboards-02/02 template (metric cards over a filterable
 * table card): the vendored Table, Tabs, Select, Input, Badge, EmptyState and
 * LoadingIndicator. The metric cards copy the PRO MetricsSimple card's markup as toggle
 * buttons rather than adding the metrics component, which brings recharts and a trend
 * indicator this page has no data for. Rules (overdue, this month, filters, sort) live in
 * client-requests-model.ts with a self-check beside it. No em or en dashes in the copy.
 */
import { type ReactNode, useEffect, useState } from "react";
import { AlertCircle, Inbox01, LogIn01, Plus, RefreshCw01, SearchLg } from "@untitledui/icons";
import type { SortDescriptor } from "react-aria-components";
import { ToggleButton as AriaToggleButton } from "react-aria-components";
import { Link } from "react-router";
import { EmptyState } from "@/components/application/empty-state/empty-state";
import { LoadingIndicator } from "@/components/application/loading-indicator/loading-indicator";
import { Table, TableCard } from "@/components/application/table/table";
import { TabList, Tabs } from "@/components/application/tabs/tabs";
import { Badge, BadgeWithButton, BadgeWithDot } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Select } from "@/components/base/select/select";
import { HelpApiError, fetchAllTickets, fetchTopics, useDifferentAccount } from "@/pages/client/help/help-api";
import {
    PRIORITIES,
    type Priority,
    STATUS_META,
    type Ticket,
    type TicketStatus,
    type TicketTopic,
    formatRaisedDay,
    isOpen,
    todayIsoDay,
    topicLabel,
} from "@/pages/client/help/help-model";
import {
    type Filters,
    METRIC_FILTERS,
    type Metrics,
    NO_FILTERS,
    STATUS_TABS,
    type SortColumn,
    type StatusTab,
    applyFilters,
    clientNameOf,
    clientOptions,
    hasFilters,
    isOverdue,
    metricsOf,
    requestHref,
    sortTickets,
} from "@/pages/team/client-requests/client-requests-model";
import { cx } from "@/utils/cx";

/** Ten pages. Past this the header says how many are shown; /team/tickets pages through the rest. */
const MAX_ROWS = 2000;

/** Status badge colours (owner, 21 Oct 2026); the words are help-model's STATUS_META. */
const STATUS_COLOR: Record<TicketStatus, "gray" | "brand" | "warning" | "success"> = {
    received: "gray",
    assigned: "gray",
    in_progress: "brand",
    in_review: "warning",
    completed: "success",
    withdrawn: "gray",
};

/** The priority tints the request form's chips use (help-model PRIORITIES): blue, green, yellow, red. */
const PRIORITY_COLOR: Record<Priority, "brand" | "success" | "warning" | "error"> = { low: "brand", medium: "success", high: "warning", urgent: "error" };

const ALL = "all";
const PRIORITY_ITEMS = [{ id: ALL, label: "All priorities" }, ...PRIORITIES.map((p) => ({ id: p.key, label: p.label }))];

const METRIC_CARDS: { key: keyof Metrics; label: string }[] = [
    { key: "open", label: "Open" },
    { key: "inReview", label: "Awaiting review" },
    { key: "overdue", label: "Overdue" },
    { key: "completedThisMonth", label: "Completed this month" },
];

type Load = { kind: "loading" } | { kind: "error"; error: unknown } | { kind: "ready"; rows: Ticket[]; total: number; capped: boolean };

/** Every page, newest first, until the server says there are no more or MAX_ROWS is reached. */
const loadAll = async (): Promise<{ rows: Ticket[]; total: number; capped: boolean }> => {
    const rows: Ticket[] = [];
    let total = 0;
    let before: string | null = null;
    do {
        const page = await fetchAllTickets({ before });
        // The first page's count is every request; later pages count only what is older.
        if (!rows.length) total = page.total;
        rows.push(...page.tickets);
        before = page.next_before;
    } while (before && rows.length < MAX_ROWS);
    return { rows, total, capped: !!before };
};

const plural = (n: number, one: string) => `${n.toLocaleString("en-US")} ${n === 1 ? one : `${one}s`}`;

export const ClientRequestsContent = () => {
    const [load, setLoad] = useState<Load>({ kind: "loading" });
    const [attempt, setAttempt] = useState(0);
    const [topics, setTopics] = useState<TicketTopic[]>([]);
    const [filters, setFilters] = useState<Filters>(NO_FILTERS);
    const [sort, setSort] = useState<SortDescriptor>({ column: "created_at", direction: "descending" });

    useEffect(() => {
        let cancelled = false;
        setLoad({ kind: "loading" });
        loadAll().then(
            (r) => !cancelled && setLoad({ kind: "ready", ...r }),
            (error) => !cancelled && setLoad({ kind: "error", error }),
        );
        return () => {
            cancelled = true;
        };
    }, [attempt]);

    const rows = load.kind === "ready" ? load.rows : [];

    // Category labels come from the database. The endpoint wants a slug only to prove who is
    // asking, so any loaded client's will do, as on /team/tickets; until it answers, the key
    // reads as words (topicLabel).
    const firstSlug = rows.find((t) => t.client_slug)?.client_slug ?? "";
    useEffect(() => {
        if (!firstSlug) return;
        fetchTopics({ slug: firstSlug, email: "" })
            .then((r) => setTopics(r.topics ?? []))
            .catch(() => {});
    }, [firstSlug]);

    // Read on every render (a few thousand rows at most), so a page left open past midnight
    // moves its overdue line on the next filter change.
    const today = todayIsoDay();
    const now = new Date();
    const metrics = metricsOf(rows, today, now);
    const clients = [{ id: ALL, label: "All clients" }, ...clientOptions(rows)];
    const shown = sortTickets(applyFilters(rows, filters, today, now), sort.column as SortColumn, sort.direction);
    const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));

    const pressMetric = (key: keyof Metrics) => {
        const target = METRIC_FILTERS[key];
        const active = filters.tab === target.tab && filters.focus === target.focus;
        set(active ? { tab: "all", focus: null } : target);
    };

    const subtitle =
        load.kind === "ready"
            ? `${plural(load.total, "request")}, ${rows.filter(isOpen).length.toLocaleString("en-US")} open${load.capped ? `. Showing the newest ${rows.length.toLocaleString("en-US")}` : ""}`
            : load.kind === "loading"
              ? "Loading…"
              : "";

    return (
        // w-0 flex-1: the dashboard's shell sizes its column to its content's widest line, so a wide
        // table would push the whole page sideways. A zero basis keeps the pane to the space left.
        <div className="flex h-full w-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg bg-secondary shadow-sm">
            <header className="flex min-h-[73px] shrink-0 items-center justify-between gap-3 border-b border-secondary bg-primary px-4 py-3 md:px-6">
                <div className="min-w-0">
                    <h1 className="text-md font-semibold text-primary">Client Requests</h1>
                    <p className="text-sm text-tertiary">{subtitle}</p>
                </div>
                <Button href="/team/tickets/new" color="secondary" size="sm" iconLeading={Plus} className="shrink-0">
                    Report a ticket
                </Button>
            </header>

            <div className="flex-1 overflow-y-auto">
                <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-5 px-4 py-5 md:gap-6 md:px-5 md:py-6">
                    {load.kind === "loading" ? (
                        <div className="flex min-h-80 items-center justify-center" role="status">
                            <LoadingIndicator type="line-spinner" size="md" label="Loading client requests" />
                        </div>
                    ) : load.kind === "error" ? (
                        <LoadError error={load.error} onRetry={() => setAttempt((n) => n + 1)} />
                    ) : (
                        <>
                            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-5">
                                {METRIC_CARDS.map((m) => {
                                    const target = METRIC_FILTERS[m.key];
                                    return (
                                        <MetricCard
                                            key={m.key}
                                            label={m.label}
                                            value={metrics[m.key]}
                                            alert={m.key === "overdue" && metrics.overdue > 0}
                                            active={filters.tab === target.tab && filters.focus === target.focus}
                                            onPress={() => pressMetric(m.key)}
                                        />
                                    );
                                })}
                            </div>

                            <TableCard.Root size="sm">
                                {rows.length > 0 && (
                                    <div className="flex flex-col gap-3 border-b border-secondary px-4 py-3 md:px-5">
                                        <div className="-mx-4 scrollbar-hide flex items-center gap-3 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
                                            <Tabs
                                                selectedKey={filters.tab}
                                                onSelectionChange={(k) => set({ tab: k as StatusTab, focus: null })}
                                                className="w-auto"
                                            >
                                                <TabList type="button-minimal" size="sm" aria-label="Status" items={STATUS_TABS} />
                                            </Tabs>
                                            {filters.focus && (
                                                <BadgeWithButton
                                                    type="modern"
                                                    size="md"
                                                    color="gray"
                                                    buttonLabel="Remove this filter"
                                                    onButtonClick={() => set({ focus: null })}
                                                >
                                                    {filters.focus === "overdue" ? "Overdue only" : "Completed this month"}
                                                </BadgeWithButton>
                                            )}
                                        </div>
                                        <div className="flex flex-col gap-3 md:flex-row md:items-center">
                                            <Input
                                                size="sm"
                                                icon={SearchLg}
                                                aria-label="Search requests"
                                                placeholder="Search reference, request or client"
                                                value={filters.query}
                                                onChange={(query) => set({ query })}
                                                className="md:max-w-80"
                                            />
                                            <div className="grid grid-cols-2 gap-3 md:ml-auto md:flex">
                                                <Select
                                                    size="sm"
                                                    aria-label="Client"
                                                    items={clients}
                                                    selectedKey={filters.client || ALL}
                                                    onSelectionChange={(k) => set({ client: k === ALL || k == null ? "" : String(k) })}
                                                    className="md:w-52"
                                                >
                                                    {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                                                </Select>
                                                <Select
                                                    size="sm"
                                                    aria-label="Priority"
                                                    items={PRIORITY_ITEMS}
                                                    selectedKey={filters.priority || ALL}
                                                    onSelectionChange={(k) => set({ priority: k === ALL || k == null ? "" : (k as Priority) })}
                                                    className="md:w-44"
                                                >
                                                    {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                                                </Select>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {rows.length === 0 ? (
                                    <Empty
                                        icon={Inbox01}
                                        title="No client requests yet"
                                        description="Requests clients raise from their Help Center, and tickets the team reports for them, appear here."
                                    />
                                ) : shown.length === 0 ? (
                                    <Empty
                                        icon={SearchLg}
                                        title="No requests match these filters"
                                        description="Try another status, client or search, or clear the filters to see every request."
                                        action={
                                            hasFilters(filters) && (
                                                <Button color="secondary" size="md" onClick={() => setFilters(NO_FILTERS)}>
                                                    Clear filters
                                                </Button>
                                            )
                                        }
                                    />
                                ) : (
                                    <>
                                        <div className="max-md:hidden">
                                            <RequestsTable rows={shown} topics={topics} today={today} sort={sort} onSortChange={setSort} />
                                        </div>
                                        <ul className="divide-y divide-secondary md:hidden">
                                            {shown.map((t) => (
                                                <RequestCard key={t.id} t={t} topics={topics} today={today} />
                                            ))}
                                        </ul>
                                    </>
                                )}
                            </TableCard.Root>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

/* ── pieces ──────────────────────────────────────────────────────────────── */

/** PRO MetricsSimple's card, pressable: it sets the matching filter, and pressing it again clears it. */
const MetricCard = ({ label, value, alert, active, onPress }: { label: string; value: number; alert: boolean; active: boolean; onPress: () => void }) => (
    <AriaToggleButton
        isSelected={active}
        onChange={onPress}
        className={({ isFocusVisible, isHovered }) =>
            cx(
                "flex cursor-pointer flex-col gap-2 rounded-xl bg-primary px-4 py-4 text-left shadow-xs ring-1 ring-secondary outline-focus-ring transition duration-100 ease-linear ring-inset md:px-5 md:py-5",
                isHovered && "bg-primary_hover",
                active && "ring-2 ring-brand",
                isFocusVisible && "outline-2 outline-offset-2",
            )
        }
    >
        <span className="text-sm font-medium text-tertiary">{label}</span>
        <span className={cx("text-display-xs font-semibold md:text-display-sm", alert ? "text-error-primary" : "text-primary")}>
            {value.toLocaleString("en-US")}
        </span>
    </AriaToggleButton>
);

const StatusBadge = ({ status }: { status: TicketStatus }) => (
    <Badge type="pill-color" size="sm" color={STATUS_COLOR[status]} className="whitespace-nowrap">
        {STATUS_META[status].label}
    </Badge>
);

const PriorityBadge = ({ priority }: { priority: Priority | null | undefined }) => {
    const meta = PRIORITIES.find((p) => p.key === priority);
    return meta ? (
        <BadgeWithDot type="modern" size="sm" color={PRIORITY_COLOR[meta.key]}>
            {meta.label}
        </BadgeWithDot>
    ) : (
        <span className="text-sm text-quaternary">Not set</span>
    );
};

const NeededBy = ({ t, today, prefix = "" }: { t: Ticket; today: string; prefix?: string }) =>
    t.needed_by ? (
        <span className={cx("whitespace-nowrap", isOverdue(t, today) && "font-medium text-error-primary")}>
            {prefix}
            {formatRaisedDay(t.needed_by)}
            {isOverdue(t, today) && <span className="sr-only"> (overdue)</span>}
        </span>
    ) : (
        <span className="text-quaternary">Not set</span>
    );

const assigneeOf = (t: Ticket) => (t.assignee_name ?? "").trim();

/**
 * The table, md and up. Each row is a React Aria link row: a click goes through the app's
 * router, and Cmd/Ctrl-click or Enter with a modifier opens the request in a new tab, which
 * React Aria does for link rows in every browser (openLink).
 */
const RequestsTable = ({
    rows,
    topics,
    today,
    sort,
    onSortChange,
}: {
    rows: Ticket[];
    topics: TicketTopic[];
    today: string;
    sort: SortDescriptor;
    onSortChange: (s: SortDescriptor) => void;
}) => (
    // Cells padded 12 rather than the kit's 20/24, so all eight columns fit the 1280 dashboard
    // with its side menu open; the outer edges keep 20.
    <Table
        aria-label="Client requests"
        size="sm"
        sortDescriptor={sort}
        onSortChange={onSortChange}
        className="[&_td]:px-3 [&_td:first-child]:pl-5 [&_td:last-child]:pr-5 [&_th]:px-3 [&_th:first-child]:pl-5 [&_th:last-child]:pr-5"
    >
        <Table.Header>
            <Table.Head id="reference" label="Reference" />
            <Table.Head id="request" label="Request" isRowHeader className="w-full" />
            <Table.Head id="client" label="Client" />
            <Table.Head id="priority" label="Priority" />
            <Table.Head id="status" label="Status" />
            <Table.Head id="created_at" label="Raised" allowsSorting />
            <Table.Head id="needed_by" label="Needed by" allowsSorting />
            <Table.Head id="assignee" label="Assigned to" />
        </Table.Header>
        {/* React Aria caches a row by its item, so cells that read anything else must name it here. */}
        <Table.Body items={rows} dependencies={[topics, today]}>
            {(t) => (
                <Table.Row id={t.id} href={requestHref(t)} className="cursor-pointer">
                    <Table.Cell className="font-mono text-xs whitespace-nowrap text-secondary">{t.reference}</Table.Cell>
                    <Table.Cell>
                        <div className="flex max-w-96 min-w-36 flex-col">
                            <span className="line-clamp-2 font-medium text-primary" title={t.title}>
                                {t.title}
                            </span>
                            <span className="text-tertiary">{topicLabel(topics, t.topic)}</span>
                        </div>
                    </Table.Cell>
                    <Table.Cell className="text-secondary">{clientNameOf(t)}</Table.Cell>
                    <Table.Cell>
                        <PriorityBadge priority={t.priority} />
                    </Table.Cell>
                    <Table.Cell>
                        <StatusBadge status={t.status} />
                    </Table.Cell>
                    <Table.Cell className="whitespace-nowrap">{formatRaisedDay(t.created_at)}</Table.Cell>
                    <Table.Cell>
                        <NeededBy t={t} today={today} />
                    </Table.Cell>
                    <Table.Cell>{assigneeOf(t) || <span className="text-quaternary">Not assigned</span>}</Table.Cell>
                </Table.Row>
            )}
        </Table.Body>
    </Table>
);

/** Below md: one card per request, the whole card a real link. */
const RequestCard = ({ t, topics, today }: { t: Ticket; topics: TicketTopic[]; today: string }) => (
    <li>
        <Link
            to={requestHref(t)}
            className="flex flex-col gap-2.5 px-4 py-4 outline-focus-ring transition duration-100 ease-linear hover:bg-primary_hover focus-visible:outline-2 focus-visible:-outline-offset-2"
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col">
                    <span className="text-sm font-medium text-primary">{t.title}</span>
                    <span className="text-sm text-tertiary">
                        {clientNameOf(t)} · {topicLabel(topics, t.topic)}
                    </span>
                </div>
                <StatusBadge status={t.status} />
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-tertiary">
                <span className="font-mono text-xs text-secondary">{t.reference}</span>
                <PriorityBadge priority={t.priority} />
                <span className="whitespace-nowrap">Raised {formatRaisedDay(t.created_at)}</span>
                {t.needed_by && <NeededBy t={t} today={today} prefix="Needed by " />}
                <span>{assigneeOf(t) || "Not assigned"}</span>
            </div>
        </Link>
    </li>
);

const Empty = ({ icon, title, description, action }: { icon: typeof Inbox01; title: string; description: string; action?: ReactNode }) => (
    <EmptyState size="md" className="overflow-hidden px-4 py-12">
        <EmptyState.Header>
            <EmptyState.FeaturedIcon icon={icon} color="gray" theme="modern" />
        </EmptyState.Header>
        <EmptyState.Content className="mb-0">
            <EmptyState.Title className="text-center">{title}</EmptyState.Title>
            <EmptyState.Description>{description}</EmptyState.Description>
        </EmptyState.Content>
        {action && <EmptyState.Footer className="mt-6">{action}</EmptyState.Footer>}
    </EmptyState>
);

/**
 * 401: no Google session, which is what the team password gives (it opens the dashboard but
 * carries no identity). 403: a session that is not staff. Neither is fixed by trying again,
 * so both offer Google's account chooser instead (useDifferentAccount, back to this tab).
 */
const LoadError = ({ error, onRetry }: { error: unknown; onRetry: () => void }) => {
    const status = error instanceof HelpApiError ? error.status : 0;
    const signIn = status === 401 || status === 403;
    return (
        <div className="rounded-xl bg-primary shadow-xs ring-1 ring-secondary ring-inset">
            <Empty
                icon={signIn ? LogIn01 : AlertCircle}
                title={
                    status === 401
                        ? "Sign in with Google to see client requests"
                        : status === 403
                          ? "This account cannot see client requests"
                          : "Client requests did not load"
                }
                description={
                    status === 401
                        ? "Requests are read with your hiddengem.media Google account. The team password opens the dashboard but cannot read them."
                        : status === 403
                          ? "Only hiddengem.media Google accounts can read them. Sign in with your work account."
                          : error instanceof HelpApiError
                            ? error.message
                            : "We could not load the requests just then."
                }
                action={
                    signIn ? (
                        <Button color="primary" size="md" iconLeading={LogIn01} onClick={() => void useDifferentAccount()}>
                            {status === 401 ? "Sign in with Google" : "Use a different account"}
                        </Button>
                    ) : (
                        <Button color="secondary" size="md" iconLeading={RefreshCw01} onClick={onRetry}>
                            Try again
                        </Button>
                    )
                }
            />
        </div>
    );
};
