-- =============================================================================
-- DEMO KURULUM 5 — Demo yönetici hesabını ofise "sahip" ve platform süper admin yapar
-- YALNIZCA DEMO SUPABASE PROJESİ İÇİNDİR. Canlı (production) veritabanında çalıştırmayın.
--
-- Önce: Supabase › Authentication › Users › Add user › Create new user
--       (e-posta + güçlü şifre, "Auto Confirm User" işaretli).
-- Sonra: aşağıdaki v_email satırındaki adresi o e-postayla değiştirip Run.
-- Şifre bu dosyaya YAZILMAZ; tekrar çalıştırılabilir.
-- =============================================================================
do $demo_admin$
declare
  v_email text := 'DEMO-YONETICI-EPOSTASI@ornek.com';   -- ← yalnızca bu satırı değiştirin
  v_user uuid;
  v_org uuid;
begin
  if to_regclass('elvankent_demo.environment') is null then
    raise exception 'DURDURULDU: Bu veritabanı DEMO olarak işaretli değil (01_v1_schema.sql ile kurulmamış). Canlı veritabanında çalıştırmayın.';
  end if;
  if v_email ilike 'DEMO-YONETICI-EPOSTASI%' then
    raise exception 'v_email satırına Authentication › Users bölümünde oluşturduğunuz e-posta adresini yazın.';
  end if;

  select id into v_user from auth.users where lower(email) = lower(trim(v_email));
  if v_user is null then
    raise exception 'Kullanıcı bulunamadı: %. Önce Authentication › Users › Add user ile oluşturun.', v_email;
  end if;

  select id into v_org from public.organizations where slug = 'elvankent';
  if v_org is null then
    raise exception 'Varsayılan ofis (elvankent) bulunamadı: 01–03 dosyaları eksiksiz çalıştırılmamış.';
  end if;

  insert into public.profiles (id) values (v_user) on conflict (id) do nothing;
  update public.profiles set is_super_admin = true where id = v_user;

  insert into public.organization_members (organization_id, user_id, role, status)
  values (v_org, v_user, 'owner', 'active')
  on conflict (organization_id, user_id) do update set role = 'owner', status = 'active';

  raise notice 'Tamam: % → Elvankent Gayrimenkul (DEMO) sahibi + süper admin', v_email;
end
$demo_admin$;
