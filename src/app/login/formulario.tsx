"use client";

import { UserRound } from "lucide-react";
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

      <Campo etiqueta="Correo o usuario" htmlFor="identificador">
        <div className="relative">
          <UserRound className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            id="identificador"
            name="identificador"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            autoFocus
            defaultValue={estado?.identificador}
            placeholder="nombre@correo.com o tu usuario"
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
