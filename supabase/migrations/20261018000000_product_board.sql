-- Shared product work. No GitHub credentials or copied issue bodies are stored here.
begin;
create table public.product_board_cycles (
  board text primary key check (board in ('development','team')),
  goal text not null default '' check (length(goal) <= 1000),
  starts_on date,
  ends_on date,
  feedback text not null default '' check (length(feedback) <= 3000),
  version integer not null default 0 check (version >= 0),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);
insert into public.product_board_cycles(board) values ('development'), ('team');

create table public.product_board_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 3 and 160),
  description text not null default '' check (length(description) <= 3000),
  result text not null default '' check (length(result) <= 3000),
  proof text not null default '' check (length(proof) <= 3000),
  status text not null default 'todo' check (status in ('todo','doing','review','done','blocked')),
  priority text not null default 'P2' check (priority in ('P1','P2','P3')),
  owner_id uuid references public.students(id) on delete set null,
  due_date date,
  blocker text not null default '' check (length(blocker) <= 3000),
  created_by uuid references public.students(id) on delete set null,
  created_at timestamptz not null default now(),
  version integer not null default 0 check (version >= 0),
  check (status <> 'blocked' or length(btrim(blocker)) >= 5),
  check (status <> 'done' or (length(btrim(result)) >= 5 and length(btrim(proof)) >= 5))
);
alter table public.product_board_cycles enable row level security;
alter table public.product_board_tasks enable row level security;
grant select, update on public.product_board_cycles to authenticated;
grant select, insert, update on public.product_board_tasks to authenticated;
revoke all on public.product_board_cycles, public.product_board_tasks from anon;
create policy product_board_cycles_admin_read on public.product_board_cycles for select to authenticated using (public.is_platform_admin());
create policy product_board_cycles_admin_update on public.product_board_cycles for update to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy product_board_tasks_admin_read on public.product_board_tasks for select to authenticated using (public.is_platform_admin());
create policy product_board_tasks_admin_insert on public.product_board_tasks for insert to authenticated with check (public.is_platform_admin() and created_by = (select id from public.students where auth_user_id = auth.uid()));
create policy product_board_tasks_admin_update on public.product_board_tasks for update to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create index product_board_tasks_created_idx on public.product_board_tasks(created_at desc);
commit;
