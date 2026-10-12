-- ============================================================================
-- 0002_addresses.sql
-- Customer saved addresses. Mirrors packages/types/src/rider.ts `Address`.
-- ============================================================================

create table if not exists addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  label text,
  full_address text not null,
  lat numeric(9, 6) not null,
  lng numeric(9, 6) not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_addresses_user on addresses(user_id, created_at desc);

alter table addresses enable row level security;

create policy "addresses_all_own" on addresses
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Enforce "at most one default address per user" without a race condition:
-- setting a new address as default automatically un-defaults the rest.
-- ----------------------------------------------------------------------------
create or replace function public.enforce_single_default_address()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.is_default then
    update addresses
    set is_default = false
    where user_id = new.user_id
      and id <> new.id
      and is_default = true;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_single_default_address on addresses;
create trigger trg_single_default_address
  before insert or update of is_default on addresses
  for each row
  when (new.is_default = true)
  execute procedure public.enforce_single_default_address();
