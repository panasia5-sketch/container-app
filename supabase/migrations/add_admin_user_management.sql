-- Admin helpers for user_profiles management

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles
    where user_id = auth.uid()
      and role = 'admin'
  );
$$;

drop policy if exists "Admins can read all profiles" on user_profiles;
drop policy if exists "Admins can update profiles" on user_profiles;

-- Admins can list every profile (own profile policy still applies too)
create policy "Admins can read all profiles"
  on user_profiles for select
  to authenticated
  using (public.is_admin());

-- Admins can change roles and emails on profiles
create policy "Admins can update profiles"
  on user_profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create or replace function public.touch_user_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_profiles_updated_at on user_profiles;

create trigger user_profiles_updated_at
  before update on user_profiles
  for each row
  execute function public.touch_user_profiles_updated_at();
