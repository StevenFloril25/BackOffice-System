import type { Metadata } from "next";
import Image from "next/image";
import { History, ShieldCheck, Users } from "lucide-react";

import { MARCA } from "@/lib/marca";
import { FormularioLogin } from "./formulario";

export const metadata: Metadata = { title: "Ingresar" };

const MENSAJES: Record<string, string> = {
  inactivo: "Tu cuenta está desactivada. Si crees que es un error, consulta con un administrador.",
  sesion: "Tu sesión terminó. Vuelve a ingresar.",
};

const PUNTOS = [
  { Icono: Users, texto: "Usuarios con acceso controlado" },
  { Icono: ShieldCheck, texto: "Roles y permisos por módulo" },
  { Icono: History, texto: "Bitácora de cada cambio" },
];

export default async function PaginaLogin({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string; volver?: string }>;
}) {
  const { motivo, volver } = await searchParams;
  const aviso = motivo ? MENSAJES[motivo] : undefined;

  return (
    <main className="flex min-h-screen">
      {/* Panel de marca */}
      <section className="relative hidden w-[46%] max-w-[640px] overflow-hidden bg-gradient-to-br from-marca-800 via-marca-700 to-marca-950 text-white lg:flex lg:flex-col">
        <div aria-hidden className="absolute -top-24 -right-20 size-80 rounded-full bg-sol-400" />
        <svg aria-hidden viewBox="0 0 600 260" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-56 w-full">
          <path d="M0 150 C 160 60, 320 250, 600 110 L 600 260 L 0 260 Z" className="fill-hoja-500/35" />
          <path d="M0 200 C 180 120, 360 270, 600 170 L 600 260 L 0 260 Z" className="fill-marca-300/25" />
          <path d="M0 235 C 200 180, 380 280, 600 220 L 600 260 L 0 260 Z" className="fill-marca-950/40" />
        </svg>

        <div className="relative z-10 flex flex-1 flex-col px-12 py-12 xl:px-16">
          <div className="flex items-center gap-3">
            <Image
              src="/brand/logo.webp"
              alt=""
              width={48}
              height={48}
              className="size-12 rounded-2xl shadow-lg ring-1 ring-white/30"
              priority
            />
            <div className="leading-tight">
              <p className="text-sm font-bold tracking-wide">{MARCA.nombre}</p>
              <p className="text-xs text-marca-200">{MARCA.sesion}</p>
            </div>
          </div>

          <div className="mt-auto mb-auto max-w-md pt-16">
            <h1 className="text-4xl leading-[1.1] font-bold tracking-tight xl:text-[2.75rem]">
              Organiza la conferencia con{" "}
              <span className="text-sol-400">claridad</span>.
            </h1>
            <p className="mt-4 text-base leading-relaxed text-marca-100/90">
              Un solo lugar para administrar al equipo, sus accesos y cada módulo del sistema.
            </p>
            <ul className="mt-8 space-y-3">
              {PUNTOS.map(({ Icono, texto }) => (
                <li key={texto} className="flex items-center gap-3 text-sm text-white/90">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
                    <Icono className="size-4 text-sol-200" aria-hidden />
                  </span>
                  {texto}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-marca-200/80">© {new Date().getFullYear()} {MARCA.nombre} · {MARCA.sesion}</p>
        </div>
      </section>

      {/* Formulario */}
      <section className="flex flex-1 items-center justify-center bg-gradient-to-b from-white to-menta-50 px-5 py-12 sm:px-8">
        <div className="animar-entrada w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center lg:items-start lg:text-left">
            <Image
              src="/brand/logo.webp"
              alt="Logo FSY"
              width={80}
              height={80}
              className="mb-6 size-20 rounded-3xl shadow-tarjeta ring-1 ring-slate-200 lg:hidden"
              priority
            />
            <h2 className="text-2xl font-bold tracking-tight text-marca-950">Bienvenido al FSY</h2>
            <p className="mt-1.5 text-sm text-slate-500">
              {MARCA.nombre} · {MARCA.sesion}. Ingresa con tu correo o tu usuario.
            </p>
          </div>

          <FormularioLogin aviso={aviso} volver={volver} />

          <p className="mt-8 text-center text-xs text-slate-400 lg:text-left">
            Acceso restringido. Las cuentas las crea un administrador del sistema.
          </p>
        </div>
      </section>
    </main>
  );
}
