-- Local-only synthetic regression. Transaction rollback preserves all existing data.
\set ON_ERROR_STOP on
begin;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
select ('f2f20000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
 '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
 'f2-sql-'||i||'@example.invalid','',now(),now(),now()
from generate_series(11,13)i;
insert into public.students(id,auth_user_id,email,name,access_level) values
('f2f20000-0000-4000-8000-000000000001','f2f20000-0000-4000-8000-000000000011','f2-a@example.invalid','F2 A',1),
('f2f20000-0000-4000-8000-000000000002','f2f20000-0000-4000-8000-000000000012','f2-b@example.invalid','F2 B',1),
('f2f20000-0000-4000-8000-000000000003','f2f20000-0000-4000-8000-000000000013','f2-admin@example.invalid','F2 Admin',3);
insert into public.notification_events(id,type,title,body,href)
select md5('f2-event-'||g)::uuid,'weekly_update.published','F2 '||g,'Synthetic',null
from generate_series(1,65) g;
insert into public.notification_recipients(id,event_id,student_id,created_at,read_at,archived_at)
select md5('f2-recipient-'||g)::uuid,md5('f2-event-'||g)::uuid,'f2f20000-0000-4000-8000-000000000001',
  case when g=1 then now()-interval '29 days' when g=2 then now()-interval '30 days'
       when g=3 then now()-interval '31 days' else now()-g*interval '1 minute' end,
  case when g=4 then now()-interval '1 minute' when g=5 then now()-interval '3 minutes' else null end,
  case when g=6 then now() else null end
from generate_series(1,65) g;
insert into public.notification_recipients(id,event_id,student_id)
values('f2f20000-0000-4000-8000-000000000021',md5('f2-event-1')::uuid,'f2f20000-0000-4000-8000-000000000002');
-- Stale staff over-delivery must stay invisible to A, including fallback/RPC.
insert into public.notification_events(id,type,title) values
('f2f20000-0000-4000-8000-000000000031','student_intake.completed','Private staff only');
insert into public.notification_recipients(id,event_id,student_id) values
('f2f20000-0000-4000-8000-000000000032','f2f20000-0000-4000-8000-000000000031','f2f20000-0000-4000-8000-000000000001');

set local timezone='Australia/Sydney';
set local role authenticated;
set local request.jwt.claim.sub='f2f20000-0000-4000-8000-000000000011';
do $$
declare s jsonb:=public.get_my_notification_shell(); p jsonb:=public.get_my_notifications_page(25,0); ids integer; n integer;
begin
  if s->>'version'<>'2' or (s->>'unreadCount')::int<>61 then raise exception '30-day badge mismatch: %',s; end if;
  if jsonb_array_length(s->'notifications')<>5 or s->'notifications'->0->'event'->>'type'<>'weekly_update.published' then raise exception 'preview/type mismatch'; end if;
  if (p->>'totalCount')::int<>64 or (p->>'unreadTotal')::int<>62 then raise exception 'history totals mismatch'; end if;
  select count(distinct x->>'id') into ids
  from (select jsonb_array_elements(public.get_my_notifications_page(25,o)->'notifications') x from generate_series(0,50,25)o) q;
  if ids<>64 then raise exception 'paginated history missing/duplicate: %',ids; end if;
  -- 62 unread first, then read g=4 before g=5 despite the reversed read dates.
  p:=public.get_my_notifications_page(25,50);
  if p->'notifications'->12->>'id'<>md5('f2-recipient-4')::uuid::text
     or p->'notifications'->13->>'id'<>md5('f2-recipient-5')::uuid::text then raise exception 'read group creation ordering'; end if;
  select count(*) into n from public.notification_recipients nr join public.notification_events ne on ne.id=nr.event_id
    where nr.student_id='f2f20000-0000-4000-8000-000000000001' and nr.read_at is null and nr.archived_at is null and nr.created_at>=now()-interval '720 hours';
  if n<>(s->>'unreadCount')::int then raise exception 'independent RLS fallback mismatch'; end if;
  update public.notification_recipients set archived_at=now() where id=md5('f2-recipient-1')::uuid and student_id='f2f20000-0000-4000-8000-000000000001';
  if (public.get_my_notification_shell()->>'unreadCount')::int<>60 then raise exception 'archive badge'; end if;
  if exists(select 1 from public.notification_recipients where id='f2f20000-0000-4000-8000-000000000021') then raise exception 'other student leaked'; end if;
  update public.notification_recipients set read_at=now() where student_id='f2f20000-0000-4000-8000-000000000001' and read_at is null and archived_at is null;
  if (public.get_my_notification_shell()->>'unreadCount')::int<>0 or (public.get_my_notifications_page()->>'unreadTotal')::int<>0 then raise exception 'bulk did not cover complete own set'; end if;
end $$;
reset role;
do $$ begin
 if (select read_at from public.notification_recipients where id='f2f20000-0000-4000-8000-000000000021') is not null
   or not exists(select 1 from public.notification_events where id=md5('f2-event-1')::uuid) then raise exception 'archive/read changed other recipient or event'; end if;
end $$;
set local role anon;
do $$ begin
 begin perform public.get_my_notifications_page(); raise exception 'anonymous page allowed'; exception when insufficient_privilege then null; end;
 begin perform public.get_my_notification_shell(); raise exception 'anonymous shell allowed'; exception when insufficient_privilege then null; end;
 begin perform public.mark_my_source_notifications_read('weekly_updates',array['777']);raise exception 'anonymous source allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
update public.notification_events set target_table='weekly_updates',target_id='777' where id=md5('f2-event-65')::uuid;
update public.notification_recipients set read_at=null where id=md5('f2-recipient-65')::uuid;
insert into public.notification_recipients(event_id,student_id) values(md5('f2-event-65')::uuid,'f2f20000-0000-4000-8000-000000000002');
set local role authenticated;
set local request.jwt.claim.sub='f2f20000-0000-4000-8000-000000000011';
do $$ begin
 if public.mark_my_source_notifications_read('weekly_updates',array['777'])<>1 then raise exception 'source did not mark own'; end if;
 if public.mark_my_source_notifications_read('weekly_updates',array['777'])<>0 then raise exception 'source not idempotent'; end if;
 begin perform public.mark_my_source_notifications_read('conversation_threads',array['777']);raise exception 'blanket chat mark allowed';exception when invalid_parameter_value then null;end;
end $$;
reset role;
do $$ begin
 if exists(select 1 from public.notification_recipients where student_id='f2f20000-0000-4000-8000-000000000002' and read_at is not null) then raise exception 'source changed another recipient'; end if;
end $$;
rollback;
