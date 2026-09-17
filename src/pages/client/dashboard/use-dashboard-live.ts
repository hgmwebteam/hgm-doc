import { useEffect, useRef } from "react";
import { type DashboardContent, type DashboardPageData, supabase } from "@/lib/supabase";

/**
 * What an open dashboard should hold once a live row arrives.
 *
 * Pure, and checked by use-dashboard-live.check.ts, because getting it wrong deletes
 * something a person typed rather than merely showing them a stale number.
 *
 * `keepWebsiteSetup` is the client's unsaved Website Setup Guide answer. That key is the
 * only part of this row a client authors: it is written server-side by the website-setup
 * function on a debounce, so a row arriving while they type carries a version OLDER than
 * what is on their screen. Everything else on the row is the team's, and the caller only
 * applies a live row at all when nobody is in edit mode.
 */
export const mergeLiveContent = (incoming: DashboardContent, local: DashboardContent, keepWebsiteSetup: boolean): DashboardContent =>
    keepWebsiteSetup ? { ...incoming, website_setup: local.website_setup } : incoming;

/**
 * Keep an open dashboard in step with its row in Supabase.
 *
 * The dashboard is shared: an AM ticks a journey step or reveals a section on their screen,
 * and until this existed the client saw none of it until they next loaded the page. That is
 * a poor fit for the launch meter in particular, which is sold to the client as something
 * they watch move.
 *
 * Scope is deliberately one row. A channel per client dashboard costs one subscription on a
 * page that is already open, where a table-wide stream would push all 49 clients' rows at
 * every viewer — and, because Realtime applies the table's RLS SELECT policy rather than any
 * per-client rule, hand each of them the others' data.
 *
 * INSERT and DELETE are not subscribed. A row appearing or vanishing is not something an
 * already-open dashboard can act on: this page was mounted with that slug's data, and a
 * delete leaves nothing to render.
 *
 * The caller decides what to do with the row — see the call site for why a dashboard can
 * never simply overwrite its local state with what arrives.
 */
export const useDashboardLive = ({
    slug,
    enabled = true,
    onUpdate,
}: {
    /** The row to follow. No slug (the template page) subscribes to nothing. */
    slug?: string;
    /** False suspends the subscription — e.g. the template, which has no row. */
    enabled?: boolean;
    onUpdate: (row: DashboardPageData) => void;
}) => {
    /* Held in a ref and refreshed every render so the handler always sees current state
       without the subscription being torn down and rebuilt on each one. Resubscribing per
       render would mean a channel churn per keystroke and a window, however brief, where an
       update lands on no listener at all. */
    const onUpdateRef = useRef(onUpdate);
    useEffect(() => {
        onUpdateRef.current = onUpdate;
    });

    useEffect(() => {
        if (!slug || !enabled) return;

        const channel = supabase
            .channel(`dashboard_pages:${slug}`)
            .on("postgres_changes", { event: "UPDATE", schema: "public", table: "dashboard_pages", filter: `slug=eq.${slug}` }, (payload) =>
                onUpdateRef.current(payload.new as DashboardPageData),
            )
            .subscribe();

        return () => {
            void supabase.removeChannel(channel);
        };
    }, [slug, enabled]);
};
