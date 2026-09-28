import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

export interface RolResumen {
  id: string;
  key: string;
  name: string;
  is_system: boolean;
}

export interface Sesion {
  id: string;
  email: string;
  nombre: string;
  telefono: string | null;
  rol: RolResumen | null;
  activo: boolean;
  debeCambiarClave: boolean;
  /** Claves "<módulo>.<acción>" efectivas. Para el admin, el catálogo completo. */
  permisos: string[];
  esAdmin: boolean;
}

/**
 * Identidad, rol y permisos del usuario de esta petición, resueltos una sola
 * vez: cache() de React los comparte entre el layout y la página de la misma
 * respuesta y los descarta al terminar. No hay forma de que se mezclen entre
 * usuarios ni entre peticiones.
 */
export const obtenerSesion = cache(async (): Promise<Sesion | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: perfil }, { data: permisos }] = await Promise.all([
    supabase
      .from("profiles")
      .select("email, full_name, phone, active, must_change_password, rol:roles(id, key, name, is_system)")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.rpc("my_permissions"),
  ]);

  const rol = (perfil?.rol as unknown as RolResumen | null) ?? null;
  const activo = perfil?.active ?? false;

  return {
    id: user.id,
    email: perfil?.email ?? user.email ?? "",
    nombre: perfil?.full_name || user.email || "",
    telefono: perfil?.phone ?? null,
    rol,
    activo,
    debeCambiarClave: perfil?.must_change_password ?? false,
    permisos: (permisos as string[] | null) ?? [],
    esAdmin: activo && !!rol?.is_system,
  };
});

export function puede(sesion: Pick<Sesion, "esAdmin" | "permisos">, permiso: string): boolean {
  return sesion.esAdmin || sesion.permisos.includes(permiso);
}

/**
 * Para páginas y layouts: garantiza una sesión válida o redirige.
 *
 * Un usuario desactivado conserva su cookie hasta que expire; se lo manda a
 * /salir (que cierra la sesión) y no a /login, porque el proxy devuelve a
 * /inicio a quien llega a /login con sesión y quedaría un bucle.
 */
export async function exigirSesion(): Promise<Sesion> {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");
  if (!sesion.activo) redirect("/salir?motivo=inactivo");
  return sesion;
}

type ResultadoPermiso = { ok: true; sesion: Sesion } | { ok: false; error: string };

/**
 * Para acciones del servidor: nunca confiar en que la interfaz ocultó el
 * botón. Cada acción vuelve a validar el permiso con la sesión real.
 */
export async function validarPermiso(permiso: string): Promise<ResultadoPermiso> {
  const sesion = await obtenerSesion();
  if (!sesion || !sesion.activo) return { ok: false, error: "Tu sesión expiró. Vuelve a ingresar." };
  if (!puede(sesion, permiso)) return { ok: false, error: "No tienes permiso para realizar esta acción." };
  return { ok: true, sesion };
}
