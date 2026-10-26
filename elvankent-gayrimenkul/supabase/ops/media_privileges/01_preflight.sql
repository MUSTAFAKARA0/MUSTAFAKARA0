-- =============================================================================
-- Medya sütun yetkileri (supabase/pending/20261027000002_media_column_privileges.sql, WP-A2/B) — 1/5 ÖN KONTROL (KAPI)
--
-- YALNIZCA OKUR: tek bir SELECT; hiçbir tabloya, fonksiyona veya ayara yazmaz.
--   Supabase › SQL Editor › New query › yapıştır › Run
--   psql: PGOPTIONS='-c default_transaction_read_only=on' psql "$DB_URL" -X -f 01_preflight.sql
--
-- Çıktının TAMAMINI saklayın (metin olarak). "durum" sütununda DUR varsa 03 UYGULANMAZ.
-- Bu betik B'nin kapısıdır: A uygulanmamışsa DUR. Yeni kodun production'da olduğu ve canlıda bir yükleme + döndürme
-- denemesinin başarılı olduğu BU BETİKLE denetlenemez; README'deki elle kayıt şarttır.
-- Çıktıda kurum adı, kimlik ya da kişi verisi yoktur; yalnızca sayı ve nesne durumu.
-- =============================================================================
with
v as (
  select case when to_regprocedure('public.karay_schema_version()') is null then null
              else (select x.n from xmltable('/table/row' passing query_to_xml('select public.karay_schema_version() as n', false, false, '') columns n text path 'n') x limit 1)
         end as surum
),
o as (
  select p.proowner as sahip_oid
    from pg_proc p where p.oid = to_regprocedure('public.media_finalize(uuid,text,text,smallint[],integer,integer,text)')
)
select sira, kontrol, deger, durum from (
  select 1 as sira, 'Ortam işareti' as kontrol,
         case when to_regclass('elvankent_demo.environment') is not null then 'DEMO veritabanı (elvankent_demo işareti var)'
              else 'demo işareti yok' end as deger,
         'BİLGİ: uygulamanın kullandığı proje bu mu? Vercel''deki NEXT_PUBLIC_SUPABASE_URL ile panelden karşılaştırın' as durum
  union all
  select 2, 'Sunucu / rol', current_database() || ' · PostgreSQL ' || current_setting('server_version') || ' · rol ' || current_user, 'BİLGİ'
  union all
  select 3, 'Şema sürümü — karay_schema_version()  [KAYDET]', coalesce((select surum from v), 'fonksiyon yok'),
         case when (select surum from v) is null then 'DUR: fonksiyon yok — önceki migration''lar eksik (PRODUCTION_MIGRATION.md)'
              when (select surum from v) < '20261018000001' then 'DUR: şema eski — önce 20261018000001''e kadar migration''lar'
              when (select surum from v) = '20261018000001' then 'TAMAM (beklenen sürüm; bu betik sürümü DEĞİŞTİRMEZ)'
              else 'BİLGİ: şema daha yeni; bu betik sürümü değiştirmez' end
  union all
  select 4, 'A uygulanmış mı — media_finalize / media_mark_failed',
         (to_regprocedure('public.media_finalize(uuid,text,text,smallint[],integer,integer,text)') is not null)::text || ' / '
           || (to_regprocedure('public.media_mark_failed(uuid,text)') is not null)::text,
         case when to_regprocedure('public.media_finalize(uuid,text,text,smallint[],integer,integer,text)') is not null
                and to_regprocedure('public.media_mark_failed(uuid,text)') is not null
              then 'TAMAM' else 'DUR: apply A first — media_finalize_rpc/03_apply.sql uygulanmamış' end
  union all
  select 5, 'Depolama erişimi: media_finalize sahibi — storage.objects SELECT / rolbypassrls  [KAYDET]',
         coalesce((select r.rolname || ' · select ' || has_table_privilege(r.oid, 'storage.objects', 'select')::text || ' · rolbypassrls ' || r.rolbypassrls::text
                     from o join pg_roles r on r.oid = o.sahip_oid), 'media_finalize yok'),
         case when exists (select 1 from o join pg_roles r on r.oid = o.sahip_oid
                            where has_table_privilege(r.oid, 'storage.objects', 'select') and r.rolbypassrls)
              then 'TAMAM (README: B''den önce gerçek ortamda yükleme + sonlandırma denemesi şart)'
              else 'DUR: sahip storage.objects okuyamaz ya da RLS atlamaz; her sonlandırma media_not_uploaded olur' end
  union all
  select 6, 'B uygulanmış mı — media_assets_pending_shape  [KAYDET]',
         (select count(*)::text from pg_trigger where tgname = 'media_assets_pending_shape' and not tgisinternal and tgrelid = to_regclass('public.media_assets')),
         case when (select count(*) from pg_trigger where tgname = 'media_assets_pending_shape' and not tgisinternal and tgrelid = to_regclass('public.media_assets')) = 0
              then 'TAMAM (henüz yok)'
              when (select count(*) from pg_trigger where tgname = 'media_assets_pending_shape' and not tgisinternal and tgrelid = to_regclass('public.media_assets')) = 1
              then 'BİLGİ: zaten var; 03 yeniden kurar (zararsız)'
              else 'DUR: beklenmeyen sayı' end
  union all
  select 7, 'authenticated tablo yetkileri — update / insert / truncate / references / trigger / delete  [KAYDET]',
         has_table_privilege('authenticated', 'public.media_assets', 'update')::text || ' / ' || has_table_privilege('authenticated', 'public.media_assets', 'insert')::text
           || ' / ' || has_table_privilege('authenticated', 'public.media_assets', 'truncate')::text || ' / ' || has_table_privilege('authenticated', 'public.media_assets', 'references')::text
           || ' / ' || has_table_privilege('authenticated', 'public.media_assets', 'trigger')::text || ' / ' || has_table_privilege('authenticated', 'public.media_assets', 'delete')::text,
         'BİLGİ: B öncesi beklenen t / t / t / t / t / t; 05 sonrası aynı olmalı'
  union all
  select 8, 'authenticated status sütununu güncelleyebilir mi (eski kod bunu yapar)  [KAYDET]',
         has_column_privilege('authenticated', 'public.media_assets', 'status', 'update')::text,
         case when has_column_privilege('authenticated', 'public.media_assets', 'status', 'update')
              then 'BİLGİ: B öncesi beklenen durum; uygulamadan sonra 04 bunu kapalı bulur'
              else 'BİLGİ: B zaten uygulanmış' end
  union all
  select 9, 'Bekleyen (pending) satır sayısı (yalnızca sayı)  [KAYDET]',
         coalesce((select x.n from xmltable('/table/row' passing query_to_xml('select count(*) as n from public.media_assets where status = ''pending''', false, false, '') columns n text path 'n') x limit 1), 'yok'),
         'BİLGİ: B sonrası yeni bekleyen satırlar kurum başına en çok 50 ile sınırlanır'
  union all
  select 10, '1 dakikadan uzun açık işlem',
         (select count(*)::text from pg_stat_activity where xact_start < now() - interval '1 minute' and pid <> pg_backend_pid()),
         case when (select count(*) from pg_stat_activity where xact_start < now() - interval '1 minute' and pid <> pg_backend_pid()) = 0
              then 'TAMAM' else 'DUR: uzun işlem tablo kilidini (55P03) bekletir; bitmesini bekleyin' end
  union all
  select 11, 'Verilmemiş (bekleyen) kilit sayısı',
         (select count(*)::text from pg_locks where not granted),
         case when (select count(*) from pg_locks where not granted) = 0
              then 'TAMAM' else 'DUR: kilit kuyruğu var; sakinleşince yeniden çalıştırın' end
  union all
  select 12, 'Kurum önekinin (organizations/<kurum>/) dışında ya da ".." içeren yol taşıyan satır sayısı (demo ve boş değerler hariç; yalnızca sayı)  [KAYDET]',
         (select count(*) from public.media_assets m
            where (m.original_path is not null and (not starts_with(m.original_path, 'organizations/' || m.organization_id::text || '/') or position('..' in m.original_path) > 0))
               or (m.public_base is not null and left(m.public_base, 1) <> '/' and (not starts_with(m.public_base, 'organizations/' || m.organization_id::text || '/') or position('..' in m.public_base) > 0)))::text,
         case when (select count(*) from public.media_assets m
            where (m.original_path is not null and (not starts_with(m.original_path, 'organizations/' || m.organization_id::text || '/') or position('..' in m.original_path) > 0))
               or (m.public_base is not null and left(m.public_base, 1) <> '/' and (not starts_with(m.public_base, 'organizations/' || m.organization_id::text || '/') or position('..' in m.public_base) > 0)))::int = 0 then 'TAMAM' else 'DUR: kurum önekinin dışında yol taşıyan satır var — B''den ÖNCE temizlenmeli (başka kurumun dosyalarını kuyruğa aldırabilir)' end
) kontroller
order by sira;
