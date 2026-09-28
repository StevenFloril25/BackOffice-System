"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type EstadoLogin = { error?: string; email?: string } | undefined;

/** Solo rutas internas: evita usar el login como redirector hacia otro sitio. */
function destinoSeguro(valor: FormDataEntryValue | null) {
  const v = typeof valor === "string" ? valor : "";
  return v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/login") ? v : "/inicio";
}

export async function iniciarSesion(_previo: EstadoLogin, formData: FormData): Promise<EstadoLogin> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Ingresa tu correo y tu contraseña.", email };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Supabase responde "User is banned" a las cuentas desactivadas.
    if (/banned/i.test(error.message)) {
      return { error: "Tu cuenta está desactivada. Consulta con un administrador.", email };
    }
    // Mismo mensaje para correo inexistente y contraseña errónea: no revela
    // qué correos tienen cuenta.
    return { error: "Correo o contraseña incorrectos.", email };
  }

  const { data: perfil } = await supabase
    .from("profiles")
    .select("active, must_change_password")
    .eq("id", data.user.id)
    .maybeSingle();

  if (perfil && !perfil.active) {
    await supabase.auth.signOut();
    return { error: "Tu cuenta está desactivada. Consulta con un administrador.", email };
  }

  if (perfil?.must_change_password) redirect("/primer-ingreso");
  redirect(destinoSeguro(formData.get("volver")));
}
