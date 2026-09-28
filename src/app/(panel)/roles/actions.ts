"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { validarPermiso } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

export interface EstadoRol {
  error?: string;
  ok?: string;
  valores?: { name: string; description: string; permisos: string[] };
}

/**
 * Crear y editar pasan por guardar_rol() en la base: valida el permiso con la
 * sesión real, impide tocar el rol de sistema o el propio, y escribe rol,
 * permisos y bitácora en una sola transacción. Aquí solo se valida antes para
 * dar un mensaje claro sin ir a la base.
 */
export async function guardarRol(id: string | null, _previo: EstadoRol | undefined, formData: FormData): Promise<EstadoRol> {
  const permiso = await validarPermiso(id ? "roles.editar" : "roles.crear");
  if (!permiso.ok) return { error: permiso.error };

  const valores = {
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    permisos: formData.getAll("permisos").map(String),
  };
  if (valores.name.length < 2) return { error: "Escribe un nombre para el rol.", valores };
  if (valores.description.length > 300) return { error: "La descripción admite hasta 300 caracteres.", valores };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("guardar_rol", {
    p_id: id,
    p_nombre: valores.name,
    p_descripcion: valores.description,
    p_permisos: valores.permisos,
  });
  if (error) return { error: error.message, valores };

  revalidatePath("/roles");
  revalidatePath("/usuarios");
  if (!id) redirect(`/roles/${data}?aviso=creado`);
  revalidatePath(`/roles/${id}`);
  return { ok: "Rol guardado." };
}

export async function eliminarRol(id: string): Promise<EstadoRol> {
  const permiso = await validarPermiso("roles.eliminar");
  if (!permiso.ok) return { error: permiso.error };

  const supabase = await createClient();
  const { error } = await supabase.rpc("eliminar_rol", { p_id: id });
  if (error) return { error: error.message };

  revalidatePath("/roles");
  redirect("/roles?aviso=eliminado");
}
