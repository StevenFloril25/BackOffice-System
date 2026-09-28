import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
import { BedDouble, CircleAlert, Printer, Wand2 } from "lucide-react";

import { AvisoBreve } from "@/components/cliente";
import { SinAcceso } from "@/components/sin-acceso";
import { Alerta, EncabezadoPagina, EnlaceBoton, EstadoVacio, Insignia, Tarjeta, claseBoton } from "@/components/ui";
import {
  jovenesSinCama,
  listarCompanias,
  listarEdificios,
  ocupacionPorHabitacion,
  resumenPorCompania,
  sexoPlural,
  type EdificioConHabitaciones,
  type HabitacionFila,
  type OcupacionHabitacion,
} from "@/lib/organizacion";
import { exigirSesion, puede } from "@/lib/sesion";
import { AccionesEdificio, AccionesHabitaciones } from "./dialogos";
import { Camas, ChipCompania } from "./grafico";

export const metadata: Metadata = { title: "Habitaciones" };

type Ocupacion = Record<string, OcupacionHabitacion>;

interface Piso {
  numero: number;
  jovenes: HabitacionFila[];
  lideres: HabitacionFila[];
  camasJovenes: number;
  ocupadosJovenes: number;
  camasLideres: number;
  ocupadosLideres: number;
  companias: Record<number, number>;
}

function pisosDe(e: EdificioConHabitaciones, ocupacion: Ocupacion): Piso[] {
  const porPiso = new Map<number, Piso>();
  for (const h of e.habitaciones) {
    const p = porPiso.get(h.piso) ?? {
      numero: h.piso,
      jovenes: [],
      lideres: [],
      camasJovenes: 0,
      ocupadosJovenes: 0,
      camasLideres: 0,
      ocupadosLideres: 0,
      companias: {},
    };
    const o = ocupacion[h.id];
    if (h.tipo === "jovenes") {
      p.jovenes.push(h);
      p.camasJovenes += h.capacidad;
      p.ocupadosJovenes += o?.ocupados ?? 0;
      for (const [n, c] of Object.entries(o?.porCompania ?? {})) p.companias[Number(n)] = (p.companias[Number(n)] ?? 0) + c;
    } else {
      p.lideres.push(h);
      p.camasLideres += h.capacidad;
      p.ocupadosLideres += o?.ocupados ?? 0;
    }
    porPiso.set(h.piso, p);
  }
  return [...porPiso.values()].sort((a, b) => b.numero - a.numero);
}

export default async function PaginaHabitaciones({ searchParams }: { searchParams: Promise<{ aviso?: string; n?: string }> }) {
  const sesion = await exigirSesion();
  if (!puede(sesion, "habitaciones.ver")) return <SinAcceso permiso="habitaciones.ver" />;

  const { aviso, n } = await searchParams;
  const [edificios, ocupacion, sinCama, companias, resumen] = await Promise.all([
    listarEdificios(),
    ocupacionPorHabitacion(),
    jovenesSinCama(),
    listarCompanias(),
    resumenPorCompania(),
  ]);

  const conPisos = edificios.map((e) => ({ edificio: e, pisos: pisosDe(e, ocupacion) }));
  const todosLosPisos = conPisos.flatMap((x) => x.pisos.map((p) => ({ ...p, sexo: x.edificio.sexo })));
  const camasDe = (sexo: string) => todosLosPisos.filter((p) => p.sexo === sexo).reduce((n, p) => n + p.camasJovenes - p.ocupadosJovenes, 0);
  const camasJovenes = todosLosPisos.reduce((n, p) => n + p.camasJovenes, 0);
  const ocupadasJovenes = todosLosPisos.reduce((n, p) => n + p.ocupadosJovenes, 0);
  const pisosSinLider = todosLosPisos.filter((p) => p.ocupadosJovenes > 0 && p.ocupadosLideres === 0).length;
  const lista = edificios.map(({ id, nombre, sexo, notas }) => ({ id, nombre, sexo, notas }));
  const verCompanias = puede(sesion, "companias.ver");

  return (
    <>
      <EncabezadoPagina
        titulo="Habitaciones"
        descripcion="Edificios de mujeres y de hombres, piso por piso. Cada cuadrito es una cama: con el color de la compañía de quien duerme ahí, o en blanco si está libre."
        acciones={
          <>
            <EnlaceBoton href="/distribucion" target="_blank" variante="secundario">
              <Printer className="size-4" aria-hidden />
              Imprimir distribución
            </EnlaceBoton>
            {puede(sesion, "habitaciones.editar") && edificios.length > 0 && (
              <EnlaceBoton href="/habitaciones/acomodar" variante="secundario">
                <Wand2 className="size-4" aria-hidden />
                Acomodar por compañías
              </EnlaceBoton>
            )}
            <AccionesHabitaciones puedeCrear={puede(sesion, "habitaciones.crear")} />
          </>
        }
      />

      {aviso === "acomodados" && (
        <AvisoBreve titulo="Acomodo aplicado" detalle={`${Number(n) || 0} personas con cama asignada.`} quitarDeUrl={["aviso", "n"]} />
      )}

      {aviso === "eliminada" && (
        <div className="mb-6">
          <Alerta tipo="exito">La habitación se eliminó.</Alerta>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Indicador etiqueta="Camas de jóvenes ocupadas" valor={`${ocupadasJovenes}/${camasJovenes}`} nota={`${camasJovenes - ocupadasJovenes} libres`} />
        <Indicador
          etiqueta="Mujeres sin cama"
          valor={sinCama.mujeres}
          nota={`${camasDe("Mujer")} camas libres para ellas`}
          tono={sinCama.mujeres > camasDe("Mujer") ? "rojo" : undefined}
        />
        <Indicador
          etiqueta="Hombres sin cama"
          valor={sinCama.hombres}
          nota={`${camasDe("Hombre")} camas libres para ellos`}
          tono={sinCama.hombres > camasDe("Hombre") ? "rojo" : undefined}
        />
        <Indicador etiqueta="Pisos con jóvenes y sin líder" valor={pisosSinLider} tono={pisosSinLider ? "sol" : undefined} />
      </div>

      {sinCama.sinSexo > 0 && (
        <div className="mb-6">
          <Alerta tipo="aviso">
            {sinCama.sinSexo === 1 ? "Hay 1 participante" : `Hay ${sinCama.sinSexo} participantes`} sin sexo indicado: no se les puede
            asignar cama hasta completarlo en su ficha.
          </Alerta>
        </div>
      )}

      {companias.length > 0 && (
        <Tarjeta className="mb-6 p-4 sm:p-5">
          <p className="mb-3 text-xs font-semibold tracking-wide text-slate-500 uppercase">Compañías · jóvenes con cama</p>
          <div className="flex flex-wrap gap-1.5">
            {companias.map((c) => {
              const r = resumen.porCompania[c.id];
              const chip = <ChipCompania numero={c.numero} texto={`${r?.conCama ?? 0}/${r?.total ?? 0}`} grande />;
              return verCompanias ? (
                <Link key={c.id} href={`/companias/${c.id}`} title={`Compañía ${c.numero}`}>
                  {chip}
                </Link>
              ) : (
                <span key={c.id}>{chip}</span>
              );
            })}
          </div>
        </Tarjeta>
      )}

      {edificios.length === 0 ? (
        <Tarjeta>
          <EstadoVacio
            icono={<BedDouble className="size-5" />}
            titulo="Todavía no hay edificios"
            descripcion="Crea los edificios de mujeres y de hombres; se arman con sus pisos y camas."
          />
        </Tarjeta>
      ) : (
        (["Mujer", "Hombre"] as const).map((sexo) => {
          const grupo = conPisos.filter((x) => x.edificio.sexo === sexo);
          if (grupo.length === 0) return null;
          return (
            <section key={sexo} className="mb-8">
              <h2 className="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase">Edificios de {sexoPlural(sexo)}</h2>
              <div className="grid gap-5 xl:grid-cols-2">
                {grupo.map(({ edificio: e, pisos }) => (
                  <TarjetaEdificio
                    key={e.id}
                    edificio={e}
                    pisos={pisos}
                    ocupacion={ocupacion}
                    edificios={lista}
                    puedeCrear={puede(sesion, "habitaciones.crear")}
                    puedeEditar={puede(sesion, "habitaciones.editar")}
                    puedeEliminar={puede(sesion, "habitaciones.eliminar")}
                  />
                ))}
              </div>
            </section>
          );
        })
      )}
    </>
  );
}

function TarjetaEdificio({
  edificio: e,
  pisos,
  ocupacion,
  edificios,
  puedeCrear,
  puedeEditar,
  puedeEliminar,
}: {
  edificio: EdificioConHabitaciones;
  pisos: Piso[];
  ocupacion: Ocupacion;
  edificios: { id: string; nombre: string; sexo: "Hombre" | "Mujer"; notas: string | null }[];
  puedeCrear: boolean;
  puedeEditar: boolean;
  puedeEliminar: boolean;
}) {
  const camas = pisos.reduce((n, p) => n + p.camasJovenes + p.camasLideres, 0);
  const ocupadas = pisos.reduce((n, p) => n + p.ocupadosJovenes + p.ocupadosLideres, 0);
  return (
    <Tarjeta>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold text-marca-950">{e.nombre}</h3>
            <Insignia tono={e.sexo === "Mujer" ? "hoja" : "marca"}>{e.sexo === "Mujer" ? "Mujeres" : "Hombres"}</Insignia>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {pisos.length} piso{pisos.length === 1 ? "" : "s"} · {ocupadas} de {camas} camas ocupadas{e.notas && ` · ${e.notas}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <a href={`/distribucion?edificio=${e.id}`} target="_blank" rel="noreferrer" className={claseBoton("fantasma", "sm")}>
            <Printer className="size-3.5" aria-hidden />
            Imprimir
          </a>
          <AccionesEdificio
            edificio={{ id: e.id, nombre: e.nombre, sexo: e.sexo, notas: e.notas }}
            edificios={edificios}
            pisos={pisos.map((p) => ({ piso: p.numero, camas: p.camasJovenes + p.camasLideres, ocupados: p.ocupadosJovenes + p.ocupadosLideres }))}
            puedeCrear={puedeCrear}
            puedeEditar={puedeEditar}
            puedeEliminar={puedeEliminar}
          />
        </div>
      </div>

      {pisos.length === 0 ? (
        <p className="px-6 py-8 text-center text-sm text-slate-500">Sin pisos todavía.{puedeCrear && " Agrégalos con «Piso»."}</p>
      ) : (
        <ol className="divide-y divide-slate-100">
          {pisos.map((p) => {
            const libres = p.camasJovenes - p.ocupadosJovenes;
            const sinLider = p.ocupadosJovenes > 0 && p.ocupadosLideres === 0;
            const numeros = Object.keys(p.companias).map(Number).sort((a, b) => (a || 999) - (b || 999));
            return (
              <li key={p.numero} className="flex gap-3 px-4 py-3.5 sm:gap-4 sm:px-5">
                <div className="w-10 shrink-0 pt-0.5 text-center">
                  <p className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">Piso</p>
                  <p className="text-xl leading-tight font-bold text-marca-950">{p.numero}</p>
                </div>

                <div className="min-w-0 flex-1 space-y-2">
                  {p.jovenes.map((h) => (
                    <Link key={h.id} href={`/habitaciones/${h.id}`} className="block rounded-lg p-1 -m-1 transition hover:bg-menta-50" title={`${h.nombre}: abrir`}>
                      {p.jovenes.length > 1 && <span className="mb-1 block text-[11px] font-medium text-slate-500">{h.nombre}</span>}
                      <Camas capacidad={h.capacidad} porCompania={ocupacion[h.id]?.porCompania} />
                    </Link>
                  ))}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {p.camasJovenes > 0 && (
                      <span className="mr-1 text-xs font-semibold text-slate-700">
                        {p.ocupadosJovenes}/{p.camasJovenes}
                      </span>
                    )}
                    {p.camasJovenes > 0 &&
                      (p.ocupadosJovenes === 0 ? (
                        <span className="text-xs text-slate-400">Vacío</span>
                      ) : libres === 0 ? (
                        <Insignia tono="hoja">Lleno</Insignia>
                      ) : (
                        <span className="text-xs font-semibold text-sol-600" title="Camas libres">
                          −{libres}
                        </span>
                      ))}
                    {numeros.map((n) => (
                      <ChipCompania key={n} numero={n} />
                    ))}
                    <a
                      href={`/distribucion?edificio=${e.id}&piso=${p.numero}`}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-auto rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-marca-700"
                      title={`Imprimir el piso ${p.numero}`}
                      aria-label={`Imprimir ${e.nombre}, piso ${p.numero}`}
                    >
                      <Printer className="size-3.5" aria-hidden />
                    </a>
                  </div>
                </div>

                <div className="w-14 shrink-0 space-y-1">
                  {p.lideres.map((h) => (
                    <Link
                      key={h.id}
                      href={`/habitaciones/${h.id}`}
                      className={clsx(
                        "block rounded-lg border p-1.5 transition hover:bg-menta-50",
                        sinLider ? "border-sol-400 bg-sol-100/60" : "border-transparent",
                      )}
                      title={`${h.nombre}: ${ocupacion[h.id]?.consejeros.join(", ") || "sin consejeros"}`}
                    >
                      <Camas capacidad={h.capacidad} lideres={ocupacion[h.id]?.ocupados ?? 0} tamano="sm" />
                      <span className="mt-1 block text-center text-[10px] font-medium text-slate-500">Líderes</span>
                    </Link>
                  ))}
                  {sinLider && (
                    <p className="flex items-center justify-center gap-0.5 text-[10px] font-semibold text-sol-600">
                      <CircleAlert className="size-3" aria-hidden /> Falta
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Tarjeta>
  );
}

function Indicador({ etiqueta, valor, nota, tono }: { etiqueta: string; valor: number | string; nota?: string; tono?: "sol" | "rojo" }) {
  return (
    <Tarjeta className="h-full px-4 py-3.5 sm:px-5 sm:py-4">
      <p className="text-xs font-medium text-slate-500">{etiqueta}</p>
      <p className={clsx("mt-1 text-2xl font-bold", tono === "sol" ? "text-sol-600" : tono === "rojo" ? "text-red-600" : "text-marca-950")}>{valor}</p>
      {nota && <p className="text-xs text-slate-400">{nota}</p>}
    </Tarjeta>
  );
}
