-- Called after an authorized content page mounts; prefetch has no side effects.
-- Existing chat uses its visible public-sequence read cursor, never this helper.
begin;
create function public.mark_my_source_notifications_read(p_table text, p_ids text[])
returns integer language plpgsql security invoker set search_path = '' as $$
declare v_student_id uuid:=public.current_chat_student_id(); v_changed integer;
begin
  if v_student_id is null then raise exception 'authentication required' using errcode='42501'; end if;
  if p_table is null or p_table not in ('weekly_updates','live_sessions','modules','lessons')
    or p_ids is null or cardinality(p_ids)>40 then
    raise exception 'invalid source' using errcode='22023';
  end if;
  update public.notification_recipients nr set read_at=now()
  where nr.student_id=v_student_id and nr.read_at is null and nr.archived_at is null
    and exists (select 1 from public.notification_events ne where ne.id=nr.event_id
      and ne.target_table=p_table and ne.target_id=any(p_ids));
  get diagnostics v_changed=row_count;
  return v_changed;
end;
$$;
revoke all on function public.mark_my_source_notifications_read(text,text[]) from public,anon;
grant execute on function public.mark_my_source_notifications_read(text,text[]) to authenticated;
commit;
