-- Ensure the `network-uploads` public storage bucket exists.
--
-- Referenced by:
--   /api/uploads
--   /api/trade-off/canteen-product/upload-image
--
-- Historically created manually in the Supabase dashboard. This
-- migration codifies it so a fresh clone stands up the storage layer
-- without a manual step. Public bucket so `getPublicUrl` returns a
-- CDN-cacheable URL — file paths are UUID-namespaced under the owner
-- slug, so listing brute-force isn't useful.

insert into storage.buckets (id, name, public)
values ('network-uploads', 'network-uploads', true)
on conflict (id) do nothing;

-- Read policy: public. Anyone can fetch the file if they know the URL.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'network_uploads_public_read'
  ) then
    create policy network_uploads_public_read on storage.objects
      for select
      to public
      using (bucket_id = 'network-uploads');
  end if;
end$$;

-- Write policy: service role only. Uploads go through the /api/uploads
-- endpoint which authenticates the caller server-side then uses the
-- service role key to write. No client-side direct write ever.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'network_uploads_service_write'
  ) then
    create policy network_uploads_service_write on storage.objects
      for all
      to service_role
      using (bucket_id = 'network-uploads')
      with check (bucket_id = 'network-uploads');
  end if;
end$$;
