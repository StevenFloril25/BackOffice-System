"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { registrarAuditoria } from "@/lib/auditoria";
import { validarClaveNueva } from "@/lib/claves";
import { validarPermiso, type Sesion } from "@/lib/sesion";
import { createAdminClient } from "@/lib/supabase/admin";
import { generarClaveTemporal } from "@/lib/utilidades";

export interface EstadoAccion {
  ok?: string;
  error?: string;
  errores?: Record<string, string>;
  /** Contraseña temporal para mostrarla UNA vez a quien la generó. */
  clave?: string;
  id?: string;
  email?: string;
  /** Lo que se escribió, para no perderlo cuando la validación falla
   *  (React 19 reinicia el formulario después de cada acción). */
  valores?: Record<string, string>;
}

const BAN_INDEFINIDO = "876000h"; // ~100 años: Supabase no tiene "para siempre".

const esquemaDatos = z.object({
  full_name: z.string().trim().min(2, "Escribe el nombre completo.").max(120, "Máximo 120 caracteres."),
  // Se normaliza ANTES de validar: un espacio pegado al copiar no es un error.
  email: z.string().trim().toLowerCase().pipe(z.email("Correo no válido.")),
  phone: z
    .string()
    .trim()
    .max(25, "Máximo 25 caracteres.")
    .regex(/^[\d\s+()-]*$/, "Solo números, espacios y + ( ) -.")
    .optional()
    .transform((v) => v || null),
  role_id: z.string().min(1, "Elige un rol.").pipe(z.uuid("Rol no válido.")),
});

function valoresDe(formData: FormData) {
  const v: Record<string, string> = {};
  for (const k of ["full_name", "email", "phone", "role_id"]) v[k] = String(formData.get(k) ?? "");
  return v;
}

function erroresDe(error: z.ZodError): Record<string, string> {
  const salida: Record<string, string> = {};
  for (const i of error.issues) {
    const campo = String(i.path[0] ?? "general");
    salida[campo] ??= i.message;
  }
  return salida;
}

async function cargarRol(roleId: string) {
  const { data } = await createAdminClient().from("roles").select("id, key, name, is_system").eq("id", roleId).maybeSingle();
  return data as { id: string; key: string; name: string; is_system: boolean } | null;
}

/**
 * Reglas sobre la cuenta que se quiere tocar, además del permiso:
 *  - La propia cuenta no se administra desde aquí (Mi cuenta): nadie se quita
 *    su propio rol, se desactiva o se borra por accidente.
 *  - Solo un administrador puede tocar a otro administrador; si no, alguien con
 *    usuarios.editar podría degradar o bloquear a quien le dio el acceso.
 */
async function validarObjetivo(sesion: Sesion, id: string) {
  const { data } = await createAdminClient()
    .from("profiles")
    .select("id, email, full_name, active, role_id, rol:roles(is_system, name)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return { error: "El usuario no existe." } as const;
  if (id === sesion.id) return { error: "Tu propia cuenta se administra desde «Mi cuenta»." } as const;
  const rol = data.rol as unknown as { is_system: boolean; name: string } | null;
  if (rol?.is_system && !sesion.esAdmin) {
    return { error: "Solo un administrador puede modificar a otro administrador." } as const;
  }
  return { objetivo: { ...data, esAdmin: !!rol?.is_system, rolNombre: rol?.name ?? null } } as const;
}

async function adminsActivos(): Promise<number> {
  const { count } = await createAdminClient()
    .from("profiles")
    .select("id, roles!inner(is_system)", { count: "exact", head: true })
    .eq("active", true)
    .eq("roles.is_system", true);
  return count ?? 0;
}

function mensajeAuth(message: string) {
  if (/already been registered|already exists|email_exists/i.test(message)) return "Ya existe una cuenta con ese correo.";
  if (/password/i.test(message)) return "La contraseña no cumple los requisitos de seguridad.";
  return message;
}

// ---------------------------------------------------------------------------

export async function crearUsuario(_previo: EstadoAccion | undefined, formData: FormData): Promise<EstadoAccion> {
  const permiso = await validarPermiso("usuarios.crear");
  if (!permiso.ok) return { error: permiso.error };
  const { sesion } = permiso;

  const datos = esquemaDatos.safeParse({
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? "",
    role_id: formData.get("role_id"),
  });
  const valores = valoresDe(formData);
  if (!datos.success) return { errores: erroresDe(datos.error), valores };

  const rol = await cargarRol(datos.data.role_id);
  if (!rol) return { errores: { role_id: "El rol elegido ya no existe." }, valores };
  if (rol.is_system && !sesion.esAdmin) {
    return { errores: { role_id: "Solo un administrador puede crear administradores." }, valores };
  }

  const modo = formData.get("modo_clave") === "manual" ? "manual" : "generada";
  const clave = modo === "manual" ? String(formData.get("clave") ?? "") : generarClaveTemporal();
  if (modo === "manual") {
    const problema = validarClaveNueva(clave);
    if (problema) return { errores: { clave: problema }, valores };
  }
  const pedirCambio = formData.get("pedir_cambio") === "on";

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: datos.data.email,
    password: clave,
    email_confirm: true,
    user_metadata: { full_name: datos.data.full_name },
    // app_metadata: solo la service role puede escribirlo; de ahí toma el
    // disparador handle_new_user el rol inicial del perfil.
    app_metadata: { role_key: rol.key, must_change_password: pedirCambio, created_by: sesion.id },
  });
  if (error || !data.user) return { error: mensajeAuth(error?.message ?? "No se pudo crear la cuenta."), valores };

  if (datos.data.phone) {
    await admin.from("profiles").update({ phone: datos.data.phone }).eq("id", data.user.id);
  }

  await registrarAuditoria(sesion, {
    accion: "usuario.crear",
    entidad: "usuario",
    entidadId: data.user.id,
    resumen: `Creó la cuenta de ${datos.data.email} con el rol ${rol.name}`,
    detalles: { rol: rol.name, clave: modo, pedir_cambio: pedirCambio },
  });

  revalidatePath("/usuarios");
  return {
    ok: "Cuenta creada.",
    id: data.user.id,
    email: datos.data.email,
    // Solo se devuelve si la generó el sistema: si la escribió quien crea, ya la conoce.
    clave: modo === "generada" ? clave : undefined,
  };
}

export async function actualizarUsuario(
  id: string,
  _previo: EstadoAccion | undefined,
  formData: FormData,
): Promise<EstadoAccion> {
  const permiso = await validarPermiso("usuarios.editar");
  if (!permiso.ok) return { error: permiso.error };
  const { sesion } = permiso;

  const v = await validarObjetivo(sesion, id);
  if ("error" in v) return { error: v.error };
  const { objetivo } = v;

  const datos = esquemaDatos.safeParse({
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? "",
    role_id: formData.get("role_id"),
  });
  const valores = valoresDe(formData);
  if (!datos.success) return { errores: erroresDe(datos.error), valores };

  const rol = await cargarRol(datos.data.role_id);
  if (!rol) return { errores: { role_id: "El rol elegido ya no existe." }, valores };
  if (rol.is_system && !sesion.esAdmin) {
    return { errores: { role_id: "Solo un administrador puede asignar ese rol." }, valores };
  }

  const admin = createAdminClient();

  if (datos.data.email !== objetivo.email) {
    const { error } = await admin.auth.admin.updateUserById(id, { email: datos.data.email, email_confirm: true });
    if (error) return { errores: { email: mensajeAuth(error.message) }, valores };
  }

  const { error } = await admin
    .from("profiles")
    .update({
      full_name: datos.data.full_name,
      email: datos.data.email,
      phone: datos.data.phone,
      role_id: rol.id,
    })
    .eq("id", id);
  if (error) {
    if (/al menos un administrador/.test(error.message)) {
      return { errores: { role_id: "Es el último administrador activo: no se le puede quitar el rol." }, valores };
    }
    return { error: "No se pudieron guardar los cambios.", valores };
  }

  const cambios: string[] = [];
  if (objetivo.full_name !== datos.data.full_name) cambios.push("nombre");
  if (objetivo.email !== datos.data.email) cambios.push("correo");
  if (objetivo.role_id !== rol.id) cambios.push(`rol → ${rol.name}`);

  await registrarAuditoria(sesion, {
    accion: "usuario.editar",
    entidad: "usuario",
    entidadId: id,
    resumen: `Editó a ${datos.data.email}${cambios.length ? ` (${cambios.join(", ")})` : ""}`,
    detalles: { rol_anterior: objetivo.rolNombre, rol_nuevo: rol.name },
  });

  revalidatePath("/usuarios");
  revalidatePath(`/usuarios/${id}`);
  return { ok: "Cambios guardados." };
}

export async function cambiarEstadoUsuario(id: string, activar: boolean): Promise<EstadoAccion> {
  const permiso = await validarPermiso("usuarios.editar");
  if (!permiso.ok) return { error: permiso.error };
  const { sesion } = permiso;

  const v = await validarObjetivo(sesion, id);
  if ("error" in v) return { error: v.error };

  if (!activar && v.objetivo.esAdmin && (await adminsActivos()) <= 1) {
    return { error: "Es el último administrador activo: no se puede desactivar." };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ active: activar }).eq("id", id);
  if (error) return { error: "No se pudo cambiar el estado." };

  // Además de la marca en el perfil, se bloquea en Supabase Auth: así una
  // cuenta desactivada tampoco puede renovar su sesión ni volver a ingresar.
  const { error: errorBan } = await admin.auth.admin.updateUserById(id, {
    ban_duration: activar ? "none" : BAN_INDEFINIDO,
  });
  if (errorBan) console.error("[usuarios] no se pudo actualizar el bloqueo en Auth:", errorBan.message);

  await registrarAuditoria(sesion, {
    accion: activar ? "usuario.activar" : "usuario.desactivar",
    entidad: "usuario",
    entidadId: id,
    resumen: `${activar ? "Activó" : "Desactivó"} la cuenta de ${v.objetivo.email}`,
  });

  revalidatePath("/usuarios");
  revalidatePath(`/usuarios/${id}`);
  return { ok: activar ? "Cuenta activada." : "Cuenta desactivada." };
}

export async function restablecerClave(id: string): Promise<EstadoAccion> {
  const permiso = await validarPermiso("usuarios.editar");
  if (!permiso.ok) return { error: permiso.error };
  const { sesion } = permiso;

  const v = await validarObjetivo(sesion, id);
  if ("error" in v) return { error: v.error };

  const clave = generarClaveTemporal();
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(id, { password: clave });
  if (error) return { error: mensajeAuth(error.message) };

  // Contraseña que conoce el admin = contraseña temporal: se exige cambiarla.
  await admin.from("profiles").update({ must_change_password: true }).eq("id", id);

  await registrarAuditoria(sesion, {
    accion: "usuario.restablecer_clave",
    entidad: "usuario",
    entidadId: id,
    resumen: `Restableció la contraseña de ${v.objetivo.email}`,
  });

  revalidatePath(`/usuarios/${id}`);
  return { ok: "Contraseña restablecida.", clave };
}

export async function eliminarUsuario(id: string): Promise<EstadoAccion> {
  const permiso = await validarPermiso("usuarios.eliminar");
  if (!permiso.ok) return { error: permiso.error };
  const { sesion } = permiso;

  const v = await validarObjetivo(sesion, id);
  if ("error" in v) return { error: v.error };

  if (v.objetivo.esAdmin && v.objetivo.active && (await adminsActivos()) <= 1) {
    return { error: "Es el último administrador activo: no se puede eliminar." };
  }

  const { error } = await createAdminClient().auth.admin.deleteUser(id);
  if (error) return { error: "No se pudo eliminar la cuenta." };

  await registrarAuditoria(sesion, {
    accion: "usuario.eliminar",
    entidad: "usuario",
    entidadId: id,
    resumen: `Eliminó la cuenta de ${v.objetivo.email}`,
    detalles: { nombre: v.objetivo.full_name, rol: v.objetivo.rolNombre },
  });

  revalidatePath("/usuarios");
  redirect("/usuarios?aviso=eliminado");
}
