"use client";

import { Check, Copy, ImagePlus, Loader2, Printer, Trash2 } from "lucide-react";
import { startTransition, useActionState, useRef, useState, useTransition, type FormEvent } from "react";

import { AvisoBreve, BotonEnviar, Dialogo, ResultadoEnvio, Seleccion } from "@/components/cliente";
import { Alerta, Boton, Campo } from "@/components/ui";
import {
  agregarTestimonio,
  eliminarFotoInforme,
  eliminarTestimonio,
  guardarConteos,
  subirFotoInforme,
  type EstadoInforme,
} from "./actions";

/** "Copiar resumen" (texto para el correo) e "Imprimir". */
export function BotonesInforme({ resumen }: { resumen: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <>
      <Boton
        variante="secundario"
        onClick={async () => {
          await navigator.clipboard.writeText(resumen);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 2000);
        }}
      >
        {copiado ? <Check className="size-4 text-hoja-600" aria-hidden /> : <Copy className="size-4" aria-hidden />}
        {copiado ? "Copiado" : "Copiar resumen"}
      </Boton>
      <Boton onClick={() => window.print()}>
        <Printer className="size-4" aria-hidden />
        Imprimir
      </Boton>
    </>
  );
}

/** Lo que se anota a mano: sesiones, coordinadores y otros puestos. */
export function FormularioConteos({ valores }: { valores: { sesiones: number; coordinadores: number; otros_jovenes_adultos: number } }) {
  const [estado, accion] = useActionState<EstadoInforme | undefined, FormData>(guardarConteos, undefined);
  const val = estado?.valores ?? {
    sesiones: String(valores.sesiones),
    coordinadores: String(valores.coordinadores),
    otros_jovenes_adultos: String(valores.otros_jovenes_adultos),
  };
  const err = estado?.errores ?? {};
  return (
    <form action={accion} noValidate className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo etiqueta="Sesiones realizadas" htmlFor="sesiones" error={err.sesiones}>
          <input id="sesiones" name="sesiones" type="number" inputMode="numeric" min={0} defaultValue={val.sesiones} className="entrada" />
        </Campo>
        <Campo etiqueta="Coordinadores" htmlFor="coordinadores" error={err.coordinadores} ayuda="Jóvenes adultos, no los auxiliares.">
          <input id="coordinadores" name="coordinadores" type="number" inputMode="numeric" min={0} defaultValue={val.coordinadores} className="entrada" />
        </Campo>
        <Campo etiqueta="Otros puestos" htmlFor="otros_jovenes_adultos" error={err.otros_jovenes_adultos} ayuda="Otros jóvenes adultos solteros.">
          <input
            id="otros_jovenes_adultos"
            name="otros_jovenes_adultos"
            type="number"
            inputMode="numeric"
            min={0}
            defaultValue={val.otros_jovenes_adultos}
            className="entrada"
          />
        </Campo>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3">
        <ResultadoEnvio estado={estado} />
        <BotonEnviar pendiente="Guardando…" variante="secundario">
          Guardar
        </BotonEnviar>
      </div>
    </form>
  );
}

/** Estado de un formulario que cuenta los envíos exitosos: con eso se vuelve a montar limpio y avisa. */
type ConVez = EstadoInforme & { vez: number };

function contandoExitos(accion: (previo: EstadoInforme | undefined, datos: FormData) => Promise<EstadoInforme>) {
  return async (previo: ConVez | undefined, datos: FormData): Promise<ConVez> => {
    const r = await accion(previo, datos);
    return { ...r, vez: (previo?.vez ?? 0) + (r.ok ? 1 : 0) };
  };
}

const agregarTestimonioContando = contandoExitos(agregarTestimonio);
const subirFotoContando = contandoExitos(subirFotoInforme);

export function NuevoTestimonio() {
  const [estado, accion] = useActionState<ConVez | undefined, FormData>(agregarTestimonioContando, undefined);
  const vez = estado?.vez ?? 0;
  const val = estado?.ok ? { autor: "", tipo: "joven", texto: "" } : (estado?.valores ?? { autor: "", tipo: "joven", texto: "" });
  const err = estado?.ok ? {} : (estado?.errores ?? {});
  return (
    <form key={vez} action={accion} noValidate className="space-y-3">
      {estado?.error && <Alerta tipo="error">{estado.error}</Alerta>}
      <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
        <Campo etiqueta="De quién" htmlFor="autor" error={err.autor} ayuda="Opcional: nombre, o solo «Joven de 15 años».">
          <input id="autor" name="autor" defaultValue={val.autor} className="entrada" autoComplete="off" />
        </Campo>
        <Campo etiqueta="Es" htmlFor="tipo" error={err.tipo}>
          <Seleccion id="tipo" name="tipo" defaultValue={val.tipo} className="entrada">
            <option value="joven">Joven</option>
            <option value="joven_adulto">Joven adulto soltero</option>
          </Seleccion>
        </Campo>
      </div>
      <Campo etiqueta="Testimonio" htmlFor="texto" error={err.texto}>
        <textarea id="texto" name="texto" rows={4} defaultValue={val.texto} className="entrada resize-y" />
      </Campo>
      <div className="flex justify-end">
        <BotonEnviar pendiente="Guardando…">Agregar testimonio</BotonEnviar>
      </div>
      {estado?.ok && <AvisoBreve key={vez} titulo="Testimonio agregado" />}
    </form>
  );
}

const LADO_MAYOR = 1600;

/**
 * Reduce la foto a 1600 px por lado (JPEG) antes de subirla: una foto de
 * celular pesa varios MB y el servidor acepta hasta 2. Así queda en unos
 * cientos de KB, con calidad de sobra para un informe.
 */
async function reducirFoto(archivo: File): Promise<Blob> {
  const bitmap = await createImageBitmap(archivo);
  const escala = Math.min(1, LADO_MAYOR / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Este navegador no puede procesar imágenes.");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.86));
  if (!blob) throw new Error("No se pudo procesar la imagen.");
  return blob;
}

export function SubirFoto() {
  const [estado, accion, enviando] = useActionState<ConVez | undefined, FormData>(subirFotoContando, undefined);
  const [preparando, setPreparando] = useState(false);
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null);
  const archivo = useRef<HTMLInputElement>(null);
  const vez = estado?.vez ?? 0;
  const val = estado?.valores ?? { fotografo_nombre: "", fotografo_correo: "", descripcion: "" };
  const err = estado?.errores ?? {};

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const elegido = archivo.current?.files?.[0];
    setErrorArchivo(null);
    if (!elegido) return setErrorArchivo("Elige una foto.");
    if (!elegido.type.startsWith("image/")) return setErrorArchivo("Elige un archivo de imagen.");
    setPreparando(true);
    try {
      const datos = new FormData(form);
      datos.set("foto", await reducirFoto(elegido), "foto.jpg");
      startTransition(() => accion(datos));
    } catch (error) {
      setErrorArchivo(error instanceof Error ? error.message : "No se pudo procesar la foto.");
    } finally {
      setPreparando(false);
    }
  }

  const ocupado = preparando || enviando;
  return (
    <>
      {/* El envío es a mano (hay que reducir la foto antes), así que React no
          limpia el formulario: tras subir, se vuelve a montar con el mismo fotógrafo. */}
      <form key={`formulario-${vez}`} onSubmit={enviar} noValidate className="space-y-3">
        {estado?.error && <Alerta tipo="error">{estado.error}</Alerta>}
        <Campo etiqueta="Foto" htmlFor="foto" error={errorArchivo ?? err.foto}>
          <input ref={archivo} id="foto" name="foto" type="file" accept="image/*" className="entrada py-1.5 file:mr-3 file:rounded-lg file:border-0 file:bg-marca-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-marca-700" />
        </Campo>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Fotógrafo" htmlFor="fotografo_nombre" error={err.fotografo_nombre} ayuda="La guía pide su nombre y su correo con cada foto.">
            <input id="fotografo_nombre" name="fotografo_nombre" defaultValue={val.fotografo_nombre} className="entrada" autoComplete="off" />
          </Campo>
          <Campo etiqueta="Correo del fotógrafo" htmlFor="fotografo_correo" error={err.fotografo_correo}>
            <input
              id="fotografo_correo"
              name="fotografo_correo"
              type="email"
              inputMode="email"
              defaultValue={val.fotografo_correo}
              className="entrada"
              autoComplete="off"
            />
          </Campo>
        </div>
        <Campo etiqueta="Descripción" htmlFor="descripcion" error={err.descripcion}>
          <input id="descripcion" name="descripcion" defaultValue={val.descripcion} placeholder="Opcional" className="entrada" autoComplete="off" />
        </Campo>
        <div className="flex justify-end">
          <Boton type="submit" disabled={ocupado} aria-busy={ocupado}>
            {ocupado ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ImagePlus className="size-4" aria-hidden />}
            {preparando ? "Preparando…" : enviando ? "Subiendo…" : "Agregar foto"}
          </Boton>
        </div>
      </form>
      {estado?.ok && <AvisoBreve key={`aviso-${vez}`} titulo="Foto agregada" />}
    </>
  );
}

/** Botón de papelera con confirmación, para testimonios y fotos. */
export function Quitar({ tipo, id, etiqueta }: { tipo: "testimonio" | "foto"; id: string; etiqueta: string }) {
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setAbierto(true);
        }}
        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 print:hidden"
        aria-label={etiqueta}
      >
        <Trash2 className="size-4" />
      </button>
      <Dialogo abierto={abierto} alCerrar={() => setAbierto(false)} titulo={tipo === "foto" ? "¿Quitar la foto?" : "¿Quitar el testimonio?"}>
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Se quita del informe y no se puede recuperar.</p>
          {error && <Alerta tipo="error">{error}</Alerta>}
          <div className="flex justify-end gap-2">
            <Boton type="button" variante="secundario" onClick={() => setAbierto(false)} disabled={pendiente}>
              Cancelar
            </Boton>
            <Boton
              type="button"
              variante="peligro"
              disabled={pendiente}
              onClick={() =>
                iniciar(async () => {
                  const r = await (tipo === "foto" ? eliminarFotoInforme(id) : eliminarTestimonio(id));
                  if (r.error) setError(r.error);
                  else setAbierto(false);
                })
              }
            >
              {pendiente ? "Quitando…" : "Quitar"}
            </Boton>
          </div>
        </div>
      </Dialogo>
    </>
  );
}
