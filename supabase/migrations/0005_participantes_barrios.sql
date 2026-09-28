-- Participantes de la conferencia, barrios con su obispo y asistencia por QR.
--
-- Los datos vienen de la exportación del sistema de inscripción (Excel) y se
-- pueden volver a importar: cada participante lleva una clave de importación
-- (nombres + apellidos + fecha de nacimiento, normalizados) para actualizarlo
-- en lugar de duplicarlo. Los adjuntos del Excel no se guardan.
--
-- La información de salud va en su propia tabla con su propio permiso: son
-- datos médicos de menores y no los necesita todo el que ve la lista.

-- ---------------------------------------------------------------------------
-- Barrios
-- ---------------------------------------------------------------------------

create table if not exists barrios (
  id uuid primary key default gen_random_uuid(),
  estaca text not null default '',
  nombre text not null check (length(btrim(nombre)) >= 2),
  obispo_nombre text not null default '',
  obispo_correo text,
  obispo_telefono text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Un barrio se repite en el Excel una vez por joven: la unicidad por estaca +
-- nombre es lo que evita crearlo 20 veces al importar.
create unique index if not exists barrios_unico on barrios (lower(estaca), lower(nombre));

drop trigger if exists barrios_touch on barrios;
create trigger barrios_touch before update on barrios
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------------
-- Participantes
-- ---------------------------------------------------------------------------

create table if not exists participantes (
  id uuid primary key default gen_random_uuid(),
  nombres text not null,
  apellidos text not null,
  nombre_preferido text not null default '',
  fecha_nacimiento date,
  sexo text check (sexo in ('Hombre', 'Mujer')),
  telefono text,
  correo text,
  talla_camiseta text,
  contacto1_nombre text,
  contacto1_correo text,
  contacto1_telefono text,
  contacto2_nombre text,
  contacto2_correo text,
  contacto2_telefono text,
  -- La edad que declaró al inscribirse; la actual se calcula con la fecha de nacimiento.
  edad_inscripcion int,
  fecha_inscripcion timestamptz,
  estado_inscripcion text not null default 'Pendiente de aprobación'
    check (estado_inscripcion in ('Aprobado', 'Pendiente de aprobación', 'Cancelado')),
  tipo text not null default 'Participante',
  barrio_id uuid references barrios(id) on delete restrict,
  foto_path text,
  -- Lo que lleva el QR. Aleatorio (122 bits) para que no se pueda adivinar ni
  -- fabricar el de otra persona.
  qr_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  asistio_at timestamptz,
  asistencia_por uuid references profiles(id) on delete set null,
  origen text not null default 'manual' check (origen in ('manual', 'importacion')),
  clave_importacion text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists participantes_barrio_idx on participantes(barrio_id);

drop trigger if exists participantes_touch on participantes;
create trigger participantes_touch before update on participantes
  for each row execute function touch_updated_at();

create table if not exists participantes_salud (
  participante_id uuid primary key references participantes(id) on delete cascade,
  informacion_medica text,
  informacion_alimentaria text,
  grupo_sanguineo text,
  alergias text,
  tratamiento_medico text,
  diabetes_asma text,
  seguro_medico text,
  updated_at timestamptz not null default now()
);

drop trigger if exists participantes_salud_touch on participantes_salud;
create trigger participantes_salud_touch before update on participantes_salud
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table barrios enable row level security;
alter table participantes enable row level security;
alter table participantes_salud enable row level security;

drop policy if exists "barrios_lectura" on barrios;
create policy "barrios_lectura" on barrios for select to authenticated
  using (has_permission('barrios.ver') or has_permission('participantes.ver') or has_permission('asistencia.registrar'));
drop policy if exists "barrios_crear" on barrios;
create policy "barrios_crear" on barrios for insert to authenticated
  with check (has_permission('barrios.crear'));
drop policy if exists "barrios_editar" on barrios;
create policy "barrios_editar" on barrios for update to authenticated
  using (has_permission('barrios.editar')) with check (has_permission('barrios.editar'));
drop policy if exists "barrios_eliminar" on barrios;
create policy "barrios_eliminar" on barrios for delete to authenticated
  using (has_permission('barrios.eliminar'));

drop policy if exists "participantes_lectura" on participantes;
create policy "participantes_lectura" on participantes for select to authenticated
  using (has_permission('participantes.ver') or has_permission('asistencia.registrar'));
drop policy if exists "participantes_crear" on participantes;
create policy "participantes_crear" on participantes for insert to authenticated
  with check (has_permission('participantes.crear'));
drop policy if exists "participantes_editar" on participantes;
create policy "participantes_editar" on participantes for update to authenticated
  using (has_permission('participantes.editar')) with check (has_permission('participantes.editar'));
drop policy if exists "participantes_eliminar" on participantes;
create policy "participantes_eliminar" on participantes for delete to authenticated
  using (has_permission('participantes.eliminar'));

drop policy if exists "salud_lectura" on participantes_salud;
create policy "salud_lectura" on participantes_salud for select to authenticated
  using (has_permission('participantes.salud'));
drop policy if exists "salud_escritura" on participantes_salud;
create policy "salud_escritura" on participantes_salud for all to authenticated
  using (has_permission('participantes.salud') and has_permission('participantes.editar'))
  with check (has_permission('participantes.salud') and has_permission('participantes.editar'));

-- La asistencia, el token del QR, la foto y la clave de importación solo
-- cambian por las funciones de abajo o por el servidor, no desde el navegador
-- aunque se tenga participantes.editar. Quitar columnas sueltas no alcanza
-- (el permiso sobre la tabla completa las incluye): se quita UPDATE entero y
-- se devuelve solo sobre las columnas editables.
revoke all on barrios, participantes, participantes_salud from anon;
revoke update on participantes from authenticated;
grant update (
  nombres, apellidos, nombre_preferido, fecha_nacimiento, sexo, telefono, correo,
  talla_camiseta, contacto1_nombre, contacto1_correo, contacto1_telefono,
  contacto2_nombre, contacto2_correo, contacto2_telefono, edad_inscripcion,
  estado_inscripcion, tipo, barrio_id
) on participantes to authenticated;

-- ---------------------------------------------------------------------------
-- Asistencia
-- ---------------------------------------------------------------------------

-- Lee el QR (token) y marca la asistencia. Devuelve qué pasó para que la
-- pantalla lo muestre: registrado, ya estaba, cancelado o no existe. Una
-- inscripción cancelada no se registra sola: que lo decida una persona.
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

  if v.estado_inscripcion = 'Cancelado' then
    v_estado := 'cancelado';
  elsif v.asistio_at is not null then
    v_estado := 'ya_registrado';
  else
    update participantes
      set asistio_at = now(), asistencia_por = auth.uid()
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
      'estado_inscripcion', v.estado_inscripcion,
      'talla_camiseta', v.talla_camiseta,
      'foto_path', v.foto_path,
      'asistio_at', v.asistio_at,
      'registrado_por', v_quien,
      'barrio', v_barrio.nombre,
      'estaca', v_barrio.estaca
    )
  );
end;
$$;

-- Marcar o desmarcar a mano (búsqueda por nombre cuando no trae el QR, o para
-- corregir un error).
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
    update participantes set asistio_at = now(), asistencia_por = auth.uid() where id = p_id;
  elsif not p_asistio and v.asistio_at is not null then
    update participantes set asistio_at = null, asistencia_por = null where id = p_id;
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

revoke execute on function registrar_asistencia(text) from public, anon;
revoke execute on function marcar_asistencia(uuid, boolean) from public, anon;
grant execute on function registrar_asistencia(text) to authenticated;
grant execute on function marcar_asistencia(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Catálogo de permisos (el admin los recibe solo; los demás roles, desde el panel)
-- ---------------------------------------------------------------------------

insert into modules (key, name, description, icon, sort_order) values
  ('participantes', 'Participantes', 'Jóvenes inscritos: datos, contactos, foto y QR.', 'id-card', 30),
  ('asistencia', 'Asistencia', 'Registro de llegada con el lector de QR.', 'scan-line', 40),
  ('barrios', 'Barrios', 'Barrios y ramas con el contacto de su obispo.', 'church', 50)
on conflict (key) do update set
  name = excluded.name, description = excluded.description,
  icon = excluded.icon, sort_order = excluded.sort_order;

insert into permissions (key, module_key, action, label, description, sort_order) values
  ('participantes.ver', 'participantes', 'ver', 'Ver', 'Ver la lista y la ficha de cada participante.', 10),
  ('participantes.crear', 'participantes', 'crear', 'Crear', 'Registrar participantes a mano.', 20),
  ('participantes.editar', 'participantes', 'editar', 'Editar', 'Cambiar datos, barrio, estado y foto.', 30),
  ('participantes.eliminar', 'participantes', 'eliminar', 'Eliminar', 'Borrar participantes.', 40),
  ('participantes.importar', 'participantes', 'importar', 'Importar', 'Cargar o actualizar la lista desde el Excel de inscripción.', 50),
  ('participantes.salud', 'participantes', 'salud', 'Datos médicos', 'Ver la información médica, alergias, tipo de sangre y seguro.', 60),
  ('asistencia.registrar', 'asistencia', 'registrar', 'Registrar', 'Leer QR y marcar o anular la asistencia.', 10),
  ('barrios.ver', 'barrios', 'ver', 'Ver', 'Ver los barrios y el contacto del obispo.', 10),
  ('barrios.crear', 'barrios', 'crear', 'Crear', 'Agregar barrios.', 20),
  ('barrios.editar', 'barrios', 'editar', 'Editar', 'Cambiar el nombre del barrio y los datos del obispo.', 30),
  ('barrios.eliminar', 'barrios', 'eliminar', 'Eliminar', 'Borrar barrios sin participantes.', 40)
on conflict (key) do update set
  label = excluded.label, description = excluded.description, sort_order = excluded.sort_order;
