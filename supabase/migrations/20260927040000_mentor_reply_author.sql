-- Keep mentor-reply notification authorship aligned with the actual sender.
-- Existing trigger and recipient behavior are unchanged; replacing its function
-- updates new notifications only. Previously delivered titles remain historical.
create or replace function public.handle_conversation_message_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_thread public.conversation_threads%rowtype;
  v_event_id uuid;
  v_sender_name text;
begin
  select *
    into v_thread
    from public.conversation_threads
    where id = new.thread_id;

  if not found then
    return new;
  end if;

  if new.sender_role = 'student' then
    update public.conversation_threads
       set last_message_at = new.created_at,
           last_student_message_at = new.created_at,
           unread_for_mentor_count = unread_for_mentor_count + 1,
           status = case when status = 'closed' then 'open' else 'pending_mentor' end,
           closed_at = null
     where id = new.thread_id;

    select coalesce(name, email, 'Student')
      into v_sender_name
      from public.students
      where id = new.sender_student_id;

    insert into public.notification_events (
      type,
      actor_student_id,
      target_table,
      target_id,
      title,
      body,
      href,
      metadata
    )
    values (
      'mentor_new_message',
      new.sender_student_id,
      'conversation_threads',
      new.thread_id::text,
      'Nieuwe mentorvraag',
      left(coalesce(v_sender_name, 'Student') || ': ' || new.body, 240),
      '/admin/mentor-inbox?thread=' || new.thread_id::text,
      jsonb_build_object('thread_id', new.thread_id)
    )
    returning id into v_event_id;

    insert into public.notification_recipients (event_id, student_id)
    select v_event_id, s.id
      from public.students s
      where s.access_level = 3
    on conflict do nothing;
  elsif new.sender_role in ('mentor', 'admin', 'ai') and new.is_internal = false then
    update public.conversation_threads
       set last_message_at = new.created_at,
           last_mentor_message_at = new.created_at,
           unread_for_student_count = unread_for_student_count + 1,
           status = 'pending_student',
           first_response_at = coalesce(first_response_at, new.created_at),
           closed_at = null
     where id = new.thread_id;

    if new.sender_role = 'ai' then
      v_sender_name := 'AI-assistent';
    else
      select nullif(btrim(s.name), '')
        into v_sender_name
        from public.students s
       where s.id = new.sender_student_id;
      v_sender_name := coalesce(v_sender_name, 'Je mentor');
    end if;

    insert into public.notification_events (
      type,
      actor_student_id,
      target_table,
      target_id,
      title,
      body,
      href,
      metadata
    )
    values (
      'mentor_reply',
      new.sender_student_id,
      'conversation_threads',
      new.thread_id::text,
      v_sender_name || ' heeft geantwoord',
      left(new.body, 240),
      '/mentor',
      jsonb_build_object('thread_id', new.thread_id)
    )
    returning id into v_event_id;

    insert into public.notification_recipients (event_id, student_id)
    values (v_event_id, v_thread.student_id)
    on conflict do nothing;
  else
    update public.conversation_threads
       set last_message_at = new.created_at
     where id = new.thread_id;
  end if;

  insert into public.conversation_events (
    thread_id,
    actor_student_id,
    event_type,
    metadata
  )
  values (
    new.thread_id,
    new.sender_student_id,
    'message_created',
    jsonb_build_object(
      'message_id', new.id,
      'sender_role', new.sender_role,
      'is_internal', new.is_internal
    )
  );

  return new;
end;
$$;
