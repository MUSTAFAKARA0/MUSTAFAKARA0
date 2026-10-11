-- =============================================================================
-- P0.2 — Marka ve site içeriği de taslak → önizleme → yayın → geri alma akışında
--
-- NEDEN: Ofis panelindeki "Şirket ayarları" (/admin/sirket), ana sayfa metinleri ve marka
-- görselleri organization_settings'e ANINDA yazılıyordu; P0.1'in taslak/yayın modeliyle
-- tutarsızdı ve canlı siteyi değiştiren ikinci bir yayın yolu bırakıyordu. Yeni taslak/sürüm
-- sistemi YAZILMAZ: mevcut site_configs.draft.brand + site_publish + site_rollback kullanılır.
--
--   1) site_brand_columns() : ziyaretçinin gördüğü diğer içerik alanları beyaz listeye eklenir
--      (hizmet bölgesi, posta kodu, ofis konumu, çalışma saatleri, saat notu, ana sayfa metinleri)
--   2) site_apply_brand()   : sütun tipine duyarlı (numeric / jsonb); yalnızca yayın/geri alma
--      sırasında işlem içi bayrak (app.site_brand_apply) açılır
--   3) organization_settings_guard : süper admin olmayan kullanıcı marka/site içeriği sütunlarını
--      DOĞRUDAN değiştiremez (tek yayın noktası); yalnızca site_publish / site_rollback yazar.
--      Paylaşım görseli ve SEO alanları SEO modülünde kalır (seo.manage; ayrı yetki modeli).
--   4) site_save_draft : isteğe bağlı eşzamanlılık belirteci (p_expected_updated_at). Verilirse ve
--      taslak o andan sonra değişmişse kayıt reddedilir ('stale_draft'). Verilmezse eskisi gibi.
--      Dönüş: yeni taslak zamanı (bir sonraki kaydın belirteci; art arda kayıtlar için).
--
-- Yeni tablo yok; veri değişmez/silinmez. Gövdelerin geri kalanı 20261005000001 ile aynıdır.
--
-- Geri alma (veri kaybı yoktur; bekleyen taslak alanları kalır ama yeni alanlar uygulanmaz):
--   1) 20261001000001_site_brand_publish.sql › site_brand_columns, site_apply_brand ve
--      20260930000002_site_builder.sql › organization_settings_guard tanımlarını yeniden çalıştırın.
--   2) drop function if exists public.site_save_draft(uuid, text, jsonb, timestamptz);
--      ardından 20261005000001_office_site_management.sql › site_save_draft tanımını ve izinlerini
--      yeniden çalıştırın.
--   3) notify pgrst, 'reload schema';
-- =============================================================================

-- 1) Taslakta tutulabilen marka / site içeriği alanları (organization_settings sütunları)
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
    'opening_hours', 'working_hours_note', 'hero_title', 'hero_subtitle'
  ]::text[];
$$;

-- 2) Marka alanlarını organization_settings'e uygular (yalnızca beyaz liste; tip dönüşümü sütuna göre)
create or replace function public.site_apply_brand(p_org uuid, p_brand jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  k text;
  v jsonb;
begin
  if p_brand is null or jsonb_typeof(p_brand) <> 'object' then
    return;
  end if;
  -- Doğrudan yazım koruması (organization_settings_guard) yalnızca bu işlem boyunca açılır
  perform set_config('app.site_brand_apply', 'on', true);
  foreach k in array public.site_brand_columns() loop
    if p_brand ? k then
      v := p_brand -> k;
      -- Boş metin = boş değer
      if jsonb_typeof(v) = 'string' and v #>> '{}' = '' then
        v := 'null'::jsonb;
      end if;
      -- Firma adı ve renkler boşaltılamaz (NOT NULL); boş gelirse mevcut değer korunur
      if k in ('display_name', 'primary_color', 'accent_color') and jsonb_typeof(v) = 'null' then
        continue;
      end if;
      -- Çalışma saatleri boşaltılırsa boş liste (sütun NOT NULL varsayılanı)
      if k = 'opening_hours' and jsonb_typeof(v) = 'null' then
        v := '[]'::jsonb;
      end if;
      execute format('update public.organization_settings set %1$I = (jsonb_populate_record(null::public.organization_settings, jsonb_build_object(%2$L, $1))).%1$I where organization_id = $2', k, k)
        using v, p_org;
    end if;
  end loop;
  perform set_config('app.site_brand_apply', 'off', true);
end;
$$;

-- 3) Ayar kaydı koruması (20260930000002 tanımı + marka/site içeriği için tek yayın noktası)
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
  -- Ziyaretçinin gördüğü marka/site içeriği yalnızca yayınla (site_publish / site_rollback) değişir
  if exists (
    select 1 from unnest(v_fields) f
     where f = any (public.site_brand_columns()) and f <> 'og_image_url'
  ) and coalesce(current_setting('app.site_brand_apply', true), '') <> 'on'
    and not public.is_super_admin() then
    raise exception 'brand_requires_publish' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- 4) Taslak bölümü kaydeder (20261005000001 gövdesi + isteğe bağlı eşzamanlılık belirteci)
drop function if exists public.site_save_draft(uuid, text, jsonb);
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
begin
  perform public.assert_site_editor(p_org);
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
revoke all on function public.site_apply_brand(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.site_save_draft(uuid, text, jsonb, timestamptz) from public, anon;
grant execute on function public.site_save_draft(uuid, text, jsonb, timestamptz) to authenticated;

notify pgrst, 'reload schema';
