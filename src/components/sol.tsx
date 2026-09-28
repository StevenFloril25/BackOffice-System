import clsx from "clsx";
import type { CSSProperties } from "react";

/**
 * Sol de la marca dibujado con líneas: arcos concéntricos que salen de una
 * esquina y barras de resplandor alrededor, en distintos tonos de amarillo.
 * No hay círculo relleno: la forma la dan los trazos.
 *
 * El centro está en la esquina superior derecha del dibujo, así que se coloca
 * pegado a esa esquina del contenedor (que debe tener overflow-hidden).
 * Las barras laten suave (desactivado con "reducir movimiento").
 */

const ANCHO = 420;
const CX = ANCHO; // centro en la esquina superior derecha
const CY = 0;

interface Arco {
  r: number;
  grosor: number;
  tono: string;
  desde: number;
  hasta: number;
  opacidad?: number;
}

interface Rayo {
  angulo: number;
  r: number;
  largo: number;
  grosor: number;
  tono: string;
  opacidad?: number;
}

// Tonos de amarillo. Van como color del trazo y no como clases del tema: el
// crema del tema (sol-200) sobre el azul se lee gris, no amarillo.
const AMARILLOS = {
  ambar: "#f59e1b",
  dorado: "#feb347",
  miel: "#ffc233",
  limon: "#ffd84d",
  claro: "#ffe68a",
  palido: "#fff1b8",
} as const;

// Arcos: cada uno un poco más corto y tenue hacia afuera, como el resplandor
// que se abre. Los extremos varían a propósito para que no se vea mecánico.
const ARCOS: Arco[] = [
  { r: 44, grosor: 7, tono: AMARILLOS.dorado, desde: 90, hasta: 180 },
  { r: 78, grosor: 5, tono: AMARILLOS.miel, desde: 92, hasta: 178 },
  { r: 112, grosor: 4, tono: AMARILLOS.limon, desde: 96, hasta: 172 },
  { r: 146, grosor: 3, tono: AMARILLOS.claro, desde: 101, hasta: 168, opacidad: 0.9 },
  { r: 178, grosor: 2.25, tono: AMARILLOS.palido, desde: 107, hasta: 162, opacidad: 0.7 },
];

// Barras de resplandor: largo, grosor y tono alternados.
const RAYOS: Rayo[] = [
  { angulo: 96, r: 206, largo: 38, grosor: 5, tono: AMARILLOS.limon },
  { angulo: 106, r: 214, largo: 22, grosor: 3.5, tono: AMARILLOS.claro },
  { angulo: 116, r: 204, largo: 44, grosor: 6, tono: AMARILLOS.dorado },
  { angulo: 126, r: 216, largo: 20, grosor: 3, tono: AMARILLOS.claro, opacidad: 0.8 },
  { angulo: 136, r: 206, largo: 36, grosor: 5, tono: AMARILLOS.ambar },
  { angulo: 146, r: 214, largo: 24, grosor: 3.5, tono: AMARILLOS.limon },
  { angulo: 156, r: 204, largo: 42, grosor: 6, tono: AMARILLOS.dorado },
  { angulo: 166, r: 216, largo: 20, grosor: 3, tono: AMARILLOS.claro, opacidad: 0.8 },
  { angulo: 175, r: 208, largo: 32, grosor: 4.5, tono: AMARILLOS.limon },
  // destellos sueltos, más afuera
  { angulo: 111, r: 262, largo: 12, grosor: 2.5, tono: AMARILLOS.claro, opacidad: 0.7 },
  { angulo: 131, r: 258, largo: 16, grosor: 3, tono: AMARILLOS.limon, opacidad: 0.75 },
  { angulo: 151, r: 262, largo: 12, grosor: 2.5, tono: AMARILLOS.claro, opacidad: 0.7 },
  { angulo: 170, r: 256, largo: 14, grosor: 2.5, tono: AMARILLOS.dorado, opacidad: 0.7 },
];

const rad = (g: number) => (g * Math.PI) / 180;
const punto = (r: number, g: number) => [CX + r * Math.cos(rad(g)), CY + r * Math.sin(rad(g))] as const;
const n = (v: number) => Math.round(v * 10) / 10;

function arco({ r, desde, hasta }: Arco) {
  const [x1, y1] = punto(r, desde);
  const [x2, y2] = punto(r, hasta);
  return `M ${n(x1)} ${n(y1)} A ${r} ${r} 0 0 1 ${n(x2)} ${n(y2)}`;
}

export function SolResplandor({ className, id = "sol" }: { className?: string; id?: string }) {
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${ANCHO} ${ANCHO}`}
      preserveAspectRatio="xMaxYMin meet"
      fill="none"
      strokeLinecap="round"
      className={clsx("pointer-events-none", className)}
    >
      <defs>
        {/* Calidez de fondo en la esquina: tenue, no es un disco pintado. */}
        <radialGradient id={`${id}-calor`} cx={CX} cy={CY} r={240} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#feb347" stopOpacity="0.28" />
          <stop offset="0.55" stopColor="#feb347" stopOpacity="0.08" />
          <stop offset="1" stopColor="#feb347" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={ANCHO} height={ANCHO} fill={`url(#${id}-calor)`} />

      {ARCOS.map((a) => (
        <path key={a.r} d={arco(a)} stroke={a.tono} strokeWidth={a.grosor} opacity={a.opacidad} />
      ))}

      {RAYOS.map((rayo, i) => {
        const [x1, y1] = punto(rayo.r, rayo.angulo);
        const [x2, y2] = punto(rayo.r + rayo.largo, rayo.angulo);
        return (
          <line
            key={`${rayo.angulo}-${rayo.r}`}
            x1={n(x1)}
            y1={n(y1)}
            x2={n(x2)}
            y2={n(y2)}
            stroke={rayo.tono}
            strokeWidth={rayo.grosor}
            opacity={rayo.opacidad}
            className="sol-destello"
            // La animación pisa la opacidad del atributo: se le pasa la base
            // por variable para que cada barra conserve su intensidad.
            style={{ animationDelay: `${(i % 5) * 0.55}s`, "--o": rayo.opacidad ?? 1 } as CSSProperties}
          />
        );
      })}
    </svg>
  );
}
