-- =============================================================================
-- P0.1 — Ofis site yönetimi (/admin/site): mevcut taslak/yayın akışını ofise açar
--
-- NEDEN: site_save_draft, site_publish, site_rollback ve site_discard_draft yalnızca süper
-- admine (assert_super_admin) açıktı; ofis yöneticisi kendi sitesini taslak → önizleme → yayın
-- akışıyla yönetemiyordu. YENİ bir taslak/yayın sistemi yazılmaz: aynı fonksiyonların yetki
-- kontrolü genişletilir, gövdeleri AYNEN korunur (20261001000001 ve 20260930000002 ile aynı).
--
--   1) assert_site_editor(p_org) : süper admin VEYA (oturum + o organizasyonda settings.manage)
--   2) site_save_draft / site_publish / site_rollback / site_discard_draft : assert_site_editor
--   3) site_save_draft : süper admin olmayan çağıran 'style' bölümünde tasarım ailesini yalnızca
--      KARAY'ın izin verdiği (org_design_family_access) bir aileye değiştirebilir
--   4) site_config_revisions : ofiste settings.manage yetkisi olan kendi sürümlerini okuyabilir
--
-- DEĞİŞMEYENLER (yalnızca KARAY / süper admin): site_set_status, site_set_features, platform_*
-- fonksiyonları, aile izin tabloları, planlar. site_apply_design olduğu gibi kalır (silinmez).
-- Yeni tablo yok, veri değişmez/silinmez. organization_id her fonksiyonda parametre olarak gelir
-- ve has_org_permission ile OTURUMUN üyeliğine karşı doğrulanır (istemciye güvenilmez).
--
-- Geri alma (veri kaybı yoktur):
--   1) 20261001000001_site_brand_publish.sql içindeki site_save_draft, site_publish, site_rollback
--      tanımlarını ve 20260930000002_site_builder.sql içindeki site_discard_draft tanımını yeniden
--      çalıştırın (perform public.assert_super_admin()).
--   2) drop policy if exists "site_config_revisions_read" on public.site_config_revisions;
--      create policy "site_config_revisions_read" on public.site_config_revisions for select
--        to authenticated using ((select public.is_super_admin()));
--   3) drop function if exists public.assert_site_editor(uuid);
-- =============================================================================

-- Site düzenleme yetkisi: KARAY süper admini veya o ofiste "Şirket ve site ayarları" yetkisi
create or replace function public.assert_site_editor(p_org uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.is_super_admin() then
    return;
  end if;
  if (select auth.uid()) is null or p_org is null or not public.has_org_permission(p_org, 'settings.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$$;

-- Taslak bölümü kaydeder (gövde 20261001000001 ile aynı; yetki + ofis için aile izni)
create or replace function public.site_save_draft(p_org uuid, p_section text, p_value jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_family text;
begin
  perform public.assert_site_editor(p_org);
  if p_section is null or p_section not in ('theme', 'colors', 'typography', 'header', 'navigation', 'home', 'footer', 'pages', 'seo', 'brand', 'style') then
    raise exception 'invalid_section' using errcode = '22023';
  end if;
  if p_section = 'brand' and (jsonb_typeof(p_value) <> 'object'
      or exists (select 1 from jsonb_object_keys(p_value) k where k <> all (public.site_brand_columns()))) then
    raise exception 'invalid_brand' using errcode = '22023';
  end if;
  -- Ofis: tasarım ailesi yalnızca izinli (ve global açık) bir aileye değiştirilebilir. Sitenin
  -- mevcut ailesi (KARAY'ın atadığı) korunarak diğer görünüm ayarları kaydedilebilir.
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

-- Taslağı yayınlar (gövde 20261001000001 ile aynı)
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
  perform public.assert_site_editor(p_org);
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

-- Önceki sürüme döner (gövde 20261001000001 ile aynı)
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
  perform public.assert_site_editor(p_org);
  select r.config into v_config from public.site_config_revisions r where r.organization_id = p_org and r.version = p_version;
  if v_config is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select * into v_row from public.site_configs c where c.organization_id = p_org for update;
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

-- Taslağı canlı sürüme döndürür (gövde 20260930000002 ile aynı)
create or replace function public.site_discard_draft(p_org uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_site_editor(p_org);
  update public.site_configs
     set draft = published, has_unpublished_changes = false, draft_updated_at = now(), draft_updated_by = (select auth.uid())
   where organization_id = p_org;
  perform public.write_audit(p_org, 'site.draft_discarded', 'site', p_org::text, null, '{}'::jsonb);
end;
$$;

-- Sürüm geçmişi: süper admin veya o ofiste settings.manage (başka kiracının sürümleri görünmez)
drop policy if exists "site_config_revisions_read" on public.site_config_revisions;
create policy "site_config_revisions_read" on public.site_config_revisions for select to authenticated
  using ((select public.is_super_admin()) or public.has_org_permission(organization_id, 'settings.manage'));

revoke all on function public.assert_site_editor(uuid) from public, anon;
grant execute on function public.assert_site_editor(uuid) to authenticated;
revoke all on function public.site_save_draft(uuid, text, jsonb) from public, anon;
revoke all on function public.site_publish(uuid, text) from public, anon;
revoke all on function public.site_rollback(uuid, integer) from public, anon;
revoke all on function public.site_discard_draft(uuid) from public, anon;
grant execute on function public.site_save_draft(uuid, text, jsonb) to authenticated;
grant execute on function public.site_publish(uuid, text) to authenticated;
grant execute on function public.site_rollback(uuid, integer) to authenticated;
grant execute on function public.site_discard_draft(uuid) to authenticated;

notify pgrst, 'reload schema';
