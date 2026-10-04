-- =============================================================================
-- P0.4 — Müşteri (ofis sahibi) daveti ve güvenli hesap aktivasyonu
--
-- Önceki akış: KARAY yeni müşteri açarken sahip hesabını GEÇİCİ ŞİFREYLE oluşturuyor ve
-- şifreyi yöneticinin ekranında gösteriyordu. Yeni akış:
--
--   platform_create_organization(..., p_invite_token_hash)
--      → organizasyon + sahip üyeliği + BEKLEYEN davet (tek işlem)
--   platform_send_owner_invitation      → yeni token (eski bağlantı geçersiz) + yeni süre
--   platform_revoke_owner_invitation    → bekleyen daveti iptal eder (hesabı silmez)
--   invitation_lookup / invitation_accept (yalnızca sunucu, service_role)
--      → token özeti ile tek kullanımlık, süreli, e-posta / kiracı / rol bağlı kabul
--
-- Güvenlik:
--   • Ham token veritabanına HİÇ gelmez; uygulama SHA-256 özetini gönderir (token_hash).
--   • Süre politikası tek yerde: invitation_ttl() (72 saat).
--   • Tek kullanım: kabul, "status = 'pending'" koşullu tek UPDATE ile yapılır (yarış güvenli).
--   • Kabul yalnızca: davetin hesabı hâlâ etkinleştirilmemiş (e-posta doğrulanmamış, hiç giriş yok), hesabın e-postası davetin
--     e-postası, üyelik aktif ve rolü davetin rolü ise. Davet şifre sıfırlama yerine kullanılamaz.
--   • Tablo istemciye kapalı: RLS + yalnızca süper admin / users.manage SELECT; token_hash sütunu
--     hiçbir istemci rolüne okunmaz. Yazma yalnızca bu dosyadaki fonksiyonlarla.
--   • Deneme sınırı: başarısız aktivasyon (IP özeti başına 10 dk'da 10) ve gönderim (ofis başına
--     saatte 5) mevcut denetim kaydı (audit_logs) üzerinden sayılır.
--
-- Mevcut kullanıcılar, üyelikler ve şifreler DEĞİŞMEZ (veri taşıma yok).
--
-- Geri alma (yalnızca gerekirse):
--   drop function if exists public.invitation_release(uuid);
--   drop function if exists public.invitation_accept(text, text);
--   drop function if exists public.invitation_lookup(text, text);
--   drop function if exists public.platform_owner_invitation(uuid);
--   drop function if exists public.platform_revoke_owner_invitation(uuid);
--   drop function if exists public.platform_mark_invitation_sent(uuid);
--   drop function if exists public.platform_send_owner_invitation(uuid, text);
--   drop function if exists public.invitation_ttl();
--   drop function if exists public.platform_create_organization(text, text, text, text, uuid, text);
--   -- 20260926000007_v2_security.sql içindeki 5 parametreli platform_create_organization yeniden uygulanır
--   drop table if exists public.organization_invitations;
-- =============================================================================

-- 1) Davet tablosu
create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null check (email = lower(email) and char_length(email) between 3 and 254),
  role public.org_role not null default 'owner' check (role = 'owner'),
  token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  expires_at timestamptz not null,
  last_sent_at timestamptz,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'accepted') = (accepted_at is not null)),
  check ((status = 'revoked') = (revoked_at is not null))
);

create unique index if not exists organization_invitations_token_idx on public.organization_invitations (token_hash);
-- Aynı ofis + e-posta için en fazla bir bekleyen davet
create unique index if not exists organization_invitations_pending_idx
  on public.organization_invitations (organization_id, email) where status = 'pending';
create index if not exists organization_invitations_org_idx on public.organization_invitations (organization_id, created_at desc);
create index if not exists organization_invitations_user_idx on public.organization_invitations (user_id);

drop trigger if exists organization_invitations_updated_at on public.organization_invitations;
create trigger organization_invitations_updated_at before update on public.organization_invitations
  for each row execute function public.set_updated_at();

alter table public.organization_invitations enable row level security;
revoke all on public.organization_invitations from public, anon, authenticated;
-- Okuma: süper admin her şeyi, ofiste users.manage yetkisi olan yalnızca kendi ofisini; token_hash HİÇ
grant select (id, organization_id, user_id, email, role, status, expires_at, last_sent_at, accepted_at, revoked_at, created_by, created_at, updated_at)
  on public.organization_invitations to authenticated;
drop policy if exists organization_invitations_select on public.organization_invitations;
create policy organization_invitations_select on public.organization_invitations
  for select to authenticated
  using (public.is_super_admin() or public.has_org_permission(organization_id, 'users.manage'));
-- INSERT / UPDATE / DELETE politikası yok: yalnızca aşağıdaki security definer fonksiyonlar yazar

-- 2) Süre politikası (tek merkez)
create or replace function public.invitation_ttl()
returns interval
language sql
immutable
set search_path = ''
as $$
  select interval '72 hours';
$$;

-- Hesap henüz etkinleştirilmemiş mi? E-postası hiç doğrulanmamış ve hiç giriş yapmamış (Supabase Auth,
-- şifresiz açılan hesaba kimsenin bilmediği rastgele bir şifre özeti yazar; doğrulanmamış e-postayla
-- şifreli giriş yapılamaz), silinmemiş, engellenmemiş. Aktivasyon e-postayı doğrular → artık false.
create or replace function public._invitation_account_pending(p_user uuid, p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.users u
     where u.id = p_user
       and lower(u.email) = p_email
       and u.email_confirmed_at is null
       and u.last_sign_in_at is null
       and u.deleted_at is null
       and (u.banned_until is null or u.banned_until < now())
  );
$$;
revoke all on function public._invitation_account_pending(uuid, text) from public, anon, authenticated;

-- 3) Organizasyon açma: davet özeti verilirse sahip için bekleyen davet aynı işlemde oluşur
drop function if exists public.platform_create_organization(text, text, text, text, uuid);
create or replace function public.platform_create_organization(
  p_slug text, p_name text, p_prefix text, p_plan text, p_owner uuid, p_invite_token_hash text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_email text;
begin
  perform public.assert_super_admin();
  if not exists (select 1 from public.plans where id = p_plan) then
    raise exception 'invalid_plan' using errcode = 'P0001';
  end if;
  if p_invite_token_hash is not null then
    if p_owner is null or p_invite_token_hash !~ '^[0-9a-f]{64}$' then
      raise exception 'invalid_invitation' using errcode = '22023';
    end if;
    select lower(u.email) into v_email from auth.users u where u.id = p_owner;
    -- Davet yalnızca henüz etkinleştirilmemiş yeni hesap içindir
    if v_email is null or not public._invitation_account_pending(p_owner, v_email) then
      raise exception 'account_active' using errcode = 'P0001';
    end if;
  end if;
  insert into public.organizations (slug, name, reference_prefix, status)
  values (p_slug, p_name, upper(p_prefix), 'active')
  returning id into v_org;
  insert into public.organization_settings (organization_id, display_name) values (v_org, left(p_name, 80));
  insert into public.subscriptions (organization_id, plan_id, status, started_at, trial_ends_at)
  values (v_org, p_plan, 'trialing', now(), now() + interval '14 days');
  if p_owner is not null then
    insert into public.organization_members (organization_id, user_id, role, status)
    values (v_org, p_owner, 'owner', 'active');
  end if;
  perform public.write_audit(null, 'organization.created', 'organization', v_org::text, p_name,
    jsonb_build_object('slug', p_slug, 'plan', p_plan));
  if p_invite_token_hash is not null then
    insert into public.organization_invitations (organization_id, user_id, email, role, token_hash, expires_at, created_by)
    values (v_org, p_owner, v_email, 'owner', p_invite_token_hash, now() + public.invitation_ttl(), (select auth.uid()));
    perform public.write_audit(v_org, 'invitation.created', 'user', p_owner::text, v_email, jsonb_build_object('role', 'owner'));
  end if;
  return v_org;
end;
$$;

-- 4) Davet gönder / tekrar gönder / yeni davet (yalnızca süper admin).
--    Bekleyen davet varsa token ve süre YENİLENİR (eski bağlantı geçersiz olur); iptal edilmiş
--    veya hiç davet yoksa sahip hesabı hâlâ etkinleştirilmemişse yeni davet açılır.
--    E-posta, kullanıcı ve rol istemciden ALINMAZ: sahip üyeliğinden / mevcut davetten okunur.
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
   where i.organization_id = p_org and i.status = 'pending'
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

  if exists (select 1 from public.organization_invitations i where i.organization_id = p_org and i.status = 'accepted') then
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

-- E-posta sağlayıcı kabul ettikten sonra işaretlenir (teslim ve kabul durumu ayrı kavramlar)
create or replace function public.platform_mark_invitation_sent(p_invitation uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform public.assert_super_admin();
  update public.organization_invitations set last_sent_at = now() where id = p_invitation and status = 'pending';
end;
$$;

-- Bekleyen daveti iptal eder; kabul edilmiş davet iptal edilemez, hesap silinmez
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
   where i.organization_id = p_org and i.status = 'pending'
   returning * into v_inv;
  if v_inv.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  perform public.write_audit(p_org, 'invitation.revoked', 'user', v_inv.user_id::text, v_inv.email, jsonb_build_object('invitation_id', v_inv.id));
end;
$$;

-- Platform ekranı: ofisin son sahip daveti (token özeti dönmez); süresi geçmiş bekleyen = expired
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
     where i.organization_id = p_org
     order by (i.status = 'pending') desc, i.created_at desc
     limit 1;
end;
$$;

-- 5) Aktivasyon (yalnızca sunucu: service_role). Geçersiz/eskimiş/kullanılmış/iptal tokenlar
--    AYNI sonucu döndürür (bilgi sızdırmaz); başarısız denemeler IP özetiyle kaydedilir ve sınırlanır.
create or replace function public._invitation_attempt_blocked(p_ip_hash text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_ip_hash is not null and (
    select count(*) from public.audit_logs a
     where a.action = 'invitation.activation_failed' and a.ip_hash = p_ip_hash
       and a.created_at > now() - interval '10 minutes') >= 10;
$$;
revoke all on function public._invitation_attempt_blocked(text) from public, anon, authenticated;

create or replace function public._invitation_log_failure(p_ip_hash text)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.audit_logs (organization_id, action, metadata, ip_hash)
  values (null, 'invitation.activation_failed', '{}'::jsonb, left(p_ip_hash, 128));
$$;
revoke all on function public._invitation_log_failure(text) from public, anon, authenticated;

-- Kullanılabilir davetin satırı (kilitlemeden); tüm koşullar burada
create or replace function public._invitation_usable(p_token_hash text)
returns public.organization_invitations
language sql
stable
security definer
set search_path = ''
as $$
  select i.* from public.organization_invitations i
   where i.token_hash = p_token_hash
     and i.status = 'pending'
     and i.expires_at > now()
     and public._invitation_account_pending(i.user_id, i.email)
     and exists (select 1 from public.organization_members m
                  where m.organization_id = i.organization_id and m.user_id = i.user_id
                    and m.status = 'active' and m.role = i.role)
     and exists (select 1 from public.organizations o where o.id = i.organization_id and o.status = 'active');
$$;
revoke all on function public._invitation_usable(text) from public, anon, authenticated;

create or replace function public.invitation_lookup(p_token_hash text, p_ip_hash text default null)
returns table (result text, email text, organization_name text, expires_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_inv public.organization_invitations;
begin
  if public._invitation_attempt_blocked(p_ip_hash) then
    return query select 'rate_limited'::text, null::text, null::text, null::timestamptz;
    return;
  end if;
  if p_token_hash ~ '^[0-9a-f]{64}$' then
    v_inv := public._invitation_usable(p_token_hash);
  end if;
  if v_inv.id is null then
    perform public._invitation_log_failure(p_ip_hash);
    return query select 'invalid'::text, null::text, null::text, null::timestamptz;
    return;
  end if;
  return query select 'ok'::text, v_inv.email, o.name, v_inv.expires_at
    from public.organizations o where o.id = v_inv.organization_id;
end;
$$;

-- Tek kullanımlık kabul: koşullu tek UPDATE (eşzamanlı iki istekte yalnızca biri satır alır)
create or replace function public.invitation_accept(p_token_hash text, p_ip_hash text default null)
returns table (result text, invitation_id uuid, organization_id uuid, user_id uuid, email text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_inv public.organization_invitations;
begin
  if public._invitation_attempt_blocked(p_ip_hash) then
    return query select 'rate_limited'::text, null::uuid, null::uuid, null::uuid, null::text;
    return;
  end if;
  if p_token_hash ~ '^[0-9a-f]{64}$' then
    v_inv := public._invitation_usable(p_token_hash);
  end if;
  if v_inv.id is not null then
    update public.organization_invitations i
       set status = 'accepted', accepted_at = now()
     where i.id = v_inv.id and i.status = 'pending' and i.token_hash = p_token_hash and i.expires_at > now()
     returning * into v_inv;
  end if;
  if v_inv.id is null or v_inv.status <> 'accepted' then
    perform public._invitation_log_failure(p_ip_hash);
    return query select 'invalid'::text, null::uuid, null::uuid, null::uuid, null::text;
    return;
  end if;
  insert into public.audit_logs (organization_id, actor_id, actor_label, action, target_type, target_id, target_label, metadata, ip_hash)
  values (v_inv.organization_id, v_inv.user_id, public.audit_actor_label(v_inv.user_id), 'invitation.accepted', 'user',
          v_inv.user_id::text, v_inv.email, jsonb_build_object('invitation_id', v_inv.id, 'role', v_inv.role), left(p_ip_hash, 128));
  return query select 'ok'::text, v_inv.id, v_inv.organization_id, v_inv.user_id, v_inv.email;
end;
$$;

-- Telafi: kabulden sonra şifre atanamadıysa (ör. Supabase Auth şifreyi zayıf buldu) davet
-- yeniden bekler — yalnızca hesap hâlâ etkinleştirilmemişse ve kabul az önce yapıldıysa
create or replace function public.invitation_release(p_invitation uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.organization_invitations i
     set status = 'pending', accepted_at = null
   where i.id = p_invitation and i.status = 'accepted'
     and i.accepted_at > now() - interval '5 minutes'
     and public._invitation_account_pending(i.user_id, i.email);
$$;

revoke all on function public.invitation_ttl() from public, anon;
grant execute on function public.invitation_ttl() to authenticated, service_role;
revoke all on function public.platform_create_organization(text, text, text, text, uuid, text) from public, anon;
grant execute on function public.platform_create_organization(text, text, text, text, uuid, text) to authenticated;
revoke all on function public.platform_send_owner_invitation(uuid, text) from public, anon;
grant execute on function public.platform_send_owner_invitation(uuid, text) to authenticated;
revoke all on function public.platform_mark_invitation_sent(uuid) from public, anon;
grant execute on function public.platform_mark_invitation_sent(uuid) to authenticated;
revoke all on function public.platform_revoke_owner_invitation(uuid) from public, anon;
grant execute on function public.platform_revoke_owner_invitation(uuid) to authenticated;
revoke all on function public.platform_owner_invitation(uuid) from public, anon;
grant execute on function public.platform_owner_invitation(uuid) to authenticated;
-- Token ile çalışan fonksiyonlar istemciye KAPALI: yalnızca sunucu (service_role)
revoke all on function public.invitation_lookup(text, text) from public, anon, authenticated;
grant execute on function public.invitation_lookup(text, text) to service_role;
revoke all on function public.invitation_accept(text, text) from public, anon, authenticated;
grant execute on function public.invitation_accept(text, text) to service_role;
revoke all on function public.invitation_release(uuid) from public, anon, authenticated;
grant execute on function public.invitation_release(uuid) to service_role;

notify pgrst, 'reload schema';
