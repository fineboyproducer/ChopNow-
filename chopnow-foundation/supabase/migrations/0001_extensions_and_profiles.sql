-- ============================================================================
-- 0001_extensions_and_profiles.sql
-- Extensions, the `profiles` table, and the trigger that provisions a
-- profile row automatically whenever a new auth.users row is created.
-- ============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists "cube";
create extension if not exists "earthdistance";

-- ----------------------------------------------------------------------------
-- ROLES
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type user_role as enum ('customer', 'admin', 'dispatcher', 'restaurant', 'rider');
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- PROFILES
-- One row per authenticated user, regardless of role. Mirrors
-- packages/types/src/auth.ts `Profile`.
-- ----------------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'customer',
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles_select_own" on profiles
  for select using (auth.uid() = id);

create policy "profiles_update_own" on profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

-- Admins can read every profile (needed for the Ops & Dispatch Center's
-- customer/rider/dispatcher management screens).
create policy "profiles_select_admin" on profiles
  for select using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ----------------------------------------------------------------------------
-- AUTO-PROVISION A PROFILE ROW ON SIGN-UP
-- Reads full_name/phone out of the auth.users raw_user_meta_data that
-- apps/web's signUpAction (packages: see auth.ts) sets at signUp() time.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'phone'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
