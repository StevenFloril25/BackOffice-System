import Image from "next/image";

import { EnlaceBoton } from "@/components/ui";

export default function NoEncontrado() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-menta-100 via-white to-marca-50 px-6 text-center">
      <Image src="/brand/logo.webp" alt="" width={72} height={72} className="mb-6 size-18 rounded-2xl ring-1 ring-slate-200" />
      <p className="text-sm font-semibold text-sol-600">Error 404</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-marca-950">No encontramos esta página</h1>
      <p className="mt-2 max-w-sm text-slate-500">Puede que el enlace esté mal escrito o que el registro ya no exista.</p>
      <EnlaceBoton href="/inicio" className="mt-8">
        Ir al inicio
      </EnlaceBoton>
    </main>
  );
}
