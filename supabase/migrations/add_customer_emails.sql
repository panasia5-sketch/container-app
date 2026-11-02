-- Customer code → email mapping for PDF classify bulk send

create table if not exists customer_emails (
  customer_code text primary key,
  email text not null,
  updated_at timestamptz not null default now(),
  constraint customer_emails_email_check
    check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

create index if not exists customer_emails_email_idx on customer_emails (email);

alter table customer_emails enable row level security;

drop policy if exists "Authenticated access on customer_emails" on customer_emails;

create policy "Authenticated access on customer_emails"
  on customer_emails for all
  to authenticated
  using (true)
  with check (true);

comment on table customer_emails is
  'Email addresses keyed by customer code for /pdf classify bulk send.';
