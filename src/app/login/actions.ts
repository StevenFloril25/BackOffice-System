"use server";

import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type EstadoLogin = { error?: string; identificador?: string } | undefined;

const CREDENCIALES_INVALIDAS = "Usuario, correo o contraseña incorrectos.";

/** Solo rutas internas: evita usar el login como redirector hacia otro sitio. */
function destinoSeguro(valor: FormDataEntryValue | null) {
  const v = typeof valor === "string" ? valor : "";
  return v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/login") ? v : "/inicio";
}

/**
 * Traduce "usuario" a correo, porque Supabase Auth solo ingresa por correo.
 *
 * Se hace aquí, en el servidor y con la service role, y no con una función
 * pública de la base: una consulta abierta a cualquiera permitiría averiguar
 * el correo de cada usuario.
 */
async function correoDeUsuario(usuario: string): Promise<string | null> {
  if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(usuario)) return null;
  const { data } = await createAdminClient().from("profiles").select("email").eq("username", usuario).maybeSingle();
  return (data?.email as string | undefined) ?? null;
}

export async function iniciarSesion(_previo: EstadoLogin, formData: FormData): Promise<EstadoLogin> {
  const identificador = String(formData.get("identificador") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!identificador || !password) return { error: "Ingresa tu correo o usuario y tu contraseña.", identificador };

  const email = identificador.includes("@") ? identificador : await correoDeUsuario(identificador);
  // Mismo mensaje para usuario inexistente y contraseña errónea: no revela qué
  // cuentas existen.
  if (!email) return { error: CREDENCIALES_INVALIDAS, identificador };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Supabase responde "User is banned" a las cuentas desactivadas.
    if (/banned/i.test(error.message)) {
      return { error: "Tu cuenta está desactivada. Consulta con un administrador.", identificador };
    }
    return { error: CREDENCIALES_INVALIDAS, identificador };
  }

  const { data: perfil } = await supabase
    .from("profiles")
    .select("active, must_change_password")
    .eq("id", data.user.id)
    .maybeSingle();

  if (perfil && !perfil.active) {
    await supabase.auth.signOut();
    return { error: "Tu cuenta está desactivada. Consulta con un administrador.", identificador };
  }

  if (perfil?.must_change_password) redirect("/primer-ingreso");
  redirect(destinoSeguro(formData.get("volver")));
}
