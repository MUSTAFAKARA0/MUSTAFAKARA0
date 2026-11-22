-- =============================================================================
-- PILOT · Deneme (pilot) süresinin bitiş tarihini KARAYS konsolundan belirleme (H)
--
-- BEKLEYEN migration: supabase/migrations/ altında DEĞİL, canlıya uygulanmaz. Yayına sahibin yazılı onayı ve
-- supabase/ops/pilot_trial_end/ betikleriyle alınır. Başka bekleyen dosyaya bağlı değildir.
--
-- Sorun: platform_create_organization ve platform_set_org_plan denemeyi sabit 14 günle açar. Ücretsiz pilot ofis
-- (ör. 60 gün) 15. günden itibaren panelde "deneme süreniz bitti" şeridini görür. Otomatik kısıtlama yoktur (OPS-02
-- bayrağı kapalı); sorun görünürlük ve güvendir.
--
-- Düzeltme: platform_set_trial_end(p_org, p_ends_at) — yalnız süper yönetici; kurumun GÜNCEL deneme (trialing)
-- aboneliğinin trial_ends_at değerini değiştirir. Sınır: şimdiden en az 1 gün, en çok 365 gün sonra. Plan, durum,
-- limitler ve abonelik geçmişi değişmez; yeni abonelik satırı açılmaz. Denetim kaydı yazılır.
-- Ödeme/tahsilat yoktur (P0-7 ertelendi).
-- Tekrar çalıştırılabilir.
--
-- GERİ DÖNÜŞ: (05_rollback.sql — girilmiş tarihler kalır; yalnız fonksiyon kaldırılır)
--   drop function if exists public.platform_set_trial_end(uuid, timestamptz);
-- =============================================================================

create or replace function public.platform_set_trial_end(p_org uuid, p_ends_at timestamptz)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_sub uuid;
  v_old timestamptz;
begin
  perform public.assert_super_admin();
  if p_ends_at is null or p_ends_at < now() + interval '1 day' or p_ends_at > now() + interval '365 days' then
    raise exception 'invalid_trial_end' using errcode = 'P0001',
      hint = 'Deneme bitişi en az 1 gün, en çok 365 gün sonrası olmalıdır.';
  end if;
  select s.id, s.trial_ends_at into v_sub, v_old
    from public.subscriptions s
   where s.organization_id = p_org and s.status = 'trialing'
   order by s.started_at desc
   limit 1
   for update;
  if v_sub is null then
    raise exception 'no_trial_subscription' using errcode = 'P0001',
      hint = 'Kurumun etkin bir deneme aboneliği yok; önce planı "deneme" durumunda atayın.';
  end if;
  update public.subscriptions set trial_ends_at = p_ends_at where id = v_sub;
  perform public.log_security_event(p_org, 'subscription.trial_end_set', (select auth.uid()), 'subscription', v_sub::text, null,
    jsonb_build_object('from', v_old, 'to', p_ends_at), null);
  return p_ends_at;
end;
$$;
revoke all on function public.platform_set_trial_end(uuid, timestamptz) from public, anon, service_role;
grant execute on function public.platform_set_trial_end(uuid, timestamptz) to authenticated;

notify pgrst, 'reload schema';
