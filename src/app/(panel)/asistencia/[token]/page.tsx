import type { Metadata } from "next";
import Link from "@/components/enlace";
import { notFound } from "next/navigation";

import { SinAcceso } from "@/components/sin-acceso";
import { EncabezadoPagina, Tarjeta, claseBoton } from "@/components/ui";
import { exigirSesion, puede } from "@/lib/sesion";
import { ConfirmarLlegada } from "./confirmar";

export const metadata: Metadata = { title: "Llegada" };

/**
 * Destino del enlace que va dentro del QR, para cuando alguien lo escanea con
 * la cámara normal del celular en vez del lector de la aplicación. No registra
 * nada al abrirse (un GET no debe cambiar datos: los navegadores precargan
 * enlaces): muestra a la persona y pide confirmar.
 */
export default async function LlegadaPorEnlace({ params }: { params: Promise<{ token: string }> }) {
  const sesion = await exigirSesion();
  if (!puede(sesion, "asistencia.registrar")) return <SinAcceso permiso="asistencia.registrar" />;

  const { token } = await params;
  if (!/^[0-9a-f]{32}$/i.test(token)) notFound();

  return (
    <>
      <EncabezadoPagina titulo="Registrar llegada" migas={[{ etiqueta: "Asistencia", href: "/asistencia" }, { etiqueta: "Código QR" }]} />
      <div className="mx-auto max-w-lg space-y-4">
        <ConfirmarLlegada token={token.toLowerCase()} />
        <Tarjeta className="p-4 text-center text-sm text-slate-500">
          Para registrar a muchos seguidos, usa el{" "}
          <Link href="/asistencia" className={claseBoton("fantasma", "sm")}>
            lector de la aplicación
          </Link>
        </Tarjeta>
      </div>
    </>
  );
}
