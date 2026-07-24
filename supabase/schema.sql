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

alter table products enable row level security;
alter table purchase_master enable row level security;
alter table purchase_record enable row level security;

create policy "Allow all on products" on products for all using (true) with check (true);
create policy "Allow all on purchase_master" on purchase_master for all using (true) with check (true);
create policy "Allow all on purchase_record" on purchase_record for all using (true) with check (true);
