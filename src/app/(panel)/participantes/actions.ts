"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { registrarAuditoria } from "@/lib/auditoria";
import { borrarFoto, subirFoto } from "@/lib/fotos";
import { importarParticipantes, type ResumenImportacion } from "@/lib/importar-participantes";
import { CAMPOS_SALUD, claveParticipante } from "@/lib/participantes";
import { obtenerSesion, puede, validarPermiso } from "@/lib/sesion";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export interface EstadoParticipante {
  ok?: string;
  error?: string;
  errores?: Record<string, string>;
  valores?: Record<string, string>;
}

const texto = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres.`)
    .transform((v) => v || null);
const telefono = z
  .string()
  .trim()
  .max(25, "Máximo 25 caracteres.")
  .regex(/^[\d\s+()-]*$/, "Solo números, espacios y + ( ) -.")
  .transform((v) => v || null);
const correo = z
  .string()
  .trim()
  .toLowerCase()
  .refine((v) => v === "" || z.email().safeParse(v).success, { message: "Correo no válido." })
  .transform((v) => v || null);

const esquema = z.object({
  nombres: z.string().trim().min(2, "Escribe los nombres.").max(80),
  apellidos: z.string().trim().min(2, "Escribe los apellidos.").max(80),
  nombre_preferido: z.string().trim().max(120),
  fecha_nacimiento: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), { message: "Fecha no válida." })
    .transform((v) => v || null),
  sexo: z.enum(["Hombre", "Mujer", ""]).transform((v) => v || null),
  telefono,
  correo,
  talla_camiseta: texto(20),
  barrio_id: z.string().min(1, "Elige el barrio.").pipe(z.uuid("Barrio no válido.")),
  contacto1_nombre: texto(120),
  contacto1_correo: correo,
  contacto1_telefono: telefono,
  contacto2_nombre: texto(120),
  contacto2_correo: correo,
  contacto2_telefono: telefono,
});

const CAMPOS = [...Object.keys(esquema.shape), ...CAMPOS_SALUD.map((c) => c.clave)];

function leer(formData: FormData) {
  return Object.fromEntries(CAMPOS.map((c) => [c, String(formData.get(c) ?? "")]));
}

function erroresDe(error: z.ZodError) {
  const salida: Record<string, string> = {};
  for (const i of error.issues) salida[String(i.path[0])] ??= i.message;
  return salida;
}

function salud(valores: Record<string, string>) {
  return Object.fromEntries(CAMPOS_SALUD.map((c) => [c.clave, valores[c.clave]?.trim() || null]));
}

function mensajeDuplicado(message: string) {
  return /clave_importacion/.test(message)
    ? "Ya hay un participante con esos nombres, apellidos y fecha de nacimiento."
    : null;
}

// ---------------------------------------------------------------------------

export async function crearParticipante(_previo: EstadoParticipante | undefined, formData: FormData): Promise<EstadoParticipante> {
  const permiso = await validarPermiso("participantes.crear");
  if (!permiso.ok) return { error: permiso.error };
  const { sesion } = permiso;

  const valores = leer(formData);
  const datos = esquema.safeParse(valores);
  if (!datos.success) return { errores: erroresDe(datos.error), valores };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("participantes")
    .insert({
      ...datos.data,
      origen: "manual",
      // Misma clave que usa la importación: si después aparece en el Excel, se
      // actualiza esta ficha en vez de duplicarla.
      clave_importacion: claveParticipante(datos.data.nombres, datos.data.apellidos, datos.data.fecha_nacimiento),
    })
    .select("id")
    .single();
  if (error) return { error: mensajeDuplicado(error.message) ?? "No se pudo guardar el participante.", valores };

  if (puede(sesion, "participantes.salud")) {
    await admin.from("participantes_salud").insert({ participante_id: data.id, ...salud(valores) });
  }

  await registrarAuditoria(sesion, {
    accion: "participante.crear",
    entidad: "participante",
    entidadId: data.id,
    resumen: `Registró a ${datos.data.nombres} ${datos.data.apellidos}`,
  });
  revalidatePath("/participantes");
  redirect(`/participantes/${data.id}?aviso=creado`);
}

export async function actualizarParticipante(
  id: string,
  _previo: EstadoParticipante | undefined,
  formData: FormData,
): Promise<EstadoParticipante> {
  const permiso = await validarPermiso("participantes.editar");
  if (!permiso.ok) return { error: permiso.error };
  const { sesion } = permiso;

  const valores = leer(formData);
  const datos = esquema.safeParse(valores);
  if (!datos.success) return { errores: erroresDe(datos.error), valores };

  const admin = createAdminClient();
  const { data: actual } = await admin.from("participantes").select("origen").eq("id", id).maybeSingle();
  if (!actual) return { error: "El participante no existe." };

  const { error } = await admin
    .from("participantes")
    .update({
      ...datos.data,
      // La clave de un importado se deja como vino del Excel: si aquí se corrige
      // una tilde del nombre, la próxima importación igual lo reconoce.
      ...(actual.origen === "manual"
        ? { clave_importacion: claveParticipante(datos.data.nombres, datos.data.apellidos, datos.data.fecha_nacimiento) }
        : {}),
    })
    .eq("id", id);
  if (error) return { error: mensajeDuplicado(error.message) ?? "No se pudieron guardar los cambios.", valores };

  if (puede(sesion, "participantes.salud")) {
    await admin.from("participantes_salud").upsert({ participante_id: id, ...salud(valores) }, { onConflict: "participante_id" });
  }

  await registrarAuditoria(sesion, {
    accion: "participante.editar",
    entidad: "participante",
    entidadId: id,
    resumen: `Editó a ${datos.data.nombres} ${datos.data.apellidos}`,
  });
  revalidatePath("/participantes");
  revalidatePath(`/participantes/${id}`);
  return { ok: "Cambios guardados." };
}

export async function eliminarParticipante(id: string): Promise<EstadoParticipante> {
  const permiso = await validarPermiso("participantes.eliminar");
  if (!permiso.ok) return { error: permiso.error };

  const admin = createAdminClient();
  const { data } = await admin.from("participantes").select("nombres, apellidos, foto_path").eq("id", id).maybeSingle();
  if (!data) return { error: "El participante no existe." };

  const { error } = await admin.from("participantes").delete().eq("id", id);
  if (error) return { error: "No se pudo eliminar." };
  await borrarFoto(data.foto_path);

  await registrarAuditoria(permiso.sesion, {
    accion: "participante.eliminar",
    entidad: "participante",
    entidadId: id,
    resumen: `Eliminó a ${data.nombres} ${data.apellidos}`,
  });
  revalidatePath("/participantes");
  redirect("/participantes?aviso=eliminado");
}

// ---------------------------------------------------------------------------
// Foto
// ---------------------------------------------------------------------------

export async function subirFotoParticipante(id: string, datos: FormData): Promise<EstadoParticipante> {
  const permiso = await validarPermiso("participantes.editar");
  if (!permiso.ok) return { error: permiso.error };

  const admin = createAdminClient();
  const { data } = await admin.from("participantes").select("foto_path, nombres, apellidos").eq("id", id).maybeSingle();
  if (!data) return { error: "El participante no existe." };

  const subida = await subirFoto("participantes", id, datos.get("foto"));
  if ("error" in subida) return { error: subida.error };

  const { error } = await admin.from("participantes").update({ foto_path: subida.path }).eq("id", id);
  if (error) {
    await borrarFoto(subida.path);
    return { error: "No se pudo guardar la foto." };
  }
  await borrarFoto(data.foto_path);
  await registrarAuditoria(permiso.sesion, {
    accion: "participante.foto",
    entidad: "participante",
    entidadId: id,
    resumen: `Cambió la foto de ${data.nombres} ${data.apellidos}`,
  });
  revalidatePath("/participantes");
  revalidatePath(`/participantes/${id}`);
  return { ok: "Foto actualizada." };
}

export async function quitarFotoParticipante(id: string): Promise<EstadoParticipante> {
  const permiso = await validarPermiso("participantes.editar");
  if (!permiso.ok) return { error: permiso.error };

  const admin = createAdminClient();
  const { data } = await admin.from("participantes").select("foto_path").eq("id", id).maybeSingle();
  if (!data?.foto_path) return { ok: "No tenía foto." };
  await admin.from("participantes").update({ foto_path: null }).eq("id", id);
  await borrarFoto(data.foto_path);
  revalidatePath("/participantes");
  revalidatePath(`/participantes/${id}`);
  return { ok: "Foto quitada." };
}

// ---------------------------------------------------------------------------
// Asistencia manual (búsqueda por nombre cuando no trae el QR, o corrección)
// ---------------------------------------------------------------------------

export async function marcarAsistencia(id: string, asistio: boolean): Promise<EstadoParticipante> {
  const permiso = await validarPermiso("asistencia.registrar");
  if (!permiso.ok) return { error: permiso.error };
  const supabase = await createClient();
  const { error } = await supabase.rpc("marcar_asistencia", { p_id: id, p_asistio: asistio });
  if (error) return { error: error.message };
  revalidatePath("/participantes");
  revalidatePath(`/participantes/${id}`);
  revalidatePath("/asistencia");
  return { ok: asistio ? "Asistencia registrada." : "Asistencia anulada." };
}

/** Casilla del kit en la ficha. La permite quien toma asistencia o edita participantes (lo valida marcar_kit). */
export async function marcarKit(id: string, entregado: boolean): Promise<EstadoParticipante & { entregado_at?: string | null }> {
  const sesion = await obtenerSesion();
  if (!sesion?.activo) return { error: "Tu sesión expiró. Vuelve a ingresar." };
  if (!puede(sesion, "asistencia.registrar") && !puede(sesion, "participantes.editar")) {
    return { error: "No tienes permiso para marcar el kit." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("marcar_kit", { p_id: id, p_entregado: entregado });
  if (error) return { error: "No se pudo guardar. Intenta de nuevo." };
  revalidatePath(`/participantes/${id}`);
  return { ok: entregado ? "Kit entregado." : "Kit pendiente.", entregado_at: (data as string | null) ?? null };
}

// ---------------------------------------------------------------------------
// Importación desde Excel
// ---------------------------------------------------------------------------

export interface EstadoImportacion {
  error?: string;
  resumen?: ResumenImportacion;
}

export async function importarExcel(_previo: EstadoImportacion | undefined, formData: FormData): Promise<EstadoImportacion> {
  const permiso = await validarPermiso("participantes.importar");
  if (!permiso.ok) return { error: permiso.error };

  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) return { error: "Elige el archivo de Excel." };
  if (!/\.xlsx$/i.test(archivo.name)) return { error: "El archivo debe ser .xlsx (Excel)." };
  if (archivo.size > 3.5 * 1024 * 1024) return { error: "El archivo supera 3,5 MB." };

  let resumen: ResumenImportacion;
  try {
    resumen = await importarParticipantes(archivo);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo leer el archivo." };
  }

  await registrarAuditoria(permiso.sesion, {
    accion: "participantes.importar",
    entidad: "participante",
    resumen: `Importó ${archivo.name}: ${resumen.nuevos} nuevos, ${resumen.actualizados} actualizados`,
    detalles: { ...resumen, archivo: archivo.name },
  });
  revalidatePath("/participantes");
  revalidatePath("/barrios");
  return { resumen };
}
