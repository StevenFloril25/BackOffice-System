import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

const MOTIVOS = new Set(["inactivo", "sesion"]);

/**
 * Cierra la sesión y vuelve al login. Es una ruta y no solo una acción porque
 * también se llega por redirección: un usuario desactivado todavía tiene su
 * cookie y hay que borrarla antes de mostrarle el login.
 */
async function salir(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const motivo = request.nextUrl.searchParams.get("motivo");
  const url = new URL("/login", request.url);
  if (motivo && MOTIVOS.has(motivo)) url.searchParams.set("motivo", motivo);
  return NextResponse.redirect(url, { status: 303 });
}

export const GET = salir;
export const POST = salir;
