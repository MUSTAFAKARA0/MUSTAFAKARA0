-- =============================================================================
-- KARAY Web Sitesi Yönetimi — marka da taslak → önizleme → yayın → geri alma akışında
--
-- Önceden KARAY › Marka sekmesindeki logo / ad / iletişim / renk değişiklikleri
-- organization_settings'e anında yazılıyordu. Artık:
--   * Taslak: site_configs.draft.brand (yalnızca DEĞİŞEN alanlar; canlı site değişmez)
--   * Önizleme: taslak marka yalnızca imzalı önizlemede üste bindirilir
--   * Yayın: bekleyen marka alanları organization_settings'e uygulanır; sürüm kaydına
--     markanın TAM anlık görüntüsü yazılır (geri alma için)
--   * Geri alma: sürümdeki marka anlık görüntüsü organization_settings'e geri uygulanır
--
-- Herkese açık site marka bilgisini bugünkü gibi organization_settings'ten (önbellekli)
-- okur: ziyaretçi başına ek sorgu yoktur. Ofisin kendi panelinden (Şirket Ayarları)
-- yaptığı düzenlemeler bugünkü gibi anında geçerlidir.
--
-- Tekrar çalıştırılabilir; veri silmez; tablo yapısı değişmez (yalnızca fonksiyonlar).
-- Geri dönüş: dosya sonunda.
-- =============================================================================

-- Taslakta tutulabilen marka alanları (organization_settings sütunları; beyaz liste)
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
    'primary_color', 'accent_color'
  ]::text[];
$$;

-- Ofisin güncel marka anlık görüntüsü (sürüm kaydı için)
create or replace function public.site_brand_snapshot(p_org uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(k, to_jsonb(s) -> k), '{}'::jsonb)
    from public.organization_settings s, unnest(public.site_brand_columns()) k
   where s.organization_id = p_org;
$$;

-- Marka alanlarını organization_settings'e uygular (yalnızca beyaz listedeki sütunlar)
create or replace function public.site_apply_brand(p_org uuid, p_brand jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  k text;
begin
  if p_brand is null or jsonb_typeof(p_brand) <> 'object' then
    return;
  end if;
  foreach k in array public.site_brand_columns() loop
    if p_brand ? k then
      -- Firma adı ve renkler boşaltılamaz (NOT NULL); boş gelirse mevcut değer korunur
      if k in ('display_name', 'primary_color', 'accent_color') and nullif(p_brand ->> k, '') is null then
        continue;
      end if;
      execute format('update public.organization_settings set %I = $1 where organization_id = $2', k)
        using nullif(p_brand ->> k, ''), p_org;
    end if;
  end loop;
end;
$$;

-- Taslak bölümü kaydeder (beyaz liste: brand ve style eklendi)
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
  if p_section is null or p_section not in ('theme', 'colors', 'typography', 'header', 'navigation', 'home', 'footer', 'pages', 'seo', 'brand', 'style') then
    raise exception 'invalid_section' using errcode = '22023';
  end if;
  if p_section = 'brand' and (jsonb_typeof(p_value) <> 'object'
      or exists (select 1 from jsonb_object_keys(p_value) k where k <> all (public.site_brand_columns()))) then
    raise exception 'invalid_brand' using errcode = '22023';
  end if;
  insert into public.site_configs (organization_id) values (p_org) on conflict (organization_id) do nothing;
  select c.draft -> p_section into v_old from public.site_configs c where c.organization_id = p_org for update;
  update public.site_configs
     set draft = case when p_section = 'brand' and p_value = '{}'::jsonb then draft - 'brand'
                      else jsonb_set(draft, array[p_section], coalesce(p_value, 'null'::jsonb), true) end,
         has_unpublished_changes = true,
         draft_updated_at = now(),
         draft_updated_by = (select auth.uid())
   where organization_id = p_org;
  perform public.write_audit(p_org, 'site.draft_saved', 'site', p_org::text, p_section,
    jsonb_build_object('section', p_section,
                       'old', case when p_section in ('theme') then v_old else null end,
                       'new', case when p_section in ('theme') then p_value else null end,
                       'fields', case when p_section = 'brand' then (select jsonb_agg(k) from jsonb_object_keys(p_value) k) else null end));
end;
$$;

-- Taslağı yayınlar: bekleyen marka uygulanır, yeni sürüm (marka anlık görüntüsüyle) oluşur
create or replace function public.site_publish(p_org uuid, p_note text default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.site_configs;
  v_version integer;
  v_config jsonb;
begin
  perform public.assert_super_admin();
  select * into v_row from public.site_configs c where c.organization_id = p_org for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  perform public.site_apply_brand(p_org, v_row.draft -> 'brand');
  v_config := v_row.draft - 'brand';
  v_version := v_row.published_version + 1;
  insert into public.site_config_revisions (organization_id, version, config, note, created_by)
  values (p_org, v_version, v_config || jsonb_build_object('brand', public.site_brand_snapshot(p_org)),
          left(nullif(trim(p_note), ''), 200), (select auth.uid()));
  update public.site_configs
     set published = v_config, draft = v_config, published_version = v_version, has_unpublished_changes = false,
         published_at = now(), published_by = (select auth.uid())
   where organization_id = p_org;
  perform public.write_audit(p_org, 'site.published', 'site', p_org::text, 'Sürüm ' || v_version,
    jsonb_build_object('version', v_version, 'note', left(p_note, 200),
                       'old_theme', v_row.published->>'theme', 'new_theme', v_row.draft->>'theme',
                       'brand_fields', (select jsonb_agg(k) from jsonb_object_keys(coalesce(v_row.draft -> 'brand', '{}'::jsonb)) k)));
  return v_version;
end;
$$;

-- Önceki sürüme döner (marka anlık görüntüsü varsa o da geri yüklenir)
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
  -- Eski sürümlerde (bu dosyadan önce) marka anlık görüntüsü yoktur: marka olduğu gibi kalır
  perform public.site_apply_brand(p_org, v_config -> 'brand');
  v_config := v_config - 'brand';
  v_version := v_row.published_version + 1;
  insert into public.site_config_revisions (organization_id, version, config, note, created_by)
  values (p_org, v_version, v_config || jsonb_build_object('brand', public.site_brand_snapshot(p_org)),
          'Sürüm ' || p_version || ' geri yüklendi', (select auth.uid()));
  update public.site_configs
     set published = v_config, draft = v_config, published_version = v_version, has_unpublished_changes = false,
         published_at = now(), published_by = (select auth.uid()), draft_updated_at = now(), draft_updated_by = (select auth.uid())
   where organization_id = p_org;
  perform public.write_audit(p_org, 'site.rolled_back', 'site', p_org::text, 'Sürüm ' || p_version,
    jsonb_build_object('restored_version', p_version, 'new_version', v_version));
  return v_version;
end;
$$;

-- Yardımcı fonksiyonlar yalnızca yukarıdaki süper admin fonksiyonlarının içinden kullanılır
revoke all on function public.site_brand_columns() from public, anon;
revoke all on function public.site_brand_snapshot(uuid) from public, anon, authenticated;
revoke all on function public.site_apply_brand(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.site_brand_columns() to authenticated;
revoke all on function public.site_save_draft(uuid, text, jsonb) from public, anon;
revoke all on function public.site_publish(uuid, text) from public, anon;
revoke all on function public.site_rollback(uuid, integer) from public, anon;
grant execute on function public.site_save_draft(uuid, text, jsonb) to authenticated;
grant execute on function public.site_publish(uuid, text) to authenticated;
grant execute on function public.site_rollback(uuid, integer) to authenticated;

notify pgrst, 'reload schema';

-- =============================================================================
-- GERİ DÖNÜŞ (gerekirse): site_save_draft, site_publish, site_rollback fonksiyonlarını
-- 20260930000002_site_builder.sql içindeki tanımlarıyla yeniden oluşturun, ardından:
--   drop function if exists public.site_apply_brand(uuid, jsonb), public.site_brand_snapshot(uuid),
--     public.site_brand_columns();
--   update public.site_configs set draft = draft - 'brand';   -- bekleyen marka taslağı atılır
--   notify pgrst, 'reload schema';
-- Veri kaybı yoktur: yayınlanmış marka zaten organization_settings'tedir.
-- =============================================================================
