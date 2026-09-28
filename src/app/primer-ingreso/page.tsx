import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";

import { exigirSesion } from "@/lib/sesion";
import { FormularioPrimerIngreso } from "./formulario";

export const metadata: Metadata = { title: "Define tu contraseña" };

export default async function PrimerIngreso() {
  const sesion = await exigirSesion();
  if (!sesion.debeCambiarClave) redirect("/inicio");

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-menta-100 via-white to-marca-50 px-5 py-12">
      <div className="animar-entrada w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-8 shadow-tarjeta sm:p-10">
        <Image src="/brand/logo.webp" alt="Logo FSY" width={64} height={64} className="mb-6 size-16 rounded-2xl ring-1 ring-slate-200" priority />
        <h1 className="text-2xl font-bold tracking-tight text-marca-950">Hola{sesion.nombre ? `, ${sesion.nombre.split(" ")[0]}` : ""}</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          Entraste con una contraseña temporal. Antes de seguir, define una propia: solo tú la vas a conocer.
        </p>
        <FormularioPrimerIngreso />
        <form action="/salir" method="post" className="mt-6 text-center">
          <button type="submit" className="text-xs font-medium text-slate-400 hover:text-slate-600">
            Salir sin cambiarla
          </button>
        </form>
      </div>
    </main>
  );
}
