-- User profiles with role-based access (admin | manager | viewer)

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

-- Users can read their own profile (role used for menu permissions)
create policy "Users can read own profile"
  on user_profiles for select
  to authenticated
  using (auth.uid() = user_id);

-- Users can insert their own profile once (first login bootstrap)
create policy "Users can create own profile"
  on user_profiles for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Role changes are done by admins via Supabase dashboard/SQL for now.
-- Example: update user_profiles set role = 'admin' where email = 'you@example.com';
