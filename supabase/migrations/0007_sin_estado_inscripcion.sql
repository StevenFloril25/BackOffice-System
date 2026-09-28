-- Se quita el estado de la inscripción (Aprobado / Pendiente de aprobación).
--
-- Es un dato del sistema de inscripción de FSY que aquí no se usa y se
-- confundía con la asistencia. Sigue estando en el Excel si alguna vez hace
-- falta. La importación solo lo lee para no cargar inscripciones canceladas.

-- registrar_asistencia deja de mirar el estado: quien tiene QR y llega, queda
-- registrado.
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

alter table participantes drop column if exists estado_inscripcion;
