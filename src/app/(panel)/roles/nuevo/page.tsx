import type { Metadata } from "next";

import { SinAcceso } from "@/components/sin-acceso";
import { EncabezadoPagina } from "@/components/ui";
import { catalogoPermisos } from "@/lib/roles";
import { exigirSesion, puede } from "@/lib/sesion";
import { EditorRol } from "../editor";

export const metadata: Metadata = { title: "Nuevo rol" };

export default async function NuevoRol() {
  const sesion = await exigirSesion();
  if (!puede(sesion, "roles.crear")) return <SinAcceso permiso="roles.crear" />;

  const catalogo = await catalogoPermisos();

  return (
    <>
      <EncabezadoPagina
        titulo="Nuevo rol"
        descripcion="Ponle un nombre claro y marca lo que podrá hacer en cada módulo."
        migas={[{ etiqueta: "Roles y permisos", href: "/roles" }, { etiqueta: "Nuevo" }]}
      />
      <EditorRol rolId={null} catalogo={catalogo} inicial={{ name: "", description: "", permisos: [] }} editable />
    </>
  );
}
