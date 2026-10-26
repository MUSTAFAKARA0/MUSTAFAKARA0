-- =============================================================================
-- OPS-02 — 5/5 GERİ DÖNÜŞ (20261025000002_ops02_subscription_limits.sql'i geri alır)
--
-- Kaynak: supabase/pending/20261025000002_ops02_subscription_limits.sql, "GERİ DÖNÜŞ" başlığı (birim testi
-- LR-14 her ifadenin burada bulunduğunu denetler):
--   1) org_plan(): org_plan'ı SON tanımlayan migration olan 20260930000002_site_builder.sql'deki tanım
--      (aşağıda, değiştirilmeden) yeniden uygulanır. Yetkiler korunur (create or replace).
--   2) platform_settings.enforce_subscription_limits sütunu silinir. Önce org_plan geri kurulur, sonra sütun
--      silinir (org_plan sütuna bağımlı kalmaz).
-- Yalnızca onayla. Tek işlem: koruma veya kontrol hata verirse hiçbir şey değişmez. Sütundaki bayrak
-- değeri kaybolur; 02 çıktısına bakın. SIRA: quota_lock de geri alınacaksa BU betik önce, ../quota_lock/05 sonra.
--   Supabase SQL Editor: dosyanın tamamı tek sorgu · psql: psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f 05_rollback.sql
-- lock_timeout 3 sn: ALTER TABLE kilidi alınamazsa 55P03 ile vazgeçer, hiçbir şey değişmez; sakin anda yeniden deneyin.
-- Sonra: 01_preflight.sql yeniden çalıştırılır; 5 ve 6. satırlar uygulama öncesi (02) çıktıyla aynı olmalı;
-- 02'nin 2. satırındaki org_plan özeti (md5) uygulama öncesiyle AYNI olmalı.
-- =============================================================================
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

do $koruma$
begin
  if to_regprocedure('public.org_plan(uuid)') is null or to_regclass('public.platform_settings') is null then
    raise exception 'DUR: org_plan(uuid) ya da platform_settings yok; geri dönüş yapılmadı';
  end if;
end
$koruma$;

-- ---- 20260930000002_site_builder.sql: org_plan() (değiştirilmeden) ----------
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
  select p.id, s.status, p.max_users, p.max_properties, p.max_storage_mb,
         coalesce((f.feature_overrides->>'crm')::boolean, p.crm_enabled),
         coalesce((f.feature_overrides->>'analytics')::boolean, p.analytics_enabled),
         coalesce((f.feature_overrides->>'pdf')::boolean, p.pdf_enabled),
         coalesce((f.feature_overrides->>'custom_domain')::boolean, p.custom_domain_enabled)
    from public.subscriptions s
    join public.plans p on p.id = s.plan_id
    left join public.site_configs f on f.organization_id = s.organization_id
   where s.organization_id = p_org
     and s.status in ('trialing', 'active', 'past_due')
   limit 1;
$$;
-- ---- tanım sonu --------------------------------------------------------------

alter table public.platform_settings drop column if exists enforce_subscription_limits;

-- Aynı işlemde kontrol: kalıntı varsa geri alınır
do $kontrol$
declare ozet text;
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'platform_settings' and column_name = 'enforce_subscription_limits') then
    raise exception 'KONTROL: enforce_subscription_limits sütunu kaldı; işlem geri alınıyor';
  end if;
  select md5(btrim(regexp_replace(prosrc, '\s+', ' ', 'g'))) into ozet from pg_proc where oid = to_regprocedure('public.org_plan(uuid)');
  if ozet is distinct from '24301050df95ea652abced0a0697d4f8' then
    raise exception 'KONTROL: org_plan gövde özeti % (beklenen 20260930000002_site_builder.sql tanımı); işlem geri alınıyor', ozet;
  end if;
end
$kontrol$;

commit;
