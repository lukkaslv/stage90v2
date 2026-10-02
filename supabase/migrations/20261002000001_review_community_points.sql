-- Keep profile points in sync when a review is added, removed, or reassigned.
-- Release scores are maintained by trg_recalculate_release_scores.
create or replace function public.on_review_submitted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles
    set community_points = coalesce(community_points, 0) + 100
    where id = new.user_id;
    return new;
  end if;

  if tg_op = 'DELETE' then
    update public.profiles
    set community_points = greatest(coalesce(community_points, 0) - 100, 0)
    where id = old.user_id;
    return old;
  end if;

  if old.user_id is distinct from new.user_id then
    update public.profiles
    set community_points = greatest(coalesce(community_points, 0) - 100, 0)
    where id = old.user_id;

    update public.profiles
    set community_points = coalesce(community_points, 0) + 100
    where id = new.user_id;
  end if;

  return new;
end;
$$;

drop trigger if exists tr_review_submitted on public.reviews;

create trigger tr_review_submitted
after insert or update of user_id or delete on public.reviews
for each row execute function public.on_review_submitted();
