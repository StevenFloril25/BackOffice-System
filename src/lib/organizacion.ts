import "server-only";

import { urlsFotos } from "@/lib/fotos";
import type {
  CompaniaResumen,
  Consejero,
  ConsejeroResumen,
  EdificioResumen,
  Integrante,
  Sexo,
  TipoHabitacion,
} from "@/lib/organizacion-comun";
import { nombreCompania } from "@/lib/organizacion-comun";
import { edad, nombreCompleto } from "@/lib/participantes-comun";
import { createClient } from "@/lib/supabase/server";

export * from "@/lib/organizacion-comun";

/**
 * Lecturas de consejeros, compañías y edificios. Van con la sesión del usuario:
 * RLS decide qué ve cada rol (ver 0008).
 */

const HABITACION = "habitacion:habitaciones(id, nombre, piso, tipo, edificio:edificios(id, nombre, sexo))";
const COLUMNAS_CONSEJERO = `*, barrio:barrios(id, nombre, estaca), ${HABITACION}`;
const RESUMEN_CONSEJERO = "id, nombres, apellidos, sexo, foto_path";
// Dos llaves de companias a consejeros: hay que decir cuál es cuál.
const COLUMNAS_COMPANIA = `id, numero, nombre, notas, consejero:consejeros!companias_consejero_id_fkey(${RESUMEN_CONSEJERO}), consejera:consejeros!companias_consejera_id_fkey(${RESUMEN_CONSEJERO})`;

const porNombre = new Intl.Collator("es", { numeric: true, sensitivity: "base" });

/** "Abish · piso 1" a partir de la habitación anidada de una consulta. */
function dondeDuerme(h: { piso: number; edificio: { nombre: string } | null } | null) {
  return h ? [h.edificio?.nombre, `piso ${h.piso}`].filter(Boolean).join(" · ") : null;
}

// ---------------------------------------------------------------------------
// Consejeros
// ---------------------------------------------------------------------------

export async function listarConsejeros(): Promise<Consejero[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("consejeros").select(COLUMNAS_CONSEJERO).order("apellidos").order("nombres");
  if (error) throw new Error(`No se pudo cargar la lista de consejeros: ${error.message}`);
  return (data ?? []) as unknown as Consejero[];
}

export async function obtenerConsejero(id: string): Promise<Consejero | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("consejeros").select(COLUMNAS_CONSEJERO).eq("id", id).maybeSingle();
  return (data as unknown as Consejero | null) ?? null;
}

/** La compañía de cada consejero asignado: { idConsejero: compañía }. */
export async function companiaDeConsejeros(): Promise<Record<string, CompaniaResumen>> {
  const supabase = await createClient();
  const { data } = await supabase.from("companias").select("id, numero, nombre, consejero_id, consejera_id");
  const salida: Record<string, CompaniaResumen> = {};
  for (const c of data ?? []) {
    const compania = { id: c.id, numero: c.numero, nombre: c.nombre };
    if (c.consejero_id) salida[c.consejero_id] = compania;
    if (c.consejera_id) salida[c.consejera_id] = compania;
  }
  return salida;
}

// ---------------------------------------------------------------------------
// Compañías
// ---------------------------------------------------------------------------

export interface CompaniaFila extends CompaniaResumen {
  notas: string | null;
  consejero: ConsejeroResumen | null;
  consejera: ConsejeroResumen | null;
}

export interface ResumenJovenes {
  total: number;
  mujeres: number;
  hombres: number;
  /** Cuántos ya tienen cama. */
  conCama: number;
  edadMin: number | null;
  edadMax: number | null;
}

export async function listarCompanias(): Promise<CompaniaFila[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("companias").select(COLUMNAS_COMPANIA).order("numero");
  if (error) throw new Error(`No se pudieron cargar las compañías: ${error.message}`);
  return (data ?? []) as unknown as CompaniaFila[];
}

export async function obtenerCompania(id: string): Promise<CompaniaFila | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("companias").select(COLUMNAS_COMPANIA).eq("id", id).maybeSingle();
  return (data as unknown as CompaniaFila | null) ?? null;
}

/** Cuántos jóvenes tiene cada compañía, por sexo, con cama y rango de edad. */
export async function resumenPorCompania(): Promise<{ porCompania: Record<string, ResumenJovenes>; sinCompania: number; total: number }> {
  const supabase = await createClient();
  const { data } = await supabase.from("participantes").select("sexo, fecha_nacimiento, compania_id, habitacion_id");
  const porCompania: Record<string, ResumenJovenes> = {};
  let sinCompania = 0;
  for (const p of data ?? []) {
    if (!p.compania_id) {
      sinCompania++;
      continue;
    }
    const r = (porCompania[p.compania_id] ??= { total: 0, mujeres: 0, hombres: 0, conCama: 0, edadMin: null, edadMax: null });
    r.total++;
    if (p.sexo === "Mujer") r.mujeres++;
    if (p.sexo === "Hombre") r.hombres++;
    if (p.habitacion_id) r.conCama++;
    const e = edad(p.fecha_nacimiento);
    if (e !== null) {
      r.edadMin = r.edadMin === null ? e : Math.min(r.edadMin, e);
      r.edadMax = r.edadMax === null ? e : Math.max(r.edadMax, e);
    }
  }
  return { porCompania, sinCompania, total: data?.length ?? 0 };
}

// ---------------------------------------------------------------------------
// Edificios y habitaciones
// ---------------------------------------------------------------------------

export interface HabitacionFila {
  id: string;
  edificio_id: string;
  piso: number;
  nombre: string;
  tipo: TipoHabitacion;
  capacidad: number;
  notas: string | null;
}

export interface EdificioConHabitaciones extends EdificioResumen {
  notas: string | null;
  habitaciones: HabitacionFila[];
}

/** Pisos de arriba hacia abajo, como se ve un edificio; en cada piso, primero el dormitorio. */
function ordenHabitaciones(a: HabitacionFila, b: HabitacionFila) {
  return b.piso - a.piso || (a.tipo === b.tipo ? porNombre.compare(a.nombre, b.nombre) : a.tipo === "jovenes" ? -1 : 1);
}

export async function listarEdificios(): Promise<EdificioConHabitaciones[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("edificios")
    .select("id, nombre, sexo, notas, habitaciones(id, edificio_id, piso, nombre, tipo, capacidad, notas)")
    .order("sexo", { ascending: false })
    .order("nombre");
  if (error) throw new Error(`No se pudieron cargar los edificios: ${error.message}`);
  return ((data ?? []) as EdificioConHabitaciones[]).map((e) => ({ ...e, habitaciones: [...e.habitaciones].sort(ordenHabitaciones) }));
}

export async function obtenerHabitacion(id: string): Promise<(HabitacionFila & { edificio: EdificioResumen }) | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("habitaciones")
    .select("id, edificio_id, piso, nombre, tipo, capacidad, notas, edificio:edificios(id, nombre, sexo)")
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as (HabitacionFila & { edificio: EdificioResumen }) | null) ?? null;
}

export interface OcupacionHabitacion {
  ocupados: number;
  /** Nombres de los consejeros que duermen ahí. */
  consejeros: string[];
  /** Jóvenes por número de compañía; 0 = sin compañía. */
  porCompania: Record<number, number>;
}

/** Quién ocupa cada habitación: cuántos, qué consejeros y de qué compañías. */
export async function ocupacionPorHabitacion(): Promise<Record<string, OcupacionHabitacion>> {
  const supabase = await createClient();
  const [{ data: jovenes }, { data: consejeros }] = await Promise.all([
    supabase.from("participantes").select("habitacion_id, compania:companias(numero)").not("habitacion_id", "is", null),
    supabase.from("consejeros").select("nombres, apellidos, habitacion_id").not("habitacion_id", "is", null),
  ]);
  const salida: Record<string, OcupacionHabitacion> = {};
  const de = (id: string) => (salida[id] ??= { ocupados: 0, consejeros: [], porCompania: {} });
  for (const j of jovenes ?? []) {
    const o = de(j.habitacion_id as string);
    const numero = (j.compania as unknown as { numero: number } | null)?.numero ?? 0;
    o.ocupados++;
    o.porCompania[numero] = (o.porCompania[numero] ?? 0) + 1;
  }
  for (const c of consejeros ?? []) {
    const o = de(c.habitacion_id as string);
    o.ocupados++;
    o.consejeros.push(nombreCompleto(c));
  }
  return salida;
}

/** Jóvenes sin cama, por sexo (los sin sexo no pueden tener cama hasta indicarlo). */
export async function jovenesSinCama(): Promise<{ mujeres: number; hombres: number; sinSexo: number }> {
  const supabase = await createClient();
  const { data } = await supabase.from("participantes").select("sexo").is("habitacion_id", null);
  const lista = data ?? [];
  return {
    mujeres: lista.filter((p) => p.sexo === "Mujer").length,
    hombres: lista.filter((p) => p.sexo === "Hombre").length,
    sinSexo: lista.filter((p) => !p.sexo).length,
  };
}

// ---------------------------------------------------------------------------
// Integrantes (jóvenes de una compañía, ocupantes de una habitación)
// ---------------------------------------------------------------------------

type FilaJoven = {
  id: string;
  nombres: string;
  apellidos: string;
  sexo: Sexo | null;
  fecha_nacimiento: string | null;
  foto_path: string | null;
  barrio: { nombre: string } | null;
  compania: CompaniaResumen | null;
  habitacion: { piso: number; edificio: { nombre: string } | null } | null;
};

const COLUMNAS_JOVEN =
  "id, nombres, apellidos, sexo, fecha_nacimiento, foto_path, barrio:barrios(nombre), compania:companias(id, numero, nombre), habitacion:habitaciones(piso, edificio:edificios(nombre))";

async function aIntegrantes(jovenes: FilaJoven[], extra: "compania" | "habitacion"): Promise<Integrante[]> {
  const fotos = await urlsFotos(jovenes.map((j) => j.foto_path));
  return jovenes
    .map((j) => ({
      id: j.id,
      tipo: "participante" as const,
      nombre: nombreCompleto(j),
      sexo: j.sexo,
      edad: edad(j.fecha_nacimiento),
      barrio: j.barrio?.nombre ?? null,
      foto: j.foto_path ? (fotos[j.foto_path] ?? null) : null,
      extra: extra === "compania" ? (j.compania ? nombreCompania(j.compania) : "Sin compañía") : dondeDuerme(j.habitacion),
      compania: j.compania?.numero ?? null,
    }))
    .sort((a, b) => (a.compania ?? 999) - (b.compania ?? 999) || porNombre.compare(a.nombre, b.nombre));
}

export async function jovenesDeCompania(companiaId: string): Promise<Integrante[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("participantes").select(COLUMNAS_JOVEN).eq("compania_id", companiaId);
  const lista = await aIntegrantes((data ?? []) as unknown as FilaJoven[], "habitacion");
  return lista.sort((a, b) => porNombre.compare(a.nombre, b.nombre));
}

export async function ocupantesDeHabitacion(habitacionId: string): Promise<Integrante[]> {
  const supabase = await createClient();
  const [{ data: jovenes }, { data: consejeros }, companias] = await Promise.all([
    supabase.from("participantes").select(COLUMNAS_JOVEN).eq("habitacion_id", habitacionId),
    supabase.from("consejeros").select("id, nombres, apellidos, sexo, fecha_nacimiento, foto_path, barrio:barrios(nombre)").eq("habitacion_id", habitacionId),
    companiaDeConsejeros(),
  ]);
  const fotos = await urlsFotos((consejeros ?? []).map((c) => c.foto_path));
  const deConsejeros: Integrante[] = (consejeros ?? []).map((c) => ({
    id: c.id,
    tipo: "consejero",
    nombre: nombreCompleto(c),
    sexo: c.sexo as Sexo,
    edad: edad(c.fecha_nacimiento),
    barrio: (c.barrio as unknown as { nombre: string } | null)?.nombre ?? null,
    foto: c.foto_path ? (fotos[c.foto_path] ?? null) : null,
    extra: companias[c.id] ? nombreCompania(companias[c.id]) : "Sin compañía",
    compania: companias[c.id]?.numero ?? null,
  }));
  return [...deConsejeros, ...(await aIntegrantes((jovenes ?? []) as unknown as FilaJoven[], "compania"))];
}

// ---------------------------------------------------------------------------
// Candidatos para asignar
// ---------------------------------------------------------------------------

/** Persona que se puede elegir en un selector: lo justo para reconocerla y filtrar. */
export interface PersonaElegible {
  id: string;
  nombre: string;
  detalle: string;
  sexo: Sexo | null;
  edad: number | null;
  /** Para filtrar por compañía en el selector. */
  grupo?: string;
}

function aElegible(j: FilaJoven, detalle: (j: FilaJoven) => (string | null | undefined)[]): PersonaElegible {
  const e = edad(j.fecha_nacimiento);
  return {
    id: j.id,
    nombre: nombreCompleto(j),
    detalle: [e !== null ? `${e} años` : null, ...detalle(j)].filter(Boolean).join(" · "),
    sexo: j.sexo,
    edad: e,
    grupo: j.compania ? `Compañía ${j.compania.numero}` : "Sin compañía",
  };
}

/** Jóvenes que todavía no tienen compañía. */
export async function jovenesSinCompania(): Promise<PersonaElegible[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("participantes").select(COLUMNAS_JOVEN).is("compania_id", null);
  return ((data ?? []) as unknown as FilaJoven[])
    .map((j) => ({ ...aElegible(j, (x) => [x.sexo, x.barrio?.nombre]), grupo: undefined }))
    .sort((a, b) => porNombre.compare(a.nombre, b.nombre));
}

/** Jóvenes de un sexo que todavía no tienen cama, con su compañía para acomodarlos juntos. */
export async function jovenesSinHabitacion(sexo: Sexo): Promise<PersonaElegible[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("participantes").select(COLUMNAS_JOVEN).is("habitacion_id", null).eq("sexo", sexo);
  return ((data ?? []) as unknown as FilaJoven[])
    .map((j) => aElegible(j, (x) => [x.compania ? nombreCompania(x.compania) : "Sin compañía", x.barrio?.nombre]))
    .sort((a, b) => porNombre.compare(a.nombre, b.nombre));
}

/** Consejeros de un sexo libres para una compañía o para una cama. */
export async function consejerosLibres(sexo: Sexo, para: "compania" | "habitacion"): Promise<PersonaElegible[]> {
  const supabase = await createClient();
  let consulta = supabase.from("consejeros").select("id, nombres, apellidos, sexo, fecha_nacimiento, barrio:barrios(nombre)").eq("sexo", sexo);
  if (para === "habitacion") consulta = consulta.is("habitacion_id", null);
  const [{ data }, companias] = await Promise.all([consulta, companiaDeConsejeros()]);
  return (data ?? [])
    .filter((c) => para === "habitacion" || !companias[c.id])
    .map((c) => {
      const e = edad(c.fecha_nacimiento);
      const barrio = (c.barrio as unknown as { nombre: string } | null)?.nombre;
      return {
        id: c.id,
        nombre: nombreCompleto(c),
        detalle: [e !== null ? `${e} años` : null, companias[c.id] ? nombreCompania(companias[c.id]) : null, barrio]
          .filter(Boolean)
          .join(" · "),
        sexo: c.sexo as Sexo,
        edad: e,
        grupo: para === "habitacion" ? (companias[c.id] ? `Compañía ${companias[c.id].numero}` : "Sin compañía") : undefined,
      };
    })
    .sort((a, b) => porNombre.compare(a.nombre, b.nombre));
}
