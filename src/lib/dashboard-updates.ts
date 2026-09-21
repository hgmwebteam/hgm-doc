import { LANDING_SECTION, STORIES_SECTION, type SectionChange, diffDashboardContent } from "@/lib/dashboard-updates-model";
import { type DashboardContent, supabase } from "@/lib/supabase";

/**
 * The team's activity feed for client dashboards — what fills the /log page.
 *
 * A dashboard is worked on by whoever is free, and nothing used to record that: you could
 * only tell a colleague had been in the row by noticing the content had changed. This module
 * writes one line per save — who, which client, which sections — so the morning question
 * ("what did Alicia change yesterday?") has an answer that doesn't involve asking Alicia.
 *
 * Two rules hold the rest up:
 *
 *   1. NO VALUES LEAVE dashboard_pages. Only section and field names are stored — see
 *      dashboard-updates-model.ts and the migration 20260917120000_dashboard_updates.sql.
 *
 *   2. LOGGING NEVER BREAKS SAVING. Every write here is best-effort and swallows its own
 *      errors. An AM's afternoon of notes must not fail to save because an audit line
 *      couldn't be written, and an error thrown from here would surface to them as exactly
 *      that: a dashboard that wouldn't save.
 *
 * The author comes from the live Supabase session rather than from an argument, so an entry
 * is always attributed to whoever is actually signed in. The RLS insert policy checks the
 * same address against the JWT, so this is convenience — the guard is in the database.
 */

/** Re-exported so a caller recording a publish needs one import, not two. */
export { LANDING_SECTION, STORIES_SECTION };
export type { SectionChange };

export interface DashboardUpdate {
    id: string;
    slug: string;
    client_name: string;
    author_email: string;
    author_name: string;
    author_avatar: string;
    kind: "save" | "publish";
    sections: string[];
    detail: SectionChange[];
    summary: string;
    created_at: string;
}

const TEAM_DOMAIN = "@hiddengem.media";

/** The signed-in team member, or null when nobody is signed in or the address isn't ours. */
async function teamAuthor(): Promise<{ email: string; name: string; avatar: string } | null> {
    try {
        const { data } = await supabase.auth.getSession();
        const user = data.session?.user;
        const email = user?.email ?? "";
        if (!email.toLowerCase().endsWith(TEAM_DOMAIN)) return null;
        const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
        return {
            email,
            name: (meta.full_name as string) || (meta.name as string) || email.split("@")[0],
            avatar: (meta.avatar_url as string) || (meta.picture as string) || "",
        };
    } catch {
        return null;
    }
}

type NewUpdate = Pick<DashboardUpdate, "slug" | "client_name" | "kind" | "sections" | "detail" | "summary">;

async function insertUpdate(row: NewUpdate): Promise<void> {
    const author = await teamAuthor();
    // No team session means a client or a signed-out preview, and neither can write
    // dashboard_pages in the first place — there is nothing to record, and the insert would
    // only be refused by the policy.
    if (!author) return;

    const { error } = await supabase.from("dashboard_updates").insert({
        ...row,
        author_email: author.email,
        author_name: author.name,
        author_avatar: author.avatar,
    });
    // Logged, never thrown — rule 2 above. Whatever this line was describing has already been
    // saved by the time we get here.
    if (error) console.error("[dashboard-updates] could not record the update:", error);
}

/**
 * Record an ordinary dashboard Save.
 *
 * Writes nothing when the diff is empty: pressing Save on an untouched dashboard is the
 * normal way to re-lock the page, and a feed of those would drown the real edits.
 */
export async function recordDashboardSave(input: {
    slug: string;
    clientName: string;
    before: Partial<DashboardContent> | null;
    after: Partial<DashboardContent>;
}): Promise<void> {
    const detail = diffDashboardContent(input.before, input.after);
    if (!detail.length) return;

    await insertUpdate({
        slug: input.slug,
        client_name: input.clientName,
        kind: "save",
        sections: detail.map((d) => d.section),
        detail,
        summary: input.before === null ? "Set up the dashboard" : "",
    });
}

/**
 * Record a Landing Page or Pinned Stories version going live.
 *
 * Those two sections own their own tables and persist on every keystroke of a draft, so their
 * saves are far too frequent to log. The publish is the moment the client sees something new,
 * which is the moment worth a line in the feed.
 */
export async function recordDashboardPublish(input: { slug: string; clientName: string; section: string; summary: string }): Promise<void> {
    await insertUpdate({
        slug: input.slug,
        client_name: input.clientName,
        kind: "publish",
        sections: [input.section],
        detail: [],
        summary: input.summary,
    });
}

/**
 * The feed, newest first.
 *
 * Team-only by policy: a signed-out or client session gets a permission error rather than an
 * empty list, which is why /log gates on sign-in before it ever calls this.
 */
export async function listDashboardUpdates(limit = 300): Promise<DashboardUpdate[]> {
    const { data, error } = await supabase.from("dashboard_updates").select("*").order("created_at", { ascending: false }).limit(limit);
    if (error) throw error;
    // `detail` is jsonb and older or hand-written rows could hold anything; the feed maps over
    // it, so a non-array would break the render rather than show a malformed entry.
    return (data ?? []).map((row) => ({ ...row, detail: Array.isArray(row.detail) ? row.detail : [] })) as DashboardUpdate[];
}
