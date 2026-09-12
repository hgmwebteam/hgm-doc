/**
 * THE TEAM'S VIEW OF EVERY CLIENT'S REQUESTS, and the form that raises one.
 *
 *   /team/tickets       every request across every client, newest first
 *   /team/tickets/new   "Report a ticket": the Figma's Screens page, frames
 *                       "Desktop / 1 Default .. 5 Success" and "Mobile / 390"
 *
 * ── WHO ─────────────────────────────────────────────────────────────────────
 * Staff. The browser checks the session's domain the way every team page in
 * this app does, and the SERVER decides: ticket-list-all and ticket-create are
 * gated on verifyStaff / verifyCaller with the three staff tests (staff.mts).
 * A client who reaches this URL sees the sign-in panel and nothing else, and a
 * client session that calls the function gets 403.
 *
 * ── THE DESIGN ──────────────────────────────────────────────────────────────
 * Same system as the client help centre (help-requests-screen.tsx documents
 * the tokens, type scale and rhythm): the TopBar with the app name, the 1040
 * column, cards with elevation/card. The form is the Figma's 560 column:
 * eyebrow "REPORTING SYSTEM" in the brand colour with 1.2 tracking, "Report a
 * ticket", the lede, then Client (Field/Select), Topic, Priority (Priority/Chip
 * over Priority/Legend), Screenshots (Field/Upload), Description
 * (Field/Textarea, where the first line becomes the title), and the Actions
 * row with Cancel, the primary, and the trust line right-aligned. The error and
 * success states are the Banner component, kind=error and kind=success.
 *
 * The list has no frame in the file; it is the Requests list with one more
 * fact per row - the client - and a priority pill where one was set.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowNarrowLeft } from "@untitledui-pro/icons/line";
import { Link, useNavigate } from "react-router";
import { useAuthUser } from "@/hooks/use-auth-user";
import { supabase } from "@/lib/supabase";
import { type ClientOption, HelpApiError, createTicket, fetchAllTickets, fetchClientOptions, fetchTopics } from "@/pages/client/help/help-api";
import { RequestForm, RequestSent } from "@/pages/client/help/help-form";
import { type Priority, type Ticket, type TicketStatus, type TicketTopic, formatStampShort, priorityMeta } from "@/pages/client/help/help-model";
import {
    ErrorNote,
    Eyebrow,
    FOCUS,
    HelpSpinner,
    MetaDot,
    MonoRef,
    Panel,
    PrimaryButton,
    SecondaryButton,
    StatusPill,
    T,
    TextLink,
} from "@/pages/client/help/help-requests-screen";
import { cx } from "@/utils/cx";

/* ── chrome ──────────────────────────────────────────────────────────────── */

const GemMark = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M7 4h10l4 5-9 11L3 9l4-5Z" stroke="#f5c518" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M3 9h18M12 20 8 9l2-5M12 20l4-11-2-5" stroke="#f5c518" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
);

/** The Figma TopBar with "Reporting System" as the app name and "Signed in as {person}". */
const TeamShell = ({ email, children }: { email: string; children: React.ReactNode }) => {
    const person = email.split("@")[0];
    const initial = (person[0] ?? "?").toUpperCase();
    return (
        <div className="min-h-dvh bg-secondary">
            <a href="#team-main" className={cx("sr-only rounded-lg bg-brand-solid px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50", T.label, FOCUS)}>
                Skip to content
            </a>
            <header className="border-b border-secondary bg-secondary">
                <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
                    <Link to="/dashboard" className={cx("inline-flex h-11 items-center gap-2.5 rounded", FOCUS)} aria-label="Back to the team dashboard">
                        <GemMark />
                        <span className={cx(T.label, "text-primary")}>
                            HiddenGem Media
                        </span>
                        <span className={cx(T.label, "text-tertiary")} aria-hidden="true">
                            /
                        </span>
                        <span className={cx(T.label, "text-fg-brand-primary")}>Reporting System</span>
                    </Link>
                    <div className="flex items-center gap-2.5">
                        <span className={cx(T.helper, "hidden text-secondary sm:inline")}>Signed in as {person}</span>
                        <span role="img" aria-label={`Account, ${email}`} className={cx("flex size-8 items-center justify-center rounded-full bg-brand-primary ring-1 ring-brand", T.caption, "text-primary")}>
                            {initial}
                        </span>
                    </div>
                </div>
            </header>
            <main id="team-main" tabIndex={-1} className="mx-auto w-full max-w-[1040px] px-4 pt-6 pb-10 outline-none sm:px-6 sm:pt-14 sm:pb-24 lg:px-0">
                {children}
            </main>
        </div>
    );
};

/** A team page's sign-in panel: Google, the same as everywhere else in the team area. */
const TeamGate = () => {
    const [busy, setBusy] = useState(false);
    const signIn = async () => {
        setBusy(true);
        await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.href, queryParams: { prompt: "select_account" } } });
    };
    return (
        <div className="flex min-h-dvh items-center justify-center bg-secondary p-6">
            <div className="w-full max-w-sm rounded-2xl bg-primary p-8 text-center shadow-2xl ring-1 ring-secondary">
                <img src="/hgm logo/Favicon ON LIGHT.svg" alt="HiddenGem Media" className="mx-auto size-11" draggable={false} />
                <h1 className={cx(T.section, "mt-5 text-primary")}>Team sign-in</h1>
                <p className={cx(T.helper, "mt-2 text-pretty text-tertiary")}>Client requests are for the HiddenGem Media team. Sign in with your hiddengem.media Google account.</p>
                <PrimaryButton onClick={signIn} disabled={busy} className="mt-6 w-full">
                    {busy ? "Opening Google..." : "Sign in with Google"}
                </PrimaryButton>
            </div>
        </div>
    );
};

const useTeam = () => {
    const { user, loading } = useAuthUser();
    const email = (user?.email ?? "").trim().toLowerCase();
    const isTeam = /@hiddengem\.media$/.test(email);
    return { email, isTeam, loading };
};

/* ── the list ────────────────────────────────────────────────────────────── */

const PriorityPill = ({ value }: { value: Priority | null | undefined }) => {
    const m = priorityMeta(value);
    if (!m) return null;
    return <span className={cx("inline-flex items-center rounded-full px-3 py-1.5 whitespace-nowrap", T.caption, m.pill)}>{m.label}</span>;
};

const LIST_FILTERS: { key: "all" | "open" | TicketStatus; label: string }[] = [
    { key: "all", label: "All" },
    { key: "open", label: "Open" },
    { key: "in_progress", label: "In progress" },
    { key: "completed", label: "Completed" },
    { key: "withdrawn", label: "Withdrawn" },
];
const OPEN: TicketStatus[] = ["received", "assigned", "in_progress"];
const matches = (t: Ticket, f: (typeof LIST_FILTERS)[number]["key"]) => (f === "all" ? true : f === "open" ? OPEN.includes(t.status) : t.status === f);

const dueLine = (t: Ticket): string => {
    if (t.status === "withdrawn") return t.withdrawn_at ? `Withdrawn ${formatStampShort(t.withdrawn_at)}` : "Withdrawn";
    if (t.status === "completed") return t.completed_at ? `Completed ${formatStampShort(t.completed_at)}` : "Completed";
    if (t.promised_date) return `Due ${formatStampShort(t.promised_date)}`;
    return t.needed_by ? `Asked for by ${formatStampShort(t.needed_by)}` : "";
};

export const TeamTicketsScreen = () => {
    const { email, isTeam, loading: authLoading } = useTeam();
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [total, setTotal] = useState(0);
    const [next, setNext] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [filter, setFilter] = useState<(typeof LIST_FILTERS)[number]["key"]>("all");
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

    const clients = useMemo(() => {
        const seen = new Map<string, string>();
        for (const t of tickets) if (t.client_slug) seen.set(t.client_slug, (t.client_name ?? "").trim() || t.client_slug.replace(/-dashboard$/, ""));
        return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
    }, [tickets]);
    const shown = tickets.filter((t) => matches(t, filter) && (!client || t.client_slug === client));
    const openCount = tickets.filter((t) => OPEN.includes(t.status)).length;

    if (authLoading) return null;
    if (!isTeam) return <TeamGate />;

    return (
        <TeamShell email={email}>
            <div className="flex flex-col gap-4 sm:gap-6">
                <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col gap-1">
                        <Eyebrow>Reporting System</Eyebrow>
                        <h1 className={cx("text-primary", T.title, "sm:text-[40px] sm:leading-[44px] sm:tracking-[-1px]")}>Client requests</h1>
                        <p className={cx("text-tertiary", T.body, "sm:text-[13px] sm:leading-[18px]")}>
                            {total} {total === 1 ? "request" : "requests"} across every client. {openCount} open.
                        </p>
                    </div>
                    <PrimaryButton as="link" to="/team/tickets/new" className="w-full sm:w-auto">
                        Report a ticket
                    </PrimaryButton>
                </header>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div role="group" aria-label="Filter by status" className="flex flex-wrap items-center gap-2">
                        {LIST_FILTERS.map((f) => {
                            const active = f.key === filter;
                            const n = tickets.filter((t) => matches(t, f.key)).length;
                            return (
                                <button
                                    key={f.key}
                                    type="button"
                                    aria-pressed={active}
                                    onClick={() => setFilter(f.key)}
                                    className={cx(
                                        "inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 whitespace-nowrap ring-1 transition duration-100 ease-linear motion-reduce:transition-none",
                                        T.helper,
                                        FOCUS,
                                        active ? "bg-brand-primary text-fg-brand-primary ring-brand" : "bg-primary text-secondary ring-secondary hover:bg-primary_hover",
                                    )}
                                >
                                    {f.label}
                                    <span className={cx("tabular-nums", active ? "text-fg-brand-primary" : "text-tertiary")}>{n}</span>
                                </button>
                            );
                        })}
                    </div>
                    <label className="flex items-center gap-2">
                        <span className={cx(T.helper, "text-tertiary")}>Client</span>
                        <select
                            value={client}
                            onChange={(e) => setClient(e.target.value)}
                            className={cx("h-11 rounded-lg bg-primary px-3 text-primary ring-1 ring-primary outline-none focus:ring-2 focus:ring-brand", T.helper)}
                        >
                            <option value="">Every client</option>
                            {clients.map(([slug, name]) => (
                                <option key={slug} value={slug}>
                                    {name}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>

                {error && <ErrorNote message={error} onRetry={() => void load()} />}

                {loading && tickets.length === 0 ? (
                    <HelpSpinner label="Loading every client's requests" />
                ) : shown.length === 0 ? (
                    <Panel className="px-5 py-12 text-center">
                        <p className={cx(T.label, "text-primary")}>Nothing here</p>
                        <p className={cx(T.helper, "mx-auto mt-1.5 max-w-[42ch] text-pretty text-tertiary")}>No request matches that filter. Raise one with the button above.</p>
                    </Panel>
                ) : (
                    <ul className={cx("flex flex-col gap-3", "sm:gap-0 sm:overflow-hidden sm:rounded-xl sm:bg-primary sm:ring-1 sm:ring-secondary", "sm:shadow-[0_1px_2px_rgba(23,23,23,0.04),0_8px_24px_-4px_rgba(23,23,23,0.05)]")}>
                        {shown.map((t, i) => {
                            const clientName = (t.client_name ?? "").trim() || (t.client_slug ?? "").replace(/-dashboard$/, "");
                            const short = (t.client_slug ?? "").replace(/-dashboard$/, "");
                            const due = dueLine(t);
                            return (
                                <li key={t.id} className={cx(i > 0 && "sm:border-t sm:border-secondary")}>
                                    <Link
                                        to={`/${short}/help/requests/${t.reference}`}
                                        className={cx(
                                            "block rounded-xl bg-primary p-4 ring-1 ring-secondary transition duration-100 ease-linear hover:bg-primary_hover motion-reduce:transition-none",
                                            "sm:rounded-none sm:px-5 sm:py-4 sm:ring-0",
                                            i % 2 === 1 && "sm:bg-secondary sm:hover:bg-tertiary",
                                            FOCUS,
                                        )}
                                    >
                                        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-4">
                                            <div className="min-w-0 flex-1">
                                                <p className={cx(T.label, "text-primary")}>
                                                    <span className="text-fg-brand-primary">{clientName}</span>
                                                    {"  "}
                                                    <MetaDot />
                                                    {"  "}
                                                    {t.title}
                                                </p>
                                                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                                                    <MonoRef>{t.reference}</MonoRef>
                                                    <span className={cx(T.helper, "text-tertiary")}>
                                                        {t.topic.charAt(0).toUpperCase() + t.topic.slice(1)}
                                                        {"  "}
                                                        <MetaDot />
                                                        {"  "}
                                                        {formatStampShort(t.created_at)}
                                                        {(t.submitted_by_name ?? "").trim() ? ` by ${t.submitted_by_name!.trim()}` : ""}
                                                        {(t.assignee_name ?? "").trim() ? `  ·  with ${t.assignee_name!.trim()}` : ""}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between gap-2 sm:justify-end">
                                                {due && <span className={cx(T.helper, "text-secondary sm:text-right")}>{due}</span>}
                                                <span className="flex items-center gap-2">
                                                    <PriorityPill value={t.priority} />
                                                    <StatusPill status={t.status} />
                                                </span>
                                            </div>
                                        </div>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                )}

                {next && !loading && (
                    <div className="flex justify-center">
                        <SecondaryButton onClick={() => void load(next)}>Show older requests</SecondaryButton>
                    </div>
                )}
            </div>
        </TeamShell>
    );
};

/* ── Report a ticket ─────────────────────────────────────────────────────── */

export const TeamReportScreen = () => {
    const { email, isTeam, loading: authLoading } = useTeam();
    const navigate = useNavigate();
    const [clients, setClients] = useState<ClientOption[]>([]);
    const [topics, setTopics] = useState<TicketTopic[]>([]);
    const [done, setDone] = useState<{ reference: string; slug: string; title: string; clientName: string; priority: Priority | null } | null>(null);

    useEffect(() => {
        if (isTeam) void fetchClientOptions().then(setClients);
    }, [isTeam]);

    // Topics are global rows; the endpoint needs a slug only to prove who is asking, so
    // they are fetched once a client is chosen.
    const onClientChange = (slug: string) => {
        setTopics([]);
        if (slug) void fetchTopics({ slug, email }).then((r) => setTopics(r.topics ?? []));
    };

    if (authLoading) return null;
    if (!isTeam) return <TeamGate />;

    if (done) {
        return (
            <TeamShell email={email}>
                <RequestSent
                    reference={done.reference}
                    title={done.title}
                    clientName={done.clientName}
                    priority={done.priority}
                    team
                    primary={{ label: "Report another ticket", onClick: () => setDone(null) }}
                    secondary={{ label: "All requests", onClick: () => navigate("/team/tickets") }}
                />
            </TeamShell>
        );
    }

    return (
        <TeamShell email={email}>
            <div className="mx-auto flex w-full max-w-[560px] flex-col gap-6">
                <TextLink to="/team/tickets" className="w-max">
                    <ArrowNarrowLeft className="size-4" aria-hidden="true" />
                    All requests
                </TextLink>
                <RequestForm
                    mode="team"
                    clients={clients}
                    topics={topics}
                    clientName=""
                    email={email}
                    onClientChange={onClientChange}
                    onSubmit={async (input) => {
                        const res = await createTicket({ slug: input.slug, email }, input);
                        return { reference: res.ticket.reference };
                    }}
                    onCreated={(reference, slug, sent) =>
                        setDone({
                            reference,
                            slug: slug.replace(/-dashboard$/, ""),
                            title: sent.title,
                            clientName: clients.find((c) => c.slug === slug)?.name ?? slug.replace(/-dashboard$/, ""),
                            priority: sent.priority,
                        })
                    }
                />
            </div>
        </TeamShell>
    );
};
