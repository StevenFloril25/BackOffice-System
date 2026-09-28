import type { Metadata } from "next";

import { SinAcceso } from "@/components/sin-acceso";
import { EncabezadoPagina } from "@/components/ui";
import { exigirSesion, puede } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { ListaBarrios, type BarrioConConteo } from "./lista";

export const metadata: Metadata = { title: "Barrios" };

export default async function PaginaBarrios() {
  const sesion = await exigirSesion();
  if (!puede(sesion, "barrios.ver")) return <SinAcceso permiso="barrios.ver" />;

  const supabase = await createClient();
  const { data } = await supabase
    .from("barrios")
    .select("id, estaca, nombre, obispo_nombre, obispo_correo, obispo_telefono, participantes(count)")
    .order("estaca")
    .order("nombre");

  const barrios: BarrioConConteo[] = (data ?? []).map((b) => ({
    id: b.id,
    estaca: b.estaca,
    nombre: b.nombre,
    obispo_nombre: b.obispo_nombre,
    obispo_correo: b.obispo_correo,
    obispo_telefono: b.obispo_telefono,
    participantes: (b.participantes as unknown as { count: number }[])?.[0]?.count ?? 0,
  }));

  return (
    <>
      <EncabezadoPagina
        titulo="Barrios"
        descripcion="Barrios y ramas de la sesión, con el contacto de su obispo y cuántos jóvenes inscribió cada uno."
      />
      <ListaBarrios
        barrios={barrios}
        puedeCrear={puede(sesion, "barrios.crear")}
        puedeEditar={puede(sesion, "barrios.editar")}
        puedeEliminar={puede(sesion, "barrios.eliminar")}
        verParticipantes={puede(sesion, "participantes.ver")}
      />
    </>
  );
}
