"use client";

import { Pencil, Trash2, UserMinus, UserPlus } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState, useTransition } from "react";

import { AvisoBreve, Dialogo } from "@/components/cliente";
import { SelectorPersonas, type Elegible } from "@/components/selector-personas";
import { Alerta, Avatar, Boton, EncabezadoTarjeta, Tarjeta, claseBoton } from "@/components/ui";
import { rolConsejero, type Integrante, type Sexo, type TipoHabitacion } from "@/lib/organizacion-comun";
import { agregarOcupantes, eliminarHabitacion, quitarOcupante } from "../actions";
import { DialogoHabitacion, useAviso, type EdificioEditable, type HabitacionEditable } from "../dialogos";
import { Camas, ChipCompania } from "../grafico";

export function AccionesHabitacion({
  habitacion,
  edificios,
  ocupados,
  puedeEditar,
  puedeEliminar,
}: {
  habitacion: HabitacionEditable;
  edificios: EdificioEditable[];
  ocupados: number;
  puedeEditar: boolean;
  puedeEliminar: boolean;
}) {
  const [editar, setEditar] = useState(false);
  const [borrar, setBorrar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const [aviso, avisar] = useAviso();
  const cerrar = useCallback(() => setEditar(false), []);

  return (
    <>
      {puedeEditar && (
        <Boton variante="secundario" onClick={() => setEditar(true)}>
          <Pencil className="size-4" aria-hidden />
          Editar
        </Boton>
      )}
      {puedeEliminar && (
        <Boton variante="secundario" onClick={() => setBorrar(true)} className="text-red-600 hover:text-red-700">
          <Trash2 className="size-4" aria-hidden />
          Eliminar
        </Boton>
      )}

      <DialogoHabitacion abierto={editar} alCerrar={cerrar} habitacion={habitacion} edificios={edificios} alGuardar={avisar} />
      {aviso && <AvisoBreve key={aviso.n} titulo={aviso.texto} />}

      <Dialogo abierto={borrar} alCerrar={() => setBorrar(false)} titulo={`¿Eliminar ${habitacion.nombre} del piso ${habitacion.piso}?`}>
        {error && <Alerta tipo="error">{error}</Alerta>}
        <p className="text-sm text-slate-500">
          {ocupados > 0 ? `Tiene ${ocupados} persona${ocupados === 1 ? "" : "s"}: primero sácalas.` : "No se puede deshacer."}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Boton variante="secundario" onClick={() => setBorrar(false)}>
            Cancelar
          </Boton>
          <Boton
            variante="peligro"
            disabled={pendiente || ocupados > 0}
            onClick={() =>
              iniciar(async () => {
                const r = await eliminarHabitacion(habitacion.id);
                if (r?.error) setError(r.error);
              })
            }
          >
            {pendiente ? "Eliminando…" : "Eliminar"}
          </Boton>
        </div>
      </Dialogo>
    </>
  );
}

export function OcupantesHabitacion({
  habitacionId,
  capacidad,
  sexo,
  tipo,
  ocupantes,
  libres: candidatos,
  editable,
  enlaces,
}: {
  habitacionId: string;
  capacidad: number;
  sexo: Sexo;
  tipo: TipoHabitacion;
  ocupantes: Integrante[];
  libres: Elegible[];
  editable: boolean;
  /** A qué fichas puede entrar quien mira: un consejero ve la habitación, no las fichas. */
  enlaces: { participantes: boolean; consejeros: boolean };
}) {
  const [selector, setSelector] = useState(false);
  const [aviso, avisar] = useAviso();
  const [error, setError] = useState<string | null>(null);
  const [quitando, setQuitando] = useState<string | null>(null);
  const [, iniciar] = useTransition();

  const esLideres = tipo === "lideres";
  const libres = Math.max(0, capacidad - ocupantes.length);
  const rol = rolConsejero(sexo);
  const quienes = esLideres ? (sexo === "Mujer" ? "consejeras" : "consejeros") : sexo === "Mujer" ? "jóvenes mujeres" : "jóvenes hombres";

  const porCompania = useMemo(() => {
    const m: Record<number, number> = {};
    for (const o of ocupantes) if (o.tipo === "participante") m[o.compania ?? 0] = (m[o.compania ?? 0] ?? 0) + 1;
    return m;
  }, [ocupantes]);

  function quitar(o: Integrante) {
    setQuitando(o.id);
    iniciar(async () => {
      setError(null);
      const r = await quitarOcupante(habitacionId, o.tipo, o.id);
      if (r.error) setError(r.error);
      setQuitando(null);
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Tarjeta className="h-fit space-y-4 p-5 sm:p-6">
        <div>
          <p className="text-xs font-medium text-slate-500">Camas ocupadas</p>
          <p className="mt-1 text-3xl font-bold text-marca-950">
            {ocupantes.length}
            <span className="text-lg font-medium text-slate-400"> / {capacidad}</span>
          </p>
          <p className="mt-1 text-sm text-slate-500">{libres === 0 ? "Llena." : `${libres} libre${libres === 1 ? "" : "s"}.`}</p>
        </div>
        <Camas capacidad={capacidad} porCompania={esLideres ? {} : porCompania} lideres={esLideres ? ocupantes.length : 0} tamano="lg" />
        {!esLideres && Object.keys(porCompania).length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(porCompania)
              .sort(([a], [b]) => (Number(a) || 999) - (Number(b) || 999))
              .map(([n, c]) => (
                <ChipCompania key={n} numero={Number(n)} texto={String(c)} grande />
              ))}
          </div>
        )}
        {esLideres && ocupantes.length === 0 && <Alerta tipo="aviso">Todavía no hay {rol.toLowerCase()} en este piso.</Alerta>}
      </Tarjeta>

      <Tarjeta className="lg:col-span-2">
        <EncabezadoTarjeta
          titulo={esLideres ? "Líderes que duermen aquí" : "Jóvenes que duermen aquí"}
          acciones={
            editable &&
            libres > 0 && (
              <Boton tamano="sm" onClick={() => setSelector(true)}>
                <UserPlus className="size-3.5" aria-hidden />
                {esLideres ? `Agregar ${rol.toLowerCase()}` : "Agregar jóvenes"}
              </Boton>
            )
          }
        />
        {error && (
          <div className="px-5 pt-4 sm:px-6">
            <Alerta tipo="error">{error}</Alerta>
          </div>
        )}
        {ocupantes.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-slate-500">Nadie asignado todavía.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {ocupantes.map((o) => (
              <li key={o.id} className="flex items-center gap-3 px-5 py-3 sm:px-6">
                <Avatar texto={o.nombre} src={o.foto} tamano="sm" />
                <div className="min-w-0 flex-1">
                  {(o.tipo === "consejero" ? enlaces.consejeros : enlaces.participantes) ? (
                    <Link
                      href={o.tipo === "consejero" ? `/consejeros/${o.id}` : `/participantes/${o.id}`}
                      className="block truncate text-sm font-semibold text-slate-800 hover:text-marca-700"
                    >
                      {o.nombre}
                    </Link>
                  ) : (
                    <p className="truncate text-sm font-semibold text-slate-800">{o.nombre}</p>
                  )}
                  <p className="truncate text-xs text-slate-500">{[o.edad !== null ? `${o.edad} años` : null, o.barrio].filter(Boolean).join(" · ") || "—"}</p>
                </div>
                {o.compania ? <ChipCompania numero={o.compania} /> : <span className="text-xs text-slate-400">Sin compañía</span>}
                {editable && (
                  <button
                    type="button"
                    disabled={quitando === o.id}
                    onClick={() => quitar(o)}
                    className={claseBoton("fantasma", "sm")}
                    aria-label={`Sacar a ${o.nombre} de la habitación`}
                  >
                    <UserMinus className="size-3.5" aria-hidden />
                    <span className="hidden sm:inline">{quitando === o.id ? "Sacando…" : "Sacar"}</span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>

      <SelectorPersonas
        abierto={selector}
        alCerrar={() => setSelector(false)}
        titulo={esLideres ? `Agregar ${rol.toLowerCase()}` : "Agregar jóvenes"}
        descripcion={
          esLideres
            ? `${sexo === "Mujer" ? "Consejeras" : "Consejeros"} que todavía no tienen cama.`
            : "Jóvenes sin cama. Filtra por compañía para que duerman en el mismo piso."
        }
        personas={candidatos}
        maximo={libres}
        vacio={`No quedan ${quienes} sin cama.`}
        alConfirmar={async (ids) => {
          const r = await agregarOcupantes(habitacionId, esLideres ? "consejero" : "participante", ids);
          if (r.ok) avisar(r.ok);
          return r;
        }}
      />
      {aviso && <AvisoBreve key={aviso.n} titulo={aviso.texto} />}
    </div>
  );
}
