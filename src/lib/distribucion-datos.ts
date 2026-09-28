import "server-only";

import {
  proponerCamas,
  proponerCompanias,
  type Alcance,
  type CompaniaParaRepartir,
  type EdificioParaAcomodar,
  type JovenParaRepartir,
  type LiderParaAcomodar,
  type ModoEdades,
  type PersonaParaAcomodar,
} from "@/lib/distribucion";
import type { Funcion, Sexo } from "@/lib/organizacion-comun";
import { edad, nombreCompleto } from "@/lib/participantes-comun";
import { createClient } from "@/lib/supabase/server";

/**
 * Datos del momento para el reparto automático. La vista previa y la acción que
 * lo aplica leen por aquí, así las dos calculan con lo mismo.
 */

export function leerModo(valor: string | undefined): ModoEdades {
  return valor === "mezclar" ? "mezclar" : "agrupar";
}

export function leerAlcance(valor: string | undefined): Alcance {
  return valor === "rehacer" ? "rehacer" : "faltantes";
}

async function companias(): Promise<(CompaniaParaRepartir & { consejero_id: string | null; consejera_id: string | null })[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("companias").select("id, numero, nombre, consejero_id, consejera_id").order("numero");
  if (error) throw new Error(`No se pudieron cargar las compañías: ${error.message}`);
  return data ?? [];
}

export async function propuestaCompanias(modo: ModoEdades, alcance: Alcance) {
  const supabase = await createClient();
  const [lista, { data, error }] = await Promise.all([
    companias(),
    supabase.from("participantes").select("id, nombres, apellidos, sexo, fecha_nacimiento, barrio_id, compania_id, barrio:barrios(nombre)"),
  ]);
  if (error) throw new Error(`No se pudieron cargar los participantes: ${error.message}`);
  const jovenes: JovenParaRepartir[] = (data ?? []).map((j) => ({
    id: j.id,
    nombre: nombreCompleto(j),
    sexo: j.sexo as Sexo | null,
    fecha_nacimiento: j.fecha_nacimiento,
    edad: edad(j.fecha_nacimiento),
    barrio_id: j.barrio_id,
    barrio: (j.barrio as unknown as { nombre: string } | null)?.nombre ?? null,
    compania_id: j.compania_id,
  }));
  const sinCompania = jovenes.filter((j) => !j.compania_id).length;
  return { propuesta: proponerCompanias(jovenes, lista, modo, alcance), total: jovenes.length, sinCompania, hayCompanias: lista.length > 0 };
}

export async function propuestaCamas(alcance: Alcance) {
  const supabase = await createClient();
  const [lista, edificios, participantes, consejeros] = await Promise.all([
    companias(),
    supabase.from("edificios").select("id, nombre, sexo, habitaciones(id, piso, nombre, tipo, capacidad)"),
    supabase.from("participantes").select("id, nombres, apellidos, sexo, compania_id, habitacion_id"),
    supabase.from("consejeros").select("id, nombres, apellidos, sexo, funcion, coordina_compania_id, habitacion_id"),
  ]);
  for (const r of [edificios, participantes, consejeros]) {
    if (r.error) throw new Error(`No se pudieron cargar los datos: ${r.error.message}`);
  }

  // La compañía de cada líder: la que ocupa como consejero/a o la que coordina.
  const titular = new Map<string, string>();
  for (const c of lista) {
    if (c.consejero_id) titular.set(c.consejero_id, c.id);
    if (c.consejera_id) titular.set(c.consejera_id, c.id);
  }
  const jovenes: PersonaParaAcomodar[] = (participantes.data ?? []).map((j) => ({
    id: j.id,
    nombre: nombreCompleto(j),
    sexo: j.sexo as Sexo | null,
    compania_id: j.compania_id,
    habitacion_id: j.habitacion_id,
  }));
  const lideres: LiderParaAcomodar[] = (consejeros.data ?? []).map((c) => ({
    id: c.id,
    nombre: nombreCompleto(c),
    sexo: c.sexo as Sexo,
    funcion: c.funcion as Funcion,
    titular: titular.has(c.id),
    compania_id: titular.get(c.id) ?? c.coordina_compania_id ?? null,
    habitacion_id: c.habitacion_id,
  }));
  const propuesta = proponerCamas((edificios.data ?? []) as EdificioParaAcomodar[], jovenes, lideres, lista, alcance);
  return {
    propuesta,
    conCompania: jovenes.filter((j) => j.compania_id).length,
    sinCama: jovenes.filter((j) => j.compania_id && !j.habitacion_id).length,
    hayEdificios: (edificios.data ?? []).length > 0,
  };
}
