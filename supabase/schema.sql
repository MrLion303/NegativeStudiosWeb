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


-- Emblemas públicos. Las escrituras se realizan exclusivamente mediante RPC protegidos.
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

-- Registro privado de administradores; se inicializa con mrlion303 si su perfil ya existe.
create table if not exists public.site_admins (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.site_admins enable row level security;
revoke all on public.site_admins from anon, authenticated;
insert into public.site_admins(user_id)
select id from public.profiles where lower(username) = 'mrlion303'
on conflict (user_id) do nothing;

create or replace function public.set_profile_badges(target_profile_id uuid, mod_enabled boolean, verified_enabled boolean)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not exists(select 1 from public.site_admins where user_id = auth.uid()) then
    raise exception 'No tienes permiso para administrar badges.' using errcode = '42501';
  end if;
  if not exists(select 1 from public.profiles where id = target_profile_id) then
    raise exception 'No se encontró el perfil indicado.';
  end if;
  if coalesce(mod_enabled,false) = false and coalesce(verified_enabled,false) = false then
    delete from public.profile_badges where user_id = target_profile_id;
  else
    insert into public.profile_badges(user_id,is_mod,is_verified,updated_at)
    values(target_profile_id,coalesce(mod_enabled,false),coalesce(verified_enabled,false),now())
    on conflict(user_id) do update set is_mod=excluded.is_mod,is_verified=excluded.is_verified,updated_at=now();
  end if;
end;
$$;
revoke all on function public.set_profile_badges(uuid,boolean,boolean) from public, anon;
grant execute on function public.set_profile_badges(uuid,boolean,boolean) to authenticated;


-- La autorización se comprueba en el servidor antes de borrar comentarios ajenos.
create or replace function public.moderator_delete_project_comment(target_comment_id bigint)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.profile_badges where user_id = auth.uid() and is_mod = true
  ) then
    raise exception 'Necesitas el badge de moderador para eliminar comentarios de otras personas.'
      using errcode = '42501';
  end if;
  delete from public.project_comments where id = target_comment_id;
  if not found then raise exception 'No se encontró el comentario o ya fue eliminado.'; end if;
end;
$$;
revoke all on function public.moderator_delete_project_comment(bigint) from public, anon;
grant execute on function public.moderator_delete_project_comment(bigint) to authenticated;
