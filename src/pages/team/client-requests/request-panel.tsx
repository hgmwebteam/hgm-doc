/**
 * Client Requests, phase 2 (owner, 21 Oct 2026): one request in a slide-out over the list,
 * so the team can read it and approve it without leaving the dashboard. The full request
 * page stays one link away ("Open full page"), and Cmd/Ctrl-click on a row still opens it.
 *
 * The open request is the URL (?request=REQ-nnnn beside dept and tab, owned by the screen),
 * so a panel can be linked to and Back closes it. The vendored Untitled UI slide-out
 * (slideout-menus) gives the focus trap, Esc and the click-outside close; below md the sheet
 * takes the whole screen.
 *
 * The detail is the help centre's own read: fetchTicket with a caller proof for the
 * request's client, built from the session exactly as the help centre builds it
 * (currentCaller). Staff pass verifyCaller for any client, and as staff the answer carries
 * the assignee, the promised date and every history event. Approve is the request page's
 * own ApproveBlock (help-request-detail.tsx), same copy and same refusals, inside an .hc
 * scope because it is drawn with the help centre's tokens. After it the panel stays open,
 * says what happened, and hands the row's new status to the list (approvedPatch).
 *
 * No em or en dashes in the copy.
 */
import { type ReactNode, useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle, FileSearch02, LinkExternal01, RefreshCw01 } from "@untitledui/icons";
import { LoadingIndicator } from "@/components/application/loading-indicator/loading-indicator";
import { Dialog, Modal, ModalOverlay, SlideoutMenu } from "@/components/application/slideout-menus/slideout-menu";
import { Button } from "@/components/base/buttons/button";
import { FeaturedIcon } from "@/components/foundations/featured-icon/featured-icon";
import { type CallerProof, HelpApiError, currentCaller, fetchTicket, fullDashboardSlug } from "@/pages/client/help/help-api";
import { formatFileSize } from "@/pages/client/help/help-atoms";
import {
    type Ticket,
    type TicketEvent,
    type TicketFile,
    type TicketTopic,
    actorName,
    displayUrl,
    formatDayMonthTime,
    formatDueDay,
    formatStampWithTime,
    isWebLink,
    topicLabel,
} from "@/pages/client/help/help-model";
import { ApproveBlock } from "@/pages/client/help/help-request-detail";
import { storedWebsitesOf } from "@/pages/client/help/request-rules";
import { approvedPatch, clientNameOf, eventLabel, isOverdue, requestHref } from "@/pages/team/client-requests/client-requests-model";
import { PriorityBadge, StatusBadge } from "@/pages/team/client-requests/request-badges";
import { cx } from "@/utils/cx";
import { Linkified } from "@/utils/linkify";

type Detail =
    | { kind: "loading" }
    | { kind: "missing" }
    | { kind: "error"; message: string }
    | { kind: "ready"; proof: CallerProof; ticket: Ticket; events: TicketEvent[]; files: TicketFile[] };

const amName = (t: Ticket) => (t.account_manager_name ?? "").trim() || (t.account_manager_email ?? "").trim();

export const RequestPanel = ({
    reference,
    row,
    rowsReady,
    topics,
    today,
    onClose,
    onRowChanged,
}: {
    /** The open request, or null when the panel is shut. */
    reference: string | null;
    /** Its row in the loaded list: the client slug the proof needs, and the title while the detail loads. */
    row: Ticket | undefined;
    rowsReady: boolean;
    topics: TicketTopic[];
    today: string;
    onClose: () => void;
    onRowChanged: (id: string, patch: Pick<Ticket, "status" | "completed_at">) => void;
}) => {
    // What the sheet shows while it slides out, after the URL has already dropped the reference.
    const last = useRef<{ reference: string; row: Ticket | undefined }>(null);
    if (reference) last.current = { reference, row };
    const shown = reference ? { reference, row } : last.current;

    return (
        <ModalOverlay isOpen={!!reference} onOpenChange={(open) => !open && onClose()} isDismissable className="z-50 max-md:pl-0">
            <Modal className="max-w-full md:max-w-120">
                <Dialog aria-label={shown ? `Request ${shown.reference}` : "Request"} className="gap-0">
                    {shown && (
                        <PanelBody
                            key={shown.reference}
                            reference={shown.reference}
                            row={shown.row}
                            rowsReady={rowsReady}
                            topics={topics}
                            today={today}
                            onClose={onClose}
                            onRowChanged={onRowChanged}
                        />
                    )}
                </Dialog>
            </Modal>
        </ModalOverlay>
    );
};

const PanelBody = ({
    reference,
    row,
    rowsReady,
    topics,
    today,
    onClose,
    onRowChanged,
}: {
    reference: string;
    row: Ticket | undefined;
    rowsReady: boolean;
    topics: TicketTopic[];
    today: string;
    onClose: () => void;
    onRowChanged: (id: string, patch: Pick<Ticket, "status" | "completed_at">) => void;
}) => {
    const [detail, setDetail] = useState<Detail>({ kind: "loading" });
    const [attempt, setAttempt] = useState(0);
    const [approved, setApproved] = useState("");
    const slug = row?.client_slug ?? "";

    useEffect(() => {
        if (!slug) {
            // A link to a request that is not in the loaded list has no client to ask about.
            setDetail(rowsReady ? { kind: "missing" } : { kind: "loading" });
            return;
        }
        let live = true;
        setDetail({ kind: "loading" });
        (async () => {
            const proof = await currentCaller(fullDashboardSlug(slug));
            if (!proof) throw new HelpApiError(401, "Sign in with your hiddengem.media Google account to open requests.");
            const res = await fetchTicket(proof, reference);
            return { kind: "ready" as const, proof, ticket: res.ticket, events: res.events ?? [], files: res.files ?? [] };
        })().then(
            (d) => live && setDetail(d),
            (e) =>
                live &&
                setDetail(
                    e instanceof HelpApiError && e.status === 404
                        ? { kind: "missing" }
                        : { kind: "error", message: e instanceof HelpApiError ? e.message : "We could not open that request just then." },
                ),
        );
        return () => {
            live = false;
        };
    }, [slug, reference, rowsReady, attempt]);

    /** After Approve: read it again for the completed stamp and the new history, then tell the list. */
    const afterApprove = async (line: string, proof: CallerProof, ticket: Ticket) => {
        setApproved(line);
        const fresh = await fetchTicket(proof, reference).catch(() => null);
        const patch = approvedPatch(fresh?.ticket ?? null, new Date().toISOString());
        setDetail((d) =>
            d.kind === "ready"
                ? { ...d, ticket: { ...(fresh?.ticket ?? d.ticket), ...patch }, events: fresh?.events ?? d.events, files: fresh?.files ?? d.files }
                : d,
        );
        onRowChanged(ticket.id, patch);
    };

    const ticket = detail.kind === "ready" ? detail.ticket : undefined;
    const title = ticket?.title ?? row?.title ?? "";
    const status = ticket?.status ?? row?.status;

    return (
        <>
            <SlideoutMenu.Header onClose={onClose} className="flex flex-col gap-2 border-b border-secondary pb-4">
                <div className="flex flex-wrap items-center gap-2 pr-10">
                    <span className="font-mono text-xs text-secondary">{reference}</span>
                    {status && <StatusBadge status={status} />}
                </div>
                {title && <h2 className="pr-6 text-lg font-semibold text-primary">{title}</h2>}
                {row && (
                    <Button href={requestHref(row)} color="link-color" size="sm" iconTrailing={LinkExternal01} className="self-start">
                        Open full page
                    </Button>
                )}
            </SlideoutMenu.Header>

            <SlideoutMenu.Content className="min-h-0 flex-1 gap-6 py-5">
                {detail.kind === "loading" ? (
                    <div className="flex flex-1 items-center justify-center py-16" role="status">
                        <LoadingIndicator type="line-spinner" size="sm" label={`Opening ${reference}`} />
                    </div>
                ) : detail.kind === "missing" ? (
                    <PanelNote icon={FileSearch02} title={`We cannot find ${reference}`} text="It is not among the loaded requests, or the reference is wrong.">
                        <Button color="secondary" size="md" onClick={onClose}>
                            Close
                        </Button>
                    </PanelNote>
                ) : detail.kind === "error" ? (
                    <PanelNote icon={AlertCircle} color="error" title={`${reference} did not open`} text={detail.message}>
                        <Button color="secondary" size="md" iconLeading={RefreshCw01} onClick={() => setAttempt((n) => n + 1)}>
                            Try again
                        </Button>
                    </PanelNote>
                ) : (
                    <Ready
                        detail={detail}
                        topics={topics}
                        today={today}
                        approved={approved}
                        onApproved={(line) => void afterApprove(line, detail.proof, detail.ticket)}
                    />
                )}
            </SlideoutMenu.Content>
        </>
    );
};

const PanelNote = ({
    icon,
    color = "gray",
    title,
    text,
    children,
}: {
    icon: typeof AlertCircle;
    color?: "gray" | "error";
    title: string;
    text: string;
    children: ReactNode;
}) => (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
        <FeaturedIcon icon={icon} color={color} theme={color === "gray" ? "modern" : "light"} size="lg" />
        <p className="text-md font-semibold text-primary">{title}</p>
        <p className="max-w-80 text-sm text-tertiary">{text}</p>
        <div className="mt-2">{children}</div>
    </div>
);

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
    <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-primary">{title}</h3>
        {children}
    </section>
);

/**
 * The facts in labelled groups, each one drawn like a filled, read-only Untitled UI input (sm):
 * label above, value in the bordered box (owner's Loom, 21 Oct 2026: one long list was hard to
 * scan). Still a description list, so it reads as facts and adds no tab stops.
 */
const Facts = ({ title, children }: { title: string; children: ReactNode }) => (
    <Section title={title}>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</dl>
    </Section>
);

const Fact = ({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) => (
    <div className={cx("flex min-w-0 flex-col gap-1.5", wide && "sm:col-span-2")}>
        <dt className="text-sm font-medium text-secondary">{label}</dt>
        <dd className="flex min-h-9 min-w-0 flex-col items-start justify-center rounded-lg bg-primary px-3 py-2 text-sm break-words text-primary shadow-xs ring-1 ring-primary ring-inset">
            {children}
        </dd>
    </div>
);

const Muted = ({ children }: { children: ReactNode }) => <span className="text-quaternary">{children}</span>;

const Ready = ({
    detail,
    topics,
    today,
    approved,
    onApproved,
}: {
    detail: Extract<Detail, { kind: "ready" }>;
    topics: TicketTopic[];
    today: string;
    approved: string;
    onApproved: (line: string) => void;
}) => {
    const { ticket: t, events, files, proof } = detail;
    const sites = (storedWebsitesOf(t.websites)?.chosen ?? []).filter((w) => isWebLink(w.url));
    const pages = (Array.isArray(t.urls) ? t.urls : []).filter(isWebLink);
    const by = (t.submitted_by_name ?? "").trim();
    const history = [...events].sort((a, b) => a.created_at.localeCompare(b.created_at));

    return (
        <>
            {approved && (
                <div role="status" className="flex gap-3 rounded-xl bg-success-primary p-4">
                    <CheckCircle className="mt-0.5 size-5 shrink-0 text-fg-success-primary" aria-hidden="true" />
                    <p className="text-sm text-secondary">{approved}</p>
                </div>
            )}
            {t.status === "in_review" && (
                <div className="hc">
                    <ApproveBlock ticket={t} proof={proof} onApproved={onApproved} />
                </div>
            )}

            <Facts title="Details">
                <Fact label="Client">{clientNameOf(t) || <Muted>Not given</Muted>}</Fact>
                <Fact label="Category">{topicLabel(topics, t.topic)}</Fact>
                <Fact label="Priority">
                    <PriorityBadge priority={t.priority} />
                </Fact>
                {(t.property ?? "").trim() && <Fact label="Property">{t.property}</Fact>}
            </Facts>

            <Facts title="Dates">
                <Fact label="Raised">{formatStampWithTime(t.created_at)}</Fact>
                <Fact label="Needed by">
                    {t.needed_by ? (
                        <span className={cx(isOverdue(t, today) && "font-medium text-error-primary")}>
                            {formatDueDay(t.needed_by)}
                            {isOverdue(t, today) && ", overdue"}
                        </span>
                    ) : (
                        <Muted>Not set</Muted>
                    )}
                </Fact>
                {t.promised_date && <Fact label="Promised">{formatDueDay(t.promised_date)}</Fact>}
            </Facts>

            <Facts title="People">
                <Fact label="Assigned to">{(t.assignee_name ?? "").trim() || <Muted>Not assigned</Muted>}</Fact>
                <Fact label="Account manager">{amName(t) || <Muted>None</Muted>}</Fact>
                <Fact label="Submitted by" wide>
                    {by || <Muted>Not given</Muted>}
                    {t.submitted_by && <span className="text-tertiary">{t.submitted_by}</span>}
                </Fact>
            </Facts>

            <Section title="Request">
                {(t.detail ?? "").trim() ? (
                    <p className="text-sm whitespace-pre-wrap text-secondary">
                        <Linkified text={t.detail!.trim()} />
                    </p>
                ) : (
                    <p className="text-sm text-quaternary">No detail given.</p>
                )}
            </Section>

            {sites.length > 0 && (
                <Section title="Websites">
                    <ul className="flex flex-col gap-1 text-sm">
                        {sites.map((w) => (
                            <li key={w.url}>
                                <a
                                    href={w.url}
                                    target="_blank"
                                    rel="noopener noreferrer nofollow"
                                    className="font-medium text-brand-secondary underline underline-offset-2 hover:text-brand-secondary_hover"
                                >
                                    {w.name}
                                </a>{" "}
                                <span className="text-tertiary">{displayUrl(w.url)}</span>
                            </li>
                        ))}
                    </ul>
                </Section>
            )}

            {pages.length > 0 && (
                <Section title="Pages">
                    <ul className="flex flex-col gap-1 text-sm">
                        {pages.map((u) => (
                            <li key={u} className="break-words">
                                <a
                                    href={u}
                                    target="_blank"
                                    rel="noopener noreferrer nofollow"
                                    className="text-brand-secondary underline underline-offset-2 hover:text-brand-secondary_hover"
                                >
                                    {displayUrl(u)}
                                </a>
                            </li>
                        ))}
                    </ul>
                </Section>
            )}

            {files.length > 0 && (
                <Section title="Files">
                    <ul className="flex flex-col gap-1 text-sm">
                        {files.map((f, i) => (
                            <li key={`${i}-${f.name}`} className="flex gap-3">
                                <span className="min-w-0 flex-1 break-words text-primary">{f.name}</span>
                                {typeof f.bytes === "number" && <span className="shrink-0 text-tertiary">{formatFileSize(f.bytes)}</span>}
                            </li>
                        ))}
                    </ul>
                </Section>
            )}

            <Section title="History">
                {history.length ? (
                    <ol className="flex flex-col">
                        {history.map((e, i) => (
                            <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
                                {/* The line between dots: decorative, the order is the list's. */}
                                {i < history.length - 1 && <span aria-hidden="true" className="absolute top-3 bottom-0 left-[3px] w-px bg-border-secondary" />}
                                <span aria-hidden="true" className="relative mt-1.5 size-2 shrink-0 rounded-full bg-fg-quaternary" />
                                <div className="flex min-w-0 flex-col gap-0.5 text-sm">
                                    <p className="font-medium text-primary">{eventLabel(e.kind)}</p>
                                    <p className="text-tertiary">
                                        {actorName(e)} · {formatDayMonthTime(e.created_at)}
                                    </p>
                                    {(e.body ?? "").trim() && (
                                        <p className="line-clamp-4 whitespace-pre-wrap text-secondary">
                                            <Linkified text={e.body!.trim()} />
                                        </p>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ol>
                ) : (
                    <p className="text-sm text-quaternary">Nothing recorded yet.</p>
                )}
            </Section>
        </>
    );
};
