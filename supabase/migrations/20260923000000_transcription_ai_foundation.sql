-- S1.1: additive transcript and enrichment lifecycle for market videos.
-- No existing content columns or policies are removed or relaxed.

create table if not exists public.ai_video_transcripts (
  id uuid primary key default gen_random_uuid(),
  weekly_update_id bigint not null references public.weekly_updates(id) on delete cascade,
  source_version text not null,
  source_language text not null default 'nl',
  provider text not null check (provider in ('mux')),
  provider_track_id text,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'ready', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  failure_code text,
  failure_retryable boolean not null default false,
  transcript jsonb,
  started_at timestamptz,
  ready_at timestamptz,
  failed_at timestamptz,
  created_by uuid references public.students(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (weekly_update_id, source_version),
  check (transcript is null or jsonb_typeof(transcript) = 'array'),
  check (status <> 'ready' or (provider_track_id is not null and transcript is not null))
);

create table if not exists public.ai_video_enrichments (
  id uuid primary key default gen_random_uuid(),
  transcript_id uuid not null references public.ai_video_transcripts(id) on delete cascade,
  prompt_version text not null,
  model text not null,
  status text not null default 'draft'
    check (status in ('draft', 'review', 'published', 'rejected', 'failed')),
  summary text,
  key_takeaways jsonb not null default '[]'::jsonb,
  chapters jsonb not null default '[]'::jsonb,
  generated_content jsonb,
  reviewed_content jsonb,
  reviewed_by uuid references public.students(id) on delete set null,
  reviewed_at timestamptz,
  published_at timestamptz,
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (transcript_id, prompt_version, model),
  check (jsonb_typeof(key_takeaways) = 'array'),
  check (jsonb_typeof(chapters) = 'array'),
  check (status <> 'published' or (reviewed_by is not null and reviewed_at is not null))
);

create table if not exists public.mux_webhook_events (
  event_id text primary key,
  event_type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error_code text
);

create index if not exists idx_ai_video_transcripts_update_status
  on public.ai_video_transcripts (weekly_update_id, status, updated_at desc);
create index if not exists idx_ai_video_enrichments_transcript_status
  on public.ai_video_enrichments (transcript_id, status, updated_at desc);

drop trigger if exists set_ai_video_transcripts_updated_at on public.ai_video_transcripts;
create trigger set_ai_video_transcripts_updated_at before update on public.ai_video_transcripts
for each row execute function public.set_updated_at();
drop trigger if exists set_ai_video_enrichments_updated_at on public.ai_video_enrichments;
create trigger set_ai_video_enrichments_updated_at before update on public.ai_video_enrichments
for each row execute function public.set_updated_at();

alter table public.ai_video_transcripts enable row level security;
alter table public.ai_video_enrichments enable row level security;
alter table public.mux_webhook_events enable row level security;

drop policy if exists "ai_video_transcripts_admin_all" on public.ai_video_transcripts;
create policy "ai_video_transcripts_admin_all" on public.ai_video_transcripts
for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
drop policy if exists "ai_video_enrichments_admin_all" on public.ai_video_enrichments;
create policy "ai_video_enrichments_admin_all" on public.ai_video_enrichments
for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

-- Webhook events are service-role only: intentionally no authenticated policy.

comment on table public.ai_video_transcripts is
  'Admin-only transcript lifecycle. Transcript text must never be copied into application logs.';
comment on table public.ai_video_enrichments is
  'Admin-only AI drafts and human review metadata; published student projections are queried separately.';

create or replace function public.process_mux_caption_event(
  p_event_id text,
  p_event_type text,
  p_asset_id text,
  p_track_id text,
  p_language_code text,
  p_error_code text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer;
  updated_count integer;
begin
  if p_event_type not in ('video.asset.track.ready', 'video.asset.track.errored') then
    raise exception 'unsupported mux caption event';
  end if;

  insert into public.mux_webhook_events (event_id, event_type)
  values (p_event_id, p_event_type)
  on conflict (event_id) do nothing;
  get diagnostics inserted_count = row_count;

  if inserted_count = 0 then
    return 'duplicate';
  end if;

  update public.ai_video_transcripts transcript
  set
    provider_track_id = p_track_id,
    source_language = p_language_code,
    status = case
      when transcript.status = 'ready' then 'ready'
      when p_event_type = 'video.asset.track.ready' then 'processing'
      else 'failed'
    end,
    failure_code = case
      when p_event_type = 'video.asset.track.errored'
        then coalesce(nullif(p_error_code, ''), 'provider_error')
      else null
    end,
    failure_retryable = (p_event_type = 'video.asset.track.errored'),
    failed_at = case
      when p_event_type = 'video.asset.track.errored' and transcript.status <> 'ready'
        then now()
      else transcript.failed_at
    end
  from public.weekly_updates content
  where transcript.weekly_update_id = content.id
    and content.mux_asset_id = p_asset_id
    and transcript.status in ('pending', 'processing', 'ready');
  get diagnostics updated_count = row_count;

  update public.mux_webhook_events
  set processed_at = now(),
      processing_error_code = case when updated_count = 0 then 'transcript_not_found' else null end
  where event_id = p_event_id;

  return case when updated_count = 0 then 'ignored' else 'processed' end;
end;
$$;

revoke all on function public.process_mux_caption_event(text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.process_mux_caption_event(text, text, text, text, text, text)
  to service_role;
