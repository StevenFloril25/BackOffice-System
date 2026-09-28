import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
import { Shirt } from "lucide-react";

import { SinAcceso } from "@/components/sin-acceso";
import { EncabezadoPagina, Tarjeta } from "@/components/ui";
import { diaDeHoy, fechaCorta, fechaLarga } from "@/lib/agenda";
import { cargarAgenda } from "@/lib/agenda-datos";
import { exigirSesion, puede } from "@/lib/sesion";
import { AccionesAgenda, AhoraEnLaSesion, EditarDia, ListaActividades } from "./cliente";

export const metadata: Metadata = { title: "Agenda" };

const VISTAS = [
  { clave: "todo", etiqueta: "Todo" },
  { clave: "jovenes", etiqueta: "Jóvenes" },
  { clave: "personal", etiqueta: "Personal" },
] as const;

export default async function PaginaAgenda({ searchParams }: { searchParams: Promise<{ dia?: string; ver?: string }> }) {
  const sesion = await exigirSesion();
  if (!puede(sesion, "agenda.ver")) return <SinAcceso permiso="agenda.ver" />;

  const sp = await searchParams;
  const { dias, actividades } = await cargarAgenda();
  const hoy = diaDeHoy(dias);
  const dia = dias.find((d) => String(d.dia) === sp.dia) ?? dias.find((d) => d.dia === hoy) ?? dias[0];
  const ver = VISTAS.find((v) => v.clave === sp.ver)?.clave ?? "todo";
  const editable = puede(sesion, "agenda.editar");
  const conFechas = dias.some((d) => d.fecha);

  const delDia = actividades.filter((a) => a.dia === dia?.dia);
  const visibles = delDia.filter((a) => (ver === "jovenes" ? !a.solo_personal : ver === "personal" ? a.solo_personal : true));
  const enlace = (d: number, v: string) => `/agenda?${new URLSearchParams(v === "todo" ? { dia: String(d) } : { dia: String(d), ver: v })}`;

  return (
    <>
      <EncabezadoPagina
        titulo="Agenda de la sesión"
        descripcion="El horario de la guía de FSY, día por día, con la ropa de cada día. Las reuniones del personal están marcadas."
        acciones={editable && <AccionesAgenda dias={dias.map((d) => d.dia)} diaElegido={dia?.dia ?? 0} inicio={dias.find((d) => d.dia === 0)?.fecha ?? null} />}
      />

      <AhoraEnLaSesion dias={dias} actividades={actividades} />

      {!conFechas && (
        <p className="mb-4 text-sm text-slate-500">
          {editable
            ? "Pon las fechas de la sesión (botón «Fechas») para ver en cada día qué toca ahora y qué sigue."
            : "Cuando se pongan las fechas de la sesión, aquí se verá qué toca ahora y qué sigue."}
        </p>
      )}

      <nav aria-label="Días" className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {dias.map((d) => {
          const activo = d.dia === dia?.dia;
          return (
            <Link
              key={d.dia}
              href={enlace(d.dia, ver)}
              replace
              scroll={false}
              aria-current={activo ? "page" : undefined}
              className={clsx(
                "relative shrink-0 rounded-xl border px-3.5 py-2 text-center transition",
                activo ? "border-marca-700 bg-marca-700 text-white shadow-sm" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
              )}
            >
              <span className="block text-sm font-semibold">Día {d.dia}</span>
              {d.fecha && <span className={clsx("block text-[11px]", activo ? "text-marca-100" : "text-slate-500")}>{fechaCorta(d.fecha)}</span>}
              {d.dia === hoy && (
                <span className="absolute -top-1.5 -right-1.5 rounded-full bg-sol-400 px-1.5 text-[10px] font-bold text-marca-950">Hoy</span>
              )}
            </Link>
          );
        })}
      </nav>

      {dia && (
        <Tarjeta>
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-marca-950">
                Día {dia.dia}
                {dia.fecha && <span className="font-medium text-slate-500"> · {fechaLarga(dia.fecha)}</span>}
              </h2>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="inline-flex items-center gap-1.5 font-medium text-marca-800">
                  <Shirt className="size-4 text-marca-500" aria-hidden />
                  {dia.vestimenta || <span className="font-normal text-slate-400">Ropa sin definir</span>}
                </span>
                {dia.notas && <span className="text-slate-500">{dia.notas}</span>}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div role="group" aria-label="Mostrar" className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-semibold">
                {VISTAS.map((v) => (
                  <Link
                    key={v.clave}
                    href={enlace(dia.dia, v.clave)}
                    replace
                    scroll={false}
                    aria-current={ver === v.clave ? "true" : undefined}
                    className={clsx("rounded-md px-2.5 py-1.5", ver === v.clave ? "bg-white text-marca-800 shadow-xs" : "text-slate-500 hover:text-slate-800")}
                  >
                    {v.etiqueta}
                  </Link>
                ))}
              </div>
              {editable && <EditarDia dia={dia} />}
            </div>
          </div>
          <ListaActividades
            actividades={visibles}
            fecha={dia.fecha}
            editable={editable}
            dias={dias.map((d) => d.dia)}
            vacio={delDia.length === 0 ? "Este día no tiene actividades todavía." : "Nada que mostrar con este filtro."}
          />
        </Tarjeta>
      )}
    </>
  );
}
