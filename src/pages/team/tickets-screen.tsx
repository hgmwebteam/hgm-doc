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
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowNarrowLeft, Image01, UploadCloud02, XClose } from "@untitledui-pro/icons/line";
import { Link, useNavigate } from "react-router";
import { useAuthUser } from "@/hooks/use-auth-user";
import { supabase } from "@/lib/supabase";
import {
    type ClientOption,
    HelpApiError,
    MAX_DETAIL,
    MAX_IMAGES,
    MAX_TITLE,
    type TicketImage,
    createTicket,
    fetchAllTickets,
    fetchClientOptions,
    fetchTopics,
    prepareImages,
} from "@/pages/client/help/help-api";
import { PriorityField } from "@/pages/client/help/help-center-screen";
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
        <div className="min-h-dvh bg-primary">
            <a href="#team-main" className={cx("sr-only rounded-lg bg-brand-solid px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50", T.label, FOCUS)}>
                Skip to content
            </a>
            <header className="border-b border-secondary bg-primary">
                <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
                    <Link to="/dashboard" className={cx("inline-flex h-11 items-center gap-2.5 rounded", FOCUS)} aria-label="Back to the team dashboard">
                        <GemMark />
                        <span className={cx(T.label, "text-primary")}>
                            <span className="sm:hidden">HiddenGem</span>
                            <span className="hidden sm:inline">HiddenGem Media</span>
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
                <p className={cx(T.helper, "mt-2 text-pretty text-tertiary")}>Client requests are for the HiddenGem team. Sign in with your hiddengem.media Google account.</p>
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

/** The Figma's Banner component: icon, title in label/field, body in body/helper, on a tint with a hairline in its colour. */
const Banner = ({ kind, title, body }: { kind: "error" | "success" | "info"; title: string; body: string }) => (
    <div
        role={kind === "error" ? "alert" : "status"}
        className={cx(
            "flex items-start gap-3 rounded-[10px] px-4 py-3 ring-1",
            kind === "error" && "bg-red-50 ring-red-600",
            kind === "success" && "bg-green-50 ring-green-700",
            kind === "info" && "bg-brand-primary ring-brand",
        )}
    >
        <span aria-hidden="true" className={cx("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ring-[1.8px]", kind === "error" ? "ring-red-600 text-red-700" : kind === "success" ? "ring-green-700 text-green-800" : "ring-brand text-fg-brand-primary")}>
            <span className={cx(T.caption, "leading-none")}>{kind === "error" ? "!" : kind === "success" ? "✓" : "i"}</span>
        </span>
        <div className="min-w-0 flex-1">
            <p className={cx(T.label, "text-primary")}>{title}</p>
            <p className={cx(T.helper, "mt-1 text-pretty text-secondary")}>{body}</p>
        </div>
    </div>
);

const fieldClass = (invalid?: boolean) =>
    cx("w-full rounded-lg bg-primary px-3.5 py-3 text-primary ring-1 outline-none placeholder:text-tertiary focus:ring-2 focus:ring-brand", T.body, invalid ? "ring-error" : "ring-primary");

const LabelRow = ({ htmlFor, children, optional }: { htmlFor: string; children: React.ReactNode; optional?: boolean }) => (
    <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className={cx(T.label, "text-secondary")}>
            {children}
        </label>
        <span className={cx(T.caption, "text-tertiary")}>{optional ? "Optional" : "Required"}</span>
    </div>
);

export const TeamReportScreen = () => {
    const { email, isTeam, loading: authLoading } = useTeam();
    const navigate = useNavigate();
    const [clients, setClients] = useState<ClientOption[]>([]);
    const [topics, setTopics] = useState<TicketTopic[]>([]);
    const [client, setClient] = useState("");
    const [topic, setTopic] = useState("");
    const [priority, setPriority] = useState<Priority | null>(null);
    const [text, setText] = useState("");
    const [images, setImages] = useState<TicketImage[]>([]);
    const [imageNotes, setImageNotes] = useState<string[]>([]);
    const [preparing, setPreparing] = useState(false);
    const [busy, setBusy] = useState(false);
    const [touched, setTouched] = useState(false);
    const [error, setError] = useState("");
    const [done, setDone] = useState<{ reference: string; slug: string } | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!isTeam) return;
        void fetchClientOptions().then(setClients);
    }, [isTeam]);
    // Topics come from any dashboard's topic list: they are global rows, and the
    // endpoint needs a slug only to prove who is asking.
    useEffect(() => {
        if (!isTeam || !client) return;
        void fetchTopics({ slug: client, email }).then((r) => {
            setTopics(r.topics ?? []);
            if (!topic && r.topics?.[0]) setTopic(r.topics[0].key);
        });
    }, [isTeam, client, email, topic]);

    // The Figma's textarea: "Start with one line that says what is wrong. That line becomes
    // the Asana task title; everything after it becomes the task description."
    const [firstLine, rest] = useMemo(() => {
        const lines = text.replace(/\r/g, "").split("\n");
        const head = (lines[0] ?? "").trim();
        const tail = lines.slice(1).join("\n").trim();
        return [head, tail];
    }, [text]);

    const clientError = touched && !client ? "Choose which client this is about, so it reaches the right team." : "";
    const priorityError = touched && !priority ? "Pick a priority, so it is worked in the right order." : "";
    const textError = touched && firstLine.length < 3 ? "Tell us what is happening. One line is enough to start; the team can ask for more." : "";
    const problems = [clientError, priorityError, textError].filter(Boolean).length;
    const canSubmit = !!client && !!topic && !!priority && firstLine.length >= 3 && !busy && !preparing;

    const onPickFiles = async (files: FileList | null) => {
        if (!files?.length) return;
        setPreparing(true);
        const { images: ready, rejected } = await prepareImages([...files]);
        setImages((prev) => [...prev, ...ready].slice(0, MAX_IMAGES));
        setImageNotes(rejected);
        setPreparing(false);
        if (fileRef.current) fileRef.current.value = "";
    };

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setTouched(true);
        if (!canSubmit) return;
        setBusy(true);
        setError("");
        try {
            const res = await createTicket(
                { slug: client, email },
                {
                    topic,
                    title: firstLine.slice(0, MAX_TITLE),
                    detail: (rest || firstLine).slice(0, MAX_DETAIL),
                    images,
                    priority: priority ?? undefined,
                },
            );
            setDone({ reference: res.ticket.reference, slug: client.replace(/-dashboard$/, "") });
        } catch (err) {
            setError(err instanceof HelpApiError ? err.message : "We could not send that just then. Nothing was lost - try again.");
            setBusy(false);
        }
    };

    if (authLoading) return null;
    if (!isTeam) return <TeamGate />;

    if (done) {
        return (
            <TeamShell email={email}>
                <div className="mx-auto flex w-full max-w-[560px] flex-col gap-6">
                    <Banner
                        kind="success"
                        title="Ticket sent"
                        body={`${done.reference} is stored and Jarvis has been told. It creates the Asana task and assigns it to whoever on the team has capacity; you will see it appear in Asana within a minute or two.`}
                    />
                    <div className="flex flex-col gap-3 sm:flex-row">
                        <PrimaryButton as="link" to={`/${done.slug}/help/requests/${done.reference}`}>
                            Open {done.reference}
                        </PrimaryButton>
                        <SecondaryButton onClick={() => navigate("/team/tickets")}>All requests</SecondaryButton>
                    </div>
                </div>
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

                <header className="flex flex-col gap-2">
                    <p className={cx(T.caption, "tracking-[1.2px] text-fg-brand-primary uppercase")}>Reporting System</p>
                    <h1 className={cx(T.title, "text-primary")}>Report a ticket</h1>
                    <p className={cx(T.body, "text-pretty text-secondary")}>
                        Tell us what is wrong and who it affects. Jarvis turns it into an Asana task and hands it to whoever on the team has capacity, so nothing
                        needs chasing.
                    </p>
                </header>

                {touched && problems > 0 && (
                    <Banner
                        kind="error"
                        title={problems === 1 ? "One thing needs fixing before this can go" : `${problems === 2 ? "Two" : "Three"} things need fixing before this can go`}
                        body="The fields are marked below."
                    />
                )}

                <form onSubmit={submit} noValidate className="flex flex-col gap-6">
                    <div className="flex flex-col gap-2">
                        <LabelRow htmlFor="tt-client">Client</LabelRow>
                        <select id="tt-client" value={client} onChange={(e) => setClient(e.target.value)} aria-invalid={!!clientError} className={cx(fieldClass(!!clientError), "h-12")}>
                            <option value="">Choose a client</option>
                            {clients.map((c) => (
                                <option key={c.slug} value={c.slug}>
                                    {c.name}
                                </option>
                            ))}
                        </select>
                        <p className={cx(T.helper, clientError ? "text-red-700" : "text-tertiary")} role={clientError ? "alert" : undefined}>
                            {clientError || "The client this ticket is for. Jarvis uses it to file the task in the right place."}
                        </p>
                    </div>

                    <div className="flex flex-col gap-2">
                        <LabelRow htmlFor="tt-topic">Topic</LabelRow>
                        <select id="tt-topic" value={topic} onChange={(e) => setTopic(e.target.value)} disabled={!client} className={cx(fieldClass(), "h-12 disabled:opacity-60")}>
                            {topics.length === 0 && <option value="">{client ? "Loading..." : "Choose a client first"}</option>}
                            {topics.map((t) => (
                                <option key={t.key} value={t.key}>
                                    {t.label}
                                </option>
                            ))}
                        </select>
                        <p className={cx(T.helper, "text-tertiary")}>Which team it goes to.</p>
                    </div>

                    <div className="flex flex-col gap-2">
                        <PriorityField value={priority} onChange={setPriority} required />
                        {priorityError && (
                            <p className={cx(T.helper, "text-red-700")} role="alert">
                                {priorityError}
                            </p>
                        )}
                    </div>

                    <div className="flex flex-col gap-2">
                        <LabelRow htmlFor="tt-images" optional>
                            Screenshots
                        </LabelRow>
                        <label
                            htmlFor="tt-images"
                            className="flex h-[132px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-primary bg-primary px-6 text-center transition duration-100 ease-linear hover:bg-secondary motion-reduce:transition-none"
                        >
                            <UploadCloud02 className="size-7 text-fg-brand-primary" aria-hidden="true" />
                            <span className={cx(T.label, "text-primary")}>{images.length ? "Add another screenshot" : "Drop screenshots here, or browse"}</span>
                            <span className={cx(T.helper, "text-tertiary")}>PNG, JPG or WEBP · shrunk in your browser · up to {MAX_IMAGES} files</span>
                        </label>
                        <input id="tt-images" ref={fileRef} type="file" accept="image/*" multiple onChange={(e) => void onPickFiles(e.target.files)} className="sr-only" />
                        {preparing && (
                            <p className={cx(T.helper, "text-tertiary")} role="status">
                                Preparing images...
                            </p>
                        )}
                        {images.length > 0 && (
                            <ul className="flex flex-wrap gap-2">
                                {images.map((img, i) => (
                                    <li key={`${img.name}-${i}`} className={cx("inline-flex items-center gap-1.5 rounded-lg bg-secondary py-1 pr-1 pl-2.5 text-secondary ring-1 ring-secondary", T.helper)}>
                                        <Image01 className="size-3.5 shrink-0 text-tertiary" aria-hidden="true" />
                                        <span className="max-w-[18ch] truncate">{img.name}</span>
                                        <button
                                            type="button"
                                            onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                                            aria-label={`Remove ${img.name}`}
                                            className={cx("flex size-6 items-center justify-center rounded-md text-tertiary hover:bg-primary_hover hover:text-primary", FOCUS)}
                                        >
                                            <XClose className="size-3.5" aria-hidden="true" />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {imageNotes.length > 0 && (
                            <ul className="flex flex-col gap-1" role="status">
                                {imageNotes.map((note) => (
                                    <li key={note} className={cx(T.helper, "text-red-700")}>
                                        {note}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div className="flex flex-col gap-2">
                        <LabelRow htmlFor="tt-text">Description</LabelRow>
                        <textarea
                            id="tt-text"
                            value={text}
                            onChange={(e) => setText(e.target.value.slice(0, MAX_DETAIL + MAX_TITLE))}
                            rows={7}
                            placeholder="What is happening, and where?"
                            aria-invalid={!!textError}
                            className={cx(fieldClass(!!textError), "resize-y")}
                        />
                        <p className={cx(T.helper, textError ? "text-red-700" : "text-tertiary")} role={textError ? "alert" : undefined}>
                            {textError || "Start with one line that says what is wrong. That line becomes the Asana task title; everything after it becomes the task description."}
                        </p>
                    </div>

                    {error && <ErrorNote message={error} />}

                    <div className="flex flex-col gap-3">
                        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                            <SecondaryButton onClick={() => navigate("/team/tickets")} disabled={busy} className="w-full sm:w-auto">
                                Cancel
                            </SecondaryButton>
                            <PrimaryButton type="submit" disabled={busy || preparing} className="w-full sm:w-auto sm:min-w-44">
                                {busy ? "Sending..." : "Send ticket"}
                            </PrimaryButton>
                        </div>
                        <p className={cx(T.helper, "text-pretty text-tertiary sm:text-right")}>
                            You will get a confirmation here, and the task appears in Asana within a couple of minutes.
                        </p>
                    </div>
                </form>
            </div>
        </TeamShell>
    );
};
