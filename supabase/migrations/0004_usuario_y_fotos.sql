-- Nombre de usuario (para ingresar sin correo) y foto de perfil.
--
-- El usuario es opcional y único sin distinguir mayúsculas. Se rellena para
-- las cuentas existentes con la parte local del correo, para que nadie quede
-- sin poder usar la opción nueva.
--
-- Las fotos viven en un bucket PRIVADO de Supabase Storage ("fotos"). No tiene
-- políticas para anon ni authenticated: nadie lo lee directo desde el
-- navegador. El servidor sube con la service role después de validar el
-- permiso, y entrega URLs firmadas de corta duración para mostrarlas. Importa
-- porque ahí también irán las fotos de los participantes, que son menores.

alter table profiles add column if not exists username text;
alter table profiles add column if not exists avatar_path text;

alter table profiles drop constraint if exists profiles_username_formato;
alter table profiles add constraint profiles_username_formato
  check (username is null or username ~ '^[a-z0-9][a-z0-9._-]{2,29}$');

create unique index if not exists profiles_username_unico on profiles (lower(username));

-- Relleno: parte local del correo, limpia; si choca con otra, se numera.
do $$
declare
  p record;
  base text;
  candidato text;
  n int;
begin
  for p in select id, email from profiles where username is null order by created_at loop
    base := lower(split_part(p.email, '@', 1));
    base := regexp_replace(base, '[^a-z0-9._-]', '', 'g');
    base := regexp_replace(base, '^[^a-z0-9]+', '');
    if length(base) < 3 then base := base || 'usr'; end if;
    base := left(base, 26);
    candidato := base;
    n := 1;
    while exists (select 1 from profiles where lower(username) = candidato) loop
      n := n + 1;
      candidato := base || n;
    end loop;
    update profiles set username = candidato where id = p.id;
  end loop;
end $$;

-- listar_usuarios devuelve también usuario y foto.
drop function if exists listar_usuarios();
create function listar_usuarios()
returns table (
  id uuid,
  email text,
  username text,
  full_name text,
  phone text,
  avatar_path text,
  role_id uuid,
  role_name text,
  role_is_system boolean,
  active boolean,
  must_change_password boolean,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select
    p.id, p.email, p.username, p.full_name, p.phone, p.avatar_path, p.role_id, r.name,
    coalesce(r.is_system, false), p.active, p.must_change_password,
    p.created_at, u.last_sign_in_at
  from profiles p
  left join roles r on r.id = p.role_id
  left join auth.users u on u.id = p.id
  where has_permission('usuarios.ver')
  order by lower(coalesce(nullif(p.full_name, ''), p.email));
$$;

revoke execute on function listar_usuarios() from public, anon;
grant execute on function listar_usuarios() to authenticated;

-- Bucket privado para fotos (usuarios y participantes). Límite de 2 MB y solo
-- imágenes: la aplicación ya las reduce antes de subirlas.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', false, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
