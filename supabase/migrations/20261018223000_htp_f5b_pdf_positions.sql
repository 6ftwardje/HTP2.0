-- HTP-32: last visible page, not proof of reading or course completion.
create table if not exists public.pdf_positions(
 student_id uuid not null references public.students(id) on delete cascade,
 document_id uuid not null references public.pdf_documents(id) on delete cascade,
 document_version uuid not null,page integer not null check(page between 1 and 150),
 revision bigint not null check(revision>0),session_id uuid not null,client_sequence integer not null check(client_sequence>0),
 updated_at timestamptz not null default now(),primary key(student_id,document_id)
);
alter table public.pdf_positions enable row level security;
revoke all on public.pdf_positions from public,anon,authenticated;
grant select on public.pdf_positions to authenticated;grant all on public.pdf_positions to service_role;
create or replace function public.current_pdf_version(p_id uuid) returns uuid
language sql stable security definer set search_path='' as $$ select d.version from public.pdf_documents d where d.id=p_id and public.can_read_pdf(d.id); $$;
revoke all on function public.current_pdf_version(uuid) from public,anon;
grant execute on function public.current_pdf_version(uuid) to authenticated;
drop policy if exists pdf_positions_owner on public.pdf_positions;
create policy pdf_positions_owner on public.pdf_positions for select to authenticated using(
 public.has_live_learning_account() and student_id in(select s.id from public.students s where s.auth_user_id=auth.uid())
 and public.can_read_pdf(document_id) and document_version=public.current_pdf_version(document_id)
);
create or replace function public.read_pdf_position(p_document_id uuid,p_version uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare s uuid;d public.pdf_documents;r public.pdf_positions;
begin
 select id into s from public.students where auth_user_id=auth.uid();
 if s is null or not public.can_read_pdf(p_document_id) then raise insufficient_privilege;end if;
 select * into d from public.pdf_documents where id=p_document_id;
 if d.version is distinct from p_version then raise invalid_parameter_value;end if;
 select * into r from public.pdf_positions where student_id=s and document_id=p_document_id;
 return jsonb_build_object('viewerId',s,'version',d.version,'page',case when r.document_version=d.version then least(r.page,d.page_count) else 1 end,'revision',case when r.document_version=d.version then r.revision else 0 end);
end;$$;
revoke all on function public.read_pdf_position(uuid,uuid) from public,anon;
grant execute on function public.read_pdf_position(uuid,uuid) to authenticated;
create or replace function public.save_pdf_position(p_document_id uuid,p_version uuid,p_viewer_id uuid,p_page integer,p_revision bigint,p_session_id uuid,p_sequence integer) returns jsonb
language plpgsql security definer set search_path='' as $$
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
revoke all on function public.save_pdf_position(uuid,uuid,uuid,integer,bigint,uuid,integer) from public,anon;
grant execute on function public.save_pdf_position(uuid,uuid,uuid,integer,bigint,uuid,integer) to authenticated;
create or replace function public.cleanup_deleted_auth_pdf_positions() returns trigger
language plpgsql security definer set search_path='' as $$begin
 delete from public.pdf_positions p using public.students s where p.student_id=s.id and s.auth_user_id=old.id;return old;
end;$$;
revoke all on function public.cleanup_deleted_auth_pdf_positions() from public,anon,authenticated;
drop trigger if exists cleanup_deleted_auth_pdf_positions on auth.users;
create trigger cleanup_deleted_auth_pdf_positions before delete on auth.users for each row execute function public.cleanup_deleted_auth_pdf_positions();
