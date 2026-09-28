import "server-only";

import { headers } from "next/headers";
import QRCode from "qrcode";

/**
 * Lo que va dentro del QR: un enlace a /asistencia/<token>. El lector de la
 * aplicación extrae el token; y si alguien lo escanea con la cámara normal del
 * celular, el enlace abre la aplicación en la ficha de llegada (quien no tenga
 * sesión o permiso no ve nada).
 */
export async function urlAsistencia(token: string): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "backoffice-fsy.vercel.app";
  const protocolo = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocolo}://${host}/asistencia/${token}`;
}

export async function qrSvg(contenido: string): Promise<string> {
  return QRCode.toString(contenido, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#012a42", light: "#ffffff" },
  });
}
