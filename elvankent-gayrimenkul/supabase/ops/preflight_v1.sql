-- =============================================================================
-- CANLI GEÇİŞ ÖNCESİ KONTROL (salt okunur — hiçbir veriyi değiştirmez)
--
-- Supabase SQL Editor'de çalıştırın ve sonucu SAKLAYIN (ekran görüntüsü / CSV).
-- Migration sonrasında postflight_v2.sql aynı sayıları tekrar gösterir;
-- ikisini karşılaştırarak veri kaybı olmadığını doğrularsınız.
-- "durum" sütununda HATA varsa geçişe BAŞLAMAYIN.
-- =============================================================================
with checks as (
  select 1 as sira, 'PostgreSQL sürümü' as kontrol, current_setting('server_version') as deger,
         case when current_setting('server_version_num')::int >= 150000 then 'TAMAM' else 'HATA: 15+ gerekli' end as durum
  union all
  select 2, 'V1 tabloları mevcut (properties, property_images, contact_requests, site_settings)',
         (select count(*)::text from information_schema.tables where table_schema = 'public'
            and table_name in ('properties', 'property_images', 'contact_requests', 'site_settings')) || ' / 4',
         case when (select count(*) from information_schema.tables where table_schema = 'public'
            and table_name in ('properties', 'property_images', 'contact_requests', 'site_settings')) = 4 then 'TAMAM' else 'HATA: V1 şeması beklenen durumda değil' end
  union all
  select 3, 'V2 henüz uygulanmamış (organizations tablosu yok)',
         case when to_regclass('public.organizations') is null then 'yok' else 'VAR' end,
         case when to_regclass('public.organizations') is null then 'TAMAM' else 'DİKKAT: V2 zaten uygulanmış olabilir — yalnızca eksik Stage 3 dosyalarını uygulayın' end
  union all
  select 5, 'İlan sayısı (toplam / demo / demo olmayan)',
         (select count(*) || ' / ' || count(*) filter (where is_demo) || ' / ' || count(*) filter (where not is_demo) from public.properties),
         'KAYDEDİN'
  union all
  select 6, 'İlan fotoğrafı (property_images)', (select count(*)::text from public.property_images), 'KAYDEDİN'
  union all
  select 7, 'İletişim talebi (contact_requests)', (select count(*)::text from public.contact_requests), 'KAYDEDİN'
  union all
  select 8, 'Yönlendirme (redirects)', (select count(*)::text from public.redirects), 'KAYDEDİN'
  union all
  select 9, 'Auth kullanıcı sayısı', (select count(*)::text from auth.users), 'KAYDEDİN'
  union all
  select 10, 'Yönetici (profiles.role = admin)', (select count(*)::text from public.profiles where role::text = 'admin'),
         case when (select count(*) from public.profiles where role::text = 'admin') > 0 then 'TAMAM' else 'DİKKAT: yönetici yok; geçişten sonra create-admin gerekir' end
  union all
  select 11, 'Depolama nesneleri (kova: adet)',
         coalesce((select string_agg(bucket_id || ': ' || n, ', ') from (select bucket_id, count(*) n from storage.objects group by 1) x), '0'),
         'KAYDEDİN'
  union all
  select 12, 'Aynı slug ile birden fazla ilan', (select count(*)::text from (select slug from public.properties group by slug having count(*) > 1) d),
         case when (select count(*) from (select slug from public.properties group by slug having count(*) > 1) d) = 0 then 'TAMAM' else 'HATA: tekrar eden slug' end
  union all
  select 13, 'Veritabanı boyutu', pg_size_pretty(pg_database_size(current_database())), 'BİLGİ'
)
select sira, kontrol, deger, durum from checks order by sira;
