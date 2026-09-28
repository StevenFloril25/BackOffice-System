-- Base del BackOffice: perfiles de usuario, roles y permisos por módulo.
--
-- Los permisos NO son columnas de una tabla (así lo hace el TechyWe Hub y cada
-- permiso nuevo exigía una migración que agregara una columna, y además nacía
-- en false para el admin). Acá son filas de un catálogo módulo + acción: cada
-- módulo que se construya después agrega sus filas a `modules` y `permissions`
-- en su propia migración, y el panel de roles las muestra solo.
--
-- El rol de sistema (`admin`) no guarda permisos: `has_permission()` le
-- devuelve true a todo. Así un permiso nuevo nunca queda fuera de su alcance.

-- ---------------------------------------------------------------------------
-- Catálogo de módulos y permisos
-- ---------------------------------------------------------------------------

create table if not exists modules (
  key text primary key,
  name text not null,
  description text not null default '',
  -- Nombre del ícono de lucide-react que usa el menú y el panel de roles.
  icon text not null default 'square',
  sort_order int not null default 0
);

create table if not exists permissions (
  key text primary key,
  module_key text not null references modules(key) on delete cascade,
  action text not null,
  label text not null,
  description text not null default '',
  sort_order int not null default 0,
  unique (module_key, action),
  -- La clave es siempre "<módulo>.<acción>": el código la escribe así y no
  -- queremos que una fila mal cargada cree un permiso inalcanzable.
  check (key = module_key || '.' || action)
);

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------

create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z0-9][a-z0-9_-]*$'),
  name text not null,
  description text not null default '',
  -- Rol protegido: no se edita ni se borra. Es la red anti-bloqueo; mientras
  -- exista un usuario activo con este rol, nadie pierde la administración.
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists role_permissions (
  role_id uuid not null references roles(id) on delete cascade,
  permission_key text not null references permissions(key) on delete cascade,
  primary key (role_id, permission_key)
);

-- ---------------------------------------------------------------------------
-- Perfiles (1:1 con auth.users)
-- ---------------------------------------------------------------------------

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null default '',
  phone text,
  role_id uuid references roles(id) on delete set null,
  active boolean not null default true,
  -- El admin crea la cuenta con una contraseña temporal: al primer ingreso se
  -- obliga a cambiarla para que el admin no conozca la credencial de nadie.
  must_change_password boolean not null default false,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on profiles(role_id);

-- ---------------------------------------------------------------------------
-- Bitácora de acciones administrativas
-- ---------------------------------------------------------------------------

create table if not exists audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references profiles(id) on delete set null,
  actor_email text,
  action text not null,
  entity text not null,
  entity_id text,
  summary text not null default '',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_created_idx on audit_log(created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------------

create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists roles_touch on roles;
create trigger roles_touch before update on roles
  for each row execute function touch_updated_at();

drop trigger if exists profiles_touch on profiles;
create trigger profiles_touch before update on profiles
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------------
-- Funciones de autorización (usadas por RLS y por la aplicación vía RPC)
-- ---------------------------------------------------------------------------

create or replace function current_role_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select p.role_id from profiles p where p.id = auth.uid() and p.active;
$$;

create or replace function is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((
    select r.is_system
    from profiles p join roles r on r.id = p.role_id
    where p.id = auth.uid() and p.active
  ), false);
$$;

create or replace function has_permission(perm text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select is_admin() or exists (
    select 1
    from profiles p
    join role_permissions rp on rp.role_id = p.role_id
    where p.id = auth.uid() and p.active and rp.permission_key = perm
  );
$$;

-- Permisos efectivos del usuario de la sesión, en una sola ida y vuelta. Para
-- el admin devuelve el catálogo completo. Devuelve un arreglo (y no un
-- conjunto de filas) para que la RPC entregue una lista plana de claves.
create or replace function my_permissions()
returns text[]
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(array_agg(distinct k order by k), '{}')
  from (
    select pe.key as k from permissions pe where is_admin()
    union
    select rp.permission_key
    from profiles p join role_permissions rp on rp.role_id = p.role_id
    where p.id = auth.uid() and p.active
  ) t;
$$;

-- Postgres le da EXECUTE a PUBLIC por defecto: quitarlo solo de anon no
-- alcanza, porque anon lo sigue heredando de PUBLIC.
revoke execute on function current_role_id() from public, anon;
revoke execute on function is_admin() from public, anon;
revoke execute on function has_permission(text) from public, anon;
revoke execute on function my_permissions() from public, anon;
grant execute on function current_role_id() to authenticated, service_role;
grant execute on function is_admin() to authenticated, service_role;
grant execute on function has_permission(text) to authenticated, service_role;
grant execute on function my_permissions() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Protecciones
-- ---------------------------------------------------------------------------

-- El rol de sistema no se toca ni por un bug en la aplicación.
create or replace function protect_system_role()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' and old.is_system then
    raise exception 'El rol "%" es del sistema y no se puede eliminar', old.name;
  end if;
  if tg_op = 'UPDATE' and old.is_system then
    raise exception 'El rol "%" es del sistema y no se puede modificar', old.name;
  end if;
  if tg_op = 'UPDATE' and new.is_system and not old.is_system then
    raise exception 'No se puede convertir un rol en rol de sistema';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists protect_system_role_trigger on roles;
create trigger protect_system_role_trigger
  before update or delete on roles
  for each row execute function protect_system_role();

-- Siempre tiene que quedar al menos un administrador activo. Solo se revisa
-- cuando la fila que cambió ERA un admin activo: así cubre desactivar, cambiar
-- de rol y borrar (también en cascada desde auth.users), pero no bloquea nada
-- mientras todavía no existe el primer admin.
create or replace function ensure_active_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.active
     and exists (select 1 from roles r where r.id = old.role_id and r.is_system)
     and not exists (
       select 1 from profiles p join roles r on r.id = p.role_id
       where r.is_system and p.active
     )
  then
    raise exception 'Debe quedar al menos un administrador activo';
  end if;
  return null;
end;
$$;

drop trigger if exists ensure_active_admin_trigger on profiles;
create constraint trigger ensure_active_admin_trigger
  after update or delete on profiles
  deferrable initially deferred
  for each row execute function ensure_active_admin();

-- Perfil automático para cada usuario de Auth. El rol sale de app_metadata
-- (solo lo puede escribir la service role), NUNCA de user_metadata, que el
-- propio usuario controla y permitiría autoasignarse admin.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role uuid;
begin
  select id into v_role from roles where key = new.raw_app_meta_data ->> 'role_key';

  insert into profiles (id, email, full_name, role_id, must_change_password, created_by)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    v_role,
    coalesce((new.raw_app_meta_data ->> 'must_change_password')::boolean, false),
    nullif(new.raw_app_meta_data ->> 'created_by', '')::uuid
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table modules enable row level security;
alter table permissions enable row level security;
alter table roles enable row level security;
alter table role_permissions enable row level security;
alter table profiles enable row level security;
alter table audit_log enable row level security;

-- Catálogo: lectura para cualquier sesión; se modifica solo por migración.
drop policy if exists "catalogo_lectura" on modules;
create policy "catalogo_lectura" on modules for select to authenticated using (true);
drop policy if exists "catalogo_lectura" on permissions;
create policy "catalogo_lectura" on permissions for select to authenticated using (true);

-- Roles: cada quien ve el suyo; quien administra usuarios o roles ve todos.
drop policy if exists "roles_lectura" on roles;
create policy "roles_lectura" on roles for select to authenticated
  using (id = current_role_id() or has_permission('roles.ver') or has_permission('usuarios.ver'));
drop policy if exists "roles_crear" on roles;
create policy "roles_crear" on roles for insert to authenticated
  with check (has_permission('roles.crear') and not is_system);
drop policy if exists "roles_editar" on roles;
create policy "roles_editar" on roles for update to authenticated
  using (has_permission('roles.editar')) with check (has_permission('roles.editar'));
drop policy if exists "roles_eliminar" on roles;
create policy "roles_eliminar" on roles for delete to authenticated
  using (has_permission('roles.eliminar'));

drop policy if exists "role_permissions_lectura" on role_permissions;
create policy "role_permissions_lectura" on role_permissions for select to authenticated
  using (role_id = current_role_id() or has_permission('roles.ver'));
drop policy if exists "role_permissions_gestion" on role_permissions;
create policy "role_permissions_gestion" on role_permissions for all to authenticated
  using (
    has_permission('roles.editar')
    and not exists (select 1 from roles r where r.id = role_id and r.is_system)
  )
  with check (
    has_permission('roles.editar')
    and not exists (select 1 from roles r where r.id = role_id and r.is_system)
  );

-- Perfiles: lectura propia o con permiso. Escribir desde el navegador se
-- limita a nombre y teléfono (grant por columna más abajo): rol, estado y
-- altas pasan por acciones del servidor que validan el permiso.
drop policy if exists "profiles_lectura" on profiles;
create policy "profiles_lectura" on profiles for select to authenticated
  using (id = auth.uid() or has_permission('usuarios.ver'));
drop policy if exists "profiles_editar" on profiles;
create policy "profiles_editar" on profiles for update to authenticated
  using (id = auth.uid() or has_permission('usuarios.editar'))
  with check (id = auth.uid() or has_permission('usuarios.editar'));

revoke insert, update, delete on profiles from anon, authenticated;
grant update (full_name, phone) on profiles to authenticated;

-- Bitácora: solo lectura con permiso; se escribe desde el servidor.
drop policy if exists "audit_lectura" on audit_log;
create policy "audit_lectura" on audit_log for select to authenticated
  using (has_permission('auditoria.ver'));
revoke insert, update, delete on audit_log from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Datos iniciales
-- ---------------------------------------------------------------------------

insert into modules (key, name, description, icon, sort_order) values
  ('usuarios', 'Usuarios', 'Cuentas de acceso al sistema: altas, datos, rol y estado.', 'users', 10),
  ('roles', 'Roles y permisos', 'Roles del sistema y lo que cada uno puede hacer en cada módulo.', 'shield-check', 20),
  ('auditoria', 'Bitácora', 'Registro de las acciones administrativas.', 'history', 90)
on conflict (key) do update set
  name = excluded.name, description = excluded.description,
  icon = excluded.icon, sort_order = excluded.sort_order;

insert into permissions (key, module_key, action, label, description, sort_order) values
  ('usuarios.ver', 'usuarios', 'ver', 'Ver', 'Ver el listado de usuarios y su detalle.', 10),
  ('usuarios.crear', 'usuarios', 'crear', 'Crear', 'Dar de alta usuarios nuevos.', 20),
  ('usuarios.editar', 'usuarios', 'editar', 'Editar', 'Cambiar datos, rol, estado y contraseña de otros usuarios.', 30),
  ('usuarios.eliminar', 'usuarios', 'eliminar', 'Eliminar', 'Borrar usuarios de forma definitiva.', 40),
  ('roles.ver', 'roles', 'ver', 'Ver', 'Ver los roles y sus permisos.', 10),
  ('roles.crear', 'roles', 'crear', 'Crear', 'Crear roles nuevos.', 20),
  ('roles.editar', 'roles', 'editar', 'Editar', 'Cambiar el nombre y los permisos de un rol.', 30),
  ('roles.eliminar', 'roles', 'eliminar', 'Eliminar', 'Eliminar roles que no tengan usuarios.', 40),
  ('auditoria.ver', 'auditoria', 'ver', 'Ver', 'Consultar la bitácora de acciones.', 10)
on conflict (key) do update set
  label = excluded.label, description = excluded.description, sort_order = excluded.sort_order;

insert into roles (key, name, description, is_system) values
  ('admin', 'Administrador', 'Acceso total a todos los módulos, presentes y futuros. No se puede editar ni eliminar.', true),
  ('consulta', 'Consulta', 'Puede ver usuarios y roles, sin modificar nada.', false)
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_key)
select r.id, p.key
from roles r cross join permissions p
where r.key = 'consulta' and p.key in ('usuarios.ver', 'roles.ver')
on conflict do nothing;
