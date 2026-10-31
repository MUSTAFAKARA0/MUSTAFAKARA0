-- =============================================================================
-- WP-A2 / C · Depolama yuvaları: satırsız yükleme ve sonlandırma sonrası üzerine yazma engeli (KI-37)
--
-- BEKLEYEN migration: supabase/migrations/ altında DEĞİL, canlıya uygulanmaz. Yayına O-5 onayı ve
-- supabase/ops/media_storage_slots/ betikleriyle alınır. Tasarım: docs/drafts/wpa2/TASARIM.md (§4 d, §10 M1).
-- Sıra: A → yeni kod → B → C. B uygulanmadan C uygulanmaz (aşağıdaki koruma 'apply B first').
-- Geri alma: C, B'den ÖNCE geri alınır (C, B'nin kanonik yol kuralına dayanır).
--
-- Yerel ölçüm (storage-api v1.82.1, tests/security/media-storage-slots.test.mjs başlığı):
--   • Storage, oturum isteğinde ve İMZALAMA (createSignedUploadUrl) anında RLS'yi geri alınan bir deneme yazımıyla
--     denetler; imzalı adresle yapılan ASIL yükleme RLS'yi atlar (veritabanına service_role olarak yazar, token 2 saat).
--   • Bu yüzden iki katman: (1) politika imzalama/istek anında yuva ister, (2) BEFORE INSERT OR UPDATE tetikleyicisi
--     imzalı adresle sonradan yapılan yazımı da reddeder.
--
-- Etki:
--   • media-originals INSERT/UPDATE (authenticated): ad, çağıranın kurumundaki BEKLEYEN (pending) satırın original_path
--     değerine birebir eşit olmalı (media_original_slot_open). Satırsız, kanonik olmayan, failed ya da ready satırın
--     orijinali imzalanamaz ve yazılamaz.
--   • media INSERT (authenticated): ad <satır klasörü>/<sürüm>/w<genişlik>.webp ve satır çağıranın kurumunda olmalı;
--     satırın GÜNCEL (sonlanmış) tabanına yazılamaz; hedef tabanda en çok 6 dosya; klasörde güncel taban ve hedef dışında
--     en çok 1 taban daha (media_variant_slot_open). Yeni tabana yazım (işleme, döndürme) açık.
--   • Tetikleyici media_storage_slot_guard (storage.objects, yalnız 'organizations/' altı, iki kova):
--       INSERT, sahibi dolu (kullanıcının oturumu ya da imzalı adresi): yukarıdaki yuva kuralları (kurum denetimi
--         olmadan; sahibi boş = service_role/sistem, ör. geri yükleme --apply, serbest).
--       UPDATE (üzerine yazma, taşıma), herkes: HİÇ (nesneler bir kez yazılır; KI-38). Yenilenen yükleme orijinal varsa
--         yüklemeyi atlar (uygulama, renewMediaUpload).
--       Bakım penceresi (public.media_overwrite_window, en çok 24 saat — CHECK, yalnız SQL Editor/postgres açar) UPDATE'i
--       ve sahibi dolu INSERT'i serbest bırakır: tam geri yükleme sonrası `restore:storage --apply --overwrite` için.
--   • Kalan (kabul edilen) sınır: bir media.manage üyesi kendi kurumunda satır başına en çok 2 güncel olmayan taban × 6
--     dosya (kova sınırı 10 MB) kadar sayılmayan dosyayı bir sonraki günlük temizliğe kadar tutabilir; D (20261031000001)
--     1 saatten eski güncel olmayan tabanları listeler, cron siler (KI-38).
--   • SELECT/DELETE politikaları değişmez. Veri değiştirmez; mevcut nesneler denetlenmez.
--
-- Hata: 'media_slot_closed' (42501). Tekrar çalıştırılabilir.
-- GERİ DÖNÜŞ: (05_rollback.sql; C HER ZAMAN B'den önce geri alınır; dört politika 20260926000008_v2_storage.sql'deki
-- hâliyle, aşağıdaki drop'lardan sonra 05'te yeniden kurulur)
--   drop trigger if exists media_storage_slot_guard on storage.objects;
--   drop policy if exists "media_originals_insert" on storage.objects;
--   drop policy if exists "media_originals_update" on storage.objects;
--   drop policy if exists "media_insert" on storage.objects;
--   drop policy if exists "media_update" on storage.objects;
--   drop function if exists public.media_storage_slot_guard();
--   drop function if exists public.media_original_slot_open(text);
--   drop function if exists public.media_variant_slot_open(text);
--   drop function if exists public.media_original_slot_org(text);
--   drop function if exists public.media_variant_slot_org(text);
--   drop table if exists public.media_overwrite_window;
-- =============================================================================

do $guard$
begin
  if to_regprocedure('public.media_finalize(uuid,text,text,smallint[],integer,integer,text)') is null
     or not exists (select 1 from pg_trigger
                     where tgname = 'media_assets_pending_shape' and not tgisinternal
                       and tgrelid = to_regclass('public.media_assets')) then
    raise exception 'apply B first';
  end if;
end
$guard$;

-- Bakım penceresi: tek satır; istemcilere ve service_role'e kapalı (yalnız veritabanı sahibi açar)
create table if not exists public.media_overwrite_window (
  id boolean primary key default true check (id),
  opened_at timestamptz not null default now(),
  open_until timestamptz not null,
  -- En çok 24 saat; ileri tarihli "uyuyan" pencere kurulamaz (DB inceleme #3)
  constraint media_overwrite_window_max_1d check (open_until > opened_at and open_until <= opened_at + interval '1 day'),
  constraint media_overwrite_window_opened_now check (opened_at <= now() + interval '1 minute')
);
alter table public.media_overwrite_window enable row level security;
revoke all on table public.media_overwrite_window from public, anon, authenticated, service_role;

-- İç yardımcılar: yalnız yol eşleşmesi (kurum denetimi yok); istemcilere kapalı.
-- Kimlik yoldan yalnız birincil anahtar araması için alınır; yetki eşitliği satırın kendi original_path değeriyle.
create or replace function public.media_original_slot_org(p_name text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.organization_id
    from public.media_assets m
   where m.id = (substring(p_name from
           '^organizations/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(?:properties/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/images|content)/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/original$'
         ))::uuid
     and m.original_path = p_name
     and m.status = 'pending'
$$;

create or replace function public.media_variant_slot_org(p_name text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  with p as (
    select regexp_match(p_name,
      '^(organizations/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(?:properties/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/images|content)/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}))/([A-Za-z0-9_]{8}(?:-r(?:90|180|270))?)/w[0-9]{1,4}\.webp$'
    ) as g
  )
  -- Sınırlar (K-23 güvenlik MEDIUM): hedef tabanda en çok 6 dosya (uygulama ≤ 6 genişlik üretir); klasörde güncel taban
  -- ve hedef dışında en çok 1 taban daha (döndürmeden sonra cron'un sileceği eski taban) → satır başına sayılmayan alan sınırlı
  select m.organization_id
    from p
    join public.media_assets m on m.id = (p.g[2])::uuid
   where p.g is not null
     and m.original_path = p.g[1] || '/original'
     and m.public_base is distinct from p.g[1] || '/' || p.g[3]
     and (select count(*) from storage.objects o
           where o.bucket_id = 'media'
             and o.name collate "C" >= p.g[1] || '/' || p.g[3] || '/' collate "C"
             and o.name collate "C" < p.g[1] || '/' || p.g[3] || '0' collate "C") < 6
     and (select count(distinct split_part(substr(o.name, length(p.g[1]) + 2), '/', 1)) from storage.objects o
           where o.bucket_id = 'media'
             and o.name collate "C" >= p.g[1] || '/' collate "C"
             and o.name collate "C" < p.g[1] || '0' collate "C"
             and not starts_with(o.name, p.g[1] || '/' || p.g[3] || '/')
             and (m.public_base is null or not starts_with(o.name, m.public_base || '/'))) < 2
$$;

revoke all on function public.media_original_slot_org(text) from public, anon, authenticated, service_role;
revoke all on function public.media_variant_slot_org(text) from public, anon, authenticated, service_role;

-- Politika yardımcıları (authenticated): yuva + çağıranın media.manage yetkili kurumu
create or replace function public.media_original_slot_open(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.media_original_slot_org(p_name) in (select x.id from public.user_org_ids('media.manage') as x(id)), false)
$$;

create or replace function public.media_variant_slot_open(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.media_variant_slot_org(p_name) in (select x.id from public.user_org_ids('media.manage') as x(id)), false)
$$;

revoke all on function public.media_original_slot_open(text) from public, anon, service_role;
revoke all on function public.media_variant_slot_open(text) from public, anon, service_role;
grant execute on function public.media_original_slot_open(text) to authenticated;
grant execute on function public.media_variant_slot_open(text) to authenticated;

-- Politikalar: 20260926000008_v2_storage.sql'deki kurum klasörü denetimi korunur, yuva şartı eklenir
drop policy if exists "media_originals_insert" on storage.objects;
create policy "media_originals_insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'media-originals'
    and (storage.foldername(name))[1] = 'organizations'
    and (storage.foldername(name))[2] in (select x.id::text from public.user_org_ids('media.manage') as x(id))
    and public.media_original_slot_open(name)
  );
drop policy if exists "media_originals_update" on storage.objects;
create policy "media_originals_update" on storage.objects for update to authenticated
  using (
    bucket_id = 'media-originals'
    and (storage.foldername(name))[1] = 'organizations'
    and (storage.foldername(name))[2] in (select x.id::text from public.user_org_ids('media.manage') as x(id))
    and public.media_original_slot_open(name)
  )
  with check (
    bucket_id = 'media-originals'
    and (storage.foldername(name))[1] = 'organizations'
    and (storage.foldername(name))[2] in (select x.id::text from public.user_org_ids('media.manage') as x(id))
    and public.media_original_slot_open(name)
  );
drop policy if exists "media_insert" on storage.objects;
create policy "media_insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'organizations'
    and (storage.foldername(name))[2] in (select x.id::text from public.user_org_ids('media.manage') as x(id))
    and public.media_variant_slot_open(name)
  );
drop policy if exists "media_update" on storage.objects;
create policy "media_update" on storage.objects for update to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'organizations'
    and (storage.foldername(name))[2] in (select x.id::text from public.user_org_ids('media.manage') as x(id))
    and public.media_variant_slot_open(name)
  )
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'organizations'
    and (storage.foldername(name))[2] in (select x.id::text from public.user_org_ids('media.manage') as x(id))
    and public.media_variant_slot_open(name)
  );

-- Tetikleyici: imzalı adresle (RLS'siz) yapılan yazımı da yakalar
create or replace function public.media_storage_slot_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window boolean;
begin
  if new.bucket_id not in ('media-originals', 'media')
     and (tg_op = 'INSERT' or old.bucket_id not in ('media-originals', 'media')) then
    return new;
  end if;
  v_window := exists (select 1 from public.media_overwrite_window w where w.open_until > now());
  if v_window then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Sahibi boş: service_role / sistem yazımı (geri yükleme --apply, testler); yeni nesne serbest
    if new.owner_id is null or new.name not like 'organizations/%' then
      return new;
    end if;
    if (new.bucket_id = 'media-originals' and public.media_original_slot_org(new.name) is not null)
       or (new.bucket_id = 'media' and public.media_variant_slot_org(new.name) is not null) then
      return new;
    end if;
    raise exception 'media_slot_closed' using errcode = '42501';
  end if;

  -- UPDATE (üzerine yazma ya da taşıma): kurum klasöründeki nesneler BİR KEZ yazılır (pencere dışında hiç UPDATE yok).
  -- Varyantlar upsert'siz yazılır; emekli (önbellekte olabilecek) tabanların üzerine yazılamaz (K-23 DB #4). Orijinal,
  -- bekleyen satırda bile işleme sırasında değiştirilemez (KI-38, K-23 DB #5); yarım kalan yükleme nesne oluşturmaz.
  if (old.bucket_id in ('media-originals', 'media') and old.name like 'organizations/%')
     or (new.bucket_id in ('media-originals', 'media') and new.name like 'organizations/%') then
    raise exception 'media_slot_closed' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.media_storage_slot_guard() from public, anon, authenticated, service_role;

drop trigger if exists media_storage_slot_guard on storage.objects;
create trigger media_storage_slot_guard
  before insert or update on storage.objects
  for each row execute function public.media_storage_slot_guard();

notify pgrst, 'reload schema';
