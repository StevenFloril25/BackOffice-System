"use client";

import clsx from "clsx";
import { Camera, Loader2, Trash2 } from "lucide-react";
import Image from "next/image";
import { useRef, useState, useTransition } from "react";

import { claseBoton } from "@/components/ui";
import { iniciales, tonoAvatar } from "@/lib/utilidades";

type Resultado = { ok?: string; error?: string } | undefined;

interface Props {
  /** URL firmada de la foto actual, o null. */
  url: string | null;
  /** Nombre o correo, para las iniciales cuando no hay foto. */
  texto: string;
  /** "circulo" para usuarios; "carnet" (3:4) para participantes. */
  forma?: "circulo" | "carnet";
  editable: boolean;
  subir: (datos: FormData) => Promise<Resultado>;
  quitar?: () => Promise<Resultado>;
}

const LADO_MAYOR = 640;

/**
 * Recorta al centro con la proporción pedida y reduce a 640 px antes de subir.
 * Una foto de celular pesa varios MB; así queda en decenas de KB y el servidor
 * nunca recibe el original.
 */
async function prepararImagen(archivo: File, proporcion: number): Promise<Blob> {
  const bitmap = await createImageBitmap(archivo);
  const { width: w, height: h } = bitmap;
  let cw = w;
  let ch = w / proporcion;
  if (ch > h) {
    ch = h;
    cw = h * proporcion;
  }
  const sx = (w - cw) / 2;
  const sy = (h - ch) / 2;
  const escala = Math.min(1, LADO_MAYOR / Math.max(cw, ch));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(cw * escala);
  canvas.height = Math.round(ch * escala);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Este navegador no puede procesar imágenes.");
  ctx.drawImage(bitmap, sx, sy, cw, ch, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  // Safari antiguo no genera WEBP y devuelve PNG: se acepta lo que salga.
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/webp", 0.85));
  if (blob && blob.type === "image/webp") return blob;
  const jpg = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.88));
  if (!jpg) throw new Error("No se pudo procesar la imagen.");
  return jpg;
}

export function EditorFoto({ url, texto, forma = "circulo", editable, subir, quitar }: Props) {
  const entrada = useRef<HTMLInputElement>(null);
  const [pendiente, iniciar] = useTransition();
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [vista, setVista] = useState<string | null>(null);
  const carnet = forma === "carnet";
  const mostrar = vista ?? url;

  function elegir(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;
    if (!archivo.type.startsWith("image/")) {
      setMensaje({ tipo: "error", texto: "Elige un archivo de imagen." });
      return;
    }
    setMensaje(null);
    iniciar(async () => {
      try {
        const blob = await prepararImagen(archivo, carnet ? 3 / 4 : 1);
        setVista(URL.createObjectURL(blob));
        const datos = new FormData();
        datos.append("foto", blob, blob.type === "image/webp" ? "foto.webp" : "foto.jpg");
        const r = await subir(datos);
        if (r?.error) {
          setVista(null);
          setMensaje({ tipo: "error", texto: r.error });
        } else {
          setMensaje({ tipo: "ok", texto: r?.ok ?? "Foto actualizada." });
        }
      } catch (err) {
        setVista(null);
        setMensaje({ tipo: "error", texto: err instanceof Error ? err.message : "No se pudo subir la foto." });
      }
    });
  }

  function borrar() {
    if (!quitar) return;
    iniciar(async () => {
      const r = await quitar();
      if (r?.error) setMensaje({ tipo: "error", texto: r.error });
      else {
        setVista(null);
        setMensaje({ tipo: "ok", texto: r?.ok ?? "Foto quitada." });
      }
    });
  }

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div
        className={clsx(
          "relative overflow-hidden ring-4 ring-white shadow-tarjeta",
          carnet ? "aspect-[3/4] w-36 rounded-2xl" : "size-28 rounded-full",
          !mostrar && tonoAvatar(texto),
        )}
      >
        {mostrar ? (
          <Image src={mostrar} alt={`Foto de ${texto}`} fill unoptimized className="object-cover" sizes="160px" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-3xl font-bold">{iniciales(texto)}</span>
        )}
        {pendiente && (
          <span className="absolute inset-0 flex items-center justify-center bg-marca-950/40 text-white">
            <Loader2 className="size-6 animate-spin" aria-label="Subiendo" />
          </span>
        )}
      </div>

      {editable && (
        <div className="flex flex-wrap justify-center gap-2">
          <input ref={entrada} type="file" accept="image/*" className="sr-only" onChange={elegir} aria-label="Elegir foto" />
          <button type="button" onClick={() => entrada.current?.click()} disabled={pendiente} className={claseBoton("secundario", "sm")}>
            <Camera className="size-3.5" aria-hidden />
            {mostrar ? "Cambiar foto" : "Subir foto"}
          </button>
          {mostrar && quitar && (
            <button type="button" onClick={borrar} disabled={pendiente} className={claseBoton("fantasma", "sm")}>
              <Trash2 className="size-3.5" aria-hidden />
              Quitar
            </button>
          )}
        </div>
      )}

      {mensaje && (
        <p className={clsx("text-xs font-medium", mensaje.tipo === "ok" ? "text-hoja-700" : "text-red-600")} role="status">
          {mensaje.texto}
        </p>
      )}
    </div>
  );
}
