-- Request files: images, PDF, Word, Excel, CSV and plain text, 25 MB each.
--
-- APPLIED BY HAND in the portal project's SQL editor (iymhjrmmgwrxdggcvmjn, behind
-- api.hgmportal.com), before the portal deploy that uses it: the help centre's only file
-- path uploads here (netlify/lib/ticket-files.mts, which carries the same SQL and the
-- ticket_uploads ledger it needs in the reporting project).
--
-- PRIVATE and with NO storage.objects policies on purpose: the browser writes only through
-- single-object signed upload URLs minted by the ticket-upload-url function (service role),
-- nobody reads from the browser, and the platform downloads with the service key.
--
-- A NEW bucket rather than widening `ticket-images`, which is left exactly as it is: that one
-- holds files a server function wrote, which existing ticket_attachments rows still point
-- at, and the daily orphan cleanup must never touch them. One insert ... on conflict sets the
-- exact limits (the old ensureBucket() only ever created, never updated).
--
-- Read-back: select id, public, file_size_limit, allowed_mime_types from storage.buckets
-- where id = 'ticket-files';  expect false, 26214400, 14 types. Also confirm the project-wide
-- Storage upload limit (Storage settings) is at least 25 MB; the default 50 MB is fine.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ticket-files', 'ticket-files', false, 26214400,
  array[
    'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/avif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'text/plain'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
