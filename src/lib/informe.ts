import "server-only";

import { urlsFotos } from "@/lib/fotos";
import { MARCA } from "@/lib/marca";
import { createClient } from "@/lib/supabase/server";

/**
 * Informe final de la sesión (guía de planificación FSY, pág. 5): lo que el
 * matrimonio director de sesión envía al matrimonio asesor en el Área.
 */

export interface Conteo {
  inscritos: number;
  asistieron: number;
}

export interface EstacaInforme extends Conteo {
  estaca: string;
  barrios: (Conteo & { nombre: string })[];
}

export interface Testimonio {
  id: string;
  autor: string | null;
  tipo: "joven" | "joven_adulto";
  texto: string;
  created_at: string;
}

export interface FotoInforme {
  id: string;
  url: string | null;
  descripcion: string | null;
  fotografo_nombre: string;
  fotografo_correo: string | null;
}

export interface DatosInforme {
  jovenes: Conteo & { mujeres: Conteo; hombres: Conteo; porEstaca: EstacaInforme[] };
  consejeros: { hombres: number; mujeres: number };
  coordinadoresAuxiliares: { hombres: number; mujeres: number };
  conteos: { sesiones: number; coordinadores: number; otros_jovenes_adultos: number };
  testimonios: Testimonio[];
  fotos: FotoInforme[];
}

const porNombre = new Intl.Collator("es", { numeric: true, sensitivity: "base" });
const vacio = (): Conteo => ({ inscritos: 0, asistieron: 0 });

export async function datosInforme(): Promise<DatosInforme> {
  const supabase = await createClient();
  const [participantes, consejeros, conteos, testimonios, fotos] = await Promise.all([
    supabase.from("participantes").select("sexo, asistio_at, barrio:barrios(nombre, estaca)"),
    supabase.from("consejeros").select("sexo, funcion"),
    supabase.from("informe_conteos").select("clave, valor"),
    supabase.from("informe_testimonios").select("id, autor, tipo, texto, created_at").order("created_at"),
    supabase.from("informe_fotos").select("id, path, descripcion, fotografo_nombre, fotografo_correo").order("created_at"),
  ]);
  for (const r of [participantes, consejeros, conteos, testimonios, fotos]) {
    if (r.error) throw new Error(`No se pudo cargar el informe: ${r.error.message}`);
  }

  const jovenes = { ...vacio(), mujeres: vacio(), hombres: vacio() };
  const estacas = new Map<string, EstacaInforme>();
  for (const p of participantes.data ?? []) {
    const asistio = p.asistio_at ? 1 : 0;
    jovenes.inscritos++;
    jovenes.asistieron += asistio;
    const sexo = p.sexo === "Mujer" ? jovenes.mujeres : p.sexo === "Hombre" ? jovenes.hombres : null;
    if (sexo) {
      sexo.inscritos++;
      sexo.asistieron += asistio;
    }
    const barrio = p.barrio as unknown as { nombre: string; estaca: string } | null;
    const nombreEstaca = barrio?.estaca || "Sin estaca";
    const estaca = estacas.get(nombreEstaca) ?? { estaca: nombreEstaca, ...vacio(), barrios: [] };
    estacas.set(nombreEstaca, estaca);
    estaca.inscritos++;
    estaca.asistieron += asistio;
    const nombreBarrio = barrio?.nombre || "Sin barrio";
    let b = estaca.barrios.find((x) => x.nombre === nombreBarrio);
    if (!b) estaca.barrios.push((b = { nombre: nombreBarrio, ...vacio() }));
    b.inscritos++;
    b.asistieron += asistio;
  }
  const porEstaca = [...estacas.values()]
    .sort((a, b) => porNombre.compare(a.estaca, b.estaca))
    .map((e) => ({ ...e, barrios: e.barrios.sort((a, b) => porNombre.compare(a.nombre, b.nombre)) }));

  const cuenta = (funcion: string, sexo: string) =>
    (consejeros.data ?? []).filter((c) => c.funcion === funcion && c.sexo === sexo).length;
  const valor = (clave: string) => (conteos.data ?? []).find((c) => c.clave === clave)?.valor ?? 0;
  const urls = await urlsFotos((fotos.data ?? []).map((f) => f.path));

  return {
    jovenes: { ...jovenes, porEstaca },
    consejeros: { hombres: cuenta("consejero", "Hombre"), mujeres: cuenta("consejero", "Mujer") },
    coordinadoresAuxiliares: { hombres: cuenta("coordinador", "Hombre"), mujeres: cuenta("coordinador", "Mujer") },
    conteos: { sesiones: valor("sesiones"), coordinadores: valor("coordinadores"), otros_jovenes_adultos: valor("otros_jovenes_adultos") },
    testimonios: (testimonios.data ?? []) as Testimonio[],
    fotos: (fotos.data ?? []).map((f) => ({
      id: f.id,
      url: urls[f.path] ?? null,
      descripcion: f.descripcion,
      fotografo_nombre: f.fotografo_nombre,
      fotografo_correo: f.fotografo_correo,
    })),
  };
}

export function totalJovenesAdultos(d: DatosInforme) {
  return (
    d.consejeros.hombres +
    d.consejeros.mujeres +
    d.coordinadoresAuxiliares.hombres +
    d.coordinadoresAuxiliares.mujeres +
    d.conteos.coordinadores +
    d.conteos.otros_jovenes_adultos
  );
}

const hm = (x: { hombres: number; mujeres: number }) => `${x.hombres + x.mujeres} (${x.hombres} hombres, ${x.mujeres} mujeres)`;

/** El informe en texto, para pegarlo en un correo. */
export function textoInforme(d: DatosInforme): string {
  const l: string[] = [];
  l.push(`Informe final de la conferencia FSY — ${MARCA.nombre} · ${MARCA.sesion}`);
  l.push("Del matrimonio director de sesión al matrimonio asesor en el Área.");
  l.push("");
  l.push(`Sesiones realizadas: ${d.conteos.sesiones}`);
  l.push("");
  l.push(`Jóvenes que asistieron: ${d.jovenes.asistieron} (de ${d.jovenes.inscritos} inscritos)`);
  l.push(`  · Mujeres: ${d.jovenes.mujeres.asistieron} · Hombres: ${d.jovenes.hombres.asistieron}`);
  if (d.jovenes.porEstaca.length > 1 || d.jovenes.porEstaca[0]?.estaca !== "Sin estaca") {
    l.push("  · Por estaca:");
    for (const e of d.jovenes.porEstaca) l.push(`    - ${e.estaca}: ${e.asistieron} de ${e.inscritos}`);
  }
  l.push("");
  l.push(`Jóvenes adultos solteros que participaron: ${totalJovenesAdultos(d)}`);
  l.push(`  · Coordinadores: ${d.conteos.coordinadores}`);
  l.push(`  · Coordinadores auxiliares: ${hm(d.coordinadoresAuxiliares)}`);
  l.push(`  · Consejeros: ${hm(d.consejeros)}`);
  l.push(`  · Otros puestos: ${d.conteos.otros_jovenes_adultos}`);
  if (d.testimonios.length) {
    l.push("");
    l.push(`Testimonios (${d.testimonios.length}):`);
    for (const t of d.testimonios) {
      const quien = [t.autor, t.tipo === "joven" ? "joven" : "joven adulto soltero"].filter(Boolean).join(", ");
      l.push(`  «${t.texto.replace(/\s+/g, " ").trim()}» — ${quien}`);
    }
  }
  if (d.fotos.length) {
    l.push("");
    l.push(`Fotografías (${d.fotos.length}), con su fotógrafo:`);
    for (const f of d.fotos) {
      l.push(`  - ${f.descripcion || "Sin descripción"} — ${f.fotografo_nombre}${f.fotografo_correo ? ` <${f.fotografo_correo}>` : ""}`);
    }
  }
  return l.join("\n");
}
