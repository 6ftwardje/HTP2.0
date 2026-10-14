-- Additive two-minute chat email outbox. Existing history is never replayed.
-- Sending remains disabled unless the separately deployed worker is enabled.
begin;

create table public.chat_email_preferences (
  student_id uuid primary key references public.students(id) on delete cascade,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
create table public.chat_email_outbox (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.conversation_threads(id) on delete cascade,
  recipient_participant_id uuid not null references public.conversation_participants(id) on delete cascade,
  recipient_student_id uuid not null references public.students(id) on delete cascade,
  recipient_role text not null check (recipient_role in ('student','mentor')),
  mentor_student_id uuid not null references public.students(id) on delete cascade,
  first_public_seq bigint not null check (first_public_seq > 0),
  last_public_seq bigint not null check (last_public_seq >= first_public_seq),
  last_message_id uuid references public.conversation_messages(id) on delete set null,
  due_at timestamptz not null,
  status text not null default 'queued' check (status in ('queued','leased','retry','sent','cancelled','failed','needs_review')),
  lease_token uuid,
  lease_until timestamptz,
  attempts integer not null default 0 check (attempts >= 0),
  first_attempt_at timestamptz,
  payload jsonb,
  provider_id text unique,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique (recipient_participant_id, last_message_id)
);
create index chat_email_outbox_due on public.chat_email_outbox(due_at,created_at)
  where status in ('queued','retry','leased');
create index chat_email_outbox_bundle on public.chat_email_outbox(thread_id,recipient_participant_id,due_at)
  where status in ('queued','retry') and first_attempt_at is null;
alter table public.chat_email_preferences enable row level security;
alter table public.chat_email_outbox enable row level security;
revoke all on public.chat_email_preferences, public.chat_email_outbox from public,anon,authenticated;
grant select on public.chat_email_preferences to authenticated;
grant all on public.chat_email_preferences, public.chat_email_outbox to service_role;
create policy chat_email_preferences_own on public.chat_email_preferences for select to authenticated
  using (student_id=public.current_chat_student_id());

create function public.chat_email_is_suppressed(p_student_id uuid)
returns boolean language plpgsql stable security definer set search_path = '' as $$
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
$$;

create function public.get_my_chat_email_preferences()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_student uuid:=public.current_chat_student_id();
begin
  if v_student is null then raise exception 'authentication required' using errcode='42501'; end if;
  return jsonb_build_object('enabled',coalesce((select enabled from public.chat_email_preferences where student_id=v_student),true),
    'suppressed',public.chat_email_is_suppressed(v_student));
end;
$$;
create function public.set_my_chat_email_preference(p_enabled boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
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

create function public.enqueue_chat_email_notification()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_recipient record; v_existing uuid; v_mentor uuid;
begin
  if new.is_internal or new.deleted_at is not null or new.public_seq is null
    or new.sender_role not in ('student','mentor') then return new; end if;
  v_mentor:=public.current_chat_mentor_id();
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
create trigger enqueue_chat_email_notification after insert on public.conversation_messages
  for each row execute function public.enqueue_chat_email_notification();

create function public.chat_email_recipient_snapshot(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_job public.chat_email_outbox; v_thread public.conversation_threads; v_recipient record; v_mentor uuid;
begin
  select * into v_job from public.chat_email_outbox where id=p_id;
  if not found then return jsonb_build_object('allowed',false,'reason','job_unavailable'); end if;
  -- Starting delivery after a disabled pilot must not replay an old backlog.
  -- Already-attempted jobs retain their separate provider idempotency deadline.
  if v_job.first_attempt_at is null and v_job.created_at<now()-interval '24 hours' then
    return jsonb_build_object('allowed',false,'reason','notification_expired'); end if;
  v_mentor:=public.current_chat_mentor_id();
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

create function public.claim_chat_email_notification()
returns setof public.chat_email_outbox language plpgsql security definer set search_path = '' as $$
begin
  return query with selected as (
    select id from public.chat_email_outbox where due_at<=now() and (
      status in ('queued','retry') or (status='leased' and lease_until<now()))
    order by due_at,created_at limit 1 for update skip locked
  ) update public.chat_email_outbox o set status='leased',lease_token=gen_random_uuid(),lease_until=now()+interval '2 minutes'
    from selected s where o.id=s.id returning o.*;
end;
$$;

create function public.prepare_chat_email_send(p_id uuid,p_lease uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
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

create function public.finish_chat_email_notification(p_id uuid,p_lease uuid,p_status text,p_reason text,p_due_at timestamptz,p_provider_id text default null)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_status not in ('queued','retry','sent','cancelled','failed','needs_review') or p_reason is not null and p_reason!~'^[a-z0-9_]{1,80}$' then
    raise exception 'invalid email result' using errcode='22023'; end if;
  update public.chat_email_outbox set status=p_status,due_at=coalesce(p_due_at,now()),last_error=p_reason,
    provider_id=coalesce(provider_id,p_provider_id),sent_at=case when p_status='sent' then coalesce(sent_at,now()) else sent_at end,
    lease_token=null,lease_until=null
  where id=p_id and status='leased' and lease_token=p_lease;
  return found;
end;
$$;

revoke all on function public.chat_email_is_suppressed(uuid),public.get_my_chat_email_preferences(),public.set_my_chat_email_preference(boolean),
  public.enqueue_chat_email_notification(),public.chat_email_recipient_snapshot(uuid),public.claim_chat_email_notification(),
  public.prepare_chat_email_send(uuid,uuid,jsonb),public.finish_chat_email_notification(uuid,uuid,text,text,timestamptz,text)
  from public,anon,authenticated;
grant execute on function public.get_my_chat_email_preferences(),public.set_my_chat_email_preference(boolean) to authenticated;
grant execute on function public.chat_email_recipient_snapshot(uuid),public.claim_chat_email_notification(),
  public.prepare_chat_email_send(uuid,uuid,jsonb),public.finish_chat_email_notification(uuid,uuid,text,text,timestamptz,text) to service_role;

comment on table public.chat_email_outbox is 'Private generic chat email delivery metadata; no chat bodies, names or historical replay.';
commit;
