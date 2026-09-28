"use client";

import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import { Dialogo } from "@/components/cliente";
import { EditorFoto } from "@/components/foto";
import { Alerta, Boton, EncabezadoTarjeta, Tarjeta } from "@/components/ui";
import { eliminarConsejero, quitarFotoConsejero, subirFotoConsejero } from "../actions";

export function FotoConsejero({ id, url, texto, editable }: { id: string; url: string | null; texto: string; editable: boolean }) {
  return (
    <EditorFoto
      url={url}
      texto={texto}
      forma="carnet"
      editable={editable}
      subir={(datos) => subirFotoConsejero(id, datos)}
      quitar={() => quitarFotoConsejero(id)}
    />
  );
}

export function EliminarConsejero({ id, nombre, asignado }: { id: string; nombre: string; asignado: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <Tarjeta className="border-red-100">
      <EncabezadoTarjeta titulo="Eliminar" />
      <div className="space-y-3 p-5 sm:p-6">
        <p className="text-sm text-slate-500">
          Borra la ficha y su foto.{asignado && " Su lugar en la compañía y su cama quedan libres."}
        </p>
        <Boton variante="peligro" tamano="sm" className="w-full" onClick={() => setAbierto(true)}>
          <Trash2 className="size-3.5" aria-hidden />
          Eliminar consejero
        </Boton>
      </div>
      <Dialogo abierto={abierto} alCerrar={() => setAbierto(false)} titulo={`¿Eliminar a ${nombre}?`}>
        {error && <Alerta tipo="error">{error}</Alerta>}
        <p className="text-sm text-slate-500">No se puede deshacer.</p>
        <div className="mt-5 flex justify-end gap-2">
          <Boton variante="secundario" onClick={() => setAbierto(false)}>
            Cancelar
          </Boton>
          <Boton
            variante="peligro"
            disabled={pendiente}
            onClick={() =>
              iniciar(async () => {
                const r = await eliminarConsejero(id);
                if (r?.error) setError(r.error);
              })
            }
          >
            {pendiente ? "Eliminando…" : "Eliminar"}
          </Boton>
        </div>
      </Dialogo>
    </Tarjeta>
  );
}
