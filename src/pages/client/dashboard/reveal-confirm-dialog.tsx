import { AlertTriangle, Eye } from "@untitledui-pro/icons/line";
import { Heading as AriaHeading } from "react-aria-components";
import { Dialog, Modal, ModalOverlay } from "@/components/application/modals/modal";
import { Button } from "@/components/base/buttons/button";
import { FeaturedIcon } from "@/components/foundations/featured-icon/featured-icon";
import type { RevealCheck } from "@/pages/client/dashboard/reveal-check";

/**
 * Asked before an eye in the side menu shows a section to the client. Hiding never asks,
 * since it can't leak anything. The reveal itself still only reaches the client on Save,
 * so the copy says "once you save" rather than implying it's already live.
 */
export const RevealConfirmDialog = ({
    open,
    label,
    clientName,
    check,
    notBuilt,
    onCancel,
    onConfirm,
}: {
    open: boolean;
    label: string;
    clientName: string;
    check: RevealCheck | null;
    /** Nothing behind the row yet: the eye approves it rather than revealing it. */
    notBuilt: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}) => {
    const empty = check?.empty ?? [];
    const hasEmpty = empty.length > 0;
    const who = clientName.trim() || "this client";

    return (
        <ModalOverlay isOpen={open} onOpenChange={(o) => !o && onCancel()} isDismissable>
            <Modal className="max-w-120">
                <Dialog role="alertdialog" aria-label={`Show ${label} to ${who}?`}>
                    <div className="flex w-full flex-col gap-4 rounded-xl bg-primary p-6 shadow-xl ring-1 ring-secondary">
                        <FeaturedIcon icon={hasEmpty ? AlertTriangle : Eye} color={hasEmpty ? "warning" : "brand"} theme="light" size="lg" />
                        <div className="flex flex-col gap-1">
                            <AriaHeading slot="title" className="text-lg font-semibold text-balance text-primary">
                                Show {label} to {who}?
                            </AriaHeading>
                            <p className="text-sm text-tertiary">
                                {notBuilt
                                    ? `Once you save, ${who} will see this section as soon as it's ready.`
                                    : hasEmpty
                                      ? `Once you save, ${who} can open this section, including the parts that are still empty.`
                                      : `Once you save, ${who} can open this section and see everything in it.`}
                            </p>
                        </div>
                        {hasEmpty && (
                            <div className="rounded-lg bg-warning-primary p-3.5 ring-1 ring-utility-yellow-200 ring-inset">
                                <p className="text-sm font-semibold text-warning-primary">
                                    {check && check.total > 3 ? `${empty.length} of ${check.total} sections are still empty` : "Still to do"}
                                </p>
                                <ul className="mt-1.5 list-disc gap-x-5 pl-4.5 text-sm/6 text-secondary sm:columns-2">
                                    {empty.map((e) => (
                                        <li key={e}>{e}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        <div className="mt-2 flex gap-3">
                            <Button color="secondary" size="lg" className="flex-1" onClick={onCancel}>
                                Cancel
                            </Button>
                            <Button color="primary" size="lg" className="flex-1" onClick={onConfirm}>
                                {hasEmpty ? "Show anyway" : "Show to client"}
                            </Button>
                        </div>
                    </div>
                </Dialog>
            </Modal>
        </ModalOverlay>
    );
};
