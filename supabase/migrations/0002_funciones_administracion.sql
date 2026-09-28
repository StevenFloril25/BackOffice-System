-- Operaciones de administración como funciones de la base.
--
-- Guardar un rol toca dos tablas (roles y role_permissions) y la bitácora. Si
-- se hiciera desde la aplicación en varias llamadas, un fallo a mitad dejaría
-- un rol sin permisos o con la mitad. Acá corre en una sola transacción, y la
-- autorización se valida con la sesión real (auth.uid()), no con la palabra
-- de quien llama.

-- Dos roles con el mismo nombre son indistinguibles en el selector de rol.
create unique index if not exists roles_nombre_unico on roles (lower(name));

create or replace function slug_rol(texto text)
returns text
language sql
immutable
as $$
  select coalesce(nullif(trim(both '-' from regexp_replace(
    translate(lower(texto), 'áàäâéèëêíìïîóòöôúùüûñç', 'aaaaeeeeiiiioooouuuunc'),
    '[^a-z0-9]+', '-', 'g'
  )), ''), 'rol');
$$;

create or replace function guardar_rol(
  p_id uuid,
  p_nombre text,
  p_descripcion text,
  p_permisos text[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := p_id;
  v_base text;
  v_key text;
  v_n int := 1;
  v_desconocidos text[];
  v_antes text[] := '{}';
  v_actor_email text;
begin
  p_nombre := btrim(coalesce(p_nombre, ''));
  p_descripcion := btrim(coalesce(p_descripcion, ''));
  p_permisos := coalesce(p_permisos, '{}');

  if length(p_nombre) < 2 or length(p_nombre) > 60 then
    raise exception 'El nombre del rol debe tener entre 2 y 60 caracteres';
  end if;

  select array_agg(x) into v_desconocidos
  from unnest(p_permisos) x
  where not exists (select 1 from permissions pe where pe.key = x);
  if v_desconocidos is not null then
    raise exception 'Permisos desconocidos: %', array_to_string(v_desconocidos, ', ');
  end if;

  if exists (
    select 1 from roles r
    where lower(r.name) = lower(p_nombre) and r.id is distinct from v_id
  ) then
    raise exception 'Ya existe un rol llamado "%"', p_nombre;
  end if;

  if v_id is null then
    if not has_permission('roles.crear') then
      raise exception 'No tienes permiso para crear roles' using errcode = '42501';
    end if;
    v_base := slug_rol(p_nombre);
    v_key := v_base;
    while exists (select 1 from roles where key = v_key) loop
      v_n := v_n + 1;
      v_key := v_base || '-' || v_n;
    end loop;
    insert into roles (key, name, description)
    values (v_key, p_nombre, p_descripcion)
    returning id into v_id;
  else
    if not has_permission('roles.editar') then
      raise exception 'No tienes permiso para editar roles' using errcode = '42501';
    end if;
    if not exists (select 1 from roles where id = v_id) then
      raise exception 'El rol no existe';
    end if;
    if exists (select 1 from roles where id = v_id and is_system) then
      raise exception 'El rol de sistema no se puede modificar';
    end if;
    -- Sin esto, quien tiene roles.editar podría darse a sí mismo cualquier
    -- permiso editando su propio rol.
    if not is_admin() and v_id = current_role_id() then
      raise exception 'No puedes modificar los permisos de tu propio rol';
    end if;

    select coalesce(array_agg(permission_key order by permission_key), '{}')
      into v_antes
      from role_permissions where role_id = v_id;

    update roles set name = p_nombre, description = p_descripcion where id = v_id;
    delete from role_permissions where role_id = v_id;
  end if;

  insert into role_permissions (role_id, permission_key)
  select v_id, x from unnest(p_permisos) x
  on conflict do nothing;

  select email into v_actor_email from profiles where id = auth.uid();
  insert into audit_log (actor_id, actor_email, action, entity, entity_id, summary, details)
  values (
    auth.uid(),
    v_actor_email,
    case when p_id is null then 'rol.crear' else 'rol.editar' end,
    'rol',
    v_id::text,
    case when p_id is null then 'Creó el rol ' else 'Editó el rol ' end || p_nombre,
    jsonb_build_object('permisos', to_jsonb(p_permisos), 'antes', to_jsonb(v_antes))
  );

  return v_id;
end;
$$;

create or replace function eliminar_rol(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol roles%rowtype;
  v_usuarios int;
begin
  if not has_permission('roles.eliminar') then
    raise exception 'No tienes permiso para eliminar roles' using errcode = '42501';
  end if;

  select * into v_rol from roles where id = p_id;
  if not found then
    raise exception 'El rol no existe';
  end if;
  if v_rol.is_system then
    raise exception 'El rol de sistema no se puede eliminar';
  end if;

  select count(*) into v_usuarios from profiles where role_id = p_id;
  if v_usuarios > 0 then
    raise exception 'El rol tiene % usuario(s) asignado(s). Reasígnalos antes de eliminarlo', v_usuarios;
  end if;

  delete from roles where id = p_id;

  insert into audit_log (actor_id, actor_email, action, entity, entity_id, summary)
  values (
    auth.uid(),
    (select email from profiles where id = auth.uid()),
    'rol.eliminar', 'rol', p_id::text, 'Eliminó el rol ' || v_rol.name
  );
end;
$$;

-- El usuario termina su primer ingreso: la marca de "debe cambiar la
-- contraseña" solo la puede apagar él mismo, y solo sobre su propia fila.
create or replace function marcar_clave_cambiada()
returns void
language sql
security definer
set search_path = public
as $$
  update profiles set must_change_password = false where id = auth.uid();
$$;

-- Listado de usuarios con su último ingreso, que vive en auth.users y no es
-- accesible desde la API. Devuelve cero filas a quien no tiene usuarios.ver.
create or replace function listar_usuarios()
returns table (
  id uuid,
  email text,
  full_name text,
  phone text,
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
    p.id, p.email, p.full_name, p.phone, p.role_id, r.name,
    coalesce(r.is_system, false), p.active, p.must_change_password,
    p.created_at, u.last_sign_in_at
  from profiles p
  left join roles r on r.id = p.role_id
  left join auth.users u on u.id = p.id
  where has_permission('usuarios.ver')
  order by lower(coalesce(nullif(p.full_name, ''), p.email));
$$;

-- Roles con cuántos usuarios y permisos tiene cada uno. Quien solo tiene
-- roles.ver no puede leer los perfiles ajenos, y sin esto no sabría cuántas
-- personas afecta un cambio de permisos.
create or replace function resumen_roles()
returns table (
  id uuid,
  key text,
  name text,
  description text,
  is_system boolean,
  usuarios int,
  usuarios_activos int,
  permisos int
)
language sql
security definer
stable
set search_path = public
as $$
  select
    r.id, r.key, r.name, r.description, r.is_system,
    (select count(*)::int from profiles p where p.role_id = r.id),
    (select count(*)::int from profiles p where p.role_id = r.id and p.active),
    case when r.is_system then (select count(*)::int from permissions)
         else (select count(*)::int from role_permissions rp where rp.role_id = r.id) end
  from roles r
  where has_permission('roles.ver')
  order by r.is_system desc, lower(r.name);
$$;

revoke execute on function resumen_roles() from public, anon;
grant execute on function resumen_roles() to authenticated;

revoke execute on function guardar_rol(uuid, text, text, text[]) from public, anon;
revoke execute on function eliminar_rol(uuid) from public, anon;
revoke execute on function marcar_clave_cambiada() from public, anon;
revoke execute on function listar_usuarios() from public, anon;
grant execute on function guardar_rol(uuid, text, text, text[]) to authenticated;
grant execute on function eliminar_rol(uuid) to authenticated;
grant execute on function marcar_clave_cambiada() to authenticated;
grant execute on function listar_usuarios() to authenticated;
