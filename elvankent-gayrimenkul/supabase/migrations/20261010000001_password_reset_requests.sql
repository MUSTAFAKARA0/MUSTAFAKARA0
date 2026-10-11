-- =============================================================================
-- FAZ 0 — Şifre sıfırlama isteği hız sınırı + şema sürümü
--
-- Şifre sıfırlama e-postası artık KARAY'ın e-posta sağlayıcısıyla (EMAIL_PROVIDER) gönderilir:
-- bağlantı sunucuda Auth yönetici API'siyle (generateLink) üretilir. Bu yol Supabase Auth'un kendi
-- "recover" hız sınırından geçmediği için sınır burada uygulanır:
--   • aynı e-posta için saatte en fazla 3 istek,
--   • aynı IP özeti için saatte en fazla 10 istek.
-- Sınır hesabın var olup olmamasından BAĞIMSIZDIR (kullanıcı listesi tahmin edilemez). E-posta
-- düz metin olarak saklanmaz: sunucu tuzlu özetini (64 hex) gönderir, kayıt audit_logs'a yazılır.
--
-- Fonksiyon YALNIZCA sunucu anahtarıyla (service_role) çağrılabilir.
--
-- karay_schema_version(): uygulanmış en son KARAY migration'ının kimliği. Canlıya çıkış kontrolü
-- (npm run prelaunch -- --production) ve son kontrol betiği bunu beklenen değerle karşılaştırır.
-- Sonraki her migration bu fonksiyonu kendi kimliğiyle yeniden tanımlar.
--
-- Veri değiştirmez; tekrar çalıştırılabilir.
--
-- Geri dönüş:
--   drop function if exists public.auth_password_reset_allowed(text, text);
--   drop function if exists public.karay_schema_version();
-- =============================================================================

create or replace function public.auth_password_reset_allowed(p_email_hash text, p_ip_hash text default null)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_email_hash is null or p_email_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_request' using errcode = '22023';
  end if;
  if p_ip_hash is not null and (char_length(p_ip_hash) > 128 or p_ip_hash !~ '^[0-9a-f]+$') then
    raise exception 'invalid_request' using errcode = '22023';
  end if;
  -- Aynı adres için saatte 3 istek (hesap var olsun olmasın)
  if (select count(*) from public.audit_logs a
       where a.organization_id is null and a.action = 'auth.password_reset_requested'
         and a.target_type = 'email_hash' and a.target_id = p_email_hash
         and a.created_at > now() - interval '1 hour') >= 3 then
    return false;
  end if;
  -- Aynı istemci (IP özeti) için saatte 10 istek
  if p_ip_hash is not null and (select count(*) from public.audit_logs a
       where a.organization_id is null and a.action = 'auth.password_reset_requested'
         and a.ip_hash = p_ip_hash and a.created_at > now() - interval '1 hour') >= 10 then
    return false;
  end if;
  insert into public.audit_logs (organization_id, actor_id, actor_label, action, target_type, target_id, metadata, ip_hash)
  values (null, null, null, 'auth.password_reset_requested', 'email_hash', p_email_hash, '{}'::jsonb, p_ip_hash);
  return true;
end;
$$;
revoke all on function public.auth_password_reset_allowed(text, text) from public, anon, authenticated;
grant execute on function public.auth_password_reset_allowed(text, text) to service_role;

create or replace function public.karay_schema_version()
returns text
language sql
immutable
set search_path = ''
as $$ select '20261010000001'::text $$;
revoke all on function public.karay_schema_version() from public;
grant execute on function public.karay_schema_version() to anon, authenticated, service_role;
