"use client";

import { Plus } from "lucide-react";
import { useActionState, useMemo, useState } from "react";

import { BotonEnviar, ResultadoEnvio } from "@/components/cliente";
import { Campo, EncabezadoTarjeta, Tarjeta } from "@/components/ui";
import { TALLAS, type BarrioResumen } from "@/lib/participantes-comun";
import { DialogoBarrio } from "../barrios/dialogo-barrio";
import { actualizarConsejero, crearConsejero, type EstadoConsejero } from "./actions";

interface Props {
  id: string | null;
  inicial: Record<string, string>;
  barrios: BarrioResumen[];
  editable: boolean;
  puedeCrearBarrio: boolean;
}

export function FormularioConsejero({ id, inicial, barrios: barriosIniciales, editable, puedeCrearBarrio }: Props) {
  const accionBase = id ? actualizarConsejero.bind(null, id) : crearConsejero;
  const [estado, accion] = useActionState<EstadoConsejero | undefined, FormData>(accionBase, undefined);
  const err = estado?.errores ?? {};
  const val = estado?.valores ?? inicial;

  const [barrios, setBarrios] = useState(barriosIniciales);
  const [barrioId, setBarrioId] = useState(val.barrio_id ?? "");
  const [dialogo, setDialogo] = useState(false);

  const porEstaca = useMemo(() => {
    const m = new Map<string, BarrioResumen[]>();
    for (const b of barrios) m.set(b.estaca || "Sin estaca", [...(m.get(b.estaca || "Sin estaca") ?? []), b]);
    return [...m.entries()];
  }, [barrios]);
  const estacas = useMemo(() => [...new Set(barrios.map((b) => b.estaca).filter(Boolean))], [barrios]);

  return (
    <>
      {/* noValidate: el servidor valida y explica junto a cada campo (ver participantes). */}
      <form action={accion} noValidate className="space-y-6">
        <fieldset disabled={!editable} className="space-y-6">
          <Tarjeta>
            <EncabezadoTarjeta titulo="Datos personales" />
            <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
              <Campo etiqueta="Nombres" htmlFor="nombres" error={err.nombres}>
                <input id="nombres" name="nombres" defaultValue={val.nombres} className="entrada" autoComplete="off" />
              </Campo>
              <Campo etiqueta="Apellidos" htmlFor="apellidos" error={err.apellidos}>
                <input id="apellidos" name="apellidos" defaultValue={val.apellidos} className="entrada" autoComplete="off" />
              </Campo>
              <Campo
                etiqueta="Es"
                htmlFor="sexo"
                error={err.sexo}
                ayuda="Decide si ocupa el lugar de consejero o de consejera en su compañía, y en qué ala duerme."
              >
                <select id="sexo" name="sexo" defaultValue={val.sexo ?? ""} className="entrada">
                  <option value="" disabled>
                    Elige…
                  </option>
                  <option value="Hombre">Consejero (hombre)</option>
                  <option value="Mujer">Consejera (mujer)</option>
                </select>
              </Campo>
              <Campo etiqueta="Fecha de nacimiento" htmlFor="fecha_nacimiento" error={err.fecha_nacimiento}>
                <input id="fecha_nacimiento" name="fecha_nacimiento" type="date" defaultValue={val.fecha_nacimiento} className="entrada" />
              </Campo>
              <Campo etiqueta="Teléfono" htmlFor="telefono" error={err.telefono}>
                <input id="telefono" name="telefono" type="tel" defaultValue={val.telefono} className="entrada" />
              </Campo>
              <Campo etiqueta="Correo" htmlFor="correo" error={err.correo}>
                <input id="correo" name="correo" type="email" defaultValue={val.correo} className="entrada" />
              </Campo>
              <Campo etiqueta="Talla de camiseta" htmlFor="talla_camiseta" error={err.talla_camiseta}>
                <select id="talla_camiseta" name="talla_camiseta" defaultValue={val.talla_camiseta ?? ""} className="entrada">
                  <option value="">Sin indicar</option>
                  {[...new Set([...TALLAS, ...(val.talla_camiseta ? [val.talla_camiseta] : [])])].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo etiqueta="Barrio" htmlFor="barrio_id" error={err.barrio_id} ayuda="Opcional: puede venir de otra estaca.">
                <div className="flex gap-2">
                  <select
                    id="barrio_id"
                    name="barrio_id"
                    value={barrioId}
                    onChange={(e) => setBarrioId(e.target.value)}
                    className="entrada"
                  >
                    <option value="">Sin barrio de la sesión</option>
                    {porEstaca.map(([estaca, lista]) => (
                      <optgroup key={estaca} label={estaca}>
                        {lista.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.nombre}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  {puedeCrearBarrio && editable && (
                    <button
                      type="button"
                      onClick={() => setDialogo(true)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-dashed border-marca-300 px-3 text-sm font-semibold text-marca-700 hover:bg-marca-50"
                      title="Crear un barrio nuevo"
                    >
                      <Plus className="size-4" aria-hidden />
                      <span className="hidden sm:inline">Nuevo</span>
                    </button>
                  )}
                </div>
              </Campo>
            </div>
          </Tarjeta>

          <Tarjeta>
            <EncabezadoTarjeta titulo="Contacto de emergencia" />
            <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
              <Campo etiqueta="Nombre" htmlFor="contacto_emergencia_nombre" error={err.contacto_emergencia_nombre}>
                <input
                  id="contacto_emergencia_nombre"
                  name="contacto_emergencia_nombre"
                  defaultValue={val.contacto_emergencia_nombre}
                  className="entrada"
                />
              </Campo>
              <Campo etiqueta="Teléfono" htmlFor="contacto_emergencia_telefono" error={err.contacto_emergencia_telefono}>
                <input
                  id="contacto_emergencia_telefono"
                  name="contacto_emergencia_telefono"
                  type="tel"
                  defaultValue={val.contacto_emergencia_telefono}
                  className="entrada"
                />
              </Campo>
              <Campo etiqueta="Notas" htmlFor="notas" error={err.notas} className="sm:col-span-2" ayuda="Experiencia, alergias o lo que convenga saber.">
                <textarea id="notas" name="notas" rows={3} defaultValue={val.notas} className="entrada resize-y" />
              </Campo>
            </div>
          </Tarjeta>
        </fieldset>

        {editable && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <ResultadoEnvio estado={estado} />
            <BotonEnviar pendiente="Guardando…" className="shrink-0">
              {id ? "Guardar cambios" : "Registrar consejero"}
            </BotonEnviar>
          </div>
        )}
      </form>

      <DialogoBarrio
        abierto={dialogo}
        alCerrar={() => setDialogo(false)}
        estacas={estacas}
        alGuardar={(b) => {
          setBarrios((lista) => [...lista.filter((x) => x.id !== b.id), b].sort((x, y) => x.nombre.localeCompare(y.nombre)));
          setBarrioId(b.id);
        }}
      />
    </>
  );
}
