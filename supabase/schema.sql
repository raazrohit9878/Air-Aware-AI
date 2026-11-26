-- Run this in the Supabase SQL Editor. Auth passwords remain in auth.users;
-- this table contains household profile data only.
create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text not null,
  age_range text,
  city text not null,
  state text,
  country text not null default 'India',
  preferred_language text not null default 'English',
  household_type text not null default 'Individual',
  household_size integer check (household_size is null or household_size between 1 and 50),
  optional_sensitivities text[] not null default '{}',
  commute_method text not null default 'Private car',
  outdoor_activity_time text not null default 'Morning',
  air_purifier_available boolean not null default false,
  air_conditioning_available boolean not null default false,
  kitchen_exhaust_available boolean not null default false,
  outdoor_ventilation_available boolean not null default true,
  budget_preference text not null default 'Low cost first',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Upgrade an existing/older user_profiles table as well as creating a new one.
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

create unique index if not exists user_profiles_user_id_unique_idx
  on public.user_profiles(user_id);

alter table public.user_profiles enable row level security;
revoke all on public.user_profiles from anon;
grant select, insert, update, delete on public.user_profiles to authenticated;

drop policy if exists "Users read own profile" on public.user_profiles;
create policy "Users read own profile" on public.user_profiles for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users create own profile" on public.user_profiles;
create policy "Users create own profile" on public.user_profiles for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users update own profile" on public.user_profiles;
create policy "Users update own profile" on public.user_profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users delete own profile" on public.user_profiles;
create policy "Users delete own profile" on public.user_profiles for delete to authenticated using ((select auth.uid()) = user_id);

create index if not exists user_profiles_user_id_idx on public.user_profiles(user_id);

-- Make the new table visible to Supabase's Data API/PostgREST immediately.
notify pgrst, 'reload schema';
