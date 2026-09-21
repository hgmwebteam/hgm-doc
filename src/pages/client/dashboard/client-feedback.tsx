import { useEffect, useState } from "react";
import { Check, CheckCircle, Edit03 } from "@untitledui/icons";
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
export const ClientFeedbackBox = ({ feedback, placeholder, rows = 6 }: { feedback: ClientFeedbackProps; placeholder: string; rows?: number }) => {
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
                    <p className="text-sm font-semibold text-primary">Your feedback</p>
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
                <p className="text-sm font-semibold text-primary">Your feedback</p>
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
export const ClientFeedbackReview = ({ feedback, labelFor }: { feedback: ClientFeedbackProps; labelFor?: (s: Suggestion) => string | null }) => {
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
