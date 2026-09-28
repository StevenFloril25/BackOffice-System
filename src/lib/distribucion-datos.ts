import "server-only";

import {
  alternativa,
  cantidadPara,
  companiasParaReparto,
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

/** Tamaño de compañía por defecto: 10 mujeres y 10 hombres. */
export const TAMANO_INICIAL = 20;

/** Lo que se eligió en la página: el tamaño de cada compañía o, directo, cuántas. */
export interface EleccionReparto {
  modo: ModoEdades;
  alcance: Alcance;
  tamano: number;
  /** Si se eligió una alternativa: cuántas compañías. Manda sobre el tamaño. */
  cantidad: number | null;
}

export function leerEleccion(p: { edades?: string; alcance?: string; tamano?: string; companias?: string }): EleccionReparto {
  const numero = (v: string | undefined, min: number, max: number) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= min && n <= max ? n : null;
  };
  return {
    modo: leerModo(p.edades),
    alcance: leerAlcance(p.alcance),
    tamano: numero(p.tamano, 4, 80) ?? TAMANO_INICIAL,
    cantidad: numero(p.companias, 1, 150),
  };
}

/** Camas de jóvenes de cada piso, por sexo, en el orden en que se llenan (como proponerCamas). */
async function camasPorPiso(): Promise<{ mujeres: number[]; hombres: number[] }> {
  const supabase = await createClient();
  const { data } = await supabase.from("edificios").select("nombre, sexo, habitaciones(piso, tipo, capacidad)");
  const salida = { mujeres: [] as number[], hombres: [] as number[] };
  const porNombre = new Intl.Collator("es", { numeric: true, sensitivity: "base" });
  for (const e of [...(data ?? [])].sort((a, b) => porNombre.compare(a.nombre, b.nombre))) {
    const pisos = new Map<number, number>();
    for (const h of e.habitaciones ?? []) if (h.tipo === "jovenes") pisos.set(h.piso, (pisos.get(h.piso) ?? 0) + h.capacidad);
    const lista = [...pisos.entries()].sort((a, b) => a[0] - b[0]).map(([, camas]) => camas);
    (e.sexo === "Mujer" ? salida.mujeres : salida.hombres).push(...lista);
  }
  return salida;
}

export async function propuestaCompanias(eleccion: EleccionReparto, puedeCrear: boolean) {
  const { modo, alcance } = eleccion;
  const supabase = await createClient();
  const [lista, { data, error }, pisos, consejeros] = await Promise.all([
    companias(),
    supabase.from("participantes").select("id, nombres, apellidos, sexo, fecha_nacimiento, barrio_id, compania_id, barrio:barrios(nombre)"),
    camasPorPiso(),
    supabase.from("consejeros").select("sexo").eq("funcion", "consejero"),
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
  const mujeres = jovenes.filter((j) => j.sexo === "Mujer").length;
  const hombres = jovenes.filter((j) => j.sexo === "Hombre").length;
  const conSexo = mujeres + hombres;

  // Cuántas compañías: las elegidas, o las que da el tamaño. Sin permiso para
  // crear, solo las que ya existen.
  const existentes = lista.map((c) => ({ ...c, jovenes: jovenes.filter((j) => j.compania_id === c.id).length }));
  const cantidad = puedeCrear
    ? Math.min(eleccion.cantidad ?? cantidadPara(eleccion.tamano, conSexo), Math.max(1, conSexo))
    : lista.length;
  const usadas = cantidad > 0 ? companiasParaReparto(existentes, cantidad, alcance) : [];
  const usadasIds = new Set(usadas.map((c) => c.id));
  const alternativas = puedeCrear
    ? [cantidad - 2, cantidad - 1, cantidad, cantidad + 1, cantidad + 2]
        .filter((k) => k >= 1 && k <= conSexo)
        .map((k) => alternativa(k, mujeres, hombres, lista.length, pisos))
    : [];

  return {
    propuesta: proponerCompanias(jovenes, usadas, modo, alcance),
    total: jovenes.length,
    sinCompania,
    mujeres,
    hombres,
    cantidad: usadas.length,
    alternativas,
    /** Compañías que ya existen y este reparto deja vacías. */
    vacias: existentes.filter((c) => !usadasIds.has(c.id)).map((c) => c.numero),
    consejeros: {
      hombres: (consejeros.data ?? []).filter((c) => c.sexo === "Hombre").length,
      mujeres: (consejeros.data ?? []).filter((c) => c.sexo === "Mujer").length,
    },
  };
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
