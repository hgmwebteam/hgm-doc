-- The client's feedback on a finished welcome email, mirrored into the email pipeline's
-- own table so it is read where the email is worked on rather than only on the dashboard.
--
-- dashboard_suggestions stays the source of truth (it carries who wrote it, when, and the
-- AM's done/dismissed verdict); this column is a copy of the latest open note for the row,
-- written by netlify/functions/dashboard-suggestions.mts and cleared on withdraw.
--
-- Matched by client_name + week (NOT position): position repeats within a client —
-- Starlight Haven Hot Springs has nine rows across six distinct positions, with weeks 4
-- and 5 both sitting at position 4 — so a position match would overwrite one email's
-- feedback with another's. `week` is unique per client, and the app already reads
-- `week ?? position` for the same reason.
alter table public.email_wf_emails
    add column if not exists feedback text;

comment on column public.email_wf_emails.feedback is
    'Latest open client feedback on this email, copied from dashboard_suggestions (welcomeFlow.{week-1}). Cleared when the client withdraws. Read-only for the email pipeline.';
