"use client";

import { CheckCircle2, Plus } from "lucide-react";
import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

import { BotonEnviar, CopiarTexto, ResultadoEnvio, Seleccion } from "@/components/cliente";
import { Campo, EncabezadoTarjeta, Tarjeta, claseBoton } from "@/components/ui";
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

/** "Registrar otro" cambia la key y monta un formulario limpio. */
export function FormularioConsejero(props: Props) {
  const [vuelta, setVuelta] = useState(0);
  return <Formulario key={vuelta} {...props} alRegistrarOtro={() => setVuelta((n) => n + 1)} />;
}

function Formulario({
  id,
  inicial,
  barrios: barriosIniciales,
  editable,
  puedeCrearBarrio,
  alRegistrarOtro,
}: Props & { alRegistrarOtro: () => void }) {
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

  if (!id && estado?.ok && estado.id) {
    return <RegistroListo estado={estado} alRegistrarOtro={alRegistrarOtro} />;
  }

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
              <Campo etiqueta="Sexo" htmlFor="sexo" error={err.sexo} ayuda="Define su lugar en la compañía y el edificio donde duerme.">
                <Seleccion id="sexo" name="sexo" defaultValue={val.sexo ?? ""} className="entrada">
                  <option value="" disabled>
                    Elige…
                  </option>
                  <option value="Hombre">Hombre</option>
                  <option value="Mujer">Mujer</option>
                </Seleccion>
              </Campo>
              <Campo etiqueta="Fecha de nacimiento" htmlFor="fecha_nacimiento" error={err.fecha_nacimiento}>
                <input id="fecha_nacimiento" name="fecha_nacimiento" type="date" defaultValue={val.fecha_nacimiento} className="entrada" />
              </Campo>
              <Campo etiqueta="Teléfono" htmlFor="telefono" error={err.telefono}>
                <input id="telefono" name="telefono" type="tel" defaultValue={val.telefono} className="entrada" />
              </Campo>
              <Campo
                etiqueta="Correo"
                htmlFor="correo"
                error={err.correo}
                ayuda={id ? "Es también el correo con el que ingresa al sistema." : "Con este correo se le crea su cuenta, con el rol Consejero."}
              >
                <input id="correo" name="correo" type="email" autoComplete="off" defaultValue={val.correo} className="entrada" />
              </Campo>
              <Campo etiqueta="Talla de camiseta" htmlFor="talla_camiseta" error={err.talla_camiseta}>
                <Seleccion id="talla_camiseta" name="talla_camiseta" defaultValue={val.talla_camiseta ?? ""} className="entrada">
                  <option value="">Sin indicar</option>
                  {[...new Set([...TALLAS, ...(val.talla_camiseta ? [val.talla_camiseta] : [])])].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Seleccion>
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

/** Datos de acceso del consejero recién registrado: se ven UNA vez. */
function RegistroListo({ estado, alRegistrarOtro }: { estado: EstadoConsejero; alRegistrarOtro: () => void }) {
  return (
    <Tarjeta className="animar-entrada max-w-2xl">
      <div className="p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-hoja-100 text-hoja-700">
            <CheckCircle2 className="size-6" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-marca-950">Consejero registrado</h2>
            <p className="text-sm text-slate-500">
              {estado.vinculada
                ? "Ya tenía cuenta con ese correo: se vinculó a su ficha. Ingresa con su contraseña de siempre."
                : "Se le creó su cuenta con el rol Consejero. Entrégale estos datos por un canal privado."}
            </p>
          </div>
        </div>
        <DatosAcceso email={estado.email} usuario={estado.usuario} clave={estado.clave} />
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href={`/consejeros/${estado.id}`} className={claseBoton("primario")}>
            Ver su ficha
          </Link>
          <button type="button" onClick={alRegistrarOtro} className={claseBoton("secundario")}>
            Registrar otro
          </button>
        </div>
      </div>
    </Tarjeta>
  );
}

export function DatosAcceso({ email, usuario, clave }: { email?: string; usuario?: string; clave?: string }) {
  return (
    <dl className="mt-6 space-y-4">
      {email && (
        <div>
          <dt className="mb-1.5 text-sm font-medium text-slate-700">Correo</dt>
          <dd>
            <CopiarTexto texto={email} />
          </dd>
        </div>
      )}
      {usuario && (
        <div>
          <dt className="mb-1.5 text-sm font-medium text-slate-700">Usuario (también sirve para ingresar)</dt>
          <dd>
            <CopiarTexto texto={usuario} />
          </dd>
        </div>
      )}
      {clave && (
        <div>
          <dt className="mb-1.5 text-sm font-medium text-slate-700">Contraseña temporal</dt>
          <dd>
            <CopiarTexto texto={clave} />
          </dd>
          <p className="mt-1.5 text-xs text-slate-500">Al ingresar por primera vez se le pide cambiarla. No se vuelve a mostrar.</p>
        </div>
      )}
    </dl>
  );
}
