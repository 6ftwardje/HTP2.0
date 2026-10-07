-- New post/own-avatar checks rely on immutable identity and trusted access_level.
-- Existing own-profile RLS permitted writing these fields directly. Preserve
-- admin access management, while forbidding client identity reassignment.
create function public.guard_student_identity() returns trigger
language plpgsql security definer set search_path = '' as $$
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
revoke all on function public.guard_student_identity() from public, anon, authenticated;
create trigger guard_student_identity before insert or update on public.students
  for each row execute function public.guard_student_identity();
