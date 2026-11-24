-- =============================================================================
-- KI-46 · Kiracı izolasyonu: kalan düşük bulgular (J)
--
-- BEKLEYEN migration: supabase/migrations/ altında DEĞİL, canlıya uygulanmaz. Yayına sahibin onayı ve
-- supabase/ops/tenant_hardening/ betikleriyle alınır. Başka bekleyen dosyaya bağlı değildir.
--
-- 08.11 bağımsız denetimin (security-reviewer + database-reviewer) "açık kalan (düşük)" maddeleri:
--   1. get_public_collection öğe sorgusuna kurum koşulu (okuma tarafında ikinci kat)
--   2. leads / appointments.assigned_to: atanan kişi kurumun aktif üyesi olmalı (tetikleyici)
--   3. anon'un organization_settings / organization_domains SELECT yetkisi kaldırılır (politika yoktu, 0 satır)
--   4. neighborhoods ekleme politikası kaldırılır (resmî konum verisi; uygulama hiç eklemiyor)
-- Veri değiştirmez. Tekrar çalıştırılabilir.
--
-- GERİ DÖNÜŞ: (05_rollback.sql — ayrıca get_public_collection'ın önceki gövdesi, anon SELECT yetkileri ve mahalle ekleme
-- politikası geri kurulur)
--   drop trigger if exists leads_assignee_guard on public.leads;
--   drop trigger if exists appointments_assignee_guard on public.appointments;
--   drop function if exists public.crm_assignee_guard();
-- =============================================================================

-- (1) Paylaşılan seçki: öğeler yalnız seçkinin kurumuna ait ilanlardan gelir (bugün collection_items tetikleyicisi
--     zaten engeller; bu, okuma tarafında ikinci kat koruma).
create or replace function public.get_public_collection(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_col public.collections;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{32,64}$' then
    return jsonb_build_object('status', 'not_found');
  end if;

  select c.* into v_col
    from public.collections c
    join public.organizations o on o.id = c.organization_id and o.status = 'active'
   where c.token = p_token;

  if v_col.id is null then
    return jsonb_build_object('status', 'not_found');
  end if;
  if v_col.revoked_at is not null then
    return jsonb_build_object('status', 'revoked', 'organization_id', v_col.organization_id);
  end if;
  if v_col.expires_at is not null and v_col.expires_at < now() then
    return jsonb_build_object('status', 'expired', 'organization_id', v_col.organization_id);
  end if;

  update public.collections set view_count = view_count + 1, last_viewed_at = now() where id = v_col.id;

  return jsonb_build_object(
    'status', 'ok',
    'organization_id', v_col.organization_id,
    'title', v_col.title,
    'message', v_col.message,
    'created_at', v_col.created_at,
    'expires_at', v_col.expires_at,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object('property_id', i.property_id, 'note', i.note) order by i.sort_order, i.created_at)
        from public.collection_items i
        join public.properties p on p.id = i.property_id and p.organization_id = v_col.organization_id
       where i.collection_id = v_col.id
         and p.status in ('published', 'sold', 'rented') and p.deleted_at is null
    ), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.get_public_collection(text) from public;
grant execute on function public.get_public_collection(text) to anon, authenticated;

-- (2) Talep ve randevu ataması: atanan kişi kaydın kurumunun AKTİF üyesi olmalı. Uygulama (assertMember) bunu zaten
--     denetler; tetikleyici doğrudan API yazımlarında da geçerli kılar. Yalnız atama değiştiğinde denetlenir: üyeliği
--     sonradan kapatılan kişiye eski atamalar kalabilir (silinmez), yeni atama yapılamaz.
create or replace function public.crm_assignee_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.assigned_to is not null
     and (tg_op = 'INSERT' or new.assigned_to is distinct from old.assigned_to)
     and not exists (
       select 1 from public.organization_members m
        where m.organization_id = new.organization_id and m.user_id = new.assigned_to and m.status = 'active'
     ) then
    raise exception 'assignee_not_member' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.crm_assignee_guard() from public, anon, authenticated, service_role;

drop trigger if exists leads_assignee_guard on public.leads;
create trigger leads_assignee_guard before insert or update of assigned_to on public.leads
  for each row execute function public.crm_assignee_guard();
drop trigger if exists appointments_assignee_guard on public.appointments;
create trigger appointments_assignee_guard before insert or update of assigned_to on public.appointments
  for each row execute function public.crm_assignee_guard();

-- (3) Ziyaretçi (anon) ofis ayarları ve alan adı tablolarını doğrudan okuyamaz. Herkese açık site bu bilgileri
--     public_tenant_settings / public_tenant_domains fonksiyonlarıyla alır; tablolarda anon politikası yoktu (0 satır).
--     organizations'ta anon SELECT kalır: /api/health sağlık sorgusu onu kullanır (politika yok, 0 satır döner).
revoke select on public.organization_settings, public.organization_domains from anon;

-- (4) Mahalle listesi resmî konum verisidir; ofis kullanıcıları yeni mahalle ekleyemez (uygulama hiç eklemiyor).
--     Ekleme yalnız service_role / içe aktarma betiğiyle (scripts/import-locations.mjs).
drop policy if exists "neighborhoods_insert_members" on public.neighborhoods;

notify pgrst, 'reload schema';
