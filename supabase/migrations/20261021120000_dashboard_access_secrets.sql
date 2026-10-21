-- Dashboard passwords move off the public row (step 1 of 2).
--
-- WHY. dashboard_pages is readable with the public anon key ("dashboard_pages read", USING true),
-- and until now the client sign-in passwords lived inside it: data.share_password and
-- data.dashboard_users[].password, in plaintext, compared in the browser. Anyone holding the
-- bundle's anon key could list every client's email and password (seen 21 Oct 2026 while
-- debugging a Gooseberry Lodges sign-in). A client's own password is often one they reuse
-- elsewhere, so this was the one leak on the row that reached past the portal.
--
-- WHAT. A team-only table holds the passwords; the dashboard-unlock Netlify function checks a
-- sign-in with the service key and only ever answers yes or no. dashboard_pages keeps the
-- access LIST (emails and sections, harmless to read) plus one non-secret flag, data.gate_armed,
-- so the browser still knows whether to show the sign-in card without knowing any password.
--
-- ORDER. This file only ADDS: the table, its policies, a copy of every password, and gate_armed.
-- The plaintext stays on dashboard_pages so the code deployed before this change keeps working.
-- 20261021120100_dashboard_access_strip.sql removes it, and must run only AFTER the code that
-- reads this table is live on hgmportal.com.
--
-- Re-runnable: every statement can run again safely, and a re-run refreshes the copy.

CREATE TABLE IF NOT EXISTS "public"."dashboard_access_secrets" (
    "slug" text PRIMARY KEY,
    -- Fallback password for anyone listed without one of their own. '' = none.
    "share_password" text NOT NULL DEFAULT '',
    -- { "<lower-cased, trimmed email>": "<password>" } for people with their own password.
    "passwords" jsonb NOT NULL DEFAULT '{}'::jsonb,
    "updated_at" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "public"."dashboard_access_secrets" ENABLE ROW LEVEL SECURITY;

-- Nothing for anon, ever. The sign-in check runs server-side with the service key.
REVOKE ALL ON TABLE "public"."dashboard_access_secrets" FROM "anon";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."dashboard_access_secrets" TO "authenticated";

DROP POLICY IF EXISTS "dashboard_access_secrets team read" ON "public"."dashboard_access_secrets";
CREATE POLICY "dashboard_access_secrets team read" ON "public"."dashboard_access_secrets"
    FOR SELECT TO "authenticated"
    USING (lower(coalesce((select auth.jwt()) ->> 'email', '')) LIKE '%@hiddengem.media');

DROP POLICY IF EXISTS "dashboard_access_secrets team insert" ON "public"."dashboard_access_secrets";
CREATE POLICY "dashboard_access_secrets team insert" ON "public"."dashboard_access_secrets"
    FOR INSERT TO "authenticated"
    WITH CHECK (lower(coalesce((select auth.jwt()) ->> 'email', '')) LIKE '%@hiddengem.media');

DROP POLICY IF EXISTS "dashboard_access_secrets team update" ON "public"."dashboard_access_secrets";
CREATE POLICY "dashboard_access_secrets team update" ON "public"."dashboard_access_secrets"
    FOR UPDATE TO "authenticated"
    USING (lower(coalesce((select auth.jwt()) ->> 'email', '')) LIKE '%@hiddengem.media')
    WITH CHECK (lower(coalesce((select auth.jwt()) ->> 'email', '')) LIKE '%@hiddengem.media');

DROP POLICY IF EXISTS "dashboard_access_secrets team delete" ON "public"."dashboard_access_secrets";
CREATE POLICY "dashboard_access_secrets team delete" ON "public"."dashboard_access_secrets"
    FOR DELETE TO "authenticated"
    USING (lower(coalesce((select auth.jwt()) ->> 'email', '')) LIKE '%@hiddengem.media');

-- Copy every password that is still on a dashboard row. A row that already lost its plaintext
-- (a save by the new code) has nothing to copy and is left alone, so a re-run never overwrites
-- a password the team changed after the move.
INSERT INTO "public"."dashboard_access_secrets" ("slug", "share_password", "passwords", "updated_at")
SELECT
    d."slug",
    coalesce(trim(d."data" ->> 'share_password'), ''),
    coalesce(
        (
            SELECT jsonb_object_agg(lower(trim(u ->> 'email')), trim(u ->> 'password'))
            FROM jsonb_array_elements(CASE WHEN jsonb_typeof(d."data" -> 'dashboard_users') = 'array' THEN d."data" -> 'dashboard_users' ELSE '[]'::jsonb END) u
            WHERE trim(coalesce(u ->> 'email', '')) <> '' AND trim(coalesce(u ->> 'password', '')) <> ''
        ),
        '{}'::jsonb
    ),
    now()
FROM "public"."dashboard_pages" d
WHERE d."data" ? 'share_password'
   OR EXISTS (
        SELECT 1
        FROM jsonb_array_elements(CASE WHEN jsonb_typeof(d."data" -> 'dashboard_users') = 'array' THEN d."data" -> 'dashboard_users' ELSE '[]'::jsonb END) u
        WHERE u ? 'password'
   )
ON CONFLICT ("slug") DO UPDATE
    SET "share_password" = EXCLUDED."share_password",
        "passwords" = EXCLUDED."passwords",
        "updated_at" = EXCLUDED."updated_at";

-- gate_armed: the same rule the browser used (client-dashboard-page.tsx, gateArmed) — armed once
-- ONE listed person has a password that gets them in, their own or the shared fallback. The
-- list is dashboard_users when that key is present, else the legacy allowed_emails.
UPDATE "public"."dashboard_pages" d
SET "data" = d."data" || jsonb_build_object(
    'gate_armed',
    EXISTS (
        SELECT 1
        FROM jsonb_array_elements(
            CASE
                WHEN d."data" ? 'dashboard_users' AND jsonb_typeof(d."data" -> 'dashboard_users') = 'array' THEN d."data" -> 'dashboard_users'
                WHEN d."data" ? 'dashboard_users' THEN '[]'::jsonb
                WHEN jsonb_typeof(d."data" -> 'allowed_emails') = 'array'
                    THEN (SELECT coalesce(jsonb_agg(jsonb_build_object('email', e)), '[]'::jsonb) FROM jsonb_array_elements_text(d."data" -> 'allowed_emails') e)
                ELSE '[]'::jsonb
            END
        ) u
        WHERE trim(coalesce(u ->> 'email', '')) <> ''
          AND (trim(coalesce(u ->> 'password', '')) <> '' OR trim(coalesce(d."data" ->> 'share_password', '')) <> '')
    )
)
WHERE d."data" ? 'share_password'
   OR d."data" ? 'dashboard_users'
   OR d."data" ? 'allowed_emails';
