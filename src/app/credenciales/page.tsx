import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { SinAcceso } from "@/components/sin-acceso";
import { urlsFotos } from "@/lib/fotos";
import { MARCA } from "@/lib/marca";
import { listarBarriosOpciones, listarParticipantes, nombreCompleto } from "@/lib/participantes";
import { qrSvg, urlAsistencia } from "@/lib/qr";
import { exigirSesion, puede } from "@/lib/sesion";
import { iniciales } from "@/lib/utilidades";
import { BotonImprimir } from "./imprimir";

export const metadata: Metadata = { title: "Credenciales" };
export const dynamic = "force-dynamic";

const POR_HOJA = 8;

/**
 * Credenciales para imprimir: 8 por hoja A4 (2 × 4), para recortar y entregar
 * por barrio. Fuera del panel a propósito: sin menú lateral, lo que se ve es
 * lo que sale en papel.
 */
export default async function Credenciales({
  searchParams,
}: {
  searchParams: Promise<{ barrio?: string; estaca?: string; id?: string; canceladas?: string }>;
}) {
  const sesion = await exigirSesion();
  if (!puede(sesion, "participantes.ver")) {
    return (
      <main className="p-6">
        <SinAcceso permiso="participantes.ver" />
      </main>
    );
  }

  const f = await searchParams;
  const [todos, barrios] = await Promise.all([listarParticipantes(), listarBarriosOpciones()]);
  const lista = todos
    .filter((p) => (f.id ? p.id === f.id : true))
    .filter((p) => (f.barrio ? p.barrio_id === f.barrio : true))
    .filter((p) => (f.estaca ? p.barrio?.estaca === f.estaca : true))
    .filter((p) => (f.id || f.canceladas ? true : p.estado_inscripcion !== "Cancelado"))
    .sort(
      (a, b) =>
        (a.barrio?.estaca ?? "").localeCompare(b.barrio?.estaca ?? "") ||
        (a.barrio?.nombre ?? "").localeCompare(b.barrio?.nombre ?? "") ||
        a.apellidos.localeCompare(b.apellidos),
    );

  const fotos = await urlsFotos(lista.map((p) => p.foto_path));
  const tarjetas = await Promise.all(
    lista.map(async (p) => ({ p, svg: await qrSvg(await urlAsistencia(p.qr_token)) })),
  );
  const hojas: (typeof tarjetas)[] = [];
  for (let i = 0; i < tarjetas.length; i += POR_HOJA) hojas.push(tarjetas.slice(i, i + POR_HOJA));
  const estacas = [...new Set(barrios.map((b) => b.estaca).filter(Boolean))];

  return (
    <main className="min-h-screen bg-slate-100 print:bg-white">
      <style>{`@page { size: A4; margin: 8mm; } @media print { .hoja { break-after: page; } .hoja:last-child { break-after: auto; } }`}</style>

      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur print:hidden">
        <form className="mx-auto flex max-w-5xl flex-wrap items-center gap-2">
          <Link href="/participantes" className="mr-2 text-sm font-semibold text-marca-700 hover:text-marca-900">
            ← Volver
          </Link>
          <select name="estaca" defaultValue={f.estaca ?? ""} className="entrada w-auto py-1.5 text-sm" aria-label="Estaca">
            <option value="">Todas las estacas</option>
            {estacas.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
          <select name="barrio" defaultValue={f.barrio ?? ""} className="entrada w-auto py-1.5 text-sm" aria-label="Barrio">
            <option value="">Todos los barrios</option>
            {barrios.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold hover:bg-slate-50">
            Filtrar
          </button>
          <span className="ml-auto text-sm text-slate-500">
            {lista.length} credenciales · {hojas.length} hoja{hojas.length === 1 ? "" : "s"}
          </span>
          <BotonImprimir />
        </form>
      </div>

      <div className="mx-auto flex flex-col items-center gap-6 py-6 print:block print:py-0">
        {hojas.length === 0 && <p className="text-slate-500">No hay participantes con ese filtro.</p>}
        {hojas.map((hoja, i) => (
          <section
            key={i}
            className="hoja grid w-[194mm] grid-cols-2 gap-[3mm] bg-white p-[3mm] shadow print:w-auto print:p-0 print:shadow-none"
            style={{ gridAutoRows: "68mm" }}
          >
            {hoja.map(({ p, svg }) => {
              const nombre = p.nombre_preferido || nombreCompleto(p);
              const foto = p.foto_path ? fotos[p.foto_path] : null;
              return (
                <article
                  key={p.id}
                  className="flex flex-col overflow-hidden rounded-[3mm] border border-slate-300"
                  style={{ breakInside: "avoid" }}
                >
                  <header className="relative flex items-center gap-[2mm] overflow-hidden bg-[#025582] px-[3mm] py-[2mm] text-white">
                    <span className="absolute -top-[8mm] -right-[6mm] size-[20mm] rounded-full bg-[#feb347]" aria-hidden />
                    <Image src="/brand/logo.png" alt="" width={32} height={32} className="relative size-[8mm] rounded-[2mm]" />
                    <span className="relative leading-tight">
                      <span className="block text-[10pt] font-extrabold">{MARCA.nombre}</span>
                      <span className="block text-[7pt] text-[#93dae6]">{MARCA.sesion}</span>
                    </span>
                  </header>
                  <div className="flex flex-1 items-center gap-[3mm] p-[3mm]">
                    <div className="w-[38mm] shrink-0 [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
                    <div className="min-w-0 flex-1">
                      {foto ? (
                        <div className="relative mb-[2mm] aspect-[3/4] w-[14mm] overflow-hidden rounded-[1.5mm]">
                          <Image src={foto} alt="" fill unoptimized className="object-cover" sizes="60px" />
                        </div>
                      ) : (
                        <div className="mb-[2mm] flex aspect-[3/4] w-[14mm] items-center justify-center rounded-[1.5mm] bg-slate-100 text-[9pt] font-bold text-slate-500">
                          {iniciales(nombre)}
                        </div>
                      )}
                      <p className="text-[11pt] leading-tight font-extrabold text-[#012a42]">{nombre}</p>
                      <p className="mt-[1mm] text-[8pt] leading-tight text-slate-600">{p.barrio?.nombre}</p>
                      <p className="text-[7pt] leading-tight text-slate-500">{p.barrio?.estaca}</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        ))}
      </div>
    </main>
  );
}
