-- Run this in the Supabase SQL Editor when public.user_profiles already exists
-- but is missing fields required by the AirAware app.
alter table public.user_profiles
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists full_name text,
  add column if not exists age_range text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists country text default 'India',
  add column if not exists preferred_language text not null default 'English',
  add column if not exists household_type text not null default 'Individual',
  add column if not exists household_size integer,
  add column if not exists optional_sensitivities text[] not null default '{}',
  add column if not exists commute_method text not null default 'Private car',
  add column if not exists outdoor_activity_time text not null default 'Morning',
  add column if not exists air_purifier_available boolean not null default false,
  add column if not exists air_conditioning_available boolean not null default false,
  add column if not exists kitchen_exhaust_available boolean not null default false,
  add column if not exists outdoor_ventilation_available boolean not null default true,
  add column if not exists budget_preference text not null default 'Low cost first',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- In this project's legacy table, id also references auth.users(id). For rows
-- whose owner column is empty, safely restore that owner link from the FK-backed
-- ID. Leave rows untouched if another row already owns the same user_id.
update public.user_profiles as profile
set user_id = profile.id
where profile.user_id is null
  and exists (select 1 from auth.users as auth_user where auth_user.id = profile.id)
  and not exists (
    select 1 from public.user_profiles as other_profile
    where other_profile.user_id = profile.id
  );

create unique index if not exists user_profiles_user_id_unique_idx
  on public.user_profiles(user_id);

alter table public.user_profiles enable row level security;
grant usage on schema public to authenticated;
revoke all on public.user_profiles from anon;
grant select, insert, update, delete on public.user_profiles to authenticated;

drop policy if exists "Users read own profile" on public.user_profiles;
create policy "Users read own profile" on public.user_profiles
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users create own profile" on public.user_profiles;
create policy "Users create own profile" on public.user_profiles
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users update own profile" on public.user_profiles;
create policy "Users update own profile" on public.user_profiles
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists "Users delete own profile" on public.user_profiles;
create policy "Users delete own profile" on public.user_profiles
  for delete to authenticated using ((select auth.uid()) = user_id);

notify pgrst, 'reload schema';
