/**
 * Which row in `email_wf_emails` a welcome-flow note belongs to.
 *
 * Split out of dashboard-suggestions.mts so the rule has a self-check beside it
 * (flow-feedback.check.mts): getting it wrong writes one email's feedback onto another
 * email's row, which nobody would notice until a client asked why their note was ignored.
 */

/** The 0-based email a "welcomeFlow.{0-8}" key names, or null for any other key. */
export const flowSlot = (key: string): number | null => {
    if (!key.startsWith("welcomeFlow.")) return null;
    const n = Number(key.slice("welcomeFlow.".length));
    return Number.isInteger(n) && n >= 0 && n <= 8 ? n : null;
};

/** The columns the match needs — everything else on the row is irrelevant here. */
export interface FlowEmailRow {
    id: string;
    week?: number | null;
    position?: number | null;
}

/**
 * The client's nine emails are numbered by `week`, NOT by `position`.
 *
 * `position` repeats within a client — one live client has nine emails spread over six
 * distinct positions, with weeks 4 and 5 both sitting at position 4 — so matching on it
 * would drop two notes onto one row and leave two emails carrying feedback that isn't
 * theirs. `week` is unique per client. `position` stays as the fallback for rows written
 * before `week` existed, the same rule the dashboard uses to decide which slot an email
 * fills (welcome-flow.tsx).
 *
 * Returns null when the client has no row for that email yet — the note still lives in
 * dashboard_suggestions, so nothing is lost.
 */
export const pickFlowEmailRow = <T extends FlowEmailRow>(rows: readonly T[], slot: number): T | null =>
    rows.find((r) => Number(r.week ?? r.position) === slot + 1) ?? null;
