/** Tipos y utilidades de participantes que usan tanto el servidor como el navegador. */

import type { CompaniaResumen, HabitacionResumen } from "@/lib/organizacion-comun";

export const TALLAS = ["XS (unisex)", "S (unisex)", "M (unisex)", "L (unisex)", "XL (unisex)", "2XL (unisex)"];

export interface BarrioResumen {
  id: string;
  nombre: string;
  estaca: string;
}

export interface Participante {
  id: string;
  nombres: string;
  apellidos: string;
  nombre_preferido: string;
  fecha_nacimiento: string | null;
  sexo: "Hombre" | "Mujer" | null;
  telefono: string | null;
  correo: string | null;
  talla_camiseta: string | null;
  contacto1_nombre: string | null;
  contacto1_correo: string | null;
  contacto1_telefono: string | null;
  contacto2_nombre: string | null;
  contacto2_correo: string | null;
  contacto2_telefono: string | null;
  edad_inscripcion: number | null;
  fecha_inscripcion: string | null;
  tipo: string;
  barrio_id: string | null;
  foto_path: string | null;
  qr_token: string;
  asistio_at: string | null;
  asistencia_por: string | null;
  /** Se marca solo al registrar la llegada, o con la casilla de la ficha (ver 0010). */
  kit_entregado_at: string | null;
  kit_origen: "llegada" | "casilla" | null;
  compania_id: string | null;
  habitacion_id: string | null;
  origen: "manual" | "importacion";
  created_at: string;
  barrio: BarrioResumen | null;
  compania: CompaniaResumen | null;
  habitacion: HabitacionResumen | null;
}

export interface Salud {
  informacion_medica: string | null;
  informacion_alimentaria: string | null;
  grupo_sanguineo: string | null;
  alergias: string | null;
  tratamiento_medico: string | null;
  diabetes_asma: string | null;
  seguro_medico: string | null;
}

export const CAMPOS_SALUD: { clave: keyof Salud; etiqueta: string }[] = [
  { clave: "informacion_medica", etiqueta: "Información médica" },
  { clave: "informacion_alimentaria", etiqueta: "Información alimentaria" },
  { clave: "alergias", etiqueta: "¿Sufre algún tipo de alergia?" },
  { clave: "tratamiento_medico", etiqueta: "¿Recibe algún tratamiento médico?" },
  { clave: "diabetes_asma", etiqueta: "¿Es diabético o asmático?" },
  { clave: "grupo_sanguineo", etiqueta: "Grupo sanguíneo y factor (RH)" },
  { clave: "seguro_medico", etiqueta: "Seguro médico" },
];

/** Edad hoy a partir de la fecha de nacimiento (AAAA-MM-DD). */
export function edad(fecha: string | null): number | null {
  if (!fecha) return null;
  const [a, m, d] = fecha.split("-").map(Number);
  if (!a || !m || !d) return null;
  const hoy = new Date();
  let e = hoy.getFullYear() - a;
  if (hoy.getMonth() + 1 < m || (hoy.getMonth() + 1 === m && hoy.getDate() < d)) e--;
  return e;
}

export function nombreCompleto(p: Pick<Participante, "nombres" | "apellidos">) {
  return `${p.nombres} ${p.apellidos}`.trim();
}

/**
 * Clave para reconocer a la misma persona entre importaciones: nombres +
 * apellidos + fecha de nacimiento, sin tildes, mayúsculas ni espacios de más.
 */
export function claveParticipante(nombres: string, apellidos: string, fechaNacimiento: string | null) {
  const n = (t: string) =>
    t
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  return `${n(nombres)}|${n(apellidos)}|${fechaNacimiento ?? ""}`;
}
