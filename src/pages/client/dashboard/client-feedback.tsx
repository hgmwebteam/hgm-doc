import { useEffect, useState } from "react";
import { Button } from "@/components/base/buttons/button";
import type { Suggestion } from "@/pages/client/dashboard/suggestions-model";

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

/**
 * The client's box. Renders nothing unless `mode` is "client", so a caller can hand it the
 * same props it gives the review list and let this decide.
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

    // Tracks the viewer's open note, which changes right after a send (the refresh brings
    // the new row back). Keyed on the row id alone so typing is never interrupted, and so
    // the send's own refresh doesn't wipe the "Sent" confirmation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        setText(mine?.suggested_value ?? "");
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
            window.setTimeout(() => setState((s) => (s === "sent" ? "idle" : s)), 6000);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong. Nothing was sent.");
            setState("error");
        }
    };

    return (
        <div className="rounded-2xl bg-primary p-4 ring-1 ring-secondary md:p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm font-semibold text-primary">Your feedback</p>
                {mine && <span className="rounded-full bg-warning-primary px-2.5 py-1 text-xs font-medium text-warning-primary">Awaiting review</span>}
            </div>
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
                {mine && (
                    <button
                        type="button"
                        onClick={() => void feedback.withdraw(mine).catch(() => undefined)}
                        className="text-sm font-semibold text-tertiary transition duration-100 ease-linear hover:text-error-primary"
                    >
                        Withdraw
                    </button>
                )}
            </div>
            {/* Status sits under the button rather than beside it — at rail width a sentence
                next to the button wrapped to three lines. */}
            {state === "sent" && <p className="mt-2.5 text-sm text-success-primary">Sent — thank you. Your account manager will follow up.</p>}
            {state === "error" && <p className="mt-2.5 text-sm text-error-primary">{error}</p>}
            {state === "idle" && !mine && resolved && (
                <p className="mt-2.5 text-xs text-quaternary">
                    Your note from {shortDate(resolved.created_at)} was marked {resolved.status === "accepted" ? "done" : "closed"}
                    {resolved.resolved_at ? ` on ${shortDate(resolved.resolved_at)}` : ""}.
                </p>
            )}
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
