"use client";

import { Mail } from "lucide-react";
import { useActionState } from "react";

import { BotonEnviar, EntradaClave } from "@/components/cliente";
import { Alerta, Campo } from "@/components/ui";
import { iniciarSesion } from "./actions";

export function FormularioLogin({ aviso, volver }: { aviso?: string; volver?: string }) {
  const [estado, accion] = useActionState(iniciarSesion, undefined);

  return (
    <form action={accion} className="space-y-5">
      {estado?.error ? <Alerta tipo="error">{estado.error}</Alerta> : aviso ? <Alerta tipo="aviso">{aviso}</Alerta> : null}

      <input type="hidden" name="volver" value={volver ?? ""} />

      <Campo etiqueta="Correo electrónico" htmlFor="email">
        <div className="relative">
          <Mail className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            autoFocus
            defaultValue={estado?.email}
            placeholder="nombre@correo.com"
            className="entrada pl-10"
          />
        </div>
      </Campo>

      <Campo etiqueta="Contraseña" htmlFor="password">
        <EntradaClave id="password" name="password" autoComplete="current-password" required placeholder="••••••••" />
      </Campo>

      <BotonEnviar className="w-full" pendiente="Ingresando…">
        Ingresar
      </BotonEnviar>
    </form>
  );
}
