/**
 * Extrae el token de lo que leyó la cámara: puede ser el enlace completo
 * (https://…/asistencia/<token>) o el token solo. Devuelve null si no parece
 * un QR de la conferencia, para no consultar la base por cualquier código.
 */
export function tokenDeQr(texto: string): string | null {
  const t = texto.trim();
  const enEnlace = t.match(/\/asistencia\/([0-9a-f]{32})(?:[/?#]|$)/i);
  if (enEnlace) return enEnlace[1].toLowerCase();
  if (/^[0-9a-f]{32}$/i.test(t)) return t.toLowerCase();
  return null;
}
