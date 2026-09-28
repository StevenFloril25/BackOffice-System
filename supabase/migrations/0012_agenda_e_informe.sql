-- Agenda de la sesión e informe final.
--
-- Agenda: el horario sugerido de la guía de planificación FSY 2025-26 (págs.
-- 31-36), días 0 al 6, con la ropa de cada día. Se carga una sola vez y después
-- se administra desde el panel. La ven también consejeros y coordinadores.
--
-- Informe final: lo que el matrimonio director envía al matrimonio asesor en el
-- Área al terminar la sesión (guía, pág. 5). Los conteos salen del sistema; aquí
-- se guarda lo que no: testimonios, fotografías (con nombre y correo del
-- fotógrafo, como pide la guía) y cantidades de puestos que el sistema no lleva.

-- ---------------------------------------------------------------------------
-- Agenda
-- ---------------------------------------------------------------------------

create table if not exists agenda_dias (
  dia int primary key check (dia between 0 and 10),
  fecha date,
  vestimenta text,
  notas text,
  updated_at timestamptz not null default now()
);

drop trigger if exists agenda_dias_touch on agenda_dias;
create trigger agenda_dias_touch before update on agenda_dias
  for each row execute function touch_updated_at();

create table if not exists agenda (
  id uuid primary key default gen_random_uuid(),
  dia int not null references agenda_dias(dia) on delete cascade,
  -- Sin hora: "hora a determinarse en la sesión".
  hora_inicio time,
  hora_fin time,
  actividad text not null check (length(btrim(actividad)) >= 2),
  lugar text,
  -- Reuniones del personal (coordinadores, consejeros…), no de los jóvenes.
  solo_personal boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (hora_fin is null or hora_inicio is null or hora_fin >= hora_inicio)
);

create index if not exists agenda_dia_idx on agenda(dia, hora_inicio);

drop trigger if exists agenda_touch on agenda;
create trigger agenda_touch before update on agenda
  for each row execute function touch_updated_at();

insert into agenda_dias (dia, vestimenta, notas) values
  (0, 'Ropa de domingo', 'Día del personal: los jóvenes llegan el día 1.'),
  (1, 'Camiseta del personal', null),
  (2, 'Camiseta del personal', null),
  (3, 'Camiseta del personal', null),
  (4, 'Ropa de domingo', null),
  (5, null, null),
  (6, null, 'Partida.')
on conflict (dia) do nothing;

-- El horario de la guía, solo si la agenda está vacía (no pisa lo ya editado).
insert into agenda (dia, hora_inicio, hora_fin, actividad, solo_personal)
select v.dia, v.inicio::time, v.fin::time, v.actividad, v.personal
from (values
  (0, null, null, 'Recorrido por las instalaciones y lugares', true),
  (0, null, null, 'Orientación para los consejeros', true),
  (0, '19:00', '20:00', 'Mensaje del matrimonio director de sesión', true),
  (0, '20:00', '20:45', 'Reunión de los coordinadores auxiliares con sus consejeros', true),
  (0, '20:00', '20:45', 'Reunión del matrimonio director de sesión y los coordinadores', true),
  (0, '20:45', '21:45', 'Planeamiento y entrevistas entre consejeros adjuntos', true),

  (1, '07:30', '08:20', 'Desayuno del personal', true),
  (1, '08:00', '08:25', 'Reunión de los coordinadores y los coordinadores auxiliares', true),
  (1, '08:30', '09:15', 'Reunión del personal', true),
  (1, '09:15', '10:00', 'Planificación entre consejeros adjuntos', true),
  (1, '09:15', '10:50', 'Distribución de materiales y práctica de orientación (según el tiempo lo permita)', true),
  (1, '11:00', '13:00', 'Llegada', false),
  (1, '13:15', '13:30', 'Revisión de las habitaciones por parte de los participantes (si corresponde)', false),
  (1, '13:30', '14:20', 'Reúnete con tu consejero', false),
  (1, '14:30', '15:05', 'Reúnete con tu compañía', false),
  (1, '15:05', '15:15', 'Nombre y verso cantado de la compañía', false),
  (1, '15:30', '16:30', 'Orientación', false),
  (1, '16:45', '17:15', 'Reunión de los coordinadores y los coordinadores auxiliares', true),
  (1, '16:45', '17:45', 'Cena', false),
  (1, '17:45', null, 'Reúnete con tu compañía / Recuento de personas', false),
  (1, '18:00', '18:45', 'Lección de la noche de hogar', false),
  (1, '19:00', '20:00', 'Juegos de la noche de hogar', false),
  (1, '20:00', '20:45', 'Establecimiento de metas en la noche de hogar', false),
  (1, '21:00', '21:45', 'Recuento de personas / Tiempo para meditar y prepararse para acostarse / Preparación para el devocional', false),
  (1, '21:45', '22:15', 'Reflexiona y repasa', false),
  (1, '22:30', null, 'Apagar las luces', false),
  (1, '22:30', null, 'Reunión de los coordinadores y los coordinadores auxiliares', true),

  (2, '07:00', '07:10', 'Reunión de los coordinadores auxiliares con sus consejeros', true),
  (2, '07:15', '07:30', 'Devocional matutino para participantes', false),
  (2, '07:30', '08:30', 'Desayuno', false),
  (2, '08:30', '09:30', 'Estudio del Evangelio', false),
  (2, '08:45', '09:15', 'Reunión del matrimonio director de sesión con los maestros', true),
  (2, '09:45', '10:30', 'Devocional matutino con el matrimonio director de sesión', false),
  (2, '10:45', '11:30', 'Clases', false),
  (2, '11:45', '12:30', 'Clases', false),
  (2, '12:30', '13:30', 'Almuerzo / Ensayo del programa musical', false),
  (2, '13:30', null, 'Recuento de personas / Reúnete con tu compañía', false),
  (2, '13:45', '14:30', 'Clases o actividad específica de la sesión', false),
  (2, '13:50', '14:30', 'Reunión de los coordinadores y los coordinadores auxiliares', true),
  (2, '14:45', '15:30', 'Clases o actividad específica de la sesión', false),
  (2, '15:30', '16:30', 'Tiempo libre de los participantes', false),
  (2, '15:30', '17:00', 'Ensayo del programa musical / Audiciones para el espectáculo de variedades', false),
  (2, '16:30', '17:00', 'Reunión de los coordinadores auxiliares con sus consejeros', true),
  (2, '16:30', '18:00', 'Cena', false),
  (2, '18:00', null, 'Reúnete con tu compañía / Recuento de personas', false),
  (2, '18:00', '18:30', 'Preparación del estandarte y los versos cantados', false),
  (2, '18:30', '18:45', 'Pautas para los bailes de FSY', false),
  (2, '18:45', '20:45', 'Baile', false),
  (2, '21:00', '21:45', 'Recuento de personas / Tiempo para meditar y prepararse para acostarse / Preparación para el devocional', false),
  (2, '21:45', '22:15', 'Reflexiona y repasa', false),
  (2, '22:30', null, 'Apagar las luces', false),
  (2, '22:30', null, 'Reunión de los coordinadores y los coordinadores auxiliares', true),

  (3, '07:00', '07:10', 'Reunión de los coordinadores auxiliares con sus consejeros', true),
  (3, '07:15', '07:30', 'Devocional matutino para participantes', false),
  (3, '07:30', '08:30', 'Desayuno', false),
  (3, '08:30', '09:30', 'Estudio del Evangelio', false),
  (3, '09:45', '10:30', 'Devocional matutino con el matrimonio director de sesión', false),
  (3, '10:45', '11:30', 'Clases o actividad específica de la sesión', false),
  (3, '11:45', '12:30', 'Clases o actividad específica de la sesión', false),
  (3, '12:30', '13:30', 'Almuerzo / Ensayo del programa musical', false),
  (3, '13:30', null, 'Recuento de personas / Reúnete con tu compañía', false),
  (3, '13:45', '14:30', 'Clases o actividad específica de la sesión', false),
  (3, '13:50', '14:30', 'Reunión de los coordinadores y los coordinadores auxiliares', true),
  (3, '14:45', '15:30', 'Clases o actividad específica de la sesión', false),
  (3, '15:30', '17:00', 'Ensayo del programa musical / Audiciones para el espectáculo de variedades', false),
  (3, '15:30', '16:30', 'Tiempo libre de los participantes', false),
  (3, '16:30', '17:00', 'Reunión de los coordinadores auxiliares con sus consejeros', true),
  (3, '16:30', '18:00', 'Cena', false),
  (3, '18:00', null, 'Reúnete con tu compañía / Recuento de personas', false),
  (3, '18:00', '18:30', 'Preparación para la Noche de juegos', false),
  (3, '18:45', '20:00', 'Noche de juegos y competencia de versos cantados', false),
  (3, '20:15', null, 'Reúnete con tu compañía / Recuento de personas', false),
  (3, '20:15', '21:00', 'Noche de comida favorita', false),
  (3, '21:00', '21:45', 'Recuento de personas / Tiempo para meditar y prepararse para acostarse / Preparación para el devocional', false),
  (3, '21:45', '22:15', 'Reflexiona y repasa', false),
  (3, '22:30', null, 'Apagar las luces', false),
  (3, '22:30', null, 'Reunión de los coordinadores y los coordinadores auxiliares', true),

  (4, '07:00', '07:10', 'Reunión de los coordinadores auxiliares con sus consejeros', true),
  (4, '07:15', '07:30', 'Devocional matutino para participantes', false),
  (4, '07:30', '08:30', 'Desayuno', false),
  (4, '08:30', '09:30', 'Estudio del Evangelio', false),
  (4, '09:45', '11:00', 'Devocional matutino de los Hombres Jóvenes / Práctica del popurrí de FSY', false),
  (4, '09:45', '11:00', 'Actividad de Mujeres Jóvenes', false),
  (4, '11:15', '12:30', 'Actividad de Hombres Jóvenes', false),
  (4, '11:15', '12:30', 'Devocional matutino de las Mujeres Jóvenes / Práctica del popurrí de FSY', false),
  (4, '12:30', '13:45', 'Almuerzo / Ensayo general del espectáculo de variedades / Ensayo del programa musical', false),
  (4, '13:45', null, 'Recuento de personas / Reúnete con tu compañía', false),
  (4, '13:45', '14:00', 'Pautas para el espectáculo de variedades', false),
  (4, '14:15', '15:30', 'Espectáculo de variedades', false),
  (4, '15:30', '16:00', 'Reunión de los coordinadores y los coordinadores auxiliares', true),
  (4, '15:30', '16:30', 'Tiempo libre de los participantes', false),
  (4, '15:30', '17:00', 'Ensayo general del programa musical', false),
  (4, '16:30', '17:50', 'Cena', false),
  (4, '17:50', '18:05', 'Análisis sobre la reverencia y el testimonio', false),
  (4, '18:20', '18:55', 'Programa musical', false),
  (4, '18:55', '19:30', 'Devocional vespertino con el matrimonio director de sesión', false),
  (4, '19:30', '19:40', 'Escribir el testimonio / Cantar el popurrí de FSY', false),
  (4, '19:50', '20:50', 'Reuniones de testimonios', false),
  (4, '21:00', '21:45', 'Recuento de personas / Tiempo para meditar y prepararse para acostarse / Preparación para el devocional', false),
  (4, '21:45', '22:15', 'Reflexiona y repasa', false),
  (4, '22:30', null, 'Apagar las luces', false),
  (4, '22:30', null, 'Reunión de los coordinadores y los coordinadores auxiliares', true),

  (5, '07:00', '07:10', 'Reunión de los coordinadores auxiliares con sus consejeros', true),
  (5, '07:15', '07:30', 'Devocional matutino para participantes', false),
  (5, '07:30', '08:30', 'Desayuno', false),
  (5, '08:30', '09:30', 'Estudio del Evangelio', false),
  (5, '09:30', '10:00', 'Repaso sobre fijar metas', false),
  (5, '10:15', '11:00', 'Devocional matutino con el matrimonio director de sesión', false),
  (5, '11:15', '12:30', 'Actividad de la guía Para la Fortaleza de la Juventud', false),
  (5, '12:30', '13:30', 'Almuerzo', false),
  (5, '13:30', null, 'Recuento de personas / Reúnete con tu compañía', false),
  (5, '13:45', '15:00', 'Actividad de Vivir el Evangelio', false),
  (5, '15:00', '15:15', 'Presentación de diapositivas', false),
  (5, '15:15', '16:30', 'Tiempo libre de los participantes (los jóvenes empacan)', false),
  (5, '16:30', '18:00', 'Cena', false),
  (5, '18:00', null, 'Reúnete con tu compañía / Recuento de personas', false),
  (5, '18:00', '18:15', 'Toma de fotografías', false),
  (5, '18:15', '20:00', 'Baile', false),
  (5, '20:15', '20:45', 'Mensaje Llévatelo a casa', false),
  (5, '21:00', '21:30', 'Mensaje Llévatelo a casa de la compañía', false),
  (5, '21:45', '22:25', 'Recuento de personas / Tiempo para meditar y prepararse para acostarse / Oración', false),
  (5, '22:30', null, 'Apagar las luces', false),
  (5, '22:30', null, 'Reunión de los coordinadores y los coordinadores auxiliares', true),

  (6, '06:30', '07:00', 'Prepararse para partir', false),
  (6, '07:00', '07:30', 'Revisión de las habitaciones al final de la sesión / Partida de los participantes', false),
  (6, '07:30', '08:00', 'Reunión final del personal', true)
) as v(dia, inicio, fin, actividad, personal)
where not exists (select 1 from agenda);

-- ---------------------------------------------------------------------------
-- Informe final
-- ---------------------------------------------------------------------------

create table if not exists informe_testimonios (
  id uuid primary key default gen_random_uuid(),
  autor text,
  tipo text not null default 'joven' check (tipo in ('joven', 'joven_adulto')),
  texto text not null check (length(btrim(texto)) >= 5),
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists informe_fotos (
  id uuid primary key default gen_random_uuid(),
  path text not null,
  descripcion text,
  -- La guía pide el nombre y el correo del fotógrafo con cada foto.
  fotografo_nombre text not null check (length(btrim(fotografo_nombre)) >= 2),
  fotografo_correo text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Lo que el informe pide y el sistema no lleva: cuántas sesiones hubo, y los
-- jóvenes adultos que sirvieron como coordinadores o en otros puestos (los
-- consejeros y coordinadores auxiliares sí salen del sistema). Se anota a mano.
create table if not exists informe_conteos (
  clave text primary key check (clave in ('sesiones', 'coordinadores', 'otros_jovenes_adultos')),
  valor int not null default 0 check (valor between 0 and 5000),
  updated_at timestamptz not null default now()
);

insert into informe_conteos (clave, valor) values ('sesiones', 1), ('coordinadores', 0), ('otros_jovenes_adultos', 0)
on conflict (clave) do nothing;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table agenda_dias enable row level security;
alter table agenda enable row level security;
alter table informe_testimonios enable row level security;
alter table informe_fotos enable row level security;
alter table informe_conteos enable row level security;

drop policy if exists "agenda_dias_lectura" on agenda_dias;
create policy "agenda_dias_lectura" on agenda_dias for select to authenticated using (has_permission('agenda.ver'));
drop policy if exists "agenda_dias_escritura" on agenda_dias;
create policy "agenda_dias_escritura" on agenda_dias for update to authenticated
  using (has_permission('agenda.editar')) with check (has_permission('agenda.editar'));

drop policy if exists "agenda_lectura" on agenda;
create policy "agenda_lectura" on agenda for select to authenticated using (has_permission('agenda.ver'));
drop policy if exists "agenda_escritura" on agenda;
create policy "agenda_escritura" on agenda for all to authenticated
  using (has_permission('agenda.editar')) with check (has_permission('agenda.editar'));

drop policy if exists "informe_testimonios_lectura" on informe_testimonios;
create policy "informe_testimonios_lectura" on informe_testimonios for select to authenticated using (has_permission('informe.ver'));
drop policy if exists "informe_testimonios_escritura" on informe_testimonios;
create policy "informe_testimonios_escritura" on informe_testimonios for all to authenticated
  using (has_permission('informe.editar')) with check (has_permission('informe.editar'));

drop policy if exists "informe_fotos_lectura" on informe_fotos;
create policy "informe_fotos_lectura" on informe_fotos for select to authenticated using (has_permission('informe.ver'));
drop policy if exists "informe_fotos_escritura" on informe_fotos;
create policy "informe_fotos_escritura" on informe_fotos for all to authenticated
  using (has_permission('informe.editar')) with check (has_permission('informe.editar'));

drop policy if exists "informe_conteos_lectura" on informe_conteos;
create policy "informe_conteos_lectura" on informe_conteos for select to authenticated using (has_permission('informe.ver'));
drop policy if exists "informe_conteos_escritura" on informe_conteos;
create policy "informe_conteos_escritura" on informe_conteos for update to authenticated
  using (has_permission('informe.editar')) with check (has_permission('informe.editar'));

revoke all on agenda_dias, agenda, informe_testimonios, informe_fotos, informe_conteos from anon;

-- ---------------------------------------------------------------------------
-- Catálogo de permisos
-- ---------------------------------------------------------------------------

insert into modules (key, name, description, icon, sort_order) values
  ('agenda', 'Agenda', 'Horario de la sesión, día por día, con la ropa de cada día.', 'calendar-days', 38),
  ('informe', 'Informe final', 'Informe para el matrimonio asesor en el Área: asistencia, personal, testimonios y fotos.', 'file-text', 60)
on conflict (key) do update set
  name = excluded.name, description = excluded.description,
  icon = excluded.icon, sort_order = excluded.sort_order;

insert into permissions (key, module_key, action, label, description, sort_order) values
  ('agenda.ver', 'agenda', 'ver', 'Ver', 'Ver la agenda de la sesión.', 10),
  ('agenda.editar', 'agenda', 'editar', 'Editar', 'Cambiar horarios, actividades, fechas y la ropa de cada día.', 20),
  ('informe.ver', 'informe', 'ver', 'Ver', 'Ver el informe final de la sesión.', 10),
  ('informe.editar', 'informe', 'editar', 'Editar', 'Agregar testimonios, fotos y los puestos que se anotan a mano.', 20)
on conflict (key) do update set
  label = excluded.label, description = excluded.description, sort_order = excluded.sort_order;

-- Consejeros y coordinadores ven la agenda.
insert into role_permissions (role_id, permission_key)
select r.id, 'agenda.ver' from roles r where r.key in ('consejero', 'coordinador')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Reparto automático: aplicar la propuesta que se vio en el panel
-- ---------------------------------------------------------------------------
-- El panel calcula el reparto sugerido (jóvenes en compañías, compañías en
-- pisos) y lo muestra antes de tocar nada. Al confirmarlo llega entero aquí y se
-- aplica todo o nada: un reparto a medias sería peor que ninguno.

-- p_asignaciones: [{id, compania_id}]. Sin p_rehacer solo se toma a quien sigue
-- sin compañía: si alguien lo asignó a mano entretanto, no se lo mueve.
create or replace function aplicar_companias(p_asignaciones jsonb, p_rehacer boolean)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  if not has_permission('companias.editar') then
    raise exception 'No tienes permiso para asignar compañías' using errcode = '42501';
  end if;
  update participantes p
    set compania_id = (a->>'compania_id')::uuid
    from jsonb_array_elements(p_asignaciones) a
    where p.id = (a->>'id')::uuid
      and (p_rehacer or p.compania_id is null);
  get diagnostics n = row_count;
  return n;
end;
$$;

-- p_jovenes / p_lideres: [{id, habitacion_id}] (habitacion_id null = queda sin
-- cama). Al rehacer, primero se liberan las camas de todos los que se
-- reacomodan: así nadie choca con el cupo de una habitación de la que otro se
-- está yendo. Sexo del edificio, tipo de habitación y cupo los siguen cuidando
-- los disparadores de 0008.
create or replace function aplicar_camas(p_jovenes jsonb, p_lideres jsonb, p_rehacer boolean)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
  m int;
begin
  if not has_permission('habitaciones.editar') then
    raise exception 'No tienes permiso para asignar camas' using errcode = '42501';
  end if;
  if p_rehacer then
    update participantes set habitacion_id = null
      where habitacion_id is not null
        and id in (select (a->>'id')::uuid from jsonb_array_elements(p_jovenes) a);
    update consejeros set habitacion_id = null
      where habitacion_id is not null
        and id in (select (a->>'id')::uuid from jsonb_array_elements(p_lideres) a);
  end if;
  update participantes p
    set habitacion_id = (a->>'habitacion_id')::uuid
    from jsonb_array_elements(p_jovenes) a
    where p.id = (a->>'id')::uuid and a->>'habitacion_id' is not null and p.habitacion_id is null;
  get diagnostics n = row_count;
  update consejeros c
    set habitacion_id = (a->>'habitacion_id')::uuid
    from jsonb_array_elements(p_lideres) a
    where c.id = (a->>'id')::uuid and a->>'habitacion_id' is not null and c.habitacion_id is null;
  get diagnostics m = row_count;
  return n + m;
end;
$$;

revoke execute on function aplicar_companias(jsonb, boolean) from public, anon;
grant execute on function aplicar_companias(jsonb, boolean) to authenticated;
revoke execute on function aplicar_camas(jsonb, jsonb, boolean) from public, anon;
grant execute on function aplicar_camas(jsonb, jsonb, boolean) to authenticated;
