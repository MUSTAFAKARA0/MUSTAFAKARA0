-- =============================================================================
-- Pilot deneme bitişi — 3/5 UYGULAMA: supabase/pending/20261108000004_pilot_trial_end.sql (tek işlem)
--
-- ÖN KOŞUL: 01'de DUR yok · 02 saklandı · tam yedek alındı · sahibin yazılı onayı. Veri değiştirmez; yalnız fonksiyon ekler.
--   psql: psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f 03_apply.sql
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
    raise exception 'DUR: şema sürümü % — en az 20261018000001 gerekir', surum;
  end if;
  if to_regprocedure('public.assert_super_admin()') is null or to_regclass('public.subscriptions') is null then
    raise exception 'DUR: assert_super_admin() ya da subscriptions yok';
  end if;
end
$koruma$;

-- ---- 20261108000004_pilot_trial_end ----------------------------------------------
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
-- ---- gövde sonu ---------------------------------------------------------------------

do $kontrol$
begin
  if to_regprocedure('public.platform_set_trial_end(uuid,timestamptz)') is null
     or has_function_privilege('anon', 'public.platform_set_trial_end(uuid,timestamptz)', 'execute')
     or not has_function_privilege('authenticated', 'public.platform_set_trial_end(uuid,timestamptz)', 'execute') then
    raise exception 'KONTROL: platform_set_trial_end yok ya da yetkileri beklenen değil; işlem geri alınıyor';
  end if;
end
$kontrol$;

commit;

select 'platform_set_trial_end' as alan, (to_regprocedure('public.platform_set_trial_end(uuid,timestamptz)') is not null)::text as deger;
