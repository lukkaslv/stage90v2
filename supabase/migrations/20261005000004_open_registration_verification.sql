-- Accounts are created immediately. Publishing scores and reviews requires verification.
drop trigger if exists require_approved_registration on auth.users;
alter table public.profiles add column if not exists registration_reason text;

create or replace function public.create_registration_profile()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  requested_role text := case when new.raw_user_meta_data->>'role' = 'author' then 'author' else 'user' end;
  requested_name text := nullif(btrim(new.raw_user_meta_data->>'display_name'), '');
  requested_link text := nullif(btrim(new.raw_user_meta_data->>'verification_link'), '');
begin
  perform set_config('stage90.creating_registration_profile', 'on', true);
  insert into public.profiles (id, email, display_name, artist_name, verification_link, registration_reason, role, is_verified)
  values (
    new.id,
    new.email,
    coalesce(requested_name, split_part(new.email, '@', 1)),
    case when requested_role = 'author' then requested_name else null end,
    requested_link,
    nullif(btrim(new.raw_user_meta_data->>'registration_reason'), ''),
    requested_role,
    false
  )
  on conflict (id) do update set
    email = excluded.email,
    display_name = excluded.display_name,
    artist_name = excluded.artist_name,
    verification_link = excluded.verification_link,
    registration_reason = excluded.registration_reason,
    role = excluded.role,
    is_verified = false;
  perform set_config('stage90.creating_registration_profile', 'off', true);
  return new;
end;
$$;

create or replace function public.protect_profile_privileges()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.role() in ('anon', 'authenticated')
    and not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    and current_setting('stage90.creating_registration_profile', true) is distinct from 'on' then
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

drop trigger if exists create_registration_profile on auth.users;
create trigger create_registration_profile
  after insert on auth.users for each row execute function public.create_registration_profile();

create or replace function public.require_verified_reviewer()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = new.user_id and (is_verified = true or role = 'admin')
  ) then
    raise exception 'Review and rating require verified account';
  end if;
  return new;
end;
$$;

drop trigger if exists require_verified_reviewer on public.reviews;
create trigger require_verified_reviewer
  before insert or update on public.reviews
  for each row execute function public.require_verified_reviewer();
