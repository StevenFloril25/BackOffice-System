"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { registrarAuditoria } from "@/lib/auditoria";
import { hora, sumarDias } from "@/lib/agenda";
import { mensajeBd } from "@/lib/errores";
import { validarPermiso } from "@/lib/sesion";
import { createAdminClient } from "@/lib/supabase/admin";
import { erroresDe, fechaOpcional, leerCampos, textoOpcional } from "@/lib/validacion";

export interface EstadoAgenda {
  ok?: string;
  error?: string;
  errores?: Record<string, string>;
  valores?: Record<string, string>;
}

const horaOpcional = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{2}:\d{2}(:\d{2})?$/.test(v), { message: "Hora no válida." })
  .transform((v) => (v ? v.slice(0, 5) : null));

const esquemaActividad = z
  .object({
    dia: z.coerce.number({ message: "Elige el día." }).int().min(0, "Elige el día.").max(10, "Elige el día."),
    hora_inicio: horaOpcional,
    hora_fin: horaOpcional,
    actividad: z.string().trim().min(2, "Escribe la actividad.").max(200, "Máximo 200 caracteres."),
    lugar: textoOpcional(100),
    solo_personal: z.boolean(),
  })
  .refine((v) => !v.hora_fin || v.hora_inicio, { message: "Pon primero la hora de inicio.", path: ["hora_inicio"] })
  .refine((v) => !v.hora_fin || !v.hora_inicio || v.hora_fin >= v.hora_inicio, {
    message: "Termina antes de empezar.",
    path: ["hora_fin"],
  });

const esquemaDia = z.object({ vestimenta: textoOpcional(100), notas: textoOpcional(500) });

function refrescar() {
  revalidatePath("/agenda");
  revalidatePath("/inicio");
}

export async function guardarActividad(id: string | null, _previo: EstadoAgenda | undefined, formData: FormData): Promise<EstadoAgenda> {
  const permiso = await validarPermiso("agenda.editar");
  if (!permiso.ok) return { error: permiso.error };

  const valores = leerCampos(formData, ["dia", "hora_inicio", "hora_fin", "actividad", "lugar"]);
  const personal = formData.get("solo_personal") === "on";
  const datos = esquemaActividad.safeParse({ ...valores, solo_personal: personal });
  if (!datos.success) return { errores: erroresDe(datos.error), valores: { ...valores, solo_personal: personal ? "on" : "" } };

  const admin = createAdminClient();
  const consulta = id ? admin.from("agenda").update(datos.data).eq("id", id) : admin.from("agenda").insert(datos.data);
  const { data, error } = await consulta.select("id").maybeSingle();
  if (error) return { error: mensajeBd(error, "No se pudo guardar la actividad."), valores };
  if (!data) return { error: "La actividad ya no existe." };

  await registrarAuditoria(permiso.sesion, {
    accion: id ? "agenda.editar" : "agenda.crear",
    entidad: "agenda",
    entidadId: data.id,
    resumen: `${id ? "Editó" : "Agregó"} en la agenda del día ${datos.data.dia}: ${datos.data.hora_inicio ? `${hora(datos.data.hora_inicio)} ` : ""}${datos.data.actividad}`,
  });
  refrescar();
  return { ok: id ? "Actividad actualizada." : "Actividad agregada." };
}

export async function eliminarActividad(id: string): Promise<EstadoAgenda> {
  const permiso = await validarPermiso("agenda.editar");
  if (!permiso.ok) return { error: permiso.error };

  const { data, error } = await createAdminClient().from("agenda").delete().eq("id", id).select("dia, actividad").maybeSingle();
  if (error) return { error: mensajeBd(error, "No se pudo quitar la actividad.") };
  if (!data) return { error: "La actividad ya no existe." };

  await registrarAuditoria(permiso.sesion, {
    accion: "agenda.eliminar",
    entidad: "agenda",
    entidadId: id,
    resumen: `Quitó de la agenda del día ${data.dia}: ${data.actividad}`,
  });
  refrescar();
  return { ok: "Actividad quitada." };
}

export async function guardarDia(dia: number, _previo: EstadoAgenda | undefined, formData: FormData): Promise<EstadoAgenda> {
  const permiso = await validarPermiso("agenda.editar");
  if (!permiso.ok) return { error: permiso.error };

  const valores = leerCampos(formData, ["vestimenta", "notas"]);
  const datos = esquemaDia.safeParse(valores);
  if (!datos.success) return { errores: erroresDe(datos.error), valores };

  const { data, error } = await createAdminClient().from("agenda_dias").update(datos.data).eq("dia", dia).select("dia").maybeSingle();
  if (error) return { error: mensajeBd(error, "No se pudo guardar el día."), valores };
  if (!data) return { error: "Ese día no existe." };

  await registrarAuditoria(permiso.sesion, {
    accion: "agenda.dia",
    entidad: "agenda",
    resumen: `Cambió la ropa o las notas del día ${dia}${datos.data.vestimenta ? ` (${datos.data.vestimenta})` : ""}`,
  });
  refrescar();
  return { ok: "Día actualizado." };
}

/** Pone la fecha del día 0; los demás días van seguidos. Vacío quita las fechas. */
export async function guardarFechas(_previo: EstadoAgenda | undefined, formData: FormData): Promise<EstadoAgenda> {
  const permiso = await validarPermiso("agenda.editar");
  if (!permiso.ok) return { error: permiso.error };

  const valores = leerCampos(formData, ["inicio"]);
  const inicio = fechaOpcional.safeParse(valores.inicio);
  if (!inicio.success) return { errores: { inicio: "Fecha no válida." }, valores };

  const admin = createAdminClient();
  const { data: dias, error: errorDias } = await admin.from("agenda_dias").select("dia");
  if (errorDias) return { error: "No se pudieron cargar los días.", valores };
  for (const { dia } of dias ?? []) {
    const { error } = await admin
      .from("agenda_dias")
      .update({ fecha: inicio.data ? sumarDias(inicio.data, dia) : null })
      .eq("dia", dia);
    if (error) return { error: mensajeBd(error, "No se pudieron guardar las fechas."), valores };
  }

  await registrarAuditoria(permiso.sesion, {
    accion: "agenda.fechas",
    entidad: "agenda",
    resumen: inicio.data ? `Puso las fechas de la sesión: el día 0 es el ${inicio.data}` : "Quitó las fechas de la sesión",
  });
  refrescar();
  return { ok: inicio.data ? "Fechas guardadas." : "Fechas quitadas." };
}
