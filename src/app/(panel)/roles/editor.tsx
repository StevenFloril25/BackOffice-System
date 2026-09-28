"use client";

import clsx from "clsx";
import { Check } from "lucide-react";
import Link from "@/components/enlace";
import { useActionState, useMemo, useState } from "react";

import { BotonEnviar } from "@/components/cliente";
import { Icono } from "@/components/iconos";
import { Alerta, Campo, EncabezadoTarjeta, Tarjeta, claseBoton } from "@/components/ui";
import type { ModuloCatalogo } from "@/lib/roles";
import { guardarRol } from "./actions";

interface Props {
  rolId: string | null;
  catalogo: ModuloCatalogo[];
  inicial: { name: string; description: string; permisos: string[] };
  editable: boolean;
  aviso?: string;
}

/**
 * Editor de un rol: datos y matriz de permisos por módulo. La matriz se arma
 * del catálogo de la base, así que un módulo nuevo aparece aquí sin tocar
 * este componente.
 *
 * Regla de consistencia: cualquier acción de un módulo implica poder verlo.
 * Marcar "crear" marca "ver"; desmarcar "ver" desmarca todo el módulo.
 */
export function EditorRol({ rolId, catalogo, inicial, editable, aviso }: Props) {
  const [estado, accion] = useActionState(guardarRol.bind(null, rolId), undefined);
  const base = estado?.valores ?? inicial;
  const [seleccion, setSeleccion] = useState<Set<string>>(() => new Set(base.permisos));

  const total = useMemo(() => catalogo.reduce((n, m) => n + m.permisos.length, 0), [catalogo]);

  function alternar(modulo: ModuloCatalogo, clave: string) {
    setSeleccion((previa) => {
      const s = new Set(previa);
      const ver = modulo.permisos.find((p) => p.action === "ver")?.key;
      if (s.has(clave)) {
        s.delete(clave);
        if (clave === ver) modulo.permisos.forEach((p) => s.delete(p.key));
      } else {
        s.add(clave);
        if (ver) s.add(ver);
      }
      return s;
    });
  }

  function alternarModulo(modulo: ModuloCatalogo, marcar: boolean) {
    setSeleccion((previa) => {
      const s = new Set(previa);
      modulo.permisos.forEach((p) => (marcar ? s.add(p.key) : s.delete(p.key)));
      return s;
    });
  }

  function todo(marcar: boolean) {
    setSeleccion(marcar ? new Set(catalogo.flatMap((m) => m.permisos.map((p) => p.key))) : new Set());
  }

  return (
    <form action={accion} className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-1">
        <Tarjeta className="lg:sticky lg:top-6">
          <EncabezadoTarjeta titulo="Datos del rol" />
          <fieldset disabled={!editable} className="space-y-5 p-5 sm:p-6">
            {estado?.error && <Alerta tipo="error">{estado.error}</Alerta>}
            {(estado?.ok || aviso) && <Alerta tipo="exito">{estado?.ok ?? aviso}</Alerta>}
            <Campo etiqueta="Nombre" htmlFor="name">
              <input
                id="name"
                name="name"
                required
                minLength={2}
                maxLength={60}
                defaultValue={base.name}
                placeholder="Ej. Coordinador general"
                className="entrada"
              />
            </Campo>
            <Campo etiqueta="Descripción" htmlFor="description" ayuda="Qué hace quien tiene este rol. Ayuda al asignarlo.">
              <textarea
                id="description"
                name="description"
                rows={4}
                maxLength={300}
                defaultValue={base.description}
                className="entrada resize-none"
              />
            </Campo>

            <div className="rounded-xl bg-menta-50 p-4">
              <p className="text-xs font-medium text-slate-500">Permisos seleccionados</p>
              <p className="mt-1 text-2xl font-bold text-marca-950">
                {seleccion.size}
                <span className="text-base font-medium text-slate-400"> / {total}</span>
              </p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-hoja-500 to-marca-500 transition-all"
                  style={{ width: `${total ? (seleccion.size / total) * 100 : 0}%` }}
                />
              </div>
            </div>
          </fieldset>
          {editable && (
            <div className="flex gap-2 border-t border-slate-100 px-5 py-4 sm:px-6">
              <BotonEnviar className="flex-1" pendiente="Guardando…">
                {rolId ? "Guardar cambios" : "Crear rol"}
              </BotonEnviar>
              <Link href="/roles" className={claseBoton("secundario")}>
                {rolId ? "Volver" : "Cancelar"}
              </Link>
            </div>
          )}
        </Tarjeta>
      </div>

      <Tarjeta className="lg:col-span-2">
        <EncabezadoTarjeta
          titulo="Permisos por módulo"
          descripcion="Cualquier acción incluye poder ver el módulo."
          acciones={
            editable && (
              <div className="flex gap-1">
                <button type="button" onClick={() => todo(true)} className={claseBoton("fantasma", "sm")}>
                  Marcar todo
                </button>
                <button type="button" onClick={() => todo(false)} className={claseBoton("fantasma", "sm")}>
                  Quitar todo
                </button>
              </div>
            )
          }
        />

        {/* El valor enviado sale de aquí, no de los botones: así el formulario
            manda exactamente lo que se ve. */}
        {[...seleccion].map((k) => (
          <input key={k} type="hidden" name="permisos" value={k} />
        ))}

        <ul className="divide-y divide-slate-100">
          {catalogo.map((modulo) => {
            const marcados = modulo.permisos.filter((p) => seleccion.has(p.key)).length;
            const completo = marcados === modulo.permisos.length && marcados > 0;
            return (
              <li key={modulo.key} className="px-5 py-5 sm:px-6">
                <div className="flex items-start gap-4">
                  <span
                    className={clsx(
                      "flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors",
                      marcados ? "bg-marca-700 text-white" : "bg-slate-100 text-slate-400",
                    )}
                  >
                    <Icono nombre={modulo.icon} className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-900">{modulo.name}</p>
                        <p className="text-sm text-slate-500">{modulo.description}</p>
                      </div>
                      {editable && (
                        <button
                          type="button"
                          onClick={() => alternarModulo(modulo, !completo)}
                          className="text-xs font-semibold text-marca-600 hover:text-marca-800"
                        >
                          {completo ? "Quitar módulo" : "Todo el módulo"}
                        </button>
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {modulo.permisos.map((p) => {
                        const activo = seleccion.has(p.key);
                        return (
                          <button
                            key={p.key}
                            type="button"
                            disabled={!editable}
                            aria-pressed={activo}
                            title={p.description}
                            onClick={() => alternar(modulo, p.key)}
                            className={clsx(
                              "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition",
                              activo
                                ? "border-marca-600 bg-marca-600 text-white shadow-sm shadow-marca-900/20"
                                : "border-slate-200 bg-white text-slate-600 hover:border-marca-300 hover:text-marca-700",
                              !editable && "cursor-default",
                            )}
                          >
                            <span
                              className={clsx(
                                "flex size-4 items-center justify-center rounded-full",
                                activo ? "bg-white/25" : "border border-slate-300",
                              )}
                            >
                              {activo && <Check className="size-3" strokeWidth={3} />}
                            </span>
                            {p.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </Tarjeta>
    </form>
  );
}
