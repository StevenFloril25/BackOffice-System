"use client";

import clsx from "clsx";
import { Loader2 } from "lucide-react";
import { useLinkStatus } from "next/link";

/**
 * Señal de "cargando" dentro de un <Link>, mientras llega la página a la que
 * lleva. El panel no tiene loading.tsx (ver (panel)/layout.tsx): sin esto, al
 * tocar un botón que lleva a otra página no pasa nada visible durante ese
 * segundo y parece que el toque no se registró.
 */
export function CargaEnlace({ className }: { className?: string }) {
  const { pending } = useLinkStatus();
  return pending ? <Loader2 aria-hidden className={clsx("shrink-0 animate-spin", className)} /> : null;
}

/** El círculo de una opción (OpcionEnlace): mientras carga la opción elegida, gira. */
export function MarcaOpcion({ activa }: { activa: boolean }) {
  const { pending } = useLinkStatus();
  if (pending) return <Loader2 aria-hidden className="mt-0.5 size-4 shrink-0 animate-spin text-marca-600" />;
  return (
    <span
      aria-hidden
      className={clsx(
        "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
        activa ? "border-marca-600 bg-marca-600" : "border-slate-300 bg-white",
      )}
    >
      {activa && <span className="size-1.5 rounded-full bg-white" />}
    </span>
  );
}
