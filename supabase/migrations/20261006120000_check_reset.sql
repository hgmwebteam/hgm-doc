-- "Reset your results" on the Industry Acumen check's results page (/dictionary/check/results):
-- each person may delete their own sittings, finished ones included (Kyle, 2026-10-06).
--
-- WHY. The check is a study aid (see 20261001120000_dictionary_check.sql). Someone who wants to
-- start their score and their terms to review from nothing should be able to, and what they'd
-- clear is only ever their own. Until now a finished sitting couldn't be deleted at all; only an
-- open one could ("Start again", the "check_attempts own discard" policy, which stays).
--
-- WHAT IT ALLOWS. DELETE on check_attempts for rows that are the signed-in person's own, from an
-- @hiddengem.media session, open or finished. Their answers go with them through the existing
-- ON DELETE CASCADE on check_answers.attempt_id, so check_term_status (a view of finished
-- sittings' answers) empties too. Nothing else changes: no update, no access to anyone else's
-- rows, nothing for anon. The table-level DELETE grant to authenticated is already in place.
--
-- Re-runnable: every statement can run again safely.

DROP POLICY IF EXISTS "check_attempts own reset" ON "public"."check_attempts";
CREATE POLICY "check_attempts own reset" ON "public"."check_attempts"
    FOR DELETE TO "authenticated"
    USING (
        "user_id" = (select auth.uid())
        AND lower(coalesce((select auth.jwt()) ->> 'email', '')) LIKE '%@hiddengem.media'
    );
