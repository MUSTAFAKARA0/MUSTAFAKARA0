-- =============================================================================
-- Plan limitleri · eşzamanlı ekleme kilidi (karardan bağımsız düzeltme)
--
-- BEKLEYEN migration: supabase/migrations/ altında DEĞİL, canlıya uygulanmaz. Yayına O-5 onayı ve
-- kendi ön/son kontrol betikleriyle alınır; D-04/D-05 kararını beklemez.
--
-- Hata (yerel Supabase'de doğrulandı, tests/security/subscription-limits.test.mjs SL-05): ilan ve
-- üyelik limiti, satır eklenmeden önce yapılan bir sayımla denetlenir. Aynı anda gelen istekler aynı
-- sayımı görür; ilan limiti 3 olan planda 8 eşzamanlı istekle 4–7 ilan oluştu.
--
-- Düzeltme: ilan ve üyelik eklemeleri, limit sayımından önce organizasyon başına bir işlem kilidi
-- alır. İstekler sırayla sayılır; READ COMMITTED'da sayım, kilit bırakıldıktan sonra öncekinin
-- kaydını görür. Yalnızca aynı organizasyondaki eklemeler birbirini bekler.
-- Kapsam dışı: media_upload_allowed() yüklemeden ÖNCE çağrılan bir denetimdir (satır yüklemeden sonra
-- yazılır); eşzamanlı yüklemeler depolama sınırını en fazla eşzamanlı dosya kadar aşabilir.
--
-- Tekrar çalıştırılabilir. Veri değiştirmez.
--
-- GERİ DÖNÜŞ:
--   drop trigger if exists aa_quota_lock on public.properties;
--   drop trigger if exists aa_quota_lock on public.organization_members;
--   drop function if exists public.quota_lock();
-- =============================================================================

-- Limit sayımından önce organizasyon başına işlem kilidi. Tetikleyici adı "aa_" ile başlar: aynı
-- olaydaki BEFORE tetikleyicileri ada göre sırayla çalışır, kilit sayımdan (properties_before_write,
-- organization_members_guard) önce alınır. Kilit işlem sonunda kendiliğinden bırakılır.
create or replace function public.quota_lock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('karay.quota:' || tg_table_name || ':' || new.organization_id::text, 0));
  return new;
end;
$$;
revoke all on function public.quota_lock() from public, anon, authenticated;

drop trigger if exists aa_quota_lock on public.properties;
create trigger aa_quota_lock
  before insert on public.properties
  for each row execute function public.quota_lock();

drop trigger if exists aa_quota_lock on public.organization_members;
create trigger aa_quota_lock
  before insert or update of status on public.organization_members
  for each row execute function public.quota_lock();
