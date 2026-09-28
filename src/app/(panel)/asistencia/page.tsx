import type { Metadata } from "next";

import { SinAcceso } from "@/components/sin-acceso";
import { EncabezadoPagina } from "@/components/ui";
import { exigirSesion, puede } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { LectorAsistencia, type Persona } from "./lector";

export const metadata: Metadata = { title: "Registro de asistencia" };

export default async function PaginaAsistencia() {
  const sesion = await exigirSesion();
  if (!puede(sesion, "asistencia.registrar")) return <SinAcceso permiso="asistencia.registrar" />;

  const supabase = await createClient();
  const { data } = await supabase
    .from("participantes")
    .select("id, nombres, apellidos, nombre_preferido, asistio_at, talla_camiseta, barrio:barrios(nombre)")
    .order("apellidos")
    .limit(5000);

  const personas: Persona[] = (data ?? []).map((p) => ({
    id: p.id,
    nombre: `${p.nombres} ${p.apellidos}`,
    preferido: p.nombre_preferido,
    barrio: (p.barrio as unknown as { nombre: string } | null)?.nombre ?? "",
    asistio_at: p.asistio_at,
    talla: p.talla_camiseta,
  }));

  return (
    <>
      <EncabezadoPagina
        titulo="Registro de asistencia"
        descripcion="Apunta la cámara al QR del participante. Si no lo trae, búscalo por nombre."
      />
      <LectorAsistencia personas={personas} />
    </>
  );
}
