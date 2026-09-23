-- =============================================================================
-- Elvankent Gayrimenkul — Supabase Storage kovaları ve erişim politikaları
-- property-images: ilan fotoğrafları (herkese açık okuma, sadece admin yazma)
-- branding: logo vb. marka görselleri (herkese açık okuma, sadece admin yazma)
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('property-images', 'property-images', true, 10485760, array['image/webp', 'image/jpeg', 'image/png', 'image/avif']),
  ('branding', 'branding', true, 2097152, array['image/webp', 'image/png', 'image/svg+xml', 'image/jpeg'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "site_images_admin_select" on storage.objects for select to authenticated
  using (bucket_id in ('property-images', 'branding') and (select public.is_admin()));

create policy "site_images_admin_insert" on storage.objects for insert to authenticated
  with check (bucket_id in ('property-images', 'branding') and (select public.is_admin()));

create policy "site_images_admin_update" on storage.objects for update to authenticated
  using (bucket_id in ('property-images', 'branding') and (select public.is_admin()))
  with check (bucket_id in ('property-images', 'branding') and (select public.is_admin()));

create policy "site_images_admin_delete" on storage.objects for delete to authenticated
  using (bucket_id in ('property-images', 'branding') and (select public.is_admin()));
