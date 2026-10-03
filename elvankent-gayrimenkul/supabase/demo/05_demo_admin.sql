-- =============================================================================
-- DEMO KURULUM 5 — Demo yönetici hesabını ofise "sahip" ve platform süper admin yapar
-- YALNIZCA DEMO SUPABASE PROJESİ İÇİNDİR. Canlı (production) veritabanında çalıştırmayın.
--
-- Önce: Supabase › Authentication › Users › Add user › Create new user
--       (e-posta + güçlü şifre, "Auto Confirm User" işaretli). Demo veritabanında
--       TEK kullanıcı olmalıdır; bu dosya o kullanıcıyı kendisi bulur (düzenleme gerekmez).
-- Şifre bu dosyada yoktur; tekrar çalıştırılabilir. Son satır sonucu tablo olarak gösterir
-- (beklenen: e-postanız | owner | true).
-- =============================================================================
do $$
begin
  if to_regclass('elvankent_demo.environment') is null then
    raise exception 'DURDURULDU: Bu veritabanı DEMO olarak işaretli değil (01_v1_schema.sql ile kurulmamış). Canlı veritabanında çalıştırmayın.';
  end if;
  if (select count(*) from auth.users) <> 1 then
    raise exception 'Beklenen: tek kullanıcı. Bulunan: %. Authentication › Users bölümünü kontrol edin.', (select count(*) from auth.users);
  end if;
  if not exists (select 1 from public.organizations where slug = 'elvankent') then
    raise exception 'Varsayılan ofis (elvankent) bulunamadı: 01–03 dosyaları eksiksiz çalıştırılmamış.';
  end if;
end $$;

insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;

update public.profiles set is_super_admin = true
where id = (select id from auth.users);

insert into public.organization_members (organization_id, user_id, role, status)
select o.id, u.id, 'owner', 'active'
from public.organizations o, auth.users u
where o.slug = 'elvankent'
on conflict (organization_id, user_id) do update set role = 'owner', status = 'active';

select u.email, m.role as rol, p.is_super_admin as super_admin
from auth.users u
join public.profiles p on p.id = u.id
left join public.organization_members m on m.user_id = u.id;
