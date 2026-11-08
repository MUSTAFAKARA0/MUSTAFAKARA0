-- =============================================================================
-- Orijinal boyut koruması — 5/5 GERİ DÖNÜŞ (20261108000001_media_size_guard.sql'i geri alır)
--
-- Kaynak: supabase/pending/20261108000001_media_size_guard.sql, "GERİ DÖNÜŞ" başlığı (birim testi LR-14 her ifadenin
-- burada bulunduğunu denetler). E, C'den ÖNCE geri alınır (E, C'nin bakım penceresi tablosunu okur).
-- Yalnızca onayla. Tek işlem. Veri ve dosya değiştirilmez: yalnız tetikleyici ve fonksiyonu silinir.
--   Supabase SQL Editor: dosyanın tamamı tek sorgu · psql: psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f 05_rollback.sql
-- lock_timeout 3 sn: storage.objects kilidi alınamazsa 55P03 ile vazgeçer, hiçbir şey değişmez; sakin anda yeniden deneyin.
-- Sonra: 01_preflight.sql yeniden çalıştırılır; 7. ve 8. satırlar uygulama öncesi çıktıyla aynı olmalı.
-- =============================================================================
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

drop trigger if exists media_storage_size_guard on storage.objects;
drop function if exists public.media_storage_size_guard();

-- Aynı işlemde kontrol: kalıntı varsa geri alınır
do $kontrol$
begin
  if exists (select 1 from pg_trigger where tgname = 'media_storage_size_guard' and not tgisinternal)
     or to_regprocedure('public.media_storage_size_guard()') is not null then
    raise exception 'KONTROL: E nesnelerinden biri kaldı; işlem geri alınıyor';
  end if;
end
$kontrol$;

commit;
