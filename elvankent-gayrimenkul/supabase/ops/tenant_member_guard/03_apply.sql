-- =============================================================================
-- Kiracı üyelik koruması — 3/5 UYGULAMA: supabase/pending/20261108000002_tenant_member_guard.sql (tek işlem)
--
-- ÖN KOŞUL: 01 çıktısında DUR yok · 02 çıktısı saklandı · tam yedek alındı · sahibin yazılı onayı.
-- Uygulama kodu: src/app/actions/admin-users.ts (createMember) aynı kuralı önceden denetler; kod önce ya da sonra
-- yayınlanabilir (bağımsız). Kod eski, F uygulanmışsa başka ofise bağlı hesap eklemesi genel bir hata mesajıyla reddedilir.
--   Supabase SQL Editor: dosyanın TAMAMI tek sorgu olarak Run · psql: psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f 03_apply.sql
-- Tek işlem; lock_timeout 3 sn, statement_timeout 30 sn. Tekrar çalıştırılabilir. Veri değiştirmez. Geri dönüş: 05.
-- =============================================================================
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

do $koruma$
declare surum text;
begin
  if to_regprocedure('public.karay_schema_version()') is null then
    raise exception 'DUR: karay_schema_version() yok (önceki migration''lar eksik)';
  end if;
  execute 'select public.karay_schema_version()' into surum;
  if surum is null or surum < '20261018000001' then
    raise exception 'DUR: şema sürümü % — en az 20261018000001 gerekir', surum;
  end if;
  if to_regclass('public.organization_members') is null or to_regclass('public.properties') is null
     or to_regclass('public.media_assets') is null or to_regprocedure('public.is_super_admin()') is null then
    raise exception 'DUR: organization_members, properties, media_assets ya da is_super_admin() yok';
  end if;
end
$koruma$;

-- ---- 20261108000002_tenant_member_guard ----------------------------------------------
create or replace function public.organization_members_target_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Sistem / service_role (ofis açılışı RPC'si, davet kabulü) ve KARAYS süper yöneticisi serbest
  if (select auth.uid()) is null or public.is_super_admin() then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id then
      raise exception 'member_user_immutable' using errcode = '42501',
        hint = 'Üyelik başka bir kişiye devredilemez; kişiyi çıkarıp yenisini ekleyin.';
    end if;
    return new;
  end if;
  if exists (select 1 from public.profiles p where p.id = new.user_id and p.is_super_admin)
     or exists (select 1 from public.organization_members m
                 where m.user_id = new.user_id and m.organization_id <> new.organization_id) then
    raise exception 'member_unavailable' using errcode = '42501',
      hint = 'Bu hesap başka bir ofise bağlı; KARAYS destek ile iletişime geçin.';
  end if;
  return new;
end;
$$;
revoke all on function public.organization_members_target_guard() from public, anon, authenticated, service_role;

drop trigger if exists organization_members_target_guard on public.organization_members;
create trigger organization_members_target_guard
  before insert or update of user_id on public.organization_members
  for each row execute function public.organization_members_target_guard();

create or replace function public.properties_og_media_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.og_media_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.og_media_id is not distinct from old.og_media_id
     and new.organization_id is not distinct from old.organization_id then
    return new;
  end if;
  if not exists (select 1 from public.media_assets m
                  where m.id = new.og_media_id and m.organization_id = new.organization_id) then
    raise exception 'cross_tenant_reference' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.properties_og_media_guard() from public, anon, authenticated, service_role;

drop trigger if exists properties_og_media_guard on public.properties;
create trigger properties_og_media_guard
  before insert or update of og_media_id, organization_id on public.properties
  for each row execute function public.properties_og_media_guard();

notify pgrst, 'reload schema';
-- ---- gövde sonu ---------------------------------------------------------------------

do $kontrol$
begin
  if (select count(*) from pg_trigger where tgname in ('organization_members_target_guard', 'properties_og_media_guard') and not tgisinternal) <> 2 then
    raise exception 'KONTROL: iki tetikleyici kurulmadı; işlem geri alınıyor';
  end if;
  if has_function_privilege('authenticated', 'public.organization_members_target_guard()', 'execute')
     or has_function_privilege('anon', 'public.properties_og_media_guard()', 'execute') then
    raise exception 'KONTROL: tetikleyici fonksiyonu istemciye açık; işlem geri alınıyor';
  end if;
end
$kontrol$;

commit;

select 'F tetikleyici sayısı' as alan,
       (select count(*)::text from pg_trigger where tgname in ('organization_members_target_guard', 'properties_og_media_guard') and not tgisinternal) as deger;
