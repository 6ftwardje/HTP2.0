-- HTP 2.0 (swohtycdqbydqrtjzwwf) only. Metadata repair for versions
-- whose effects have been verified on the live schema. Do not treat this as
-- permission to run the older, still-unreconciled migration backlog.
do $$
begin
  if position('v_student_access_level >= 2' in pg_get_functiondef('public.start_module_exam(bigint)'::regprocedure)) = 0 then
    raise exception 'exam access migration signature missing';
  end if;
  if (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'weekly_updates'
        and column_name in ('markets','actuality_status','event_context','period_label','chapters','related_content','needs_review')) <> 7
     or to_regclass('public.market_insight_content') is null then
    raise exception 'market insight migration signature missing';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public'
      and tablename = 'weekly_updates' and policyname = 'weekly_updates_select_subscription'
      and qual like '%access_level >= 2%') then
    raise exception 'level-2 content access policy missing';
  end if;
  if to_regclass('public.ai_video_transcripts') is null
     or to_regclass('public.ai_video_enrichments') is null
     or to_regclass('public.mux_webhook_events') is null
     or to_regprocedure('public.process_mux_caption_event(text,text,text,text,text,text)') is null then
    raise exception 'transcription foundation signature missing';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public'
      and table_name = 'ai_video_enrichments' and column_name = 'estimated_cost_eur')
     or to_regprocedure('public.claim_video_enrichment(uuid,text,text)') is null then
    raise exception 'enrichment cost migration signature missing';
  end if;
  if to_regclass('public.ai_video_workflows') is null
     or to_regprocedure('public.claim_ai_video_workflow(uuid,integer)') is null then
    raise exception 'workflow migration signature missing';
  end if;
  if (select count(*) from information_schema.columns where table_schema = 'public'
      and table_name = 'weekly_updates' and column_name in ('content_format','body','image_paths')) <> 3
     or not exists (select 1 from pg_constraint where conname = 'weekly_updates_published_non_video_check'
        and conrelid = 'public.weekly_updates'::regclass) then
    raise exception 'multi-format schema signature missing';
  end if;
  if not exists (select 1 from storage.buckets where id = 'market-update-charts' and public = false)
     or not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
        and policyname = 'market_update_charts_no_direct_read' and permissive = 'RESTRICTIVE') then
    raise exception 'private chart storage signature missing';
  end if;

  insert into supabase_migrations.schema_migrations (version, name)
  values
    ('20260922000000', 'align_exam_module_access'),
    ('20260922010000', 'market_insight_content'),
    ('20260922020000', 'restore_level_two_content_access'),
    ('20260923000000', 'transcription_ai_foundation'),
    ('20260923010000', 'enrichment_job_cost_tracking'),
    ('20260923020000', 'transcription_workflow_orchestration'),
    ('20260924000000', 'weekly_update_content_formats'),
    ('20260924010000', 'market_update_chart_storage')
  on conflict (version) do nothing;
end $$;
