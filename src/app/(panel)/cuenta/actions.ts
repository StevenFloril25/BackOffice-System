"use server";

import { createClient as clienteSinSesion } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

import { registrarAuditoria } from "@/lib/auditoria";
import { validarClaveNueva } from "@/lib/claves";
import { obtenerSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

export type EstadoCuenta = { ok?: string; error?: string } | undefined;

export async function guardarPerfil(_previo: EstadoCuenta, formData: FormData): Promise<EstadoCuenta> {
  const sesion = await obtenerSesion();
  if (!sesion?.activo) return { error: "Tu sesión expiró. Vuelve a ingresar." };

  const nombre = String(formData.get("full_name") ?? "").trim();
  const telefono = String(formData.get("phone") ?? "").trim();
  if (nombre.length < 2 || nombre.length > 120) return { error: "Escribe tu nombre completo (2 a 120 caracteres)." };
  if (telefono && !/^[\d\s+()-]{0,25}$/.test(telefono)) return { error: "El teléfono solo admite números, espacios y + ( ) -." };

  // Con la sesión propia: RLS y el grant por columna solo dejan tocar nombre y
  // teléfono de la fila propia.
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: nombre, phone: telefono || null })
    .eq("id", sesion.id);
  if (error) return { error: "No se pudieron guardar tus datos." };

  revalidatePath("/", "layout");
  return { ok: "Datos actualizados." };
}

/**
 * Cambio de contraseña propio. Se exige la actual y se verifica de verdad:
 * Supabase no la pide al llamar updateUser, y sin esto cualquiera frente a una
 * sesión abierta se quedaría con la cuenta. La verificación usa un cliente
 * aparte para no tocar la sesión de las cookies.
 */
export async function cambiarClave(_previo: EstadoCuenta, formData: FormData): Promise<EstadoCuenta> {
  const sesion = await obtenerSesion();
  if (!sesion?.activo) return { error: "Tu sesión expiró. Vuelve a ingresar." };

  const actual = String(formData.get("actual") ?? "");
  const nueva = String(formData.get("nueva") ?? "");
  const repetida = String(formData.get("repetida") ?? "");

  if (!actual) return { error: "Escribe tu contraseña actual." };
  const problema = validarClaveNueva(nueva, repetida);
  if (problema) return { error: problema };
  if (nueva === actual) return { error: "La contraseña nueva tiene que ser distinta de la actual." };

  const verificador = clienteSinSesion(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: errorVerificacion } = await verificador.auth.signInWithPassword({ email: sesion.email, password: actual });
  if (errorVerificacion) return { error: "La contraseña actual no es correcta." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: nueva });
  if (error) return { error: "No se pudo cambiar la contraseña." };

  await registrarAuditoria(sesion, {
    accion: "usuario.cambiar_clave",
    entidad: "usuario",
    entidadId: sesion.id,
    resumen: `${sesion.email} cambió su contraseña`,
  });

  return { ok: "Contraseña actualizada. La próxima vez ingresa con la nueva." };
}
