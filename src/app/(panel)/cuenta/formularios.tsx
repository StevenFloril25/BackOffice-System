"use client";

import { useActionState } from "react";

import { BotonEnviar, EntradaClave, ResultadoEnvio } from "@/components/cliente";
import { Campo } from "@/components/ui";
import { cambiarClave, guardarPerfil } from "./actions";

export function FormularioPerfil({ nombre, telefono }: { nombre: string; telefono: string }) {
  const [estado, accion] = useActionState(guardarPerfil, undefined);
  return (
    <form action={accion}>
      <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
        <Campo etiqueta="Nombre completo" htmlFor="full_name">
          <input id="full_name" name="full_name" required defaultValue={nombre} className="entrada" />
        </Campo>
        <Campo etiqueta="Teléfono" htmlFor="phone" ayuda="Opcional.">
          <input id="phone" name="phone" type="tel" defaultValue={telefono} className="entrada" />
        </Campo>
      </div>
      <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6">
        <ResultadoEnvio estado={estado} />
        <BotonEnviar className="shrink-0" pendiente="Guardando…">Guardar</BotonEnviar>
      </div>
    </form>
  );
}

export function FormularioClave() {
  const [estado, accion] = useActionState(cambiarClave, undefined);
  return (
    <form action={accion}>
      <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
        <Campo etiqueta="Contraseña actual" htmlFor="actual" className="sm:col-span-2">
          <EntradaClave id="actual" name="actual" autoComplete="current-password" required />
        </Campo>
        <Campo etiqueta="Contraseña nueva" htmlFor="nueva" ayuda="Mínimo 8 caracteres, con letras y números.">
          <EntradaClave id="nueva" name="nueva" autoComplete="new-password" required minLength={8} />
        </Campo>
        <Campo etiqueta="Repite la nueva" htmlFor="repetida">
          <EntradaClave id="repetida" name="repetida" autoComplete="new-password" required minLength={8} />
        </Campo>
      </div>
      <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6">
        <ResultadoEnvio estado={estado} />
        <BotonEnviar className="shrink-0" pendiente="Cambiando…">Cambiar contraseña</BotonEnviar>
      </div>
    </form>
  );
}
