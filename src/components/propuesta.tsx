"use client";

import { Check, Loader2 } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";

import { Dialogo } from "@/components/cliente";
import { Alerta, Boton } from "@/components/ui";

/**
 * Botón para aplicar una propuesta automática (reparto en compañías, acomodo en
 * habitaciones), con confirmación. La acción redirige al terminar bien; si
 * vuelve con error, se muestra aquí mismo.
 */
export function AplicarPropuesta({
  aplicar,
  etiqueta,
  titulo,
  descripcion,
  deshabilitado,
}: {
  aplicar: () => Promise<{ error?: string } | undefined>;
  etiqueta: string;
  titulo: string;
  descripcion: ReactNode;
  deshabilitado?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  return (
    <>
      <Boton
        onClick={() => {
          setError(null);
          setAbierto(true);
        }}
        disabled={deshabilitado}
      >
        <Check className="size-4" aria-hidden />
        {etiqueta}
      </Boton>
      <Dialogo abierto={abierto} alCerrar={() => !pendiente && setAbierto(false)} titulo={titulo} descripcion={descripcion}>
        <div className="space-y-4">
          {error && <Alerta tipo="error">{error}</Alerta>}
          <div className="flex justify-end gap-2">
            <Boton type="button" variante="secundario" onClick={() => setAbierto(false)} disabled={pendiente}>
              Cancelar
            </Boton>
            <Boton
              type="button"
              disabled={pendiente}
              aria-busy={pendiente}
              onClick={() =>
                iniciar(async () => {
                  const r = await aplicar();
                  if (r?.error) setError(r.error);
                })
              }
            >
              {pendiente && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {pendiente ? "Aplicando…" : "Sí, aplicar"}
            </Boton>
          </div>
        </div>
      </Dialogo>
    </>
  );
}
