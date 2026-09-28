import type { Metadata } from "next";
import { Flag } from "lucide-react";

import { AplicarPropuesta } from "@/components/propuesta";
import { SinAcceso } from "@/components/sin-acceso";
import { Alerta, EncabezadoPagina, EnlaceBoton, EstadoVacio, Insignia, OpcionEnlace, Tarjeta } from "@/components/ui";
import type { CompaniaPropuesta } from "@/lib/distribucion";
import { leerAlcance, leerModo, propuestaCompanias } from "@/lib/distribucion-datos";
import { colorCompania } from "@/lib/organizacion-comun";
import { exigirSesion, puede } from "@/lib/sesion";
import { aplicarReparto } from "../actions";

export const metadata: Metadata = { title: "Reparto sugerido" };

export default async function RepartoSugerido({
  searchParams,
}: {
  searchParams: Promise<{ edades?: string; alcance?: string }>;
}) {
  const sesion = await exigirSesion();
  if (!puede(sesion, "companias.editar")) return <SinAcceso permiso="companias.editar" />;

  const sp = await searchParams;
  const modo = leerModo(sp.edades);
  const alcance = leerAlcance(sp.alcance);
  const { propuesta, total, sinCompania, hayCompanias } = await propuestaCompanias(modo, alcance);
  const enlace = (cambio: Record<string, string>) => `/companias/distribuir?${new URLSearchParams({ edades: modo, alcance, ...cambio })}`;
  const n = propuesta.asignaciones.length;
  const k = propuesta.companias.length;
  const tamanos = propuesta.companias.map((c) => c.miembros.length);

  return (
    <>
      <EncabezadoPagina
        migas={[{ etiqueta: "Compañías", href: "/companias" }, { etiqueta: "Reparto sugerido" }]}
        titulo="Reparto sugerido de jóvenes"
        descripcion="Una propuesta para repartir a los jóvenes en las compañías: mujeres y hombres parejos en cada una y los barrios mezclados. No se guarda nada hasta que la apliques; después puedes mover a quien quieras a mano."
      />

      <Tarjeta className="mb-6 p-4 sm:p-5">
        <div className="grid gap-5 lg:grid-cols-2">
          <fieldset>
            <legend className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Edades</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <OpcionEnlace
                href={enlace({ edades: "agrupar" })}
                activa={modo === "agrupar"}
                titulo="Agrupar edades parecidas"
                detalle="Cada compañía con jóvenes de edades cercanas. La 1, los más jóvenes."
              />
              <OpcionEnlace
                href={enlace({ edades: "mezclar" })}
                activa={modo === "mezclar"}
                titulo="Mezclar edades"
                detalle="Cada compañía con jóvenes de todas las edades."
              />
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">A quiénes</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <OpcionEnlace
                href={enlace({ alcance: "faltantes" })}
                activa={alcance === "faltantes"}
                titulo="Solo a quienes no tienen compañía"
                detalle={`${sinCompania} de ${total}. Los demás se quedan donde están.`}
              />
              <OpcionEnlace
                href={enlace({ alcance: "rehacer" })}
                activa={alcance === "rehacer"}
                titulo="Rehacer todas las compañías"
                detalle={`Se reparte de nuevo a los ${total} jóvenes.`}
              />
            </div>
          </fieldset>
        </div>
      </Tarjeta>

      {!hayCompanias ? (
        <Tarjeta>
          <EstadoVacio
            icono={<Flag className="size-5" />}
            titulo="Primero crea las compañías"
            descripcion="El reparto usa las compañías que ya existen. Créalas (con «Crear varias» van de golpe) y vuelve aquí."
            accion={<EnlaceBoton href="/companias">Ir a Compañías</EnlaceBoton>}
          />
        </Tarjeta>
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-marca-100 bg-marca-50/60 px-4 py-3.5 sm:px-5">
            <div className="min-w-0 text-sm text-marca-950">
              <p className="font-semibold">
                {n === 0
                  ? "No hay jóvenes para repartir."
                  : `${n} ${n === 1 ? "joven" : "jóvenes"} en ${k} ${k === 1 ? "compañía" : "compañías"}`}
              </p>
              {n > 0 && (
                <p className="text-marca-800/80">
                  Quedan de {Math.min(...tamanos)} a {Math.max(...tamanos)} jóvenes por compañía.
                  {alcance === "rehacer" && ` ${propuesta.cambian} cambian de compañía.`}
                </p>
              )}
            </div>
            <AplicarPropuesta
              aplicar={aplicarReparto.bind(null, modo, alcance, propuesta.huella)}
              etiqueta="Aplicar reparto"
              titulo="¿Aplicar este reparto?"
              deshabilitado={n === 0}
              descripcion={
                alcance === "rehacer"
                  ? `Se rehacen las ${k} compañías: ${propuesta.cambian} ${propuesta.cambian === 1 ? "joven cambia" : "jóvenes cambian"} de compañía. Las camas no se tocan: después revisa Habitaciones.`
                  : `Se asignan ${n} ${n === 1 ? "joven" : "jóvenes"} a sus compañías. Quienes ya tenían compañía no se mueven.`
              }
            />
          </div>

          {propuesta.sinSexo > 0 && (
            <div className="mb-6">
              <Alerta tipo="aviso">
                {propuesta.sinSexo === 1 ? "1 joven no tiene" : `${propuesta.sinSexo} jóvenes no tienen`} el sexo indicado y queda
                {propuesta.sinSexo === 1 ? "" : "n"} fuera del reparto. Complétalo en su ficha.
              </Alerta>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {propuesta.companias.map((c) => (
              <TarjetaCompania key={c.compania.id} c={c} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function TarjetaCompania({ c }: { c: CompaniaPropuesta }) {
  const total = c.miembros.length;
  return (
    <Tarjeta className="flex flex-col">
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-2xl text-lg font-bold text-white"
          style={{ background: colorCompania(c.compania.numero) }}
        >
          {c.compania.numero}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-900">Compañía {c.compania.numero}</p>
          <p className="truncate text-sm text-slate-500">{c.compania.nombre || "Sin nombre"}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl leading-none font-bold text-marca-950">{total}</p>
          <p className="text-[11px] text-slate-500">{total === 1 ? "joven" : "jóvenes"}</p>
        </div>
      </div>
      <dl className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100 text-center">
        <Dato etiqueta="Mujeres · hombres">
          {c.mujeres} · {c.hombres}
        </Dato>
        <Dato etiqueta="Edades">
          {c.edadMin === null ? "—" : c.edadMin === c.edadMax ? `${c.edadMin}` : `${c.edadMin}–${c.edadMax}`}
        </Dato>
        <Dato etiqueta="Barrios">
          <span title={`Máximo ${c.maxMismoBarrio} del mismo barrio`}>
            {c.barrios}
            <span className="text-xs font-medium text-slate-400"> · máx {c.maxMismoBarrio}</span>
          </span>
        </Dato>
      </dl>
      <details className="group px-5 py-3">
        <summary className="cursor-pointer text-sm font-medium text-marca-700 select-none hover:text-marca-900">
          Ver jóvenes{c.nuevos > 0 && c.nuevos < total && <span className="font-normal text-slate-500"> · {c.nuevos} nuevos</span>}
        </summary>
        <ul className="mt-2 divide-y divide-slate-100 text-sm">
          {c.miembros.map((m) => (
            <li key={m.id} className="flex items-center gap-2 py-1.5">
              <span
                aria-hidden
                className={`size-2 shrink-0 rounded-full ${m.sexo === "Mujer" ? "bg-hoja-500" : m.sexo === "Hombre" ? "bg-marca-500" : "bg-slate-300"}`}
              />
              <span className="min-w-0 flex-1 truncate text-slate-800">{m.nombre}</span>
              <span className="shrink-0 text-xs text-slate-500">
                {m.edad ?? "—"} · {m.barrio ?? "sin barrio"}
              </span>
              {m.nuevo && c.nuevos < total && <Insignia tono="sol">Nuevo</Insignia>}
            </li>
          ))}
        </ul>
      </details>
    </Tarjeta>
  );
}

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="px-2 py-3">
      <dt className="text-[11px] text-slate-500">{etiqueta}</dt>
      <dd className="mt-0.5 font-semibold text-slate-800">{children}</dd>
    </div>
  );
}
