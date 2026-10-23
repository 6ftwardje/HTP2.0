-- SCHEMA ONLY. Captured read-only from swohtycdqbydqrtjzwwf on 2026-10-23.
-- Application source: 4f07cf37b7d97cbd67ddacadc51cc8488c802a85. No users or application rows.
--
-- PostgreSQL database dump
--

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;
-- A fresh Supabase project can grant extra default rights. Clear these first;
-- the dump restores every captured object ACL and final default privileges.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated, service_role;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: lesson_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.lesson_type AS ENUM (
    'theorie',
    'praktijk'
);


--
-- Name: _send_chat_message_core(text, uuid, uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._send_chat_message_core(p_body text, p_client_message_id uuid, p_thread_id uuid DEFAULT NULL::uuid, p_is_internal boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare
  v_student_id uuid := public.current_chat_student_id();
  v_mentor_id uuid;
  v_thread public.conversation_threads%rowtype;
  v_message public.conversation_messages%rowtype;
  v_principal uuid;
  v_mentor_principal uuid;
  v_role text;
  v_body text := regexp_replace(replace(coalesce(p_body, ''), E'\r\n', E'\n'),
    '^[[:space:]]+|[[:space:]]+$', '', 'g');
begin
  if v_student_id is null then raise exception 'authentication required' using errcode = '42501'; end if;
  perform 1 from public.chat_mentor_config where singleton for share;
  v_mentor_id := public.current_chat_mentor_id();
  if v_mentor_id is null then raise exception 'chat mentor unavailable' using errcode = '55000'; end if;
  if p_client_message_id is null then raise exception 'client message ID required' using errcode = '22023'; end if;
  if p_thread_id is null then
    if v_student_id = v_mentor_id or coalesce(p_is_internal, false) then
      raise exception 'choose a student conversation' using errcode = '42501';
    end if;
    p_thread_id := (public.open_chat_thread(v_mentor_id)->>'threadId')::uuid;
  end if;
  select * into v_thread from public.conversation_threads where id = p_thread_id for update;
  if v_thread.id is null or v_thread.source_type <> 'mentor_chat' then
    raise exception 'chat access denied' using errcode = '42501';
  end if;
  v_role := public.chat_participant_role(v_thread.id);
  if v_role is null or (coalesce(p_is_internal, false) and v_role <> 'mentor') then
    raise exception 'chat access denied' using errcode = '42501';
  end if;
  select id into v_principal from public.chat_principals where student_id = v_student_id and kind = 'human';
  select * into v_message from public.conversation_messages
  where thread_id = v_thread.id and sender_principal_id = v_principal
    and client_message_id = p_client_message_id;
  if found then
    if v_message.body is distinct from v_body
       or v_message.is_internal is distinct from coalesce(p_is_internal, false) then
      raise exception 'client message ID conflicts with a different message' using errcode = '22023';
    end if;
    return jsonb_build_object('threadId', v_thread.id, 'message', to_jsonb(v_message));
  end if;
  if char_length(v_body) not between 1 and 5000 then
    raise exception 'message must contain between 1 and 5000 characters' using errcode = '22023';
  end if;
  if v_thread.chat_mode = 'paused' then
    raise exception 'chat temporarily read-only' using errcode = '55000';
  end if;
  -- Retries above never consume a new quota. The thread lock serializes this
  -- per-sender rolling limit for the one-conversation product model.
  if (select count(*) from public.conversation_messages m
      where m.thread_id = v_thread.id and m.sender_principal_id = v_principal
        and m.created_at > now() - interval '1 minute') >= 30 then
    raise exception 'message rate limit reached; retry shortly' using errcode = 'P0001';
  end if;
  insert into public.conversation_messages(thread_id, sender_student_id, sender_role,
    body, client_message_id, is_internal)
  values (v_thread.id, v_student_id, v_role, v_body, p_client_message_id, coalesce(p_is_internal, false))
  returning * into v_message;
  return jsonb_build_object('threadId', v_thread.id, 'message', to_jsonb(v_message));
end;
$_$;


--
-- Name: FUNCTION _send_chat_message_core(p_body text, p_client_message_id uuid, p_thread_id uuid, p_is_internal boolean); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public._send_chat_message_core(p_body text, p_client_message_id uuid, p_thread_id uuid, p_is_internal boolean) IS 'Authenticated, membership-authorized, serialized, idempotent human chat send. All content-access levels are eligible.';


--
-- Name: can_access_notification_recipient(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_access_notification_recipient(p_event_id uuid, p_student_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select case when public.is_chat_notification_event(p_event_id) then
    p_student_id = public.current_chat_student_id()
      and public.can_read_notification_event(p_event_id)
  else public.is_platform_admin() or (
    exists (select 1 from public.students s
            where s.id = p_student_id and s.auth_user_id = auth.uid())
    and public.can_read_notification_event(p_event_id)
  ) end;
$$;


--
-- Name: can_open_academy_module(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_open_academy_module(p_module_id bigint) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_student_id uuid;
  v_access_level smallint;
begin
  if auth.uid() is null then return false; end if;

  select s.id, s.access_level into v_student_id, v_access_level
  from public.students s where s.auth_user_id = auth.uid();
  if v_student_id is null then return false; end if;

  if not exists (
    select 1 from public.modules m
    where m.id = p_module_id and m.is_published
  ) then return false; end if;

  if v_access_level >= 2 then return true; end if;
  if exists (
    select 1 from public.legacy_academy_module_access legacy
    where legacy.student_id = v_student_id
      and legacy.module_id = p_module_id
  ) then return true; end if;
  if not public.current_student_completed_intake() then return false; end if;

  return exists (
    select 1 from public.modules m
    where m.id = p_module_id and m.is_published and m.is_free
  );
end;
$$;


--
-- Name: can_read_academy_lesson(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_read_academy_lesson(p_lesson_id bigint) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_access_level smallint;
  v_module_id bigint;
  v_first_module_id bigint;
  v_first_lesson_id bigint;
begin
  if auth.uid() is null then return false; end if;

  select s.access_level into v_access_level
  from public.students s
  where s.auth_user_id = auth.uid();
  if v_access_level is null then return false; end if;

  select l.module_id into v_module_id
  from public.lessons l
  join public.modules m on m.id = l.module_id
  where l.id = p_lesson_id and l.is_published and m.is_published;
  if v_module_id is null then return false; end if;

  if public.can_open_academy_module(v_module_id) then return true; end if;
  if v_access_level >= 2 then return false; end if;

  select m.id into v_first_module_id
  from public.modules m where m.is_published
  order by m.order_index, m.id limit 1;
  if v_module_id is distinct from v_first_module_id then return false; end if;

  select l.id into v_first_lesson_id
  from public.lessons l
  where l.module_id = v_first_module_id and l.is_published
  order by l.order_index, l.id limit 1;
  return p_lesson_id = v_first_lesson_id;
end;
$$;


--
-- Name: can_read_chat_attachment(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_read_chat_attachment(p_attachment_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select public.current_chat_student_id() is not null
    and public.chat_attachment_readable_by_student(p_attachment_id, public.current_chat_student_id());
$$;


--
-- Name: can_read_chat_profile(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_read_chat_profile(p_student_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select public.current_chat_student_id() is not null and exists (
    select 1 from public.students s join auth.users u on u.id = s.auth_user_id
    where s.id = p_student_id and u.deleted_at is null
      and (u.banned_until is null or u.banned_until <= now()) and (
        s.id = public.current_chat_student_id() or public.is_available_chat_mentor(s.id)
        or exists (
          select 1 from public.conversation_threads t
          where public.chat_participant_role(t.id) is not null and (
            t.student_id = s.id or t.assigned_to_student_id = s.id or exists (
              select 1 from public.conversation_messages m where m.thread_id = t.id
                and m.sender_student_id = s.id and m.deleted_at is null
                and (not m.is_internal or public.chat_participant_role(t.id) = 'mentor')
            )
          )
        )
      )
  );
$$;


--
-- Name: can_read_market_post(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_read_market_post(p_post_id bigint) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select auth.uid() is not null
    and exists (select 1 from auth.users u where u.id = auth.uid())
    and exists (
    select 1 from public.weekly_updates w
    where w.id = p_post_id and w.is_published and (
      public.is_platform_admin() or w.access_tier = 'free'
      or (w.access_tier = 'full_course' and exists (
        select 1 from public.students s where s.auth_user_id = auth.uid() and s.access_level >= 2
      ))
      or (w.access_tier = 'subscription'
        and (w.type in ('weekly_outlook', 'market_update', 'live_session') or w.type is null)
        and exists (select 1 from public.students s where s.auth_user_id = auth.uid() and s.access_level >= 2))
    )
  );
$$;


--
-- Name: can_read_notification_event(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_read_notification_event(p_event_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select case when public.is_chat_notification_event(p_event_id) then
    exists (
      select 1 from public.notification_events ne
      join public.notification_recipients nr on nr.event_id = ne.id
      where ne.id = p_event_id and nr.student_id = public.current_chat_student_id()
        and public.chat_participant_role(public.chat_notification_thread_id(ne.id)) is not null
        and (ne.type <> 'mentor_new_message'
             or public.chat_participant_role(public.chat_notification_thread_id(ne.id)) = 'mentor')
        and (ne.type <> 'mentor_reply'
             or public.chat_participant_role(public.chat_notification_thread_id(ne.id)) = 'student')
    )
  else public.is_platform_admin() or exists (
    select 1 from public.notification_events ne
    join public.notification_recipients nr on nr.event_id = ne.id
    join public.students s on s.id = nr.student_id
    where ne.id = p_event_id and s.auth_user_id = auth.uid()
      and ne.type in ('mentor_reply', 'weekly_update.published', 'live_session.scheduled',
        'live_session.cancelled', 'subscription.bonus_expired', 'subscription.payment_failed')
  ) end;
$$;


--
-- Name: FUNCTION can_read_notification_event(p_event_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.can_read_notification_event(p_event_id uuid) IS 'Chat events require current active participation and own delivery. Unrelated platform notifications retain their previous policy.';


--
-- Name: can_read_pdf(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_read_pdf(p_document_id uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare d public.pdf_documents; v_student public.students;
begin
 select * into v_student from public.students where auth_user_id=auth.uid();
 if v_student.id is null or not exists(select 1 from auth.users where id=auth.uid()) then return false; end if;
 select * into d from public.pdf_documents where id=p_document_id;
 if d.id is null then return false; end if;
 if v_student.access_level=3 then return d.storage_ready and d.state in ('draft','ready'); end if;
 if d.state<>'ready' or not d.storage_ready then return false; end if;
 if d.weekly_update_id is not null then return public.can_read_market_post(d.weekly_update_id); end if;
 -- Full module entitlement; deliberately excludes the first-lesson preview shortcut.
 return public.can_open_academy_module(d.module_id);
end;$$;


--
-- Name: can_read_student_avatar(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_read_student_avatar(p_student_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select auth.uid() is not null
    and exists (select 1 from auth.users u where u.id = auth.uid())
    and (
      exists (select 1 from public.students s where s.id = p_student_id and s.auth_user_id = auth.uid())
      or exists (
        select 1 from public.weekly_updates w
        where (case when w.content_format <> 'video' or w.content_kind = 'article'
          then coalesce(w.published_by_student_id, w.mentor_student_id, w.created_by_student_id)
          else coalesce(w.mentor_student_id, w.created_by_student_id) end) = p_student_id
          and public.can_read_market_post(w.id)
      )
    );
$$;


--
-- Name: can_start_academy_exam(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_start_academy_exam(p_module_id bigint) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_student_id uuid;
begin
  if auth.uid() is null then return false; end if;
  select s.id into v_student_id
  from public.students s where s.auth_user_id = auth.uid();
  if v_student_id is null then return false; end if;
  if not public.can_open_academy_module(p_module_id) then return false; end if;

  if not exists (
    select 1 from public.lessons l
    where l.module_id = p_module_id and l.is_published
  ) then return false; end if;

  return not exists (
    select 1 from public.lessons l
    where l.module_id = p_module_id
      and l.is_published
      and not exists (
        select 1 from public.progress p
        where p.student_id = v_student_id
          and p.lesson_id = l.id
          and p.watched = true
      )
  );
end;
$$;


--
-- Name: chat_attachment_projection(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.chat_attachment_projection(p_attachment_id uuid) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select jsonb_build_object('id', a.id, 'fileName', a.file_name, 'width', a.width,
    'height', a.height, 'mediaType', a.media_type, 'sizeBytes', a.size_bytes)
  from public.conversation_attachments a where a.id = p_attachment_id;
$$;


--
-- Name: chat_attachment_readable_by_student(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.chat_attachment_readable_by_student(p_attachment_id uuid, p_student_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select coalesce((select case when a.message_id is null then
    a.uploader_student_id = p_student_id and a.state in ('pending', 'ready')
      and public.current_chat_mentor_id() is not null
      and (a.thread_id is null or public.chat_attachment_role_for_student(a.thread_id, p_student_id) is not null)
    else a.state = 'attached' and exists (
      select 1 from public.conversation_messages m
      where m.id = a.message_id and m.thread_id = a.thread_id and m.deleted_at is null
        and public.chat_attachment_role_for_student(m.thread_id, p_student_id) is not null
        and (not m.is_internal or public.chat_attachment_role_for_student(m.thread_id, p_student_id) = 'mentor')
    ) end from public.conversation_attachments a where a.id = p_attachment_id), false);
$$;


--
-- Name: chat_attachment_role_for_student(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.chat_attachment_role_for_student(p_thread_id uuid, p_student_id uuid) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select cp.role from public.conversation_participants cp
  join public.chat_principals p on p.id = cp.principal_id and p.kind = 'human'
  join public.students s on s.id = p.student_id
  join auth.users u on u.id = s.auth_user_id
  join public.conversation_threads t on t.id = cp.thread_id
  where cp.thread_id = p_thread_id and cp.active and cp.revoked_at is null
    and p.student_id = p_student_id and u.deleted_at is null
    and (u.banned_until is null or u.banned_until <= now())
    and public.chat_thread_mentor_id(t.id) is not null
    and ((cp.role = 'student' and t.student_id = p_student_id)
      or (cp.role = 'mentor' and t.assigned_to_student_id = p_student_id))
  limit 1;
$$;


--
-- Name: chat_email_is_suppressed(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.chat_email_is_suppressed(p_student_id uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare v_user uuid; v_email text; v_suppressed boolean;
begin
  select u.id,u.email into v_user,v_email from public.students s join auth.users u on u.id=s.auth_user_id where s.id=p_student_id;
  if not found or v_email is null then return true; end if;
  -- The chat release can precede the separate email foundation. If installed,
  -- its bounce/unsubscribe suppressions are authoritative; lookup errors fail closed.
  if to_regclass('public.email_contacts') is not null then
    execute 'select exists(select 1 from public.email_contacts where auth_user_id=$1 and deleted_at is not null)' into v_suppressed using v_user;
    if v_suppressed then return true; end if;
  end if;
  if to_regclass('public.email_suppressions') is null then return false; end if;
  if to_regprocedure('public.email_identity_key(text)') is null then return true; end if;
  execute 'select exists(select 1 from public.email_suppressions where scope in (''all'',''mentor'') and identity_key=public.email_identity_key($1))'
    into v_suppressed using v_email;
  if v_suppressed then return true; end if;
  if to_regclass('public.email_contacts') is not null then
    execute 'select exists(select 1 from public.email_suppressions x join public.email_contacts c on c.identity_key=x.identity_key where c.auth_user_id=$1 and x.scope in (''all'',''mentor''))'
      into v_suppressed using v_user;
  end if;
  return coalesce(v_suppressed,false);
exception when others then return true;
end;
$_$;


--
-- Name: chat_email_recipient_snapshot(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.chat_email_recipient_snapshot(p_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_job public.chat_email_outbox; v_thread public.conversation_threads; v_recipient record; v_mentor uuid;
begin
  select * into v_job from public.chat_email_outbox where id=p_id;
  if not found then return jsonb_build_object('allowed',false,'reason','job_unavailable'); end if;
  -- Starting delivery after a disabled pilot must not replay an old backlog.
  -- Already-attempted jobs retain their separate provider idempotency deadline.
  if v_job.first_attempt_at is null and v_job.created_at<now()-interval '24 hours' then
    return jsonb_build_object('allowed',false,'reason','notification_expired'); end if;
  v_mentor:=public.chat_thread_mentor_id(v_job.thread_id);
  if v_mentor is null or v_job.mentor_student_id<>v_mentor then return jsonb_build_object('allowed',false,'reason','mentor_changed'); end if;
  select * into v_thread from public.conversation_threads where id=v_job.thread_id and source_type='mentor_chat';
  if not found or v_thread.student_id=v_mentor then return jsonb_build_object('allowed',false,'reason','thread_unavailable'); end if;
  select cp.role,cp.last_read_public_seq,p.student_id,u.email,u.email_confirmed_at,u.deleted_at,u.banned_until into v_recipient
  from public.conversation_participants cp join public.chat_principals p on p.id=cp.principal_id and p.kind='human'
  join public.students s on s.id=p.student_id join auth.users u on u.id=s.auth_user_id
  where cp.id=v_job.recipient_participant_id and cp.thread_id=v_job.thread_id and cp.active and cp.revoked_at is null
    and p.student_id=v_job.recipient_student_id and cp.role=v_job.recipient_role
    and ((cp.role='mentor' and p.student_id=v_mentor) or (cp.role='student' and p.student_id=v_thread.student_id));
  if not found then return jsonb_build_object('allowed',false,'reason','recipient_revoked'); end if;
  if v_recipient.deleted_at is not null or (v_recipient.banned_until is not null and v_recipient.banned_until>now())
    or v_recipient.email is null or v_recipient.email_confirmed_at is null then
    return jsonb_build_object('allowed',false,'reason','account_unavailable'); end if;
  if not exists (select 1 from public.conversation_participants cp join public.chat_principals p on p.id=cp.principal_id and p.kind='human'
    where cp.thread_id=v_thread.id and cp.active and cp.revoked_at is null and cp.role='student' and p.student_id=v_thread.student_id)
    or not exists (select 1 from public.conversation_participants cp join public.chat_principals p on p.id=cp.principal_id and p.kind='human'
    where cp.thread_id=v_thread.id and cp.active and cp.revoked_at is null and cp.role='mentor' and p.student_id=v_mentor) then
    return jsonb_build_object('allowed',false,'reason','participation_changed'); end if;
  if not coalesce((select enabled from public.chat_email_preferences where student_id=v_recipient.student_id),true) then
    return jsonb_build_object('allowed',false,'reason','preference_disabled'); end if;
  if public.chat_email_is_suppressed(v_recipient.student_id) then return jsonb_build_object('allowed',false,'reason','email_suppressed'); end if;
  if v_recipient.last_read_public_seq>=v_job.last_public_seq or not exists (
    select 1 from public.conversation_messages m where m.thread_id=v_job.thread_id and not m.is_internal and m.deleted_at is null
      and m.public_seq>v_recipient.last_read_public_seq and m.public_seq<=v_job.last_public_seq
      and m.sender_role=case when v_job.recipient_role='student' then 'mentor' else 'student' end
  ) then return jsonb_build_object('allowed',false,'reason','already_read'); end if;
  return jsonb_build_object('allowed',true,'email',lower(btrim(v_recipient.email)),
    'recipientStudentId',v_recipient.student_id,'recipientRole',v_recipient.role,'mentorStudentId',v_mentor,
    'threadId',v_thread.id,'lastReadSeq',v_recipient.last_read_public_seq,'lastPublicSeq',v_thread.last_public_message_seq);
end;
$$;


--
-- Name: chat_notification_thread_id(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.chat_notification_thread_id(p_event_id uuid) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $_$
  select case
    when ne.target_table = 'conversation_threads'
      and ne.target_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then ne.target_id::uuid
    when (ne.metadata ->> 'thread_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (ne.metadata ->> 'thread_id')::uuid
    when ne.target_table = 'conversation_messages'
      and ne.target_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (select m.thread_id from public.conversation_messages m where m.id = ne.target_id::uuid)
    else null end
  from public.notification_events ne where ne.id = p_event_id;
$_$;


--
-- Name: chat_participant_role(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.chat_participant_role(p_thread_id uuid) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select public.chat_attachment_role_for_student(p_thread_id, public.current_chat_student_id());
$$;


--
-- Name: chat_presence_heartbeat(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.chat_presence_heartbeat(p_session_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_student uuid := public.current_chat_student_id();
begin
  if v_student is null then raise exception 'authentication required' using errcode='42501'; end if;
  if p_session_id is null then raise exception 'session ID required' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('chat-presence:' || v_student::text, 0));
  delete from public.chat_presence_sessions where student_id=v_student and last_seen_at < now()-interval '65 seconds';
  if not exists(select 1 from public.chat_presence_sessions where student_id=v_student and session_id=p_session_id)
    and (select count(*) from public.chat_presence_sessions where student_id=v_student)>=12 then
    raise exception 'presence session limit reached' using errcode='53300';
  end if;
  insert into public.chat_presence_sessions(student_id,session_id,last_seen_at)
  values(v_student,p_session_id,statement_timestamp())
  on conflict(student_id,session_id) do update set last_seen_at=excluded.last_seen_at;
end;
$$;


--
-- Name: chat_presence_leave(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.chat_presence_leave(p_session_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_student uuid := public.current_chat_student_id();
begin
  if v_student is null then raise exception 'authentication required' using errcode='42501'; end if;
  delete from public.chat_presence_sessions where student_id=v_student and session_id=p_session_id;
end;
$$;


--
-- Name: chat_thread_mentor_id(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.chat_thread_mentor_id(p_thread_id uuid) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select t.assigned_to_student_id from public.conversation_threads t
  where t.id = p_thread_id and t.source_type = 'mentor_chat'
    and t.student_id <> t.assigned_to_student_id
    and public.is_available_chat_mentor(t.assigned_to_student_id);
$$;


--
-- Name: claim_ai_video_workflow(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_ai_video_workflow(p_transcript_id uuid, p_lease_seconds integer DEFAULT 120) RETURNS TABLE(workflow_id uuid, claimed boolean, lease_token uuid, attempt_count integer, max_attempts integer, workflow_status text, workflow_step text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: claim_avatar_garbage(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_avatar_garbage() RETURNS TABLE(object_path text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
begin
  -- Reconcile files whose expired pending record was removed before a slow
  -- Storage upload finished. A referenced avatar always has its FK record.
  insert into public.avatar_objects(object_path, state)
    select o.name, 'garbage' from storage.objects o
    where o.bucket_id = 'profile-avatars'
      and o.name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'
      and not exists (select 1 from public.avatar_objects a where a.object_path = o.name)
    order by o.created_at limit 100 on conflict on constraint avatar_objects_pkey do nothing;
  return query with candidates as (
    select o.object_path from public.avatar_objects o
    where (o.state = 'garbage' or (o.state = 'pending' and o.created_at < now() - interval '1 hour'))
      and not exists (select 1 from public.student_avatars a where a.object_path = o.object_path)
    order by o.created_at limit 100 for update skip locked
  ) update public.avatar_objects o set state = 'garbage' from candidates c
    where o.object_path = c.object_path returning o.object_path;
end;
$_$;


--
-- Name: claim_chat_attachment_garbage(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_chat_attachment_garbage(p_limit integer DEFAULT 100) RETURNS TABLE(id uuid, object_path text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_limit integer := greatest(1, least(coalesce(p_limit, 100), 100));
begin
  -- Tombstones retain the hourly quota and catch a late upload after a failed
  -- request. A second cleanup safely removes the same immutable path again.
  return query with candidates as (
    select a.id from public.conversation_attachments a
    where a.message_id is null and (
      a.state = 'garbage' or a.state = 'attached' or a.uploader_student_id is null
      or (a.state in ('pending', 'ready') and a.created_at < now() - interval '24 hours')
      or (a.state = 'deleted' and exists (select 1 from storage.objects o
          where o.bucket_id = 'mentor-chat-attachments' and o.name = a.object_path))
    ) order by a.created_at limit v_limit for update skip locked
  ), claimed as (
    update public.conversation_attachments a set state = 'garbage'
    from candidates c where a.id = c.id returning a.id, a.object_path
  ) select c.id, c.object_path from claimed c;
  return query select null::uuid, o.name from storage.objects o
  where o.bucket_id = 'mentor-chat-attachments' and o.created_at < now() - interval '24 hours'
    and not exists (select 1 from public.conversation_attachments a where a.object_path = o.name)
  order by o.created_at limit v_limit;
  delete from public.conversation_attachments a
  where a.state = 'deleted' and a.message_id is null and a.deleted_at < now() - interval '24 hours'
    and not exists (select 1 from storage.objects o
      where o.bucket_id = 'mentor-chat-attachments' and o.name = a.object_path);
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: chat_email_outbox; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_email_outbox (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    thread_id uuid NOT NULL,
    recipient_participant_id uuid NOT NULL,
    recipient_student_id uuid NOT NULL,
    recipient_role text NOT NULL,
    mentor_student_id uuid NOT NULL,
    first_public_seq bigint NOT NULL,
    last_public_seq bigint NOT NULL,
    last_message_id uuid,
    due_at timestamp with time zone NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    lease_token uuid,
    lease_until timestamp with time zone,
    attempts integer DEFAULT 0 NOT NULL,
    first_attempt_at timestamp with time zone,
    payload jsonb,
    provider_id text,
    sent_at timestamp with time zone,
    last_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chat_email_outbox_attempts_check CHECK ((attempts >= 0)),
    CONSTRAINT chat_email_outbox_check CHECK ((last_public_seq >= first_public_seq)),
    CONSTRAINT chat_email_outbox_first_public_seq_check CHECK ((first_public_seq > 0)),
    CONSTRAINT chat_email_outbox_recipient_role_check CHECK ((recipient_role = ANY (ARRAY['student'::text, 'mentor'::text]))),
    CONSTRAINT chat_email_outbox_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'leased'::text, 'retry'::text, 'sent'::text, 'cancelled'::text, 'failed'::text, 'needs_review'::text])))
);


--
-- Name: TABLE chat_email_outbox; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.chat_email_outbox IS 'Private generic chat email delivery metadata; no chat bodies, names or historical replay.';


--
-- Name: claim_chat_email_notification(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_chat_email_notification() RETURNS SETOF public.chat_email_outbox
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  return query with selected as (
    select id from public.chat_email_outbox where due_at<=now() and (
      status in ('queued','retry') or (status='leased' and lease_until<now()))
    order by due_at,created_at limit 1 for update skip locked
  ) update public.chat_email_outbox o set status='leased',lease_token=gen_random_uuid(),lease_until=now()+interval '2 minutes'
    from selected s where o.id=s.id returning o.*;
end;
$$;


--
-- Name: claim_video_enrichment(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_video_enrichment(p_transcript_id uuid, p_prompt_version text, p_model text) RETURNS TABLE(enrichment_id uuid, claimed boolean, enrichment_status text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: cleanup_deleted_auth_market_profile(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_deleted_auth_market_profile() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  delete from public.market_post_reactions r using public.students s
    where r.student_id = s.id and s.auth_user_id = old.id;
  update public.avatar_objects o set state = 'garbage'
    from public.students s where o.student_id = s.id and s.auth_user_id = old.id;
  delete from public.student_avatars a using public.students s
    where a.student_id = s.id and s.auth_user_id = old.id;
  return old;
end;
$$;


--
-- Name: cleanup_deleted_auth_pdf_logs(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_deleted_auth_pdf_logs() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$begin
 delete from public.pdf_open_logs l using public.students s where l.student_id=s.id and s.auth_user_id=old.id;return old;
end;$$;


--
-- Name: cleanup_deleted_auth_pdf_positions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_deleted_auth_pdf_positions() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$begin
 delete from public.pdf_positions p using public.students s where p.student_id=s.id and s.auth_user_id=old.id;return old;
end;$$;


--
-- Name: cleanup_deleted_auth_video_positions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_deleted_auth_video_positions() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$begin
 delete from public.video_positions p using public.students s where p.student_id=s.id and s.auth_user_id=old.id;return old;
end;$$;


--
-- Name: commit_student_avatar(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.commit_student_avatar(p_auth_uid uuid, p_path text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_student uuid; v_old text;
begin
  -- Serialize against Auth account deletion, including in-flight uploads.
  perform 1 from auth.users where id = p_auth_uid for key share;
  if not found then raise exception 'Account no longer exists'; end if;
  select id into v_student from public.students where auth_user_id = p_auth_uid for update;
  if v_student is null then raise exception 'Profile not found'; end if;
  if p_path is not null then
    perform 1 from public.avatar_objects where object_path = p_path and student_id = v_student and state = 'pending' for update;
    if not found then raise exception 'Avatar is not pending or owned by this user'; end if;
    perform 1 from storage.objects where bucket_id = 'profile-avatars' and name = p_path;
    if not found then raise exception 'Avatar object missing'; end if;
  end if;
  select object_path into v_old from public.student_avatars where student_id = v_student;
  insert into public.student_avatars(student_id, object_path) values(v_student, p_path)
    on conflict(student_id) do update set object_path = excluded.object_path, updated_at = now();
  update public.avatar_objects set state = 'active' where object_path = p_path;
  update public.avatar_objects set state = 'garbage' where object_path = v_old and object_path is distinct from p_path;
  return p_path;
end;
$$;


--
-- Name: complete_chat_attachment_cleanup(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.complete_chat_attachment_cleanup(p_attachment_ids uuid[]) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO ''
    AS $$
  update public.conversation_attachments set state = 'deleted', deleted_at = now()
  where id = any(p_attachment_ids) and state = 'garbage' and message_id is null;
$$;


--
-- Name: complete_chat_attachment_upload(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.complete_chat_attachment_upload(p_auth_uid uuid, p_attachment_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_attachment public.conversation_attachments%rowtype; v_student uuid;
begin
  select s.id into v_student from public.students s join auth.users u on u.id = s.auth_user_id
  where u.id = p_auth_uid and u.deleted_at is null and (u.banned_until is null or u.banned_until <= now());
  select * into v_attachment from public.conversation_attachments where id = p_attachment_id for update;
  if v_student is null or v_attachment.uploader_student_id is distinct from v_student
    or v_attachment.state not in ('pending', 'ready', 'attached') then
    raise exception 'upload unavailable' using errcode = '42501';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'mentor-chat-attachments'
      and name = v_attachment.object_path) then
    raise exception 'validated image object missing' using errcode = '55000';
  end if;
  update public.conversation_attachments set state = 'ready' where id = p_attachment_id and state = 'pending';
  return public.chat_attachment_projection(p_attachment_id);
end;
$$;


--
-- Name: configure_chat_mentor(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.configure_chat_mentor(p_student_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_principal uuid; v_thread public.conversation_threads%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'trusted service required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.students s join auth.users u on u.id = s.auth_user_id
    where s.id = p_student_id and u.deleted_at is null
      and (u.banned_until is null or u.banned_until <= now())) then
    raise exception 'mentor must be a live platform account' using errcode = '22023';
  end if;
  perform 1 from public.chat_mentor_config where singleton for update;
  insert into public.user_roles(student_id, role) values(p_student_id, 'mentor')
    on conflict(student_id, role) do nothing;
  insert into public.chat_principals(kind, student_id, display_name)
  select 'human', s.id, coalesce(nullif(btrim(s.name), ''), 'Platformlid')
  from public.students s where s.id = p_student_id
  on conflict (student_id) where kind = 'human'
  do update set display_name = excluded.display_name returning id into v_principal;
  for v_thread in select * from public.conversation_threads
    where source_type = 'mentor_chat' and source_id is null
      and assigned_to_student_id is null and student_id <> p_student_id
    order by id for update
  loop
    update public.conversation_participants set active = false, revoked_at = now()
      where thread_id = v_thread.id and role = 'mentor' and active;
    insert into public.conversation_participants(thread_id, principal_id, role, active, last_read_public_seq)
    values(v_thread.id, v_principal, 'mentor', true,
      case when v_thread.unread_for_mentor_count = 0 then v_thread.last_public_message_seq else 0 end)
    on conflict(thread_id, principal_id, role) do nothing;
    update public.conversation_threads set assigned_to_student_id = p_student_id,
      chat_version = chat_version + 1 where id = v_thread.id;
  end loop;
  update public.chat_mentor_config set mentor_student_id = p_student_id, enabled = true,
    updated_at = now() where singleton;
  return jsonb_build_object('configured', true, 'mentorStudentId', p_student_id);
end;
$$;


--
-- Name: FUNCTION configure_chat_mentor(p_student_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.configure_chat_mentor(p_student_id uuid) IS 'Service-only default mentor selection; existing pair conversations are never rotated or merged.';


--
-- Name: current_chat_mentor_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_chat_mentor_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select s.id from public.students s
  cross join public.chat_mentor_config c
  where public.is_available_chat_mentor(s.id)
  order by (s.id = c.mentor_student_id) desc, s.name nulls last, s.id limit 1;
$$;


--
-- Name: current_chat_student_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_chat_student_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select s.id from public.students s
  join auth.users u on u.id = s.auth_user_id
  where s.auth_user_id = auth.uid() and u.deleted_at is null
    and (u.banned_until is null or u.banned_until <= now())
  limit 1;
$$;


--
-- Name: current_pdf_version(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_pdf_version(p_id uuid) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$ select d.version from public.pdf_documents d where d.id=p_id and public.can_read_pdf(d.id); $$;


--
-- Name: current_student_completed_intake(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_student_completed_intake() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (
    select 1
    from public.students s
    join public.student_onboarding_responses r on r.student_id = s.id
    where s.auth_user_id = auth.uid()
      and nullif(trim(coalesce(r.experience_level, '')), '') is not null
      and nullif(trim(coalesce(r.primary_market, '')), '') is not null
      and nullif(trim(coalesce(r.main_challenge, '')), '') is not null
      and nullif(trim(coalesce(r.goal_90_days, '')), '') is not null
      and nullif(trim(coalesce(r.weekly_time_commitment, '')), '') is not null
      and nullif(trim(coalesce(r.mentorship_interest, '')), '') is not null
      and r.confidence_score between 1 and 5
  );
$$;


--
-- Name: delete_academy_rubric(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_academy_rubric(p_id uuid, p_version integer) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
 if not public.is_pdf_admin() then raise insufficient_privilege;end if;
 delete from public.academy_rubrics where id=p_id and version=p_version;
 if not found then raise exception using errcode='40001',message='Rubric changed';end if;
 -- Only the presentation mapping is removed. Modules, PDFs, progress and exams survive.
 return true;
end;$$;


--
-- Name: discard_chat_attachment(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.discard_chat_attachment(p_attachment_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_student uuid := public.current_chat_student_id(); v_attachment public.conversation_attachments%rowtype;
begin
  select * into v_attachment from public.conversation_attachments where id = p_attachment_id for update;
  if v_student is null or v_attachment.uploader_student_id is distinct from v_student
    or v_attachment.message_id is not null or v_attachment.state = 'attached' then
    raise exception 'image unavailable' using errcode = '42501';
  end if;
  update public.conversation_attachments set state = 'garbage'
  where id = p_attachment_id and state <> 'deleted';
  return jsonb_build_object('success', true);
end;
$$;


--
-- Name: enqueue_chat_email_notification(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enqueue_chat_email_notification() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_recipient record; v_existing uuid; v_mentor uuid;
begin
  if new.is_internal or new.deleted_at is not null or new.public_seq is null
    or new.sender_role not in ('student','mentor') then return new; end if;
  v_mentor:=public.chat_thread_mentor_id(new.thread_id);
  if v_mentor is null then return new; end if;
  select cp.id as participant_id,p.student_id,cp.role into v_recipient
  from public.conversation_threads t
  join public.conversation_participants cp on cp.thread_id=t.id and cp.active and cp.revoked_at is null
  join public.chat_principals p on p.id=cp.principal_id and p.kind='human'
  where t.id=new.thread_id and t.source_type='mentor_chat' and t.student_id<>v_mentor
    and cp.role=case when new.sender_role='student' then 'mentor' else 'student' end
    and ((cp.role='mentor' and p.student_id=v_mentor) or (cp.role='student' and p.student_id=t.student_id));
  if not found then return new; end if;
  if not coalesce((select enabled from public.chat_email_preferences where student_id=v_recipient.student_id),true)
    or public.chat_email_is_suppressed(v_recipient.student_id) then return new; end if;
  -- send_chat_message already serializes inserts on the thread. The first event
  -- starts the window; later messages extend the range without delaying delivery.
  select id into v_existing from public.chat_email_outbox
  where thread_id=new.thread_id and recipient_participant_id=v_recipient.participant_id
    and status in ('queued','retry') and first_attempt_at is null and due_at>now()
  order by created_at desc limit 1 for update;
  if v_existing is not null then
    update public.chat_email_outbox set last_public_seq=new.public_seq,last_message_id=new.id where id=v_existing;
  else
    insert into public.chat_email_outbox(thread_id,recipient_participant_id,recipient_student_id,recipient_role,
      mentor_student_id,first_public_seq,last_public_seq,last_message_id,due_at)
    values(new.thread_id,v_recipient.participant_id,v_recipient.student_id,v_recipient.role,
      v_mentor,new.public_seq,new.public_seq,new.id,now()+interval '2 minutes');
  end if;
  return new;
end;
$$;


--
-- Name: finish_chat_email_notification(uuid, uuid, text, text, timestamp with time zone, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.finish_chat_email_notification(p_id uuid, p_lease uuid, p_status text, p_reason text, p_due_at timestamp with time zone, p_provider_id text DEFAULT NULL::text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
begin
  if p_status not in ('queued','retry','sent','cancelled','failed','needs_review') or p_reason is not null and p_reason!~'^[a-z0-9_]{1,80}$' then
    raise exception 'invalid email result' using errcode='22023'; end if;
  update public.chat_email_outbox set status=p_status,due_at=coalesce(p_due_at,now()),last_error=p_reason,
    provider_id=coalesce(provider_id,p_provider_id),sent_at=case when p_status='sent' then coalesce(sent_at,now()) else sent_at end,
    lease_token=null,lease_until=null
  where id=p_id and status='leased' and lease_token=p_lease;
  return found;
end;
$_$;


--
-- Name: get_chat_attachment_download(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_chat_attachment_download(p_auth_uid uuid, p_attachment_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_student uuid;
begin
  select s.id into v_student from public.students s join auth.users u on u.id = s.auth_user_id
  where u.id = p_auth_uid and u.deleted_at is null and (u.banned_until is null or u.banned_until <= now());
  if v_student is null or not public.chat_attachment_readable_by_student(p_attachment_id, v_student) then
    raise exception 'image unavailable' using errcode = '42501';
  end if;
  return (select jsonb_build_object('objectPath', object_path, 'mediaType', media_type, 'fileName', file_name)
    from public.conversation_attachments where id = p_attachment_id);
end;
$$;


--
-- Name: get_chat_mentors(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_chat_mentors() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_student uuid := public.current_chat_student_id(); v_result jsonb;
begin
  if v_student is null then raise exception 'authentication required' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('studentId', s.id,
    'displayName', coalesce(nullif(btrim(s.name), ''), 'Mentor'),
    'role', case when s.access_level = 3 or exists(select 1 from public.user_roles r where r.student_id=s.id and r.role='admin') then 'admin' else 'mentor' end,
    'avatarPath', a.object_path, 'threadId', t.id,
    'unreadCount', coalesce(t.unread_for_student_count, 0))
    order by (s.id = c.mentor_student_id) desc, s.name, s.id), '[]'::jsonb) into v_result
  from public.students s cross join public.chat_mentor_config c
  left join public.student_avatars a on a.student_id = s.id
  left join public.conversation_threads t on t.student_id = v_student and t.assigned_to_student_id = s.id
    and t.source_type='mentor_chat' and t.source_id is null and public.chat_participant_role(t.id)='student'
  where s.id <> v_student and public.is_available_chat_mentor(s.id)
    and not exists (
      select 1 from public.conversation_threads existing
      where existing.student_id = v_student and existing.assigned_to_student_id = s.id
        and existing.source_type = 'mentor_chat' and existing.source_id is null
        and public.chat_participant_role(existing.id) is distinct from 'student'
    );
  return v_result;
end;
$$;


--
-- Name: get_chat_message_attachments(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_chat_message_attachments(p_message_ids uuid[]) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_student uuid := public.current_chat_student_id(); v_mentor uuid := public.current_chat_mentor_id(); v_result jsonb;
begin
  if v_student is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if coalesce(cardinality(p_message_ids), 0) > 100 then
    raise exception 'too many message IDs' using errcode = '22023';
  end if;
  with my_threads as materialized (
    select cp.thread_id, cp.role from public.conversation_participants cp
    join public.chat_principals p on p.id = cp.principal_id and p.kind = 'human'
    join public.conversation_threads t on t.id = cp.thread_id
    where p.student_id = v_student and cp.active and cp.revoked_at is null
      and public.chat_participant_role(t.id) = cp.role
  )
  select coalesce(jsonb_agg(jsonb_build_object('messageId', m.id, 'attachments', coalesce((
    select jsonb_agg(public.chat_attachment_projection(a.id) order by a.position, a.id)
    from public.conversation_attachments a where a.message_id = m.id and a.thread_id = m.thread_id and a.state = 'attached'
  ), '[]'::jsonb))), '[]'::jsonb) into v_result
  from public.conversation_messages m join my_threads mt on mt.thread_id = m.thread_id
  where m.id = any(coalesce(p_message_ids, '{}'::uuid[])) and m.deleted_at is null
    and (not m.is_internal or mt.role = 'mentor');
  return v_result;
end;
$$;


--
-- Name: get_chat_profiles(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_chat_profiles(p_student_ids uuid[]) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_result jsonb;
begin
  if public.current_chat_student_id() is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if coalesce(cardinality(p_student_ids), 0) > 200 then raise exception 'too many profile IDs' using errcode = '22023'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('studentId', s.id,
    'displayName', coalesce(nullif(btrim(s.name), ''), 'Platformlid'),
    'role', case when s.access_level = 3 or exists (select 1 from public.user_roles r where r.student_id=s.id and r.role='admin') then 'admin'
      when public.is_available_chat_mentor(s.id) or exists (select 1 from public.user_roles r where r.student_id=s.id and r.role='mentor') then 'mentor' else 'student' end,
    'avatarPath', a.object_path) order by s.name, s.id), '[]'::jsonb) into v_result
  from public.students s left join public.student_avatars a on a.student_id = s.id
  where s.id = any(coalesce(p_student_ids, '{}'::uuid[])) and public.can_read_chat_profile(s.id);
  return v_result;
end;
$$;


--
-- Name: FUNCTION get_chat_profiles(p_student_ids uuid[]); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_chat_profiles(p_student_ids uuid[]) IS 'Authenticated minimal profile projection: self, available mentors, and authors/participants in currently authorized chats.';


--
-- Name: get_chat_read_state(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_chat_read_state(p_thread_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_role text := public.chat_participant_role(p_thread_id);
  v_read_seq bigint;
begin
  if v_role is null then raise exception 'chat access denied' using errcode = '42501'; end if;
  select cp.last_read_public_seq into v_read_seq
  from public.conversation_participants cp join public.chat_principals p on p.id = cp.principal_id
  where cp.thread_id = p_thread_id and cp.active and cp.revoked_at is null
    and cp.role = v_role and p.student_id = public.current_chat_student_id();
  return jsonb_build_object('lastReadSeq', coalesce(v_read_seq, 0));
end;
$$;


--
-- Name: get_mentor_inbox(text, text, integer, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_mentor_inbox(p_status text DEFAULT 'active'::text, p_query text DEFAULT ''::text, p_limit integer DEFAULT 40, p_cursor text DEFAULT NULL::text, p_selected_thread_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 40), 100));
  v_query text := btrim(coalesce(p_query, ''));
  v_cursor_at timestamptz;
  v_cursor_id uuid;
  v_rows jsonb := '[]'::jsonb;
  v_row record;
  v_count integer := 0;
  v_has_more boolean := false;
  v_next_cursor text;
  v_selected jsonb;
begin
  if public.current_chat_student_id() is null
     or not public.is_available_chat_mentor(public.current_chat_student_id()) then
    raise exception 'mentor chat access required' using errcode = '42501';
  end if;
  if p_cursor is not null then
    begin
      v_cursor_at := (p_cursor::jsonb ->> 'at')::timestamptz;
      v_cursor_id := (p_cursor::jsonb ->> 'id')::uuid;
      if v_cursor_at is null or v_cursor_id is null then raise invalid_text_representation; end if;
    exception when others then
      raise exception 'invalid inbox cursor' using errcode = '22023';
    end;
  end if;
  for v_row in
    select t.id, coalesce(t.last_message_at, t.created_at) sort_at
    from public.conversation_threads t join public.students s on s.id = t.student_id
    where t.source_type = 'mentor_chat' and public.chat_participant_role(t.id) = 'mentor'
      and case
        when p_status = 'all' then true
        when p_status = 'unread' then t.unread_for_mentor_count > 0
        when p_status in ('open', 'pending_mentor', 'pending_student', 'snoozed', 'closed') then t.status = p_status
        else t.status <> 'closed' end
      and (v_query = '' or position(lower(v_query) in lower(coalesce(s.name, ''))) > 0
        or position(lower(v_query) in lower(coalesce(t.subject, ''))) > 0
        or exists (select 1 from public.conversation_messages m
          where m.thread_id = t.id and not m.is_internal and m.deleted_at is null
            and position(lower(v_query) in lower(m.body)) > 0))
      and (v_cursor_at is null or (coalesce(t.last_message_at, t.created_at), t.id) < (v_cursor_at, v_cursor_id))
    order by coalesce(t.last_message_at, t.created_at) desc, t.id desc limit v_limit + 1
  loop
    v_count := v_count + 1;
    if v_count > v_limit then v_has_more := true; exit; end if;
    v_rows := v_rows || jsonb_build_array(public.mentor_chat_thread_projection(v_row.id));
    v_next_cursor := jsonb_build_object('at', v_row.sort_at, 'id', v_row.id)::text;
  end loop;
  if p_selected_thread_id is not null then
    v_selected := public.mentor_chat_thread_projection(p_selected_thread_id);
  end if;
  return jsonb_build_object('rows', v_rows, 'selectedThread', v_selected,
    'hasMore', v_has_more, 'nextCursor', case when v_has_more then v_next_cursor else null end);
end;
$$;


--
-- Name: get_my_chat_access(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_chat_access() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_student uuid := public.current_chat_student_id(); v_mentor uuid := public.current_chat_mentor_id();
begin
  if v_student is null then raise exception 'authentication required' using errcode='42501'; end if;
  return jsonb_build_object('available', v_mentor is not null,
    'isMentor', public.is_available_chat_mentor(v_student),
    'unreadCount', coalesce((select sum(case when public.chat_participant_role(t.id)='mentor'
      then t.unread_for_mentor_count else t.unread_for_student_count end)
      from public.conversation_threads t where t.source_type='mentor_chat' and public.chat_participant_role(t.id) is not null),0),
    'mentor', case when v_mentor is null then null else (
      select jsonb_build_object('studentId',s.id,'displayName',coalesce(nullif(btrim(s.name),''),'Mentor'),
        'avatarPath',a.object_path) from public.students s left join public.student_avatars a on a.student_id=s.id where s.id=v_mentor) end);
end;
$$;


--
-- Name: get_my_chat_email_preferences(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_chat_email_preferences() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_student uuid:=public.current_chat_student_id();
begin
  if v_student is null then raise exception 'authentication required' using errcode='42501'; end if;
  return jsonb_build_object('enabled',coalesce((select enabled from public.chat_email_preferences where student_id=v_student),true),
    'suppressed',public.chat_email_is_suppressed(v_student));
end;
$$;


--
-- Name: get_my_dashboard_read_model(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_dashboard_read_model() RETURNS jsonb
    LANGUAGE plpgsql STABLE
    SET search_path TO ''
    AS $$
declare
  v_auth_user_id uuid := auth.uid();
  v_student_id uuid;
begin
  if v_auth_user_id is null then
    raise exception 'authentication required'
      using errcode = '42501';
  end if;

  select s.id
    into v_student_id
    from public.students s
   where s.auth_user_id = v_auth_user_id;

  if v_student_id is null then
    raise exception 'student not found'
      using errcode = '42501';
  end if;

  return jsonb_build_object(
    'studentId', v_student_id,
    'modules', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', m.id,
          'title', m.title,
          'slug', m.slug,
          'description', m.description,
          'short_description', m.short_description,
          'order_index', m.order_index,
          'thumbnail_url', m.thumbnail_url,
          'is_published', m.is_published,
          'is_free', m.is_free
        )
        order by m.order_index, m.id
      )
      from public.modules m
      where m.is_published = true
    ), '[]'::jsonb),
    'lessons', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', l.id,
          'module_id', l.module_id,
          'type', l.type,
          'title', l.title,
          'slug', l.slug,
          'description', l.description,
          'takeaway', l.takeaway,
          'action_items', l.action_items,
          'thumbnail_url', l.thumbnail_url,
          'order_index', l.order_index,
          'is_published', l.is_published
        )
        order by l.module_id, l.order_index
      )
      from public.lessons l
      where l.is_published = true
    ), '[]'::jsonb),
    'exams', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', e.id,
          'module_id', e.module_id,
          'title', e.title,
          'description', e.description,
          'passing_score', e.passing_score,
          'is_published', e.is_published
        )
        order by e.module_id
      )
      from public.exams e
      where e.is_published = true
    ), '[]'::jsonb),
    'onboarding', (
      select jsonb_build_object(
        'id', o.id,
        'student_id', o.student_id,
        'experience_level', o.experience_level,
        'primary_market', o.primary_market,
        'main_challenge', o.main_challenge,
        'goal_90_days', o.goal_90_days,
        'weekly_time_commitment', o.weekly_time_commitment,
        'mentorship_interest', o.mentorship_interest,
        'confidence_score', o.confidence_score
      )
      from public.student_onboarding_responses o
      where o.student_id = v_student_id
      limit 1
    ),
    'passedExamIds', coalesce((
      select jsonb_agg(distinct r.exam_id)
      from public.exam_results r
      where r.student_id = v_student_id
        and r.passed = true
    ), '[]'::jsonb),
    'progress', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'lesson_id', p.lesson_id,
          'watched', p.watched,
          'watched_at', p.watched_at
        )
        order by p.lesson_id
      )
      from public.progress p
      where p.student_id = v_student_id
    ), '[]'::jsonb)
  );
end;
$$;


--
-- Name: FUNCTION get_my_dashboard_read_model(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_my_dashboard_read_model() IS 'Narrow RLS-backed dashboard payload for the current auth.uid(); no caller-supplied student id.';


--
-- Name: get_my_notification_shell(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_notification_shell() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare
  v_student_id uuid := public.current_chat_student_id();
  v_mentor_id uuid := public.current_chat_mentor_id();
  v_is_admin boolean;
  v_result jsonb;
begin
  if v_student_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  select s.access_level = 3 into v_is_admin from public.students s where s.id = v_student_id;
  with my_threads as materialized (
    select cp.thread_id, cp.role
    from public.conversation_participants cp
    join public.chat_principals p on p.id = cp.principal_id
    join public.conversation_threads t on t.id = cp.thread_id
    where p.kind = 'human' and p.student_id = v_student_id
      and cp.active and cp.revoked_at is null and t.source_type = 'mentor_chat'
      and public.chat_participant_role(t.id) = cp.role
  ), own_events as materialized (
    select nr.id, nr.created_at, nr.read_at, ne.type, ne.title, ne.body, ne.href,
      ne.target_table, ne.metadata,
      case
        when ne.target_table = 'conversation_threads'
          and ne.target_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then ne.target_id::uuid
        when (ne.metadata ->> 'thread_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then (ne.metadata ->> 'thread_id')::uuid
        when ne.target_table = 'conversation_messages'
          and ne.target_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then (select m.thread_id from public.conversation_messages m where m.id = ne.target_id::uuid)
        else null
      end thread_id
    from public.notification_recipients nr
    join public.notification_events ne on ne.id = nr.event_id
    where nr.student_id = v_student_id and nr.archived_at is null
  ), classified as materialized (
    select e.*, case when t.id is not null and t.source_type <> 'mentor_chat' then false
      else e.type in ('mentor_new_message', 'mentor_reply')
        or e.target_table in ('conversation_threads', 'conversation_messages', 'conversation_events')
        or e.metadata ? 'thread_id' end is_chat
    from own_events e left join public.conversation_threads t on t.id = e.thread_id
  ), visible as materialized (
    select e.id, e.created_at, e.read_at, e.title, e.body, e.href
    from classified e left join my_threads mt on mt.thread_id = e.thread_id
    where case when e.is_chat then mt.thread_id is not null
      and (e.type <> 'mentor_new_message' or mt.role = 'mentor')
      and (e.type <> 'mentor_reply' or mt.role = 'student')
    else v_is_admin or e.type in ('mentor_reply', 'weekly_update.published',
      'live_session.scheduled', 'live_session.cancelled',
      'subscription.bonus_expired', 'subscription.payment_failed') end
  )
  select jsonb_build_object(
    'studentId', v_student_id,
    'unreadCount', (select count(*) from visible where read_at is null),
    'notifications', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'created_at', r.created_at, 'read_at', r.read_at,
        'event', jsonb_build_object('title', r.title, 'body', r.body, 'href', r.href)
      ) order by r.created_at desc, r.id desc)
      from (select * from visible order by created_at desc, id desc limit 8) r
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$_$;


--
-- Name: FUNCTION get_my_notification_shell(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_my_notification_shell() IS 'Own delivery count and latest eight notifications, explicitly authorized against live identity and current chat participation once per batch.';


--
-- Name: guard_chat_notification_recipient_identity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_chat_notification_recipient_identity() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if auth.uid() is not null and (public.is_chat_notification_event(old.event_id)
      or public.is_chat_notification_event(new.event_id))
    and (new.id is distinct from old.id or new.event_id is distinct from old.event_id
      or new.student_id is distinct from old.student_id or new.created_at is distinct from old.created_at) then
    raise exception 'notification identity is immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;


--
-- Name: guard_legacy_chat_message_write(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_legacy_chat_message_write() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare v_thread public.conversation_threads%rowtype; v_role text;
begin
  perform 1 from public.chat_mentor_config where singleton for share;
  select * into v_thread from public.conversation_threads where id = new.thread_id for update;
  if v_thread.source_type <> 'mentor_chat' then return new; end if;
  v_role := public.legacy_chat_thread_role(new.thread_id);
  if v_role is null or new.sender_student_id is distinct from public.legacy_chat_current_student_id()
     or (v_role = 'student' and (new.sender_role <> 'student' or new.is_internal))
     or (v_role = 'mentor' and new.sender_role not in ('mentor', 'admin')) then
    raise exception 'chat access denied' using errcode = '42501';
  end if;
  new.body := regexp_replace(replace(coalesce(new.body, ''), E'\r\n', E'\n'),
    '^[[:space:]]+|[[:space:]]+$', '', 'g');
  if char_length(new.body) not between 1 and 5000 then
    raise exception 'message must contain between 1 and 5000 characters' using errcode = '22023';
  end if;
  new.created_at := now();
  new.status := 'sent';
  new.body_format := 'plain';
  new.deleted_at := null;
  new.edited_at := null;
  new.parent_message_id := null;
  new.metadata := '{}'::jsonb;
  return new;
end;
$_$;


--
-- Name: guard_legacy_chat_thread_write(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_legacy_chat_thread_write() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_student uuid := public.legacy_chat_current_student_id(); v_mentor uuid;
begin
  if new.source_type <> 'mentor_chat' and (tg_op = 'INSERT' or old.source_type <> 'mentor_chat') then
    return new;
  end if;
  perform 1 from public.chat_mentor_config where singleton for share;
  v_mentor := public.legacy_chat_mentor_id();
  -- Trusted service maintenance is separately protected by connection grants.
  if auth.uid() is null then return new; end if;
  if v_student is null or v_mentor is null then
    raise exception 'chat mentor unavailable' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    if new.student_id <> v_student or v_student = v_mentor or new.source_id is not null
       or new.status <> 'open' or new.priority <> 'normal'
       or new.unread_for_student_count <> 0 or new.unread_for_mentor_count <> 0 then
      raise exception 'chat access denied' using errcode = '42501';
    end if;
  else
    if new.id is distinct from old.id or new.student_id is distinct from old.student_id
      or new.source_type is distinct from old.source_type or new.source_id is distinct from old.source_id then
      raise exception 'conversation identity is immutable' using errcode = '42501';
    end if;
    -- Trigger-generated counters run under the original actor's JWT; permit
    -- them only from a nested trigger. Direct student thread updates stay denied
    -- by RLS. The configured mentor retains the current status UI.
    if v_student <> v_mentor and pg_trigger_depth() < 2 and (
      new.unread_for_student_count <> 0
      or (to_jsonb(new) - array['unread_for_student_count', 'updated_at'])
        is distinct from (to_jsonb(old) - array['unread_for_student_count', 'updated_at'])
    ) then
      raise exception 'mentor chat access required' using errcode = '42501';
    end if;
  end if;
  new.assigned_to_student_id := v_mentor;
  return new;
end;
$$;


--
-- Name: guard_market_update_pin_position(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_market_update_pin_position() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
begin
  if new.is_published is true
    and coalesce(new.actuality_status, 'current') <> 'archive'
    and new.update_structure->>'pinned_rank' in ('1', '2')
    and (
      new.update_structure->>'pin_until' is null
      or (new.update_structure->>'pin_until')::timestamptz > now()
    )
  then
    perform pg_advisory_xact_lock(hashtext('weekly_updates_structured_pin_positions'));
    if exists (
      select 1 from public.weekly_updates existing
      where existing.id <> new.id
        and existing.is_published is true
        and coalesce(existing.actuality_status, 'current') <> 'archive'
        and existing.update_structure->>'pinned_rank' = new.update_structure->>'pinned_rank'
        and (
          existing.update_structure->>'pin_until' is null
          or (existing.update_structure->>'pin_until')::timestamptz > now()
        )
    ) then
      raise exception using errcode = '23505', message = 'Deze pinpositie is al in gebruik. Kies de andere positie of maak de bestaande positie vrij.';
    end if;
  end if;
  return new;
end;
$$;


--
-- Name: guard_reaction_account(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_reaction_account() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  perform 1 from auth.users u join public.students s on s.auth_user_id = u.id
    where s.id = new.student_id for key share of u;
  if not found then raise exception 'Account no longer exists' using errcode = '42501'; end if;
  return new;
end;
$$;


--
-- Name: guard_student_identity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_student_identity() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if auth.uid() is null then return new; end if; -- migrations/service integrations
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id or new.auth_user_id is distinct from old.auth_user_id then
      raise exception 'Profile identity is immutable' using errcode = '42501';
    end if;
    if new.access_level is distinct from old.access_level and not public.is_platform_admin() then
      raise exception 'Cannot change own content access' using errcode = '42501';
    end if;
  elsif not public.is_platform_admin() and (new.auth_user_id <> auth.uid() or new.access_level > 1) then
    raise exception 'Cannot grant content access at registration' using errcode = '42501';
  end if;
  return new;
end;
$$;


--
-- Name: handle_conversation_message_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_conversation_message_insert() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_thread public.conversation_threads%rowtype;
  v_event_id uuid;
  v_recipient_id uuid;
  v_sender_name text;
begin
  select * into v_thread from public.conversation_threads where id = new.thread_id for update;
  if not found then return new; end if;
  if v_thread.source_type = 'mentor_chat' then
    if not new.is_internal then
      update public.conversation_threads
      set last_message_at = new.created_at,
          last_public_message_id = new.id,
          last_student_message_at = case when new.sender_role = 'student'
            then new.created_at else last_student_message_at end,
          last_mentor_message_at = case when new.sender_role = 'mentor'
            then new.created_at else last_mentor_message_at end,
          unread_for_mentor_count = unread_for_mentor_count + case when new.sender_role = 'student' then 1 else 0 end,
          unread_for_student_count = unread_for_student_count + case when new.sender_role = 'mentor' then 1 else 0 end,
          status = case when new.sender_role = 'student' then 'pending_mentor' else 'pending_student' end,
          first_response_at = case when new.sender_role = 'mentor'
            then coalesce(first_response_at, new.created_at) else first_response_at end,
          closed_at = null
      where id = new.thread_id;

      select p.student_id into v_recipient_id
      from public.conversation_participants cp
      join public.chat_principals p on p.id = cp.principal_id and p.kind = 'human'
      where cp.thread_id = new.thread_id and cp.active and cp.revoked_at is null
        and cp.role = case when new.sender_role = 'student' then 'mentor' else 'student' end
        and (cp.role <> 'mentor' or p.student_id = v_thread.assigned_to_student_id);
      if v_recipient_id is null then
        raise exception 'chat recipient unavailable' using errcode = '42501';
      end if;
      insert into public.notification_events(type, actor_student_id, target_table,
        target_id, title, body, href, metadata)
      values (
        case when new.sender_role = 'student' then 'mentor_new_message' else 'mentor_reply' end,
        new.sender_student_id, 'conversation_threads', new.thread_id::text,
        case when new.sender_role = 'student' then 'Nieuw chatbericht' else 'Je hebt een nieuw bericht' end,
        'Open je gesprek om het bericht te lezen.',
        case when new.sender_role = 'student' then '/mentor-inbox?thread=' || new.thread_id::text else '/mentor?mentor=' || v_thread.assigned_to_student_id::text end,
        jsonb_build_object('thread_id', new.thread_id, 'message_id', new.id, 'public_seq', new.public_seq)
      ) returning id into v_event_id;
      insert into public.notification_recipients(event_id, student_id)
      values (v_event_id, v_recipient_id);
    end if;
  else
    -- Preserve the pre-existing notification behavior for unrelated sources.
    if new.sender_role = 'student' then
      update public.conversation_threads
      set last_message_at = new.created_at, last_student_message_at = new.created_at,
          unread_for_mentor_count = unread_for_mentor_count + 1,
          status = case when status = 'closed' then 'open' else 'pending_mentor' end,
          closed_at = null where id = new.thread_id;
      select coalesce(name, email, 'Student') into v_sender_name
      from public.students where id = new.sender_student_id;
      insert into public.notification_events(type, actor_student_id, target_table,
        target_id, title, body, href, metadata)
      values ('mentor_new_message', new.sender_student_id, 'conversation_threads',
        new.thread_id::text, 'Nieuwe mentorvraag',
        left(coalesce(v_sender_name, 'Student') || ': ' || new.body, 240),
        '/admin/mentor-inbox?thread=' || new.thread_id::text,
        jsonb_build_object('thread_id', new.thread_id)) returning id into v_event_id;
      insert into public.notification_recipients(event_id, student_id)
      select v_event_id, s.id from public.students s where s.access_level = 3 on conflict do nothing;
    elsif new.sender_role in ('mentor', 'admin', 'ai') and not new.is_internal then
      update public.conversation_threads
      set last_message_at = new.created_at, last_mentor_message_at = new.created_at,
          unread_for_student_count = unread_for_student_count + 1,
          status = 'pending_student', first_response_at = coalesce(first_response_at, new.created_at),
          closed_at = null where id = new.thread_id;
      select nullif(btrim(name), '') into v_sender_name from public.students where id = new.sender_student_id;
      v_sender_name := case when new.sender_role = 'ai' then 'AI-assistent' else coalesce(v_sender_name, 'Je mentor') end;
      insert into public.notification_events(type, actor_student_id, target_table,
        target_id, title, body, href, metadata)
      values ('mentor_reply', new.sender_student_id, 'conversation_threads', new.thread_id::text,
        v_sender_name || ' heeft geantwoord', left(new.body, 240), '/mentor',
        jsonb_build_object('thread_id', new.thread_id)) returning id into v_event_id;
      insert into public.notification_recipients(event_id, student_id)
      values (v_event_id, v_thread.student_id) on conflict do nothing;
    else
      update public.conversation_threads set last_message_at = new.created_at where id = new.thread_id;
    end if;
  end if;
  insert into public.conversation_events(thread_id, actor_student_id, event_type, metadata)
  values (new.thread_id, new.sender_student_id, 'message_created',
    jsonb_build_object('message_id', new.id, 'sender_role', new.sender_role, 'is_internal', new.is_internal));
  return new;
end;
$$;


--
-- Name: handle_new_auth_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_auth_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.students (email, auth_user_id, access_level)
  VALUES (NEW.email, NEW.id, 1)
  ON CONFLICT (email) DO UPDATE
    SET auth_user_id = EXCLUDED.auth_user_id;
  RETURN NEW;
END;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.students (
    email,
    auth_user_id,
    access_level,
    name,
    phone
  )
  VALUES (
    NEW.email,
    NEW.id,
    1,
    COALESCE(NEW.raw_user_meta_data->>'name', 'Onbekend'),
    NULLIF(NEW.raw_user_meta_data->>'phone', '')
  )
  ON CONFLICT (auth_user_id) DO NOTHING;

  RETURN NEW;
END;
$$;


--
-- Name: has_active_entitlement(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_active_entitlement(p_entitlement_key text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  select
    public.is_platform_admin()
    or exists (
      select 1
      from public.student_entitlements entitlement
      join public.students student on student.id = entitlement.student_id
      where student.auth_user_id = auth.uid()
        and entitlement.entitlement_key = p_entitlement_key
        and entitlement.revoked_at is null
        and entitlement.starts_at <= now()
        and (entitlement.ends_at is null or entitlement.ends_at > now())
    );
$$;


--
-- Name: has_live_learning_account(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_live_learning_account() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 select exists(select 1 from public.students s join auth.users u on u.id=s.auth_user_id where u.id=auth.uid());
$$;


--
-- Name: video_positions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.video_positions (
    id bigint NOT NULL,
    student_id uuid NOT NULL,
    lesson_id bigint,
    weekly_update_id bigint,
    video_version text NOT NULL,
    position_seconds double precision NOT NULL,
    duration_seconds double precision NOT NULL,
    max_position_seconds double precision NOT NULL,
    completed boolean DEFAULT false NOT NULL,
    revision bigint NOT NULL,
    session_id uuid NOT NULL,
    client_sequence bigint NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT video_positions_check CHECK (((max_position_seconds >= (0)::double precision) AND (max_position_seconds <= duration_seconds))),
    CONSTRAINT video_positions_check1 CHECK ((num_nonnulls(lesson_id, weekly_update_id) = 1)),
    CONSTRAINT video_positions_check2 CHECK ((position_seconds <= duration_seconds)),
    CONSTRAINT video_positions_check3 CHECK ((completed = ((max_position_seconds / duration_seconds) >= (0.95)::double precision))),
    CONSTRAINT video_positions_client_sequence_check CHECK ((client_sequence > 0)),
    CONSTRAINT video_positions_duration_seconds_check CHECK (((duration_seconds > (0)::double precision) AND (duration_seconds <= (604800)::double precision))),
    CONSTRAINT video_positions_position_seconds_check CHECK (((position_seconds >= (0)::double precision) AND (position_seconds < 'Infinity'::double precision))),
    CONSTRAINT video_positions_revision_check CHECK ((revision > 0)),
    CONSTRAINT video_positions_video_version_check CHECK ((video_version ~ '^mux:[A-Za-z0-9_-]+$'::text))
);


--
-- Name: htp_position_json(public.video_positions, uuid, text, double precision); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.htp_position_json(p_row public.video_positions, p_student uuid, p_version text, p_duration double precision) RETURNS jsonb
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
 select jsonb_build_object('viewerId',p_student,'videoVersion',p_version,'revision',coalesce(p_row.revision,0),
 'positionSeconds',case when p_row.video_version=p_version then p_row.position_seconds else 0 end,
 'durationSeconds',case when p_row.video_version=p_version then p_row.duration_seconds else coalesce(p_duration,0) end,
 'maxPositionSeconds',case when p_row.video_version=p_version then p_row.max_position_seconds else 0 end,
 'completed',case when p_row.video_version=p_version then p_row.completed else false end);
$$;


--
-- Name: htp_video_access(text, bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.htp_video_access(p_kind text, p_content_id bigint) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_student uuid; v_previous bigint;
begin
  select s.id into v_student from public.students s where s.auth_user_id = auth.uid();
  if v_student is null or p_kind is null or p_kind not in ('lesson','update') or p_content_id is null or p_content_id <= 0 then return false; end if;
  if not exists(select 1 from auth.users u where u.id=auth.uid()) then return false; end if;
  if p_kind = 'update' then return public.can_read_market_post(p_content_id); end if;
  if p_kind <> 'lesson' or not public.can_read_academy_lesson(p_content_id) then return false; end if;
  if exists(select 1 from public.progress p where p.student_id=v_student and p.lesson_id=p_content_id and p.watched) then return true; end if;
  select l.id into v_previous from public.lessons l join public.lessons current on current.id=p_content_id
    where l.module_id=current.module_id and l.is_published and (l.order_index,l.id)<(current.order_index,current.id)
    order by l.order_index desc,l.id desc limit 1;
  return v_previous is null or exists(select 1 from public.progress p where p.student_id=v_student and p.lesson_id=v_previous and p.watched);
end; $$;


--
-- Name: htp_video_version(text, bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.htp_video_version(p_kind text, p_content_id bigint) RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare v_playback text;
begin
  if not public.htp_video_access(p_kind,p_content_id) then return null; end if;
  if p_kind='lesson' then
    select l.mux_playback_id into v_playback from public.lessons l where l.id=p_content_id and l.video_provider='mux';
  else
    select w.mux_playback_id into v_playback from public.weekly_updates w where w.id=p_content_id and w.video_provider='mux' and w.content_format='video' and coalesce(w.content_kind,'video')<>'article';
  end if;
  if v_playback is null or v_playback !~ '^[A-Za-z0-9_-]+$' then return null; end if;
  -- A Mux playback ID identifies fixed media; this is never a signed playback token.
  return 'mux:'||v_playback;
end; $_$;


--
-- Name: is_available_chat_mentor(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_available_chat_mentor(p_student_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (
    select 1 from public.chat_mentor_config c
    join public.students s on s.id = p_student_id
    join auth.users u on u.id = s.auth_user_id
    where c.singleton and c.enabled and u.deleted_at is null
      and (u.banned_until is null or u.banned_until <= now())
      and (c.mentor_student_id = s.id or exists (
        select 1 from public.user_roles r where r.student_id = s.id and r.role = 'mentor'
      ))
  );
$$;


--
-- Name: is_chat_notification_event(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_chat_notification_event(p_event_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select coalesce((
    select case when exists (
      select 1 from public.conversation_threads t
      where t.id = public.chat_notification_thread_id(ne.id) and t.source_type <> 'mentor_chat'
    ) then false else ne.type in ('mentor_new_message', 'mentor_reply')
      or ne.target_table in ('conversation_threads', 'conversation_messages', 'conversation_events')
      or ne.metadata ? 'thread_id' end
    from public.notification_events ne where ne.id = p_event_id
  ), false);
$$;


--
-- Name: is_pdf_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_pdf_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 select public.is_platform_admin() and exists(select 1 from auth.users where id=auth.uid());
$$;


--
-- Name: is_platform_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_platform_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.students
    where auth_user_id = auth.uid()
      and access_level = 3
  );
$$;


--
-- Name: FUNCTION is_platform_admin(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.is_platform_admin() IS 'True when the current user is a platform admin (access_level 3). Uses SECURITY DEFINER to avoid RLS recursion on students.';


--
-- Name: legacy_can_access_chat_notification_recipient(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.legacy_can_access_chat_notification_recipient(p_event_id uuid, p_student_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select case when public.legacy_is_chat_notification(p_event_id) then
    p_student_id = public.legacy_chat_current_student_id() and public.can_read_notification_event(p_event_id)
  else public.is_platform_admin() or (exists (select 1 from public.students s
    where s.id = p_student_id and s.auth_user_id = auth.uid()) and public.can_read_notification_event(p_event_id)) end;
$$;


--
-- Name: legacy_chat_current_student_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.legacy_chat_current_student_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select s.id from public.students s join auth.users u on u.id = s.auth_user_id
  where s.auth_user_id = auth.uid() and u.deleted_at is null
    and (u.banned_until is null or u.banned_until <= now()) limit 1;
$$;


--
-- Name: legacy_chat_mentor_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.legacy_chat_mentor_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select c.mentor_student_id from public.chat_mentor_config c
  join public.students s on s.id = c.mentor_student_id
  join auth.users u on u.id = s.auth_user_id
  where c.singleton and c.enabled and u.deleted_at is null
    and (u.banned_until is null or u.banned_until <= now());
$$;


--
-- Name: legacy_chat_notification_thread_id(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.legacy_chat_notification_thread_id(p_event_id uuid) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $_$
  select case
    when ne.target_table = 'conversation_threads'
      and ne.target_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then ne.target_id::uuid
    when (ne.metadata ->> 'thread_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (ne.metadata ->> 'thread_id')::uuid
    when ne.target_table = 'conversation_messages'
      and ne.target_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (select m.thread_id from public.conversation_messages m where m.id = ne.target_id::uuid)
    else null end from public.notification_events ne where ne.id = p_event_id;
$_$;


--
-- Name: legacy_chat_thread_role(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.legacy_chat_thread_role(p_thread_id uuid) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select public.chat_participant_role(p_thread_id);
$$;


--
-- Name: legacy_is_chat_notification(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.legacy_is_chat_notification(p_event_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select coalesce((select case when exists (
    select 1 from public.conversation_threads t
    where t.id = public.legacy_chat_notification_thread_id(ne.id) and t.source_type <> 'mentor_chat'
  ) then false else ne.type in ('mentor_new_message', 'mentor_reply')
    or ne.target_table in ('conversation_threads', 'conversation_messages', 'conversation_events')
    or ne.metadata ? 'thread_id' end from public.notification_events ne where ne.id = p_event_id), false);
$$;


--
-- Name: list_chat_presence(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.list_chat_presence(p_student_ids uuid[]) RETURNS TABLE(student_id uuid, last_seen_at timestamp with time zone, server_now timestamp with time zone)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if public.current_chat_student_id() is null then raise exception 'authentication required' using errcode='42501'; end if;
  if coalesce(cardinality(p_student_ids),0)>200 then raise exception 'too many presence IDs' using errcode='22023'; end if;
  return query select ps.student_id,max(ps.last_seen_at),statement_timestamp()
  from public.chat_presence_sessions ps where ps.student_id=any(coalesce(p_student_ids,'{}'::uuid[]))
    and ps.last_seen_at>statement_timestamp()-interval '65 seconds'
    and public.can_read_chat_profile(ps.student_id)
  group by ps.student_id;
end;
$$;


--
-- Name: list_visible_pdf_documents(text, bigint[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.list_visible_pdf_documents(p_kind text, p_parent_ids bigint[]) RETURNS TABLE(id uuid, title text, description text, page_count integer, version uuid, shelf text, sort_order integer, has_cover boolean, reading_available boolean, module_id bigint, weekly_update_id bigint)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
 if p_kind not in ('update','module') or cardinality(p_parent_ids) not between 1 and 100 then raise invalid_parameter_value using message='Invalid parents'; end if;
 return query select d.id,d.title,d.description,d.page_count,d.version,d.shelf,d.sort_order,d.cover_path is not null,d.accessible_verified,d.module_id,d.weekly_update_id
 from public.pdf_documents d where
 ((p_kind='update' and d.weekly_update_id=any(p_parent_ids)) or (p_kind='module' and d.module_id=any(p_parent_ids)))
 and d.state='ready' and d.storage_ready and public.can_read_pdf(d.id)
 order by d.sort_order,d.id;
end;$$;


--
-- Name: mark_chat_read(uuid, bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_chat_read(p_thread_id uuid, p_seen_seq bigint) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare
  v_role text;
  v_thread public.conversation_threads%rowtype;
  v_read_seq bigint;
begin
  if public.current_chat_student_id() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  perform 1 from public.chat_mentor_config where singleton for share;
  select * into v_thread from public.conversation_threads where id = p_thread_id for update;
  v_role := public.chat_participant_role(p_thread_id);
  if v_role is null then raise exception 'chat access denied' using errcode = '42501'; end if;
  if p_seen_seq is null or p_seen_seq < 0 or p_seen_seq > v_thread.last_public_message_seq
     or (p_seen_seq > 0 and not exists (
       select 1 from public.conversation_messages m where m.thread_id = p_thread_id
         and m.public_seq = p_seen_seq and not m.is_internal and m.deleted_at is null
     )) then
    raise exception 'invalid public read boundary' using errcode = '22023';
  end if;
  update public.conversation_participants cp
  set last_read_public_seq = greatest(cp.last_read_public_seq, p_seen_seq)
  from public.chat_principals p
  where p.id = cp.principal_id and p.student_id = public.current_chat_student_id()
    and cp.thread_id = p_thread_id and cp.active and cp.role = v_role
  returning cp.last_read_public_seq into v_read_seq;
  if v_role = 'student' then
    update public.conversation_threads t
    set unread_for_student_count = (
      select count(*) from public.conversation_messages m
      where m.thread_id = t.id and m.public_seq > v_read_seq
        and m.sender_role <> 'student' and not m.is_internal and m.deleted_at is null
    ) where t.id = p_thread_id;
  else
    update public.conversation_threads t
    set unread_for_mentor_count = (
      select count(*) from public.conversation_messages m
      where m.thread_id = t.id and m.public_seq > v_read_seq
        and m.sender_role = 'student' and not m.is_internal and m.deleted_at is null
    ) where t.id = p_thread_id;
  end if;
  -- Mark only corresponding delivered events; clearing notification history
  -- elsewhere never moves the conversation's cursor.
  update public.notification_recipients nr set read_at = coalesce(nr.read_at, now())
  from public.notification_events ne
  where ne.id = nr.event_id and nr.student_id = public.current_chat_student_id()
    and public.chat_notification_thread_id(ne.id) = p_thread_id
    and (ne.metadata ->> 'public_seq') ~ '^[0-9]+$'
    and (ne.metadata ->> 'public_seq')::numeric <= v_read_seq
    and public.can_read_notification_event(ne.id);
  return jsonb_build_object('success', true);
end;
$_$;


--
-- Name: mark_deleted_student_avatar(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_deleted_student_avatar() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  update public.avatar_objects set state = 'garbage' where student_id = old.id;
  return old;
end;
$$;


--
-- Name: mark_mentor_conversation_read(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_mentor_conversation_read(p_thread_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  raise exception 'use mark_chat_read with a visible public sequence' using errcode = '42501';
end;
$$;


--
-- Name: mark_student_conversation_read(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_student_conversation_read(p_thread_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  raise exception 'use mark_chat_read with a visible public sequence' using errcode = '42501';
end;
$$;


--
-- Name: market_post_author(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.market_post_author(p_post_id bigint) RETURNS TABLE(name text, object_path text, student_id uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if not public.can_read_market_post(p_post_id) then
    raise exception 'Post access denied' using errcode = '42501';
  end if;
  return query
    select case when w.content_format <> 'video' or w.content_kind = 'article'
      then coalesce(nullif(btrim(w.published_by_display_name), ''), nullif(btrim(s.name), ''), w.author_name, 'Auteur')
      else coalesce(nullif(btrim(s.name), ''), w.author_name, 'Auteur') end,
      a.object_path, s.id
    from public.weekly_updates w
    left join public.students s on s.id = case when w.content_format <> 'video' or w.content_kind = 'article'
      then coalesce(w.published_by_student_id, w.mentor_student_id, w.created_by_student_id)
      else coalesce(w.mentor_student_id, w.created_by_student_id) end
    left join public.student_avatars a on a.student_id = s.id
    where w.id = p_post_id;
end;
$$;


--
-- Name: market_post_reaction_state(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.market_post_reaction_state(p_post_id bigint) RETURNS TABLE(total bigint, active boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_student uuid;
begin
  if not public.can_read_market_post(p_post_id) then raise exception 'Post access denied' using errcode = '42501'; end if;
  select id into v_student from public.students where auth_user_id = auth.uid();
  return query select count(*), coalesce(bool_or(r.student_id = v_student), false)
    from public.market_post_reactions r where r.post_id = p_post_id;
end;
$$;


--
-- Name: mentor_chat_thread_projection(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mentor_chat_thread_projection(p_thread_id uuid) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select to_jsonb(t) || jsonb_build_object(
    'student', jsonb_build_object('id', s.id, 'name', s.name),
    'lastMessage', (
      select to_jsonb(m) from public.conversation_messages m
      where m.thread_id = t.id and not m.is_internal and m.deleted_at is null
      order by m.public_seq desc limit 1
    )
  )
  from public.conversation_threads t join public.students s on s.id = t.student_id
  where t.id = p_thread_id and public.chat_participant_role(t.id) = 'mentor';
$$;


--
-- Name: normalize_lessons_admin(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.normalize_lessons_admin(target_module_id bigint) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_lesson_ids bigint[];
begin
  if not public.is_platform_admin() then
    raise exception 'Only platform admins can normalize lessons.' using errcode = '42501';
  end if;

  if target_module_id is null then
    raise exception 'Module id is required.';
  end if;

  select coalesce(array_agg(id order by order_index, id), array[]::bigint[])
  into v_lesson_ids
  from public.lessons
  where module_id = target_module_id;

  if cardinality(v_lesson_ids) = 0 then
    return;
  end if;

  perform public.reorder_lessons_admin(target_module_id, v_lesson_ids);
end;
$$;


--
-- Name: normalize_modules_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.normalize_modules_admin() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_module_ids bigint[];
begin
  if not public.is_platform_admin() then
    raise exception 'Only platform admins can normalize modules.' using errcode = '42501';
  end if;

  select coalesce(array_agg(id order by order_index, id), array[]::bigint[])
  into v_module_ids
  from public.modules;

  if cardinality(v_module_ids) = 0 then
    return;
  end if;

  perform public.reorder_modules_admin(v_module_ids);
end;
$$;


--
-- Name: notify_clickup_on_lead(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_clickup_on_lead() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  IF NEW.access_level = 1 THEN
    PERFORM net.http_post(
      url := 'https://peak-automations.app.n8n.cloud/webhook/htp-lead-to-clickup',
      body := jsonb_build_object(
        'record', jsonb_build_object(
          'id', NEW.id,
          'name', NEW.name,
          'email', NEW.email,
          'phone', NEW.phone,
          'created_at', NEW.created_at
        )
      ),
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: notify_student_intake_completed(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_student_intake_completed(p_student_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_student public.students%rowtype;
  v_response public.student_onboarding_responses%rowtype;
  v_event_id uuid;
  v_recipient_count integer := 0;
begin
  select *
  into v_student
  from public.students
  where id = p_student_id;

  if not found then
    return jsonb_build_object('notified', 0, 'skipped', true, 'reason', 'student_not_found');
  end if;

  if not (
    public.is_platform_admin()
    or v_student.auth_user_id = auth.uid()
  ) then
    raise exception 'Not allowed to notify intake completion for this student'
      using errcode = '42501';
  end if;

  select *
  into v_response
  from public.student_onboarding_responses
  where student_id = p_student_id;

  if not found
    or v_response.completed_at is null
    or nullif(trim(coalesce(v_response.experience_level, '')), '') is null
    or nullif(trim(coalesce(v_response.primary_market, '')), '') is null
    or nullif(trim(coalesce(v_response.main_challenge, '')), '') is null
    or nullif(trim(coalesce(v_response.goal_90_days, '')), '') is null
    or nullif(trim(coalesce(v_response.weekly_time_commitment, '')), '') is null
    or nullif(trim(coalesce(v_response.mentorship_interest, '')), '') is null
    or v_response.confidence_score is null
    or v_response.confidence_score < 1
    or v_response.confidence_score > 5
  then
    return jsonb_build_object('notified', 0, 'skipped', true, 'reason', 'intake_incomplete');
  end if;

  select id
  into v_event_id
  from public.notification_events
  where type = 'student_intake.completed'
    and target_table = 'students'
    and target_id = p_student_id::text
  limit 1;

  if v_event_id is null then
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
      'student_intake.completed',
      p_student_id,
      'students',
      p_student_id::text,
      'Nieuwe intake ingevuld',
      coalesce(nullif(trim(v_student.name), ''), v_student.email) || ' heeft de intake afgerond.',
      '/admin/students/' || p_student_id::text,
      jsonb_build_object(
        'student_id', p_student_id,
        'student_email', v_student.email,
        'access_level', v_student.access_level,
        'completed_at', v_response.completed_at,
        'experience_level', v_response.experience_level,
        'primary_market', v_response.primary_market,
        'weekly_time_commitment', v_response.weekly_time_commitment,
        'mentorship_interest', v_response.mentorship_interest,
        'confidence_score', v_response.confidence_score
      )
    )
    on conflict (type, target_table, target_id)
      where type = 'student_intake.completed'
        and target_table = 'students'
    do nothing
    returning id into v_event_id;

    if v_event_id is null then
      select id
      into v_event_id
      from public.notification_events
      where type = 'student_intake.completed'
        and target_table = 'students'
        and target_id = p_student_id::text
      limit 1;
    end if;
  end if;

  if v_event_id is null then
    return jsonb_build_object('notified', 0, 'skipped', true, 'reason', 'event_not_created');
  end if;

  insert into public.notification_recipients (event_id, student_id)
  select v_event_id, s.id
  from public.students s
  where s.access_level = 3
    and s.id <> p_student_id
  on conflict (event_id, student_id) do nothing;

  get diagnostics v_recipient_count = row_count;

  return jsonb_build_object(
    'notified', v_recipient_count,
    'skipped', v_recipient_count = 0,
    'event_id', v_event_id
  );
end;
$$;


--
-- Name: open_chat_thread(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.open_chat_thread(p_mentor_student_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_student uuid := public.current_chat_student_id();
  v_thread public.conversation_threads%rowtype; v_created boolean := false;
begin
  if v_student is null then raise exception 'authentication required' using errcode = '42501'; end if;
  perform 1 from public.chat_mentor_config where singleton for share;
  if v_student = p_mentor_student_id or not public.is_available_chat_mentor(p_mentor_student_id) then
    raise exception 'chat mentor unavailable' using errcode = '42501';
  end if;
  insert into public.conversation_threads(student_id, assigned_to_student_id, source_type, subject)
  select v_student, s.id, 'mentor_chat', 'Gesprek met ' || coalesce(nullif(btrim(s.name), ''), 'je mentor')
  from public.students s where s.id = p_mentor_student_id
  on conflict(student_id, assigned_to_student_id) where source_type = 'mentor_chat' and source_id is null do nothing
  returning * into v_thread;
  v_created := found;
  if not v_created then
    select * into v_thread from public.conversation_threads
    where student_id = v_student and assigned_to_student_id = p_mentor_student_id
      and source_type = 'mentor_chat' and source_id is null for update;
  else
    insert into public.chat_principals(kind, student_id, display_name)
    select 'human', s.id, coalesce(nullif(btrim(s.name), ''), 'Platformlid')
    from public.students s where s.id in (v_student, p_mentor_student_id)
    on conflict(student_id) where kind = 'human' do nothing;
    insert into public.conversation_participants(thread_id, principal_id, role, active)
    select v_thread.id, p.id, case when p.student_id = v_student then 'student' else 'mentor' end, true
    from public.chat_principals p where p.kind = 'human' and p.student_id in (v_student, p_mentor_student_id);
  end if;
  -- A revoked participant never regains access through an open/retry request.
  if public.chat_participant_role(v_thread.id) is distinct from 'student' then
    raise exception 'chat access denied' using errcode = '42501';
  end if;
  return jsonb_build_object('threadId', v_thread.id);
end;
$$;


--
-- Name: prepare_chat_email_send(uuid, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prepare_chat_email_send(p_id uuid, p_lease uuid, p_payload jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_job public.chat_email_outbox; v_snapshot jsonb;
begin
  -- Match send/rotation lock order: config, then thread/job. Never hold an
  -- outbox row while waiting on a mentor reconfiguration's exclusive config lock.
  perform 1 from public.chat_mentor_config where singleton for share;
  select * into v_job from public.chat_email_outbox where id=p_id and status='leased' and lease_token=p_lease and lease_until>now() for update;
  if not found then return null; end if;
  v_snapshot:=public.chat_email_recipient_snapshot(p_id);
  if not coalesce((v_snapshot->>'allowed')::boolean,false) then
    update public.chat_email_outbox set status='cancelled',last_error=v_snapshot->>'reason',lease_token=null,lease_until=null where id=p_id;
    return null;
  end if;
  if v_job.first_attempt_at is not null and v_job.first_attempt_at<=now()-interval '23 hours' then
    update public.chat_email_outbox set status='needs_review',last_error='idempotency_window_elapsed',lease_token=null,lease_until=null where id=p_id;
    return null;
  end if;
  if lower(coalesce(coalesce(v_job.payload,p_payload)->>'to',''))<>v_snapshot->>'email' then
    update public.chat_email_outbox set status='cancelled',last_error='email_changed',lease_token=null,lease_until=null where id=p_id;
    return null;
  end if;
  if v_job.payload is null and (p_payload is null or jsonb_typeof(p_payload) is distinct from 'object' or p_payload->>'subject' is distinct from 'Je hebt een ongelezen chatbericht'
    or not coalesce(p_payload ?& array['from','to','replyTo','subject','html','text','tags'],false)) then
    raise exception 'invalid chat email payload' using errcode='22023'; end if;
  update public.chat_email_outbox set payload=coalesce(payload,p_payload),attempts=attempts+1,
    first_attempt_at=coalesce(first_attempt_at,now()),last_error=null where id=p_id returning * into v_job;
  return v_job.payload;
end;
$$;


--
-- Name: prepare_private_chat_message(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prepare_private_chat_message() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_thread public.conversation_threads%rowtype;
  v_role text;
  v_principal uuid;
  v_participant uuid;
begin
  select * into v_thread from public.conversation_threads where id = new.thread_id for update;
  if v_thread.source_type <> 'mentor_chat' then return new; end if;
  v_role := public.chat_participant_role(new.thread_id);
  if v_role is null or (new.is_internal and v_role <> 'mentor') then
    raise exception 'chat access denied' using errcode = '42501';
  end if;
  if new.client_message_id is null then
    raise exception 'client message ID required' using errcode = '22023';
  end if;
  select p.id, cp.id into v_principal, v_participant
  from public.chat_principals p
  join public.conversation_participants cp on cp.principal_id = p.id
  where p.kind = 'human' and p.student_id = public.current_chat_student_id()
    and cp.thread_id = new.thread_id and cp.role = v_role and cp.active and cp.revoked_at is null;
  new.sender_student_id := public.current_chat_student_id();
  new.sender_role := v_role;
  new.sender_principal_id := v_principal;
  new.sender_participant_id := v_participant;
  new.message_kind := case when new.is_internal then 'internal_note' else 'text' end;
  new.created_at := now();
  new.body_format := 'plain';
  new.status := 'sent';
  if new.is_internal then
    new.public_seq := null;
  else
    new.public_seq := v_thread.last_public_message_seq + 1;
    update public.conversation_threads
    set last_public_message_seq = new.public_seq where id = new.thread_id;
  end if;
  return new;
end;
$$;


--
-- Name: process_mux_caption_event(text, text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.process_mux_caption_event(p_event_id text, p_event_type text, p_asset_id text, p_track_id text, p_language_code text, p_error_code text DEFAULT NULL::text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: protect_exam_result_entitlement(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_exam_result_entitlement() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  v_module_id bigint;
  v_student_id uuid;
begin
  if auth.role() = 'service_role'
     or session_user in ('postgres', 'supabase_admin') then
    return new;
  end if;

  if auth.uid() is null then
    raise exception 'Authentication required to record an exam result'
      using errcode = '42501';
  end if;

  if public.is_platform_admin() then return new; end if;

  select s.id into v_student_id
  from public.students s where s.auth_user_id = auth.uid();
  select e.module_id into v_module_id
  from public.exams e where e.id = new.exam_id;
  if v_student_id is distinct from new.student_id
     or v_module_id is null
     or not public.can_start_academy_exam(v_module_id) then
    raise exception 'Exam result is outside the current Academy access'
      using errcode = '42501';
  end if;

  return new;
end;
$$;


--
-- Name: protect_student_privileged_fields(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_student_privileged_fields() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if auth.role() = 'service_role'
     or session_user in ('postgres', 'supabase_admin') then
    return new;
  end if;

  if auth.uid() is null then
    raise exception 'Authentication required to update a student'
      using errcode = '42501';
  end if;

  if public.is_platform_admin() then
    return new;
  end if;

  if (to_jsonb(new) - array['name', 'phone', 'last_seen', 'onboarding_skipped_at', 'updated_at'])
     is distinct from
     (to_jsonb(old) - array['name', 'phone', 'last_seen', 'onboarding_skipped_at', 'updated_at']) then
    raise exception 'Only profile fields can be changed by a student'
      using errcode = '42501';
  end if;

  return new;
end;
$$;


--
-- Name: purge_pdf_open_logs(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.purge_pdf_open_logs() RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare n bigint;begin
 delete from public.pdf_open_logs where opened_at<now()-interval '30 days';get diagnostics n=row_count;return n;
end;$$;


--
-- Name: read_pdf_position(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.read_pdf_position(p_document_id uuid, p_version uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare s uuid;d public.pdf_documents;r public.pdf_positions;
begin
 select id into s from public.students where auth_user_id=auth.uid();
 if s is null or not public.can_read_pdf(p_document_id) then raise insufficient_privilege;end if;
 select * into d from public.pdf_documents where id=p_document_id;
 if d.version is distinct from p_version then raise invalid_parameter_value;end if;
 select * into r from public.pdf_positions where student_id=s and document_id=p_document_id;
 return jsonb_build_object('viewerId',s,'version',d.version,'page',case when r.document_version=d.version then least(r.page,d.page_count) else 1 end,'revision',case when r.document_version=d.version then r.revision else 0 end);
end;$$;


--
-- Name: read_video_position(text, bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.read_video_position(p_kind text, p_content_id bigint) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_student uuid; v_version text; v_duration double precision; v_row public.video_positions;
begin
 select s.id into v_student from public.students s where s.auth_user_id=auth.uid();
 if v_student is null or not public.htp_video_access(p_kind,p_content_id) then raise exception 'Video access denied' using errcode='42501'; end if;
 v_version:=public.htp_video_version(p_kind,p_content_id);
 if v_version is null then raise exception 'Unsupported video' using errcode='22023'; end if;
 if p_kind='lesson' then select l.video_duration_seconds into v_duration from public.lessons l where l.id=p_content_id;
 else select w.video_duration_seconds into v_duration from public.weekly_updates w where w.id=p_content_id; end if;
 select * into v_row from public.video_positions p where p.student_id=v_student and
   (p_kind='lesson' and p.lesson_id=p_content_id or p_kind='update' and p.weekly_update_id=p_content_id);
 return public.htp_position_json(v_row,v_student,v_version,v_duration);
end; $$;


--
-- Name: record_pdf_open(uuid, uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_pdf_open(p_document_id uuid, p_version uuid, p_request_id uuid, p_student_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare d public.pdf_documents; v_auth uuid; v_claims text; v_sub text;
begin
 select auth_user_id into v_auth from public.students where id=p_student_id;
 if v_auth is null or p_request_id is null or not exists(select 1 from auth.users where id=v_auth) then raise exception 'PDF access denied' using errcode='42501'; end if;
 perform 1 from auth.users where id=v_auth for key share;
 if not found then raise exception 'PDF access denied' using errcode='42501'; end if;
 -- Only the trusted server can record a successful transformation. Reuse the live
 -- user gate instead of duplicating subscription/intake/legacy business rules.
 v_claims:=current_setting('request.jwt.claims',true);v_sub:=current_setting('request.jwt.claim.sub',true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',v_auth,'role','authenticated')::text,true);
 perform set_config('request.jwt.claim.sub',v_auth::text,true);
 if not public.can_read_pdf(p_document_id) then raise exception 'PDF access denied' using errcode='42501'; end if;
 select * into d from public.pdf_documents where id=p_document_id for share;
 if d.version is distinct from p_version then raise exception 'PDF version changed' using errcode='22023'; end if;
 perform set_config('request.jwt.claims',coalesce(v_claims,''),true);perform set_config('request.jwt.claim.sub',coalesce(v_sub,''),true);
 insert into public.pdf_open_logs(document_id,document_version,document_title,weekly_update_id,module_id,student_id,request_id)
 values(d.id,d.version,d.title,d.weekly_update_id,d.module_id,p_student_id,p_request_id)
 on conflict(student_id,document_id,request_id) do nothing;
end;$$;


--
-- Name: register_chat_attachment(uuid, uuid, uuid, text, text, text, integer, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.register_chat_attachment(p_auth_uid uuid, p_upload_intent uuid, p_thread_id uuid, p_object_path text, p_content_sha256 text, p_file_name text, p_width integer, p_height integer, p_size_bytes integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare v_student uuid; v_mentor uuid; v_attachment public.conversation_attachments%rowtype;
begin
  select s.id into v_student from public.students s join auth.users u on u.id = s.auth_user_id
  where u.id = p_auth_uid and u.deleted_at is null and (u.banned_until is null or u.banned_until <= now());
  if v_student is null then raise exception 'authentication required' using errcode = '42501'; end if;
  perform 1 from public.chat_mentor_config where singleton for share;
  v_mentor := public.current_chat_mentor_id();
  if v_mentor is null then raise exception 'chat mentor unavailable' using errcode = '55000'; end if;
  if p_upload_intent is null or p_object_path not like p_auth_uid::text || '/%'
     or p_content_sha256 is null or p_content_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid upload intent' using errcode = '22023';
  end if;
  if p_thread_id is null then
    if v_student = v_mentor then raise exception 'choose a student conversation' using errcode = '42501'; end if;
  else
    perform 1 from public.conversation_threads where id = p_thread_id for share;
    if public.chat_attachment_role_for_student(p_thread_id, v_student) is null then
      raise exception 'chat access denied' using errcode = '42501';
    end if;
  end if;
  -- Serialize all upload quotas for this actor, across tabs and draft intents.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('chat-upload:' || v_student::text, 0));
  select * into v_attachment from public.conversation_attachments
  where uploader_student_id = v_student and upload_intent = p_upload_intent
    and content_sha256 = p_content_sha256 and state in ('pending', 'ready', 'attached') for update;
  if found then
    if v_attachment.thread_id is distinct from p_thread_id and v_attachment.state <> 'attached' then
      raise exception 'upload intent belongs to another conversation' using errcode = '22023';
    end if;
    return jsonb_build_object('id', v_attachment.id, 'objectPath', v_attachment.object_path,
      'state', v_attachment.state, 'attachment', public.chat_attachment_projection(v_attachment.id));
  end if;
  if (select count(*) from public.conversation_attachments where uploader_student_id = v_student
      and upload_intent = p_upload_intent and state in ('pending', 'ready')) >= 3
    or (select count(*) from public.conversation_attachments where uploader_student_id = v_student
      and state in ('pending', 'ready')) >= 12
    or (select count(*) from public.conversation_attachments where uploader_student_id = v_student
      and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'attachment upload limit reached' using errcode = '53300';
  end if;
  insert into public.conversation_attachments(uploader_student_id, upload_intent, thread_id,
    object_path, content_sha256, file_name, width, height, size_bytes)
  values (v_student, p_upload_intent, p_thread_id, p_object_path, p_content_sha256,
    p_file_name, p_width, p_height, p_size_bytes) returning * into v_attachment;
  return jsonb_build_object('id', v_attachment.id, 'objectPath', v_attachment.object_path,
    'state', v_attachment.state, 'attachment', public.chat_attachment_projection(v_attachment.id));
end;
$_$;


--
-- Name: reject_admin_audit_log_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reject_admin_audit_log_mutation() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog'
    AS $$
begin
  raise exception 'admin_audit_log is append-only' using errcode = '42501';
end;
$$;


--
-- Name: reorder_lessons_admin(bigint, bigint[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reorder_lessons_admin(target_module_id bigint, lesson_ids bigint[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_expected_count integer;
  v_distinct_count integer;
begin
  if not public.is_platform_admin() then
    raise exception 'Only platform admins can reorder lessons.' using errcode = '42501';
  end if;

  if target_module_id is null then
    raise exception 'Module id is required.';
  end if;

  select count(*) into v_expected_count
  from public.lessons
  where module_id = target_module_id;

  select count(distinct lesson_id) into v_distinct_count
  from unnest(lesson_ids) as lesson_id;

  if coalesce(cardinality(lesson_ids), 0) <> v_expected_count
    or v_distinct_count <> v_expected_count
    or exists (
      select 1
      from unnest(lesson_ids) as submitted_id
      left join public.lessons l
        on l.id = submitted_id
       and l.module_id = target_module_id
      where l.id is null
    )
  then
    raise exception 'Lesson order payload must contain every lesson in the module exactly once.';
  end if;

  update public.lessons
  set order_index = -array_position(lesson_ids, id)::integer
  where module_id = target_module_id
    and id = any(lesson_ids);

  update public.lessons
  set order_index = array_position(lesson_ids, id)::integer
  where module_id = target_module_id
    and id = any(lesson_ids);
end;
$$;


--
-- Name: reorder_modules_admin(bigint[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reorder_modules_admin(module_ids bigint[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_expected_count integer;
  v_distinct_count integer;
begin
  if not public.is_platform_admin() then
    raise exception 'Only platform admins can reorder modules.' using errcode = '42501';
  end if;

  select count(*) into v_expected_count from public.modules;
  select count(distinct module_id) into v_distinct_count
  from unnest(module_ids) as module_id;

  if coalesce(cardinality(module_ids), 0) <> v_expected_count
    or v_distinct_count <> v_expected_count
    or exists (
      select 1
      from unnest(module_ids) as submitted_id
      left join public.modules m on m.id = submitted_id
      where m.id is null
    )
  then
    raise exception 'Module order payload must contain every module exactly once.';
  end if;

  update public.modules
  set order_index = -array_position(module_ids, id)::integer
  where id = any(module_ids);

  update public.modules
  set order_index = array_position(module_ids, id)::integer
  where id = any(module_ids);
end;
$$;


--
-- Name: save_academy_rubric(uuid, integer, text, text, text, integer, boolean, bigint[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_academy_rubric(p_id uuid, p_version integer, p_title text, p_slug text, p_description text, p_sort_order integer, p_published boolean, p_modules bigint[]) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare v_id uuid;v_current integer;
begin
 if not public.is_pdf_admin() then raise insufficient_privilege;end if;
 if p_title is null or length(trim(p_title)) not between 1 and 160 or p_slug is null or p_slug !~ '^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$' or p_description is null or length(p_description)>1000 or p_sort_order is null or p_sort_order not between 0 and 10000 or p_published is null or p_modules is null or cardinality(p_modules)>100 then raise invalid_parameter_value;end if;
 if exists(select 1 from unnest(p_modules) m where m is null or not exists(select 1 from public.modules x where x.id=m)) or (p_published and cardinality(p_modules)=0) then raise invalid_parameter_value using message='Choose existing modules';end if;
 if p_id is null then
  insert into public.academy_rubrics(title,slug,description,sort_order,is_published) values(trim(p_title),p_slug,p_description,p_sort_order,p_published) returning id into v_id;
 else
  select version into v_current from public.academy_rubrics where id=p_id for update;
  if v_current is null or v_current is distinct from p_version then raise exception using errcode='40001',message='Rubric changed';end if;
  update public.academy_rubrics set title=trim(p_title),slug=p_slug,description=p_description,sort_order=p_sort_order,is_published=p_published,version=version+1 where id=p_id;v_id=p_id;
 end if;
 delete from public.academy_rubric_modules where rubric_id=v_id;
 insert into public.academy_rubric_modules(rubric_id,module_id) select v_id,m from unnest(p_modules)m group by m;
 return v_id;
end;$_$;


--
-- Name: save_pdf_position(uuid, uuid, uuid, integer, bigint, uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_pdf_position(p_document_id uuid, p_version uuid, p_viewer_id uuid, p_page integer, p_revision bigint, p_session_id uuid, p_sequence integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare s uuid;d public.pdf_documents;r public.pdf_positions;v_revision bigint:=0;
begin
 select id into s from public.students where auth_user_id=auth.uid();
 if s is null or s is distinct from p_viewer_id then raise insufficient_privilege;end if;
 perform 1 from auth.users where id=auth.uid() for key share;if not found then raise insufficient_privilege;end if;
 perform pg_advisory_xact_lock(hashtextextended(s::text||p_document_id::text,731));
 select * into d from public.pdf_documents where id=p_document_id for share;
 if d.id is null or not public.can_read_pdf(p_document_id) then raise insufficient_privilege;end if;
 if d.version is distinct from p_version or p_page is null or p_page not between 1 and d.page_count or p_revision is null or p_revision<0 or p_session_id is null or p_sequence is null or p_sequence<1 then raise invalid_parameter_value;end if;
 select * into r from public.pdf_positions where student_id=s and document_id=p_document_id for update;
 if r.document_version=d.version then
  v_revision:=r.revision;
  if r.session_id=p_session_id and p_sequence<=r.client_sequence then return jsonb_build_object('viewerId',s,'version',d.version,'page',r.page,'revision',r.revision,'ignored',true);end if;
 end if;
 if p_revision<>v_revision then return jsonb_build_object('viewerId',s,'version',d.version,'page',case when r.document_version=d.version then least(r.page,d.page_count) else 1 end,'revision',v_revision,'conflict',true);end if;
 insert into public.pdf_positions(student_id,document_id,document_version,page,revision,session_id,client_sequence)
 values(s,p_document_id,d.version,p_page,v_revision+1,p_session_id,p_sequence)
 on conflict(student_id,document_id) do update set document_version=excluded.document_version,page=excluded.page,revision=excluded.revision,session_id=excluded.session_id,client_sequence=excluded.client_sequence,updated_at=now();
 return jsonb_build_object('viewerId',s,'version',d.version,'page',p_page,'revision',v_revision+1);
end;$$;


--
-- Name: save_video_position(text, bigint, uuid, text, double precision, double precision, bigint, uuid, bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_video_position(p_kind text, p_content_id bigint, p_viewer_id uuid, p_video_version text, p_position_seconds double precision, p_duration_seconds double precision, p_expected_revision bigint, p_session_id uuid, p_client_sequence bigint) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_student uuid; v_version text; v_duration double precision; v_max double precision; v_row public.video_positions;
begin
 select s.id into v_student from public.students s where s.auth_user_id=auth.uid();
 if v_student is null or v_student is distinct from p_viewer_id or not public.htp_video_access(p_kind,p_content_id) then raise exception 'Video access denied' using errcode='42501'; end if;
 v_version:=public.htp_video_version(p_kind,p_content_id);
 if v_version is null or v_version is distinct from p_video_version then raise exception 'Video version changed' using errcode='22023'; end if;
 if p_position_seconds is null or not(p_position_seconds>=0 and p_position_seconds<'Infinity'::float8)
   or p_duration_seconds is null or not(p_duration_seconds>0 and p_duration_seconds<=604800)
   or p_position_seconds>p_duration_seconds or p_expected_revision is null or p_expected_revision<0
   or p_session_id is null or p_client_sequence is null or p_client_sequence<=0 then raise exception 'Invalid video position' using errcode='22023'; end if;
 if p_kind='lesson' then select l.video_duration_seconds into v_duration from public.lessons l where l.id=p_content_id;
 else select w.video_duration_seconds into v_duration from public.weekly_updates w where w.id=p_content_id; end if;
 if v_duration>0 and abs(v_duration-p_duration_seconds)>greatest(5,v_duration*0.02) then raise exception 'Video duration mismatch' using errcode='22023'; end if;
 -- The actual player's duration remains bounded; known catalog duration is checked, not blindly trusted.
 v_duration:=p_duration_seconds;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_student::text||':'||p_kind||':'||p_content_id::text,0));
 select * into v_row from public.video_positions p where p.student_id=v_student and
  (p_kind='lesson' and p.lesson_id=p_content_id or p_kind='update' and p.weekly_update_id=p_content_id) for update;
 if v_row.video_version=v_version and v_row.session_id=p_session_id and p_client_sequence<=v_row.client_sequence then
   return public.htp_position_json(v_row,v_student,v_version,v_duration)||jsonb_build_object('accepted',p_client_sequence=v_row.client_sequence,'stale',p_client_sequence<v_row.client_sequence);
 end if;
 if coalesce(v_row.revision,0)<>p_expected_revision then
   return public.htp_position_json(v_row,v_student,v_version,v_duration)||jsonb_build_object('accepted',false,'conflict',true);
 end if;
 v_max:=greatest(p_position_seconds,case when v_row.video_version=v_version then least(v_row.max_position_seconds,v_duration) else 0 end);
 if v_row.id is null then
  insert into public.video_positions(student_id,lesson_id,weekly_update_id,video_version,position_seconds,duration_seconds,max_position_seconds,completed,revision,session_id,client_sequence)
  values(v_student,case when p_kind='lesson' then p_content_id end,case when p_kind='update' then p_content_id end,v_version,p_position_seconds,v_duration,v_max,v_max/v_duration>=0.95,1,p_session_id,p_client_sequence) returning * into v_row;
 else
  update public.video_positions set video_version=v_version,position_seconds=p_position_seconds,duration_seconds=v_duration,max_position_seconds=v_max,
   completed=v_max/v_duration>=0.95,revision=revision+1,session_id=p_session_id,client_sequence=p_client_sequence,updated_at=clock_timestamp()
   where id=v_row.id returning * into v_row;
 end if;
 return public.htp_position_json(v_row,v_student,v_version,v_duration)||jsonb_build_object('accepted',true,'conflict',false);
end; $$;


--
-- Name: send_chat_message(text, uuid, uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.send_chat_message(p_body text, p_client_message_id uuid, p_thread_id uuid DEFAULT NULL::uuid, p_is_internal boolean DEFAULT false) RETURNS jsonb
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select public.send_chat_message_with_attachments(p_body, p_client_message_id,
    p_thread_id, p_is_internal, '{}'::uuid[], null::uuid);
$$;


--
-- Name: send_chat_message_with_attachments(text, uuid, uuid, boolean, uuid[], uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.send_chat_message_with_attachments(p_body text, p_client_message_id uuid, p_thread_id uuid DEFAULT NULL::uuid, p_is_internal boolean DEFAULT false, p_attachment_ids uuid[] DEFAULT '{}'::uuid[], p_upload_intent uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_student uuid := public.current_chat_student_id(); v_mentor uuid;
  v_thread public.conversation_threads%rowtype; v_existing_id uuid; v_result jsonb;
  v_message_id uuid; v_attachment public.conversation_attachments%rowtype;
  v_expected uuid[]; v_actual uuid[]; v_seen integer := 0; v_dto jsonb;
begin
  if v_student is null then raise exception 'authentication required' using errcode = '42501'; end if;
  perform 1 from public.chat_mentor_config where singleton for share;
  v_mentor := public.current_chat_mentor_id();
  if v_mentor is null then raise exception 'chat mentor unavailable' using errcode = '55000'; end if;
  p_attachment_ids := coalesce(p_attachment_ids, '{}'::uuid[]);
  if cardinality(p_attachment_ids) > 3 or array_position(p_attachment_ids, null) is not null
    or (select count(distinct x) from unnest(p_attachment_ids) x) <> cardinality(p_attachment_ids)
    or (cardinality(p_attachment_ids) > 0 and p_upload_intent is null) then
    raise exception 'invalid attachment selection' using errcode = '22023';
  end if;
  if p_thread_id is null then
    if v_student = v_mentor or coalesce(p_is_internal, false) then
      raise exception 'choose a student conversation' using errcode = '42501';
    end if;
    p_thread_id := (public.open_chat_thread(v_mentor)->>'threadId')::uuid;
  end if;
  select * into v_thread from public.conversation_threads where id = p_thread_id for update;
  if public.chat_participant_role(p_thread_id) is null then
    raise exception 'chat access denied' using errcode = '42501';
  end if;
  select m.id into v_existing_id from public.conversation_messages m
  where m.thread_id = v_thread.id and m.sender_student_id = v_student and m.client_message_id = p_client_message_id;
  v_result := public._send_chat_message_core(p_body, p_client_message_id, p_thread_id, p_is_internal);
  v_message_id := (v_result -> 'message' ->> 'id')::uuid;
  select coalesce(array_agg(x order by x), '{}'::uuid[]) into v_expected from unnest(p_attachment_ids) x;
  if v_existing_id is not null then
    select coalesce(array_agg(id order by id), '{}'::uuid[]) into v_actual
    from public.conversation_attachments where message_id = v_message_id and state = 'attached';
    if v_actual is distinct from v_expected or exists (
      select 1 from public.conversation_attachments where id = any(p_attachment_ids)
        and upload_intent is distinct from p_upload_intent
    ) then
      raise exception 'client message ID conflicts with attachment payload' using errcode = '22023';
    end if;
  else
    for v_attachment in select * from public.conversation_attachments
      where id = any(p_attachment_ids) order by id for update
    loop
      v_seen := v_seen + 1;
      if v_attachment.uploader_student_id is distinct from v_student
        or v_attachment.state <> 'ready' or v_attachment.message_id is not null
        or v_attachment.upload_intent is distinct from p_upload_intent
        or (v_attachment.thread_id is not null and v_attachment.thread_id <> v_thread.id)
        or (v_attachment.thread_id is null and (v_thread.student_id <> v_student or v_thread.source_id is not null)) then
        raise exception 'attachment unavailable for this message' using errcode = '42501';
      end if;
    end loop;
    if v_seen <> cardinality(p_attachment_ids) then
      raise exception 'attachment unavailable for this message' using errcode = '42501';
    end if;
    update public.conversation_attachments a
    set message_id = v_message_id, thread_id = v_thread.id, state = 'attached',
        position = array_position(p_attachment_ids, a.id) - 1
    where a.id = any(p_attachment_ids);
  end if;
  select coalesce(jsonb_agg(public.chat_attachment_projection(id) order by position, id), '[]'::jsonb)
    into v_dto from public.conversation_attachments where message_id = v_message_id and state = 'attached';
  return jsonb_set(v_result, '{message,attachments}', v_dto, true);
end;
$$;


--
-- Name: FUNCTION send_chat_message_with_attachments(p_body text, p_client_message_id uuid, p_thread_id uuid, p_is_internal boolean, p_attachment_ids uuid[], p_upload_intent uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.send_chat_message_with_attachments(p_body text, p_client_message_id uuid, p_thread_id uuid, p_is_internal boolean, p_attachment_ids uuid[], p_upload_intent uuid) IS 'Caption-required atomic send/link with same-actor draft intent, ready-state checks and exact idempotent attachment set.';


--
-- Name: serialize_exam_attempt(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.serialize_exam_attempt(p_attempt_id uuid) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select jsonb_build_object(
    'attemptId', a.id,
    'examId', a.exam_id,
    'moduleId', a.module_id,
    'status', a.status,
    'score', a.score,
    'passed', a.passed,
    'totalQuestions', a.total_questions,
    'questions', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', aq.question_id,
          'questionText', aq.question_snapshot,
          'explanation', aq.explanation_snapshot,
          'options', aq.options_snapshot
        )
        order by aq.order_index
      ) filter (where aq.id is not null),
      '[]'::jsonb
    )
  )
  from public.exam_attempts a
  left join public.exam_attempt_questions aq on aq.attempt_id = a.id
  where a.id = p_attempt_id
    and (
      public.is_platform_admin()
      or exists (
        select 1
        from public.students s
        where s.id = a.student_id
          and s.auth_user_id = auth.uid()
      )
    )
  group by a.id;
$$;


--
-- Name: set_market_post_reaction(bigint, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_market_post_reaction(p_post_id bigint, p_active boolean) RETURNS TABLE(total bigint, active boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_student uuid;
begin
  -- Take the account lock first, consistently with direct reaction inserts.
  perform 1 from auth.users where id = auth.uid() for key share;
  if not found then raise exception 'Authentication required' using errcode = '42501'; end if;
  perform 1 from public.weekly_updates where id = p_post_id for update;
  if not public.can_read_market_post(p_post_id) then raise exception 'Post access denied' using errcode = '42501'; end if;
  select id into v_student from public.students where auth_user_id = auth.uid();
  if v_student is null or p_active is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_active then
    insert into public.market_post_reactions(post_id, student_id) values(p_post_id, v_student) on conflict do nothing;
  else
    delete from public.market_post_reactions where post_id = p_post_id and student_id = v_student;
  end if;
  return query select * from public.market_post_reaction_state(p_post_id);
end;
$$;


--
-- Name: set_my_chat_email_preference(boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_my_chat_email_preference(p_enabled boolean) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_student uuid:=public.current_chat_student_id();
begin
  if v_student is null or p_enabled is null then raise exception 'authentication required' using errcode='42501'; end if;
  insert into public.chat_email_preferences(student_id,enabled) values(v_student,p_enabled)
  on conflict(student_id) do update set enabled=excluded.enabled,updated_at=now();
  -- Enabling never removes delivery/bounce/unsubscribe suppression from the existing email system.
  if not p_enabled then
    update public.chat_email_outbox set status='cancelled',last_error='preference_disabled',lease_token=null,lease_until=null
    where recipient_student_id=v_student and status in ('queued','retry');
  end if;
  return public.get_my_chat_email_preferences();
end;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: start_module_exam(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.start_module_exam(p_module_id bigint) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if not public.can_start_academy_exam(p_module_id) then
    return jsonb_build_object('success', false, 'error', 'Rond eerst de toegankelijke lessen en je intake af, of activeer volledige Academy-toegang.');
  end if;
  return public.start_module_exam_unchecked(p_module_id);
end;
$$;


--
-- Name: start_module_exam_unchecked(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.start_module_exam_unchecked(p_module_id bigint) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_student_id uuid;
  v_exam_id bigint;
  v_attempt_id uuid;
  v_active_count integer;
  v_valid_count integer;
begin
  select id into v_student_id
  from public.students
  where auth_user_id = auth.uid();

  if v_student_id is null then
    return jsonb_build_object('success', false, 'error', 'Je bent niet aangemeld.');
  end if;

  -- The public wrapper additionally requires every published lesson watched.
  -- Reuse the same entitlement helper here instead of a second order gate.
  if not public.can_open_academy_module(p_module_id) then
    return jsonb_build_object('success', false, 'error', 'Deze module is nog vergrendeld.');
  end if;

  select id into v_exam_id
  from public.exams
  where module_id = p_module_id
    and is_published = true;

  if v_exam_id is null then
    return jsonb_build_object('success', false, 'error', 'Voor deze module is nog geen toets beschikbaar.');
  end if;

  select id into v_attempt_id
  from public.exam_attempts
  where student_id = v_student_id
    and module_id = p_module_id
    and exam_id = v_exam_id
    and status = 'in_progress'
  order by created_at desc
  limit 1;

  if v_attempt_id is not null then
    return jsonb_build_object('success', true, 'attempt', public.serialize_exam_attempt(v_attempt_id));
  end if;

  select count(*) into v_active_count
  from public.exam_questions
  where module_id = p_module_id
    and exam_id = v_exam_id
    and is_active = true
    and deleted_at is null;

  with valid_questions as (
    select q.id
    from public.exam_questions q
    join public.exam_answer_options o on o.question_id = q.id
    where q.module_id = p_module_id
      and q.exam_id = v_exam_id
      and q.is_active = true
      and q.deleted_at is null
    group by q.id
    having count(o.id) >= 2
       and count(o.id) filter (where o.is_correct) = 1
  )
  select count(*) into v_valid_count
  from valid_questions;

  if v_valid_count < 10 then
    return jsonb_build_object(
      'success', false,
      'error', 'Deze toets heeft nog niet genoeg geldige actieve vragen. Er zijn minimaal 10 vragen nodig.',
      'activeQuestionCount', v_active_count,
      'validQuestionCount', v_valid_count
    );
  end if;

  insert into public.exam_attempts (student_id, exam_id, module_id, total_questions)
  values (v_student_id, v_exam_id, p_module_id, 10)
  returning id into v_attempt_id;

  with selected_questions as (
    select q.id, q.question_text, q.explanation, row_number() over (order by random()) as order_index
    from public.exam_questions q
    where q.module_id = p_module_id
      and q.exam_id = v_exam_id
      and q.is_active = true
      and q.deleted_at is null
      and (
        select count(*)
        from public.exam_answer_options o
        where o.question_id = q.id
      ) >= 2
      and (
        select count(*)
        from public.exam_answer_options o
        where o.question_id = q.id
          and o.is_correct
      ) = 1
    order by random()
    limit 10
  ),
  question_payload as (
    select
      sq.id as question_id,
      sq.order_index,
      sq.question_text,
      sq.explanation,
      correct.id as correct_option_id,
      correct.option_text as correct_option_snapshot,
      (
        select jsonb_agg(
          jsonb_build_object('id', shuffled.id, 'optionText', shuffled.option_text)
          order by shuffled.random_order
        )
        from (
          select o.id, o.option_text, random() as random_order
          from public.exam_answer_options o
          where o.question_id = sq.id
        ) shuffled
      ) as options_snapshot
    from selected_questions sq
    join public.exam_answer_options correct
      on correct.question_id = sq.id
     and correct.is_correct = true
  )
  insert into public.exam_attempt_questions (
    attempt_id,
    question_id,
    order_index,
    question_snapshot,
    explanation_snapshot,
    options_snapshot,
    correct_option_id,
    correct_option_snapshot
  )
  select
    v_attempt_id,
    question_id,
    order_index,
    question_text,
    explanation,
    options_snapshot,
    correct_option_id,
    correct_option_snapshot
  from question_payload;

  return jsonb_build_object('success', true, 'attempt', public.serialize_exam_attempt(v_attempt_id));
end;
$$;


--
-- Name: submit_module_exam(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.submit_module_exam(p_attempt_id uuid, p_answers jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_module_id bigint;
begin
  select a.module_id into v_module_id
  from public.exam_attempts a
  join public.students s on s.id = a.student_id
  where a.id = p_attempt_id and s.auth_user_id = auth.uid();

  if v_module_id is null or not public.can_start_academy_exam(v_module_id) then
    return jsonb_build_object('success', false, 'error', 'Deze toets is niet meer toegankelijk.');
  end if;

  return public.submit_module_exam_unchecked(p_attempt_id, p_answers);
end;
$$;


--
-- Name: submit_module_exam_unchecked(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.submit_module_exam_unchecked(p_attempt_id uuid, p_answers jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_student_id uuid;
  v_attempt_id uuid;
  v_attempt_exam_id bigint;
  v_attempt_status text;
  v_attempt_score integer;
  v_attempt_total_questions integer;
  v_attempt_passed boolean;
  v_answer_count integer;
  v_correct_count integer;
  v_score integer;
  v_passing_score integer;
  v_passed boolean;
begin
  select id into v_student_id
  from public.students
  where auth_user_id = auth.uid();

  if v_student_id is null then
    return jsonb_build_object('success', false, 'error', 'Je bent niet aangemeld.');
  end if;

  select
    id,
    exam_id,
    status,
    score,
    total_questions,
    passed
  into
    v_attempt_id,
    v_attempt_exam_id,
    v_attempt_status,
    v_attempt_score,
    v_attempt_total_questions,
    v_attempt_passed
  from public.exam_attempts
  where id = p_attempt_id
    and student_id = v_student_id;

  if v_attempt_id is null then
    return jsonb_build_object('success', false, 'error', 'Deze poging bestaat niet.');
  end if;

  if v_attempt_status = 'submitted' then
    return jsonb_build_object(
      'success', true,
      'score', v_attempt_score,
      'passed', v_attempt_passed,
      'alreadySubmitted', true
    );
  end if;

  if jsonb_typeof(p_answers) <> 'array' then
    return jsonb_build_object('success', false, 'error', 'Ongeldige antwoorden.');
  end if;

  create temporary table tmp_exam_submission_answers (
    question_id bigint not null,
    selected_option_id bigint not null
  ) on commit drop;

  insert into tmp_exam_submission_answers (question_id, selected_option_id)
  select
    (value->>'questionId')::bigint,
    (value->>'selectedOptionId')::bigint
  from jsonb_array_elements(p_answers)
  where value ? 'questionId'
    and value ? 'selectedOptionId';

  select count(*) into v_answer_count
  from tmp_exam_submission_answers;

  if v_answer_count <> v_attempt_total_questions then
    return jsonb_build_object('success', false, 'error', 'Beantwoord alle vragen voordat je de toets indient.');
  end if;

  if (
    select count(distinct question_id)
    from tmp_exam_submission_answers
  ) <> v_answer_count then
    return jsonb_build_object('success', false, 'error', 'Een vraag is meerdere keren beantwoord.');
  end if;

  if exists (
    select 1
    from tmp_exam_submission_answers submitted
    left join public.exam_attempt_questions aq
      on aq.attempt_id = v_attempt_id
     and aq.question_id = submitted.question_id
    where aq.id is null
  ) then
    return jsonb_build_object('success', false, 'error', 'Een of meer antwoorden horen niet bij deze poging.');
  end if;

  if exists (
    select 1
    from tmp_exam_submission_answers submitted
    join public.exam_attempt_questions aq
      on aq.attempt_id = v_attempt_id
     and aq.question_id = submitted.question_id
    where not exists (
      select 1
      from jsonb_array_elements(aq.options_snapshot) option_row
      where (option_row->>'id')::bigint = submitted.selected_option_id
    )
  ) then
    return jsonb_build_object('success', false, 'error', 'Een of meer antwoorden zijn ongeldig.');
  end if;

  insert into public.exam_attempt_answers (
    attempt_id,
    question_id,
    selected_option_id,
    is_correct,
    question_snapshot,
    selected_option_snapshot,
    correct_option_snapshot
  )
  select
    v_attempt_id,
    aq.question_id,
    submitted.selected_option_id,
    submitted.selected_option_id = aq.correct_option_id,
    aq.question_snapshot,
    selected_snapshot.option_text,
    aq.correct_option_snapshot
  from tmp_exam_submission_answers submitted
  join public.exam_attempt_questions aq
    on aq.attempt_id = v_attempt_id
   and aq.question_id = submitted.question_id
  join lateral (
    select option_row->>'optionText' as option_text
    from jsonb_array_elements(aq.options_snapshot) option_row
    where (option_row->>'id')::bigint = submitted.selected_option_id
    limit 1
  ) selected_snapshot on true
  order by aq.order_index;

  select count(*) into v_correct_count
  from public.exam_attempt_answers
  where attempt_id = v_attempt_id
    and is_correct = true;

  v_score := round((v_correct_count::numeric / v_attempt_total_questions::numeric) * 100)::integer;

  select passing_score into v_passing_score
  from public.exams
  where id = v_attempt_exam_id;

  v_passed := v_score >= coalesce(v_passing_score, 70);

  update public.exam_attempts
  set
    status = 'submitted',
    score = v_score,
    correct_count = v_correct_count,
    passed = v_passed,
    submitted_at = now()
  where id = v_attempt_id;

  insert into public.exam_results (student_id, exam_id, score, passed)
  values (v_student_id, v_attempt_exam_id, v_score, v_passed);

  return jsonb_build_object(
    'success', true,
    'score', v_score,
    'passed', v_passed,
    'correctCount', v_correct_count,
    'totalQuestions', v_attempt_total_questions
  );
end;
$$;


--
-- Name: update_chat_thread(uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_chat_thread(p_thread_id uuid, p_status text DEFAULT NULL::text, p_priority text DEFAULT NULL::text, p_category text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if public.current_chat_student_id() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  perform 1 from public.chat_mentor_config where singleton for share;
  perform 1 from public.conversation_threads where id = p_thread_id for update;
  if public.chat_participant_role(p_thread_id) is distinct from 'mentor' then
    raise exception 'mentor chat access required' using errcode = '42501';
  end if;
  if p_status is not null and p_status not in ('open', 'pending_mentor', 'pending_student', 'snoozed', 'closed') then
    raise exception 'invalid chat status' using errcode = '22023';
  end if;
  if p_priority is not null and p_priority not in ('normal', 'high', 'urgent') then
    raise exception 'invalid chat priority' using errcode = '22023';
  end if;
  if p_category is not null and char_length(p_category) > 100 then
    raise exception 'chat category too long' using errcode = '22023';
  end if;
  update public.conversation_threads
  set status = coalesce(p_status, status), priority = coalesce(p_priority, priority),
      category = case when p_category is null then category else nullif(btrim(p_category), '') end,
      closed_at = case when p_status = 'closed' then now()
                      when p_status is not null then null else closed_at end
  where id = p_thread_id;
  return jsonb_build_object('success', true);
end;
$$;


--
-- Name: valid_market_chapters(jsonb, numeric, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.valid_market_chapters(chapters jsonb, duration numeric, markets text[]) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare chapter jsonb; seconds numeric; previous numeric := -1;
begin
  if chapters is null or jsonb_typeof(chapters) <> 'array' then return false; end if;
  if jsonb_array_length(chapters) > 200 then return false; end if;
  for chapter in select value from jsonb_array_elements(chapters) loop
    if jsonb_typeof(chapter) <> 'object'
      or chapter - array['title','seconds','market']::text[] <> '{}'::jsonb
      or jsonb_typeof(chapter->'title') is distinct from 'string'
      or length(btrim(chapter->>'title')) = 0 or length(chapter->>'title') > 240
      or jsonb_typeof(chapter->'seconds') is distinct from 'number' then return false; end if;
    seconds := (chapter->>'seconds')::numeric;
    if seconds < 0 or seconds > 9007199254740991 or seconds <> trunc(seconds)
      or seconds <= previous or (duration > 0 and seconds >= duration) then return false; end if;
    if chapter ? 'market' and (jsonb_typeof(chapter->'market') is distinct from 'string'
      or not coalesce((chapter->>'market') = any(markets),false)
      or not ((chapter->>'market') = any(array['stocks','forex','crypto','gold','commodities','trading','macro','indices','general']))) then return false; end if;
    previous := seconds;
  end loop;
  return true;
end;
$$;


--
-- Name: academy_rubric_modules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.academy_rubric_modules (
    rubric_id uuid NOT NULL,
    module_id bigint NOT NULL
);


--
-- Name: academy_rubrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.academy_rubrics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    slug text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_published boolean DEFAULT false NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    CONSTRAINT academy_rubrics_description_check CHECK ((length(description) <= 1000)),
    CONSTRAINT academy_rubrics_slug_check CHECK ((slug ~ '^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$'::text)),
    CONSTRAINT academy_rubrics_sort_order_check CHECK (((sort_order >= 0) AND (sort_order <= 10000))),
    CONSTRAINT academy_rubrics_title_check CHECK (((length(title) >= 1) AND (length(title) <= 160))),
    CONSTRAINT academy_rubrics_version_check CHECK ((version > 0))
);


--
-- Name: admin_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_type text NOT NULL,
    actor_student_id uuid NOT NULL,
    target_student_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT admin_audit_log_event_type_check CHECK ((((char_length(event_type) >= 3) AND (char_length(event_type) <= 128)) AND (event_type ~ '^[a-z][a-z0-9_.]*$'::text))),
    CONSTRAINT admin_audit_log_metadata_check CHECK ((jsonb_typeof(metadata) = 'object'::text))
);


--
-- Name: ai_interactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_interactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid,
    actor_student_id uuid,
    feature text NOT NULL,
    model text,
    input_tokens integer,
    output_tokens integer,
    status text DEFAULT 'success'::text NOT NULL,
    error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    transcript_id uuid,
    prompt_version text,
    estimated_cost_eur numeric(12,6),
    failure_code text,
    failure_retryable boolean DEFAULT false NOT NULL,
    CONSTRAINT ai_interactions_status_check CHECK ((status = ANY (ARRAY['success'::text, 'error'::text])))
);


--
-- Name: ai_student_summaries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_student_summaries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    feature text DEFAULT 'mentor_summary'::text NOT NULL,
    summary jsonb NOT NULL,
    model text,
    generated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_video_enrichments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_video_enrichments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    transcript_id uuid NOT NULL,
    prompt_version text NOT NULL,
    model text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    summary text,
    key_takeaways jsonb DEFAULT '[]'::jsonb NOT NULL,
    chapters jsonb DEFAULT '[]'::jsonb NOT NULL,
    generated_content jsonb,
    reviewed_content jsonb,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    published_at timestamp with time zone,
    input_tokens integer,
    output_tokens integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    failure_code text,
    failure_retryable boolean DEFAULT false NOT NULL,
    estimated_cost_eur numeric(12,6),
    CONSTRAINT ai_video_enrichments_chapters_check CHECK ((jsonb_typeof(chapters) = 'array'::text)),
    CONSTRAINT ai_video_enrichments_check CHECK (((status <> 'published'::text) OR ((reviewed_by IS NOT NULL) AND (reviewed_at IS NOT NULL)))),
    CONSTRAINT ai_video_enrichments_input_tokens_check CHECK (((input_tokens IS NULL) OR (input_tokens >= 0))),
    CONSTRAINT ai_video_enrichments_key_takeaways_check CHECK ((jsonb_typeof(key_takeaways) = 'array'::text)),
    CONSTRAINT ai_video_enrichments_output_tokens_check CHECK (((output_tokens IS NULL) OR (output_tokens >= 0))),
    CONSTRAINT ai_video_enrichments_status_check CHECK ((status = ANY (ARRAY['processing'::text, 'draft'::text, 'review'::text, 'published'::text, 'rejected'::text, 'failed'::text])))
);


--
-- Name: TABLE ai_video_enrichments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.ai_video_enrichments IS 'Admin-only AI drafts and human review metadata; published student projections are queried separately.';


--
-- Name: ai_video_transcripts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_video_transcripts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    weekly_update_id bigint NOT NULL,
    source_version text NOT NULL,
    source_language text DEFAULT 'nl'::text NOT NULL,
    provider text NOT NULL,
    provider_track_id text,
    status text DEFAULT 'pending'::text NOT NULL,
    attempt_count integer DEFAULT 0 NOT NULL,
    failure_code text,
    failure_retryable boolean DEFAULT false NOT NULL,
    transcript jsonb,
    started_at timestamp with time zone,
    ready_at timestamp with time zone,
    failed_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ai_video_transcripts_attempt_count_check CHECK ((attempt_count >= 0)),
    CONSTRAINT ai_video_transcripts_check CHECK (((status <> 'ready'::text) OR ((provider_track_id IS NOT NULL) AND (transcript IS NOT NULL)))),
    CONSTRAINT ai_video_transcripts_provider_check CHECK ((provider = 'mux'::text)),
    CONSTRAINT ai_video_transcripts_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'ready'::text, 'failed'::text]))),
    CONSTRAINT ai_video_transcripts_transcript_check CHECK (((transcript IS NULL) OR (jsonb_typeof(transcript) = 'array'::text)))
);


--
-- Name: TABLE ai_video_transcripts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.ai_video_transcripts IS 'Admin-only transcript lifecycle. Transcript text must never be copied into application logs.';


--
-- Name: ai_video_workflows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_video_workflows (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    transcript_id uuid NOT NULL,
    step text DEFAULT 'fetch_transcript'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    attempt_count integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 4 NOT NULL,
    next_attempt_at timestamp with time zone,
    lease_token uuid,
    lease_expires_at timestamp with time zone,
    last_error_code text,
    last_error_retryable boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ai_video_workflows_attempt_count_check CHECK ((attempt_count >= 0)),
    CONSTRAINT ai_video_workflows_max_attempts_check CHECK (((max_attempts >= 1) AND (max_attempts <= 10))),
    CONSTRAINT ai_video_workflows_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'running'::text, 'waiting_review'::text, 'completed'::text, 'failed'::text, 'dead_letter'::text]))),
    CONSTRAINT ai_video_workflows_step_check CHECK ((step = ANY (ARRAY['fetch_transcript'::text, 'enrich'::text, 'review'::text, 'complete'::text])))
);


--
-- Name: avatar_objects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.avatar_objects (
    object_path text NOT NULL,
    student_id uuid,
    state text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT avatar_objects_object_path_check CHECK ((object_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'::text)),
    CONSTRAINT avatar_objects_state_check CHECK ((state = ANY (ARRAY['pending'::text, 'active'::text, 'garbage'::text])))
);


--
-- Name: billing_customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.billing_customers (
    student_id uuid NOT NULL,
    stripe_customer_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: chat_email_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_email_preferences (
    student_id uuid NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: chat_mentor_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_mentor_config (
    singleton boolean DEFAULT true NOT NULL,
    mentor_student_id uuid,
    enabled boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chat_mentor_config_singleton_check CHECK (singleton)
);


--
-- Name: TABLE chat_mentor_config; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.chat_mentor_config IS 'Explicit private-chat mentor configuration; no name/email/admin-role lookup. Service-only configuration.';


--
-- Name: chat_presence_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_presence_sessions (
    student_id uuid NOT NULL,
    session_id uuid NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE chat_presence_sessions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.chat_presence_sessions IS 'Private per-tab authenticated heartbeat leases. Query online users only through scoped list_chat_presence; no activity timestamps in public profile data.';


--
-- Name: chat_principals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_principals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    kind text NOT NULL,
    student_id uuid,
    display_name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chat_principals_kind_check CHECK ((kind = ANY (ARRAY['human'::text, 'ai'::text, 'system'::text]))),
    CONSTRAINT chat_principals_nonhuman_account_check CHECK (((kind = 'human'::text) OR (student_id IS NULL)))
);


--
-- Name: conversation_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    uploader_student_id uuid,
    upload_intent uuid NOT NULL,
    thread_id uuid,
    message_id uuid,
    object_path text NOT NULL,
    content_sha256 text NOT NULL,
    file_name text NOT NULL,
    media_type text DEFAULT 'image/webp'::text NOT NULL,
    size_bytes integer NOT NULL,
    width integer NOT NULL,
    height integer NOT NULL,
    state text DEFAULT 'pending'::text NOT NULL,
    "position" smallint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT chat_attachment_path CHECK ((object_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'::text)),
    CONSTRAINT chat_attachment_pending_unlinked CHECK (((state <> ALL (ARRAY['pending'::text, 'ready'::text])) OR (message_id IS NULL))),
    CONSTRAINT chat_attachment_pixels CHECK ((((width)::bigint * height) <= 25000000)),
    CONSTRAINT conversation_attachments_content_sha256_check CHECK ((content_sha256 ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT conversation_attachments_file_name_check CHECK (((char_length(file_name) >= 1) AND (char_length(file_name) <= 120))),
    CONSTRAINT conversation_attachments_height_check CHECK (((height >= 1) AND (height <= 10000))),
    CONSTRAINT conversation_attachments_media_type_check CHECK ((media_type = 'image/webp'::text)),
    CONSTRAINT conversation_attachments_position_check CHECK ((("position" >= 0) AND ("position" <= 2))),
    CONSTRAINT conversation_attachments_size_bytes_check CHECK (((size_bytes >= 1) AND (size_bytes <= 4194304))),
    CONSTRAINT conversation_attachments_state_check CHECK ((state = ANY (ARRAY['pending'::text, 'ready'::text, 'attached'::text, 'garbage'::text, 'deleted'::text]))),
    CONSTRAINT conversation_attachments_width_check CHECK (((width >= 1) AND (width <= 10000)))
);


--
-- Name: TABLE conversation_attachments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.conversation_attachments IS 'Private processed screenshots; authenticated metadata reads omit uploader, intent, hash and Storage path. Sources are never stored.';


--
-- Name: conversation_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    thread_id uuid NOT NULL,
    actor_student_id uuid,
    event_type text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: conversation_message_reactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation_message_reactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid NOT NULL,
    student_id uuid NOT NULL,
    reaction text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT conversation_message_reactions_reaction_length CHECK (((char_length(reaction) >= 1) AND (char_length(reaction) <= 32)))
);


--
-- Name: conversation_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    thread_id uuid NOT NULL,
    sender_student_id uuid,
    sender_role text NOT NULL,
    body text NOT NULL,
    body_format text DEFAULT 'plain'::text NOT NULL,
    client_message_id uuid,
    status text DEFAULT 'sent'::text NOT NULL,
    is_internal boolean DEFAULT false NOT NULL,
    parent_message_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    edited_at timestamp with time zone,
    deleted_at timestamp with time zone,
    sender_principal_id uuid,
    sender_participant_id uuid,
    public_seq bigint,
    message_kind text DEFAULT 'text'::text NOT NULL,
    CONSTRAINT conversation_messages_body_format_check CHECK ((body_format = ANY (ARRAY['plain'::text, 'markdown'::text]))),
    CONSTRAINT conversation_messages_body_length CHECK ((char_length(body) <= 5000)),
    CONSTRAINT conversation_messages_body_not_empty CHECK ((length(TRIM(BOTH FROM body)) > 0)),
    CONSTRAINT conversation_messages_message_kind_check CHECK ((message_kind = ANY (ARRAY['text'::text, 'internal_note'::text]))),
    CONSTRAINT conversation_messages_public_seq_check CHECK (((public_seq IS NULL) OR (public_seq > 0))),
    CONSTRAINT conversation_messages_sender_role_check CHECK ((sender_role = ANY (ARRAY['student'::text, 'mentor'::text, 'admin'::text, 'ai'::text, 'system'::text]))),
    CONSTRAINT conversation_messages_status_check CHECK ((status = ANY (ARRAY['sent'::text, 'delivered'::text, 'read'::text, 'failed'::text, 'deleted'::text])))
);


--
-- Name: conversation_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation_participants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    thread_id uuid NOT NULL,
    principal_id uuid NOT NULL,
    role text NOT NULL,
    active boolean DEFAULT false NOT NULL,
    last_read_public_seq bigint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    CONSTRAINT conversation_participants_last_read_public_seq_check CHECK ((last_read_public_seq >= 0)),
    CONSTRAINT conversation_participants_role_check CHECK ((role = ANY (ARRAY['student'::text, 'mentor'::text, 'ai'::text, 'system'::text])))
);


--
-- Name: conversation_threads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation_threads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    assigned_to_student_id uuid,
    status text DEFAULT 'open'::text NOT NULL,
    priority text DEFAULT 'normal'::text NOT NULL,
    category text,
    source_type text DEFAULT 'mentor_chat'::text NOT NULL,
    source_id text,
    subject text,
    last_message_at timestamp with time zone,
    last_student_message_at timestamp with time zone,
    last_mentor_message_at timestamp with time zone,
    unread_for_student_count integer DEFAULT 0 NOT NULL,
    unread_for_mentor_count integer DEFAULT 0 NOT NULL,
    first_response_at timestamp with time zone,
    closed_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    chat_mode text DEFAULT 'human'::text NOT NULL,
    chat_version bigint DEFAULT 1 NOT NULL,
    last_public_message_seq bigint DEFAULT 0 NOT NULL,
    last_public_message_id uuid,
    CONSTRAINT conversation_threads_chat_mode_check CHECK ((chat_mode = ANY (ARRAY['human'::text, 'ai'::text, 'paused'::text]))),
    CONSTRAINT conversation_threads_last_public_message_seq_check CHECK ((last_public_message_seq >= 0)),
    CONSTRAINT conversation_threads_priority_check CHECK ((priority = ANY (ARRAY['normal'::text, 'high'::text, 'urgent'::text]))),
    CONSTRAINT conversation_threads_status_check CHECK ((status = ANY (ARRAY['open'::text, 'pending_mentor'::text, 'pending_student'::text, 'snoozed'::text, 'closed'::text]))),
    CONSTRAINT conversation_threads_unread_mentor_nonnegative CHECK ((unread_for_mentor_count >= 0)),
    CONSTRAINT conversation_threads_unread_student_nonnegative CHECK ((unread_for_student_count >= 0))
);


--
-- Name: exam_answer_options; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exam_answer_options (
    id bigint NOT NULL,
    question_id bigint NOT NULL,
    option_text text NOT NULL,
    is_correct boolean DEFAULT false NOT NULL,
    order_index integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT exam_answer_options_option_text_check CHECK ((length(TRIM(BOTH FROM option_text)) > 0))
);


--
-- Name: exam_answer_options_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.exam_answer_options_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: exam_answer_options_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.exam_answer_options_id_seq OWNED BY public.exam_answer_options.id;


--
-- Name: exam_attempt_answers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exam_attempt_answers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    attempt_id uuid NOT NULL,
    question_id bigint NOT NULL,
    selected_option_id bigint NOT NULL,
    is_correct boolean NOT NULL,
    question_snapshot text NOT NULL,
    selected_option_snapshot text NOT NULL,
    correct_option_snapshot text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: exam_attempt_questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exam_attempt_questions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    attempt_id uuid NOT NULL,
    question_id bigint NOT NULL,
    order_index integer NOT NULL,
    question_snapshot text NOT NULL,
    explanation_snapshot text,
    options_snapshot jsonb NOT NULL,
    correct_option_id bigint NOT NULL,
    correct_option_snapshot text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT exam_attempt_questions_options_snapshot_check CHECK ((jsonb_typeof(options_snapshot) = 'array'::text))
);


--
-- Name: exam_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exam_attempts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    exam_id bigint NOT NULL,
    module_id bigint NOT NULL,
    status text DEFAULT 'in_progress'::text NOT NULL,
    score integer,
    correct_count integer,
    total_questions integer DEFAULT 10 NOT NULL,
    passed boolean,
    submitted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT exam_attempts_correct_count_check CHECK (((correct_count IS NULL) OR (correct_count >= 0))),
    CONSTRAINT exam_attempts_score_check CHECK (((score IS NULL) OR ((score >= 0) AND (score <= 100)))),
    CONSTRAINT exam_attempts_status_check CHECK ((status = ANY (ARRAY['in_progress'::text, 'submitted'::text]))),
    CONSTRAINT exam_attempts_total_questions_check CHECK ((total_questions > 0))
);


--
-- Name: exam_questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exam_questions (
    id integer NOT NULL,
    exam_id integer,
    question text,
    options jsonb,
    correct_answer text,
    order_index integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    module_id bigint NOT NULL,
    question_text text NOT NULL,
    explanation text,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    updated_by uuid,
    deleted_at timestamp with time zone,
    CONSTRAINT exam_questions_question_text_not_blank CHECK ((length(TRIM(BOTH FROM question_text)) > 0))
);


--
-- Name: exam_questions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.exam_questions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: exam_questions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.exam_questions_id_seq OWNED BY public.exam_questions.id;


--
-- Name: exam_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exam_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid,
    exam_id integer,
    score integer,
    passed boolean,
    submitted_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: exams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exams (
    id integer NOT NULL,
    module_id integer,
    title text,
    description text,
    passing_score integer DEFAULT 70 NOT NULL,
    is_published boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: exams_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.exams_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: exams_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.exams_id_seq OWNED BY public.exams.id;


--
-- Name: legacy_academy_module_access; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.legacy_academy_module_access (
    student_id uuid NOT NULL,
    module_id bigint NOT NULL,
    grant_source text NOT NULL,
    captured_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT legacy_academy_module_access_grant_source_check CHECK ((grant_source = ANY (ARRAY['existing_progress'::text, 'verified_exam_attempt'::text, 'legacy_exam_result'::text])))
);


--
-- Name: lesson_action_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lesson_action_progress (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    lesson_id bigint NOT NULL,
    action_index integer NOT NULL,
    completed boolean DEFAULT false NOT NULL,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT lesson_action_progress_action_index_check CHECK ((action_index >= 0))
);


--
-- Name: lessons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lessons (
    id integer NOT NULL,
    module_id integer,
    title text NOT NULL,
    video_url text,
    "order" integer,
    description text,
    thumbnail_url text,
    slug text NOT NULL,
    video_provider text DEFAULT 'vimeo'::text NOT NULL,
    video_duration_seconds integer,
    order_index integer NOT NULL,
    is_published boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    mux_asset_id text,
    mux_playback_id text,
    mux_playback_policy text DEFAULT 'public'::text NOT NULL,
    mux_status text,
    mux_upload_id text,
    mux_error_message text,
    takeaway text,
    action_items jsonb DEFAULT '[]'::jsonb NOT NULL,
    type public.lesson_type DEFAULT 'theorie'::public.lesson_type NOT NULL,
    CONSTRAINT lessons_action_items_array_check CHECK ((jsonb_typeof(action_items) = 'array'::text)),
    CONSTRAINT lessons_mux_playback_policy_check CHECK ((mux_playback_policy = ANY (ARRAY['public'::text, 'signed'::text]))),
    CONSTRAINT lessons_mux_status_check CHECK (((mux_status IS NULL) OR (mux_status = ANY (ARRAY['preparing'::text, 'ready'::text, 'errored'::text]))))
);


--
-- Name: COLUMN lessons.thumbnail_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.lessons.thumbnail_url IS 'URL to the thumbnail image hosted in Supabase Storage';


--
-- Name: lessons_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lessons_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lessons_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lessons_id_seq OWNED BY public.lessons.id;


--
-- Name: live_session_provider_secrets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.live_session_provider_secrets (
    live_session_id uuid NOT NULL,
    external_join_url text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT live_session_provider_secrets_external_join_url_check CHECK ((external_join_url ~ '^https://'::text))
);


--
-- Name: live_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.live_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    slug text NOT NULL,
    description text,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    display_timezone text DEFAULT 'Europe/Brussels'::text NOT NULL,
    mentor_student_id uuid,
    created_by_student_id uuid,
    provider text DEFAULT 'clickmeeting'::text NOT NULL,
    provider_event_id text,
    status text DEFAULT 'draft'::text NOT NULL,
    is_published boolean DEFAULT false NOT NULL,
    published_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    cancellation_reason text,
    replay_weekly_update_id bigint,
    replay_available_from timestamp with time zone,
    replay_available_until timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    markets text[] DEFAULT '{}'::text[] NOT NULL,
    summary text,
    chapters jsonb DEFAULT '[]'::jsonb NOT NULL,
    thumbnail_url text,
    CONSTRAINT live_sessions_chapters_array_check CHECK ((jsonb_typeof(chapters) = 'array'::text)),
    CONSTRAINT live_sessions_check CHECK ((ends_at > starts_at)),
    CONSTRAINT live_sessions_check1 CHECK (((replay_available_until IS NULL) OR (replay_available_from IS NULL) OR (replay_available_until >= (replay_available_from + '28 days'::interval)))),
    CONSTRAINT live_sessions_check2 CHECK (((status <> 'cancelled'::text) OR ((cancelled_at IS NOT NULL) AND (length(TRIM(BOTH FROM COALESCE(cancellation_reason, ''::text))) > 0)))),
    CONSTRAINT live_sessions_markets_check CHECK ((markets <@ ARRAY['stocks'::text, 'forex'::text, 'crypto'::text, 'commodities'::text, 'macro'::text])),
    CONSTRAINT live_sessions_provider_check CHECK ((provider = ANY (ARRAY['clickmeeting'::text, 'external'::text]))),
    CONSTRAINT live_sessions_slug_check CHECK ((slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text)),
    CONSTRAINT live_sessions_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'scheduled'::text, 'live'::text, 'completed'::text, 'cancelled'::text]))),
    CONSTRAINT live_sessions_title_check CHECK ((length(TRIM(BOTH FROM title)) > 0))
);


--
-- Name: weekly_updates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.weekly_updates (
    id bigint NOT NULL,
    title text NOT NULL,
    slug text NOT NULL,
    summary text,
    key_takeaways jsonb DEFAULT '[]'::jsonb NOT NULL,
    market text,
    week_start_date date NOT NULL,
    mentor_student_id uuid,
    created_by_student_id uuid,
    access_tier text DEFAULT 'premium'::text NOT NULL,
    video_provider text DEFAULT 'mux'::text NOT NULL,
    video_url text,
    video_duration_seconds integer,
    thumbnail_url text,
    mux_asset_id text,
    mux_playback_id text,
    mux_playback_policy text DEFAULT 'signed'::text NOT NULL,
    mux_status text,
    mux_upload_id text,
    mux_error_message text,
    is_published boolean DEFAULT false NOT NULL,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    type text,
    content_format text DEFAULT 'video'::text NOT NULL,
    body text,
    image_paths text[] DEFAULT '{}'::text[] NOT NULL,
    markets text[] DEFAULT '{}'::text[] NOT NULL,
    actuality_status text DEFAULT 'current'::text NOT NULL,
    event_context text,
    period_label text,
    chapters jsonb DEFAULT '[]'::jsonb NOT NULL,
    related_content jsonb DEFAULT '[]'::jsonb NOT NULL,
    needs_review boolean DEFAULT false NOT NULL,
    published_by_student_id uuid,
    published_by_display_name text,
    content_kind text DEFAULT 'video'::text NOT NULL,
    intro text,
    article_html text,
    author_name text,
    update_structure jsonb,
    CONSTRAINT weekly_updates_access_tier_check CHECK ((access_tier = ANY (ARRAY['free'::text, 'full_course'::text, 'subscription'::text, 'premium'::text, 'mentor_membership'::text]))),
    CONSTRAINT weekly_updates_actuality_status_check CHECK ((actuality_status = ANY (ARRAY['current'::text, 'still_relevant'::text, 'archive'::text]))),
    CONSTRAINT weekly_updates_body_length_check CHECK (((body IS NULL) OR (char_length(body) <= 12000))),
    CONSTRAINT weekly_updates_chapters_array_check CHECK (((jsonb_typeof(chapters) = 'array'::text) AND (jsonb_typeof(related_content) = 'array'::text))),
    CONSTRAINT weekly_updates_content_format_check CHECK ((content_format = ANY (ARRAY['video'::text, 'chart'::text, 'text'::text]))),
    CONSTRAINT weekly_updates_content_kind_check CHECK ((content_kind = ANY (ARRAY['video'::text, 'article'::text]))),
    CONSTRAINT weekly_updates_image_paths_check CHECK (((cardinality(image_paths) <= 4) AND (array_position(image_paths, NULL::text) IS NULL) AND (array_position(image_paths, ''::text) IS NULL))),
    CONSTRAINT weekly_updates_key_takeaways_array_check CHECK ((jsonb_typeof(key_takeaways) = 'array'::text)),
    CONSTRAINT weekly_updates_market_check CHECK (((market IS NULL) OR (market = ANY (ARRAY['stocks'::text, 'forex'::text, 'crypto'::text, 'gold'::text, 'commodities'::text, 'trading'::text])))),
    CONSTRAINT weekly_updates_markets_check CHECK (((markets <@ ARRAY['stocks'::text, 'forex'::text, 'crypto'::text, 'gold'::text, 'commodities'::text, 'trading'::text, 'macro'::text, 'indices'::text, 'general'::text]) AND (array_position(markets, NULL::text) IS NULL))),
    CONSTRAINT weekly_updates_mux_playback_policy_check CHECK ((mux_playback_policy = ANY (ARRAY['public'::text, 'signed'::text]))),
    CONSTRAINT weekly_updates_mux_status_check CHECK (((mux_status IS NULL) OR (mux_status = ANY (ARRAY['preparing'::text, 'ready'::text, 'errored'::text])))),
    CONSTRAINT weekly_updates_published_non_video_check CHECK (((is_published IS NOT TRUE) OR (content_format = 'video'::text) OR ((type = 'market_update'::text) AND ((market IS NOT NULL) OR (cardinality(markets) > 0) OR COALESCE(((update_structure ->> 'category'::text) = ANY (ARRAY['indices'::text, 'general'::text])), false)) AND (body IS NOT NULL) AND ((char_length(btrim(body)) >= 20) OR (update_structure IS NOT NULL)) AND ((content_format = 'text'::text) OR (cardinality(image_paths) >= 1))))),
    CONSTRAINT weekly_updates_type_check CHECK (((type IS NULL) OR (type = ANY (ARRAY['weekly_outlook'::text, 'market_update'::text, 'live_session'::text])))),
    CONSTRAINT weekly_updates_type_market_check CHECK (((type IS NULL) OR ((type = 'market_update'::text) AND ((market IS NOT NULL) OR (cardinality(markets) > 0) OR COALESCE(((update_structure ->> 'category'::text) = ANY (ARRAY['indices'::text, 'general'::text])), false))) OR ((type = ANY (ARRAY['weekly_outlook'::text, 'live_session'::text])) AND (market IS NULL)))),
    CONSTRAINT weekly_updates_update_structure_check CHECK (((update_structure IS NULL) OR COALESCE(((type = 'market_update'::text) AND (jsonb_typeof(update_structure) = 'object'::text) AND ((update_structure -> 'version'::text) = '1'::jsonb) AND ((update_structure ->> 'category'::text) = ANY (ARRAY['crypto'::text, 'forex'::text, 'stocks'::text, 'gold'::text, 'commodities'::text, 'trading'::text, 'macro'::text, 'indices'::text, 'general'::text])) AND ((update_structure ->> 'type'::text) = ANY (ARRAY['setup'::text, 'analysis'::text, 'news'::text, 'education'::text])) AND (jsonb_typeof((update_structure -> 'fields'::text)) = 'object'::text) AND (jsonb_typeof((update_structure -> 'targets'::text)) = 'array'::text) AND (jsonb_typeof((update_structure -> 'history'::text)) = 'array'::text)), false))),
    CONSTRAINT weekly_updates_video_duration_seconds_check CHECK (((video_duration_seconds IS NULL) OR (video_duration_seconds >= 0))),
    CONSTRAINT weekly_updates_video_provider_check CHECK ((video_provider = ANY (ARRAY['mux'::text, 'vimeo'::text, 'youtube'::text])))
);


--
-- Name: COLUMN weekly_updates.content_format; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.weekly_updates.content_format IS 'Presentation format; existing rows remain video.';


--
-- Name: COLUMN weekly_updates.body; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.weekly_updates.body IS 'Plain-text analysis body, at most 12000 characters.';


--
-- Name: COLUMN weekly_updates.image_paths; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.weekly_updates.image_paths IS 'Private chart object paths, at most four per update.';


--
-- Name: COLUMN weekly_updates.markets; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.weekly_updates.markets IS 'Complete market tags. Six document markets plus distinct historical macro/indices/general. Scalar market and structure.category are compatibility projections.';


--
-- Name: COLUMN weekly_updates.chapters; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.weekly_updates.chapters IS 'Ordered {title,seconds,market?}; optional market references a selected update tag. Week date and period_label remain unchanged.';


--
-- Name: COLUMN weekly_updates.update_structure; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.weekly_updates.update_structure IS 'Versioned category, template and manual setup follow-up for the update rubric. Null preserves legacy content.';


--
-- Name: market_insight_content; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.market_insight_content WITH (security_invoker='true') AS
 SELECT ('video:'::text || (wu.id)::text) AS content_id,
        CASE
            WHEN (wu.type = 'weekly_outlook'::text) THEN 'weekly_outlook'::text
            WHEN (wu.type = 'live_session'::text) THEN 'live_session'::text
            ELSE 'market_breakdown'::text
        END AS format,
    wu.title,
    wu.slug,
    wu.summary,
        CASE
            WHEN (cardinality(wu.markets) > 0) THEN wu.markets
            WHEN (wu.market IS NOT NULL) THEN ARRAY[wu.market]
            ELSE '{}'::text[]
        END AS markets,
    wu.published_at AS occurs_at,
    wu.video_duration_seconds AS duration_seconds,
    wu.thumbnail_url,
    wu.actuality_status,
        CASE
            WHEN (wu.type = 'live_session'::text) THEN 'completed'::text
            ELSE 'published'::text
        END AS status,
    wu.needs_review,
    'weekly_updates'::text AS source_table,
    (wu.id)::text AS source_id
   FROM public.weekly_updates wu
  WHERE (wu.is_published = true)
UNION ALL
 SELECT ('live:'::text || (ls.id)::text) AS content_id,
    'live_session'::text AS format,
    ls.title,
    ls.slug,
    COALESCE(ls.summary, ls.description) AS summary,
    ls.markets,
    ls.starts_at AS occurs_at,
    (GREATEST((0)::numeric, EXTRACT(epoch FROM (ls.ends_at - ls.starts_at))))::integer AS duration_seconds,
    ls.thumbnail_url,
    'current'::text AS actuality_status,
    ls.status,
    false AS needs_review,
    'live_sessions'::text AS source_table,
    (ls.id)::text AS source_id
   FROM public.live_sessions ls
  WHERE (ls.is_published = true);


--
-- Name: VIEW market_insight_content; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.market_insight_content IS 'Unified, non-destructive read model for Weekvooruitblikken, Marktbreakdowns and Live marktsessies.';


--
-- Name: market_post_reactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.market_post_reactions (
    post_id bigint NOT NULL,
    student_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: modules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.modules (
    id integer NOT NULL,
    title text NOT NULL,
    description text,
    "order" integer,
    icon_url text,
    slug text NOT NULL,
    short_description text,
    order_index integer NOT NULL,
    thumbnail_url text,
    is_published boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_free boolean DEFAULT false NOT NULL
);


--
-- Name: COLUMN modules.is_free; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.modules.is_free IS 'Free level-1 access after intake; managed by platform admins. Reordering does not change access.';


--
-- Name: modules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.modules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: modules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.modules_id_seq OWNED BY public.modules.id;


--
-- Name: mux_webhook_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mux_webhook_events (
    event_id text NOT NULL,
    event_type text NOT NULL,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone,
    processing_error_code text
);


--
-- Name: notification_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type text NOT NULL,
    actor_student_id uuid,
    target_table text,
    target_id text,
    title text NOT NULL,
    body text,
    href text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notification_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_preferences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    notification_type text NOT NULL,
    in_app_enabled boolean DEFAULT true NOT NULL,
    email_enabled boolean DEFAULT true NOT NULL,
    push_enabled boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notification_recipients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_recipients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    student_id uuid NOT NULL,
    read_at timestamp with time zone,
    archived_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: one_time_purchases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.one_time_purchases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    product_key text NOT NULL,
    stripe_checkout_session_id text NOT NULL,
    stripe_payment_intent_id text,
    stripe_customer_id text NOT NULL,
    stripe_price_id text NOT NULL,
    amount_total integer NOT NULL,
    currency text NOT NULL,
    payment_status text NOT NULL,
    purchased_at timestamp with time zone NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT one_time_purchases_amount_total_check CHECK ((amount_total >= 0)),
    CONSTRAINT one_time_purchases_currency_check CHECK ((currency ~ '^[a-z]{3}$'::text)),
    CONSTRAINT one_time_purchases_payment_status_check CHECK ((payment_status = ANY (ARRAY['paid'::text, 'refunded'::text, 'disputed'::text]))),
    CONSTRAINT one_time_purchases_product_key_check CHECK ((product_key = 'academy'::text))
);


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    stripe_session_id text NOT NULL,
    stripe_payment_intent_id text,
    amount integer NOT NULL,
    currency text NOT NULL,
    status text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pdf_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pdf_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    weekly_update_id bigint,
    module_id bigint,
    title text NOT NULL,
    object_path text NOT NULL,
    byte_size integer NOT NULL,
    page_count integer NOT NULL,
    sha256 text NOT NULL,
    version uuid DEFAULT gen_random_uuid() NOT NULL,
    state text DEFAULT 'draft'::text NOT NULL,
    storage_ready boolean DEFAULT false NOT NULL,
    accessible_html text DEFAULT ''::text NOT NULL,
    accessible_verified boolean DEFAULT false NOT NULL,
    error_message text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    shelf text DEFAULT 'course'::text NOT NULL,
    cover_path text,
    CONSTRAINT pdf_cover_path_valid CHECK (((cover_path IS NULL) OR (cover_path ~ (('^covers/'::text || (id)::text) || '/[a-f0-9-]{36}\.webp$'::text)))),
    CONSTRAINT pdf_documents_accessible_html_check CHECK ((length(accessible_html) <= 100000)),
    CONSTRAINT pdf_documents_byte_size_check CHECK (((byte_size >= 1) AND (byte_size <= 3145728))),
    CONSTRAINT pdf_documents_check CHECK ((num_nonnulls(weekly_update_id, module_id) = 1)),
    CONSTRAINT pdf_documents_check1 CHECK ((object_path = (('documents/'::text || (id)::text) || '/source.pdf'::text))),
    CONSTRAINT pdf_documents_check2 CHECK (((state <> 'ready'::text) OR (storage_ready AND accessible_verified AND (length(accessible_html) > 20)))),
    CONSTRAINT pdf_documents_description_check CHECK ((length(description) <= 600)),
    CONSTRAINT pdf_documents_page_count_check CHECK (((page_count >= 1) AND (page_count <= 150))),
    CONSTRAINT pdf_documents_sha256_check CHECK ((sha256 ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT pdf_documents_shelf_check CHECK ((shelf = ANY (ARRAY['course'::text, 'toolbox'::text]))),
    CONSTRAINT pdf_documents_sort_order_check CHECK (((sort_order >= 0) AND (sort_order <= 10000))),
    CONSTRAINT pdf_documents_state_check CHECK ((state = ANY (ARRAY['draft'::text, 'ready'::text, 'deleting'::text, 'error'::text]))),
    CONSTRAINT pdf_documents_title_check CHECK (((length(title) >= 1) AND (length(title) <= 160)))
);


--
-- Name: pdf_open_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pdf_open_logs (
    id bigint NOT NULL,
    document_id uuid NOT NULL,
    document_version uuid NOT NULL,
    document_title text NOT NULL,
    weekly_update_id bigint,
    module_id bigint,
    student_id uuid NOT NULL,
    request_id uuid NOT NULL,
    opened_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pdf_open_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.pdf_open_logs ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.pdf_open_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: pdf_positions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pdf_positions (
    student_id uuid NOT NULL,
    document_id uuid NOT NULL,
    document_version uuid NOT NULL,
    page integer NOT NULL,
    revision bigint NOT NULL,
    session_id uuid NOT NULL,
    client_sequence integer NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pdf_positions_client_sequence_check CHECK ((client_sequence > 0)),
    CONSTRAINT pdf_positions_page_check CHECK (((page >= 1) AND (page <= 150))),
    CONSTRAINT pdf_positions_revision_check CHECK ((revision > 0))
);


--
-- Name: practical_lessons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.practical_lessons (
    id integer NOT NULL,
    module_id integer NOT NULL,
    title text NOT NULL,
    description text,
    location text,
    thumbnail_url text
);


--
-- Name: practical_lessons_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.practical_lessons_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: practical_lessons_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.practical_lessons_id_seq OWNED BY public.practical_lessons.id;


--
-- Name: product_board_cycles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_board_cycles (
    board text NOT NULL,
    goal text DEFAULT ''::text NOT NULL,
    starts_on date,
    ends_on date,
    feedback text DEFAULT ''::text NOT NULL,
    version integer DEFAULT 0 NOT NULL,
    CONSTRAINT product_board_cycles_board_check CHECK ((board = ANY (ARRAY['development'::text, 'team'::text]))),
    CONSTRAINT product_board_cycles_check CHECK (((ends_on IS NULL) OR (starts_on IS NULL) OR (ends_on >= starts_on))),
    CONSTRAINT product_board_cycles_feedback_check CHECK ((length(feedback) <= 3000)),
    CONSTRAINT product_board_cycles_goal_check CHECK ((length(goal) <= 1000)),
    CONSTRAINT product_board_cycles_version_check CHECK ((version >= 0))
);


--
-- Name: product_board_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_board_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    result text DEFAULT ''::text NOT NULL,
    proof text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'todo'::text NOT NULL,
    priority text DEFAULT 'P2'::text NOT NULL,
    owner_id uuid,
    due_date date,
    blocker text DEFAULT ''::text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    version integer DEFAULT 0 NOT NULL,
    CONSTRAINT product_board_tasks_blocker_check CHECK ((length(blocker) <= 3000)),
    CONSTRAINT product_board_tasks_check CHECK (((status <> 'blocked'::text) OR (length(btrim(blocker)) >= 5))),
    CONSTRAINT product_board_tasks_check1 CHECK (((status <> 'done'::text) OR ((length(btrim(result)) >= 5) AND (length(btrim(proof)) >= 5)))),
    CONSTRAINT product_board_tasks_description_check CHECK ((length(description) <= 3000)),
    CONSTRAINT product_board_tasks_priority_check CHECK ((priority = ANY (ARRAY['P1'::text, 'P2'::text, 'P3'::text]))),
    CONSTRAINT product_board_tasks_proof_check CHECK ((length(proof) <= 3000)),
    CONSTRAINT product_board_tasks_result_check CHECK ((length(result) <= 3000)),
    CONSTRAINT product_board_tasks_status_check CHECK ((status = ANY (ARRAY['todo'::text, 'doing'::text, 'review'::text, 'done'::text, 'blocked'::text]))),
    CONSTRAINT product_board_tasks_title_check CHECK (((length(btrim(title)) >= 3) AND (length(btrim(title)) <= 160))),
    CONSTRAINT product_board_tasks_version_check CHECK ((version >= 0))
);


--
-- Name: progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.progress (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid,
    lesson_id integer,
    watched boolean DEFAULT false,
    watched_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: stripe_webhook_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stripe_webhook_events (
    stripe_event_id text NOT NULL,
    event_type text NOT NULL,
    event_created_at timestamp with time zone NOT NULL,
    processing_status text DEFAULT 'processing'::text NOT NULL,
    processed_at timestamp with time zone,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT stripe_webhook_events_processing_status_check CHECK ((processing_status = ANY (ARRAY['processing'::text, 'completed'::text, 'failed'::text])))
);


--
-- Name: student_avatars; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_avatars (
    student_id uuid NOT NULL,
    object_path text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: student_entitlements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_entitlements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    entitlement_key text NOT NULL,
    source_type text NOT NULL,
    source_id text NOT NULL,
    starts_at timestamp with time zone DEFAULT now() NOT NULL,
    ends_at timestamp with time zone,
    revoked_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT student_entitlements_check CHECK (((ends_at IS NULL) OR (ends_at > starts_at))),
    CONSTRAINT student_entitlements_entitlement_key_check CHECK ((entitlement_key ~ '^[a-z][a-z0-9_]*$'::text)),
    CONSTRAINT student_entitlements_source_type_check CHECK ((source_type = ANY (ARRAY['stripe_subscription'::text, 'academy_bonus'::text, 'legacy_academy_bonus'::text, 'manual'::text])))
);


--
-- Name: student_mentor_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_mentor_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    author_student_id uuid,
    body text NOT NULL,
    is_pinned boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT student_mentor_notes_body_check CHECK ((length(TRIM(BOTH FROM body)) > 0))
);


--
-- Name: student_onboarding_responses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_onboarding_responses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    experience_level text,
    primary_market text,
    main_challenge text,
    goal_90_days text,
    weekly_time_commitment text,
    mentorship_interest text,
    tools jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    confidence_score integer,
    completed_at timestamp with time zone,
    intake_version text DEFAULT 'v1'::text NOT NULL,
    CONSTRAINT student_onboarding_confidence_score_check CHECK (((confidence_score IS NULL) OR ((confidence_score >= 1) AND (confidence_score <= 5))))
);


--
-- Name: students; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.students (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    name text,
    created_at timestamp with time zone DEFAULT now(),
    last_seen timestamp with time zone,
    auth_user_id uuid NOT NULL,
    access_level smallint DEFAULT 1,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    phone text,
    mentor_status text DEFAULT 'active'::text NOT NULL,
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    onboarding_skipped_at timestamp with time zone,
    CONSTRAINT phone_length_check CHECK (((phone IS NULL) OR ((length(phone) >= 8) AND (length(phone) <= 20)))),
    CONSTRAINT students_mentor_status_check CHECK ((mentor_status = ANY (ARRAY['active'::text, 'watch'::text, 'needs_attention'::text])))
);


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    stripe_subscription_id text NOT NULL,
    stripe_customer_id text NOT NULL,
    stripe_price_id text NOT NULL,
    status text NOT NULL,
    current_period_start timestamp with time zone,
    current_period_end timestamp with time zone,
    cancel_at_period_end boolean DEFAULT false NOT NULL,
    cancel_at timestamp with time zone,
    canceled_at timestamp with time zone,
    ended_at timestamp with time zone,
    trial_end timestamp with time zone,
    latest_invoice_id text,
    last_stripe_event_created_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT subscriptions_status_check CHECK ((status = ANY (ARRAY['incomplete'::text, 'incomplete_expired'::text, 'trialing'::text, 'active'::text, 'past_due'::text, 'canceled'::text, 'unpaid'::text, 'paused'::text])))
);


--
-- Name: update_reads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.update_reads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    update_id uuid NOT NULL,
    student_id uuid NOT NULL,
    read_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: updates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.updates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    author_id uuid NOT NULL,
    title text,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    image_path text
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    student_id uuid NOT NULL,
    role text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_roles_role_check CHECK ((role = ANY (ARRAY['student'::text, 'mentor'::text, 'content_manager'::text, 'admin'::text])))
);


--
-- Name: video_positions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.video_positions ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.video_positions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: weekly_update_views; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.weekly_update_views (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    weekly_update_id bigint NOT NULL,
    watched boolean DEFAULT false NOT NULL,
    watched_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: weekly_updates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.weekly_updates_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: weekly_updates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.weekly_updates_id_seq OWNED BY public.weekly_updates.id;


--
-- Name: exam_answer_options id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exam_answer_options ALTER COLUMN id SET DEFAULT nextval('public.exam_answer_options_id_seq'::regclass);


--
-- Name: exam_questions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exam_questions ALTER COLUMN id SET DEFAULT nextval('public.exam_questions_id_seq'::regclass);


--
-- Name: exams id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exams ALTER COLUMN id SET DEFAULT nextval('public.exams_id_seq'::regclass);


--
-- Name: lessons id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lessons ALTER COLUMN id SET DEFAULT nextval('public.lessons_id_seq'::regclass);


--
-- Name: modules id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modules ALTER COLUMN id SET DEFAULT nextval('public.modules_id_seq'::regclass);


--
-- Name: practical_lessons id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.practical_lessons ALTER COLUMN id SET DEFAULT nextval('public.practical_lessons_id_seq'::regclass);


--
-- Name: weekly_updates id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_updates ALTER COLUMN id SET DEFAULT nextval('public.weekly_updates_id_seq'::regclass);


--
-- Name: academy_rubric_modules academy_rubric_modules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.academy_rubric_modules
    ADD CONSTRAINT academy_rubric_modules_pkey PRIMARY KEY (rubric_id, module_id);


--
-- Name: academy_rubrics academy_rubrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.academy_rubrics
    ADD CONSTRAINT academy_rubrics_pkey PRIMARY KEY (id);


--
-- Name: academy_rubrics academy_rubrics_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.academy_rubrics
    ADD CONSTRAINT academy_rubrics_slug_key UNIQUE (slug);


--
-- Name: admin_audit_log admin_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_audit_log
    ADD CONSTRAINT admin_audit_log_pkey PRIMARY KEY (id);


--
-- Name: ai_interactions ai_interactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_interactions
    ADD CONSTRAINT ai_interactions_pkey PRIMARY KEY (id);


--
-- Name: ai_student_summaries ai_student_summaries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_student_summaries
    ADD CONSTRAINT ai_student_summaries_pkey PRIMARY KEY (id);


--
-- Name: ai_student_summaries ai_student_summaries_student_id_feature_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_student_summaries
    ADD CONSTRAINT ai_student_summaries_student_id_feature_key UNIQUE (student_id, feature);


--
-- Name: ai_video_enrichments ai_video_enrichments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_video_enrichments
    ADD CONSTRAINT ai_video_enrichments_pkey PRIMARY KEY (id);


--
-- Name: ai_video_enrichments ai_video_enrichments_transcript_id_prompt_version_model_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_video_enrichments
    ADD CONSTRAINT ai_video_enrichments_transcript_id_prompt_version_model_key UNIQUE (transcript_id, prompt_version, model);


--
-- Name: ai_video_transcripts ai_video_transcripts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_video_transcripts
    ADD CONSTRAINT ai_video_transcripts_pkey PRIMARY KEY (id);


--
-- Name: ai_video_transcripts ai_video_transcripts_weekly_update_id_source_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_video_transcripts
    ADD CONSTRAINT ai_video_transcripts_weekly_update_id_source_version_key UNIQUE (weekly_update_id, source_version);


--
-- Name: ai_video_workflows ai_video_workflows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_video_workflows
    ADD CONSTRAINT ai_video_workflows_pkey PRIMARY KEY (id);


--
-- Name: ai_video_workflows ai_video_workflows_transcript_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_video_workflows
    ADD CONSTRAINT ai_video_workflows_transcript_id_key UNIQUE (transcript_id);


--
-- Name: avatar_objects avatar_objects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.avatar_objects
    ADD CONSTRAINT avatar_objects_pkey PRIMARY KEY (object_path);


--
-- Name: billing_customers billing_customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_customers
    ADD CONSTRAINT billing_customers_pkey PRIMARY KEY (student_id);


--
-- Name: billing_customers billing_customers_stripe_customer_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_customers
    ADD CONSTRAINT billing_customers_stripe_customer_id_key UNIQUE (stripe_customer_id);


--
-- Name: chat_email_outbox chat_email_outbox_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_email_outbox
    ADD CONSTRAINT chat_email_outbox_pkey PRIMARY KEY (id);


--
-- Name: chat_email_outbox chat_email_outbox_provider_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_email_outbox
    ADD CONSTRAINT chat_email_outbox_provider_id_key UNIQUE (provider_id);


--
-- Name: chat_email_outbox chat_email_outbox_recipient_participant_id_last_message_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_email_outbox
    ADD CONSTRAINT chat_email_outbox_recipient_participant_id_last_message_id_key UNIQUE (recipient_participant_id, last_message_id);


--
-- Name: chat_email_preferences chat_email_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_email_preferences
    ADD CONSTRAINT chat_email_preferences_pkey PRIMARY KEY (student_id);


--
-- Name: chat_mentor_config chat_mentor_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_mentor_config
    ADD CONSTRAINT chat_mentor_config_pkey PRIMARY KEY (singleton);


--
-- Name: chat_presence_sessions chat_presence_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_presence_sessions
    ADD CONSTRAINT chat_presence_sessions_pkey PRIMARY KEY (student_id, session_id);


--
-- Name: chat_principals chat_principals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_principals
    ADD CONSTRAINT chat_principals_pkey PRIMARY KEY (id);


--
-- Name: conversation_attachments conversation_attachments_message_id_position_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_attachments
    ADD CONSTRAINT conversation_attachments_message_id_position_key UNIQUE (message_id, "position");


--
-- Name: conversation_attachments conversation_attachments_object_path_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_attachments
    ADD CONSTRAINT conversation_attachments_object_path_key UNIQUE (object_path);


--
-- Name: conversation_attachments conversation_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_attachments
    ADD CONSTRAINT conversation_attachments_pkey PRIMARY KEY (id);


--
-- Name: conversation_events conversation_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_events
    ADD CONSTRAINT conversation_events_pkey PRIMARY KEY (id);


--
-- Name: conversation_message_reactions conversation_message_reaction_message_id_student_id_reactio_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_message_reactions
    ADD CONSTRAINT conversation_message_reaction_message_id_student_id_reactio_key UNIQUE (message_id, student_id, reaction);


--
-- Name: conversation_message_reactions conversation_message_reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_message_reactions
    ADD CONSTRAINT conversation_message_reactions_pkey PRIMARY KEY (id);


--
-- Name: conversation_messages conversation_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_messages
    ADD CONSTRAINT conversation_messages_pkey PRIMARY KEY (id);


--
-- Name: conversation_participants conversation_participants_id_principal_id_thread_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_id_principal_id_thread_id_key UNIQUE (id, principal_id, thread_id);


--
-- Name: conversation_participants conversation_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_pkey PRIMARY KEY (id);


--
-- Name: conversation_participants conversation_participants_thread_id_principal_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_thread_id_principal_id_role_key UNIQUE (thread_id, principal_id, role);


--
-- Name: conversation_threads conversation_threads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_threads
    ADD CONSTRAINT conversation_threads_pkey PRIMARY KEY (id);


--
-- Name: exam_answer_options exam_answer_options_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exam_answer_options
    ADD CONSTRAINT exam_answer_options_pkey PRIMARY KEY (id);


--
-- Name: exam_attempt_answers exam_attempt_answers_attempt_id_question_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exam_attempt_answers
    ADD CONSTRAINT exam_attempt_answers_attempt_id_question_id_key UNIQUE (attempt_id, question_id);


--
-- Name: exam_attempt_answers exam_attempt_answers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exam_attempt_answers
    ADD CONSTRAINT exam_attempt_answers_pkey PRIMARY KEY (id);


--
-- Name: exam_attempt_questions exam_attempt_questions_attempt_id_order_index_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exam_attempt_questions
    ADD CONSTRAINT exam_attempt_questions_attempt_id_order_index_key UNIQUE (attempt_id, order_index);


--
-- Name: exam_attempt_questions exam_attempt_questions_attempt_id_question_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exam_attempt_questions
    ADD CONSTRAINT exam_attempt_questions_attempt_id_question_id_key UNIQUE (attempt_id, question_id);


--
-- Name: exam_attempt_questions exam_attempt_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exam_attempt_questions
    ADD CONSTRAINT exam_attempt_questions_pkey PRIMARY KEY (id);


--
-- Name: exam_attempts exam_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exam_attempts
    ADD CONSTRAINT exam_attempts_pkey PRIMARY KEY (id);


--
-- Name: exam_questions exam_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exam_questions
    ADD CONSTRAINT exam_questions_pkey PRIMARY KEY (id);


--
-- Name: exam_results exam_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exam_results
    ADD CONSTRAINT exam_results_pkey PRIMARY KEY (id);


--
-- Name: exams exams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT exams_pkey PRIMARY KEY (id);


--
-- Name: legacy_academy_module_access legacy_academy_module_access_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.legacy_academy_module_access
    ADD CONSTRAINT legacy_academy_module_access_pkey PRIMARY KEY (student_id, module_id);


--
-- Name: lesson_action_progress lesson_action_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_action_progress
    ADD CONSTRAINT lesson_action_progress_pkey PRIMARY KEY (id);


--
-- Name: lesson_action_progress lesson_action_progress_student_id_lesson_id_action_index_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_action_progress
    ADD CONSTRAINT lesson_action_progress_student_id_lesson_id_action_index_key UNIQUE (student_id, lesson_id, action_index);


--
-- Name: lessons lessons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lessons
    ADD CONSTRAINT lessons_pkey PRIMARY KEY (id);


--
-- Name: live_session_provider_secrets live_session_provider_secrets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_session_provider_secrets
    ADD CONSTRAINT live_session_provider_secrets_pkey PRIMARY KEY (live_session_id);


--
-- Name: live_sessions live_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_sessions
    ADD CONSTRAINT live_sessions_pkey PRIMARY KEY (id);


--
-- Name: live_sessions live_sessions_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_sessions
    ADD CONSTRAINT live_sessions_slug_key UNIQUE (slug);


--
-- Name: market_post_reactions market_post_reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.market_post_reactions
    ADD CONSTRAINT market_post_reactions_pkey PRIMARY KEY (post_id, student_id);


--
-- Name: modules modules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modules
    ADD CONSTRAINT modules_pkey PRIMARY KEY (id);


--
-- Name: mux_webhook_events mux_webhook_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mux_webhook_events
    ADD CONSTRAINT mux_webhook_events_pkey PRIMARY KEY (event_id);


--
-- Name: notification_events notification_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_events
    ADD CONSTRAINT notification_events_pkey PRIMARY KEY (id);


--
-- Name: notification_preferences notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_pkey PRIMARY KEY (id);


--
-- Name: notification_preferences notification_preferences_student_id_notification_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_student_id_notification_type_key UNIQUE (student_id, notification_type);


--
-- Name: notification_recipients notification_recipients_event_id_student_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_recipients
    ADD CONSTRAINT notification_recipients_event_id_student_id_key UNIQUE (event_id, student_id);


--
-- Name: notification_recipients notification_recipients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_recipients
    ADD CONSTRAINT notification_recipients_pkey PRIMARY KEY (id);


--
-- Name: one_time_purchases one_time_purchases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.one_time_purchases
    ADD CONSTRAINT one_time_purchases_pkey PRIMARY KEY (id);


--
-- Name: one_time_purchases one_time_purchases_stripe_checkout_session_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.one_time_purchases
    ADD CONSTRAINT one_time_purchases_stripe_checkout_session_id_key UNIQUE (stripe_checkout_session_id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: payments payments_stripe_session_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_stripe_session_id_key UNIQUE (stripe_session_id);


--
-- Name: pdf_documents pdf_documents_object_path_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdf_documents
    ADD CONSTRAINT pdf_documents_object_path_key UNIQUE (object_path);


--
-- Name: pdf_documents pdf_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdf_documents
    ADD CONSTRAINT pdf_documents_pkey PRIMARY KEY (id);


--
-- Name: pdf_open_logs pdf_open_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdf_open_logs
    ADD CONSTRAINT pdf_open_logs_pkey PRIMARY KEY (id);


--
-- Name: pdf_open_logs pdf_open_logs_student_id_document_id_request_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdf_open_logs
    ADD CONSTRAINT pdf_open_logs_student_id_document_id_request_id_key UNIQUE (student_id, document_id, request_id);


--
-- Name: pdf_positions pdf_positions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdf_positions
    ADD CONSTRAINT pdf_positions_pkey PRIMARY KEY (student_id, document_id);


--
-- Name: practical_lessons practical_lessons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.practical_lessons
    ADD CONSTRAINT practical_lessons_pkey PRIMARY KEY (id);


--
-- Name: product_board_cycles product_board_cycles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_board_cycles
    ADD CONSTRAINT product_board_cycles_pkey PRIMARY KEY (board);


--
-- Name: product_board_tasks product_board_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_board_tasks
    ADD CONSTRAINT product_board_tasks_pkey PRIMARY KEY (id);


--
-- Name: progress progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.progress
    ADD CONSTRAINT progress_pkey PRIMARY KEY (id);


--
-- Name: stripe_webhook_events stripe_webhook_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stripe_webhook_events
    ADD CONSTRAINT stripe_webhook_events_pkey PRIMARY KEY (stripe_event_id);


--
-- Name: student_avatars student_avatars_object_path_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_avatars
    ADD CONSTRAINT student_avatars_object_path_key UNIQUE (object_path);


--
-- Name: student_avatars student_avatars_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_avatars
    ADD CONSTRAINT student_avatars_pkey PRIMARY KEY (student_id);


--
-- Name: student_entitlements student_entitlements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_entitlements
    ADD CONSTRAINT student_entitlements_pkey PRIMARY KEY (id);


--
-- Name: student_entitlements student_entitlements_student_id_entitlement_key_source_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_entitlements
    ADD CONSTRAINT student_entitlements_student_id_entitlement_key_source_type_key UNIQUE (student_id, entitlement_key, source_type, source_id);


--
-- Name: student_mentor_notes student_mentor_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_mentor_notes
    ADD CONSTRAINT student_mentor_notes_pkey PRIMARY KEY (id);


--
-- Name: student_onboarding_responses student_onboarding_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_onboarding_responses
    ADD CONSTRAINT student_onboarding_responses_pkey PRIMARY KEY (id);


--
-- Name: student_onboarding_responses student_onboarding_responses_student_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_onboarding_responses
    ADD CONSTRAINT student_onboarding_responses_student_id_key UNIQUE (student_id);


--
-- Name: students students_auth_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_auth_user_id_key UNIQUE (auth_user_id);


--
-- Name: students students_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_email_key UNIQUE (email);


--
-- Name: students students_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_stripe_subscription_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_stripe_subscription_id_key UNIQUE (stripe_subscription_id);


--
-- Name: update_reads update_reads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.update_reads
    ADD CONSTRAINT update_reads_pkey PRIMARY KEY (id);


--
-- Name: update_reads update_reads_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.update_reads
    ADD CONSTRAINT update_reads_unique UNIQUE (update_id, student_id);


--
-- Name: updates updates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.updates
    ADD CONSTRAINT updates_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (student_id, role);


--
-- Name: video_positions video_positions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_positions
    ADD CONSTRAINT video_positions_pkey PRIMARY KEY (id);


--
-- Name: weekly_update_views weekly_update_views_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_update_views
    ADD CONSTRAINT weekly_update_views_pkey PRIMARY KEY (id);


--
-- Name: weekly_update_views weekly_update_views_student_id_weekly_update_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_update_views
    ADD CONSTRAINT weekly_update_views_student_id_weekly_update_id_key UNIQUE (student_id, weekly_update_id);


--
-- Name: weekly_updates weekly_updates_chapters_contract_check; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.weekly_updates
    ADD CONSTRAINT weekly_updates_chapters_contract_check CHECK (public.valid_market_chapters(chapters, (video_duration_seconds)::numeric, markets)) NOT VALID;


--
-- Name: weekly_updates weekly_updates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_updates
    ADD CONSTRAINT weekly_updates_pkey PRIMARY KEY (id);


--
-- Name: weekly_updates weekly_updates_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_updates
    ADD CONSTRAINT weekly_updates_slug_key UNIQUE (slug);


--
-- Name: avatar_objects_cleanup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX avatar_objects_cleanup ON public.avatar_objects USING btree (state, created_at);


--
-- Name: chat_email_outbox_bundle; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chat_email_outbox_bundle ON public.chat_email_outbox USING btree (thread_id, recipient_participant_id, due_at) WHERE ((status = ANY (ARRAY['queued'::text, 'retry'::text])) AND (first_attempt_at IS NULL));


--
-- Name: chat_email_outbox_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chat_email_outbox_due ON public.chat_email_outbox USING btree (due_at, created_at) WHERE (status = ANY (ARRAY['queued'::text, 'retry'::text, 'leased'::text]));


--
-- Name: chat_principals_human_student_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX chat_principals_human_student_unique ON public.chat_principals USING btree (student_id) WHERE (kind = 'human'::text);


--
-- Name: conversation_attachments_message; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conversation_attachments_message ON public.conversation_attachments USING btree (message_id, "position") WHERE (message_id IS NOT NULL);


--
-- Name: conversation_attachments_upload_deduplication; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX conversation_attachments_upload_deduplication ON public.conversation_attachments USING btree (uploader_student_id, upload_intent, content_sha256) WHERE (state = ANY (ARRAY['pending'::text, 'ready'::text, 'attached'::text]));


--
-- Name: conversation_attachments_uploader; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conversation_attachments_uploader ON public.conversation_attachments USING btree (uploader_student_id, created_at DESC);


--
-- Name: conversation_messages_client_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX conversation_messages_client_unique ON public.conversation_messages USING btree (thread_id, sender_student_id, client_message_id) WHERE (client_message_id IS NOT NULL);


--
-- Name: conversation_messages_principal_intent_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX conversation_messages_principal_intent_unique ON public.conversation_messages USING btree (thread_id, sender_principal_id, client_message_id) WHERE ((sender_principal_id IS NOT NULL) AND (client_message_id IS NOT NULL));


--
-- Name: conversation_messages_public_page; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conversation_messages_public_page ON public.conversation_messages USING btree (thread_id, public_seq DESC) WHERE ((NOT is_internal) AND (deleted_at IS NULL));


--
-- Name: conversation_messages_public_sequence_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX conversation_messages_public_sequence_unique ON public.conversation_messages USING btree (thread_id, public_seq) WHERE (public_seq IS NOT NULL);


--
-- Name: conversation_participants_active_principal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conversation_participants_active_principal ON public.conversation_participants USING btree (principal_id, thread_id) WHERE active;


--
-- Name: conversation_participants_single_active_mentor; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX conversation_participants_single_active_mentor ON public.conversation_participants USING btree (thread_id) WHERE (active AND (role = 'mentor'::text));


--
-- Name: conversation_participants_single_active_student; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX conversation_participants_single_active_student ON public.conversation_participants USING btree (thread_id) WHERE (active AND (role = 'student'::text));


--
-- Name: conversation_threads_mentor_inbox_page; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conversation_threads_mentor_inbox_page ON public.conversation_threads USING btree (COALESCE(last_message_at, created_at) DESC, id DESC) WHERE (source_type = 'mentor_chat'::text);


--
-- Name: conversation_threads_student_mentor_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX conversation_threads_student_mentor_unique ON public.conversation_threads USING btree (student_id, assigned_to_student_id) WHERE ((source_type = 'mentor_chat'::text) AND (source_id IS NULL));


--
-- Name: exam_questions_exam_order_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX exam_questions_exam_order_unique ON public.exam_questions USING btree (exam_id, order_index);


--
-- Name: exams_module_id_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX exams_module_id_unique ON public.exams USING btree (module_id);


--
-- Name: idx_admin_audit_log_actor_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_audit_log_actor_created_at ON public.admin_audit_log USING btree (actor_student_id, created_at DESC);


--
-- Name: idx_admin_audit_log_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_audit_log_created_at ON public.admin_audit_log USING btree (created_at DESC);


--
-- Name: idx_admin_audit_log_target_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_audit_log_target_created_at ON public.admin_audit_log USING btree (target_student_id, created_at DESC) WHERE (target_student_id IS NOT NULL);


--
-- Name: idx_ai_interactions_feature; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_interactions_feature ON public.ai_interactions USING btree (feature, created_at DESC);


--
-- Name: idx_ai_interactions_student; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_interactions_student ON public.ai_interactions USING btree (student_id, created_at DESC);


--
-- Name: idx_ai_student_summaries_student; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_student_summaries_student ON public.ai_student_summaries USING btree (student_id);


--
-- Name: idx_ai_video_enrichments_transcript_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_video_enrichments_transcript_status ON public.ai_video_enrichments USING btree (transcript_id, status, updated_at DESC);


--
-- Name: idx_ai_video_transcripts_update_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_video_transcripts_update_status ON public.ai_video_transcripts USING btree (weekly_update_id, status, updated_at DESC);


--
-- Name: idx_ai_video_workflows_runnable; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_video_workflows_runnable ON public.ai_video_workflows USING btree (status, next_attempt_at, lease_expires_at);


--
-- Name: idx_conversation_events_thread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversation_events_thread ON public.conversation_events USING btree (thread_id, created_at DESC);


--
-- Name: idx_conversation_messages_sender; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversation_messages_sender ON public.conversation_messages USING btree (sender_student_id, created_at DESC) WHERE (sender_student_id IS NOT NULL);


--
-- Name: idx_conversation_messages_thread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversation_messages_thread ON public.conversation_messages USING btree (thread_id, created_at);


--
-- Name: idx_conversation_messages_thread_public; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversation_messages_thread_public ON public.conversation_messages USING btree (thread_id, created_at) WHERE ((is_internal = false) AND (deleted_at IS NULL));


--
-- Name: idx_conversation_threads_assigned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversation_threads_assigned ON public.conversation_threads USING btree (assigned_to_student_id, last_message_at DESC NULLS LAST) WHERE (assigned_to_student_id IS NOT NULL);


--
-- Name: idx_conversation_threads_inbox; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversation_threads_inbox ON public.conversation_threads USING btree (status, last_message_at DESC NULLS LAST);


--
-- Name: idx_conversation_threads_student; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversation_threads_student ON public.conversation_threads USING btree (student_id, last_message_at DESC NULLS LAST);


--
-- Name: idx_conversation_threads_unread_mentor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversation_threads_unread_mentor ON public.conversation_threads USING btree (unread_for_mentor_count, last_message_at DESC NULLS LAST) WHERE (unread_for_mentor_count > 0);


--
-- Name: idx_exam_answer_options_one_correct; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_exam_answer_options_one_correct ON public.exam_answer_options USING btree (question_id) WHERE (is_correct = true);


--
-- Name: idx_exam_answer_options_question_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exam_answer_options_question_id ON public.exam_answer_options USING btree (question_id, order_index);


--
-- Name: idx_exam_attempt_answers_attempt_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exam_attempt_answers_attempt_id ON public.exam_attempt_answers USING btree (attempt_id);


--
-- Name: idx_exam_attempt_answers_question_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exam_attempt_answers_question_id ON public.exam_attempt_answers USING btree (question_id);


--
-- Name: idx_exam_attempt_questions_attempt_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exam_attempt_questions_attempt_id ON public.exam_attempt_questions USING btree (attempt_id, order_index);


--
-- Name: idx_exam_attempt_questions_question_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exam_attempt_questions_question_id ON public.exam_attempt_questions USING btree (question_id);


--
-- Name: idx_exam_attempts_exam_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exam_attempts_exam_id ON public.exam_attempts USING btree (exam_id, created_at DESC);


--
-- Name: idx_exam_attempts_in_progress; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exam_attempts_in_progress ON public.exam_attempts USING btree (student_id, module_id, created_at DESC) WHERE (status = 'in_progress'::text);


--
-- Name: idx_exam_attempts_module_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exam_attempts_module_id ON public.exam_attempts USING btree (module_id, created_at DESC);


--
-- Name: idx_exam_attempts_student_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exam_attempts_student_id ON public.exam_attempts USING btree (student_id, created_at DESC);


--
-- Name: idx_exam_attempts_submitted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exam_attempts_submitted_at ON public.exam_attempts USING btree (submitted_at DESC) WHERE (submitted_at IS NOT NULL);


--
-- Name: idx_exam_questions_module_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exam_questions_module_active ON public.exam_questions USING btree (module_id, is_active) WHERE ((is_active = true) AND (deleted_at IS NULL));


--
-- Name: idx_exam_questions_module_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exam_questions_module_id ON public.exam_questions USING btree (module_id);


--
-- Name: idx_exams_is_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exams_is_published ON public.exams USING btree (is_published) WHERE (is_published = true);


--
-- Name: idx_lesson_action_progress_lesson_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lesson_action_progress_lesson_id ON public.lesson_action_progress USING btree (lesson_id);


--
-- Name: idx_lesson_action_progress_student_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lesson_action_progress_student_id ON public.lesson_action_progress USING btree (student_id);


--
-- Name: idx_lessons_is_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lessons_is_published ON public.lessons USING btree (is_published) WHERE (is_published = true);


--
-- Name: idx_lessons_mux_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lessons_mux_status ON public.lessons USING btree (mux_status) WHERE (mux_status IS NOT NULL);


--
-- Name: idx_live_sessions_archive; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_live_sessions_archive ON public.live_sessions USING btree (starts_at DESC) WHERE ((is_published = true) AND (status = ANY (ARRAY['completed'::text, 'cancelled'::text])));


--
-- Name: idx_live_sessions_mentor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_live_sessions_mentor ON public.live_sessions USING btree (mentor_student_id, starts_at DESC);


--
-- Name: idx_live_sessions_upcoming; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_live_sessions_upcoming ON public.live_sessions USING btree (starts_at) WHERE ((is_published = true) AND (status = ANY (ARRAY['scheduled'::text, 'live'::text])));


--
-- Name: idx_modules_is_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_modules_is_published ON public.modules USING btree (is_published) WHERE (is_published = true);


--
-- Name: idx_notification_events_type_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_events_type_created ON public.notification_events USING btree (type, created_at DESC);


--
-- Name: idx_notification_recipients_student_all; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_recipients_student_all ON public.notification_recipients USING btree (student_id, created_at DESC);


--
-- Name: idx_notification_recipients_student_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_recipients_student_unread ON public.notification_recipients USING btree (student_id, created_at DESC) WHERE ((read_at IS NULL) AND (archived_at IS NULL));


--
-- Name: idx_one_time_purchases_payment_intent; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_one_time_purchases_payment_intent ON public.one_time_purchases USING btree (stripe_payment_intent_id) WHERE (stripe_payment_intent_id IS NOT NULL);


--
-- Name: idx_one_time_purchases_student; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_one_time_purchases_student ON public.one_time_purchases USING btree (student_id, purchased_at DESC);


--
-- Name: idx_student_entitlements_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_student_entitlements_active ON public.student_entitlements USING btree (student_id, entitlement_key, starts_at, ends_at) WHERE (revoked_at IS NULL);


--
-- Name: idx_student_mentor_notes_author_student_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_student_mentor_notes_author_student_id ON public.student_mentor_notes USING btree (author_student_id);


--
-- Name: idx_student_mentor_notes_student_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_student_mentor_notes_student_id ON public.student_mentor_notes USING btree (student_id, created_at DESC);


--
-- Name: idx_student_onboarding_responses_student_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_student_onboarding_responses_student_id ON public.student_onboarding_responses USING btree (student_id);


--
-- Name: idx_students_mentor_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_students_mentor_status ON public.students USING btree (mentor_status);


--
-- Name: idx_subscriptions_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_customer ON public.subscriptions USING btree (stripe_customer_id);


--
-- Name: idx_subscriptions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_status ON public.subscriptions USING btree (status);


--
-- Name: idx_subscriptions_student_updated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_student_updated ON public.subscriptions USING btree (student_id, updated_at DESC);


--
-- Name: idx_weekly_update_views_student_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weekly_update_views_student_id ON public.weekly_update_views USING btree (student_id);


--
-- Name: idx_weekly_update_views_student_update; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weekly_update_views_student_update ON public.weekly_update_views USING btree (student_id, weekly_update_id);


--
-- Name: idx_weekly_update_views_weekly_update_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weekly_update_views_weekly_update_id ON public.weekly_update_views USING btree (weekly_update_id);


--
-- Name: idx_weekly_updates_access_tier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weekly_updates_access_tier ON public.weekly_updates USING btree (access_tier);


--
-- Name: idx_weekly_updates_market_insight_filters; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weekly_updates_market_insight_filters ON public.weekly_updates USING btree (type, actuality_status, published_at DESC) WHERE (is_published = true);


--
-- Name: idx_weekly_updates_market_updates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weekly_updates_market_updates ON public.weekly_updates USING btree (market, published_at DESC, created_at DESC) WHERE ((is_published = true) AND (type = 'market_update'::text));


--
-- Name: idx_weekly_updates_mentor_student_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weekly_updates_mentor_student_id ON public.weekly_updates USING btree (mentor_student_id);


--
-- Name: idx_weekly_updates_mux_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weekly_updates_mux_status ON public.weekly_updates USING btree (mux_status) WHERE (mux_status IS NOT NULL);


--
-- Name: idx_weekly_updates_needs_review; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weekly_updates_needs_review ON public.weekly_updates USING btree (needs_review, created_at DESC) WHERE (needs_review = true);


--
-- Name: idx_weekly_updates_published_type_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weekly_updates_published_type_date ON public.weekly_updates USING btree (type, published_at DESC, created_at DESC) WHERE (is_published = true);


--
-- Name: idx_weekly_updates_published_week; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weekly_updates_published_week ON public.weekly_updates USING btree (is_published, week_start_date DESC);


--
-- Name: lessons_module_order_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX lessons_module_order_unique ON public.lessons USING btree (module_id, order_index);


--
-- Name: lessons_mux_asset_id_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX lessons_mux_asset_id_unique ON public.lessons USING btree (mux_asset_id) WHERE (mux_asset_id IS NOT NULL);


--
-- Name: lessons_mux_playback_id_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX lessons_mux_playback_id_unique ON public.lessons USING btree (mux_playback_id) WHERE (mux_playback_id IS NOT NULL);


--
-- Name: lessons_slug_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX lessons_slug_unique ON public.lessons USING btree (slug);


--
-- Name: market_post_reactions_student; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX market_post_reactions_student ON public.market_post_reactions USING btree (student_id);


--
-- Name: modules_order_index_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX modules_order_index_unique ON public.modules USING btree (order_index);


--
-- Name: modules_slug_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX modules_slug_unique ON public.modules USING btree (slug);


--
-- Name: notification_events_bonus_expired_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX notification_events_bonus_expired_unique ON public.notification_events USING btree (type, target_table, target_id) WHERE ((type = 'subscription.bonus_expired'::text) AND (target_table = 'student_entitlements'::text));


--
-- Name: notification_events_live_session_cancelled_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX notification_events_live_session_cancelled_unique ON public.notification_events USING btree (type, target_table, target_id) WHERE ((type = 'live_session.cancelled'::text) AND (target_table = 'live_sessions'::text));


--
-- Name: notification_events_live_session_scheduled_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX notification_events_live_session_scheduled_unique ON public.notification_events USING btree (type, target_table, target_id) WHERE ((type = 'live_session.scheduled'::text) AND (target_table = 'live_sessions'::text));


--
-- Name: notification_events_payment_failed_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX notification_events_payment_failed_unique ON public.notification_events USING btree (type, target_table, target_id) WHERE ((type = 'subscription.payment_failed'::text) AND (target_table = 'stripe_invoices'::text));


--
-- Name: notification_events_student_intake_completed_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX notification_events_student_intake_completed_unique ON public.notification_events USING btree (type, target_table, target_id) WHERE ((type = 'student_intake.completed'::text) AND (target_table = 'students'::text));


--
-- Name: payments_student_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payments_student_id_idx ON public.payments USING btree (student_id);


--
-- Name: pdf_documents_module_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pdf_documents_module_order ON public.pdf_documents USING btree (module_id, shelf, sort_order, id);


--
-- Name: pdf_documents_update_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pdf_documents_update_order ON public.pdf_documents USING btree (weekly_update_id, sort_order, id);


--
-- Name: pdf_open_logs_retention; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pdf_open_logs_retention ON public.pdf_open_logs USING btree (opened_at);


--
-- Name: product_board_tasks_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX product_board_tasks_created_idx ON public.product_board_tasks USING btree (created_at DESC);


--
-- Name: progress_student_lesson_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX progress_student_lesson_unique ON public.progress USING btree (student_id, lesson_id);


--
-- Name: progress_unique_student_lesson; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX progress_unique_student_lesson ON public.progress USING btree (student_id, lesson_id);


--
-- Name: students_auth_user_id_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX students_auth_user_id_unique ON public.students USING btree (auth_user_id);


--
-- Name: update_reads_student_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX update_reads_student_idx ON public.update_reads USING btree (student_id);


--
-- Name: update_reads_update_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX update_reads_update_idx ON public.update_reads USING btree (update_id);


--
-- Name: updates_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX updates_created_at_idx ON public.updates USING btree (created_at DESC);


--
-- Name: video_positions_lesson_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX video_positions_lesson_owner ON public.video_positions USING btree (student_id, lesson_id);


--
-- Name: video_positions_update_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX video_positions_update_owner ON public.video_positions USING btree (student_id, weekly_update_id);


--
-- Name: weekly_updates_mux_asset_id_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX weekly_updates_mux_asset_id_unique ON public.weekly_updates USING btree (mux_asset_id) WHERE (mux_asset_id IS NOT NULL);


--
-- Name: weekly_updates_mux_playback_id_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX weekly_updates_mux_playback_id_unique ON public.weekly_updates USING btree (mux_playback_id) WHERE (mux_playback_id IS NOT NULL);


--
-- Name: weekly_updates_mux_upload_id_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX weekly_updates_mux_upload_id_unique ON public.weekly_updates USING btree (mux_upload_id) WHERE (mux_upload_id IS NOT NULL);


--
-- Name: weekly_updates_one_outlook_per_week; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX weekly_updates_one_outlook_per_week ON public.weekly_updates USING btree (week_start_date) WHERE (type = 'weekly_outlook'::text);


--
-- Name: students deleted_student_avatar; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER deleted_student_avatar BEFORE DELETE ON public.students FOR EACH ROW EXECUTE FUNCTION public.mark_deleted_student_avatar();


--
-- Name: conversation_messages enqueue_chat_email_notification; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enqueue_chat_email_notification AFTER INSERT ON public.conversation_messages FOR EACH ROW EXECUTE FUNCTION public.enqueue_chat_email_notification();


--
-- Name: notification_recipients guard_chat_notification_recipient_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER guard_chat_notification_recipient_identity BEFORE UPDATE ON public.notification_recipients FOR EACH ROW EXECUTE FUNCTION public.guard_chat_notification_recipient_identity();


--
-- Name: market_post_reactions guard_reaction_account; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER guard_reaction_account BEFORE INSERT ON public.market_post_reactions FOR EACH ROW EXECUTE FUNCTION public.guard_reaction_account();


--
-- Name: students guard_student_identity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER guard_student_identity BEFORE INSERT OR UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.guard_student_identity();


--
-- Name: conversation_messages handle_conversation_message_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER handle_conversation_message_insert AFTER INSERT ON public.conversation_messages FOR EACH ROW EXECUTE FUNCTION public.handle_conversation_message_insert();


--
-- Name: weekly_updates market_update_pin_position_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER market_update_pin_position_guard BEFORE INSERT OR UPDATE OF update_structure, is_published, actuality_status ON public.weekly_updates FOR EACH ROW EXECUTE FUNCTION public.guard_market_update_pin_position();


--
-- Name: students on_new_htp_lead; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_new_htp_lead AFTER INSERT ON public.students FOR EACH ROW EXECUTE FUNCTION public.notify_clickup_on_lead();


--
-- Name: conversation_messages prepare_private_chat_message; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER prepare_private_chat_message BEFORE INSERT ON public.conversation_messages FOR EACH ROW EXECUTE FUNCTION public.prepare_private_chat_message();


--
-- Name: exam_results protect_exam_result_entitlement; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER protect_exam_result_entitlement BEFORE INSERT ON public.exam_results FOR EACH ROW EXECUTE FUNCTION public.protect_exam_result_entitlement();


--
-- Name: students protect_student_privileged_fields; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER protect_student_privileged_fields BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.protect_student_privileged_fields();


--
-- Name: admin_audit_log reject_admin_audit_log_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER reject_admin_audit_log_truncate BEFORE TRUNCATE ON public.admin_audit_log FOR EACH STATEMENT EXECUTE FUNCTION public.reject_admin_audit_log_mutation();


--
-- Name: admin_audit_log reject_admin_audit_log_update_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER reject_admin_audit_log_update_delete BEFORE DELETE OR UPDATE ON public.admin_audit_log FOR EACH ROW EXECUTE FUNCTION public.reject_admin_audit_log_mutation();


--
-- Name: ai_student_summaries set_ai_student_summaries_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_ai_student_summaries_updated_at BEFORE UPDATE ON public.ai_student_summaries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: ai_video_enrichments set_ai_video_enrichments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_ai_video_enrichments_updated_at BEFORE UPDATE ON public.ai_video_enrichments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: ai_video_transcripts set_ai_video_transcripts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_ai_video_transcripts_updated_at BEFORE UPDATE ON public.ai_video_transcripts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: ai_video_workflows set_ai_video_workflows_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_ai_video_workflows_updated_at BEFORE UPDATE ON public.ai_video_workflows FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: billing_customers set_billing_customers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_billing_customers_updated_at BEFORE UPDATE ON public.billing_customers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: conversation_threads set_conversation_threads_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_conversation_threads_updated_at BEFORE UPDATE ON public.conversation_threads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: exam_answer_options set_exam_answer_options_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_exam_answer_options_updated_at BEFORE UPDATE ON public.exam_answer_options FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: exam_attempts set_exam_attempts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_exam_attempts_updated_at BEFORE UPDATE ON public.exam_attempts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: exam_questions set_exam_questions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_exam_questions_updated_at BEFORE UPDATE ON public.exam_questions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: exams set_exams_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_exams_updated_at BEFORE UPDATE ON public.exams FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: lesson_action_progress set_lesson_action_progress_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_lesson_action_progress_updated_at BEFORE UPDATE ON public.lesson_action_progress FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: lessons set_lessons_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_lessons_updated_at BEFORE UPDATE ON public.lessons FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: live_session_provider_secrets set_live_session_provider_secrets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_live_session_provider_secrets_updated_at BEFORE UPDATE ON public.live_session_provider_secrets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: live_sessions set_live_sessions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_live_sessions_updated_at BEFORE UPDATE ON public.live_sessions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: modules set_modules_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_modules_updated_at BEFORE UPDATE ON public.modules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: notification_preferences set_notification_preferences_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_notification_preferences_updated_at BEFORE UPDATE ON public.notification_preferences FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: one_time_purchases set_one_time_purchases_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_one_time_purchases_updated_at BEFORE UPDATE ON public.one_time_purchases FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: progress set_progress_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_progress_updated_at BEFORE UPDATE ON public.progress FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: stripe_webhook_events set_stripe_webhook_events_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_stripe_webhook_events_updated_at BEFORE UPDATE ON public.stripe_webhook_events FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: student_entitlements set_student_entitlements_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_student_entitlements_updated_at BEFORE UPDATE ON public.student_entitlements FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: student_mentor_notes set_student_mentor_notes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_student_mentor_notes_updated_at BEFORE UPDATE ON public.student_mentor_notes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: student_onboarding_responses set_student_onboarding_responses_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_student_onboarding_responses_updated_at BEFORE UPDATE ON public.student_onboarding_responses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: subscriptions set_subscriptions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: weekly_update_views set_weekly_update_views_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_weekly_update_views_updated_at BEFORE UPDATE ON public.weekly_update_views FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: weekly_updates set_weekly_updates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_weekly_updates_updated_at BEFORE UPDATE ON public.weekly_updates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: students trg_students_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_students_set_updated_at BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: academy_rubric_modules academy_rubric_modules_module_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.academy_rubric_modules
    ADD CONSTRAINT academy_rubric_modules_module_id_fkey FOREIGN KEY (module_id) REFERENCES public.modules(id) ON DELETE RESTRICT;


--
-- Name: academy_rubric_modules academy_rubric_modules_rubric_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.academy_rubric_modules
    ADD CONSTRAINT academy_rubric_modules_rubric_id_fkey FOREIGN KEY (rubric_id) REFERENCES public.academy_rubrics(id) ON DELETE CASCADE;


--
-- Name: ai_interactions ai_interactions_actor_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_interactions
    ADD CONSTRAINT ai_interactions_actor_student_id_fkey FOREIGN KEY (actor_student_id) REFERENCES public.students(id) ON DELETE SET NULL;


--
-- Name: ai_interactions ai_interactions_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_interactions
    ADD CONSTRAINT ai_interactions_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: ai_interactions ai_interactions_transcript_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_interactions
    ADD CONSTRAINT ai_interactions_transcript_id_fkey FOREIGN KEY (transcript_id) REFERENCES public.ai_video_transcripts(id) ON DELETE SET NULL;


--
-- Name: ai_student_summaries ai_student_summaries_generated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_student_summaries
    ADD CONSTRAINT ai_student_summaries_generated_by_fkey FOREIGN KEY (generated_by) REFERENCES public.students(id) ON DELETE SET NULL;


--
-- Name: ai_student_summaries ai_student_summaries_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_student_summaries
    ADD CONSTRAINT ai_student_summaries_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: ai_video_enrichments ai_video_enrichments_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_video_enrichments
    ADD CONSTRAINT ai_video_enrichments_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.students(id) ON DELETE SET NULL;


--
-- Name: ai_video_enrichments ai_video_enrichments_transcript_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_video_enrichments
    ADD CONSTRAINT ai_video_enrichments_transcript_id_fkey FOREIGN KEY (transcript_id) REFERENCES public.ai_video_transcripts(id) ON DELETE CASCADE;


--
-- Name: ai_video_transcripts ai_video_transcripts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_video_transcripts
    ADD CONSTRAINT ai_video_transcripts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.students(id) ON DELETE SET NULL;


--
-- Name: ai_video_transcripts ai_video_transcripts_weekly_update_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_video_transcripts
    ADD CONSTRAINT ai_video_transcripts_weekly_update_id_fkey FOREIGN KEY (weekly_update_id) REFERENCES public.weekly_updates(id) ON DELETE CASCADE;


--
-- Name: ai_video_workflows ai_video_workflows_transcript_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_video_workflows
    ADD CONSTRAINT ai_video_workflows_transcript_id_fkey FOREIGN KEY (transcript_id) REFERENCES public.ai_video_transcripts(id) ON DELETE CASCADE;


--
-- Name: avatar_objects avatar_objects_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.avatar_objects
    ADD CONSTRAINT avatar_objects_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE SET NULL;


--
-- Name: billing_customers billing_customers_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_customers
    ADD CONSTRAINT billing_customers_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: chat_email_outbox chat_email_outbox_last_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_email_outbox
    ADD CONSTRAINT chat_email_outbox_last_message_id_fkey FOREIGN KEY (last_message_id) REFERENCES public.conversation_messages(id) ON DELETE SET NULL;


--
-- Name: chat_email_outbox chat_email_outbox_mentor_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_email_outbox
    ADD CONSTRAINT chat_email_outbox_mentor_student_id_fkey FOREIGN KEY (mentor_student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: chat_email_outbox chat_email_outbox_recipient_participant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_email_outbox
    ADD CONSTRAINT chat_email_outbox_recipient_participant_id_fkey FOREIGN KEY (recipient_participant_id) REFERENCES public.conversation_participants(id) ON DELETE CASCADE;


--
-- Name: chat_email_outbox chat_email_outbox_recipient_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_email_outbox
    ADD CONSTRAINT chat_email_outbox_recipient_student_id_fkey FOREIGN KEY (recipient_student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: chat_email_outbox chat_email_outbox_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_email_outbox
    ADD CONSTRAINT chat_email_outbox_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.conversation_threads(id) ON DELETE CASCADE;


--
-- Name: chat_email_preferences chat_email_preferences_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_email_preferences
    ADD CONSTRAINT chat_email_preferences_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: chat_mentor_config chat_mentor_config_mentor_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_mentor_config
    ADD CONSTRAINT chat_mentor_config_mentor_student_id_fkey FOREIGN KEY (mentor_student_id) REFERENCES public.students(id) ON DELETE SET NULL;


--
-- Name: chat_presence_sessions chat_presence_sessions_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_presence_sessions
    ADD CONSTRAINT chat_presence_sessions_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: chat_principals chat_principals_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_principals
    ADD CONSTRAINT chat_principals_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE SET NULL;


--
-- Name: conversation_attachments conversation_attachments_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_attachments
    ADD CONSTRAINT conversation_attachments_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.conversation_messages(id) ON DELETE SET NULL;


--
-- Name: conversation_attachments conversation_attachments_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_attachments
    ADD CONSTRAINT conversation_attachments_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.conversation_threads(id) ON DELETE SET NULL;


--
-- Name: conversation_attachments conversation_attachments_uploader_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_attachments
    ADD CONSTRAINT conversation_attachments_uploader_student_id_fkey FOREIGN KEY (uploader_student_id) REFERENCES public.students(id) ON DELETE SET NULL;


--
-- Name: conversation_events conversation_events_actor_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_events
    ADD CONSTRAINT conversation_events_actor_student_id_fkey FOREIGN KEY (actor_student_id) REFERENCES public.students(id) ON DELETE SET NULL;


--
-- Name: conversation_events conversation_events_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_events
    ADD CONSTRAINT conversation_events_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.conversation_threads(id) ON DELETE CASCADE;


--
-- Name: conversation_message_reactions conversation_message_reactions_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_message_reactions
    ADD CONSTRAINT conversation_message_reactions_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.conversation_messages(id) ON DELETE CASCADE;


--
-- Name: conversation_message_reactions conversation_message_reactions_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_message_reactions
    ADD CONSTRAINT conversation_message_reactions_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: conversation_messages conversation_messages_parent_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_messages
    ADD CONSTRAINT conversation_messages_parent_message_id_fkey FOREIGN KEY (parent_message_id) REFERENCES public.conversation_messages(id) ON DELETE SET NULL;


--
-- Name: conversation_messages conversation_messages_participant_identity_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_messages
    ADD CONSTRAINT conversation_messages_participant_identity_fk FOREIGN KEY (sender_participant_id, sender_principal_id, thread_id) REFERENCES public.conversation_participants(id, principal_id, thread_id);


--
-- Name: conversation_messages conversation_messages_sender_principal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_messages
    ADD CONSTRAINT conversation_messages_sender_principal_id_fkey FOREIGN KEY (sender_principal_id) REFERENCES public.chat_principals(id) ON DELETE SET NULL;


--
-- Name: conversation_messages conversation_messages_sender_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_messages
    ADD CONSTRAINT conversation_messages_sender_student_id_fkey FOREIGN KEY (sender_student_id) REFERENCES public.students(id) ON DELETE SET NULL;


--
-- Name: conversation_messages conversation_messages_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_messages
    ADD CONSTRAINT conversation_messages_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.conversation_threads(id) ON DELETE CASCADE;


--
-- Name: conversation_participants conversation_participants_principal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_principal_id_fkey FOREIGN KEY (principal_id) REFERENCES public.chat_principals(id) ON DELETE CASCADE;


--
-- Name: conversation_participants conversation_participants_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.conversation_threads(id) ON DELETE CASCADE;


--
-- Name: conversation_threads conversation_threads_assigned_to_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_threads
    ADD CONSTRAINT conversation_threads_assigned_to_student_id_fkey FOREIGN KEY (assigned_to_student_id) REFERENCES public.students(id) ON DELETE SET NULL;


--
-- Name: conversation_threads conversation_threads_last_public_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_threads
    ADD CONSTRAINT conversation_threads_last_public_message_id_fkey FOREIGN KEY (last_public_message_id) REFERENCES public.conversation_messages(id) ON DELETE SET NULL;


--
-- Name: conversation_threads conversation_threads_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_threads
    ADD CONSTRAINT conversation_threads_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: exam_answer_options exam_answer_options_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exam_answer_options
    ADD CONSTRAINT exam_answer_options_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.exam_questions(id) ON DELETE CASCADE;


--
-- Name: exam_attempt_answers exam_attempt_answers_attempt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exam_attempt_answers
    ADD CONSTRAINT exam_attempt_answers_attempt_id_fkey FOREIGN KEY (attempt_id) REFERENCES public.exam_attempts(id) ON DELETE CASCADE;


--
-- Name: exam_attempt_answers exam_attempt_answers_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exam_attempt_answers
    ADD CONSTRAINT exam_attempt_answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.exam_questions(id) ON DELETE RESTRICT;


--
-- Name: exam_attempt_answers exam_attempt_answers_selected_option_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exam_attempt_answers
    ADD CONSTRAINT exam_attempt_answers_selected_option_id_fkey FOREIGN KEY (selected_option_id) REFERENCES public.exam_answer_options(id) ON DELETE RESTRICT;


--
-- Name: exam_attempt_questions exam_attempt_questions_attempt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exam_attempt_questions
    ADD CONSTRAINT exam_attempt_questions_attempt_id_fkey FOREIGN KEY (attempt_id) REFERENCES public.exam_attempts(id) ON DELETE CASCADE;


--
-- Name: exam_attempt_questions exam_attempt_questions_correct_option_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exam_attempt_questions
    ADD CONSTRAINT exam_attempt_questions_correct_option_id_fkey FOREIGN KEY (correct_option_id) REFERENCES public.exam_answer_options(id) ON DELETE RESTRICT;


--
-- Name: exam_attempt_questions exam_attempt_questions_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exam_attempt_questions
    ADD CONSTRAINT exam_attempt_questions_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.exam_questions(id) ON DELETE RESTRICT;


--
-- Name: exam_attempts exam_attempts_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exam_attempts
    ADD CONSTRAINT exam_attempts_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exams(id) ON DELETE CASCADE;


--
-- Name: exam_attempts exam_attempts_module_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exam_attempts
    ADD CONSTRAINT exam_attempts_module_id_fkey FOREIGN KEY (module_id) REFERENCES public.modules(id) ON DELETE CASCADE;


--
-- Name: exam_attempts exam_attempts_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exam_attempts
    ADD CONSTRAINT exam_attempts_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: exam_questions exam_questions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exam_questions
    ADD CONSTRAINT exam_questions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.students(id) ON DELETE SET NULL;


--
-- Name: exam_questions exam_questions_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exam_questions
    ADD CONSTRAINT exam_questions_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exams(id) ON DELETE CASCADE;


--
-- Name: exam_questions exam_questions_module_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exam_questions
    ADD CONSTRAINT exam_questions_module_id_fkey FOREIGN KEY (module_id) REFERENCES public.modules(id) ON DELETE CASCADE;


--
-- Name: exam_questions exam_questions_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exam_questions
    ADD CONSTRAINT exam_questions_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.students(id) ON DELETE SET NULL;


--
-- Name: exam_results exam_results_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exam_results
    ADD CONSTRAINT exam_results_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exams(id) ON DELETE CASCADE;


--
-- Name: exam_results exam_results_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exam_results
    ADD CONSTRAINT exam_results_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: exams exams_module_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT exams_module_id_fkey FOREIGN KEY (module_id) REFERENCES public.modules(id) ON DELETE CASCADE;


--
-- Name: legacy_academy_module_access legacy_academy_module_access_module_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.legacy_academy_module_access
    ADD CONSTRAINT legacy_academy_module_access_module_id_fkey FOREIGN KEY (module_id) REFERENCES public.modules(id) ON DELETE CASCADE;


--
-- Name: legacy_academy_module_access legacy_academy_module_access_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.legacy_academy_module_access
    ADD CONSTRAINT legacy_academy_module_access_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: lesson_action_progress lesson_action_progress_lesson_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_action_progress
    ADD CONSTRAINT lesson_action_progress_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES public.lessons(id) ON DELETE CASCADE;


--
-- Name: lesson_action_progress lesson_action_progress_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lesson_action_progress
    ADD CONSTRAINT lesson_action_progress_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: lessons lessons_module_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lessons
    ADD CONSTRAINT lessons_module_id_fkey FOREIGN KEY (module_id) REFERENCES public.modules(id) ON DELETE CASCADE;


--
-- Name: live_session_provider_secrets live_session_provider_secrets_live_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_session_provider_secrets
    ADD CONSTRAINT live_session_provider_secrets_live_session_id_fkey FOREIGN KEY (live_session_id) REFERENCES public.live_sessions(id) ON DELETE CASCADE;


--
-- Name: live_sessions live_sessions_created_by_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_sessions
    ADD CONSTRAINT live_sessions_created_by_student_id_fkey FOREIGN KEY (created_by_student_id) REFERENCES public.students(id) ON DELETE SET NULL;


--
-- Name: live_sessions live_sessions_mentor_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_sessions
    ADD CONSTRAINT live_sessions_mentor_student_id_fkey FOREIGN KEY (mentor_student_id) REFERENCES public.students(id) ON DELETE SET NULL;


--
-- Name: live_sessions live_sessions_replay_weekly_update_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_sessions
    ADD CONSTRAINT live_sessions_replay_weekly_update_id_fkey FOREIGN KEY (replay_weekly_update_id) REFERENCES public.weekly_updates(id) ON DELETE SET NULL;


--
-- Name: market_post_reactions market_post_reactions_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.market_post_reactions
    ADD CONSTRAINT market_post_reactions_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.weekly_updates(id) ON DELETE CASCADE;


--
-- Name: market_post_reactions market_post_reactions_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.market_post_reactions
    ADD CONSTRAINT market_post_reactions_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: notification_events notification_events_actor_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_events
    ADD CONSTRAINT notification_events_actor_student_id_fkey FOREIGN KEY (actor_student_id) REFERENCES public.students(id) ON DELETE SET NULL;


--
-- Name: notification_preferences notification_preferences_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: notification_recipients notification_recipients_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_recipients
    ADD CONSTRAINT notification_recipients_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.notification_events(id) ON DELETE CASCADE;


--
-- Name: notification_recipients notification_recipients_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_recipients
    ADD CONSTRAINT notification_recipients_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: one_time_purchases one_time_purchases_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.one_time_purchases
    ADD CONSTRAINT one_time_purchases_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: payments payments_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: pdf_documents pdf_documents_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdf_documents
    ADD CONSTRAINT pdf_documents_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.students(id) ON DELETE SET NULL;


--
-- Name: pdf_documents pdf_documents_module_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdf_documents
    ADD CONSTRAINT pdf_documents_module_id_fkey FOREIGN KEY (module_id) REFERENCES public.modules(id) ON DELETE RESTRICT;


--
-- Name: pdf_documents pdf_documents_weekly_update_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdf_documents
    ADD CONSTRAINT pdf_documents_weekly_update_id_fkey FOREIGN KEY (weekly_update_id) REFERENCES public.weekly_updates(id) ON DELETE RESTRICT;


--
-- Name: pdf_open_logs pdf_open_logs_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdf_open_logs
    ADD CONSTRAINT pdf_open_logs_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: pdf_positions pdf_positions_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdf_positions
    ADD CONSTRAINT pdf_positions_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.pdf_documents(id) ON DELETE CASCADE;


--
-- Name: pdf_positions pdf_positions_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdf_positions
    ADD CONSTRAINT pdf_positions_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: practical_lessons practical_lessons_module_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.practical_lessons
    ADD CONSTRAINT practical_lessons_module_id_fkey FOREIGN KEY (module_id) REFERENCES public.modules(id) ON DELETE CASCADE;


--
-- Name: product_board_tasks product_board_tasks_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_board_tasks
    ADD CONSTRAINT product_board_tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.students(id) ON DELETE SET NULL;


--
-- Name: product_board_tasks product_board_tasks_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_board_tasks
    ADD CONSTRAINT product_board_tasks_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.students(id) ON DELETE SET NULL;


--
-- Name: progress progress_lesson_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.progress
    ADD CONSTRAINT progress_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES public.lessons(id) ON DELETE CASCADE;


--
-- Name: progress progress_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.progress
    ADD CONSTRAINT progress_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: student_avatars student_avatars_object_path_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_avatars
    ADD CONSTRAINT student_avatars_object_path_fkey FOREIGN KEY (object_path) REFERENCES public.avatar_objects(object_path);


--
-- Name: student_avatars student_avatars_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_avatars
    ADD CONSTRAINT student_avatars_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: student_entitlements student_entitlements_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_entitlements
    ADD CONSTRAINT student_entitlements_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: student_mentor_notes student_mentor_notes_author_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_mentor_notes
    ADD CONSTRAINT student_mentor_notes_author_student_id_fkey FOREIGN KEY (author_student_id) REFERENCES public.students(id) ON DELETE SET NULL;


--
-- Name: student_mentor_notes student_mentor_notes_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_mentor_notes
    ADD CONSTRAINT student_mentor_notes_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: student_onboarding_responses student_onboarding_responses_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_onboarding_responses
    ADD CONSTRAINT student_onboarding_responses_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: update_reads update_reads_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.update_reads
    ADD CONSTRAINT update_reads_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: update_reads update_reads_update_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.update_reads
    ADD CONSTRAINT update_reads_update_id_fkey FOREIGN KEY (update_id) REFERENCES public.updates(id) ON DELETE CASCADE;


--
-- Name: updates updates_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.updates
    ADD CONSTRAINT updates_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: video_positions video_positions_lesson_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_positions
    ADD CONSTRAINT video_positions_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES public.lessons(id) ON DELETE CASCADE;


--
-- Name: video_positions video_positions_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_positions
    ADD CONSTRAINT video_positions_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: video_positions video_positions_weekly_update_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_positions
    ADD CONSTRAINT video_positions_weekly_update_id_fkey FOREIGN KEY (weekly_update_id) REFERENCES public.weekly_updates(id) ON DELETE CASCADE;


--
-- Name: weekly_update_views weekly_update_views_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_update_views
    ADD CONSTRAINT weekly_update_views_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: weekly_update_views weekly_update_views_weekly_update_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_update_views
    ADD CONSTRAINT weekly_update_views_weekly_update_id_fkey FOREIGN KEY (weekly_update_id) REFERENCES public.weekly_updates(id) ON DELETE CASCADE;


--
-- Name: weekly_updates weekly_updates_created_by_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_updates
    ADD CONSTRAINT weekly_updates_created_by_student_id_fkey FOREIGN KEY (created_by_student_id) REFERENCES public.students(id) ON DELETE SET NULL;


--
-- Name: weekly_updates weekly_updates_mentor_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_updates
    ADD CONSTRAINT weekly_updates_mentor_student_id_fkey FOREIGN KEY (mentor_student_id) REFERENCES public.students(id) ON DELETE SET NULL;


--
-- Name: weekly_updates weekly_updates_published_by_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_updates
    ADD CONSTRAINT weekly_updates_published_by_student_id_fkey FOREIGN KEY (published_by_student_id) REFERENCES public.students(id) ON DELETE SET NULL;


--
-- Name: students No client-side student deletes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No client-side student deletes" ON public.students FOR DELETE USING (false);


--
-- Name: students No client-side student updates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No client-side student updates" ON public.students FOR UPDATE USING (false);


--
-- Name: students No direct student level updates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "No direct student level updates" ON public.students FOR UPDATE USING (false);


--
-- Name: exam_results Students can read own exam results; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can read own exam results" ON public.exam_results FOR SELECT USING ((student_id IN ( SELECT students.id
   FROM public.students
  WHERE (students.auth_user_id = auth.uid()))));


--
-- Name: payments Students can read own payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can read own payments" ON public.payments FOR SELECT USING ((student_id IN ( SELECT students.id
   FROM public.students
  WHERE (students.auth_user_id = auth.uid()))));


--
-- Name: students Students can read own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can read own profile" ON public.students FOR SELECT USING ((auth.uid() = auth_user_id));


--
-- Name: progress Students can read own progress; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Students can read own progress" ON public.progress FOR SELECT USING ((student_id IN ( SELECT students.id
   FROM public.students
  WHERE (students.auth_user_id = auth.uid()))));


--
-- Name: students Users can update own name and phone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own name and phone" ON public.students FOR UPDATE USING ((auth.uid() = auth_user_id)) WITH CHECK ((auth.uid() = auth_user_id));


--
-- Name: academy_rubric_modules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.academy_rubric_modules ENABLE ROW LEVEL SECURITY;

--
-- Name: academy_rubric_modules academy_rubric_modules_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY academy_rubric_modules_read ON public.academy_rubric_modules FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.academy_rubrics r
  WHERE (r.id = academy_rubric_modules.rubric_id))));


--
-- Name: academy_rubrics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.academy_rubrics ENABLE ROW LEVEL SECURITY;

--
-- Name: academy_rubrics academy_rubrics_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY academy_rubrics_read ON public.academy_rubrics FOR SELECT TO authenticated USING ((public.has_live_learning_account() AND (is_published OR public.is_pdf_admin())));


--
-- Name: admin_audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_interactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_interactions ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_interactions ai_interactions_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_interactions_insert_admin ON public.ai_interactions FOR INSERT TO authenticated WITH CHECK (public.is_platform_admin());


--
-- Name: ai_interactions ai_interactions_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_interactions_select_admin ON public.ai_interactions FOR SELECT TO authenticated USING (public.is_platform_admin());


--
-- Name: ai_student_summaries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_student_summaries ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_student_summaries ai_student_summaries_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_student_summaries_insert_admin ON public.ai_student_summaries FOR INSERT TO authenticated WITH CHECK (public.is_platform_admin());


--
-- Name: ai_student_summaries ai_student_summaries_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_student_summaries_select_admin ON public.ai_student_summaries FOR SELECT TO authenticated USING (public.is_platform_admin());


--
-- Name: ai_student_summaries ai_student_summaries_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_student_summaries_update_admin ON public.ai_student_summaries FOR UPDATE TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());


--
-- Name: ai_video_enrichments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_video_enrichments ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_video_enrichments ai_video_enrichments_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_video_enrichments_admin_all ON public.ai_video_enrichments TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());


--
-- Name: ai_video_transcripts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_video_transcripts ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_video_transcripts ai_video_transcripts_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_video_transcripts_admin_all ON public.ai_video_transcripts TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());


--
-- Name: ai_video_workflows; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_video_workflows ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_video_workflows ai_video_workflows_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_video_workflows_admin_all ON public.ai_video_workflows TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());


--
-- Name: avatar_objects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.avatar_objects ENABLE ROW LEVEL SECURITY;

--
-- Name: student_avatars avatars_read_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY avatars_read_admin ON public.student_avatars FOR SELECT TO authenticated USING (public.is_platform_admin());


--
-- Name: student_avatars avatars_read_chat; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY avatars_read_chat ON public.student_avatars FOR SELECT TO authenticated USING (public.can_read_chat_profile(student_id));


--
-- Name: student_avatars avatars_read_visible; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY avatars_read_visible ON public.student_avatars FOR SELECT TO authenticated USING (public.can_read_student_avatar(student_id));


--
-- Name: billing_customers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;

--
-- Name: billing_customers billing_customers_select_own_or_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY billing_customers_select_own_or_admin ON public.billing_customers FOR SELECT TO authenticated USING ((public.is_platform_admin() OR (EXISTS ( SELECT 1
   FROM public.students student
  WHERE ((student.id = billing_customers.student_id) AND (student.auth_user_id = auth.uid()))))));


--
-- Name: chat_email_outbox; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_email_outbox ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_email_preferences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_email_preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_email_preferences chat_email_preferences_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chat_email_preferences_own ON public.chat_email_preferences FOR SELECT TO authenticated USING ((student_id = public.current_chat_student_id()));


--
-- Name: chat_mentor_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_mentor_config ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_presence_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_presence_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_principals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_principals ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_principals chat_principals_select_visible; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY chat_principals_select_visible ON public.chat_principals FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.conversation_participants cp
  WHERE ((cp.principal_id = chat_principals.id) AND cp.active AND (public.chat_participant_role(cp.thread_id) IS NOT NULL)))));


--
-- Name: conversation_attachments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversation_attachments ENABLE ROW LEVEL SECURITY;

--
-- Name: conversation_attachments conversation_attachments_select_visible; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY conversation_attachments_select_visible ON public.conversation_attachments FOR SELECT TO authenticated USING (public.can_read_chat_attachment(id));


--
-- Name: conversation_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversation_events ENABLE ROW LEVEL SECURITY;

--
-- Name: conversation_events conversation_events_select_participating_mentor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY conversation_events_select_participating_mentor ON public.conversation_events FOR SELECT TO authenticated USING (((public.chat_participant_role(thread_id) = 'mentor'::text) OR (EXISTS ( SELECT 1
   FROM public.conversation_threads t
  WHERE ((t.id = conversation_events.thread_id) AND (t.source_type <> 'mentor_chat'::text) AND public.is_platform_admin())))));


--
-- Name: conversation_message_reactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversation_message_reactions ENABLE ROW LEVEL SECURITY;

--
-- Name: conversation_message_reactions conversation_message_reactions_select_visible; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY conversation_message_reactions_select_visible ON public.conversation_message_reactions FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.conversation_messages m
  WHERE (m.id = conversation_message_reactions.message_id))));


--
-- Name: conversation_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: conversation_messages conversation_messages_select_visible; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY conversation_messages_select_visible ON public.conversation_messages FOR SELECT TO authenticated USING ((((public.chat_participant_role(thread_id) IS NOT NULL) AND ((NOT is_internal) OR (public.chat_participant_role(thread_id) = 'mentor'::text)) AND (deleted_at IS NULL)) OR (EXISTS ( SELECT 1
   FROM public.conversation_threads t
  WHERE ((t.id = conversation_messages.thread_id) AND (t.source_type <> 'mentor_chat'::text) AND (public.is_platform_admin() OR ((NOT conversation_messages.is_internal) AND (conversation_messages.deleted_at IS NULL) AND (EXISTS ( SELECT 1
           FROM public.students s
          WHERE ((s.id = t.student_id) AND (s.auth_user_id = auth.uid())))))))))));


--
-- Name: conversation_participants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

--
-- Name: conversation_participants conversation_participants_select_visible; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY conversation_participants_select_visible ON public.conversation_participants FOR SELECT TO authenticated USING (((public.chat_participant_role(thread_id) IS NOT NULL) AND active AND (role = ANY (ARRAY['student'::text, 'mentor'::text]))));


--
-- Name: conversation_threads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversation_threads ENABLE ROW LEVEL SECURITY;

--
-- Name: conversation_threads conversation_threads_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY conversation_threads_select_own ON public.conversation_threads FOR SELECT TO authenticated USING (((public.chat_participant_role(id) IS NOT NULL) OR ((source_type <> 'mentor_chat'::text) AND (public.is_platform_admin() OR (EXISTS ( SELECT 1
   FROM public.students s
  WHERE ((s.id = conversation_threads.student_id) AND (s.auth_user_id = auth.uid()))))))));


--
-- Name: exam_answer_options; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.exam_answer_options ENABLE ROW LEVEL SECURITY;

--
-- Name: exam_answer_options exam_answer_options_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY exam_answer_options_delete_admin ON public.exam_answer_options FOR DELETE TO authenticated USING (public.is_platform_admin());


--
-- Name: exam_answer_options exam_answer_options_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY exam_answer_options_insert_admin ON public.exam_answer_options FOR INSERT TO authenticated WITH CHECK (public.is_platform_admin());


--
-- Name: exam_answer_options exam_answer_options_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY exam_answer_options_select_admin ON public.exam_answer_options FOR SELECT TO authenticated USING (public.is_platform_admin());


--
-- Name: exam_answer_options exam_answer_options_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY exam_answer_options_update_admin ON public.exam_answer_options FOR UPDATE TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());


--
-- Name: exam_attempt_answers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.exam_attempt_answers ENABLE ROW LEVEL SECURITY;

--
-- Name: exam_attempt_answers exam_attempt_answers_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY exam_attempt_answers_select_admin ON public.exam_attempt_answers FOR SELECT TO authenticated USING (public.is_platform_admin());


--
-- Name: exam_attempt_answers exam_attempt_answers_select_own_submitted; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY exam_attempt_answers_select_own_submitted ON public.exam_attempt_answers FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.exam_attempts a
     JOIN public.students s ON ((s.id = a.student_id)))
  WHERE ((a.id = exam_attempt_answers.attempt_id) AND (a.status = 'submitted'::text) AND (s.auth_user_id = auth.uid()) AND public.can_open_academy_module(a.module_id)))));


--
-- Name: exam_attempt_questions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.exam_attempt_questions ENABLE ROW LEVEL SECURITY;

--
-- Name: exam_attempt_questions exam_attempt_questions_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY exam_attempt_questions_select_admin ON public.exam_attempt_questions FOR SELECT TO authenticated USING (public.is_platform_admin());


--
-- Name: exam_attempts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.exam_attempts ENABLE ROW LEVEL SECURITY;

--
-- Name: exam_attempts exam_attempts_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY exam_attempts_select_admin ON public.exam_attempts FOR SELECT TO authenticated USING (public.is_platform_admin());


--
-- Name: exam_attempts exam_attempts_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY exam_attempts_select_own ON public.exam_attempts FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.students s
  WHERE ((s.id = exam_attempts.student_id) AND (s.auth_user_id = auth.uid())))));


--
-- Name: exam_questions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.exam_questions ENABLE ROW LEVEL SECURITY;

--
-- Name: exam_questions exam_questions_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY exam_questions_delete_admin ON public.exam_questions FOR DELETE TO authenticated USING (public.is_platform_admin());


--
-- Name: exam_questions exam_questions_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY exam_questions_insert_admin ON public.exam_questions FOR INSERT TO authenticated WITH CHECK (public.is_platform_admin());


--
-- Name: exam_questions exam_questions_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY exam_questions_select_admin ON public.exam_questions FOR SELECT TO authenticated USING (public.is_platform_admin());


--
-- Name: exam_questions exam_questions_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY exam_questions_update_admin ON public.exam_questions FOR UPDATE TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());


--
-- Name: exam_results; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.exam_results ENABLE ROW LEVEL SECURITY;

--
-- Name: exam_results exam_results_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY exam_results_select_admin ON public.exam_results FOR SELECT TO authenticated USING (public.is_platform_admin());


--
-- Name: exam_results exam_results_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY exam_results_select_own ON public.exam_results FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.students s
  WHERE ((s.id = exam_results.student_id) AND (s.auth_user_id = auth.uid())))));


--
-- Name: exams; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;

--
-- Name: exams exams_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY exams_insert_admin ON public.exams FOR INSERT TO authenticated WITH CHECK (public.is_platform_admin());


--
-- Name: exams exams_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY exams_select_admin ON public.exams FOR SELECT TO authenticated USING (public.is_platform_admin());


--
-- Name: exams exams_select_entitled; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY exams_select_entitled ON public.exams FOR SELECT TO authenticated USING ((is_published AND public.can_open_academy_module((module_id)::bigint)));


--
-- Name: exams exams_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY exams_update_admin ON public.exams FOR UPDATE TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());


--
-- Name: legacy_academy_module_access legacy_academy_access_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY legacy_academy_access_select_own ON public.legacy_academy_module_access FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.students s
  WHERE ((s.id = legacy_academy_module_access.student_id) AND (s.auth_user_id = auth.uid())))));


--
-- Name: legacy_academy_module_access; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.legacy_academy_module_access ENABLE ROW LEVEL SECURITY;

--
-- Name: conversation_events legacy_mentor_chat_event_write_guard; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY legacy_mentor_chat_event_write_guard ON public.conversation_events AS RESTRICTIVE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.conversation_threads t
  WHERE ((t.id = conversation_events.thread_id) AND ((t.source_type <> 'mentor_chat'::text) OR (public.legacy_chat_thread_role(t.id) = 'mentor'::text)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.conversation_threads t
  WHERE ((t.id = conversation_events.thread_id) AND (t.source_type <> 'mentor_chat'::text)))));


--
-- Name: conversation_messages legacy_mentor_chat_message_delete_guard; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY legacy_mentor_chat_message_delete_guard ON public.conversation_messages AS RESTRICTIVE FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.conversation_threads t
  WHERE ((t.id = conversation_messages.thread_id) AND (t.source_type <> 'mentor_chat'::text)))));


--
-- Name: conversation_messages legacy_mentor_chat_message_insert_guard; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY legacy_mentor_chat_message_insert_guard ON public.conversation_messages AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.conversation_threads t
  WHERE ((t.id = conversation_messages.thread_id) AND ((t.source_type <> 'mentor_chat'::text) OR ((conversation_messages.sender_student_id = public.legacy_chat_current_student_id()) AND (((public.legacy_chat_thread_role(t.id) = 'student'::text) AND (conversation_messages.sender_role = 'student'::text) AND (NOT conversation_messages.is_internal)) OR ((public.legacy_chat_thread_role(t.id) = 'mentor'::text) AND (conversation_messages.sender_role = ANY (ARRAY['mentor'::text, 'admin'::text]))))))))));


--
-- Name: conversation_messages legacy_mentor_chat_message_update_guard; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY legacy_mentor_chat_message_update_guard ON public.conversation_messages AS RESTRICTIVE FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.conversation_threads t
  WHERE ((t.id = conversation_messages.thread_id) AND (t.source_type <> 'mentor_chat'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.conversation_threads t
  WHERE ((t.id = conversation_messages.thread_id) AND (t.source_type <> 'mentor_chat'::text)))));


--
-- Name: conversation_message_reactions legacy_mentor_chat_reaction_delete_guard; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY legacy_mentor_chat_reaction_delete_guard ON public.conversation_message_reactions AS RESTRICTIVE FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.conversation_messages m
     JOIN public.conversation_threads t ON ((t.id = m.thread_id)))
  WHERE ((m.id = conversation_message_reactions.message_id) AND (t.source_type <> 'mentor_chat'::text)))));


--
-- Name: conversation_message_reactions legacy_mentor_chat_reaction_insert_guard; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY legacy_mentor_chat_reaction_insert_guard ON public.conversation_message_reactions AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.conversation_messages m
     JOIN public.conversation_threads t ON ((t.id = m.thread_id)))
  WHERE ((m.id = conversation_message_reactions.message_id) AND (t.source_type <> 'mentor_chat'::text)))));


--
-- Name: conversation_message_reactions legacy_mentor_chat_reaction_update_guard; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY legacy_mentor_chat_reaction_update_guard ON public.conversation_message_reactions AS RESTRICTIVE FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.conversation_messages m
     JOIN public.conversation_threads t ON ((t.id = m.thread_id)))
  WHERE ((m.id = conversation_message_reactions.message_id) AND (t.source_type <> 'mentor_chat'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.conversation_messages m
     JOIN public.conversation_threads t ON ((t.id = m.thread_id)))
  WHERE ((m.id = conversation_message_reactions.message_id) AND (t.source_type <> 'mentor_chat'::text)))));


--
-- Name: conversation_threads legacy_mentor_chat_thread_delete_guard; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY legacy_mentor_chat_thread_delete_guard ON public.conversation_threads AS RESTRICTIVE FOR DELETE TO authenticated USING ((source_type <> 'mentor_chat'::text));


--
-- Name: conversation_threads legacy_mentor_chat_thread_insert_guard; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY legacy_mentor_chat_thread_insert_guard ON public.conversation_threads AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (((source_type <> 'mentor_chat'::text) OR ((source_id IS NULL) AND (student_id = public.legacy_chat_current_student_id()) AND (student_id <> public.legacy_chat_mentor_id()) AND (assigned_to_student_id = public.legacy_chat_mentor_id()))));


--
-- Name: conversation_threads legacy_mentor_chat_thread_update_guard; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY legacy_mentor_chat_thread_update_guard ON public.conversation_threads AS RESTRICTIVE FOR UPDATE TO authenticated USING (((source_type <> 'mentor_chat'::text) OR (public.legacy_chat_thread_role(id) = 'mentor'::text))) WITH CHECK (((source_type <> 'mentor_chat'::text) OR (public.legacy_chat_thread_role(id) = 'mentor'::text)));


--
-- Name: lesson_action_progress; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lesson_action_progress ENABLE ROW LEVEL SECURITY;

--
-- Name: lesson_action_progress lesson_action_progress_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lesson_action_progress_insert_own ON public.lesson_action_progress FOR INSERT TO authenticated WITH CHECK ((public.can_read_academy_lesson(lesson_id) AND (EXISTS ( SELECT 1
   FROM public.students s
  WHERE ((s.id = lesson_action_progress.student_id) AND (s.auth_user_id = auth.uid()))))));


--
-- Name: lesson_action_progress lesson_action_progress_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lesson_action_progress_select_admin ON public.lesson_action_progress FOR SELECT TO authenticated USING (public.is_platform_admin());


--
-- Name: lesson_action_progress lesson_action_progress_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lesson_action_progress_select_own ON public.lesson_action_progress FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.students s
  WHERE ((s.id = lesson_action_progress.student_id) AND (s.auth_user_id = auth.uid())))));


--
-- Name: lesson_action_progress lesson_action_progress_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lesson_action_progress_update_own ON public.lesson_action_progress FOR UPDATE TO authenticated USING ((public.can_read_academy_lesson(lesson_id) AND (EXISTS ( SELECT 1
   FROM public.students s
  WHERE ((s.id = lesson_action_progress.student_id) AND (s.auth_user_id = auth.uid())))))) WITH CHECK ((public.can_read_academy_lesson(lesson_id) AND (EXISTS ( SELECT 1
   FROM public.students s
  WHERE ((s.id = lesson_action_progress.student_id) AND (s.auth_user_id = auth.uid()))))));


--
-- Name: lessons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;

--
-- Name: lessons lessons_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lessons_delete_admin ON public.lessons FOR DELETE TO authenticated USING (public.is_platform_admin());


--
-- Name: lessons lessons_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lessons_insert_admin ON public.lessons FOR INSERT TO authenticated WITH CHECK (public.is_platform_admin());


--
-- Name: lessons lessons_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lessons_select_admin ON public.lessons FOR SELECT TO authenticated USING (public.is_platform_admin());


--
-- Name: lessons lessons_select_published_entitled; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lessons_select_published_entitled ON public.lessons FOR SELECT TO authenticated USING ((is_published AND public.can_read_academy_lesson((id)::bigint)));


--
-- Name: lessons lessons_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lessons_update_admin ON public.lessons FOR UPDATE TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());


--
-- Name: live_session_provider_secrets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.live_session_provider_secrets ENABLE ROW LEVEL SECURITY;

--
-- Name: live_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: live_sessions live_sessions_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY live_sessions_delete_admin ON public.live_sessions FOR DELETE TO authenticated USING (public.is_platform_admin());


--
-- Name: live_sessions live_sessions_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY live_sessions_insert_admin ON public.live_sessions FOR INSERT TO authenticated WITH CHECK (public.is_platform_admin());


--
-- Name: live_sessions live_sessions_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY live_sessions_select_admin ON public.live_sessions FOR SELECT TO authenticated USING (public.is_platform_admin());


--
-- Name: live_sessions live_sessions_select_subscriber; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY live_sessions_select_subscriber ON public.live_sessions FOR SELECT TO authenticated USING (((is_published = true) AND (status = ANY (ARRAY['scheduled'::text, 'live'::text, 'completed'::text, 'cancelled'::text])) AND (EXISTS ( SELECT 1
   FROM public.students student
  WHERE ((student.auth_user_id = auth.uid()) AND (student.access_level >= 2))))));


--
-- Name: live_sessions live_sessions_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY live_sessions_update_admin ON public.live_sessions FOR UPDATE TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());


--
-- Name: market_post_reactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.market_post_reactions ENABLE ROW LEVEL SECURITY;

--
-- Name: conversation_events mentor_chat_event_privacy_guard; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mentor_chat_event_privacy_guard ON public.conversation_events AS RESTRICTIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.conversation_threads t
  WHERE ((t.id = conversation_events.thread_id) AND ((t.source_type <> 'mentor_chat'::text) OR (public.chat_participant_role(t.id) = 'mentor'::text))))));


--
-- Name: conversation_messages mentor_chat_message_privacy_guard; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mentor_chat_message_privacy_guard ON public.conversation_messages AS RESTRICTIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.conversation_threads t
  WHERE ((t.id = conversation_messages.thread_id) AND ((t.source_type <> 'mentor_chat'::text) OR ((public.chat_participant_role(t.id) IS NOT NULL) AND ((NOT conversation_messages.is_internal) OR (public.chat_participant_role(t.id) = 'mentor'::text)) AND (conversation_messages.deleted_at IS NULL)))))));


--
-- Name: notification_events mentor_chat_notification_event_delete_guard; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mentor_chat_notification_event_delete_guard ON public.notification_events AS RESTRICTIVE FOR DELETE TO authenticated USING ((NOT public.is_chat_notification_event(id)));


--
-- Name: notification_events mentor_chat_notification_event_insert_guard; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mentor_chat_notification_event_insert_guard ON public.notification_events AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (((type <> ALL (ARRAY['mentor_new_message'::text, 'mentor_reply'::text])) AND (COALESCE(target_table, ''::text) <> ALL (ARRAY['conversation_threads'::text, 'conversation_messages'::text, 'conversation_events'::text])) AND (NOT (metadata ? 'thread_id'::text))));


--
-- Name: notification_events mentor_chat_notification_event_privacy_guard; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mentor_chat_notification_event_privacy_guard ON public.notification_events AS RESTRICTIVE FOR SELECT TO authenticated USING (((NOT public.is_chat_notification_event(id)) OR public.can_read_notification_event(id)));


--
-- Name: notification_events mentor_chat_notification_event_update_guard; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mentor_chat_notification_event_update_guard ON public.notification_events AS RESTRICTIVE FOR UPDATE TO authenticated USING ((NOT public.is_chat_notification_event(id))) WITH CHECK (((type <> ALL (ARRAY['mentor_new_message'::text, 'mentor_reply'::text])) AND (COALESCE(target_table, ''::text) <> ALL (ARRAY['conversation_threads'::text, 'conversation_messages'::text, 'conversation_events'::text])) AND (NOT (metadata ? 'thread_id'::text))));


--
-- Name: notification_recipients mentor_chat_notification_recipient_delete_guard; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mentor_chat_notification_recipient_delete_guard ON public.notification_recipients AS RESTRICTIVE FOR DELETE TO authenticated USING ((NOT public.is_chat_notification_event(event_id)));


--
-- Name: notification_recipients mentor_chat_notification_recipient_insert_guard; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mentor_chat_notification_recipient_insert_guard ON public.notification_recipients AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK ((NOT public.is_chat_notification_event(event_id)));


--
-- Name: notification_recipients mentor_chat_notification_recipient_privacy_guard; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mentor_chat_notification_recipient_privacy_guard ON public.notification_recipients AS RESTRICTIVE FOR SELECT TO authenticated USING (((NOT public.is_chat_notification_event(event_id)) OR public.can_access_notification_recipient(event_id, student_id)));


--
-- Name: notification_recipients mentor_chat_notification_recipient_update_guard; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mentor_chat_notification_recipient_update_guard ON public.notification_recipients AS RESTRICTIVE FOR UPDATE TO authenticated USING (((NOT public.is_chat_notification_event(event_id)) OR public.can_access_notification_recipient(event_id, student_id))) WITH CHECK (((NOT public.is_chat_notification_event(event_id)) OR public.can_access_notification_recipient(event_id, student_id)));


--
-- Name: conversation_message_reactions mentor_chat_reaction_privacy_guard; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mentor_chat_reaction_privacy_guard ON public.conversation_message_reactions AS RESTRICTIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.conversation_messages m
     JOIN public.conversation_threads t ON ((t.id = m.thread_id)))
  WHERE ((m.id = conversation_message_reactions.message_id) AND ((t.source_type <> 'mentor_chat'::text) OR ((public.chat_participant_role(t.id) IS NOT NULL) AND (m.deleted_at IS NULL) AND ((NOT m.is_internal) OR (public.chat_participant_role(t.id) = 'mentor'::text))))))));


--
-- Name: conversation_threads mentor_chat_thread_privacy_guard; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mentor_chat_thread_privacy_guard ON public.conversation_threads AS RESTRICTIVE FOR SELECT TO authenticated USING (((source_type <> 'mentor_chat'::text) OR (public.chat_participant_role(id) IS NOT NULL)));


--
-- Name: modules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;

--
-- Name: modules modules_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY modules_delete_admin ON public.modules FOR DELETE TO authenticated USING (public.is_platform_admin());


--
-- Name: modules modules_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY modules_insert_admin ON public.modules FOR INSERT TO authenticated WITH CHECK (public.is_platform_admin());


--
-- Name: modules modules_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY modules_select_admin ON public.modules FOR SELECT TO authenticated USING (public.is_platform_admin());


--
-- Name: modules modules_select_published; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY modules_select_published ON public.modules FOR SELECT TO authenticated USING ((is_published = true));


--
-- Name: modules modules_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY modules_update_admin ON public.modules FOR UPDATE TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());


--
-- Name: mux_webhook_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mux_webhook_events ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_events notification_events_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notification_events_insert_admin ON public.notification_events FOR INSERT TO authenticated WITH CHECK (public.is_platform_admin());


--
-- Name: notification_events notification_events_select_recipients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notification_events_select_recipients ON public.notification_events FOR SELECT TO authenticated USING (public.can_read_notification_event(id));


--
-- Name: notification_preferences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_preferences notification_preferences_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notification_preferences_insert_own ON public.notification_preferences FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.students s
  WHERE ((s.id = notification_preferences.student_id) AND (s.auth_user_id = auth.uid())))));


--
-- Name: notification_preferences notification_preferences_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notification_preferences_select_own ON public.notification_preferences FOR SELECT TO authenticated USING ((public.is_platform_admin() OR (EXISTS ( SELECT 1
   FROM public.students s
  WHERE ((s.id = notification_preferences.student_id) AND (s.auth_user_id = auth.uid()))))));


--
-- Name: notification_preferences notification_preferences_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notification_preferences_update_own ON public.notification_preferences FOR UPDATE TO authenticated USING ((public.is_platform_admin() OR (EXISTS ( SELECT 1
   FROM public.students s
  WHERE ((s.id = notification_preferences.student_id) AND (s.auth_user_id = auth.uid())))))) WITH CHECK ((public.is_platform_admin() OR (EXISTS ( SELECT 1
   FROM public.students s
  WHERE ((s.id = notification_preferences.student_id) AND (s.auth_user_id = auth.uid()))))));


--
-- Name: notification_recipients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notification_recipients ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_recipients notification_recipients_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notification_recipients_insert_admin ON public.notification_recipients FOR INSERT TO authenticated WITH CHECK (public.is_platform_admin());


--
-- Name: notification_recipients notification_recipients_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notification_recipients_select_own ON public.notification_recipients FOR SELECT TO authenticated USING (public.can_access_notification_recipient(event_id, student_id));


--
-- Name: notification_recipients notification_recipients_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notification_recipients_update_own ON public.notification_recipients FOR UPDATE TO authenticated USING (public.can_access_notification_recipient(event_id, student_id)) WITH CHECK (public.can_access_notification_recipient(event_id, student_id));


--
-- Name: one_time_purchases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.one_time_purchases ENABLE ROW LEVEL SECURITY;

--
-- Name: one_time_purchases one_time_purchases_select_own_or_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY one_time_purchases_select_own_or_admin ON public.one_time_purchases FOR SELECT TO authenticated USING ((public.is_platform_admin() OR (EXISTS ( SELECT 1
   FROM public.students student
  WHERE ((student.id = one_time_purchases.student_id) AND (student.auth_user_id = auth.uid()))))));


--
-- Name: payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

--
-- Name: pdf_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pdf_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: pdf_open_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pdf_open_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: pdf_open_logs pdf_open_logs_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pdf_open_logs_admin ON public.pdf_open_logs FOR SELECT TO authenticated USING ((public.is_pdf_admin() AND (opened_at >= (now() - '30 days'::interval))));


--
-- Name: pdf_positions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pdf_positions ENABLE ROW LEVEL SECURITY;

--
-- Name: pdf_positions pdf_positions_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pdf_positions_owner ON public.pdf_positions FOR SELECT TO authenticated USING ((public.has_live_learning_account() AND (student_id IN ( SELECT s.id
   FROM public.students s
  WHERE (s.auth_user_id = auth.uid()))) AND public.can_read_pdf(document_id) AND (document_version = public.current_pdf_version(document_id))));


--
-- Name: practical_lessons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.practical_lessons ENABLE ROW LEVEL SECURITY;

--
-- Name: practical_lessons practical_lessons_select_entitled; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY practical_lessons_select_entitled ON public.practical_lessons FOR SELECT TO authenticated USING ((public.is_platform_admin() OR public.can_open_academy_module((module_id)::bigint)));


--
-- Name: product_board_cycles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_board_cycles ENABLE ROW LEVEL SECURITY;

--
-- Name: product_board_cycles product_board_cycles_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY product_board_cycles_admin_read ON public.product_board_cycles FOR SELECT TO authenticated USING (public.is_platform_admin());


--
-- Name: product_board_cycles product_board_cycles_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY product_board_cycles_admin_update ON public.product_board_cycles FOR UPDATE TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());


--
-- Name: product_board_tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_board_tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: product_board_tasks product_board_tasks_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY product_board_tasks_admin_insert ON public.product_board_tasks FOR INSERT TO authenticated WITH CHECK ((public.is_platform_admin() AND (created_by = ( SELECT students.id
   FROM public.students
  WHERE (students.auth_user_id = auth.uid())))));


--
-- Name: product_board_tasks product_board_tasks_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY product_board_tasks_admin_read ON public.product_board_tasks FOR SELECT TO authenticated USING (public.is_platform_admin());


--
-- Name: product_board_tasks product_board_tasks_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY product_board_tasks_admin_update ON public.product_board_tasks FOR UPDATE TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());


--
-- Name: progress; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.progress ENABLE ROW LEVEL SECURITY;

--
-- Name: progress progress_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY progress_delete_admin ON public.progress FOR DELETE TO authenticated USING (public.is_platform_admin());


--
-- Name: progress progress_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY progress_insert_admin ON public.progress FOR INSERT TO authenticated WITH CHECK (public.is_platform_admin());


--
-- Name: progress progress_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY progress_insert_own ON public.progress FOR INSERT TO authenticated WITH CHECK ((public.can_read_academy_lesson((lesson_id)::bigint) AND (EXISTS ( SELECT 1
   FROM public.students s
  WHERE ((s.id = progress.student_id) AND (s.auth_user_id = auth.uid()))))));


--
-- Name: progress progress_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY progress_select_admin ON public.progress FOR SELECT TO authenticated USING (public.is_platform_admin());


--
-- Name: progress progress_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY progress_select_own ON public.progress FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.students s
  WHERE ((s.id = progress.student_id) AND (s.auth_user_id = auth.uid())))));


--
-- Name: progress progress_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY progress_update_admin ON public.progress FOR UPDATE TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());


--
-- Name: progress progress_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY progress_update_own ON public.progress FOR UPDATE TO authenticated USING ((public.can_read_academy_lesson((lesson_id)::bigint) AND (EXISTS ( SELECT 1
   FROM public.students s
  WHERE ((s.id = progress.student_id) AND (s.auth_user_id = auth.uid())))))) WITH CHECK ((public.can_read_academy_lesson((lesson_id)::bigint) AND (EXISTS ( SELECT 1
   FROM public.students s
  WHERE ((s.id = progress.student_id) AND (s.auth_user_id = auth.uid()))))));


--
-- Name: market_post_reactions reactions_add_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reactions_add_own ON public.market_post_reactions FOR INSERT TO authenticated WITH CHECK ((public.can_read_market_post(post_id) AND (student_id IN ( SELECT students.id
   FROM public.students
  WHERE (students.auth_user_id = auth.uid())))));


--
-- Name: market_post_reactions reactions_read_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reactions_read_own ON public.market_post_reactions FOR SELECT TO authenticated USING ((public.can_read_market_post(post_id) AND (student_id IN ( SELECT students.id
   FROM public.students
  WHERE (students.auth_user_id = auth.uid())))));


--
-- Name: market_post_reactions reactions_remove_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reactions_remove_own ON public.market_post_reactions FOR DELETE TO authenticated USING ((public.can_read_market_post(post_id) AND (student_id IN ( SELECT students.id
   FROM public.students
  WHERE (students.auth_user_id = auth.uid())))));


--
-- Name: stripe_webhook_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

--
-- Name: student_avatars; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.student_avatars ENABLE ROW LEVEL SECURITY;

--
-- Name: student_entitlements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.student_entitlements ENABLE ROW LEVEL SECURITY;

--
-- Name: student_entitlements student_entitlements_select_own_or_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY student_entitlements_select_own_or_admin ON public.student_entitlements FOR SELECT TO authenticated USING ((public.is_platform_admin() OR (EXISTS ( SELECT 1
   FROM public.students student
  WHERE ((student.id = student_entitlements.student_id) AND (student.auth_user_id = auth.uid()))))));


--
-- Name: student_mentor_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.student_mentor_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: student_mentor_notes student_mentor_notes_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY student_mentor_notes_delete_admin ON public.student_mentor_notes FOR DELETE TO authenticated USING (public.is_platform_admin());


--
-- Name: student_mentor_notes student_mentor_notes_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY student_mentor_notes_insert_admin ON public.student_mentor_notes FOR INSERT TO authenticated WITH CHECK (public.is_platform_admin());


--
-- Name: student_mentor_notes student_mentor_notes_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY student_mentor_notes_select_admin ON public.student_mentor_notes FOR SELECT TO authenticated USING (public.is_platform_admin());


--
-- Name: student_mentor_notes student_mentor_notes_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY student_mentor_notes_update_admin ON public.student_mentor_notes FOR UPDATE TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());


--
-- Name: student_onboarding_responses student_onboarding_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY student_onboarding_insert_own ON public.student_onboarding_responses FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.students s
  WHERE ((s.id = student_onboarding_responses.student_id) AND (s.auth_user_id = auth.uid())))));


--
-- Name: student_onboarding_responses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.student_onboarding_responses ENABLE ROW LEVEL SECURITY;

--
-- Name: student_onboarding_responses student_onboarding_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY student_onboarding_select_admin ON public.student_onboarding_responses FOR SELECT TO authenticated USING (public.is_platform_admin());


--
-- Name: student_onboarding_responses student_onboarding_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY student_onboarding_select_own ON public.student_onboarding_responses FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.students s
  WHERE ((s.id = student_onboarding_responses.student_id) AND (s.auth_user_id = auth.uid())))));


--
-- Name: student_onboarding_responses student_onboarding_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY student_onboarding_update_own ON public.student_onboarding_responses FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.students s
  WHERE ((s.id = student_onboarding_responses.student_id) AND (s.auth_user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.students s
  WHERE ((s.id = student_onboarding_responses.student_id) AND (s.auth_user_id = auth.uid())))));


--
-- Name: students; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

--
-- Name: students students select own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "students select own profile" ON public.students FOR SELECT TO authenticated USING ((auth.uid() = auth_user_id));


--
-- Name: students students_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY students_insert_own ON public.students FOR INSERT TO authenticated WITH CHECK (((auth_user_id = auth.uid()) AND (access_level = 1) AND (mentor_status = 'active'::text) AND (cardinality(tags) = 0)));


--
-- Name: students students_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY students_select_admin ON public.students FOR SELECT TO authenticated USING (public.is_platform_admin());


--
-- Name: students students_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY students_select_own ON public.students FOR SELECT TO authenticated USING ((auth_user_id = auth.uid()));


--
-- Name: students students_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY students_update_admin ON public.students FOR UPDATE TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());


--
-- Name: students students_update_own_profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY students_update_own_profile ON public.students FOR UPDATE TO authenticated USING ((auth_user_id = auth.uid())) WITH CHECK ((auth_user_id = auth.uid()));


--
-- Name: subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: subscriptions subscriptions_select_own_or_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY subscriptions_select_own_or_admin ON public.subscriptions FOR SELECT TO authenticated USING ((public.is_platform_admin() OR (EXISTS ( SELECT 1
   FROM public.students student
  WHERE ((student.id = subscriptions.student_id) AND (student.auth_user_id = auth.uid()))))));


--
-- Name: update_reads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.update_reads ENABLE ROW LEVEL SECURITY;

--
-- Name: update_reads update_reads_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY update_reads_insert_own ON public.update_reads FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.students s
  WHERE ((s.auth_user_id = auth.uid()) AND (s.id = update_reads.student_id) AND (s.access_level = ANY (ARRAY[2, 3]))))));


--
-- Name: update_reads update_reads_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY update_reads_select_own ON public.update_reads FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.students s
  WHERE ((s.auth_user_id = auth.uid()) AND (s.id = update_reads.student_id)))));


--
-- Name: updates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.updates ENABLE ROW LEVEL SECURITY;

--
-- Name: updates updates_delete_only_own_by_mentors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY updates_delete_only_own_by_mentors ON public.updates FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.students s
  WHERE ((s.auth_user_id = auth.uid()) AND (s.id = updates.author_id) AND (s.access_level = 3)))));


--
-- Name: updates updates_insert_only_mentors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY updates_insert_only_mentors ON public.updates FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.students s
  WHERE ((s.auth_user_id = auth.uid()) AND (s.id = updates.author_id) AND (s.access_level = 3)))));


--
-- Name: updates updates_select_all_authenticated_students; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY updates_select_all_authenticated_students ON public.updates FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.students s
  WHERE ((s.auth_user_id = auth.uid()) AND (s.id = s.id)))));


--
-- Name: updates updates_update_only_own_by_mentors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY updates_update_only_own_by_mentors ON public.updates FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.students s
  WHERE ((s.auth_user_id = auth.uid()) AND (s.id = updates.author_id) AND (s.access_level = 3))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.students s
  WHERE ((s.auth_user_id = auth.uid()) AND (s.id = updates.author_id) AND (s.access_level = 3)))));


--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles user_roles_manage_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_roles_manage_admin ON public.user_roles TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());


--
-- Name: user_roles user_roles_select_own_or_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_roles_select_own_or_admin ON public.user_roles FOR SELECT TO authenticated USING ((public.is_platform_admin() OR (EXISTS ( SELECT 1
   FROM public.students student
  WHERE ((student.id = user_roles.student_id) AND (student.auth_user_id = auth.uid()))))));


--
-- Name: video_positions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.video_positions ENABLE ROW LEVEL SECURITY;

--
-- Name: video_positions video_positions_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY video_positions_select_own ON public.video_positions FOR SELECT TO authenticated USING (((student_id IN ( SELECT s.id
   FROM public.students s
  WHERE (s.auth_user_id = auth.uid()))) AND (video_version = public.htp_video_version(
CASE
    WHEN (lesson_id IS NULL) THEN 'update'::text
    ELSE 'lesson'::text
END, COALESCE(lesson_id, weekly_update_id)))));


--
-- Name: weekly_update_views; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.weekly_update_views ENABLE ROW LEVEL SECURITY;

--
-- Name: weekly_update_views weekly_update_views_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY weekly_update_views_delete_admin ON public.weekly_update_views FOR DELETE TO authenticated USING (public.is_platform_admin());


--
-- Name: weekly_update_views weekly_update_views_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY weekly_update_views_insert_admin ON public.weekly_update_views FOR INSERT TO authenticated WITH CHECK (public.is_platform_admin());


--
-- Name: weekly_update_views weekly_update_views_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY weekly_update_views_insert_own ON public.weekly_update_views FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.students s
  WHERE ((s.id = weekly_update_views.student_id) AND (s.auth_user_id = auth.uid())))));


--
-- Name: weekly_update_views weekly_update_views_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY weekly_update_views_select_admin ON public.weekly_update_views FOR SELECT TO authenticated USING (public.is_platform_admin());


--
-- Name: weekly_update_views weekly_update_views_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY weekly_update_views_select_own ON public.weekly_update_views FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.students s
  WHERE ((s.id = weekly_update_views.student_id) AND (s.auth_user_id = auth.uid())))));


--
-- Name: weekly_update_views weekly_update_views_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY weekly_update_views_update_admin ON public.weekly_update_views FOR UPDATE TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());


--
-- Name: weekly_update_views weekly_update_views_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY weekly_update_views_update_own ON public.weekly_update_views FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.students s
  WHERE ((s.id = weekly_update_views.student_id) AND (s.auth_user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.students s
  WHERE ((s.id = weekly_update_views.student_id) AND (s.auth_user_id = auth.uid())))));


--
-- Name: weekly_updates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.weekly_updates ENABLE ROW LEVEL SECURITY;

--
-- Name: weekly_updates weekly_updates_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY weekly_updates_delete_admin ON public.weekly_updates FOR DELETE TO authenticated USING (public.is_platform_admin());


--
-- Name: weekly_updates weekly_updates_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY weekly_updates_insert_admin ON public.weekly_updates FOR INSERT TO authenticated WITH CHECK (public.is_platform_admin());


--
-- Name: weekly_updates weekly_updates_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY weekly_updates_select_admin ON public.weekly_updates FOR SELECT TO authenticated USING (public.is_platform_admin());


--
-- Name: weekly_updates weekly_updates_select_full_course; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY weekly_updates_select_full_course ON public.weekly_updates FOR SELECT TO authenticated USING (((is_published = true) AND (access_tier = 'full_course'::text) AND ((type = ANY (ARRAY['weekly_outlook'::text, 'market_update'::text, 'live_session'::text])) OR (type IS NULL)) AND (EXISTS ( SELECT 1
   FROM public.students s
  WHERE ((s.auth_user_id = auth.uid()) AND (s.access_level >= 2))))));


--
-- Name: weekly_updates weekly_updates_select_published_free; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY weekly_updates_select_published_free ON public.weekly_updates FOR SELECT TO authenticated USING (((is_published = true) AND (access_tier = 'free'::text) AND ((type = ANY (ARRAY['weekly_outlook'::text, 'market_update'::text, 'live_session'::text])) OR (type IS NULL))));


--
-- Name: weekly_updates weekly_updates_select_subscription; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY weekly_updates_select_subscription ON public.weekly_updates FOR SELECT TO authenticated USING (((is_published = true) AND (access_tier = 'subscription'::text) AND ((type = ANY (ARRAY['weekly_outlook'::text, 'market_update'::text, 'live_session'::text])) OR (type IS NULL)) AND (EXISTS ( SELECT 1
   FROM public.students student
  WHERE ((student.auth_user_id = auth.uid()) AND (student.access_level >= 2))))));


--
-- Name: weekly_updates weekly_updates_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY weekly_updates_update_admin ON public.weekly_updates FOR UPDATE TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION _send_chat_message_core(p_body text, p_client_message_id uuid, p_thread_id uuid, p_is_internal boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._send_chat_message_core(p_body text, p_client_message_id uuid, p_thread_id uuid, p_is_internal boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public._send_chat_message_core(p_body text, p_client_message_id uuid, p_thread_id uuid, p_is_internal boolean) TO service_role;


--
-- Name: FUNCTION can_access_notification_recipient(p_event_id uuid, p_student_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.can_access_notification_recipient(p_event_id uuid, p_student_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.can_access_notification_recipient(p_event_id uuid, p_student_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.can_access_notification_recipient(p_event_id uuid, p_student_id uuid) TO authenticated;


--
-- Name: FUNCTION can_open_academy_module(p_module_id bigint); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.can_open_academy_module(p_module_id bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public.can_open_academy_module(p_module_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.can_open_academy_module(p_module_id bigint) TO service_role;


--
-- Name: FUNCTION can_read_academy_lesson(p_lesson_id bigint); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.can_read_academy_lesson(p_lesson_id bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public.can_read_academy_lesson(p_lesson_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.can_read_academy_lesson(p_lesson_id bigint) TO service_role;


--
-- Name: FUNCTION can_read_chat_attachment(p_attachment_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.can_read_chat_attachment(p_attachment_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.can_read_chat_attachment(p_attachment_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.can_read_chat_attachment(p_attachment_id uuid) TO authenticated;


--
-- Name: FUNCTION can_read_chat_profile(p_student_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.can_read_chat_profile(p_student_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.can_read_chat_profile(p_student_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.can_read_chat_profile(p_student_id uuid) TO authenticated;


--
-- Name: FUNCTION can_read_market_post(p_post_id bigint); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.can_read_market_post(p_post_id bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public.can_read_market_post(p_post_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.can_read_market_post(p_post_id bigint) TO service_role;


--
-- Name: FUNCTION can_read_notification_event(p_event_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.can_read_notification_event(p_event_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.can_read_notification_event(p_event_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.can_read_notification_event(p_event_id uuid) TO authenticated;


--
-- Name: FUNCTION can_read_pdf(p_document_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.can_read_pdf(p_document_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.can_read_pdf(p_document_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.can_read_pdf(p_document_id uuid) TO service_role;


--
-- Name: FUNCTION can_read_student_avatar(p_student_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.can_read_student_avatar(p_student_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.can_read_student_avatar(p_student_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.can_read_student_avatar(p_student_id uuid) TO service_role;


--
-- Name: FUNCTION can_start_academy_exam(p_module_id bigint); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.can_start_academy_exam(p_module_id bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public.can_start_academy_exam(p_module_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.can_start_academy_exam(p_module_id bigint) TO service_role;


--
-- Name: FUNCTION chat_attachment_projection(p_attachment_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.chat_attachment_projection(p_attachment_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.chat_attachment_projection(p_attachment_id uuid) TO service_role;


--
-- Name: FUNCTION chat_attachment_readable_by_student(p_attachment_id uuid, p_student_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.chat_attachment_readable_by_student(p_attachment_id uuid, p_student_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.chat_attachment_readable_by_student(p_attachment_id uuid, p_student_id uuid) TO service_role;


--
-- Name: FUNCTION chat_attachment_role_for_student(p_thread_id uuid, p_student_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.chat_attachment_role_for_student(p_thread_id uuid, p_student_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.chat_attachment_role_for_student(p_thread_id uuid, p_student_id uuid) TO service_role;


--
-- Name: FUNCTION chat_email_is_suppressed(p_student_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.chat_email_is_suppressed(p_student_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.chat_email_is_suppressed(p_student_id uuid) TO service_role;


--
-- Name: FUNCTION chat_email_recipient_snapshot(p_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.chat_email_recipient_snapshot(p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.chat_email_recipient_snapshot(p_id uuid) TO service_role;


--
-- Name: FUNCTION chat_notification_thread_id(p_event_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.chat_notification_thread_id(p_event_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.chat_notification_thread_id(p_event_id uuid) TO service_role;


--
-- Name: FUNCTION chat_participant_role(p_thread_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.chat_participant_role(p_thread_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.chat_participant_role(p_thread_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.chat_participant_role(p_thread_id uuid) TO authenticated;


--
-- Name: FUNCTION chat_presence_heartbeat(p_session_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.chat_presence_heartbeat(p_session_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.chat_presence_heartbeat(p_session_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.chat_presence_heartbeat(p_session_id uuid) TO authenticated;


--
-- Name: FUNCTION chat_presence_leave(p_session_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.chat_presence_leave(p_session_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.chat_presence_leave(p_session_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.chat_presence_leave(p_session_id uuid) TO authenticated;


--
-- Name: FUNCTION chat_thread_mentor_id(p_thread_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.chat_thread_mentor_id(p_thread_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.chat_thread_mentor_id(p_thread_id uuid) TO service_role;


--
-- Name: FUNCTION claim_ai_video_workflow(p_transcript_id uuid, p_lease_seconds integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.claim_ai_video_workflow(p_transcript_id uuid, p_lease_seconds integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.claim_ai_video_workflow(p_transcript_id uuid, p_lease_seconds integer) TO authenticated;
GRANT ALL ON FUNCTION public.claim_ai_video_workflow(p_transcript_id uuid, p_lease_seconds integer) TO service_role;


--
-- Name: FUNCTION claim_avatar_garbage(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.claim_avatar_garbage() FROM PUBLIC;
GRANT ALL ON FUNCTION public.claim_avatar_garbage() TO service_role;


--
-- Name: FUNCTION claim_chat_attachment_garbage(p_limit integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.claim_chat_attachment_garbage(p_limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.claim_chat_attachment_garbage(p_limit integer) TO service_role;


--
-- Name: TABLE chat_email_outbox; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.chat_email_outbox TO service_role;


--
-- Name: FUNCTION claim_chat_email_notification(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.claim_chat_email_notification() FROM PUBLIC;
GRANT ALL ON FUNCTION public.claim_chat_email_notification() TO service_role;


--
-- Name: FUNCTION claim_video_enrichment(p_transcript_id uuid, p_prompt_version text, p_model text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.claim_video_enrichment(p_transcript_id uuid, p_prompt_version text, p_model text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.claim_video_enrichment(p_transcript_id uuid, p_prompt_version text, p_model text) TO authenticated;
GRANT ALL ON FUNCTION public.claim_video_enrichment(p_transcript_id uuid, p_prompt_version text, p_model text) TO service_role;


--
-- Name: FUNCTION cleanup_deleted_auth_market_profile(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.cleanup_deleted_auth_market_profile() FROM PUBLIC;
GRANT ALL ON FUNCTION public.cleanup_deleted_auth_market_profile() TO service_role;


--
-- Name: FUNCTION cleanup_deleted_auth_pdf_logs(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.cleanup_deleted_auth_pdf_logs() FROM PUBLIC;
GRANT ALL ON FUNCTION public.cleanup_deleted_auth_pdf_logs() TO service_role;


--
-- Name: FUNCTION cleanup_deleted_auth_pdf_positions(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.cleanup_deleted_auth_pdf_positions() FROM PUBLIC;
GRANT ALL ON FUNCTION public.cleanup_deleted_auth_pdf_positions() TO service_role;


--
-- Name: FUNCTION cleanup_deleted_auth_video_positions(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.cleanup_deleted_auth_video_positions() FROM PUBLIC;
GRANT ALL ON FUNCTION public.cleanup_deleted_auth_video_positions() TO service_role;


--
-- Name: FUNCTION commit_student_avatar(p_auth_uid uuid, p_path text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.commit_student_avatar(p_auth_uid uuid, p_path text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.commit_student_avatar(p_auth_uid uuid, p_path text) TO service_role;


--
-- Name: FUNCTION complete_chat_attachment_cleanup(p_attachment_ids uuid[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.complete_chat_attachment_cleanup(p_attachment_ids uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.complete_chat_attachment_cleanup(p_attachment_ids uuid[]) TO service_role;


--
-- Name: FUNCTION complete_chat_attachment_upload(p_auth_uid uuid, p_attachment_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.complete_chat_attachment_upload(p_auth_uid uuid, p_attachment_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.complete_chat_attachment_upload(p_auth_uid uuid, p_attachment_id uuid) TO service_role;


--
-- Name: FUNCTION configure_chat_mentor(p_student_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.configure_chat_mentor(p_student_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.configure_chat_mentor(p_student_id uuid) TO service_role;


--
-- Name: FUNCTION current_chat_mentor_id(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.current_chat_mentor_id() FROM PUBLIC;
GRANT ALL ON FUNCTION public.current_chat_mentor_id() TO service_role;
GRANT ALL ON FUNCTION public.current_chat_mentor_id() TO authenticated;


--
-- Name: FUNCTION current_chat_student_id(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.current_chat_student_id() FROM PUBLIC;
GRANT ALL ON FUNCTION public.current_chat_student_id() TO service_role;
GRANT ALL ON FUNCTION public.current_chat_student_id() TO authenticated;


--
-- Name: FUNCTION current_pdf_version(p_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.current_pdf_version(p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.current_pdf_version(p_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.current_pdf_version(p_id uuid) TO service_role;


--
-- Name: FUNCTION current_student_completed_intake(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.current_student_completed_intake() FROM PUBLIC;
GRANT ALL ON FUNCTION public.current_student_completed_intake() TO authenticated;
GRANT ALL ON FUNCTION public.current_student_completed_intake() TO service_role;


--
-- Name: FUNCTION delete_academy_rubric(p_id uuid, p_version integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.delete_academy_rubric(p_id uuid, p_version integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.delete_academy_rubric(p_id uuid, p_version integer) TO authenticated;
GRANT ALL ON FUNCTION public.delete_academy_rubric(p_id uuid, p_version integer) TO service_role;


--
-- Name: FUNCTION discard_chat_attachment(p_attachment_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.discard_chat_attachment(p_attachment_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.discard_chat_attachment(p_attachment_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.discard_chat_attachment(p_attachment_id uuid) TO authenticated;


--
-- Name: FUNCTION enqueue_chat_email_notification(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.enqueue_chat_email_notification() FROM PUBLIC;
GRANT ALL ON FUNCTION public.enqueue_chat_email_notification() TO service_role;


--
-- Name: FUNCTION finish_chat_email_notification(p_id uuid, p_lease uuid, p_status text, p_reason text, p_due_at timestamp with time zone, p_provider_id text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.finish_chat_email_notification(p_id uuid, p_lease uuid, p_status text, p_reason text, p_due_at timestamp with time zone, p_provider_id text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.finish_chat_email_notification(p_id uuid, p_lease uuid, p_status text, p_reason text, p_due_at timestamp with time zone, p_provider_id text) TO service_role;


--
-- Name: FUNCTION get_chat_attachment_download(p_auth_uid uuid, p_attachment_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_chat_attachment_download(p_auth_uid uuid, p_attachment_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_chat_attachment_download(p_auth_uid uuid, p_attachment_id uuid) TO service_role;


--
-- Name: FUNCTION get_chat_mentors(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_chat_mentors() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_chat_mentors() TO service_role;
GRANT ALL ON FUNCTION public.get_chat_mentors() TO authenticated;


--
-- Name: FUNCTION get_chat_message_attachments(p_message_ids uuid[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_chat_message_attachments(p_message_ids uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_chat_message_attachments(p_message_ids uuid[]) TO service_role;
GRANT ALL ON FUNCTION public.get_chat_message_attachments(p_message_ids uuid[]) TO authenticated;


--
-- Name: FUNCTION get_chat_profiles(p_student_ids uuid[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_chat_profiles(p_student_ids uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_chat_profiles(p_student_ids uuid[]) TO service_role;
GRANT ALL ON FUNCTION public.get_chat_profiles(p_student_ids uuid[]) TO authenticated;


--
-- Name: FUNCTION get_chat_read_state(p_thread_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_chat_read_state(p_thread_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_chat_read_state(p_thread_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.get_chat_read_state(p_thread_id uuid) TO authenticated;


--
-- Name: FUNCTION get_mentor_inbox(p_status text, p_query text, p_limit integer, p_cursor text, p_selected_thread_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_mentor_inbox(p_status text, p_query text, p_limit integer, p_cursor text, p_selected_thread_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_mentor_inbox(p_status text, p_query text, p_limit integer, p_cursor text, p_selected_thread_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.get_mentor_inbox(p_status text, p_query text, p_limit integer, p_cursor text, p_selected_thread_id uuid) TO authenticated;


--
-- Name: FUNCTION get_my_chat_access(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_my_chat_access() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_my_chat_access() TO service_role;
GRANT ALL ON FUNCTION public.get_my_chat_access() TO authenticated;


--
-- Name: FUNCTION get_my_chat_email_preferences(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_my_chat_email_preferences() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_my_chat_email_preferences() TO service_role;
GRANT ALL ON FUNCTION public.get_my_chat_email_preferences() TO authenticated;


--
-- Name: FUNCTION get_my_dashboard_read_model(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_my_dashboard_read_model() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_my_dashboard_read_model() TO authenticated;
GRANT ALL ON FUNCTION public.get_my_dashboard_read_model() TO service_role;


--
-- Name: FUNCTION get_my_notification_shell(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_my_notification_shell() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_my_notification_shell() TO service_role;
GRANT ALL ON FUNCTION public.get_my_notification_shell() TO authenticated;


--
-- Name: FUNCTION guard_chat_notification_recipient_identity(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.guard_chat_notification_recipient_identity() FROM PUBLIC;
GRANT ALL ON FUNCTION public.guard_chat_notification_recipient_identity() TO service_role;


--
-- Name: FUNCTION guard_legacy_chat_message_write(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.guard_legacy_chat_message_write() FROM PUBLIC;
GRANT ALL ON FUNCTION public.guard_legacy_chat_message_write() TO service_role;


--
-- Name: FUNCTION guard_legacy_chat_thread_write(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.guard_legacy_chat_thread_write() FROM PUBLIC;
GRANT ALL ON FUNCTION public.guard_legacy_chat_thread_write() TO service_role;


--
-- Name: FUNCTION guard_market_update_pin_position(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.guard_market_update_pin_position() TO anon;
GRANT ALL ON FUNCTION public.guard_market_update_pin_position() TO authenticated;
GRANT ALL ON FUNCTION public.guard_market_update_pin_position() TO service_role;


--
-- Name: FUNCTION guard_reaction_account(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.guard_reaction_account() FROM PUBLIC;
GRANT ALL ON FUNCTION public.guard_reaction_account() TO service_role;


--
-- Name: FUNCTION guard_student_identity(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.guard_student_identity() FROM PUBLIC;
GRANT ALL ON FUNCTION public.guard_student_identity() TO service_role;


--
-- Name: FUNCTION handle_conversation_message_insert(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.handle_conversation_message_insert() FROM PUBLIC;
GRANT ALL ON FUNCTION public.handle_conversation_message_insert() TO service_role;


--
-- Name: FUNCTION handle_new_auth_user(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.handle_new_auth_user() TO anon;
GRANT ALL ON FUNCTION public.handle_new_auth_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_auth_user() TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.handle_new_user() TO anon;
GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: FUNCTION has_active_entitlement(p_entitlement_key text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.has_active_entitlement(p_entitlement_key text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.has_active_entitlement(p_entitlement_key text) TO anon;
GRANT ALL ON FUNCTION public.has_active_entitlement(p_entitlement_key text) TO authenticated;
GRANT ALL ON FUNCTION public.has_active_entitlement(p_entitlement_key text) TO service_role;


--
-- Name: FUNCTION has_live_learning_account(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.has_live_learning_account() FROM PUBLIC;
GRANT ALL ON FUNCTION public.has_live_learning_account() TO authenticated;
GRANT ALL ON FUNCTION public.has_live_learning_account() TO service_role;


--
-- Name: TABLE video_positions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.video_positions TO service_role;
GRANT SELECT ON TABLE public.video_positions TO authenticated;


--
-- Name: FUNCTION htp_position_json(p_row public.video_positions, p_student uuid, p_version text, p_duration double precision); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.htp_position_json(p_row public.video_positions, p_student uuid, p_version text, p_duration double precision) FROM PUBLIC;
GRANT ALL ON FUNCTION public.htp_position_json(p_row public.video_positions, p_student uuid, p_version text, p_duration double precision) TO service_role;


--
-- Name: FUNCTION htp_video_access(p_kind text, p_content_id bigint); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.htp_video_access(p_kind text, p_content_id bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public.htp_video_access(p_kind text, p_content_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.htp_video_access(p_kind text, p_content_id bigint) TO service_role;


--
-- Name: FUNCTION htp_video_version(p_kind text, p_content_id bigint); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.htp_video_version(p_kind text, p_content_id bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public.htp_video_version(p_kind text, p_content_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.htp_video_version(p_kind text, p_content_id bigint) TO service_role;


--
-- Name: FUNCTION is_available_chat_mentor(p_student_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_available_chat_mentor(p_student_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_available_chat_mentor(p_student_id uuid) TO service_role;


--
-- Name: FUNCTION is_chat_notification_event(p_event_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_chat_notification_event(p_event_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_chat_notification_event(p_event_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.is_chat_notification_event(p_event_id uuid) TO authenticated;


--
-- Name: FUNCTION is_pdf_admin(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_pdf_admin() FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_pdf_admin() TO authenticated;
GRANT ALL ON FUNCTION public.is_pdf_admin() TO service_role;


--
-- Name: FUNCTION is_platform_admin(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_platform_admin() TO anon;
GRANT ALL ON FUNCTION public.is_platform_admin() TO authenticated;
GRANT ALL ON FUNCTION public.is_platform_admin() TO service_role;


--
-- Name: FUNCTION legacy_can_access_chat_notification_recipient(p_event_id uuid, p_student_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.legacy_can_access_chat_notification_recipient(p_event_id uuid, p_student_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.legacy_can_access_chat_notification_recipient(p_event_id uuid, p_student_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.legacy_can_access_chat_notification_recipient(p_event_id uuid, p_student_id uuid) TO authenticated;


--
-- Name: FUNCTION legacy_chat_current_student_id(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.legacy_chat_current_student_id() FROM PUBLIC;
GRANT ALL ON FUNCTION public.legacy_chat_current_student_id() TO service_role;
GRANT ALL ON FUNCTION public.legacy_chat_current_student_id() TO authenticated;


--
-- Name: FUNCTION legacy_chat_mentor_id(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.legacy_chat_mentor_id() FROM PUBLIC;
GRANT ALL ON FUNCTION public.legacy_chat_mentor_id() TO service_role;
GRANT ALL ON FUNCTION public.legacy_chat_mentor_id() TO authenticated;


--
-- Name: FUNCTION legacy_chat_notification_thread_id(p_event_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.legacy_chat_notification_thread_id(p_event_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.legacy_chat_notification_thread_id(p_event_id uuid) TO service_role;


--
-- Name: FUNCTION legacy_chat_thread_role(p_thread_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.legacy_chat_thread_role(p_thread_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.legacy_chat_thread_role(p_thread_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.legacy_chat_thread_role(p_thread_id uuid) TO authenticated;


--
-- Name: FUNCTION legacy_is_chat_notification(p_event_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.legacy_is_chat_notification(p_event_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.legacy_is_chat_notification(p_event_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.legacy_is_chat_notification(p_event_id uuid) TO authenticated;


--
-- Name: FUNCTION list_chat_presence(p_student_ids uuid[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.list_chat_presence(p_student_ids uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.list_chat_presence(p_student_ids uuid[]) TO service_role;
GRANT ALL ON FUNCTION public.list_chat_presence(p_student_ids uuid[]) TO authenticated;


--
-- Name: FUNCTION list_visible_pdf_documents(p_kind text, p_parent_ids bigint[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.list_visible_pdf_documents(p_kind text, p_parent_ids bigint[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.list_visible_pdf_documents(p_kind text, p_parent_ids bigint[]) TO authenticated;
GRANT ALL ON FUNCTION public.list_visible_pdf_documents(p_kind text, p_parent_ids bigint[]) TO service_role;


--
-- Name: FUNCTION mark_chat_read(p_thread_id uuid, p_seen_seq bigint); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.mark_chat_read(p_thread_id uuid, p_seen_seq bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public.mark_chat_read(p_thread_id uuid, p_seen_seq bigint) TO service_role;
GRANT ALL ON FUNCTION public.mark_chat_read(p_thread_id uuid, p_seen_seq bigint) TO authenticated;


--
-- Name: FUNCTION mark_deleted_student_avatar(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.mark_deleted_student_avatar() FROM PUBLIC;
GRANT ALL ON FUNCTION public.mark_deleted_student_avatar() TO service_role;


--
-- Name: FUNCTION mark_mentor_conversation_read(p_thread_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.mark_mentor_conversation_read(p_thread_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.mark_mentor_conversation_read(p_thread_id uuid) TO service_role;


--
-- Name: FUNCTION mark_student_conversation_read(p_thread_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.mark_student_conversation_read(p_thread_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.mark_student_conversation_read(p_thread_id uuid) TO service_role;


--
-- Name: FUNCTION market_post_author(p_post_id bigint); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.market_post_author(p_post_id bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public.market_post_author(p_post_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.market_post_author(p_post_id bigint) TO service_role;


--
-- Name: FUNCTION market_post_reaction_state(p_post_id bigint); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.market_post_reaction_state(p_post_id bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public.market_post_reaction_state(p_post_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.market_post_reaction_state(p_post_id bigint) TO service_role;


--
-- Name: FUNCTION mentor_chat_thread_projection(p_thread_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.mentor_chat_thread_projection(p_thread_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.mentor_chat_thread_projection(p_thread_id uuid) TO service_role;


--
-- Name: FUNCTION normalize_lessons_admin(target_module_id bigint); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.normalize_lessons_admin(target_module_id bigint) TO anon;
GRANT ALL ON FUNCTION public.normalize_lessons_admin(target_module_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.normalize_lessons_admin(target_module_id bigint) TO service_role;


--
-- Name: FUNCTION normalize_modules_admin(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.normalize_modules_admin() TO anon;
GRANT ALL ON FUNCTION public.normalize_modules_admin() TO authenticated;
GRANT ALL ON FUNCTION public.normalize_modules_admin() TO service_role;


--
-- Name: FUNCTION notify_clickup_on_lead(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.notify_clickup_on_lead() TO anon;
GRANT ALL ON FUNCTION public.notify_clickup_on_lead() TO authenticated;
GRANT ALL ON FUNCTION public.notify_clickup_on_lead() TO service_role;


--
-- Name: FUNCTION notify_student_intake_completed(p_student_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.notify_student_intake_completed(p_student_id uuid) TO anon;
GRANT ALL ON FUNCTION public.notify_student_intake_completed(p_student_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.notify_student_intake_completed(p_student_id uuid) TO service_role;


--
-- Name: FUNCTION open_chat_thread(p_mentor_student_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.open_chat_thread(p_mentor_student_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.open_chat_thread(p_mentor_student_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.open_chat_thread(p_mentor_student_id uuid) TO authenticated;


--
-- Name: FUNCTION prepare_chat_email_send(p_id uuid, p_lease uuid, p_payload jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.prepare_chat_email_send(p_id uuid, p_lease uuid, p_payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.prepare_chat_email_send(p_id uuid, p_lease uuid, p_payload jsonb) TO service_role;


--
-- Name: FUNCTION prepare_private_chat_message(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.prepare_private_chat_message() FROM PUBLIC;
GRANT ALL ON FUNCTION public.prepare_private_chat_message() TO service_role;


--
-- Name: FUNCTION process_mux_caption_event(p_event_id text, p_event_type text, p_asset_id text, p_track_id text, p_language_code text, p_error_code text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.process_mux_caption_event(p_event_id text, p_event_type text, p_asset_id text, p_track_id text, p_language_code text, p_error_code text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.process_mux_caption_event(p_event_id text, p_event_type text, p_asset_id text, p_track_id text, p_language_code text, p_error_code text) TO service_role;


--
-- Name: FUNCTION protect_exam_result_entitlement(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.protect_exam_result_entitlement() FROM PUBLIC;
GRANT ALL ON FUNCTION public.protect_exam_result_entitlement() TO service_role;


--
-- Name: FUNCTION protect_student_privileged_fields(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.protect_student_privileged_fields() FROM PUBLIC;
GRANT ALL ON FUNCTION public.protect_student_privileged_fields() TO service_role;


--
-- Name: FUNCTION purge_pdf_open_logs(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.purge_pdf_open_logs() FROM PUBLIC;
GRANT ALL ON FUNCTION public.purge_pdf_open_logs() TO service_role;


--
-- Name: FUNCTION read_pdf_position(p_document_id uuid, p_version uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.read_pdf_position(p_document_id uuid, p_version uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.read_pdf_position(p_document_id uuid, p_version uuid) TO authenticated;
GRANT ALL ON FUNCTION public.read_pdf_position(p_document_id uuid, p_version uuid) TO service_role;


--
-- Name: FUNCTION read_video_position(p_kind text, p_content_id bigint); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.read_video_position(p_kind text, p_content_id bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public.read_video_position(p_kind text, p_content_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.read_video_position(p_kind text, p_content_id bigint) TO service_role;


--
-- Name: FUNCTION record_pdf_open(p_document_id uuid, p_version uuid, p_request_id uuid, p_student_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.record_pdf_open(p_document_id uuid, p_version uuid, p_request_id uuid, p_student_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.record_pdf_open(p_document_id uuid, p_version uuid, p_request_id uuid, p_student_id uuid) TO service_role;


--
-- Name: FUNCTION register_chat_attachment(p_auth_uid uuid, p_upload_intent uuid, p_thread_id uuid, p_object_path text, p_content_sha256 text, p_file_name text, p_width integer, p_height integer, p_size_bytes integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.register_chat_attachment(p_auth_uid uuid, p_upload_intent uuid, p_thread_id uuid, p_object_path text, p_content_sha256 text, p_file_name text, p_width integer, p_height integer, p_size_bytes integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.register_chat_attachment(p_auth_uid uuid, p_upload_intent uuid, p_thread_id uuid, p_object_path text, p_content_sha256 text, p_file_name text, p_width integer, p_height integer, p_size_bytes integer) TO service_role;


--
-- Name: FUNCTION reject_admin_audit_log_mutation(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.reject_admin_audit_log_mutation() TO anon;
GRANT ALL ON FUNCTION public.reject_admin_audit_log_mutation() TO authenticated;
GRANT ALL ON FUNCTION public.reject_admin_audit_log_mutation() TO service_role;


--
-- Name: FUNCTION reorder_lessons_admin(target_module_id bigint, lesson_ids bigint[]); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.reorder_lessons_admin(target_module_id bigint, lesson_ids bigint[]) TO anon;
GRANT ALL ON FUNCTION public.reorder_lessons_admin(target_module_id bigint, lesson_ids bigint[]) TO authenticated;
GRANT ALL ON FUNCTION public.reorder_lessons_admin(target_module_id bigint, lesson_ids bigint[]) TO service_role;


--
-- Name: FUNCTION reorder_modules_admin(module_ids bigint[]); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.reorder_modules_admin(module_ids bigint[]) TO anon;
GRANT ALL ON FUNCTION public.reorder_modules_admin(module_ids bigint[]) TO authenticated;
GRANT ALL ON FUNCTION public.reorder_modules_admin(module_ids bigint[]) TO service_role;


--
-- Name: FUNCTION save_academy_rubric(p_id uuid, p_version integer, p_title text, p_slug text, p_description text, p_sort_order integer, p_published boolean, p_modules bigint[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.save_academy_rubric(p_id uuid, p_version integer, p_title text, p_slug text, p_description text, p_sort_order integer, p_published boolean, p_modules bigint[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.save_academy_rubric(p_id uuid, p_version integer, p_title text, p_slug text, p_description text, p_sort_order integer, p_published boolean, p_modules bigint[]) TO authenticated;
GRANT ALL ON FUNCTION public.save_academy_rubric(p_id uuid, p_version integer, p_title text, p_slug text, p_description text, p_sort_order integer, p_published boolean, p_modules bigint[]) TO service_role;


--
-- Name: FUNCTION save_pdf_position(p_document_id uuid, p_version uuid, p_viewer_id uuid, p_page integer, p_revision bigint, p_session_id uuid, p_sequence integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.save_pdf_position(p_document_id uuid, p_version uuid, p_viewer_id uuid, p_page integer, p_revision bigint, p_session_id uuid, p_sequence integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.save_pdf_position(p_document_id uuid, p_version uuid, p_viewer_id uuid, p_page integer, p_revision bigint, p_session_id uuid, p_sequence integer) TO authenticated;
GRANT ALL ON FUNCTION public.save_pdf_position(p_document_id uuid, p_version uuid, p_viewer_id uuid, p_page integer, p_revision bigint, p_session_id uuid, p_sequence integer) TO service_role;


--
-- Name: FUNCTION save_video_position(p_kind text, p_content_id bigint, p_viewer_id uuid, p_video_version text, p_position_seconds double precision, p_duration_seconds double precision, p_expected_revision bigint, p_session_id uuid, p_client_sequence bigint); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.save_video_position(p_kind text, p_content_id bigint, p_viewer_id uuid, p_video_version text, p_position_seconds double precision, p_duration_seconds double precision, p_expected_revision bigint, p_session_id uuid, p_client_sequence bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public.save_video_position(p_kind text, p_content_id bigint, p_viewer_id uuid, p_video_version text, p_position_seconds double precision, p_duration_seconds double precision, p_expected_revision bigint, p_session_id uuid, p_client_sequence bigint) TO authenticated;
GRANT ALL ON FUNCTION public.save_video_position(p_kind text, p_content_id bigint, p_viewer_id uuid, p_video_version text, p_position_seconds double precision, p_duration_seconds double precision, p_expected_revision bigint, p_session_id uuid, p_client_sequence bigint) TO service_role;


--
-- Name: FUNCTION send_chat_message(p_body text, p_client_message_id uuid, p_thread_id uuid, p_is_internal boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.send_chat_message(p_body text, p_client_message_id uuid, p_thread_id uuid, p_is_internal boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.send_chat_message(p_body text, p_client_message_id uuid, p_thread_id uuid, p_is_internal boolean) TO service_role;
GRANT ALL ON FUNCTION public.send_chat_message(p_body text, p_client_message_id uuid, p_thread_id uuid, p_is_internal boolean) TO authenticated;


--
-- Name: FUNCTION send_chat_message_with_attachments(p_body text, p_client_message_id uuid, p_thread_id uuid, p_is_internal boolean, p_attachment_ids uuid[], p_upload_intent uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.send_chat_message_with_attachments(p_body text, p_client_message_id uuid, p_thread_id uuid, p_is_internal boolean, p_attachment_ids uuid[], p_upload_intent uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.send_chat_message_with_attachments(p_body text, p_client_message_id uuid, p_thread_id uuid, p_is_internal boolean, p_attachment_ids uuid[], p_upload_intent uuid) TO service_role;
GRANT ALL ON FUNCTION public.send_chat_message_with_attachments(p_body text, p_client_message_id uuid, p_thread_id uuid, p_is_internal boolean, p_attachment_ids uuid[], p_upload_intent uuid) TO authenticated;


--
-- Name: FUNCTION serialize_exam_attempt(p_attempt_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.serialize_exam_attempt(p_attempt_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.serialize_exam_attempt(p_attempt_id uuid) TO service_role;


--
-- Name: FUNCTION set_market_post_reaction(p_post_id bigint, p_active boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_market_post_reaction(p_post_id bigint, p_active boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_market_post_reaction(p_post_id bigint, p_active boolean) TO authenticated;
GRANT ALL ON FUNCTION public.set_market_post_reaction(p_post_id bigint, p_active boolean) TO service_role;


--
-- Name: FUNCTION set_my_chat_email_preference(p_enabled boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_my_chat_email_preference(p_enabled boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_my_chat_email_preference(p_enabled boolean) TO service_role;
GRANT ALL ON FUNCTION public.set_my_chat_email_preference(p_enabled boolean) TO authenticated;


--
-- Name: FUNCTION set_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_updated_at() TO service_role;


--
-- Name: FUNCTION start_module_exam(p_module_id bigint); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.start_module_exam(p_module_id bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public.start_module_exam(p_module_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.start_module_exam(p_module_id bigint) TO service_role;


--
-- Name: FUNCTION start_module_exam_unchecked(p_module_id bigint); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.start_module_exam_unchecked(p_module_id bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public.start_module_exam_unchecked(p_module_id bigint) TO service_role;


--
-- Name: FUNCTION submit_module_exam(p_attempt_id uuid, p_answers jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.submit_module_exam(p_attempt_id uuid, p_answers jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.submit_module_exam(p_attempt_id uuid, p_answers jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.submit_module_exam(p_attempt_id uuid, p_answers jsonb) TO service_role;


--
-- Name: FUNCTION submit_module_exam_unchecked(p_attempt_id uuid, p_answers jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.submit_module_exam_unchecked(p_attempt_id uuid, p_answers jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.submit_module_exam_unchecked(p_attempt_id uuid, p_answers jsonb) TO service_role;


--
-- Name: FUNCTION update_chat_thread(p_thread_id uuid, p_status text, p_priority text, p_category text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.update_chat_thread(p_thread_id uuid, p_status text, p_priority text, p_category text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_chat_thread(p_thread_id uuid, p_status text, p_priority text, p_category text) TO service_role;
GRANT ALL ON FUNCTION public.update_chat_thread(p_thread_id uuid, p_status text, p_priority text, p_category text) TO authenticated;


--
-- Name: FUNCTION valid_market_chapters(chapters jsonb, duration numeric, markets text[]); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.valid_market_chapters(chapters jsonb, duration numeric, markets text[]) TO anon;
GRANT ALL ON FUNCTION public.valid_market_chapters(chapters jsonb, duration numeric, markets text[]) TO authenticated;
GRANT ALL ON FUNCTION public.valid_market_chapters(chapters jsonb, duration numeric, markets text[]) TO service_role;


--
-- Name: TABLE academy_rubric_modules; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.academy_rubric_modules TO service_role;
GRANT SELECT ON TABLE public.academy_rubric_modules TO authenticated;


--
-- Name: TABLE academy_rubrics; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.academy_rubrics TO service_role;
GRANT SELECT ON TABLE public.academy_rubrics TO authenticated;


--
-- Name: TABLE admin_audit_log; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.admin_audit_log TO service_role;


--
-- Name: TABLE ai_interactions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ai_interactions TO anon;
GRANT ALL ON TABLE public.ai_interactions TO authenticated;
GRANT ALL ON TABLE public.ai_interactions TO service_role;


--
-- Name: TABLE ai_student_summaries; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ai_student_summaries TO anon;
GRANT ALL ON TABLE public.ai_student_summaries TO authenticated;
GRANT ALL ON TABLE public.ai_student_summaries TO service_role;


--
-- Name: TABLE ai_video_enrichments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ai_video_enrichments TO anon;
GRANT ALL ON TABLE public.ai_video_enrichments TO authenticated;
GRANT ALL ON TABLE public.ai_video_enrichments TO service_role;


--
-- Name: TABLE ai_video_transcripts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ai_video_transcripts TO anon;
GRANT ALL ON TABLE public.ai_video_transcripts TO authenticated;
GRANT ALL ON TABLE public.ai_video_transcripts TO service_role;


--
-- Name: TABLE ai_video_workflows; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ai_video_workflows TO anon;
GRANT ALL ON TABLE public.ai_video_workflows TO authenticated;
GRANT ALL ON TABLE public.ai_video_workflows TO service_role;


--
-- Name: TABLE avatar_objects; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.avatar_objects TO service_role;


--
-- Name: TABLE billing_customers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.billing_customers TO anon;
GRANT ALL ON TABLE public.billing_customers TO authenticated;
GRANT ALL ON TABLE public.billing_customers TO service_role;


--
-- Name: TABLE chat_email_preferences; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.chat_email_preferences TO service_role;
GRANT SELECT ON TABLE public.chat_email_preferences TO authenticated;


--
-- Name: TABLE chat_mentor_config; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.chat_mentor_config TO service_role;


--
-- Name: TABLE chat_presence_sessions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.chat_presence_sessions TO service_role;


--
-- Name: TABLE chat_principals; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.chat_principals TO service_role;
GRANT SELECT ON TABLE public.chat_principals TO authenticated;


--
-- Name: TABLE conversation_attachments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.conversation_attachments TO service_role;


--
-- Name: COLUMN conversation_attachments.id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(id) ON TABLE public.conversation_attachments TO authenticated;


--
-- Name: COLUMN conversation_attachments.message_id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(message_id) ON TABLE public.conversation_attachments TO authenticated;


--
-- Name: COLUMN conversation_attachments.file_name; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(file_name) ON TABLE public.conversation_attachments TO authenticated;


--
-- Name: COLUMN conversation_attachments.media_type; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(media_type) ON TABLE public.conversation_attachments TO authenticated;


--
-- Name: COLUMN conversation_attachments.size_bytes; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(size_bytes) ON TABLE public.conversation_attachments TO authenticated;


--
-- Name: COLUMN conversation_attachments.width; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(width) ON TABLE public.conversation_attachments TO authenticated;


--
-- Name: COLUMN conversation_attachments.height; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(height) ON TABLE public.conversation_attachments TO authenticated;


--
-- Name: COLUMN conversation_attachments.created_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(created_at) ON TABLE public.conversation_attachments TO authenticated;


--
-- Name: TABLE conversation_events; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,MAINTAIN ON TABLE public.conversation_events TO anon;
GRANT SELECT,MAINTAIN ON TABLE public.conversation_events TO authenticated;
GRANT ALL ON TABLE public.conversation_events TO service_role;


--
-- Name: TABLE conversation_message_reactions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,MAINTAIN ON TABLE public.conversation_message_reactions TO anon;
GRANT SELECT,MAINTAIN ON TABLE public.conversation_message_reactions TO authenticated;
GRANT ALL ON TABLE public.conversation_message_reactions TO service_role;


--
-- Name: TABLE conversation_messages; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,MAINTAIN ON TABLE public.conversation_messages TO anon;
GRANT SELECT,MAINTAIN ON TABLE public.conversation_messages TO authenticated;
GRANT ALL ON TABLE public.conversation_messages TO service_role;


--
-- Name: TABLE conversation_participants; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.conversation_participants TO service_role;
GRANT SELECT ON TABLE public.conversation_participants TO authenticated;


--
-- Name: TABLE conversation_threads; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,MAINTAIN ON TABLE public.conversation_threads TO anon;
GRANT SELECT,MAINTAIN ON TABLE public.conversation_threads TO authenticated;
GRANT ALL ON TABLE public.conversation_threads TO service_role;


--
-- Name: TABLE exam_answer_options; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.exam_answer_options TO anon;
GRANT ALL ON TABLE public.exam_answer_options TO authenticated;
GRANT ALL ON TABLE public.exam_answer_options TO service_role;


--
-- Name: SEQUENCE exam_answer_options_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.exam_answer_options_id_seq TO anon;
GRANT ALL ON SEQUENCE public.exam_answer_options_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.exam_answer_options_id_seq TO service_role;


--
-- Name: TABLE exam_attempt_answers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.exam_attempt_answers TO anon;
GRANT ALL ON TABLE public.exam_attempt_answers TO authenticated;
GRANT ALL ON TABLE public.exam_attempt_answers TO service_role;


--
-- Name: TABLE exam_attempt_questions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.exam_attempt_questions TO anon;
GRANT ALL ON TABLE public.exam_attempt_questions TO authenticated;
GRANT ALL ON TABLE public.exam_attempt_questions TO service_role;


--
-- Name: TABLE exam_attempts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.exam_attempts TO anon;
GRANT ALL ON TABLE public.exam_attempts TO authenticated;
GRANT ALL ON TABLE public.exam_attempts TO service_role;


--
-- Name: TABLE exam_questions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.exam_questions TO anon;
GRANT ALL ON TABLE public.exam_questions TO authenticated;
GRANT ALL ON TABLE public.exam_questions TO service_role;


--
-- Name: SEQUENCE exam_questions_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.exam_questions_id_seq TO anon;
GRANT ALL ON SEQUENCE public.exam_questions_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.exam_questions_id_seq TO service_role;


--
-- Name: TABLE exam_results; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.exam_results TO anon;
GRANT ALL ON TABLE public.exam_results TO authenticated;
GRANT ALL ON TABLE public.exam_results TO service_role;


--
-- Name: TABLE exams; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.exams TO anon;
GRANT ALL ON TABLE public.exams TO authenticated;
GRANT ALL ON TABLE public.exams TO service_role;


--
-- Name: SEQUENCE exams_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.exams_id_seq TO anon;
GRANT ALL ON SEQUENCE public.exams_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.exams_id_seq TO service_role;


--
-- Name: TABLE legacy_academy_module_access; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.legacy_academy_module_access TO service_role;
GRANT SELECT ON TABLE public.legacy_academy_module_access TO authenticated;


--
-- Name: TABLE lesson_action_progress; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.lesson_action_progress TO anon;
GRANT ALL ON TABLE public.lesson_action_progress TO authenticated;
GRANT ALL ON TABLE public.lesson_action_progress TO service_role;


--
-- Name: TABLE lessons; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.lessons TO anon;
GRANT ALL ON TABLE public.lessons TO authenticated;
GRANT ALL ON TABLE public.lessons TO service_role;


--
-- Name: SEQUENCE lessons_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.lessons_id_seq TO anon;
GRANT ALL ON SEQUENCE public.lessons_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.lessons_id_seq TO service_role;


--
-- Name: TABLE live_session_provider_secrets; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.live_session_provider_secrets TO anon;
GRANT ALL ON TABLE public.live_session_provider_secrets TO authenticated;
GRANT ALL ON TABLE public.live_session_provider_secrets TO service_role;


--
-- Name: TABLE live_sessions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.live_sessions TO anon;
GRANT ALL ON TABLE public.live_sessions TO authenticated;
GRANT ALL ON TABLE public.live_sessions TO service_role;


--
-- Name: TABLE weekly_updates; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.weekly_updates TO anon;
GRANT ALL ON TABLE public.weekly_updates TO authenticated;
GRANT ALL ON TABLE public.weekly_updates TO service_role;


--
-- Name: TABLE market_insight_content; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.market_insight_content TO anon;
GRANT ALL ON TABLE public.market_insight_content TO authenticated;
GRANT ALL ON TABLE public.market_insight_content TO service_role;


--
-- Name: TABLE market_post_reactions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.market_post_reactions TO service_role;
GRANT SELECT,INSERT,DELETE ON TABLE public.market_post_reactions TO authenticated;


--
-- Name: TABLE modules; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.modules TO anon;
GRANT ALL ON TABLE public.modules TO authenticated;
GRANT ALL ON TABLE public.modules TO service_role;


--
-- Name: SEQUENCE modules_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.modules_id_seq TO anon;
GRANT ALL ON SEQUENCE public.modules_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.modules_id_seq TO service_role;


--
-- Name: TABLE mux_webhook_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.mux_webhook_events TO anon;
GRANT ALL ON TABLE public.mux_webhook_events TO authenticated;
GRANT ALL ON TABLE public.mux_webhook_events TO service_role;


--
-- Name: TABLE notification_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.notification_events TO anon;
GRANT ALL ON TABLE public.notification_events TO authenticated;
GRANT ALL ON TABLE public.notification_events TO service_role;


--
-- Name: TABLE notification_preferences; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.notification_preferences TO anon;
GRANT ALL ON TABLE public.notification_preferences TO authenticated;
GRANT ALL ON TABLE public.notification_preferences TO service_role;


--
-- Name: TABLE notification_recipients; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.notification_recipients TO anon;
GRANT ALL ON TABLE public.notification_recipients TO authenticated;
GRANT ALL ON TABLE public.notification_recipients TO service_role;


--
-- Name: TABLE one_time_purchases; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.one_time_purchases TO anon;
GRANT ALL ON TABLE public.one_time_purchases TO authenticated;
GRANT ALL ON TABLE public.one_time_purchases TO service_role;


--
-- Name: TABLE payments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.payments TO anon;
GRANT ALL ON TABLE public.payments TO authenticated;
GRANT ALL ON TABLE public.payments TO service_role;


--
-- Name: TABLE pdf_documents; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.pdf_documents TO service_role;


--
-- Name: TABLE pdf_open_logs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.pdf_open_logs TO service_role;
GRANT SELECT ON TABLE public.pdf_open_logs TO authenticated;


--
-- Name: SEQUENCE pdf_open_logs_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.pdf_open_logs_id_seq TO anon;
GRANT ALL ON SEQUENCE public.pdf_open_logs_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.pdf_open_logs_id_seq TO service_role;


--
-- Name: TABLE pdf_positions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.pdf_positions TO service_role;
GRANT SELECT ON TABLE public.pdf_positions TO authenticated;


--
-- Name: TABLE practical_lessons; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.practical_lessons TO anon;
GRANT ALL ON TABLE public.practical_lessons TO authenticated;
GRANT ALL ON TABLE public.practical_lessons TO service_role;


--
-- Name: SEQUENCE practical_lessons_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.practical_lessons_id_seq TO anon;
GRANT ALL ON SEQUENCE public.practical_lessons_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.practical_lessons_id_seq TO service_role;


--
-- Name: TABLE product_board_cycles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.product_board_cycles TO authenticated;
GRANT ALL ON TABLE public.product_board_cycles TO service_role;


--
-- Name: TABLE product_board_tasks; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.product_board_tasks TO authenticated;
GRANT ALL ON TABLE public.product_board_tasks TO service_role;


--
-- Name: TABLE progress; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.progress TO anon;
GRANT ALL ON TABLE public.progress TO authenticated;
GRANT ALL ON TABLE public.progress TO service_role;


--
-- Name: TABLE stripe_webhook_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.stripe_webhook_events TO anon;
GRANT ALL ON TABLE public.stripe_webhook_events TO authenticated;
GRANT ALL ON TABLE public.stripe_webhook_events TO service_role;


--
-- Name: TABLE student_avatars; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.student_avatars TO service_role;
GRANT SELECT ON TABLE public.student_avatars TO authenticated;


--
-- Name: TABLE student_entitlements; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.student_entitlements TO anon;
GRANT ALL ON TABLE public.student_entitlements TO authenticated;
GRANT ALL ON TABLE public.student_entitlements TO service_role;


--
-- Name: TABLE student_mentor_notes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.student_mentor_notes TO anon;
GRANT ALL ON TABLE public.student_mentor_notes TO authenticated;
GRANT ALL ON TABLE public.student_mentor_notes TO service_role;


--
-- Name: TABLE student_onboarding_responses; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.student_onboarding_responses TO anon;
GRANT ALL ON TABLE public.student_onboarding_responses TO authenticated;
GRANT ALL ON TABLE public.student_onboarding_responses TO service_role;


--
-- Name: TABLE students; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.students TO anon;
GRANT ALL ON TABLE public.students TO authenticated;
GRANT ALL ON TABLE public.students TO service_role;


--
-- Name: TABLE subscriptions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.subscriptions TO anon;
GRANT ALL ON TABLE public.subscriptions TO authenticated;
GRANT ALL ON TABLE public.subscriptions TO service_role;


--
-- Name: TABLE update_reads; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.update_reads TO anon;
GRANT ALL ON TABLE public.update_reads TO authenticated;
GRANT ALL ON TABLE public.update_reads TO service_role;


--
-- Name: TABLE updates; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.updates TO anon;
GRANT ALL ON TABLE public.updates TO authenticated;
GRANT ALL ON TABLE public.updates TO service_role;


--
-- Name: TABLE user_roles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_roles TO anon;
GRANT ALL ON TABLE public.user_roles TO authenticated;
GRANT ALL ON TABLE public.user_roles TO service_role;


--
-- Name: SEQUENCE video_positions_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.video_positions_id_seq TO anon;
GRANT ALL ON SEQUENCE public.video_positions_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.video_positions_id_seq TO service_role;


--
-- Name: TABLE weekly_update_views; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.weekly_update_views TO anon;
GRANT ALL ON TABLE public.weekly_update_views TO authenticated;
GRANT ALL ON TABLE public.weekly_update_views TO service_role;


--
-- Name: SEQUENCE weekly_updates_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.weekly_updates_id_seq TO anon;
GRANT ALL ON SEQUENCE public.weekly_updates_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.weekly_updates_id_seq TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- PostgreSQL database dump complete
--
