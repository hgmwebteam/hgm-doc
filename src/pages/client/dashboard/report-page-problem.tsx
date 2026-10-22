/**
 * Team only: a warning button in the bottom-right corner of a client dashboard. An account
 * manager who spots something wrong on the open page (a Welcome Flow email, a Pinned Post)
 * reports it from here without leaving it (owner's Loom, 22 Oct 2026).
 *
 * The report is a Client Request like any other, so nothing new on the server: the Help
 * Center's own RequestForm, raised as staff, with this page's link already in Pages and room
 * for the issue and screenshots. It lands in Website > Client Requests, and the client sees it
 * in their Help Center as raised by the team (owner's choice, 22 Oct 2026). The form is drawn
 * with the help centre's tokens, hence the .hc scope.
 *
 * The caller proof and the categories are read when the window opens, not on every dashboard
 * visit. No em or en dashes in the copy.
 */
import { useState } from "react";
import { AlertTriangle, RefreshCw01 } from "@untitledui/icons";
import { LoadingIndicator } from "@/components/application/loading-indicator/loading-indicator";
import { Dialog, Modal, ModalOverlay } from "@/components/application/modals/modal";
import { Button } from "@/components/base/buttons/button";
import { CloseButton } from "@/components/base/buttons/close-button";
import { type CallerProof, HelpApiError, type Viewer, createTicket, currentCaller, fetchTopics, fullDashboardSlug } from "@/pages/client/help/help-api";
import { RequestForm, RequestSent, sentExtrasFrom } from "@/pages/client/help/help-form";
import type { Priority, TicketTopic } from "@/pages/client/help/help-model";
import { submitterNamePrefill } from "@/pages/client/help/request-rules";

type Load =
    | { kind: "loading" }
    | { kind: "error"; message: string }
    | { kind: "ready"; proof: CallerProof; viewer: Viewer; topics: TicketTopic[] }
    | {
          kind: "sent";
          proof: CallerProof;
          viewer: Viewer;
          reference: string;
          title: string;
          priority: Priority | null;
          urls: string[];
          files: string[];
          submittedByName: string;
      };

export const ReportPageProblem = ({ slug, pageLabel, pageUrl }: { slug: string; pageLabel: string; pageUrl: string }) => {
    const [open, setOpen] = useState(false);
    const [load, setLoad] = useState<Load>({ kind: "loading" });

    const start = async () => {
        setLoad({ kind: "loading" });
        try {
            const proof = await currentCaller(fullDashboardSlug(slug));
            if (!proof) throw new HelpApiError(401, "Sign in with your hiddengem.media Google account to report a problem.");
            const { viewer, topics } = await fetchTopics(proof);
            setLoad({ kind: "ready", proof, viewer, topics: topics ?? [] });
        } catch (e) {
            setLoad({ kind: "error", message: e instanceof HelpApiError ? e.message : "We could not open the report form just then." });
        }
    };

    const openReport = () => {
        setOpen(true);
        void start();
    };

    return (
        <>
            <button
                type="button"
                onClick={openReport}
                aria-label={`Report a problem on ${pageLabel}`}
                title={`Report a problem on ${pageLabel}`}
                className="fixed right-4 bottom-4 z-40 flex size-11 cursor-pointer items-center justify-center rounded-full bg-primary text-fg-warning-primary shadow-lg ring-1 ring-secondary outline-focus-ring transition duration-100 ease-linear ring-inset hover:bg-warning-primary focus-visible:outline-2 focus-visible:outline-offset-2"
            >
                <AlertTriangle className="size-5" aria-hidden="true" />
            </button>

            <ModalOverlay isOpen={open} onOpenChange={setOpen} isDismissable>
                <Modal className="max-w-160">
                    <Dialog aria-label={`Report a problem on ${pageLabel}`}>
                        <div className="relative flex w-full flex-col gap-4 rounded-xl bg-primary p-6 shadow-xl ring-1 ring-secondary">
                            <CloseButton label="Close" className="absolute top-3 right-3" onPress={() => setOpen(false)} />
                            {/* The form below carries its own heading; this line says where the report is from and where it goes. */}
                            <p className="pr-8 text-sm text-tertiary">
                                <span className="font-semibold text-secondary">Reporting from {pageLabel}.</span> It goes to the Web Team as a Client Request
                                with this page's link already added, and the client sees it in their Help Center as raised by the team.
                            </p>

                            {load.kind === "loading" && (
                                <div className="flex justify-center py-12" role="status">
                                    <LoadingIndicator type="line-spinner" size="sm" label="Opening the report form" />
                                </div>
                            )}

                            {load.kind === "error" && (
                                <div className="flex flex-col items-start gap-3 py-4">
                                    <p className="text-sm text-error-primary">{load.message}</p>
                                    <Button color="secondary" size="md" iconLeading={RefreshCw01} onClick={() => void start()}>
                                        Try again
                                    </Button>
                                </div>
                            )}

                            {load.kind === "ready" && (
                                <div className="hc">
                                    <RequestForm
                                        mode="client"
                                        slug={load.proof.slug}
                                        topics={load.topics}
                                        clientName={load.viewer.clientName}
                                        websites={load.viewer.websites ?? []}
                                        submitterName={submitterNamePrefill([load.viewer.name], load.proof.email)}
                                        email={`${load.proof.email} (HiddenGem Media)`}
                                        viewerIsStaff
                                        initialPages={[pageUrl]}
                                        // The completion notice goes back to whoever reported it (owner's Loom, 22 Oct 2026: the field was required and empty).
                                        initialNotifyEmail={load.proof.email.trim().toLowerCase()}
                                        focusFirstField
                                        onSubmit={async (input) => {
                                            const res = await createTicket(load.proof, input);
                                            return { reference: res.ticket.reference, stored: sentExtrasFrom(res) };
                                        }}
                                        onCreated={(reference, _slug, sent) =>
                                            setLoad({
                                                kind: "sent",
                                                proof: load.proof,
                                                viewer: load.viewer,
                                                reference,
                                                title: sent.title,
                                                priority: sent.priority,
                                                urls: sent.urls ?? [],
                                                files: sent.files ?? [],
                                                submittedByName: sent.submittedByName ?? "",
                                            })
                                        }
                                    />
                                </div>
                            )}

                            {load.kind === "sent" && (
                                <div className="hc">
                                    <RequestSent
                                        reference={load.reference}
                                        title={load.title}
                                        clientName={load.viewer.clientName}
                                        priority={load.priority}
                                        team
                                        slug={load.proof.slug}
                                        urls={load.urls}
                                        files={load.files}
                                        submittedByName={load.submittedByName}
                                        primary={{ label: "Report another problem", onClick: () => void start() }}
                                        secondary={{ label: "Back to the page", onClick: () => setOpen(false) }}
                                    />
                                </div>
                            )}
                        </div>
                    </Dialog>
                </Modal>
            </ModalOverlay>
        </>
    );
};
