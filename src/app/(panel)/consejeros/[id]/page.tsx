import type { Metadata } from "next";
import Link from "@/components/enlace";
import { notFound } from "next/navigation";
import { BedDouble, Flag } from "lucide-react";

import { SinAcceso } from "@/components/sin-acceso";
import { EncabezadoPagina, EncabezadoTarjeta, Tarjeta } from "@/components/ui";
import { urlFoto } from "@/lib/fotos";
import { companiaDeConsejeros, nombreCompania, nombreFuncion, obtenerConsejero } from "@/lib/organizacion";
import { edad, listarBarriosOpciones, nombreCompleto } from "@/lib/participantes";
import { exigirSesion, puede } from "@/lib/sesion";
import { FormularioConsejero } from "../formulario";
import { createAdminClient } from "@/lib/supabase/admin";
import { CuentaConsejero, EliminarConsejero, FotoConsejero } from "./acciones";

export const metadata: Metadata = { title: "Consejero" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function FichaConsejero({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await exigirSesion();
  if (!puede(sesion, "consejeros.ver")) return <SinAcceso permiso="consejeros.ver" />;

  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const [c, barrios, companias] = await Promise.all([obtenerConsejero(id), listarBarriosOpciones(), companiaDeConsejeros()]);
  if (!c) notFound();

  const editable = puede(sesion, "consejeros.editar");
  // La cuenta se lee con la llave de servicio: quien ve consejeros no necesita permiso de usuarios para verla.
  const { data: perfil } = c.profile_id
    ? await createAdminClient().from("profiles").select("id, username, email, active, rol:roles(name)").eq("id", c.profile_id).maybeSingle()
    : { data: null };
  const cuenta = perfil
    ? {
        id: perfil.id as string,
        usuario: perfil.username as string | null,
        email: perfil.email as string,
        rol: (perfil.rol as unknown as { name: string } | null)?.name ?? null,
        activa: Boolean(perfil.active),
      }
    : null;
  const foto = await urlFoto(c.foto_path);
  const compania = companias[c.id];
  const e = edad(c.fecha_nacimiento);

  const inicial: Record<string, string> = {
    funcion: c.funcion,
    nombres: c.nombres,
    apellidos: c.apellidos,
    sexo: c.sexo,
    fecha_nacimiento: c.fecha_nacimiento ?? "",
    telefono: c.telefono ?? "",
    correo: c.correo ?? "",
    barrio_id: c.barrio_id ?? "",
    talla_camiseta: c.talla_camiseta ?? "",
    contacto_emergencia_nombre: c.contacto_emergencia_nombre ?? "",
    contacto_emergencia_telefono: c.contacto_emergencia_telefono ?? "",
    notas: c.notas ?? "",
  };

  return (
    <>
      <EncabezadoPagina
        migas={[{ etiqueta: "Consejeros", href: "/consejeros" }, { etiqueta: nombreCompleto(c) }]}
        titulo={nombreCompleto(c)}
        descripcion={[nombreFuncion(c.funcion, c.sexo), e !== null ? `${e} años` : null, c.barrio?.nombre].filter(Boolean).join(" · ")}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <FormularioConsejero
            id={c.id}
            inicial={inicial}
            barrios={barrios}
            editable={editable}
            puedeCrearBarrio={puede(sesion, "barrios.crear")}
          />
        </div>

        <div className="space-y-6">
          <Tarjeta>
            <EncabezadoTarjeta titulo="Foto" descripcion="Tipo carnet." />
            <div className="p-6">
              <FotoConsejero id={c.id} url={foto} texto={nombreCompleto(c)} editable={editable} />
            </div>
          </Tarjeta>

          <Tarjeta>
            <EncabezadoTarjeta titulo="Asignación" descripcion="Se asigna desde Compañías y Habitaciones." />
            <ul className="divide-y divide-slate-100 text-sm">
              <li className="flex items-center gap-3 px-5 py-3.5 sm:px-6">
                <Flag className="size-4 shrink-0 text-marca-500" aria-hidden />
                <span className="flex-1 text-slate-500">
                  {c.coordina_compania_id ? "Coordina" : compania && c.funcion === "coordinador" ? "Cubre como consejero en" : "Compañía"}
                </span>
                {compania ? (
                  <Link href={`/companias/${compania.id}`} className="font-semibold text-marca-700 hover:text-marca-900">
                    {nombreCompania(compania)}
                  </Link>
                ) : (
                  <span className="font-medium text-slate-400">Sin compañía</span>
                )}
              </li>
              <li className="flex items-center gap-3 px-5 py-3.5 sm:px-6">
                <BedDouble className="size-4 shrink-0 text-marca-500" aria-hidden />
                <span className="flex-1 text-slate-500">Habitación</span>
                {c.habitacion ? (
                  <Link href={`/habitaciones/${c.habitacion.id}`} className="text-right font-semibold text-marca-700 hover:text-marca-900">
                    {c.habitacion.edificio?.nombre}
                    <span className="block text-xs font-normal text-slate-500">Piso {c.habitacion.piso}</span>
                  </Link>
                ) : (
                  <span className="font-medium text-slate-400">Sin habitación</span>
                )}
              </li>
            </ul>
          </Tarjeta>

          <CuentaConsejero id={c.id} cuenta={cuenta} verUsuarios={puede(sesion, "usuarios.ver")} puedeCrear={editable} />

          {puede(sesion, "consejeros.eliminar") && (
            <EliminarConsejero id={c.id} nombre={nombreCompleto(c)} asignado={Boolean(compania || c.habitacion)} />
          )}
        </div>
      </div>
    </>
  );
}
