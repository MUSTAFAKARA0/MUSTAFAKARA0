-- =============================================================================
-- Medya sonlandırma RPC'si — 5/5 GERİ DÖNÜŞ (20261027000001_media_finalize_rpc.sql'i geri alır)
--
-- Kaynak: supabase/pending/20261027000001_media_finalize_rpc.sql, "GERİ DÖNÜŞ" başlığı (birim testi LR-14 her ifadenin burada bulunduğunu denetler).
-- Yalnızca onayla. Tek işlem. Veri değiştirilmez, ama:
--   • B (media_privileges) uygulanmışsa DURUR: önce media_privileges/05_rollback.sql (B HER ZAMAN A'dan önce geri alınır).
--   • media_file_queue'da satır varsa DURUR: kuyruk silinmemiş dosyaları tutar; önce boşaltın (cron media_queue_claim/done)
--     ya da satırları dışa aktarın, sonra yeniden deneyin. Boş kuyruk tablosu silinir.
--   • Uygulama yeni kodda RPC yoksa yedek yola düşer (PGRST202); eski kod etkilenmez.
--   Supabase SQL Editor: dosyanın tamamı tek sorgu · psql: psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f 05_rollback.sql
-- lock_timeout 3 sn: tablo kilidi alınamazsa 55P03 ile vazgeçer, hiçbir şey değişmez; sakin anda yeniden deneyin.
-- Sonra: 01_preflight.sql yeniden çalıştırılır; 6. ve 9. satırlar uygulama öncesi (02) çıktıyla aynı olmalı.
-- =============================================================================
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

do $koruma$
begin
  if exists (select 1 from pg_trigger where tgname = 'media_assets_pending_shape' and not tgisinternal
               and tgrelid = to_regclass('public.media_assets')) then
    raise exception 'DUR: B (media_assets_pending_shape) uygulanmış — önce media_privileges/05_rollback.sql';
  end if;
end
$koruma$;

-- Önce silme tetikleyicisi düşer (yeni silmeler artık kuyruğa girmez), SONRA kuyruk sayılır: satır varsa işlem geri alınır
drop trigger if exists media_assets_enqueue_files on public.media_assets;

do $kuyruk$
declare kalan bigint;
begin
  if to_regclass('public.media_file_queue') is not null then
    execute 'select count(*) from public.media_file_queue' into kalan;
    if kalan > 0 then
      raise exception 'DUR: media_file_queue''da % satır var — önce boşaltın ya da dışa aktarın (silinmemiş dosyalar kaybolur); işlem geri alınıyor', kalan;
    end if;
  end if;
end
$kuyruk$;

drop function if exists public.media_finalize(uuid, text, text, smallint[], integer, integer, text);
drop function if exists public.media_mark_failed(uuid, text);
drop function if exists public.media_queue_claim(integer);
drop function if exists public.media_queue_done(bigint[]);
drop function if exists public.media_storage_report(uuid);
drop function if exists public.media_assets_enqueue_files();
drop table if exists public.media_file_queue;
notify pgrst, 'reload schema';

-- Aynı işlemde kontrol: kalıntı varsa geri alınır
do $kontrol$
declare kalan int;
begin
  select count(*) into kalan from pg_proc where pronamespace = 'public'::regnamespace
     and proname in ('media_finalize', 'media_mark_failed', 'media_queue_claim', 'media_queue_done', 'media_storage_report', 'media_assets_enqueue_files');
  if kalan <> 0 or to_regclass('public.media_file_queue') is not null
     or exists (select 1 from pg_trigger where tgname = 'media_assets_enqueue_files' and not tgisinternal) then
    raise exception 'KONTROL: A nesneleri kaldı; işlem geri alınıyor';
  end if;
end
$kontrol$;

commit;
