-- Track whether a student actually completed the mentor intake.
-- Existing rows remain editable; completion is explicit instead of inferred.
alter table public.student_onboarding_responses
  add column if not exists confidence_score integer,
  add column if not exists completed_at timestamptz,
  add column if not exists intake_version text not null default 'v1';

alter table public.student_onboarding_responses
  drop constraint if exists student_onboarding_confidence_score_check;

alter table public.student_onboarding_responses
  add constraint student_onboarding_confidence_score_check
  check (confidence_score is null or confidence_score between 1 and 5);

update public.student_onboarding_responses
set completed_at = coalesce(completed_at, updated_at, now())
where completed_at is null
  and nullif(trim(coalesce(experience_level, '')), '') is not null
  and nullif(trim(coalesce(primary_market, '')), '') is not null
  and nullif(trim(coalesce(main_challenge, '')), '') is not null
  and nullif(trim(coalesce(goal_90_days, '')), '') is not null
  and nullif(trim(coalesce(weekly_time_commitment, '')), '') is not null
  and nullif(trim(coalesce(mentorship_interest, '')), '') is not null;
