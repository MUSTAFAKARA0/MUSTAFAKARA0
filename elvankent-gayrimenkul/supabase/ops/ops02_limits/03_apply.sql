-- =============================================================================
-- OPS-02 — 3/5 UYGULAMA: supabase/pending/20261025000002_ops02_subscription_limits.sql (tek işlem)
--
-- ÖN KOŞUL (hepsi): ../quota_lock/03_apply.sql UYGULANMIŞ (aksi hâlde bu betik DUR der) · 01 çıktısında
-- DUR yok · 02 çıktısı saklandı · tam yedek alındı ve doğrulandı · bu adım için yazılı O-5 onayı var.
--   Supabase SQL Editor: dosyanın TAMAMI tek sorgu olarak (metin seçili değilken) Run.
--   psql: psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f 03_apply.sql
--
-- BU BETİK BAYRAĞI AÇMAZ: platform_settings.enforce_subscription_limits varsayılan false kalır ve
-- org_plan() bayrak KAPALIYKEN eski çıktısını birebir verir. Bayrağın açılması ayrı bir karardır (D-04/D-05).
--
-- Davranış:
--   • Tek işlem (begin … commit). Herhangi bir adım hata verirse HİÇBİR değişiklik kalmaz.
--   • lock_timeout 3 sn, statement_timeout 30 sn. ALTER TABLE platform_settings kısa süreli ACCESS EXCLUSIVE
--     kilit ister: uzun bir işlem varsa 3 sn sonra 55P03 (lock_not_available) ile vazgeçer, site etkilenmez.
--     55P03'te hiçbir şey değişmemiştir: 01'i yeniden çalıştırın, sakin bir anda 03'ü TEKRAR deneyin.
--   • Koruma: şema sürümü en az 20261018000001; nesneler (platform_settings, subscriptions, plans,
--     organizations, org_plan) var; aa_quota_lock iki tabloda da kurulu. Bu betik karay_schema_version()
--     değerini DEĞİŞTİRMEZ (bekleyen dosya sürüm işaretlemez; migrations/'a taşınırken güncellenir).
--   • Gövde supabase/pending/20261025000002_ops02_subscription_limits.sql ile birebir aynıdır
--     (birim testi LR-14 denetler). Tekrar çalıştırılabilir. Veri değiştirmez.
--   • Sondaki kontrol aynı işlemde çalışır: beklenen sonuç yoksa işlem geri alınır.
-- =============================================================================
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

do $koruma$
declare surum text; ilan int; uyelik int;
begin
  if to_regprocedure('public.karay_schema_version()') is null then
    raise exception 'DUR: karay_schema_version() yok (önceki migration''lar eksik)';
  end if;
  execute 'select public.karay_schema_version()' into surum;
  if surum is null or surum < '20261018000001' then
    raise exception 'DUR: şema sürümü % — en az 20261018000001 gerekir; önce PRODUCTION_MIGRATION.md sırasıyla eksik migration''lar', surum;
  end if;
  if to_regclass('public.platform_settings') is null or to_regclass('public.subscriptions') is null
     or to_regclass('public.plans') is null or to_regclass('public.organizations') is null
     or to_regprocedure('public.org_plan(uuid)') is null then
    raise exception 'DUR: platform_settings / subscriptions / plans / organizations / org_plan nesnelerinden biri yok';
  end if;
  select count(*) into ilan from pg_trigger
   where tgname = 'aa_quota_lock' and not tgisinternal and tgrelid = to_regclass('public.properties');
  select count(*) into uyelik from pg_trigger
   where tgname = 'aa_quota_lock' and not tgisinternal and tgrelid = to_regclass('public.organization_members');
  if ilan <> 1 or uyelik <> 1 then
    raise exception 'DUR: aa_quota_lock eksik (properties=%, organization_members=%) — önce ../quota_lock/03_apply.sql uygulanmalı', ilan, uyelik;
  end if;
end
$koruma$;

-- ---- 20261025000002_ops02_subscription_limits.sql (gövde, değiştirilmeden) ---
alter table public.platform_settings
  add column if not exists enforce_subscription_limits boolean not null default false;

comment on column public.platform_settings.enforce_subscription_limits is
  'OPS-02: true ise etkin aboneliği olmayan organizasyonda yeni ilan, kullanıcı ve yükleme reddedilir (limitler 0).';

create or replace function public.org_plan(p_org uuid)
returns table (
  plan_id text,
  subscription_status public.subscription_status,
  max_users integer,
  max_properties integer,
  max_storage_mb integer,
  crm_enabled boolean,
  analytics_enabled boolean,
  pdf_enabled boolean,
  custom_domain_enabled boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  (select p.id, s.status, p.max_users, p.max_properties, p.max_storage_mb,
          coalesce((f.feature_overrides->>'crm')::boolean, p.crm_enabled),
          coalesce((f.feature_overrides->>'analytics')::boolean, p.analytics_enabled),
          coalesce((f.feature_overrides->>'pdf')::boolean, p.pdf_enabled),
          coalesce((f.feature_overrides->>'custom_domain')::boolean, p.custom_domain_enabled)
     from public.subscriptions s
     join public.plans p on p.id = s.plan_id
     left join public.site_configs f on f.organization_id = s.organization_id
    where s.organization_id = p_org
      and s.status in ('trialing', 'active', 'past_due')
    limit 1)
  union all
  -- Son aboneliğin durumu (iptal/süresi doldu) yalnızca kurumun üyesine ve süper admine gösterilir;
  -- anonim ziyaretçi ve başka kiracı null görür (limitler yine 0). Etkin abonelik satırı (ilk kol)
  -- önceden olduğu gibi herkese açıktır; site özellik bayrakları anonim istekle okunur.
  select null::text,
         case when public.is_super_admin() or exists (select 1 from public.user_org_ids() x(id) where x.id = p_org)
              then (select s.status from public.subscriptions s
                     where s.organization_id = p_org
                     order by s.created_at desc limit 1)
         end,
         0, 0, 0, false, false, false, false
   where coalesce((select ps.enforce_subscription_limits from public.platform_settings ps where ps.id), false)
     and not exists (
       select 1 from public.subscriptions s
        where s.organization_id = p_org and s.status in ('trialing', 'active', 'past_due'));
$$;
-- ---- gövde sonu --------------------------------------------------------------

-- Aynı işlem içinde kontrol: beklenen sonuç yoksa hata → commit yerine geri alma
do $kontrol$
declare varsayilan text; bos text; acik int; ozet text; surum text;
begin
  select column_default, is_nullable into varsayilan, bos from information_schema.columns
   where table_schema = 'public' and table_name = 'platform_settings' and column_name = 'enforce_subscription_limits';
  if varsayilan is distinct from 'false' or bos is distinct from 'NO' then
    raise exception 'KONTROL: enforce_subscription_limits varsayılan=% null olabilir=% (beklenen false / NO); işlem geri alınıyor', varsayilan, bos;
  end if;
  execute 'select count(*) from public.platform_settings where enforce_subscription_limits' into acik;
  if acik <> 0 then
    raise exception 'KONTROL: bayrak AÇIK görünüyor; OPS-02 bu betikle açılmaz; işlem geri alınıyor';
  end if;
  select md5(btrim(regexp_replace(prosrc, '\s+', ' ', 'g'))) into ozet from pg_proc where oid = to_regprocedure('public.org_plan(uuid)');
  if ozet is distinct from '2c003a00cf1dcb95257ba9addf5e994f' then
    raise exception 'KONTROL: org_plan gövde özeti % (beklenen bekleyen dosyadaki tanım); işlem geri alınıyor', ozet;
  end if;
  execute 'select public.karay_schema_version()' into surum;
  if surum < '20261018000001' then
    raise exception 'KONTROL: şema sürümü % değişmiş görünüyor; işlem geri alınıyor', surum;
  end if;
end
$kontrol$;

commit;

-- Sonuç (yalnızca okur; SQL Editor bu tabloyu gösterir). Tam kontrol: 04_postflight.sql
select 'enforce_subscription_limits varsayılanı' as alan,
       (select column_default from information_schema.columns
         where table_schema = 'public' and table_name = 'platform_settings' and column_name = 'enforce_subscription_limits') as deger;
