"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { useState, useTransition } from "react";

import { Fecha } from "@/components/cliente";
import { Alerta, Boton, Tarjeta } from "@/components/ui";
import { registrarPorQr, type ResultadoLectura } from "../actions";
import { AvisoLectura } from "../lector";

export function ConfirmarLlegada({ token }: { token: string }) {
  const [resultado, setResultado] = useState<ResultadoLectura | null>(null);
  const [pendiente, iniciar] = useTransition();

  if (!resultado) {
    return (
      <Tarjeta className="space-y-4 p-6 text-center">
        <p className="text-slate-600">Se leyó un código de participante. ¿Registrar su llegada ahora?</p>
        <Boton className="w-full" disabled={pendiente} onClick={() => iniciar(async () => setResultado(await registrarPorQr(token)))}>
          {pendiente ? "Registrando…" : "Registrar llegada"}
        </Boton>
      </Tarjeta>
    );
  }

  const p = resultado.participante;
  const nombre = p ? p.nombre_preferido || `${p.nombres} ${p.apellidos}` : "";
  return (
    <Tarjeta className="space-y-4 p-6 text-center">
      <AvisoLectura resultado={resultado} />
      {resultado.estado === "registrado" && (
        <>
          <CheckCircle2 className="mx-auto size-12 text-hoja-600" aria-hidden />
          <p className="text-lg font-bold text-slate-900">{nombre}</p>
          <p className="text-sm text-slate-500">{p?.barrio}</p>
          <Alerta tipo="exito">Llegada registrada.</Alerta>
        </>
      )}
      {resultado.estado === "ya_registrado" && (
        <>
          <p className="text-lg font-bold text-slate-900">{nombre}</p>
          <Alerta tipo="aviso">
            Ya estaba registrado {p?.asistio_at && <Fecha iso={p.asistio_at} relativa />}.
          </Alerta>
        </>
      )}
      {(resultado.estado === "no_encontrado" || resultado.estado === "no_valido" || resultado.estado === "error") && (
        <>
          <XCircle className="mx-auto size-12 text-red-500" aria-hidden />
          <Alerta tipo="error">{resultado.mensaje ?? "Este código no corresponde a ningún participante."}</Alerta>
        </>
      )}
    </Tarjeta>
  );
}
