"use client";

import { useActionState, useEffect } from "react";

import { BotonEnviar, Dialogo } from "@/components/cliente";
import { Alerta, Boton, Campo } from "@/components/ui";
import type { BarrioResumen } from "@/lib/participantes";
import { guardarBarrio } from "./actions";

export interface BarrioEditable {
  id: string;
  estaca: string;
  nombre: string;
  obispo_nombre: string;
  obispo_correo: string | null;
  obispo_telefono: string | null;
}

/**
 * Modal para crear o editar un barrio con los datos de su obispo. Se usa en
 * la página de barrios y dentro del formulario de participante ("+ Nuevo
 * barrio"), para no tener que salir a mitad de un registro.
 */
export function DialogoBarrio({
  abierto,
  alCerrar,
  barrio,
  estacas,
  alGuardar,
}: {
  abierto: boolean;
  alCerrar: () => void;
  barrio?: BarrioEditable | null;
  estacas: string[];
  alGuardar?: (b: BarrioResumen) => void;
}) {
  return (
    <Dialogo
      abierto={abierto}
      alCerrar={alCerrar}
      titulo={barrio ? `Editar ${barrio.nombre}` : "Nuevo barrio"}
      descripcion="El obispo es el contacto del barrio para la conferencia."
      ancho="max-w-lg"
    >
      {/* key: el formulario se monta limpio cada vez que se abre */}
      <Formulario key={barrio?.id ?? "nuevo"} barrio={barrio ?? null} estacas={estacas} alCerrar={alCerrar} alGuardar={alGuardar} />
    </Dialogo>
  );
}

function Formulario({
  barrio,
  estacas,
  alCerrar,
  alGuardar,
}: {
  barrio: BarrioEditable | null;
  estacas: string[];
  alCerrar: () => void;
  alGuardar?: (b: BarrioResumen) => void;
}) {
  const [estado, accion] = useActionState(guardarBarrio.bind(null, barrio?.id ?? null), undefined);
  const err = estado?.errores ?? {};
  const val = estado?.valores ?? {
    estaca: barrio?.estaca ?? estacas[0] ?? "",
    nombre: barrio?.nombre ?? "",
    obispo_nombre: barrio?.obispo_nombre ?? "",
    obispo_correo: barrio?.obispo_correo ?? "",
    obispo_telefono: barrio?.obispo_telefono ?? "",
  };

  useEffect(() => {
    if (estado?.barrio) {
      alGuardar?.(estado.barrio);
      alCerrar();
    }
  }, [estado, alGuardar, alCerrar]);

  return (
    <form action={accion} className="space-y-4">
      {estado?.error && <Alerta tipo="error">{estado.error}</Alerta>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Estaca o distrito" htmlFor="estaca" error={err.estaca}>
          <input id="estaca" name="estaca" list="lista-estacas" defaultValue={val.estaca} className="entrada" />
          <datalist id="lista-estacas">
            {estacas.map((e) => (
              <option key={e} value={e} />
            ))}
          </datalist>
        </Campo>
        <Campo etiqueta="Barrio o rama" htmlFor="nombre" error={err.nombre}>
          <input id="nombre" name="nombre" required defaultValue={val.nombre} className="entrada" placeholder="Ej. Eden Ward" />
        </Campo>
      </div>

      <div className="rounded-xl border border-slate-200 p-4">
        <p className="mb-3 text-sm font-semibold text-slate-700">Obispo o presidente de rama</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Nombre" htmlFor="obispo_nombre" error={err.obispo_nombre} className="sm:col-span-2">
            <input id="obispo_nombre" name="obispo_nombre" defaultValue={val.obispo_nombre} className="entrada" />
          </Campo>
          <Campo etiqueta="Correo" htmlFor="obispo_correo" error={err.obispo_correo}>
            <input id="obispo_correo" name="obispo_correo" type="email" defaultValue={val.obispo_correo} className="entrada" />
          </Campo>
          <Campo etiqueta="Teléfono" htmlFor="obispo_telefono" error={err.obispo_telefono}>
            <input id="obispo_telefono" name="obispo_telefono" type="tel" defaultValue={val.obispo_telefono} className="entrada" />
          </Campo>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Boton type="button" variante="secundario" onClick={alCerrar}>
          Cancelar
        </Boton>
        <BotonEnviar pendiente="Guardando…">{barrio ? "Guardar cambios" : "Crear barrio"}</BotonEnviar>
      </div>
    </form>
  );
}
