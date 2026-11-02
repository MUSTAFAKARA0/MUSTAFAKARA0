-- =============================================================================
-- Ekleme kilidi — 3/5 UYGULAMA: supabase/pending/20261025000001_quota_lock.sql (tek işlem)
--
-- ÖN KOŞUL (hepsi): 01 çıktısında DUR yok · 02 çıktısı saklandı · tam yedek alındı ve doğrulandı ·
-- bu adım için yazılı O-5 onayı var. SIRA: bu betik, ops02_limits/03_apply.sql'den ÖNCE uygulanır.
--   Supabase SQL Editor: dosyanın TAMAMI tek sorgu olarak (metin seçili değilken) Run.
--   psql: psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f 03_apply.sql
--
-- Davranış:
--   • Tek işlem (begin … commit). Herhangi bir adım hata verirse HİÇBİR değişiklik kalmaz.
--   • lock_timeout 3 sn, statement_timeout 30 sn. DROP TRIGGER / CREATE TRIGGER properties ve
--     organization_members üzerinde güçlü tablo kilidi ister (ACCESS EXCLUSIVE / SHARE ROW EXCLUSIVE):
--     uzun bir işlem varsa 3 sn sonra 55P03 (lock_not_available) ile vazgeçer, site etkilenmez.
--     55P03'te hiçbir şey değişmemiştir: 01'i yeniden çalıştırın, sakin bir anda 03'ü TEKRAR deneyin.
--   • Koruma: şema sürümü en az 20261018000001 olmalı; tablolar yoksa durur. Bu betik
--     karay_schema_version() değerini DEĞİŞTİRMEZ (bekleyen dosya sürüm işaretlemez).
--   • Gövde supabase/pending/20261025000001_quota_lock.sql ile birebir aynıdır (birim testi LR-14 denetler).
--   • Tekrar çalıştırılabilir (create or replace / drop … if exists). Veri değiştirmez.
--   • Sondaki kontrol aynı işlemde çalışır: beklenen sonuç yoksa işlem geri alınır.
-- =============================================================================
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

do $koruma$
declare surum text;
begin
  if to_regprocedure('public.karay_schema_version()') is null then
    raise exception 'DUR: karay_schema_version() yok (önceki migration''lar eksik)';
  end if;
  execute 'select public.karay_schema_version()' into surum;
  if surum is null or surum < '20261018000001' then
    raise exception 'DUR: şema sürümü % — en az 20261018000001 gerekir; önce PRODUCTION_MIGRATION.md sırasıyla eksik migration''lar', surum;
  end if;
  if to_regclass('public.properties') is null or to_regclass('public.organization_members') is null then
    raise exception 'DUR: public.properties ya da public.organization_members yok';
  end if;
end
$koruma$;

-- ---- 20261025000001_quota_lock.sql (gövde, değiştirilmeden) ------------------
create or replace function public.quota_lock()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('karay.quota:' || tg_table_name || ':' || new.organization_id::text, 0));
  return new;
end;
$$;
revoke all on function public.quota_lock() from public, anon, authenticated;

drop trigger if exists aa_quota_lock on public.properties;
create trigger aa_quota_lock
  before insert on public.properties
  for each row execute function public.quota_lock();

drop trigger if exists aa_quota_lock on public.organization_members;
create trigger aa_quota_lock
  before insert or update of status on public.organization_members
  for each row execute function public.quota_lock();
-- ---- gövde sonu --------------------------------------------------------------

-- Aynı işlem içinde kontrol: beklenen sonuç yoksa hata → commit yerine geri alma
do $kontrol$
declare ilan int; uyelik int; yetkili int; surum text;
begin
  select count(*) into ilan from pg_trigger
   where tgname = 'aa_quota_lock' and not tgisinternal and tgrelid = to_regclass('public.properties');
  select count(*) into uyelik from pg_trigger
   where tgname = 'aa_quota_lock' and not tgisinternal and tgrelid = to_regclass('public.organization_members');
  if ilan <> 1 or uyelik <> 1 then
    raise exception 'KONTROL: aa_quota_lock sayısı properties=% organization_members=% (beklenen 1/1); işlem geri alınıyor', ilan, uyelik;
  end if;
  select count(*) into yetkili
    from pg_proc p
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    left join pg_roles r on r.oid = a.grantee
   where p.oid = to_regprocedure('public.quota_lock()') and a.privilege_type = 'EXECUTE'
     and (a.grantee = 0 or r.rolname in ('anon', 'authenticated'));
  if yetkili <> 0 then
    raise exception 'KONTROL: quota_lock() anon/authenticated/PUBLIC için yürütülebilir; işlem geri alınıyor';
  end if;
  execute 'select public.karay_schema_version()' into surum;
  if surum < '20261018000001' then
    raise exception 'KONTROL: şema sürümü % değişmiş görünüyor; işlem geri alınıyor', surum;
  end if;
end
$kontrol$;

commit;

-- Sonuç (yalnızca okur; SQL Editor bu tabloyu gösterir). Tam kontrol: 04_postflight.sql
select 'aa_quota_lock tetikleyici sayısı' as alan,
       (select count(*)::text from pg_trigger where tgname = 'aa_quota_lock' and not tgisinternal) as deger;
