import clsx from "clsx";
import Image from "next/image";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

import { iniciales, tonoAvatar } from "@/lib/utilidades";

// ---------------------------------------------------------------------------
// Botones
// ---------------------------------------------------------------------------

type Variante = "primario" | "secundario" | "peligro" | "fantasma" | "sol";
type Tamano = "sm" | "md";

const VARIANTES: Record<Variante, string> = {
  primario:
    "bg-marca-700 text-white shadow-sm shadow-marca-900/20 hover:bg-marca-800 active:bg-marca-900 disabled:bg-marca-700/60",
  secundario:
    "border border-slate-200 bg-white text-slate-700 shadow-xs hover:border-slate-300 hover:bg-slate-50 disabled:text-slate-400",
  peligro: "bg-red-600 text-white shadow-sm hover:bg-red-700 disabled:bg-red-600/60",
  fantasma: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  sol: "bg-sol-400 text-marca-950 shadow-sm hover:bg-sol-500 disabled:opacity-60",
};

const TAMANOS: Record<Tamano, string> = {
  sm: "h-8 gap-1.5 rounded-lg px-3 text-xs",
  md: "h-10 gap-2 rounded-xl px-4 text-sm",
};

export function claseBoton(variante: Variante = "primario", tamano: Tamano = "md", extra?: string) {
  return clsx(
    "inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed",
    VARIANTES[variante],
    TAMANOS[tamano],
    extra,
  );
}

export function Boton({
  variante,
  tamano,
  className,
  ...props
}: ComponentProps<"button"> & { variante?: Variante; tamano?: Tamano }) {
  return <button className={claseBoton(variante, tamano, className)} {...props} />;
}

export function EnlaceBoton({
  variante,
  tamano,
  className,
  ...props
}: ComponentProps<typeof Link> & { variante?: Variante; tamano?: Tamano }) {
  return <Link className={claseBoton(variante, tamano, className)} {...props} />;
}

// ---------------------------------------------------------------------------
// Formularios
// ---------------------------------------------------------------------------

export function Campo({
  etiqueta,
  htmlFor,
  ayuda,
  error,
  children,
  className,
}: {
  etiqueta: string;
  htmlFor?: string;
  ayuda?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700">
        {etiqueta}
      </label>
      {children}
      {error ? (
        <p className="text-xs font-medium text-red-600">{error}</p>
      ) : ayuda ? (
        <p className="text-xs text-slate-500">{ayuda}</p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Estructura
// ---------------------------------------------------------------------------

export function Tarjeta({ className, ...props }: ComponentProps<"div">) {
  return (
    <div className={clsx("rounded-2xl border border-slate-200/80 bg-white shadow-tarjeta", className)} {...props} />
  );
}

export function EncabezadoTarjeta({
  titulo,
  descripcion,
  acciones,
}: {
  titulo: ReactNode;
  descripcion?: ReactNode;
  acciones?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-slate-900">{titulo}</h2>
        {descripcion && <p className="mt-0.5 text-sm text-slate-500">{descripcion}</p>}
      </div>
      {acciones}
    </div>
  );
}

export function EncabezadoPagina({
  titulo,
  descripcion,
  acciones,
  migas,
}: {
  titulo: ReactNode;
  descripcion?: ReactNode;
  acciones?: ReactNode;
  migas?: { etiqueta: string; href?: string }[];
}) {
  return (
    <header className="mb-6 sm:mb-8">
      {migas && migas.length > 0 && (
        <nav aria-label="Ruta" className="mb-2 flex flex-wrap items-center gap-1.5 text-xs font-medium text-slate-500">
          {migas.map((m, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-slate-300">/</span>}
              {m.href ? (
                <Link href={m.href} className="hover:text-marca-700">
                  {m.etiqueta}
                </Link>
              ) : (
                <span className="text-slate-700">{m.etiqueta}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-marca-950 sm:text-[1.7rem]">{titulo}</h1>
          {descripcion && <p className="mt-1 max-w-2xl text-sm text-slate-500">{descripcion}</p>}
        </div>
        {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Indicadores
// ---------------------------------------------------------------------------

type Tono = "neutro" | "marca" | "hoja" | "sol" | "rojo";

const TONOS: Record<Tono, string> = {
  neutro: "bg-slate-100 text-slate-600 ring-slate-500/10",
  marca: "bg-marca-50 text-marca-700 ring-marca-600/15",
  hoja: "bg-hoja-100 text-hoja-700 ring-hoja-600/20",
  sol: "bg-sol-100 text-sol-600 ring-sol-500/25",
  rojo: "bg-red-50 text-red-700 ring-red-600/15",
};

export function Insignia({ tono = "neutro", punto, children }: { tono?: Tono; punto?: boolean; children: ReactNode }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset",
        TONOS[tono],
      )}
    >
      {punto && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function Avatar({
  texto,
  tamano = "md",
  src,
}: {
  texto: string;
  tamano?: "sm" | "md" | "lg";
  /** URL firmada de la foto; sin ella se muestran las iniciales. */
  src?: string | null;
}) {
  const medida = clsx(
    tamano === "sm" && "size-8 text-xs",
    tamano === "md" && "size-10 text-sm",
    tamano === "lg" && "size-14 text-lg",
  );
  if (src) {
    return (
      <span aria-hidden className={clsx("relative inline-block shrink-0 overflow-hidden rounded-full bg-slate-100", medida)}>
        {/* unoptimized: la URL firmada caduca y no tiene sentido cachearla en el optimizador. */}
        <Image src={src} alt="" fill unoptimized sizes="56px" className="object-cover" />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className={clsx("inline-flex shrink-0 items-center justify-center rounded-full font-bold", tonoAvatar(texto), medida)}
    >
      {iniciales(texto)}
    </span>
  );
}

const ALERTAS = {
  info: { clase: "border-marca-200 bg-marca-50 text-marca-900", Icono: Info },
  exito: { clase: "border-hoja-200 bg-hoja-100 text-hoja-700", Icono: CheckCircle2 },
  aviso: { clase: "border-sol-200 bg-sol-100 text-sol-600", Icono: AlertTriangle },
  error: { clase: "border-red-200 bg-red-50 text-red-700", Icono: XCircle },
};

export function Alerta({
  tipo = "info",
  titulo,
  children,
}: {
  tipo?: keyof typeof ALERTAS;
  titulo?: string;
  children?: ReactNode;
}) {
  const { clase, Icono } = ALERTAS[tipo];
  return (
    <div role={tipo === "error" ? "alert" : "status"} className={clsx("flex gap-3 rounded-xl border px-4 py-3 text-sm", clase)}>
      <Icono className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 space-y-0.5">
        {titulo && <p className="font-semibold">{titulo}</p>}
        {children && <div className="leading-relaxed">{children}</div>}
      </div>
    </div>
  );
}

export function EstadoVacio({
  icono,
  titulo,
  descripcion,
  accion,
}: {
  icono: ReactNode;
  titulo: string;
  descripcion?: string;
  accion?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-marca-50 text-marca-600">{icono}</div>
      <p className="font-semibold text-slate-900">{titulo}</p>
      {descripcion && <p className="mt-1 max-w-sm text-sm text-slate-500">{descripcion}</p>}
      {accion && <div className="mt-5">{accion}</div>}
    </div>
  );
}
