import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SinAcceso } from "@/components/sin-acceso";
import { Alerta, Avatar, EncabezadoPagina, EncabezadoTarjeta, Insignia, Tarjeta } from "@/components/ui";
import { catalogoPermisos, obtenerRol, resumenRoles } from "@/lib/roles";
import { exigirSesion, puede } from "@/lib/sesion";
import { listarUsuarios } from "@/lib/usuarios";
import { EditorRol } from "../editor";
import { EliminarRol } from "./eliminar";

export const metadata: Metadata = { title: "Rol" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function DetalleRol({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aviso?: string }>;
}) {
  const sesion = await exigirSesion();
  if (!puede(sesion, "roles.ver")) return <SinAcceso permiso="roles.ver" />;

  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { aviso } = await searchParams;

  const [rol, catalogo, resumen] = await Promise.all([obtenerRol(id), catalogoPermisos(), resumenRoles()]);
  if (!rol) notFound();

  const usuariosDelRol = puede(sesion, "usuarios.ver") ? (await listarUsuarios()).filter((u) => u.role_id === id) : null;
  const cantidadUsuarios = resumen.find((r) => r.id === id)?.usuarios ?? 0;

  const esPropio = rol.id === sesion.rol?.id;
  const editable = puede(sesion, "roles.editar") && !rol.is_system && !(esPropio && !sesion.esAdmin);
  const eliminable = puede(sesion, "roles.eliminar") && !rol.is_system;

  // El admin no guarda permisos (los tiene todos por definición): se muestra el
  // catálogo completo marcado para que se entienda qué implica.
  const permisos = rol.is_system ? catalogo.flatMap((m) => m.permisos.map((p) => p.key)) : rol.permisos;

  return (
    <>
      <EncabezadoPagina
        titulo={
          <span className="flex flex-wrap items-center gap-3">
            {rol.name}
            {rol.is_system && <Insignia tono="sol">Sistema</Insignia>}
            {esPropio && <Insignia tono="marca">Tu rol</Insignia>}
          </span>
        }
        descripcion={rol.description || undefined}
        migas={[{ etiqueta: "Roles y permisos", href: "/roles" }, { etiqueta: rol.name }]}
      />

      {rol.is_system && (
        <div className="mb-6">
          <Alerta tipo="info" titulo="Rol protegido">
            Tiene acceso total a todos los módulos, incluidos los que se agreguen después. No se puede editar ni eliminar, para
            que siempre exista alguien capaz de administrar el sistema.
          </Alerta>
        </div>
      )}
      {esPropio && !sesion.esAdmin && !rol.is_system && puede(sesion, "roles.editar") && (
        <div className="mb-6">
          <Alerta tipo="aviso">No puedes modificar los permisos de tu propio rol. Pídeselo a otra persona con permiso.</Alerta>
        </div>
      )}

      <EditorRol
        rolId={rol.id}
        catalogo={catalogo}
        inicial={{ name: rol.name, description: rol.description, permisos }}
        editable={editable}
        aviso={aviso === "creado" ? "Rol creado." : undefined}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {usuariosDelRol && (
          <Tarjeta className="lg:col-span-2">
            <EncabezadoTarjeta titulo="Usuarios con este rol" descripcion={`${usuariosDelRol.length} en total`} />
            {usuariosDelRol.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-slate-500">Nadie tiene este rol todavía.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {usuariosDelRol.map((u) => (
                  <li key={u.id}>
                    <Link href={`/usuarios/${u.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-menta-50 sm:px-6">
                      <Avatar texto={u.full_name || u.email} tamano="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-900">{u.full_name || u.email}</span>
                        <span className="block truncate text-xs text-slate-500">{u.email}</span>
                      </span>
                      {!u.active && <Insignia>Inactivo</Insignia>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>
        )}
        {eliminable && <EliminarRol id={rol.id} nombre={rol.name} usuarios={cantidadUsuarios} />}
      </div>
    </>
  );
}
