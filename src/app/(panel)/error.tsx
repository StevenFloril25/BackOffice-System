"use client";

import { AlertTriangle } from "lucide-react";

import { Boton, EstadoVacio, Tarjeta } from "@/components/ui";

export default function ErrorPanel({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Tarjeta className="mx-auto mt-10 max-w-lg">
      <EstadoVacio
        icono={<AlertTriangle className="size-5" />}
        titulo="Algo salió mal al cargar esta sección"
        descripcion={
          error.digest
            ? `Si vuelve a pasar, comparte este código con soporte: ${error.digest}`
            : "Intenta de nuevo en unos segundos."
        }
        accion={<Boton onClick={reset}>Reintentar</Boton>}
      />
    </Tarjeta>
  );
}
