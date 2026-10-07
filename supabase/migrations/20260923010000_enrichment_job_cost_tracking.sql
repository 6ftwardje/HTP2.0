alter table public.ai_video_enrichments
  drop constraint if exists ai_video_enrichments_status_check;
alter table public.ai_video_enrichments
  add constraint ai_video_enrichments_status_check
  check (status in ('processing', 'draft', 'review', 'published', 'rejected', 'failed'));

alter table public.ai_video_enrichments
  add column if not exists failure_code text,
  add column if not exists failure_retryable boolean not null default false,
  add column if not exists estimated_cost_eur numeric(12,6);

alter table public.ai_interactions
  add column if not exists transcript_id uuid references public.ai_video_transcripts(id) on delete set null,
  add column if not exists prompt_version text,
  add column if not exists estimated_cost_eur numeric(12,6),
  add column if not exists failure_code text,
  add column if not exists failure_retryable boolean not null default false;

create or replace function public.claim_video_enrichment(
  p_transcript_id uuid,
  p_prompt_version text,
  p_model text
)
returns table(enrichment_id uuid, claimed boolean, enrichment_status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  inserted_count integer;
begin
  if not public.is_platform_admin() then
    raise exception 'admin required';
  end if;

  insert into public.ai_video_enrichments (
    transcript_id, prompt_version, model, status
  ) values (
    p_transcript_id, p_prompt_version, p_model, 'processing'
  )
  on conflict (transcript_id, prompt_version, model) do nothing
  returning id into new_id;
  get diagnostics inserted_count = row_count;

  if inserted_count = 1 then
    return query select new_id, true, 'processing'::text;
  else
    update public.ai_video_enrichments
    set status = 'processing',
        failure_code = null,
        failure_retryable = false
    where transcript_id = p_transcript_id
      and prompt_version = p_prompt_version
      and model = p_model
      and status = 'failed'
      and failure_retryable = true
    returning id into new_id;
    get diagnostics inserted_count = row_count;

    if inserted_count = 1 then
      return query select new_id, true, 'processing'::text;
      return;
    end if;

    return query
      select id, false, status
      from public.ai_video_enrichments
      where transcript_id = p_transcript_id
        and prompt_version = p_prompt_version
        and model = p_model;
  end if;
end;
$$;

revoke all on function public.claim_video_enrichment(uuid, text, text)
  from public, anon;
grant execute on function public.claim_video_enrichment(uuid, text, text)
  to authenticated;
