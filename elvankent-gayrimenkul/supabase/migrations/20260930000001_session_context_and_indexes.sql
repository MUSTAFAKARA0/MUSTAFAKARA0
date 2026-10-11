-- =============================================================================
-- Performans: oturum bağlamı tek sorguda + eksik indeksler
--
-- Ölçülen sorun: her panel sayfası, asıl veriden önce oturum/ofis bilgisini
-- 4–5 ARDIŞIK sorguyla alıyordu (profil → üyelikler → ofis + yetkiler + plan →
-- marka ayarları). Supabase ile uygulama arasındaki her gidiş-dönüş bu süreye
-- eklendiği için sayfa geçişleri gecikiyordu.
--
-- session_context(): aynı bilgileri TEK çağrıda döndürür.
--   • SECURITY INVOKER: çağıranın kendi yetkileriyle (RLS) çalışır; öncekiyle aynı
--     satırları görür, fazlasını görmez. Yalnızca çağıranın (auth.uid()) verisi döner.
--   • Aktif ofis seçimi öncekiyle aynı kurala göre yapılır: tercih edilen ofis
--     (çerez) → bulunulan alan adının ofisi → ilk aktif üyelik; üyelik yoksa seçilmez.
--
-- Ayrıca yabancı anahtar / sık süzülen sütunlar için eksik indeksler.
-- Tekrar çalıştırılabilir; veri değiştirmez. Uygulama bu fonksiyon yoksa eski
-- (ardışık) sorgulara döner — migration öncesi ve sonrası çalışır.
-- Geri dönüş: dosyanın sonunda.
-- =============================================================================

create or replace function public.session_context(p_preferred_org uuid default null, p_host_key text default null)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_profile jsonb;
  v_members jsonb;
  v_host uuid;
  v_org uuid;
  v_role public.org_role;
begin
  if v_uid is null then
    return null;
  end if;

  select jsonb_build_object('full_name', p.full_name, 'is_super_admin', p.is_super_admin, 'password_change_required', p.password_change_required)
    into v_profile
    from public.profiles p
   where p.id = v_uid;

  select coalesce(jsonb_agg(jsonb_build_object(
           'org_id', o.id, 'slug', o.slug, 'name', o.name, 'status', o.status,
           'role', m.role, 'require_admin_mfa', o.require_admin_mfa) order by m.created_at, o.name), '[]'::jsonb)
    into v_members
    from public.organization_members m
    join public.organizations o on o.id = m.organization_id
   where m.user_id = v_uid and m.status = 'active';

  -- Bulunulan alan adının / adresin ofisi (yalnızca üyesi olduğu ofislerde anlamlı)
  if p_host_key is not null then
    select o.id into v_host
      from public.organizations o
     where o.slug = p_host_key
        or o.id = (select d.organization_id from public.organization_domains d where d.hostname = lower(p_host_key) limit 1)
     limit 1;
  end if;

  -- Aktif ofis: tercih → alan adı → ilk aktif üyelik (ofis durumu 'active')
  select (e->>'org_id')::uuid, (e->>'role')::public.org_role
    into v_org, v_role
    from jsonb_array_elements(v_members) with ordinality as x(e, n)
   where e->>'status' = 'active'
   order by ((e->>'org_id')::uuid = p_preferred_org) desc nulls last,
            ((e->>'org_id')::uuid = v_host) desc nulls last,
            n
   limit 1;

  return jsonb_build_object(
    'profile', v_profile,
    'memberships', v_members,
    'org', case when v_org is null then null else (
      select jsonb_build_object('id', o.id, 'slug', o.slug, 'name', o.name, 'reference_prefix', o.reference_prefix)
        from public.organizations o where o.id = v_org) end,
    'role', v_role,
    'permissions', case when v_org is null then '[]'::jsonb else (
      select coalesce(jsonb_agg(rp.permission order by rp.permission), '[]'::jsonb)
        from public.role_permissions rp where rp.role = v_role) end,
    'plan', case when v_org is null then null else (
      select to_jsonb(pl) from public.org_plan(v_org) pl limit 1) end,
    'brand', case when v_org is null then null else (
      select jsonb_build_object('display_name', s.display_name, 'logo_url', s.logo_url, 'favicon_url', s.favicon_url,
                                'primary_color', s.primary_color, 'accent_color', s.accent_color)
        from public.organization_settings s where s.organization_id = v_org) end
  );
end;
$$;

revoke all on function public.session_context(uuid, text) from public, anon;
grant execute on function public.session_context(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Eksik indeksler (yabancı anahtarlar ve sık süzülen sütunlar)
-- -----------------------------------------------------------------------------
create index if not exists lead_activities_org_created_idx on public.lead_activities (organization_id, created_at desc);
create index if not exists property_price_history_org_idx on public.property_price_history (organization_id);
create index if not exists appointments_lead_idx on public.appointments (lead_id) where lead_id is not null;
create index if not exists appointments_property_idx on public.appointments (property_id) where property_id is not null;
create index if not exists appointments_assigned_idx on public.appointments (assigned_to) where assigned_to is not null;
create index if not exists leads_assigned_idx on public.leads (assigned_to) where assigned_to is not null;
create index if not exists collections_customer_idx on public.collections (customer_id) where customer_id is not null;
create index if not exists favorites_property_idx on public.favorites (property_id);
create index if not exists subscriptions_plan_idx on public.subscriptions (plan_id);
create index if not exists posts_cover_media_idx on public.posts (cover_media_id) where cover_media_id is not null;
create index if not exists properties_og_media_idx on public.properties (og_media_id) where og_media_id is not null;

notify pgrst, 'reload schema';

-- =============================================================================
-- GERİ DÖNÜŞ (gerekirse):
--   drop function if exists public.session_context(uuid, text);
--   -- indeksler zararsızdır; kaldırmak için: drop index if exists public.<ad>;
--   notify pgrst, 'reload schema';
-- Uygulama fonksiyon yoksa eski sorgulara döner.
-- =============================================================================
