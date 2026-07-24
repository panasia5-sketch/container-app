alter table products add column if not exists duty numeric(12, 2) not null default 0;
alter table products add column if not exists tax numeric(12, 2) not null default 0;
