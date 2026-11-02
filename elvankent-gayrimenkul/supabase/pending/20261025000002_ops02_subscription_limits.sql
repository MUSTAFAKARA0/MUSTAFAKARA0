-- =============================================================================
-- OPS-02 · Abonelik limitlerinin zorlanması (bayraklı, varsayılan KAPALI)
--
-- BEKLEYEN migration (D-04/D-05 kararını bekler): supabase/migrations/ altında DEĞİL, canlıya uygulanmaz. D-04/D-05 kararı
-- verilince kendi ön/son kontrol betikleriyle migrations/ klasörüne taşınır (taşırken
-- karay_schema_version() bu dosyanın kimliğine güncellenir; docs/OPS02_ABONELIK_DURUMLARI.md §3).
-- CI bu dosyayı migration'lardan sonra uygular; RLS ve E2E testleri bayrak kapalıyken davranışın
-- değişmediğini, bayrak açıkken limitlerin uygulandığını doğrular (tests/security/subscription-limits.test.mjs).
--
-- Boşluk: org_plan() yalnızca trialing/active/past_due aboneliği döndürür. Abonelik iptal edilmiş,
-- süresi dolmuş ya da hiç yoksa satır dönmez; ilan, kullanıcı ve depolama kontrolleri boş limiti
-- "sınırsız" sayar (fail-open).
--
-- Bu dosya:
--   1) platform_settings.enforce_subscription_limits (varsayılan false). Yalnızca süper admin
--      değiştirebilir (mevcut platform_settings RLS'i); herkese açık profil bu alanı göstermez.
--   2) org_plan(): bayrak AÇIK ve etkin abonelik YOKSA tek satır döner: plan yok, son aboneliğin
--      durumu (yalnızca kurumun üyesine/süper admine; diğerlerine null), tüm limitler 0, tüm özellikler kapalı. Üç limit kontrolü (ilan tetikleyicisi, üyelik
--      tetikleyicisi, media_upload_allowed) değişmeden yeni kaydı reddeder. Mevcut kayıtlar
--      okunur ve düzenlenir; limitler yalnızca yeni kayıtta denetlenir. Bayrak KAPALIYKEN çıktı
--      öncekiyle birebir aynıdır.
--   Eşzamanlı eklemeler 20261025000001_quota_lock.sql ile sırayla sayılır (bu dosyadan önce uygulanır).
--
-- Bilinen sınırlar (ECC güvenlik incelemesi, K-19):
--   * Bayrak açıkken sıfır limit, servis rolü ve süper admin dahil herkes için yeni üyeyi engeller
--     (davet kabulü, askıdaki üyeyi etkinleştirme). Destek akışı: önce platform_set_org_plan ile abonelik
--     etkinleştirilir. Muafiyet istenirse D-04/D-05 ile birlikte karar verilir.
--   * Limit tetikleyicisi RLS denetiminden (WITH CHECK) önce çalışır: başka kurum adına ilan ekleme
--     denemesi, kurum limitteyse "plan_limit_properties", değilse RLS hatası alır. Bu ayrım bugün de
--     limitteki kurumlar için vardır; bayrak açılınca aboneliği bitmiş kurumlara da genişler.

-- Tekrar çalıştırılabilir. Veri değiştirmez.
--
-- GERİ DÖNÜŞ:
--   org_plan(): 20260930000002_site_builder.sql'deki tanım yeniden uygulanır.
--   alter table public.platform_settings drop column if exists enforce_subscription_limits;
-- =============================================================================

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
