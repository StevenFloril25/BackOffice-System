"use client";

import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { Dialogo } from "@/components/cliente";
import { EditorFoto } from "@/components/foto";
import { Alerta, Boton, EncabezadoTarjeta, Insignia, Tarjeta, claseBoton } from "@/components/ui";
import { crearCuentaConsejero, eliminarConsejero, quitarFotoConsejero, subirFotoConsejero, type EstadoConsejero } from "../actions";
import { DatosAcceso } from "../formulario";

export function FotoConsejero({ id, url, texto, editable }: { id: string; url: string | null; texto: string; editable: boolean }) {
  return (
    <EditorFoto
      url={url}
      texto={texto}
      forma="carnet"
      editable={editable}
      subir={(datos) => subirFotoConsejero(id, datos)}
      quitar={() => quitarFotoConsejero(id)}
    />
  );
}

export function EliminarConsejero({ id, nombre, asignado }: { id: string; nombre: string; asignado: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <Tarjeta className="border-red-100">
      <EncabezadoTarjeta titulo="Eliminar" />
      <div className="space-y-3 p-5 sm:p-6">
        <p className="text-sm text-slate-500">
          Borra la ficha, su foto y su cuenta de acceso.{asignado && " Su lugar en la compañía y su cama quedan libres."}
        </p>
        <Boton variante="peligro" tamano="sm" className="w-full" onClick={() => setAbierto(true)}>
          <Trash2 className="size-3.5" aria-hidden />
          Eliminar consejero
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
                const r = await eliminarConsejero(id);
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

export interface CuentaResumen {
  id: string;
  usuario: string | null;
  email: string;
  rol: string | null;
  activa: boolean;
}

/** Cuenta con la que el consejero ingresa (rol Consejero): ver, administrar o crearla si no tiene. */
export function CuentaConsejero({
  id,
  cuenta,
  verUsuarios,
  puedeCrear,
}: {
  id: string;
  cuenta: CuentaResumen | null;
  verUsuarios: boolean;
  puedeCrear: boolean;
}) {
  const [pendiente, iniciar] = useTransition();
  const [resultado, setResultado] = useState<EstadoConsejero | null>(null);

  return (
    <Tarjeta>
      <EncabezadoTarjeta titulo="Cuenta de acceso" descripcion="Con ella ve las habitaciones y su compañía." />
      <div className="space-y-3 p-5 sm:p-6">
        {resultado?.error && <Alerta tipo="error">{resultado.error}</Alerta>}
        {resultado?.ok ? (
          <>
            <Alerta tipo="exito">{resultado.ok}</Alerta>
            <DatosAcceso email={resultado.email} usuario={resultado.usuario} clave={resultado.clave} />
          </>
        ) : cuenta ? (
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Usuario</dt>
              <dd className="font-semibold text-slate-800">{cuenta.usuario ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Rol</dt>
              <dd>
                <Insignia tono="marca">{cuenta.rol ?? "Sin rol"}</Insignia>
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Estado</dt>
              <dd>{cuenta.activa ? <Insignia tono="hoja" punto>Activa</Insignia> : <Insignia tono="rojo">Desactivada</Insignia>}</dd>
            </div>
            {verUsuarios && (
              <Link href={`/usuarios/${cuenta.id}`} className={claseBoton("secundario", "sm", "mt-2 w-full")}>
                Administrar cuenta (contraseña, activar…)
              </Link>
            )}
          </dl>
        ) : (
          <>
            <p className="text-sm text-slate-500">Todavía no tiene cuenta para ingresar.</p>
            {puedeCrear && (
              <Boton
                tamano="sm"
                className="w-full"
                disabled={pendiente}
                onClick={() => iniciar(async () => setResultado(await crearCuentaConsejero(id)))}
              >
                {pendiente ? "Creando…" : "Crear su cuenta"}
              </Boton>
            )}
          </>
        )}
      </div>
    </Tarjeta>
  );
}
