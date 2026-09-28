"use client";

import { Layers, Plus } from "lucide-react";
import { useActionState, useCallback, useEffect, useState } from "react";

import { AvisoBreve, BotonEnviar, Dialogo } from "@/components/cliente";
import { Alerta, Boton, Campo } from "@/components/ui";
import { crearVariasCompanias, guardarCompania, type EstadoCompania } from "./actions";

export interface CompaniaEditable {
  id: string;
  numero: number;
  nombre: string;
  notas: string | null;
}

/** Botones "Nueva compañía" y "Crear varias" de la página de compañías. */
export function AccionesCompanias({ siguiente }: { siguiente: number }) {
  const [abierto, setAbierto] = useState<"una" | "varias" | null>(null);
  const [aviso, setAviso] = useState<{ n: number; texto: string } | null>(null);
  const avisar = useCallback((texto: string) => setAviso((a) => ({ n: (a?.n ?? 0) + 1, texto })), []);
  const cerrar = useCallback(() => setAbierto(null), []);

  return (
    <>
      <Boton variante="secundario" onClick={() => setAbierto("varias")}>
        <Layers className="size-4" aria-hidden />
        Crear varias
      </Boton>
      <Boton onClick={() => setAbierto("una")}>
        <Plus className="size-4" aria-hidden />
        Nueva compañía
      </Boton>

      <DialogoCompania abierto={abierto === "una"} alCerrar={cerrar} compania={null} siguiente={siguiente} alGuardar={avisar} />

      <Dialogo
        abierto={abierto === "varias"}
        alCerrar={cerrar}
        titulo="Crear varias compañías"
        descripcion={`Se numeran solas desde la ${siguiente}. El nombre se puede poner después.`}
      >
        <FormularioVarias siguiente={siguiente} alCerrar={cerrar} alGuardar={avisar} />
      </Dialogo>

      {aviso && <AvisoBreve key={aviso.n} titulo={aviso.texto} />}
    </>
  );
}

function FormularioVarias({
  siguiente,
  alCerrar,
  alGuardar,
}: {
  siguiente: number;
  alCerrar: () => void;
  alGuardar: (texto: string) => void;
}) {
  const [estado, accion] = useActionState<EstadoCompania | undefined, FormData>(crearVariasCompanias, undefined);
  const [cantidad, setCantidad] = useState(estado?.valores?.cantidad ?? "10");

  useEffect(() => {
    if (estado?.ok) {
      alGuardar(estado.ok);
      alCerrar();
    }
  }, [estado, alGuardar, alCerrar]);

  const n = Number(cantidad);
  return (
    <form action={accion} noValidate className="space-y-4">
      {estado?.error && <Alerta tipo="error">{estado.error}</Alerta>}
      <Campo
        etiqueta="¿Cuántas?"
        htmlFor="cantidad"
        error={estado?.errores?.cantidad}
        ayuda={Number.isInteger(n) && n >= 1 && n <= 50 ? `Compañías ${siguiente} a ${siguiente + n - 1}.` : "Entre 1 y 50."}
      >
        <input
          id="cantidad"
          name="cantidad"
          type="number"
          inputMode="numeric"
          min={1}
          max={50}
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          className="entrada"
        />
      </Campo>
      <div className="flex justify-end gap-2">
        <Boton type="button" variante="secundario" onClick={alCerrar}>
          Cancelar
        </Boton>
        <BotonEnviar pendiente="Creando…">Crear</BotonEnviar>
      </div>
    </form>
  );
}

/** Crear o editar una compañía: número, nombre opcional y notas. */
export function DialogoCompania({
  abierto,
  alCerrar,
  compania,
  siguiente,
  alGuardar,
}: {
  abierto: boolean;
  alCerrar: () => void;
  compania: CompaniaEditable | null;
  siguiente?: number;
  alGuardar?: (texto: string) => void;
}) {
  return (
    <Dialogo
      abierto={abierto}
      alCerrar={alCerrar}
      titulo={compania ? "Editar compañía" : "Nueva compañía"}
      descripcion="El nombre es opcional: si no hay, se muestra solo el número."
    >
      <FormularioCompania compania={compania} siguiente={siguiente} alCerrar={alCerrar} alGuardar={alGuardar} />
    </Dialogo>
  );
}

function FormularioCompania({
  compania,
  siguiente,
  alCerrar,
  alGuardar,
}: {
  compania: CompaniaEditable | null;
  siguiente?: number;
  alCerrar: () => void;
  alGuardar?: (texto: string) => void;
}) {
  const [estado, accion] = useActionState<EstadoCompania | undefined, FormData>(
    guardarCompania.bind(null, compania?.id ?? null),
    undefined,
  );
  const err = estado?.errores ?? {};
  const val = estado?.valores ?? {
    numero: String(compania?.numero ?? siguiente ?? 1),
    nombre: compania?.nombre ?? "",
    notas: compania?.notas ?? "",
  };

  useEffect(() => {
    if (estado?.ok) {
      alGuardar?.(estado.ok);
      alCerrar();
    }
  }, [estado, alGuardar, alCerrar]);

  return (
    <form action={accion} noValidate className="space-y-4">
      {estado?.error && <Alerta tipo="error">{estado.error}</Alerta>}
      <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
        <Campo etiqueta="Número" htmlFor="numero" error={err.numero}>
          <input id="numero" name="numero" type="number" inputMode="numeric" min={1} max={999} defaultValue={val.numero} className="entrada" />
        </Campo>
        <Campo etiqueta="Nombre" htmlFor="nombre" error={err.nombre}>
          <input id="nombre" name="nombre" defaultValue={val.nombre} placeholder="Opcional" className="entrada" autoComplete="off" />
        </Campo>
      </div>
      <Campo etiqueta="Notas" htmlFor="notas" error={err.notas}>
        <textarea id="notas" name="notas" rows={2} defaultValue={val.notas} className="entrada resize-y" />
      </Campo>
      <div className="flex justify-end gap-2">
        <Boton type="button" variante="secundario" onClick={alCerrar}>
          Cancelar
        </Boton>
        <BotonEnviar pendiente="Guardando…">{compania ? "Guardar cambios" : "Crear compañía"}</BotonEnviar>
      </div>
    </form>
  );
}
