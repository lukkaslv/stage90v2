-- Existing reviews remain NULL: their technical criteria must not be reinterpreted.
alter table public.reviews
  add column if not exists scoring_model text;

comment on column public.reviews.scoring_model is
  'NULL denotes a legacy or unversioned rating; experience_v1 denotes the subjective Stage 90 criteria.';

-- Rollback: alter table public.reviews drop column if exists scoring_model;
