drop policy if exists "Admins can manage concerts" on public.concerts;

create policy "Admins can manage concerts"
  on public.concerts for all to authenticated
  using (exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  ))
  with check (exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  ));
