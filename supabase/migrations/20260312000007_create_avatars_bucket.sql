-- ============================================================
-- Create avatars storage bucket for profile photos
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152, -- 2MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Allow authenticated users to upload their own avatar
create policy "users_upload_own_avatar" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'avatars'
    and auth.uid()::text = split_part((storage.filename(name)), '.', 1)
  );

-- Allow authenticated users to update (overwrite) their own avatar
create policy "users_update_own_avatar" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = split_part((storage.filename(name)), '.', 1)
  );

-- Allow public read access to all avatars
create policy "public_read_avatars" on storage.objects
  for select to public
  using (bucket_id = 'avatars');
