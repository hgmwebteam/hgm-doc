/**
 * The real HGM roster (hiddengem.media/team) — canonical names for the client
 * assignment dropdowns so per-person counts never fragment on typos. AMs pair
 * with a Marketing Assistant to handle each client. `clients.am` stores one of
 * these names, never an address.
 *
 * Lives in lib (not dashboard-screen) so the shell, the bell and search can ask
 * "who is signed in" without a page → shell → page import.
 */
// Gillian Conley is Operations Manager, not an AM — deliberately not listed.
export const ACCOUNT_MANAGERS = ["Makenna Moran", "Alicia Morin", "Charlotte Pickering", "Ananya Arora", "Nicole Araya", "Chiara Henry", "Kristal Puguan"];
export const MARKETING_ASSISTANTS = ["Vicky Si", "Lily Phanthavong", "Lucca Maggiolo"];
export const WEB_TEAM = ["AnhTuan Bui", "Brandon Nguyen", "Leshan Patterson", "Kyle Zinger"];
export const OPERATIONS_MANAGER = "Gillian Conley";

export const OWNER_EMAIL = "anhtuan@hiddengem.media";

/**
 * What the signed-in teammate sees:
 *  - owner — everything, including the project logs and questions only AnhTuan works
 *  - ops   — the Operations Manager: every AM's clients, plus an activity view per AM
 *  - am    — only their own clients, comments and pipeline
 *  - team  — anyone else on @hiddengem.media: the company view, without owner-only pages
 */
export type TeamRole = { kind: "owner" } | { kind: "ops" } | { kind: "am"; amName: string } | { kind: "team" };

const norm = (s: string | null | undefined) => (s ?? "").trim().replace(/\s+/g, " ").toLowerCase();

/** Roster names match on the Google account's full name, or on the mailbox being the
 *  person's first name (alicia@ → Alicia Morin), so no addresses ship in the bundle. */
const matches = (rosterName: string, user: { email: string; name: string }) =>
    norm(user.name) === norm(rosterName) || norm(user.email.split("@")[0]) === norm(rosterName.split(" ")[0]);

export const teamRoleOf = (user: { email: string; name: string } | null): TeamRole => {
    if (!user) return { kind: "team" };
    if (norm(user.email) === OWNER_EMAIL) return { kind: "owner" };
    if (matches(OPERATIONS_MANAGER, user)) return { kind: "ops" };
    const am = ACCOUNT_MANAGERS.find((n) => matches(n, user));
    return am ? { kind: "am", amName: am } : { kind: "team" };
};

/** Is this client one of the AM's? `clients.am` also keeps legacy free-typed names. */
export const isAmClient = (clientAm: string | null | undefined, amName: string) => norm(clientAm) === norm(amName);

/** The `clients` row a dashboard slug belongs to — the only link the data has is
 *  `clients.link` ending in "/{slug}" (same rule as netlify/functions/form-submitted.mts). */
export const clientForSlug = <T extends { link?: string | null }>(clients: T[], slug: string): T | undefined =>
    clients.find((c) => (c.link ?? "").trim().replace(/\/+$/, "").toLowerCase().endsWith(`/${slug.toLowerCase()}`));
