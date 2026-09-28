import type { Metadata } from "next";
import Form from "next/form";
import Link from "@/components/enlace";
import clsx from "clsx";
import { Flag } from "lucide-react";

import { CargaEnlace } from "@/components/carga-enlace";
import { AplicarPropuesta } from "@/components/propuesta";
import { SinAcceso } from "@/components/sin-acceso";
import { Alerta, Boton, EncabezadoPagina, EnlaceBoton, EstadoVacio, Insignia, OpcionEnlace, Tarjeta } from "@/components/ui";
import type { Alternativa, CompaniaPropuesta } from "@/lib/distribucion";
import { leerEleccion, propuestaCompanias } from "@/lib/distribucion-datos";
import { colorCompania } from "@/lib/organizacion-comun";
import { exigirSesion, puede } from "@/lib/sesion";
import { aplicarReparto } from "../actions";

export const metadata: Metadata = { title: "Reparto sugerido" };

const TAMANOS = [12, 16, 20, 24];

type Parametros = { edades?: string; alcance?: string; tamano?: string; companias?: string };

/** "2 a 10", o "2, 4 y 6 a 9" si hay huecos. */
function numeros(lista: number[]): string {
  const tramos: string[] = [];
  for (let i = 0; i < lista.length; ) {
    let j = i;
    while (j + 1 < lista.length && lista[j + 1] === lista[j] + 1) j++;
    tramos.push(j === i ? `${lista[i]}` : `${lista[i]} a ${lista[j]}`);
    i = j + 1;
  }
  return tramos.length > 1 ? `${tramos.slice(0, -1).join(", ")} y ${tramos.at(-1)}` : (tramos[0] ?? "");
}

const deA = ([min, max]: [number, number]) => (min === max ? `${min}` : `${min}–${max}`);

export default async function RepartoSugerido({ searchParams }: { searchParams: Promise<Parametros> }) {
  const sesion = await exigirSesion();
  if (!puede(sesion, "companias.editar")) return <SinAcceso permiso="companias.editar" />;

  const sp = await searchParams;
  const eleccion = leerEleccion(sp);
  const { modo, alcance, tamano } = eleccion;
  const puedeCrear = puede(sesion, "companias.crear");
  const d = await propuestaCompanias(eleccion, puedeCrear);
  const { propuesta } = d;

  // Los parámetros tal como se leyeron: la acción vuelve a calcular con ellos.
  const actuales: Parametros = { edades: modo, alcance, tamano: String(tamano), ...(eleccion.cantidad ? { companias: String(eleccion.cantidad) } : {}) };
  const enlace = (cambio: Parametros) => {
    const q = new URLSearchParams(Object.entries({ ...actuales, ...cambio }).filter((e): e is [string, string] => Boolean(e[1])));
    return `/companias/distribuir?${q}`;
  };

  const n = propuesta.asignaciones.length;
  const k = propuesta.companias.length;
  const tamanos = propuesta.companias.map((c) => c.miembros.length);
  const nuevas = propuesta.crear.length;
  const faltanConsejeros = Math.max(0, k - d.consejeros.hombres);
  const faltanConsejeras = Math.max(0, k - d.consejeros.mujeres);
  const reparte =
    alcance === "rehacer"
      ? `se rehacen las ${k} compañías: ${propuesta.cambian} ${propuesta.cambian === 1 ? "joven cambia" : "jóvenes cambian"} de compañía. Las camas no se tocan: después revisa Habitaciones.`
      : `se asignan ${n} ${n === 1 ? "joven" : "jóvenes"} a sus compañías. Quienes ya tenían compañía no se mueven.`;
  const confirmacion =
    nuevas > 0
      ? `Se ${nuevas === 1 ? `crea la compañía ${propuesta.crear[0]}` : `crean ${nuevas} compañías (${numeros(propuesta.crear)})`} y ${reparte}`
      : reparte.charAt(0).toUpperCase() + reparte.slice(1);

  return (
    <>
      <EncabezadoPagina
        migas={[{ etiqueta: "Compañías", href: "/companias" }, { etiqueta: "Reparto sugerido" }]}
        titulo="Reparto sugerido de jóvenes"
        descripcion="Una propuesta para repartir a los jóvenes en compañías: mujeres y hombres parejos en cada una y los barrios mezclados. Si hacen falta compañías, se crean al aplicar. No se guarda nada hasta que la apliques; después puedes mover a quien quieras a mano."
      />

      <Tarjeta className="mb-6 divide-y divide-slate-100">
        {puedeCrear ? (
          <div className="p-4 sm:p-5">
            <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Jóvenes por compañía</p>
            <div className="flex flex-wrap items-center gap-2">
              {TAMANOS.map((t) => {
                const activo = !eleccion.cantidad && tamano === t;
                return (
                  <Link
                    key={t}
                    href={enlace({ tamano: String(t), companias: undefined })}
                    replace
                    scroll={false}
                    aria-current={activo ? "true" : undefined}
                    className={clsx(
                      "inline-flex items-center rounded-xl border px-4 py-2 text-sm font-semibold transition",
                      activo ? "border-marca-700 bg-marca-700 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
                    )}
                  >
                    {t}
                    {t === 20 && <span className={clsx("ml-1.5 text-xs font-medium", activo ? "text-marca-100" : "text-slate-400")}>10 y 10</span>}
                    <CargaEnlace className="ml-1.5 size-3.5" />
                  </Link>
                );
              })}
              <Form action="/companias/distribuir" replace scroll={false} prefetch={false} className="flex items-center gap-2">
                <input type="hidden" name="edades" value={modo} />
                <input type="hidden" name="alcance" value={alcance} />
                <label htmlFor="tamano" className="sr-only">
                  Otro tamaño
                </label>
                <input
                  id="tamano"
                  name="tamano"
                  type="number"
                  inputMode="numeric"
                  min={4}
                  max={80}
                  placeholder="Otro"
                  defaultValue={TAMANOS.includes(tamano) || eleccion.cantidad ? "" : tamano}
                  className="entrada w-24"
                />
                <Boton type="submit" variante="secundario">
                  Ver
                </Boton>
              </Form>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              En total, mujeres y hombres. Hay {d.mujeres} mujeres y {d.hombres} hombres
              {d.mujeres !== d.hombres && `: en cada compañía habrá algo más de ${d.mujeres > d.hombres ? "mujeres" : "hombres"}`}.
            </p>
          </div>
        ) : (
          <p className="p-4 text-sm text-slate-600 sm:p-5">
            Se reparte entre las {d.cantidad} compañías que ya existen. Para que el reparto cree las que falten hace falta el permiso de crear compañías.
          </p>
        )}

        <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-2">
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
                detalle={`${d.sinCompania} de ${d.total}. Los demás se quedan donde están.`}
              />
              <OpcionEnlace
                href={enlace({ alcance: "rehacer" })}
                activa={alcance === "rehacer"}
                titulo="Rehacer todas las compañías"
                detalle={`Se reparte de nuevo a los ${d.total} jóvenes.`}
              />
            </div>
          </fieldset>
        </div>
      </Tarjeta>

      {k === 0 ? (
        <Tarjeta>
          <EstadoVacio
            icono={<Flag className="size-5" />}
            titulo="No hay compañías"
            descripcion="Pide a quien pueda crear compañías que las cree, o que haga el reparto."
            accion={<EnlaceBoton href="/companias">Ir a Compañías</EnlaceBoton>}
          />
        </Tarjeta>
      ) : (
        <>
          {d.alternativas.length > 1 && (
            <section className="mb-6">
              <h2 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">¿Cuántas compañías?</h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {d.alternativas.map((a) => (
                  <OpcionEnlace
                    key={a.companias}
                    href={enlace({ companias: String(a.companias) })}
                    activa={a.companias === d.cantidad}
                    titulo={`${a.companias} compañías`}
                    detalle={<DetalleAlternativa a={a} />}
                  />
                ))}
              </div>
            </section>
          )}

          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-marca-100 bg-marca-50/60 px-4 py-3.5 sm:px-5">
            <div className="min-w-0 space-y-0.5 text-sm text-marca-950">
              <p className="font-semibold">
                {n === 0
                  ? "No hay jóvenes para repartir."
                  : `${n} ${n === 1 ? "joven" : "jóvenes"} en ${k} ${k === 1 ? "compañía" : "compañías"}`}
                {nuevas > 0 && (
                  <span className="font-normal">
                    {" · "}se {nuevas === 1 ? "crea la compañía" : `crean ${nuevas}: las compañías`} {numeros(propuesta.crear)}
                  </span>
                )}
              </p>
              {n > 0 && (
                <p className="text-marca-800/80">
                  Quedan de {Math.min(...tamanos)} a {Math.max(...tamanos)} jóvenes por compañía.
                  {alcance === "rehacer" && ` ${propuesta.cambian} cambian de compañía.`}
                </p>
              )}
              {(faltanConsejeros > 0 || faltanConsejeras > 0) && (
                <p className="text-marca-800/80">
                  Para {k} compañías hacen falta {k} consejeros y {k} consejeras: hay {d.consejeros.hombres} y {d.consejeros.mujeres} registrados.
                </p>
              )}
            </div>
            <AplicarPropuesta
              aplicar={aplicarReparto.bind(null, actuales, propuesta.huella)}
              etiqueta="Aplicar reparto"
              titulo="¿Aplicar este reparto?"
              deshabilitado={n === 0}
              descripcion={confirmacion}
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
          {d.vacias.length > 0 && (
            <div className="mb-6">
              <Alerta tipo="aviso">
                {d.vacias.length === 1 ? `La compañía ${d.vacias[0]} queda vacía` : `Las compañías ${numeros(d.vacias)} quedan vacías`}: puedes
                eliminarla{d.vacias.length === 1 ? "" : "s"} después o elegir más compañías.
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

function DetalleAlternativa({ a }: { a: Alternativa }) {
  const diezYDiez = a.mujeres[0] >= 10 && a.hombres[0] >= 10;
  return (
    <span className="mt-1 block space-y-0.5">
      <span className="block font-semibold text-slate-700">{deA(a.porCompania)} jóvenes c/u</span>
      <span className="block">
        {deA(a.mujeres)} mujeres · {deA(a.hombres)} hombres
      </span>
      <span className="block">
        {a.pisosMujeres === null || a.pisosHombres === null
          ? "Alguna no cabe junta en un piso"
          : `Pisos: ${a.pisosMujeres} de mujeres · ${a.pisosHombres} de hombres`}
      </span>
      <span className="block">{a.nuevas > 0 ? `Crea ${a.nuevas} nueva${a.nuevas === 1 ? "" : "s"}` : "Usa las que ya hay"}</span>
      {diezYDiez && <span className="block font-medium text-hoja-700">Al menos 10 y 10</span>}
    </span>
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
          <p className="flex items-center gap-2 truncate font-semibold text-slate-900">
            Compañía {c.compania.numero}
            {c.compania.nueva && <Insignia tono="hoja">Nueva</Insignia>}
          </p>
          <p className="truncate text-sm text-slate-500">{c.compania.nueva ? "Se crea al aplicar" : c.compania.nombre || "Sin nombre"}</p>
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
