-- Esquema de cuentas, perfiles públicos y comentarios de NegativeStudios.
-- Se puede volver a ejecutar en el SQL Editor de Supabase.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  display_name text not null default 'Usuario',
  bio text not null default '',
  avatar_url text,
  banner_url text,
  is_private boolean not null default false,
  username_changed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,24}$'),
  constraint profiles_display_name_length check (char_length(display_name) between 1 and 32),
  constraint profiles_bio_length check (char_length(bio) <= 180)
);

alter table public.profiles add column if not exists banner_url text;
alter table public.profiles add column if not exists username_changed_at timestamptz;
update public.profiles set is_private = false where is_private is distinct from false;

create unique index if not exists profiles_username_lower_unique
  on public.profiles (lower(username));

alter table public.profiles enable row level security;
drop policy if exists "Anyone can view public profiles" on public.profiles;
drop policy if exists "All profiles are public" on public.profiles;
create policy "All profiles are public"
  on public.profiles for select
  using (true);

drop policy if exists "Users can create their own profile" on public.profiles;
create policy "Users can create their own profile"
  on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

grant select on public.profiles to anon, authenticated;
grant insert, update on public.profiles to authenticated;

-- El límite de dos semanas se aplica en el servidor y no puede alterarse desde el navegador.
create or replace function public.enforce_public_profile_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.is_private := false;
  new.updated_at := now();

  if tg_op = 'UPDATE' then
    if new.username is distinct from old.username then
      if old.username_changed_at is not null
         and old.username_changed_at > now() - interval '14 days' then
        raise exception 'username_cooldown: you can change your username once every 14 days'
          using errcode = 'P0001';
      end if;
      new.username_changed_at := now();
    else
      new.username_changed_at := old.username_changed_at;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_public_profile_rules on public.profiles;
create trigger enforce_public_profile_rules
  before insert or update on public.profiles
  for each row execute function public.enforce_public_profile_rules();

-- Crear un perfil básico al crear una cuenta (correo/contraseña u OAuth).
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_name text;
  candidate text;
  visible_name text;
begin
  base_name := lower(regexp_replace(
    coalesce(
      nullif(new.raw_user_meta_data ->> 'username', ''),
      nullif(new.raw_user_meta_data ->> 'preferred_username', ''),
      nullif(new.raw_user_meta_data ->> 'user_name', ''),
      split_part(coalesce(new.email, ''), '@', 1),
      'usuario'
    ),
    '[^a-z0-9_]', '', 'g'
  ));
  base_name := left(base_name, 24);

  if char_length(base_name) < 3 then
    base_name := 'usuario';
  end if;

  candidate := base_name;
  if exists (select 1 from public.profiles p where lower(p.username) = lower(candidate)) then
    candidate := left(base_name, 16) || '_' || left(replace(new.id::text, '-', ''), 7);
  end if;

  visible_name := left(coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'preferred_username'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Usuario'
  ), 32);

  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    candidate,
    visible_name,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'avatar_url', ''),
      nullif(new.raw_user_meta_data ->> 'picture', ''),
      nullif(new.raw_user_meta_data ->> 'profile_image_url', ''),
      nullif(new.raw_user_meta_data ->> 'profile_image', ''),
      nullif(new.raw_user_meta_data ->> 'avatar', '')
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_user_profile();

-- Comentarios públicos en las páginas de proyectos, con respuestas anidadas.
create table if not exists public.project_comments (
  id bigint generated by default as identity primary key,
  project_slug text not null check (project_slug ~ '^[a-z0-9-]{2,64}$'),
  user_id uuid not null references public.profiles(id) on delete cascade,
  parent_comment_id bigint references public.project_comments(id) on delete cascade,
  content text not null check (char_length(trim(content)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists project_comments_project_created_idx
  on public.project_comments (project_slug, created_at desc);
create index if not exists project_comments_parent_idx
  on public.project_comments (parent_comment_id);

create or replace function public.validate_project_comment_parent()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent_project text;
begin
  if new.parent_comment_id is not null then
    select project_slug into parent_project
      from public.project_comments
      where id = new.parent_comment_id;

    if parent_project is null or parent_project <> new.project_slug then
      raise exception 'A reply must belong to the same project as its parent comment';
    end if;
  end if;
  new.content := trim(new.content);
  return new;
end;
$$;

drop trigger if exists validate_project_comment_parent on public.project_comments;
create trigger validate_project_comment_parent
  before insert or update on public.project_comments
  for each row execute function public.validate_project_comment_parent();

alter table public.project_comments enable row level security;
drop policy if exists "Project comments are publicly readable" on public.project_comments;
create policy "Project comments are publicly readable"
  on public.project_comments for select using (true);

drop policy if exists "Signed-in users can comment" on public.project_comments;
create policy "Signed-in users can comment"
  on public.project_comments for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can delete their own comments" on public.project_comments;
create policy "Users can delete their own comments"
  on public.project_comments for delete to authenticated
  using (user_id = (select auth.uid()));

grant select on public.project_comments to anon, authenticated;
grant insert, delete on public.project_comments to authenticated;
grant usage, select on sequence public.project_comments_id_seq to authenticated;

-- Almacenamiento público para fotos de perfil (3 MB) y banners (6 MB).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 3145728, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set
  public = true,
  file_size_limit = 3145728,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'];

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('banners', 'banners', true, 6291456, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set
  public = true,
  file_size_limit = 6291456,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'];

drop policy if exists "Avatar images are publicly readable" on storage.objects;
create policy "Avatar images are publicly readable"
  on storage.objects for select using (bucket_id = 'avatars');

drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users can delete their own avatar" on storage.objects;
create policy "Users can delete their own avatar"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Banner images are publicly readable" on storage.objects;
create policy "Banner images are publicly readable"
  on storage.objects for select using (bucket_id = 'banners');

drop policy if exists "Users can upload their own banner" on storage.objects;
create policy "Users can upload their own banner"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'banners' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users can update their own banner" on storage.objects;
create policy "Users can update their own banner"
  on storage.objects for update to authenticated
  using (bucket_id = 'banners' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'banners' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users can delete their own banner" on storage.objects;
create policy "Users can delete their own banner"
  on storage.objects for delete to authenticated
  using (bucket_id = 'banners' and (storage.foldername(name))[1] = (select auth.uid())::text);


-- Emblemas públicos: solo los RPC autorizados pueden modificarlos.
create table if not exists public.profile_badges (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  is_mod boolean not null default false,
  is_verified boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.profile_badges enable row level security;
drop policy if exists "Profile badges are publicly readable" on public.profile_badges;
create policy "Profile badges are publicly readable" on public.profile_badges for select using (true);
revoke all on public.profile_badges from anon, authenticated;
grant select on public.profile_badges to anon, authenticated;

-- Lista privada de administradores, inicializada con mrlion303 si el perfil ya existe.
create table if not exists public.site_admins (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.site_admins enable row level security;
revoke all on public.site_admins from anon, authenticated;
insert into public.site_admins (user_id)
select id from public.profiles where lower(username) = 'mrlion303'
on conflict (user_id) do nothing;

create or replace function public.set_profile_badges(target_profile_id uuid, mod_enabled boolean, verified_enabled boolean)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (select 1 from public.site_admins where user_id = auth.uid()) then
    raise exception 'No tienes permiso para administrar badges.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = target_profile_id) then
    raise exception 'No se encontró el perfil indicado.';
  end if;
  if coalesce(mod_enabled, false) = false and coalesce(verified_enabled, false) = false then
    delete from public.profile_badges where user_id = target_profile_id;
  else
    insert into public.profile_badges (user_id, is_mod, is_verified, updated_at)
    values (target_profile_id, coalesce(mod_enabled, false), coalesce(verified_enabled, false), now())
    on conflict (user_id) do update set is_mod = excluded.is_mod, is_verified = excluded.is_verified, updated_at = now();
  end if;
end;
$$;
revoke all on function public.set_profile_badges(uuid, boolean, boolean) from public, anon;
grant execute on function public.set_profile_badges(uuid, boolean, boolean) to authenticated;

create or replace function public.moderator_delete_project_comment(target_comment_id bigint)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.profile_badges where user_id = auth.uid() and is_mod = true
  ) then
    raise exception 'Necesitas el badge de moderador para eliminar comentarios de otras personas.' using errcode = '42501';
  end if;
  delete from public.project_comments where id = target_comment_id;
  if not found then raise exception 'No se encontró el comentario o ya fue eliminado.'; end if;
end;
$$;
revoke all on function public.moderator_delete_project_comment(bigint) from public, anon;
grant execute on function public.moderator_delete_project_comment(bigint) to authenticated;


-- Comunidad: amistades, foro, imágenes y reacciones.
create table if not exists public.friend_requests (
 id uuid primary key default gen_random_uuid(),
 requester_id uuid not null references public.profiles(id) on delete cascade,
 recipient_id uuid not null references public.profiles(id) on delete cascade,
 status text not null default 'pending' check (status in ('pending','accepted','rejected')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint friend_requests_no_self check (requester_id <> recipient_id),
 constraint friend_requests_pair_unique unique(requester_id,recipient_id)
);
create index if not exists friend_requests_recipient_status_idx on public.friend_requests(recipient_id,status,created_at desc);
create index if not exists friend_requests_requester_status_idx on public.friend_requests(requester_id,status,created_at desc);
alter table public.friend_requests enable row level security;
drop policy if exists "Users can read their own friendship requests" on public.friend_requests;
create policy "Users can read their own friendship requests" on public.friend_requests for select to authenticated
 using (requester_id=(select auth.uid()) or recipient_id=(select auth.uid()));
revoke all on public.friend_requests from anon,authenticated;
grant select on public.friend_requests to authenticated;

create or replace function public.send_friend_request(target_user_id uuid)
returns text language plpgsql security definer set search_path=''
as $$
declare current_status text;
begin
 if auth.uid() is null then raise exception 'Inicia sesión para enviar solicitudes.' using errcode='42501'; end if;
 if target_user_id=auth.uid() then raise exception 'No puedes enviarte una solicitud a ti mismo.'; end if;
 if not exists(select 1 from public.profiles where id=target_user_id) then raise exception 'No se encontró ese perfil.'; end if;
 if exists(select 1 from public.friend_requests where status='accepted' and ((requester_id=auth.uid() and recipient_id=target_user_id) or (requester_id=target_user_id and recipient_id=auth.uid()))) then raise exception 'Ya son amigos.'; end if;
 if exists(select 1 from public.friend_requests where requester_id=target_user_id and recipient_id=auth.uid() and status='pending') then raise exception 'Esta persona ya te envió una solicitud; puedes aceptarla desde su perfil.'; end if;
 select status into current_status from public.friend_requests where requester_id=auth.uid() and recipient_id=target_user_id;
 if current_status='pending' then raise exception 'Ya enviaste una solicitud a esta persona.'; end if;
 insert into public.friend_requests(requester_id,recipient_id,status,created_at,updated_at)
 values(auth.uid(),target_user_id,'pending',now(),now())
 on conflict(requester_id,recipient_id) do update set status='pending',created_at=now(),updated_at=now();
 return 'pending';
end;
$$;
revoke all on function public.send_friend_request(uuid) from public,anon;
grant execute on function public.send_friend_request(uuid) to authenticated;

create or replace function public.respond_friend_request(request_id uuid, accept_request boolean)
returns void language plpgsql security definer set search_path=''
as $$
begin
 if auth.uid() is null then raise exception 'Inicia sesión para responder solicitudes.' using errcode='42501'; end if;
 update public.friend_requests set status=case when accept_request then 'accepted' else 'rejected' end,updated_at=now()
 where id=request_id and recipient_id=auth.uid() and status='pending';
 if not found then raise exception 'La solicitud ya no existe o no puedes responderla.'; end if;
end;
$$;
revoke all on function public.respond_friend_request(uuid,boolean) from public,anon;
grant execute on function public.respond_friend_request(uuid,boolean) to authenticated;

create or replace function public.remove_friend(target_user_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
begin
 if auth.uid() is null then raise exception 'Inicia sesión para administrar amistades.' using errcode='42501'; end if;
 delete from public.friend_requests where status='accepted' and ((requester_id=auth.uid() and recipient_id=target_user_id) or (requester_id=target_user_id and recipient_id=auth.uid()));
 if not found then raise exception 'No se encontró una amistad activa con ese usuario.'; end if;
end;
$$;
revoke all on function public.remove_friend(uuid) from public,anon;
grant execute on function public.remove_friend(uuid) to authenticated;

create table if not exists public.forum_posts (
 id bigint generated by default as identity primary key,
 user_id uuid not null references public.profiles(id) on delete cascade,
 content_html text not null default '',
 content_text text not null default '',
 image_url text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint forum_posts_content_length check(char_length(content_text)<=5000),
 constraint forum_posts_html_length check(char_length(content_html)<=15000),
 constraint forum_posts_not_empty check(char_length(trim(content_text))>0 or image_url is not null)
);
create index if not exists forum_posts_created_idx on public.forum_posts(created_at desc);
create index if not exists forum_posts_user_created_idx on public.forum_posts(user_id,created_at desc);
alter table public.forum_posts enable row level security;
drop policy if exists "Forum posts are publicly readable" on public.forum_posts;
create policy "Forum posts are publicly readable" on public.forum_posts for select using(true);
drop policy if exists "Users can publish their own forum posts" on public.forum_posts;
create policy "Users can publish their own forum posts" on public.forum_posts for insert to authenticated with check(user_id=(select auth.uid()));
drop policy if exists "Users can edit their own forum posts" on public.forum_posts;
create policy "Users can edit their own forum posts" on public.forum_posts for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
drop policy if exists "Users can delete their own forum posts" on public.forum_posts;
create policy "Users can delete their own forum posts" on public.forum_posts for delete to authenticated using(user_id=(select auth.uid()));
grant select on public.forum_posts to anon,authenticated;
grant insert,update,delete on public.forum_posts to authenticated;
grant usage,select on sequence public.forum_posts_id_seq to authenticated;

create table if not exists public.project_comment_likes (
 comment_id bigint not null references public.project_comments(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(comment_id,user_id)
);
create index if not exists project_comment_likes_user_idx on public.project_comment_likes(user_id,created_at desc);
alter table public.project_comment_likes enable row level security;
drop policy if exists "Comment hearts are publicly readable" on public.project_comment_likes;
create policy "Comment hearts are publicly readable" on public.project_comment_likes for select using(true);
drop policy if exists "Users can add their own comment hearts" on public.project_comment_likes;
create policy "Users can add their own comment hearts" on public.project_comment_likes for insert to authenticated with check(user_id=(select auth.uid()));
drop policy if exists "Users can remove their own comment hearts" on public.project_comment_likes;
create policy "Users can remove their own comment hearts" on public.project_comment_likes for delete to authenticated using(user_id=(select auth.uid()));
grant select on public.project_comment_likes to anon,authenticated;
grant insert,delete on public.project_comment_likes to authenticated;

create table if not exists public.forum_post_likes (
 post_id bigint not null references public.forum_posts(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(post_id,user_id)
);
create index if not exists forum_post_likes_user_idx on public.forum_post_likes(user_id,created_at desc);
alter table public.forum_post_likes enable row level security;
drop policy if exists "Forum hearts are publicly readable" on public.forum_post_likes;
create policy "Forum hearts are publicly readable" on public.forum_post_likes for select using(true);
drop policy if exists "Users can add their own forum hearts" on public.forum_post_likes;
create policy "Users can add their own forum hearts" on public.forum_post_likes for insert to authenticated with check(user_id=(select auth.uid()));
drop policy if exists "Users can remove their own forum hearts" on public.forum_post_likes;
create policy "Users can remove their own forum hearts" on public.forum_post_likes for delete to authenticated using(user_id=(select auth.uid()));
grant select on public.forum_post_likes to anon,authenticated;
grant insert,delete on public.forum_post_likes to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('post-images','post-images',true,5242880,array['image/png','image/jpeg','image/webp'])
on conflict(id) do update set public=true,file_size_limit=5242880,allowed_mime_types=array['image/png','image/jpeg','image/webp'];
drop policy if exists "Post images are publicly readable" on storage.objects;
create policy "Post images are publicly readable" on storage.objects for select using(bucket_id='post-images');
drop policy if exists "Users can upload their own post images" on storage.objects;
create policy "Users can upload their own post images" on storage.objects for insert to authenticated with check(bucket_id='post-images' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "Users can update their own post images" on storage.objects;
create policy "Users can update their own post images" on storage.objects for update to authenticated using(bucket_id='post-images' and (storage.foldername(name))[1]=(select auth.uid())::text) with check(bucket_id='post-images' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "Users can delete their own post images" on storage.objects;
create policy "Users can delete their own post images" on storage.objects for delete to authenticated using(bucket_id='post-images' and (storage.foldername(name))[1]=(select auth.uid())::text);
 
 -- Los moderadores también pueden retirar publicaciones ajenas del foro.
 create or replace function public.moderator_delete_forum_post(target_post_id bigint)
 returns void language plpgsql security definer set search_path=''
 as $$
 begin
   if auth.uid() is null or not exists(select 1 from public.profile_badges where user_id=auth.uid() and is_mod=true) then
     raise exception 'Necesitas el badge de moderador para eliminar publicaciones.' using errcode='42501';
   end if;
   delete from public.forum_posts where id=target_post_id;
   if not found then raise exception 'No se encontró la publicación o ya fue eliminada.'; end if;
 end;
 $$;
 revoke all on function public.moderator_delete_forum_post(bigint) from public,anon;
 grant execute on function public.moderator_delete_forum_post(bigint) to authenticated;

 
-- Permitir consultar públicamente amistades aceptadas sin exponer solicitudes pendientes.
drop policy if exists "Accepted friendships are publicly readable" on public.friend_requests;
create policy "Accepted friendships are publicly readable"
  on public.friend_requests for select
  using (status = 'accepted');
grant select on public.friend_requests to anon, authenticated;



-- Notificaciones de actividad, menciones y conexiones de Microsoft.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null,
  title text not null,
  body text not null default '',
  post_id bigint references public.forum_posts(id) on delete cascade,
  comment_id bigint references public.project_comments(id) on delete cascade,
  friend_request_id uuid references public.friend_requests(id) on delete cascade,
  project_slug text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists notifications_user_unread_created_idx
  on public.notifications(user_id, read_at, created_at desc);
alter table public.notifications enable row level security;
drop policy if exists "Users can read their own notifications" on public.notifications;
create policy "Users can read their own notifications"
  on public.notifications for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists "Users can mark their own notifications read" on public.notifications;
create policy "Users can mark their own notifications read"
  on public.notifications for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
revoke all on public.notifications from anon, authenticated;
grant select, update on public.notifications to authenticated;

create or replace function public.create_activity_notification(
  target_user_id uuid, actor_user_id uuid, event_type text, event_title text,
  event_body text default '', target_post_id bigint default null,
  target_comment_id bigint default null, target_friend_request_id uuid default null,
  target_project_slug text default null
) returns void language plpgsql security definer set search_path=''
as $$
begin
  if target_user_id is null or (actor_user_id is not null and target_user_id=actor_user_id) then return; end if;
  insert into public.notifications(user_id,actor_id,type,title,body,post_id,comment_id,friend_request_id,project_slug)
  values(target_user_id,actor_user_id,event_type,event_title,coalesce(event_body,''),target_post_id,target_comment_id,target_friend_request_id,target_project_slug);
end;
$$;
revoke all on function public.create_activity_notification(uuid,uuid,text,text,text,bigint,bigint,uuid,text) from public,anon,authenticated;

create or replace function public.notify_friend_request_activity()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if new.status='pending' and (tg_op='INSERT' or old.status is distinct from 'pending') then
    perform public.create_activity_notification(new.recipient_id,new.requester_id,'friend_request','Te envió una solicitud de amistad','',null,null,new.id,null);
  end if;
  return new;
end;
$$;
drop trigger if exists notify_friend_request_activity on public.friend_requests;
create trigger notify_friend_request_activity after insert or update of status on public.friend_requests
for each row execute function public.notify_friend_request_activity();

create or replace function public.notify_forum_post_like()
returns trigger language plpgsql security definer set search_path=''
as $$
declare post_owner uuid;
begin
  select user_id into post_owner from public.forum_posts where id=new.post_id;
  perform public.create_activity_notification(post_owner,new.user_id,'post_like','Le gustó tu publicación','',new.post_id,null,null,null);
  return new;
end;
$$;
drop trigger if exists notify_forum_post_like on public.forum_post_likes;
create trigger notify_forum_post_like after insert on public.forum_post_likes
for each row execute function public.notify_forum_post_like();

create or replace function public.notify_project_comment_like()
returns trigger language plpgsql security definer set search_path=''
as $$
declare comment_owner uuid; project_name text;
begin
  select user_id, project_slug into comment_owner, project_name from public.project_comments where id=new.comment_id;
  perform public.create_activity_notification(comment_owner,new.user_id,'comment_like','Le gustó tu comentario','',null,new.comment_id,null,project_name);
  return new;
end;
$$;
drop trigger if exists notify_project_comment_like on public.project_comment_likes;
create trigger notify_project_comment_like after insert on public.project_comment_likes
for each row execute function public.notify_project_comment_like();

create or replace function public.notify_project_comment_reply()
returns trigger language plpgsql security definer set search_path=''
as $$
declare parent_owner uuid;
begin
  if new.parent_comment_id is null then return new; end if;
  select user_id into parent_owner from public.project_comments where id=new.parent_comment_id;
  perform public.create_activity_notification(parent_owner,new.user_id,'comment_reply','Respondieron a tu comentario',left(new.content,180),null,new.id,null,new.project_slug);
  return new;
end;
$$;
drop trigger if exists notify_project_comment_reply on public.project_comments;
create trigger notify_project_comment_reply after insert on public.project_comments
for each row execute function public.notify_project_comment_reply();

create table if not exists public.forum_post_mentions (
  post_id bigint not null references public.forum_posts(id) on delete cascade,
  mentioned_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(post_id,mentioned_user_id)
);
create index if not exists forum_post_mentions_user_idx on public.forum_post_mentions(mentioned_user_id,created_at desc);
alter table public.forum_post_mentions enable row level security;
drop policy if exists "Post mentions are publicly readable" on public.forum_post_mentions;
create policy "Post mentions are publicly readable" on public.forum_post_mentions for select using(true);
drop policy if exists "Authors can tag users in their own posts" on public.forum_post_mentions;
create policy "Authors can tag users in their own posts" on public.forum_post_mentions for insert to authenticated
  with check(exists(select 1 from public.forum_posts p where p.id=post_id and p.user_id=(select auth.uid())));
grant select on public.forum_post_mentions to anon,authenticated;
grant insert on public.forum_post_mentions to authenticated;

create or replace function public.notify_forum_post_mention()
returns trigger language plpgsql security definer set search_path=''
as $$
declare post_owner uuid; post_body text;
begin
  select user_id,content_text into post_owner,post_body from public.forum_posts where id=new.post_id;
  perform public.create_activity_notification(new.mentioned_user_id,post_owner,'post_mention','Te mencionaron en una publicación',left(coalesce(post_body,''),180),new.post_id,null,null,null);
  return new;
end;
$$;
drop trigger if exists notify_forum_post_mention on public.forum_post_mentions;
create trigger notify_forum_post_mention after insert on public.forum_post_mentions
for each row execute function public.notify_forum_post_mention();

-- Tokens de cuentas Microsoft enlazadas: nunca son legibles desde el navegador.
create table if not exists public.microsoft_account_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  slot smallint not null check(slot between 1 and 3),
  microsoft_user_id text not null,
  email text,
  display_name text not null default 'Cuenta Microsoft',
  access_token_encrypted text not null,
  refresh_token_encrypted text,
  expires_at timestamptz,
  scopes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,slot),
  unique(user_id,microsoft_user_id)
);
alter table public.microsoft_account_connections enable row level security;
revoke all on public.microsoft_account_connections from anon,authenticated;

create table if not exists public.microsoft_oauth_states (
  state text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  slot smallint not null check(slot between 1 and 3),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
alter table public.microsoft_oauth_states enable row level security;
revoke all on public.microsoft_oauth_states from anon,authenticated;
