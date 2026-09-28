"use client";

import { HeartPulse, Plus } from "lucide-react";
import { useActionState, useMemo, useState } from "react";

import { BotonEnviar } from "@/components/cliente";
import { Alerta, Campo, EncabezadoTarjeta, Tarjeta } from "@/components/ui";
import { CAMPOS_SALUD, ESTADOS_INSCRIPCION, TALLAS, type BarrioResumen } from "@/lib/participantes-comun";
import { DialogoBarrio } from "../barrios/dialogo-barrio";
import { actualizarParticipante, crearParticipante, type EstadoParticipante } from "./actions";

export type ValoresParticipante = Record<string, string>;

interface Props {
  id: string | null;
  inicial: ValoresParticipante;
  barrios: BarrioResumen[];
  editable: boolean;
  verSalud: boolean;
  puedeCrearBarrio: boolean;
}

export function FormularioParticipante({ id, inicial, barrios: barriosIniciales, editable, verSalud, puedeCrearBarrio }: Props) {
  const accionBase = id ? actualizarParticipante.bind(null, id) : crearParticipante;
  const [estado, accion] = useActionState<EstadoParticipante | undefined, FormData>(accionBase, undefined);
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
      <form action={accion} className="space-y-6">
        {estado?.error && <Alerta tipo="error">{estado.error}</Alerta>}
        {estado?.ok && <Alerta tipo="exito">{estado.ok}</Alerta>}

        <fieldset disabled={!editable} className="space-y-6">
          <Tarjeta>
            <EncabezadoTarjeta titulo="Datos personales" />
            <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
              <Campo etiqueta="Nombres" htmlFor="nombres" error={err.nombres}>
                <input id="nombres" name="nombres" required defaultValue={val.nombres} className="entrada" />
              </Campo>
              <Campo etiqueta="Apellidos" htmlFor="apellidos" error={err.apellidos}>
                <input id="apellidos" name="apellidos" required defaultValue={val.apellidos} className="entrada" />
              </Campo>
              <Campo etiqueta="Nombre que prefiere" htmlFor="nombre_preferido" error={err.nombre_preferido} className="sm:col-span-2">
                <input id="nombre_preferido" name="nombre_preferido" defaultValue={val.nombre_preferido} className="entrada" />
              </Campo>
              <Campo etiqueta="Fecha de nacimiento" htmlFor="fecha_nacimiento" error={err.fecha_nacimiento}>
                <input id="fecha_nacimiento" name="fecha_nacimiento" type="date" defaultValue={val.fecha_nacimiento} className="entrada" />
              </Campo>
              <Campo etiqueta="Sexo" htmlFor="sexo" error={err.sexo}>
                <select id="sexo" name="sexo" defaultValue={val.sexo} className="entrada">
                  <option value="">Sin indicar</option>
                  <option value="Mujer">Mujer</option>
                  <option value="Hombre">Hombre</option>
                </select>
              </Campo>
              <Campo etiqueta="Teléfono" htmlFor="telefono" error={err.telefono}>
                <input id="telefono" name="telefono" type="tel" defaultValue={val.telefono} className="entrada" />
              </Campo>
              <Campo etiqueta="Correo" htmlFor="correo" error={err.correo}>
                <input id="correo" name="correo" type="email" defaultValue={val.correo} className="entrada" />
              </Campo>
              <Campo etiqueta="Talla de camiseta" htmlFor="talla_camiseta" error={err.talla_camiseta}>
                <select id="talla_camiseta" name="talla_camiseta" defaultValue={val.talla_camiseta} className="entrada">
                  <option value="">Sin indicar</option>
                  {[...new Set([...TALLAS, ...(val.talla_camiseta ? [val.talla_camiseta] : [])])].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Campo>
            </div>
          </Tarjeta>

          <Tarjeta>
            <EncabezadoTarjeta titulo="Barrio e inscripción" />
            <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
              <Campo etiqueta="Barrio o rama" htmlFor="barrio_id" error={err.barrio_id}>
                <div className="flex gap-2">
                  <select
                    id="barrio_id"
                    name="barrio_id"
                    required
                    value={barrioId}
                    onChange={(e) => setBarrioId(e.target.value)}
                    className="entrada"
                  >
                    <option value="" disabled>
                      Elige el barrio…
                    </option>
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
              <Campo etiqueta="Estado de la inscripción" htmlFor="estado_inscripcion" error={err.estado_inscripcion}>
                <select id="estado_inscripcion" name="estado_inscripcion" defaultValue={val.estado_inscripcion} className="entrada">
                  {ESTADOS_INSCRIPCION.map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </select>
              </Campo>
            </div>
          </Tarjeta>

          <Tarjeta>
            <EncabezadoTarjeta titulo="Contactos de emergencia" descripcion="Padres o tutores." />
            <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-2">
              {[1, 2].map((n) => (
                <div key={n} className="space-y-4">
                  <p className="text-sm font-semibold text-slate-700">Contacto {n}</p>
                  <Campo etiqueta="Nombre" htmlFor={`contacto${n}_nombre`} error={err[`contacto${n}_nombre`]}>
                    <input id={`contacto${n}_nombre`} name={`contacto${n}_nombre`} defaultValue={val[`contacto${n}_nombre`]} className="entrada" />
                  </Campo>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Campo etiqueta="Teléfono" htmlFor={`contacto${n}_telefono`} error={err[`contacto${n}_telefono`]}>
                      <input
                        id={`contacto${n}_telefono`}
                        name={`contacto${n}_telefono`}
                        type="tel"
                        defaultValue={val[`contacto${n}_telefono`]}
                        className="entrada"
                      />
                    </Campo>
                    <Campo etiqueta="Correo" htmlFor={`contacto${n}_correo`} error={err[`contacto${n}_correo`]}>
                      <input
                        id={`contacto${n}_correo`}
                        name={`contacto${n}_correo`}
                        type="email"
                        defaultValue={val[`contacto${n}_correo`]}
                        className="entrada"
                      />
                    </Campo>
                  </div>
                </div>
              ))}
            </div>
          </Tarjeta>

          {verSalud && (
            <Tarjeta>
              <EncabezadoTarjeta
                titulo={
                  <span className="flex items-center gap-2">
                    <HeartPulse className="size-4 text-red-500" aria-hidden />
                    Salud
                  </span>
                }
                descripcion="Información médica confidencial. Solo la ve quien tiene el permiso de datos médicos."
              />
              <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
                {CAMPOS_SALUD.map((c) => (
                  <Campo
                    key={c.clave}
                    etiqueta={c.etiqueta}
                    htmlFor={c.clave}
                    className={c.clave === "informacion_medica" || c.clave === "tratamiento_medico" ? "sm:col-span-2" : undefined}
                  >
                    <textarea id={c.clave} name={c.clave} rows={2} defaultValue={val[c.clave]} className="entrada resize-y" />
                  </Campo>
                ))}
              </div>
            </Tarjeta>
          )}
        </fieldset>

        {editable && (
          <div className="flex justify-end">
            <BotonEnviar pendiente="Guardando…">{id ? "Guardar cambios" : "Registrar participante"}</BotonEnviar>
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
