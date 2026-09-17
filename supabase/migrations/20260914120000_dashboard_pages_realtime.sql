-- Stream dashboard_pages changes to open dashboards.
--
-- Without this the client's page only reflects an AM's ticks on their next page load, so
-- "watch your progress bar move" was only true if they happened to refresh. Adding the
-- table to the supabase_realtime publication lets useDashboardLive() subscribe to UPDATEs
-- on the client's own row and apply them in place.
--
-- No new access is granted. Realtime enforces the table's existing RLS SELECT policy, and
-- that policy is already open to anon (see 20260813180000_dashboard_pages_no_anon_writes,
-- which left SELECT open deliberately pending read-gating). So a subscriber receives
-- exactly the rows it could already have fetched with the anon key — this changes when
-- they learn about a change, not what they may read. When read-gating does land, it will
-- narrow these streams along with the reads, with nothing to change here.
--
-- Writes are unaffected: still authenticated-only, still through persistAndLock().
--
-- Replica identity is left at the default (primary key). The subscriber only ever reads
-- `payload.new`; REPLICA IDENTITY FULL would be needed for `payload.old`, and it writes
-- every column of every update into the WAL, which is not worth paying for a diff nobody
-- reads.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'dashboard_pages'
    ) THEN
        ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."dashboard_pages";
    END IF;
END
$$;
