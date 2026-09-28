import type { Metadata } from "next";
import Link from "next/link";
import { History, Search } from "lucide-react";

import { Fecha } from "@/components/cliente";
import { SinAcceso } from "@/components/sin-acceso";
import { Avatar, EncabezadoPagina, EstadoVacio, Insignia, Tarjeta, claseBoton } from "@/components/ui";
import { exigirSesion, puede } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Bitácora" };

const POR_PAGINA = 30;

const ENTIDADES: Record<string, { etiqueta: string; tono: "marca" | "sol" | "hoja" | "neutro" }> = {
  usuario: { etiqueta: "Usuario", tono: "marca" },
  rol: { etiqueta: "Rol", tono: "sol" },
};

export default async function Bitacora({ searchParams }: { searchParams: Promise<{ q?: string; pagina?: string }> }) {
  const sesion = await exigirSesion();
  if (!puede(sesion, "auditoria.ver")) return <SinAcceso permiso="auditoria.ver" />;

  const { q = "", pagina = "1" } = await searchParams;
  const numero = Math.max(1, Number.parseInt(pagina, 10) || 1);
  const desde = (numero - 1) * POR_PAGINA;

  const supabase = await createClient();
  let consulta = supabase
    .from("audit_log")
    .select("id, actor_email, action, entity, summary, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(desde, desde + POR_PAGINA - 1);

  const texto = q.trim();
  if (texto) {
    // Las comas y paréntesis rompen la sintaxis de or() de PostgREST.
    const limpio = texto.replace(/[,()*%]/g, " ");
    consulta = consulta.or(`summary.ilike.%${limpio}%,actor_email.ilike.%${limpio}%`);
  }

  const { data, count } = await consulta;
  const filas = data ?? [];
  const total = count ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  const enlace = (n: number) => `/bitacora?${new URLSearchParams({ ...(texto ? { q: texto } : {}), pagina: String(n) })}`;

  return (
    <>
      <EncabezadoPagina titulo="Bitácora" descripcion="Registro de cada acción administrativa: quién hizo qué y cuándo." />

      <Tarjeta>
        <form className="flex gap-2 border-b border-slate-100 p-4 sm:px-5" role="search">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input name="q" defaultValue={q} placeholder="Buscar por descripción o por quién lo hizo" aria-label="Buscar" className="entrada pl-10" />
          </div>
          <button type="submit" className={claseBoton("secundario")}>
            Buscar
          </button>
        </form>

        {filas.length === 0 ? (
          <EstadoVacio
            icono={<History className="size-5" />}
            titulo={texto ? "Nada coincide con la búsqueda" : "La bitácora está vacía"}
            descripcion={texto ? undefined : "Aquí aparecerán las altas, cambios de rol, bloqueos y demás acciones."}
          />
        ) : (
          <ol className="divide-y divide-slate-100">
            {filas.map((f) => {
              const entidad = ENTIDADES[f.entity] ?? { etiqueta: f.entity, tono: "neutro" as const };
              return (
                <li key={f.id} className="flex items-start gap-3 px-5 py-4 sm:px-6">
                  <Avatar texto={f.actor_email ?? "sistema"} tamano="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-800">{f.summary}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                      <span>{f.actor_email ?? "Sistema"}</span>
                      <span aria-hidden>·</span>
                      <Fecha iso={f.created_at} conHora />
                      <Insignia tono={entidad.tono}>{entidad.etiqueta}</Insignia>
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {paginas > 1 && (
          <nav aria-label="Paginación" className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-sm">
            <span className="text-slate-500">
              Página {numero} de {paginas}
            </span>
            <div className="flex gap-2">
              {numero > 1 && (
                <Link href={enlace(numero - 1)} className={claseBoton("secundario", "sm")}>
                  Anterior
                </Link>
              )}
              {numero < paginas && (
                <Link href={enlace(numero + 1)} className={claseBoton("secundario", "sm")}>
                  Siguiente
                </Link>
              )}
            </div>
          </nav>
        )}
      </Tarjeta>
    </>
  );
}
