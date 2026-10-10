-- =============================================================================
-- Aşama D5 — Tasarım ailesi yetkileri (KARAY Site Factory)
--
--   1) design_family_settings        : KARAY'ın aileyi GLOBAL açıp kapatması (satır yok = açık)
--   2) organization_design_families  : KARAY'ın bir kiracıya izin verdiği aileler
--   3) org_design_family_access()     : kiracının seçebileceği aileler (izinli ∩ global açık)
--   4) platform_set_design_family()  / platform_set_org_design_families() : yalnızca süper admin
--   5) site_apply_design()            : ofis yöneticisi (settings.manage) kendi sitesinin tasarımını
--                                        İZİNLİ bir aileyle değiştirir; yetki VERİTABANINDA doğrulanır
--
-- EK (additive) migration: mevcut tablo/fonksiyon değiştirilmez veya silinmez, veri silinmez.
-- Katalog (aile tanımları) kodda kalır; burada yalnızca kimlikler (ör. 'sinematik-vitrin') tutulur.
-- Kiracı sitesi bu tabloları OKUMAZ: yayındaki site yalnızca kendi manifestini (site_configs) çizer.
--
-- Geri alma (veri kaybı yoktur; yalnızca izin kayıtları kaybolur, siteler etkilenmez):
--   drop function if exists public.site_apply_design(uuid, text, jsonb),
--     public.platform_set_org_design_families(uuid, text[]), public.platform_set_design_family(text, boolean),
--     public.org_design_family_access(uuid);
--   drop table if exists public.organization_design_families, public.design_family_settings;
-- =============================================================================

create table if not exists public.design_family_settings (
  family_id text primary key check (family_id ~ '^[a-z0-9-]{1,40}$'),
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

create table if not exists public.organization_design_families (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  family_id text not null check (family_id ~ '^[a-z0-9-]{1,40}$'),
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (organization_id, family_id)
);
create index if not exists organization_design_families_granted_by_idx on public.organization_design_families (granted_by) where granted_by is not null;
create index if not exists design_family_settings_updated_by_idx on public.design_family_settings (updated_by) where updated_by is not null;

-- RLS: okuma — global ayarlar oturumlu kullanıcılara (yalnızca kimlik + açık/kapalı), kiracı izinleri
-- yalnızca o kiracının üyelerine ve süper admine. Doğrudan yazma YOK (yalnızca aşağıdaki fonksiyonlar).
alter table public.design_family_settings enable row level security;
alter table public.organization_design_families enable row level security;

drop policy if exists "design_family_settings_read" on public.design_family_settings;
create policy "design_family_settings_read" on public.design_family_settings for select to authenticated using (true);

drop policy if exists "organization_design_families_read" on public.organization_design_families;
create policy "organization_design_families_read" on public.organization_design_families for select to authenticated
  using (organization_id in (select public.member_org_ids()) or (select public.is_super_admin()));

revoke all on public.design_family_settings, public.organization_design_families from anon;
revoke insert, update, delete on public.design_family_settings, public.organization_design_families from authenticated;
grant select on public.design_family_settings, public.organization_design_families to authenticated;
grant all on public.design_family_settings, public.organization_design_families to service_role;

-- Kiracının seçebileceği aileler: KARAY'ın izin verdiği VE global olarak kapatılmamış olanlar
create or replace function public.org_design_family_access(p_org uuid)
returns table (family_id text)
language sql
stable
security definer
set search_path = ''
as $$
  select g.family_id
    from public.organization_design_families g
    left join public.design_family_settings s on s.family_id = g.family_id
   where g.organization_id = p_org
     and coalesce(s.enabled, true)
     and (p_org in (select public.member_org_ids()) or (select public.is_super_admin()))
   order by g.family_id;
$$;

-- KARAY: aileyi global aç / kapat (kapatılan aile hiçbir kiracıya yeni seçenek olarak görünmez;
-- onu kullanan mevcut sitelerin yayındaki görünümü DEĞİŞMEZ)
create or replace function public.platform_set_design_family(p_family text, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_super_admin();
  if p_family is null or p_family !~ '^[a-z0-9-]{1,40}$' or p_enabled is null then
    raise exception 'invalid_family' using errcode = '22023';
  end if;
  insert into public.design_family_settings (family_id, enabled, updated_at, updated_by)
  values (p_family, p_enabled, now(), (select auth.uid()))
  on conflict (family_id) do update set enabled = excluded.enabled, updated_at = now(), updated_by = (select auth.uid());
  perform public.write_audit(null, 'design_family.toggled', 'design_family', p_family, p_family,
    jsonb_build_object('enabled', p_enabled));
end;
$$;

-- KARAY: kiracının izinli aile listesini belirler (liste tamamen değiştirilir)
create or replace function public.platform_set_org_design_families(p_org uuid, p_families text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old text[];
  v_new text[];
begin
  perform public.assert_super_admin();
  if p_org is null or not exists (select 1 from public.organizations o where o.id = p_org) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select coalesce(array_agg(distinct f order by f), '{}') into v_new from unnest(coalesce(p_families, '{}')) f;
  if exists (select 1 from unnest(v_new) f where f !~ '^[a-z0-9-]{1,40}$') or cardinality(v_new) > 50 then
    raise exception 'invalid_family' using errcode = '22023';
  end if;
  select coalesce(array_agg(family_id order by family_id), '{}') into v_old from public.organization_design_families where organization_id = p_org;
  delete from public.organization_design_families where organization_id = p_org and family_id <> all (v_new);
  insert into public.organization_design_families (organization_id, family_id, granted_by)
  select p_org, f, (select auth.uid()) from unnest(v_new) f
  on conflict (organization_id, family_id) do nothing;
  if v_old is distinct from v_new then
    perform public.write_audit(p_org, 'site.design_families_changed', 'site', p_org::text, null,
      jsonb_build_object('old', v_old, 'new', v_new));
  end if;
end;
$$;

-- OFİS YÖNETİCİSİ: izinli bir aileyle kendi sitesinin tasarımını değiştirir ve yayınlar.
-- Yalnızca tasarım bölümleri (tema, renk, tipografi, yapısal parçalar, ana sayfa) yazılır; marka,
-- menü, sayfalar, SEO ve KARAY'ın yayınlanmamış taslak değişiklikleri YAYINLANMAZ (taslağın diğer
-- bölümleri olduğu gibi kalır). Bölümlerin içeriği uygulama sunucusunda katalogdan derlenir ve
-- şemayla doğrulanır; okuma tarafı (parseSiteConfig) ayrıca kapalı şemayla temizler.
create or replace function public.site_apply_design(p_org uuid, p_family text, p_sections jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.site_configs;
  v_version integer;
  v_published jsonb;
  v_draft jsonb;
begin
  if (select auth.uid()) is null or not public.has_org_permission(p_org, 'settings.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_family is null or not exists (select 1 from public.org_design_family_access(p_org) a where a.family_id = p_family) then
    raise exception 'family_not_allowed' using errcode = '42501';
  end if;
  if jsonb_typeof(p_sections) <> 'object'
     or exists (select 1 from jsonb_object_keys(p_sections) k where k <> all (array['theme', 'colors', 'typography', 'style', 'home']))
     or not (p_sections ?& array['theme', 'colors', 'typography', 'style', 'home'])
     or jsonb_typeof(p_sections -> 'style') <> 'object'
     or (p_sections -> 'style' -> 'origin' ->> 'family') is distinct from p_family
     or pg_column_size(p_sections) > 65536 then
    raise exception 'invalid_design' using errcode = '22023';
  end if;
  select * into v_row from public.site_configs c where c.organization_id = p_org for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  v_published := coalesce(v_row.published, '{}'::jsonb) || p_sections;
  v_draft := coalesce(v_row.draft, '{}'::jsonb) || p_sections;
  v_version := v_row.published_version + 1;
  insert into public.site_config_revisions (organization_id, version, config, note, created_by)
  values (p_org, v_version, v_published || jsonb_build_object('brand', public.site_brand_snapshot(p_org)),
          'Tasarım değişikliği (ofis): ' || p_family, (select auth.uid()));
  update public.site_configs
     set published = v_published, draft = v_draft, published_version = v_version,
         has_unpublished_changes = (v_draft is distinct from v_published),
         published_at = now(), published_by = (select auth.uid())
   where organization_id = p_org;
  perform public.write_audit(p_org, 'site.design_applied', 'site', p_org::text, p_family,
    jsonb_build_object('version', v_version, 'family', p_family, 'old_family', v_row.published -> 'style' -> 'origin' ->> 'family'));
  return v_version;
end;
$$;

revoke all on function public.org_design_family_access(uuid) from public, anon;
revoke all on function public.platform_set_design_family(text, boolean) from public, anon;
revoke all on function public.platform_set_org_design_families(uuid, text[]) from public, anon;
revoke all on function public.site_apply_design(uuid, text, jsonb) from public, anon;
grant execute on function public.org_design_family_access(uuid) to authenticated, service_role;
grant execute on function public.platform_set_design_family(text, boolean) to authenticated;
grant execute on function public.platform_set_org_design_families(uuid, text[]) to authenticated;
grant execute on function public.site_apply_design(uuid, text, jsonb) to authenticated;

notify pgrst, 'reload schema';
