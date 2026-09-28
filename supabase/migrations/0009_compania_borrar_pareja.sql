-- Borrar a la vez al consejero y a la consejera de una compañía fallaba con
-- "La consejera de la compañía tiene que ser mujer".
--
-- Al borrar un consejero, su llave vacía su lugar en la compañía (on delete set
-- null) con un UPDATE, y ese UPDATE disparaba validar_compania, que revisaba
-- también el otro lugar. Si la otra persona se borraba en la misma sentencia, ya
-- no se encontraba, su sexo salía NULL y la regla lo tomaba por "no es mujer".
--
-- Ahora solo se revisa el lugar que cambia, y una persona que no existe no se
-- juzga aquí: de eso se encarga la llave foránea.
create or replace function validar_compania()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sexo text;
begin
  if new.consejero_id is not null and (tg_op = 'INSERT' or new.consejero_id is distinct from old.consejero_id) then
    select sexo into v_sexo from consejeros where id = new.consejero_id;
    if found and v_sexo <> 'Hombre' then
      raise exception 'El consejero de la compañía tiene que ser hombre.';
    end if;
  end if;
  if new.consejera_id is not null and (tg_op = 'INSERT' or new.consejera_id is distinct from old.consejera_id) then
    select sexo into v_sexo from consejeros where id = new.consejera_id;
    if found and v_sexo <> 'Mujer' then
      raise exception 'La consejera de la compañía tiene que ser mujer.';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function validar_compania() from public, anon, authenticated;
