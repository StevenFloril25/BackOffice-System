import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SinAcceso } from "@/components/sin-acceso";
import { EncabezadoPagina } from "@/components/ui";
import { urlsFotos } from "@/lib/fotos";
import {
  consejerosLibres,
  coordinadoresLibres,
  jovenesDeCompania,
  jovenesSinCompania,
  nombreCompania,
  obtenerCompania,
} from "@/lib/organizacion";
import { exigirSesion, puede } from "@/lib/sesion";
import { AccionesCompania, ConsejerosCompania, CoordinadoresCompania, JovenesCompania } from "./gestion";

export const metadata: Metadata = { title: "Compañía" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function FichaCompania({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await exigirSesion();
  if (!puede(sesion, "companias.ver")) return <SinAcceso permiso="companias.ver" />;

  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const editable = puede(sesion, "companias.editar");
  const [c, jovenes, libresH, libresM, candidatos, coordLibres] = await Promise.all([
    obtenerCompania(id),
    jovenesDeCompania(id),
    editable ? consejerosLibres("Hombre", "compania", id) : Promise.resolve([]),
    editable ? consejerosLibres("Mujer", "compania", id) : Promise.resolve([]),
    editable ? jovenesSinCompania() : Promise.resolve([]),
    editable ? coordinadoresLibres() : Promise.resolve([]),
  ]);
  if (!c) notFound();
  const fotos = await urlsFotos([c.consejero?.foto_path, c.consejera?.foto_path, ...c.coordinadores.map((k) => k.foto_path)]);
  const conFoto = <T extends { foto_path: string | null }>(k: T) => ({ ...k, foto: k.foto_path ? (fotos[k.foto_path] ?? null) : null });

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
        <div className="space-y-6 lg:col-span-1">
          <ConsejerosCompania
            companiaId={c.id}
            consejero={c.consejero ? conFoto(c.consejero) : null}
            consejera={c.consejera ? conFoto(c.consejera) : null}
            libresH={libresH}
            libresM={libresM}
            editable={editable}
          />
          <CoordinadoresCompania
            companiaId={c.id}
            coordinadores={c.coordinadores.map(conFoto)}
            libres={coordLibres}
            faltaConsejero={!c.consejero}
            faltaConsejera={!c.consejera}
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
