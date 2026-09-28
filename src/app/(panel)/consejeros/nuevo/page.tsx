import type { Metadata } from "next";

import { SinAcceso } from "@/components/sin-acceso";
import { EncabezadoPagina } from "@/components/ui";
import { listarBarriosOpciones } from "@/lib/participantes";
import { exigirSesion, puede } from "@/lib/sesion";
import { FormularioConsejero } from "../formulario";

export const metadata: Metadata = { title: "Nuevo consejero" };

export default async function NuevoConsejero() {
  const sesion = await exigirSesion();
  if (!puede(sesion, "consejeros.crear")) return <SinAcceso permiso="consejeros.crear" />;

  const barrios = await listarBarriosOpciones();

  return (
    <>
      <EncabezadoPagina
        titulo="Nuevo consejero"
        descripcion="Después se le asigna una compañía y una habitación desde esas páginas."
        migas={[{ etiqueta: "Consejeros", href: "/consejeros" }, { etiqueta: "Nuevo" }]}
      />
      <FormularioConsejero id={null} inicial={{}} barrios={barrios} editable puedeCrearBarrio={puede(sesion, "barrios.crear")} />
    </>
  );
}
