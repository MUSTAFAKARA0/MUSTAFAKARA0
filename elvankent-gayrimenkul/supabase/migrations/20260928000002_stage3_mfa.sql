-- =============================================================================
-- Stage 3 / 2 — Yönetici iki adımlı doğrulama (MFA / TOTP)
--
-- Supabase Auth TOTP faktörlerini kullanır. Veritabanı katmanında zorunluluk:
--   1) Doğrulanmış MFA faktörü olan bir kullanıcı, oturumu "aal2" (kod girilmiş)
--      değilse hiçbir organizasyon verisine erişemez.
--   2) Organizasyon "yöneticiler için MFA zorunlu" ise sahip (owner) ve
--      yönetici (admin) rolündekiler aal2 olmadan erişemez.
-- Bu kurallar RLS'in merkezindeki user_org_ids() fonksiyonuna eklenir; böylece
-- tüm tablo ve depolama politikaları otomatik uygular (API'ye doğrudan istekle
-- atlatılamaz). Süper admin yetkisi (is_super_admin) için de 1. kural geçerlidir.
--
-- MFA kullanmayan ve zorunluluk olmayan kullanıcıların davranışı DEĞİŞMEZ.
-- Tekrar çalıştırılması güvenlidir.
-- =============================================================================

alter table public.organizations
  add column if not exists require_admin_mfa boolean not null default false;

-- Oturumun doğrulama seviyesi (JWT "aal" talebi). Talep yoksa aal1 sayılır.
create or replace function public.session_aal()
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce((select auth.jwt()) ->> 'aal', 'aal1');
$$;

-- Kullanıcının doğrulanmış (kurulumu tamamlanmış) MFA faktörü var mı
create or replace function public.user_has_mfa()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.mfa_factors f
     where f.user_id = (select auth.uid()) and f.status = 'verified'
  );
$$;

create or replace function public.user_org_ids(p_permission text default null)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.organization_id
    from public.organization_members m
    join public.organizations o on o.id = m.organization_id and o.status = 'active'
   where m.user_id = (select auth.uid())
     and m.status = 'active'
     and (
       p_permission is null
       or exists (
         select 1 from public.role_permissions rp
          where rp.role = m.role and rp.permission = p_permission
       )
     )
     and (
       (select public.session_aal()) = 'aal2'
       or (
         not (select public.user_has_mfa())
         and not (o.require_admin_mfa and m.role in ('owner', 'admin'))
       )
     );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.is_super_admin from public.profiles p where p.id = (select auth.uid())), false)
     and ((select public.session_aal()) = 'aal2' or not (select public.user_has_mfa()));
$$;

-- Sahip, zorunluluğu açıp kapatabilir. Kilitlenmeyi önlemek için işlemi yapan
-- sahibin kendi oturumu aal2 olmalıdır (önce kendisi MFA kurmuş olmalı).
create or replace function public.set_require_admin_mfa(p_org uuid, p_value boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.organization_members m
     where m.organization_id = p_org and m.user_id = (select auth.uid())
       and m.status = 'active' and m.role = 'owner'
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if (select public.session_aal()) <> 'aal2' then
    raise exception 'mfa_required' using errcode = 'P0001';
  end if;
  update public.organizations set require_admin_mfa = p_value where id = p_org;
  perform public.write_audit(p_org, 'settings.updated', 'settings', p_org::text, null,
    jsonb_build_object('fields', jsonb_build_array('require_admin_mfa'), 'value', p_value));
end;
$$;

-- Ekip listesinde MFA durumu (yalnızca kullanıcı yönetimi yetkisi olanlar)
create or replace function public.org_member_mfa_status(p_org uuid)
returns table (user_id uuid, mfa_enabled boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_org_permission(p_org, 'users.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select m.user_id,
           exists (select 1 from auth.mfa_factors f where f.user_id = m.user_id and f.status = 'verified')
      from public.organization_members m
     where m.organization_id = p_org;
end;
$$;

revoke all on function public.set_require_admin_mfa(uuid, boolean) from public, anon;
revoke all on function public.org_member_mfa_status(uuid) from public, anon;
revoke all on function public.user_has_mfa() from public, anon;
grant execute on function public.set_require_admin_mfa(uuid, boolean) to authenticated;
grant execute on function public.org_member_mfa_status(uuid) to authenticated;
grant execute on function public.user_has_mfa() to authenticated;
grant execute on function public.session_aal() to anon, authenticated;
