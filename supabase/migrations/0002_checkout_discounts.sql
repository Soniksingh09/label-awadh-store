-- Safe additive migration for checkout totals. Existing tables/data are preserved.
alter table public.orders add column if not exists coupon_code text;
alter table public.orders add column if not exists discount_paise integer not null default 0 check (discount_paise >= 0);
