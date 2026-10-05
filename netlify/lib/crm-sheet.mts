import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Writes cells into the team's CRM Google Sheet ("CRM - HiddenGem Media" → "Clients - Onboarding")
 * through the Apps Script web app in scripts/crm-sheet-sync.gs.
 *
 * Needs CRM_SHEET_WEBHOOK_URL (the web app's /exec URL) and CRM_SHEET_SECRET (the same value as
 * the script's SECRET property) in the Netlify UI. Unset ⇒ a silent no-op, so the portal works
 * the same without the sheet.
 *
 * Never throws: every caller has already done its real job (saved a dashboard, recorded a form)
 * and a sheet that couldn't be updated must not turn that into an error.
 */

/** The only headers the portal may write. Mirrors src/lib/crm-sheet-model.ts plus Questionnaire. */
export const CRM_COLUMNS = new Set(["Questionnaire", "Brand Assets", "Onboarding Call", "Master Brand Document", "Canva Brand Kit"]);

export type CrmResult = { ok: boolean; written?: string[]; skipped?: { header: string; reason: string }[]; error?: string };

export const pushCrmCells = async (client: string, cells: Record<string, string>): Promise<CrmResult> => {
    const url = process.env.CRM_SHEET_WEBHOOK_URL;
    const secret = process.env.CRM_SHEET_SECRET;
    if (!url || !secret) return { ok: false, error: "not-configured" };
    try {
        // Apps Script answers a POST with a 302 to the result; fetch follows it.
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "text/plain" },
            body: JSON.stringify({ secret, client, cells }),
        });
        const json = (await res.json().catch(() => null)) as CrmResult | null;
        if (!res.ok || !json) return { ok: false, error: `HTTP ${res.status}` };
        if (!json.ok || json.skipped?.length) console.warn(`[crm-sheet] ${client}:`, JSON.stringify(json));
        return json;
    } catch (err) {
        console.error("[crm-sheet] request failed", err);
        return { ok: false, error: "request-failed" };
    }
};

/** The name the sheet knows a client by: their `clients` row, else the given fallback. */
export const crmClientName = async (db: SupabaseClient, base: string, fallback: string): Promise<string> => {
    // Links are stored as "/{base}-dashboard"; match the tail so a full URL typed into the field still counts.
    const { data } = await db.from("clients").select("name").ilike("link", `%/${base}-dashboard`).limit(1);
    return ((data?.[0]?.name as string | undefined) || fallback || base).trim();
};
