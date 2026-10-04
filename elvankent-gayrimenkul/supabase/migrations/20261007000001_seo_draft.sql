-- =============================================================================
-- P0.3 — Site geneli SEO ve meta verisi de taslak → önizleme → yayın → geri alma akışında
--
-- NEDEN: /admin/seo (seo.manage) SEO başlığını, açıklamasını, paylaşım görselini ve Search
-- Console doğrulama kodunu organization_settings'e ANINDA yazıyordu; ayrıca site_configs.seo
-- (taslaklı) ile organization_settings.seo_* (anlık) iki ayrı başlık/açıklama kaynağıydı.
-- Yeni tablo veya ikinci bir taslak/sürüm sistemi YAZILMAZ:
--
--   * Başlık / açıklama / indeksleme / şema türü : TEK kaynak site_configs.seo bölümü (taslaklı)
--   * Paylaşım görseli / doğrulama kodu          : marka taslağı (site_configs.draft.brand →
--                                                  yayında organization_settings; P0.2 ile aynı yol)
--
--   1) Geriye uyum (veri kaybı yok): organization_settings.seo_title / seo_description değerleri,
--      site_configs.published / draft ve sürüm kayıtlarındaki seo bölümüne — orada değer YOKSA —
--      kopyalanır (görünen sonuç değişmez; eski metadata "seo.title ?? seo_title" ile aynıydı).
--      Eski sütunlar silinmez; artık yalnızca okunmaz ve doğrudan değiştirilemez (donduruldu).
--   2) site_brand_columns : google_site_verification eklenir (og_image_url zaten listede)
--   3) organization_settings_guard : paylaşım görseli dahil marka sütunları ve eski SEO sütunları
--      süper admin dışında doğrudan değiştirilemez (yalnızca site_publish / site_rollback yazar)
--   4) site_save_draft : SEO yetkisi (seo.manage) olan rol (ör. editör) yalnızca SEO taslağını
--      yazabilir: 'seo' bölümü ve marka taslağında YALNIZCA paylaşım görseli / doğrulama kodu.
--      Yayın ve geri alma eskisi gibi settings.manage ister (assert_site_editor).
--
-- Gövdelerin geri kalanı 20261006000001 ile aynıdır. Veri silinmez.
--
-- Geri alma:
--   1) 20261006000001_brand_content_draft.sql › site_brand_columns, organization_settings_guard ve
--      site_save_draft tanımlarını yeniden çalıştırın (site_save_draft'tan önce:
--      drop function if exists public.site_save_draft(uuid, text, jsonb, timestamptz);).
--   2) Kopyalanan seo.title / seo.description değerleri zararsızdır (eski sütunlarla aynı değer);
--      geri almada bırakılabilir. Eski sütunlar hiç değişmediği için uygulama eski sürüme dönerse
--      onları okumaya devam eder.
--   3) notify pgrst, 'reload schema';
-- =============================================================================

-- 1) Geriye uyum: eski SEO alanları seo bölümüne (yalnızca boşsa)
create or replace function public._p03_merge_seo(p_config jsonb, p_title text, p_description text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case
    when p_config is null or jsonb_typeof(p_config) <> 'object' then p_config
    when p_title is null and p_description is null then p_config
    else jsonb_set(
      p_config, '{seo}',
      (case when jsonb_typeof(p_config -> 'seo') = 'object' then p_config -> 'seo' else '{}'::jsonb end)
        || jsonb_strip_nulls(jsonb_build_object(
             'title', coalesce(nullif(p_config -> 'seo' ->> 'title', ''), p_title),
             'description', coalesce(nullif(p_config -> 'seo' ->> 'description', ''), p_description))),
      true)
  end;
$$;

update public.site_configs c
   set published = public._p03_merge_seo(c.published, s.seo_title, s.seo_description),
       draft = public._p03_merge_seo(c.draft, s.seo_title, s.seo_description)
  from public.organization_settings s
 where s.organization_id = c.organization_id
   and (s.seo_title is not null or s.seo_description is not null);

update public.site_config_revisions r
   set config = public._p03_merge_seo(r.config, s.seo_title, s.seo_description)
  from public.organization_settings s
 where s.organization_id = r.organization_id
   and (s.seo_title is not null or s.seo_description is not null);

drop function public._p03_merge_seo(jsonb, text, text);

-- 2) Taslakta tutulabilen marka / site içeriği alanları (+ doğrulama kodu)
create or replace function public.site_brand_columns()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'display_name', 'short_name', 'legal_name', 'tagline', 'description',
    'phone', 'whatsapp', 'email', 'address_line', 'address_district', 'address_city', 'maps_url',
    'instagram_url', 'facebook_url', 'x_url', 'youtube_url', 'linkedin_url', 'tiktok_url',
    'logo_url', 'logo_mobile_url', 'favicon_url', 'og_image_url', 'hero_image_url',
    'primary_color', 'accent_color',
    'service_area', 'postal_code', 'office_latitude', 'office_longitude',
    'opening_hours', 'working_hours_note', 'hero_title', 'hero_subtitle',
    'google_site_verification'
  ]::text[];
$$;

-- SEO yetkisinin (seo.manage) taslakta değiştirebildiği marka alanları
create or replace function public.site_seo_brand_columns()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['og_image_url', 'google_site_verification']::text[];
$$;

-- 3) Ayar kaydı koruması: marka/site içeriği + SEO yalnızca yayınla değişir
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
  -- Ziyaretçinin gördüğü marka/site içeriği ve site SEO'su yalnızca yayınla (site_publish /
  -- site_rollback) değişir. Eski seo_title / seo_description artık okunmaz ve değiştirilemez.
  if exists (
    select 1 from unnest(v_fields) f
     where f = any (public.site_brand_columns()) or f in ('seo_title', 'seo_description')
  ) and coalesce(current_setting('app.site_brand_apply', true), '') <> 'on'
    and not public.is_super_admin() then
    raise exception 'brand_requires_publish' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- 4) Taslak bölümü kaydeder (20261006000001 gövdesi + SEO yetkisinin sınırlı taslak hakkı)
drop function if exists public.site_save_draft(uuid, text, jsonb, timestamptz);
create or replace function public.site_save_draft(p_org uuid, p_section text, p_value jsonb, p_expected_updated_at timestamptz default null)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_family text;
  v_updated_at timestamptz;
  v_now timestamptz := now();
  v_full boolean;
begin
  -- Yetki: süper admin veya settings.manage → tüm bölümler; seo.manage → yalnızca SEO taslağı
  if public.is_super_admin()
     or ((select auth.uid()) is not null and p_org is not null and public.has_org_permission(p_org, 'settings.manage')) then
    v_full := true;
  elsif (select auth.uid()) is not null and p_org is not null and public.has_org_permission(p_org, 'seo.manage')
        and p_section in ('seo', 'brand') then
    v_full := false;
  else
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_section is null or p_section not in ('theme', 'colors', 'typography', 'header', 'navigation', 'home', 'footer', 'pages', 'seo', 'brand', 'style') then
    raise exception 'invalid_section' using errcode = '22023';
  end if;
  if p_section = 'brand' and (jsonb_typeof(p_value) <> 'object'
      or exists (select 1 from jsonb_object_keys(p_value) k where k <> all (public.site_brand_columns()))) then
    raise exception 'invalid_brand' using errcode = '22023';
  end if;
  if p_section = 'style' and not public.is_super_admin() then
    v_family := p_value -> 'origin' ->> 'family';
    if v_family is not null
       and v_family is distinct from (select c.draft -> 'style' -> 'origin' ->> 'family' from public.site_configs c where c.organization_id = p_org)
       and v_family is distinct from (select c.published -> 'style' -> 'origin' ->> 'family' from public.site_configs c where c.organization_id = p_org)
       and not exists (select 1 from public.org_design_family_access(p_org) a where a.family_id = v_family) then
      raise exception 'family_not_allowed' using errcode = '42501';
    end if;
  end if;
  insert into public.site_configs (organization_id) values (p_org) on conflict (organization_id) do nothing;
  select c.draft -> p_section, c.draft_updated_at into v_old, v_updated_at from public.site_configs c where c.organization_id = p_org for update;
  -- SEO yetkisi: marka taslağında yalnızca SEO alanları değişebilir (diğer bekleyen alanlar aynen kalmalı)
  if not v_full and p_section = 'brand' and exists (
    select 1
      from (select jsonb_object_keys(coalesce(v_old, '{}'::jsonb)) as k
            union select jsonb_object_keys(p_value)) keys
     where keys.k <> all (public.site_seo_brand_columns())
       and (coalesce(v_old, '{}'::jsonb) -> keys.k) is distinct from (p_value -> keys.k)
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  -- Eski taslak: kullanıcı formu açtıktan sonra taslak başka biri tarafından değiştirildi
  if p_expected_updated_at is not null and v_updated_at is distinct from p_expected_updated_at then
    raise exception 'stale_draft' using errcode = 'PT409';
  end if;
  update public.site_configs
     set draft = case when p_section = 'brand' and p_value = '{}'::jsonb then draft - 'brand'
                      else jsonb_set(draft, array[p_section], coalesce(p_value, 'null'::jsonb), true) end,
         has_unpublished_changes = true,
         draft_updated_at = v_now,
         draft_updated_by = (select auth.uid())
   where organization_id = p_org;
  perform public.write_audit(p_org, 'site.draft_saved', 'site', p_org::text, p_section,
    jsonb_build_object('section', p_section,
                       'old', case when p_section in ('theme') then v_old else null end,
                       'new', case when p_section in ('theme') then p_value else null end,
                       'fields', case when p_section = 'brand' then (select jsonb_agg(k) from jsonb_object_keys(p_value) k) else null end));
  -- Yeni eşzamanlılık belirteci (istemci bir sonraki kayıtta gönderir)
  return v_now;
end;
$$;

revoke all on function public.site_brand_columns() from public, anon;
grant execute on function public.site_brand_columns() to authenticated;
revoke all on function public.site_seo_brand_columns() from public, anon;
grant execute on function public.site_seo_brand_columns() to authenticated;
revoke all on function public.site_save_draft(uuid, text, jsonb, timestamptz) from public, anon;
grant execute on function public.site_save_draft(uuid, text, jsonb, timestamptz) to authenticated;

notify pgrst, 'reload schema';
