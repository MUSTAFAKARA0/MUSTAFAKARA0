-- =============================================================================
-- KARAY Web Sitesi Yönetimi (Site Control Center)
--
-- Her kiracının (emlak ofisi) web sitesinin GÖRÜNÜMÜ yapılandırma olarak tutulur;
-- tema, renkler, tipografi, header, menü, ana sayfa bölümleri, footer, sayfa ve SEO
-- ayarları tek bir JSON belgesidir (şema uygulamada: src/platform/site/schema.ts).
-- İlanlar, CRM, kullanıcılar ve URL'ler bu belgeden ETKİLENMEZ (yalnızca sunum katmanı).
--
--   site_configs            kiracı başına 1 satır: taslak, yayındaki sürüm, site durumu,
--                           özellik bayrakları (feature flags)
--   site_config_revisions   her yayın bir sürüm (geri dönüş için)
--
-- Yazma: yalnızca SÜPER ADMİN (KARAY), SECURITY DEFINER fonksiyonlarla; her işlem
-- denetim kaydına (audit_logs) yazılır. Kiracı kullanıcıları kendi sitelerinin
-- kaydını OKUYABİLİR, başka kiracınınkini okuyamaz; hiçbirini değiştiremez.
-- Herkese açık site yalnızca YAYINDAKİ sürümü okur (taslak asla).
--
-- Ayrıca: organization_settings'e kısa ad / mobil logo / harita bağlantısı sütunları;
-- org_plan() kiracı bazlı özellik bayraklarını da hesaba katar.
-- Tekrar çalıştırılabilir; mevcut veriyi değiştirmez. Geri dönüş: dosyanın sonunda.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Tablolar
-- -----------------------------------------------------------------------------
create table if not exists public.site_configs (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  draft jsonb not null default '{}'::jsonb check (jsonb_typeof(draft) = 'object' and octet_length(draft::text) < 262144),
  published jsonb not null default '{}'::jsonb check (jsonb_typeof(published) = 'object' and octet_length(published::text) < 262144),
  published_version integer not null default 0 check (published_version >= 0),
  has_unpublished_changes boolean not null default false,
  site_status text not null default 'active' check (site_status in ('active', 'maintenance', 'draft')),
  maintenance_message text check (char_length(maintenance_message) <= 300),
  feature_overrides jsonb not null default '{}'::jsonb check (jsonb_typeof(feature_overrides) = 'object'),
  draft_updated_at timestamptz,
  draft_updated_by uuid references auth.users (id) on delete set null,
  published_at timestamptz,
  published_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists site_configs_updated_at on public.site_configs;
create trigger site_configs_updated_at before update on public.site_configs
  for each row execute function public.set_updated_at();

create table if not exists public.site_config_revisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  version integer not null check (version > 0),
  config jsonb not null check (jsonb_typeof(config) = 'object'),
  note text check (char_length(note) <= 200),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, version)
);
create index if not exists site_config_revisions_org_idx on public.site_config_revisions (organization_id, version desc);
create index if not exists site_configs_draft_by_idx on public.site_configs (draft_updated_by) where draft_updated_by is not null;
create index if not exists site_configs_published_by_idx on public.site_configs (published_by) where published_by is not null;
create index if not exists site_config_revisions_created_by_idx on public.site_config_revisions (created_by) where created_by is not null;

-- Mevcut her kiracı için boş yapılandırma (boş = bugünkü görünüm; hiçbir şey değişmez)
insert into public.site_configs (organization_id)
select o.id from public.organizations o
on conflict (organization_id) do nothing;

-- Yeni kiracı oluşturulunca yapılandırma satırı da oluşur
create or replace function public.site_configs_on_org_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.site_configs (organization_id) values (new.id) on conflict (organization_id) do nothing;
  return new;
end;
$$;
drop trigger if exists organizations_site_config on public.organizations;
create trigger organizations_site_config after insert on public.organizations
  for each row execute function public.site_configs_on_org_insert();

-- -----------------------------------------------------------------------------
-- 2) RLS: kiracı yalnızca KENDİ sitesinin kaydını okur; süper admin hepsini.
--    Doğrudan yazma yok (yalnızca aşağıdaki fonksiyonlar).
-- -----------------------------------------------------------------------------
alter table public.site_configs enable row level security;
alter table public.site_config_revisions enable row level security;

drop policy if exists "site_configs_read" on public.site_configs;
create policy "site_configs_read" on public.site_configs for select to authenticated
  using (organization_id in (select public.member_org_ids()) or (select public.is_super_admin()));
drop policy if exists "site_config_revisions_read" on public.site_config_revisions;
create policy "site_config_revisions_read" on public.site_config_revisions for select to authenticated
  using ((select public.is_super_admin()));

revoke all on public.site_configs, public.site_config_revisions from anon;
revoke insert, update, delete, truncate on public.site_configs, public.site_config_revisions from authenticated;
grant select on public.site_configs, public.site_config_revisions to authenticated;

-- -----------------------------------------------------------------------------
-- 3) Marka sütunları (kısa ad, mobil logo, harita bağlantısı)
-- -----------------------------------------------------------------------------
alter table public.organization_settings
  add column if not exists short_name text check (char_length(short_name) <= 40),
  add column if not exists logo_mobile_url text check (char_length(logo_mobile_url) <= 500),
  add column if not exists maps_url text check (char_length(maps_url) <= 500 and maps_url ~ '^https://');

-- Süper admin (KARAY) kiracının marka/iletişim ayarlarını da düzenleyebilir
create or replace function public.organization_settings_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fields text[];
begin
  if (select auth.uid()) is null then
    return new;
  end if;
  new.organization_id := old.organization_id;
  new.updated_by := (select auth.uid());
  v_fields := public.audit_changed_fields(to_jsonb(old), to_jsonb(new));
  if exists (
    select 1 from unnest(v_fields) f
     where f not in ('seo_title', 'seo_description', 'og_image_url', 'google_site_verification', 'updated_by')
  ) and not public.has_org_permission(new.organization_id, 'settings.manage')
    and not public.is_super_admin() then
    raise exception 'settings_forbidden' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4) Özellik bayrakları plan hesabına dahil (kiracı bazlı AÇ/KAPA, plandan önceliklidir)
--    Anahtarlar: crm, analytics, pdf, custom_domain (panel) — diğerleri site tarafında.
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 5) Herkese açık okuma: yalnızca YAYINDAKİ sürüm + durum + site bayrakları (aktif kiracı)
-- -----------------------------------------------------------------------------
create or replace function public.public_site_config(p_org uuid)
returns table (published jsonb, published_version integer, site_status text, maintenance_message text, feature_overrides jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select c.published, c.published_version, c.site_status, c.maintenance_message, c.feature_overrides
    from public.site_configs c
    join public.organizations o on o.id = c.organization_id and o.status = 'active'
   where c.organization_id = p_org;
$$;

-- -----------------------------------------------------------------------------
-- 6) Yönetim fonksiyonları (yalnızca süper admin; her biri denetim kaydı yazar)
-- -----------------------------------------------------------------------------

-- Web siteleri listesi (tüm kiracılar)
create or replace function public.platform_sites()
returns table (
  organization_id uuid, slug text, name text, org_status public.org_status, is_default boolean,
  site_status text, published_version integer, has_unpublished_changes boolean,
  published_at timestamptz, draft_updated_at timestamptz, theme text, primary_domain text, logo_url text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_super_admin();
  return query
    select o.id, o.slug, o.name, o.status, o.is_default,
           coalesce(c.site_status, 'active'), coalesce(c.published_version, 0), coalesce(c.has_unpublished_changes, false),
           c.published_at, c.draft_updated_at,
           coalesce(c.published->>'theme', 'klasik'),
           (select d.hostname from public.organization_domains d where d.organization_id = o.id and d.is_primary limit 1),
           s.logo_url
      from public.organizations o
      left join public.site_configs c on c.organization_id = o.id
      left join public.organization_settings s on s.organization_id = o.id
     order by o.is_default desc, o.name;
end;
$$;

-- Taslağın bir bölümünü kaydeder (ör. 'theme', 'colors', 'navigation'); tüm belgeyi değil
create or replace function public.site_save_draft(p_org uuid, p_section text, p_value jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
begin
  perform public.assert_super_admin();
  -- Yalnızca bilinen bölümler (uygulamadaki SECTION_SCHEMAS ile aynı liste)
  if p_section is null or p_section not in ('theme', 'colors', 'typography', 'header', 'navigation', 'home', 'footer', 'pages', 'seo') then
    raise exception 'invalid_section' using errcode = '22023';
  end if;
  insert into public.site_configs (organization_id) values (p_org) on conflict (organization_id) do nothing;
  select c.draft -> p_section into v_old from public.site_configs c where c.organization_id = p_org for update;
  update public.site_configs
     set draft = jsonb_set(draft, array[p_section], coalesce(p_value, 'null'::jsonb), true),
         has_unpublished_changes = true,
         draft_updated_at = now(),
         draft_updated_by = (select auth.uid())
   where organization_id = p_org;
  perform public.write_audit(p_org, 'site.draft_saved', 'site', p_org::text, p_section,
    jsonb_build_object('section', p_section,
                       'old', case when p_section in ('theme') then v_old else null end,
                       'new', case when p_section in ('theme') then p_value else null end));
end;
$$;

-- Taslağı yayınlar: yeni sürüm oluşturur
create or replace function public.site_publish(p_org uuid, p_note text default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.site_configs;
  v_version integer;
begin
  perform public.assert_super_admin();
  select * into v_row from public.site_configs c where c.organization_id = p_org for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  v_version := v_row.published_version + 1;
  insert into public.site_config_revisions (organization_id, version, config, note, created_by)
  values (p_org, v_version, v_row.draft, left(nullif(trim(p_note), ''), 200), (select auth.uid()));
  update public.site_configs
     set published = v_row.draft, published_version = v_version, has_unpublished_changes = false,
         published_at = now(), published_by = (select auth.uid())
   where organization_id = p_org;
  perform public.write_audit(p_org, 'site.published', 'site', p_org::text, 'Sürüm ' || v_version,
    jsonb_build_object('version', v_version, 'note', left(p_note, 200),
                       'old_theme', v_row.published->>'theme', 'new_theme', v_row.draft->>'theme'));
  return v_version;
end;
$$;

-- Önceki bir sürüme geri döner (yeni sürüm olarak yayınlanır; geçmiş silinmez)
create or replace function public.site_rollback(p_org uuid, p_version integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_config jsonb;
  v_row public.site_configs;
  v_version integer;
begin
  perform public.assert_super_admin();
  select r.config into v_config from public.site_config_revisions r where r.organization_id = p_org and r.version = p_version;
  if v_config is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select * into v_row from public.site_configs c where c.organization_id = p_org for update;
  v_version := v_row.published_version + 1;
  insert into public.site_config_revisions (organization_id, version, config, note, created_by)
  values (p_org, v_version, v_config, 'Sürüm ' || p_version || ' geri yüklendi', (select auth.uid()));
  update public.site_configs
     set published = v_config, draft = v_config, published_version = v_version, has_unpublished_changes = false,
         published_at = now(), published_by = (select auth.uid()), draft_updated_at = now(), draft_updated_by = (select auth.uid())
   where organization_id = p_org;
  perform public.write_audit(p_org, 'site.rolled_back', 'site', p_org::text, 'Sürüm ' || p_version,
    jsonb_build_object('restored_version', p_version, 'new_version', v_version));
  return v_version;
end;
$$;

-- Yayınlanmamış taslak değişikliklerini atar
create or replace function public.site_discard_draft(p_org uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_super_admin();
  update public.site_configs
     set draft = published, has_unpublished_changes = false, draft_updated_at = now(), draft_updated_by = (select auth.uid())
   where organization_id = p_org;
  perform public.write_audit(p_org, 'site.draft_discarded', 'site', p_org::text, null, '{}'::jsonb);
end;
$$;

-- Site durumu: active | maintenance | draft (panel etkilenmez)
create or replace function public.site_set_status(p_org uuid, p_status text, p_message text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old text;
begin
  perform public.assert_super_admin();
  if p_status not in ('active', 'maintenance', 'draft') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  select c.site_status into v_old from public.site_configs c where c.organization_id = p_org;
  update public.site_configs
     set site_status = p_status, maintenance_message = left(nullif(trim(p_message), ''), 300)
   where organization_id = p_org;
  perform public.write_audit(p_org, 'site.status_changed', 'site', p_org::text, p_status,
    jsonb_build_object('old', v_old, 'new', p_status));
end;
$$;

-- Özellik bayrakları (anında geçerli). null değer = plan varsayılanına dön
create or replace function public.site_set_features(p_org uuid, p_overrides jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_clean jsonb;
begin
  perform public.assert_super_admin();
  if jsonb_typeof(p_overrides) <> 'object' then
    raise exception 'invalid_features' using errcode = '22023';
  end if;
  -- Yalnızca bilinen anahtarlar ve boolean değerler
  select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) into v_clean
    from jsonb_each(p_overrides) as e(k, v)
   where k in ('crm', 'analytics', 'pdf', 'custom_domain', 'blog', 'valuation', 'whatsapp', 'favorites', 'advanced_seo', 'dark_mode')
     and jsonb_typeof(v) = 'boolean';
  select c.feature_overrides into v_old from public.site_configs c where c.organization_id = p_org;
  update public.site_configs set feature_overrides = v_clean where organization_id = p_org;
  perform public.write_audit(p_org, 'site.features_changed', 'site', p_org::text, null,
    jsonb_build_object('old', v_old, 'new', v_clean));
end;
$$;

revoke all on function public.public_site_config(uuid) from public;
grant execute on function public.public_site_config(uuid) to anon, authenticated, service_role;
revoke all on function public.platform_sites() from public, anon;
revoke all on function public.site_save_draft(uuid, text, jsonb) from public, anon;
revoke all on function public.site_publish(uuid, text) from public, anon;
revoke all on function public.site_rollback(uuid, integer) from public, anon;
revoke all on function public.site_discard_draft(uuid) from public, anon;
revoke all on function public.site_set_status(uuid, text, text) from public, anon;
revoke all on function public.site_set_features(uuid, jsonb) from public, anon;
revoke all on function public.site_configs_on_org_insert() from public, anon, authenticated;
grant execute on function public.platform_sites() to authenticated;
grant execute on function public.site_save_draft(uuid, text, jsonb) to authenticated;
grant execute on function public.site_publish(uuid, text) to authenticated;
grant execute on function public.site_rollback(uuid, integer) to authenticated;
grant execute on function public.site_discard_draft(uuid) to authenticated;
grant execute on function public.site_set_status(uuid, text, text) to authenticated;
grant execute on function public.site_set_features(uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';

-- =============================================================================
-- GERİ DÖNÜŞ (gerekirse; site görünümü varsayılana döner, başka veri etkilenmez):
--   -- ÖNCE org_plan ve organization_settings_guard'ı önceki tanımlarına döndürün
--   -- (20260926000002_v2_tenancy.sql › org_plan, 20260930000002 öncesi guard:
--   --  20260926000007_v2_security.sql); org_plan site_configs tablosunu okur.
--   drop trigger if exists organizations_site_config on public.organizations;
--   drop function if exists public.site_configs_on_org_insert();
--   drop function if exists public.public_site_config(uuid), public.platform_sites(),
--     public.site_save_draft(uuid, text, jsonb), public.site_publish(uuid, text),
--     public.site_rollback(uuid, integer), public.site_discard_draft(uuid),
--     public.site_set_status(uuid, text, text), public.site_set_features(uuid, jsonb);
--   drop table if exists public.site_config_revisions;
--   drop table if exists public.site_configs;
--   -- Eklenen sütunlar (short_name, logo_mobile_url, maps_url) boş kalabilir.
--   notify pgrst, 'reload schema';
-- =============================================================================
