"use client";

import { KeyRound, Power, Trash2 } from "lucide-react";
import { useActionState, useEffect, useState } from "react";

import { BotonEnviar, CopiarTexto, Dialogo } from "@/components/cliente";
import { Alerta, Boton, EncabezadoTarjeta, Tarjeta } from "@/components/ui";
import { cambiarEstadoUsuario, eliminarUsuario, restablecerClave } from "../actions";

type Abierto = null | "estado" | "clave" | "eliminar";

export function AccionesCuenta({
  id,
  nombre,
  activo,
  puedeEditar,
  puedeEliminar,
}: {
  id: string;
  nombre: string;
  activo: boolean;
  puedeEditar: boolean;
  puedeEliminar: boolean;
}) {
  const [abierto, setAbierto] = useState<Abierto>(null);
  const [aviso, setAviso] = useState<{ tipo: "exito" | "error"; texto: string } | null>(null);
  const cerrar = () => setAbierto(null);

  return (
    <Tarjeta>
      <EncabezadoTarjeta titulo="Cuenta" />
      <div className="space-y-2 p-4">
        {aviso && <Alerta tipo={aviso.tipo}>{aviso.texto}</Alerta>}

        {puedeEditar && (
          <>
            <Opcion
              icono={<Power className="size-4" />}
              titulo={activo ? "Desactivar cuenta" : "Activar cuenta"}
              descripcion={activo ? "No podrá ingresar hasta que la reactives." : "Podrá volver a ingresar."}
              onClick={() => setAbierto("estado")}
            />
            <Opcion
              icono={<KeyRound className="size-4" />}
              titulo="Restablecer contraseña"
              descripcion="Genera una temporal que deberá cambiar al ingresar."
              onClick={() => setAbierto("clave")}
            />
          </>
        )}
        {puedeEliminar && (
          <Opcion
            peligro
            icono={<Trash2 className="size-4" />}
            titulo="Eliminar cuenta"
            descripcion="Borra la cuenta de forma definitiva."
            onClick={() => setAbierto("eliminar")}
          />
        )}
      </div>

      {/* Cada diálogo monta su contenido al abrirse: el estado de la acción
          empieza limpio cada vez (no se ve la contraseña de la vez anterior). */}
      <Dialogo abierto={abierto === "estado"} alCerrar={cerrar} titulo={activo ? `¿Desactivar a ${nombre}?` : `¿Activar a ${nombre}?`}>
        <ContenidoEstado
          id={id}
          activo={activo}
          alCancelar={cerrar}
          alTerminar={(r) => {
            setAviso(r);
            cerrar();
          }}
        />
      </Dialogo>

      <Dialogo abierto={abierto === "clave"} alCerrar={cerrar} titulo="Restablecer contraseña">
        <ContenidoClave id={id} nombre={nombre} alCerrar={cerrar} />
      </Dialogo>

      <Dialogo abierto={abierto === "eliminar"} alCerrar={cerrar} titulo={`¿Eliminar a ${nombre}?`}>
        <ContenidoEliminar id={id} alCancelar={cerrar} />
      </Dialogo>
    </Tarjeta>
  );
}

function ContenidoEstado({
  id,
  activo,
  alCancelar,
  alTerminar,
}: {
  id: string;
  activo: boolean;
  alCancelar: () => void;
  alTerminar: (r: { tipo: "exito" | "error"; texto: string }) => void;
}) {
  const [estado, accion] = useActionState(cambiarEstadoUsuario.bind(null, id, !activo), undefined);

  useEffect(() => {
    if (estado?.ok) alTerminar({ tipo: "exito", texto: estado.ok });
  }, [estado, alTerminar]);

  return (
    <form action={accion} className="space-y-5">
      <p className="text-sm text-slate-500">
        {activo
          ? "Se cierra su acceso: no podrá ingresar ni renovar su sesión. Sus datos se conservan y puedes reactivarla cuando quieras."
          : "Podrá volver a ingresar con su contraseña actual."}
      </p>
      {estado?.error && <Alerta tipo="error">{estado.error}</Alerta>}
      <div className="flex justify-end gap-2">
        <Boton type="button" variante="secundario" onClick={alCancelar}>
          Cancelar
        </Boton>
        <BotonEnviar variante={activo ? "peligro" : "primario"} pendiente={activo ? "Desactivando…" : "Activando…"}>
          {activo ? "Desactivar" : "Activar"}
        </BotonEnviar>
      </div>
    </form>
  );
}

function ContenidoClave({ id, nombre, alCerrar }: { id: string; nombre: string; alCerrar: () => void }) {
  const [estado, accion] = useActionState(restablecerClave.bind(null, id), undefined);

  if (estado?.clave) {
    return (
      <div className="space-y-4">
        <Alerta tipo="exito">Listo. Al ingresar se le pedirá definir una contraseña propia.</Alerta>
        <CopiarTexto texto={estado.clave} />
        <p className="text-xs text-slate-500">Es la única vez que se muestra. Entrégala por un canal privado.</p>
        <div className="flex justify-end">
          <Boton type="button" onClick={alCerrar}>
            Listo
          </Boton>
        </div>
      </div>
    );
  }

  return (
    <form action={accion} className="space-y-5">
      <p className="text-sm text-slate-500">
        Se generará una contraseña temporal para {nombre}. La actual deja de funcionar en ese momento.
      </p>
      {estado?.error && <Alerta tipo="error">{estado.error}</Alerta>}
      <div className="flex justify-end gap-2">
        <Boton type="button" variante="secundario" onClick={alCerrar}>
          Cancelar
        </Boton>
        <BotonEnviar pendiente="Generando…">Generar contraseña</BotonEnviar>
      </div>
    </form>
  );
}

function ContenidoEliminar({ id, alCancelar }: { id: string; alCancelar: () => void }) {
  const [estado, accion] = useActionState(eliminarUsuario.bind(null, id), undefined);
  const [confirmacion, setConfirmacion] = useState("");

  return (
    <form action={accion} className="space-y-4">
      <p className="text-sm text-slate-500">
        No se puede deshacer. Si solo quieres quitarle el acceso, mejor desactiva la cuenta.
      </p>
      {estado?.error && <Alerta tipo="error">{estado.error}</Alerta>}
      <label className="block text-sm text-slate-600">
        Escribe <strong className="font-semibold text-slate-900">ELIMINAR</strong> para confirmar
        <input value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} className="entrada mt-1.5" autoComplete="off" />
      </label>
      <div className="flex justify-end gap-2">
        <Boton type="button" variante="secundario" onClick={alCancelar}>
          Cancelar
        </Boton>
        <BotonEnviar variante="peligro" disabled={confirmacion.trim().toUpperCase() !== "ELIMINAR"} pendiente="Eliminando…">
          Eliminar definitivamente
        </BotonEnviar>
      </div>
    </form>
  );
}

function Opcion({
  icono,
  titulo,
  descripcion,
  onClick,
  peligro,
}: {
  icono: React.ReactNode;
  titulo: string;
  descripcion: string;
  onClick: () => void;
  peligro?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-xl p-3 text-left transition ${peligro ? "hover:bg-red-50" : "hover:bg-menta-50"}`}
    >
      <span
        className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${peligro ? "bg-red-50 text-red-600" : "bg-marca-50 text-marca-700"}`}
      >
        {icono}
      </span>
      <span className="min-w-0">
        <span className={`block text-sm font-semibold ${peligro ? "text-red-700" : "text-slate-800"}`}>{titulo}</span>
        <span className="block text-xs text-slate-500">{descripcion}</span>
      </span>
    </button>
  );
}
