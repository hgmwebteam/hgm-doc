/**
 * Master Brand Document suggestion mode — the React pieces.
 *
 * A client can't edit the document (and can't write dashboard_pages at all — they're
 * `anon` to Supabase). Instead they propose values, which land in the separate
 * dashboard_suggestions table via the Netlify function, and an AM accepts or declines
 * each one. Accepting routes the value through patchFoundation + the ordinary Save
 * button, so the document itself only ever changes through the existing save path.
 *
 * The pure model (field-key addressing, apply/read/label) lives in
 * suggestions-model.ts so suggestions.check.ts can run it without React.
 */
import { createContext, useContext, useState } from "react";
import { Check, Copy01 } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { type Suggestion, type SuggestionItem, wordDiff } from "@/pages/client/dashboard/suggestions-model";

export type { Suggestion };

/* ── Context the field components read ── */

export interface SuggestionCtx {
    /** "review" = team viewing; "suggest" = client actively suggesting; "off" = anything else. */
    mode: "off" | "suggest" | "review";
    /** Pending suggestions grouped by field key. */
    pendingByKey: Map<string, Suggestion[]>;
    /** Latest resolved suggestion per key — the client's "what happened" note. */
    resolvedByKey: Map<string, Suggestion>;
    /** The client's in-progress edits, keyed by field key. Entries equal to the live value are dropped at send. */
    draft: Record<string, string>;
    setDraft: (key: string, value: string) => void;
    /** Accepted locally but not yet saved — flipped to accepted in the DB only after Save succeeds. */
    queuedAccepts: ReadonlySet<string>;
    /** Replace the field with the suggestion (queued until Save). */
    accept: (s: Suggestion) => void;
    /** Put the field back as it was before `accept`, while it is still only queued. */
    undo: (s: Suggestion) => void;
    /** What the field said when each queued suggestion was accepted, by suggestion id. */
    previousById: ReadonlyMap<string, string>;
    /** Resolve without touching the field — the AM used some of it by hand, or none. */
    markDone: (s: Suggestion) => void;
    decline: (s: Suggestion) => void;
    withdraw: (s: Suggestion) => void;
    /** The client's own identity email (empty for team / anonymous unlocks). */
    viewerEmail: string;
}

export const SuggestionContext = createContext<SuggestionCtx | null>(null);

const shortDate = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const Label = ({ children }: { children: string }) => <p className="text-[11px] font-semibold tracking-wide text-quaternary uppercase">{children}</p>;

/**
 * The team's view of one pending suggestion: what the field says now beside what the client
 * suggested, with the changed words marked, and three ways to handle it. Replace takes the
 * suggestion whole and stays undoable until Save; Copy + Mark as done is for keeping some
 * of it by hand; Decline leaves the field alone.
 */
const ReviewCard = ({ s, liveValue, ctx }: { s: Suggestion; liveValue: string; ctx: SuggestionCtx }) => {
    const [copied, setCopied] = useState(false);
    const queued = ctx.queuedAccepts.has(s.id);
    const before = queued ? (ctx.previousById.get(s.id) ?? s.current_value) : liveValue;
    const stale = !queued && s.current_value !== liveValue;
    const parts = wordDiff(before, s.suggested_value);
    const changed = parts.some((p) => p.kind !== "same");

    const copy = () =>
        void navigator.clipboard.writeText(s.suggested_value).then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1600);
        });

    if (queued) {
        return (
            <div className="rounded-xl bg-success-primary p-3 ring-1 ring-secondary">
                <p className="text-xs font-medium text-secondary">Replaced with the suggestion — press Save changes to make it permanent</p>
                <div className="mt-2">
                    <Label>Before</Label>
                    <p className="mt-0.5 text-sm whitespace-pre-wrap text-tertiary">{before.trim() || <span className="italic">Empty</span>}</p>
                </div>
                <div className="mt-2 flex items-center gap-2">
                    <Button size="sm" color="secondary" onClick={() => ctx.undo(s)}>
                        Undo
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-xl bg-brand-primary_alt p-3 ring-1 ring-secondary">
            <p className="text-xs font-medium text-secondary">{`Suggested by ${s.suggested_by} · ${shortDate(s.created_at)}`}</p>
            <div className="mt-2 grid gap-3 md:grid-cols-2">
                <div className="min-w-0">
                    <Label>Currently</Label>
                    <p className="mt-0.5 text-sm whitespace-pre-wrap text-tertiary">{before.trim() || <span className="italic">Empty</span>}</p>
                </div>
                <div className="min-w-0">
                    <Label>Suggested</Label>
                    {/* Added words are highlighted, removed ones struck through. */}
                    <p className="mt-0.5 text-sm whitespace-pre-wrap text-primary">
                        {!s.suggested_value.trim() ? (
                            <span className="text-quaternary italic">(cleared)</span>
                        ) : (
                            parts.map((p, i) =>
                                p.kind === "same" ? (
                                    <span key={i}>{p.text}</span>
                                ) : p.kind === "add" ? (
                                    <mark key={i} className="rounded bg-success-secondary px-0.5 text-primary">
                                        {p.text}
                                    </mark>
                                ) : (
                                    <del key={i} className="text-quaternary decoration-fg-error-primary">
                                        {p.text}
                                    </del>
                                ),
                            )
                        )}
                    </p>
                    {!changed && <p className="mt-1 text-xs text-quaternary">Same as the current text.</p>}
                </div>
            </div>
            {stale && (
                <p className="mt-2 text-xs text-warning-primary">
                    This field has changed since the suggestion was made — it was “{s.current_value.trim() || "empty"}” then.
                </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button size="sm" color="primary" onClick={() => ctx.accept(s)}>
                    Replace with this
                </Button>
                <Button size="sm" color="secondary" iconLeading={copied ? Check : Copy01} onClick={copy}>
                    {copied ? "Copied" : "Copy suggestion"}
                </Button>
                <Button size="sm" color="secondary" onClick={() => ctx.markDone(s)}>
                    Mark as done
                </Button>
                <Button size="sm" color="tertiary" onClick={() => ctx.decline(s)}>
                    Decline
                </Button>
            </div>
            <p className="mt-2 text-xs text-quaternary">Want only part of it? Copy it, edit the field above yourself, then Mark as done.</p>
        </div>
    );
};

/**
 * Everything a field shows about its suggestions: the team's review card (ReviewCard),
 * or for the suggesting client their pending text with Withdraw, and the resolved
 * outcome note.
 * Renders nothing when the field has no suggestion history — so it's safe under every
 * field in every mode.
 */
export const SuggestionBox = ({ sKey, liveValue }: { sKey: string; liveValue: string }) => {
    const ctx = useContext(SuggestionContext);
    if (!ctx) return null;
    const pending = ctx.pendingByKey.get(sKey) ?? [];
    const resolved = ctx.resolvedByKey.get(sKey);
    if (pending.length === 0 && !resolved) return null;

    return (
        <div className="mt-2 flex flex-col gap-2">
            {pending.map((s) =>
                ctx.mode === "review" ? (
                    <ReviewCard key={s.id} s={s} liveValue={liveValue} ctx={ctx} />
                ) : (
                    <div key={s.id} className="rounded-xl bg-brand-primary_alt p-3 ring-1 ring-secondary">
                        <p className="text-xs font-medium text-secondary">{`Suggested by ${s.suggested_by} · ${shortDate(s.created_at)}`}</p>
                        <p className="mt-1 text-sm whitespace-pre-wrap text-primary">
                            {s.suggested_value.trim() ? s.suggested_value : <span className="text-quaternary italic">(cleared)</span>}
                        </p>
                        {!!ctx.viewerEmail && s.suggested_by === ctx.viewerEmail && (
                            <button
                                type="button"
                                onClick={() => ctx.withdraw(s)}
                                className="mt-1.5 text-xs font-semibold text-tertiary transition duration-100 ease-linear hover:text-error-primary"
                            >
                                Withdraw suggestion
                            </button>
                        )}
                    </div>
                ),
            )}
            {pending.length === 0 && resolved && (
                <p className="text-xs text-quaternary">
                    Your suggestion from {shortDate(resolved.created_at)} was {resolved.status}
                    {resolved.resolved_at ? ` on ${shortDate(resolved.resolved_at)}` : ""}.
                </p>
            )}
        </div>
    );
};

/* ── API wrappers — all client traffic goes through the Netlify function, which holds
      the service-role key and re-validates the email against allowed_emails. ── */

const ENDPOINT = "/.netlify/functions/dashboard-suggestions";

const call = async (body: Record<string, unknown>): Promise<Record<string, unknown>> => {
    let res: Response;
    try {
        res = await fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    } catch {
        throw new Error("Couldn't reach the server — check your connection and try again.");
    }
    const text = await res.text();
    let json: Record<string, unknown> = {};
    if (text) {
        try {
            json = JSON.parse(text) as Record<string, unknown>;
        } catch {
            /* Not JSON at all — a proxy error page, or this app's own index.html served by
               a dev server with no functions behind it. Both used to sail through as
               "success" and silently drop the suggestions, so they throw instead. */
            throw new Error(`The server didn't answer properly (${res.status}). Nothing was sent — please try again.`);
        }
    }
    if (!res.ok) throw new Error(String(json.error ?? `Request failed (${res.status})`));
    return json;
};

export const fetchSuggestions = async (slug: string, email: string): Promise<Suggestion[]> => {
    const json = await call({ action: "list", slug, email });
    return (json.suggestions as Suggestion[]) ?? [];
};

export const sendSuggestions = (slug: string, email: string, items: SuggestionItem[]) => call({ action: "create", slug, email, items });

export const withdrawSuggestion = (slug: string, email: string, id: string) => call({ action: "withdraw", slug, email, id });
