-- Q2.2: correct the production Auth mapping, without changing entitlements.
-- Keep the existing trigger if present. Fresh databases can also bootstrap via
-- ensureCurrentStudent; do not introduce a second automatic profile lifecycle.
create or replace function public.normalized_student_name(p_value text) returns text
language sql immutable set search_path='' as $$
 select case when length(trim(p_value)) between 1 and 100
  and lower(trim(p_value)) not in ('onbekend','unknown')
  and p_value !~ '[[:cntrl:]]' and p_value ~ '[[:alpha:]]'
 then regexp_replace(trim(p_value),'[[:space:]]+',' ','g') else null end;
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into public.students(email,auth_user_id,access_level,name,phone)
 values(new.email,new.id,1,
  coalesce(public.normalized_student_name(new.raw_user_meta_data->>'full_name'),public.normalized_student_name(new.raw_user_meta_data->>'name')),
  case when new.raw_user_meta_data->>'phone' ~ '^\+[1-9][0-9]{7,14}$' then new.raw_user_meta_data->>'phone' else null end)
 on conflict(auth_user_id) do nothing;
 return new;
end;$$;
revoke all on function public.handle_new_user() from public,anon,authenticated;

create or replace function public.repair_own_student_profile() returns setof public.students
language plpgsql security definer set search_path='' as $$
declare v_name text;v_phone text;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501';end if;
 select coalesce(public.normalized_student_name(u.raw_user_meta_data->>'full_name'),public.normalized_student_name(u.raw_user_meta_data->>'name')),
  case when u.raw_user_meta_data->>'phone' ~ '^\+[1-9][0-9]{7,14}$' then u.raw_user_meta_data->>'phone' else null end
 into v_name,v_phone from auth.users u where u.id=auth.uid();
 update public.students s set
  name=case when public.normalized_student_name(s.name) is null and v_name is not null then v_name else s.name end,
  phone=case when nullif(trim(s.phone),'') is null and v_phone is not null then v_phone else s.phone end
 where s.auth_user_id=auth.uid() and ((public.normalized_student_name(s.name) is null and v_name is not null) or (nullif(trim(s.phone),'') is null and v_phone is not null));
 return query select s.* from public.students s where s.auth_user_id=auth.uid();
end;$$;

create or replace function public.complete_own_student_profile(p_name text,p_phone text) returns setof public.students
language plpgsql security definer set search_path='' as $$
declare v_name text:=public.normalized_student_name(p_name);
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501';end if;
 if v_name is null or p_phone is null or p_phone !~ '^\+[1-9][0-9]{7,14}$' then
  raise exception 'Invalid profile fields' using errcode='22023';
 end if;
 return query update public.students s set name=v_name,phone=p_phone where s.auth_user_id=auth.uid() returning s.*;
end;$$;
revoke all on function public.repair_own_student_profile() from public,anon;
revoke all on function public.complete_own_student_profile(text,text) from public,anon;
grant execute on function public.repair_own_student_profile() to authenticated;
grant execute on function public.complete_own_student_profile(text,text) to authenticated;
comment on function public.repair_own_student_profile() is 'Repairs only the authenticated owner missing name/phone from existing Auth metadata; preserves real names and access.';
notify pgrst,'reload schema';
