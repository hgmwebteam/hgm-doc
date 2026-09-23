/**
 * Rendering of a client's submitted intake / brand-vision answers, plus the team-only
 * summary of any voice or video answer they recorded.
 *
 * Shown inline under each form section once it is in, so an AM does not have to open the
 * review screen to read back what the client said.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckDone01, Edit01, Flag01, Lightbulb01, MessageTextSquare01, Stars02, Trash01 } from "@untitledui-pro/icons/line";
import { RecordingPlayer } from "@/components/application/media-answer";
import { Button } from "@/components/base/buttons/button";
import { useAuthUser } from "@/hooks/use-auth-user";
import { type ScriptLog, isInFlight, isStalled, listSummariesForPaths, queueSummary, retrySummary } from "@/lib/script-logs";
import { supabase } from "@/lib/supabase";
import type { OnboardingAnswerSection } from "@/pages/client/client-onboarding-form-page";

/** Signed-URL playback for a recorded answer shown on the dashboard. */
export const InlineRecording = ({ path, kind }: { path: string; kind: "audio" | "video" | "" }) => {
    const [url, setUrl] = useState("");
    useEffect(() => {
        let live = true;
        supabase.storage
            .from("recordings")
            .createSignedUrl(path, 60 * 60)
            .then(({ data }) => {
                if (live && data?.signedUrl) setUrl(data.signedUrl);
            });
        return () => {
            live = false;
        };
    }, [path]);
    if (!url) return <p className="mt-1 text-xs text-quaternary">Loading recording…</p>;
    return (
        <div className="mt-2">
            <p className="mb-1 text-xs font-medium text-tertiary">{kind === "video" ? "Video answer" : "Voice answer"}</p>
            <RecordingPlayer src={url} kind={kind} className={kind === "video" ? "aspect-video w-full max-w-sm rounded-lg bg-primary" : "w-full max-w-sm"} />
        </div>
    );
};

/** One labelled list inside a recording summary. Renders nothing when the model had
 *  nothing to put in it, so an empty answer doesn't produce four empty headings. */
export const SummaryBullets = ({ title, icon: Icon, items }: { title: string; icon: typeof Flag01; items?: string[] }) => {
    if (!items?.length) return null;
    return (
        <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold text-secondary">
                <Icon className="size-3.5 shrink-0 text-fg-quaternary" aria-hidden="true" />
                {title}
            </p>
            <ul className="mt-1 flex flex-col gap-1">
                {items.map((item, i) => (
                    <li key={i} className="flex gap-2 text-sm text-tertiary">
                        <span className="mt-1.5 size-1 shrink-0 rounded-full bg-quaternary" aria-hidden="true" />
                        <span className="text-pretty">{item}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
};

/**
 * AI summary of a recorded answer — TEAM ONLY.
 *
 * An AM opening a submitted form shouldn't have to sit through a two-minute video to find
 * out what the client said. This reads the recording back as key points and action items.
 *
 * The client must never see this, so it is gated twice over. The caller renders it only
 * when `isTeamView`, and independently of that the `script_logs` table denies `anon`
 * outright and restricts `authenticated` to @hiddengem.media — so even a bug that rendered
 * this for a client would have no data to show. The visible "Only your team sees this"
 * label is not decoration: an AM needs to know at a glance that a machine's reading of the
 * client's words is not being shown back to the client as if it were their own answer.
 *
 * Summaries that already exist appear on their own; generating a new one takes a click,
 * because transcription is billed per minute and a dashboard that quietly spent money
 * every time someone opened a form would be a bad surprise.
 */
export const TeamRecordingSummary = ({ log }: { log?: ScriptLog }) => {
    const shell = "mt-3 rounded-xl bg-secondary p-3 ring-1 ring-secondary";
    const eyebrow = (
        <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-brand-secondary uppercase">
            <Stars02 className="size-3.5 shrink-0" aria-hidden="true" />
            AI summary
            <span className="font-normal tracking-normal text-quaternary normal-case">· only your team sees this</span>
        </p>
    );

    // Nothing generated yet. Deliberately not a per-recording button: the AM presses one
    // control above the answers and every recording on the form is handled, so a form with
    // a dozen recordings isn't a dozen clicks.
    if (!log) {
        return <p className="mt-2 text-xs text-quaternary">Not summarised yet.</p>;
    }

    if (isInFlight(log)) {
        return (
            <div className={shell}>
                {eyebrow}
                <p className="mt-1.5 flex items-center gap-2 text-sm text-tertiary">
                    <span className="size-3.5 animate-spin rounded-full border-2 border-brand border-t-transparent" aria-hidden="true" />
                    {log.status === "transcribing"
                        ? "Transcribing the recording…"
                        : log.status === "summarising"
                          ? "Writing the summary…"
                          : "Waiting to start…"}
                    {isStalled(log) && " — this is taking longer than expected."}
                </p>
            </div>
        );
    }

    if (log.status === "error") {
        return (
            <div className="mt-3 rounded-xl bg-error-primary p-3 ring-1 ring-error_subtle">
                {eyebrow}
                <p className="mt-1.5 flex gap-2 text-sm text-pretty text-tertiary">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-fg-error-secondary" aria-hidden="true" />
                    {log.error || "That didn't work."}
                </p>
                <button
                    type="button"
                    onClick={() => void retrySummary(log.id)}
                    className="mt-2 text-sm font-semibold text-brand-secondary transition duration-100 ease-linear hover:underline"
                >
                    Try again
                </button>
            </div>
        );
    }

    const s = log.summary;
    if (!s) return null;

    return (
        <div className={shell}>
            {eyebrow}
            <p className="mt-1.5 text-sm font-semibold text-pretty text-primary">{s.headline}</p>
            {s.context && <p className="mt-1 text-sm text-pretty text-tertiary">{s.context}</p>}
            <div className="mt-3 flex flex-col gap-3">
                <SummaryBullets title="Key points" icon={Lightbulb01} items={s.key_points} />
                <SummaryBullets title="Action items" icon={CheckDone01} items={s.action_items} />
                <SummaryBullets title="Worth quoting" icon={MessageTextSquare01} items={s.quotes} />
                <SummaryBullets title="Flagged" icon={Flag01} items={s.flags} />
            </div>
            {log.transcript && (
                <details className="mt-3">
                    <summary className="cursor-pointer list-none text-xs font-medium text-quaternary select-none hover:text-tertiary">
                        Read the transcript instead
                    </summary>
                    <p className="mt-2 text-sm whitespace-pre-wrap text-tertiary">{log.transcript}</p>
                </details>
            )}
        </div>
    );
};

/**
 * A submitted form rendered inline, grouped by section.
 *
 * Takes pre-computed sections rather than raw form data so it serves BOTH client-input
 * forms — clientOnboardingAnswers() for the Onboarding Form and hostOnboardingAnswers()
 * for the Brand Vision Form. Their answer shapes are structurally identical, so neither
 * form page has to import from the other.
 *
 * Passwords stay masked behind a per-row reveal: this panel sits open on the dashboard, a
 * weaker place to park a credential than a review screen someone had to deliberately open.
 * (Only the Onboarding Form carries any; Brand Vision has none.)
 *
 * With `onDeleteLogin`, each of those rows also gets a delete control, so a login can be
 * moved into 1Password and removed one at a time. It is drawn only under `isTeamView` —
 * the client opens this same panel on their own dashboard, and deleting their password
 * from our records is our housekeeping, not an action to hand them.
 */
export const OnboardingAnswers = ({
    sections,
    onEdit,
    isTeamView,
    clientName,
    onDeleteLogin,
}: {
    sections: OnboardingAnswerSection[];
    onEdit: (field: string) => void;
    /**
     * Whose voice to write in. The client reading this panel is looking at their OWN submission,
     * so "Their answers" tells them the site is talking about them to somebody else. False while
     * a team member previews as the client, so the preview shows what the client actually gets.
     */
    isTeamView?: boolean;
    clientName: string;
    /**
     * Delete the stored password on one login row. Only passed for the Onboarding Form —
     * the Brand Vision Form collects no credentials, so its rows never offer it.
     * Rejecting leaves the row alone and the confirm in place, so a failed write cannot
     * read as a password that is gone when it is still there.
     */
    onDeleteLogin?: (field: string) => Promise<void>;
}) => {
    const [shown, setShown] = useState<Record<string, boolean>>({});
    /* Armed per row: the first click only asks. There is no undo, and the rows sit close
       enough together that a single-click delete beside Edit would eventually be a
       mis-click on the wrong client's login. */
    const [armedDelete, setArmedDelete] = useState("");
    const [deleting, setDeleting] = useState("");
    const answered = sections.flatMap((s) => s.rows).filter((r) => r.lines.length || r.mediaPath).length;

    /**
     * A row is deletable when it still holds a password — which is exactly the rows that
     * carry a `secret` line. Read off the rendered answer rather than re-deriving which
     * questions are credential questions, so the control appears on precisely the rows
     * that show something to hide, and disappears the moment one is cleared.
     */
    const canDeleteLogin = (row: OnboardingAnswerSection["rows"][number]) => !!onDeleteLogin && !!isTeamView && row.lines.some((l) => l.secret);

    const runDelete = async (field: string) => {
        if (!onDeleteLogin) return;
        setDeleting(field);
        try {
            await onDeleteLogin(field);
            setArmedDelete("");
            // Drop any reveal for this row, so the next password to appear here starts masked.
            setShown((v) => ({ ...v, [field]: false }));
        } catch {
            // Deliberately stays armed: the caller logs it, and a confirm that vanished
            // would read as a password deleted when it is still in the row.
        } finally {
            setDeleting("");
        }
    };

    /* ── Team-only: AI summaries of the recorded answers ────────────────
       Every query below is gated on isTeamView. That is belt-and-braces rather than the
       actual protection — script_logs denies anon and restricts authenticated to
       @hiddengem.media — but a client should not be firing requests that can only 403. */

    const { user: viewer } = useAuthUser();
    const [summaries, setSummaries] = useState<Record<string, ScriptLog>>({});
    const [bulkBusy, setBulkBusy] = useState(false);
    const [summaryError, setSummaryError] = useState("");

    const mediaRows = useMemo(() => sections.flatMap((s) => s.rows).filter((r) => r.mediaPath), [sections]);
    // A stable primitive to depend on: the rows array is rebuilt every render, so depending
    // on it directly would refetch summaries in a loop.
    const pathKey = mediaRows.map((r) => r.mediaPath).join("|");

    const loadSummaries = useCallback(async () => {
        const paths = pathKey ? pathKey.split("|") : [];
        if (!isTeamView || !paths.length) return;
        try {
            setSummaries(await listSummariesForPaths(paths));
        } catch (err) {
            // Non-fatal by design: the answers themselves must still render. A team member
            // who can't reach script_logs sees the recordings exactly as before.
            console.error("[dashboard] could not load recording summaries", err);
        }
    }, [isTeamView, pathKey]);

    useEffect(() => {
        void loadSummaries();
    }, [loadSummaries]);

    // Generation is a background function that can't call back, so the only way to learn it
    // finished is to look again — but only while something is actually running.
    const anyInFlight = Object.values(summaries).some(isInFlight);
    const loadRef = useRef(loadSummaries);
    loadRef.current = loadSummaries;
    useEffect(() => {
        if (!anyInFlight) return;
        const id = window.setInterval(() => void loadRef.current(), 4000);
        return () => window.clearInterval(id);
    }, [anyInFlight]);

    /**
     * Recordings with no summary and nothing already running for them.
     *
     * Anything already `done` is excluded, so pressing the button twice doesn't pay to
     * transcribe the same audio again. A failed row is excluded too — it has its own "Try
     * again" so one broken recording can't make the bulk button re-run the other eleven.
     */
    const pending = mediaRows.filter((r) => !summaries[r.mediaPath]);

    /**
     * One press, every recording on this form.
     *
     * Queued one at a time rather than with Promise.all: each row appears as it's accepted,
     * so a form with a dozen recordings visibly fills in instead of sitting still and then
     * changing all at once. The actual transcription work happens in parallel anyway — these
     * are just the inserts, and each one hands off to a background function that returns
     * immediately.
     */
    const generateAll = async () => {
        if (!pending.length) return;
        setBulkBusy(true);
        setSummaryError("");
        let failed = 0;
        for (const row of pending) {
            try {
                const created = await queueSummary({
                    // Recordings are namespaced by the FORM's slug, not the dashboard's, so
                    // the owning slug comes from the path rather than from this page.
                    clientSlug: row.mediaPath.split("/")[0],
                    clientName,
                    sourcePath: row.mediaPath,
                    sourceLabel: row.label,
                    mediaKind: row.mediaKind,
                    createdBy: viewer?.email ?? "",
                });
                setSummaries((prev) => ({ ...prev, [row.mediaPath]: created }));
            } catch (err) {
                console.error("[dashboard] could not queue a summary for", row.mediaPath, err);
                failed++;
            }
        }
        if (failed) {
            setSummaryError(`Couldn't start ${failed} of ${pending.length} — press again to retry those.`);
            setTimeout(() => setSummaryError(""), 6000);
        }
        setBulkBusy(false);
    };

    return (
        <div className="mt-5 border-t border-secondary pt-5">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <p className="text-sm font-semibold text-primary">
                    {isTeamView ? "Their answers" : "Your answers"} <span className="font-normal text-tertiary tabular-nums">· {answered} answered</span>
                </p>
                {summaryError && (
                    <span className="text-sm text-error-primary" role="alert">
                        {summaryError}
                    </span>
                )}
                {isTeamView && (
                    <div className="flex flex-wrap items-center gap-3">
                        {/* The one control that reads every recording on this form. Team only —
                            the client never sees it, and never sees what it produces. Hidden
                            once there's nothing left to do rather than sitting there disabled,
                            because a permanently greyed-out button reads as broken. */}
                        {isTeamView && pending.length > 0 && (
                            <Button
                                size="sm"
                                color="secondary"
                                iconLeading={Stars02}
                                isLoading={bulkBusy}
                                showTextWhileLoading
                                onClick={() => void generateAll()}
                            >
                                {bulkBusy ? "Starting…" : `Summarise ${pending.length} recording${pending.length === 1 ? "" : "s"}`}
                            </Button>
                        )}
                    </div>
                )}
            </div>
            {/* Double the gap between sections. Now that each section is one card rather than a
                stack of small ones, the run between "Account Setup" and "Billing & Legal" is the
                only thing separating two dense blocks — at gap-6 they read as one continuous wall. */}
            <div className="mt-4 flex flex-col gap-12">
                {sections.map((s) => (
                    <section key={s.id}>
                        {/* Same icon the form showed for this section, so reading the answers back
                            uses the landmarks the client filled them in under. */}
                        <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-brand-secondary uppercase">
                            <s.icon className="size-4 shrink-0" aria-hidden="true" />
                            {s.title}
                        </p>
                        {/* One card per section rather than one per question. A client reading
                            their own answers back is scanning a section as a whole, and a stack of
                            separate cards chops that into unrelated-looking fragments. Dividers
                            keep the rows distinct without breaking the group apart. */}
                        <dl className="mt-3 divide-y divide-secondary overflow-hidden rounded-2xl bg-primary ring-1 ring-secondary">
                            {s.rows.map((row) => {
                                const empty = !row.lines.length && !row.mediaPath;
                                return (
                                    <div
                                        key={row.field}
                                        className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1 p-4 transition duration-100 ease-linear hover:bg-secondary"
                                    >
                                        <dt className="col-start-1 row-start-1 text-md font-medium text-secondary">{row.label}</dt>
                                        <dd className="col-span-2 col-start-1 row-start-2 min-w-0">
                                            {empty && <span className="text-md text-quaternary italic">Not answered</span>}
                                            {row.lines.map((line, i) =>
                                                line.secret && !shown[row.field] ? (
                                                    <p key={i} className="flex items-center gap-2 text-md text-tertiary">
                                                        <span className="tracking-[0.2em]">••••••••</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => setShown((v) => ({ ...v, [row.field]: true }))}
                                                            className="text-sm font-semibold text-brand-secondary transition duration-100 ease-linear hover:underline"
                                                        >
                                                            Show
                                                        </button>
                                                    </p>
                                                ) : (
                                                    <p key={i} className="text-md break-words whitespace-pre-wrap text-tertiary">
                                                        {line.text}
                                                    </p>
                                                ),
                                            )}
                                            {canDeleteLogin(row) && armedDelete === row.field && (
                                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                                    <Button
                                                        size="sm"
                                                        color="primary-destructive"
                                                        isLoading={deleting === row.field}
                                                        showTextWhileLoading
                                                        onClick={() => void runDelete(row.field)}
                                                    >
                                                        {deleting === row.field ? "Deleting…" : "Yes, delete this password"}
                                                    </Button>
                                                    <Button size="sm" color="secondary" isDisabled={deleting === row.field} onClick={() => setArmedDelete("")}>
                                                        Cancel
                                                    </Button>
                                                </div>
                                            )}
                                            {row.mediaPath && <InlineRecording path={row.mediaPath} kind={row.mediaKind} />}
                                            {/* Team only. The client keeps seeing exactly what they
                                                recorded and nothing else. */}
                                            {row.mediaPath && isTeamView && <TeamRecordingSummary log={summaries[row.mediaPath]} />}
                                        </dd>
                                        {/* Both controls share one grid cell, so they sit in a row inside it
                                            rather than each claiming col-start-2 and stacking on top of the
                                            other. Always visible, not hover-revealed: this panel is read on
                                            phones and tablets too, where there is no hover and an opacity-0
                                            control is simply invisible. */}
                                        <div className="col-start-2 row-start-1 -mt-0.5 flex items-center gap-1 justify-self-end">
                                            {canDeleteLogin(row) && (
                                                <button
                                                    type="button"
                                                    onClick={() => setArmedDelete((f) => (f === row.field ? "" : row.field))}
                                                    title={`Delete the saved password — ${row.label}`}
                                                    aria-label={`Delete the saved password for ${row.label}`}
                                                    className="flex size-7 shrink-0 items-center justify-center rounded-lg text-fg-quaternary transition duration-100 ease-linear hover:bg-primary hover:text-fg-error-secondary hover:ring-1 hover:ring-secondary"
                                                >
                                                    <Trash01 className="size-3.5" aria-hidden="true" />
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => onEdit(row.field)}
                                                title={`Edit — ${row.label}`}
                                                aria-label={`Edit ${row.label}`}
                                                className="flex size-7 shrink-0 items-center justify-center rounded-lg text-fg-quaternary transition duration-100 ease-linear hover:bg-primary hover:text-brand-secondary hover:ring-1 hover:ring-secondary"
                                            >
                                                <Edit01 className="size-3.5" aria-hidden="true" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </dl>
                    </section>
                ))}
            </div>
        </div>
    );
};
