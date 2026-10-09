import { useEffect, useId, useRef, useState } from "react";
import { Check, CheckCircle, Edit03, XCircle, XClose } from "@untitledui/icons";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { type Key as AriaKey, Tab as AriaTab, TabList as AriaTabList, TabPanel as AriaTabPanel, Tabs as AriaTabs } from "react-aria-components";
import { Button } from "@/components/base/buttons/button";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
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
 * The client's box is shared by every section a client can comment on (Welcome Email Flow,
 * Landing Page, Example Reels, Pinned Stories, Pinned Posts); so is the team's side,
 * ClientFeedbackTabs below. Each renders its body only — the caller positions it, so a
 * section can drop it anywhere without inheriting another's layout.
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

/* ── Open and Feedback history ──────────────────────────────────────────────
   The team's side of every section's comments. Until 2026-10-09 it listed open notes only
   (ClientFeedbackReview), so a note marked done vanished: the row was kept in
   dashboard_suggestions (status, resolved_by, resolved_at) but nothing could show it again. This panel keeps every note in two tabs: Open, to act on,
   and Feedback history, everything already closed. A row is who and when on one line, the
   words, and how it ended; that last line leads with a green check for done or a grey X
   for dismissed, so the two separate at a glance inside one list. (Three tabs, Open / Done
   / Dismissed, were tried on 2026-10-09 and dropped as one tab too many.)

   Used by every section a client comments on: inside the Landing Page's Client review card,
   inside each Pinned Post, and as its own card (`framed`) on Welcome Emails, Example Reels
   and Pinned Stories, where `hideWhenEmpty` keeps a section with no comments free of an
   empty box. */

/** A closed item from outside dashboard_suggestions that belongs in the same history, such
 *  as the client's verdict on an older landing-page version: a newer version answered it. */
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
    kind: "done" | "dismissed" | "changes" | "approved";
    /** The name line: who wrote it, or what the verdict was. */
    heading: string;
    text?: string;
    /** Who closed it and when, after the outcome word: "by Ananya, Oct 6". For a verdict,
     *  who gave it: "From bsmith@…". */
    outcome: string;
    /** When it was written. */
    writtenAt?: string;
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

/** "just now", "12m ago", "3h ago", "2d ago", then the date. The exact time is the tooltip. */
const ago = (iso: string) => {
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return "";
    const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
    if (mins < 7 * 1440) return `${Math.round(mins / 1440)}d ago`;
    return shortDate(iso);
};

/** Every closed note and past verdict, newest first, in one shape. Pure. */
export const historyOf = (items: Suggestion[], verdicts: PastVerdict[], labelFor?: (s: Suggestion) => string | null): HistoryItem[] => {
    const notes: HistoryItem[] = items
        .filter((s) => s.status !== "pending")
        .map((s) => {
            const who = firstNameOf(s.resolved_by);
            const when = s.resolved_at ? shortDate(s.resolved_at) : "";
            const label = labelFor?.(s) ?? null;
            return {
                id: s.id,
                kind: s.status === "accepted" ? "done" : "dismissed",
                heading: label ? `${s.suggested_by}, ${label}` : s.suggested_by,
                text: s.suggested_value,
                outcome: [who && `by ${who}`, when].filter(Boolean).join(", "),
                writtenAt: s.created_at,
                sortAt: s.resolved_at ?? s.created_at,
            };
        });
    const past: HistoryItem[] = verdicts.map((v) => ({
        id: v.id,
        kind: v.kind,
        heading: v.title,
        text: v.text,
        outcome: v.by ? `From ${v.by}` : "",
        writtenAt: v.at,
        sortAt: v.at ?? "",
    }));
    return [...notes, ...past].sort((a, b) => b.sortAt.localeCompare(a.sortAt));
};

/** Who and when on one line; the time is relative, the exact one is on hover. */
const Byline = ({ heading, at, muted = false }: { heading: string; at?: string; muted?: boolean }) => (
    <div className="flex min-w-0 items-baseline gap-2">
        <p className={cx("min-w-0 truncate text-sm font-medium", muted ? "text-secondary" : "text-primary")}>{heading}</p>
        {at && (
            <time dateTime={at} title={sentStamp(at)} className="shrink-0 text-xs text-quaternary">
                {ago(at)}
            </time>
        )}
    </div>
);

/** One open note: who and when, the words, and the two ways to close it. The actions sit on
 *  the name line's right when the panel is wide, and drop under the words when it is narrow,
 *  so a long email address is never squeezed to a few letters. */
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
    const actions = (
        <div className="flex shrink-0 items-center gap-0.5">
            <Button
                size="xs"
                color="secondary"
                iconLeading={Check}
                isLoading={busy === "accepted"}
                showTextWhileLoading
                isDisabled={busy !== null}
                onClick={() => void act("accepted")}
            >
                Mark done
            </Button>
            <ButtonUtility size="xs" color="tertiary" icon={XClose} tooltip="Dismiss" isDisabled={busy !== null} onClick={() => void act("declined")} />
        </div>
    );
    return (
        <div>
            <div className="flex items-center justify-between gap-3">
                <Byline heading={s.suggested_by} at={s.created_at} />
                <div className="-my-1 hidden @md/comments:block">{actions}</div>
            </div>
            {label && <p className="text-xs text-quaternary">{label}</p>}
            <p className="mt-1 text-sm whitespace-pre-wrap text-secondary">{s.suggested_value}</p>
            <div className="mt-2.5 @md/comments:hidden">{actions}</div>
        </div>
    );
};

/** One closed item: the same shape as an open note, quieter, with who closed it last. */
const ClosedNote = ({ item }: { item: HistoryItem }) => {
    const [expanded, setExpanded] = useState(false);
    const text = item.text?.trim() ?? "";
    // "Show more" only when the clamp actually cuts something off: measured, not guessed
    // from length, so a note that fits in three lines never offers to show more of itself.
    const textRef = useRef<HTMLParagraphElement>(null);
    const [clipped, setClipped] = useState(false);
    useEffect(() => {
        const el = textRef.current;
        if (!el || expanded) return;
        const measure = () => setClipped(el.scrollHeight > el.clientHeight + 1);
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, [text, expanded]);
    return (
        <div>
            {/* How it ended sits on the name line's right when the panel is wide, like an open
                note's actions, and drops under the words when it is narrow. */}
            <div className="flex items-center justify-between gap-3">
                <Byline heading={item.heading} at={item.writtenAt} muted />
                <div className="hidden shrink-0 @md/comments:block">
                    <Outcome item={item} />
                </div>
            </div>
            {text && (
                <p ref={textRef} className={cx("mt-1 text-sm whitespace-pre-wrap text-tertiary", !expanded && "line-clamp-3")}>
                    {text}
                </p>
            )}
            {(clipped || expanded) && (
                <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    className="mt-0.5 text-xs font-semibold text-tertiary transition duration-100 ease-linear hover:text-primary"
                >
                    {expanded ? "Show less" : "Show more"}
                </button>
            )}
            <div className="mt-1.5 @md/comments:hidden">
                <Outcome item={item} />
            </div>
        </div>
    );
};

/** How a closed item ended. The marker and the word carry the colour (green check for done
 *  or approved, grey X for dismissed); who and when stay grey. A verdict that asked for
 *  changes has no marker, since its heading already says so. */
const Outcome = ({ item }: { item: HistoryItem }) => {
    const mark =
        item.kind === "done"
            ? { Icon: CheckCircle, word: "Done", cls: "text-success-primary", icon: "text-fg-success-secondary" }
            : item.kind === "approved"
              ? { Icon: CheckCircle, word: "Approved", cls: "text-success-primary", icon: "text-fg-success-secondary" }
              : item.kind === "dismissed"
                ? { Icon: XCircle, word: "Dismissed", cls: "text-tertiary", icon: "text-fg-quaternary" }
                : null;
    if (!mark && !item.outcome) return null;
    return (
        <p className="flex flex-wrap items-center gap-x-1 text-xs whitespace-nowrap text-quaternary">
            {mark && (
                <span className={cx("inline-flex items-center gap-1 font-semibold", mark.cls)}>
                    <mark.Icon className={cx("size-3.5 shrink-0", mark.icon)} aria-hidden="true" />
                    {mark.word}
                </span>
            )}
            {item.outcome && <span>{item.outcome}</span>}
        </p>
    );
};

/** The history list, five at a time until "Show all". */
const ClosedList = ({ items, empty }: { items: HistoryItem[]; empty: { title: string; body: string } }) => {
    const [shown, setShown] = useState(HISTORY_STEP);
    if (items.length === 0) return <EmptyNote {...empty} />;
    return (
        <>
            <ul className="flex flex-col gap-5">
                {items.slice(0, shown).map((item) => (
                    <li key={item.id}>
                        <ClosedNote item={item} />
                    </li>
                ))}
            </ul>
            {items.length > shown && (
                <Button color="link-gray" size="sm" className="mt-4" onClick={() => setShown(items.length)}>
                    {`Show all ${items.length}`}
                </Button>
            )}
        </>
    );
};

const EmptyNote = ({ title, body }: { title: string; body: string }) => (
    <div className="flex items-start gap-3 rounded-xl bg-secondary px-4 py-3.5">
        <CheckCircle className="mt-0.5 size-4 shrink-0 text-fg-quaternary" aria-hidden="true" />
        <div>
            <p className="text-sm font-medium text-secondary">{title}</p>
            <p className="mt-0.5 text-sm text-pretty text-tertiary">{body}</p>
        </div>
    </div>
);

/** A count that gives a small pulse when it goes up, so a note marked done or dismissed
 *  visibly lands in Feedback history. Feedback, not decoration: it fires only on an increase. */
const Count = ({ n, waiting = false }: { n: number; waiting?: boolean }) => {
    const reduceMotion = useReducedMotion();
    const prev = useRef(n);
    const grew = n > prev.current;
    useEffect(() => {
        prev.current = n;
    }, [n]);
    const loud = waiting && n > 0;
    return (
        <motion.span
            key={n}
            initial={grew && !reduceMotion ? { scale: 1.25 } : false}
            animate={{ scale: 1 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            className={cx(
                "inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1 text-[11px] leading-none font-semibold tabular-nums",
                loud ? "bg-brand-solid text-white" : "bg-tertiary text-tertiary",
            )}
        >
            {n}
        </motion.span>
    );
};

/** One segment of the switch; the highlight slides between segments. */
const Segment = ({ id, groupId, label, count, waiting }: { id: string; groupId: string; label: string; count: number; waiting?: boolean }) => {
    const reduceMotion = useReducedMotion();
    return (
        <AriaTab
            id={id}
            className={({ isSelected, isFocusVisible, isHovered }) =>
                cx(
                    "relative flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold outline-focus-ring transition-colors duration-150 ease-out",
                    isSelected ? "text-primary" : isHovered ? "text-secondary" : "text-tertiary",
                    isFocusVisible && "outline-2 outline-offset-1",
                )
            }
        >
            {({ isSelected }) => (
                <>
                    {isSelected && (
                        <motion.span
                            layoutId={`segment-${groupId}`}
                            aria-hidden="true"
                            className="absolute inset-0 rounded-md bg-primary shadow-xs ring-1 ring-secondary"
                            transition={reduceMotion ? { duration: 0 } : { type: "spring", duration: 0.28, bounce: 0 }}
                        />
                    )}
                    <span className="relative">{label}</span>
                    <span className="relative flex">
                        <Count n={count} waiting={waiting} />
                    </span>
                </>
            )}
        </AriaTab>
    );
};

/**
 * The team's comments on one section, in two tabs: Open (to act on) and Feedback history
 * (everything closed, plus past verdicts from outside the table). Renders nothing unless
 * `mode` is "review". By default it renders the body only, for a caller that already has a
 * card; `framed` gives it a card of its own.
 */
export const ClientFeedbackTabs = ({
    feedback,
    pastVerdicts = [],
    labelFor,
    framed = false,
    hideWhenEmpty = false,
}: {
    feedback: Pick<ClientFeedbackProps, "mode" | "items" | "resolve">;
    pastVerdicts?: PastVerdict[];
    labelFor?: (s: Suggestion) => string | null;
    /** Wrap in its own card, for a section with no card to put it in. */
    framed?: boolean;
    /** Render nothing at all while there is nothing open and no history. */
    hideWhenEmpty?: boolean;
}) => {
    const reduceMotion = useReducedMotion();
    const groupId = useId();
    /** Null until the viewer picks, so the default can follow the data as it loads. */
    const [picked, setPicked] = useState<AriaKey | null>(null);

    if (feedback.mode !== "review") return null;

    const open = feedback.items.filter((s) => s.status === "pending");
    const history = historyOf(feedback.items, pastVerdicts, labelFor);
    if (hideWhenEmpty && open.length === 0 && history.length === 0) return null;
    // Open first while anything is waiting; otherwise the history, if there is one.
    const selected = picked ?? (open.length > 0 || history.length === 0 ? "open" : "history");

    return (
        <AriaTabs
            selectedKey={selected}
            onSelectionChange={setPicked}
            keyboardActivation="manual"
            className={cx("@container/comments", framed && "rounded-2xl bg-primary px-5 py-4 ring-1 ring-secondary")}
        >
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <p className="text-sm font-semibold text-primary">Comments</p>
                <AriaTabList aria-label="Client comments" className="flex gap-0.5 rounded-lg bg-secondary p-0.5 ring-1 ring-secondary ring-inset">
                    <Segment id="open" groupId={groupId} label="Open" count={open.length} waiting />
                    <Segment id="history" groupId={groupId} label="Feedback history" count={history.length} />
                </AriaTabList>
            </div>

            <AriaTabPanel id="open" className="mt-4 outline-none">
                {open.length === 0 ? (
                    <EmptyNote title="All caught up" body="New comments from the client show up here." />
                ) : (
                    <ul className="flex flex-col gap-5">
                        {/* A note leaving the list fades out where it is, then the rest close the
                            gap, so the list never jumps. Opacity only under reduced motion. */}
                        <AnimatePresence initial={false} mode="popLayout">
                            {open.map((s) => (
                                <motion.li
                                    key={s.id}
                                    layout={!reduceMotion}
                                    exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98, filter: "blur(2px)" }}
                                    transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                                >
                                    <OpenNote s={s} label={labelFor?.(s) ?? null} resolve={feedback.resolve} />
                                </motion.li>
                            ))}
                        </AnimatePresence>
                    </ul>
                )}
            </AriaTabPanel>

            <AriaTabPanel id="history" className="mt-4 outline-none">
                <ClosedList
                    items={history}
                    empty={{ title: "No feedback history yet", body: "Comments you mark as done or dismiss stay here, so you can look back at them." }}
                />
            </AriaTabPanel>
        </AriaTabs>
    );
};
