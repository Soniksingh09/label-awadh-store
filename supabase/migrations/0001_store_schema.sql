-- Label Awadh e-commerce schema (Supabase/PostgreSQL)
create extension if not exists pgcrypto;

create type public.order_status as enum ('pending','confirmed','processing','shipped','delivered','cancelled');
create type public.payment_method as enum ('cod','online');
create type public.payment_status as enum ('pending','paid','failed','refunded');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text not null default '',
  category text not null default 'Chikankari Suits',
  price_paise integer not null check (price_paise >= 0),
  compare_at_price_paise integer check (compare_at_price_paise is null or compare_at_price_paise >= price_paise),
  image_urls text[] not null default '{}',
  sizes text[] not null default array['S','M','L','XL'],
  stock_by_size jsonb not null default '{"S":0,"M":0,"L":0,"XL":0}'::jsonb,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity unique,
  customer_name text not null,
  email text not null,
  phone text not null,
  address_line1 text not null,
  address_line2 text not null default '',
  city text not null,
  state text not null,
  postal_code text not null,
  country text not null default 'India',
  notes text not null default '',
  payment_method public.payment_method not null,
  payment_status public.payment_status not null default 'pending',
  status public.order_status not null default 'pending',
  subtotal_paise integer not null check (subtotal_paise >= 0),
  shipping_paise integer not null default 0 check (shipping_paise >= 0),
  total_paise integer not null check (total_paise >= 0),
  razorpay_order_id text unique,
  razorpay_payment_id text unique,
  notification_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  product_slug text not null,
  size text not null,
  quantity integer not null check (quantity between 1 and 10),
  unit_price_paise integer not null check (unit_price_paise >= 0),
  line_total_paise integer not null check (line_total_paise >= 0)
);

create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'razorpay',
  provider_event_id text unique,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create index products_active_category_idx on public.products(active, category);
create index orders_created_at_idx on public.orders(created_at desc);
create index orders_status_idx on public.orders(status);
create index order_items_order_id_idx on public.order_items(order_id);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.admin_users where user_id = auth.uid()); $$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

alter table public.profiles enable row level security;
alter table public.admin_users enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payment_events enable row level security;

create policy "users read own profile" on public.profiles for select to authenticated using (id = auth.uid());
create policy "admins manage products" on public.products for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "public read active products" on public.products for select to anon, authenticated using (active = true);
create policy "admins read orders" on public.orders for select to authenticated using (public.is_admin());
create policy "admins update orders" on public.orders for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins read order items" on public.order_items for select to authenticated using (public.is_admin());
create policy "admins read payment events" on public.payment_events for select to authenticated using (public.is_admin());
-- Deliberately no public insert/select policy on orders/order_items/payment_events.
-- Edge Functions using SUPABASE_SERVICE_ROLE_KEY perform validated writes.

grant select on public.products to anon, authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select on public.orders, public.order_items, public.payment_events to authenticated;
grant update on public.orders to authenticated;
