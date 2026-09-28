/**
 * Reparto automático sugerido: jóvenes en compañías y compañías en pisos.
 *
 * Funciones puras y deterministas (mismos datos, mismo resultado). La página
 * calcula la propuesta para mostrarla; al confirmar, el servidor la vuelve a
 * calcular con los datos del momento y compara la huella: si alguien cambió algo
 * entretanto, no se aplica una propuesta que ya no es la que se vio.
 */

import type { Funcion, Sexo } from "@/lib/organizacion-comun";

export type ModoEdades = "agrupar" | "mezclar";
/** "faltantes": solo a quien todavía no tiene (compañía o cama). "rehacer": todo de nuevo. */
export type Alcance = "faltantes" | "rehacer";

const SEXOS: Sexo[] = ["Mujer", "Hombre"];
const porNombre = new Intl.Collator("es", { numeric: true, sensitivity: "base" });

/** FNV-1a de 32 bits: basta para notar que la propuesta cambió. */
function huellaDe(texto: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

// ---------------------------------------------------------------------------
// Jóvenes en compañías
// ---------------------------------------------------------------------------

export interface JovenParaRepartir {
  id: string;
  nombre: string;
  sexo: Sexo | null;
  /** AAAA-MM-DD */
  fecha_nacimiento: string | null;
  edad: number | null;
  barrio_id: string | null;
  barrio: string | null;
  compania_id: string | null;
}

export interface CompaniaParaRepartir {
  id: string;
  numero: number;
  nombre: string;
}

export interface MiembroPropuesto {
  id: string;
  nombre: string;
  sexo: Sexo | null;
  edad: number | null;
  barrio: string | null;
  /** Llega con este reparto (no estaba ya en la compañía). */
  nuevo: boolean;
}

export interface CompaniaPropuesta {
  compania: CompaniaParaRepartir;
  miembros: MiembroPropuesto[];
  mujeres: number;
  hombres: number;
  edadMin: number | null;
  edadMax: number | null;
  barrios: number;
  /** Cuántos comparten el barrio más repetido de la compañía. */
  maxMismoBarrio: number;
  nuevos: number;
}

export interface PropuestaCompanias {
  asignaciones: { id: string; compania_id: string }[];
  companias: CompaniaPropuesta[];
  /** Sin sexo indicado: no se pueden equilibrar, quedan fuera del reparto. */
  sinSexo: number;
  /** Con "rehacer": cuántos cambian de compañía. */
  cambian: number;
  huella: string;
}

const claveBarrio = (j: JovenParaRepartir) => j.barrio_id ?? `solo:${j.id}`;

/**
 * Reparte a los jóvenes en las compañías:
 *  - mujeres y hombres por separado, cada compañía con cantidades parejas de
 *    ambos (la que recibe una mujer de más recibe un hombre de menos);
 *  - edades "agrupar": se ordenan por fecha de nacimiento y cada compañía toma un
 *    tramo seguido (la 1, los más jóvenes). "mezclar": se reparten en zigzag,
 *    así cada compañía recibe de todas las edades;
 *  - barrios: después se intercambian jóvenes del mismo sexo y la misma edad
 *    entre compañías mientras eso reparta mejor los barrios, sin tocar lo anterior.
 */
export function proponerCompanias(
  jovenes: JovenParaRepartir[],
  companias: CompaniaParaRepartir[],
  modo: ModoEdades,
  alcance: Alcance,
): PropuestaCompanias {
  const orden = [...companias].sort((a, b) => a.numero - b.numero);
  const ids = new Set(orden.map((c) => c.id));
  const k = orden.length;
  const destino = new Map<string, string>();
  const fijos = jovenes.filter((j) => alcance === "faltantes" && j.compania_id && ids.has(j.compania_id));
  const fijosIds = new Set(fijos.map((j) => j.id));
  const movibles = jovenes.filter((j) => !fijosIds.has(j.id) && j.sexo);
  const sinSexo = jovenes.filter((j) => !fijosIds.has(j.id) && !j.sexo).length;

  if (k > 0) {
    SEXOS.forEach((sexo, s) => {
      const lista = movibles
        .filter((j) => j.sexo === sexo)
        .sort((a, b) => (b.fecha_nacimiento ?? "").localeCompare(a.fecha_nacimiento ?? "") || porNombre.compare(a.nombre, b.nombre));
      const yaTienen = orden.map((c) => fijos.filter((j) => j.sexo === sexo && j.compania_id === c.id).length);
      const total = lista.length + yaTienen.reduce((a, b) => a + b, 0);
      const base = Math.floor(total / k);
      const resto = total % k;
      // Las mujeres de más van a las primeras compañías y los hombres de más a las
      // últimas: así el total de cada compañía queda parejo.
      const meta = orden.map((_, i) => base + (s === 0 ? (i < resto ? 1 : 0) : i >= k - resto ? 1 : 0));
      const cupo = meta.map((m, i) => Math.max(0, m - yaTienen[i]));
      // Si alguna ya se pasó de su meta, sobran lugares: se descuentan de las más llenas.
      let sobran = cupo.reduce((a, b) => a + b, 0) - lista.length;
      while (sobran > 0) {
        let mayor = -1;
        for (let i = 0; i < k; i++) {
          if (cupo[i] > 0 && (mayor < 0 || yaTienen[i] + cupo[i] > yaTienen[mayor] + cupo[mayor])) mayor = i;
        }
        cupo[mayor]--;
        sobran--;
      }

      if (modo === "agrupar") {
        let p = 0;
        orden.forEach((c, i) => {
          for (let n = 0; n < cupo[i]; n++) destino.set(lista[p++].id, c.id);
        });
      } else {
        const quedan = [...cupo];
        let p = 0;
        for (let vuelta = 0; p < lista.length; vuelta++) {
          const indices = vuelta % 2 === 0 ? orden.map((_, i) => i) : orden.map((_, i) => k - 1 - i);
          for (const i of indices) {
            if (p >= lista.length) break;
            if (quedan[i] > 0) {
              destino.set(lista[p++].id, orden[i].id);
              quedan[i]--;
            }
          }
        }
      }
    });

    mezclarBarrios(fijos, movibles, destino);
  }

  const companiaDe = (j: JovenParaRepartir) => (fijosIds.has(j.id) ? j.compania_id : destino.get(j.id));
  const propuesta = orden.map((c) => {
    const miembros = jovenes
      .filter((j) => companiaDe(j) === c.id)
      .map((j) => ({ id: j.id, nombre: j.nombre, sexo: j.sexo, edad: j.edad, barrio: j.barrio, nuevo: j.compania_id !== c.id }))
      .sort((a, b) => porNombre.compare(a.nombre, b.nombre));
    const edades = miembros.map((m) => m.edad).filter((e): e is number => e !== null);
    const porBarrio = new Map<string, number>();
    for (const j of jovenes.filter((x) => companiaDe(x) === c.id)) porBarrio.set(claveBarrio(j), (porBarrio.get(claveBarrio(j)) ?? 0) + 1);
    return {
      compania: c,
      miembros,
      mujeres: miembros.filter((m) => m.sexo === "Mujer").length,
      hombres: miembros.filter((m) => m.sexo === "Hombre").length,
      edadMin: edades.length ? Math.min(...edades) : null,
      edadMax: edades.length ? Math.max(...edades) : null,
      barrios: porBarrio.size,
      maxMismoBarrio: Math.max(0, ...porBarrio.values()),
      nuevos: miembros.filter((m) => m.nuevo).length,
    };
  });

  const asignaciones = [...destino.entries()]
    .map(([id, compania_id]) => ({ id, compania_id }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const actual = new Map(jovenes.map((j) => [j.id, j.compania_id]));
  return {
    asignaciones,
    companias: propuesta,
    sinSexo,
    cambian: asignaciones.filter((a) => actual.get(a.id) && actual.get(a.id) !== a.compania_id).length,
    huella: huellaDe(`c|${modo}|${alcance}|` + asignaciones.map((a) => `${a.id}:${a.compania_id}`).join(";")),
  };
}

/**
 * Intercambia jóvenes del mismo sexo y la misma edad entre compañías mientras
 * baje la concentración de barrios (suma de cuadrados de cuántos hay de cada
 * barrio en cada compañía). No cambia cuántos hay por sexo ni por edad.
 */
function mezclarBarrios(fijos: JovenParaRepartir[], movibles: JovenParaRepartir[], destino: Map<string, string>) {
  const cuenta = new Map<string, number>();
  const clave = (compania: string, barrio: string) => `${compania}|${barrio}`;
  const n = (compania: string, barrio: string) => cuenta.get(clave(compania, barrio)) ?? 0;
  const sumar = (compania: string, barrio: string, d: number) => cuenta.set(clave(compania, barrio), n(compania, barrio) + d);
  for (const j of fijos) sumar(j.compania_id!, claveBarrio(j), 1);
  for (const j of movibles) if (destino.has(j.id)) sumar(destino.get(j.id)!, claveBarrio(j), 1);

  const candidatos = movibles.filter((j) => destino.has(j.id) && j.edad !== null && j.barrio_id);
  for (let pasada = 0; pasada < 12; pasada++) {
    let mejoro = false;
    for (let x = 0; x < candidatos.length; x++) {
      for (let y = x + 1; y < candidatos.length; y++) {
        const a = candidatos[x];
        const b = candidatos[y];
        if (a.sexo !== b.sexo || a.edad !== b.edad || a.barrio_id === b.barrio_id) continue;
        const ca = destino.get(a.id)!;
        const cb = destino.get(b.id)!;
        if (ca === cb) continue;
        const ba = claveBarrio(a);
        const bb = claveBarrio(b);
        // Cambio en la suma de cuadrados al pasar a de ca a cb y b de cb a ca.
        const delta = 2 * (n(ca, bb) - n(ca, ba) + n(cb, ba) - n(cb, bb)) + 4;
        if (delta >= 0) continue;
        sumar(ca, ba, -1);
        sumar(cb, bb, -1);
        sumar(cb, ba, 1);
        sumar(ca, bb, 1);
        destino.set(a.id, cb);
        destino.set(b.id, ca);
        mejoro = true;
      }
    }
    if (!mejoro) break;
  }
}

// ---------------------------------------------------------------------------
// Compañías en pisos
// ---------------------------------------------------------------------------

export interface HabitacionParaAcomodar {
  id: string;
  piso: number;
  nombre: string;
  tipo: "jovenes" | "lideres";
  capacidad: number;
}

export interface EdificioParaAcomodar {
  id: string;
  nombre: string;
  sexo: Sexo;
  habitaciones: HabitacionParaAcomodar[];
}

export interface PersonaParaAcomodar {
  id: string;
  nombre: string;
  sexo: Sexo | null;
  compania_id: string | null;
  habitacion_id: string | null;
}

export interface LiderParaAcomodar extends PersonaParaAcomodar {
  funcion: Funcion;
  /** Ocupa el lugar de consejero/a de su compañía (si no, la coordina). */
  titular: boolean;
}

export interface LiderEnPiso {
  nombre: string;
  compania: number | null;
  funcion: Funcion;
  sexo: Sexo | null;
  nuevo: boolean;
}

export interface PisoPropuesto {
  edificio: { id: string; nombre: string; sexo: Sexo };
  piso: number;
  camas: number;
  ocupadas: number;
  /** Jóvenes por número de compañía; 0 = sin compañía. */
  porCompania: Record<number, number>;
  nuevos: number;
  camasLideres: number;
  lideres: LiderEnPiso[];
}

export interface PropuestaCamas {
  jovenes: { id: string; habitacion_id: string | null }[];
  lideres: { id: string; habitacion_id: string | null }[];
  pisos: PisoPropuesto[];
  avisos: string[];
  /** Cuántos reciben cama nueva (o cambian de cama, al rehacer). */
  acomodados: number;
  huella: string;
}

interface Piso {
  edificio: EdificioParaAcomodar;
  numero: number;
  dormitorios: { h: HabitacionParaAcomodar; libres: number }[];
  lideres: { h: HabitacionParaAcomodar; libres: number }[];
}

const libresDe = (p: Piso) => p.dormitorios.reduce((n, d) => n + d.libres, 0);

/**
 * Acomoda las compañías en los pisos, como la hoja de distribución: por sexo,
 * edificio por edificio (en orden alfabético) y piso por piso desde el 1, cada
 * compañía junta en un piso (la primera que tenga lugar para todos). Si una no
 * entra entera en ningún piso, se reparte y se avisa. Los consejeros duermen en
 * la habitación de líderes del piso de sus jóvenes; los coordinadores, donde
 * quede lugar, cerca.
 */
export function proponerCamas(
  edificios: EdificioParaAcomodar[],
  jovenes: PersonaParaAcomodar[],
  lideres: LiderParaAcomodar[],
  companias: CompaniaParaRepartir[],
  alcance: Alcance,
): PropuestaCamas {
  const avisos: string[] = [];
  const numeroDe = new Map(companias.map((c) => [c.id, c.numero]));
  const orden = [...companias].sort((a, b) => a.numero - b.numero);
  const rehacer = alcance === "rehacer";

  const movibleJoven = (j: PersonaParaAcomodar) => Boolean(j.sexo && j.compania_id && numeroDe.has(j.compania_id) && (rehacer || !j.habitacion_id));
  const movibleLider = (l: LiderParaAcomodar) => Boolean(l.sexo && l.compania_id && numeroDe.has(l.compania_id) && (rehacer || !l.habitacion_id));

  // Camas libres de cada habitación, descontando a quienes se quedan donde están.
  const ocupadasFijas = new Map<string, number>();
  for (const p of [...jovenes.filter((j) => !movibleJoven(j)), ...lideres.filter((l) => !movibleLider(l))]) {
    if (p.habitacion_id) ocupadasFijas.set(p.habitacion_id, (ocupadasFijas.get(p.habitacion_id) ?? 0) + 1);
  }
  const pisos: Piso[] = [];
  for (const e of [...edificios].sort((a, b) => porNombre.compare(a.nombre, b.nombre))) {
    const numeros = [...new Set(e.habitaciones.map((h) => h.piso))].sort((a, b) => a - b);
    for (const numero of numeros) {
      const habs = e.habitaciones.filter((h) => h.piso === numero).sort((a, b) => porNombre.compare(a.nombre, b.nombre));
      const conLibres = (h: HabitacionParaAcomodar) => ({ h, libres: Math.max(0, h.capacidad - (ocupadasFijas.get(h.id) ?? 0)) });
      pisos.push({
        edificio: e,
        numero,
        dormitorios: habs.filter((h) => h.tipo === "jovenes").map(conLibres),
        lideres: habs.filter((h) => h.tipo === "lideres").map(conLibres),
      });
    }
  }
  const pisoDe = new Map<string, Piso>();
  for (const p of pisos) for (const d of [...p.dormitorios, ...p.lideres]) pisoDe.set(d.h.id, p);

  const camaJoven = new Map<string, string | null>();
  const camaLider = new Map<string, string | null>();
  /** Dónde queda cada joven (fijo o acomodado), para ubicar a sus líderes. */
  const habitacionFinal = (j: PersonaParaAcomodar) => (camaJoven.has(j.id) ? camaJoven.get(j.id)! : j.habitacion_id);

  const poner = (piso: Piso, personas: PersonaParaAcomodar[]) => {
    let i = 0;
    for (const d of piso.dormitorios) {
      while (d.libres > 0 && i < personas.length) {
        camaJoven.set(personas[i++].id, d.h.id);
        d.libres--;
      }
    }
    return personas.slice(i);
  };

  for (const sexo of SEXOS) {
    const pisosSexo = pisos.filter((p) => p.edificio.sexo === sexo);
    let sinLugar = 0;
    for (const c of orden) {
      let grupo = jovenes
        .filter((j) => j.sexo === sexo && j.compania_id === c.id && movibleJoven(j))
        .sort((a, b) => porNombre.compare(a.nombre, b.nombre));
      if (grupo.length === 0) continue;
      // Si parte de la compañía ya tiene cama (al completar), primero ese piso.
      const pisosPrevios = new Map<Piso, number>();
      for (const j of jovenes) {
        const h = !movibleJoven(j) && j.sexo === sexo && j.compania_id === c.id ? j.habitacion_id : null;
        const p = h ? pisoDe.get(h) : undefined;
        if (p) pisosPrevios.set(p, (pisosPrevios.get(p) ?? 0) + 1);
      }
      const preferidos = [...pisosPrevios.entries()].sort((a, b) => b[1] - a[1]).map(([p]) => p);
      const entero = [...preferidos, ...pisosSexo].find((p) => libresDe(p) >= grupo.length);
      if (entero) {
        poner(entero, grupo);
        continue;
      }
      // No entra junta en ningún piso: se reparte, empezando por donde haya más lugar.
      const usados = new Set<Piso>();
      for (const p of [...preferidos, ...[...pisosSexo].sort((a, b) => libresDe(b) - libresDe(a))]) {
        if (grupo.length === 0) break;
        if (libresDe(p) === 0 || usados.has(p)) continue;
        usados.add(p);
        grupo = poner(p, grupo);
      }
      if (usados.size > 1) avisos.push(`La compañía ${c.numero} no entra junta en un piso: sus ${sexo === "Mujer" ? "mujeres" : "hombres"} quedan en ${usados.size} pisos.`);
      for (const j of grupo) camaJoven.set(j.id, null);
      sinLugar += grupo.length;
    }
    if (sinLugar > 0) avisos.push(`Faltan ${sinLugar} ${sexo === "Mujer" ? "camas de mujeres" : "camas de hombres"}: ${sinLugar === 1 ? "queda 1 joven" : `quedan ${sinLugar} jóvenes`} sin cama. Agrega pisos o camas.`);
  }

  // Líderes: primero consejeros y consejeras (al piso con más jóvenes de su
  // compañía y su sexo), después los coordinadores.
  const lideresMovibles = lideres
    .filter(movibleLider)
    .sort((a, b) => Number(b.titular) - Number(a.titular) || (numeroDe.get(a.compania_id!) ?? 0) - (numeroDe.get(b.compania_id!) ?? 0) || porNombre.compare(a.nombre, b.nombre));
  const lejos: string[] = [];
  const sinCamaLider: string[] = [];
  for (const l of lideresMovibles) {
    const pisosSexo = pisos.filter((p) => p.edificio.sexo === l.sexo);
    const cuenta = new Map<Piso, number>();
    for (const j of jovenes) {
      if (j.compania_id !== l.compania_id || j.sexo !== l.sexo) continue;
      const h = habitacionFinal(j);
      const p = h ? pisoDe.get(h) : undefined;
      if (p) cuenta.set(p, (cuenta.get(p) ?? 0) + 1);
    }
    const suyos = [...cuenta.entries()].sort((a, b) => b[1] - a[1]).map(([p]) => p);
    const cerca = suyos.length ? pisosSexo.filter((p) => p.edificio.id === suyos[0].edificio.id) : [];
    const candidatos = [...suyos, ...cerca, ...pisosSexo];
    let puesto: string | null = null;
    for (const p of candidatos) {
      const libre = p.lideres.find((d) => d.libres > 0);
      if (libre) {
        libre.libres--;
        puesto = libre.h.id;
        if (suyos.length && p !== suyos[0] && l.titular) lejos.push(l.nombre);
        break;
      }
    }
    camaLider.set(l.id, puesto);
    if (!puesto) sinCamaLider.push(l.nombre);
  }
  if (lejos.length) avisos.push(`Sin lugar en la habitación de líderes del piso de sus jóvenes: ${lejos.join(", ")} (duermen en otro piso).`);
  if (sinCamaLider.length) avisos.push(`No hay camas de líderes libres para: ${sinCamaLider.join(", ")}.`);

  const jovenesSinCompania = jovenes.filter((j) => !j.compania_id && !j.habitacion_id).length;
  if (jovenesSinCompania) avisos.push(`${jovenesSinCompania === 1 ? "1 joven sin compañía no se acomoda" : `${jovenesSinCompania} jóvenes sin compañía no se acomodan`}: primero repártelos en compañías.`);
  const sinSexo = jovenes.filter((j) => !j.sexo && j.compania_id && !j.habitacion_id).length;
  if (sinSexo) avisos.push(`${sinSexo === 1 ? "1 joven" : `${sinSexo} jóvenes`} sin sexo indicado: complétalo en su ficha para darle cama.`);
  const lideresSinCompania = lideres.filter((l) => !l.compania_id && !l.habitacion_id).length;
  if (lideresSinCompania) avisos.push(`${lideresSinCompania === 1 ? "1 consejero o coordinador sin compañía no se acomoda" : `${lideresSinCompania} consejeros o coordinadores sin compañía no se acomodan`}.`);

  // Vista por piso, con lo que ya estaba y lo nuevo.
  const numeroDeJoven = (j: PersonaParaAcomodar) => (j.compania_id ? (numeroDe.get(j.compania_id) ?? 0) : 0);
  const vista: PisoPropuesto[] = pisos.map((p) => {
    const dormitorios = new Set(p.dormitorios.map((d) => d.h.id));
    const deLideres = new Set(p.lideres.map((d) => d.h.id));
    const aqui = jovenes.filter((j) => {
      const h = habitacionFinal(j);
      return h !== null && dormitorios.has(h);
    });
    const porCompania: Record<number, number> = {};
    for (const j of aqui) porCompania[numeroDeJoven(j)] = (porCompania[numeroDeJoven(j)] ?? 0) + 1;
    const lideresAqui = lideres
      .filter((l) => {
        const h = camaLider.has(l.id) ? camaLider.get(l.id)! : l.habitacion_id;
        return h !== null && deLideres.has(h);
      })
      .map((l) => ({
        nombre: l.nombre,
        compania: l.compania_id ? (numeroDe.get(l.compania_id) ?? null) : null,
        funcion: l.funcion,
        sexo: l.sexo,
        nuevo: camaLider.has(l.id) && camaLider.get(l.id) !== l.habitacion_id,
      }))
      .sort((a, b) => (a.compania ?? 999) - (b.compania ?? 999) || porNombre.compare(a.nombre, b.nombre));
    return {
      edificio: { id: p.edificio.id, nombre: p.edificio.nombre, sexo: p.edificio.sexo },
      piso: p.numero,
      camas: p.dormitorios.reduce((n, d) => n + d.h.capacidad, 0),
      ocupadas: aqui.length,
      porCompania,
      nuevos: aqui.filter((j) => camaJoven.has(j.id) && camaJoven.get(j.id) !== j.habitacion_id).length,
      camasLideres: p.lideres.reduce((n, d) => n + d.h.capacidad, 0),
      lideres: lideresAqui,
    };
  });

  const lista = (m: Map<string, string | null>) =>
    [...m.entries()].map(([id, habitacion_id]) => ({ id, habitacion_id })).sort((a, b) => a.id.localeCompare(b.id));
  const listaJovenes = lista(camaJoven);
  const listaLideres = lista(camaLider);
  // Al completar solo se mandan quienes reciben cama; al rehacer, todos (null = sin cama).
  const jovenesSalida = rehacer ? listaJovenes : listaJovenes.filter((a) => a.habitacion_id);
  const lideresSalida = rehacer ? listaLideres : listaLideres.filter((a) => a.habitacion_id);
  const antes = new Map([...jovenes, ...lideres].map((p) => [p.id, p.habitacion_id]));
  return {
    jovenes: jovenesSalida,
    lideres: lideresSalida,
    pisos: vista,
    avisos,
    acomodados: [...jovenesSalida, ...lideresSalida].filter((a) => a.habitacion_id && a.habitacion_id !== antes.get(a.id)).length,
    huella: huellaDe(
      `h|${alcance}|` + [...jovenesSalida, ...lideresSalida].map((a) => `${a.id}:${a.habitacion_id ?? "-"}`).join(";"),
    ),
  };
}
