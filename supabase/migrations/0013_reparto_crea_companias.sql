-- El reparto sugerido también crea las compañías que hagan falta.
--
-- Antes repartía solo entre las compañías ya creadas: con una sola, ponía a
-- todos ahí. Ahora el panel propone cuántas compañías hacen falta según el
-- tamaño elegido, y al aplicar se crean y se asignan los jóvenes en la misma
-- transacción: o queda todo o no queda nada.
--
-- Reemplaza a aplicar_companias (0012): las asignaciones van por número de
-- compañía, porque las nuevas todavía no tienen id cuando se arma la propuesta.

drop function if exists aplicar_companias(jsonb, boolean);

-- p_asignaciones: [{id, numero}]. p_crear: números de las compañías que se
-- crean. Sin p_rehacer solo se toma a quien sigue sin compañía.
create or replace function aplicar_reparto(p_asignaciones jsonb, p_crear int[], p_rehacer boolean)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
  repetida int;
  falta int;
begin
  if not has_permission('companias.editar') then
    raise exception 'No tienes permiso para asignar compañías' using errcode = '42501';
  end if;
  if coalesce(array_length(p_crear, 1), 0) > 0 then
    if not has_permission('companias.crear') then
      raise exception 'No tienes permiso para crear compañías' using errcode = '42501';
    end if;
    select numero into repetida from companias where numero = any(p_crear) limit 1;
    if found then
      raise exception 'La compañía % ya existe: vuelve a cargar la propuesta.', repetida;
    end if;
    insert into companias (numero) select unnest(p_crear);
  end if;
  -- Si alguien borró una compañía de la propuesta entretanto, nada.
  select (a->>'numero')::int into falta
    from jsonb_array_elements(p_asignaciones) a
    where not exists (select 1 from companias c where c.numero = (a->>'numero')::int)
    limit 1;
  if found then
    raise exception 'La compañía % ya no existe: vuelve a cargar la propuesta.', falta;
  end if;

  update participantes p
    set compania_id = c.id
    from jsonb_array_elements(p_asignaciones) a
    join companias c on c.numero = (a->>'numero')::int
    where p.id = (a->>'id')::uuid
      and (p_rehacer or p.compania_id is null);
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function aplicar_reparto(jsonb, int[], boolean) from public, anon;
grant execute on function aplicar_reparto(jsonb, int[], boolean) to authenticated;
