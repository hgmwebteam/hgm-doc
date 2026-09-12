/**
 * 03 REQUEST DETAIL - one request, its timing, who owns it, and everything that has
 * happened to it.
 *
 * Reading order is fixed by the approved design and is the same at every width: the timing
 * block, then PROPERTY / ASSIGNED TO / ACCOUNT MANAGER / ELAPSED, then the timeline, then
 * the team's updates. On a phone that puts the timing block above everything else, which is
 * the one thing a client opens this screen to find; on a desktop the four facts spread into
 * a single row instead of stacking, so the timeline starts above the fold rather than being
 * pushed down by a column of labels.
 *
 * ── NO INVENTED DATES ───────────────────────────────────────────────────────
 * Everything this screen says about timing comes from promiseBlock() in help-model.ts and
 * nothing else. There is no fallback string here, no "usually", no date arithmetic. Read
 * that function's header before touching the timing block.
 *
 * ── WHAT IS DELIBERATELY NOT SHOWN ──────────────────────────────────────────
 * `route_error` and the `route_failed` event never reach this screen. They mean the topic
 * had no Asana board or no default assignee so the brain refused to open an unowned task
 * and told the account manager instead. That is us handling it. To the client the request
 * is simply still "Received", which is the truth.
 */
import { useCallback, useEffect, useState } from "react";
import {
    ArrowNarrowLeft,
    Calendar,
    CheckCircle,
    Clock,
    Folder,
    Hourglass01,
    Image01,
    MarkerPin01,
    SlashCircle01,
    User01,
    UserCheck01,
} from "@untitledui-pro/icons/line";
import { Link } from "react-router";
import { Button } from "@/components/base/buttons/button";
import { type CallerProof, HelpApiError, fetchTicket, withdrawTicket } from "@/pages/client/help/help-api";
import {
    CLIENT_VISIBLE_EVENTS,
    EVENT_LABEL,
    type PromiseTone,
    type Ticket,
    type TicketEvent,
    type TicketTopic,
    actorName,
    canWithdraw,
    elapsedLabel,
    formatDayLong,
    formatStampShort,
    formatStampWithTime,
    initialOf,
    promiseBlock,
    topicLabel,
} from "@/pages/client/help/help-model";
import { ErrorNote, Eyebrow, HelpSpinner, MonoRef, Panel, StatusPill } from "@/pages/client/help/help-requests-screen";
import { cx } from "@/utils/cx";
import { Linkified } from "@/utils/linkify";

/* ── The timing block ────────────────────────────────────────────────────── */

/**
 * Tone is carried by the icon chip and the card's ring, never by the text colour or the
 * card's background.
 *
 * That is a legibility decision with a number behind it. Every line on this card is
 * text-primary or text-tertiary on bg-primary, measured at 17.91:1 and 7.80:1 in light and
 * 18.96:1 and 7.63:1 in dark. Tinting the card background would put the most important
 * sentence on the page onto a surface whose contrast then has to be re-proved in both
 * themes for four separate tones. The chip does the signalling and the reading stays safe.
 */
const TONE_CHIP: Record<PromiseTone, string> = {
    pending: "bg-utility-neutral-50 text-utility-neutral-700",
    dated: "bg-utility-brand-50 text-utility-brand-700",
    done: "bg-utility-green-50 text-utility-green-700",
    closed: "bg-utility-neutral-50 text-utility-neutral-700",
};

const TONE_ICON: Record<PromiseTone, typeof Clock> = {
    pending: Hourglass01,
    dated: Calendar,
    done: CheckCircle,
    closed: SlashCircle01,
};

const PromiseCard = ({ ticket }: { ticket: Ticket }) => {
    const block = promiseBlock(ticket);
    const Icon = TONE_ICON[block.tone];

    return (
        <Panel className={cx("p-5 sm:p-6", block.tone === "dated" && "ring-brand")}>
            <div className="flex items-start gap-4">
                <span className={cx("flex size-10 shrink-0 items-center justify-center rounded-lg", TONE_CHIP[block.tone])}>
                    <Icon className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                    <Eyebrow>When you will have it</Eyebrow>
                    {/* text-display-xs on a phone rather than something larger: at 390px a longer
                        headline like "Received, owner assigned" needs two lines at 24px and four
                        at 30px, and four lines stops it reading as one answer. */}
                    <p className="mt-1.5 text-display-xs font-semibold text-pretty text-primary">{block.headline}</p>
                    <p className="mt-2 max-w-[60ch] text-sm text-pretty text-tertiary">{block.sub}</p>
                </div>
            </div>
        </Panel>
    );
};

/* ── The four facts ──────────────────────────────────────────────────────── */

const Fact = ({ icon: Icon, label, value, hint }: { icon: typeof Clock; label: string; value: string; hint?: string }) => (
    <div className="flex flex-col gap-1.5 p-4 sm:p-5">
        <div className="flex items-center gap-1.5">
            <Icon className="size-3.5 shrink-0 text-tertiary" aria-hidden="true" />
            <Eyebrow>{label}</Eyebrow>
        </div>
        <p className="text-sm font-semibold text-pretty text-primary">{value}</p>
        {hint && <p className="text-xs text-tertiary">{hint}</p>}
    </div>
);

/**
 * PROPERTY / ASSIGNED TO / ACCOUNT MANAGER / ELAPSED.
 *
 * 2x2 at 390px and a single row of four from 640px up, with hairline dividers drawn by the
 * grid's own gap over a ruled background. Every cell renders even when its value is empty:
 * a missing "Assigned to" is information ("nobody yet"), and collapsing the cell would make
 * the grid reflow into a different shape per request, which reads as a broken layout rather
 * than as an absent fact.
 */
const FactRow = ({ ticket }: { ticket: Ticket }) => {
    const owner = (ticket.assignee_name ?? "").trim();
    const am = (ticket.account_manager_email ?? "").trim();
    const property = (ticket.property ?? "").trim();
    const elapsed = elapsedLabel(ticket);
    const closed = ticket.status === "completed" || ticket.status === "withdrawn";

    return (
        <Panel className="overflow-hidden">
            <div className="grid grid-cols-2 gap-px bg-secondary sm:grid-cols-4">
                <div className="bg-primary">
                    <Fact icon={MarkerPin01} label="Property" value={property || "All properties"} hint={property ? undefined : "Not tied to one listing"} />
                </div>
                <div className="bg-primary">
                    <Fact icon={UserCheck01} label="Assigned to" value={owner || "Being assigned"} hint={owner ? undefined : "We name an owner before work starts"} />
                </div>
                <div className="bg-primary">
                    <Fact icon={User01} label="Account manager" value={am || "Your HiddenGem AM"} />
                </div>
                <div className="bg-primary">
                    <Fact icon={Clock} label="Elapsed" value={elapsed || "Just now"} hint={closed ? "Time to close" : "Since you raised it"} />
                </div>
            </div>
        </Panel>
    );
};

/* ── The timeline ────────────────────────────────────────────────────────── */

const Timeline = ({ events }: { events: TicketEvent[] }) => {
    const shown = events.filter((e) => CLIENT_VISIBLE_EVENTS.includes(e.kind));
    if (shown.length === 0) return null;

    return (
        <section>
            <h2 className="text-md font-semibold text-primary">History</h2>
            <ol className="mt-4">
                {shown.map((e, i) => {
                    const last = i === shown.length - 1;
                    return (
                        <li key={e.id} className="relative flex gap-4 pb-5 last:pb-0">
                            {/* The rail is drawn per item rather than as one absolute line down the
                                list, so it always stops exactly at the final dot however many
                                events there are. */}
                            {!last && <span aria-hidden="true" className="absolute top-5 bottom-0 left-[7px] w-px bg-secondary" />}
                            <span
                                aria-hidden="true"
                                className={cx(
                                    "relative mt-1 size-3.5 shrink-0 rounded-full ring-2 ring-primary",
                                    e.kind === "completed" ? "bg-success-solid" : e.kind === "withdrawn" ? "bg-quaternary" : "bg-brand-solid",
                                )}
                            />
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-primary">{EVENT_LABEL[e.kind]}</p>
                                <p className="mt-0.5 text-xs text-tertiary">{formatStampWithTime(e.created_at)}</p>
                                {e.body?.trim() && <p className="mt-1.5 text-sm text-pretty text-tertiary"><Linkified text={e.body.trim()} /></p>}
                            </div>
                        </li>
                    );
                })}
            </ol>
        </section>
    );
};

/* ── Team updates ────────────────────────────────────────────────────────── */

/**
 * Every update is signed.
 *
 * Rule 3 of the design document puts a person's name on every comment written INTO Asana,
 * because that connection is one shared account. The same reasoning applies facing the
 * client: an update signed "HiddenGem" tells them nothing about who is actually holding
 * their request. actorName() guarantees a byline rather than letting one render blank.
 */
const TeamUpdates = ({ events }: { events: TicketEvent[] }) => {
    const updates = events.filter((e) => e.kind === "team_update" && (e.body ?? "").trim());
    if (updates.length === 0) return null;

    return (
        <section>
            <h2 className="text-md font-semibold text-primary">Team updates</h2>
            <ul className="mt-4 flex flex-col gap-3">
                {updates.map((e) => {
                    const who = actorName(e);
                    return (
                        <li key={e.id}>
                            <Panel className="p-4 sm:p-5">
                                <div className="flex items-center gap-3">
                                    <span
                                        aria-hidden="true"
                                        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-utility-brand-50 text-sm font-semibold text-utility-brand-700"
                                    >
                                        {initialOf(who)}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold text-primary">{who}</p>
                                        <p className="text-xs text-tertiary">{formatStampWithTime(e.created_at)}</p>
                                    </div>
                                </div>
                                <p className="mt-3 text-sm whitespace-pre-wrap text-pretty text-secondary"><Linkified text={e.body!.trim()} /></p>
                            </Panel>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
};

/* ── What the client asked for ───────────────────────────────────────────── */

/**
 * The client's own words, shown back to them verbatim.
 *
 * `derived_subject` is deliberately not rendered. That is the model's summary written for
 * the Asana task; showing a client our paraphrase of their own request invites an argument
 * about whether we understood it, and they cannot edit it. They see what they typed.
 */
const TheirWords = ({ ticket, topics }: { ticket: Ticket; topics: TicketTopic[] }) => {
    const detail = (ticket.detail ?? "").trim();
    const neededBy = formatDayLong(ticket.needed_by);
    const images = ticket.image_count ?? 0;
    const folder = (ticket.drive_folder_url ?? "").trim();

    return (
        <section>
            <h2 className="text-md font-semibold text-primary">What you asked for</h2>
            <Panel className="mt-4 p-4 sm:p-5">
                <Eyebrow>{topicLabel(topics, ticket.topic)}</Eyebrow>
                {detail ? (
                    <p className="mt-2 text-sm whitespace-pre-wrap text-pretty text-secondary"><Linkified text={detail} /></p>
                ) : (
                    <p className="mt-2 text-sm text-tertiary">No further detail was added.</p>
                )}

                {(neededBy || images > 0 || folder) && (
                    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-secondary pt-4 text-xs text-tertiary">
                        {neededBy && (
                            <span className="inline-flex items-center gap-1.5">
                                <Calendar className="size-3.5" aria-hidden="true" />
                                {/* Worded as the client's ask, never as our commitment. The only
                                    date we commit to is promised_date, on the card above. */}
                                You asked for this by {neededBy}
                            </span>
                        )}
                        {images > 0 && (
                            <span className="inline-flex items-center gap-1.5">
                                <Image01 className="size-3.5" aria-hidden="true" />
                                {images} {images === 1 ? "image" : "images"} attached
                            </span>
                        )}
                        {folder && (
                            <a
                                href={folder}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex min-h-6 items-center gap-1.5 rounded font-semibold text-brand-secondary outline-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                            >
                                <Folder className="size-3.5" aria-hidden="true" />
                                Open the file folder
                            </a>
                        )}
                    </div>
                )}
            </Panel>
        </section>
    );
};

/* ── Withdrawing ─────────────────────────────────────────────────────────── */

/**
 * Two-step, in the page.
 *
 * Not window.confirm: it cannot be styled, it is announced badly, and on a phone it appears
 * detached from the thing it is about. The confirm step names the request and says in
 * plain words that the row is kept, because rule 4 is that withdrawing closes a request and
 * never deletes it - and a client who thinks "withdraw" means "delete" will not use it.
 */
const WithdrawBlock = ({ ticket, proof, onWithdrawn }: { ticket: Ticket; proof: CallerProof; onWithdrawn: () => void }) => {
    const [confirming, setConfirming] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    if (!canWithdraw(ticket)) return null;
    // ONLY THE PERSON WHO RAISED IT. That is the server's rule (a colleague on
    // the same dashboard gets 403, staff get 403), and a control the server
    // will refuse should not be on the page: it was being shown to everyone
    // who could open the request, and the first anyone learned of the rule
    // was the refusal after the confirm step. submitted_by is on the detail
    // read for exactly this comparison.
    if ((ticket.submitted_by ?? "").trim().toLowerCase() !== proof.email.trim().toLowerCase()) return null;

    const submit = async () => {
        setBusy(true);
        setError("");
        try {
            await withdrawTicket(proof, ticket.reference);
            onWithdrawn();
        } catch (e) {
            setError(e instanceof HelpApiError ? e.message : "We could not withdraw that just then. Try again in a moment.");
            setBusy(false);
        }
    };

    return (
        <section>
            <Panel className="p-4 sm:p-5">
                {confirming ? (
                    <>
                        <p className="text-sm font-semibold text-primary">Withdraw {ticket.reference}?</p>
                        <p className="mt-1.5 max-w-[60ch] text-sm text-pretty text-tertiary">
                            We will stop work on it and mark it withdrawn. It stays on your list with everything on it, so you can always look back at what you
                            asked for.
                        </p>
                        {error && (
                            <p className="mt-3 text-sm text-error-primary" role="alert">
                                {error}
                            </p>
                        )}
                        <div className="mt-4 flex flex-wrap gap-2">
                            <Button size="sm" color="primary-destructive" isDisabled={busy} isLoading={busy} onClick={submit}>
                                Yes, withdraw it
                            </Button>
                            <Button size="sm" color="secondary" isDisabled={busy} onClick={() => setConfirming(false)}>
                                Keep it open
                            </Button>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm text-tertiary">Changed your mind about this request?</p>
                        <Button size="sm" color="secondary-destructive" onClick={() => setConfirming(true)}>
                            Withdraw request
                        </Button>
                    </div>
                )}
            </Panel>
        </section>
    );
};

/* ── The screen ──────────────────────────────────────────────────────────── */

export const HelpRequestDetail = ({
    proof,
    reference,
    slug,
    topics,
    onTicketChanged,
}: {
    proof: CallerProof;
    reference: string;
    slug: string;
    topics: TicketTopic[];
    /** Lets the shell refresh its list and counts after a withdrawal. */
    onTicketChanged: () => void;
}) => {
    const [ticket, setTicket] = useState<Ticket | null>(null);
    const [events, setEvents] = useState<TicketEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [missing, setMissing] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        setMissing(false);
        try {
            const res = await fetchTicket(proof, reference);
            setTicket(res.ticket);
            setEvents(res.events ?? []);
        } catch (e) {
            // A reference that is not this client's own comes back as a 404 rather than a
            // 403, so there is nothing to distinguish here: either way this client has no
            // such request, and saying so is both true and non-enumerable.
            if (e instanceof HelpApiError && e.status === 404) setMissing(true);
            else setError(e instanceof HelpApiError ? e.message : "We could not open that request just then.");
        }
        setLoading(false);
    }, [proof, reference]);

    useEffect(() => {
        void load();
    }, [load]);

    // `-ml-2 px-2` is optical alignment, not a stray margin: the padding gives the link a
    // 44px-tall hover and focus surface that bleeds 8px into the page gutter, while the
    // LABEL still starts at exactly 16px, flush with every heading and paragraph under it.
    // An edge-gutter audit measures border boxes and will report this as content 8px from
    // the edge. It is not - measure where the text starts before changing it.
    const backLink = (
        <Link
            to={`/${slug}/help/requests`}
            className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-brand-secondary transition duration-100 ease-linear outline-brand hover:bg-primary_hover focus-visible:outline-2 focus-visible:outline-offset-2"
        >
            <ArrowNarrowLeft className="size-4" aria-hidden="true" />
            All requests
        </Link>
    );

    if (loading) {
        return (
            <div>
                {backLink}
                <HelpSpinner label={`Opening ${reference}`} />
            </div>
        );
    }

    if (missing || !ticket) {
        return (
            <div className="flex flex-col gap-6">
                {backLink}
                <Panel className="px-5 py-12 text-center">
                    <p className="text-md font-semibold text-primary">We cannot find {reference}</p>
                    <p className="mx-auto mt-1.5 max-w-[44ch] text-sm text-pretty text-tertiary">
                        Check the reference, or open it from your list of requests.
                    </p>
                    <div className="mt-5 flex justify-center">
                        <Button size="sm" color="secondary" href={`/${slug}/help/requests`}>
                            See my requests
                        </Button>
                    </div>
                </Panel>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            {backLink}

            {error && <ErrorNote message={error} onRetry={() => void load()} />}

            <header>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <MonoRef className="text-sm">{ticket.reference}</MonoRef>
                    <StatusPill status={ticket.status} size="sm" />
                </div>
                <h1 className="mt-2 text-display-xs font-semibold text-pretty text-primary sm:text-display-sm">{ticket.title}</h1>
                <p className="mt-2 text-sm text-tertiary">
                    Raised {formatStampShort(ticket.created_at)}
                    {(ticket.submitted_by_name ?? "").trim() ? ` by ${ticket.submitted_by_name!.trim()}` : ""}
                </p>
            </header>

            {/* Order below is the approved design's and is the same at every width. See the
                file header for why the phone and the desktop differ in shape but not order. */}
            <PromiseCard ticket={ticket} />
            <FactRow ticket={ticket} />
            <TheirWords ticket={ticket} topics={topics} />
            <Timeline events={events} />
            <TeamUpdates events={events} />
            <WithdrawBlock
                ticket={ticket}
                proof={proof}
                onWithdrawn={() => {
                    void load();
                    onTicketChanged();
                }}
            />
        </div>
    );
};
