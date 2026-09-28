"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { registrarAuditoria } from "@/lib/auditoria";
import type { BarrioResumen } from "@/lib/participantes";
import { validarPermiso } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

export interface EstadoBarrio {
  ok?: string;
  error?: string;
  errores?: Record<string, string>;
  barrio?: BarrioResumen;
  valores?: Record<string, string>;
}

const esquema = z.object({
  estaca: z.string().trim().max(80, "Máximo 80 caracteres."),
  nombre: z.string().trim().min(2, "Escribe el nombre del barrio.").max(80, "Máximo 80 caracteres."),
  obispo_nombre: z.string().trim().max(120, "Máximo 120 caracteres."),
  obispo_correo: z
    .string()
    .trim()
    .toLowerCase()
    .refine((v) => v === "" || z.email().safeParse(v).success, { message: "Correo no válido." })
    .transform((v) => v || null),
  obispo_telefono: z
    .string()
    .trim()
    .max(25, "Máximo 25 caracteres.")
    .regex(/^[\d\s+()-]*$/, "Solo números, espacios y + ( ) -.")
    .transform((v) => v || null),
});

const CAMPOS = ["estaca", "nombre", "obispo_nombre", "obispo_correo", "obispo_telefono"] as const;

/**
 * Crea o edita un barrio. Se escribe con la sesión del usuario: RLS vuelve a
 * exigir barrios.crear / barrios.editar aunque la interfaz ya lo haya filtrado.
 */
export async function guardarBarrio(id: string | null, _previo: EstadoBarrio | undefined, formData: FormData): Promise<EstadoBarrio> {
  const permiso = await validarPermiso(id ? "barrios.editar" : "barrios.crear");
  if (!permiso.ok) return { error: permiso.error };

  const valores = Object.fromEntries(CAMPOS.map((c) => [c, String(formData.get(c) ?? "")]));
  const datos = esquema.safeParse(valores);
  if (!datos.success) {
    const errores: Record<string, string> = {};
    for (const i of datos.error.issues) errores[String(i.path[0])] ??= i.message;
    return { errores, valores };
  }

  const supabase = await createClient();
  const consulta = id
    ? supabase.from("barrios").update(datos.data).eq("id", id)
    : supabase.from("barrios").insert(datos.data);
  const { data, error } = await consulta.select("id, nombre, estaca").single();
  if (error) {
    if (/barrios_unico|duplicate/.test(error.message)) {
      return { errores: { nombre: "Ese barrio ya existe en esa estaca." }, valores };
    }
    return { error: "No se pudo guardar el barrio.", valores };
  }

  await registrarAuditoria(permiso.sesion, {
    accion: id ? "barrio.editar" : "barrio.crear",
    entidad: "barrio",
    entidadId: data.id,
    resumen: `${id ? "Editó" : "Creó"} el barrio ${data.nombre}`,
  });

  revalidatePath("/barrios");
  revalidatePath("/participantes", "layout");
  return { ok: id ? "Barrio actualizado." : "Barrio creado.", barrio: data as BarrioResumen };
}

export async function eliminarBarrio(id: string): Promise<EstadoBarrio> {
  const permiso = await validarPermiso("barrios.eliminar");
  if (!permiso.ok) return { error: permiso.error };

  const supabase = await createClient();
  const { count } = await supabase.from("participantes").select("id", { count: "exact", head: true }).eq("barrio_id", id);
  if (count) return { error: `Tiene ${count} participante(s). Cámbialos de barrio antes de eliminarlo.` };

  const { data, error } = await supabase.from("barrios").delete().eq("id", id).select("nombre").maybeSingle();
  if (error) return { error: "No se pudo eliminar el barrio." };
  if (!data) return { error: "El barrio no existe o no tienes permiso." };

  await registrarAuditoria(permiso.sesion, {
    accion: "barrio.eliminar",
    entidad: "barrio",
    entidadId: id,
    resumen: `Eliminó el barrio ${data.nombre}`,
  });
  revalidatePath("/barrios");
  return { ok: "Barrio eliminado." };
}
