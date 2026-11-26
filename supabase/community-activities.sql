-- Community participation is reported as household activity estimates, not as
-- measured improvements in city air quality. Safe to run more than once.
create table if not exists public.community_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  city text not null check (length(trim(city)) between 1 and 100),
  activity_type text not null check (activity_type in ('shared_trip','combined_errands','public_transport','active_trip')),
  distance_km numeric(10,2) not null check (distance_km >= 0),
  estimated_co2e_avoided_kg numeric(10,3) not null check (estimated_co2e_avoided_kg >= 0),
  created_at timestamptz not null default now()
);

create index if not exists community_activities_user_created_idx
  on public.community_activities(user_id, created_at desc);
create index if not exists community_activities_city_created_idx
  on public.community_activities(lower(city), created_at desc);

alter table public.community_activities enable row level security;
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.community_activities to authenticated;
revoke all on public.community_activities from anon;

drop policy if exists "Users read own community activities" on public.community_activities;
create policy "Users read own community activities" on public.community_activities
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users insert own community activities" on public.community_activities;
create policy "Users insert own community activities" on public.community_activities
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users update own community activities" on public.community_activities;
create policy "Users update own community activities" on public.community_activities
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users delete own community activities" on public.community_activities;
create policy "Users delete own community activities" on public.community_activities
  for delete to authenticated using (auth.uid() = user_id);

-- Aggregate only after at least five distinct households have participated in
-- the last 30 days. No household-level rows are returned by this RPC.
create or replace function public.get_airaware_community_stats(p_city text)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  city_key text := lower(trim(coalesce(p_city, '')));
  household_count integer;
  action_count integer;
  estimated_total numeric;
begin
  if auth.uid() is null or city_key = '' then
    return jsonb_build_object('available', false, 'reason', 'sign_in_required');
  end if;

  select count(distinct a.user_id), count(*), coalesce(sum(a.estimated_co2e_avoided_kg), 0)
    into household_count, action_count, estimated_total
  from public.community_activities a
  where lower(trim(a.city)) = city_key
    and a.created_at >= now() - interval '30 days';

  if household_count < 5 then
    return jsonb_build_object('available', false, 'reason', 'privacy_threshold');
  end if;

  return jsonb_build_object(
    'available', true,
    'participating_households', household_count,
    'activities_logged', action_count,
    'estimated_co2e_avoided_kg', round(estimated_total, 2),
    'period_days', 30,
    'updated_at', now()
  );
end;
$$;

revoke all on function public.get_airaware_community_stats(text) from public, anon;
grant execute on function public.get_airaware_community_stats(text) to authenticated;

notify pgrst, 'reload schema';
