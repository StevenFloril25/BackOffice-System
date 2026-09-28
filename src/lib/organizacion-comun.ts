/** Tipos y utilidades de consejeros, compañías y edificios (servidor y navegador). */

import type { BarrioResumen } from "@/lib/participantes-comun";

export type Sexo = "Hombre" | "Mujer";

/** jovenes: el dormitorio del piso. lideres: la habitación de los consejeros. */
export type TipoHabitacion = "jovenes" | "lideres";

export interface EdificioResumen {
  id: string;
  nombre: string;
  sexo: Sexo;
}

export interface HabitacionResumen {
  id: string;
  nombre: string;
  piso: number;
  tipo: TipoHabitacion;
  edificio: EdificioResumen | null;
}

export interface CompaniaResumen {
  id: string;
  numero: number;
  nombre: string;
}

export interface ConsejeroResumen {
  id: string;
  nombres: string;
  apellidos: string;
  sexo: Sexo;
  foto_path: string | null;
}

export interface Consejero extends ConsejeroResumen {
  fecha_nacimiento: string | null;
  telefono: string | null;
  correo: string | null;
  barrio_id: string | null;
  talla_camiseta: string | null;
  contacto_emergencia_nombre: string | null;
  contacto_emergencia_telefono: string | null;
  notas: string | null;
  habitacion_id: string | null;
  /** Su cuenta de acceso (rol Consejero). */
  profile_id: string | null;
  created_at: string;
  barrio: BarrioResumen | null;
  habitacion: HabitacionResumen | null;
}

/** Persona que ocupa una cama o forma parte de una compañía, con lo justo para listarla. */
export interface Integrante {
  id: string;
  tipo: "participante" | "consejero";
  nombre: string;
  sexo: Sexo | null;
  edad: number | null;
  barrio: string | null;
  foto: string | null;
  /** Compañía (para ocupantes de una habitación) o dónde duerme (para jóvenes de una compañía). */
  extra: string | null;
  /** Número de su compañía, para pintarlo con su color. */
  compania: number | null;
}

export function nombreCompania(c: Pick<CompaniaResumen, "numero" | "nombre">) {
  return c.nombre ? `Compañía ${c.numero} · ${c.nombre}` : `Compañía ${c.numero}`;
}

/** "Abish · piso 1 · Jóvenes" */
export function nombreHabitacion(h: Pick<HabitacionResumen, "nombre" | "piso" | "edificio">) {
  return [h.edificio?.nombre, `piso ${h.piso}`, h.nombre].filter(Boolean).join(" · ");
}

/** "mujeres" / "hombres", para "Edificio de mujeres" y avisos. */
export function sexoPlural(sexo: Sexo | null) {
  return sexo === "Mujer" ? "mujeres" : sexo === "Hombre" ? "hombres" : "—";
}

/** Consejero o consejera según el sexo. */
export function rolConsejero(sexo: Sexo | null) {
  return sexo === "Mujer" ? "Consejera" : "Consejero";
}

/**
 * Color fijo de cada compañía para los gráficos: la misma compañía sale siempre
 * del mismo color. El ángulo dorado reparte bien los tonos aunque sean 20 o más.
 */
export function colorCompania(numero: number) {
  return `hsl(${Math.round((numero * 137.508) % 360)} 62% 47%)`;
}
