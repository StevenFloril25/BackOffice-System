import type { Metadata } from "next";
import Link from "next/link";
import { Package, Search } from "lucide-react";

import { Fecha } from "@/components/cliente";
import { SinAcceso } from "@/components/sin-acceso";
import { EncabezadoPagina, EncabezadoTarjeta, EstadoVacio, Insignia, Tarjeta, claseBoton } from "@/components/ui";
import { listarConsejeros } from "@/lib/organizacion";
import { TALLAS, listarParticipantes, nombreCompleto } from "@/lib/participantes";
import { exigirSesion, puede } from "@/lib/sesion";

export const metadata: Metadata = { title: "Entrega de kits" };

type Filtros = { q?: string; estado?: string };

const sinTildes = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const corta = (t: string | null) => t?.replace(" (unisex)", "") ?? null;

/**
 * El kit se entrega al llegar: registrar la llegada (QR o a mano) lo marca solo
 * y anularla lo deja pendiente. Esta página no marca nada; muestra cuántos
 * faltan y de qué talla, para preparar la mesa de entrega.
 */
export default async function PaginaKits({ searchParams }: { searchParams: Promise<Filtros> }) {
  const sesion = await exigirSesion();
  if (!puede(sesion, "kits.ver")) return <SinAcceso permiso="kits.ver" />;

  const f = await searchParams;
  const estado = f.estado === "entregados" || f.estado === "todos" ? f.estado : "pendientes";
  const [participantes, consejeros] = await Promise.all([listarParticipantes(), listarConsejeros()]);

  const entregados = participantes.filter((p) => p.kit_entregado_at).length;
  const pendientes = participantes.length - entregados;
  const pct = participantes.length ? Math.round((entregados / participantes.length) * 100) : 0;

  // Tallas: las conocidas en orden y después cualquier otra que venga en los datos.
  const otras = [...new Set([...participantes, ...consejeros].map((x) => x.talla_camiseta).filter((t): t is string => !!t && !TALLAS.includes(t)))];
  const filas = [...TALLAS, ...otras, null].map((talla) => {
    const deTalla = participantes.filter((p) => (p.talla_camiseta ?? null) === talla);
    return {
      talla,
      jovenes: deTalla.length,
      entregados: deTalla.filter((p) => p.kit_entregado_at).length,
      consejeros: consejeros.filter((c) => (c.talla_camiseta ?? null) === talla).length,
    };
  }).filter((f) => f.jovenes || f.consejeros);

  const texto = sinTildes((f.q ?? "").trim());
  const lista = participantes.filter((p) => {
    if (estado === "pendientes" && p.kit_entregado_at) return false;
    if (estado === "entregados" && !p.kit_entregado_at) return false;
    if (texto) {
      const pajar = sinTildes(`${p.nombres} ${p.apellidos} ${p.nombre_preferido} ${p.barrio?.nombre ?? ""}`);
      if (!texto.split(/\s+/).every((t) => pajar.includes(t))) return false;
    }
    return true;
  });

  return (
    <>
      <EncabezadoPagina
        titulo="Entrega de kits"
        descripcion="El kit se marca solo al registrar la llegada del participante (con su QR o a mano). Si se anula la llegada, el kit vuelve a quedar pendiente."
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Tarjeta className="flex items-center gap-4 p-5">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-slate-500">Kits entregados</p>
            <p className="text-3xl font-bold text-marca-950">
              {entregados}
              <span className="text-lg font-medium text-slate-400"> / {participantes.length}</span>
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-hoja-500" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-2 text-xs text-slate-500">{pendientes} pendientes</p>
          </div>
          <p className="text-2xl font-bold text-hoja-700">{pct}%</p>
        </Tarjeta>

        <Tarjeta className="lg:col-span-2">
          <EncabezadoTarjeta titulo="Camisetas por talla" descripcion="Para preparar la mesa de entrega y el pedido." />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  <th className="px-5 py-2.5">Talla</th>
                  <th className="px-3 py-2.5 text-right">Jóvenes</th>
                  <th className="px-3 py-2.5 text-right">Entregadas</th>
                  <th className="px-3 py-2.5 text-right">Por entregar</th>
                  <th className="px-5 py-2.5 text-right">Consejeros</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filas.map((fila) => (
                  <tr key={fila.talla ?? "sin"}>
                    <td className="px-5 py-2 font-semibold text-slate-800">{corta(fila.talla) ?? <span className="text-slate-400">Sin talla</span>}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{fila.jovenes}</td>
                    <td className="px-3 py-2 text-right text-hoja-700">{fila.entregados}</td>
                    <td className="px-3 py-2 text-right font-semibold text-marca-950">{fila.jovenes - fila.entregados}</td>
                    <td className="px-5 py-2 text-right text-slate-600">{fila.consejeros}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Tarjeta>
      </div>

      <Tarjeta>
        <form className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:px-5" role="search">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input name="q" defaultValue={f.q} placeholder="Nombre o barrio" aria-label="Buscar" className="entrada pl-10" />
          </div>
          <select name="estado" defaultValue={estado} aria-label="Estado del kit" className="entrada sm:w-44">
            <option value="pendientes">Pendientes</option>
            <option value="entregados">Entregados</option>
            <option value="todos">Todos</option>
          </select>
          <button type="submit" className={claseBoton("secundario")}>
            Filtrar
          </button>
        </form>

        {lista.length === 0 ? (
          <EstadoVacio
            icono={<Package className="size-5" />}
            titulo={estado === "pendientes" && !texto ? "No queda ningún kit por entregar" : "Nadie coincide"}
            descripcion={estado === "entregados" && !texto ? "Se marcan al registrar la llegada." : undefined}
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {lista.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/participantes/${p.id}`} className="block truncate text-sm font-semibold text-slate-800 hover:text-marca-700">
                    {nombreCompleto(p)}
                  </Link>
                  <p className="truncate text-xs text-slate-500">{[p.barrio?.nombre, p.compania ? `Compañía ${p.compania.numero}` : null].filter(Boolean).join(" · ")}</p>
                </div>
                <span className="w-12 shrink-0 text-center text-sm font-semibold text-slate-700">{corta(p.talla_camiseta) ?? "—"}</span>
                {p.kit_entregado_at ? (
                  <Insignia tono="hoja" punto>
                    <Fecha iso={p.kit_entregado_at} conHora />
                  </Insignia>
                ) : (
                  <Insignia tono="sol">Pendiente</Insignia>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
          {lista.length} de {participantes.length} participantes
        </p>
      </Tarjeta>
    </>
  );
}
