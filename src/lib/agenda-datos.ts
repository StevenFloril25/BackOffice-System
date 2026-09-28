import "server-only";

import type { Actividad, DiaAgenda } from "@/lib/agenda";
import { createClient } from "@/lib/supabase/server";

/** Días y actividades de la agenda, con la sesión del usuario (RLS: agenda.ver). */
export async function cargarAgenda(): Promise<{ dias: DiaAgenda[]; actividades: Actividad[] }> {
  const supabase = await createClient();
  const [dias, actividades] = await Promise.all([
    supabase.from("agenda_dias").select("dia, fecha, vestimenta, notas").order("dia"),
    supabase
      .from("agenda")
      .select("id, dia, hora_inicio, hora_fin, actividad, lugar, solo_personal")
      .order("dia")
      .order("hora_inicio", { nullsFirst: true })
      .order("hora_fin", { nullsFirst: true })
      .order("actividad"),
  ]);
  if (dias.error || actividades.error) throw new Error("No se pudo cargar la agenda.");
  return { dias: dias.data ?? [], actividades: actividades.data ?? [] };
}
