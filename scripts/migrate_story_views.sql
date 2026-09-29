begin;

create table if not exists public.story_views (
  story_id uuid not null references public.stories(id) on delete cascade,
  viewer_id uuid not null references auth.users(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (story_id, viewer_id)
);

create index if not exists idx_story_views_viewer
  on public.story_views(viewer_id, viewed_at desc);

alter table public.story_views enable row level security;

commit;