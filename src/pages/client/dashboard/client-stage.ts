/**
 * Which dashboard a client gets: the onboarding journey, or the existing-client one.
 *
 * The switch is the Client List's own `status` on the `clients` row (existing | onboarding |
 * offboarding, missing = existing; see ClientRecord in lib/supabase.ts), so an account
 * manager flips a client from Onboarding to Existing in the Edit Client dialog and the
 * dashboard follows. There is no second field to keep in step.
 *
 * A dashboard with no `clients` row at all (a test dashboard, the template) is "unknown" and
 * keeps the journey dashboard it always had, so nothing changes for a page nobody listed.
 *
 * The `clients` row carries a `link` ("/enjoy-unique-stays-dashboard", sometimes a full URL,
 * sometimes empty); when it is empty the name is slugified the way the Create dialog does,
 * so a client created without a link still matches their dashboard.
 *
 * No React: `client-stage.check.ts` runs the pure parts.
 */
import { supabase } from "@/lib/supabase";
import { slugify } from "@/pages/client/dashboard/dashboard-model";

export type ClientStage = "onboarding" | "existing";

export interface ClientStageRow {
    name: string;
    link?: string | null;
    status?: string | null;
}

/** The path part of whatever the AM typed into "Dashboard / page link". */
const linkPath = (link: string): string => {
    const raw = link.trim().toLowerCase();
    if (!raw) return "";
    if (raw.startsWith("/")) return raw.replace(/\/+$/, "").split(/[?#]/)[0];
    try {
        return new URL(raw).pathname.replace(/\/+$/, "");
    } catch {
        return `/${raw.replace(/^\/+/, "")}`.replace(/\/+$/, "").split(/[?#]/)[0];
    }
};

/** Does this `clients` row belong to the dashboard at `slug` (full or short form)? */
export const clientRowMatches = (row: ClientStageRow, slug: string): boolean => {
    // Either form may arrive: the visitor's short /enjoy-unique-stays or the row's full slug.
    const short = slug
        .trim()
        .toLowerCase()
        .replace(/-dashboard$/, "");
    const full = `${short}-dashboard`;
    const path = linkPath(row.link ?? "");
    if (path && (path === `/${full}` || path === `/${short}`)) return true;
    return slugify(row.name) === short;
};

/** `onboarding` is the only status that keeps the journey; anything else on a row is an existing client. */
export const stageOf = (row: ClientStageRow | null | undefined): ClientStage | null => {
    if (!row) return null;
    return (row.status ?? "").trim().toLowerCase() === "onboarding" ? "onboarding" : "existing";
};

export const pickClientRow = (rows: ClientStageRow[], slug: string): ClientStageRow | null => rows.find((r) => clientRowMatches(r, slug)) ?? null;

// ponytail: one cached promise per slug for the page's lifetime; the roster is ~50 rows and the
// dashboard and the help centre both ask, so one read serves both. Reload to see a status change.
const cache = new Map<string, Promise<ClientStage | null>>();

/** Null when no `clients` row matches (keep the journey dashboard); never throws. */
export const fetchClientStage = (slug: string): Promise<ClientStage | null> => {
    const key = slug.trim().toLowerCase();
    const hit = cache.get(key);
    if (hit) return hit;
    const p = (async () => {
        try {
            const { data, error } = await supabase.from("clients").select("name, link, status");
            return error || !data ? null : stageOf(pickClientRow(data as ClientStageRow[], key));
        } catch {
            return null;
        }
    })();
    cache.set(key, p);
    return p;
};
