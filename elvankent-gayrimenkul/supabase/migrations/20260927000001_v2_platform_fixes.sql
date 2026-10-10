-- =============================================================================
-- V2 / 10 — Platform düzeltmesi: süper admin'in yeni organizasyona sahip
-- (owner) üyeliği ekleyebilmesi.
--
-- Sorun: platform_create_organization() sahip üyeliğini eklerken
-- organization_members_guard tetikleyicisi, işlemi yapan kullanıcının (süper
-- admin) yeni organizasyonda zaten sahip olmasını bekliyordu ve işlem
-- 'owner_required' hatasıyla geri alınıyordu.
--
-- Düzeltme (yalnızca süper admin için):
--   • Sahip (owner) rolü kuralları uygulanmaz.
--   • Süper admin kendisini yeni bir organizasyona sahip olarak ekleyebilir (INSERT).
-- Plan kullanıcı limiti ve "son aktif sahip" koruması HERKES için geçerlidir.
-- Normal kullanıcıların davranışı değişmez. Süper adminler başka bir
-- organizasyonun üyelik tablosuna RLS nedeniyle doğrudan yazamaz; bu yol
-- platform_* fonksiyonları içindir.
--
-- Ayrıca organizasyonun kendisi silinirken (zincirleme silme) üyelik kuralları
-- atlanır; aksi halde organizasyon hiç silinemiyordu.
--
-- Mevcut verileri değiştirmez; yalnızca fonksiyonları ve yetkileri günceller
-- (create or replace / grant → tekrar çalıştırılması güvenlidir).
-- =============================================================================

create or replace function public.organization_members_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_actor_role public.org_role;
  v_org uuid := coalesce(new.organization_id, old.organization_id);
  v_target_user uuid := coalesce(new.user_id, old.user_id);
  v_max_users integer;
  v_active_count integer;
  v_super boolean := false;
begin
  -- Organizasyonun kendisi siliniyorsa (zincirleme silme) üyelik kuralları uygulanmaz
  if tg_op = 'DELETE' and not exists (select 1 from public.organizations o where o.id = v_org) then
    return old;
  end if;

  -- Plan limiti (aktif üye sayısı)
  if tg_op in ('INSERT', 'UPDATE') and new.status = 'active'
     and (tg_op = 'INSERT' or old.status <> 'active') then
    select max_users into v_max_users from public.org_plan(v_org);
    if v_max_users is not null then
      select count(*) into v_active_count from public.organization_members
       where organization_id = v_org and status = 'active';
      if v_active_count >= v_max_users then
        raise exception 'plan_limit_users' using errcode = 'P0001',
          hint = 'Planınızın kullanıcı limitine ulaşıldı.';
      end if;
    end if;
  end if;

  if v_actor is null then
    return coalesce(new, old);
  end if;

  v_super := public.is_super_admin();

  if v_actor = v_target_user and not (v_super and tg_op = 'INSERT') then
    raise exception 'cannot_modify_self' using errcode = '42501',
      hint = 'Kendi rolünüzü veya üyeliğinizi değiştiremezsiniz.';
  end if;

  select m.role into v_actor_role from public.organization_members m
   where m.organization_id = v_org and m.user_id = v_actor and m.status = 'active';

  if not v_super and v_actor_role is distinct from 'owner' and (
       (tg_op in ('INSERT', 'UPDATE') and new.role = 'owner')
    or (tg_op in ('UPDATE', 'DELETE') and old.role = 'owner')
  ) then
    raise exception 'owner_required' using errcode = '42501',
      hint = 'Sahip (owner) rolüyle ilgili işlemleri yalnızca bir sahip yapabilir.';
  end if;

  if tg_op in ('UPDATE', 'DELETE') and old.role = 'owner' and old.status = 'active'
     and (tg_op = 'DELETE' or new.role <> 'owner' or new.status <> 'active') then
    if (select count(*) from public.organization_members
         where organization_id = v_org and role = 'owner' and status = 'active') <= 1 then
      raise exception 'last_owner' using errcode = '42501',
        hint = 'Organizasyonun en az bir aktif sahibi olmalıdır.';
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

-- =============================================================================
-- Organizasyon silinebilmeli (ör. KVKK kapsamında veri silme talebi).
--
-- Sorun: organizasyon silinirken zincirleme silinen alt kayıtların (alan adı,
-- üyelik, ilan, medya...) denetim tetikleyicileri, silinmekte olan
-- organizasyona ait yeni bir denetim kaydı yazmaya çalışıyor; yabancı anahtar
-- ihlali nedeniyle tüm silme işlemi geri alınıyordu.
-- Düzeltme: organizasyon artık yoksa o organizasyona kayıt yazılmaz (kayıtları
-- zaten organizasyonla birlikte silinir). Platform kayıtları (p_org null) ve
-- normal işlemler etkilenmez.
-- =============================================================================
create or replace function public.write_audit(
  p_org uuid,
  p_action text,
  p_target_type text,
  p_target_id text,
  p_target_label text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if p_org is not null and not exists (select 1 from public.organizations o where o.id = p_org) then
    return;
  end if;
  insert into public.audit_logs (organization_id, actor_id, actor_label, action, target_type, target_id, target_label, metadata)
  values (p_org, v_actor, public.audit_actor_label(v_actor), p_action, p_target_type, p_target_id,
          left(p_target_label, 200), coalesce(p_metadata, '{}'::jsonb));
end;
$$;

-- =============================================================================
-- Medya: anonim ziyaretçiye yalnızca görüntüleme için gereken sütunlar.
--
-- media_public_read politikası yayındaki ilanların hazır görsellerini herkese
-- açar; ancak tablo düzeyindeki SELECT yetkisi iç sütunları da (orijinal dosya
-- adı, özel depolama yolu, yükleyen kullanıcı, hata metni, dosya boyutu)
-- anonim kullanıcıya gösteriyordu. Sütun düzeyinde yetkiyle yalnızca sitede
-- kullanılan alanlar açık bırakılır. Oturum açmış kullanıcıların (yönetim
-- paneli) yetkileri değişmez.
-- =============================================================================
revoke select on public.media_assets from anon;
grant select (
  id, property_id, kind, status, public_base, legacy_path, variant_widths,
  width, height, blur_data_url, alt_text, sort_order, is_cover
) on public.media_assets to anon;

-- =============================================================================
-- Silinen ilanın adresi için yönlendirme: organizasyonun kendisi silinirken
-- (zincirleme silme) yönlendirme eklenmez; aksi halde silinmekte olan
-- organizasyona kayıt eklenmeye çalışılıyor ve organizasyon silinemiyordu.
-- =============================================================================
create or replace function public.properties_after_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target text;
begin
  if old.published_at is null
     or not exists (select 1 from public.organizations o where o.id = old.organization_id) then
    return old;
  end if;
  v_target := case
    when old.category = 'arsa' then '/arsa'
    when old.category = 'ticari' then '/ticari'
    when old.listing_type = 'rent' then '/kiralik'
    else '/satilik'
  end;
  insert into public.redirects (organization_id, from_path, to_path, status_code)
  values (old.organization_id, '/ilan/' || old.slug, v_target, 301)
  on conflict (organization_id, from_path) do update set to_path = excluded.to_path, status_code = 301;
  update public.redirects set to_path = v_target
   where organization_id = old.organization_id and to_path = '/ilan/' || old.slug;
  return old;
end;
$$;
