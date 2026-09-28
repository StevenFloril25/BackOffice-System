"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { registrarAuditoria } from "@/lib/auditoria";
import { mensajeBd } from "@/lib/errores";
import { borrarFoto, subirFoto } from "@/lib/fotos";
import { validarPermiso } from "@/lib/sesion";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  correoOpcional,
  erroresDe,
  fechaOpcional,
  idOpcional,
  leerCampos,
  telefonoOpcional,
  textoOpcional,
} from "@/lib/validacion";

export interface EstadoConsejero {
  ok?: string;
  error?: string;
  errores?: Record<string, string>;
  valores?: Record<string, string>;
}

const esquema = z.object({
  nombres: z.string().trim().min(2, "Escribe los nombres.").max(80),
  apellidos: z.string().trim().min(2, "Escribe los apellidos.").max(80),
  sexo: z.enum(["Hombre", "Mujer"], { message: "Elige si es consejero (hombre) o consejera (mujer)." }),
  fecha_nacimiento: fechaOpcional,
  telefono: telefonoOpcional,
  correo: correoOpcional,
  barrio_id: idOpcional,
  talla_camiseta: textoOpcional(20),
  contacto_emergencia_nombre: textoOpcional(120),
  contacto_emergencia_telefono: telefonoOpcional,
  notas: textoOpcional(1000),
});

const CAMPOS = Object.keys(esquema.shape);

function refrescar(id?: string) {
  revalidatePath("/consejeros");
  if (id) revalidatePath(`/consejeros/${id}`);
  revalidatePath("/companias", "layout");
  revalidatePath("/habitaciones", "layout");
}

export async function crearConsejero(_previo: EstadoConsejero | undefined, formData: FormData): Promise<EstadoConsejero> {
  const permiso = await validarPermiso("consejeros.crear");
  if (!permiso.ok) return { error: permiso.error };

  const valores = leerCampos(formData, CAMPOS);
  const datos = esquema.safeParse(valores);
  if (!datos.success) return { errores: erroresDe(datos.error), valores };

  const { data, error } = await createAdminClient().from("consejeros").insert(datos.data).select("id").single();
  if (error) return { error: mensajeBd(error, "No se pudo registrar al consejero."), valores };

  await registrarAuditoria(permiso.sesion, {
    accion: "consejero.crear",
    entidad: "consejero",
    entidadId: data.id,
    resumen: `Registró a ${datos.data.nombres} ${datos.data.apellidos} como ${datos.data.sexo === "Mujer" ? "consejera" : "consejero"}`,
  });
  refrescar();
  redirect(`/consejeros/${data.id}?aviso=creado`);
}

export async function actualizarConsejero(
  id: string,
  _previo: EstadoConsejero | undefined,
  formData: FormData,
): Promise<EstadoConsejero> {
  const permiso = await validarPermiso("consejeros.editar");
  if (!permiso.ok) return { error: permiso.error };

  const valores = leerCampos(formData, CAMPOS);
  const datos = esquema.safeParse(valores);
  if (!datos.success) return { errores: erroresDe(datos.error), valores };

  const { data, error } = await createAdminClient().from("consejeros").update(datos.data).eq("id", id).select("id").maybeSingle();
  // Cambiar el sexo de quien ya tiene compañía o habitación lo frena la base, con su explicación.
  if (error) return { error: mensajeBd(error, "No se pudieron guardar los cambios."), valores };
  if (!data) return { error: "El consejero no existe." };

  await registrarAuditoria(permiso.sesion, {
    accion: "consejero.editar",
    entidad: "consejero",
    entidadId: id,
    resumen: `Editó a ${datos.data.nombres} ${datos.data.apellidos}`,
  });
  refrescar(id);
  return { ok: "Cambios guardados." };
}

export async function eliminarConsejero(id: string): Promise<EstadoConsejero> {
  const permiso = await validarPermiso("consejeros.eliminar");
  if (!permiso.ok) return { error: permiso.error };

  const admin = createAdminClient();
  const { data } = await admin.from("consejeros").select("nombres, apellidos, foto_path").eq("id", id).maybeSingle();
  if (!data) return { error: "El consejero no existe." };

  // Su lugar en la compañía queda libre (on delete set null) y su cama también.
  const { error } = await admin.from("consejeros").delete().eq("id", id);
  if (error) return { error: mensajeBd(error, "No se pudo eliminar.") };
  await borrarFoto(data.foto_path);

  await registrarAuditoria(permiso.sesion, {
    accion: "consejero.eliminar",
    entidad: "consejero",
    entidadId: id,
    resumen: `Eliminó a ${data.nombres} ${data.apellidos}`,
  });
  refrescar();
  redirect("/consejeros?aviso=eliminado");
}

export async function subirFotoConsejero(id: string, datos: FormData): Promise<EstadoConsejero> {
  const permiso = await validarPermiso("consejeros.editar");
  if (!permiso.ok) return { error: permiso.error };

  const admin = createAdminClient();
  const { data } = await admin.from("consejeros").select("foto_path, nombres, apellidos").eq("id", id).maybeSingle();
  if (!data) return { error: "El consejero no existe." };

  const subida = await subirFoto("consejeros", id, datos.get("foto"));
  if ("error" in subida) return { error: subida.error };

  const { error } = await admin.from("consejeros").update({ foto_path: subida.path }).eq("id", id);
  if (error) {
    await borrarFoto(subida.path);
    return { error: "No se pudo guardar la foto." };
  }
  await borrarFoto(data.foto_path);
  await registrarAuditoria(permiso.sesion, {
    accion: "consejero.foto",
    entidad: "consejero",
    entidadId: id,
    resumen: `Cambió la foto de ${data.nombres} ${data.apellidos}`,
  });
  refrescar(id);
  return { ok: "Foto actualizada." };
}

export async function quitarFotoConsejero(id: string): Promise<EstadoConsejero> {
  const permiso = await validarPermiso("consejeros.editar");
  if (!permiso.ok) return { error: permiso.error };

  const admin = createAdminClient();
  const { data } = await admin.from("consejeros").select("foto_path").eq("id", id).maybeSingle();
  if (!data?.foto_path) return { ok: "No tenía foto." };
  await admin.from("consejeros").update({ foto_path: null }).eq("id", id);
  await borrarFoto(data.foto_path);
  refrescar(id);
  return { ok: "Foto quitada." };
}
