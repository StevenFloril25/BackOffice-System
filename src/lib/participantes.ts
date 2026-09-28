import "server-only";

import type { BarrioResumen, Participante, Salud } from "@/lib/participantes-comun";
import { createClient } from "@/lib/supabase/server";

export * from "@/lib/participantes-comun";

const COLUMNAS = "*, barrio:barrios(id, nombre, estaca)";

export async function listarParticipantes(): Promise<Participante[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("participantes")
    .select(COLUMNAS)
    .order("apellidos")
    .order("nombres")
    .limit(5000);
  if (error) throw new Error(`No se pudo cargar la lista de participantes: ${error.message}`);
  return (data ?? []) as Participante[];
}

export async function obtenerParticipante(id: string): Promise<{ participante: Participante; salud: Salud | null } | null> {
  const supabase = await createClient();
  const [{ data }, { data: salud }] = await Promise.all([
    supabase.from("participantes").select(COLUMNAS).eq("id", id).maybeSingle(),
    // Sin participantes.salud, RLS devuelve cero filas: no hace falta preguntar.
    supabase.from("participantes_salud").select("*").eq("participante_id", id).maybeSingle(),
  ]);
  if (!data) return null;
  return { participante: data as Participante, salud: (salud as Salud | null) ?? null };
}

export async function listarBarriosOpciones(): Promise<BarrioResumen[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("barrios").select("id, nombre, estaca").order("estaca").order("nombre");
  return (data ?? []) as BarrioResumen[];
}

