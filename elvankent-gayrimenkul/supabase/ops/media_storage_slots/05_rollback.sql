-- =============================================================================
-- Medya depolama yuvaları — 5/5 GERİ DÖNÜŞ (20261027000003_media_storage_slots.sql'i geri alır)
--
-- Kaynak: supabase/pending/20261027000003_media_storage_slots.sql, "GERİ DÖNÜŞ" başlığı (birim testi LR-14 her ifadenin
-- burada bulunduğunu denetler). C HER ZAMAN B'den önce geri alınır (B'nin 05'i C varken durur).
-- Yalnızca onayla. Tek işlem. Veri ve dosya değiştirilmez: tetikleyici, yuva fonksiyonları ve bakım penceresi tablosu silinir;
-- dört yazma politikası 20260926000008_v2_storage.sql'deki hâliyle (yalnız kurum klasörü denetimi) yeniden kurulur.
--   Supabase SQL Editor: dosyanın tamamı tek sorgu · psql: psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f 05_rollback.sql
-- lock_timeout 3 sn: storage.objects kilidi alınamazsa 55P03 ile vazgeçer, hiçbir şey değişmez; sakin anda yeniden deneyin.
-- Sonra: 01_preflight.sql yeniden çalıştırılır; 7., 8. ve 9. satırlar uygulama öncesi çıktıyla aynı olmalı; 02 çıktısındaki
-- politika tanımları elle değiştirilmişse (varsayılan dışı) o tanımlar 02 çıktısından elle kurulur.
-- =============================================================================
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

drop trigger if exists media_storage_slot_guard on storage.objects;
drop policy if exists "media_originals_insert" on storage.objects;
drop policy if exists "media_originals_update" on storage.objects;
drop policy if exists "media_insert" on storage.objects;
drop policy if exists "media_update" on storage.objects;
drop function if exists public.media_storage_slot_guard();
drop function if exists public.media_original_slot_open(text);
drop function if exists public.media_variant_slot_open(text);
drop function if exists public.media_original_slot_org(text);
drop function if exists public.media_variant_slot_org(text);
drop table if exists public.media_overwrite_window;

-- 20260926000008_v2_storage.sql'deki tanımlar (birebir)
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
notify pgrst, 'reload schema';

-- Aynı işlemde kontrol: kalıntı varsa geri alınır
do $kontrol$
begin
  if exists (select 1 from pg_trigger where tgname = 'media_storage_slot_guard' and not tgisinternal)
     or to_regprocedure('public.media_storage_slot_guard()') is not null
     or to_regprocedure('public.media_original_slot_open(text)') is not null
     or to_regprocedure('public.media_variant_slot_open(text)') is not null
     or to_regclass('public.media_overwrite_window') is not null then
    raise exception 'KONTROL: C nesnelerinden biri kaldı; işlem geri alınıyor';
  end if;
  if (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects'
        and policyname in ('media_originals_insert', 'media_originals_update', 'media_insert', 'media_update')
        and (coalesce(qual, '') || coalesce(with_check, '')) !~ 'slot_open') <> 4 then
    raise exception 'KONTROL: dört yazma politikası eski hâline dönmedi; işlem geri alınıyor';
  end if;
end
$kontrol$;

commit;
