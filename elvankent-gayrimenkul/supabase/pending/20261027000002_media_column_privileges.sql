-- =============================================================================
-- WP-A2 / B · media_assets sütun yetkileri ve bekleyen satır şekil tetikleyicisi
--
-- BEKLEYEN migration: supabase/migrations/ altında DEĞİL, canlıya uygulanmaz. Yayına O-5 onayı ve
-- supabase/ops/media_privileges/ betikleriyle alınır. Tasarım: docs/drafts/wpa2/TASARIM.md (§1, §8).
-- ESKİ KODU BOZAR: eski uygulama kodu status/boyut/taban sütunlarını oturum istemcisiyle günceller (42501 alır).
-- Yayın sırası: A → yeni kod → kapı (01) → B. A uygulanmadan B uygulanmaz (aşağıdaki koruma 'apply A first').
-- Geri alma sırası: B HER ZAMAN A'dan önce geri alınır; B'den sonra kod geri alınacaksa ÖNCE B'nin 05'i.
--
-- Etki (authenticated, oturum istemcisi):
--   • UPDATE yalnız alt_text, sort_order, is_cover sütunlarında (set_property_cover ve reorder_property_media INVOKER).
--     status, boyutlar, yollar, public_base vb. değişimi media_finalize / media_mark_failed RPC'leriyle (A).
--   • INSERT yalnız id, organization_id, property_id, kind, status, original_path, mime_type, byte_size,
--     original_filename, created_by, sort_order, alt_text sütunlarında. DELETE açık kalır.
--   • TRUNCATE, REFERENCES, TRIGGER yetkileri authenticated'dan alınır (RLS TRUNCATE'i korumaz).
--   • BEFORE INSERT media_assets_pending_shape (SECURITY INVOKER, fail-closed: postgres, service_role ve
--     supabase_admin dışındaki her rolde çalışır) yalnız çağıran o kurumda media.manage / süper admin ise denetler
--     (değilse new döner, RLS tek tip reddeder, sayı sızmaz): status = 'pending'; kind property_photo ya da post_cover;
--     original_path satırın kendi sütunlarından üretilen kanonik yola eşit (id yolda); created_by boş ya da auth.uid();
--     byte_size 1–52428800; mime_type izinli 4 tür; kurum başına en çok 50 bekleyen ya da başarısız (pending + failed) satır (media_pending_limit).
--     Sayım kota kilidi altında yapılır (aynı anahtar).
--   • byte_size eklemede rezervasyon olarak kalır; gerçek boyut media_finalize ile yazılır.
--
-- Tekrar çalıştırılabilir. Veri değiştirmez.
-- GERİ DÖNÜŞ:
--   (B her zaman A'dan önce geri alınır)
--   drop trigger if exists media_assets_pending_shape on public.media_assets;
--   drop function if exists public.media_assets_pending_shape();
--   revoke update, insert on public.media_assets from authenticated;
--   grant update, insert on public.media_assets to authenticated;
--   grant truncate, references, trigger on public.media_assets to authenticated;
-- =============================================================================

do $guard$
begin
  if to_regprocedure('public.media_finalize(uuid,text,text,smallint[],integer,integer,text)') is null
     or to_regprocedure('public.media_mark_failed(uuid,text)') is null then
    raise exception 'apply A first';
  end if;
end
$guard$;

create or replace function public.media_assets_pending_shape()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin') then
    return new;
  end if;
  -- Yetkisiz çağıran: denetim yok; RLS WITH CHECK satırı tek tip reddeder
  if not (coalesce(new.organization_id in (select public.user_org_ids('media.manage')), false)
          or (select public.is_super_admin())) then
    return new;
  end if;
  if new.status is distinct from 'pending'
     or new.kind not in ('property_photo', 'post_cover')
     or (new.created_by is not null and new.created_by is distinct from (select auth.uid()))
     or new.byte_size is null or new.byte_size < 1 or new.byte_size > 52428800
     or new.mime_type is null or new.mime_type not in ('image/jpeg', 'image/png', 'image/webp', 'image/avif')
     or new.original_path is distinct from (
          case new.kind
            when 'property_photo' then
              case when new.property_id is null then null
                   else 'organizations/' || new.organization_id::text || '/properties/' || new.property_id::text
                        || '/images/' || new.id::text || '/original' end
            else 'organizations/' || new.organization_id::text || '/content/' || new.id::text || '/original'
          end) then
    raise exception 'media_invalid_input' using errcode = '23514';
  end if;
  -- Kurum başına bekleyen satır sınırı (kota kilidi altında, eşzamanlı eklemeler aşamaz)
  perform pg_advisory_xact_lock(hashtextextended('karay.quota:media_assets:' || new.organization_id::text, 0));
  if (select count(*) from public.media_assets m where m.organization_id = new.organization_id and m.status in ('pending', 'failed')) >= 50 then
    raise exception 'media_pending_limit' using errcode = 'P0001',
      hint = 'Çok fazla yükleme bekliyor; birkaçı işlenince yeniden deneyin.';
  end if;
  return new;
end;
$$;
revoke all on function public.media_assets_pending_shape() from public, anon, service_role;

drop trigger if exists media_assets_pending_shape on public.media_assets;
create trigger media_assets_pending_shape
  before insert on public.media_assets
  for each row execute function public.media_assets_pending_shape();

revoke update, insert on public.media_assets from authenticated;
revoke truncate, references, trigger on public.media_assets from authenticated;
grant update (alt_text, sort_order, is_cover) on public.media_assets to authenticated;
grant insert (id, organization_id, property_id, kind, status, original_path, mime_type, byte_size,
              original_filename, created_by, sort_order, alt_text) on public.media_assets to authenticated;

notify pgrst, 'reload schema';
