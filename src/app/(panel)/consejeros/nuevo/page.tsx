import type { Metadata } from "next";

import { SinAcceso } from "@/components/sin-acceso";
import { EncabezadoPagina } from "@/components/ui";
import { listarBarriosOpciones } from "@/lib/participantes";
import { exigirSesion, puede } from "@/lib/sesion";
import { FormularioConsejero } from "../formulario";

export const metadata: Metadata = { title: "Nuevo consejero o coordinador" };

export default async function NuevoConsejero() {
  const sesion = await exigirSesion();
  if (!puede(sesion, "consejeros.crear")) return <SinAcceso permiso="consejeros.crear" />;

  const barrios = await listarBarriosOpciones();

  return (
    <>
      <EncabezadoPagina
        titulo="Nuevo consejero o coordinador"
        descripcion="Al registrarlo se le crea su cuenta con el rol de su función (Consejero o Coordinador auxiliar): podrá ver las habitaciones y su compañía. La compañía y la cama se le asignan después desde esas páginas."
        migas={[{ etiqueta: "Consejeros", href: "/consejeros" }, { etiqueta: "Nuevo" }]}
      />
      <FormularioConsejero id={null} inicial={{}} barrios={barrios} editable puedeCrearBarrio={puede(sesion, "barrios.crear")} />
    </>
  );
}
