import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Printer } from "lucide-react";

import { SinAcceso } from "@/components/sin-acceso";
import { EncabezadoPagina, EnlaceBoton } from "@/components/ui";
import {
  consejerosLibres,
  jovenesSinHabitacion,
  listarEdificios,
  obtenerHabitacion,
  ocupantesDeHabitacion,
  sexoPlural,
} from "@/lib/organizacion";
import { exigirSesion, puede } from "@/lib/sesion";
import { AccionesHabitacion, OcupantesHabitacion } from "./gestion";

export const metadata: Metadata = { title: "Habitación" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function FichaHabitacion({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await exigirSesion();
  if (!puede(sesion, "habitaciones.ver")) return <SinAcceso permiso="habitaciones.ver" />;

  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const h = await obtenerHabitacion(id);
  if (!h) notFound();

  const editable = puede(sesion, "habitaciones.editar");
  const esLideres = h.tipo === "lideres";
  const [ocupantes, edificios, libres] = await Promise.all([
    ocupantesDeHabitacion(id),
    editable ? listarEdificios() : Promise.resolve([]),
    !editable ? Promise.resolve([]) : esLideres ? consejerosLibres(h.edificio.sexo, "habitacion") : jovenesSinHabitacion(h.edificio.sexo),
  ]);

  return (
    <>
      <EncabezadoPagina
        migas={[{ etiqueta: "Habitaciones", href: "/habitaciones" }, { etiqueta: h.edificio.nombre }, { etiqueta: `Piso ${h.piso}` }]}
        titulo={`${h.edificio.nombre} · piso ${h.piso} · ${h.nombre}`}
        descripcion={[
          esLideres ? "Habitación de líderes (consejeros)" : "Dormitorio de jóvenes",
          `edificio de ${sexoPlural(h.edificio.sexo)}`,
          h.notas,
        ]
          .filter(Boolean)
          .join(" · ")}
        acciones={
          <>
            <EnlaceBoton href={`/distribucion?habitacion=${h.id}`} target="_blank" variante="secundario">
              <Printer className="size-4" aria-hidden />
              Imprimir
            </EnlaceBoton>
            <AccionesHabitacion
              habitacion={{ id: h.id, edificio_id: h.edificio_id, piso: h.piso, nombre: h.nombre, tipo: h.tipo, capacidad: h.capacidad, notas: h.notas }}
              edificios={edificios.map(({ id: eId, nombre, sexo, notas }) => ({ id: eId, nombre, sexo, notas }))}
              ocupados={ocupantes.length}
              puedeEditar={editable}
              puedeEliminar={puede(sesion, "habitaciones.eliminar")}
            />
          </>
        }
      />

      <OcupantesHabitacion
        habitacionId={h.id}
        capacidad={h.capacidad}
        sexo={h.edificio.sexo}
        tipo={h.tipo}
        ocupantes={ocupantes}
        libres={libres}
        editable={editable}
        enlaces={{ participantes: puede(sesion, "participantes.ver"), consejeros: puede(sesion, "consejeros.ver") }}
      />
    </>
  );
}
