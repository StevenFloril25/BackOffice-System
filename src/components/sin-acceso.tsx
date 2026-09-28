import { Lock } from "lucide-react";

import { EnlaceBoton, EstadoVacio, Tarjeta } from "@/components/ui";

/** Se muestra en lugar de la página cuando el rol no tiene el permiso. */
export function SinAcceso({ permiso }: { permiso: string }) {
  return (
    <Tarjeta className="mx-auto mt-10 max-w-lg">
      {/* Toda página necesita su título para lectores de pantalla. */}
      <h1 className="sr-only">Sin acceso</h1>
      <EstadoVacio
        icono={<Lock className="size-5" />}
        titulo="No tienes acceso a esta sección"
        descripcion={`Tu rol no incluye el permiso "${permiso}". Si lo necesitas, pídeselo a un administrador.`}
        accion={
          <EnlaceBoton href="/inicio" variante="secundario">
            Volver al inicio
          </EnlaceBoton>
        }
      />
    </Tarjeta>
  );
}
