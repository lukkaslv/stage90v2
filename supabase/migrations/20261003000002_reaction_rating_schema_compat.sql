-- The OBS submission writes the same scoring model marker as ReleaseDetail.
-- Some linked databases have the Studio migration but not the earlier marker migration.
alter table public.reviews add column if not exists scoring_model text;

comment on column public.reviews.scoring_model is
  'NULL denotes a legacy or unversioned rating; experience_v1 denotes the subjective Stage 90 criteria.';

notify pgrst, 'reload schema';
