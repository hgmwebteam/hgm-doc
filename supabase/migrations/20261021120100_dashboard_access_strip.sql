-- Dashboard passwords move off the public row (step 2 of 2).
--
-- RUN ONLY AFTER the code that reads dashboard_access_secrets is live on hgmportal.com. Before
-- that, the deployed sign-in card still compares passwords it reads off dashboard_pages, and
-- stripping them would lock out every client on a password-gated dashboard.
--
-- Copies once more (an AM may have changed a password through the old code between step 1 and
-- the deploy; any row still holding plaintext has not been saved by the new code, so its
-- plaintext is the latest), then removes data.share_password and every
-- data.dashboard_users[].password. gate_armed, the emails and the sections stay.
--
-- Re-runnable: a second run finds nothing to copy or strip.

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

UPDATE "public"."dashboard_pages" d
SET "data" = CASE
    WHEN jsonb_typeof(d."data" -> 'dashboard_users') = 'array' THEN
        (d."data" - 'share_password')
        || jsonb_build_object(
            'dashboard_users',
            (SELECT coalesce(jsonb_agg(u - 'password' ORDER BY i), '[]'::jsonb) FROM jsonb_array_elements(d."data" -> 'dashboard_users') WITH ORDINALITY AS t(u, i))
        )
    ELSE d."data" - 'share_password'
END
WHERE d."data" ? 'share_password'
   OR EXISTS (
        SELECT 1
        FROM jsonb_array_elements(CASE WHEN jsonb_typeof(d."data" -> 'dashboard_users') = 'array' THEN d."data" -> 'dashboard_users' ELSE '[]'::jsonb END) u
        WHERE u ? 'password'
   );
