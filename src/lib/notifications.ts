import { supabase } from "@/lib/supabase";
import { isFlowFeedbackKey, isLandingFeedbackKey } from "@/pages/client/dashboard/suggestions-model";

/**
 * Attention feed for the header notification bell (icon-rail.tsx HeaderBell).
 * Pulls the things that block the team's projects from moving:
 *   1. open Questions across every project-log page (HIGH-priority count called out)
 *   2. open docs requests / bug reports
 *   3. the Client List roster gap (clients filed vs. the 47-client Homepage roster)
 * Lives in lib (not the questions page) so icon-rail can import it without a
 * circular page → shell → page import.
 */

export interface AttentionItem {
    id: string;
    kind: "questions" | "request" | "roster" | "suggestions";
    title: string;
    description: string;
    /** Internal route to open when clicked. */
    to: string;
    /** Marks the red-accent items (bugs, HIGH questions). */
    urgent?: boolean;
}

/** Same log pages the /questions inbox aggregates. */
const QUESTION_SLUGS = [
    "roadmap",
    "welcome-email-flow-overview",
    "client-dashboard-overview",
    "chat-widget-overview",
    "owner-guide-overview",
    "homepage-overview",
];

type QA = { answer?: string; resolved?: boolean; priority?: string };

const isOpen = (q: QA) => !(q.resolved ?? !!(q.answer || "").trim());

export async function fetchAttentionItems(): Promise<AttentionItem[]> {
    const [pagesRes, requestsRes, clientsRes, suggestionsRes] = await Promise.all([
        supabase.from("sop_pages").select("slug, data").in("slug", QUESTION_SLUGS),
        supabase.from("docs_requests").select("id, title, priority, requester").eq("status", "open").order("created_at", { ascending: false }),
        // Private/test clients don't count toward the team-wide roster size.
        supabase.from("clients").select("id", { count: "exact", head: true }).is("private_to", null),
        // Client edit suggestions awaiting AM review. Non-team sessions get a
        // permission-denied error (anon has no grant at all), which the error
        // check below turns into a silent no-op.
        supabase.from("dashboard_suggestions").select("slug, field_key").eq("status", "pending"),
    ]);

    const items: AttentionItem[] = [];

    // 1) Open questions across the log pages
    if (!pagesRes.error && pagesRes.data) {
        let open = 0;
        let high = 0;
        let pages = 0;
        let rosterSize: number | null = null;
        for (const row of pagesRes.data) {
            const qs = ((row.data?.questions ?? []) as QA[]).filter(isOpen);
            if (qs.length) pages++;
            open += qs.length;
            high += qs.filter((q) => q.priority === "high").length;
            if (row.slug === "homepage-overview" && Array.isArray(row.data?.clients)) rosterSize = row.data.clients.length;
        }
        if (open > 0) {
            items.push({
                id: "questions",
                kind: "questions",
                title: `${open} question${open === 1 ? "" : "s"} need${open === 1 ? "s" : ""} your attention`,
                description:
                    high > 0
                        ? `${high} HIGH priority · across ${pages} project page${pages === 1 ? "" : "s"}`
                        : `Across ${pages} project page${pages === 1 ? "" : "s"}`,
                to: "/questions",
                urgent: high > 0,
            });
        }

        // 3) Roster gap — clients filed vs. the Homepage roster
        const filed = clientsRes.count ?? null;
        if (rosterSize != null && filed != null && filed < rosterSize) {
            items.push({
                id: "roster",
                kind: "roster",
                title: `${rosterSize - filed} roster clients not filed yet`,
                description: `Client List has ${filed} of ${rosterSize} — the homepage counts follow the Client List`,
                to: "/dashboard?dept=clients",
            });
        }
    }

    // 4) Client suggestions awaiting review — document edits, welcome-email feedback and
    //    landing-page feedback share a table but are different jobs, and each is read and
    //    closed in a different section, so they get separate lines.
    if (!suggestionsRes.error && suggestionsRes.data && suggestionsRes.data.length > 0) {
        const rows = suggestionsRes.data as { slug: string; field_key: string }[];
        const edits = rows.filter((r) => !isFlowFeedbackKey(r.field_key) && !isLandingFeedbackKey(r.field_key));
        const notes = rows.filter((r) => isFlowFeedbackKey(r.field_key));
        const landingNotes = rows.filter((r) => isLandingFeedbackKey(r.field_key));
        const dashboards = (list: { slug: string }[]) => {
            const slugs = [...new Set(list.map((r) => r.slug))];
            return { slugs, label: `${slugs.length} dashboard${slugs.length === 1 ? "" : "s"}` };
        };
        if (edits.length > 0) {
            const { slugs, label } = dashboards(edits);
            items.push({
                id: "suggestions",
                kind: "suggestions",
                title: `${edits.length} client edit suggestion${edits.length === 1 ? "" : "s"} to review`,
                description: `On ${label} — accept or decline in the Master Brand Document`,
                to: slugs.length === 1 ? `/${slugs[0]}#foundation` : "/dashboard?dept=clients",
            });
        }
        if (notes.length > 0) {
            const { slugs, label } = dashboards(notes);
            items.push({
                id: "flow-feedback",
                kind: "suggestions",
                title: `${notes.length} client comment${notes.length === 1 ? "" : "s"} on welcome emails`,
                description: `On ${label} — read and mark done in the Welcome Email Flow`,
                to: slugs.length === 1 ? `/${slugs[0]}#flow` : "/dashboard?dept=clients",
            });
        }
        if (landingNotes.length > 0) {
            const { slugs, label } = dashboards(landingNotes);
            items.push({
                id: "landing-feedback",
                kind: "suggestions",
                title: `${landingNotes.length} client comment${landingNotes.length === 1 ? "" : "s"} on landing pages`,
                description: `On ${label} — read and mark done in the Landing page section`,
                to: slugs.length === 1 ? `/${slugs[0]}#landing` : "/dashboard?dept=clients",
            });
        }
    }

    // 2) Open docs requests / bugs (bugs + high priority first, cap at 4)
    if (!requestsRes.error && requestsRes.data) {
        const rank = (r: { title: string; priority?: string }) =>
            (r.title.toLowerCase().includes("[bug]") ? 0 : 2) + (r.priority === "urgent" || r.priority === "high" ? 0 : 1);
        const sorted = [...requestsRes.data].sort((a, b) => rank(a) - rank(b));
        for (const r of sorted.slice(0, 4)) {
            const isBug = r.title.toLowerCase().includes("[bug]");
            items.push({
                id: `req-${r.id}`,
                kind: "request",
                title: r.title,
                description: `${isBug ? "Bug report" : "Docs request"} from ${r.requester || "unknown"}${r.priority ? ` · ${r.priority} priority` : ""}`,
                to: "/requests",
                urgent: isBug || r.priority === "urgent" || r.priority === "high",
            });
        }
        if (sorted.length > 4) {
            items.push({
                id: "req-more",
                kind: "request",
                title: `${sorted.length - 4} more open requests`,
                description: "See the full queue",
                to: "/requests",
            });
        }
    }

    return items;
}
