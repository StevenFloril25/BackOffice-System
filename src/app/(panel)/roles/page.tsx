import type { Metadata } from "next";
import Link from "@/components/enlace";
import { Crown, Plus, ShieldCheck, Users } from "lucide-react";

import { SinAcceso } from "@/components/sin-acceso";
import { Alerta, EncabezadoPagina, EnlaceBoton, EstadoVacio, Insignia, Tarjeta } from "@/components/ui";
import { catalogoPermisos, resumenRoles } from "@/lib/roles";
import { exigirSesion, puede } from "@/lib/sesion";
import { plural } from "@/lib/utilidades";

export const metadata: Metadata = { title: "Roles y permisos" };

export default async function PaginaRoles({ searchParams }: { searchParams: Promise<{ aviso?: string }> }) {
  const sesion = await exigirSesion();
  if (!puede(sesion, "roles.ver")) return <SinAcceso permiso="roles.ver" />;

  const { aviso } = await searchParams;
  const [roles, catalogo] = await Promise.all([resumenRoles(), catalogoPermisos()]);
  const totalPermisos = catalogo.reduce((n, m) => n + m.permisos.length, 0);

  return (
    <>
      <EncabezadoPagina
        titulo="Roles y permisos"
        descripcion={`Cada rol define qué puede hacer una persona en cada módulo. Hoy hay ${plural(catalogo.length, "módulo")} y ${plural(totalPermisos, "permiso")}.`}
        acciones={
          puede(sesion, "roles.crear") && (
            <EnlaceBoton href="/roles/nuevo">
              <Plus className="size-4" aria-hidden />
              Nuevo rol
            </EnlaceBoton>
          )
        }
      />

      {aviso === "eliminado" && (
        <div className="mb-6">
          <Alerta tipo="exito">El rol se eliminó.</Alerta>
        </div>
      )}

      {roles.length === 0 ? (
        <Tarjeta>
          <EstadoVacio icono={<ShieldCheck className="size-5" />} titulo="No hay roles" />
        </Tarjeta>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {roles.map((r) => {
            const porcentaje = totalPermisos ? Math.round((r.permisos / totalPermisos) * 100) : 0;
            const esPropio = r.id === sesion.rol?.id;
            return (
              <Link key={r.id} href={`/roles/${r.id}`} className="group">
                <Tarjeta className="flex h-full flex-col p-5 transition group-hover:-translate-y-0.5 group-hover:border-marca-200 group-hover:shadow-flotante/10">
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className={
                        r.is_system
                          ? "flex size-11 items-center justify-center rounded-2xl bg-sol-100 text-sol-600"
                          : "flex size-11 items-center justify-center rounded-2xl bg-marca-50 text-marca-700"
                      }
                    >
                      {r.is_system ? <Crown className="size-5" /> : <ShieldCheck className="size-5" />}
                    </span>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {r.is_system && <Insignia tono="sol">Sistema</Insignia>}
                      {esPropio && <Insignia tono="marca">Tu rol</Insignia>}
                    </div>
                  </div>
                  <h2 className="mt-4 font-semibold text-slate-900 group-hover:text-marca-700">{r.name}</h2>
                  <p className="mt-1 line-clamp-2 flex-1 text-sm text-slate-500">{r.description || "Sin descripción."}</p>

                  <div className="mt-5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-600">
                        {r.is_system ? "Acceso total" : `${r.permisos} de ${totalPermisos} permisos`}
                      </span>
                      <span className="flex items-center gap-1 text-slate-500">
                        <Users className="size-3.5" aria-hidden />
                        {plural(r.usuarios, "usuario")}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={r.is_system ? "h-full rounded-full bg-sol-400" : "h-full rounded-full bg-gradient-to-r from-hoja-500 to-marca-500"}
                        style={{ width: `${porcentaje}%` }}
                      />
                    </div>
                  </div>
                </Tarjeta>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
