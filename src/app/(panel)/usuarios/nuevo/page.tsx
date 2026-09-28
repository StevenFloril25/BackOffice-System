import type { Metadata } from "next";

import { SinAcceso } from "@/components/sin-acceso";
import { EncabezadoPagina } from "@/components/ui";
import { exigirSesion, puede } from "@/lib/sesion";
import { listarRolesOpciones } from "@/lib/usuarios";
import { FormularioNuevoUsuario } from "./formulario";

export const metadata: Metadata = { title: "Nuevo usuario" };

export default async function NuevoUsuario() {
  const sesion = await exigirSesion();
  if (!puede(sesion, "usuarios.crear")) return <SinAcceso permiso="usuarios.crear" />;

  const roles = (await listarRolesOpciones()).filter((r) => sesion.esAdmin || !r.is_system);

  return (
    <>
      <EncabezadoPagina
        titulo="Nuevo usuario"
        descripcion="La persona podrá ingresar en cuanto la crees, con el correo y la contraseña que se muestran al final."
        migas={[{ etiqueta: "Usuarios", href: "/usuarios" }, { etiqueta: "Nuevo" }]}
      />
      <FormularioNuevoUsuario roles={roles} />
    </>
  );
}
