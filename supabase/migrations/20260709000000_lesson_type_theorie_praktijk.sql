do $$
begin
  create type public.lesson_type as enum ('theorie', 'praktijk');
exception
  when duplicate_object then null;
end $$;

alter table public.lessons
  add column if not exists type public.lesson_type;

update public.lessons
set type = 'theorie'
where type is null;

alter table public.lessons
  alter column type set default 'theorie',
  alter column type set not null;
