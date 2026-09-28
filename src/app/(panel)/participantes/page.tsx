import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, FileSpreadsheet, IdCard, Search, UserPlus } from "lucide-react";

import { Fecha } from "@/components/cliente";
import { SinAcceso } from "@/components/sin-acceso";
import { Alerta, Avatar, EncabezadoPagina, EnlaceBoton, EstadoVacio, Insignia, Tarjeta, claseBoton } from "@/components/ui";
import { urlsFotos } from "@/lib/fotos";
import {
  ESTADOS_INSCRIPCION,
  TONO_ESTADO,
  edad,
  listarBarriosOpciones,
  listarParticipantes,
  nombreCompleto,
} from "@/lib/participantes";
import { exigirSesion, puede } from "@/lib/sesion";

export const metadata: Metadata = { title: "Participantes" };

type Filtros = { q?: string; barrio?: string; estaca?: string; estado?: string; asistencia?: string; sexo?: string; aviso?: string };

const sinTildes = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export default async function PaginaParticipantes({ searchParams }: { searchParams: Promise<Filtros> }) {
  const sesion = await exigirSesion();
  if (!puede(sesion, "participantes.ver")) return <SinAcceso permiso="participantes.ver" />;

  const f = await searchParams;
  const [todos, barrios] = await Promise.all([listarParticipantes(), listarBarriosOpciones()]);
  const estacas = [...new Set(barrios.map((b) => b.estaca).filter(Boolean))];

  const texto = sinTildes((f.q ?? "").trim());
  const lista = todos.filter((p) => {
    if (texto) {
      const pajar = sinTildes(
        `${p.nombres} ${p.apellidos} ${p.nombre_preferido} ${p.correo ?? ""} ${p.telefono ?? ""} ${p.contacto1_nombre ?? ""} ${p.contacto1_telefono ?? ""}`,
      );
      if (!texto.split(/\s+/).every((t) => pajar.includes(t))) return false;
    }
    if (f.barrio && p.barrio_id !== f.barrio) return false;
    if (f.estaca && p.barrio?.estaca !== f.estaca) return false;
    if (f.estado && p.estado_inscripcion !== f.estado) return false;
    if (f.sexo && p.sexo !== f.sexo) return false;
    if (f.asistencia === "si" && !p.asistio_at) return false;
    if (f.asistencia === "no" && p.asistio_at) return false;
    return true;
  });
  const hayFiltros = Boolean(texto || f.barrio || f.estaca || f.estado || f.sexo || f.asistencia);
  const fotos = await urlsFotos(lista.map((p) => p.foto_path));

  const cuenta = (e: string) => todos.filter((p) => p.estado_inscripcion === e).length;
  const llegaron = todos.filter((p) => p.asistio_at).length;
  const vigentes = todos.filter((p) => p.estado_inscripcion !== "Cancelado").length;

  return (
    <>
      <EncabezadoPagina
        titulo="Participantes"
        descripcion="Jóvenes inscritos en la sesión. La lista se carga desde el Excel de inscripción y se puede actualizar cuantas veces haga falta."
        acciones={
          <>
            {puede(sesion, "participantes.importar") && (
              <EnlaceBoton href="/participantes/importar" variante="secundario">
                <FileSpreadsheet className="size-4" aria-hidden />
                Importar Excel
              </EnlaceBoton>
            )}
            {puede(sesion, "participantes.crear") && (
              <EnlaceBoton href="/participantes/nuevo">
                <UserPlus className="size-4" aria-hidden />
                Nuevo participante
              </EnlaceBoton>
            )}
          </>
        }
      />

      {f.aviso === "eliminado" && (
        <div className="mb-6">
          <Alerta tipo="exito">El participante se eliminó.</Alerta>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Indicador etiqueta="Inscritos" valor={todos.length} nota={`${vigentes} vigentes`} />
        <Indicador etiqueta="Aprobados" valor={cuenta("Aprobado")} tono="hoja" href="/participantes?estado=Aprobado" />
        <Indicador etiqueta="Pendientes de aprobación" valor={cuenta("Pendiente de aprobación")} tono="sol" href="/participantes?estado=Pendiente%20de%20aprobaci%C3%B3n" />
        <Indicador etiqueta="Llegaron" valor={llegaron} nota={vigentes ? `${Math.round((llegaron / vigentes) * 100)}% de los vigentes` : undefined} href="/participantes?asistencia=si" />
      </div>

      <Tarjeta>
        <form className="grid gap-3 border-b border-slate-100 p-4 sm:px-5 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto_auto]" role="search">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input name="q" defaultValue={f.q} placeholder="Nombre, teléfono, correo o contacto" aria-label="Buscar" className="entrada pl-10" />
          </div>
          <select name="barrio" defaultValue={f.barrio ?? ""} aria-label="Barrio" className="entrada lg:w-44">
            <option value="">Todos los barrios</option>
            {estacas.map((e) => (
              <optgroup key={e} label={e}>
                {barrios
                  .filter((b) => b.estaca === e)
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.nombre}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
          <select name="estado" defaultValue={f.estado ?? ""} aria-label="Estado de inscripción" className="entrada lg:w-44">
            <option value="">Todo estado</option>
            {ESTADOS_INSCRIPCION.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
          <select name="asistencia" defaultValue={f.asistencia ?? ""} aria-label="Asistencia" className="entrada lg:w-36">
            <option value="">Asistencia</option>
            <option value="si">Llegaron</option>
            <option value="no">No han llegado</option>
          </select>
          <select name="sexo" defaultValue={f.sexo ?? ""} aria-label="Sexo" className="entrada lg:w-32">
            <option value="">Sexo</option>
            <option value="Mujer">Mujeres</option>
            <option value="Hombre">Hombres</option>
          </select>
          <div className="flex gap-2">
            <button type="submit" className={claseBoton("secundario")}>
              Filtrar
            </button>
            {hayFiltros && (
              <Link href="/participantes" className={claseBoton("fantasma")}>
                Limpiar
              </Link>
            )}
          </div>
        </form>

        {lista.length === 0 ? (
          <EstadoVacio
            icono={<IdCard className="size-5" />}
            titulo={hayFiltros ? "Nadie coincide con el filtro" : "Todavía no hay participantes"}
            descripcion={hayFiltros ? "Prueba con otra búsqueda." : "Importa el Excel de inscripción para cargar la lista."}
            accion={
              !hayFiltros &&
              puede(sesion, "participantes.importar") && (
                <EnlaceBoton href="/participantes/importar">
                  <FileSpreadsheet className="size-4" aria-hidden />
                  Importar Excel
                </EnlaceBoton>
              )
            }
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                    <th className="px-5 py-3">Participante</th>
                    <th className="px-5 py-3">Barrio</th>
                    <th className="px-5 py-3">Inscripción</th>
                    <th className="px-5 py-3">Talla</th>
                    <th className="px-5 py-3">Llegada</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lista.map((p) => {
                    const e = edad(p.fecha_nacimiento);
                    return (
                      <tr key={p.id} className="group transition-colors hover:bg-menta-50/70">
                        <td className="px-5 py-3">
                          <Link href={`/participantes/${p.id}`} className="flex items-center gap-3">
                            <Avatar texto={nombreCompleto(p)} src={p.foto_path ? fotos[p.foto_path] : null} />
                            <span className="min-w-0">
                              <span className="block truncate font-semibold text-slate-900 group-hover:text-marca-700">
                                {nombreCompleto(p)}
                              </span>
                              <span className="block truncate text-xs text-slate-500">
                                {[e !== null ? `${e} años` : null, p.sexo].filter(Boolean).join(" · ") || "—"}
                              </span>
                            </span>
                          </Link>
                        </td>
                        <td className="px-5 py-3">
                          <span className="block font-medium text-slate-700">{p.barrio?.nombre ?? "—"}</span>
                          <span className="block text-xs text-slate-500">{p.barrio?.estaca}</span>
                        </td>
                        <td className="px-5 py-3">
                          <Insignia tono={TONO_ESTADO[p.estado_inscripcion]}>{p.estado_inscripcion}</Insignia>
                        </td>
                        <td className="px-5 py-3 text-slate-600">{p.talla_camiseta?.replace(" (unisex)", "") ?? "—"}</td>
                        <td className="px-5 py-3">
                          {p.asistio_at ? (
                            <Insignia tono="hoja" punto>
                              <Fecha iso={p.asistio_at} conHora />
                            </Insignia>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Link
                            href={`/participantes/${p.id}`}
                            className="inline-flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-marca-700"
                            aria-label={`Ver ${nombreCompleto(p)}`}
                          >
                            <ChevronRight className="size-4" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-slate-100 md:hidden">
              {lista.map((p) => (
                <li key={p.id}>
                  <Link href={`/participantes/${p.id}`} className="flex items-center gap-3 px-4 py-3.5 active:bg-menta-50">
                    <Avatar texto={nombreCompleto(p)} src={p.foto_path ? fotos[p.foto_path] : null} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-slate-900">{nombreCompleto(p)}</p>
                      <p className="truncate text-sm text-slate-500">{p.barrio?.nombre ?? "Sin barrio"}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <Insignia tono={TONO_ESTADO[p.estado_inscripcion]}>{p.estado_inscripcion}</Insignia>
                        {p.asistio_at && (
                          <Insignia tono="hoja" punto>
                            Llegó
                          </Insignia>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="size-4 text-slate-300" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>

            <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
              {hayFiltros ? `${lista.length} de ${todos.length} participantes` : `${todos.length} participantes`}
            </p>
          </>
        )}
      </Tarjeta>
    </>
  );
}

function Indicador({
  etiqueta,
  valor,
  nota,
  tono,
  href,
}: {
  etiqueta: string;
  valor: number;
  nota?: string;
  tono?: "hoja" | "sol";
  href?: string;
}) {
  const color = tono === "hoja" ? "text-hoja-700" : tono === "sol" ? "text-sol-600" : "text-marca-950";
  const contenido = (
    <Tarjeta className="h-full px-4 py-3.5 transition hover:border-marca-200 sm:px-5 sm:py-4">
      <p className="text-xs font-medium text-slate-500">{etiqueta}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{valor}</p>
      {nota && <p className="text-xs text-slate-400">{nota}</p>}
    </Tarjeta>
  );
  return href ? <Link href={href}>{contenido}</Link> : contenido;
}
