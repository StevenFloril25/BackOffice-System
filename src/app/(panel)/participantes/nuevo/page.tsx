import type { Metadata } from "next";

import { SinAcceso } from "@/components/sin-acceso";
import { EncabezadoPagina } from "@/components/ui";
import { listarBarriosOpciones } from "@/lib/participantes";
import { exigirSesion, puede } from "@/lib/sesion";
import { FormularioParticipante } from "../formulario";

export const metadata: Metadata = { title: "Nuevo participante" };

export default async function NuevoParticipante() {
  const sesion = await exigirSesion();
  if (!puede(sesion, "participantes.crear")) return <SinAcceso permiso="participantes.crear" />;

  const barrios = await listarBarriosOpciones();

  return (
    <>
      <EncabezadoPagina
        titulo="Nuevo participante"
        descripcion="Para registrar a alguien que no está en el Excel de inscripción. Si después aparece en el Excel, la importación actualiza esta ficha en vez de duplicarla."
        migas={[{ etiqueta: "Participantes", href: "/participantes" }, { etiqueta: "Nuevo" }]}
      />
      <FormularioParticipante
        id={null}
        inicial={{ estado_inscripcion: "Aprobado" }}
        barrios={barrios}
        editable
        verSalud={puede(sesion, "participantes.salud")}
        puedeCrearBarrio={puede(sesion, "barrios.crear")}
      />
    </>
  );
}
