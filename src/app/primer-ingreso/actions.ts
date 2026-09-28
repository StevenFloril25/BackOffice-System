"use server";

import { redirect } from "next/navigation";

import { registrarAuditoria } from "@/lib/auditoria";
import { validarClaveNueva } from "@/lib/claves";
import { obtenerSesion } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

export type EstadoPrimerIngreso = { error?: string } | undefined;

export async function definirClave(_previo: EstadoPrimerIngreso, formData: FormData): Promise<EstadoPrimerIngreso> {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");

  const nueva = String(formData.get("nueva") ?? "");
  const repetida = String(formData.get("repetida") ?? "");
  const problema = validarClaveNueva(nueva, repetida);
  if (problema) return { error: problema };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: nueva });
  if (error) {
    if (/different from the old/i.test(error.message)) {
      return { error: "La contraseña nueva tiene que ser distinta de la temporal." };
    }
    return { error: "No se pudo guardar la contraseña. Intenta de nuevo." };
  }

  await supabase.rpc("marcar_clave_cambiada");
  await registrarAuditoria(sesion, {
    accion: "usuario.definir_clave",
    entidad: "usuario",
    entidadId: sesion.id,
    resumen: `${sesion.email} definió su contraseña en el primer ingreso`,
  });

  redirect("/inicio");
}
