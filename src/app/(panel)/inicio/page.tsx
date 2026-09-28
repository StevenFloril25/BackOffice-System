import type { Metadata } from "next";
import Link from "@/components/enlace";
import { ArrowRight, History, ShieldCheck, UserCheck, UserPlus, Users } from "lucide-react";

import { Fecha } from "@/components/cliente";
import { Icono } from "@/components/iconos";
import { Alerta, Avatar, EncabezadoTarjeta, EnlaceBoton, Tarjeta } from "@/components/ui";
import { cargarAgenda } from "@/lib/agenda-datos";
import { MENU } from "@/lib/navegacion";
import { catalogoPermisos, resumenRoles } from "@/lib/roles";
import { exigirSesion, puede } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { listarUsuarios } from "@/lib/usuarios";
import { AhoraEnLaSesion } from "../agenda/cliente";

export const metadata: Metadata = { title: "Inicio" };

export default async function Inicio() {
  const sesion = await exigirSesion();
  const verUsuarios = puede(sesion, "usuarios.ver");
  const verRoles = puede(sesion, "roles.ver");
  const verBitacora = puede(sesion, "auditoria.ver");

  const supabase = await createClient();
  const [agenda, usuarios, roles, catalogo, actividad] = await Promise.all([
    puede(sesion, "agenda.ver") ? cargarAgenda() : Promise.resolve(null),
    verUsuarios ? listarUsuarios() : Promise.resolve(null),
    verRoles ? resumenRoles() : Promise.resolve(null),
    catalogoPermisos(),
    verBitacora
      ? supabase
          .from("audit_log")
          .select("id, actor_email, summary, action, created_at")
          .order("created_at", { ascending: false })
          .limit(6)
          .then((r) => r.data ?? [])
      : Promise.resolve(null),
  ]);

  const primerNombre = sesion.nombre.split(" ")[0] || sesion.email;
  const accesos = MENU.flatMap((s) => s.items).filter(
    (i) => i.permiso && puede(sesion, i.permiso) && !(sesion.esAdmin && i.ocultarAlAdmin),
  );
  const misModulos = catalogo
    .map((m) => ({ ...m, acciones: m.permisos.filter((p) => puede(sesion, p.key)) }))
    .filter((m) => m.acciones.length > 0);

  return (
    <>
      {/* Bienvenida */}
      <section className="relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-marca-700 via-marca-800 to-marca-950 px-6 py-8 text-white shadow-flotante/30 sm:px-10 sm:py-10">
        <svg aria-hidden viewBox="0 0 800 120" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-24 w-full">
          <path d="M0 80 C 200 20, 420 130, 800 50 L 800 120 L 0 120 Z" className="fill-hoja-500/30" />
          <path d="M0 100 C 240 60, 460 140, 800 90 L 800 120 L 0 120 Z" className="fill-marca-300/20" />
        </svg>
        {/* Después de las olas: si quedara detrás, su transparencia teñiría el sol. */}
        <div
          aria-hidden
          className="absolute -top-12 -right-10 size-32 rounded-full bg-sol-400 sm:-top-20 sm:-right-8 sm:size-56"
        />
        <div className="relative max-w-xl">
          <p className="text-sm font-medium text-marca-200">{sesion.rol?.name ?? "Sin rol asignado"}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">Hola, {primerNombre}</h1>
          <p className="mt-2 text-marca-100/90">
            {accesos.length > 0
              ? "Esto es lo que está pasando en el sistema."
              : "Todavía no tienes módulos asignados. Un administrador puede darte acceso."}
          </p>
        </div>
      </section>

      {/* Durante la sesión: qué toca ahora y qué sigue (solo aparece los días de la sesión). */}
      {agenda && <AhoraEnLaSesion dias={agenda.dias} actividades={agenda.actividades} enlace />}

      {!sesion.rol && (
        <div className="mb-8">
          <Alerta tipo="aviso" titulo="Tu cuenta no tiene un rol">
            Puedes ingresar, pero no verás ningún módulo hasta que un administrador te asigne un rol.
          </Alerta>
        </div>
      )}

      {/* Indicadores */}
      {(usuarios || roles) && (
        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {usuarios && (
            <>
              <Indicador icono={<Users className="size-5" />} etiqueta="Usuarios" valor={usuarios.length} href="/usuarios" />
              <Indicador
                icono={<UserCheck className="size-5" />}
                etiqueta="Activos"
                valor={usuarios.filter((u) => u.active).length}
                tono="hoja"
                href="/usuarios?estado=activos"
              />
              <Indicador
                icono={<UserPlus className="size-5" />}
                etiqueta="Sin ingresar aún"
                valor={usuarios.filter((u) => u.active && !u.last_sign_in_at).length}
                tono="sol"
                href="/usuarios"
              />
            </>
          )}
          {roles && (
            <Indicador icono={<ShieldCheck className="size-5" />} etiqueta="Roles" valor={roles.length} href="/roles" />
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {accesos.length > 0 && (
            <Tarjeta>
              <EncabezadoTarjeta titulo="Accesos rápidos" />
              <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
                {accesos.map((a) => (
                  <Link
                    key={a.href}
                    href={a.href}
                    className="group flex items-center gap-3 rounded-2xl border border-slate-200/80 p-4 transition hover:border-marca-200 hover:bg-menta-50"
                  >
                    <span className="flex size-10 items-center justify-center rounded-xl bg-marca-50 text-marca-700 group-hover:bg-marca-700 group-hover:text-white">
                      <Icono nombre={a.icono} className="size-5" />
                    </span>
                    <span className="flex-1 font-semibold text-slate-800">{a.etiqueta}</span>
                    <ArrowRight className="size-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-marca-600" />
                  </Link>
                ))}
              </div>
            </Tarjeta>
          )}

          {actividad && (
            <Tarjeta>
              <EncabezadoTarjeta
                titulo="Actividad reciente"
                acciones={
                  <EnlaceBoton href="/bitacora" variante="fantasma" tamano="sm">
                    Ver todo
                  </EnlaceBoton>
                }
              />
              {actividad.length === 0 ? (
                <p className="px-6 py-8 text-center text-sm text-slate-500">Sin movimientos todavía.</p>
              ) : (
                <ol className="divide-y divide-slate-100">
                  {actividad.map((a) => (
                    <li key={a.id} className="flex items-start gap-3 px-5 py-3.5 sm:px-6">
                      <Avatar texto={a.actor_email ?? "sistema"} tamano="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-slate-800">{a.summary}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {a.actor_email ?? "Sistema"} · <Fecha iso={a.created_at} relativa />
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </Tarjeta>
          )}
        </div>

        <Tarjeta className="h-fit">
          <EncabezadoTarjeta
            titulo="Tu acceso"
            descripcion={sesion.esAdmin ? "Administrador: acceso total." : "Lo que tu rol te permite hacer."}
          />
          {misModulos.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-slate-500">Sin permisos asignados.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {misModulos.map((m) => (
                <li key={m.key} className="flex items-start gap-3 px-5 py-3.5 sm:px-6">
                  <Icono nombre={m.icon} className="mt-0.5 size-4 text-marca-600" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{m.name}</p>
                    <p className="text-xs text-slate-500">{m.acciones.map((a) => a.label).join(" · ")}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {verBitacora && (
            <div className="border-t border-slate-100 px-5 py-3 sm:px-6">
              <Link href="/bitacora" className="flex items-center gap-2 text-xs font-semibold text-marca-600 hover:text-marca-800">
                <History className="size-3.5" /> Revisar la bitácora
              </Link>
            </div>
          )}
        </Tarjeta>
      </div>
    </>
  );
}

function Indicador({
  icono,
  etiqueta,
  valor,
  href,
  tono = "marca",
}: {
  icono: React.ReactNode;
  etiqueta: string;
  valor: number;
  href: string;
  tono?: "marca" | "hoja" | "sol";
}) {
  const colores = {
    marca: "bg-marca-50 text-marca-700",
    hoja: "bg-hoja-100 text-hoja-700",
    sol: "bg-sol-100 text-sol-600",
  }[tono];
  return (
    <Link href={href} className="group">
      <Tarjeta className="flex items-center gap-4 p-4 transition group-hover:border-marca-200 sm:p-5">
        <span className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${colores}`}>{icono}</span>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-slate-500">{etiqueta}</p>
          <p className="text-2xl font-bold text-marca-950">{valor}</p>
        </div>
      </Tarjeta>
    </Link>
  );
}
