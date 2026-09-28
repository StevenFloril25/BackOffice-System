"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { registrarAuditoria } from "@/lib/auditoria";
import { mensajeBd } from "@/lib/errores";
import { nombreCompania } from "@/lib/organizacion-comun";
import { validarPermiso } from "@/lib/sesion";
import { createAdminClient } from "@/lib/supabase/admin";
import { erroresDe, leerCampos, textoOpcional } from "@/lib/validacion";

export interface EstadoCompania {
  ok?: string;
  error?: string;
  errores?: Record<string, string>;
  valores?: Record<string, string>;
}

const esquema = z.object({
  numero: z.coerce
    .number({ message: "Escribe el número." })
    .int("Solo números enteros.")
    .min(1, "Desde 1.")
    .max(999, "Hasta 999."),
  nombre: z.string().trim().max(60, "Máximo 60 caracteres."),
  notas: textoOpcional(500),
});

const ids = z.array(z.uuid()).min(1, "Elige al menos a uno.").max(500);

function refrescar(id?: string) {
  revalidatePath("/companias");
  if (id) revalidatePath(`/companias/${id}`);
  revalidatePath("/consejeros", "layout");
  revalidatePath("/participantes", "layout");
  revalidatePath("/habitaciones", "layout");
}

export async function guardarCompania(id: string | null, _previo: EstadoCompania | undefined, formData: FormData): Promise<EstadoCompania> {
  const permiso = await validarPermiso(id ? "companias.editar" : "companias.crear");
  if (!permiso.ok) return { error: permiso.error };

  const valores = leerCampos(formData, ["numero", "nombre", "notas"]);
  const datos = esquema.safeParse(valores);
  if (!datos.success) return { errores: erroresDe(datos.error), valores };

  const admin = createAdminClient();
  const consulta = id ? admin.from("companias").update(datos.data).eq("id", id) : admin.from("companias").insert(datos.data);
  const { data, error } = await consulta.select("id, numero, nombre").single();
  if (error) {
    if (error.code === "23505") return { errores: { numero: `Ya existe la compañía ${datos.data.numero}.` }, valores };
    return { error: mensajeBd(error, "No se pudo guardar la compañía."), valores };
  }

  await registrarAuditoria(permiso.sesion, {
    accion: id ? "compania.editar" : "compania.crear",
    entidad: "compania",
    entidadId: data.id,
    resumen: `${id ? "Editó" : "Creó"} la ${nombreCompania(data)}`,
  });
  refrescar(data.id);
  return { ok: id ? "Compañía actualizada." : `${nombreCompania(data)} creada.` };
}

/** Crea varias compañías seguidas, numeradas a partir de la última. */
export async function crearVariasCompanias(_previo: EstadoCompania | undefined, formData: FormData): Promise<EstadoCompania> {
  const permiso = await validarPermiso("companias.crear");
  if (!permiso.ok) return { error: permiso.error };

  const valores = leerCampos(formData, ["cantidad"]);
  const cantidad = z.coerce.number().int().min(1).max(50).safeParse(valores.cantidad);
  if (!cantidad.success) return { errores: { cantidad: "Entre 1 y 50." }, valores };

  const admin = createAdminClient();
  const { data: ultima } = await admin.from("companias").select("numero").order("numero", { ascending: false }).limit(1).maybeSingle();
  const desde = (ultima?.numero ?? 0) + 1;
  const hasta = desde + cantidad.data - 1;
  if (hasta > 999) return { errores: { cantidad: "Pasaría de la compañía 999." }, valores };

  const filas = Array.from({ length: cantidad.data }, (_, i) => ({ numero: desde + i }));
  const { error } = await admin.from("companias").insert(filas);
  if (error) return { error: mensajeBd(error, "No se pudieron crear. Si alguien más estaba creando compañías, intenta de nuevo."), valores };

  await registrarAuditoria(permiso.sesion, {
    accion: "compania.crear",
    entidad: "compania",
    resumen: `Creó ${cantidad.data === 1 ? `la compañía ${desde}` : `las compañías ${desde} a ${hasta}`}`,
  });
  refrescar();
  return { ok: cantidad.data === 1 ? `Se creó la compañía ${desde}.` : `Se crearon las compañías ${desde} a ${hasta}.` };
}

export async function eliminarCompania(id: string): Promise<EstadoCompania> {
  const permiso = await validarPermiso("companias.eliminar");
  if (!permiso.ok) return { error: permiso.error };

  const admin = createAdminClient();
  const { count } = await admin.from("participantes").select("id", { count: "exact", head: true }).eq("compania_id", id);
  if (count) return { error: `Tiene ${count} ${count === 1 ? "joven" : "jóvenes"}. Quítalos de la compañía antes de eliminarla.` };

  const { data, error } = await admin.from("companias").delete().eq("id", id).select("numero, nombre").maybeSingle();
  if (error) return { error: mensajeBd(error, "No se pudo eliminar la compañía.") };
  if (!data) return { error: "La compañía no existe." };

  await registrarAuditoria(permiso.sesion, {
    accion: "compania.eliminar",
    entidad: "compania",
    entidadId: id,
    resumen: `Eliminó la ${nombreCompania(data)}`,
  });
  refrescar();
  redirect("/companias?aviso=eliminada");
}

/** Pone (o quita, con null) al consejero o a la consejera de la compañía. */
export async function asignarConsejero(
  companiaId: string,
  lugar: "consejero" | "consejera",
  consejeroId: string | null,
): Promise<EstadoCompania> {
  const permiso = await validarPermiso("companias.editar");
  if (!permiso.ok) return { error: permiso.error };
  if (consejeroId !== null && !z.uuid().safeParse(consejeroId).success) return { error: "Elige de la lista." };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("companias")
    .update(lugar === "consejero" ? { consejero_id: consejeroId } : { consejera_id: consejeroId })
    .eq("id", companiaId)
    .select("numero, nombre")
    .maybeSingle();
  if (error) {
    if (error.code === "23505") return { error: `Ya está en otra compañía. Quítalo de allá primero.` };
    return { error: mensajeBd(error, "No se pudo asignar.") };
  }
  if (!data) return { error: "La compañía no existe." };

  let quien = "";
  if (consejeroId) {
    const { data: c } = await admin.from("consejeros").select("nombres, apellidos").eq("id", consejeroId).maybeSingle();
    quien = c ? `${c.nombres} ${c.apellidos}` : "";
  }
  await registrarAuditoria(permiso.sesion, {
    accion: "compania.consejero",
    entidad: "compania",
    entidadId: companiaId,
    resumen: consejeroId
      ? `Asignó a ${quien} como ${lugar} de la ${nombreCompania(data)}`
      : `Dejó sin ${lugar} la ${nombreCompania(data)}`,
  });
  refrescar(companiaId);
  return { ok: consejeroId ? `${lugar === "consejero" ? "Consejero asignado" : "Consejera asignada"}.` : "Lugar libre." };
}

/**
 * Agrega jóvenes a la compañía. Solo toma a los que no tienen compañía: si
 * alguien lo asignó a otra mientras se elegía, no se lo mueve sin avisar.
 */
export async function agregarJovenes(companiaId: string, participantes: string[]): Promise<EstadoCompania> {
  const permiso = await validarPermiso("companias.editar");
  if (!permiso.ok) return { error: permiso.error };
  const lista = ids.safeParse(participantes);
  if (!lista.success) return { error: "Elige al menos a uno." };

  const admin = createAdminClient();
  const { data: compania } = await admin.from("companias").select("numero, nombre").eq("id", companiaId).maybeSingle();
  if (!compania) return { error: "La compañía no existe." };

  const { data, error } = await admin
    .from("participantes")
    .update({ compania_id: companiaId })
    .in("id", lista.data)
    .is("compania_id", null)
    .select("id");
  if (error) return { error: mensajeBd(error, "No se pudieron agregar.") };

  const agregados = data?.length ?? 0;
  await registrarAuditoria(permiso.sesion, {
    accion: "compania.jovenes",
    entidad: "compania",
    entidadId: companiaId,
    resumen: `Agregó ${agregados} ${agregados === 1 ? "joven" : "jóvenes"} a la ${nombreCompania(compania)}`,
  });
  refrescar(companiaId);
  const omitidos = lista.data.length - agregados;
  return omitidos > 0
    ? { ok: `Se agregaron ${agregados}. ${omitidos} ya estaba${omitidos === 1 ? "" : "n"} en otra compañía.` }
    : { ok: `Se agregaron ${agregados}.` };
}

export async function quitarJoven(companiaId: string, participanteId: string): Promise<EstadoCompania> {
  const permiso = await validarPermiso("companias.editar");
  if (!permiso.ok) return { error: permiso.error };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("participantes")
    .update({ compania_id: null })
    .eq("id", participanteId)
    .eq("compania_id", companiaId)
    .select("nombres, apellidos")
    .maybeSingle();
  if (error) return { error: mensajeBd(error, "No se pudo quitar.") };
  if (!data) return { error: "Ya no estaba en esta compañía." };

  await registrarAuditoria(permiso.sesion, {
    accion: "compania.jovenes",
    entidad: "compania",
    entidadId: companiaId,
    resumen: `Quitó a ${data.nombres} ${data.apellidos} de su compañía`,
  });
  refrescar(companiaId);
  return { ok: "Quitado de la compañía." };
}
