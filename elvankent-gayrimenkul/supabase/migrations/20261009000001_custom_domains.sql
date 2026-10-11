-- =============================================================================
-- P0.5 — Özel alan adı bağlama (doğrulama → bağlantı → kiracı çözümlemesi)
--
-- Önceki durum: organization_domains vardı; süper admin eklediği anda verified_at = now()
-- yazılıyordu (sahiplik doğrulaması yok), "doğrulandı" ile "trafik bağlandı" ayrımı yoktu ve
-- hostname tüm durumlarda tekildi (bekleyen bir kayıt alan adını kalıcı olarak kilitliyordu).
--
-- Yeni yaşam döngüsü (AYNI tablo genişletilir; ikinci bir alan adı sistemi yoktur):
--   pending  → alan adı eklendi; TXT doğrulama kodu bekleniyor (süreli)
--   verified → _karay-verification TXT kaydı doğrulandı (sahiplik)
--   active   → DNS yönlendirmesi KARAY'a bağlı; site bu adreste açılır
-- Yalnızca ACTIVE alan adı kiracıya çözülür (public_tenant, public_tenant_domains).
--
-- Güvenlik:
--   • Doğrulama kodu (TXT değeri) veritabanına yazılmaz; yalnızca SHA-256 özeti
--     (verification_token_hash) ve kodu sunucunun yeniden üretebilmesi için rastgele nonce.
--     Kod sunucuda HMAC(sunucu anahtarı, alan adı kimliği | kiracı | hostname | nonce) ile
--     üretilir → bir alan adının kodu başka bir alan adını / kiracıyı doğrulayamaz.
--   • Kod süreli: domain_verification_ttl() (7 gün, tek merkez).
--   • Bir hostname aynı anda yalnızca BİR kiracıda doğrulanmış/aktif olabilir (kısmi tekil
--     indeks; eşzamanlı iki doğrulamada yalnızca biri başarılı olur). Aynı kiracıda tekrar yok.
--     Bekleyen kayıt alan adını kilitlemez (işgal edilemez); sahibi doğrulayan alır.
--   • Birincil alan adı yalnızca aktif olabilir; kiracı başına en fazla bir birincil (mevcut indeks).
--   • Yazma yalnızca bu dosyadaki fonksiyonlarla ve yalnızca sunucudan (service_role). Fonksiyon
--     işlemi yapanın (p_actor) yetkisini AYRICA doğrular: ofiste settings.manage (+ plan özelliği)
--     veya süper admin. Organizasyon kimliği sunucuda oturumdan gelir (ctx.org.id).
--   • İstemci tabloyu yalnızca okuyabilir (kendi ofisi / süper admin; anonim RLS ile boş); token özeti ve nonce okunmaz.
--   • Doğrulama denemesi sınırı: alan adı başına 10 dakikada 10 (audit_logs üzerinden).
--
-- Mevcut veri: verified_at dolu kayıtlar 'active' olur (bugün çalışan alan adları çalışmaya devam
-- eder), diğerleri 'pending' (birincil işareti kaldırılır). Veri silinmez.
--
-- Geri alma (yalnızca gerekirse):
--   drop function if exists public.domain_list(uuid, uuid, boolean);
--   drop function if exists public.domain_remove(uuid, uuid, boolean, uuid);
--   drop function if exists public.domain_set_primary(uuid, uuid, boolean, uuid);
--   drop function if exists public.domain_mark_active(uuid, uuid, boolean, uuid, boolean);
--   drop function if exists public.domain_mark_verified(uuid, uuid, boolean, uuid, text[]);
--   drop function if exists public.domain_check_begin(uuid, uuid, boolean, uuid);
--   drop function if exists public.domain_rotate_verification(uuid, uuid, boolean, uuid, text, text);
--   drop function if exists public.domain_add(uuid, uuid, boolean, uuid, text, text, text);
--   drop function if exists public._domain_actor_allowed(uuid, uuid, boolean);
--   drop function if exists public.domain_verification_ttl();
--   -- public_tenant / public_tenant_domains / platform_add_domain: 20260929000001 ve
--   -- 20260926000007 tanımları yeniden uygulanır
--   drop index if exists public.organization_domains_bound_idx;
--   drop index if exists public.organization_domains_org_host_idx;
--   alter table public.organization_domains add constraint organization_domains_hostname_key unique (hostname);
--   alter table public.organization_domains drop constraint if exists organization_domains_status_check,
--     drop constraint if exists organization_domains_state_check, drop constraint if exists organization_domains_primary_active_check,
--     drop column if exists status, drop column if exists verification_token_hash, drop column if exists verification_nonce,
--     drop column if exists verification_expires_at, drop column if exists activated_at, drop column if exists updated_at,
--     drop column if exists created_by;
-- =============================================================================

-- 1) Sütunlar
alter table public.organization_domains
  add column if not exists status text not null default 'pending',
  add column if not exists verification_token_hash text,
  add column if not exists verification_nonce text,
  add column if not exists verification_expires_at timestamptz,
  add column if not exists activated_at timestamptz,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists created_by uuid references auth.users (id) on delete set null;

-- 2) Mevcut veri (bir kez; yeniden çalıştırmada değişiklik yapmaz)
update public.organization_domains
   set status = 'active', activated_at = coalesce(activated_at, verified_at)
 where verified_at is not null and status = 'pending' and activated_at is null;
update public.organization_domains set is_primary = false where is_primary and status <> 'active';

-- 3) Kısıtlar
alter table public.organization_domains drop constraint if exists organization_domains_status_check;
alter table public.organization_domains add constraint organization_domains_status_check
  check (status in ('pending', 'verified', 'active'));
alter table public.organization_domains drop constraint if exists organization_domains_state_check;
alter table public.organization_domains add constraint organization_domains_state_check check (
  (status = 'pending' or verified_at is not null)
  and ((status = 'active') = (activated_at is not null))
  and (verification_token_hash is null or verification_token_hash ~ '^[0-9a-f]{64}$')
  and (verification_nonce is null or verification_nonce ~ '^[0-9a-f]{32}$')
);
alter table public.organization_domains drop constraint if exists organization_domains_primary_active_check;
alter table public.organization_domains add constraint organization_domains_primary_active_check
  check (not is_primary or status = 'active');

-- Tekillik: bağlı (doğrulanmış/aktif) hostname tek kiracıda; aynı kiracıda tekrar yok
alter table public.organization_domains drop constraint if exists organization_domains_hostname_key;
create unique index if not exists organization_domains_bound_idx
  on public.organization_domains (hostname) where status in ('verified', 'active');
create unique index if not exists organization_domains_org_host_idx
  on public.organization_domains (organization_id, hostname);
create index if not exists organization_domains_host_idx on public.organization_domains (hostname);

drop trigger if exists organization_domains_updated_at on public.organization_domains;
create trigger organization_domains_updated_at before update on public.organization_domains
  for each row execute function public.set_updated_at();

-- 4) İstemci erişimi: yalnızca okuma (RLS: kendi ofisi settings.manage / süper admin; anonim için
--    politika yok → boş); token özeti ve nonce hiçbir istemciye okunmaz (herkese açık çözümleme RPC ile)
revoke all on public.organization_domains from anon, authenticated;
grant select (id, organization_id, hostname, is_primary, status, verified_at, activated_at, verification_expires_at, created_at, updated_at)
  on public.organization_domains to authenticated;
-- Anonim rol: önceki davranış korunur (tablo okuma yetkisi var, anonim RLS politikası YOK → hiçbir
-- satır, dolayısıyla hiçbir özet dönmez). Herkese açık çözümleme yalnızca public_tenant* RPC'leriyle.
grant select on public.organization_domains to anon;

-- 5) Süre politikası (tek merkez)
create or replace function public.domain_verification_ttl()
returns interval
language sql
immutable
set search_path = ''
as $$
  select interval '7 days';
$$;

-- İşlemi yapan kişi bu ofisin alan adlarını yönetebilir mi? (service_role çağrılarında auth.uid()
-- yoktur; kimlik sunucunun doğruladığı oturumdan gelir ve burada AYRICA denetlenir)
create or replace function public._domain_actor_allowed(p_actor uuid, p_org uuid, p_platform boolean)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_actor is null or p_org is null then false
    when p_platform then exists (select 1 from public.profiles p where p.id = p_actor and p.is_super_admin)
    else exists (
      select 1
        from public.organization_members m
        join public.organizations o on o.id = m.organization_id and o.status = 'active'
        join public.role_permissions rp on rp.role = m.role and rp.permission = 'settings.manage'
       where m.organization_id = p_org and m.user_id = p_actor and m.status = 'active')
  end;
$$;
revoke all on function public._domain_actor_allowed(uuid, uuid, boolean) from public, anon, authenticated;

-- 6) Alan adı ekle (pending + doğrulama kodu özeti)
create or replace function public.domain_add(
  p_actor uuid, p_org uuid, p_platform boolean, p_id uuid, p_hostname text, p_nonce text, p_token_hash text
)
returns table (id uuid, hostname text, status text, verification_expires_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.organization_domains;
begin
  if not public._domain_actor_allowed(p_actor, p_org, p_platform) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.organizations o where o.id = p_org and o.status = 'active') then
    raise exception 'invalid_organization' using errcode = 'P0001';
  end if;
  -- Ofis kendi alan adını ancak planı özel alan adına izin veriyorsa ekler
  if not p_platform and not coalesce((select pl.custom_domain_enabled from public.org_plan(p_org) pl limit 1), false) then
    raise exception 'plan_feature_disabled' using errcode = 'P0001';
  end if;
  if (select count(*) from public.organization_domains d where d.organization_id = p_org) >= 5 then
    raise exception 'domain_limit' using errcode = 'P0001';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' or p_nonce is null or p_nonce !~ '^[0-9a-f]{32}$' then
    raise exception 'invalid_verification' using errcode = '22023';
  end if;
  -- Başka kiracıda doğrulanmış/aktif alan adı alınamaz (indeks de korur; burada anlaşılır hata)
  if exists (select 1 from public.organization_domains d where d.hostname = p_hostname and d.status in ('verified', 'active') and d.organization_id <> p_org) then
    raise exception 'domain_taken' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.organization_domains d where d.hostname = p_hostname and d.organization_id = p_org) then
    raise exception 'domain_exists' using errcode = 'P0001';
  end if;
  insert into public.organization_domains (id, organization_id, hostname, is_primary, status, verification_token_hash, verification_nonce, verification_expires_at, created_by)
  values (p_id, p_org, p_hostname, false, 'pending', p_token_hash, p_nonce, now() + public.domain_verification_ttl(), p_actor)
  returning * into v_row;
  return query select v_row.id, v_row.hostname, v_row.status, v_row.verification_expires_at;
end;
$$;

-- 7) Yeni doğrulama kodu (yalnızca bekleyen alan adı; eski kod hemen geçersiz, süre baştan)
create or replace function public.domain_rotate_verification(
  p_actor uuid, p_org uuid, p_platform boolean, p_id uuid, p_nonce text, p_token_hash text
)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_expires timestamptz;
begin
  if not public._domain_actor_allowed(p_actor, p_org, p_platform) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' or p_nonce is null or p_nonce !~ '^[0-9a-f]{32}$' then
    raise exception 'invalid_verification' using errcode = '22023';
  end if;
  update public.organization_domains d
     set verification_token_hash = p_token_hash, verification_nonce = p_nonce,
         verification_expires_at = now() + public.domain_verification_ttl()
   where d.id = p_id and d.organization_id = p_org and d.status = 'pending'
   returning d.verification_expires_at into v_expires;
  if v_expires is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return v_expires;
end;
$$;

-- 8) Doğrulama / bağlantı denetimi başlangıcı: yetki + deneme sınırı (DNS'e gitmeden ÖNCE)
create or replace function public.domain_check_begin(p_actor uuid, p_org uuid, p_platform boolean, p_id uuid)
returns table (hostname text, status text, verification_nonce text, verification_expires_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.organization_domains;
begin
  if not public._domain_actor_allowed(p_actor, p_org, p_platform) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_row from public.organization_domains d where d.id = p_id and d.organization_id = p_org;
  if v_row.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if (select count(*) from public.audit_logs a
       where a.organization_id = p_org and a.action = 'domain.checked' and a.target_id = p_id::text
         and a.created_at > now() - interval '10 minutes') >= 10 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  insert into public.audit_logs (organization_id, actor_id, actor_label, action, target_type, target_id, target_label, metadata)
  values (p_org, p_actor, public.audit_actor_label(p_actor), 'domain.checked', 'domain', p_id::text, v_row.hostname,
          jsonb_build_object('status', v_row.status));
  return query select v_row.hostname, v_row.status, v_row.verification_nonce, v_row.verification_expires_at;
end;
$$;

-- 9) Sahiplik doğrulandı: DNS'te bulunan TXT değerlerinin özetlerinden biri bu alan adının
--    (bu kiracının) süresi geçmemiş kod özetiyle eşleşmeli
create or replace function public.domain_mark_verified(p_actor uuid, p_org uuid, p_platform boolean, p_id uuid, p_found_hashes text[])
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_host text;
begin
  if not public._domain_actor_allowed(p_actor, p_org, p_platform) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  begin
    update public.organization_domains d
       set status = 'verified', verified_at = now(), verification_token_hash = null, verification_nonce = null, verification_expires_at = null
     where d.id = p_id and d.organization_id = p_org and d.status = 'pending'
       and d.verification_token_hash is not null
       and d.verification_expires_at > now()
       and d.verification_token_hash = any (coalesce(p_found_hashes, '{}'::text[]))
     returning d.hostname into v_host;
  exception when unique_violation then
    raise exception 'domain_taken' using errcode = 'P0001';
  end;
  if v_host is null then
    raise exception 'verification_failed' using errcode = 'P0001';
  end if;
  insert into public.audit_logs (organization_id, actor_id, actor_label, action, target_type, target_id, target_label, metadata)
  values (p_org, p_actor, public.audit_actor_label(p_actor), 'domain.verified', 'domain', p_id::text, v_host, '{}'::jsonb);
  return v_host;
end;
$$;

-- 10) Bağlantı: yalnızca doğrulanmış alan adı aktif olur. DNS yönlendirmesi sunucuda denetlenir;
--     elle onay (p_manual) yalnızca süper admin. İlk aktif alan adı birincil olur.
create or replace function public.domain_mark_active(p_actor uuid, p_org uuid, p_platform boolean, p_id uuid, p_manual boolean)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_host text;
begin
  if not public._domain_actor_allowed(p_actor, p_org, p_platform) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_manual and not p_platform then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.organization_domains d
     set status = 'active', activated_at = now()
   where d.id = p_id and d.organization_id = p_org and d.status = 'verified' and d.verified_at is not null
   returning d.hostname into v_host;
  if v_host is null then
    raise exception 'not_verified' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.organization_domains d where d.organization_id = p_org and d.is_primary) then
    update public.organization_domains d set is_primary = true where d.id = p_id;
  end if;
  insert into public.audit_logs (organization_id, actor_id, actor_label, action, target_type, target_id, target_label, metadata)
  values (p_org, p_actor, public.audit_actor_label(p_actor), 'domain.activated', 'domain', p_id::text, v_host,
          jsonb_build_object('manual', coalesce(p_manual, false)));
  return v_host;
end;
$$;

-- 11) Birincil (kanonik) alan adı: yalnızca aynı kiracının AKTİF alan adı
create or replace function public.domain_set_primary(p_actor uuid, p_org uuid, p_platform boolean, p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public._domain_actor_allowed(p_actor, p_org, p_platform) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.organization_domains d where d.id = p_id and d.organization_id = p_org and d.status = 'active') then
    raise exception 'not_active' using errcode = 'P0001';
  end if;
  update public.organization_domains d set is_primary = false where d.organization_id = p_org and d.is_primary and d.id <> p_id;
  update public.organization_domains d set is_primary = true where d.id = p_id and d.organization_id = p_org;
end;
$$;

-- 12) Kaldır: kiracı çözümlemesinden hemen düşer; birincilse kiracı varsayılan adresine döner
--     (başka alan adı kendiliğinden birincil yapılmaz). Ad serbest kalır; yeni sahibi yeniden doğrular.
create or replace function public.domain_remove(p_actor uuid, p_org uuid, p_platform boolean, p_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_host text;
begin
  if not public._domain_actor_allowed(p_actor, p_org, p_platform) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.organization_domains d where d.id = p_id and d.organization_id = p_org returning d.hostname into v_host;
  if v_host is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return v_host;
end;
$$;

-- 13) Yönetim listesi (token özeti dönmez; nonce yalnızca sunucuya, TXT değerini yeniden üretmek için)
create or replace function public.domain_list(p_actor uuid, p_org uuid, p_platform boolean)
returns table (id uuid, hostname text, status text, is_primary boolean, verified_at timestamptz, activated_at timestamptz,
               verification_expires_at timestamptz, verification_nonce text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public._domain_actor_allowed(p_actor, p_org, p_platform) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select d.id, d.hostname, d.status, d.is_primary, d.verified_at, d.activated_at, d.verification_expires_at, d.verification_nonce, d.created_at
      from public.organization_domains d
     where d.organization_id = p_org
     order by d.is_primary desc, d.created_at;
end;
$$;

-- 14) Herkese açık çözümleme: YALNIZCA aktif alan adı
create or replace function public.public_tenant(p_slug text default null, p_hostname text default null)
returns table (id uuid, slug text, name text, is_default boolean, reference_prefix text, status public.org_status)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.slug, o.name, o.is_default, o.reference_prefix, o.status
    from public.organizations o
   where o.status = 'active'
     and (
       (p_slug is not null and o.slug = p_slug)
       or (
         p_hostname is not null
         and o.id = (
           select d.organization_id
             from public.organization_domains d
            where d.hostname = lower(p_hostname)
              and d.status = 'active'
            limit 1
         )
       )
     )
   limit 1;
$$;

create or replace function public.public_tenant_domains(p_org uuid)
returns table (hostname text, is_primary boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select d.hostname, d.is_primary
    from public.organization_domains d
    join public.organizations o on o.id = d.organization_id and o.status = 'active'
   where d.organization_id = p_org
     and d.status = 'active';
$$;

-- Eski platform yolu (geriye uyum): artık doğrulanmış/aktif olarak EKLEMEZ, bekleyen kayıt açar.
-- Uygulama bunu kullanmaz (domain_add); süper admin dışındakiler için hata vermeye devam eder.
create or replace function public.platform_add_domain(p_org uuid, p_hostname text, p_primary boolean default false)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform public.assert_super_admin();
  insert into public.organization_domains (organization_id, hostname, is_primary, status)
  values (p_org, lower(btrim(p_hostname)), false, 'pending')
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.domain_verification_ttl() from public, anon;
grant execute on function public.domain_verification_ttl() to authenticated, service_role;
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.domain_add(uuid, uuid, boolean, uuid, text, text, text)',
    'public.domain_rotate_verification(uuid, uuid, boolean, uuid, text, text)',
    'public.domain_check_begin(uuid, uuid, boolean, uuid)',
    'public.domain_mark_verified(uuid, uuid, boolean, uuid, text[])',
    'public.domain_mark_active(uuid, uuid, boolean, uuid, boolean)',
    'public.domain_set_primary(uuid, uuid, boolean, uuid)',
    'public.domain_remove(uuid, uuid, boolean, uuid)',
    'public.domain_list(uuid, uuid, boolean)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;

notify pgrst, 'reload schema';
