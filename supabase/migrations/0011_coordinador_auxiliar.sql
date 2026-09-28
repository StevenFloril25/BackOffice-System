-- Coordinador auxiliar: acompaña a una compañía para ayudar a su pareja de
-- consejeros y puede cubrir el lugar de uno si se va.
--
-- Es un líder más (misma ficha, foto, cama en la habitación de líderes y cuenta),
-- así que vive en la tabla consejeros con su función. Normalmente hay uno por
-- compañía; muy rara vez dos, por eso no se limita.
--
-- "Cubrir" es ocupar el lugar de consejero o consejera de su compañía (se sigue
-- viendo como coordinador); "pasar a ser consejero" es cambiarle la función.

alter table consejeros add column if not exists funcion text not null default 'consejero'
  check (funcion in ('consejero', 'coordinador'));
alter table consejeros add column if not exists coordina_compania_id uuid references companias(id) on delete set null;
create index if not exists consejeros_coordina_idx on consejeros(coordina_compania_id);

-- Solo un coordinador coordina una compañía.
alter table consejeros drop constraint if exists consejeros_coordina_solo_coordinador;
alter table consejeros add constraint consejeros_coordina_solo_coordinador
  check (coordina_compania_id is null or funcion = 'coordinador');

-- Una persona está en un solo lugar: o ocupa el de consejero de una compañía o
-- coordina una. Al cubrir, la aplicación primero lo quita de coordinador.
create or replace function validar_compania()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v consejeros%rowtype;
begin
  if new.consejero_id is not null and (tg_op = 'INSERT' or new.consejero_id is distinct from old.consejero_id) then
    select * into v from consejeros where id = new.consejero_id;
    if found and v.sexo <> 'Hombre' then
      raise exception 'El consejero de la compañía tiene que ser hombre.';
    end if;
    if found and v.coordina_compania_id is not null then
      raise exception 'Es coordinador auxiliar de una compañía: primero quítalo de ahí.';
    end if;
  end if;
  if new.consejera_id is not null and (tg_op = 'INSERT' or new.consejera_id is distinct from old.consejera_id) then
    select * into v from consejeros where id = new.consejera_id;
    if found and v.sexo <> 'Mujer' then
      raise exception 'La consejera de la compañía tiene que ser mujer.';
    end if;
    if found and v.coordina_compania_id is not null then
      raise exception 'Es coordinadora auxiliar de una compañía: primero quítala de ahí.';
    end if;
  end if;
  return new;
end;
$$;

create or replace function validar_coordinador()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.coordina_compania_id is not null
     and exists (select 1 from companias where consejero_id = new.id or consejera_id = new.id) then
    raise exception 'Ya ocupa el lugar de consejero en una compañía: no puede además coordinar una.';
  end if;
  return new;
end;
$$;

drop trigger if exists consejeros_coordinador on consejeros;
create trigger consejeros_coordinador before insert or update of coordina_compania_id on consejeros
  for each row execute function validar_coordinador();

revoke execute on function validar_compania(), validar_coordinador() from public, anon, authenticated;

-- "Mi compañía" también para el coordinador.
create or replace function mi_compania_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select c.id from companias c
  join consejeros k on k.id in (c.consejero_id, c.consejera_id) or k.coordina_compania_id = c.id
  where k.profile_id = auth.uid()
  limit 1
$$;

-- Quien ve su compañía ve también a sus coordinadores (y el coordinador, a la pareja).
drop policy if exists "consejeros_lectura" on consejeros;
create policy "consejeros_lectura" on consejeros for select to authenticated
  using (has_permission('consejeros.ver') or has_permission('companias.ver') or has_permission('habitaciones.ver')
         or (has_permission('companias.ver_propia')
             and (id in (select unnest(array[consejero_id, consejera_id]) from companias where id = mi_compania_id())
                  or coordina_compania_id = mi_compania_id())));

-- Rol de los coordinadores: lo mismo que ve un consejero.
insert into roles (key, name, description) values
  ('coordinador', 'Coordinador auxiliar',
   'Rol de los coordinadores auxiliares. Se asigna solo al registrarlos: ven las habitaciones y su compañía.')
-- Sin (key): tampoco choca si alguien ya creó a mano un rol con ese nombre.
on conflict do nothing;

insert into role_permissions (role_id, permission_key)
select r.id, p.key
from roles r cross join permissions p
where r.key = 'coordinador' and p.key in ('habitaciones.ver', 'companias.ver_propia')
on conflict do nothing;

update permissions set description =
  'Solo la compañía que tiene asignada: sus jóvenes, sus consejeros y su coordinador. Es el permiso de consejeros y coordinadores auxiliares.'
  where key = 'companias.ver_propia';

update modules set name = 'Consejeros y coordinadores',
  description = 'Consejeros, consejeras y coordinadores auxiliares: datos, contacto, talla, foto y su cuenta.'
  where key = 'consejeros';
