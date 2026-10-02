-- The first achievements migration starts event-driven processing, but reviews
-- that predate its triggers already satisfy some rules. Reconcile them once as
-- part of deployment so progress and awarded grants agree on first page load.
-- refresh_achievements is idempotent: its unique grant key and audit logic
-- prevent duplicate grants or duplicate award entries on a retry.
do $$
declare item record;
begin
  for item in
    select distinct r.user_id,
      greatest(2020, extract(year from r.created_at at time zone 'Asia/Tbilisi')::integer) as season_year
    from public.reviews r
    join public.profiles p on p.id = r.user_id
    where r.created_at is not null
    order by r.user_id, season_year
  loop
    perform public.refresh_achievements(item.user_id, item.season_year);
  end loop;
end $$;
