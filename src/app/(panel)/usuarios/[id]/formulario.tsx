"use client";

import { useActionState } from "react";

import { BotonEnviar } from "@/components/cliente";
import { Alerta, Campo } from "@/components/ui";
import type { RolOpcion, UsuarioFila } from "@/lib/usuarios";
import { actualizarUsuario } from "../actions";

export function FormularioEditarUsuario({
  usuario,
  roles,
  editable,
}: {
  usuario: UsuarioFila;
  roles: RolOpcion[];
  editable: boolean;
}) {
  const [estado, accion] = useActionState(actualizarUsuario.bind(null, usuario.id), undefined);
  const err = estado?.errores ?? {};
  // Tras un error se muestra lo que se escribió; si no, lo guardado.
  const val = estado?.valores ?? {
    full_name: usuario.full_name,
    email: usuario.email,
    username: usuario.username ?? "",
    phone: usuario.phone ?? "",
    role_id: usuario.role_id ?? "",
  };

  return (
    <form action={accion}>
      <fieldset disabled={!editable} className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
        {estado?.error && (
          <div className="sm:col-span-2">
            <Alerta tipo="error">{estado.error}</Alerta>
          </div>
        )}
        {estado?.ok && (
          <div className="sm:col-span-2">
            <Alerta tipo="exito">{estado.ok}</Alerta>
          </div>
        )}
        <Campo etiqueta="Nombre completo" htmlFor="full_name" error={err.full_name} className="sm:col-span-2">
          <input id="full_name" name="full_name" required defaultValue={val.full_name} className="entrada" />
        </Campo>
        <Campo etiqueta="Correo electrónico" htmlFor="email" error={err.email} ayuda="Si lo cambias, ingresará con el nuevo.">
          <input id="email" name="email" type="email" required defaultValue={val.email} className="entrada" />
        </Campo>
        <Campo etiqueta="Usuario" htmlFor="username" error={err.username} ayuda="Para ingresar sin correo.">
          <input
            id="username"
            name="username"
            defaultValue={val.username}
            autoCapitalize="none"
            spellCheck={false}
            className="entrada"
          />
        </Campo>
        <Campo etiqueta="Teléfono" htmlFor="phone" error={err.phone}>
          <input id="phone" name="phone" type="tel" defaultValue={val.phone} className="entrada" />
        </Campo>
        <Campo etiqueta="Rol" htmlFor="role_id" error={err.role_id}>
          <select id="role_id" name="role_id" required defaultValue={val.role_id} className="entrada">
            <option value="" disabled>
              Sin rol — elige uno…
            </option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </Campo>
      </fieldset>
      {editable && (
        <div className="flex justify-end border-t border-slate-100 px-5 py-4 sm:px-6">
          <BotonEnviar pendiente="Guardando…">Guardar cambios</BotonEnviar>
        </div>
      )}
    </form>
  );
}
