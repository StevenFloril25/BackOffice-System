import type { Metadata } from "next";
import Link from "@/components/enlace";
import { ChevronRight, Search, UserPlus, Users } from "lucide-react";

import { Fecha } from "@/components/cliente";
import { SinAcceso } from "@/components/sin-acceso";
import { Alerta, Avatar, EncabezadoPagina, EnlaceBoton, EstadoVacio, Insignia, Tarjeta, claseBoton } from "@/components/ui";
import { urlsFotos } from "@/lib/fotos";
import { exigirSesion, puede } from "@/lib/sesion";
import { estadoUsuario, listarRolesOpciones, listarUsuarios } from "@/lib/usuarios";
import { plural } from "@/lib/utilidades";

export const metadata: Metadata = { title: "Usuarios" };

type Filtros = { q?: string; rol?: string; estado?: string; aviso?: string };

export default async function PaginaUsuarios({ searchParams }: { searchParams: Promise<Filtros> }) {
  const sesion = await exigirSesion();
  if (!puede(sesion, "usuarios.ver")) return <SinAcceso permiso="usuarios.ver" />;

  const { q = "", rol = "", estado = "", aviso } = await searchParams;
  const [usuarios, roles] = await Promise.all([listarUsuarios(), listarRolesOpciones()]);
  const fotos = await urlsFotos(usuarios.map((u) => u.avatar_path));

  const texto = q.trim().toLowerCase();
  const filtrados = usuarios.filter((u) => {
    if (texto && !`${u.full_name} ${u.email} ${u.username ?? ""} ${u.phone ?? ""}`.toLowerCase().includes(texto)) return false;
    if (rol === "sin-rol" ? u.role_id !== null : rol && u.role_id !== rol) return false;
    if (estado === "activos" && !u.active) return false;
    if (estado === "inactivos" && u.active) return false;
    return true;
  });
  const hayFiltros = Boolean(texto || rol || estado);

  const activos = usuarios.filter((u) => u.active).length;
  const sinIngresar = usuarios.filter((u) => u.active && !u.last_sign_in_at).length;

  return (
    <>
      <EncabezadoPagina
        titulo="Usuarios"
        descripcion="Cuentas con acceso al sistema, su rol y su estado."
        acciones={
          puede(sesion, "usuarios.crear") && (
            <EnlaceBoton href="/usuarios/nuevo">
              <UserPlus className="size-4" aria-hidden />
              Nuevo usuario
            </EnlaceBoton>
          )
        }
      />

      {aviso === "eliminado" && (
        <div className="mb-6">
          <Alerta tipo="exito">La cuenta se eliminó.</Alerta>
        </div>
      )}

      <div className="mb-6 grid grid-cols-3 gap-3 sm:gap-4">
        <Indicador etiqueta="Total" valor={usuarios.length} />
        <Indicador etiqueta="Activos" valor={activos} acento="hoja" />
        <Indicador etiqueta="Sin ingresar aún" valor={sinIngresar} acento="sol" />
      </div>

      <Tarjeta>
        <form className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:px-5" role="search">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              name="q"
              defaultValue={q}
              placeholder="Buscar por nombre, usuario, correo o teléfono"
              aria-label="Buscar"
              className="entrada pl-10"
            />
          </div>
          <select name="rol" defaultValue={rol} aria-label="Filtrar por rol" className="entrada sm:w-48">
            <option value="">Todos los roles</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
            <option value="sin-rol">Sin rol</option>
          </select>
          <select name="estado" defaultValue={estado} aria-label="Filtrar por estado" className="entrada sm:w-40">
            <option value="">Todos</option>
            <option value="activos">Activos</option>
            <option value="inactivos">Inactivos</option>
          </select>
          <div className="flex gap-2">
            <button type="submit" className={claseBoton("secundario")}>
              Filtrar
            </button>
            {hayFiltros && (
              <Link href="/usuarios" className={claseBoton("fantasma")}>
                Limpiar
              </Link>
            )}
          </div>
        </form>

        {filtrados.length === 0 ? (
          <EstadoVacio
            icono={<Users className="size-5" />}
            titulo={hayFiltros ? "Ningún usuario coincide con el filtro" : "Todavía no hay usuarios"}
            descripcion={hayFiltros ? "Prueba con otra búsqueda o limpia los filtros." : "Crea la primera cuenta para dar acceso al sistema."}
          />
        ) : (
          <>
            {/* Tabla en pantallas medianas y grandes */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                    <th className="px-5 py-3">Usuario</th>
                    <th className="px-5 py-3">Rol</th>
                    <th className="px-5 py-3">Estado</th>
                    <th className="px-5 py-3">Último ingreso</th>
                    <th className="px-5 py-3">Alta</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtrados.map((u) => {
                    const e = estadoUsuario(u);
                    return (
                      <tr key={u.id} className="group transition-colors hover:bg-menta-50/70">
                        <td className="px-5 py-3.5">
                          <Link href={`/usuarios/${u.id}`} className="flex items-center gap-3">
                            <Avatar texto={u.full_name || u.email} src={u.avatar_path ? fotos[u.avatar_path] : null} />
                            <span className="min-w-0">
                              <span className="block truncate font-semibold text-slate-900 group-hover:text-marca-700">
                                {u.full_name || "Sin nombre"}
                                {u.id === sesion.id && <span className="ml-2 text-xs font-medium text-slate-400">(tú)</span>}
                              </span>
                              <span className="block truncate text-slate-500">
                                {u.username && <span className="font-medium text-slate-600">@{u.username} · </span>}
                                {u.email}
                              </span>
                            </span>
                          </Link>
                        </td>
                        <td className="px-5 py-3.5">
                          {u.role_name ? (
                            <Insignia tono={u.role_is_system ? "sol" : "marca"}>{u.role_name}</Insignia>
                          ) : (
                            <Insignia>Sin rol</Insignia>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <Insignia tono={e.tono} punto>
                            {e.etiqueta}
                          </Insignia>
                        </td>
                        <td className="px-5 py-3.5 text-slate-600">
                          <Fecha iso={u.last_sign_in_at} relativa />
                        </td>
                        <td className="px-5 py-3.5 text-slate-600">
                          <Fecha iso={u.created_at} />
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <Link
                            href={`/usuarios/${u.id}`}
                            className="inline-flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-marca-700"
                            aria-label={`Ver ${u.full_name || u.email}`}
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

            {/* Lista en móvil */}
            <ul className="divide-y divide-slate-100 md:hidden">
              {filtrados.map((u) => {
                const e = estadoUsuario(u);
                return (
                  <li key={u.id}>
                    <Link href={`/usuarios/${u.id}`} className="flex items-center gap-3 px-4 py-3.5 active:bg-menta-50">
                      <Avatar texto={u.full_name || u.email} src={u.avatar_path ? fotos[u.avatar_path] : null} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-slate-900">{u.full_name || "Sin nombre"}</p>
                        <p className="truncate text-sm text-slate-500">{u.email}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          <Insignia tono={u.role_is_system ? "sol" : u.role_name ? "marca" : "neutro"}>
                            {u.role_name ?? "Sin rol"}
                          </Insignia>
                          <Insignia tono={e.tono} punto>
                            {e.etiqueta}
                          </Insignia>
                        </div>
                      </div>
                      <ChevronRight className="size-4 text-slate-300" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>

            <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
              {hayFiltros
                ? `${plural(filtrados.length, "usuario")} de ${usuarios.length}`
                : plural(usuarios.length, "usuario")}
            </p>
          </>
        )}
      </Tarjeta>
    </>
  );
}

function Indicador({ etiqueta, valor, acento }: { etiqueta: string; valor: number; acento?: "hoja" | "sol" }) {
  return (
    <Tarjeta className="px-4 py-3.5 sm:px-5 sm:py-4">
      <p className="text-xs font-medium text-slate-500">{etiqueta}</p>
      <p
        className={
          acento === "hoja"
            ? "mt-1 text-2xl font-bold text-hoja-700"
            : acento === "sol"
              ? "mt-1 text-2xl font-bold text-sol-600"
              : "mt-1 text-2xl font-bold text-marca-950"
        }
      >
        {valor}
      </p>
    </Tarjeta>
  );
}
