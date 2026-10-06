import { useAuthUser } from "@/hooks/use-auth-user";
import { ACCOUNT_MANAGERS, OPERATIONS_MANAGER, type TeamRole, teamRoleOf } from "@/lib/team-roster";

const VIEW_AS_KEY = "hgm_view_as";

/** Who the owner may preview the portal as — the people whose view differs from theirs. */
export const VIEW_AS_OPTIONS = [OPERATIONS_MANAGER, ...ACCOUNT_MANAGERS];

const readViewAs = (): string | null => {
    try {
        // `?as=alicia` (first name or full name) sets it, so a preview is a shareable local link.
        const param = new URLSearchParams(window.location.search).get("as");
        if (param !== null) {
            const hit = VIEW_AS_OPTIONS.find((n) => [n.toLowerCase(), n.split(" ")[0].toLowerCase()].includes(param.trim().toLowerCase()));
            if (hit) sessionStorage.setItem(VIEW_AS_KEY, hit);
            else sessionStorage.removeItem(VIEW_AS_KEY);
        }
        const stored = sessionStorage.getItem(VIEW_AS_KEY);
        return stored && VIEW_AS_OPTIONS.includes(stored) ? stored : null;
    } catch {
        return null;
    }
};

/** Switch the owner's preview and reload, so every surface (home, bell, search) re-reads it. */
export const setViewAs = (name: string | null) => {
    try {
        if (name) sessionStorage.setItem(VIEW_AS_KEY, name);
        else sessionStorage.removeItem(VIEW_AS_KEY);
    } catch {
        /* storage blocked — nothing to switch */
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("as");
    window.location.assign(url.toString());
};

/**
 * The signed-in teammate's role — or, for the owner only, the role of whoever they chose
 * to "view as". The preview changes what the UI shows, never what the session can read:
 * the owner already reads everything an AM or the Operations Manager can.
 */
export const useTeamRole = () => {
    const { user, loading } = useAuthUser();
    const realRole: TeamRole = teamRoleOf(user);
    const viewAs = realRole.kind === "owner" ? readViewAs() : null;
    const role: TeamRole = viewAs ? teamRoleOf({ email: "", name: viewAs }) : realRole;
    return { user, loading, role, realRole, viewAs, displayName: viewAs ?? user?.name ?? "" };
};
