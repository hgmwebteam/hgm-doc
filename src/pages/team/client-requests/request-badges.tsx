/**
 * The status and priority badges the Client Requests table, its card list and its request
 * panel share (owner, 21 Oct 2026). Words come from help-model; colours are the owner's.
 */
import { Badge, BadgeWithDot } from "@/components/base/badges/badges";
import { PRIORITIES, type Priority, STATUS_META, type TicketStatus } from "@/pages/client/help/help-model";

/** Received and Assigned gray, In progress brand, Awaiting review warning, Completed success, Withdrawn gray. */
const STATUS_COLOR: Record<TicketStatus, "gray" | "brand" | "warning" | "success"> = {
    received: "gray",
    assigned: "gray",
    in_progress: "brand",
    in_review: "warning",
    completed: "success",
    withdrawn: "gray",
};

/** The priority tints the request form's chips use (help-model PRIORITIES): blue, green, yellow, red. */
const PRIORITY_COLOR: Record<Priority, "brand" | "success" | "warning" | "error"> = { low: "brand", medium: "success", high: "warning", urgent: "error" };

export const StatusBadge = ({ status }: { status: TicketStatus }) => (
    <Badge type="pill-color" size="sm" color={STATUS_COLOR[status]} className="whitespace-nowrap">
        {STATUS_META[status].label}
    </Badge>
);

export const PriorityBadge = ({ priority }: { priority: Priority | null | undefined }) => {
    const meta = PRIORITIES.find((p) => p.key === priority);
    return meta ? (
        <BadgeWithDot type="modern" size="sm" color={PRIORITY_COLOR[meta.key]}>
            {meta.label}
        </BadgeWithDot>
    ) : (
        <span className="text-sm text-quaternary">Not set</span>
    );
};
