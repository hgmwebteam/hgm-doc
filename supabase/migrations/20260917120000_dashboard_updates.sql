-- The team's activity feed for client dashboards (the /log page).
--
-- A client dashboard is edited by whoever is free — an AM one morning, the web team that
-- afternoon — and until now nothing recorded that. Two people worked the same row blind,
-- which is how an afternoon of notes got overwritten three times on 2026-08-24 (see the
-- conflict guard in client-dashboard-page.tsx). This table answers the everyday question
-- behind that: what did anyone change today, and on whose client?
--
-- One row per SAVE, written by the browser that saved, from the same session that wrote
-- dashboard_pages. Nothing writes here on its own schedule — no trigger, no function —
-- so a row existing means a person pressed Save and something actually differed.
--
-- WHAT IS DELIBERATELY NOT STORED: values. Only which sections changed and the names of
-- the fields inside them. dashboard_pages.data carries share_password, dashboard_users
-- passwords and every word a client wrote about their business; copying any of that into
-- a second table would double the places a leak can come from for no gain — the feed only
-- ever needs to say "Alicia changed the Brand Kit (Colours, Fonts)". Keep it that way:
-- if a future entry needs more context, add a short human note, never the field's value.
--
-- ACCESS: team-only, checked against the session's own JWT like script_logs.
--   * anon gets NOTHING. Clients never write dashboard_pages (they have no UPDATE grant)
--     and have no business reading who on the team touched their row.
--   * authenticated gets SELECT/INSERT on an @hiddengem.media address.
--   * UPDATE is granted to NOBODY — an audit line that can be edited afterwards is worth
--     less than no line at all.
--   * DELETE is granted so a wrong or noisy entry can be cleared; the feed is a working
--     record for the team, not a compliance log.

CREATE TABLE IF NOT EXISTS "public"."dashboard_updates" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    -- dashboard_pages slug, always "{client}-dashboard". Not a clients.id: a dashboard is
    -- saved whether or not anyone has filed that client on the roster yet.
    "slug" text NOT NULL,
    -- Captured at write time so the feed still reads properly after a rename, and so one
    -- query fills the page instead of a join per row.
    "client_name" text NOT NULL DEFAULT '',
    -- Who saved. The email comes from the verified session, never from a form field —
    -- see recordDashboardSave() in src/lib/dashboard-updates.ts.
    "author_email" text NOT NULL,
    "author_name" text NOT NULL DEFAULT '',
    "author_avatar" text NOT NULL DEFAULT '',
    -- 'save'    — an ordinary dashboard Save, sections derived by diff.
    -- 'publish' — a Landing Page or Pinned Stories version going live. Those two sections
    --             write their own tables on every keystroke, so only the publish is logged;
    --             logging their saves would bury everything else in the feed.
    "kind" text NOT NULL DEFAULT 'save' CHECK ("kind" IN ('save', 'publish')),
    -- Human section labels, e.g. {"Brand Kit","Master Brand"}. Labels rather than SectionId
    -- so the feed keeps reading correctly if a section is ever renamed or retired in code.
    "sections" text[] NOT NULL DEFAULT '{}',
    -- [{ "section": "Master Brand", "fields": ["Taglines", "Personas"] }] — names only.
    "detail" jsonb NOT NULL DEFAULT '[]'::jsonb,
    -- One line for entries a diff can't describe, e.g. "Published Landing Page v3".
    "summary" text NOT NULL DEFAULT '',
    "created_at" timestamptz NOT NULL DEFAULT now()
);

-- The feed reads newest-first across everything; the other two indexes serve the
-- per-client and per-person filters on /log.
CREATE INDEX IF NOT EXISTS "dashboard_updates_created_at_idx" ON "public"."dashboard_updates" ("created_at" DESC);
CREATE INDEX IF NOT EXISTS "dashboard_updates_slug_idx" ON "public"."dashboard_updates" ("slug", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "dashboard_updates_author_idx" ON "public"."dashboard_updates" ("author_email", "created_at" DESC);

ALTER TABLE "public"."dashboard_updates" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dashboard_updates team read" ON "public"."dashboard_updates";
CREATE POLICY "dashboard_updates team read" ON "public"."dashboard_updates"
    FOR SELECT TO "authenticated"
    USING (lower(coalesce(auth.jwt() ->> 'email', '')) LIKE '%@hiddengem.media');

-- WITH CHECK pins author_email to the session's own address. Without it a signed-in team
-- member could file an entry under a colleague's name, and a feed whose attribution can be
-- forged is worse than none — it would be believed.
DROP POLICY IF EXISTS "dashboard_updates team insert" ON "public"."dashboard_updates";
CREATE POLICY "dashboard_updates team insert" ON "public"."dashboard_updates"
    FOR INSERT TO "authenticated"
    WITH CHECK (
        lower(coalesce(auth.jwt() ->> 'email', '')) LIKE '%@hiddengem.media'
        AND lower("author_email") = lower(coalesce(auth.jwt() ->> 'email', ''))
    );

DROP POLICY IF EXISTS "dashboard_updates team delete" ON "public"."dashboard_updates";
CREATE POLICY "dashboard_updates team delete" ON "public"."dashboard_updates"
    FOR DELETE TO "authenticated"
    USING (lower(coalesce(auth.jwt() ->> 'email', '')) LIKE '%@hiddengem.media');

-- Table grants must agree with the policies above. Supabase grants anon and authenticated
-- everything on new public tables by default, so revoking first is the only way to be sure
-- — a policy is not a permission, and leaving the privilege in place means one permissive
-- policy is all that stands between a stranger and this data.
REVOKE ALL ON TABLE "public"."dashboard_updates" FROM "anon";
REVOKE ALL ON TABLE "public"."dashboard_updates" FROM "authenticated";
GRANT SELECT, INSERT, DELETE ON TABLE "public"."dashboard_updates" TO "authenticated";
