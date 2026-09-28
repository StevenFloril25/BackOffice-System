"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { registrarAuditoria } from "@/lib/auditoria";
import { mensajeBd } from "@/lib/errores";
import { validarPermiso } from "@/lib/sesion";
import { createAdminClient } from "@/lib/supabase/admin";
import { erroresDe, leerCampos, textoOpcional } from "@/lib/validacion";

export interface EstadoHabitacion {
  ok?: string;
  error?: string;
  errores?: Record<string, string>;
  valores?: Record<string, string>;
}

const sexo = z.enum(["Hombre", "Mujer"], { message: "Elige si es de mujeres o de hombres." });
const camas = (min: number) =>
  z.coerce
    .number({ message: "Escribe cuántas camas." })
    .int("Solo números enteros.")
    .min(min, min === 0 ? "No puede ser negativo." : `Al menos ${min}.`)
    .max(60, "Hasta 60.");
const piso = z.coerce.number({ message: "Escribe el piso." }).int("Solo números enteros.").min(0, "Desde 0.").max(60, "Hasta 60.");

const esquemaEdificio = z.object({
  nombre: z.string().trim().min(2, "Escribe el nombre del edificio.").max(60, "Máximo 60 caracteres."),
  sexo,
  notas: textoOpcional(500),
});

/** Al crear un edificio se arman sus pisos: dormitorio de jóvenes y habitación de líderes. */
const esquemaPisos = z.object({
  pisos: z.coerce.number({ message: "Escribe cuántos pisos." }).int().min(0, "Desde 0.").max(20, "Hasta 20."),
  camas_jovenes: camas(0),
  camas_lideres: camas(0),
});

const esquemaPiso = z
  .object({ edificio_id: z.uuid("Elige el edificio."), piso, camas_jovenes: camas(0), camas_lideres: camas(0) })
  .refine((v) => v.camas_jovenes + v.camas_lideres > 0, { message: "Pon camas en al menos una habitación.", path: ["camas_jovenes"] });

const esquemaHabitacion = z.object({
  edificio_id: z.uuid("Elige el edificio."),
  piso,
  nombre: z.string().trim().min(1, "Escribe el nombre.").max(40, "Máximo 40 caracteres."),
  tipo: z.enum(["jovenes", "lideres"], { message: "Elige para quién es." }),
  capacidad: camas(1),
  notas: textoOpcional(500),
});

const ids = z.array(z.uuid()).min(1).max(60);

function refrescar(id?: string) {
  revalidatePath("/habitaciones");
  if (id) revalidatePath(`/habitaciones/${id}`);
  revalidatePath("/consejeros", "layout");
  revalidatePath("/participantes", "layout");
  revalidatePath("/companias", "layout");
}

function habitacionesDePiso(edificio_id: string, numero: number, jovenes: number, lideres: number) {
  return [
    ...(jovenes > 0 ? [{ edificio_id, piso: numero, nombre: "Jóvenes", tipo: "jovenes", capacidad: jovenes }] : []),
    ...(lideres > 0 ? [{ edificio_id, piso: numero, nombre: "Líderes", tipo: "lideres", capacidad: lideres }] : []),
  ];
}

// ---------------------------------------------------------------------------
// Edificios
// ---------------------------------------------------------------------------

export async function guardarEdificio(id: string | null, _previo: EstadoHabitacion | undefined, formData: FormData): Promise<EstadoHabitacion> {
  const permiso = await validarPermiso(id ? "habitaciones.editar" : "habitaciones.crear");
  if (!permiso.ok) return { error: permiso.error };

  const valores = leerCampos(formData, ["nombre", "sexo", "notas", "pisos", "camas_jovenes", "camas_lideres"]);
  const datos = esquemaEdificio.safeParse(valores);
  const pisos = id ? null : esquemaPisos.safeParse(valores);
  if (!datos.success || (pisos && !pisos.success)) {
    return {
      errores: { ...(datos.success ? {} : erroresDe(datos.error)), ...(pisos && !pisos.success ? erroresDe(pisos.error) : {}) },
      valores,
    };
  }

  const admin = createAdminClient();
  const consulta = id ? admin.from("edificios").update(datos.data).eq("id", id) : admin.from("edificios").insert(datos.data);
  const { data, error } = await consulta.select("id, nombre").single();
  if (error) {
    if (error.code === "23505") return { errores: { nombre: "Ya hay un edificio con ese nombre." }, valores };
    return { error: mensajeBd(error, "No se pudo guardar el edificio."), valores };
  }

  if (pisos?.success && pisos.data.pisos > 0) {
    const { pisos: n, camas_jovenes, camas_lideres } = pisos.data;
    const filas = Array.from({ length: n }, (_, i) => habitacionesDePiso(data.id, i + 1, camas_jovenes, camas_lideres)).flat();
    if (filas.length) {
      const { error: e2 } = await admin.from("habitaciones").insert(filas);
      if (e2) return { error: "Se creó el edificio, pero no sus pisos. Agrégalos con «Piso».", valores };
    }
  }

  await registrarAuditoria(permiso.sesion, {
    accion: id ? "edificio.editar" : "edificio.crear",
    entidad: "edificio",
    entidadId: data.id,
    resumen: `${id ? "Editó" : "Creó"} el edificio ${data.nombre}`,
  });
  refrescar();
  return { ok: id ? `Edificio ${data.nombre} actualizado.` : `Edificio ${data.nombre} creado.` };
}

/** Elimina un edificio con sus habitaciones, solo si nadie duerme ahí. */
export async function eliminarEdificio(id: string): Promise<EstadoHabitacion> {
  const permiso = await validarPermiso("habitaciones.eliminar");
  if (!permiso.ok) return { error: permiso.error };

  const admin = createAdminClient();
  const { data, error } = await admin.from("edificios").delete().eq("id", id).select("nombre").maybeSingle();
  // Las habitaciones se van en cascada; si alguna tiene gente, la base lo impide.
  if (error) return { error: error.code === "23503" ? "Hay gente asignada en este edificio: sácala antes de eliminarlo." : mensajeBd(error, "No se pudo eliminar.") };
  if (!data) return { error: "El edificio no existe." };

  await registrarAuditoria(permiso.sesion, { accion: "edificio.eliminar", entidad: "edificio", entidadId: id, resumen: `Eliminó el edificio ${data.nombre}` });
  refrescar();
  return { ok: `Edificio ${data.nombre} eliminado.` };
}

// ---------------------------------------------------------------------------
// Pisos
// ---------------------------------------------------------------------------

export async function crearPiso(_previo: EstadoHabitacion | undefined, formData: FormData): Promise<EstadoHabitacion> {
  const permiso = await validarPermiso("habitaciones.crear");
  if (!permiso.ok) return { error: permiso.error };

  const valores = leerCampos(formData, ["edificio_id", "piso", "camas_jovenes", "camas_lideres"]);
  const datos = esquemaPiso.safeParse(valores);
  if (!datos.success) return { errores: erroresDe(datos.error), valores };
  const { edificio_id, piso: numero, camas_jovenes, camas_lideres } = datos.data;

  const admin = createAdminClient();
  const [{ data: edificio }, { count }] = await Promise.all([
    admin.from("edificios").select("nombre").eq("id", edificio_id).maybeSingle(),
    admin.from("habitaciones").select("id", { count: "exact", head: true }).eq("edificio_id", edificio_id).eq("piso", numero),
  ]);
  if (!edificio) return { error: "El edificio no existe.", valores };
  if (count) return { errores: { piso: `El piso ${numero} ya existe. Para cambiar sus camas, abre sus habitaciones.` }, valores };

  const { error } = await admin.from("habitaciones").insert(habitacionesDePiso(edificio_id, numero, camas_jovenes, camas_lideres));
  if (error) return { error: mensajeBd(error, "No se pudo crear el piso."), valores };

  await registrarAuditoria(permiso.sesion, {
    accion: "habitacion.crear",
    entidad: "edificio",
    entidadId: edificio_id,
    resumen: `Agregó el piso ${numero} a ${edificio.nombre} (${camas_jovenes} camas de jóvenes, ${camas_lideres} de líderes)`,
  });
  refrescar();
  return { ok: `Piso ${numero} agregado a ${edificio.nombre}.` };
}

export async function eliminarPiso(edificioId: string, numero: number): Promise<EstadoHabitacion> {
  const permiso = await validarPermiso("habitaciones.eliminar");
  if (!permiso.ok) return { error: permiso.error };

  const admin = createAdminClient();
  const { data, error } = await admin.from("habitaciones").delete().eq("edificio_id", edificioId).eq("piso", numero).select("id");
  if (error) return { error: error.code === "23503" ? `Hay gente asignada en el piso ${numero}: sácala antes de quitarlo.` : mensajeBd(error, "No se pudo quitar el piso.") };
  if (!data?.length) return { error: "Ese piso ya no existe." };

  const { data: edificio } = await admin.from("edificios").select("nombre").eq("id", edificioId).maybeSingle();
  await registrarAuditoria(permiso.sesion, {
    accion: "habitacion.eliminar",
    entidad: "edificio",
    entidadId: edificioId,
    resumen: `Quitó el piso ${numero} de ${edificio?.nombre ?? "un edificio"}`,
  });
  refrescar();
  return { ok: `Piso ${numero} quitado.` };
}

// ---------------------------------------------------------------------------
// Habitaciones
// ---------------------------------------------------------------------------

export async function guardarHabitacion(
  id: string | null,
  _previo: EstadoHabitacion | undefined,
  formData: FormData,
): Promise<EstadoHabitacion> {
  const permiso = await validarPermiso(id ? "habitaciones.editar" : "habitaciones.crear");
  if (!permiso.ok) return { error: permiso.error };

  const valores = leerCampos(formData, ["edificio_id", "piso", "nombre", "tipo", "capacidad", "notas"]);
  const datos = esquemaHabitacion.safeParse(valores);
  if (!datos.success) return { errores: erroresDe(datos.error), valores };

  const admin = createAdminClient();
  const consulta = id ? admin.from("habitaciones").update(datos.data).eq("id", id) : admin.from("habitaciones").insert(datos.data);
  const { data, error } = await consulta.select("id, nombre, piso, edificio:edificios(nombre)").single();
  if (error) {
    if (error.code === "23505") return { errores: { nombre: "Ya existe una habitación con ese nombre en ese piso." }, valores };
    // Menos camas que gente, cambiar de tipo o de edificio con gente: lo explica la base.
    return { error: mensajeBd(error, "No se pudo guardar la habitación."), valores };
  }

  const edificio = (data.edificio as unknown as { nombre: string } | null)?.nombre ?? "";
  await registrarAuditoria(permiso.sesion, {
    accion: id ? "habitacion.editar" : "habitacion.crear",
    entidad: "habitacion",
    entidadId: data.id,
    resumen: `${id ? "Editó" : "Creó"} la habitación ${data.nombre} (${edificio}, piso ${data.piso})`,
  });
  refrescar(data.id);
  return { ok: id ? "Habitación actualizada." : `Habitación ${data.nombre} creada.` };
}

export async function eliminarHabitacion(id: string): Promise<EstadoHabitacion> {
  const permiso = await validarPermiso("habitaciones.eliminar");
  if (!permiso.ok) return { error: permiso.error };

  const admin = createAdminClient();
  const { data, error } = await admin.from("habitaciones").delete().eq("id", id).select("nombre, piso").maybeSingle();
  if (error) return { error: error.code === "23503" ? "Hay gente asignada: sácala antes de eliminarla." : mensajeBd(error, "No se pudo eliminar la habitación.") };
  if (!data) return { error: "La habitación no existe." };

  await registrarAuditoria(permiso.sesion, {
    accion: "habitacion.eliminar",
    entidad: "habitacion",
    entidadId: id,
    resumen: `Eliminó la habitación ${data.nombre} del piso ${data.piso}`,
  });
  refrescar();
  redirect("/habitaciones?aviso=eliminada");
}

// ---------------------------------------------------------------------------
// Quién duerme dónde
// ---------------------------------------------------------------------------

const TABLA = { participante: "participantes", consejero: "consejeros" } as const;

/**
 * Pone a varios en la habitación. Cupo, sexo del edificio y tipo de habitación
 * los revisa la base en la misma sentencia: si no entran todos, no entra
 * ninguno y se explica por qué. Solo toma a quienes no tienen cama, para no
 * mudar a nadie sin avisar.
 */
export async function agregarOcupantes(
  habitacionId: string,
  tipo: "participante" | "consejero",
  personas: string[],
): Promise<EstadoHabitacion> {
  const permiso = await validarPermiso("habitaciones.editar");
  if (!permiso.ok) return { error: permiso.error };
  const lista = ids.safeParse(personas);
  if (!lista.success) return { error: "Elige al menos a uno." };

  const admin = createAdminClient();
  const { data: hab } = await admin.from("habitaciones").select("nombre, piso, edificio:edificios(nombre)").eq("id", habitacionId).maybeSingle();
  if (!hab) return { error: "La habitación no existe." };

  const { data, error } = await admin
    .from(TABLA[tipo])
    .update({ habitacion_id: habitacionId })
    .in("id", lista.data)
    .is("habitacion_id", null)
    .select("id");
  if (error) return { error: mensajeBd(error, "No se pudieron agregar.") };

  const n = data?.length ?? 0;
  const lugar = `${(hab.edificio as unknown as { nombre: string } | null)?.nombre ?? ""}, piso ${hab.piso}, ${hab.nombre}`;
  await registrarAuditoria(permiso.sesion, {
    accion: "habitacion.ocupantes",
    entidad: "habitacion",
    entidadId: habitacionId,
    resumen: `Asignó ${n} ${tipo === "consejero" ? (n === 1 ? "consejero" : "consejeros") : n === 1 ? "joven" : "jóvenes"} a ${lugar}`,
  });
  refrescar(habitacionId);
  const omitidos = lista.data.length - n;
  return omitidos > 0
    ? { ok: `Se agregaron ${n}. ${omitidos} ya tenía${omitidos === 1 ? "" : "n"} cama.` }
    : { ok: n === 1 ? "Se agregó 1 persona." : `Se agregaron ${n} personas.` };
}

export async function quitarOcupante(habitacionId: string, tipo: "participante" | "consejero", id: string): Promise<EstadoHabitacion> {
  const permiso = await validarPermiso("habitaciones.editar");
  if (!permiso.ok) return { error: permiso.error };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from(TABLA[tipo])
    .update({ habitacion_id: null })
    .eq("id", id)
    .eq("habitacion_id", habitacionId)
    .select("nombres, apellidos")
    .maybeSingle();
  if (error) return { error: mensajeBd(error, "No se pudo quitar.") };
  if (!data) return { error: "Ya no estaba en esta habitación." };

  await registrarAuditoria(permiso.sesion, {
    accion: "habitacion.ocupantes",
    entidad: "habitacion",
    entidadId: habitacionId,
    resumen: `Sacó a ${data.nombres} ${data.apellidos} de su habitación`,
  });
  refrescar(habitacionId);
  return { ok: "Quitado de la habitación." };
}
