-- Supabase SQL schema for container order management

create table if not exists products (
  item_id text primary key,
  description text not null,
  packaging text not null,
  price numeric(12, 2) not null default 0,
  duty numeric(12, 2) not null default 0,
  tax numeric(12, 2) not null default 0,
  rate numeric(8, 2) not null default 0
);

create table if not exists purchase_master (
  po_no text primary key,
  order_date date not null,
  container_no text not null,
  invoice_no text not null,
  invoice_date date not null,
  total_amount numeric(14, 2) not null default 0
);

create table if not exists purchase_record (
  id bigint generated always as identity primary key,
  po_no text not null references purchase_master (po_no) on delete cascade,
  item_no text not null references products (item_id),
  quantity numeric(12, 2) not null default 0,
  unit_price numeric(12, 2) not null default 0,
  subtotal numeric(14, 2) generated always as (quantity * unit_price) stored,
  duty numeric(12, 2) not null default 0,
  tax numeric(12, 2) not null default 0,
  rate numeric(8, 2) not null default 0
);

create index if not exists purchase_record_po_no_idx on purchase_record (po_no);

create table if not exists user_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  role text not null default 'viewer'
    check (role in ('admin', 'manager', 'viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_profiles_role_idx on user_profiles (role);

alter table user_profiles enable row level security;

create policy "Users can read own profile"
  on user_profiles for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can create own profile"
  on user_profiles for insert
  to authenticated
  with check (auth.uid() = user_id);

alter table products enable row level security;
alter table purchase_master enable row level security;
alter table purchase_record enable row level security;

create policy "Authenticated access on products" on products for all to authenticated using (true) with check (true);
create policy "Authenticated access on purchase_master" on purchase_master for all to authenticated using (true) with check (true);
create policy "Authenticated access on purchase_record" on purchase_record for all to authenticated using (true) with check (true);
