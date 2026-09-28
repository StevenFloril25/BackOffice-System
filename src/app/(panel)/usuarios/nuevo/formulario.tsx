"use client";

import clsx from "clsx";
import { CheckCircle2, KeyRound, Sparkles } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";

import { BotonEnviar, CopiarTexto, EntradaClave } from "@/components/cliente";
import { Alerta, Campo, EncabezadoTarjeta, Tarjeta, claseBoton } from "@/components/ui";
import type { RolOpcion } from "@/lib/usuarios";
import { crearUsuario } from "../actions";

/**
 * "Crear otro" cambia la key y React monta un formulario nuevo: es la forma de
 * volver el estado de la acción a cero sin recargar la página.
 */
export function FormularioNuevoUsuario({ roles }: { roles: RolOpcion[] }) {
  const [vuelta, setVuelta] = useState(0);
  return <Formulario key={vuelta} roles={roles} alCrearOtro={() => setVuelta((n) => n + 1)} />;
}

function Formulario({ roles, alCrearOtro }: { roles: RolOpcion[]; alCrearOtro: () => void }) {
  const [estado, accion] = useActionState(crearUsuario, undefined);
  const [modo, setModo] = useState<"generada" | "manual">("generada");
  const [rolId, setRolId] = useState("");
  const rolElegido = roles.find((r) => r.id === rolId);

  if (estado?.ok && estado.id) {
    return (
      <Tarjeta className="animar-entrada max-w-2xl">
        <div className="p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-hoja-100 text-hoja-700">
              <CheckCircle2 className="size-6" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-marca-950">Cuenta creada</h2>
              <p className="text-sm text-slate-500">Entrégale estos datos a la persona por un canal privado.</p>
            </div>
          </div>

          <dl className="mt-6 space-y-4">
            <div>
              <dt className="mb-1.5 text-sm font-medium text-slate-700">Correo</dt>
              <dd>
                <CopiarTexto texto={estado.email ?? ""} />
              </dd>
            </div>
            {estado.usuario && (
              <div>
                <dt className="mb-1.5 text-sm font-medium text-slate-700">Usuario (también sirve para ingresar)</dt>
                <dd>
                  <CopiarTexto texto={estado.usuario} />
                </dd>
              </div>
            )}
            {estado.clave && (
              <div>
                <dt className="mb-1.5 text-sm font-medium text-slate-700">Contraseña temporal</dt>
                <dd>
                  <CopiarTexto texto={estado.clave} />
                </dd>
              </div>
            )}
          </dl>

          {estado.clave && (
            <div className="mt-5">
              <Alerta tipo="aviso">
                Es la única vez que se muestra. Si se pierde, restablécela desde la ficha del usuario.
              </Alerta>
            </div>
          )}

          <div className="mt-7 flex flex-wrap gap-2">
            <Link href={`/usuarios/${estado.id}`} className={claseBoton("primario")}>
              Ver usuario
            </Link>
            <button type="button" onClick={alCrearOtro} className={claseBoton("secundario")}>
              Crear otro
            </button>
          </div>
        </div>
      </Tarjeta>
    );
  }

  const err = estado?.errores ?? {};
  const val = estado?.valores ?? {};

  return (
    <form action={accion} className="grid gap-6 lg:grid-cols-3">
      <Tarjeta className="lg:col-span-2">
        <EncabezadoTarjeta titulo="Datos de la persona" />
        <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
          {estado?.error && (
            <div className="sm:col-span-2">
              <Alerta tipo="error">{estado.error}</Alerta>
            </div>
          )}
          <Campo etiqueta="Nombre completo" htmlFor="full_name" error={err.full_name} className="sm:col-span-2">
            <input
              id="full_name"
              name="full_name"
              required
              autoFocus
              defaultValue={val.full_name}
              className="entrada"
              placeholder="Ej. María José Pérez"
            />
          </Campo>
          <Campo etiqueta="Correo electrónico" htmlFor="email" error={err.email} ayuda="Con este correo va a ingresar.">
            <input
              id="email"
              name="email"
              type="email"
              required
              defaultValue={val.email}
              className="entrada"
              placeholder="nombre@correo.com"
            />
          </Campo>
          <Campo
            etiqueta="Usuario"
            htmlFor="username"
            error={err.username}
            ayuda="Para ingresar sin correo. Si lo dejas vacío, se arma con el correo."
          >
            <input
              id="username"
              name="username"
              defaultValue={val.username}
              autoCapitalize="none"
              spellCheck={false}
              className="entrada"
              placeholder="maria.perez"
            />
          </Campo>
          <Campo etiqueta="Teléfono" htmlFor="phone" error={err.phone} ayuda="Opcional.">
            <input id="phone" name="phone" type="tel" defaultValue={val.phone} className="entrada" placeholder="+503 7000 0000" />
          </Campo>
          <Campo etiqueta="Rol" htmlFor="role_id" error={err.role_id} ayuda={rolElegido?.description}>
            <select
              id="role_id"
              name="role_id"
              required
              value={rolId}
              onChange={(e) => setRolId(e.target.value)}
              className="entrada"
            >
              <option value="" disabled>
                Elige el rol…
              </option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </Campo>
        </div>
      </Tarjeta>

      <div className="space-y-6">
        <Tarjeta>
          <EncabezadoTarjeta titulo="Contraseña inicial" />
          <div className="space-y-4 p-5 sm:p-6">
            <input type="hidden" name="modo_clave" value={modo} />
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Cómo definir la contraseña">
              <OpcionModo activa={modo === "generada"} onClick={() => setModo("generada")} icono={<Sparkles className="size-4" />}>
                Generar
              </OpcionModo>
              <OpcionModo activa={modo === "manual"} onClick={() => setModo("manual")} icono={<KeyRound className="size-4" />}>
                Escribirla
              </OpcionModo>
            </div>

            {modo === "generada" ? (
              <p className="text-sm text-slate-500">Se genera una contraseña segura y te la mostramos al crear la cuenta.</p>
            ) : (
              <Campo etiqueta="Contraseña" htmlFor="clave" error={err.clave} ayuda="Mínimo 8 caracteres, con letras y números.">
                <EntradaClave id="clave" name="clave" autoComplete="new-password" required minLength={8} />
              </Campo>
            )}

            <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm">
              <input type="checkbox" name="pedir_cambio" defaultChecked className="mt-0.5 size-4 accent-marca-700" />
              <span>
                <span className="font-medium text-slate-800">Pedir cambio al primer ingreso</span>
                <span className="mt-0.5 block text-xs text-slate-500">Recomendado: así solo la persona conoce su contraseña.</span>
              </span>
            </label>
          </div>
        </Tarjeta>

        <div className="flex gap-2">
          <BotonEnviar className="flex-1" pendiente="Creando…">
            Crear usuario
          </BotonEnviar>
          <Link href="/usuarios" className={claseBoton("secundario")}>
            Cancelar
          </Link>
        </div>
      </div>
    </form>
  );
}

function OpcionModo({
  activa,
  onClick,
  icono,
  children,
}: {
  activa: boolean;
  onClick: () => void;
  icono: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={activa}
      onClick={onClick}
      className={clsx(
        "flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition",
        activa
          ? "border-marca-500 bg-marca-50 text-marca-800 ring-4 ring-marca-500/10"
          : "border-slate-200 text-slate-600 hover:border-slate-300",
      )}
    >
      {icono}
      {children}
    </button>
  );
}
