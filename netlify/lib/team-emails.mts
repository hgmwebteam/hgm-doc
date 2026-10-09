/**
 * Work email for each name on the Account Manager roster — `ACCOUNT_MANAGERS` in
 * src/lib/team-roster.ts, which is what `clients.am` stores (a name, never an
 * address). Keep the two lists in step: an AM missing here is simply not emailed, and the
 * function logs which name it could not resolve.
 *
 * Server-side on purpose, so the roster's addresses aren't shipped in the public bundle.
 */
const ACCOUNT_MANAGER_EMAILS: Record<string, string> = {
    "Alicia Morin": "alicia@hiddengem.media",
    "Makenna Moran": "makenna@hiddengem.media",
    "Charlotte Pickering": "charlotte@hiddengem.media",
    "Ananya Arora": "ananya@hiddengem.media",
    "Nicole Araya": "nicole@hiddengem.media",
    "Chiara Henry": "chiara@hiddengem.media",
    "Kristal Puguan": "kristal@hiddengem.media",
};

/**
 * Copied on every Onboarding Form and Account Access Form email, whoever the client's AM is —
 * and still emailed when the AM can't be resolved. Anyone here who is also the AM gets one copy.
 *
 * Also where a client's dashboard note goes when no AM resolves (client-note-alert.mts) —
 * addressed directly then, never copied: notes arrive far more often than forms.
 */
export const FORM_SUBMISSION_CC: string[] = ["dustin@hiddengem.media", "gillian@hiddengem.media", "makenna@hiddengem.media", "alicia@hiddengem.media"];

/** Case- and whitespace-insensitive, because `clients.am` also keeps legacy free-typed names. */
export const accountManagerEmail = (name: string | null | undefined): string | null => {
    const key = (name ?? "").trim().replace(/\s+/g, " ").toLowerCase();
    if (!key) return null;
    for (const [n, email] of Object.entries(ACCOUNT_MANAGER_EMAILS)) {
        if (n.toLowerCase() === key) return email || null;
    }
    return null;
};
