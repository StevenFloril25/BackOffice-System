"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { registrarAuditoria } from "@/lib/auditoria";
import { crearCuenta, mensajeAuth, perfilPorCorreo } from "@/lib/cuentas";
import { mensajeBd } from "@/lib/errores";
import { borrarFoto, subirFoto } from "@/lib/fotos";
import { nombreFuncion } from "@/lib/organizacion-comun";
import { validarPermiso, type Sesion } from "@/lib/sesion";
import { createAdminClient } from "@/lib/supabase/admin";
import { erroresDe, fechaOpcional, idOpcional, leerCampos, telefonoOpcional, textoOpcional } from "@/lib/validacion";

export interface EstadoConsejero {
  ok?: string;
  error?: string;
  errores?: Record<string, string>;
  valores?: Record<string, string>;
  /** Al registrar: la ficha nueva y los datos para ingresar, que se muestran UNA vez. */
  id?: string;
  email?: string;
  usuario?: string;
  clave?: string;
  /** Ya tenía cuenta con ese correo: se vinculó en vez de crear otra. */
  vinculada?: boolean;
}

/** El rol de la cuenta sigue a la función: consejero → Consejero; coordinador → Coordinador auxiliar. */
const ROLES_PROPIOS = ["consejero", "coordinador"] as const;
const rolDe = (funcion: Datos["funcion"]) => (funcion === "coordinador" ? "coordinador" : "consejero");

const esquema = z.object({
  funcion: z.enum(["consejero", "coordinador"], { message: "Elige si es consejero o coordinador auxiliar." }),
  nombres: z.string().trim().min(2, "Escribe los nombres.").max(80),
  apellidos: z.string().trim().min(2, "Escribe los apellidos.").max(80),
  sexo: z.enum(["Hombre", "Mujer"], { message: "Elige hombre o mujer." }),
  fecha_nacimiento: fechaOpcional,
  telefono: telefonoOpcional,
  // Obligatorio: con este correo (o su usuario) ingresa al sistema.
  correo: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Escribe su correo: con él ingresa al sistema.")
    .pipe(z.email("Correo no válido.")),
  barrio_id: idOpcional,
  talla_camiseta: textoOpcional(20),
  contacto_emergencia_nombre: textoOpcional(120),
  contacto_emergencia_telefono: telefonoOpcional,
  notas: textoOpcional(1000),
});

type Datos = z.infer<typeof esquema>;
const CAMPOS = Object.keys(esquema.shape);

function refrescar(id?: string) {
  revalidatePath("/consejeros");
  if (id) revalidatePath(`/consejeros/${id}`);
  revalidatePath("/companias", "layout");
  revalidatePath("/habitaciones", "layout");
  revalidatePath("/usuarios", "layout");
}

async function correoEnOtroConsejero(correo: string, salvo?: string) {
  let consulta = createAdminClient().from("consejeros").select("id").ilike("correo", correo);
  if (salvo) consulta = consulta.neq("id", salvo);
  const { data } = await consulta.limit(1);
  return (data?.length ?? 0) > 0;
}

/**
 * Le da cuenta a un consejero: si ya existe una con su correo, la vincula (sin
 * cambiarle el rol a quien ya tenía uno, p. ej. un administrador que también es
 * consejero); si no, crea una con el rol Consejero y contraseña temporal.
 */
async function cuentaPara(
  datos: Pick<Datos, "correo" | "nombres" | "apellidos" | "telefono" | "funcion">,
  sesion: Sesion,
): Promise<{ profileId: string; usuario: string | null; clave?: string; vinculada: boolean; creada: boolean } | { error: string }> {
  const existente = await perfilPorCorreo(datos.correo);
  if (existente) {
    const { data: ocupado } = await createAdminClient().from("consejeros").select("id").eq("profile_id", existente.id).maybeSingle();
    if (ocupado) return { error: "Esa cuenta ya es de otro consejero." };
    if (!existente.rolKey) {
      const { data: rol } = await createAdminClient().from("roles").select("id").eq("key", rolDe(datos.funcion)).single();
      await createAdminClient().from("profiles").update({ role_id: rol?.id }).eq("id", existente.id);
    }
    return { profileId: existente.id, usuario: existente.username, vinculada: true, creada: false };
  }
  const cuenta = await crearCuenta({
    email: datos.correo,
    nombre: `${datos.nombres} ${datos.apellidos}`,
    telefono: datos.telefono,
    rolKey: rolDe(datos.funcion),
    creadaPor: sesion.id,
  });
  if ("error" in cuenta) return cuenta;
  return { profileId: cuenta.id, usuario: cuenta.usuario, clave: cuenta.clave, vinculada: false, creada: true };
}

/**
 * La cuenta vinculada, solo si se creó para ser líder (rol Consejero o
 * Coordinador auxiliar): una cuenta con otro rol, p. ej. un administrador que
 * también es consejero, no se toca desde aquí.
 */
async function cuentaPropia(profileId: string | null) {
  if (!profileId) return null;
  const { data } = await createAdminClient().from("profiles").select("id, email, rol:roles(key)").eq("id", profileId).maybeSingle();
  const rol = (data?.rol as unknown as { key: string } | null)?.key;
  if (!data || !ROLES_PROPIOS.includes(rol as (typeof ROLES_PROPIOS)[number])) return null;
  return { id: data.id as string, email: data.email as string, rol };
}

// ---------------------------------------------------------------------------

export async function crearConsejero(_previo: EstadoConsejero | undefined, formData: FormData): Promise<EstadoConsejero> {
  const permiso = await validarPermiso("consejeros.crear");
  if (!permiso.ok) return { error: permiso.error };
  const { sesion } = permiso;

  const valores = leerCampos(formData, CAMPOS);
  const datos = esquema.safeParse(valores);
  if (!datos.success) return { errores: erroresDe(datos.error), valores };
  if (await correoEnOtroConsejero(datos.data.correo)) return { errores: { correo: "Ya hay un consejero con ese correo." }, valores };

  const cuenta = await cuentaPara(datos.data, sesion);
  if ("error" in cuenta) return { errores: { correo: cuenta.error }, valores };

  const admin = createAdminClient();
  const { data, error } = await admin.from("consejeros").insert({ ...datos.data, profile_id: cuenta.profileId }).select("id").single();
  if (error) {
    // Sin ficha no hay para qué dejar la cuenta recién creada.
    if (cuenta.creada) await admin.auth.admin.deleteUser(cuenta.profileId);
    return { error: mensajeBd(error, "No se pudo registrar al consejero."), valores };
  }

  const nombre = `${datos.data.nombres} ${datos.data.apellidos}`;
  const como = nombreFuncion(datos.data.funcion, datos.data.sexo).toLowerCase();
  await registrarAuditoria(sesion, {
    accion: "consejero.crear",
    entidad: "consejero",
    entidadId: data.id,
    resumen: cuenta.vinculada
      ? `Registró a ${nombre} como ${como} y lo vinculó a su cuenta existente`
      : `Registró a ${nombre} como ${como}, con su cuenta de acceso`,
  });
  refrescar();
  return {
    ok: `${nombreFuncion(datos.data.funcion, datos.data.sexo)} registrad${datos.data.sexo === "Mujer" ? "a" : "o"}.`,
    id: data.id,
    email: datos.data.correo,
    usuario: cuenta.usuario ?? undefined,
    clave: cuenta.clave,
    vinculada: cuenta.vinculada,
  };
}

/** Para un consejero sin cuenta (p. ej. si se borró desde Usuarios). */
export async function crearCuentaConsejero(id: string): Promise<EstadoConsejero> {
  const permiso = await validarPermiso("consejeros.editar");
  if (!permiso.ok) return { error: permiso.error };

  const admin = createAdminClient();
  const { data: c } = await admin.from("consejeros").select("nombres, apellidos, correo, telefono, funcion, profile_id").eq("id", id).maybeSingle();
  if (!c) return { error: "El consejero no existe." };
  if (c.profile_id) return { error: "Ya tiene cuenta." };
  if (!c.correo) return { error: "Primero escribe su correo en la ficha y guarda." };

  const cuenta = await cuentaPara(
    { correo: c.correo, nombres: c.nombres, apellidos: c.apellidos, telefono: c.telefono, funcion: c.funcion },
    permiso.sesion,
  );
  if ("error" in cuenta) return { error: cuenta.error };
  await admin.from("consejeros").update({ profile_id: cuenta.profileId }).eq("id", id);

  await registrarAuditoria(permiso.sesion, {
    accion: "consejero.cuenta",
    entidad: "consejero",
    entidadId: id,
    resumen: `${cuenta.vinculada ? "Vinculó" : "Creó"} la cuenta de acceso de ${c.nombres} ${c.apellidos}`,
  });
  refrescar(id);
  return { ok: cuenta.vinculada ? "Cuenta vinculada." : "Cuenta creada.", email: c.correo, usuario: cuenta.usuario ?? undefined, clave: cuenta.clave, vinculada: cuenta.vinculada };
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
  if (await correoEnOtroConsejero(datos.data.correo, id)) return { errores: { correo: "Ya hay otro consejero con ese correo." }, valores };

  const admin = createAdminClient();
  const { data: actual } = await admin.from("consejeros").select("profile_id").eq("id", id).maybeSingle();
  if (!actual) return { error: "El consejero no existe." };

  // Su cuenta sigue a la ficha: nombre, teléfono y correo (con el que ingresa).
  const cuenta = await cuentaPropia(actual.profile_id);
  if (cuenta && cuenta.email.toLowerCase() !== datos.data.correo) {
    const { error } = await admin.auth.admin.updateUserById(cuenta.id, { email: datos.data.correo, email_confirm: true });
    if (error) return { errores: { correo: mensajeAuth(error.message) }, valores };
  }

  // Quien pasa a ser consejero deja de coordinar su compañía.
  const cambios = datos.data.funcion === "consejero" ? { ...datos.data, coordina_compania_id: null } : datos.data;
  const { error } = await admin.from("consejeros").update(cambios).eq("id", id);
  // Cambiar el sexo de quien ya tiene compañía o cama lo frena la base, con su explicación.
  if (error) return { error: mensajeBd(error, "No se pudieron guardar los cambios."), valores };

  if (cuenta) {
    const { data: rol } = await admin.from("roles").select("id").eq("key", rolDe(datos.data.funcion)).maybeSingle();
    await admin
      .from("profiles")
      .update({
        full_name: `${datos.data.nombres} ${datos.data.apellidos}`,
        phone: datos.data.telefono,
        email: datos.data.correo,
        // Su rol sigue a la función (p. ej. un coordinador que pasa a ser consejero).
        ...(rol ? { role_id: rol.id } : {}),
      })
      .eq("id", cuenta.id);
  }

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
  const { data } = await admin.from("consejeros").select("nombres, apellidos, foto_path, profile_id").eq("id", id).maybeSingle();
  if (!data) return { error: "El consejero no existe." };
  const cuenta = await cuentaPropia(data.profile_id);

  // Su lugar en la compañía queda libre (on delete set null) y su cama también.
  const { error } = await admin.from("consejeros").delete().eq("id", id);
  if (error) return { error: mensajeBd(error, "No se pudo eliminar.") };
  await borrarFoto(data.foto_path);
  // La cuenta se creó para ser consejero: sin ficha no tiene para qué quedar.
  if (cuenta) await admin.auth.admin.deleteUser(cuenta.id);

  await registrarAuditoria(permiso.sesion, {
    accion: "consejero.eliminar",
    entidad: "consejero",
    entidadId: id,
    resumen: `Eliminó a ${data.nombres} ${data.apellidos}${cuenta ? " y su cuenta de acceso" : ""}`,
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
