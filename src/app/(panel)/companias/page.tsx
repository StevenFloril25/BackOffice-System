import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Flag } from "lucide-react";

import { SinAcceso } from "@/components/sin-acceso";
import { Alerta, Avatar, EncabezadoPagina, EstadoVacio, Insignia, Tarjeta } from "@/components/ui";
import { urlsFotos } from "@/lib/fotos";
import { listarCompanias, resumenPorCompania, type ConsejeroResumen } from "@/lib/organizacion";
import { nombreCompleto } from "@/lib/participantes-comun";
import { exigirSesion, puede } from "@/lib/sesion";
import { AccionesCompanias } from "./dialogos";

export const metadata: Metadata = { title: "Compañías" };

export default async function PaginaCompanias({ searchParams }: { searchParams: Promise<{ aviso?: string }> }) {
  const sesion = await exigirSesion();
  if (!puede(sesion, "companias.ver")) return <SinAcceso permiso="companias.ver" />;

  const { aviso } = await searchParams;
  const [companias, resumen] = await Promise.all([listarCompanias(), resumenPorCompania()]);
  const fotos = await urlsFotos(companias.flatMap((c) => [c.consejero?.foto_path, c.consejera?.foto_path]));
  const siguiente = Math.max(0, ...companias.map((c) => c.numero)) + 1;
  const completas = companias.filter((c) => c.consejero && c.consejera).length;
  const asignados = resumen.total - resumen.sinCompania;

  return (
    <>
      <EncabezadoPagina
        titulo="Compañías"
        descripcion="Cada compañía tiene un consejero y una consejera y un grupo de jóvenes. Los jóvenes se reparten después, por edades."
        acciones={puede(sesion, "companias.crear") && <AccionesCompanias siguiente={siguiente} />}
      />

      {aviso === "eliminada" && (
        <div className="mb-6">
          <Alerta tipo="exito">La compañía se eliminó.</Alerta>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Indicador etiqueta="Compañías" valor={companias.length} />
        <Indicador etiqueta="Con pareja completa" valor={completas} nota={`de ${companias.length}`} />
        <Indicador etiqueta="Jóvenes asignados" valor={asignados} nota={`de ${resumen.total}`} />
        <Indicador etiqueta="Sin compañía" valor={resumen.sinCompania} tono={resumen.sinCompania ? "sol" : undefined} />
      </div>

      {companias.length === 0 ? (
        <Tarjeta>
          <EstadoVacio
            icono={<Flag className="size-5" />}
            titulo="Todavía no hay compañías"
            descripcion={
              puede(sesion, "companias.crear")
                ? "Crea las compañías (una por una o varias de golpe) y después asígnales su consejero, su consejera y sus jóvenes."
                : "Cuando se creen, aparecen aquí."
            }
          />
        </Tarjeta>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {companias.map((c) => {
            const r = resumen.porCompania[c.id];
            return (
              <Link key={c.id} href={`/companias/${c.id}`} className="group">
                <Tarjeta className="flex h-full flex-col transition group-hover:border-marca-200">
                  <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-marca-700 text-lg font-bold text-white">
                      {c.numero}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-slate-900 group-hover:text-marca-700">Compañía {c.numero}</p>
                      <p className="truncate text-sm text-slate-500">{c.nombre || "Sin nombre"}</p>
                    </div>
                    <ChevronRight className="size-4 text-slate-300 group-hover:text-marca-500" aria-hidden />
                  </div>
                  <div className="space-y-2.5 px-5 py-4">
                    <Lugar etiqueta="Consejero" persona={c.consejero} fotos={fotos} />
                    <Lugar etiqueta="Consejera" persona={c.consejera} fotos={fotos} />
                  </div>
                  <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">
                      {r?.total ?? 0} {r?.total === 1 ? "joven" : "jóvenes"}
                    </span>
                    {r && (
                      <>
                        <span>
                          {r.mujeres} M · {r.hombres} H
                        </span>
                        {r.edadMin !== null && <span>{r.edadMin === r.edadMax ? `${r.edadMin} años` : `${r.edadMin}–${r.edadMax} años`}</span>}
                      </>
                    )}
                  </div>
                </Tarjeta>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

function Lugar({ etiqueta, persona, fotos }: { etiqueta: string; persona: ConsejeroResumen | null; fotos: Record<string, string> }) {
  if (!persona) {
    return (
      <div className="flex items-center gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-dashed border-slate-300 text-xs text-slate-400">
          ?
        </span>
        <Insignia tono="sol">Falta {etiqueta.toLowerCase()}</Insignia>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3">
      <Avatar texto={nombreCompleto(persona)} src={persona.foto_path ? fotos[persona.foto_path] : null} tamano="sm" />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-800">{nombreCompleto(persona)}</p>
        <p className="text-xs text-slate-500">{etiqueta}</p>
      </div>
    </div>
  );
}

function Indicador({ etiqueta, valor, nota, tono }: { etiqueta: string; valor: number; nota?: string; tono?: "sol" }) {
  return (
    <Tarjeta className="h-full px-4 py-3.5 sm:px-5 sm:py-4">
      <p className="text-xs font-medium text-slate-500">{etiqueta}</p>
      <p className={`mt-1 text-2xl font-bold ${tono === "sol" ? "text-sol-600" : "text-marca-950"}`}>{valor}</p>
      {nota && <p className="text-xs text-slate-400">{nota}</p>}
    </Tarjeta>
  );
}
