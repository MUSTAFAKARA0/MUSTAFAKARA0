-- =============================================================================
-- Medya sütun yetkileri — 3/5 UYGULAMA: supabase/pending/20261027000002_media_column_privileges.sql (tek işlem)
--
-- ESKİ KODU BOZAR (son güncelleme 42501). ÖN KOŞUL (hepsi): A (media_finalize_rpc) uygulanmış · YENİ KOD production'da
-- ve ona geçildiği, canlıda bir yükleme + döndürme denemesinin başarılı olduğu kaydedildi (README) · 01 çıktısında DUR yok ·
-- 02 çıktısı saklandı · tam yedek alındı · bu adım için yazılı O-5 onayı var.
--   Supabase SQL Editor: dosyanın TAMAMI tek sorgu olarak (metin seçili değilken) Run.
--   psql: psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f 03_apply.sql
--
-- Davranış:
--   • Tek işlem. Herhangi bir adım hata verirse HİÇBİR değişiklik kalmaz. lock_timeout 3 sn, statement_timeout 30 sn
--     (REVOKE/GRANT/CREATE TRIGGER media_assets üzerinde kilit ister; 55P03'te hiçbir şey değişmemiştir, sakin anda tekrar).
--   • Koruma: şema sürümü en az 20261018000001; A kurulu ('apply A first'); media_finalize sahibi storage.objects okuyabilir.
--   • Gövde supabase/pending/20261027000002_media_column_privileges.sql ile birebir aynıdır (birim testi LR-14 denetler). Tekrar çalıştırılabilir. Veri değiştirmez.
--   • Geri dönüş: 05 (B HER ZAMAN A'dan önce geri alınır; B'den sonra kod geri alınacaksa ÖNCE 05).
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
  if to_regclass('public.media_assets') is null or to_regprocedure('public.org_plan(uuid)') is null
     or to_regprocedure('public.has_org_permission(uuid,text)') is null or to_regprocedure('public.is_super_admin()') is null
     or to_regclass('storage.objects') is null then
    raise exception 'DUR: public.media_assets ya da org_plan / has_org_permission / is_super_admin / storage.objects yok';
  end if;
  if to_regprocedure('public.media_finalize(uuid,text,text,smallint[],integer,integer,text)') is null
     or to_regprocedure('public.media_mark_failed(uuid,text)') is null then
    raise exception 'DUR: apply A first — media_finalize / media_mark_failed yok (media_finalize_rpc/03_apply.sql)';
  end if;
  if not exists (select 1 from pg_proc p join pg_roles o on o.oid = p.proowner
                  where p.oid = to_regprocedure('public.media_finalize(uuid,text,text,smallint[],integer,integer,text)')
                    and has_table_privilege(o.oid, 'storage.objects', 'select') and o.rolbypassrls) then
    raise exception 'DUR: media_finalize sahibinin storage.objects üzerinde SELECT hakkı ve RLS atlaması yok (her sonlandırma media_not_uploaded olur)';
  end if;
end
$koruma$;

-- ---- 20261027000002_media_column_privileges (gövde, değiştirilmeden) ----------------
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
-- ---- gövde sonu --------------------------------------------------------------

-- Aynı işlemde kontrol: beklenen sonuç yoksa hata → commit yerine geri alma
do $kontrol$
declare adet int; surum text;
begin
  select count(*) into adet from pg_trigger
   where tgname = 'media_assets_pending_shape' and not tgisinternal and tgrelid = to_regclass('public.media_assets');
  if adet <> 1 then
    raise exception 'KONTROL: media_assets_pending_shape sayısı % (beklenen 1); işlem geri alınıyor', adet;
  end if;
  if has_table_privilege('authenticated', 'public.media_assets', 'update') or has_table_privilege('authenticated', 'public.media_assets', 'insert')
     or has_table_privilege('authenticated', 'public.media_assets', 'truncate') then
    raise exception 'KONTROL: authenticated tablo düzeyinde UPDATE/INSERT/TRUNCATE yetkisi taşıyor; işlem geri alınıyor';
  end if;
  if has_column_privilege('authenticated', 'public.media_assets', 'status', 'update')
     or has_column_privilege('authenticated', 'public.media_assets', 'byte_size', 'update')
     or has_column_privilege('authenticated', 'public.media_assets', 'public_base', 'update')
     or not has_column_privilege('authenticated', 'public.media_assets', 'alt_text', 'update')
     or not has_column_privilege('authenticated', 'public.media_assets', 'sort_order', 'update')
     or not has_column_privilege('authenticated', 'public.media_assets', 'is_cover', 'update') then
    raise exception 'KONTROL: sütun UPDATE yetkileri beklenen değil; işlem geri alınıyor';
  end if;
  if has_column_privilege('authenticated', 'public.media_assets', 'variants_byte_size', 'insert')
     or has_column_privilege('authenticated', 'public.media_assets', 'public_base', 'insert')
     or not has_column_privilege('authenticated', 'public.media_assets', 'original_path', 'insert')
     or not has_table_privilege('authenticated', 'public.media_assets', 'delete') then
    raise exception 'KONTROL: sütun INSERT/DELETE yetkileri beklenen değil; işlem geri alınıyor';
  end if;
  execute 'select public.karay_schema_version()' into surum;
  if surum < '20261018000001' then
    raise exception 'KONTROL: şema sürümü % değişmiş görünüyor; işlem geri alınıyor', surum;
  end if;
end
$kontrol$;

commit;

-- Sonuç (yalnızca okur). Tam kontrol: 04_postflight.sql
select 'media_assets_pending_shape tetikleyici sayısı' as alan,
       (select count(*)::text from pg_trigger where tgname = 'media_assets_pending_shape' and not tgisinternal) as deger;
