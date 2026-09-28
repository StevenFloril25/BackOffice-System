/** Iniciales para el avatar: "María José Pérez" -> "MP", "ana@x.com" -> "AN". */
export function iniciales(texto: string): string {
  const limpio = texto.includes("@") ? texto.split("@")[0] : texto;
  const partes = limpio.trim().split(/[\s._-]+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

const TONOS_AVATAR = [
  "bg-marca-100 text-marca-800",
  "bg-hoja-100 text-hoja-700",
  "bg-sol-100 text-sol-600",
  "bg-marca-200 text-marca-900",
  "bg-hoja-200 text-hoja-700",
];

/** Color estable por persona: el mismo texto siempre da el mismo tono. */
export function tonoAvatar(semilla: string): string {
  let h = 0;
  for (const c of semilla) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TONOS_AVATAR[h % TONOS_AVATAR.length];
}

/**
 * Contraseña temporal legible: sin caracteres que se confunden al dictarla
 * (0/O, 1/l/I). 12 caracteres de un alfabeto de 55 dan ~69 bits.
 */
export function generarClaveTemporal(largo = 12): string {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint32Array(largo);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join("");
}

export function plural(n: number, singular: string, pluralTexto = `${singular}s`) {
  return `${n} ${n === 1 ? singular : pluralTexto}`;
}
