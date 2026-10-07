create table if not exists public.ai_video_workflows (
  id uuid primary key default gen_random_uuid(),
  transcript_id uuid not null unique references public.ai_video_transcripts(id) on delete cascade,
  step text not null default 'fetch_transcript'
    check (step in ('fetch_transcript', 'enrich', 'review', 'complete')),
  status text not null default 'pending'
    check (status in ('pending', 'running', 'waiting_review', 'completed', 'failed', 'dead_letter')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 4 check (max_attempts between 1 and 10),
  next_attempt_at timestamptz,
  lease_token uuid,
  lease_expires_at timestamptz,
  last_error_code text,
  last_error_retryable boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ai_video_workflows_runnable
  on public.ai_video_workflows (status, next_attempt_at, lease_expires_at);

drop trigger if exists set_ai_video_workflows_updated_at on public.ai_video_workflows;
create trigger set_ai_video_workflows_updated_at before update on public.ai_video_workflows
for each row execute function public.set_updated_at();

alter table public.ai_video_workflows enable row level security;
drop policy if exists "ai_video_workflows_admin_all" on public.ai_video_workflows;
create policy "ai_video_workflows_admin_all" on public.ai_video_workflows
for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

create or replace function public.claim_ai_video_workflow(
  p_transcript_id uuid,
  p_lease_seconds integer default 120
)
returns table(
  workflow_id uuid,
  claimed boolean,
  lease_token uuid,
  attempt_count integer,
  max_attempts integer,
  workflow_status text,
  workflow_step text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_id uuid;
  claimed_token uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'admin required';
  end if;
  if p_lease_seconds < 30 or p_lease_seconds > 600 then
    raise exception 'invalid lease duration';
  end if;

  insert into public.ai_video_workflows (transcript_id)
  values (p_transcript_id)
  on conflict (transcript_id) do nothing;

  claimed_token := gen_random_uuid();
  update public.ai_video_workflows workflow
  set status = 'running',
      lease_token = claimed_token,
      lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      attempt_count = workflow.attempt_count + 1
  where workflow.transcript_id = p_transcript_id
    and (
      workflow.status in ('pending', 'failed')
      or (workflow.status = 'running' and workflow.lease_expires_at <= now())
    )
    and workflow.attempt_count < workflow.max_attempts
    and (workflow.next_attempt_at is null or workflow.next_attempt_at <= now())
    and (workflow.lease_expires_at is null or workflow.lease_expires_at <= now())
  returning workflow.id into claimed_id;

  if claimed_id is not null then
    return query
      select workflow.id, true, workflow.lease_token, workflow.attempt_count,
             workflow.max_attempts, workflow.status, workflow.step
      from public.ai_video_workflows workflow where workflow.id = claimed_id;
  else
    return query
      select workflow.id, false, workflow.lease_token, workflow.attempt_count,
             workflow.max_attempts, workflow.status, workflow.step
      from public.ai_video_workflows workflow
      where workflow.transcript_id = p_transcript_id;
  end if;
end;
$$;

revoke all on function public.claim_ai_video_workflow(uuid, integer) from public, anon;
grant execute on function public.claim_ai_video_workflow(uuid, integer) to authenticated;
