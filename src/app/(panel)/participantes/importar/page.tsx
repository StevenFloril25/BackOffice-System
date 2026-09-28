import type { Metadata } from "next";

import { SinAcceso } from "@/components/sin-acceso";
import { EncabezadoPagina } from "@/components/ui";
import { exigirSesion, puede } from "@/lib/sesion";
import { FormularioImportar } from "./formulario";

export const metadata: Metadata = { title: "Importar participantes" };

export default async function ImportarParticipantes() {
  const sesion = await exigirSesion();
  if (!puede(sesion, "participantes.importar")) return <SinAcceso permiso="participantes.importar" />;

  return (
    <>
      <EncabezadoPagina
        titulo="Importar participantes"
        descripcion="Sube la exportación del sistema de inscripción (.xlsx). Puedes repetirlo cuando haya inscripciones nuevas: los que ya están se actualizan, no se duplican."
        migas={[{ etiqueta: "Participantes", href: "/participantes" }, { etiqueta: "Importar" }]}
      />
      <FormularioImportar />
    </>
  );
}
