-- Explicit API-role grants for the six tables that were still leaning on Supabase's
-- automatic ones.
--
-- From 2026-10-30 Supabase stops granting anon, authenticated and service_role on new
-- tables in `public`. Existing tables keep what they have, so production is untouched,
-- but anything that rebuilds the schema from these migrations (a local `supabase db
-- reset`, a preview branch, a fresh project) creates every table "new" and gets no
-- grants it did not write down. Without this file, on such a rebuild:
--   • automation_branding has no grants at all, so the team's Brand Kit save fails and
--     the automations (service_role) cannot read it;
--   • check_answers, check_attempts, dashboard_suggestions, dashboard_updates and
--     script_logs revoke and re-grant `authenticated` only, so every Netlify function
--     that reaches them with the service_role key gets "permission denied".
--
-- Each grant below matches what production already holds (checked 2026-10-20 against
-- information_schema.role_table_grants), so applying it there is a no-op. service_role
-- bypasses RLS and never ships to the browser, so full DML for it adds no exposure.

GRANT SELECT, INSERT, UPDATE ON TABLE "public"."automation_branding" TO "authenticated";

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."automation_branding" TO "service_role";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."check_answers" TO "service_role";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."check_attempts" TO "service_role";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."dashboard_suggestions" TO "service_role";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."dashboard_updates" TO "service_role";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."script_logs" TO "service_role";
