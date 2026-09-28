-- El perfil ya no toma el rol de app_metadata.
--
-- Supabase Auth (GoTrue) inserta el usuario y escribe app_metadata en un
-- UPDATE posterior, así que el disparador AFTER INSERT nunca lo veía: el primer
-- administrador quedó sin rol. En vez de perseguir ese orden interno de Auth,
-- el disparador solo garantiza que exista el perfil, y el rol, la contraseña
-- temporal y quién lo creó los asigna explícitamente quien da el alta (la
-- acción crearUsuario y scripts/crear-admin.mjs), con la service role.

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, email, full_name)
  values (new.id, lower(new.email), coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;
