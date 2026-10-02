/**
 * What a team member is warned about before showing a dashboard section to its client.
 *
 * The eye on a side-menu row used to reveal a section on one click, so an AM could hand a
 * client a Master Brand Document that was mostly "Not filled in" without noticing. Showing
 * a row now asks first, and this decides what the question lists. Pure, no React.
 */
import type { DashboardContent } from "@/lib/supabase";
import { type SectionId, TEMPLATE_CONTENT, isTemplatePalette } from "@/pages/client/dashboard/dashboard-model";
import { FOUNDATION_SECTIONS, foundationProgress } from "@/pages/client/dashboard/master-brand-document";

export type RevealCheck = {
    /** Parts still empty, in reading order. Empty when the section looks complete. */
    empty: string[];
    /** How many parts were checked, for "6 of 11 sections are still empty". */
    total: number;
};

/**
 * The empty parts of a section, or `null` for a section with no completeness check (it
 * gets the plain "the client can now open this" confirmation).
 *
 * Master Brand reuses `foundationProgress`, the same model as its "x of 11" counter and
 * rail ticks, so the warning can never disagree with what the page shows.
 */
export const revealCheck = (id: SectionId, content: DashboardContent): RevealCheck | null => {
    if (id === "foundation") {
        if (!content.foundation) return { empty: FOUNDATION_SECTIONS.map((s) => s.label), total: FOUNDATION_SECTIONS.length };
        const progress = foundationProgress(content.foundation);
        return { empty: FOUNDATION_SECTIONS.filter((s) => !progress[s.id]).map((s) => s.label), total: FOUNDATION_SECTIONS.length };
    }
    if (id === "brand") {
        const b = content.brand;
        const parts: [string, boolean][] = [
            ["Palette is still the template", isTemplatePalette(b.colors) || !b.colors.length],
            // "Inter" is the template's placeholder, so it counts as unchosen, as in isUntouchedBrandKit.
            ["No fonts chosen", (!b.fonts.trim() || b.fonts.trim() === TEMPLATE_CONTENT.brand.fonts) && !b.font_files?.heading && !b.font_files?.body],
            ["No logo uploaded", !(b.logos ?? []).length],
        ];
        return { empty: parts.filter(([, missing]) => missing).map(([label]) => label), total: parts.length };
    }
    return null;
};
