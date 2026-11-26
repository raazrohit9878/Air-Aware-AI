-- Household onboarding table. This migration is safe to rerun and does not
-- alter or remove public.user_profiles or any existing user data.
create table if not exists public.household_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  household_type text not null,
  household_size integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint household_profiles_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade,
  constraint household_profiles_household_type_check check (
    household_type in (
      'Individual',
      'Family with children',
      'Family with senior citizens',
      'Working professional',
      'Student',
      'Other'
    )
  ),
  constraint household_profiles_household_size_check
    check (household_size is null or household_size > 0)
);

-- If this table already existed in a partial form, add missing columns without
-- deleting or rewriting existing values.
alter table public.household_profiles
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists user_id uuid,
  add column if not exists household_type text,
  add column if not exists household_size integer,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.household_profiles alter column id set default gen_random_uuid();
update public.household_profiles set id = gen_random_uuid() where id is null;
alter table public.household_profiles alter column id set not null;

-- Add the primary key only if the pre-existing table does not have one.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.household_profiles'::regclass
      and contype = 'p'
  ) then
    alter table public.household_profiles
      add constraint household_profiles_pkey primary key (id);
  end if;
end
$$;

-- NOT VALID preserves any legacy rows while enforcing the rules on new writes.
-- The fresh-table constraints above are already validated.
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.household_profiles'::regclass and conname = 'household_profiles_user_id_fkey') then
    alter table public.household_profiles add constraint household_profiles_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.household_profiles'::regclass and conname = 'household_profiles_user_id_required_check') then
    alter table public.household_profiles add constraint household_profiles_user_id_required_check
      check (user_id is not null) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.household_profiles'::regclass and conname = 'household_profiles_household_type_check') then
    alter table public.household_profiles add constraint household_profiles_household_type_check
      check (household_type is not null and household_type in ('Individual','Family with children','Family with senior citizens','Working professional','Student','Other')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.household_profiles'::regclass and conname = 'household_profiles_household_size_check') then
    alter table public.household_profiles add constraint household_profiles_household_size_check
      check (household_size is null or household_size > 0) not valid;
  end if;
end
$$;

-- Enforces one household row per user and supports the upsert conflict target.
-- Existing duplicate user_ids cause this statement to fail without deleting data.
create unique index if not exists household_profiles_user_id_unique_idx
  on public.household_profiles(user_id);

create or replace function public.set_household_profiles_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.household_profiles'::regclass
      and tgname = 'household_profiles_set_updated_at'
      and not tgisinternal
  ) then
    create trigger household_profiles_set_updated_at
      before update on public.household_profiles
      for each row execute function public.set_household_profiles_updated_at();
  end if;
end
$$;

alter table public.household_profiles enable row level security;
grant usage on schema public to authenticated;
revoke all on public.household_profiles from anon;
grant select, insert, update, delete on public.household_profiles to authenticated;

drop policy if exists "Users read own household profile" on public.household_profiles;
create policy "Users read own household profile" on public.household_profiles
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users insert own household profile" on public.household_profiles;
create policy "Users insert own household profile" on public.household_profiles
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users update own household profile" on public.household_profiles;
create policy "Users update own household profile" on public.household_profiles
  for update to authenticated using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
drop policy if exists "Users delete own household profile" on public.household_profiles;
create policy "Users delete own household profile" on public.household_profiles
  for delete to authenticated using (auth.uid() = user_id);

notify pgrst, 'reload schema';
