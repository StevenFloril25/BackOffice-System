import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { generarClaveTemporal } from "@/lib/utilidades";

/** Usuario libre a partir del correo: "maria.perez@x.com" -> "maria.perez" (o "maria.perez2"...). */
export async function usuarioSugerido(email: string): Promise<string> {
  let base = email.split("@")[0].toLowerCase().replace(/[^a-z0-9._-]/g, "").replace(/^[^a-z0-9]+/, "");
  if (base.length < 3) base = `${base}usr`;
  base = base.slice(0, 26);
  const { data } = await createAdminClient().from("profiles").select("username").ilike("username", `${base}%`);
  const usados = new Set((data ?? []).map((x) => x.username as string));
  if (!usados.has(base)) return base;
  let n = 2;
  while (usados.has(`${base}${n}`)) n++;
  return `${base}${n}`;
}

export function mensajeAuth(message: string) {
  if (/already been registered|already exists|email_exists/i.test(message)) return "Ya existe una cuenta con ese correo.";
  if (/password/i.test(message)) return "La contraseña no cumple los requisitos de seguridad.";
  return message;
}

export interface CuentaCreada {
  id: string;
  usuario: string;
  clave: string;
}

/**
 * Crea una cuenta con un rol y contraseña temporal (se cambia al primer
 * ingreso). El disparador de Auth solo crea el perfil vacío; el rol se asigna
 * aquí, y si eso falla se borra la cuenta: una cuenta sin rol confunde más que
 * un error visible (ver 0003_perfil_sin_metadata.sql).
 */
export async function crearCuenta(datos: {
  email: string;
  nombre: string;
  telefono: string | null;
  rolKey: string;
  creadaPor: string;
}): Promise<CuentaCreada | { error: string }> {
  const admin = createAdminClient();
  const { data: rol } = await admin.from("roles").select("id").eq("key", datos.rolKey).maybeSingle();
  if (!rol) return { error: `No existe el rol «${datos.rolKey}».` };

  const clave = generarClaveTemporal();
  const { data, error } = await admin.auth.admin.createUser({
    email: datos.email,
    password: clave,
    email_confirm: true,
    user_metadata: { full_name: datos.nombre },
  });
  if (error || !data.user) return { error: mensajeAuth(error?.message ?? "No se pudo crear la cuenta.") };

  const usuario = await usuarioSugerido(datos.email);
  const { error: errorPerfil } = await admin
    .from("profiles")
    .update({
      full_name: datos.nombre,
      phone: datos.telefono,
      username: usuario,
      role_id: rol.id,
      must_change_password: true,
      created_by: datos.creadaPor,
    })
    .eq("id", data.user.id);
  if (errorPerfil) {
    await admin.auth.admin.deleteUser(data.user.id);
    return { error: "No se pudo preparar la cuenta. Intenta de nuevo." };
  }
  return { id: data.user.id, usuario, clave };
}

/** Perfil existente con ese correo (para vincularlo en vez de crear otra cuenta). */
export async function perfilPorCorreo(email: string) {
  const { data } = await createAdminClient()
    .from("profiles")
    .select("id, email, username, full_name, rol:roles(key, name)")
    .ilike("email", email)
    .maybeSingle();
  if (!data) return null;
  const rol = data.rol as unknown as { key: string; name: string } | null;
  return { id: data.id as string, username: data.username as string | null, rolKey: rol?.key ?? null, rolNombre: rol?.name ?? null };
}
