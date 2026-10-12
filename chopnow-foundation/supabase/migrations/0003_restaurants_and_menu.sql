-- ============================================================================
-- 0003_restaurants_and_menu.sql
-- Restaurants and menu items. Mirrors packages/types/src/restaurant.ts.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'restaurant_status') then
    create type restaurant_status as enum ('open', 'busy', 'offline');
  end if;
end $$;

create extension if not exists moddatetime schema extensions;

create table if not exists restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  category text,
  cover_url text,
  logo_url text,
  phone text,
  address text,
  lat numeric(9, 6) not null,
  lng numeric(9, 6) not null,
  opening_hours jsonb,
  status restaurant_status not null default 'offline',
  is_featured boolean not null default false,
  base_delivery_fee integer not null default 0,
  markup_percent_override numeric(5, 2),
  rating numeric(2, 1) not null default 0,
  review_count integer not null default 0,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_restaurants_status on restaurants(status);
-- Proximity queries (nearest-restaurant sort) use earthdistance, enabled in 0001.
create index if not exists idx_restaurants_geo on restaurants using gist (ll_to_earth(lat, lng));

alter table restaurants enable row level security;

-- Public can read restaurants (browsing requires no auth per the PRD's
-- public-browsing decision in Sprint 2's middleware).
create policy "restaurants_select_public" on restaurants
  for select using (true);

create policy "restaurants_write_admin" on restaurants
  for insert with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'dispatcher'))
  );

create policy "restaurants_update_admin" on restaurants
  for update using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'dispatcher'))
  );

create policy "restaurants_delete_admin" on restaurants
  for delete using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create trigger set_restaurants_updated_at
  before update on restaurants
  for each row execute procedure moddatetime(updated_at);

-- ----------------------------------------------------------------------------
-- MENU CATEGORIES & ITEMS
-- ----------------------------------------------------------------------------
create table if not exists menu_categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0
);

create index if not exists idx_menu_categories_restaurant on menu_categories(restaurant_id, sort_order);

alter table menu_categories enable row level security;

create policy "menu_categories_select_public" on menu_categories
  for select using (true);

create policy "menu_categories_write_admin" on menu_categories
  for all using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'dispatcher'))
  );

create table if not exists menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  category_id uuid references menu_categories(id) on delete set null,
  name text not null,
  description text,
  image_url text,
  base_price integer not null check (base_price > 0),
  is_available boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_menu_items_restaurant on menu_items(restaurant_id, category_id);

alter table menu_items enable row level security;

create policy "menu_items_select_public" on menu_items
  for select using (true);

create policy "menu_items_write_admin" on menu_items
  for all using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'dispatcher'))
  );

create trigger set_menu_items_updated_at
  before update on menu_items
  for each row execute procedure moddatetime(updated_at);
