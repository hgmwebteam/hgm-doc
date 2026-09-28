-- Automation branding: everything the reel, carousel/story and email automations read for
-- a client, filled once by the team in the Brand Kit and then pulled forever.
--
-- It replaces three hand-filled Google Sheets ("Reel Automation Fonts", "Carousel & Story
-- Automation Branding", "Email Components (Automation)") that sat next to a brand kit
-- already holding the same palette and families. Columns are named after those sheets'
-- headers, US spelling ("color"), so the mapping is readable in both directions:
--
--   Reel Automation Fonts      Primary Font / Primary Font Size / Secondary Font Size /
--                              Weight / Secondary  → reel_*
--   Carousel & Story Branding  Title Font / Body Font / Background / Accent / Font Colour
--                              → carousel_story_* and story_*
--   Email Components           BG / Button / Secondary Colour, Contact Info, Footer Text,
--                              Instagram / Facebook / TikTok / Website Link, Contact Number
--                              → email_*
--
-- One row per dashboard slug. `client_name` rides alongside because the automations look a
-- client up by name, the way every one of those sheets' first column did.
--
-- Deliberately flat named columns, not jsonb: the point is that an automation selects a
-- column by the name it was asked for, without knowing this app's shapes.
--
-- Access model — INTERNAL, which here means the client must not be able to read it:
--   • Read/insert/update: authenticated @hiddengem.media only. A client is `anon` to
--     Supabase (they clear the app's own email/password gate, not Supabase auth), so anon
--     having no policy at all is what keeps this internal even if the UI gate were bypassed.
--   • The automations read with the service_role key, which bypasses RLS by design.
-- There is deliberately NO anon read: the anon key ships inside the browser bundle, so an
-- anon policy here would publish every client's branding to anyone who opened devtools.

CREATE TABLE IF NOT EXISTS "public"."automation_branding" (
    "slug" "text" NOT NULL,
    "client_name" "text" DEFAULT ''::"text",

    -- Reels — sizes are CSS lengths as the automation expects them ("7.5vmin"), weight a
    -- numeric string ("400"), both kept as text so a value is never silently reformatted.
    "reel_primary_font" "text" DEFAULT ''::"text",
    "reel_primary_font_size" "text" DEFAULT ''::"text",
    "reel_secondary_font_size" "text" DEFAULT ''::"text",
    "reel_font_weight" "text" DEFAULT ''::"text",
    "reel_secondary_font" "text" DEFAULT ''::"text",

    -- Carousels and stories share their type
    "carousel_story_title_font" "text" DEFAULT ''::"text",
    "carousel_story_body_font" "text" DEFAULT ''::"text",

    -- Stories
    "story_background_color" "text" DEFAULT ''::"text",
    "story_accent_color" "text" DEFAULT ''::"text",
    "story_font_color" "text" DEFAULT ''::"text",

    -- Email
    "email_background_color" "text" DEFAULT ''::"text",
    "email_button_color" "text" DEFAULT ''::"text",
    "email_secondary_color" "text" DEFAULT ''::"text",
    "email_contact_info" "text" DEFAULT ''::"text",
    "email_footer_text" "text" DEFAULT ''::"text",
    "email_instagram_link" "text" DEFAULT ''::"text",
    "email_facebook_link" "text" DEFAULT ''::"text",
    "email_tiktok_link" "text" DEFAULT ''::"text",
    "email_website_link" "text" DEFAULT ''::"text",
    "email_contact_number" "text" DEFAULT ''::"text",

    "updated_by" "text" DEFAULT ''::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE "public"."automation_branding" OWNER TO "postgres";
ALTER TABLE ONLY "public"."automation_branding"
    ADD CONSTRAINT "automation_branding_pkey" PRIMARY KEY ("slug");
ALTER TABLE "public"."automation_branding" ENABLE ROW LEVEL SECURITY;

-- The automations look a client up by name, like the sheets did.
CREATE INDEX IF NOT EXISTS "automation_branding_client_name_idx"
    ON "public"."automation_branding" (lower("client_name"));

CREATE POLICY "automation_branding team read" ON "public"."automation_branding"
    FOR SELECT TO "authenticated"
    USING (lower(coalesce(auth.jwt() ->> 'email', '')) LIKE '%@hiddengem.media');

CREATE POLICY "automation_branding team insert" ON "public"."automation_branding"
    FOR INSERT TO "authenticated"
    WITH CHECK (lower(coalesce(auth.jwt() ->> 'email', '')) LIKE '%@hiddengem.media');

CREATE POLICY "automation_branding team update" ON "public"."automation_branding"
    FOR UPDATE TO "authenticated"
    USING (lower(coalesce(auth.jwt() ->> 'email', '')) LIKE '%@hiddengem.media')
    WITH CHECK (lower(coalesce(auth.jwt() ->> 'email', '')) LIKE '%@hiddengem.media');

COMMENT ON TABLE "public"."automation_branding" IS
    'Per-client fonts, colours and email components for the reel, carousel/story and email automations. Team-only; automations read it with the service_role key, matching on lower(client_name).';
