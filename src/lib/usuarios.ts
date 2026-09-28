import "server-only";

import { createClient } from "@/lib/supabase/server";

export interface UsuarioFila {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role_id: string | null;
  role_name: string | null;
  role_is_system: boolean;
  active: boolean;
  must_change_password: boolean;
  created_at: string;
  last_sign_in_at: string | null;
}

export interface RolOpcion {
  id: string;
  name: string;
  description: string;
  is_system: boolean;
}

/** Todos los usuarios visibles para la sesión (cero filas sin usuarios.ver). */
export async function listarUsuarios(): Promise<UsuarioFila[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("listar_usuarios");
  if (error) throw new Error(`No se pudo cargar el listado de usuarios: ${error.message}`);
  return (data ?? []) as UsuarioFila[];
}

export async function obtenerUsuario(id: string): Promise<UsuarioFila | null> {
  // listar_usuarios trae el último ingreso, que no está en profiles. Con el
  // tamaño esperado del equipo, filtrar aquí es más simple que otra función.
  const todos = await listarUsuarios();
  return todos.find((u) => u.id === id) ?? null;
}

export async function listarRolesOpciones(): Promise<RolOpcion[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("roles")
    .select("id, name, description, is_system")
    .order("is_system", { ascending: false })
    .order("name");
  return (data ?? []) as RolOpcion[];
}

export function estadoUsuario(u: Pick<UsuarioFila, "active" | "must_change_password" | "last_sign_in_at">) {
  if (!u.active) return { etiqueta: "Inactivo", tono: "neutro" as const };
  if (!u.last_sign_in_at) return { etiqueta: "Sin ingresar", tono: "sol" as const };
  return { etiqueta: "Activo", tono: "hoja" as const };
}
