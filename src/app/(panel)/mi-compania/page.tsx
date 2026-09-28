import type { Metadata } from "next";
import Link from "next/link";
import { BedDouble, Phone, UsersRound } from "lucide-react";

import { SinAcceso } from "@/components/sin-acceso";
import { Avatar, EncabezadoPagina, EncabezadoTarjeta, EstadoVacio, Tarjeta } from "@/components/ui";
import { urlsFotos } from "@/lib/fotos";
import { miCompania, nombreCompania, type ConsejeroResumen } from "@/lib/organizacion";
import { nombreCompleto } from "@/lib/participantes-comun";
import { exigirSesion, puede } from "@/lib/sesion";

export const metadata: Metadata = { title: "Mi compañía" };

/**
 * Lo que ve un consejero: su compañía, su pareja y sus jóvenes con el contacto
 * de emergencia y dónde duerme cada uno. Todo lo recorta RLS (ver 0010).
 */
export default async function MiCompania() {
  const sesion = await exigirSesion();
  if (!puede(sesion, "companias.ver_propia")) return <SinAcceso permiso="companias.ver_propia" />;

  const datos = await miCompania();
  if (!datos) {
    return (
      <>
        <EncabezadoPagina titulo="Mi compañía" />
        <Tarjeta>
          <EstadoVacio
            icono={<UsersRound className="size-5" />}
            titulo="Todavía no tienes una compañía asignada"
            descripcion="Cuando te asignen a una compañía, aquí verás a tus jóvenes, su contacto de emergencia y dónde duerme cada uno."
          />
        </Tarjeta>
      </>
    );
  }

  const { compania: c, jovenes } = datos;
  const fotos = await urlsFotos([c.consejero?.foto_path, c.consejera?.foto_path]);
  const mujeres = jovenes.filter((j) => j.sexo === "Mujer").length;
  const hombres = jovenes.filter((j) => j.sexo === "Hombre").length;
  const verFichas = puede(sesion, "participantes.ver");

  return (
    <>
      <EncabezadoPagina
        titulo={nombreCompania(c)}
        descripcion={`${jovenes.length} ${jovenes.length === 1 ? "joven" : "jóvenes"} · ${mujeres} mujeres · ${hombres} hombres`}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Tarjeta className="h-fit">
          <EncabezadoTarjeta titulo="Consejeros" />
          <ul className="divide-y divide-slate-100">
            <Lugar etiqueta="Consejero" persona={c.consejero} fotos={fotos} />
            <Lugar etiqueta="Consejera" persona={c.consejera} fotos={fotos} />
          </ul>
        </Tarjeta>

        <Tarjeta className="lg:col-span-2">
          <EncabezadoTarjeta titulo="Jóvenes" descripcion="Con el contacto de emergencia que dejaron al inscribirse." />
          {jovenes.length === 0 ? (
            <EstadoVacio icono={<UsersRound className="size-5" />} titulo="Todavía no hay jóvenes en tu compañía" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {jovenes.map((j) => (
                <li key={j.id} className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:gap-4 sm:px-6">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar texto={j.nombre} src={j.foto} />
                    <div className="min-w-0">
                      {verFichas ? (
                        <Link href={`/participantes/${j.id}`} className="block truncate font-semibold text-slate-900 hover:text-marca-700">
                          {j.nombre}
                        </Link>
                      ) : (
                        <p className="truncate font-semibold text-slate-900">{j.nombre}</p>
                      )}
                      <p className="truncate text-xs text-slate-500">
                        {[j.preferido && j.preferido !== j.nombre ? `«${j.preferido}»` : null, j.edad !== null ? `${j.edad} años` : null, j.barrio]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                        <BedDouble className="size-3.5 shrink-0 text-marca-400" aria-hidden />
                        {j.duerme ?? "Sin cama todavía"}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 pl-13 text-xs sm:w-52 sm:pl-0 sm:text-right">
                    <p className="text-slate-400">Emergencia</p>
                    <p className="truncate font-medium text-slate-700">{j.contacto.nombre ?? "—"}</p>
                    {j.contacto.telefono && (
                      <a href={`tel:${j.contacto.telefono}`} className="inline-flex items-center gap-1 font-semibold text-marca-700 hover:text-marca-900">
                        <Phone className="size-3" aria-hidden />
                        {j.contacto.telefono}
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </div>
    </>
  );
}

function Lugar({ etiqueta, persona, fotos }: { etiqueta: string; persona: ConsejeroResumen | null; fotos: Record<string, string> }) {
  return (
    <li className="flex items-center gap-3 px-5 py-3.5 sm:px-6">
      {persona ? (
        <>
          <Avatar texto={nombreCompleto(persona)} src={persona.foto_path ? fotos[persona.foto_path] : null} />
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-800">{nombreCompleto(persona)}</p>
            <p className="text-xs text-slate-500">{etiqueta}</p>
          </div>
        </>
      ) : (
        <p className="text-sm text-slate-400">Sin {etiqueta.toLowerCase()} todavía</p>
      )}
    </li>
  );
}
