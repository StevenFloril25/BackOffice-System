import { NextResponse, type NextRequest } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Latido diario para que Supabase no pause el proyecto.
 *
 * En el plan gratuito, un proyecto con 7 días sin actividad se pausa y el
 * sistema entero deja de funcionar (nadie puede ingresar) hasta que alguien lo
 * restaure a mano. Pasó el 2026-10-06, tras una semana sin uso. Entre una
 * sesión de FSY y la siguiente hay meses sin movimiento, así que un cron de
 * Vercel (vercel.json) llama aquí una vez al día y hace una consulta mínima.
 *
 * Solo responde a Vercel: el cron manda CRON_SECRET en Authorization.
 */
export async function GET(request: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const inicio = Date.now();
  const { count, error } = await createAdminClient().from("agenda_dias").select("dia", { count: "exact", head: true });
  if (error) {
    console.error("[mantener-activo] la base no respondió:", error.message);
    return NextResponse.json({ ok: false, error: "La base no respondió" }, { status: 503 });
  }
  return NextResponse.json({ ok: true, dias: count, ms: Date.now() - inicio });
}
