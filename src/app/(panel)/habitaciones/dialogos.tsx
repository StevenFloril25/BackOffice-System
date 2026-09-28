"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useActionState, useCallback, useEffect, useState, useTransition } from "react";

import { AvisoBreve, BotonEnviar, Dialogo, Seleccion } from "@/components/cliente";
import { Alerta, Boton, Campo, claseBoton } from "@/components/ui";
import type { Sexo, TipoHabitacion } from "@/lib/organizacion-comun";
import {
  crearPiso,
  eliminarEdificio,
  eliminarPiso,
  guardarEdificio,
  guardarHabitacion,
  type EstadoHabitacion,
} from "./actions";

export interface EdificioEditable {
  id: string;
  nombre: string;
  sexo: Sexo;
  notas: string | null;
}

export interface HabitacionEditable {
  id: string;
  edificio_id: string;
  piso: number;
  nombre: string;
  tipo: TipoHabitacion;
  capacidad: number;
  notas: string | null;
}

export interface PisoResumen {
  piso: number;
  camas: number;
  ocupados: number;
}

type Aviso = { n: number; texto: string } | null;

export function useAviso() {
  const [aviso, setAviso] = useState<Aviso>(null);
  const avisar = useCallback((texto: string) => setAviso((a) => ({ n: (a?.n ?? 0) + 1, texto })), []);
  return [aviso, avisar] as const;
}

/** Cierra el diálogo y avisa cuando la acción salió bien. */
function useAlGuardar(estado: EstadoHabitacion | undefined, alCerrar: () => void, alGuardar?: (t: string) => void) {
  useEffect(() => {
    if (estado?.ok) {
      alGuardar?.(estado.ok);
      alCerrar();
    }
  }, [estado, alGuardar, alCerrar]);
}

// ---------------------------------------------------------------------------
// Botón de la página: nuevo edificio
// ---------------------------------------------------------------------------

export function AccionesHabitaciones({ puedeCrear }: { puedeCrear: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const [aviso, avisar] = useAviso();
  const cerrar = useCallback(() => setAbierto(false), []);
  if (!puedeCrear) return null;

  return (
    <>
      <Boton onClick={() => setAbierto(true)}>
        <Plus className="size-4" aria-hidden />
        Nuevo edificio
      </Boton>
      <Dialogo abierto={abierto} alCerrar={cerrar} titulo="Nuevo edificio" descripcion="Se arma con sus pisos: en cada uno, un dormitorio para jóvenes y una habitación para líderes.">
        <FormularioEdificio edificio={null} alCerrar={cerrar} alGuardar={avisar} />
      </Dialogo>
      {aviso && <AvisoBreve key={aviso.n} titulo={aviso.texto} />}
    </>
  );
}

// ---------------------------------------------------------------------------
// Encabezado de cada edificio: piso, habitación, editar
// ---------------------------------------------------------------------------

export function AccionesEdificio({
  edificio,
  edificios,
  pisos,
  puedeCrear,
  puedeEditar,
  puedeEliminar,
}: {
  edificio: EdificioEditable;
  edificios: EdificioEditable[];
  pisos: PisoResumen[];
  puedeCrear: boolean;
  puedeEditar: boolean;
  puedeEliminar: boolean;
}) {
  const [abierto, setAbierto] = useState<"piso" | "habitacion" | "editar" | null>(null);
  const [aviso, avisar] = useAviso();
  const cerrar = useCallback(() => setAbierto(null), []);
  const siguiente = Math.max(0, ...pisos.map((p) => p.piso)) + 1;
  if (!puedeCrear && !puedeEditar && !puedeEliminar) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {puedeCrear && (
        <>
          <button type="button" onClick={() => setAbierto("piso")} className={claseBoton("secundario", "sm")}>
            <Plus className="size-3.5" aria-hidden />
            Piso
          </button>
          <button type="button" onClick={() => setAbierto("habitacion")} className={claseBoton("fantasma", "sm")}>
            <Plus className="size-3.5" aria-hidden />
            Habitación
          </button>
        </>
      )}
      {(puedeEditar || puedeEliminar) && (
        <button type="button" onClick={() => setAbierto("editar")} className={claseBoton("fantasma", "sm")} aria-label={`Editar ${edificio.nombre}`}>
          <Pencil className="size-3.5" aria-hidden />
          <span className="hidden sm:inline">Editar</span>
        </button>
      )}

      <Dialogo abierto={abierto === "piso"} alCerrar={cerrar} titulo={`Agregar piso a ${edificio.nombre}`}>
        <FormularioPiso edificioId={edificio.id} siguiente={siguiente} alCerrar={cerrar} alGuardar={avisar} />
      </Dialogo>
      <DialogoHabitacion
        abierto={abierto === "habitacion"}
        alCerrar={cerrar}
        habitacion={null}
        edificios={edificios}
        edificioInicial={edificio.id}
        pisoInicial={Math.max(1, siguiente - 1)}
        alGuardar={avisar}
      />
      <Dialogo abierto={abierto === "editar"} alCerrar={cerrar} titulo={`Editar ${edificio.nombre}`} ancho="max-w-lg">
        {puedeEditar && <FormularioEdificio edificio={edificio} alCerrar={cerrar} alGuardar={avisar} />}
        <PisosEdificio edificio={edificio} pisos={pisos} puedeEliminar={puedeEliminar} alCerrar={cerrar} avisar={avisar} />
      </Dialogo>
      {aviso && <AvisoBreve key={aviso.n} titulo={aviso.texto} />}
    </div>
  );
}

/** Lista de pisos con su ocupación: los vacíos se pueden quitar; el edificio vacío, eliminar. */
function PisosEdificio({
  edificio,
  pisos,
  puedeEliminar,
  alCerrar,
  avisar,
}: {
  edificio: EdificioEditable;
  pisos: PisoResumen[];
  puedeEliminar: boolean;
  alCerrar: () => void;
  avisar: (t: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const [confirmar, setConfirmar] = useState(false);
  const vacio = pisos.every((p) => p.ocupados === 0);

  const ejecutar = (accion: () => Promise<EstadoHabitacion>, cerrar = false) =>
    iniciar(async () => {
      setError(null);
      const r = await accion();
      if (r.error) setError(r.error);
      else {
        avisar(r.ok ?? "Listo.");
        if (cerrar) alCerrar();
      }
    });

  return (
    <div className="mt-6 space-y-3 border-t border-slate-100 pt-5">
      <p className="text-sm font-semibold text-slate-700">Pisos</p>
      {error && <Alerta tipo="error">{error}</Alerta>}
      {pisos.length === 0 ? (
        <p className="text-sm text-slate-500">Sin pisos todavía.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {pisos.map((p) => (
            <li key={p.piso} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span className="flex-1 font-medium text-slate-800">Piso {p.piso}</span>
              <span className="text-slate-500">
                {p.ocupados}/{p.camas} camas
              </span>
              {puedeEliminar && (
                <button
                  type="button"
                  disabled={pendiente || p.ocupados > 0}
                  onClick={() => ejecutar(() => eliminarPiso(edificio.id, p.piso))}
                  title={p.ocupados > 0 ? "Tiene gente asignada" : `Quitar el piso ${p.piso}`}
                  className={claseBoton("fantasma", "sm", "text-red-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-40")}
                >
                  Quitar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {puedeEliminar &&
        (confirmar ? (
          <div className="flex flex-wrap items-center justify-end gap-2 rounded-xl bg-red-50 p-3">
            <p className="flex-1 text-sm text-red-700">Se borra con todas sus habitaciones. ¿Seguro?</p>
            <Boton variante="secundario" tamano="sm" onClick={() => setConfirmar(false)}>
              No
            </Boton>
            <Boton variante="peligro" tamano="sm" disabled={pendiente} onClick={() => ejecutar(() => eliminarEdificio(edificio.id), true)}>
              {pendiente ? "Eliminando…" : "Sí, eliminar"}
            </Boton>
          </div>
        ) : (
          <button
            type="button"
            disabled={!vacio}
            onClick={() => setConfirmar(true)}
            title={vacio ? undefined : "Tiene gente asignada"}
            className={claseBoton("fantasma", "sm", "text-red-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-40")}
          >
            <Trash2 className="size-3.5" aria-hidden />
            Eliminar el edificio
          </button>
        ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Formularios
// ---------------------------------------------------------------------------

function FormularioEdificio({
  edificio,
  alCerrar,
  alGuardar,
}: {
  edificio: EdificioEditable | null;
  alCerrar: () => void;
  alGuardar?: (t: string) => void;
}) {
  const [estado, accion] = useActionState<EstadoHabitacion | undefined, FormData>(guardarEdificio.bind(null, edificio?.id ?? null), undefined);
  const err = estado?.errores ?? {};
  const val = estado?.valores ?? {
    nombre: edificio?.nombre ?? "",
    sexo: edificio?.sexo ?? "",
    notas: edificio?.notas ?? "",
    pisos: "4",
    camas_jovenes: "34",
    camas_lideres: "4",
  };
  useAlGuardar(estado, alCerrar, alGuardar);

  return (
    <form action={accion} noValidate className="space-y-4">
      {estado?.error && <Alerta tipo="error">{estado.error}</Alerta>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Nombre" htmlFor="nombre" error={err.nombre}>
          <input id="nombre" name="nombre" defaultValue={val.nombre} placeholder="Ej. Abish" className="entrada" autoComplete="off" />
        </Campo>
        <Campo etiqueta="Es de" htmlFor="sexo" error={err.sexo}>
          <Seleccion id="sexo" name="sexo" defaultValue={val.sexo} className="entrada">
            <option value="" disabled>
              Elige…
            </option>
            <option value="Mujer">Mujeres</option>
            <option value="Hombre">Hombres</option>
          </Seleccion>
        </Campo>
      </div>
      {!edificio && (
        <div className="grid grid-cols-3 gap-3 rounded-xl bg-menta-50 p-4">
          <Campo etiqueta="Pisos" htmlFor="pisos" error={err.pisos}>
            <input id="pisos" name="pisos" type="number" inputMode="numeric" min={0} max={20} defaultValue={val.pisos} className="entrada" />
          </Campo>
          <Campo etiqueta="Camas jóvenes" htmlFor="camas_jovenes" error={err.camas_jovenes}>
            <input id="camas_jovenes" name="camas_jovenes" type="number" inputMode="numeric" min={0} max={60} defaultValue={val.camas_jovenes} className="entrada" />
          </Campo>
          <Campo etiqueta="Camas líderes" htmlFor="camas_lideres" error={err.camas_lideres}>
            <input id="camas_lideres" name="camas_lideres" type="number" inputMode="numeric" min={0} max={60} defaultValue={val.camas_lideres} className="entrada" />
          </Campo>
          <p className="col-span-3 text-xs text-slate-500">Por piso. Después se puede cambiar cada habitación.</p>
        </div>
      )}
      <Campo etiqueta="Notas" htmlFor="notas" error={err.notas}>
        <textarea id="notas" name="notas" rows={2} defaultValue={val.notas} className="entrada resize-y" />
      </Campo>
      <div className="flex justify-end gap-2">
        <Boton type="button" variante="secundario" onClick={alCerrar}>
          Cancelar
        </Boton>
        <BotonEnviar pendiente="Guardando…">{edificio ? "Guardar cambios" : "Crear edificio"}</BotonEnviar>
      </div>
    </form>
  );
}

function FormularioPiso({
  edificioId,
  siguiente,
  alCerrar,
  alGuardar,
}: {
  edificioId: string;
  siguiente: number;
  alCerrar: () => void;
  alGuardar?: (t: string) => void;
}) {
  const [estado, accion] = useActionState<EstadoHabitacion | undefined, FormData>(crearPiso, undefined);
  const err = estado?.errores ?? {};
  const val = estado?.valores ?? { piso: String(siguiente), camas_jovenes: "34", camas_lideres: "4" };
  useAlGuardar(estado, alCerrar, alGuardar);

  return (
    <form action={accion} noValidate className="space-y-4">
      {estado?.error && <Alerta tipo="error">{estado.error}</Alerta>}
      <input type="hidden" name="edificio_id" value={edificioId} />
      <div className="grid grid-cols-3 gap-3">
        <Campo etiqueta="Piso" htmlFor="piso" error={err.piso}>
          <input id="piso" name="piso" type="number" inputMode="numeric" min={0} max={60} defaultValue={val.piso} className="entrada" />
        </Campo>
        <Campo etiqueta="Camas jóvenes" htmlFor="camas_jovenes" error={err.camas_jovenes}>
          <input id="camas_jovenes" name="camas_jovenes" type="number" inputMode="numeric" min={0} max={60} defaultValue={val.camas_jovenes} className="entrada" />
        </Campo>
        <Campo etiqueta="Camas líderes" htmlFor="camas_lideres" error={err.camas_lideres}>
          <input id="camas_lideres" name="camas_lideres" type="number" inputMode="numeric" min={0} max={60} defaultValue={val.camas_lideres} className="entrada" />
        </Campo>
      </div>
      <div className="flex justify-end gap-2">
        <Boton type="button" variante="secundario" onClick={alCerrar}>
          Cancelar
        </Boton>
        <BotonEnviar pendiente="Agregando…">Agregar piso</BotonEnviar>
      </div>
    </form>
  );
}

export function DialogoHabitacion({
  abierto,
  alCerrar,
  habitacion,
  edificios,
  edificioInicial,
  pisoInicial,
  alGuardar,
}: {
  abierto: boolean;
  alCerrar: () => void;
  habitacion: HabitacionEditable | null;
  edificios: EdificioEditable[];
  edificioInicial?: string;
  pisoInicial?: number;
  alGuardar?: (t: string) => void;
}) {
  return (
    <Dialogo abierto={abierto} alCerrar={alCerrar} titulo={habitacion ? `Editar ${habitacion.nombre} · piso ${habitacion.piso}` : "Nueva habitación"}>
      <FormularioHabitacion
        habitacion={habitacion}
        edificios={edificios}
        edificioInicial={edificioInicial}
        pisoInicial={pisoInicial}
        alCerrar={alCerrar}
        alGuardar={alGuardar}
      />
    </Dialogo>
  );
}

function FormularioHabitacion({
  habitacion,
  edificios,
  edificioInicial,
  pisoInicial,
  alCerrar,
  alGuardar,
}: {
  habitacion: HabitacionEditable | null;
  edificios: EdificioEditable[];
  edificioInicial?: string;
  pisoInicial?: number;
  alCerrar: () => void;
  alGuardar?: (t: string) => void;
}) {
  const [estado, accion] = useActionState<EstadoHabitacion | undefined, FormData>(
    guardarHabitacion.bind(null, habitacion?.id ?? null),
    undefined,
  );
  const err = estado?.errores ?? {};
  const val = estado?.valores ?? {
    edificio_id: habitacion?.edificio_id ?? edificioInicial ?? edificios[0]?.id ?? "",
    piso: String(habitacion?.piso ?? pisoInicial ?? 1),
    nombre: habitacion?.nombre ?? "",
    tipo: habitacion?.tipo ?? "jovenes",
    capacidad: String(habitacion?.capacidad ?? 4),
    notas: habitacion?.notas ?? "",
  };
  useAlGuardar(estado, alCerrar, alGuardar);

  return (
    <form action={accion} noValidate className="space-y-4">
      {estado?.error && <Alerta tipo="error">{estado.error}</Alerta>}
      <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
        <Campo etiqueta="Edificio" htmlFor="edificio_id" error={err.edificio_id}>
          <Seleccion id="edificio_id" name="edificio_id" defaultValue={val.edificio_id} className="entrada">
            {edificios.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre} ({e.sexo === "Mujer" ? "mujeres" : "hombres"})
              </option>
            ))}
          </Seleccion>
        </Campo>
        <Campo etiqueta="Piso" htmlFor="piso" error={err.piso}>
          <input id="piso" name="piso" type="number" inputMode="numeric" min={0} max={60} defaultValue={val.piso} className="entrada" />
        </Campo>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
        <Campo etiqueta="Nombre" htmlFor="nombre" error={err.nombre}>
          <input id="nombre" name="nombre" defaultValue={val.nombre} placeholder="Ej. Jóvenes" className="entrada" autoComplete="off" />
        </Campo>
        <Campo etiqueta="Camas" htmlFor="capacidad" error={err.capacidad}>
          <input id="capacidad" name="capacidad" type="number" inputMode="numeric" min={1} max={60} defaultValue={val.capacidad} className="entrada" />
        </Campo>
      </div>
      <Campo etiqueta="Para" htmlFor="tipo" error={err.tipo}>
        <Seleccion id="tipo" name="tipo" defaultValue={val.tipo} className="entrada">
          <option value="jovenes">Jóvenes (participantes)</option>
          <option value="lideres">Líderes (consejeros)</option>
        </Seleccion>
      </Campo>
      <Campo etiqueta="Notas" htmlFor="notas" error={err.notas}>
        <textarea id="notas" name="notas" rows={2} defaultValue={val.notas} className="entrada resize-y" />
      </Campo>
      <div className="flex justify-end gap-2">
        <Boton type="button" variante="secundario" onClick={alCerrar}>
          Cancelar
        </Boton>
        <BotonEnviar pendiente="Guardando…">{habitacion ? "Guardar cambios" : "Crear habitación"}</BotonEnviar>
      </div>
    </form>
  );
}
