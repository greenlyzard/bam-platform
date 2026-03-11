-- ============================================================
-- BAM Platform — Studio Shop Tables
-- Creates: shop_configs, products, shop_orders
-- ============================================================

-- ============================================================
-- shop_configs — white-label shop instances
-- ============================================================
create table shop_configs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  logo_url text,
  banner_url text,
  primary_color text default '#9C8BBF',
  secondary_color text default '#C9A84C',
  is_active boolean default false,
  event_name text,
  opens_at timestamptz,
  closes_at timestamptz,
  activated_at timestamptz,
  deactivated_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_shop_configs_active on shop_configs(is_active);
create index idx_shop_configs_slug on shop_configs(slug);

-- ============================================================
-- products
-- ============================================================
create table products (
  id uuid primary key default gen_random_uuid(),
  shop_config_id uuid not null references shop_configs(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  price_cents int not null check (price_cents >= 0),
  compare_at_price_cents int,
  image_url text,
  images text[] default '{}',
  category text not null
    check (category in ('merchandise', 'concession', 'flower', 'apparel', 'costume', 'ticket', 'patch', 'other')),
  sizes text[] default '{}',
  colors text[] default '{}',
  inventory int default 0,
  track_inventory boolean default true,
  is_active boolean default true,
  sort_order int default 0,
  stripe_price_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(shop_config_id, slug)
);

create index idx_products_shop on products(shop_config_id);
create index idx_products_category on products(category);
create index idx_products_active on products(is_active);

-- ============================================================
-- shop_orders
-- ============================================================
create table shop_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null,
  shop_config_id uuid not null references shop_configs(id) on delete cascade,
  customer_id uuid references profiles(id) on delete set null,
  customer_name text not null,
  customer_email text not null,
  items jsonb not null default '[]',
  subtotal_cents int not null check (subtotal_cents >= 0),
  tax_cents int not null default 0,
  discount_cents int not null default 0,
  total_cents int not null check (total_cents >= 0),
  discount_code text,
  payment_method text
    check (payment_method in ('card', 'cash', 'zelle', 'venmo')),
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'refunded', 'failed')),
  fulfillment_status text default 'pending'
    check (fulfillment_status in ('pending', 'processing', 'ready_for_pickup', 'shipped', 'delivered', 'cancelled')),
  stripe_payment_intent_id text,
  notes text,
  paid_at timestamptz,
  fulfilled_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_orders_shop on shop_orders(shop_config_id);
create index idx_orders_customer on shop_orders(customer_id);
create index idx_orders_status on shop_orders(payment_status);
create index idx_orders_number on shop_orders(order_number);
