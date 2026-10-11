-- =============================================================================
-- TABLO SATIR SAYILARI (salt okunur) — FAZ 3
--
-- Yedekle AYNI anlık görüntüde üretilir (scripts/backup-db.sh) ve dump'la birlikte
-- db-TARIH.tables.txt olarak saklanır. Geri yükleme tatbikatı (scripts/restore-drill.sh) aynı
-- sorguyu geri yüklenen veritabanında çalıştırıp yedekteki her tabloyu satır satır karşılaştırır.
--
-- Her satır: şema.tablo | satır sayısı. Yalnızca sayım yapar; kişisel veri okumaz.
-- Okuma yetkisi olmayan tablo listelenmez (sorgu hata vermez). Sıralama sunucu dilinden
-- bağımsızdır (collate "C"): farklı sunucuya geri yüklemede de çıktı birebir karşılaştırılabilir.
-- =============================================================================
select format('%I.%I', n.nspname, c.relname) || ' | ' ||
       (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', n.nspname, c.relname), false, true, '')))[1]::text
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where c.relkind in ('r', 'p')
   and n.nspname in ('public', 'auth', 'storage')
   and has_table_privilege(c.oid, 'select')
 order by n.nspname collate "C", c.relname collate "C";
