-- ============================================================
-- MIDO XI — Storage RLS for the private "videos" bucket
-- Each user can only read/write/delete objects inside their own
-- folder: videos/<their-user-id>/<file>. Run after 0001_init.sql.
-- (The bucket itself is created by the app's setup, not here.)
-- ============================================================

create policy "videos_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "videos_select_own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "videos_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "videos_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
