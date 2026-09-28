"use client";

import { useActionState } from "react";

import { BotonEnviar, EntradaClave } from "@/components/cliente";
import { Alerta, Campo } from "@/components/ui";
import { definirClave } from "./actions";

export function FormularioPrimerIngreso() {
  const [estado, accion] = useActionState(definirClave, undefined);

  return (
    <form action={accion} className="mt-7 space-y-5">
      {estado?.error && <Alerta tipo="error">{estado.error}</Alerta>}
      <Campo etiqueta="Contraseña nueva" htmlFor="nueva" ayuda="Mínimo 8 caracteres, con al menos una letra y un número.">
        <EntradaClave id="nueva" name="nueva" autoComplete="new-password" required minLength={8} autoFocus />
      </Campo>
      <Campo etiqueta="Repite la contraseña" htmlFor="repetida">
        <EntradaClave id="repetida" name="repetida" autoComplete="new-password" required minLength={8} />
      </Campo>
      <BotonEnviar className="w-full" pendiente="Guardando…">
        Guardar y continuar
      </BotonEnviar>
    </form>
  );
}
