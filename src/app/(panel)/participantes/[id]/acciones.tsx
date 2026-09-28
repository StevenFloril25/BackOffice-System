"use client";

import { CheckCircle2, Clock, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import { AvisoBreve, Dialogo, Fecha } from "@/components/cliente";
import { EditorFoto } from "@/components/foto";
import { Alerta, Boton, EncabezadoTarjeta, Tarjeta } from "@/components/ui";
import { eliminarParticipante, marcarAsistencia, quitarFotoParticipante, subirFotoParticipante } from "../actions";

export function FotoParticipante({ id, url, texto, editable }: { id: string; url: string | null; texto: string; editable: boolean }) {
  return (
    <EditorFoto
      url={url}
      texto={texto}
      forma="carnet"
      editable={editable}
      subir={(datos) => subirFotoParticipante(id, datos)}
      quitar={() => quitarFotoParticipante(id)}
    />
  );
}

export function Asistencia({
  id,
  nombre,
  talla,
  asistioAt,
  registradoPor,
  puedeRegistrar,
}: {
  id: string;
  nombre: string;
  talla: string | null;
  asistioAt: string | null;
  registradoPor: string | null;
  puedeRegistrar: boolean;
}) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmarAnular, setConfirmarAnular] = useState(false);
  // Cada llegada marcada abre el modal breve (la `key` lo vuelve a montar).
  const [registros, setRegistros] = useState(0);
  const tallaCorta = talla?.replace(" (unisex)", "") ?? null;

  const cambiar = (asistio: boolean) =>
    iniciar(async () => {
      setError(null);
      const r = await marcarAsistencia(id, asistio);
      if (r.error) setError(r.error);
      else if (asistio) setRegistros((n) => n + 1);
      setConfirmarAnular(false);
    });

  return (
    <Tarjeta>
      {registros > 0 && (
        <AvisoBreve
          key={registros}
          titulo="Participante registrado"
          detalle={
            <>
              <span className="block">{nombre}</span>
              <span className="mt-2 block font-semibold text-hoja-700">Kit entregado{tallaCorta && ` · talla ${tallaCorta}`}</span>
            </>
          }
        />
      )}
      <EncabezadoTarjeta titulo="Llegada" />
      <div className="space-y-4 p-5 sm:p-6">
        {error && <Alerta tipo="error">{error}</Alerta>}
        {asistioAt ? (
          <div className="flex items-start gap-3 rounded-xl bg-hoja-100 p-4 text-hoja-700">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden />
            <div className="text-sm">
              <p className="font-semibold">Llegó</p>
              <p>
                <Fecha iso={asistioAt} conHora />
                {registradoPor && <> · registró {registradoPor}</>}
              </p>
              <p className="mt-1 font-medium">Kit entregado{tallaCorta && ` · talla ${tallaCorta}`}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-4 text-slate-600">
            <Clock className="mt-0.5 size-5 shrink-0" aria-hidden />
            <p className="text-sm">
              <span className="font-semibold">Aún no llega.</span> Se registra al leer su QR en la entrada, y ahí
              mismo recibe su kit{tallaCorta && ` (talla ${tallaCorta})`}.
            </p>
          </div>
        )}
        {puedeRegistrar &&
          (asistioAt ? (
            <Boton variante="secundario" tamano="sm" disabled={pendiente} onClick={() => setConfirmarAnular(true)} className="w-full">
              Anular llegada
            </Boton>
          ) : (
            <Boton tamano="sm" disabled={pendiente} onClick={() => cambiar(true)} className="w-full">
              {pendiente ? "Registrando…" : "Marcar llegada a mano"}
            </Boton>
          ))}
      </div>

      <Dialogo abierto={confirmarAnular} alCerrar={() => setConfirmarAnular(false)} titulo="¿Anular la llegada?">
        <p className="text-sm text-slate-500">Úsalo solo para corregir un registro por error. Queda en la bitácora.</p>
        <div className="mt-5 flex justify-end gap-2">
          <Boton variante="secundario" onClick={() => setConfirmarAnular(false)}>
            Cancelar
          </Boton>
          <Boton variante="peligro" disabled={pendiente} onClick={() => cambiar(false)}>
            {pendiente ? "Anulando…" : "Anular"}
          </Boton>
        </div>
      </Dialogo>
    </Tarjeta>
  );
}

export function EliminarParticipante({ id, nombre }: { id: string; nombre: string }) {
  const [abierto, setAbierto] = useState(false);
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <Tarjeta className="border-red-100">
      <EncabezadoTarjeta titulo="Eliminar" />
      <div className="space-y-3 p-5 sm:p-6">
        <p className="text-sm text-slate-500">Borra la ficha, su foto y su QR. Si vuelve a venir en el Excel, se creará de nuevo.</p>
        <Boton variante="peligro" tamano="sm" className="w-full" onClick={() => setAbierto(true)}>
          <Trash2 className="size-3.5" aria-hidden />
          Eliminar participante
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
                const r = await eliminarParticipante(id);
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
