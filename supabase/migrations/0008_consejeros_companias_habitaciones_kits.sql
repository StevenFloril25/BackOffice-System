-- Consejeros, compañías, edificios con sus habitaciones y entrega de kits.
--
-- Es la estructura para organizar la sesión; aquí no se asigna a nadie. Una
-- compañía tiene un consejero y una consejera y un grupo de jóvenes (se reparten
-- después, por edades).
--
-- El alojamiento son edificios de mujeres o de hombres, con pisos. En cada piso
-- hay un dormitorio grande para los jóvenes y una habitación solo para líderes
-- (consejeros). Nombres, pisos y camas se administran desde el panel; aquí se
-- cargan los cuatro edificios que tiene hoy la sesión.
--
-- El kit se entrega al llegar: registrar la llegada lo marca solo (no hay
-- casilla aparte por ahora) y anularla lo deja pendiente otra vez.
--
-- Las reglas que no deben depender de la pantalla las cuida la base: el sexo de
-- cada lugar de la compañía, el sexo del edificio, quién va en cada tipo de
-- habitación y el cupo. Así ni un script ni dos personas asignando a la vez
-- dejan datos imposibles.

-- ---------------------------------------------------------------------------
-- Edificios y habitaciones
-- ---------------------------------------------------------------------------

create table if not exists edificios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(btrim(nombre)) >= 2),
  sexo text not null check (sexo in ('Hombre', 'Mujer')),
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists edificios_nombre_unico on edificios (lower(btrim(nombre)));

drop trigger if exists edificios_touch on edificios;
create trigger edificios_touch before update on edificios
  for each row execute function touch_updated_at();

create table if not exists habitaciones (
  id uuid primary key default gen_random_uuid(),
  -- cascade: quitar un edificio (o un piso) se lleva sus habitaciones, pero
  -- solo si están vacías: la llave de participantes y consejeros es restrict.
  edificio_id uuid not null references edificios(id) on delete cascade,
  piso int not null default 1 check (piso between 0 and 60),
  nombre text not null check (length(btrim(nombre)) >= 1),
  -- jovenes: el dormitorio del piso. lideres: donde duermen solo los consejeros.
  tipo text not null default 'jovenes' check (tipo in ('jovenes', 'lideres')),
  capacidad int not null check (capacidad between 1 and 60),
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists habitaciones_nombre_unico on habitaciones (edificio_id, piso, lower(btrim(nombre)));
create index if not exists habitaciones_edificio_idx on habitaciones(edificio_id, piso);

drop trigger if exists habitaciones_touch on habitaciones;
create trigger habitaciones_touch before update on habitaciones
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------------
-- Consejeros
-- ---------------------------------------------------------------------------

create table if not exists consejeros (
  id uuid primary key default gen_random_uuid(),
  nombres text not null check (length(btrim(nombres)) >= 2),
  apellidos text not null check (length(btrim(apellidos)) >= 2),
  -- Obligatorio: decide su lugar en la compañía y en qué edificio duerme.
  sexo text not null check (sexo in ('Hombre', 'Mujer')),
  fecha_nacimiento date,
  telefono text,
  correo text,
  -- Opcional: un consejero puede venir de una estaca que no inscribió jóvenes.
  barrio_id uuid references barrios(id) on delete restrict,
  talla_camiseta text,
  contacto_emergencia_nombre text,
  contacto_emergencia_telefono text,
  notas text,
  foto_path text,
  habitacion_id uuid references habitaciones(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists consejeros_habitacion_idx on consejeros(habitacion_id);

drop trigger if exists consejeros_touch on consejeros;
create trigger consejeros_touch before update on consejeros
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------------
-- Compañías
-- ---------------------------------------------------------------------------

create table if not exists companias (
  id uuid primary key default gen_random_uuid(),
  numero int not null check (numero between 1 and 999),
  nombre text not null default '',
  -- Un consejero no puede estar en dos compañías: unique en cada lugar (el sexo
  -- ya impide que el mismo esté como consejero en una y consejera en otra).
  consejero_id uuid unique references consejeros(id) on delete set null,
  consejera_id uuid unique references consejeros(id) on delete set null,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists companias_numero_unico on companias(numero);

drop trigger if exists companias_touch on companias;
create trigger companias_touch before update on companias
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------------
-- Participantes: compañía, habitación y kit
-- ---------------------------------------------------------------------------

-- restrict: borrar una compañía o una habitación con gente no la deja "sin
-- lugar" en silencio; la pantalla pide sacarlos primero.
alter table participantes add column if not exists compania_id uuid references companias(id) on delete restrict;
alter table participantes add column if not exists habitacion_id uuid references habitaciones(id) on delete restrict;
alter table participantes add column if not exists kit_entregado_at timestamptz;
alter table participantes add column if not exists kit_entregado_por uuid references profiles(id) on delete set null;

create index if not exists participantes_compania_idx on participantes(compania_id);
create index if not exists participantes_habitacion_idx on participantes(habitacion_id);

-- Los edificios de hoy: Abish y Esther (mujeres), Amón y Moroni (hombres), de 4
-- pisos con un dormitorio de 34 camas para jóvenes y una habitación de 4 para
-- líderes. Solo si todavía no hay edificios: si ya se cambiaron, no se tocan.
with nuevos as (
  insert into edificios (nombre, sexo)
  select v.nombre, v.sexo
  from (values ('Abish', 'Mujer'), ('Esther', 'Mujer'), ('Amón', 'Hombre'), ('Moroni', 'Hombre')) as v(nombre, sexo)
  where not exists (select 1 from edificios)
  returning id
)
insert into habitaciones (edificio_id, piso, nombre, tipo, capacidad)
select n.id, p.piso, t.nombre, t.tipo, t.capacidad
from nuevos n
cross join generate_series(1, 4) as p(piso)
cross join (values ('Jóvenes', 'jovenes', 34), ('Líderes', 'lideres', 4)) as t(nombre, tipo, capacidad);

-- ---------------------------------------------------------------------------
-- Reglas
-- ---------------------------------------------------------------------------

create or replace function etiqueta_sexo_plural(p_sexo text)
returns text
language sql
immutable
as $$ select case p_sexo when 'Mujer' then 'mujeres' when 'Hombre' then 'hombres' else 'sin sexo' end $$;

-- El lugar de consejero es de un hombre y el de consejera, de una mujer.
create or replace function validar_compania()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.consejero_id is not null
     and (select sexo from consejeros where id = new.consejero_id) is distinct from 'Hombre' then
    raise exception 'El consejero de la compañía tiene que ser hombre.';
  end if;
  if new.consejera_id is not null
     and (select sexo from consejeros where id = new.consejera_id) is distinct from 'Mujer' then
    raise exception 'La consejera de la compañía tiene que ser mujer.';
  end if;
  return new;
end;
$$;

drop trigger if exists companias_validar on companias;
create trigger companias_validar before insert or update of consejero_id, consejera_id on companias
  for each row execute function validar_compania();

-- Quien duerme en una habitación: sexo del edificio, tipo de habitación (los
-- jóvenes en el dormitorio, los consejeros en la de líderes) y cupo. Sirve para
-- participantes y consejeros (tienen las mismas columnas sexo y habitacion_id).
--
-- security definer: bloquea la fila de la habitación (FOR UPDATE) sin depender
-- de los permisos de quien asigna. El bloqueo hace que dos asignaciones a la
-- misma habitación esperen una a la otra, y la segunda cuente a la primera: no
-- pueden pasar las dos el último lugar.
create or replace function validar_habitacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hab habitaciones%rowtype;
  v_edificio edificios%rowtype;
  v_lugar text;
  v_ocupados int;
begin
  if new.habitacion_id is null then
    return new;
  end if;

  select * into v_hab from habitaciones where id = new.habitacion_id for update;
  select * into v_edificio from edificios where id = v_hab.edificio_id;
  v_lugar := format('%s, piso %s, %s', v_edificio.nombre, v_hab.piso, v_hab.nombre);

  if new.sexo is null then
    raise exception 'Indica si es hombre o mujer antes de asignarle una habitación.';
  end if;
  if new.sexo <> v_edificio.sexo then
    raise exception 'El edificio % es de %.', v_edificio.nombre, etiqueta_sexo_plural(v_edificio.sexo);
  end if;
  if tg_table_name = 'participantes' and v_hab.tipo <> 'jovenes' then
    raise exception '%: es la habitación de líderes; los jóvenes van al dormitorio del piso.', v_lugar;
  end if;
  if tg_table_name = 'consejeros' and v_hab.tipo <> 'lideres' then
    raise exception '%: es el dormitorio de los jóvenes; los consejeros van a la habitación de líderes.', v_lugar;
  end if;

  if tg_op = 'INSERT' or old.habitacion_id is distinct from new.habitacion_id then
    -- Las filas ya procesadas en la misma sentencia sí se ven aquí: asignar a
    -- varios de una vez también respeta el cupo.
    select (select count(*) from participantes where habitacion_id = v_hab.id)
         + (select count(*) from consejeros where habitacion_id = v_hab.id)
      into v_ocupados;
    if v_ocupados >= v_hab.capacidad then
      raise exception '%: ya está lleno (% de % camas).', v_lugar, v_ocupados, v_hab.capacidad;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists participantes_habitacion on participantes;
create trigger participantes_habitacion before insert or update of habitacion_id, sexo on participantes
  for each row execute function validar_habitacion();

drop trigger if exists consejeros_habitacion on consejeros;
create trigger consejeros_habitacion before insert or update of habitacion_id, sexo on consejeros
  for each row execute function validar_habitacion();

-- Cambiar el sexo de un consejero que ya ocupa el lugar del otro sexo en una
-- compañía dejaría la compañía inválida: primero se le quita de ahí.
create or replace function validar_sexo_consejero()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.sexo is distinct from old.sexo
     and exists (select 1 from companias where consejero_id = new.id or consejera_id = new.id) then
    raise exception 'Primero quítalo de su compañía: ahí ocupa el lugar de %.',
      case old.sexo when 'Hombre' then 'consejero' else 'consejera' end;
  end if;
  return new;
end;
$$;

drop trigger if exists consejeros_sexo on consejeros;
create trigger consejeros_sexo before update of sexo on consejeros
  for each row execute function validar_sexo_consejero();

-- Un edificio no cambia de sexo con gente adentro, y una habitación no se
-- achica, no cambia de tipo ni se muda de edificio por debajo de quienes ya
-- duermen ahí.
create or replace function validar_cambio_edificio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.sexo is distinct from old.sexo and (
       exists (select 1 from participantes p join habitaciones h on h.id = p.habitacion_id where h.edificio_id = new.id)
       or exists (select 1 from consejeros c join habitaciones h on h.id = c.habitacion_id where h.edificio_id = new.id)
     ) then
    raise exception 'El edificio % tiene gente asignada: sácala antes de cambiarlo de % a %.',
      new.nombre, etiqueta_sexo_plural(old.sexo), etiqueta_sexo_plural(new.sexo);
  end if;
  return new;
end;
$$;

drop trigger if exists edificios_validar on edificios;
create trigger edificios_validar before update of sexo on edificios
  for each row execute function validar_cambio_edificio();

create or replace function validar_cambio_habitacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ocupados int;
begin
  select (select count(*) from participantes where habitacion_id = new.id)
       + (select count(*) from consejeros where habitacion_id = new.id)
    into v_ocupados;
  if v_ocupados = 0 then
    return new;
  end if;
  if new.capacidad < v_ocupados then
    raise exception 'Hay % personas asignadas: el cupo no puede ser menor.', v_ocupados;
  end if;
  if new.tipo is distinct from old.tipo then
    raise exception 'Tiene gente asignada: sácala antes de cambiarla de tipo.';
  end if;
  if new.edificio_id is distinct from old.edificio_id
     and (select sexo from edificios where id = new.edificio_id) is distinct from (select sexo from edificios where id = old.edificio_id) then
    raise exception 'Tiene gente asignada: no puede pasar a un edificio de %.',
      etiqueta_sexo_plural((select sexo from edificios where id = new.edificio_id));
  end if;
  return new;
end;
$$;

drop trigger if exists habitaciones_validar on habitaciones;
create trigger habitaciones_validar before update of capacidad, tipo, edificio_id on habitaciones
  for each row execute function validar_cambio_habitacion();

-- Las funciones de disparador no se llaman directo.
revoke execute on function validar_compania(), validar_habitacion(), validar_sexo_consejero(),
  validar_cambio_edificio(), validar_cambio_habitacion() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Kit: se entrega con la llegada
-- ---------------------------------------------------------------------------

-- Las mismas funciones de 0007, más el kit. Devuelven la talla para que quien
-- registra sepa qué camiseta entregar.
create or replace function registrar_asistencia(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v participantes%rowtype;
  v_barrio barrios%rowtype;
  v_estado text;
  v_quien text;
begin
  if not has_permission('asistencia.registrar') then
    raise exception 'No tienes permiso para registrar asistencia' using errcode = '42501';
  end if;

  select * into v from participantes where qr_token = btrim(p_token);
  if not found then
    return jsonb_build_object('estado', 'no_encontrado');
  end if;
  select * into v_barrio from barrios where id = v.barrio_id;

  if v.asistio_at is not null then
    v_estado := 'ya_registrado';
  else
    update participantes
      set asistio_at = now(), asistencia_por = auth.uid(),
          kit_entregado_at = coalesce(kit_entregado_at, now()),
          kit_entregado_por = coalesce(kit_entregado_por, auth.uid())
      where id = v.id
      returning * into v;
    v_estado := 'registrado';
    insert into audit_log (actor_id, actor_email, action, entity, entity_id, summary)
    values (
      auth.uid(), (select email from profiles where id = auth.uid()),
      'asistencia.registrar', 'participante', v.id::text,
      'Registró la asistencia de ' || v.nombres || ' ' || v.apellidos
    );
  end if;

  select coalesce(nullif(full_name, ''), email) into v_quien from profiles where id = v.asistencia_por;

  return jsonb_build_object(
    'estado', v_estado,
    'participante', jsonb_build_object(
      'id', v.id,
      'nombres', v.nombres,
      'apellidos', v.apellidos,
      'nombre_preferido', v.nombre_preferido,
      'sexo', v.sexo,
      'fecha_nacimiento', v.fecha_nacimiento,
      'talla_camiseta', v.talla_camiseta,
      'foto_path', v.foto_path,
      'asistio_at', v.asistio_at,
      'kit_entregado_at', v.kit_entregado_at,
      'registrado_por', v_quien,
      'barrio', v_barrio.nombre,
      'estaca', v_barrio.estaca
    )
  );
end;
$$;

create or replace function marcar_asistencia(p_id uuid, p_asistio boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v participantes%rowtype;
begin
  if not has_permission('asistencia.registrar') then
    raise exception 'No tienes permiso para registrar asistencia' using errcode = '42501';
  end if;
  select * into v from participantes where id = p_id;
  if not found then
    raise exception 'El participante no existe';
  end if;

  if p_asistio and v.asistio_at is null then
    update participantes
      set asistio_at = now(), asistencia_por = auth.uid(),
          kit_entregado_at = coalesce(kit_entregado_at, now()),
          kit_entregado_por = coalesce(kit_entregado_por, auth.uid())
      where id = p_id;
  elsif not p_asistio and v.asistio_at is not null then
    -- Anular la llegada es corregir un error: el kit tampoco se entregó.
    update participantes
      set asistio_at = null, asistencia_por = null, kit_entregado_at = null, kit_entregado_por = null
      where id = p_id;
  else
    return;
  end if;

  insert into audit_log (actor_id, actor_email, action, entity, entity_id, summary)
  values (
    auth.uid(), (select email from profiles where id = auth.uid()),
    case when p_asistio then 'asistencia.registrar' else 'asistencia.anular' end,
    'participante', p_id::text,
    case when p_asistio then 'Registró a mano la asistencia de ' else 'Anuló la asistencia de ' end
      || v.nombres || ' ' || v.apellidos
  );
end;
$$;

-- Quienes ya llegaron antes de esta migración recibieron su kit al llegar.
update participantes
  set kit_entregado_at = asistio_at, kit_entregado_por = asistencia_por
  where asistio_at is not null and kit_entregado_at is null;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table edificios enable row level security;
alter table habitaciones enable row level security;
alter table consejeros enable row level security;
alter table companias enable row level security;

-- Quien arma compañías o habitaciones, o revisa los kits, necesita ver los
-- nombres de consejeros y jóvenes aunque no administre esos módulos.
drop policy if exists "consejeros_lectura" on consejeros;
create policy "consejeros_lectura" on consejeros for select to authenticated
  using (has_permission('consejeros.ver') or has_permission('companias.ver')
         or has_permission('habitaciones.ver') or has_permission('kits.ver'));
drop policy if exists "consejeros_crear" on consejeros;
create policy "consejeros_crear" on consejeros for insert to authenticated
  with check (has_permission('consejeros.crear'));
drop policy if exists "consejeros_editar" on consejeros;
create policy "consejeros_editar" on consejeros for update to authenticated
  using (has_permission('consejeros.editar')) with check (has_permission('consejeros.editar'));
drop policy if exists "consejeros_eliminar" on consejeros;
create policy "consejeros_eliminar" on consejeros for delete to authenticated
  using (has_permission('consejeros.eliminar'));

drop policy if exists "companias_lectura" on companias;
create policy "companias_lectura" on companias for select to authenticated
  using (has_permission('companias.ver') or has_permission('consejeros.ver')
         or has_permission('participantes.ver') or has_permission('habitaciones.ver') or has_permission('kits.ver'));
drop policy if exists "companias_crear" on companias;
create policy "companias_crear" on companias for insert to authenticated
  with check (has_permission('companias.crear'));
drop policy if exists "companias_editar" on companias;
create policy "companias_editar" on companias for update to authenticated
  using (has_permission('companias.editar')) with check (has_permission('companias.editar'));
drop policy if exists "companias_eliminar" on companias;
create policy "companias_eliminar" on companias for delete to authenticated
  using (has_permission('companias.eliminar'));

drop policy if exists "edificios_lectura" on edificios;
create policy "edificios_lectura" on edificios for select to authenticated
  using (has_permission('habitaciones.ver') or has_permission('consejeros.ver') or has_permission('participantes.ver'));
drop policy if exists "edificios_crear" on edificios;
create policy "edificios_crear" on edificios for insert to authenticated
  with check (has_permission('habitaciones.crear'));
drop policy if exists "edificios_editar" on edificios;
create policy "edificios_editar" on edificios for update to authenticated
  using (has_permission('habitaciones.editar')) with check (has_permission('habitaciones.editar'));
drop policy if exists "edificios_eliminar" on edificios;
create policy "edificios_eliminar" on edificios for delete to authenticated
  using (has_permission('habitaciones.eliminar'));

drop policy if exists "habitaciones_lectura" on habitaciones;
create policy "habitaciones_lectura" on habitaciones for select to authenticated
  using (has_permission('habitaciones.ver') or has_permission('consejeros.ver') or has_permission('participantes.ver'));
drop policy if exists "habitaciones_crear" on habitaciones;
create policy "habitaciones_crear" on habitaciones for insert to authenticated
  with check (has_permission('habitaciones.crear'));
drop policy if exists "habitaciones_editar" on habitaciones;
create policy "habitaciones_editar" on habitaciones for update to authenticated
  using (has_permission('habitaciones.editar')) with check (has_permission('habitaciones.editar'));
drop policy if exists "habitaciones_eliminar" on habitaciones;
create policy "habitaciones_eliminar" on habitaciones for delete to authenticated
  using (has_permission('habitaciones.eliminar'));

drop policy if exists "participantes_lectura" on participantes;
create policy "participantes_lectura" on participantes for select to authenticated
  using (has_permission('participantes.ver') or has_permission('asistencia.registrar')
         or has_permission('companias.ver') or has_permission('habitaciones.ver') or has_permission('kits.ver'));

-- Compañía, habitación, kit y foto solo cambian desde el servidor, después de
-- validar el permiso de cada acción. Desde el navegador, ni con "editar".
revoke all on edificios, habitaciones, consejeros, companias from anon;
revoke update on consejeros from authenticated;
grant update (
  nombres, apellidos, sexo, fecha_nacimiento, telefono, correo, barrio_id, talla_camiseta,
  contacto_emergencia_nombre, contacto_emergencia_telefono, notas
) on consejeros to authenticated;

-- ---------------------------------------------------------------------------
-- Catálogo de permisos (el admin los recibe solo; los demás roles, desde el panel)
-- ---------------------------------------------------------------------------

insert into modules (key, name, description, icon, sort_order) values
  ('consejeros', 'Consejeros', 'Consejeros y consejeras: datos, contacto, talla y foto.', 'heart-handshake', 32),
  ('companias', 'Compañías', 'Compañías con su consejero, su consejera y sus jóvenes.', 'flag', 34),
  ('habitaciones', 'Habitaciones', 'Edificios de mujeres y de hombres, sus pisos y habitaciones, y quién duerme en cada una.', 'bed-double', 36),
  ('kits', 'Entrega de kits', 'Quién ya recibió su kit (se marca al registrar la llegada) y qué tallas faltan.', 'package', 42)
on conflict (key) do update set
  name = excluded.name, description = excluded.description,
  icon = excluded.icon, sort_order = excluded.sort_order;

insert into permissions (key, module_key, action, label, description, sort_order) values
  ('consejeros.ver', 'consejeros', 'ver', 'Ver', 'Ver la lista y la ficha de cada consejero.', 10),
  ('consejeros.crear', 'consejeros', 'crear', 'Crear', 'Registrar consejeros.', 20),
  ('consejeros.editar', 'consejeros', 'editar', 'Editar', 'Cambiar datos y foto.', 30),
  ('consejeros.eliminar', 'consejeros', 'eliminar', 'Eliminar', 'Borrar consejeros.', 40),
  ('companias.ver', 'companias', 'ver', 'Ver', 'Ver las compañías, sus consejeros y sus jóvenes.', 10),
  ('companias.crear', 'companias', 'crear', 'Crear', 'Crear compañías.', 20),
  ('companias.editar', 'companias', 'editar', 'Editar y asignar', 'Cambiar el nombre y asignar consejeros y jóvenes.', 30),
  ('companias.eliminar', 'companias', 'eliminar', 'Eliminar', 'Borrar compañías vacías.', 40),
  ('habitaciones.ver', 'habitaciones', 'ver', 'Ver', 'Ver los edificios, sus habitaciones y quién duerme en cada una.', 10),
  ('habitaciones.crear', 'habitaciones', 'crear', 'Crear', 'Crear edificios, pisos y habitaciones.', 20),
  ('habitaciones.editar', 'habitaciones', 'editar', 'Editar y asignar', 'Cambiar nombres y camas y asignar a quién duerme en cada habitación.', 30),
  ('habitaciones.eliminar', 'habitaciones', 'eliminar', 'Eliminar', 'Borrar edificios, pisos y habitaciones vacías.', 40),
  ('kits.ver', 'kits', 'ver', 'Ver', 'Ver quién recibió su kit y las tallas pendientes.', 10)
on conflict (key) do update set
  label = excluded.label, description = excluded.description, sort_order = excluded.sort_order;
