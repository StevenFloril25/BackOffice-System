"use client";

import { Church, Mail, MessageCircle, Pencil, Phone, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

import { Dialogo } from "@/components/cliente";
import { Alerta, Boton, EstadoVacio, Tarjeta, claseBoton } from "@/components/ui";
import { eliminarBarrio } from "./actions";
import { DialogoBarrio, type BarrioEditable } from "./dialogo-barrio";

export interface BarrioConConteo extends BarrioEditable {
  participantes: number;
}

/** Número local de Ecuador (09xxxxxxxx) a formato internacional para WhatsApp. */
function enlaceWhatsApp(telefono: string) {
  let n = telefono.replace(/\D/g, "");
  if (n.startsWith("0")) n = `593${n.slice(1)}`;
  return `https://wa.me/${n}`;
}

export function ListaBarrios({
  barrios,
  puedeCrear,
  puedeEditar,
  puedeEliminar,
  verParticipantes,
}: {
  barrios: BarrioConConteo[];
  puedeCrear: boolean;
  puedeEditar: boolean;
  puedeEliminar: boolean;
  verParticipantes: boolean;
}) {
  const [dialogo, setDialogo] = useState<{ barrio: BarrioEditable | null } | null>(null);
  const [aBorrar, setABorrar] = useState<BarrioConConteo | null>(null);
  const [aviso, setAviso] = useState<{ tipo: "exito" | "error"; texto: string } | null>(null);
  const [borrando, iniciar] = useTransition();

  const estacas = useMemo(() => [...new Set(barrios.map((b) => b.estaca).filter(Boolean))], [barrios]);
  const grupos = useMemo(() => {
    const m = new Map<string, BarrioConConteo[]>();
    for (const b of barrios) m.set(b.estaca || "Sin estaca", [...(m.get(b.estaca || "Sin estaca") ?? []), b]);
    return [...m.entries()];
  }, [barrios]);

  const total = barrios.reduce((n, b) => n + b.participantes, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          {barrios.length} barrios · {estacas.length} estacas · {total} participantes
        </p>
        {puedeCrear && (
          <Boton onClick={() => setDialogo({ barrio: null })}>
            <Plus className="size-4" aria-hidden />
            Nuevo barrio
          </Boton>
        )}
      </div>

      {aviso && <Alerta tipo={aviso.tipo}>{aviso.texto}</Alerta>}

      {barrios.length === 0 ? (
        <Tarjeta>
          <EstadoVacio
            icono={<Church className="size-5" />}
            titulo="Todavía no hay barrios"
            descripcion="Se crean solos al importar la lista de participantes, o puedes agregarlos a mano."
          />
        </Tarjeta>
      ) : (
        grupos.map(([estaca, lista]) => (
          <Tarjeta key={estaca}>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
              <h2 className="font-semibold text-slate-900">{estaca}</h2>
              <span className="text-xs font-medium text-slate-500">
                {lista.length} barrios · {lista.reduce((n, b) => n + b.participantes, 0)} jóvenes
              </span>
            </div>
            <ul className="divide-y divide-slate-100">
              {lista.map((b) => (
                <li key={b.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
                  <div className="min-w-0 sm:w-56">
                    <p className="font-semibold text-slate-900">{b.nombre}</p>
                    {verParticipantes ? (
                      <Link href={`/participantes?barrio=${b.id}`} className="text-xs font-medium text-marca-600 hover:text-marca-800">
                        {b.participantes} participante{b.participantes === 1 ? "" : "s"}
                      </Link>
                    ) : (
                      <p className="text-xs text-slate-500">{b.participantes} participantes</p>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">Obispo</p>
                    <p className="truncate text-sm font-medium text-slate-800">{b.obispo_nombre || "Sin registrar"}</p>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      {b.obispo_correo ? (
                        <a href={`mailto:${b.obispo_correo}`} className="inline-flex items-center gap-1.5 text-slate-600 hover:text-marca-700">
                          <Mail className="size-3.5" aria-hidden />
                          {b.obispo_correo}
                        </a>
                      ) : (
                        <span className="text-slate-400">Sin correo</span>
                      )}
                      {b.obispo_telefono ? (
                        <>
                          <a href={`tel:${b.obispo_telefono}`} className="inline-flex items-center gap-1.5 text-slate-600 hover:text-marca-700">
                            <Phone className="size-3.5" aria-hidden />
                            {b.obispo_telefono}
                          </a>
                          <a
                            href={enlaceWhatsApp(b.obispo_telefono)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-hoja-700 hover:text-hoja-600"
                          >
                            <MessageCircle className="size-3.5" aria-hidden />
                            WhatsApp
                          </a>
                        </>
                      ) : (
                        <span className="text-slate-400">Sin teléfono</span>
                      )}
                    </div>
                  </div>
                  {(puedeEditar || puedeEliminar) && (
                    <div className="flex gap-1">
                      {puedeEditar && (
                        <button
                          type="button"
                          onClick={() => setDialogo({ barrio: b })}
                          className={claseBoton("fantasma", "sm")}
                          aria-label={`Editar ${b.nombre}`}
                        >
                          <Pencil className="size-3.5" aria-hidden />
                          Editar
                        </button>
                      )}
                      {puedeEliminar && (
                        <button
                          type="button"
                          onClick={() => setABorrar(b)}
                          disabled={b.participantes > 0}
                          title={b.participantes > 0 ? "Tiene participantes" : undefined}
                          className={claseBoton("fantasma", "sm", "text-red-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-40")}
                          aria-label={`Eliminar ${b.nombre}`}
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                        </button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Tarjeta>
        ))
      )}

      <DialogoBarrio
        abierto={dialogo !== null}
        alCerrar={() => setDialogo(null)}
        barrio={dialogo?.barrio ?? null}
        estacas={estacas}
        alGuardar={(g) => setAviso({ tipo: "exito", texto: `Barrio «${g.nombre}» guardado.` })}
      />

      <Dialogo abierto={aBorrar !== null} alCerrar={() => setABorrar(null)} titulo={`¿Eliminar ${aBorrar?.nombre ?? ""}?`}>
        <p className="text-sm text-slate-500">Se borra junto con los datos del obispo. No se puede deshacer.</p>
        <div className="mt-5 flex justify-end gap-2">
          <Boton variante="secundario" onClick={() => setABorrar(null)}>
            Cancelar
          </Boton>
          <Boton
            variante="peligro"
            disabled={borrando}
            onClick={() =>
              iniciar(async () => {
                if (!aBorrar) return;
                const r = await eliminarBarrio(aBorrar.id);
                setAviso(r.error ? { tipo: "error", texto: r.error } : { tipo: "exito", texto: r.ok ?? "Eliminado." });
                setABorrar(null);
              })
            }
          >
            {borrando ? "Eliminando…" : "Eliminar"}
          </Boton>
        </div>
      </Dialogo>
    </div>
  );
}
