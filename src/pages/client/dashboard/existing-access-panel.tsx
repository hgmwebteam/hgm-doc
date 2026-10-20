/**
 * "Who has access", for an EXISTING client's dashboard.
 *
 * The journey dashboard shows DashboardAccessPanel inside its edit mode. An existing
 * client's dashboard is the Help Centre, which has no edit mode, so the same panel is
 * mounted here on its own: the team's Edit dashboard row in the rail opens it, an account
 * manager adds the client's addresses, Save writes them, Done goes back to the help home.
 * The owner asked for exactly this (Loom, 16 Oct 2026): "whoever has the email entered here
 * will be able to get in".
 *
 * Saving writes ONLY the access keys (dashboard_users, its allowed_emails mirror, and
 * share_password) over a fresh read of the row, so an AM editing here can never erase the
 * rest of the dashboard the way a whole-row write could.
 *
 * The password the panel generates matters for the full dashboard only. The Help Centre
 * signs people in with an emailed sign-in link to the listed address, or a password they set
 * (help-center-screen.tsx, HelpGate), so the note above the panel says so.
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/base/buttons/button";
import { type DashboardContent, supabase } from "@/lib/supabase";
import { DashboardAccessPanel } from "@/pages/client/dashboard/dashboard-chrome";
import { DEFAULT_CLIENT_VISIBLE, type DashboardUser, readDashboardUsers, usersToAllowedEmails } from "@/pages/client/dashboard/dashboard-model";

type AccessKeys = Pick<DashboardContent, "dashboard_users" | "allowed_emails" | "share_password">;

export const ExistingAccessPanel = ({ slug, clientName, onDone }: { slug: string; clientName: string; onDone: () => void }) => {
    const [users, setUsers] = useState<DashboardUser[] | null>(null);
    const [sharePassword, setSharePassword] = useState("");
    const [defaultSections, setDefaultSections] = useState<string[]>([...DEFAULT_CLIENT_VISIBLE]);
    const [state, setState] = useState<"idle" | "dirty" | "saving" | "saved" | "error">("idle");
    const [loadError, setLoadError] = useState("");

    useEffect(() => {
        let live = true;
        void supabase
            .from("dashboard_pages")
            .select("data")
            .eq("slug", slug)
            .maybeSingle()
            .then(({ data, error }) => {
                if (!live) return;
                if (error || !data) {
                    setLoadError("Could not load this dashboard's access list. Reload and try again.");
                    return;
                }
                const content = (data.data ?? {}) as Partial<DashboardContent>;
                setUsers(readDashboardUsers(content));
                setSharePassword((content.share_password ?? "").trim());
                setDefaultSections(content.client_visible ?? [...DEFAULT_CLIENT_VISIBLE]);
            });
        return () => {
            live = false;
        };
    }, [slug]);

    const save = async () => {
        if (!users) return;
        setState("saving");
        // Fresh read, then only the access keys over it: never the whole row.
        const { data: row, error: readErr } = await supabase.from("dashboard_pages").select("data").eq("slug", slug).maybeSingle();
        if (readErr || !row) {
            setState("error");
            return;
        }
        const access: AccessKeys = { dashboard_users: users, allowed_emails: usersToAllowedEmails(users), share_password: sharePassword };
        const next = { ...((row.data ?? {}) as Partial<DashboardContent>), ...access };
        const { error } = await supabase.from("dashboard_pages").update({ data: next }).eq("slug", slug);
        setState(error ? "error" : "saved");
    };

    return (
        <section aria-labelledby="access-title" className="mx-auto w-full max-w-[1040px]">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className="hc-t-caption-meta text-(--hc-text-tertiary)">HIDDENGEM MEDIA</p>
                    <h1 id="access-title" className="mt-1 hc-t-display-title text-(--hc-text-primary)">
                        Access for {clientName || "this client"}
                    </h1>
                    <p className="mt-2 max-w-[680px] hc-t-body-helper text-(--hc-text-secondary)">
                        People on this list can open this client&rsquo;s Help Center to raise and follow requests. They sign in with a link emailed to their
                        address, so any email works, and that browser remembers them after that. They can also set their own password for next time. The
                        passwords on this page are different: your team sets them, and they only open the full dashboard.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button color="secondary" size="md" onClick={onDone}>
                        Done
                    </Button>
                    <Button size="md" onClick={() => void save()} isDisabled={!users || state === "saving" || state === "idle" || state === "saved"}>
                        {state === "saving" ? "Saving…" : state === "saved" ? "Saved" : state === "error" ? "Try saving again" : "Save changes"}
                    </Button>
                </div>
            </div>

            {loadError && (
                <p className="mt-6 text-sm text-error-primary" role="alert">
                    {loadError}
                </p>
            )}
            {users && (
                <DashboardAccessPanel
                    users={users}
                    sharePassword={sharePassword}
                    defaultSections={defaultSections}
                    onChangeUsers={(next) => {
                        setUsers(next);
                        setState("dirty");
                    }}
                    onChangeSharePassword={(next) => {
                        setSharePassword(next);
                        setState("dirty");
                    }}
                />
            )}
            {state === "error" && (
                <p className="mt-3 text-sm text-error-primary" role="alert">
                    The save did not go through. Nothing was changed. Try again in a moment.
                </p>
            )}
        </section>
    );
};
