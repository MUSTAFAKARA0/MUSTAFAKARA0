-- =============================================================================
-- Medya kota kilidi — 3/5 UYGULAMA: supabase/pending/20261026000001_media_quota_lock.sql (tek işlem)
--
-- ÖN KOŞUL (hepsi): 01 çıktısında DUR yok · 02 çıktısı saklandı · tam yedek alındı ve doğrulandı ·
-- bu adım için yazılı O-5 onayı var · 01'in 8. satırındaki (kotayı aşmış kurum sayısı) müşteri etkisi değerlendirildi.
-- SIRA: bu betik quota_lock/03_apply.sql'den SONRA uygulanır; company_name'den bağımsızdır.
--   Supabase SQL Editor: dosyanın TAMAMI tek sorgu olarak (metin seçili değilken) Run.
--   psql: psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f 03_apply.sql
--
-- Davranış:
--   • Tek işlem (begin … commit). Herhangi bir adım hata verirse HİÇBİR değişiklik kalmaz.
--   • lock_timeout 3 sn, statement_timeout 30 sn. DROP/CREATE TRIGGER media_assets üzerinde güçlü tablo
--     kilidi ister: uzun bir işlem varsa 3 sn sonra 55P03 (lock_not_available) ile vazgeçer, site etkilenmez.
--     55P03'te hiçbir şey değişmemiştir: 01'i yeniden çalıştırın, sakin bir anda 03'ü TEKRAR deneyin.
--   • Koruma: şema sürümü en az 20261018000001; aa_quota_lock (quota_lock) kurulu; media_assets_org var.
--     Bu betik karay_schema_version() değerini DEĞİŞTİRMEZ.
--   • Gövde supabase/pending/20261026000001_media_quota_lock.sql ile birebir aynıdır (birim testi LR-14 denetler).
--   • Tekrar çalıştırılabilir (create or replace / drop … if exists). Veri değiştirmez; mevcut satırlar denetlenmez.
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
  if to_regclass('public.media_assets') is null or to_regprocedure('public.org_plan(uuid)') is null
     or to_regprocedure('public.user_org_ids(text)') is null or to_regprocedure('public.is_super_admin()') is null then
    raise exception 'DUR: public.media_assets ya da org_plan / user_org_ids / is_super_admin yok';
  end if;
  if (select count(*) from pg_trigger where tgname = 'aa_quota_lock' and not tgisinternal
        and tgrelid in (to_regclass('public.properties'), to_regclass('public.organization_members'))) <> 2 then
    raise exception 'DUR: aa_quota_lock eksik — önce quota_lock/03_apply.sql uygulanmalı (K-19 sırası)';
  end if;
  if (select count(*) from pg_trigger where tgname = 'media_assets_org' and not tgisinternal
        and tgrelid = to_regclass('public.media_assets')) <> 1 then
    raise exception 'DUR: media_assets_org tetikleyicisi yok (organization_id doldurulmuyor)';
  end if;
end
$koruma$;

-- ---- 20261026000001_media_quota_lock (gövde, değiştirilmeden) ----------------
create or replace function public.media_quota_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer;
begin
  -- Yetkisiz çağıran: kilit almadan dön, RLS WITH CHECK satırı reddetsin (kota durumu sızmasın)
  if (select auth.role()) in ('anon', 'authenticated')
     and not coalesce(new.organization_id in (select public.user_org_ids('media.manage')), false)
     and not (select public.is_super_admin()) then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('karay.quota:media_assets:' || new.organization_id::text, 0));
  select max_storage_mb into v_limit from public.org_plan(new.organization_id);
  if v_limit is null then
    return new;
  end if;
  if (
    select coalesce(sum(coalesce(byte_size, 0) + variants_byte_size), 0)
      from public.media_assets where organization_id = new.organization_id
  ) + (coalesce(new.byte_size, 0) * 1.35)::bigint > v_limit::bigint * 1024 * 1024 then
    raise exception 'plan_limit_storage' using errcode = 'P0001',
      hint = 'Depolama alanı kotanız doldu.';
  end if;
  return new;
end;
$$;
revoke all on function public.media_quota_check() from public, anon, authenticated, service_role;

drop trigger if exists media_assets_quota on public.media_assets;
create trigger media_assets_quota
  before insert on public.media_assets
  for each row execute function public.media_quota_check();
-- ---- gövde sonu --------------------------------------------------------------

-- Aynı işlem içinde kontrol: beklenen sonuç yoksa hata → commit yerine geri alma
do $kontrol$
declare adet int; sirali int; yetkili int; tanim int; surum text;
begin
  select count(*) into adet from pg_trigger
   where tgname = 'media_assets_quota' and not tgisinternal and tgrelid = to_regclass('public.media_assets');
  if adet <> 1 then
    raise exception 'KONTROL: media_assets_quota sayısı % (beklenen 1); işlem geri alınıyor', adet;
  end if;
  -- BEFORE tetikleyicileri ada göre çalışır: media_assets_org'dan SONRA olmalı
  select count(*) into sirali from pg_trigger o, pg_trigger q
   where o.tgrelid = to_regclass('public.media_assets') and o.tgname = 'media_assets_org' and not o.tgisinternal
     and q.tgrelid = o.tgrelid and q.tgname = 'media_assets_quota' and not q.tgisinternal
     and q.tgname::text collate "C" > o.tgname::text collate "C";
  if sirali <> 1 then
    raise exception 'KONTROL: media_assets_quota, media_assets_org''dan sonra sıralanmıyor; işlem geri alınıyor';
  end if;
  select count(*) into tanim from pg_proc p
   where p.oid = to_regprocedure('public.media_quota_check()') and p.prosecdef
     and p.proconfig @> array['search_path=""'];
  if tanim <> 1 then
    raise exception 'KONTROL: media_quota_check() security definer ve boş search_path değil; işlem geri alınıyor';
  end if;
  select count(*) into yetkili
    from pg_proc p
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    left join pg_roles r on r.oid = a.grantee
   where p.oid = to_regprocedure('public.media_quota_check()') and a.privilege_type = 'EXECUTE'
     and (a.grantee = 0 or r.rolname in ('anon', 'authenticated', 'service_role'));
  if yetkili <> 0 then
    raise exception 'KONTROL: media_quota_check() anon/authenticated/service_role/PUBLIC için yürütülebilir; işlem geri alınıyor';
  end if;
  execute 'select public.karay_schema_version()' into surum;
  if surum < '20261018000001' then
    raise exception 'KONTROL: şema sürümü % değişmiş görünüyor; işlem geri alınıyor', surum;
  end if;
end
$kontrol$;

commit;

-- Sonuç (yalnızca okur; SQL Editor bu tabloyu gösterir). Tam kontrol: 04_postflight.sql
select 'media_assets_quota tetikleyici sayısı' as alan,
       (select count(*)::text from pg_trigger where tgname = 'media_assets_quota' and not tgisinternal) as deger;
