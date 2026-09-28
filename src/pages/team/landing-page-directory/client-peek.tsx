import { AlertTriangle } from "@untitledui/icons";
import { cx } from "@/utils/cx";
import { ClientCard } from "./client-card";
import { ALERTS, type DirectoryClient, type EditorTab, issuesFor } from "./directory-model";
import { DirectoryModal } from "./directory-ui";

/**
 * A client opened from the table, the overview or an alert: what needs attention (with a Fix
 * that opens the editor on the right tab) and the client's card.
 */
export const ClientPeek = ({
    client,
    alertId,
    editing,
    onClose,
    onEdit,
}: {
    client: DirectoryClient;
    /** The alert that led here, so its line reads as the current one. */
    alertId?: string;
    editing: boolean;
    onClose: () => void;
    onEdit: (tab?: EditorTab) => void;
}) => {
    const issues = issuesFor(client);
    const current = ALERTS.find((r) => r.id === alertId);
    return (
        <DirectoryModal title={client.name} hideTitle onClose={onClose} width="max-w-2xl">
            {/* mr-10 keeps it clear of the floating close button. */}
            {issues.length > 0 && (
                <div className="mr-10 mb-4 rounded-xl border border-error_subtle bg-error-primary px-4 py-3">
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-error-primary">
                        <AlertTriangle className="size-4" aria-hidden="true" />
                        Needs attention
                    </span>
                    <ul className="mt-1.5 flex flex-col">
                        {issues.map((r) => (
                            <li
                                key={r.id}
                                className={cx("flex min-h-8 items-center gap-2.5 text-sm", r.id === alertId ? "font-semibold text-primary" : "text-secondary")}
                            >
                                <span className={"size-1.5 shrink-0 rounded-full bg-fg-error-secondary"} aria-hidden="true" />
                                {r.label}
                                {editing && (
                                    <button
                                        type="button"
                                        onClick={() => onEdit(r.tab)}
                                        className="ml-auto text-xs font-semibold text-brand-secondary hover:underline"
                                    >
                                        Fix
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            <ClientCard client={client} editing={editing} onEdit={() => onEdit(current?.tab)} details entrance={false} className="border-0 p-0 shadow-none" />
        </DirectoryModal>
    );
};
