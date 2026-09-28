/** Agenda de la sesión: tipos y cálculos que usan tanto el servidor como el navegador. */

/** La sesión es en Quito: "hoy" y "ahora" se cuentan con esta hora. */
export const ZONA_HORARIA = "America/Guayaquil";

export interface DiaAgenda {
  dia: number;
  /** AAAA-MM-DD */
  fecha: string | null;
  vestimenta: string | null;
  notas: string | null;
}

export interface Actividad {
  id: string;
  dia: number;
  /** HH:MM:SS, o null si la hora se decide en la sesión. */
  hora_inicio: string | null;
  hora_fin: string | null;
  actividad: string;
  lugar: string | null;
  solo_personal: boolean;
}

/** "7:30" a partir de "07:30:00". */
export function hora(t: string | null): string {
  if (!t) return "";
  const [h, m] = t.split(":");
  return `${Number(h)}:${m}`;
}

export function horario(a: Pick<Actividad, "hora_inicio" | "hora_fin">): string {
  if (!a.hora_inicio) return "Por definir";
  return a.hora_fin ? `${hora(a.hora_inicio)} – ${hora(a.hora_fin)}` : hora(a.hora_inicio);
}

const minutos = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

/** Fecha (AAAA-MM-DD) y minuto del día en Quito. */
export function ahoraEnLaSesion(momento = new Date()): { fecha: string; minuto: number } {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: ZONA_HORARIA,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(momento)
      .map((p) => [p.type, p.value]),
  );
  return { fecha: `${partes.year}-${partes.month}-${partes.day}`, minuto: Number(partes.hour) * 60 + Number(partes.minute) };
}

/** Qué día de la sesión es hoy (o null si hoy no hay sesión o faltan las fechas). */
export function diaDeHoy(dias: DiaAgenda[], momento = new Date()): number | null {
  const { fecha } = ahoraEnLaSesion(momento);
  return dias.find((d) => d.fecha === fecha)?.dia ?? null;
}

/**
 * Lo que pasa ahora y lo que sigue en el día dado. Una actividad sin hora de
 * fin ("Apagar las luces") cuenta como "ahora" durante 15 minutos.
 */
export function ahoraYSigue(actividades: Actividad[], minuto: number): { ahora: Actividad[]; sigue: Actividad[] } {
  const conHora = actividades.filter((a) => a.hora_inicio);
  const ahora = conHora.filter((a) => {
    const inicio = minutos(a.hora_inicio!);
    const fin = a.hora_fin ? minutos(a.hora_fin) : inicio + 15;
    return inicio <= minuto && minuto < fin;
  });
  const proximas = conHora.filter((a) => minutos(a.hora_inicio!) > minuto);
  const primera = Math.min(...proximas.map((a) => minutos(a.hora_inicio!)));
  return { ahora, sigue: proximas.filter((a) => minutos(a.hora_inicio!) === primera) };
}

/** "Lunes 12 de julio" */
export function fechaLarga(fecha: string): string {
  const [a, m, d] = fecha.split("-").map(Number);
  const texto = new Date(Date.UTC(a, m - 1, d, 12)).toLocaleDateString("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** "lun 12" */
export function fechaCorta(fecha: string): string {
  const [a, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d, 12))
    .toLocaleDateString("es", { weekday: "short", day: "numeric", timeZone: "UTC" })
    .replace(".", "");
}

/** Suma días a una fecha AAAA-MM-DD. */
export function sumarDias(fecha: string, dias: number): string {
  const [a, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}
