-- The Industry Acumen check (/dictionary/check): each person's sittings and answers.
--
-- WHAT IT IS FOR. A self-check on the dictionary's 90 tier A and B terms, to learn them.
-- There is no pass mark, and nobody is held to the result (Kyle, 2026-10-01): the check is a
-- study aid people should be able to use without worrying who's watching. That decision
-- shapes every rule below. Each person can see only their own rows, and nothing in the app
-- — no page, no function, no team roll-up — shows anyone else's. A roll-up was specified
-- and deliberately dropped; don't add one, or any cross-person view, without asking first.
--
-- WHAT THE APP CAN'T PROMISE. Anyone with access to the Supabase dashboard can read these
-- tables directly (the dashboard's SQL editor bypasses row-level security). Rows hold a user
-- id, never a name or email, but a dashboard admin could look the id up.
--
-- WHAT IS STORED, and nothing more:
--   * per sitting: when it started and finished, which questions it served (the plan), and
--     the score it left you with;
--   * per answer: which term, which question and version, and right or wrong.
-- NOT the answer itself. What someone types stays in their own browser while the sitting is
-- open (decision 1a, 2026-10-01). No timings per question, no analytics, nothing sent on.
--
-- HOW A PERSON'S STATUS WORKS. Their status for a term is their most recent answer to it in a
-- FINISHED sitting — check_term_status at the bottom. Answers are only ever added: changing an
-- answer mid-sitting adds a newer row and the newest wins, so no row is ever edited. The
-- browser computes the score with the same rule (src/pages/team/dictionary/check/check-score.ts);
-- keep the two in step.
--
-- ACCESS. Authenticated @hiddengem.media sessions only: any Google account can sign in to
-- Supabase, so "signed in" is never enough. anon gets nothing. Each policy also pins rows to
-- auth.uid(), the signed-in person.
--   check_attempts  read your own; start one; finish your own while it's open (four columns
--                   only); discard your own while it's open ("Start again"). A finished
--                   sitting can't be changed or deleted.
--   check_answers   read your own; add rows only to your own OPEN sitting. No update, no
--                   delete: a finished sitting's answers can't be rewritten. Discarding an open
--                   sitting removes its answers with it (ON DELETE CASCADE).
-- user_id, answered_at and started_at are filled in by the database (auth.uid(), now()), and
-- the insert grants leave them out, so the browser can't send its own. completed_at is
-- stamped by a trigger, whatever time the browser sends.
--
-- Scoring happens in the browser, so a person could fake their own result. It's a self-check
-- with nothing riding on it; the only thing they could fake is their own score.

/* ── Sittings ─────────────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS "public"."check_attempts" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    -- The person. Deleting their sign-in deletes their check history with it.
    "user_id" uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users ("id") ON DELETE CASCADE,
    -- 'full': every term. 'missed': only the terms the person had wrong when it started.
    "mode" text NOT NULL CHECK ("mode" IN ('full', 'missed')),
    -- The bank's "version" field, so a sitting can be traced to the questions it used.
    "bank_version" text NOT NULL CHECK (char_length("bank_version") <= 64),
    -- The sitting as served, in order: [{ "item", "variant", "blank"?, "terms": [...] }].
    -- Question ids only, no answers. Stored so a sitting resumed on another day, or another
    -- device, shows the same questions in the same order (see PlanEntry in check-model.ts).
    "plan" jsonb NOT NULL CHECK (jsonb_typeof("plan") = 'array' AND octet_length("plan"::text) <= 65536),
    "started_at" timestamptz NOT NULL DEFAULT now(),
    -- Null while the sitting is open. Answers count towards a person's status only once set.
    "completed_at" timestamptz,
    -- The score and grade this sitting left the person with (all terms, not just the ones
    -- it served), and how many terms were still to review. Stored so the results page can say
    -- "Up 9% since last time · 7 fewer terms to review" without replaying older sittings.
    "score_pct" integer CHECK ("score_pct" BETWEEN 0 AND 100),
    "grade" text CHECK (char_length("grade") <= 3),
    "missed_count" integer CHECK ("missed_count" >= 0)
);

-- One open sitting per person, so "resume" is never ambiguous, and so one sitting's answers
-- always come after the last one's (check_term_status relies on that ordering).
CREATE UNIQUE INDEX IF NOT EXISTS "check_attempts_one_open_idx" ON "public"."check_attempts" ("user_id") WHERE "completed_at" IS NULL;
CREATE INDEX IF NOT EXISTS "check_attempts_user_idx" ON "public"."check_attempts" ("user_id", "completed_at" DESC);

ALTER TABLE "public"."check_attempts" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "check_attempts own read" ON "public"."check_attempts";
CREATE POLICY "check_attempts own read" ON "public"."check_attempts"
    FOR SELECT TO "authenticated"
    USING (
        "user_id" = (select auth.uid())
        AND lower(coalesce((select auth.jwt()) ->> 'email', '')) LIKE '%@hiddengem.media'
    );

DROP POLICY IF EXISTS "check_attempts own insert" ON "public"."check_attempts";
CREATE POLICY "check_attempts own insert" ON "public"."check_attempts"
    FOR INSERT TO "authenticated"
    WITH CHECK (
        "user_id" = (select auth.uid())
        AND lower(coalesce((select auth.jwt()) ->> 'email', '')) LIKE '%@hiddengem.media'
    );

-- USING picks which rows may be updated: your own, still open. Once completed_at is set the
-- row no longer matches, so a finished sitting can never be edited again.
DROP POLICY IF EXISTS "check_attempts own finish" ON "public"."check_attempts";
CREATE POLICY "check_attempts own finish" ON "public"."check_attempts"
    FOR UPDATE TO "authenticated"
    USING (
        "user_id" = (select auth.uid())
        AND "completed_at" IS NULL
        AND lower(coalesce((select auth.jwt()) ->> 'email', '')) LIKE '%@hiddengem.media'
    )
    WITH CHECK (
        "user_id" = (select auth.uid())
        AND lower(coalesce((select auth.jwt()) ->> 'email', '')) LIKE '%@hiddengem.media'
    );

DROP POLICY IF EXISTS "check_attempts own discard" ON "public"."check_attempts";
CREATE POLICY "check_attempts own discard" ON "public"."check_attempts"
    FOR DELETE TO "authenticated"
    USING (
        "user_id" = (select auth.uid())
        AND "completed_at" IS NULL
        AND lower(coalesce((select auth.jwt()) ->> 'email', '')) LIKE '%@hiddengem.media'
    );

-- Supabase grants anon and authenticated everything on a new public table by default, so
-- revoke first: a policy is not a permission, and the privilege left in place would be one
-- permissive policy away from exposing the table. The column lists are the point here —
-- the browser can write only the columns named.
REVOKE ALL ON TABLE "public"."check_attempts" FROM "anon";
REVOKE ALL ON TABLE "public"."check_attempts" FROM "authenticated";
GRANT SELECT, DELETE ON TABLE "public"."check_attempts" TO "authenticated";
GRANT INSERT ("mode", "bank_version", "plan") ON TABLE "public"."check_attempts" TO "authenticated";
GRANT UPDATE ("completed_at", "score_pct", "grade", "missed_count") ON TABLE "public"."check_attempts" TO "authenticated";

/* ── Answers ──────────────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS "public"."check_answers" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "attempt_id" uuid NOT NULL REFERENCES "public"."check_attempts" ("id") ON DELETE CASCADE,
    "user_id" uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users ("id") ON DELETE CASCADE,
    -- The bank's item and variant ids: which question, and which version of it, was shown.
    -- The results page uses them to show that version's explanation, and the next sitting
    -- uses them to show the other version.
    "item_id" text NOT NULL CHECK (char_length("item_id") <= 200),
    "variant_id" text NOT NULL CHECK (char_length("variant_id") <= 200),
    -- The dictionary slug this answer scores. One row scores exactly one term.
    "term_slug" text NOT NULL CHECK (char_length("term_slug") <= 200),
    "correct" boolean NOT NULL,
    "answered_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "check_answers_attempt_idx" ON "public"."check_answers" ("attempt_id");
CREATE INDEX IF NOT EXISTS "check_answers_status_idx" ON "public"."check_answers" ("user_id", "term_slug", "answered_at" DESC);

ALTER TABLE "public"."check_answers" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "check_answers own read" ON "public"."check_answers";
CREATE POLICY "check_answers own read" ON "public"."check_answers"
    FOR SELECT TO "authenticated"
    USING (
        "user_id" = (select auth.uid())
        AND lower(coalesce((select auth.jwt()) ->> 'email', '')) LIKE '%@hiddengem.media'
    );

-- Only into a sitting that is yours and still open. Without the EXISTS, a person could add
-- answers to a finished sitting and quietly rewrite their own history — or, with someone
-- else's attempt id, attach rows to a sitting that isn't theirs.
DROP POLICY IF EXISTS "check_answers own insert" ON "public"."check_answers";
CREATE POLICY "check_answers own insert" ON "public"."check_answers"
    FOR INSERT TO "authenticated"
    WITH CHECK (
        "user_id" = (select auth.uid())
        AND lower(coalesce((select auth.jwt()) ->> 'email', '')) LIKE '%@hiddengem.media'
        AND EXISTS (
            SELECT 1 FROM "public"."check_attempts" a
            WHERE a."id" = "check_answers"."attempt_id" AND a."user_id" = (select auth.uid()) AND a."completed_at" IS NULL
        )
    );

REVOKE ALL ON TABLE "public"."check_answers" FROM "anon";
REVOKE ALL ON TABLE "public"."check_answers" FROM "authenticated";
GRANT SELECT ON TABLE "public"."check_answers" TO "authenticated";
GRANT INSERT ("attempt_id", "item_id", "variant_id", "term_slug", "correct") ON TABLE "public"."check_answers" TO "authenticated";

/* ── Two guards a policy can't express ────────────────────────────── */

-- completed_at is the database's clock, not the browser's. Sittings are ordered by it ("Up 9%
-- since last time" compares the two newest), and two devices' clocks can disagree.
CREATE OR REPLACE FUNCTION "public"."check_attempts_stamp_finish"() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path = ''
AS $$
BEGIN
    IF OLD."completed_at" IS NULL AND NEW."completed_at" IS NOT NULL THEN
        NEW."completed_at" := now();
    END IF;
    RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS "check_attempts_stamp_finish" ON "public"."check_attempts";
CREATE TRIGGER "check_attempts_stamp_finish"
    BEFORE UPDATE ON "public"."check_attempts"
    FOR EACH ROW EXECUTE FUNCTION "public"."check_attempts_stamp_finish"();

-- The insert policy checks the sitting is open, but takes no lock, so a save from a second tab
-- in the same instant as Finish could land just after it. This share-locks the sitting first:
-- Finish then waits for the save, or the save sees the sitting finished and is refused. It runs
-- as the caller, so the row-level security above still decides whose sitting it can see.
CREATE OR REPLACE FUNCTION "public"."check_answers_open_only"() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path = ''
AS $$
BEGIN
    PERFORM 1 FROM "public"."check_attempts" WHERE "id" = NEW."attempt_id" AND "completed_at" IS NULL FOR SHARE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'This check sitting is finished, or not yours.' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS "check_answers_open_only" ON "public"."check_answers";
CREATE TRIGGER "check_answers_open_only"
    BEFORE INSERT ON "public"."check_answers"
    FOR EACH ROW EXECUTE FUNCTION "public"."check_answers_open_only"();

-- Trigger functions only; nobody should call them directly.
REVOKE ALL ON FUNCTION "public"."check_attempts_stamp_finish"() FROM PUBLIC, "anon", "authenticated";
REVOKE ALL ON FUNCTION "public"."check_answers_open_only"() FROM PUBLIC, "anon", "authenticated";

/* ── Current status per term ──────────────────────────────────────── */

-- Each person's latest answer per term, across their FINISHED sittings. An open sitting's
-- answers don't count until it's finished, so leaving halfway changes nothing.
--
-- security_invoker matters: a plain view runs with its OWNER's rights, which skip row-level
-- security, and would show every person's rows to anyone who can read the view. With it,
-- the view runs as the caller, so the policies above still limit them to their own.
--
-- "Latest" is answered_at, which the database stamps. Because a person has one open sitting
-- at a time and can only add answers to it, every answer in a sitting comes after every
-- answer in the one before, so this is the same as "the most recent sitting wins".
CREATE OR REPLACE VIEW "public"."check_term_status" WITH (security_invoker = true) AS
SELECT DISTINCT ON (a."user_id", a."term_slug")
    a."user_id",
    a."term_slug",
    a."correct",
    a."item_id",
    a."variant_id",
    a."answered_at"
FROM "public"."check_answers" a
JOIN "public"."check_attempts" t ON t."id" = a."attempt_id"
WHERE t."completed_at" IS NOT NULL
ORDER BY a."user_id", a."term_slug", a."answered_at" DESC, a."id" DESC;

REVOKE ALL ON TABLE "public"."check_term_status" FROM "anon";
REVOKE ALL ON TABLE "public"."check_term_status" FROM "authenticated";
GRANT SELECT ON TABLE "public"."check_term_status" TO "authenticated";
