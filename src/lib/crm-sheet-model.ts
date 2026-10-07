import type { DashboardContent } from "@/lib/supabase";
import { mergeContent } from "@/pages/client/dashboard/dashboard-model";
import { foundationProgress } from "@/pages/client/dashboard/master-brand-document";

/**
 * Which cells of the team's CRM sheet ("CRM - HiddenGem Media" → "Clients - Onboarding") a
 * dashboard save moves, and to what. Pure — no React, no fetch — and checked by
 * crm-sheet-model.check.ts.
 *
 * Keys are the sheet's column HEADERS exactly as row 2 prints them, and values are its dropdown
 * options exactly. The Apps Script (scripts/crm-sheet-sync.gs) finds a column by header, never by
 * letter, and refuses a value that is not one of that cell's dropdown options, so a mismatch
 * here skips the cell rather than writing junk. Keep CRM_COLUMNS in netlify/lib/crm-sheet.mts
 * in step.
 *
 * Only columns the portal can actually observe are here. The rest (Welcome Email, Call Summary
 * Email, Content Organized, Email Brand Brief, Reel Copy Brief, Custom Claude) happen outside the
 * portal. Kick-Off Call is left out on purpose: the portal ticks it when the call is BOOKED, and
 * the sheet means the call was HELD. Questionnaire is the Onboarding Form, written server-side by
 * form-submitted.mts on submit, not from here.
 */
export type CrmCells = Record<string, string>;

export const crmCells = (partial: Partial<DashboardContent> | null | undefined): CrmCells => {
    const c = mergeContent(partial);
    const done = c.journey_done ?? [];
    const sections = Object.values(foundationProgress(c.foundation!));
    const filled = sections.filter(Boolean).length;
    return {
        "Brand Assets": done.includes("resources") ? "Gathered" : "Not Yet Gathered",
        "Onboarding Call": done.includes("call") ? "Complete" : "Incomplete",
        // An AM's tick wins; otherwise the document's own eleven sections decide.
        "Master Brand Document": done.includes("masterdoc") || filled === sections.length ? "Complete" : filled > 0 ? "In Progress" : "Incomplete",
        "Canva Brand Kit": done.includes("brandkit") ? "Complete" : "Incomplete",
    };
};

/**
 * Only the cells this save CHANGED. Pushing every cell on every save would stomp whatever an AM
 * set by hand in the sheet for a column this save never touched. A brand-new row (no `before`)
 * pushes nothing — there is no change to report yet.
 */
export const crmChanges = (before: Partial<DashboardContent> | null | undefined, after: Partial<DashboardContent>): CrmCells => {
    if (!before) return {};
    const was = crmCells(before);
    return Object.fromEntries(Object.entries(crmCells(after)).filter(([k, v]) => was[k] !== v));
};
