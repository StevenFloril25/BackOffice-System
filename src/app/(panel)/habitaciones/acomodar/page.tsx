import type { Metadata } from "next";
import clsx from "clsx";
import { BedDouble } from "lucide-react";

import { AplicarPropuesta } from "@/components/propuesta";
import { SinAcceso } from "@/components/sin-acceso";
import { Alerta, EncabezadoPagina, EstadoVacio, Insignia, OpcionEnlace, Tarjeta } from "@/components/ui";
import type { PisoPropuesto } from "@/lib/distribucion";
import { leerOpcionesCamas, propuestaCamas } from "@/lib/distribucion-datos";
import { nombreFuncion, sexoPlural } from "@/lib/organizacion-comun";
import { exigirSesion, puede } from "@/lib/sesion";
import { aplicarAcomodo } from "../actions";
import { Camas, ChipCompania } from "../grafico";

export const metadata: Metadata = { title: "Acomodo sugerido" };

type Parametros = { alcance?: string; modo?: string; pisos?: string };

export default async function AcomodoSugerido({ searchParams }: { searchParams: Promise<Parametros> }) {
  const sesion = await exigirSesion();
  if (!puede(sesion, "habitaciones.editar")) return <SinAcceso permiso="habitaciones.editar" />;

  const opciones = leerOpcionesCamas(await searchParams);
  const { alcance, modo, llenado } = opciones;
  const { propuesta, entran, sinCama, hayEdificios } = await propuestaCamas(opciones);
  const n = propuesta.acomodados;
  const cambios = propuesta.jovenes.length + propuesta.lideres.length;

  // Los parámetros tal como se leyeron: la acción vuelve a calcular con ellos.
  const actuales: Parametros = { alcance, modo, pisos: llenado };
  const enlace = (cambio: Parametros) => `/habitaciones/acomodar?${new URLSearchParams({ ...actuales, ...cambio } as Record<string, string>)}`;
  const porEdad = modo === "edad";

  return (
    <>
      <EncabezadoPagina
        migas={[{ etiqueta: "Habitaciones", href: "/habitaciones" }, { etiqueta: "Acomodo sugerido" }]}
        titulo="Acomodo sugerido en las habitaciones"
        descripcion={
          porEdad
            ? "Cada piso con jóvenes de edades cercanas (el piso 1, los más jóvenes), mezclando compañías y barrios. Cada consejero duerme en el piso donde está la mayoría de su compañía, y ningún piso con jóvenes queda sin líder. No se guarda nada hasta que lo apliques."
            : "Cada compañía junta en un piso, como la hoja de distribución: edificio por edificio y piso por piso. Consejeros y consejeras duermen en la habitación de líderes del piso de sus jóvenes. No se guarda nada hasta que lo apliques."
        }
      />

      <Tarjeta className="mb-6 divide-y divide-slate-100">
        <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-2">
          <fieldset>
            <legend className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Cómo acomodar</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <OpcionEnlace
                href={enlace({ modo: "edad" })}
                activa={porEdad}
                titulo="Por edad, mezclando compañías"
                detalle="Edades cercanas en cada piso; compañías y barrios mezclados."
              />
              <OpcionEnlace
                href={enlace({ modo: "companias" })}
                activa={!porEdad}
                titulo="Cada compañía junta"
                detalle="Toda la compañía en un mismo piso, como la hoja de distribución."
              />
            </div>
          </fieldset>
          {porEdad && (
            <fieldset>
              <legend className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Pisos</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                <OpcionEnlace
                  href={enlace({ pisos: "parejo" })}
                  activa={llenado === "parejo"}
                  titulo="Repartir parejo"
                  detalle="Los pisos justos, con la misma cantidad en cada uno y camas libres en todos."
                />
                <OpcionEnlace
                  href={enlace({ pisos: "llenar" })}
                  activa={llenado === "llenar"}
                  titulo="Llenar piso por piso"
                  detalle="Cada piso hasta el tope antes de pasar al siguiente."
                />
              </div>
            </fieldset>
          )}
        </div>
        <fieldset className="p-4 sm:p-5">
          <legend className="sr-only">A quiénes</legend>
          <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">A quiénes</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:max-w-3xl">
            <OpcionEnlace
              href={enlace({ alcance: "faltantes" })}
              activa={alcance === "faltantes"}
              titulo="Solo a quienes no tienen cama"
              detalle={`${sinCama} ${sinCama === 1 ? "joven" : "jóvenes"} sin cama${porEdad ? "" : " (con compañía)"}. Nadie se muda.`}
            />
            <OpcionEnlace
              href={enlace({ alcance: "rehacer" })}
              activa={alcance === "rehacer"}
              titulo="Rehacer todo"
              detalle={`Se acomoda de nuevo a los ${entran} jóvenes${porEdad ? "" : " con compañía"} y a sus líderes.`}
            />
          </div>
        </fieldset>
      </Tarjeta>

      {!hayEdificios ? (
        <Tarjeta>
          <EstadoVacio icono={<BedDouble className="size-5" />} titulo="Todavía no hay edificios" descripcion="Créalos en Habitaciones y vuelve aquí." />
        </Tarjeta>
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-marca-100 bg-marca-50/60 px-4 py-3.5 sm:px-5">
            <p className="min-w-0 text-sm font-semibold text-marca-950">
              {n === 0
                ? alcance === "faltantes"
                  ? "No hay a quién acomodar: todos ya tienen cama."
                  : "El acomodo sugerido es igual al actual."
                : `${n} ${n === 1 ? "persona recibe" : "personas reciben"} cama${alcance === "rehacer" ? " nueva" : ""}.`}
            </p>
            <AplicarPropuesta
              aplicar={aplicarAcomodo.bind(null, actuales, propuesta.huella)}
              etiqueta="Aplicar acomodo"
              titulo="¿Aplicar este acomodo?"
              deshabilitado={alcance === "faltantes" ? n === 0 : cambios === 0}
              descripcion={
                alcance === "rehacer"
                  ? `Se vuelven a repartir las camas de ${porEdad ? "todos los jóvenes" : "todos los jóvenes con compañía"} y de sus líderes, como se ve aquí.${porEdad ? "" : " Quienes no tienen compañía se quedan en su cama."}`
                  : `${n} ${n === 1 ? "persona recibe" : "personas reciben"} cama. Nadie que ya tenga cama se muda.`
              }
            />
          </div>

          {propuesta.avisos.length > 0 && (
            <div className="mb-6">
              <Alerta tipo="aviso" titulo="Para revisar">
                <ul className="list-disc space-y-0.5 pl-4">
                  {propuesta.avisos.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </Alerta>
            </div>
          )}

          {(["Mujer", "Hombre"] as const).map((sexo) => {
            const pisos = propuesta.pisos.filter((p) => p.edificio.sexo === sexo);
            if (pisos.length === 0) return null;
            const edificios = [...new Map(pisos.map((p) => [p.edificio.id, p.edificio])).values()];
            return (
              <section key={sexo} className="mb-8">
                <h2 className="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase">Edificios de {sexoPlural(sexo)}</h2>
                <div className="grid gap-5 xl:grid-cols-2">
                  {edificios.map((e) => (
                    <Edificio key={e.id} nombre={e.nombre} sexo={e.sexo} pisos={pisos.filter((p) => p.edificio.id === e.id)} />
                  ))}
                </div>
              </section>
            );
          })}
        </>
      )}
    </>
  );
}

function Edificio({ nombre, sexo, pisos }: { nombre: string; sexo: "Mujer" | "Hombre"; pisos: PisoPropuesto[] }) {
  const ocupadas = pisos.reduce((s, p) => s + p.ocupadas, 0);
  const camas = pisos.reduce((s, p) => s + p.camas, 0);
  return (
    <Tarjeta>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-bold text-marca-950">{nombre}</h3>
          <Insignia tono={sexo === "Mujer" ? "hoja" : "marca"}>{sexo === "Mujer" ? "Mujeres" : "Hombres"}</Insignia>
        </div>
        <p className="text-xs text-slate-500">
          {ocupadas} de {camas} camas de jóvenes
        </p>
      </div>
      <ol className="divide-y divide-slate-100">
        {[...pisos]
          .sort((a, b) => b.piso - a.piso)
          .map((p) => {
            const numeros = Object.keys(p.porCompania)
              .map(Number)
              .sort((a, b) => (a || 999) - (b || 999));
            const companias = numeros.filter((c) => c !== 0).length;
            return (
              <li key={p.piso} className="flex gap-3 px-4 py-3.5 sm:gap-4 sm:px-5">
                <div className="w-10 shrink-0 pt-0.5 text-center">
                  <p className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">Piso</p>
                  <p className="text-xl leading-tight font-bold text-marca-950">{p.piso}</p>
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  {p.camas > 0 && <Camas capacidad={p.camas} porCompania={p.porCompania} />}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span className="font-semibold text-slate-700">
                      {p.ocupadas}/{p.camas}
                    </span>
                    {p.ocupadas === 0 ? (
                      <span className="text-slate-400">Vacío</span>
                    ) : (
                      <>
                        {p.edades && (
                          <span className="font-semibold text-marca-800">
                            {p.edades[0] === p.edades[1] ? `${p.edades[0]} años` : `${p.edades[0]}–${p.edades[1]} años`}
                          </span>
                        )}
                        <span className="text-slate-500">
                          {companias > 0 && `${companias} ${companias === 1 ? "compañía" : "compañías"} · `}
                          {p.barrios} {p.barrios === 1 ? "barrio" : "barrios"}
                        </span>
                        {p.nuevos > 0 && p.nuevos < p.ocupadas && <span className="text-slate-500">{p.nuevos} nuevos</span>}
                      </>
                    )}
                  </div>
                  {numeros.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {numeros.map((c) => (
                        <ChipCompania key={c} numero={c} texto={String(p.porCompania[c])} />
                      ))}
                    </div>
                  )}
                  {p.camasLideres > 0 && (
                    <div className={clsx("rounded-lg px-2.5 py-1.5 text-xs", p.lideres.length ? "bg-menta-50" : p.ocupadas ? "bg-sol-100/60" : "bg-slate-50")}>
                      <span className="font-semibold text-slate-700">
                        Líderes {p.lideres.length}/{p.camasLideres}
                      </span>
                      {p.lideres.length === 0 ? (
                        <span className="text-slate-500">{p.ocupadas ? " · falta un líder en este piso" : ""}</span>
                      ) : (
                        <span className="text-slate-600">
                          {" · "}
                          {p.lideres
                            .map((l) => `${l.nombre} (${nombreFuncion(l.funcion, l.sexo).toLowerCase()}${l.compania ? `, C${l.compania}` : ""})`)
                            .join(" · ")}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
      </ol>
    </Tarjeta>
  );
}
