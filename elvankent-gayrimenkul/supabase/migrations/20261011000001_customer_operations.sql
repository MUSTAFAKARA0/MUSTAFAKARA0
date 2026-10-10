-- =============================================================================
-- FAZ 1 — Ticari operasyon: ekip daveti, müşteri genel görünümü, kurulum adımları, yönetici notları
--
-- 1) Ekip üyesi daveti (geçici şifre yerine): organization_invitations artık her rol için.
--    org_send_member_invitation yalnızca SUNUCU anahtarıyla çağrılır; işlemi yapan kişinin
--    (oturumdan) ofiste users.manage yetkisi AYRICA burada doğrulanır. Kabul akışı P0.4 ile aynı
--    (invitation_accept / invitation_lookup rolden bağımsızdır).
--    Sahip daveti fonksiyonları (platform_*_owner_invitation) yalnızca role = 'owner' satırlarını görür.
-- 2) _org_onboarding_flags: sitenin kurulum adımları (marka taslağı canlı ayarların üzerine bindirilir)
--    — ofis paneli (org_onboarding) ve KARAY konsolu (platform_customer_overview) AYNI hesabı kullanır.
-- 3) platform_customer_overview: KARAY yöneticisi için müşteri başına sahip / site / alan adı /
--    kurulum / not durumu (yalnızca süper admin).
-- 4) platform_org_notes: müşteri başına yönetici notları (yalnızca süper admin; ekleme + okuma,
--    düzenleme/silme yok — destek geçmişi değişmez).
-- 5) org_member_account_states: ofis kullanıcı listesinde "davet bekliyor" durumu (users.manage).
--
-- Mevcut veri değişmez; tekrar çalıştırılabilir.
--
-- Geri dönüş:
--   drop function if exists public.platform_customer_overview(), public.org_onboarding(uuid),
--     public._org_onboarding_flags(uuid), public.org_send_member_invitation(uuid, uuid, uuid, text),
--     public.org_mark_member_invitation_sent(uuid),
--     public.org_member_account_states(uuid);
--   drop table if exists public.platform_org_notes;
--   (sahip davet fonksiyonları 20261008000001 dosyasından yeniden uygulanır;
--    alter table public.organization_invitations add constraint organization_invitations_role_check check (role = 'owner'));
-- =============================================================================

-- 1a) Davet tablosu her rolü kabul eder
alter table public.organization_invitations drop constraint if exists organization_invitations_role_check;

-- 1b) Ekip üyesi daveti
create or replace function public.org_send_member_invitation(p_actor uuid, p_org uuid, p_user uuid, p_token_hash text)
returns table (invitation_id uuid, email text, role public.org_role, expires_at timestamptz, resent boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_role public.org_role;
  v_member public.organization_members;
  v_email text;
  v_prev uuid;
  v_inv public.organization_invitations;
begin
  if p_actor is null or p_org is null or p_user is null or p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_invitation' using errcode = '22023';
  end if;
  -- İşlemi yapan: bu ofiste aktif, users.manage yetkili üye (ofis aktif)
  select m.role into v_actor_role
    from public.organization_members m
    join public.organizations o on o.id = m.organization_id and o.status = 'active'
    join public.role_permissions rp on rp.role = m.role and rp.permission = 'users.manage'
   where m.organization_id = p_org and m.user_id = p_actor and m.status = 'active';
  if v_actor_role is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_actor = p_user then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_member from public.organization_members m
   where m.organization_id = p_org and m.user_id = p_user and m.status = 'active';
  if v_member.user_id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  -- Sahip rolündeki kişiye yalnızca bir sahip davet gönderebilir
  if v_member.role = 'owner' and v_actor_role <> 'owner' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select lower(u.email) into v_email from auth.users u where u.id = p_user;
  if v_email is null or not public._invitation_account_pending(p_user, v_email) then
    raise exception 'account_active' using errcode = 'P0001';
  end if;
  -- Kötüye kullanım sınırı: ofis başına saatte 20 ekip daveti
  if (select count(*) from public.audit_logs a
       where a.organization_id = p_org and a.action = 'invitation.member_sent'
         and a.created_at > now() - interval '1 hour') >= 20 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  -- Önceki bekleyen davet geçersiz olur (eski bağlantı çalışmaz)
  update public.organization_invitations i
     set status = 'revoked', revoked_at = now()
   where i.organization_id = p_org and i.email = v_email and i.status = 'pending'
   returning i.id into v_prev;

  -- last_sent_at sunucu e-postayı GERÇEKTEN gönderdikten sonra yazılır (gönderilemezse "gönderilmedi")
  insert into public.organization_invitations (organization_id, user_id, email, role, token_hash, expires_at, created_by)
  values (p_org, p_user, v_email, v_member.role, p_token_hash, now() + public.invitation_ttl(), p_actor)
  returning * into v_inv;
  insert into public.audit_logs (organization_id, actor_id, actor_label, action, target_type, target_id, target_label, metadata)
  values (p_org, p_actor, public.audit_actor_label(p_actor), 'invitation.member_sent', 'user', p_user::text, v_email,
          jsonb_build_object('invitation_id', v_inv.id, 'role', v_inv.role, 'resent', v_prev is not null));
  return query select v_inv.id, v_inv.email, v_inv.role, v_inv.expires_at, v_prev is not null;
end;
$$;
revoke all on function public.org_send_member_invitation(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.org_send_member_invitation(uuid, uuid, uuid, text) to service_role;

-- E-posta sağlayıcıya teslim edildikten sonra (yalnızca sunucu anahtarıyla)
create or replace function public.org_mark_member_invitation_sent(p_invitation uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.organization_invitations i set last_sent_at = now()
   where i.id = p_invitation and i.status = 'pending';
$$;
revoke all on function public.org_mark_member_invitation_sent(uuid) from public, anon, authenticated;
grant execute on function public.org_mark_member_invitation_sent(uuid) to service_role;

-- 1c) Ofis kullanıcı listesi: hesabı henüz etkinleştirilmemiş üyeler ve son davetleri
create or replace function public.org_member_account_states(p_org uuid)
returns table (user_id uuid, account_pending boolean, invitation_status text, invitation_expires_at timestamptz, invitation_sent_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (public.is_super_admin() or public.has_org_permission(p_org, 'users.manage')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select m.user_id,
           public._invitation_account_pending(m.user_id, lower(u.email)),
           case when i.status = 'pending' and i.last_sent_at is null then 'not_sent'
                when i.status = 'pending' and i.expires_at <= now() then 'expired' else i.status end,
           i.expires_at, i.last_sent_at
      from public.organization_members m
      join auth.users u on u.id = m.user_id
      left join lateral (
        select i2.status, i2.expires_at, i2.last_sent_at from public.organization_invitations i2
         where i2.organization_id = m.organization_id and i2.user_id = m.user_id and i2.status <> 'revoked'
         order by i2.created_at desc limit 1) i on true
     where m.organization_id = p_org;
end;
$$;
revoke all on function public.org_member_account_states(uuid) from public, anon;
grant execute on function public.org_member_account_states(uuid) to authenticated;

-- 2) Kurulum adımları (taslak marka canlı ayarların üzerine bindirilir)
create or replace function public._org_onboarding_flags(p_org uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with s as (select * from public.organization_settings where organization_id = p_org),
       c as (select * from public.site_configs where organization_id = p_org),
       b as (select coalesce((select c.draft->'brand' from c), '{}'::jsonb) as brand),
       eff as (
         select nullif(trim(coalesce(b.brand->>'display_name', s.display_name)), '') as display_name,
                nullif(trim(coalesce(b.brand->>'phone', s.phone)), '') as phone,
                nullif(trim(coalesce(b.brand->>'email', s.email)), '') as email,
                nullif(trim(coalesce(b.brand->>'address_line', s.address_line)), '') as address_line,
                nullif(trim(coalesce(b.brand->>'address_city', s.address_city)), '') as address_city,
                nullif(trim(coalesce(b.brand->>'logo_url', s.logo_url)), '') as logo_url
           from b left join s on true)
  select jsonb_build_object(
    'company', (select display_name is not null and (phone is not null or email is not null) from eff),
    'logo', (select logo_url is not null from eff),
    'contact', (select phone is not null and (address_line is not null or address_city is not null) from eff),
    'design', coalesce((select (c.draft ? 'theme') or (c.published ? 'theme') from c), false),
    'seo', coalesce((select nullif(trim(coalesce(c.draft->'seo'->>'title', c.published->'seo'->>'title', '')), '') is not null
                         or nullif(trim(coalesce(c.draft->'seo'->>'description', c.published->'seo'->>'description', '')), '') is not null from c), false),
    'listing', exists (select 1 from public.properties p where p.organization_id = p_org and p.status = 'published'
                         and p.deleted_at is null and not p.is_demo),
    'published', coalesce((select c.published_version > 0 from c), false),
    'pending_changes', coalesce((select c.has_unpublished_changes from c), false),
    'domain', exists (select 1 from public.organization_domains d where d.organization_id = p_org and d.status = 'active'),
    'domain_available', coalesce((select pl.custom_domain_enabled from public.org_plan(p_org) pl limit 1), false),
    'live', coalesce((select c.site_status = 'active' from c), false)
          and exists (select 1 from public.organizations o where o.id = p_org and o.status = 'active')
  );
$$;
revoke all on function public._org_onboarding_flags(uuid) from public, anon, authenticated;

create or replace function public.org_onboarding(p_org uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (public.is_super_admin() or public.has_org_permission(p_org, 'settings.manage')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return public._org_onboarding_flags(p_org);
end;
$$;
revoke all on function public.org_onboarding(uuid) from public, anon;
grant execute on function public.org_onboarding(uuid) to authenticated;

-- 3) Yönetici notları (müşteri başına destek / teslim geçmişi)
create table if not exists public.platform_org_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists platform_org_notes_org_idx on public.platform_org_notes (organization_id, created_at desc);
alter table public.platform_org_notes enable row level security;
revoke all on public.platform_org_notes from public, anon, authenticated;
grant select, insert on public.platform_org_notes to authenticated;
drop policy if exists platform_org_notes_select on public.platform_org_notes;
create policy platform_org_notes_select on public.platform_org_notes for select to authenticated
  using (public.is_super_admin());
drop policy if exists platform_org_notes_insert on public.platform_org_notes;
create policy platform_org_notes_insert on public.platform_org_notes for insert to authenticated
  with check (public.is_super_admin() and author_id = (select auth.uid()));

-- 4) Müşteri genel görünümü (KARAY konsolu)
create or replace function public.platform_customer_overview()
returns table (
  organization_id uuid, owner_user_id uuid, owner_email text, owner_pending boolean,
  invitation_status text, invitation_expires_at timestamptz,
  site_status text, published_version integer, published_at timestamptz,
  domains_active integer, domains_waiting integer, domain_waiting_since timestamptz,
  onboarding jsonb, notes_count integer, last_note_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_super_admin();
  return query
    select o.id, ow.user_id, ow.email, coalesce(public._invitation_account_pending(ow.user_id, ow.email), false),
           -- not_sent: organizasyonla birlikte açılan davet henüz e-postayla gönderilmedi (bağlantısı yok)
           case when inv.status = 'pending' and inv.last_sent_at is null then 'not_sent'
                when inv.status = 'pending' and inv.expires_at <= now() then 'expired' else inv.status end,
           inv.expires_at,
           coalesce(c.site_status, 'active'), coalesce(c.published_version, 0), c.published_at,
           (select count(*)::int from public.organization_domains d where d.organization_id = o.id and d.status = 'active'),
           (select count(*)::int from public.organization_domains d where d.organization_id = o.id and d.status <> 'active'),
           (select min(d.created_at) from public.organization_domains d where d.organization_id = o.id and d.status <> 'active'),
           public._org_onboarding_flags(o.id),
           (select count(*)::int from public.platform_org_notes n where n.organization_id = o.id),
           (select max(n.created_at) from public.platform_org_notes n where n.organization_id = o.id)
      from public.organizations o
      left join public.site_configs c on c.organization_id = o.id
      left join lateral (
        select m.user_id, lower(u.email) as email from public.organization_members m join auth.users u on u.id = m.user_id
         where m.organization_id = o.id and m.role = 'owner' and m.status = 'active'
         order by m.created_at limit 1) ow on true
      left join lateral (
        select i.status, i.expires_at, i.last_sent_at from public.organization_invitations i
         where i.organization_id = o.id and i.role = 'owner' and i.status <> 'revoked'
         order by i.created_at desc limit 1) inv on true
     order by o.created_at;
end;
$$;
revoke all on function public.platform_customer_overview() from public, anon;
grant execute on function public.platform_customer_overview() to authenticated;

-- 5) Sahip daveti fonksiyonları: yalnızca sahip (owner) davetleri (ekip davetleri karışmaz)
create or replace function public.platform_owner_invitation(p_org uuid)
returns table (id uuid, email text, status text, expires_at timestamptz, last_sent_at timestamptz,
               accepted_at timestamptz, revoked_at timestamptz, created_at timestamptz, account_pending boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_super_admin();
  return query
    select i.id, i.email,
           case when i.status = 'pending' and i.expires_at <= now() then 'expired' else i.status end,
           i.expires_at, i.last_sent_at, i.accepted_at, i.revoked_at, i.created_at,
           public._invitation_account_pending(i.user_id, i.email)
      from public.organization_invitations i
     where i.organization_id = p_org and i.role = 'owner'
     order by (i.status = 'pending') desc, i.created_at desc
     limit 1;
end;
$$;

create or replace function public.platform_send_owner_invitation(p_org uuid, p_token_hash text)
returns table (invitation_id uuid, email text, expires_at timestamptz, resent boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_inv public.organization_invitations;
  v_user uuid;
  v_email text;
begin
  perform public.assert_super_admin();
  if p_org is null or p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_invitation' using errcode = '22023';
  end if;
  if not exists (select 1 from public.organizations o where o.id = p_org and o.status = 'active') then
    raise exception 'invalid_organization' using errcode = 'P0001';
  end if;
  -- Kötüye kullanım sınırı: ofis başına saatte 5 gönderim
  if (select count(*) from public.audit_logs a
       where a.organization_id = p_org and a.action in ('invitation.sent', 'invitation.resent')
         and a.created_at > now() - interval '1 hour') >= 5 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  select * into v_inv from public.organization_invitations i
   where i.organization_id = p_org and i.status = 'pending' and i.role = 'owner'
   order by i.created_at desc limit 1
   for update;

  if found then
    if not public._invitation_account_pending(v_inv.user_id, v_inv.email)
       or not exists (select 1 from public.organization_members m
                       where m.organization_id = p_org and m.user_id = v_inv.user_id and m.status = 'active' and m.role = v_inv.role) then
      raise exception 'account_active' using errcode = 'P0001';
    end if;
    update public.organization_invitations i
       set token_hash = p_token_hash, expires_at = now() + public.invitation_ttl()
     where i.id = v_inv.id
     returning * into v_inv;
    perform public.write_audit(p_org, case when v_inv.last_sent_at is null then 'invitation.sent' else 'invitation.resent' end,
      'user', v_inv.user_id::text, v_inv.email, jsonb_build_object('invitation_id', v_inv.id));
    return query select v_inv.id, v_inv.email, v_inv.expires_at, v_inv.last_sent_at is not null;
    return;
  end if;

  if exists (select 1 from public.organization_invitations i where i.organization_id = p_org and i.status = 'accepted' and i.role = 'owner') then
    raise exception 'invitation_accepted' using errcode = 'P0001';
  end if;
  -- Yeni davet: aktif sahip üyeliği olan, henüz etkinleştirilmemiş hesap
  select m.user_id, lower(u.email) into v_user, v_email
    from public.organization_members m join auth.users u on u.id = m.user_id
   where m.organization_id = p_org and m.role = 'owner' and m.status = 'active'
   order by m.created_at limit 1;
  if v_user is null then
    raise exception 'owner_not_found' using errcode = 'P0001';
  end if;
  if not public._invitation_account_pending(v_user, v_email) then
    raise exception 'account_active' using errcode = 'P0001';
  end if;
  insert into public.organization_invitations (organization_id, user_id, email, role, token_hash, expires_at, created_by)
  values (p_org, v_user, v_email, 'owner', p_token_hash, now() + public.invitation_ttl(), (select auth.uid()))
  returning * into v_inv;
  perform public.write_audit(p_org, 'invitation.created', 'user', v_user::text, v_email, jsonb_build_object('role', 'owner'));
  perform public.write_audit(p_org, 'invitation.sent', 'user', v_user::text, v_email, jsonb_build_object('invitation_id', v_inv.id));
  return query select v_inv.id, v_inv.email, v_inv.expires_at, false;
end;
$$;

create or replace function public.platform_revoke_owner_invitation(p_org uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_inv public.organization_invitations;
begin
  perform public.assert_super_admin();
  update public.organization_invitations i
     set status = 'revoked', revoked_at = now()
   where i.organization_id = p_org and i.status = 'pending' and i.role = 'owner'
   returning * into v_inv;
  if v_inv.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  perform public.write_audit(p_org, 'invitation.revoked', 'user', v_inv.user_id::text, v_inv.email, jsonb_build_object('invitation_id', v_inv.id));
end;
$$;

-- Şema sürümü
create or replace function public.karay_schema_version()
returns text
language sql
immutable
set search_path = ''
as $$ select '20261011000001'::text $$;
revoke all on function public.karay_schema_version() from public;
grant execute on function public.karay_schema_version() to anon, authenticated, service_role;
