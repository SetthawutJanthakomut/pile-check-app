-- Fix "infinite recursion detected in policy for relation profiles":
-- the previous admin-write policy queried profiles from within its own
-- policy on profiles. A SECURITY DEFINER helper bypasses RLS internally,
-- breaking the recursive cycle.
create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

drop policy if exists "profiles admin write" on profiles;
create policy "profiles admin write" on profiles for all to authenticated
  using (is_admin())
  with check (is_admin());
