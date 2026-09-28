import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { SinAcceso } from "@/components/sin-acceso";
import { MARCA } from "@/lib/marca";
import {
  colorCompania,
  companiaDeConsejeros,
  listarEdificios,
  nombreFuncion,
  sexoPlural,
  type Funcion,
  type Sexo,
  type EdificioConHabitaciones,
  type HabitacionFila,
} from "@/lib/organizacion";
import { edad, nombreCompleto } from "@/lib/participantes-comun";
import { exigirSesion, puede } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { BotonImprimir } from "../credenciales/imprimir";

export const metadata: Metadata = { title: "Distribución de habitaciones" };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const porNombre = new Intl.Collator("es", { numeric: true, sensitivity: "base" });

interface Ocupante {
  nombre: string;
  compania: number | null;
  edad: number | null;
  barrio: string | null;
  /** Solo líderes: "Consejera", "Coordinador auxiliar"… */
  funcion?: string;
}

interface Hoja {
  edificio: EdificioConHabitaciones;
  piso: number;
  habitaciones: HabitacionFila[];
}

/**
 * La distribución para imprimir: una hoja A4 por piso con la habitación de
 * líderes y el dormitorio de jóvenes, cama por cama, y una columna para marcar
 * a mano. Fuera del panel a propósito, como las credenciales: lo que se ve es lo
 * que sale en papel.
 */
export default async function Distribucion({
  searchParams,
}: {
  searchParams: Promise<{ edificio?: string; piso?: string; habitacion?: string }>;
}) {
  const sesion = await exigirSesion();
  if (!puede(sesion, "habitaciones.ver")) {
    return (
      <main className="p-6">
        <SinAcceso permiso="habitaciones.ver" />
      </main>
    );
  }

  const f = await searchParams;
  const edificioId = f.edificio && UUID.test(f.edificio) ? f.edificio : null;
  const habitacionId = f.habitacion && UUID.test(f.habitacion) ? f.habitacion : null;
  const piso = f.piso && /^\d+$/.test(f.piso) ? Number(f.piso) : null;

  const supabase = await createClient();
  const [edificios, jovenes, consejeros, companias] = await Promise.all([
    listarEdificios(),
    supabase
      .from("participantes")
      .select("nombres, apellidos, fecha_nacimiento, habitacion_id, compania:companias(numero), barrio:barrios(nombre)")
      .not("habitacion_id", "is", null)
      .then((r) => r.data ?? []),
    supabase
      .from("consejeros")
      .select("id, nombres, apellidos, sexo, funcion, fecha_nacimiento, habitacion_id, barrio:barrios(nombre)")
      .not("habitacion_id", "is", null)
      .then((r) => r.data ?? []),
    companiaDeConsejeros(),
  ]);

  const ocupantes = new Map<string, Ocupante[]>();
  const agregar = (hab: string, o: Ocupante) => ocupantes.set(hab, [...(ocupantes.get(hab) ?? []), o]);
  for (const j of jovenes) {
    agregar(j.habitacion_id as string, {
      nombre: nombreCompleto(j),
      compania: (j.compania as unknown as { numero: number } | null)?.numero ?? null,
      edad: edad(j.fecha_nacimiento),
      barrio: (j.barrio as unknown as { nombre: string } | null)?.nombre ?? null,
    });
  }
  for (const c of consejeros) {
    agregar(c.habitacion_id as string, {
      nombre: nombreCompleto(c),
      compania: companias[c.id]?.numero ?? null,
      edad: edad(c.fecha_nacimiento),
      barrio: (c.barrio as unknown as { nombre: string } | null)?.nombre ?? null,
      funcion: nombreFuncion(c.funcion as Funcion, c.sexo as Sexo),
    });
  }
  for (const lista of ocupantes.values()) {
    lista.sort((a, b) => (a.compania ?? 999) - (b.compania ?? 999) || porNombre.compare(a.nombre, b.nombre));
  }

  // Una hoja por piso (de abajo hacia arriba), con el filtro pedido.
  const hojas: Hoja[] = [];
  for (const e of edificios) {
    if (edificioId && e.id !== edificioId) continue;
    const pisos = [...new Set(e.habitaciones.map((h) => h.piso))].sort((a, b) => a - b);
    for (const p of pisos) {
      if (piso !== null && p !== piso) continue;
      const habitaciones = e.habitaciones
        .filter((h) => h.piso === p && (!habitacionId || h.id === habitacionId))
        // En el papel, primero los líderes: son el contacto del piso.
        .sort((a, b) => (a.tipo === b.tipo ? porNombre.compare(a.nombre, b.nombre) : a.tipo === "lideres" ? -1 : 1));
      if (habitaciones.length) hojas.push({ edificio: e, piso: p, habitaciones });
    }
  }

  const titulo =
    hojas.length === 1 && habitacionId
      ? `${hojas[0].edificio.nombre} · piso ${hojas[0].piso} · ${hojas[0].habitaciones[0].nombre}`
      : edificioId && hojas[0]
        ? `${hojas[0].edificio.nombre}${piso !== null ? ` · piso ${piso}` : ""}`
        : "Todos los edificios";
  const hoy = new Date().toLocaleDateString("es-EC", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Guayaquil" });

  return (
    <main className="min-h-screen bg-slate-100 print:bg-white">
      <style>{`@page { size: A4; margin: 10mm; } @media print { .hoja { break-after: page; } .hoja:last-child { break-after: auto; } } .hoja * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }`}</style>

      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur print:hidden">
        <form className="mx-auto flex max-w-5xl flex-wrap items-center gap-2">
          <Link href="/habitaciones" className="mr-2 text-sm font-semibold text-marca-700 hover:text-marca-900">
            ← Volver
          </Link>
          <select name="edificio" defaultValue={edificioId ?? ""} className="entrada w-auto py-1.5 text-sm" aria-label="Edificio">
            <option value="">Todos los edificios</option>
            {edificios.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
          <select name="piso" defaultValue={piso ?? ""} className="entrada w-auto py-1.5 text-sm" aria-label="Piso">
            <option value="">Todos los pisos</option>
            {[...new Set(edificios.flatMap((e) => e.habitaciones.map((h) => h.piso)))]
              .sort((a, b) => a - b)
              .map((p) => (
                <option key={p} value={p}>
                  Piso {p}
                </option>
              ))}
          </select>
          <button type="submit" className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold hover:bg-slate-50">
            Ver
          </button>
          <span className="ml-auto text-sm text-slate-500">
            {titulo} · {hojas.length} hoja{hojas.length === 1 ? "" : "s"}
          </span>
          <BotonImprimir />
        </form>
      </div>

      <div className="mx-auto flex flex-col items-center gap-6 py-6 print:block print:py-0">
        {hojas.length === 0 && <p className="text-slate-500">No hay habitaciones con ese filtro.</p>}
        {hojas.map((h) => {
          const camas = h.habitaciones.reduce((n, x) => n + x.capacidad, 0);
          const ocupadas = h.habitaciones.reduce((n, x) => n + (ocupantes.get(x.id)?.length ?? 0), 0);
          return (
            <section
              key={`${h.edificio.id}-${h.piso}`}
              className="hoja w-[190mm] bg-white p-[8mm] text-[#012a42] shadow print:w-auto print:p-0 print:shadow-none"
            >
              <header className="flex items-center gap-[3mm] border-b-2 border-[#025582] pb-[3mm]">
                <Image src="/brand/logo.png" alt="" width={40} height={40} className="size-[11mm] rounded-[2mm]" />
                <div className="leading-tight">
                  <p className="text-[12pt] font-extrabold">{MARCA.nombre}</p>
                  <p className="text-[8pt] text-slate-500">{MARCA.sesion} · Distribución de habitaciones</p>
                </div>
                <p className="ml-auto text-right text-[8pt] text-slate-500">{hoy}</p>
              </header>

              <div className="mt-[4mm] flex items-end justify-between">
                <h1 className="text-[18pt] leading-none font-extrabold">
                  {h.edificio.nombre} · Piso {h.piso}
                </h1>
                <p className="text-[9pt] text-slate-600">
                  Edificio de {sexoPlural(h.edificio.sexo)} · {ocupadas} de {camas} camas
                </p>
              </div>

              {h.habitaciones.map((hab) => (
                <Tabla key={hab.id} habitacion={hab} ocupantes={ocupantes.get(hab.id) ?? []} />
              ))}
            </section>
          );
        })}
      </div>
    </main>
  );
}

function Tabla({ habitacion: h, ocupantes }: { habitacion: HabitacionFila; ocupantes: Ocupante[] }) {
  const lideres = h.tipo === "lideres";
  return (
    <div className="mt-[5mm]" style={{ breakInside: "avoid" }}>
      <p className="mb-[1.5mm] text-[10pt] font-bold">
        {h.nombre}
        <span className="ml-[2mm] text-[8.5pt] font-normal text-slate-500">
          {lideres ? "consejeros y coordinadores" : "participantes"} · {ocupantes.length} de {h.capacidad} camas
        </span>
      </p>
      <table className="w-full border-collapse text-[8.5pt]">
        <thead>
          <tr className="bg-[#e1f5f8] text-left text-[7.5pt] tracking-wide uppercase">
            <th className="w-[8mm] border border-slate-300 px-[1.5mm] py-[1mm] text-center">#</th>
            <th className="border border-slate-300 px-[2mm] py-[1mm]">Nombre</th>
            <th className="w-[16mm] border border-slate-300 px-[1.5mm] py-[1mm] text-center">Comp.</th>
            {!lideres && <th className="w-[12mm] border border-slate-300 px-[1.5mm] py-[1mm] text-center">Edad</th>}
            <th className="w-[38mm] border border-slate-300 px-[2mm] py-[1mm]">Barrio</th>
            <th className="w-[10mm] border border-slate-300 px-[1.5mm] py-[1mm] text-center">✓</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: h.capacidad }, (_, i) => {
            const o = ocupantes[i];
            return (
              <tr key={i} className="h-[4.6mm]">
                <td className="border border-slate-300 px-[1.5mm] text-center text-slate-400">{i + 1}</td>
                <td className="border border-slate-300 px-[2mm] font-semibold">
                  {o?.nombre ?? ""}
                  {o?.funcion && <span className="ml-[1.5mm] text-[7pt] font-normal text-slate-500">{o.funcion}</span>}
                </td>
                <td className="border border-slate-300 px-[1.5mm] text-center">
                  {o?.compania ? (
                    <span className="rounded-[1mm] px-[1.5mm] text-[7.5pt] font-bold text-white" style={{ background: colorCompania(o.compania) }}>
                      C{o.compania}
                    </span>
                  ) : null}
                </td>
                {!lideres && <td className="border border-slate-300 px-[1.5mm] text-center">{o?.edad ?? ""}</td>}
                <td className="truncate border border-slate-300 px-[2mm] text-slate-600">{o?.barrio ?? ""}</td>
                <td className="border border-slate-300" />
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
