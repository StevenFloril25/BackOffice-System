"use client";

import clsx from "clsx";
import { Check, Search } from "lucide-react";
import { useMemo, useState, useTransition, type ReactNode } from "react";

import { Dialogo } from "@/components/cliente";
import { Alerta, Boton } from "@/components/ui";

export interface Elegible {
  id: string;
  nombre: string;
  detalle: string;
  sexo: "Hombre" | "Mujer" | null;
  edad: number | null;
  /** Grupo para filtrar, como la compañía. */
  grupo?: string;
}

const sinTildes = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/**
 * Modal para elegir varias personas de una lista: jóvenes para una compañía,
 * ocupantes para una habitación. Busca por nombre o detalle, filtra por sexo,
 * edad (el reparto se hace por edades) y compañía, y respeta un tope opcional,
 * como las camas libres de una habitación.
 */
export function SelectorPersonas({
  abierto,
  alCerrar,
  titulo,
  descripcion,
  personas,
  maximo,
  vacio = "No hay nadie disponible.",
  alConfirmar,
}: {
  abierto: boolean;
  alCerrar: () => void;
  titulo: string;
  descripcion?: ReactNode;
  personas: Elegible[];
  /** Cuántos se pueden elegir como máximo (camas libres). Sin tope si no se indica. */
  maximo?: number;
  vacio?: string;
  alConfirmar: (ids: string[]) => Promise<{ error?: string } | undefined>;
}) {
  return (
    <Dialogo abierto={abierto} alCerrar={alCerrar} titulo={titulo} descripcion={descripcion} ancho="max-w-xl">
      <Contenido personas={personas} maximo={maximo} vacio={vacio} alCerrar={alCerrar} alConfirmar={alConfirmar} />
    </Dialogo>
  );
}

function Contenido({
  personas,
  maximo,
  vacio,
  alCerrar,
  alConfirmar,
}: {
  personas: Elegible[];
  maximo?: number;
  vacio: string;
  alCerrar: () => void;
  alConfirmar: (ids: string[]) => Promise<{ error?: string } | undefined>;
}) {
  const [texto, setTexto] = useState("");
  const [sexo, setSexo] = useState("");
  const [edad, setEdad] = useState("");
  const [grupo, setGrupo] = useState("");
  const [elegidos, setElegidos] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const ambosSexos = personas.some((p) => p.sexo === "Mujer") && personas.some((p) => p.sexo === "Hombre");
  const edades = useMemo(
    () => [...new Set(personas.map((p) => p.edad).filter((e): e is number => e !== null))].sort((a, b) => a - b),
    [personas],
  );
  const grupos = useMemo(
    () =>
      [...new Set(personas.map((p) => p.grupo).filter((g): g is string => !!g))].sort((a, b) =>
        a.localeCompare(b, "es", { numeric: true }),
      ),
    [personas],
  );
  const visibles = useMemo(() => {
    const partes = sinTildes(texto.trim()).split(/\s+/).filter(Boolean);
    return personas.filter((p) => {
      if (sexo && p.sexo !== sexo) return false;
      if (edad && p.edad !== Number(edad)) return false;
      if (grupo && p.grupo !== grupo) return false;
      const pajar = sinTildes(`${p.nombre} ${p.detalle}`);
      return partes.every((t) => pajar.includes(t));
    });
  }, [personas, texto, sexo, edad, grupo]);

  const tope = maximo ?? Infinity;
  const lleno = elegidos.size >= tope;

  function alternar(id: string) {
    setElegidos((previos) => {
      const s = new Set(previos);
      if (s.has(id)) s.delete(id);
      else if (s.size < tope) s.add(id);
      return s;
    });
  }

  function elegirVisibles() {
    setElegidos((previos) => {
      const s = new Set(previos);
      for (const p of visibles) {
        if (s.size >= tope) break;
        s.add(p.id);
      }
      return s;
    });
  }

  function confirmar() {
    iniciar(async () => {
      setError(null);
      const r = await alConfirmar([...elegidos]);
      if (r?.error) setError(r.error);
      else alCerrar();
    });
  }

  if (personas.length === 0) {
    return (
      <div className="space-y-4">
        <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">{vacio}</p>
        <div className="flex justify-end">
          <Boton variante="secundario" onClick={alCerrar}>
            Cerrar
          </Boton>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && <Alerta tipo="error">{error}</Alerta>}

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Busca por nombre, barrio o compañía"
          aria-label="Buscar"
          className="entrada pl-10"
          autoComplete="off"
        />
      </div>

      {(ambosSexos || edades.length > 1 || grupos.length > 1) && (
        <div className="flex flex-wrap gap-2">
          {ambosSexos && (
            <select value={sexo} onChange={(e) => setSexo(e.target.value)} aria-label="Sexo" className="entrada w-auto flex-1 py-2">
              <option value="">Mujeres y hombres</option>
              <option value="Mujer">Mujeres</option>
              <option value="Hombre">Hombres</option>
            </select>
          )}
          {edades.length > 1 && (
            <select value={edad} onChange={(e) => setEdad(e.target.value)} aria-label="Edad" className="entrada w-auto flex-1 py-2">
              <option value="">Todas las edades</option>
              {edades.map((e) => (
                <option key={e} value={e}>
                  {e} años
                </option>
              ))}
            </select>
          )}
          {grupos.length > 1 && (
            <select value={grupo} onChange={(e) => setGrupo(e.target.value)} aria-label="Compañía" className="entrada w-auto flex-1 py-2">
              <option value="">Todas las compañías</option>
              {grupos.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          {visibles.length} de {personas.length}
        </span>
        {visibles.length > 0 && !lleno && (
          <button type="button" onClick={elegirVisibles} className="font-semibold text-marca-600 hover:text-marca-800">
            {maximo !== undefined && visibles.length > tope - elegidos.size
              ? `Elegir los primeros ${tope - elegidos.size}`
              : "Elegir todos los de la lista"}
          </button>
        )}
      </div>

      <ul className="max-h-[45vh] divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
        {visibles.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-500">Nadie coincide.</li>}
        {visibles.map((p) => {
          const marcado = elegidos.has(p.id);
          const bloqueado = !marcado && lleno;
          return (
            <li key={p.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={marcado}
                disabled={bloqueado}
                onClick={() => alternar(p.id)}
                className={clsx(
                  "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
                  marcado ? "bg-marca-50" : "hover:bg-slate-50",
                  bloqueado && "cursor-not-allowed opacity-40",
                )}
              >
                <span
                  className={clsx(
                    "flex size-5 shrink-0 items-center justify-center rounded-md border",
                    marcado ? "border-marca-600 bg-marca-600 text-white" : "border-slate-300 bg-white",
                  )}
                >
                  {marcado && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-slate-800">{p.nombre}</span>
                  <span className="block truncate text-xs text-slate-500">{p.detalle || "—"}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">
          {elegidos.size === 0 ? "Nadie elegido" : `${elegidos.size} elegido${elegidos.size === 1 ? "" : "s"}`}
          {maximo !== undefined && ` · ${maximo === 1 ? "queda 1 lugar" : `quedan ${maximo} lugares`}`}
        </p>
        <div className="flex gap-2">
          <Boton variante="secundario" onClick={alCerrar} className="flex-1 sm:flex-none">
            Cancelar
          </Boton>
          <Boton onClick={confirmar} disabled={pendiente || elegidos.size === 0} className="flex-1 sm:flex-none">
            {pendiente ? "Agregando…" : elegidos.size > 0 ? `Agregar ${elegidos.size}` : "Agregar"}
          </Boton>
        </div>
      </div>
    </div>
  );
}
