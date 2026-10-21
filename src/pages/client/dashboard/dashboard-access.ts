/**
 * The network half of dashboard access: reading and writing the team-only passwords, and the
 * client's sign-in check. The pure half (and why the passwords moved) is in dashboard-model.ts.
 */
import { supabase } from "@/lib/supabase";
import { type AccessSecrets, type DashboardUser, secretsFromContent, toSecretsRow } from "@/pages/client/dashboard/dashboard-model";

/**
 * The team's copy of a dashboard's passwords. Null when it could not be read (no
 * @hiddengem.media session, or the network), which callers must treat as "unknown", never as
 * "no passwords": saving an empty set over a real one would lock the client out.
 *
 * A dashboard with no secrets row yet is seeded from whatever plaintext its own row still
 * carries, so one created or edited by the old code in the hand-over window loses nothing.
 */
export const loadAccessSecrets = async (
    slug: string,
    legacy: { dashboard_users?: DashboardUser[]; allowed_emails?: string[]; share_password?: string },
): Promise<AccessSecrets | null> => {
    const { data, error } = await supabase.from("dashboard_access_secrets").select("share_password, passwords").eq("slug", slug).maybeSingle();
    if (error) return null;
    if (!data) return secretsFromContent(legacy);
    return {
        sharePassword: String(data.share_password ?? "").trim(),
        passwords: (data.passwords ?? {}) as Record<string, string>,
    };
};

export const saveAccessSecrets = async (slug: string, secrets: AccessSecrets): Promise<boolean> => {
    const { error } = await supabase
        .from("dashboard_access_secrets")
        .upsert({ slug, ...toSecretsRow(secrets), updated_at: new Date().toISOString() }, { onConflict: "slug" });
    return !error;
};

/** The sign-in card's check, made by the dashboard-unlock function so no password ever
 *  reaches the browser. "error" is a failed request, not a wrong password. */
export const requestDashboardUnlock = async (slug: string, email: string, password: string): Promise<"ok" | "no" | "error"> => {
    try {
        const res = await fetch("/.netlify/functions/dashboard-unlock", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ slug, email, password }),
        });
        if (!res.ok) return "error";
        const body = (await res.json()) as { ok?: boolean };
        return body.ok ? "ok" : "no";
    } catch {
        return "error";
    }
};
