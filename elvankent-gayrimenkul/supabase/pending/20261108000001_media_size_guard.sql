-- =============================================================================
-- KI-42 · Orijinal dosyanın gerçek boyutu, bekleyen satırda bildirilen boyutu aşamaz (E)
--
-- BEKLEYEN migration: supabase/migrations/ altında DEĞİL, canlıya uygulanmaz. Yayına sahibin yazılı onayı ve
-- supabase/ops/media_size_guard/ betikleriyle alınır. C'ye (20261027000003_media_storage_slots.sql) dayanır: 'apply C first'.
--
-- Sorun (02.11 medya denetimi; dış denetim 05.11 F02): yükleme bileti istemcinin bildirdiği boyutla bekleyen (pending) satır
-- açar; kota (media_upload_allowed, media_assets_quota) bekleyen ve başarısız satırı bu boyutla sayar, gerçek boyut yalnız
-- media_finalize ile yazılır. 1 bayt bildirip 50 MB (kova sınırı) yüklemek mümkündü: kurum başına 50 bekleyen/başarısız satır
-- × 50 MB ≈ 2,5 GB kota dışı alan (24 saatte temizlenir).
--
-- Düzeltme: storage.objects üzerinde AYRI bir BEFORE INSERT OR UPDATE tetikleyicisi. media-originals kovasında, kurum
-- klasöründe, sahibi dolu (kullanıcı oturumu ya da imzalı adres) bir nesne satırı yazılırken nesnenin GERÇEK boyutu
-- (metadata.size) o yolun bekleyen satırındaki byte_size'ı aşıyorsa 'media_size_mismatch' (42501) ile reddedilir.
--
-- storage-api (v1.82.1, src/storage/uploader.ts completeUpload): nesne satırı dosya arka uca yazıldıktan SONRA tek işlemde
-- upsertObject ile metadata.size (arka ucun gerçek boyutu) dolu olarak eklenir; aynı işlemde önce çağıranın yetkisi deneme
-- yazımıyla denetlenir. Red bu işlemi geri alır; storage-api kaydı yapılmamış sürümün baytlarını siler. Yüklemeden ÖNCEKİ
-- yetki denemesinde metadata.size yoktur (yalnız contentLength): bu tetikleyici o denemeyi geçirir. contentLength bilinçli
-- olarak kullanılmaz: tarayıcı çok parçalı (multipart) gövde gönderdiğinde istek uzunluğu dosyadan büyüktür ve dürüst
-- yüklemeyi yanlışlıkla reddederdi.
--
-- Etki:
--   • Panel her zaman dosyanın kendi boyutunu (File.size) bildirir: dürüst yükleme etkilenmez. Bildirilenden KÜÇÜK dosya kabul
--     edilir (sonlandırma gerçek boyutu yazar).
--   • Bekleyen satırı olmayan yol, media kovası (varyantlar), sahibi boş yazımlar (service_role: geri yükleme --apply, testler)
--     ve C'nin bakım penceresi (media_overwrite_window) bu tetikleyiciden etkilenmez; onları C yönetir.
--   • UPDATE: yalnız metadata.size değişiyorsa aynı kural; boyutu değişmeyen güncellemeler serbest.
--   • Tetikleyici adı C'ninkinden önce sıralanır (size < slot); hangisi reddederse yazım olmaz.
--   • Veri ve mevcut nesneler değişmez. Tekrar çalıştırılabilir.
--
-- Hata: 'media_size_mismatch' (42501). Panel bunu yükleme hatası olarak gösterir; "Tekrar dene" yeni kayıtla baştan yükler.
--
-- GERİ DÖNÜŞ: (05_rollback.sql)
--   drop trigger if exists media_storage_size_guard on storage.objects;
--   drop function if exists public.media_storage_size_guard();
-- =============================================================================

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
