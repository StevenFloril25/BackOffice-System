import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, HeartHandshake, Search, UserPlus } from "lucide-react";

import { SinAcceso } from "@/components/sin-acceso";
import { Alerta, Avatar, EncabezadoPagina, EnlaceBoton, EstadoVacio, Insignia, Tarjeta, claseBoton } from "@/components/ui";
import { urlsFotos } from "@/lib/fotos";
import { companiaDeConsejeros, listarConsejeros, nombreCompania, rolConsejero } from "@/lib/organizacion";
import { edad, nombreCompleto } from "@/lib/participantes-comun";
import { exigirSesion, puede } from "@/lib/sesion";

export const metadata: Metadata = { title: "Consejeros" };

type Filtros = { q?: string; sexo?: string; compania?: string; aviso?: string };

const sinTildes = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export default async function PaginaConsejeros({ searchParams }: { searchParams: Promise<Filtros> }) {
  const sesion = await exigirSesion();
  if (!puede(sesion, "consejeros.ver")) return <SinAcceso permiso="consejeros.ver" />;

  const f = await searchParams;
  const [todos, companias] = await Promise.all([listarConsejeros(), companiaDeConsejeros()]);

  const texto = sinTildes((f.q ?? "").trim());
  const lista = todos.filter((c) => {
    if (texto) {
      const pajar = sinTildes(`${c.nombres} ${c.apellidos} ${c.telefono ?? ""} ${c.correo ?? ""} ${c.barrio?.nombre ?? ""}`);
      if (!texto.split(/\s+/).every((t) => pajar.includes(t))) return false;
    }
    if (f.sexo && c.sexo !== f.sexo) return false;
    if (f.compania === "si" && !companias[c.id]) return false;
    if (f.compania === "no" && companias[c.id]) return false;
    return true;
  });
  const hayFiltros = Boolean(texto || f.sexo || f.compania);
  const fotos = await urlsFotos(lista.map((c) => c.foto_path));

  const consejeros = todos.filter((c) => c.sexo === "Hombre").length;
  const consejeras = todos.filter((c) => c.sexo === "Mujer").length;
  const sinCompania = todos.filter((c) => !companias[c.id]).length;

  return (
    <>
      <EncabezadoPagina
        titulo="Consejeros"
        descripcion="Consejeros y consejeras de la sesión. Cada compañía lleva un consejero y una consejera, y en cada habitación duerme al menos uno."
        acciones={
          puede(sesion, "consejeros.crear") && (
            <EnlaceBoton href="/consejeros/nuevo">
              <UserPlus className="size-4" aria-hidden />
              Nuevo consejero
            </EnlaceBoton>
          )
        }
      />

      {f.aviso === "eliminado" && (
        <div className="mb-6">
          <Alerta tipo="exito">El consejero se eliminó.</Alerta>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Indicador etiqueta="En total" valor={todos.length} />
        <Indicador etiqueta="Consejeros" valor={consejeros} href="/consejeros?sexo=Hombre" />
        <Indicador etiqueta="Consejeras" valor={consejeras} href="/consejeros?sexo=Mujer" />
        <Indicador etiqueta="Sin compañía" valor={sinCompania} href="/consejeros?compania=no" />
      </div>

      <Tarjeta>
        <form className="grid gap-3 border-b border-slate-100 p-4 sm:px-5 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto]" role="search">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input name="q" defaultValue={f.q} placeholder="Nombre, teléfono, correo o barrio" aria-label="Buscar" className="entrada pl-10" />
          </div>
          <select name="sexo" defaultValue={f.sexo ?? ""} aria-label="Consejero o consejera" className="entrada lg:w-40">
            <option value="">Todos</option>
            <option value="Hombre">Consejeros</option>
            <option value="Mujer">Consejeras</option>
          </select>
          <select name="compania" defaultValue={f.compania ?? ""} aria-label="Compañía" className="entrada lg:w-44">
            <option value="">Con y sin compañía</option>
            <option value="si">Con compañía</option>
            <option value="no">Sin compañía</option>
          </select>
          <div className="flex gap-2">
            <button type="submit" className={claseBoton("secundario")}>
              Filtrar
            </button>
            {hayFiltros && (
              <Link href="/consejeros" className={claseBoton("fantasma")}>
                Limpiar
              </Link>
            )}
          </div>
        </form>

        {lista.length === 0 ? (
          <EstadoVacio
            icono={<HeartHandshake className="size-5" />}
            titulo={hayFiltros ? "Nadie coincide con el filtro" : "Todavía no hay consejeros"}
            descripcion={hayFiltros ? "Prueba con otra búsqueda." : "Registra a los consejeros y consejeras para armar las compañías."}
            accion={
              !hayFiltros &&
              puede(sesion, "consejeros.crear") && (
                <EnlaceBoton href="/consejeros/nuevo">
                  <UserPlus className="size-4" aria-hidden />
                  Nuevo consejero
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
                    <th className="px-5 py-3">Consejero</th>
                    <th className="px-5 py-3">Compañía</th>
                    <th className="px-5 py-3">Habitación</th>
                    <th className="px-5 py-3">Teléfono</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lista.map((c) => {
                    const e = edad(c.fecha_nacimiento);
                    const compania = companias[c.id];
                    return (
                      <tr key={c.id} className="group transition-colors hover:bg-menta-50/70">
                        <td className="px-5 py-3">
                          <Link href={`/consejeros/${c.id}`} className="flex items-center gap-3">
                            <Avatar texto={nombreCompleto(c)} src={c.foto_path ? fotos[c.foto_path] : null} />
                            <span className="min-w-0">
                              <span className="block truncate font-semibold text-slate-900 group-hover:text-marca-700">
                                {nombreCompleto(c)}
                              </span>
                              <span className="block truncate text-xs text-slate-500">
                                {[rolConsejero(c.sexo), e !== null ? `${e} años` : null, c.barrio?.nombre].filter(Boolean).join(" · ")}
                              </span>
                            </span>
                          </Link>
                        </td>
                        <td className="px-5 py-3">
                          {compania ? (
                            <Link href={`/companias/${compania.id}`} className="font-medium text-marca-700 hover:text-marca-900">
                              {nombreCompania(compania)}
                            </Link>
                          ) : (
                            <Insignia tono="sol">Sin compañía</Insignia>
                          )}
                        </td>
                        <td className="px-5 py-3 text-slate-600">
                          {c.habitacion ? (
                            <Link href={`/habitaciones/${c.habitacion.id}`} className="hover:text-marca-700">
                              {c.habitacion.edificio?.nombre}
                              <span className="block text-xs text-slate-400">Piso {c.habitacion.piso}</span>
                            </Link>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-slate-600">{c.telefono ?? "—"}</td>
                        <td className="px-5 py-3 text-right">
                          <Link
                            href={`/consejeros/${c.id}`}
                            className="inline-flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-marca-700"
                            aria-label={`Ver ${nombreCompleto(c)}`}
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
              {lista.map((c) => {
                const compania = companias[c.id];
                return (
                  <li key={c.id}>
                    <Link href={`/consejeros/${c.id}`} className="flex items-center gap-3 px-4 py-3.5 active:bg-menta-50">
                      <Avatar texto={nombreCompleto(c)} src={c.foto_path ? fotos[c.foto_path] : null} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-slate-900">{nombreCompleto(c)}</p>
                        <p className="truncate text-sm text-slate-500">
                          {rolConsejero(c.sexo)} · {compania ? nombreCompania(compania) : "Sin compañía"}
                        </p>
                      </div>
                      <ChevronRight className="size-4 text-slate-300" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>

            <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
              {hayFiltros ? `${lista.length} de ${todos.length} consejeros` : `${todos.length} consejeros`}
            </p>
          </>
        )}
      </Tarjeta>
    </>
  );
}

function Indicador({ etiqueta, valor, href }: { etiqueta: string; valor: number; href?: string }) {
  const contenido = (
    <Tarjeta className="h-full px-4 py-3.5 transition hover:border-marca-200 sm:px-5 sm:py-4">
      <p className="text-xs font-medium text-slate-500">{etiqueta}</p>
      <p className="mt-1 text-2xl font-bold text-marca-950">{valor}</p>
    </Tarjeta>
  );
  return href ? <Link href={href}>{contenido}</Link> : contenido;
}
