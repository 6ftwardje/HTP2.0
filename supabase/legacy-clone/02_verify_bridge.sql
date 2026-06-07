select 'students' as table_name, count(*)::bigint as row_count from public.students
union all select 'modules', count(*) from public.modules
union all select 'lessons', count(*) from public.lessons
union all select 'practical_lessons', count(*) from public.practical_lessons
union all select 'exams', count(*) from public.exams
union all select 'exam_questions', count(*) from public.exam_questions
union all select 'exam_results', count(*) from public.exam_results
union all select 'progress', count(*) from public.progress;

select
  count(*) filter (where slug is null) as modules_missing_slug,
  count(*) filter (where order_index is null) as modules_missing_order_index,
  count(*) filter (where is_published is not true) as modules_not_published
from public.modules;

select
  count(*) filter (where slug is null) as lessons_missing_slug,
  count(*) filter (where order_index is null) as lessons_missing_order_index,
  count(*) filter (where video_provider is distinct from 'vimeo') as lessons_not_vimeo,
  count(*) filter (where is_published is not true) as lessons_not_published
from public.lessons;

select id, title, slug, order_index, thumbnail_url is not null as has_thumbnail
from public.modules
order by order_index
limit 12;

select id, module_id, title, slug, order_index, video_provider
from public.lessons
order by module_id, order_index, id
limit 16;
