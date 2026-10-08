import { teamCall } from "@/lib/canva-import";
import { type CrmCells, crmChanges } from "@/lib/crm-sheet-model";
import type { DashboardContent } from "@/lib/supabase";

/**
 * Mirrors a dashboard save into the team's CRM sheet — see crm-sheet-model.ts for which cells.
 *
 * Same rule as the /log feed: NEVER breaks saving. The dashboard is already saved when this
 * runs, so every failure is logged and swallowed. A cell the sheet refused (no row for the
 * client, a renamed header, a value not in the dropdown) comes back in `skipped` and is
 * logged here, so the sheet can drift without anyone being told — check the console first.
 */
export async function syncCrmSheet(slug: string, before: Partial<DashboardContent> | null, after: DashboardContent): Promise<void> {
    const cells: CrmCells = crmChanges(before, after);
    if (!Object.keys(cells).length) return;
    try {
        const { res, json } = await teamCall("/.netlify/functions/crm-sync", { slug, cells });
        if (!res.ok) console.error("[crm-sync] failed", res.status, json);
        else if (Array.isArray(json.skipped) && json.skipped.length) console.warn("[crm-sync] sheet skipped", json.skipped);
    } catch (err) {
        console.error("[crm-sync] request failed", err);
    }
}
