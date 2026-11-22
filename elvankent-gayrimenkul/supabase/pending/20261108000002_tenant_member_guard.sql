-- =============================================================================
-- P0-3 · Kiracı izolasyonu sıkılaştırması (F): izinsiz üyelik ve yabancı OG görseli
--
-- BEKLEYEN migration: supabase/migrations/ altında DEĞİL, canlıya uygulanmaz. Yayına sahibin yazılı onayı ve
-- supabase/ops/tenant_member_guard/ betikleriyle alınır. Başka bekleyen dosyaya bağlı değildir.
--
-- Bulgular (08.11 bağımsız denetim, uygulama + veritabanı katmanı; ikisi de aynı açığı buldu):
--   1. organization_members: `users.manage` yetkili bir ofis yöneticisi (ekip formu ya da doğrudan PostgREST) HERHANGİ bir
--      kullanıcı kimliğini — başka ofisin sahibini ya da KARAYS platform yöneticisini — onayı olmadan kendi ofisine aktif
--      üye olarak ekleyebiliyor; üyelik satırının user_id'sini de başka birine çevirebiliyor. Sonuç: o kişinin adı, telefonu,
--      e-postası ve son girişi bu ofise görünür (profiles_select_self_or_team, list_org_members); kişi habersiz bir ofise bağlanır.
--   2. properties.og_media_id: properties_before_write bu sütunu denetlemiyor; ilanın paylaşım görseli başka ofisin medyasını
--      gösterebiliyor (posts.cover_media_id denetleniyor; bu eksikti).
--
-- Düzeltme (yalnız istemci oturumları; service_role / sistem yolları ve KARAYS süper yöneticisi etkilenmez):
--   • organization_members_target_guard (BEFORE INSERT OR UPDATE OF user_id): UPDATE'te user_id değişemez; INSERT'te hedef
--     hesap başka bir ofiste üyeyse (her durumda) ya da süper yöneticiyse 'member_unavailable' (42501). Hiçbir ofise bağlı
--     olmayan hesap (yeni hesap, bu ofisten çıkarılıp yeniden eklenen kişi) eklenebilir.
--   • properties_og_media_guard (BEFORE INSERT OR UPDATE OF og_media_id, organization_id): og_media_id aynı ofisin medyası
--     değilse 'cross_tenant_reference' (42501).
-- Uygulama kodu (src/app/actions/admin-users.ts createMember) aynı kuralı önceden denetler ve anlaşılır mesaj verir; bu dosya
-- doğrudan API ile atlatılmasını kapatır.
--
-- Mevcut veri: değişmez, denetlenmez (yalnız yeni yazımlar). 01_preflight birden çok ofise bağlı hesap sayısını ve yabancı
-- og_media_id sayısını yalnız SAYAR (bilgi).
-- Tekrar çalıştırılabilir.
--
-- GERİ DÖNÜŞ: (05_rollback.sql)
--   drop trigger if exists organization_members_target_guard on public.organization_members;
--   drop function if exists public.organization_members_target_guard();
--   drop trigger if exists properties_og_media_guard on public.properties;
--   drop function if exists public.properties_og_media_guard();
-- =============================================================================

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
