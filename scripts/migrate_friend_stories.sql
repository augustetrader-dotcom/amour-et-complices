begin;

alter table public.stories alter column couple_id drop not null;
alter table public.stories add column if not exists audience text not null default 'couple';

do $$
begin
  alter table public.stories
    add constraint stories_audience_check check (audience in ('couple', 'friends'));
exception when duplicate_object then
  null;
end $$;

create index if not exists idx_stories_friends_expiry
  on public.stories(audience, user_id, expires_at desc);

drop policy if exists "Un membre du couple voit les stories" on public.stories;
drop policy if exists "Un membre du couple publie sa story" on public.stories;
drop policy if exists "Amis acceptes voient les stories amis" on public.stories;
create or replace function public.can_view_story_from_group(story_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.conversation_members viewer_member
    join public.conversation_members story_owner_member
      on story_owner_member.conversation_id = viewer_member.conversation_id
    join public.conversations
      on conversations.id = viewer_member.conversation_id
    where viewer_member.user_id = auth.uid()
      and story_owner_member.user_id = story_owner
      and conversations.type = 'group'
  );
$$;
revoke all on function public.can_view_story_from_group(uuid) from public, anon;
grant execute on function public.can_view_story_from_group(uuid) to authenticated;

drop policy if exists "Accès média du couple" on storage.objects;
drop policy if exists "Accès média chat et stories" on storage.objects;
create policy "Accès média chat et stories"
  on storage.objects for all
  using (
    bucket_id = 'chat-media' and (
      exists (
        select 1 from public.couples
        where couples.id::text = (storage.foldername(name))[1]
          and (couples.user_a = auth.uid() or couples.user_b = auth.uid())
      )
      or (
        (storage.foldername(name))[1] = auth.uid()::text
        and (storage.foldername(name))[2] = 'stories'
      )
      or (
        (storage.foldername(name))[1] = 'conv'
        and exists (
          select 1 from public.conversation_members m
          where m.conversation_id::text = (storage.foldername(name))[2]
            and m.user_id = auth.uid()
        )
      )
    )
  )
  with check (
    bucket_id = 'chat-media' and (
      exists (
        select 1 from public.couples
        where couples.id::text = (storage.foldername(name))[1]
          and (couples.user_a = auth.uid() or couples.user_b = auth.uid())
      )
      or (
        (storage.foldername(name))[1] = auth.uid()::text
        and (storage.foldername(name))[2] = 'stories'
      )
      or (
        (storage.foldername(name))[1] = 'conv'
        and exists (
          select 1 from public.conversation_members m
          where m.conversation_id::text = (storage.foldername(name))[2]
            and m.user_id = auth.uid()
        )
      )
    )
  );

create policy "Un membre du couple voit les stories"
  on public.stories for select using (
    user_id = auth.uid()
    or (
      audience = 'couple' and exists (
        select 1 from public.couples
        where couples.id = stories.couple_id
          and (couples.user_a = auth.uid() or couples.user_b = auth.uid())
      )
    )
    or (
      audience in ('couple', 'friends') and exists (
        select 1 from public.friends
        where (friends.user_id = auth.uid() and friends.friend_id = stories.user_id)
           or (friends.friend_id = auth.uid() and friends.user_id = stories.user_id)
      )
    )
    or (
      audience in ('couple', 'friends') and public.can_view_story_from_group(stories.user_id)
    )
  );

create policy "Un membre du couple publie sa story"
  on public.stories for insert with check (
    auth.uid() = user_id and (
      (audience = 'friends' and couple_id is null)
      or (
        audience = 'couple' and exists (
          select 1 from public.couples
          where couples.id = stories.couple_id
            and (couples.user_a = auth.uid() or couples.user_b = auth.uid())
        )
      )
    )
  );

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'stories'
     ) then
    alter publication supabase_realtime add table public.stories;
  end if;
exception when others then
  raise notice 'Active stories dans Database > Replication si la publication n’est pas accessible.';
end $$;

commit;
