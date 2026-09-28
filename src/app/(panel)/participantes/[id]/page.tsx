import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AvisoBreve, Fecha } from "@/components/cliente";
import { SinAcceso } from "@/components/sin-acceso";
import { EncabezadoPagina, EncabezadoTarjeta, Tarjeta } from "@/components/ui";
import { urlFoto } from "@/lib/fotos";
import { qrSvg, urlAsistencia } from "@/lib/qr";
import { CAMPOS_SALUD, edad, listarBarriosOpciones, nombreCompleto, obtenerParticipante } from "@/lib/participantes";
import { exigirSesion, puede } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { FormularioParticipante } from "../formulario";
import { Asistencia, EliminarParticipante, FotoParticipante } from "./acciones";
import { QrParticipante } from "./qr";

export const metadata: Metadata = { title: "Participante" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function FichaParticipante({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aviso?: string }>;
}) {
  const sesion = await exigirSesion();
  if (!puede(sesion, "participantes.ver")) return <SinAcceso permiso="participantes.ver" />;

  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { aviso } = await searchParams;

  const [datos, barrios] = await Promise.all([obtenerParticipante(id), listarBarriosOpciones()]);
  if (!datos) notFound();
  const { participante: p, salud } = datos;

  const verSalud = puede(sesion, "participantes.salud");
  const editable = puede(sesion, "participantes.editar");
  const foto = await urlFoto(p.foto_path);
  const contenidoQr = await urlAsistencia(p.qr_token);
  const svgQr = await qrSvg(contenidoQr);

  let registradoPor: string | null = null;
  if (p.asistio_at) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("listar_usuarios");
    const quien = (data as { id: string; full_name: string; email: string }[] | null)?.find((u) => u.id === p.asistencia_por);
    registradoPor = quien ? quien.full_name || quien.email : null;
  }

  const inicial: Record<string, string> = {
    nombres: p.nombres,
    apellidos: p.apellidos,
    nombre_preferido: p.nombre_preferido,
    fecha_nacimiento: p.fecha_nacimiento ?? "",
    sexo: p.sexo ?? "",
    telefono: p.telefono ?? "",
    correo: p.correo ?? "",
    talla_camiseta: p.talla_camiseta ?? "",
    barrio_id: p.barrio_id ?? "",
    contacto1_nombre: p.contacto1_nombre ?? "",
    contacto1_correo: p.contacto1_correo ?? "",
    contacto1_telefono: p.contacto1_telefono ?? "",
    contacto2_nombre: p.contacto2_nombre ?? "",
    contacto2_correo: p.contacto2_correo ?? "",
    contacto2_telefono: p.contacto2_telefono ?? "",
    ...Object.fromEntries(CAMPOS_SALUD.map((c) => [c.clave, salud?.[c.clave] ?? ""])),
  };

  const e = edad(p.fecha_nacimiento);

  return (
    <>
      <EncabezadoPagina
        migas={[{ etiqueta: "Participantes", href: "/participantes" }, { etiqueta: nombreCompleto(p) }]}
        titulo={nombreCompleto(p)}
        descripcion={
          <span className="flex flex-wrap items-center gap-2">
            {p.barrio && (
              <span>
                {p.barrio.nombre} · {p.barrio.estaca}
              </span>
            )}
            {e !== null && <span>· {e} años</span>}
          </span>
        }
      />

      {aviso === "creado" && <AvisoBreve titulo="Participante registrado" detalle={nombreCompleto(p)} quitarDeUrl="aviso" />}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <FormularioParticipante
            id={p.id}
            inicial={inicial}
            barrios={barrios}
            editable={editable}
            verSalud={verSalud}
            puedeCrearBarrio={puede(sesion, "barrios.crear")}
          />
        </div>

        <div className="space-y-6">
          <Tarjeta>
            <EncabezadoTarjeta titulo="Foto" descripcion="Tipo carnet." />
            <div className="p-6">
              <FotoParticipante id={p.id} url={foto} texto={nombreCompleto(p)} editable={editable} />
            </div>
          </Tarjeta>

          <Asistencia
            id={p.id}
            nombre={nombreCompleto(p)}
            asistioAt={p.asistio_at}
            registradoPor={registradoPor}
            puedeRegistrar={puede(sesion, "asistencia.registrar")}
          />

          <QrParticipante
            id={p.id}
            contenido={contenidoQr}
            svg={svgQr}
            nombre={p.nombre_preferido || nombreCompleto(p)}
            barrio={p.barrio?.nombre ?? ""}
            estaca={p.barrio?.estaca ?? ""}
          />

          <Tarjeta>
            <EncabezadoTarjeta titulo="Registro" />
            <dl className="divide-y divide-slate-100 text-sm">
              <Dato etiqueta="Se registró">
                <Fecha iso={p.fecha_inscripcion} conHora />
              </Dato>
              <Dato etiqueta="Edad al registrarse">{p.edad_inscripcion ?? "—"}</Dato>
              <Dato etiqueta="Origen">{p.origen === "importacion" ? "Excel de inscripción" : "Registro manual"}</Dato>
              <Dato etiqueta="Tipo">{p.tipo}</Dato>
            </dl>
          </Tarjeta>

          {puede(sesion, "participantes.eliminar") && <EliminarParticipante id={p.id} nombre={nombreCompleto(p)} />}
        </div>
      </div>
    </>
  );
}

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3 sm:px-6">
      <dt className="text-slate-500">{etiqueta}</dt>
      <dd className="text-right font-medium text-slate-800">{children}</dd>
    </div>
  );
}
