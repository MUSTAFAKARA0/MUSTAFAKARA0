-- =============================================================================
-- Plan limitleri · depolama kotası, eşzamanlı medya kaydı kilidi (karardan bağımsız düzeltme)
--
-- BEKLEYEN migration: supabase/migrations/ altında DEĞİL, canlıya uygulanmaz. Yayına O-5 onayı ve
-- kendi ön/son kontrol betikleriyle alınır; D-04/D-05 kararını beklemez. OPS-02 bayrağına dokunmaz.
--
-- Hata (tests/security/subscription-limits.test.mjs SL-06): depolama kotası yalnızca uygulamada,
-- media_upload_allowed() RPC'siyle denetlenir. Kota media_assets satırlarının byte_size toplamını sayar
-- ve satır bu denetimden SONRA, ayrı bir istekte eklenir (src/app/actions/media.ts). Aynı anda gelen
-- istekler aynı toplamı görür; ayrıca media.manage yetkili bir kullanıcı RLS (media_member_write)
-- üzerinden satırı doğrudan ekleyip denetimi hiç çağırmayabilir.
--
-- Düzeltme: media_assets eklemesi organizasyon başına işlem kilidi alır ve kotayı yeni satır dahil
-- veritabanında yeniden denetler (media_upload_allowed ile aynı formül: varyantlar için %35 pay).
-- Tetikleyici adı "media_assets_quota": BEFORE tetikleyicileri ada göre çalışır, organization_id'yi
-- ilandan dolduran media_assets_org'dan SONRA çalışmalıdır. Sayım READ COMMITTED'da kilit
-- bırakıldıktan sonra öncekinin kaydını görür (20261025000001_quota_lock.sql ile aynı yaklaşım).
-- Limit, ilan limiti gibi her eklemeye uygulanır (service role dahil); plan sınırsızsa (NULL) etkisiz.
--
-- Kilit yalnızca yetkili çağıran için alınır: API istek rolü (anon ya da authenticated) media.manage
-- yetkisi olmadığı (ve süper admin olmadığı) bir kurum adına satır eklemeye çalışırsa tetikleyici kilit
-- almadan döner ve RLS (media_member_write WITH CHECK) satırı tek tip hatayla reddeder. Böylece başka
-- kurumun kilidi alınmaz ve kurumun kotada olup olmadığı (plan_limit_storage ile RLS hatası farkı) sızmaz.
-- service_role ve doğrudan veritabanı bağlantıları (bakım, seed) ile süper admin etkilenmez.
--
-- Kapsam dışı (bilinen kalan risk, ayrı iş WP-A2): byte_size istemcinin bildirdiği boyuttur ve gerçek
-- boyutla eşlenmez; media_member_write (FOR ALL) üyenin byte_size / variants_byte_size / original_path /
-- public_base sütunlarını doğrudan güncellemesine izin verir, kötü niyetli bir üye kotayı yine aşabilir.
-- Tam çözüm: authenticated için UPDATE'in sütun düzeyinde daraltılması ve sonlandırmanın tek bir definer
-- RPC'ye taşınması. media_assets satırı olmadan organizations/{org}/ altına yüklenen dosyalar sayılmaz.
-- Varyant boyutu (variants_byte_size) sonradan yazılır; %35 payı bunun içindir.
--
-- Tekrar çalıştırılabilir. Veri değiştirmez; mevcut satırlar denetlenmez.
--
-- GERİ DÖNÜŞ:
--   drop trigger if exists media_assets_quota on public.media_assets;
--   drop function if exists public.media_quota_check();
-- =============================================================================

create or replace function public.media_quota_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer;
begin
  -- Yetkisiz çağıran: kilit almadan dön, RLS WITH CHECK satırı reddetsin (kota durumu sızmasın)
  if (select auth.role()) in ('anon', 'authenticated')
     and not coalesce(new.organization_id in (select public.user_org_ids('media.manage')), false)
     and not (select public.is_super_admin()) then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('karay.quota:media_assets:' || new.organization_id::text, 0));
  select max_storage_mb into v_limit from public.org_plan(new.organization_id);
  if v_limit is null then
    return new;
  end if;
  if (
    select coalesce(sum(coalesce(byte_size, 0) + variants_byte_size), 0)
      from public.media_assets where organization_id = new.organization_id
  ) + (coalesce(new.byte_size, 0) * 1.35)::bigint > v_limit::bigint * 1024 * 1024 then
    raise exception 'plan_limit_storage' using errcode = 'P0001',
      hint = 'Depolama alanı kotanız doldu.';
  end if;
  return new;
end;
$$;
revoke all on function public.media_quota_check() from public, anon, authenticated, service_role;

drop trigger if exists media_assets_quota on public.media_assets;
create trigger media_assets_quota
  before insert on public.media_assets
  for each row execute function public.media_quota_check();
