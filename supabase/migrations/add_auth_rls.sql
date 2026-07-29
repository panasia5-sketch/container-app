-- Require authenticated users for all tables (run after enabling Supabase Auth)

drop policy if exists "Allow all on products" on products;
drop policy if exists "Allow all on purchase_master" on purchase_master;
drop policy if exists "Allow all on purchase_record" on purchase_record;

create policy "Authenticated access on products"
  on products for all
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated access on purchase_master"
  on purchase_master for all
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated access on purchase_record"
  on purchase_record for all
  to authenticated
  using (true)
  with check (true);
