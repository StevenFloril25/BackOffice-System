"use client";

import clsx from "clsx";
import { CheckCircle2, FileSpreadsheet, UploadCloud } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";

import { BotonEnviar } from "@/components/cliente";
import { Alerta, EncabezadoTarjeta, Tarjeta, claseBoton } from "@/components/ui";
import { importarExcel } from "../actions";

const QUE_SE_IMPORTA = [
  "Datos personales, talla y contactos de emergencia",
  "Estaca y barrio (los barrios nuevos se crean con su obispo)",
  "Estado de la inscripción y fecha",
  "Información médica (solo visible con el permiso de datos médicos)",
];

export function FormularioImportar() {
  const [estado, accion] = useActionState(importarExcel, undefined);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [ultimo, setUltimo] = useState(estado);
  // Al terminar una importación React vacía el <input>: se olvida también el
  // nombre mostrado para no invitar a reenviar un archivo que ya no está.
  if (estado !== ultimo) {
    setUltimo(estado);
    if (estado?.resumen) setArchivo(null);
  }
  const r = estado?.resumen;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {r && (
          <Tarjeta className="animar-entrada">
            <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
              <CheckCircle2 className="mt-0.5 size-5 text-hoja-600" aria-hidden />
              <div>
                <h2 className="font-semibold text-slate-900">Importación terminada</h2>
                <p className="text-sm text-slate-500">{r.filas} filas leídas del archivo.</p>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-4">
              <Cifra etiqueta="Nuevos" valor={r.nuevos} tono="text-hoja-700" />
              <Cifra etiqueta="Actualizados" valor={r.actualizados} tono="text-marca-700" />
              <Cifra etiqueta="Barrios nuevos" valor={r.barriosNuevos} tono="text-marca-700" />
              <Cifra etiqueta="Repetidos en el archivo" valor={r.duplicadosEnArchivo} tono="text-sol-600" />
            </dl>
            <div className="space-y-3 px-5 py-4 text-sm sm:px-6">
              {r.duplicadosEnArchivo > 0 && (
                <p className="text-slate-500">
                  Las personas repetidas (se inscribieron más de una vez) quedaron con su inscripción vigente; a igualdad, con la más
                  reciente.
                </p>
              )}
              {r.omitidas.length > 0 && (
                <Alerta tipo="aviso" titulo={`${r.omitidas.length} fila(s) sin importar`}>
                  <ul className="mt-1 list-disc pl-4">
                    {r.omitidas.slice(0, 10).map((o) => (
                      <li key={o.fila}>
                        Fila {o.fila}: {o.motivo}
                      </li>
                    ))}
                  </ul>
                </Alerta>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <Link href="/participantes" className={claseBoton("primario")}>
                  Ver participantes
                </Link>
                <Link href="/barrios" className={claseBoton("secundario")}>
                  Revisar barrios
                </Link>
              </div>
            </div>
          </Tarjeta>
        )}

        <Tarjeta>
          <EncabezadoTarjeta titulo={r ? "Importar otro archivo" : "Archivo de inscripción"} />
          <form action={accion} className="space-y-4 p-5 sm:p-6">
            {estado?.error && <Alerta tipo="error">{estado.error}</Alerta>}
            <label
              htmlFor="archivo"
              onDragOver={(e) => {
                e.preventDefault();
                setArrastrando(true);
              }}
              onDragLeave={() => setArrastrando(false)}
              onDrop={(e) => {
                e.preventDefault();
                setArrastrando(false);
                const f = e.dataTransfer.files?.[0];
                const input = document.getElementById("archivo") as HTMLInputElement | null;
                if (f && input) {
                  const dt = new DataTransfer();
                  dt.items.add(f);
                  input.files = dt.files;
                  setArchivo(f);
                }
              }}
              className={clsx(
                "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition",
                arrastrando ? "border-marca-500 bg-marca-50" : "border-slate-200 hover:border-marca-300 hover:bg-menta-50",
              )}
            >
              {archivo ? (
                <FileSpreadsheet className="size-9 text-hoja-600" aria-hidden />
              ) : (
                <UploadCloud className="size-9 text-marca-400" aria-hidden />
              )}
              <span className="text-sm">
                {archivo ? (
                  <>
                    <span className="font-semibold text-slate-900">{archivo.name}</span>
                    <span className="block text-slate-500">{(archivo.size / 1024).toFixed(0)} KB · haz clic para cambiarlo</span>
                  </>
                ) : (
                  <>
                    <span className="font-semibold text-marca-700">Elige el archivo</span>{" "}
                    <span className="text-slate-500">o arrástralo aquí</span>
                    <span className="block text-xs text-slate-400">Excel .xlsx, hasta 3,5 MB</span>
                  </>
                )}
              </span>
              <input
                id="archivo"
                name="archivo"
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                required
                className="sr-only"
                onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
              />
            </label>
            <div className="flex justify-end">
              <BotonEnviar disabled={!archivo} pendiente="Importando… puede tardar unos segundos">
                Importar
              </BotonEnviar>
            </div>
          </form>
        </Tarjeta>
      </div>

      <Tarjeta className="h-fit">
        <EncabezadoTarjeta titulo="Qué se importa" />
        <ul className="space-y-2.5 p-5 text-sm text-slate-600 sm:p-6">
          {QUE_SE_IMPORTA.map((t) => (
            <li key={t} className="flex gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-hoja-600" aria-hidden />
              {t}
            </li>
          ))}
        </ul>
        <div className="border-t border-slate-100 p-5 text-sm text-slate-500 sm:p-6">
          <p className="font-medium text-slate-700">No se importan</p>
          <p className="mt-1">Los adjuntos (autorización de imagen, permiso médico y foto). La foto se sube aquí, en la ficha de cada participante.</p>
          <p className="mt-3 font-medium text-slate-700">No se tocan</p>
          <p className="mt-1">Fotos, códigos QR ni asistencia de quienes ya estaban.</p>
        </div>
      </Tarjeta>
    </div>
  );
}

function Cifra({ etiqueta, valor, tono }: { etiqueta: string; valor: number; tono: string }) {
  return (
    <div className="bg-white px-5 py-4">
      <dt className="text-xs font-medium text-slate-500">{etiqueta}</dt>
      <dd className={`mt-1 text-2xl font-bold ${tono}`}>{valor}</dd>
    </div>
  );
}
