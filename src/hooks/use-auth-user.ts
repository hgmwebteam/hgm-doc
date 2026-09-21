import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface AuthUser {
    email: string;
    name: string;
    avatarUrl: string | null;
}

/**
 * Returns the currently signed-in Supabase user, normalized for display.
 * Pulls name/avatar from the Google OAuth identity (user_metadata) when present.
 * `user` is null when signed out; `loading` is true until the first lookup resolves.
 */
export const useAuthUser = () => {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const toAuthUser = (session: Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]): AuthUser | null => {
            const u = session?.user;
            if (!u?.email) return null;
            const meta = u.user_metadata ?? {};
            // A Google identity carries the name in user_metadata; an account minted by
            // an admin (a seeded proof user, an invited teammate) may carry it in
            // app_metadata instead. Either is the person's name; the mailbox is the
            // last resort.
            const app = (u.app_metadata ?? {}) as Record<string, unknown>;
            return {
                email: u.email,
                name: (meta.full_name as string) || (meta.name as string) || (app.full_name as string) || (app.name as string) || u.email.split("@")[0],
                avatarUrl: (meta.avatar_url as string) || (meta.picture as string) || null,
            };
        };

        supabase.auth
            .getSession()
            .then(({ data }) => {
                setUser(toAuthUser(data.session));
                setLoading(false);
            })
            // Never leave `loading` stuck true: callers gate rendering on it (the `/`
            // root gate in main.tsx renders nothing until it resolves), so a rejected
            // lookup would strand them on a blank screen instead of falling back to
            // the signed-out view.
            .catch(() => {
                setUser(null);
                setLoading(false);
            });

        const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(toAuthUser(session));
            setLoading(false);
        });

        return () => sub.subscription.unsubscribe();
    }, []);

    return { user, loading };
};
