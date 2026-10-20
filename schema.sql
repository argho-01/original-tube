-- Original Tube schema. Run in Supabase SQL Editor as project owner.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  avatar_url text,
  bio text,
  created_at timestamptz not null default now()
);
create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  description text default '',
  video_url text not null,
  thumbnail_url text,
  category text not null default 'Entertainment',
  visibility text not null default 'public' check (visibility in ('public','unlisted','private')),
  created_at timestamptz not null default now()
);
create index if not exists videos_feed_idx on public.videos(visibility, created_at desc);
create index if not exists videos_user_idx on public.videos(user_id, created_at desc);
create table if not exists public.likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id, video_id)
);
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists comments_video_idx on public.comments(video_id, created_at desc);
create table if not exists public.subscriptions (
  subscriber_id uuid not null references public.profiles(id) on delete cascade,
  channel_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(subscriber_id, channel_id),
  check (subscriber_id <> channel_id)
);

-- Create profile automatically when a user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, username)
  values(new.id, coalesce(nullif(new.raw_user_meta_data->>'username',''), split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.videos enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.subscriptions enable row level security;

create policy "Profiles are viewable" on public.profiles for select using (true);
create policy "Users update own profile" on public.profiles for update using (auth.uid()=id) with check (auth.uid()=id);
create policy "Users insert own profile" on public.profiles for insert with check (auth.uid()=id);

create policy "Public videos visible, owners can see theirs" on public.videos for select
using (visibility='public' or user_id=auth.uid());
create policy "Signed-in users upload own videos" on public.videos for insert
to authenticated with check (user_id=auth.uid());
create policy "Owners update own videos" on public.videos for update
to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "Owners delete own videos" on public.videos for delete
to authenticated using (user_id=auth.uid());

create policy "Likes are readable" on public.likes for select using (true);
create policy "Users like as themselves" on public.likes for insert to authenticated with check (user_id=auth.uid());
create policy "Users remove own likes" on public.likes for delete to authenticated using (user_id=auth.uid());

create policy "Comments are readable" on public.comments for select using (true);
create policy "Signed-in users comment as themselves" on public.comments for insert to authenticated with check (user_id=auth.uid());
create policy "Users delete own comments" on public.comments for delete to authenticated using (user_id=auth.uid());

create policy "Subscriptions readable" on public.subscriptions for select using (true);
create policy "Users subscribe as themselves" on public.subscriptions for insert to authenticated with check (subscriber_id=auth.uid());
create policy "Users unsubscribe as themselves" on public.subscriptions for delete to authenticated using (subscriber_id=auth.uid());

-- Storage buckets. Public read means public videos are delivered by public URLs.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('videos','videos',true,524288000,array['video/mp4','video/webm','video/quicktime','video/x-m4v','video/mpeg'])
on conflict (id) do update set public=true, file_size_limit=524288000;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('thumbnails','thumbnails',true,10485760,array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update set public=true, file_size_limit=10485760;

create policy "Public video files readable" on storage.objects for select using (bucket_id in ('videos','thumbnails'));
create policy "Users upload into own folder" on storage.objects for insert to authenticated
with check (bucket_id in ('videos','thumbnails') and (storage.foldername(name))[1]=auth.uid()::text);
create policy "Users update own files" on storage.objects for update to authenticated
using (bucket_id in ('videos','thumbnails') and (storage.foldername(name))[1]=auth.uid()::text)
with check (bucket_id in ('videos','thumbnails') and (storage.foldername(name))[1]=auth.uid()::text);
create policy "Users delete own files" on storage.objects for delete to authenticated
using (bucket_id in ('videos','thumbnails') and (storage.foldername(name))[1]=auth.uid()::text);

-- Production note: add moderation, report/abuse workflows, quotas, transcoding and resumable uploads before launch.
