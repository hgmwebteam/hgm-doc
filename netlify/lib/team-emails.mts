/**
 * Work email for each name on the Account Manager roster — `ACCOUNT_MANAGERS` in
 * src/pages/team/dashboard-screen.tsx, which is what `clients.am` stores (a name, never an
 * address). Keep the two lists in step: an AM missing here is simply not emailed, and the
 * function logs which name it could not resolve.
 *
 * Server-side on purpose, so the roster's addresses aren't shipped in the public bundle.
 */
const ACCOUNT_MANAGER_EMAILS: Record<string, string> = {
    "Alicia Morin": "alicia@hiddengem.media",
    "Makenna Moran": "",
    "Charlotte Pickering": "",
    "Ananya Arora": "",
    "Nicole Araya": "",
    "Chiara Henry": "",
    "Kristal Puguan": "",
};

/** Case- and whitespace-insensitive, because `clients.am` also keeps legacy free-typed names. */
export const accountManagerEmail = (name: string | null | undefined): string | null => {
    const key = (name ?? "").trim().replace(/\s+/g, " ").toLowerCase();
    if (!key) return null;
    for (const [n, email] of Object.entries(ACCOUNT_MANAGER_EMAILS)) {
        if (n.toLowerCase() === key) return email || null;
    }
    return null;
};
