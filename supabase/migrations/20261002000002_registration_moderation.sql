create table if not exists public.registration_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(btrim(email)) and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  display_name text not null check (length(btrim(display_name)) between 2 and 100),
  requested_role text not null check (requested_role in ('user', 'author')),
  social_url text not null check (
    social_url ~* '^https://(www\.)?(instagram\.com/[^/?#]+|youtube\.com/(@[^/?#]+|channel/[^/?#]+|c/[^/?#]+|user/[^/?#]+))/?([?#].*)?$'
  ),
  registration_reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  approval_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  invited_user_id uuid references auth.users(id) on delete set null
);

create unique index if not exists registration_requests_active_email
  on public.registration_requests (lower(email)) where status in ('pending', 'approved');

alter table public.registration_requests enable row level security;
revoke all on public.registration_requests from anon, authenticated;
grant insert (email, display_name, requested_role, social_url, registration_reason)
  on public.registration_requests to anon, authenticated;
grant select on public.registration_requests to authenticated;

create policy "submit registration request"
  on public.registration_requests for insert to anon, authenticated
  with check (status = 'pending' and reviewed_at is null and reviewed_by is null and invited_user_id is null);

create policy "admins read registration requests"
  on public.registration_requests for select to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create or replace function public.require_approved_registration()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not exists (
    select 1 from public.registration_requests request
    where request.id::text = new.raw_user_meta_data->>'registration_request_id'
      and request.approval_token::text = new.raw_user_meta_data->>'approval_token'
      and request.status = 'approved'
      and request.invited_user_id is null
      and request.email = lower(new.email)
      and request.requested_role = new.raw_user_meta_data->>'role'
      and request.display_name = new.raw_user_meta_data->>'display_name'
  ) then
    raise exception 'Registration requires administrator approval';
  end if;
  return new;
end;
$$;

drop trigger if exists require_approved_registration on auth.users;
create trigger require_approved_registration
  before insert on auth.users for each row execute function public.require_approved_registration();

create or replace function public.protect_profile_privileges()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.role() in ('anon', 'authenticated')
    and not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    if tg_op = 'INSERT' and (new.role <> 'user' or coalesce(new.is_verified, false)) then
      raise exception 'Profile privileges require administrator approval';
    end if;
    if tg_op = 'UPDATE' and (
      new.role is distinct from old.role
      or new.is_verified is distinct from old.is_verified
      or new.author_category is distinct from old.author_category
    ) then
      raise exception 'Profile privileges require administrator approval';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_privileges on public.profiles;
create trigger protect_profile_privileges
  before insert or update on public.profiles for each row execute function public.protect_profile_privileges();

update public.profiles
set role = 'user', author_category = null
where role = 'author' and coalesce(is_verified, false) = false;
