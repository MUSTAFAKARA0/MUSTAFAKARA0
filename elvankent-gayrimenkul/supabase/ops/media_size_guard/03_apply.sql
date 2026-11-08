-- =============================================================================
-- Orijinal boyut koruması — 3/5 UYGULAMA: supabase/pending/20261108000001_media_size_guard.sql (tek işlem)
--
-- ÖN KOŞUL (hepsi): C (media_storage_slots) uygulanmış ve 04'ü TAMAM · 01 çıktısında DUR yok · 02 çıktısı saklandı ·
-- tam yedek alındı · bu adım için sahibin yazılı onayı var. Uygulama kodu değişikliği GEREKMEZ (panel her zaman gerçek
-- dosya boyutunu bildirir).
--   Supabase SQL Editor: dosyanın TAMAMI tek sorgu olarak (metin seçili değilken) Run.
--   psql: psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f 03_apply.sql
--
-- Davranış:
--   • Tek işlem. Herhangi bir adım hata verirse HİÇBİR değişiklik kalmaz. lock_timeout 3 sn, statement_timeout 30 sn
--     (CREATE TRIGGER storage.objects üzerinde kilit ister; 55P03'te hiçbir şey değişmemiştir, sakin anda tekrar).
--   • Koruma: şema sürümü en az 20261018000001; C kurulu ('apply C first'); TRIGGER hakkı var.
--   • Gövde pending dosyayla birebir aynıdır (birim testi LR-14 denetler). Tekrar çalıştırılabilir. Veri değiştirmez.
--   • Geri dönüş: 05.
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
    raise exception 'DUR: şema sürümü % — en az 20261018000001 gerekir; önce PRODUCTION_MIGRATION.md sırasıyla eksik migration''lar', surum;
  end if;
  if to_regclass('public.media_assets') is null or to_regclass('storage.objects') is null then
    raise exception 'DUR: public.media_assets ya da storage.objects yok';
  end if;
  if not has_table_privilege(current_user, 'storage.objects', 'trigger') then
    raise exception 'DUR: çalıştıran rolün storage.objects üzerinde TRIGGER hakkı yok';
  end if;
end
$koruma$;

-- ---- 20261108000001_media_size_guard ----------------------------------------------
do $guard$
begin
  if to_regclass('public.media_overwrite_window') is null
     or to_regprocedure('public.media_storage_slot_guard()') is null then
    raise exception 'apply C first';
  end if;
end
$guard$;

create or replace function public.media_storage_size_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_size text;
  v_declared bigint;
begin
  if new.bucket_id is distinct from 'media-originals' or new.owner_id is null or new.name not like 'organizations/%' then
    return new;
  end if;
  v_size := new.metadata ->> 'size';
  -- Yükleme öncesi yetki denemesi: gerçek boyut henüz yok
  if v_size is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and (old.metadata ->> 'size') is not distinct from v_size then
    return new;
  end if;
  if exists (select 1 from public.media_overwrite_window w where w.open_until > now()) then
    return new;
  end if;
  select m.byte_size into v_declared
    from public.media_assets m
   where m.id = (substring(new.name from
           '^organizations/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(?:properties/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/images|content)/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/original$'
         ))::uuid
     and m.original_path = new.name
     and m.status = 'pending';
  -- Bekleyen satır yoksa yuva kuralı C'nindir
  if not found then
    return new;
  end if;
  if v_size !~ '^[0-9]{1,18}$' or v_declared is null or v_size::bigint > v_declared then
    raise exception 'media_size_mismatch' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.media_storage_size_guard() from public, anon, authenticated, service_role;

drop trigger if exists media_storage_size_guard on storage.objects;
create trigger media_storage_size_guard
  before insert or update on storage.objects
  for each row when (new.bucket_id = 'media-originals' and new.owner_id is not null)
  execute function public.media_storage_size_guard();

notify pgrst, 'reload schema';
-- ---- gövde sonu ---------------------------------------------------------------------

-- Aynı işlemde kontrol: beklenmeyen durum varsa her şey geri alınır
do $kontrol$
declare surum text;
begin
  if (select count(*) from pg_trigger where tgname = 'media_storage_size_guard' and not tgisinternal and tgrelid = to_regclass('storage.objects')) <> 1 then
    raise exception 'KONTROL: media_storage_size_guard tetikleyicisi tam bir kez yok; işlem geri alınıyor';
  end if;
  if has_function_privilege('anon', 'public.media_storage_size_guard()', 'execute')
     or has_function_privilege('authenticated', 'public.media_storage_size_guard()', 'execute')
     or has_function_privilege('service_role', 'public.media_storage_size_guard()', 'execute') then
    raise exception 'KONTROL: tetikleyici fonksiyonu bir istemciye açık; işlem geri alınıyor';
  end if;
  execute 'select public.karay_schema_version()' into surum;
  if surum < '20261018000001' then
    raise exception 'KONTROL: şema sürümü % değişmiş görünüyor; işlem geri alınıyor', surum;
  end if;
end
$kontrol$;

commit;

-- Sonuç (yalnızca okur). Tam kontrol: 04_postflight.sql
select 'media_storage_size_guard tetikleyici sayısı' as alan,
       (select count(*)::text from pg_trigger where tgname = 'media_storage_size_guard' and not tgisinternal) as deger;
