-- A text-free Stage 90 rating is a review row for aggregation, but not a written review.
alter table public.reviews drop constraint if exists reviews_content_check;
alter table public.reviews add constraint reviews_content_check check (
  char_length(content) between 300 and 8500
  or (content = '' and scoring_model = 'experience_v1')
);
