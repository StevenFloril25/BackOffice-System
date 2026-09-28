"use client";

import clsx from "clsx";
import { Loader2, LogOut, Menu, UserRound, X } from "lucide-react";
import Image from "next/image";
import { useLinkStatus } from "next/link";
import Link from "@/components/enlace";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { Icono } from "@/components/iconos";
import { Avatar } from "@/components/ui";
import { MARCA } from "@/lib/marca";
import type { SeccionMenu } from "@/lib/navegacion";

interface Usuario {
  nombre: string;
  email: string;
  rol: string;
  foto: string | null;
}

export function Estructura({ menu, usuario, children }: { menu: SeccionMenu[]; usuario: Usuario; children: ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  const ruta = usePathname();

  return (
    <div className="min-h-screen lg:pl-72 print:pl-0">
      {/* Barra superior en móvil */}
      <div className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200/80 bg-white/85 px-4 backdrop-blur lg:hidden print:hidden">
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="-ml-1 flex size-10 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100"
          aria-label="Abrir menú"
        >
          <Menu className="size-5" />
        </button>
        <Marca compacta />
      </div>

      {/* Fondo del menú móvil */}
      <div
        aria-hidden
        onClick={() => setAbierto(false)}
        className={clsx(
          "fixed inset-0 z-40 bg-marca-950/40 backdrop-blur-[2px] transition-opacity lg:hidden print:hidden",
          abierto ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col overflow-hidden bg-gradient-to-b from-marca-800 via-marca-900 to-marca-950 text-white transition-transform duration-200 lg:translate-x-0 print:hidden",
          abierto ? "translate-x-0 shadow-flotante" : "-translate-x-full",
        )}
      >

        <div className="relative flex h-20 items-center justify-between px-5">
          <Marca />
          <button
            type="button"
            onClick={() => setAbierto(false)}
            className="flex size-9 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 lg:hidden"
            aria-label="Cerrar menú"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav aria-label="Principal" className="barra-oscura relative flex-1 space-y-7 overflow-y-auto px-3 py-4">
          {menu.map((seccion) => (
            <div key={seccion.titulo}>
              <p className="mb-2 px-3 text-[0.68rem] font-semibold tracking-[0.12em] text-marca-300/70 uppercase">
                {seccion.titulo}
              </p>
              <ul className="space-y-1">
                {seccion.items.map((item) => {
                  const activo = ruta === item.href || ruta.startsWith(`${item.href}/`);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setAbierto(false)}
                        aria-current={activo ? "page" : undefined}
                        className={clsx(
                          "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                          activo ? "bg-white/12 text-white" : "text-marca-100/75 hover:bg-white/6 hover:text-white",
                        )}
                      >
                        {activo && <span aria-hidden className="absolute inset-y-2 -left-3 w-1 rounded-r-full bg-sol-400" />}
                        <Icono
                          nombre={item.icono}
                          className={clsx("size-[1.15rem]", activo ? "text-sol-400" : "text-marca-300/80 group-hover:text-marca-200")}
                        />
                        <span className="min-w-0 flex-1">{item.etiqueta}</span>
                        <Cargando />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="relative border-t border-white/10 p-3">
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <Avatar texto={usuario.nombre || usuario.email} tamano="sm" src={usuario.foto} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{usuario.nombre || usuario.email}</p>
              <p className="truncate text-xs text-marca-300/80">{usuario.rol}</p>
            </div>
          </div>
          <div className="mt-1 grid grid-cols-2 gap-1">
            <Link
              href="/cuenta"
              onClick={() => setAbierto(false)}
              className="flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-marca-100/80 hover:bg-white/8 hover:text-white"
            >
              <UserRound className="size-3.5" aria-hidden />
              Mi cuenta
            </Link>
            <form action="/salir" method="post">
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-marca-100/80 hover:bg-white/8 hover:text-white"
              >
                <LogOut className="size-3.5" aria-hidden />
                Salir
              </button>
            </form>
          </div>
        </div>
      </aside>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-8 sm:py-10 print:max-w-none print:p-0">{children}</main>
    </div>
  );
}

function Marca({ compacta = false }: { compacta?: boolean }) {
  return (
    <Link href="/inicio" className="flex items-center gap-3">
      <Image
        src="/brand/logo.webp"
        alt=""
        width={40}
        height={40}
        className={clsx("rounded-xl ring-1", compacta ? "size-9 ring-slate-200" : "size-10 ring-white/25 shadow-lg shadow-marca-950/30")}
        priority
      />
      <span className="leading-tight">
        <span className={clsx("block text-sm font-bold", compacta ? "text-marca-950" : "text-white")}>{MARCA.nombre}</span>
        <span className={clsx("block text-xs", compacta ? "text-slate-500" : "text-marca-300/80")}>{MARCA.sesion}</span>
      </span>
    </Link>
  );
}

/**
 * Señal de "cargando" en el enlace del menú que se tocó. El panel no tiene
 * loading.tsx (ver (panel)/layout.tsx): mientras llega la página nueva se ve la
 * anterior, y esto avisa que el toque sí se registró.
 */
function Cargando() {
  const { pending } = useLinkStatus();
  return pending ? <Loader2 aria-hidden className="size-3.5 shrink-0 animate-spin text-marca-200" /> : null;
}
