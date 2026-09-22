-- SOP library storage. The portal page to_html.py renders (self-contained HTML)
-- and the print PDF for each SOP live here; the masters and figures stay in the
-- repo under reference/sop/ as the record.
--
-- Private on purpose. SOPs describe the vault and the deploy path. Reads need a
-- real Supabase session (Google sign-in) — the shared team password creates no
-- session and so gets nothing here, which is the intended behaviour. Writes are
-- limited to @hiddengem.media accounts; the MVP uploads by hand from Studio, and
-- phase 2's Create/Update SOP writes through a Netlify function with the service
-- role key, which bypasses these policies anyway.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'sops',
    'sops',
    false,               -- private: signed URLs / authenticated download only
    10485760,            -- 10 MB per file; the largest SOP page today is under 1 MB
    ARRAY['text/html', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "sops team read" ON storage.objects;
CREATE POLICY "sops team read" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'sops');

DROP POLICY IF EXISTS "sops team write" ON storage.objects;
CREATE POLICY "sops team write" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'sops'
        AND (auth.jwt() ->> 'email') ILIKE '%@hiddengem.media'
    );

DROP POLICY IF EXISTS "sops team update" ON storage.objects;
CREATE POLICY "sops team update" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'sops' AND (auth.jwt() ->> 'email') ILIKE '%@hiddengem.media')
    WITH CHECK (bucket_id = 'sops' AND (auth.jwt() ->> 'email') ILIKE '%@hiddengem.media');

-- No DELETE policy: retire an SOP by changing its status in src/data/sops.json and
-- leaving the file in place, so old links degrade to "archived" rather than 404.
