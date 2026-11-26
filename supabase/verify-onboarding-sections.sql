-- 1) Confirm required columns are present.
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('user_profiles','household_profiles','sensitivity_profiles','lifestyle_profiles','home_profiles')
order by table_name, ordinal_position;

-- 2) Confirm RLS is enabled for the four onboarding section tables.
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('household_profiles','sensitivity_profiles','lifestyle_profiles','home_profiles')
order by c.relname;

-- 3) Review ownership policies.
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('household_profiles','sensitivity_profiles','lifestyle_profiles','home_profiles')
order by tablename, policyname;

-- 4) Confirm unique user indexes, FKs, checks, and update triggers.
select t.relname as table_name, i.relname as index_name, ix.indisunique as is_unique
from pg_class t
join pg_namespace n on n.oid=t.relnamespace
join pg_index ix on ix.indrelid=t.oid
join pg_class i on i.oid=ix.indexrelid
where n.nspname='public'
  and t.relname in ('household_profiles','sensitivity_profiles','lifestyle_profiles','home_profiles')
order by t.relname, i.relname;

select c.conrelid::regclass as table_name, c.conname, c.contype, c.convalidated
from pg_constraint c
where c.conrelid in ('public.household_profiles'::regclass,'public.sensitivity_profiles'::regclass,'public.lifestyle_profiles'::regclass,'public.home_profiles'::regclass)
order by c.conrelid::regclass::text, c.conname;

select event_object_table as table_name, trigger_name, action_timing, event_manipulation
from information_schema.triggers
where trigger_schema='public'
  and event_object_table in ('household_profiles','sensitivity_profiles','lifestyle_profiles','home_profiles')
order by event_object_table, trigger_name;

-- 5) Sample saved rows for a specific authenticated user. Replace the UUID.
-- Do not run this query without replacing the placeholder.
-- select * from public.household_profiles where user_id = 'YOUR_AUTH_USER_UUID'::uuid;
-- select * from public.sensitivity_profiles where user_id = 'YOUR_AUTH_USER_UUID'::uuid;
-- select * from public.lifestyle_profiles where user_id = 'YOUR_AUTH_USER_UUID'::uuid;
-- select * from public.home_profiles where user_id = 'YOUR_AUTH_USER_UUID'::uuid;
