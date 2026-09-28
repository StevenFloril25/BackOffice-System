"use client";

import { Trash2 } from "lucide-react";
import { useActionState, useState } from "react";

import { BotonEnviar, Dialogo } from "@/components/cliente";
import { Alerta, Boton, EncabezadoTarjeta, Tarjeta } from "@/components/ui";
import { plural } from "@/lib/utilidades";
import { eliminarRol } from "../actions";

export function EliminarRol({ id, nombre, usuarios }: { id: string; nombre: string; usuarios: number }) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion] = useActionState(eliminarRol.bind(null, id), undefined);
  const bloqueado = usuarios > 0;

  return (
    <Tarjeta className="h-fit border-red-100">
      <EncabezadoTarjeta titulo="Eliminar rol" />
      <div className="space-y-4 p-5 sm:p-6">
        <p className="text-sm text-slate-500">
          {bloqueado
            ? `Tiene ${plural(usuarios, "usuario asignado", "usuarios asignados")}. Reasígnalos a otro rol antes de eliminarlo.`
            : "Nadie tiene este rol. Puedes eliminarlo sin afectar a ninguna cuenta."}
        </p>
        <Boton variante="peligro" disabled={bloqueado} onClick={() => setAbierto(true)} className="w-full">
          <Trash2 className="size-4" aria-hidden />
          Eliminar rol
        </Boton>
      </div>

      <Dialogo abierto={abierto} alCerrar={() => setAbierto(false)} titulo={`¿Eliminar el rol «${nombre}»?`}>
        <form action={accion} className="space-y-5">
          <p className="text-sm text-slate-500">Se borra junto con su configuración de permisos. No se puede deshacer.</p>
          {estado?.error && <Alerta tipo="error">{estado.error}</Alerta>}
          <div className="flex justify-end gap-2">
            <Boton type="button" variante="secundario" onClick={() => setAbierto(false)}>
              Cancelar
            </Boton>
            <BotonEnviar variante="peligro" pendiente="Eliminando…">
              Eliminar
            </BotonEnviar>
          </div>
        </form>
      </Dialogo>
    </Tarjeta>
  );
}
