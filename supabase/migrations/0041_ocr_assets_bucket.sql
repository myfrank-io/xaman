-- 0041_ocr_assets_bucket.sql — D139: the French OCR model leaves the deployment.
--
-- `fra.traineddata.gz` is 600 Ko of open-source language data read by the local reader (D92).
-- It was traced into the two serverless functions that can read a document, so every deployment
-- carried two copies of it — for a file that changes about once a year. It moves here, and the
-- reader fetches it by URL (`langPath`, src/lib/inbox/extract.ts); the copy in the repository
-- stays the source of truth and `pnpm ocr:push` uploads it.
--
-- The bucket is **public** on purpose, and it is the only public bucket of the project:
--   * Tesseract fetches the model from inside its worker with a bare `fetch`, no session and no
--     header to put a token in — a signed URL would expire and take the OCR down with it;
--   * what it holds is Apache-2.0 data published by Google, not a single byte about a boat.
-- Nothing else may ever be written here: the boats' documents live in `boat-files`, which is
-- private (0002), and the constraint below keeps this bucket to the model alone.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ocr-assets',
  'ocr-assets',
  true,
  8 * 1024 * 1024,
  array['application/gzip', 'application/octet-stream']
)
on conflict (id) do update
   set public = true,
       file_size_limit = excluded.file_size_limit,
       allowed_mime_types = excluded.allowed_mime_types;

-- Read: everyone, signed in or not — see above. `for select` only.
drop policy if exists "ocr_assets_read" on storage.objects;
create policy "ocr_assets_read" on storage.objects for select to anon, authenticated
  using (bucket_id = 'ocr-assets');

-- No insert, update or delete policy: RLS denies what no policy allows, so the bucket is
-- read-only for every signed-in user and for the anonymous one. Only the service role, which
-- bypasses RLS and never reaches the browser (rule 2), writes here — from `pnpm ocr:push`.
