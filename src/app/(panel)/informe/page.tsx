import type { Metadata } from "next";
import Image from "next/image";
import { Camera, Quote } from "lucide-react";

import { SinAcceso } from "@/components/sin-acceso";
import { Alerta, EncabezadoPagina, EncabezadoTarjeta, Tarjeta } from "@/components/ui";
import { datosInforme, textoInforme, totalJovenesAdultos, type Conteo } from "@/lib/informe";
import { MARCA } from "@/lib/marca";
import { exigirSesion, puede } from "@/lib/sesion";
import { BotonesInforme, FormularioConteos, NuevoTestimonio, Quitar, SubirFoto } from "./cliente";

export const metadata: Metadata = { title: "Informe final" };

const porcentaje = (c: Conteo) => (c.inscritos ? `${Math.round((c.asistieron / c.inscritos) * 100)} %` : "—");

export default async function PaginaInforme() {
  const sesion = await exigirSesion();
  if (!puede(sesion, "informe.ver")) return <SinAcceso permiso="informe.ver" />;

  const d = await datosInforme();
  const editable = puede(sesion, "informe.editar");
  const adultos = totalJovenesAdultos(d);
  const hoy = new Date().toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Guayaquil" });

  return (
    <div className="print:text-[12px]">
      <div className="print:hidden">
        <EncabezadoPagina
          titulo="Informe final"
          descripcion="Lo que el matrimonio director de sesión envía al matrimonio asesor en el Área al terminar la sesión. Los números salen del sistema; los testimonios y las fotos se agregan aquí."
          acciones={<BotonesInforme resumen={textoInforme(d)} />}
        />
        <div className="mb-6">
          <Alerta tipo="info">
            El matrimonio asesor en el Área envía el resumen al equipo de conferencias FSY (FSY@ChurchofJesusChrist.org) dentro del mes
            siguiente a la sesión. «Copiar resumen» deja el informe listo para pegar en un correo.
          </Alerta>
        </div>
      </div>

      {/* Encabezado solo para el papel */}
      <header className="mb-5 hidden border-b border-slate-300 pb-3 print:block">
        <p className="text-lg font-bold text-marca-950">
          Informe final · {MARCA.nombre} · {MARCA.sesion}
        </p>
        <p className="text-slate-600">Del matrimonio director de sesión al matrimonio asesor en el Área · {hoy}</p>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Indicador etiqueta="Jóvenes que asistieron" valor={d.jovenes.asistieron} nota={`de ${d.jovenes.inscritos} inscritos · ${porcentaje(d.jovenes)}`} />
        <Indicador etiqueta="Mujeres · hombres" valor={`${d.jovenes.mujeres.asistieron} · ${d.jovenes.hombres.asistieron}`} nota="que asistieron" />
        <Indicador etiqueta="Jóvenes adultos solteros" valor={adultos} nota="en el personal" />
        <Indicador etiqueta="Sesiones" valor={d.conteos.sesiones} nota="realizadas" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2 print:block print:space-y-5">
        <Tarjeta className="break-inside-avoid print:shadow-none">
          <EncabezadoTarjeta titulo="Jóvenes por estaca y barrio" descripcion="La asistencia sale del registro de llegada." />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                  <th className="px-5 py-2 font-medium sm:px-6">Estaca / barrio</th>
                  <th className="px-3 py-2 text-right font-medium">Inscritos</th>
                  <th className="px-3 py-2 text-right font-medium">Asistieron</th>
                  <th className="px-5 py-2 text-right font-medium sm:px-6">%</th>
                </tr>
              </thead>
              {d.jovenes.porEstaca.map((e) => (
                <tbody key={e.estaca} className="border-b border-slate-100">
                  <tr className="bg-slate-50/70 font-semibold text-slate-800">
                    <td className="px-5 py-2 sm:px-6">{e.estaca}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{e.inscritos}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{e.asistieron}</td>
                    <td className="px-5 py-2 text-right tabular-nums sm:px-6">{porcentaje(e)}</td>
                  </tr>
                  {e.barrios.map((b) => (
                    <tr key={b.nombre} className="text-slate-600">
                      <td className="py-1.5 pr-3 pl-9 sm:pl-10">{b.nombre}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{b.inscritos}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{b.asistieron}</td>
                      <td className="px-5 py-1.5 text-right tabular-nums sm:px-6">{porcentaje(b)}</td>
                    </tr>
                  ))}
                </tbody>
              ))}
              <tfoot>
                <tr className="font-bold text-marca-950">
                  <td className="px-5 py-2.5 sm:px-6">Total</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{d.jovenes.inscritos}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{d.jovenes.asistieron}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums sm:px-6">{porcentaje(d.jovenes)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Tarjeta>

        <Tarjeta className="h-fit break-inside-avoid print:shadow-none">
          <EncabezadoTarjeta
            titulo="Jóvenes adultos solteros"
            descripcion="Consejeros y coordinadores auxiliares salen del sistema; lo demás se anota a mano."
          />
          <dl className="divide-y divide-slate-100 text-sm">
            <Fila etiqueta="Coordinadores" valor={d.conteos.coordinadores} detalle="anotado a mano" />
            <Fila
              etiqueta="Coordinadores auxiliares"
              valor={d.coordinadoresAuxiliares.hombres + d.coordinadoresAuxiliares.mujeres}
              detalle={`${d.coordinadoresAuxiliares.hombres} hombres · ${d.coordinadoresAuxiliares.mujeres} mujeres`}
            />
            <Fila
              etiqueta="Consejeros"
              valor={d.consejeros.hombres + d.consejeros.mujeres}
              detalle={`${d.consejeros.hombres} hombres · ${d.consejeros.mujeres} mujeres`}
            />
            <Fila etiqueta="Otros puestos" valor={d.conteos.otros_jovenes_adultos} detalle="anotado a mano" />
            <div className="flex items-center justify-between gap-4 px-5 py-3 font-bold text-marca-950 sm:px-6">
              <dt>Total</dt>
              <dd className="tabular-nums">{adultos}</dd>
            </div>
          </dl>
          {editable && (
            <div className="border-t border-slate-100 p-5 sm:p-6 print:hidden">
              <p className="mb-3 text-sm font-semibold text-slate-800">Anotar a mano</p>
              <FormularioConteos valores={d.conteos} />
            </div>
          )}
        </Tarjeta>
      </div>

      <Tarjeta className="mt-6 print:mt-5 print:shadow-none">
        <EncabezadoTarjeta
          titulo={`Testimonios (${d.testimonios.length})`}
          descripcion="Algunos testimonios de jóvenes y jóvenes adultos solteros, si están disponibles."
        />
        {d.testimonios.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-slate-500">Todavía no hay testimonios.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {d.testimonios.map((t) => (
              <li key={t.id} className="flex gap-3 px-5 py-4 break-inside-avoid sm:px-6">
                <Quote className="mt-0.5 size-4 shrink-0 text-marca-300" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm whitespace-pre-line text-slate-800">{t.texto}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {[t.autor, t.tipo === "joven" ? "Joven" : "Joven adulto soltero"].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {editable && <Quitar tipo="testimonio" id={t.id} etiqueta="Quitar testimonio" />}
              </li>
            ))}
          </ul>
        )}
        {editable && (
          <div className="border-t border-slate-100 p-5 sm:p-6 print:hidden">
            <NuevoTestimonio />
          </div>
        )}
      </Tarjeta>

      <Tarjeta className="mt-6 print:mt-5 print:shadow-none">
        <EncabezadoTarjeta titulo={`Fotografías (${d.fotos.length})`} descripcion="Cada foto con el nombre y el correo de quien la tomó." />
        {d.fotos.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-slate-500">Todavía no hay fotos.</p>
        ) : (
          <ul className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-3 print:grid-cols-3">
            {d.fotos.map((f) => (
              <li key={f.id} className="break-inside-avoid">
                <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100">
                  {f.url ? (
                    <a href={f.url} target="_blank" rel="noreferrer" title="Abrir en tamaño completo">
                      <Image src={f.url} alt={f.descripcion ?? "Foto de la sesión"} fill unoptimized sizes="(min-width: 1024px) 33vw, 100vw" className="object-cover" />
                    </a>
                  ) : (
                    <span className="flex h-full items-center justify-center text-slate-400">
                      <Camera className="size-6" aria-hidden />
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-start gap-2">
                  <div className="min-w-0 flex-1 text-xs">
                    {f.descripcion && <p className="font-medium text-slate-800">{f.descripcion}</p>}
                    <p className="text-slate-500">
                      Foto: {f.fotografo_nombre}
                      {f.fotografo_correo && ` · ${f.fotografo_correo}`}
                    </p>
                  </div>
                  {editable && <Quitar tipo="foto" id={f.id} etiqueta="Quitar foto" />}
                </div>
              </li>
            ))}
          </ul>
        )}
        {editable && (
          <div className="border-t border-slate-100 p-5 sm:p-6 print:hidden">
            <SubirFoto />
          </div>
        )}
      </Tarjeta>
    </div>
  );
}

function Indicador({ etiqueta, valor, nota }: { etiqueta: string; valor: number | string; nota?: string }) {
  return (
    <Tarjeta className="h-full px-4 py-3.5 sm:px-5 sm:py-4 print:shadow-none">
      <p className="text-xs font-medium text-slate-500">{etiqueta}</p>
      <p className="mt-1 text-2xl font-bold text-marca-950">{valor}</p>
      {nota && <p className="text-xs text-slate-400">{nota}</p>}
    </Tarjeta>
  );
}

function Fila({ etiqueta, valor, detalle }: { etiqueta: string; valor: number; detalle?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3 sm:px-6">
      <dt className="min-w-0">
        <span className="font-medium text-slate-800">{etiqueta}</span>
        {detalle && <span className="block text-xs text-slate-500">{detalle}</span>}
      </dt>
      <dd className="text-lg font-bold text-marca-950 tabular-nums">{valor}</dd>
    </div>
  );
}
