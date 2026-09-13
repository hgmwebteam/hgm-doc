/**
 * THE TEAM'S VIEW OF EVERY CLIENT'S REQUESTS, and the form that raises one.
 *
 *   /team/tickets       every request across every client, newest first
 *   /team/tickets/new   "Report a ticket": the Figma file's fourteen form frames
 *                       ("Desktop · Light / 1 Default .. 5 Success", "Mobile · Light /
 *                       390 Default, Filled", and the same in Dark)
 *
 * ── WHO ─────────────────────────────────────────────────────────────────────
 * Staff. The browser checks the session's domain the way every team page in
 * this app does, and the SERVER decides: ticket-list-all and ticket-create are
 * gated on verifyStaff / verifyCaller with the three staff tests (staff.mts).
 * A client who reaches this URL sees the sign-in panel and nothing else, and a
 * client session that calls the function gets 403.
 *
 * ── THE DESIGN ──────────────────────────────────────────────────────────────
 * The help centre's atoms (help-atoms.tsx), and nothing else: the TopBar with
 * "Reporting System" as the app name, the Button, the FilterChips, the
 * StatusPill, the MonoRef, the card. The form is help-form.tsx, which is the
 * frames; the page around it is the frames' Body: the 560 column with the body
 * 56 from the top bar on desktop (96 below), 16px gutters and 24 from the top
 * at 390 (40 below).
 *
 * The list has no frame in the file. It is the help centre's Requests list with
 * two more facts per row, the client and the priority, laid out the way that
 * frame lays its rows out: a card of 76px rows, alternating bg/primary and
 * bg/secondary with a border/secondary hairline between them.
 *
 * House style: no em or en dashes anywhere.
 */
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAuthUser } from "@/hooks/use-auth-user";
import { supabase } from "@/lib/supabase";
import { type ClientOption, HelpApiError, createTicket, fetchAllTickets, fetchClientOptions, fetchTopics } from "@/pages/client/help/help-api";
import { Banner, Button, Card, ChevronDownIcon, FilterChip, GemIcon, HelpFrame, MonoRef, PRIORITY_LEVELS, type PillTone, PriorityDot, type PriorityLevel, StatusPill, TopBar, firstNameOf, initialOf } from "@/pages/client/help/help-atoms";
import { RequestForm, RequestSent } from "@/pages/client/help/help-form";
import { type Priority, type Ticket, type TicketStatus, type TicketTopic, elapsedDays, formatDayMonth, formatDayMonthShort, topicLabel } from "@/pages/client/help/help-model";
import { cx } from "@/utils/cx";

/* ── chrome ──────────────────────────────────────────────────────────────── */

/**
 * The page: HelpFrame around the file's TopBar with "Reporting System" as the app name
 * and "Signed in as {first name}" on the right; the avatar is named "Account, {name}".
 * The form frames pad the bar 16 at 390 (the help centre's keep 24), which the wrapper
 * sets on the bar since the atom has one padding at every width.
 */
const TeamShell = ({ email, name, children }: { email: string; name: string; children: ReactNode }) => {
    const person = firstNameOf(name) || email.split("@")[0];
    return (
        <HelpFrame
            topBar={
                <div className="[&>div]:px-4 sm:[&>div]:px-6">
                    <TopBar app="Reporting System" brandTo="/dashboard" right={`Signed in as ${person}`} initial={initialOf(person)} accountName={name || person} />
                </div>
            }
        >
            {children}
        </HelpFrame>
    );
};

/** The frames' Body around the 560 form column: top 56 and bottom 96 on desktop, 24 and 40 inside 16px gutters at 390. */
const FormPage = ({ children }: { children: ReactNode }) => <div className="px-4 pt-6 pb-10 sm:px-6 sm:pt-14 sm:pb-24">{children}</div>;

/** A team page's sign-in panel: Google, the same as everywhere else in the team area. */
const TeamGate = () => {
    const [busy, setBusy] = useState(false);
    const signIn = async () => {
        setBusy(true);
        await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.href, queryParams: { prompt: "select_account" } } });
    };
    return (
        <div className="hc flex min-h-dvh items-center justify-center bg-(--hc-bg-page) p-6">
            <Card className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
                <GemIcon className="size-8" />
                <h1 className="hc-t-heading-section text-(--hc-text-primary)">Team sign-in</h1>
                <p className="hc-t-body-helper text-(--hc-text-tertiary)">Client requests are for the HiddenGem Media team. Sign in with your hiddengem.media Google account.</p>
                <Button fill onClick={signIn} loading={busy} className={busy ? undefined : "cursor-pointer"}>
                    {busy ? "Opening Google" : "Sign in with Google"}
                </Button>
            </Card>
        </div>
    );
};

const useTeam = () => {
    const { user, loading } = useAuthUser();
    const email = (user?.email ?? "").trim().toLowerCase();
    const isTeam = /@hiddengem\.media$/.test(email);
    return { email, name: user?.name ?? "", isTeam, loading };
};

/* ── the list ────────────────────────────────────────────────────────────── */

type ListFilter = "all" | "open" | TicketStatus;

const LIST_FILTERS: { key: ListFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "open", label: "Open" },
    { key: "in_progress", label: "In progress" },
    { key: "completed", label: "Completed" },
    { key: "withdrawn", label: "Withdrawn" },
];
const OPEN: TicketStatus[] = ["received", "assigned", "in_progress"];
const matches = (t: Ticket, f: ListFilter) => (f === "all" ? true : f === "open" ? OPEN.includes(t.status) : t.status === f);

/** Status/Pill, per status: the label carries the state, the tone reinforces it. */
const PILL: Record<TicketStatus, { label: string; tone: PillTone }> = {
    received: { label: "Received", tone: "with-the-team" },
    assigned: { label: "Assigned", tone: "with-the-team" },
    in_progress: { label: "In progress", tone: "in-progress" },
    completed: { label: "Completed", tone: "done" },
    withdrawn: { label: "Withdrawn", tone: "withdrawn" },
};

/**
 * The row's right-hand fact, the way the requests frame words it: "Due 12 September",
 * "Completed in 3 days", "Withdrawn"; "Asked for by 29 September" when the client gave
 * a date and nothing is promised yet. promised_date and needed_by are plain DATE
 * columns, so they go through the day parser, never new Date().
 */
const dueLine = (t: Ticket): string => {
    if (t.status === "withdrawn") return "Withdrawn";
    if (t.status === "completed") {
        const days = elapsedDays(t.created_at, t.completed_at);
        return days === null ? "Completed" : days === 0 ? "Completed the same day" : `Completed in ${days} ${days === 1 ? "day" : "days"}`;
    }
    if (t.promised_date) return `Due ${formatDayMonth(t.promised_date)}`;
    return t.needed_by ? `Asked for by ${formatDayMonth(t.needed_by)}` : "";
};

const isLevel = (p: Priority | null | undefined): p is PriorityLevel => !!p && PRIORITY_LEVELS.some((l) => l.value === p);

const shortSlug = (slug: string | null | undefined) => (slug ?? "").replace(/-dashboard$/, "");

export const TeamTicketsScreen = () => {
    const { email, name, isTeam, loading: authLoading } = useTeam();
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [topics, setTopics] = useState<TicketTopic[]>([]);
    const [total, setTotal] = useState(0);
    const [next, setNext] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [filter, setFilter] = useState<ListFilter>("all");
    const [client, setClient] = useState("");

    const load = useCallback(async (before: string | null = null) => {
        setLoading(true);
        setError("");
        try {
            const res = await fetchAllTickets({ before });
            setTickets((prev) => (before ? [...prev, ...res.tickets] : res.tickets));
            setTotal(res.total);
            setNext(res.next_before);
        } catch (e) {
            setError(e instanceof HelpApiError ? e.message : "We could not load the requests just then.");
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        if (isTeam) void load();
    }, [isTeam, load]);

    // The category labels come from the database, never a list here. The endpoint
    // needs a slug only to prove who is asking, so the first request's client will do.
    const firstSlug = tickets.find((t) => t.client_slug)?.client_slug ?? "";
    useEffect(() => {
        if (!firstSlug || topics.length) return;
        fetchTopics({ slug: firstSlug, email })
            .then((r) => setTopics(r.topics ?? []))
            .catch(() => {
                // The key stands in for the label until the next load.
            });
    }, [firstSlug, email, topics.length]);

    const clients = useMemo(() => {
        const seen = new Map<string, string>();
        for (const t of tickets) if (t.client_slug) seen.set(t.client_slug, (t.client_name ?? "").trim() || shortSlug(t.client_slug));
        return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
    }, [tickets]);
    const shown = tickets.filter((t) => matches(t, filter) && (!client || t.client_slug === client));
    const openCount = tickets.filter((t) => OPEN.includes(t.status)).length;

    if (authLoading) return null;
    if (!isTeam) return <TeamGate />;

    return (
        <TeamShell email={email} name={name}>
            <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-6 px-4 pt-6 pb-10 sm:gap-10 sm:px-6 sm:pt-14 sm:pb-16 xl:px-0">
                <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col gap-1">
                        <h1 className="hc-t-display-title text-(--hc-text-primary) sm:hc-t-display-hero">Client requests</h1>
                        <p className="hc-t-body-helper text-(--hc-text-tertiary)">
                            {total} {total === 1 ? "request" : "requests"} across every client. {openCount} open.
                        </p>
                    </div>
                    <Button to="/team/tickets/new" className="max-sm:w-full cursor-pointer">
                        Report a ticket
                    </Button>
                </header>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div role="group" aria-label="Filter by status" className="flex flex-wrap items-center gap-2">
                        {LIST_FILTERS.map((f) => (
                            <FilterChip key={f.key} selected={f.key === filter} onClick={() => setFilter(f.key)} className="cursor-pointer">
                                {f.label}
                            </FilterChip>
                        ))}
                    </div>
                    <label className="flex items-center gap-2">
                        <span className="hc-t-body-helper text-(--hc-text-tertiary)">Client</span>
                        <span className="relative">
                            <select
                                value={client}
                                onChange={(e) => setClient(e.target.value)}
                                className="hc-focus-border hc-hover hc-t-body-helper block h-11 cursor-pointer appearance-none rounded-(--hc-radius-md) border border-(--hc-border-primary) bg-(--hc-bg-primary) pr-[43px] pl-[13px] text-(--hc-text-primary) focus:border-2 focus:border-(--hc-border-brand) focus:pl-[12px] sm:h-9"
                            >
                                <option value="">Every client</option>
                                {clients.map(([slug, clientName]) => (
                                    <option key={slug} value={slug}>
                                        {clientName}
                                    </option>
                                ))}
                            </select>
                            <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-[11px] -translate-y-1/2 text-(--hc-text-tertiary)" />
                        </span>
                    </label>
                </div>

                {error && (
                    <Banner kind="error" title="The list did not load">
                        {error}
                    </Banner>
                )}
                {error && (
                    <Button variant="secondary" onClick={() => void load()} className="cursor-pointer">
                        Try again
                    </Button>
                )}

                {loading && tickets.length === 0 ? (
                    <p className="hc-t-body-helper text-(--hc-text-tertiary)" role="status">
                        Loading every client's requests
                    </p>
                ) : shown.length === 0 ? (
                    <Card className="flex flex-col items-center gap-2 py-12 text-center">
                        <p className="hc-t-label-field text-(--hc-text-primary)">Nothing here</p>
                        <p className="hc-t-body-helper max-w-[42ch] text-(--hc-text-tertiary)">No request matches that filter. Raise one with the button above.</p>
                    </Card>
                ) : (
                    <ul className="flex flex-col overflow-hidden rounded-(--hc-radius-xl) border border-(--hc-border-secondary) bg-(--hc-bg-primary) shadow-(--hc-elevation-card)">
                        {shown.map((t, i) => {
                            const clientName = (t.client_name ?? "").trim() || shortSlug(t.client_slug);
                            const due = dueLine(t);
                            const by = (t.submitted_by_name ?? "").trim();
                            const pill = PILL[t.status];
                            return (
                                <li key={t.id} className={cx(i > 0 && "border-t border-(--hc-border-secondary)", i % 2 === 1 && "bg-(--hc-bg-secondary)")}>
                                    <Link
                                        to={`/${shortSlug(t.client_slug)}/help/requests/${t.reference}`}
                                        className="hc-hover flex cursor-pointer flex-col gap-2.5 px-4 py-4 hover:bg-(--hc-bg-primary_hover) sm:flex-row sm:items-center sm:gap-4 sm:px-5"
                                    >
                                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                                            <p className="hc-t-label-field text-(--hc-text-primary)">{t.title}</p>
                                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                                <MonoRef>{t.reference}</MonoRef>
                                                <span className="hc-t-body-helper text-(--hc-text-tertiary)">
                                                    {`${clientName}  ·  ${topicLabel(topics, t.topic)}  ·  raised ${formatDayMonthShort(t.created_at)}${by ? ` by ${by}` : ""}`}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 sm:justify-end">
                                            {isLevel(t.priority) && (
                                                <span className="hc-t-body-helper inline-flex items-center gap-2 text-(--hc-text-secondary)">
                                                    <PriorityDot level={t.priority} />
                                                    {PRIORITY_LEVELS.find((l) => l.value === t.priority)?.label}
                                                </span>
                                            )}
                                            {due && <span className="hc-t-body-helper text-(--hc-text-secondary)">{due}</span>}
                                            <StatusPill label={pill.label} tone={pill.tone} />
                                        </div>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                )}

                {next && !loading && (
                    <div className="flex justify-center">
                        <Button variant="secondary" onClick={() => void load(next)} className="cursor-pointer">
                            Show older requests
                        </Button>
                    </div>
                )}
            </div>
        </TeamShell>
    );
};

/* ── Report a ticket ─────────────────────────────────────────────────────── */

export const TeamReportScreen = () => {
    const { email, name, isTeam, loading: authLoading } = useTeam();
    const navigate = useNavigate();
    const [clients, setClients] = useState<ClientOption[]>([]);
    const [done, setDone] = useState<{ reference: string; slug: string; title: string; clientName: string; priority: Priority | null } | null>(null);

    useEffect(() => {
        if (isTeam) void fetchClientOptions().then(setClients);
    }, [isTeam]);

    if (authLoading) return null;
    if (!isTeam) return <TeamGate />;

    return (
        <TeamShell email={email} name={name}>
            <FormPage>
                {done ? (
                    <RequestSent
                        reference={done.reference}
                        title={done.title}
                        clientName={done.clientName}
                        priority={done.priority}
                        team
                        slug={done.slug}
                        primary={{ label: "Report another ticket", onClick: () => setDone(null) }}
                        secondary={{ label: "Back to portal", onClick: () => navigate("/team/tickets") }}
                    />
                ) : (
                    <RequestForm
                        mode="team"
                        clients={clients}
                        topics={[]}
                        clientName=""
                        email={email}
                        onSubmit={async (input) => {
                            const res = await createTicket({ slug: input.slug, email }, input);
                            return { reference: res.ticket.reference };
                        }}
                        onCreated={(reference, slug, sent) =>
                            setDone({
                                reference,
                                slug,
                                title: sent.title,
                                clientName: clients.find((c) => c.slug === slug)?.name ?? shortSlug(slug),
                                priority: sent.priority,
                            })
                        }
                    />
                )}
            </FormPage>
        </TeamShell>
    );
};
