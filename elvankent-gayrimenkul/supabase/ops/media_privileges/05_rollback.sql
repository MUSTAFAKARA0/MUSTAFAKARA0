-- =============================================================================
-- Medya sütun yetkileri — 5/5 GERİ DÖNÜŞ (20261027000002_media_column_privileges.sql'i geri alır)
--
-- Kaynak: supabase/pending/20261027000002_media_column_privileges.sql, "GERİ DÖNÜŞ" başlığı (birim testi LR-14
-- her ifadenin burada bulunduğunu denetler). B HER ZAMAN A'dan önce geri alınır (A'nın 05'i B varken durur);
-- C (media_storage_slots) varsa önce C'nin 05'i (bu betik C varken DUR der).
-- B'den sonra uygulama kodu geri alınacaksa (Instant Rollback) ÖNCE bu betik çalıştırılır: eski kod B ile 42501 alır.
-- Yalnızca onayla. Tek işlem. Veri değiştirilmez: şekil tetikleyicisi silinir, authenticated'a tablo düzeyi
-- UPDATE/INSERT ve TRUNCATE/REFERENCES/TRIGGER geri verilir (sütun yetkileri önce temizlenir).
--   Supabase SQL Editor: dosyanın tamamı tek sorgu · psql: psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f 05_rollback.sql
-- lock_timeout 3 sn: tablo kilidi alınamazsa 55P03 ile vazgeçer, hiçbir şey değişmez; sakin anda yeniden deneyin.
-- Sonra: 01_preflight.sql yeniden çalıştırılır; 6., 7. ve 8. satırlar uygulama öncesi (02) çıktıyla aynı olmalı.
-- =============================================================================
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

-- Sıra: C (media_storage_slots) B'nin kanonik yol kuralına dayanır; C varken B geri alınmaz
do $sira$
begin
  if exists (select 1 from pg_trigger where tgname = 'media_storage_slot_guard' and not tgisinternal) then
    raise exception 'DUR: önce C geri alınır (media_storage_slots/05_rollback.sql)';
  end if;
end
$sira$;

drop trigger if exists media_assets_pending_shape on public.media_assets;
drop function if exists public.media_assets_pending_shape();
revoke update, insert on public.media_assets from authenticated;
grant update, insert on public.media_assets to authenticated;
grant truncate, references, trigger on public.media_assets to authenticated;
notify pgrst, 'reload schema';

-- Aynı işlemde kontrol: kalıntı varsa geri alınır
do $kontrol$
begin
  if exists (select 1 from pg_trigger where tgname = 'media_assets_pending_shape' and not tgisinternal)
     or to_regprocedure('public.media_assets_pending_shape()') is not null then
    raise exception 'KONTROL: media_assets_pending_shape ya da fonksiyonu kaldı; işlem geri alınıyor';
  end if;
  if not has_table_privilege('authenticated', 'public.media_assets', 'update') or not has_table_privilege('authenticated', 'public.media_assets', 'insert')
     or not has_column_privilege('authenticated', 'public.media_assets', 'status', 'update') then
    raise exception 'KONTROL: authenticated UPDATE/INSERT yetkisi geri gelmedi; işlem geri alınıyor';
  end if;
end
$kontrol$;

commit;
