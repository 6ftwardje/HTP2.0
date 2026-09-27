-- Attribute published text and chart posts to the account that published them.
-- The name is a snapshot so student RLS and later profile edits do not hide it.
alter table public.weekly_updates
  add column if not exists published_by_student_id uuid references public.students (id) on delete set null,
  add column if not exists published_by_display_name text;

-- Older posts did not record the publishing actor. Their known creator is the
-- best available attribution; rows without one remain unattributed.
update public.weekly_updates as update_row
set published_by_student_id = creator.id,
    published_by_display_name = left(
      case
        when nullif(btrim(creator.name), '') is not null
          and lower(btrim(creator.name)) <> 'onbekend'
          then btrim(creator.name)
        else split_part(creator.email, '@', 1)
      end,
      120
    )
from public.students as creator
where update_row.created_by_student_id = creator.id
  and update_row.content_format in ('text', 'chart')
  and update_row.is_published = true
  and update_row.published_by_student_id is null;
