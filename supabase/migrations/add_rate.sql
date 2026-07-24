alter table products add column if not exists rate numeric(8, 2) not null default 0;
alter table purchase_record add column if not exists rate numeric(8, 2) not null default 0;
