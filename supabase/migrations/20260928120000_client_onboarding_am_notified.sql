-- When the assigned Account Manager was emailed that this form was submitted. Each
-- client has two rows here — "{base}-onboarding" (Onboarding Form) and "{base}-access"
-- (Account Access Form) — so each form gets its own email. Written only by
-- netlify/functions/form-submitted.mts, which claims it (NULL → now()) before sending,
-- so a resubmit or a double-click never sends a second email.
--
-- A column rather than a key inside `data`: the form's autosave replaces `data`
-- wholesale from the browser's copy, which would wipe a flag stored there.

ALTER TABLE "public"."client_onboarding_pages"
    ADD COLUMN IF NOT EXISTS "am_notified_at" timestamp with time zone;
