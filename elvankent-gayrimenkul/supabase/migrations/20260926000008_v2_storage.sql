-- =============================================================================
-- V2 / 8 — Depolama (Supabase Storage): kiracı izolasyonlu medya kovaları
--
--   media-originals (ÖZEL, 50 MB): yüklenen orijinal dosya (4K ve üzeri).
--       Ziyaretçiye hiçbir zaman gönderilmez; yalnızca organizasyon üyeleri
--       kısa süreli imzalı adresle indirebilir. EXIF/GPS bilgisi burada kalır.
--   media (HERKESE AÇIK, 10 MB): sunucuda üretilen WebP varyantları
--       (320…2880 px). Meta veriler (EXIF/GPS) temizlenmiştir. Dosya yolları
--       rastgele UUID içerir; kova listelemesi yalnızca üyelere açıktır.
--   branding (HERKESE AÇIK, 2 MB): logo ve favicon (sunucuda PNG'ye dönüştürülür).
--   property-images (V1, eski): yalnızca geriye dönük okuma ve silme.
--
-- Yol düzeni (ilk iki klasör RLS ile doğrulanır):
--   organizations/{organization_id}/properties/{property_id}/images/{media_id}/original.{jpg|png|webp|avif}
--   organizations/{organization_id}/properties/{property_id}/images/{media_id}/w{genişlik}.webp
--   organizations/{organization_id}/branding/{dosya}.png
-- Tenant A, Tenant B'nin klasöründe OKUMA/YAZMA/GÜNCELLEME/SİLME yapamaz.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('media-originals', 'media-originals', false, 52428800, array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('media', 'media', true, 10485760, array['image/webp', 'image/jpeg', 'image/avif']),
  ('branding', 'branding', true, 2097152, array['image/png', 'image/webp', 'image/jpeg'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Eski kova: yeni yükleme kabul etmez
update storage.buckets set allowed_mime_types = array['image/webp'], file_size_limit = 1
 where id = 'property-images';

-- Orijinaller (özel)
create policy "media_originals_select" on storage.objects for select to authenticated
  using (
    bucket_id = 'media-originals'
    and (storage.foldername(name))[1] = 'organizations'
    and (storage.foldername(name))[2] in (select x.id::text from public.user_org_ids('media.manage') as x(id))
  );
create policy "media_originals_insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'media-originals'
    and (storage.foldername(name))[1] = 'organizations'
    and (storage.foldername(name))[2] in (select x.id::text from public.user_org_ids('media.manage') as x(id))
  );
create policy "media_originals_update" on storage.objects for update to authenticated
  using (
    bucket_id = 'media-originals'
    and (storage.foldername(name))[1] = 'organizations'
    and (storage.foldername(name))[2] in (select x.id::text from public.user_org_ids('media.manage') as x(id))
  );
create policy "media_originals_delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'media-originals'
    and (storage.foldername(name))[1] = 'organizations'
    and (storage.foldername(name))[2] in (select x.id::text from public.user_org_ids('media.manage') as x(id))
  );

-- Varyantlar (herkese açık okuma URL ile; API üzerinden listeleme/yazma üyelere)
create policy "media_select" on storage.objects for select to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'organizations'
    and (storage.foldername(name))[2] in (select x.id::text from public.user_org_ids('media.manage') as x(id))
  );
create policy "media_insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'organizations'
    and (storage.foldername(name))[2] in (select x.id::text from public.user_org_ids('media.manage') as x(id))
  );
create policy "media_update" on storage.objects for update to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'organizations'
    and (storage.foldername(name))[2] in (select x.id::text from public.user_org_ids('media.manage') as x(id))
  );
create policy "media_delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'organizations'
    and (storage.foldername(name))[2] in (select x.id::text from public.user_org_ids('media.manage') as x(id))
  );

-- Marka görselleri
create policy "branding_select" on storage.objects for select to authenticated
  using (
    bucket_id = 'branding'
    and (storage.foldername(name))[1] = 'organizations'
    and (storage.foldername(name))[2] in (select x.id::text from public.user_org_ids('settings.manage') as x(id))
  );
create policy "branding_insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'branding'
    and (storage.foldername(name))[1] = 'organizations'
    and (storage.foldername(name))[2] in (select x.id::text from public.user_org_ids('settings.manage') as x(id))
  );
create policy "branding_update" on storage.objects for update to authenticated
  using (
    bucket_id = 'branding'
    and (storage.foldername(name))[1] = 'organizations'
    and (storage.foldername(name))[2] in (select x.id::text from public.user_org_ids('settings.manage') as x(id))
  );
create policy "branding_delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'branding'
    and (storage.foldername(name))[1] = 'organizations'
    and (storage.foldername(name))[2] in (select x.id::text from public.user_org_ids('settings.manage') as x(id))
  );

-- V1 kovası: ilanın organizasyonunda medya yetkisi olan silebilir (geçiş temizliği)
create policy "legacy_property_images_delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'property-images'
    and (storage.foldername(name))[1] = 'properties'
    and (storage.foldername(name))[2] in (
      select p.id::text from public.properties p
       where p.organization_id in (select x.id from public.user_org_ids('media.manage') as x(id))
    )
  );
