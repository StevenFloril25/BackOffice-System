"use client";

import { Download, Printer, Share2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { EncabezadoTarjeta, Tarjeta, claseBoton } from "@/components/ui";
import { crearCredencialPng } from "@/lib/credencial-png";
import { MARCA } from "@/lib/marca";

export function QrParticipante({
  id,
  contenido,
  svg,
  nombre,
  barrio,
  estaca,
}: {
  id: string;
  contenido: string;
  svg: string;
  nombre: string;
  barrio: string;
  estaca: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const archivo = `credencial-${nombre.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-")}.png`;

  async function generar() {
    setError(null);
    setTrabajando(true);
    try {
      return await crearCredencialPng({ contenido, nombre, barrio, estaca, marca: MARCA });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar la credencial.");
      return null;
    } finally {
      setTrabajando(false);
    }
  }

  async function descargar() {
    const png = await generar();
    if (!png) return;
    const url = URL.createObjectURL(png);
    const a = document.createElement("a");
    a.href = url;
    a.download = archivo;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async function compartir() {
    const png = await generar();
    if (!png) return;
    const file = new File([png], archivo, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: `Credencial ${MARCA.nombre}`, text: `Credencial de ${nombre} para ${MARCA.nombre}` });
      } catch {
        // Cancelar el menú de compartir no es un error.
      }
    } else {
      setError("Este dispositivo no permite compartir archivos: usa Descargar.");
    }
  }

  return (
    <Tarjeta>
      <EncabezadoTarjeta titulo="Código QR" descripcion="Lo presenta al llegar para registrar su asistencia." />
      <div className="space-y-4 p-5 sm:p-6">
        <div
          className="mx-auto w-full max-w-[220px] rounded-2xl border border-slate-200 bg-white p-3 [&>svg]:h-auto [&>svg]:w-full"
          // SVG generado en el servidor por la librería qrcode a partir del token: no contiene texto del usuario.
          dangerouslySetInnerHTML={{ __html: svg }}
          role="img"
          aria-label={`Código QR de ${nombre}`}
        />
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={descargar} disabled={trabajando} className={claseBoton("primario", "sm")}>
            <Download className="size-3.5" aria-hidden />
            Descargar
          </button>
          <button type="button" onClick={compartir} disabled={trabajando} className={claseBoton("secundario", "sm")}>
            <Share2 className="size-3.5" aria-hidden />
            Compartir
          </button>
          <Link href={`/credenciales?id=${id}`} target="_blank" className={`${claseBoton("fantasma", "sm")} col-span-2`}>
            <Printer className="size-3.5" aria-hidden />
            Imprimir credencial
          </Link>
        </div>
        {error && <p className="text-center text-xs font-medium text-red-600">{error}</p>}
      </div>
    </Tarjeta>
  );
}
