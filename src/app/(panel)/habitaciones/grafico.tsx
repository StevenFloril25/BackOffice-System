import clsx from "clsx";

import { colorCompania } from "@/lib/organizacion-comun";

/** Gris azulado para jóvenes con cama pero sin compañía todavía. */
const SIN_COMPANIA = "#9fb8c9";
/** Consejeros en la habitación de líderes: el azul de la marca. */
const LIDER = "#025582";

/**
 * Las camas de una habitación como cuadritos: cada cama ocupada con el color de
 * la compañía de quien duerme ahí, las libres en blanco. Los de la misma
 * compañía quedan juntos, así se ve de un vistazo qué compañías hay en cada piso.
 */
export function Camas({
  capacidad,
  porCompania = {},
  lideres = 0,
  tamano = "md",
}: {
  capacidad: number;
  /** Jóvenes por número de compañía; 0 = sin compañía. */
  porCompania?: Record<number, number>;
  /** Consejeros (para la habitación de líderes). */
  lideres?: number;
  tamano?: "sm" | "md" | "lg";
}) {
  const colores: string[] = [];
  for (const numero of Object.keys(porCompania).map(Number).sort((a, b) => (a || 999) - (b || 999))) {
    for (let i = 0; i < porCompania[numero]; i++) colores.push(numero ? colorCompania(numero) : SIN_COMPANIA);
  }
  for (let i = 0; i < lideres; i++) colores.push(LIDER);

  // Dos filas para el dormitorio (34 → 17 × 2); la de líderes, cuadrada.
  const columnas = tamano === "sm" ? Math.min(2, capacidad) : Math.min(20, Math.max(1, Math.ceil(capacidad / 2)));
  return (
    <div
      className={clsx("grid", tamano === "lg" ? "gap-1.5" : "gap-[3px]")}
      style={{ gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))` }}
      role="img"
      aria-label={`${colores.length} de ${capacidad} camas ocupadas`}
    >
      {Array.from({ length: capacidad }, (_, i) => (
        <span
          key={i}
          className={clsx(
            "aspect-square rounded-[3px]",
            tamano === "lg" && "rounded-[4px]",
            !colores[i] && "border border-slate-300 bg-white",
          )}
          style={colores[i] ? { background: colores[i] } : undefined}
        />
      ))}
    </div>
  );
}

/** Etiqueta de una compañía con su color: "C3". */
export function ChipCompania({ numero, texto, grande }: { numero: number; texto?: string; grande?: boolean }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-md font-bold text-white",
        grande ? "px-2 py-1 text-xs" : "px-1.5 py-0.5 text-[10px] leading-none",
      )}
      style={{ background: numero ? colorCompania(numero) : SIN_COMPANIA }}
    >
      {numero ? `C${numero}` : "Sin comp."}
      {texto && <span className="font-medium opacity-90">{texto}</span>}
    </span>
  );
}
