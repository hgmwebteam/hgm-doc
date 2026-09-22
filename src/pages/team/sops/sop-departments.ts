import { Announcement02, Code02, Dataflow03, Lock01, PenTool01, Users01 } from "@untitledui/icons";

/**
 * SOP departments — the taxonomy SOP IDs are numbered within (HGM-SOP-WEB-001).
 *
 * This is data on purpose: the dashboard's own DEPARTMENTS array (Clients, Website,
 * AM, Docs) describes the portal's rail and stays in dashboard-screen.tsx. SOP
 * departments are a property of the SOP library and can grow without touching the
 * rail. Adding one is a row here; the sidebar, the coverage bars and the card groups
 * all read this list. When the library moves into a Supabase table the columns are
 * the same.
 *
 * `requiresApproval` marks a department whose SOPs need a lead's sign-off before they
 * publish (the plan's SEC gate). The MVP only draws the lock; the gate itself is phase 2.
 */
export interface SopDepartment {
    /** Three-letter code used in the SOP ID. Upper case. */
    code: string;
    name: string;
    icon: typeof Code02;
    requiresApproval: boolean;
}

export const SOP_DEPARTMENTS: SopDepartment[] = [
    { code: "ACC", name: "Account Management", icon: Users01, requiresApproval: false },
    { code: "WEB", name: "Web", icon: Code02, requiresApproval: false },
    { code: "ADS", name: "Ads", icon: Announcement02, requiresApproval: false },
    { code: "CON", name: "Content", icon: PenTool01, requiresApproval: false },
    { code: "PLA", name: "Platforms", icon: Dataflow03, requiresApproval: false },
    { code: "SEC", name: "Security", icon: Lock01, requiresApproval: true },
];

/** Sidebar tab id for a department — lower-case code, so `?dept=sops&tab=web` reads naturally. */
export const sopDeptTabId = (code: string) => code.toLowerCase();

export const findSopDepartment = (code: string) => SOP_DEPARTMENTS.find((d) => d.code === code.toUpperCase());
