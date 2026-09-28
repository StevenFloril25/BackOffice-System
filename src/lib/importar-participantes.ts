import "server-only";

import ExcelJS from "exceljs";

import { claveParticipante, ESTADOS_INSCRIPCION, type EstadoInscripcion, type Salud } from "@/lib/participantes";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Importa la exportación del sistema de inscripción (Excel).
 *
 * Reglas:
 *  - Las columnas se reconocen por su título, no por su posición: si el
 *    sistema de inscripción agrega o mueve una columna, la importación sigue.
 *  - Los adjuntos (RUI, permiso médico, foto) no se importan.
 *  - La misma persona (nombres + apellidos + nacimiento) se actualiza en vez de
 *    duplicarse. Si viene dos veces en el mismo archivo (se inscribió, canceló
 *    y volvió a inscribirse), gana la inscripción vigente y, a igualdad, la más
 *    reciente.
 *  - Nunca toca lo que se gestiona aquí: foto, QR ni asistencia.
 *  - Un barrio nuevo se crea con el obispo del Excel; uno existente solo recibe
 *    los datos del obispo que le falten (no pisa lo que se corrigió a mano).
 */

type Campo =
  | "nombres" | "apellidos" | "nombre_preferido" | "fecha_nacimiento" | "sexo" | "telefono" | "correo"
  | "talla_camiseta" | "contacto1_nombre" | "contacto1_correo" | "contacto1_telefono"
  | "contacto2_nombre" | "contacto2_correo" | "contacto2_telefono" | "edad_inscripcion"
  | "fecha_inscripcion" | "estado_inscripcion" | "tipo" | "estaca" | "barrio"
  | "obispo_correo" | "obispo_nombre" | keyof Salud;

// Títulos del Excel (normalizados: sin tildes, signos ni mayúsculas) -> campo.
const COLUMNAS: [string, Campo][] = [
  ["nombre de pila", "nombres"],
  ["apellido", "apellidos"],
  ["nombre que se prefiere", "nombre_preferido"],
  ["cumpleanos", "fecha_nacimiento"],
  ["sexo", "sexo"],
  ["telefono del contacto 1", "contacto1_telefono"],
  ["telefono del contacto 2", "contacto2_telefono"],
  ["telefono", "telefono"],
  ["correo electronico del contacto 1", "contacto1_correo"],
  ["correo electronico del contacto 2", "contacto2_correo"],
  ["correo electronico del obispo", "obispo_correo"],
  ["correo electronico", "correo"],
  ["informacion medica", "informacion_medica"],
  ["talla de camiseta", "talla_camiseta"],
  ["informacion alimentaria", "informacion_alimentaria"],
  ["nombre del contacto 1", "contacto1_nombre"],
  ["nombre del contacto 2", "contacto2_nombre"],
  ["edad", "edad_inscripcion"],
  ["fecha", "fecha_inscripcion"],
  ["estado", "estado_inscripcion"],
  ["tipo", "tipo"],
  ["nombre de la estaca o distrito", "estaca"],
  ["nombre del barrio o rama", "barrio"],
  ["nombre del obispo", "obispo_nombre"],
  ["grupo sanguineo y factor rh", "grupo_sanguineo"],
  ["sufres de algun tipo de alergia", "alergias"],
  ["recibes algun tipo de tratamiento medico", "tratamiento_medico"],
  ["eres diabetico o asmatico", "diabetes_asma"],
  ["con que seguro medico cuentas", "seguro_medico"],
];

const CAMPOS_SALUD: (keyof Salud)[] = [
  "informacion_medica", "informacion_alimentaria", "grupo_sanguineo", "alergias",
  "tratamiento_medico", "diabetes_asma", "seguro_medico",
];

export interface ResumenImportacion {
  filas: number;
  nuevos: number;
  actualizados: number;
  duplicadosEnArchivo: number;
  barriosNuevos: number;
  omitidas: { fila: number; motivo: string }[];
}

function normalizar(t: string) {
  return t
    .replace(/ /g, " ")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[¿?()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function textoCelda(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((r) => r.text).join("").trim();
    if ("text" in v) return String(v.text).trim();
    if ("result" in v) return String(v.result ?? "").trim();
  }
  return String(v).trim();
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "2013-08-30", "30/08/2013" o una fecha de Excel -> "2013-08-30". */
function fechaISO(v: ExcelJS.CellValue): string | null {
  if (v instanceof Date) return `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`;
  const t = textoCelda(v);
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
  return null;
}

/** "27/9/2026, 15:19:59" (hora de Ecuador) -> ISO con zona. */
function momentoISO(v: ExcelJS.CellValue): string | null {
  if (v instanceof Date) return v.toISOString();
  const m = textoCelda(v).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}T${pad(+m[4])}:${m[5]}:${m[6] ?? "00"}-05:00`;
}

function estado(t: string): EstadoInscripcion {
  const n = normalizar(t);
  return ESTADOS_INSCRIPCION.find((e) => normalizar(e) === n) ?? "Pendiente de aprobación";
}

function masFrecuente(valores: string[]): string {
  const c = new Map<string, number>();
  for (const v of valores) if (v) c.set(v, (c.get(v) ?? 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
}

export async function importarParticipantes(archivo: Blob): Promise<ResumenImportacion> {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(await archivo.arrayBuffer());

  // La hoja cuyo encabezado tenga "Nombre de pila" (en la exportación: "Participante").
  let hoja: ExcelJS.Worksheet | undefined;
  let mapa = new Map<number, Campo>();
  for (const h of libro.worksheets) {
    const m = new Map<number, Campo>();
    h.getRow(1).eachCell((celda, col) => {
      const titulo = normalizar(textoCelda(celda.value));
      const par = COLUMNAS.find(([t]) => titulo === t || titulo.startsWith(`${t} `) || titulo.startsWith(t));
      if (par && ![...m.values()].includes(par[1])) m.set(col, par[1]);
    });
    if ([...m.values()].includes("nombres")) {
      hoja = h;
      mapa = m;
      if (normalizar(h.name) === "participante") break;
    }
  }
  if (!hoja) throw new Error("No encontré una hoja con la columna «Nombre de pila». ¿Es la exportación de inscripciones?");
  const faltan = (["nombres", "apellidos", "barrio"] as Campo[]).filter((c) => ![...mapa.values()].includes(c));
  if (faltan.length) throw new Error(`Al archivo le faltan columnas: ${faltan.join(", ")}.`);

  const resumen: ResumenImportacion = { filas: 0, nuevos: 0, actualizados: 0, duplicadosEnArchivo: 0, barriosNuevos: 0, omitidas: [] };

  type Fila = Record<Campo, string | null> & { _fila: number; _clave: string };
  const porClave = new Map<string, Fila>();

  hoja.eachRow((fila, numero) => {
    if (numero === 1) return;
    const r = {} as Fila;
    let vacia = true;
    for (const [col, campo] of mapa) {
      const valor = fila.getCell(col).value;
      let texto: string | null;
      if (campo === "fecha_nacimiento") texto = fechaISO(valor);
      else if (campo === "fecha_inscripcion") texto = momentoISO(valor);
      else texto = textoCelda(valor) || null;
      if (texto) vacia = false;
      r[campo] = texto;
    }
    if (vacia) return;
    resumen.filas++;
    r._fila = numero;
    if (!r.nombres || !r.apellidos) {
      resumen.omitidas.push({ fila: numero, motivo: "Sin nombre o apellido" });
      return;
    }
    if (!r.barrio) {
      resumen.omitidas.push({ fila: numero, motivo: "Sin barrio" });
      return;
    }
    r._clave = claveParticipante(r.nombres, r.apellidos, r.fecha_nacimiento);
    const previa = porClave.get(r._clave);
    if (previa) {
      resumen.duplicadosEnArchivo++;
      const vigente = (x: Fila) => (estado(x.estado_inscripcion ?? "") === "Cancelado" ? 0 : 1);
      const gana =
        vigente(r) !== vigente(previa)
          ? vigente(r) > vigente(previa)
          : (r.fecha_inscripcion ?? "") > (previa.fecha_inscripcion ?? "");
      if (!gana) return;
    }
    porClave.set(r._clave, r);
  });

  const filas = [...porClave.values()];
  const admin = createAdminClient();

  // --- Barrios -------------------------------------------------------------
  const { data: existentes } = await admin.from("barrios").select("id, estaca, nombre, obispo_nombre, obispo_correo");
  const claveBarrio = (estaca: string, nombre: string) => `${normalizar(estaca)}|${normalizar(nombre)}`;
  const barrioId = new Map<string, string>();
  for (const b of existentes ?? []) barrioId.set(claveBarrio(b.estaca, b.nombre), b.id);

  const grupos = new Map<string, Fila[]>();
  for (const f of filas) {
    const k = claveBarrio(f.estaca ?? "", f.barrio ?? "");
    grupos.set(k, [...(grupos.get(k) ?? []), f]);
  }
  for (const [k, grupo] of grupos) {
    const obispoNombre = masFrecuente(grupo.map((g) => g.obispo_nombre ?? ""));
    const obispoCorreo = masFrecuente(grupo.map((g) => (g.obispo_correo ?? "").toLowerCase()));
    const previo = (existentes ?? []).find((b) => claveBarrio(b.estaca, b.nombre) === k);
    if (!previo) {
      const { data, error } = await admin
        .from("barrios")
        .insert({
          estaca: grupo[0].estaca ?? "",
          nombre: grupo[0].barrio!,
          obispo_nombre: obispoNombre,
          obispo_correo: obispoCorreo || null,
        })
        .select("id")
        .single();
      if (error) throw new Error(`No se pudo crear el barrio ${grupo[0].barrio}: ${error.message}`);
      barrioId.set(k, data.id);
      resumen.barriosNuevos++;
    } else if ((!previo.obispo_nombre && obispoNombre) || (!previo.obispo_correo && obispoCorreo)) {
      await admin
        .from("barrios")
        .update({
          ...(!previo.obispo_nombre && obispoNombre ? { obispo_nombre: obispoNombre } : {}),
          ...(!previo.obispo_correo && obispoCorreo ? { obispo_correo: obispoCorreo } : {}),
        })
        .eq("id", previo.id);
    }
  }

  // --- Participantes ------------------------------------------------------
  const { data: yaEstan } = await admin.from("participantes").select("clave_importacion").not("clave_importacion", "is", null);
  const conocidas = new Set((yaEstan ?? []).map((x) => x.clave_importacion as string));

  const registros = filas.map((f) => {
    const sexo = f.sexo === "Hombre" || f.sexo === "Mujer" ? f.sexo : null;
    const edadNum = Number.parseInt(f.edad_inscripcion ?? "", 10);
    return {
      clave_importacion: f._clave,
      origen: "importacion",
      nombres: f.nombres!,
      apellidos: f.apellidos!,
      nombre_preferido: f.nombre_preferido ?? "",
      fecha_nacimiento: f.fecha_nacimiento,
      sexo,
      telefono: f.telefono,
      correo: f.correo?.toLowerCase() ?? null,
      talla_camiseta: f.talla_camiseta,
      contacto1_nombre: f.contacto1_nombre,
      contacto1_correo: f.contacto1_correo?.toLowerCase() ?? null,
      contacto1_telefono: f.contacto1_telefono,
      contacto2_nombre: f.contacto2_nombre,
      contacto2_correo: f.contacto2_correo?.toLowerCase() ?? null,
      contacto2_telefono: f.contacto2_telefono,
      edad_inscripcion: Number.isFinite(edadNum) ? edadNum : null,
      fecha_inscripcion: f.fecha_inscripcion,
      estado_inscripcion: estado(f.estado_inscripcion ?? ""),
      tipo: f.tipo ?? "Participante",
      barrio_id: barrioId.get(claveBarrio(f.estaca ?? "", f.barrio ?? ""))!,
    };
  });

  for (const r of registros) {
    if (conocidas.has(r.clave_importacion)) resumen.actualizados++;
    else resumen.nuevos++;
  }

  const LOTE = 100;
  const ids = new Map<string, string>();
  for (let i = 0; i < registros.length; i += LOTE) {
    const { data, error } = await admin
      .from("participantes")
      .upsert(registros.slice(i, i + LOTE), { onConflict: "clave_importacion" })
      .select("id, clave_importacion");
    if (error) throw new Error(`No se pudieron guardar los participantes: ${error.message}`);
    for (const d of data ?? []) ids.set(d.clave_importacion as string, d.id as string);
  }

  const salud = filas.map((f) => {
    const s: Record<string, string | null> = { participante_id: ids.get(f._clave)! };
    for (const c of CAMPOS_SALUD) s[c] = f[c];
    return s;
  });
  for (let i = 0; i < salud.length; i += LOTE) {
    const { error } = await admin.from("participantes_salud").upsert(salud.slice(i, i + LOTE), { onConflict: "participante_id" });
    if (error) throw new Error(`No se pudo guardar la información médica: ${error.message}`);
  }

  return resumen;
}
