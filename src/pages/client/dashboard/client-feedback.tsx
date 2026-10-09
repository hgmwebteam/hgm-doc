import { type FC, useEffect, useState } from "react";
import { Check, CheckCircle, Edit03, MessageChatCircle, XCircle } from "@untitledui/icons";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Key as AriaKey } from "react-aria-components";
import { Tab, TabList, TabPanel, Tabs } from "@/components/application/tabs/tabs";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import type { Suggestion } from "@/pages/client/dashboard/suggestions-model";
import { cx } from "@/utils/cx";

/**
 * The plain client feedback box, and the team's list of what came back.
 *
 * One note per person per section: sending again replaces the open one, so a client never
 * has to hunt for what they said last. Both halves ride `dashboard_suggestions` under a
 * per-section key family (see suggestions-model.ts) — the same table, function and review
 * loop as a Master Document edit, which is why nothing here talks to Supabase itself. The
 * section owns every read and write; this only renders and calls back.
 *
 * Shared by the Welcome Email Flow (in a sticky rail beside the previews) and the Landing
 * Page (a card under the preview, which is one full-width frame with no room beside it).
 * The box renders the card only — its caller positions it, so a new section can drop it
 * anywhere without inheriting either of those layouts.
 */

/** What a section hands the box so a client can comment and the team can close it. */
export interface ClientFeedbackProps {
    /** "client" = may send; "review" = team reads and resolves; "off" = nothing shown. */
    mode: "off" | "client" | "review";
    /** Every note on this section for this dashboard, newest first, open and closed alike. */
    items: Suggestion[];
    /** The address a new note is stamped with; empty means the viewer can't send. */
    author: string;
    /** Sends (or replaces) the author's one open note. */
    send: (text: string) => Promise<void>;
    withdraw: (s: Suggestion) => Promise<void>;
    /** "accepted" reads as done, "declined" as dismissed — nothing is applied anywhere. */
    resolve: (s: Suggestion, status: "accepted" | "declined") => Promise<void>;
}

export const shortDate = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

/** "Sep 14 at 2:31 PM" — a sent note says exactly when it went, not just the day. */
const sentStamp = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return `${shortDate(iso)} at ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
};

/**
 * The client's box. Renders nothing unless `mode` is "client", so a caller can hand it the
 * same props it gives the review list and let this decide.
 *
 * Two faces, because an open textarea is the wrong answer to "I already told you": the
 * compose form until a note is sent, then a receipt — what was sent, when, and what happens
 * next — with Edit reopening the form. The receipt is the resting state, so a client who
 * comes back tomorrow still sees their note landed; the old confirmation line timed out
 * after six seconds and left the page looking like nothing had happened.
 */
export const ClientFeedbackBox = ({
    feedback,
    placeholder,
    title = "Your feedback",
    rows = 6,
}: {
    feedback: ClientFeedbackProps;
    placeholder: string;
    /** Names what this note is about — the Welcome Flow passes the email it belongs to. */
    title?: string;
    rows?: number;
}) => {
    const pending = feedback.items.filter((s) => s.status === "pending");
    /** The viewer's own open note — the box edits it in place. */
    const mine = pending.find((s) => s.suggested_by === feedback.author);
    /** The viewer's most recent closed note, for the "what happened" line. */
    const resolved = feedback.items.find((s) => s.status !== "pending" && s.suggested_by === feedback.author);

    const [text, setText] = useState("");
    const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
    const [error, setError] = useState("");
    /** Reopens the form over a sent note. Cleared whenever the open note changes. */
    const [editing, setEditing] = useState(false);
    /** Withdraw confirms in place rather than in a dialog — it's one quiet link, not a verdict. */
    const [confirmWithdraw, setConfirmWithdraw] = useState(false);

    // Tracks the viewer's open note, which changes right after a send (the refresh brings
    // the new row back). Keyed on the row id alone so typing is never interrupted, and so
    // the send's own refresh doesn't wipe the "Sent" confirmation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        setText(mine?.suggested_value ?? "");
        setEditing(false);
        setConfirmWithdraw(false);
    }, [mine?.id]);

    if (feedback.mode !== "client") return null;

    const submit = async () => {
        const body = text.trim();
        if (!body) return;
        setState("sending");
        setError("");
        try {
            await feedback.send(body);
            setState("sent");
            setEditing(false);
            window.setTimeout(() => setState((s) => (s === "sent" ? "idle" : s)), 6000);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong. Nothing was sent.");
            setState("error");
        }
    };

    const card = "rounded-2xl bg-primary p-4 ring-1 ring-secondary md:p-5";

    /* ── Sent: the receipt ──
       What they wrote, when it went, and who has it now. No textarea, because there is
       nothing to write until they decide to change something — Edit brings it back. */
    if (mine && !editing) {
        return (
            <div className={card}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-primary">{title}</p>
                    <span className="rounded-full bg-warning-primary px-2.5 py-1 text-xs font-medium text-warning-primary">Awaiting review</span>
                </div>

                <div
                    className={cx(
                        "mt-3 flex gap-2.5 rounded-xl bg-success-primary p-3",
                        state === "sent" && "duration-200 animate-in fade-in slide-in-from-bottom-1 motion-reduce:animate-none",
                    )}
                >
                    <Check className="mt-0.5 size-4 shrink-0 text-success-primary" />
                    <div>
                        <p className="text-sm font-medium text-primary">Thanks — we have your feedback.</p>
                        <p className="mt-0.5 text-sm text-tertiary">Your account manager reads this and will come back to you.</p>
                    </div>
                </div>

                {/* Their own words, quoted back. Seeing it is the reassurance, and it makes
                    Edit honest — they can tell what they are about to change. */}
                <blockquote className="mt-3 border-l-2 border-brand pl-3 text-sm whitespace-pre-wrap text-secondary">{mine.suggested_value}</blockquote>
                <p className="mt-2 text-xs text-quaternary">Sent {sentStamp(mine.created_at)}</p>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                    <Button size="sm" color="secondary" iconLeading={Edit03} onClick={() => setEditing(true)}>
                        Edit feedback
                    </Button>
                    {confirmWithdraw ? (
                        <span className="flex items-center gap-2 text-sm text-tertiary">
                            Delete this?
                            <button
                                type="button"
                                onClick={() => void feedback.withdraw(mine).catch(() => undefined)}
                                className="font-semibold text-error-primary transition duration-100 ease-linear hover:underline"
                            >
                                Yes, delete
                            </button>
                            <button
                                type="button"
                                onClick={() => setConfirmWithdraw(false)}
                                className="font-semibold text-tertiary transition duration-100 ease-linear hover:text-primary"
                            >
                                Keep it
                            </button>
                        </span>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setConfirmWithdraw(true)}
                            className="text-sm font-semibold text-tertiary transition duration-100 ease-linear hover:text-error-primary"
                        >
                            Withdraw
                        </button>
                    )}
                </div>
            </div>
        );
    }

    /* ── Compose: nothing open, or editing what is ── */
    return (
        <div className={card}>
            <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm font-semibold text-primary">{title}</p>
                {editing && <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary">Editing</span>}
            </div>

            {/* A closed note is answered here rather than in a footnote — the client asked for
                something, someone dealt with it, and that deserves a line of its own. */}
            {!editing && resolved && (
                <div className="mt-3 flex gap-2.5 rounded-xl bg-secondary p-3">
                    <CheckCircle className="mt-0.5 size-4 shrink-0 text-success-primary" />
                    <div>
                        <p className="text-sm font-medium text-primary">
                            {resolved.status === "accepted" ? "Your last note is done" : "Your last note was closed"}
                            {resolved.resolved_at ? ` — ${shortDate(resolved.resolved_at)}` : ""}
                        </p>
                        <p className="mt-0.5 text-sm text-tertiary">Anything else you'd change? Write it below.</p>
                    </div>
                </div>
            )}

            <textarea
                rows={rows}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={placeholder}
                className="mt-3 w-full resize-y rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-primary transition duration-100 ease-linear outline-none placeholder:text-placeholder focus:border-brand focus:ring-1 focus:ring-brand"
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button
                    size="sm"
                    color="primary"
                    onClick={() => void submit()}
                    isDisabled={!text.trim() || text.trim() === (mine?.suggested_value ?? "")}
                    isLoading={state === "sending"}
                    showTextWhileLoading
                >
                    {mine ? "Update feedback" : "Send feedback"}
                </Button>
                {editing && (
                    <button
                        type="button"
                        onClick={() => {
                            setText(mine?.suggested_value ?? "");
                            setEditing(false);
                        }}
                        className="text-sm font-semibold text-tertiary transition duration-100 ease-linear hover:text-primary"
                    >
                        Cancel
                    </button>
                )}
            </div>
            {/* Status sits under the button rather than beside it — at rail width a sentence
                next to the button wrapped to three lines. */}
            {state === "error" && <p className="mt-2.5 text-sm text-error-primary">{error}</p>}
            {!editing && !resolved && <p className="mt-2.5 text-xs text-quaternary">Only your account manager sees this.</p>}
        </div>
    );
};

/**
 * The team's side: every open note on this section, read and closed here. Renders nothing
 * unless `mode` is "review" or there is nothing open, so it can sit unconditionally in a
 * section body.
 *
 * `labelFor` adds a per-note suffix where a section has one worth showing (the Welcome Flow
 * names the email a legacy per-email note was written about). Return null for no suffix.
 */
export const ClientFeedbackReview = ({ feedback, labelFor }: { feedback: Omit<ClientFeedbackProps, "send">; labelFor?: (s: Suggestion) => string | null }) => {
    if (feedback.mode !== "review") return null;
    const pending = feedback.items.filter((s) => s.status === "pending");
    if (pending.length === 0) return null;

    return (
        <div className="flex flex-col gap-2">
            {pending.map((s) => {
                const label = labelFor?.(s) ?? null;
                return (
                    <div key={s.id} className="rounded-xl bg-brand-primary p-3.5 ring-1 ring-secondary">
                        <p className="text-xs font-medium text-secondary">
                            Client feedback · {s.suggested_by} · {shortDate(s.created_at)}
                            {label && <span> · {label}</span>}
                        </p>
                        <p className="mt-1 text-sm whitespace-pre-wrap text-primary">{s.suggested_value}</p>
                        <div className="mt-2.5 flex items-center gap-2">
                            <Button size="sm" color="primary" onClick={() => void feedback.resolve(s, "accepted")}>
                                Mark as done
                            </Button>
                            <Button size="sm" color="secondary" onClick={() => void feedback.resolve(s, "declined")}>
                                Dismiss
                            </Button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

/* ── Open and Done, in one place ─────────────────────────────────────────────
   ClientFeedbackReview above shows open notes only, so a note marked done vanished: the
   row was kept in dashboard_suggestions (status, resolved_by, resolved_at) but nothing on
   the page could show it again. This panel keeps both halves in one card behind two tabs,
   each with its count, so the open ones stay first and what was already handled is one
   click away. Used by the Landing Page's Client review card (2026-10-09); the other
   sections still use ClientFeedbackReview and can move over by swapping the component. */

/** A closed item from outside dashboard_suggestions that belongs in the same history, such
 *  as the client's verdict on an older landing-page version. */
export interface PastVerdict {
    id: string;
    /** "Changes requested on v1", "Approved v2". */
    title: string;
    /** What the client wrote, when there was anything. */
    text?: string;
    by?: string;
    at?: string;
    kind: "changes" | "approved";
}

type HistoryItem = {
    id: string;
    icon: FC<{ className?: string }>;
    iconClass: string;
    heading: string;
    text?: string;
    footer: string;
    /** When it was written, shown on the right. */
    shownAt?: string;
    /** When it was closed, for the order: newest first. */
    sortAt: string;
};

/** How many closed items show before "Show all". */
const HISTORY_STEP = 5;

/** "ananya@hiddengem.media" → "Ananya": the team member who closed a note, by first name. */
const firstNameOf = (email?: string | null) => {
    const local = (email ?? "").split("@")[0] ?? "";
    return local ? local.charAt(0).toUpperCase() + local.slice(1) : "";
};

/** Every closed note and past verdict, newest first, in one shape. Pure. */
export const historyOf = (items: Suggestion[], verdicts: PastVerdict[], labelFor?: (s: Suggestion) => string | null): HistoryItem[] => {
    const notes: HistoryItem[] = items
        .filter((s) => s.status !== "pending")
        .map((s) => {
            const done = s.status === "accepted";
            const who = firstNameOf(s.resolved_by);
            const when = s.resolved_at ? shortDate(s.resolved_at) : "";
            const label = labelFor?.(s) ?? null;
            return {
                id: s.id,
                icon: done ? CheckCircle : XCircle,
                iconClass: done ? "text-fg-success-secondary" : "text-fg-quaternary",
                heading: label ? `${s.suggested_by}, ${label}` : s.suggested_by,
                text: s.suggested_value,
                footer: [done ? "Marked done" : "Dismissed", who && `by ${who}`, when && `on ${when}`].filter(Boolean).join(" "),
                shownAt: s.created_at,
                sortAt: s.resolved_at ?? s.created_at,
            };
        });
    const past: HistoryItem[] = verdicts.map((v) => ({
        id: v.id,
        icon: v.kind === "approved" ? CheckCircle : MessageChatCircle,
        iconClass: v.kind === "approved" ? "text-fg-success-secondary" : "text-fg-quaternary",
        heading: v.title,
        text: v.text,
        footer: v.by ? `From ${v.by}` : "",
        shownAt: v.at,
        sortAt: v.at ?? "",
    }));
    return [...notes, ...past].sort((a, b) => b.sortAt.localeCompare(a.sortAt));
};

/** One open note: what the client wrote, and the two ways to close it. */
const OpenNote = ({
    s,
    label,
    resolve,
}: {
    s: Suggestion;
    label: string | null;
    resolve: (s: Suggestion, status: "accepted" | "declined") => Promise<void>;
}) => {
    const [busy, setBusy] = useState<"accepted" | "declined" | null>(null);
    const act = async (status: "accepted" | "declined") => {
        setBusy(status);
        try {
            await resolve(s, status);
        } finally {
            setBusy(null);
        }
    };
    return (
        <div className="rounded-xl bg-secondary p-3.5">
            <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 truncate text-sm font-medium text-secondary">
                    {s.suggested_by}
                    {label && <span className="font-normal text-tertiary">, {label}</span>}
                </p>
                <p className="shrink-0 text-xs text-quaternary">{sentStamp(s.created_at)}</p>
            </div>
            <p className="mt-1.5 text-sm whitespace-pre-wrap text-primary">{s.suggested_value}</p>
            <div className="mt-3 flex items-center gap-2">
                {/* Secondary, not primary: with several notes open, a solid button on each
                    out-shouts the notes themselves. The words lead; the action sits under them. */}
                <Button
                    size="sm"
                    color="secondary"
                    iconLeading={Check}
                    isLoading={busy === "accepted"}
                    showTextWhileLoading
                    isDisabled={busy !== null}
                    onClick={() => void act("accepted")}
                >
                    Mark as done
                </Button>
                <Button
                    size="sm"
                    color="tertiary"
                    isLoading={busy === "declined"}
                    showTextWhileLoading
                    isDisabled={busy !== null}
                    onClick={() => void act("declined")}
                >
                    Dismiss
                </Button>
            </div>
        </div>
    );
};

/** One closed item: quieter than an open note, its outcome on the last line. */
const DoneNote = ({ item }: { item: HistoryItem }) => {
    const [expanded, setExpanded] = useState(false);
    const text = item.text?.trim() ?? "";
    const long = text.length > 220 || text.split("\n").length > 3;
    const Icon = item.icon;
    return (
        <div className="flex gap-3 py-3.5 first:pt-1 last:pb-1">
            <Icon className={cx("mt-0.5 size-4 shrink-0", item.iconClass)} aria-hidden="true" />
            <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                    <p className="min-w-0 truncate text-sm font-medium text-secondary">{item.heading}</p>
                    {item.shownAt && <p className="shrink-0 text-xs text-quaternary">{shortDate(item.shownAt)}</p>}
                </div>
                {text && <p className={cx("mt-1 text-sm whitespace-pre-wrap text-tertiary", !expanded && long && "line-clamp-3")}>{text}</p>}
                {long && (
                    <button
                        type="button"
                        onClick={() => setExpanded((v) => !v)}
                        className="mt-1 text-xs font-semibold text-tertiary transition duration-100 ease-linear hover:text-primary"
                    >
                        {expanded ? "Show less" : "Show more"}
                    </button>
                )}
                {item.footer && <p className="mt-1.5 text-xs text-quaternary">{item.footer}</p>}
            </div>
        </div>
    );
};

const EmptyNote = ({ title, body }: { title: string; body: string }) => (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-secondary px-4 py-7 text-center">
        <p className="text-sm font-medium text-secondary">{title}</p>
        <p className="max-w-xs text-sm text-pretty text-tertiary">{body}</p>
    </div>
);

/** The open count turns brand while anything waits, so the tab that needs action reads first. */
const TabCount = ({ n, waiting = false }: { n: number; waiting?: boolean }) => (
    <Badge size="sm" type="pill-color" color={waiting && n > 0 ? "brand" : "gray"} className="-my-px tabular-nums">
        {String(n)}
    </Badge>
);

/**
 * The team's comment panel: Open (to act on) and Done (what was already handled), with
 * past verdicts from outside the table folded into Done. Renders nothing unless `mode` is
 * "review". It renders the body only: the caller puts it inside its own card.
 */
export const ClientFeedbackTabs = ({
    feedback,
    pastVerdicts = [],
    labelFor,
}: {
    feedback: Omit<ClientFeedbackProps, "send">;
    pastVerdicts?: PastVerdict[];
    labelFor?: (s: Suggestion) => string | null;
}) => {
    const reduceMotion = useReducedMotion();
    /** Null until the viewer picks a tab, so the default can follow the data as it loads. */
    const [picked, setPicked] = useState<AriaKey | null>(null);
    const [shown, setShown] = useState(HISTORY_STEP);

    if (feedback.mode !== "review") return null;

    const open = feedback.items.filter((s) => s.status === "pending");
    const history = historyOf(feedback.items, pastVerdicts, labelFor);
    // Open first while anything is waiting; otherwise the history, if there is one.
    const selected = picked ?? (open.length > 0 || history.length === 0 ? "open" : "done");

    return (
        <Tabs selectedKey={selected} onSelectionChange={setPicked}>
            <TabList type="button-minimal" size="sm" fullWidth aria-label="Client comments">
                <Tab id="open">
                    Open <TabCount n={open.length} waiting />
                </Tab>
                <Tab id="done">
                    Done <TabCount n={history.length} />
                </Tab>
            </TabList>

            <TabPanel id="open" className="mt-4">
                {open.length === 0 ? (
                    <EmptyNote title="No open comments" body="New comments from the client show up here." />
                ) : (
                    <ul className="flex flex-col gap-2">
                        {/* A note leaving for Done fades out where it is, then the rest close
                            the gap, so the list never jumps. Opacity only under reduced motion. */}
                        <AnimatePresence initial={false} mode="popLayout">
                            {open.map((s) => (
                                <motion.li
                                    key={s.id}
                                    layout={!reduceMotion}
                                    exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
                                    transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                                >
                                    <OpenNote s={s} label={labelFor?.(s) ?? null} resolve={feedback.resolve} />
                                </motion.li>
                            ))}
                        </AnimatePresence>
                    </ul>
                )}
            </TabPanel>

            <TabPanel id="done" className="mt-4">
                {history.length === 0 ? (
                    <EmptyNote title="Nothing here yet" body="Comments you mark as done or dismiss stay here, so you can look back at them." />
                ) : (
                    <>
                        <ul className="flex flex-col divide-y divide-secondary">
                            {history.slice(0, shown).map((item) => (
                                <li key={item.id}>
                                    <DoneNote item={item} />
                                </li>
                            ))}
                        </ul>
                        {history.length > shown && (
                            <Button color="link-gray" size="sm" className="mt-3" onClick={() => setShown(history.length)}>
                                {`Show all ${history.length}`}
                            </Button>
                        )}
                    </>
                )}
            </TabPanel>
        </Tabs>
    );
};
