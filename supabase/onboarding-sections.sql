-- AirAware onboarding Sections 2-5.
-- Safe to rerun: does not drop tables/columns or remove user data. Existing
-- invalid legacy rows are retained; NOT VALID checks enforce future writes.

create table if not exists public.household_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  household_type text not null,
  household_size integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint household_profiles_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade,
  constraint household_profiles_household_type_check check (household_type in ('Individual','Family with children','Family with senior citizens','Working professional','Student','Other')),
  constraint household_profiles_household_size_check check (household_size is null or household_size > 0)
);

create table if not exists public.sensitivity_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  respiratory_sensitivity boolean not null default false,
  asthma_concerns boolean not null default false,
  allergies boolean not null default false,
  other_air_pollution_sensitivity boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sensitivity_profiles_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade
);

create table if not exists public.lifestyle_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  usual_commute text,
  usual_outdoor_activity_time text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lifestyle_profiles_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade,
  constraint lifestyle_profiles_usual_commute_check check (usual_commute is null or usual_commute in ('Private car','Two-wheeler','Public transportation','Walking','Cycling','Work from home','Mixed / varies')),
  constraint lifestyle_profiles_activity_time_check check (usual_outdoor_activity_time is null or usual_outdoor_activity_time in ('Morning','Afternoon','Evening','Varies','Rarely outdoors'))
);

create table if not exists public.home_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  air_purifier_available boolean not null default false,
  air_conditioning_available boolean not null default false,
  kitchen_exhaust_ventilation boolean not null default false,
  can_open_windows boolean not null default false,
  budget_preference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint home_profiles_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade,
  constraint home_profiles_budget_preference_check check (budget_preference is null or budget_preference in ('Low cost first','No extra budget','Some flexibility','Can invest in equipment'))
);

-- Add absent columns to partial tables without dropping or rewriting data.
alter table public.household_profiles
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists user_id uuid,
  add column if not exists household_type text,
  add column if not exists household_size integer,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();
alter table public.sensitivity_profiles
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists user_id uuid,
  add column if not exists respiratory_sensitivity boolean not null default false,
  add column if not exists asthma_concerns boolean not null default false,
  add column if not exists allergies boolean not null default false,
  add column if not exists other_air_pollution_sensitivity boolean not null default false,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();
alter table public.lifestyle_profiles
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists user_id uuid,
  add column if not exists usual_commute text,
  add column if not exists usual_outdoor_activity_time text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();
alter table public.home_profiles
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists user_id uuid,
  add column if not exists air_purifier_available boolean not null default false,
  add column if not exists air_conditioning_available boolean not null default false,
  add column if not exists kitchen_exhaust_ventilation boolean not null default false,
  add column if not exists can_open_windows boolean not null default false,
  add column if not exists budget_preference text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- Backfill UUIDs only where missing; this preserves all existing user data.
update public.household_profiles set id = gen_random_uuid() where id is null;
update public.sensitivity_profiles set id = gen_random_uuid() where id is null;
update public.lifestyle_profiles set id = gen_random_uuid() where id is null;
update public.home_profiles set id = gen_random_uuid() where id is null;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['household_profiles','sensitivity_profiles','lifestyle_profiles','home_profiles'] loop
    execute format('alter table public.%I alter column id set default gen_random_uuid()', table_name);
    execute format('alter table public.%I alter column id set not null', table_name);
    if not exists (
      select 1 from pg_constraint
      where conrelid = format('public.%I', table_name)::regclass
        and contype = 'p'
    ) then
      execute format('alter table public.%I add constraint %I primary key (id)', table_name, table_name || '_pkey');
    end if;
  end loop;
end
$$;

-- Add missing FK/check constraints by name. NOT VALID keeps legacy rows intact.
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.household_profiles'::regclass and conname='household_profiles_user_id_fkey') then alter table public.household_profiles add constraint household_profiles_user_id_fkey foreign key(user_id) references auth.users(id) on delete cascade not valid; end if;
  if not exists (select 1 from pg_constraint where conrelid='public.household_profiles'::regclass and conname='household_profiles_user_id_required_check') then alter table public.household_profiles add constraint household_profiles_user_id_required_check check(user_id is not null) not valid; end if;
  if not exists (select 1 from pg_constraint where conrelid='public.household_profiles'::regclass and conname='household_profiles_type_required_check') then alter table public.household_profiles add constraint household_profiles_type_required_check check(household_type is not null) not valid; end if;
  if not exists (select 1 from pg_constraint where conrelid='public.household_profiles'::regclass and conname='household_profiles_household_type_check') then alter table public.household_profiles add constraint household_profiles_household_type_check check(household_type in ('Individual','Family with children','Family with senior citizens','Working professional','Student','Other')) not valid; end if;
  if not exists (select 1 from pg_constraint where conrelid='public.household_profiles'::regclass and conname='household_profiles_household_size_check') then alter table public.household_profiles add constraint household_profiles_household_size_check check(household_size is null or household_size > 0) not valid; end if;

  if not exists (select 1 from pg_constraint where conrelid='public.sensitivity_profiles'::regclass and conname='sensitivity_profiles_user_id_fkey') then alter table public.sensitivity_profiles add constraint sensitivity_profiles_user_id_fkey foreign key(user_id) references auth.users(id) on delete cascade not valid; end if;
  if not exists (select 1 from pg_constraint where conrelid='public.sensitivity_profiles'::regclass and conname='sensitivity_profiles_user_id_required_check') then alter table public.sensitivity_profiles add constraint sensitivity_profiles_user_id_required_check check(user_id is not null) not valid; end if;

  if not exists (select 1 from pg_constraint where conrelid='public.lifestyle_profiles'::regclass and conname='lifestyle_profiles_user_id_fkey') then alter table public.lifestyle_profiles add constraint lifestyle_profiles_user_id_fkey foreign key(user_id) references auth.users(id) on delete cascade not valid; end if;
  if not exists (select 1 from pg_constraint where conrelid='public.lifestyle_profiles'::regclass and conname='lifestyle_profiles_user_id_required_check') then alter table public.lifestyle_profiles add constraint lifestyle_profiles_user_id_required_check check(user_id is not null) not valid; end if;
  if not exists (select 1 from pg_constraint where conrelid='public.lifestyle_profiles'::regclass and conname='lifestyle_profiles_usual_commute_check') then alter table public.lifestyle_profiles add constraint lifestyle_profiles_usual_commute_check check(usual_commute is null or usual_commute in ('Private car','Two-wheeler','Public transportation','Walking','Cycling','Work from home','Mixed / varies')) not valid; end if;
  if not exists (select 1 from pg_constraint where conrelid='public.lifestyle_profiles'::regclass and conname='lifestyle_profiles_activity_time_check') then alter table public.lifestyle_profiles add constraint lifestyle_profiles_activity_time_check check(usual_outdoor_activity_time is null or usual_outdoor_activity_time in ('Morning','Afternoon','Evening','Varies','Rarely outdoors')) not valid; end if;

  if not exists (select 1 from pg_constraint where conrelid='public.home_profiles'::regclass and conname='home_profiles_user_id_fkey') then alter table public.home_profiles add constraint home_profiles_user_id_fkey foreign key(user_id) references auth.users(id) on delete cascade not valid; end if;
  if not exists (select 1 from pg_constraint where conrelid='public.home_profiles'::regclass and conname='home_profiles_user_id_required_check') then alter table public.home_profiles add constraint home_profiles_user_id_required_check check(user_id is not null) not valid; end if;
  if not exists (select 1 from pg_constraint where conrelid='public.home_profiles'::regclass and conname='home_profiles_budget_preference_check') then alter table public.home_profiles add constraint home_profiles_budget_preference_check check(budget_preference is null or budget_preference in ('Low cost first','No extra budget','Some flexibility','Can invest in equipment')) not valid; end if;
end
$$;

-- Unique indexes enforce one row per user and support upsert(... onConflict).
create unique index if not exists household_profiles_user_id_unique_idx on public.household_profiles(user_id);
create unique index if not exists sensitivity_profiles_user_id_unique_idx on public.sensitivity_profiles(user_id);
create unique index if not exists lifestyle_profiles_user_id_unique_idx on public.lifestyle_profiles(user_id);
create unique index if not exists home_profiles_user_id_unique_idx on public.home_profiles(user_id);

-- Shared timestamp trigger function for all onboarding section tables.
create or replace function public.airaware_set_updated_at()
returns trigger language plpgsql set search_path = pg_catalog
as $$ begin new.updated_at := pg_catalog.now(); return new; end; $$;

drop trigger if exists household_profiles_set_updated_at on public.household_profiles;
create trigger household_profiles_set_updated_at before update on public.household_profiles for each row execute function public.airaware_set_updated_at();
drop trigger if exists sensitivity_profiles_set_updated_at on public.sensitivity_profiles;
create trigger sensitivity_profiles_set_updated_at before update on public.sensitivity_profiles for each row execute function public.airaware_set_updated_at();
drop trigger if exists lifestyle_profiles_set_updated_at on public.lifestyle_profiles;
create trigger lifestyle_profiles_set_updated_at before update on public.lifestyle_profiles for each row execute function public.airaware_set_updated_at();
drop trigger if exists home_profiles_set_updated_at on public.home_profiles;
create trigger home_profiles_set_updated_at before update on public.home_profiles for each row execute function public.airaware_set_updated_at();

-- RLS is enabled on every table; users can access only their own rows.
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.household_profiles, public.sensitivity_profiles, public.lifestyle_profiles, public.home_profiles to authenticated;
revoke all on public.household_profiles, public.sensitivity_profiles, public.lifestyle_profiles, public.home_profiles from anon;

alter table public.household_profiles enable row level security;
alter table public.sensitivity_profiles enable row level security;
alter table public.lifestyle_profiles enable row level security;
alter table public.home_profiles enable row level security;

drop policy if exists "Users manage own household profile" on public.household_profiles;
drop policy if exists "Users read own household profile" on public.household_profiles;
create policy "Users read own household profile" on public.household_profiles for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users insert own household profile" on public.household_profiles;
create policy "Users insert own household profile" on public.household_profiles for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users update own household profile" on public.household_profiles;
create policy "Users update own household profile" on public.household_profiles for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users delete own household profile" on public.household_profiles;
create policy "Users delete own household profile" on public.household_profiles for delete to authenticated using (auth.uid() = user_id);
drop policy if exists "Users manage own sensitivity profile" on public.sensitivity_profiles;
drop policy if exists "Users read own sensitivity profile" on public.sensitivity_profiles;
create policy "Users read own sensitivity profile" on public.sensitivity_profiles for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users insert own sensitivity profile" on public.sensitivity_profiles;
create policy "Users insert own sensitivity profile" on public.sensitivity_profiles for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users update own sensitivity profile" on public.sensitivity_profiles;
create policy "Users update own sensitivity profile" on public.sensitivity_profiles for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users delete own sensitivity profile" on public.sensitivity_profiles;
create policy "Users delete own sensitivity profile" on public.sensitivity_profiles for delete to authenticated using (auth.uid() = user_id);
drop policy if exists "Users manage own lifestyle profile" on public.lifestyle_profiles;
drop policy if exists "Users read own lifestyle profile" on public.lifestyle_profiles;
create policy "Users read own lifestyle profile" on public.lifestyle_profiles for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users insert own lifestyle profile" on public.lifestyle_profiles;
create policy "Users insert own lifestyle profile" on public.lifestyle_profiles for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users update own lifestyle profile" on public.lifestyle_profiles;
create policy "Users update own lifestyle profile" on public.lifestyle_profiles for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users delete own lifestyle profile" on public.lifestyle_profiles;
create policy "Users delete own lifestyle profile" on public.lifestyle_profiles for delete to authenticated using (auth.uid() = user_id);
drop policy if exists "Users manage own home profile" on public.home_profiles;
drop policy if exists "Users read own home profile" on public.home_profiles;
create policy "Users read own home profile" on public.home_profiles for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users insert own home profile" on public.home_profiles;
create policy "Users insert own home profile" on public.home_profiles for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users update own home profile" on public.home_profiles;
create policy "Users update own home profile" on public.home_profiles for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users delete own home profile" on public.home_profiles;
create policy "Users delete own home profile" on public.home_profiles for delete to authenticated using (auth.uid() = user_id);

notify pgrst, 'reload schema';
