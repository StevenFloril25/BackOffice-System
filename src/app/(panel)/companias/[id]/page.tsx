import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SinAcceso } from "@/components/sin-acceso";
import { EncabezadoPagina } from "@/components/ui";
import { urlsFotos } from "@/lib/fotos";
import {
  consejerosLibres,
  jovenesDeCompania,
  jovenesSinCompania,
  nombreCompania,
  obtenerCompania,
} from "@/lib/organizacion";
import { exigirSesion, puede } from "@/lib/sesion";
import { AccionesCompania, ConsejerosCompania, JovenesCompania } from "./gestion";

export const metadata: Metadata = { title: "Compañía" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function FichaCompania({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await exigirSesion();
  if (!puede(sesion, "companias.ver")) return <SinAcceso permiso="companias.ver" />;

  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const editable = puede(sesion, "companias.editar");
  const [c, jovenes, libresH, libresM, candidatos] = await Promise.all([
    obtenerCompania(id),
    jovenesDeCompania(id),
    editable ? consejerosLibres("Hombre", "compania") : Promise.resolve([]),
    editable ? consejerosLibres("Mujer", "compania") : Promise.resolve([]),
    editable ? jovenesSinCompania() : Promise.resolve([]),
  ]);
  if (!c) notFound();
  const fotos = await urlsFotos([c.consejero?.foto_path, c.consejera?.foto_path]);

  return (
    <>
      <EncabezadoPagina
        migas={[{ etiqueta: "Compañías", href: "/companias" }, { etiqueta: nombreCompania(c) }]}
        titulo={nombreCompania(c)}
        descripcion={c.notas ?? undefined}
        acciones={
          <AccionesCompania
            compania={{ id: c.id, numero: c.numero, nombre: c.nombre, notas: c.notas }}
            puedeEditar={editable}
            puedeEliminar={puede(sesion, "companias.eliminar")}
            jovenes={jovenes.length}
          />
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <ConsejerosCompania
            companiaId={c.id}
            consejero={c.consejero ? { ...c.consejero, foto: c.consejero.foto_path ? (fotos[c.consejero.foto_path] ?? null) : null } : null}
            consejera={c.consejera ? { ...c.consejera, foto: c.consejera.foto_path ? (fotos[c.consejera.foto_path] ?? null) : null } : null}
            libresH={libresH}
            libresM={libresM}
            editable={editable}
          />
        </div>
        <div className="lg:col-span-2">
          <JovenesCompania companiaId={c.id} jovenes={jovenes} candidatos={candidatos} editable={editable} />
        </div>
      </div>
    </>
  );
}
