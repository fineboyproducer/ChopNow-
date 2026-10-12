-- ============================================================================
-- seed.sql — development seed data
-- Run via `supabase db reset` or `npm run supabase:seed`. Safe to re-run:
-- every insert is guarded with ON CONFLICT DO NOTHING keyed on slug/id.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- RESTAURANTS (same four used throughout the customer app prototypes, now
-- as real rows so Sprint 3's checkout has something genuine to order from)
-- ----------------------------------------------------------------------------
insert into restaurants (id, name, slug, description, category, cover_url, logo_url, phone, address, lat, lng, opening_hours, status, is_featured, base_delivery_fee, rating, review_count)
values
  (
    '11111111-1111-1111-1111-111111111111', 'Mama Ekpoma Kitchen', 'mama-ekpoma-kitchen',
    'Home-style jollof, native soups and swallow made fresh every morning.', 'Nigerian Food',
    'https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?w=1200&q=80',
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=200&q=80',
    '+2348030001111', 'Along EUC Road, Ekpoma', 6.7433, 6.1370,
    '{"mon": {"open": "08:00", "close": "22:00"}}', 'open', true, 400, 4.8, 412
  ),
  (
    '22222222-2222-2222-2222-222222222222', 'Slice House Pizza', 'slice-house-pizza',
    'Stone-baked pizza, loaded fries and cold drinks.', 'Fast Food',
    'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=1200&q=80',
    'https://images.unsplash.com/photo-1571066811602-716837d681de?w=200&q=80',
    '+2348030002222', 'Opposite EDSU Main Gate, Ekpoma', 6.7441, 6.1355,
    '{"mon": {"open": "10:00", "close": "23:00"}}', 'open', true, 500, 4.6, 268
  ),
  (
    '33333333-3333-3333-3333-333333333333', 'Grill & Wrap Shawarma', 'grill-and-wrap-shawarma',
    'Late-night shawarma spot loved for generous fillings.', 'Shawarma',
    'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=1200&q=80',
    'https://images.unsplash.com/photo-1544025162-d76694265947?w=200&q=80',
    '+2348030003333', 'Ekpoma Central Market Road', 6.7419, 6.1382,
    '{"mon": {"open": "12:00", "close": "23:59"}}', 'open', false, 300, 4.9, 530
  ),
  (
    '44444444-4444-4444-4444-444444444444', 'Sunrise Breakfast Spot', 'sunrise-breakfast-spot',
    'Early morning pap, akara, bread and bites.', 'Breakfast',
    'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=1200&q=80',
    'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=200&q=80',
    '+2348030004444', 'Uwessan Road, Ekpoma', 6.7461, 6.1341,
    '{"mon": {"open": "06:00", "close": "12:00"}}', 'offline', false, 600, 4.5, 156
  )
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- MENU CATEGORIES
-- ----------------------------------------------------------------------------
insert into menu_categories (id, restaurant_id, name, sort_order) values
  ('a1111111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Rice', 0),
  ('a1111111-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Swallow', 1),
  ('a1111111-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Soups', 2),
  ('a1111111-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'Drinks', 3),
  ('a2222222-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Pizza', 0),
  ('a2222222-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Burgers', 1),
  ('a3333333-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'Shawarma', 0),
  ('a3333333-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 'Chicken', 1),
  ('a4444444-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', 'Breakfast', 0),
  ('a4444444-0000-0000-0000-000000000002', '44444444-4444-4444-4444-444444444444', 'Snacks', 1)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- MENU ITEMS
-- ----------------------------------------------------------------------------
insert into menu_items (id, restaurant_id, category_id, name, description, image_url, base_price, is_available, sort_order) values
  ('b1111111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'a1111111-0000-0000-0000-000000000001', 'Jollof Rice + Chicken', 'Smoky party jollof with a grilled chicken thigh and fried plantain.', 'https://images.unsplash.com/photo-1604908176997-4316014925d1?w=600&q=80', 2500, true, 0),
  ('b1111111-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'a1111111-0000-0000-0000-000000000001', 'Ofada Rice + Ayamase', 'Local ofada rice with rich pepper sauce and assorted meat.', 'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=600&q=80', 3200, true, 1),
  ('b1111111-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'a1111111-0000-0000-0000-000000000002', 'Pounded Yam + Egusi', 'Smooth pounded yam served with melon seed soup and stockfish.', 'https://images.unsplash.com/photo-1626200926749-014a5d548e5f?w=600&q=80', 2800, true, 0),
  ('b1111111-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'a1111111-0000-0000-0000-000000000004', 'Chilled Chapman', 'House-mixed Chapman, extra fruity, extra cold.', 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=600&q=80', 900, true, 0),
  ('b1111111-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'a1111111-0000-0000-0000-000000000003', 'Efo Riro + Semo', 'Rich vegetable soup with smoked fish and assorted meat.', 'https://images.unsplash.com/photo-1567337710282-00832b415979?w=600&q=80', 2600, false, 1),

  ('b2222222-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'a2222222-0000-0000-0000-000000000001', 'Pepperoni Supreme (Medium)', 'Double pepperoni, mozzarella, house tomato base.', 'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=600&q=80', 6500, true, 0),
  ('b2222222-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'a2222222-0000-0000-0000-000000000001', 'Chicken Suya Pizza', 'Suya-spiced chicken, onions, bell peppers, smoked cheese.', 'https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?w=600&q=80', 7200, true, 1),
  ('b2222222-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'a2222222-0000-0000-0000-000000000002', 'Loaded Beef Burger', 'Double beef patty, cheddar, caramelised onions, special sauce.', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=80', 3800, true, 0),

  ('b3333333-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'a3333333-0000-0000-0000-000000000001', 'Chicken Shawarma Special', 'Grilled chicken, coleslaw, cheese, our signature sauce.', 'https://images.unsplash.com/photo-1615361200141-f45040f367be?w=600&q=80', 2200, true, 0),
  ('b3333333-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 'a3333333-0000-0000-0000-000000000001', 'Beef Suya Wrap', 'Spiced beef suya wrapped with fresh onions and cabbage.', 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=600&q=80', 2000, true, 1),
  ('b3333333-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', 'a3333333-0000-0000-0000-000000000002', 'Grilled Chicken Full', 'Whole grilled chicken with pepper sauce and coleslaw.', 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=600&q=80', 4500, true, 0),

  ('b4444444-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', 'a4444444-0000-0000-0000-000000000001', 'Akara + Pap', 'Freshly fried bean cakes with warm smooth pap.', 'https://images.unsplash.com/photo-1626074353765-517a681e40be?w=600&q=80', 1200, true, 0),
  ('b4444444-0000-0000-0000-000000000002', '44444444-4444-4444-4444-444444444444', 'a4444444-0000-0000-0000-000000000002', 'Meat Pie (3 pcs)', 'Flaky pastry, seasoned minced meat filling.', 'https://images.unsplash.com/photo-1619894991209-9f9694be045f?w=600&q=80', 1500, true, 1)
on conflict (id) do nothing;
