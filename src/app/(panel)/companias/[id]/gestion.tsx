"use client";

import { Pencil, Trash2, UserMinus, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { useCallback, useState, useTransition } from "react";

import { AvisoBreve, Dialogo } from "@/components/cliente";
import { SelectorPersonas, type Elegible } from "@/components/selector-personas";
import { Alerta, Avatar, Boton, EncabezadoTarjeta, EstadoVacio, Insignia, Tarjeta, claseBoton } from "@/components/ui";
import { nombreFuncion, type ConsejeroResumen, type Integrante } from "@/lib/organizacion-comun";
import { nombreCompleto } from "@/lib/participantes-comun";
import { agregarJovenes, asignarConsejero, asignarCoordinador, eliminarCompania, quitarCoordinador, quitarJoven } from "../actions";
import { DialogoCompania, type CompaniaEditable } from "../dialogos";

type Aviso = { n: number; texto: string } | null;

function useAviso() {
  const [aviso, setAviso] = useState<Aviso>(null);
  const avisar = useCallback((texto: string) => setAviso((a) => ({ n: (a?.n ?? 0) + 1, texto })), []);
  return [aviso, avisar] as const;
}

// ---------------------------------------------------------------------------
// Editar y eliminar
// ---------------------------------------------------------------------------

export function AccionesCompania({
  compania,
  puedeEditar,
  puedeEliminar,
  jovenes,
}: {
  compania: CompaniaEditable;
  puedeEditar: boolean;
  puedeEliminar: boolean;
  jovenes: number;
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

      <DialogoCompania abierto={editar} alCerrar={cerrar} compania={compania} alGuardar={avisar} />
      {aviso && <AvisoBreve key={aviso.n} titulo={aviso.texto} />}

      <Dialogo abierto={borrar} alCerrar={() => setBorrar(false)} titulo={`¿Eliminar la compañía ${compania.numero}?`}>
        {error && <Alerta tipo="error">{error}</Alerta>}
        <p className="text-sm text-slate-500">
          {jovenes > 0
            ? `Tiene ${jovenes} ${jovenes === 1 ? "joven" : "jóvenes"}: primero quítalos de la compañía.`
            : "Sus consejeros quedan libres para otra compañía."}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Boton variante="secundario" onClick={() => setBorrar(false)}>
            Cancelar
          </Boton>
          <Boton
            variante="peligro"
            disabled={pendiente || jovenes > 0}
            onClick={() =>
              iniciar(async () => {
                const r = await eliminarCompania(compania.id);
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

// ---------------------------------------------------------------------------
// Consejero y consejera
// ---------------------------------------------------------------------------

type ConsejeroConFoto = ConsejeroResumen & { foto: string | null };

export function ConsejerosCompania({
  companiaId,
  consejero,
  consejera,
  libresH,
  libresM,
  editable,
}: {
  companiaId: string;
  consejero: ConsejeroConFoto | null;
  consejera: ConsejeroConFoto | null;
  libresH: Elegible[];
  libresM: Elegible[];
  editable: boolean;
}) {
  const [aviso, avisar] = useAviso();
  return (
    <Tarjeta>
      <EncabezadoTarjeta titulo="Pareja de consejeros" descripcion="Un consejero y una consejera por compañía." />
      <div className="divide-y divide-slate-100">
        <Lugar companiaId={companiaId} lugar="consejero" actual={consejero} libres={libresH} editable={editable} avisar={avisar} />
        <Lugar companiaId={companiaId} lugar="consejera" actual={consejera} libres={libresM} editable={editable} avisar={avisar} />
      </div>
      {aviso && <AvisoBreve key={aviso.n} titulo={aviso.texto} />}
    </Tarjeta>
  );
}

function Lugar({
  companiaId,
  lugar,
  actual,
  libres,
  editable,
  avisar,
}: {
  companiaId: string;
  lugar: "consejero" | "consejera";
  actual: ConsejeroConFoto | null;
  libres: Elegible[];
  editable: boolean;
  avisar: (texto: string) => void;
}) {
  const [elegido, setElegido] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const titulo = lugar === "consejero" ? "Consejero" : "Consejera";

  const asignar = (id: string | null) =>
    iniciar(async () => {
      setError(null);
      const r = await asignarConsejero(companiaId, lugar, id);
      if (r.error) setError(r.error);
      else {
        setElegido("");
        avisar(r.ok ?? "Listo.");
      }
    });

  return (
    <div className="space-y-3 px-5 py-4 sm:px-6">
      <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">{titulo}</p>
      {actual ? (
        <div className="flex items-center gap-3">
          <Avatar texto={nombreCompleto(actual)} src={actual.foto} />
          <div className="min-w-0 flex-1">
            <Link href={`/consejeros/${actual.id}`} className="block truncate font-semibold text-slate-800 hover:text-marca-700">
              {nombreCompleto(actual)}
            </Link>
            {actual.funcion === "coordinador" && (
              <p className="text-xs text-slate-500">{nombreFuncion("coordinador", actual.sexo)} · cubre el lugar</p>
            )}
          </div>
          {editable && (
            <button
              type="button"
              disabled={pendiente}
              onClick={() => asignar(null)}
              className={claseBoton("fantasma", "sm")}
              title={`Dejar la compañía sin ${lugar}`}
            >
              <UserMinus className="size-3.5" aria-hidden />
              Quitar
            </button>
          )}
        </div>
      ) : (
        <Insignia tono="sol">Sin {lugar}</Insignia>
      )}

      {error && <Alerta tipo="error">{error}</Alerta>}

      {editable &&
        (libres.length > 0 ? (
          <div className="flex gap-2">
            <select
              value={elegido}
              onChange={(e) => setElegido(e.target.value)}
              aria-label={`Elegir ${lugar}`}
              className="entrada min-w-0 flex-1 py-2"
            >
              <option value="">{actual ? `Cambiar por otr${lugar === "consejera" ? "a" : "o"}…` : `Elegir ${lugar}…`}</option>
              {libres.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                  {p.detalle ? ` · ${p.detalle}` : ""}
                </option>
              ))}
            </select>
            <Boton tamano="md" disabled={!elegido || pendiente} onClick={() => asignar(elegido)}>
              {pendiente ? "…" : "Asignar"}
            </Boton>
          </div>
        ) : (
          !actual && (
            <p className="text-xs text-slate-500">
              No hay {lugar === "consejero" ? "consejeros" : "consejeras"} sin compañía.{" "}
              <Link href="/consejeros/nuevo" className="font-semibold text-marca-600 hover:text-marca-800">
                Registrar
              </Link>
            </p>
          )
        ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Coordinadores auxiliares
// ---------------------------------------------------------------------------

export function CoordinadoresCompania({
  companiaId,
  coordinadores,
  libres,
  faltaConsejero,
  faltaConsejera,
  editable,
}: {
  companiaId: string;
  coordinadores: ConsejeroConFoto[];
  libres: Elegible[];
  faltaConsejero: boolean;
  faltaConsejera: boolean;
  editable: boolean;
}) {
  const [elegido, setElegido] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const [aviso, avisar] = useAviso();

  const ejecutar = (accion: () => Promise<{ ok?: string; error?: string }>) =>
    iniciar(async () => {
      setError(null);
      const r = await accion();
      if (r.error) setError(r.error);
      else {
        setElegido("");
        avisar(r.ok ?? "Listo.");
      }
    });

  return (
    <Tarjeta>
      <EncabezadoTarjeta
        titulo="Coordinador auxiliar"
        descripcion="Ayuda a la pareja de consejeros y puede cubrir a uno de ellos."
      />
      <div className="space-y-3 px-5 py-4 sm:px-6">
        {coordinadores.length === 0 ? (
          <p className="text-sm text-slate-400">Sin coordinador auxiliar todavía.</p>
        ) : (
          <ul className="space-y-3">
            {coordinadores.map((k) => {
              const puedeCubrir = k.sexo === "Hombre" ? faltaConsejero : faltaConsejera;
              return (
                <li key={k.id} className="flex flex-wrap items-center gap-3">
                  <Avatar texto={nombreCompleto(k)} src={k.foto} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/consejeros/${k.id}`} className="block truncate font-semibold text-slate-800 hover:text-marca-700">
                      {nombreCompleto(k)}
                    </Link>
                    <p className="text-xs text-slate-500">{nombreFuncion("coordinador", k.sexo)}</p>
                  </div>
                  {editable && (
                    <div className="flex gap-1">
                      {puedeCubrir && (
                        <button
                          type="button"
                          disabled={pendiente}
                          onClick={() => ejecutar(() => asignarConsejero(companiaId, k.sexo === "Hombre" ? "consejero" : "consejera", k.id))}
                          className={claseBoton("secundario", "sm")}
                          title="Ocupa el lugar vacío de la pareja de consejeros"
                        >
                          Cubrir como {k.sexo === "Hombre" ? "consejero" : "consejera"}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={pendiente}
                        onClick={() => ejecutar(() => quitarCoordinador(companiaId, k.id))}
                        className={claseBoton("fantasma", "sm")}
                        aria-label={`Quitar a ${nombreCompleto(k)} de la compañía`}
                      >
                        <UserMinus className="size-3.5" aria-hidden />
                        <span className="hidden sm:inline">Quitar</span>
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {error && <Alerta tipo="error">{error}</Alerta>}

        {editable &&
          (libres.length > 0 ? (
            <div className="space-y-1.5">
              <div className="flex gap-2">
                <select
                  value={elegido}
                  onChange={(e) => setElegido(e.target.value)}
                  aria-label="Elegir coordinador auxiliar"
                  className="entrada min-w-0 flex-1 py-2"
                >
                  <option value="">{coordinadores.length ? "Agregar otro…" : "Elegir coordinador auxiliar…"}</option>
                  {libres.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                      {p.detalle ? ` · ${p.detalle}` : ""}
                    </option>
                  ))}
                </select>
                <Boton disabled={!elegido || pendiente} onClick={() => ejecutar(() => asignarCoordinador(companiaId, elegido))}>
                  {pendiente ? "…" : "Asignar"}
                </Boton>
              </div>
              {coordinadores.length > 0 && <p className="text-xs text-slate-500">Normalmente hay uno por compañía.</p>}
            </div>
          ) : (
            coordinadores.length === 0 && (
              <p className="text-xs text-slate-500">
                No hay coordinadores auxiliares sin compañía.{" "}
                <Link href="/consejeros/nuevo" className="font-semibold text-marca-600 hover:text-marca-800">
                  Registrar
                </Link>
              </p>
            )
          ))}
      </div>
      {aviso && <AvisoBreve key={aviso.n} titulo={aviso.texto} />}
    </Tarjeta>
  );
}

// ---------------------------------------------------------------------------
// Jóvenes
// ---------------------------------------------------------------------------

export function JovenesCompania({
  companiaId,
  jovenes,
  candidatos,
  editable,
}: {
  companiaId: string;
  jovenes: Integrante[];
  candidatos: Elegible[];
  editable: boolean;
}) {
  const [selector, setSelector] = useState(false);
  const [aviso, avisar] = useAviso();
  const [error, setError] = useState<string | null>(null);
  const [quitando, setQuitando] = useState<string | null>(null);
  const [, iniciar] = useTransition();

  const mujeres = jovenes.filter((j) => j.sexo === "Mujer").length;
  const hombres = jovenes.filter((j) => j.sexo === "Hombre").length;

  function quitar(id: string) {
    setQuitando(id);
    iniciar(async () => {
      setError(null);
      const r = await quitarJoven(companiaId, id);
      if (r.error) setError(r.error);
      setQuitando(null);
    });
  }

  return (
    <Tarjeta>
      <EncabezadoTarjeta
        titulo={`Jóvenes (${jovenes.length})`}
        descripcion={jovenes.length > 0 ? `${mujeres} mujeres · ${hombres} hombres` : undefined}
        acciones={
          editable && (
            <Boton tamano="sm" onClick={() => setSelector(true)}>
              <UserPlus className="size-3.5" aria-hidden />
              Agregar jóvenes
            </Boton>
          )
        }
      />
      {error && (
        <div className="px-5 pt-4 sm:px-6">
          <Alerta tipo="error">{error}</Alerta>
        </div>
      )}
      {jovenes.length === 0 ? (
        <EstadoVacio
          icono={<Users className="size-5" />}
          titulo="Todavía no tiene jóvenes"
          descripcion={editable ? "Agrégalos cuando se haga el reparto por edades." : undefined}
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {jovenes.map((j) => (
            <li key={j.id} className="flex items-center gap-3 px-5 py-3 sm:px-6">
              <Avatar texto={j.nombre} src={j.foto} tamano="sm" />
              <div className="min-w-0 flex-1">
                <Link href={`/participantes/${j.id}`} className="block truncate text-sm font-semibold text-slate-800 hover:text-marca-700">
                  {j.nombre}
                </Link>
                <p className="truncate text-xs text-slate-500">
                  {[j.edad !== null ? `${j.edad} años` : null, j.sexo, j.barrio, j.extra].filter(Boolean).join(" · ")}
                </p>
              </div>
              {editable && (
                <button
                  type="button"
                  disabled={quitando === j.id}
                  onClick={() => quitar(j.id)}
                  className={claseBoton("fantasma", "sm")}
                  aria-label={`Quitar a ${j.nombre} de la compañía`}
                >
                  <UserMinus className="size-3.5" aria-hidden />
                  <span className="hidden sm:inline">{quitando === j.id ? "Quitando…" : "Quitar"}</span>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <SelectorPersonas
        abierto={selector}
        alCerrar={() => setSelector(false)}
        titulo="Agregar jóvenes a la compañía"
        descripcion="Solo aparecen los que todavía no tienen compañía."
        personas={candidatos}
        vacio="Todos los jóvenes ya tienen compañía."
        alConfirmar={async (ids) => {
          const r = await agregarJovenes(companiaId, ids);
          if (r.ok) avisar(r.ok);
          return r;
        }}
      />
      {aviso && <AvisoBreve key={aviso.n} titulo={aviso.texto} />}
    </Tarjeta>
  );
}
