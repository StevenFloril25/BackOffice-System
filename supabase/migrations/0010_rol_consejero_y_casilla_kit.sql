-- Consejero como rol de usuario, casilla del kit en la ficha y fuera el módulo
-- "Entrega de kits".
--
-- Cada consejero registrado recibe su cuenta con el rol "Consejero": por ahora
-- ve las habitaciones y su compañía (sus jóvenes y su pareja de consejeros).
-- La cuenta se crea desde la aplicación; aquí queda el vínculo, el rol y las
-- reglas de lectura para "su compañía".
--
-- El kit deja de tener página propia: se marca en la ficha del participante con
-- una casilla, y sigue marcándose solo al registrar la llegada.

-- ---------------------------------------------------------------------------
-- Consejero ↔ cuenta
-- ---------------------------------------------------------------------------

alter table consejeros add column if not exists profile_id uuid unique references profiles(id) on delete set null;

-- El consejero de la sesión (por su cuenta) y la compañía donde está. Security
-- definer y stable: las políticas los llaman en cada fila sin recursión de RLS.
create or replace function mi_consejero_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$ select id from consejeros where profile_id = auth.uid() $$;

create or replace function mi_compania_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select c.id from companias c
  join consejeros k on k.id in (c.consejero_id, c.consejera_id)
  where k.profile_id = auth.uid()
  limit 1
$$;

revoke execute on function mi_consejero_id(), mi_compania_id() from public, anon;
grant execute on function mi_consejero_id(), mi_compania_id() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Permiso "Ver su compañía" y rol Consejero
-- ---------------------------------------------------------------------------

insert into permissions (key, module_key, action, label, description, sort_order) values
  ('companias.ver_propia', 'companias', 'ver_propia', 'Ver su compañía',
   'Solo la compañía que tiene asignada: sus jóvenes y su pareja de consejeros. Es el permiso de los consejeros.', 5)
on conflict (key) do update set
  label = excluded.label, description = excluded.description, sort_order = excluded.sort_order;

insert into roles (key, name, description) values
  ('consejero', 'Consejero',
   'Rol de los consejeros y consejeras. Se asigna solo al registrarlos: ven las habitaciones y su compañía.')
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_key)
select r.id, p.key
from roles r cross join permissions p
where r.key = 'consejero' and p.key in ('habitaciones.ver', 'companias.ver_propia')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Fuera el módulo de kits (su permiso se va de los roles en cascada)
-- ---------------------------------------------------------------------------

delete from permissions where module_key = 'kits';
delete from modules where key = 'kits';

-- ---------------------------------------------------------------------------
-- Lectura: sin kits.ver y con "su compañía"
-- ---------------------------------------------------------------------------

drop policy if exists "consejeros_lectura" on consejeros;
create policy "consejeros_lectura" on consejeros for select to authenticated
  using (has_permission('consejeros.ver') or has_permission('companias.ver') or has_permission('habitaciones.ver')
         or (has_permission('companias.ver_propia')
             and id in (select unnest(array[consejero_id, consejera_id]) from companias where id = mi_compania_id())));

drop policy if exists "companias_lectura" on companias;
create policy "companias_lectura" on companias for select to authenticated
  using (has_permission('companias.ver') or has_permission('consejeros.ver')
         or has_permission('participantes.ver') or has_permission('habitaciones.ver')
         or (has_permission('companias.ver_propia') and id = mi_compania_id()));

drop policy if exists "participantes_lectura" on participantes;
create policy "participantes_lectura" on participantes for select to authenticated
  using (has_permission('participantes.ver') or has_permission('asistencia.registrar')
         or has_permission('companias.ver') or has_permission('habitaciones.ver')
         or (has_permission('companias.ver_propia') and compania_id = mi_compania_id()));

-- ---------------------------------------------------------------------------
-- Kit: casilla en la ficha
-- ---------------------------------------------------------------------------

-- De dónde salió la marca: al anular una llegada solo se deshace el kit que esa
-- llegada marcó. Comparar horas no alcanza (la casilla y la llegada pueden caer
-- en el mismo instante).
alter table participantes add column if not exists kit_origen text check (kit_origen in ('llegada', 'casilla'));
update participantes set kit_origen = 'llegada' where kit_entregado_at is not null and kit_origen is null;

-- La lectura del QR, como en 0008, anotando que el kit vino con la llegada.
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
          kit_origen = case when kit_entregado_at is null then 'llegada' else kit_origen end,
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

-- La marca quien toma asistencia o quien edita participantes.
create or replace function marcar_kit(p_id uuid, p_entregado boolean)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v participantes%rowtype;
begin
  if not (has_permission('asistencia.registrar') or has_permission('participantes.editar')) then
    raise exception 'No tienes permiso para marcar el kit' using errcode = '42501';
  end if;
  select * into v from participantes where id = p_id;
  if not found then
    raise exception 'El participante no existe';
  end if;
  if p_entregado = (v.kit_entregado_at is not null) then
    return v.kit_entregado_at;
  end if;

  update participantes
    set kit_entregado_at = case when p_entregado then now() end,
        kit_entregado_por = case when p_entregado then auth.uid() end,
        kit_origen = case when p_entregado then 'casilla' end
    where id = p_id
    returning * into v;

  insert into audit_log (actor_id, actor_email, action, entity, entity_id, summary)
  values (
    auth.uid(), (select email from profiles where id = auth.uid()),
    case when p_entregado then 'kit.entregar' else 'kit.anular' end,
    'participante', p_id::text,
    case when p_entregado then 'Marcó el kit entregado a ' else 'Desmarcó el kit de ' end || v.nombres || ' ' || v.apellidos
  );
  return v.kit_entregado_at;
end;
$$;

revoke execute on function marcar_kit(uuid, boolean) from public, anon;
grant execute on function marcar_kit(uuid, boolean) to authenticated;

-- Anular una llegada deshace solo el kit que esa llegada marcó. Si el kit se
-- marcó aparte con la casilla, se respeta.
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
          kit_origen = case when kit_entregado_at is null then 'llegada' else kit_origen end,
          kit_entregado_at = coalesce(kit_entregado_at, now()),
          kit_entregado_por = coalesce(kit_entregado_por, auth.uid())
      where id = p_id;
  elsif not p_asistio and v.asistio_at is not null then
    update participantes
      set asistio_at = null, asistencia_por = null,
          kit_entregado_at = case when kit_origen = 'llegada' then null else kit_entregado_at end,
          kit_entregado_por = case when kit_origen = 'llegada' then null else kit_entregado_por end,
          kit_origen = case when kit_origen = 'llegada' then null else kit_origen end
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
