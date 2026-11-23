-- =============================================================================
-- Kiracı izolasyonu kalanları (J) — 5/5 GERİ DÖNÜŞ (tek işlem). Önceki gövde, yetkiler ve politika geri gelir.
--   psql: psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f 05_rollback.sql   → sonra 01: 5. satır 0, 6–7. satırlar 02 ile aynı
-- =============================================================================
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

drop trigger if exists leads_assignee_guard on public.leads;
drop trigger if exists appointments_assignee_guard on public.appointments;
drop function if exists public.crm_assignee_guard();

create or replace function public.get_public_collection(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_col public.collections;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{32,64}$' then
    return jsonb_build_object('status', 'not_found');
  end if;

  select c.* into v_col
    from public.collections c
    join public.organizations o on o.id = c.organization_id and o.status = 'active'
   where c.token = p_token;

  if v_col.id is null then
    return jsonb_build_object('status', 'not_found');
  end if;
  if v_col.revoked_at is not null then
    return jsonb_build_object('status', 'revoked', 'organization_id', v_col.organization_id);
  end if;
  if v_col.expires_at is not null and v_col.expires_at < now() then
    return jsonb_build_object('status', 'expired', 'organization_id', v_col.organization_id);
  end if;

  update public.collections set view_count = view_count + 1, last_viewed_at = now() where id = v_col.id;

  return jsonb_build_object(
    'status', 'ok',
    'organization_id', v_col.organization_id,
    'title', v_col.title,
    'message', v_col.message,
    'created_at', v_col.created_at,
    'expires_at', v_col.expires_at,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object('property_id', i.property_id, 'note', i.note) order by i.sort_order, i.created_at)
        from public.collection_items i
        join public.properties p on p.id = i.property_id
       where i.collection_id = v_col.id
         and p.status in ('published', 'sold', 'rented') and p.deleted_at is null
    ), '[]'::jsonb)
  );
end;
$$;
grant execute on function public.get_public_collection(text) to anon, authenticated;

grant select on public.organization_settings, public.organization_domains to anon;

drop policy if exists "neighborhoods_insert_members" on public.neighborhoods;
create policy "neighborhoods_insert_members" on public.neighborhoods for insert to authenticated
  with check (exists (select 1 from public.user_org_ids('properties.create')));

notify pgrst, 'reload schema';
commit;

select 'atama tetikleyicileri' as alan, (select count(*)::text from pg_trigger where tgname in ('leads_assignee_guard', 'appointments_assignee_guard') and not tgisinternal) as deger;
