import type { Metadata } from "next";

import { Avatar, EncabezadoPagina, EncabezadoTarjeta, Insignia, Tarjeta } from "@/components/ui";
import { exigirSesion } from "@/lib/sesion";
import { FormularioClave, FormularioPerfil } from "./formularios";

export const metadata: Metadata = { title: "Mi cuenta" };

export default async function MiCuenta() {
  const sesion = await exigirSesion();

  return (
    <>
      <EncabezadoPagina titulo="Mi cuenta" descripcion="Tus datos personales y tu contraseña." />

      <div className="grid gap-6 lg:grid-cols-3">
        <Tarjeta className="h-fit p-6 text-center">
          <div className="flex justify-center">
            <Avatar texto={sesion.nombre || sesion.email} tamano="lg" />
          </div>
          <p className="mt-4 font-semibold text-slate-900">{sesion.nombre || "Sin nombre"}</p>
          <p className="text-sm text-slate-500">{sesion.email}</p>
          <div className="mt-3">
            <Insignia tono={sesion.esAdmin ? "sol" : sesion.rol ? "marca" : "neutro"}>{sesion.rol?.name ?? "Sin rol"}</Insignia>
          </div>
          <p className="mt-4 text-xs text-slate-400">El correo y el rol solo los cambia un administrador.</p>
        </Tarjeta>

        <div className="space-y-6 lg:col-span-2">
          <Tarjeta>
            <EncabezadoTarjeta titulo="Datos personales" />
            <FormularioPerfil nombre={sesion.nombre} telefono={sesion.telefono ?? ""} />
          </Tarjeta>
          <Tarjeta>
            <EncabezadoTarjeta titulo="Contraseña" descripcion="Te pedimos la actual para confirmar que eres tú." />
            <FormularioClave />
          </Tarjeta>
        </div>
      </div>
    </>
  );
}
