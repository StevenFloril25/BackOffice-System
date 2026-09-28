"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { registrarAuditoria } from "@/lib/auditoria";
import { mensajeBd } from "@/lib/errores";
import { borrarFoto, subirFoto } from "@/lib/fotos";
import { validarPermiso } from "@/lib/sesion";
import { createAdminClient } from "@/lib/supabase/admin";
import { correoOpcional, erroresDe, leerCampos, textoOpcional } from "@/lib/validacion";

export interface EstadoInforme {
  ok?: string;
  error?: string;
  errores?: Record<string, string>;
  valores?: Record<string, string>;
}

const cantidad = z.coerce
  .number({ message: "Escribe un número." })
  .int("Solo números enteros.")
  .min(0, "No puede ser negativo.")
  .max(5000, "Hasta 5000.");

const esquemaConteos = z.object({ sesiones: cantidad, coordinadores: cantidad, otros_jovenes_adultos: cantidad });

const esquemaTestimonio = z.object({
  autor: textoOpcional(100),
  tipo: z.enum(["joven", "joven_adulto"], { message: "Elige quién lo dio." }),
  texto: z.string().trim().min(5, "Escribe el testimonio.").max(3000, "Máximo 3000 caracteres."),
});

const esquemaFoto = z.object({
  fotografo_nombre: z.string().trim().min(2, "Escribe quién tomó la foto.").max(100, "Máximo 100 caracteres."),
  fotografo_correo: correoOpcional,
  descripcion: textoOpcional(300),
});

const refrescar = () => revalidatePath("/informe");

export async function guardarConteos(_previo: EstadoInforme | undefined, formData: FormData): Promise<EstadoInforme> {
  const permiso = await validarPermiso("informe.editar");
  if (!permiso.ok) return { error: permiso.error };

  const valores = leerCampos(formData, ["sesiones", "coordinadores", "otros_jovenes_adultos"]);
  const datos = esquemaConteos.safeParse(valores);
  if (!datos.success) return { errores: erroresDe(datos.error), valores };

  const filas = Object.entries(datos.data).map(([clave, valor]) => ({ clave, valor, updated_at: new Date().toISOString() }));
  const { error } = await createAdminClient().from("informe_conteos").upsert(filas);
  if (error) return { error: mensajeBd(error, "No se pudo guardar."), valores };

  await registrarAuditoria(permiso.sesion, {
    accion: "informe.conteos",
    entidad: "informe",
    resumen: `Anotó en el informe: ${datos.data.sesiones} sesiones, ${datos.data.coordinadores} coordinadores, ${datos.data.otros_jovenes_adultos} en otros puestos`,
  });
  refrescar();
  return { ok: "Guardado.", valores };
}

export async function agregarTestimonio(_previo: EstadoInforme | undefined, formData: FormData): Promise<EstadoInforme> {
  const permiso = await validarPermiso("informe.editar");
  if (!permiso.ok) return { error: permiso.error };

  const valores = leerCampos(formData, ["autor", "tipo", "texto"]);
  const datos = esquemaTestimonio.safeParse(valores);
  if (!datos.success) return { errores: erroresDe(datos.error), valores };

  const { data, error } = await createAdminClient()
    .from("informe_testimonios")
    .insert({ ...datos.data, created_by: permiso.sesion.id })
    .select("id")
    .single();
  if (error) return { error: mensajeBd(error, "No se pudo guardar el testimonio."), valores };

  await registrarAuditoria(permiso.sesion, {
    accion: "informe.testimonio",
    entidad: "informe",
    entidadId: data.id,
    resumen: `Agregó un testimonio al informe${datos.data.autor ? ` (${datos.data.autor})` : ""}`,
  });
  refrescar();
  return { ok: "Testimonio agregado." };
}

export async function eliminarTestimonio(id: string): Promise<EstadoInforme> {
  const permiso = await validarPermiso("informe.editar");
  if (!permiso.ok) return { error: permiso.error };

  const { data, error } = await createAdminClient().from("informe_testimonios").delete().eq("id", id).select("autor").maybeSingle();
  if (error) return { error: mensajeBd(error, "No se pudo quitar.") };
  if (!data) return { error: "Ya no existe." };

  await registrarAuditoria(permiso.sesion, {
    accion: "informe.testimonio",
    entidad: "informe",
    entidadId: id,
    resumen: `Quitó un testimonio del informe${data.autor ? ` (${data.autor})` : ""}`,
  });
  refrescar();
  return { ok: "Testimonio quitado." };
}

/** La foto llega ya reducida desde el navegador (ver cliente.tsx). */
export async function subirFotoInforme(_previo: EstadoInforme | undefined, formData: FormData): Promise<EstadoInforme> {
  const permiso = await validarPermiso("informe.editar");
  if (!permiso.ok) return { error: permiso.error };

  const valores = leerCampos(formData, ["fotografo_nombre", "fotografo_correo", "descripcion"]);
  const datos = esquemaFoto.safeParse(valores);
  if (!datos.success) return { errores: erroresDe(datos.error), valores };

  const id = randomUUID();
  const subida = await subirFoto("informe", id, formData.get("foto"));
  if ("error" in subida) return { errores: { foto: subida.error }, valores };

  const { error } = await createAdminClient()
    .from("informe_fotos")
    .insert({ id, path: subida.path, ...datos.data, created_by: permiso.sesion.id });
  if (error) {
    await borrarFoto(subida.path);
    return { error: mensajeBd(error, "No se pudo guardar la foto."), valores };
  }

  await registrarAuditoria(permiso.sesion, {
    accion: "informe.foto",
    entidad: "informe",
    entidadId: id,
    resumen: `Agregó una foto al informe (de ${datos.data.fotografo_nombre})`,
  });
  refrescar();
  // Se conserva el fotógrafo: lo normal es subir varias fotos suyas seguidas.
  return { ok: "Foto agregada.", valores: { fotografo_nombre: valores.fotografo_nombre, fotografo_correo: valores.fotografo_correo, descripcion: "" } };
}

export async function eliminarFotoInforme(id: string): Promise<EstadoInforme> {
  const permiso = await validarPermiso("informe.editar");
  if (!permiso.ok) return { error: permiso.error };

  const { data, error } = await createAdminClient().from("informe_fotos").delete().eq("id", id).select("path, fotografo_nombre").maybeSingle();
  if (error) return { error: mensajeBd(error, "No se pudo quitar.") };
  if (!data) return { error: "Ya no existe." };
  await borrarFoto(data.path);

  await registrarAuditoria(permiso.sesion, {
    accion: "informe.foto",
    entidad: "informe",
    entidadId: id,
    resumen: `Quitó una foto del informe (de ${data.fotografo_nombre})`,
  });
  refrescar();
  return { ok: "Foto quitada." };
}
