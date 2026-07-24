-- Add duty and tax columns to existing purchase_record table
alter table purchase_record add column if not exists duty numeric(12, 2) not null default 0;
alter table purchase_record add column if not exists tax numeric(12, 2) not null default 0;
