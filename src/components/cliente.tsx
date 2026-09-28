"use client";

import clsx from "clsx";
import { Check, Copy, Eye, EyeOff, Loader2 } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore, type ComponentProps, type ReactNode } from "react";
import { createPortal, useFormStatus } from "react-dom";

import { Alerta, claseBoton } from "@/components/ui";

/** Botón de envío que se bloquea y muestra carga mientras la acción corre. */
export function BotonEnviar({
  children,
  pendiente,
  variante = "primario",
  tamano = "md",
  className,
  ...props
}: ComponentProps<"button"> & {
  pendiente?: ReactNode;
  variante?: "primario" | "secundario" | "peligro" | "sol";
  tamano?: "sm" | "md";
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || props.disabled}
      aria-busy={pending}
      className={claseBoton(variante, tamano, className)}
      {...props}
    >
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {pending ? (pendiente ?? children) : children}
    </button>
  );
}

/**
 * Resultado de un formulario, para ponerlo junto a su botón de envío.
 *
 * En el celular un formulario largo se envía desde el final: un aviso arriba queda
 * fuera de la pantalla y parece que "Guardar" no hizo nada. Por eso el aviso va
 * aquí y, si hay errores, la vista baja o sube al primer campo marcado.
 */
export function ResultadoEnvio({
  estado,
}: {
  estado?: { ok?: string; error?: string; errores?: Record<string, string> };
}) {
  const ref = useRef<HTMLDivElement>(null);
  const campos = Object.keys(estado?.errores ?? {});

  useEffect(() => {
    const aviso = ref.current;
    if (!estado || !aviso) return;
    const conError = new Set(Object.keys(estado.errores ?? {}));
    const form = aviso.closest("form");
    const primero = form && [...form.elements].find((e) => conError.has((e as HTMLInputElement).name));
    if (primero instanceof HTMLElement) {
      primero.scrollIntoView({ behavior: "smooth", block: "center" });
      primero.focus({ preventScroll: true });
    } else {
      aviso.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [estado]);

  return (
    <div ref={ref} className="empty:hidden">
      {estado?.error ? (
        <Alerta tipo="error">{estado.error}</Alerta>
      ) : campos.length > 0 ? (
        <Alerta tipo="error">
          {campos.length === 1
            ? "Hay un dato por corregir. Está marcado en rojo más arriba."
            : `Hay ${campos.length} datos por corregir. Están marcados en rojo más arriba.`}
        </Alerta>
      ) : estado?.ok ? (
        <Alerta tipo="exito">{estado.ok}</Alerta>
      ) : null}
    </div>
  );
}

/** Campo de contraseña con botón para mostrar/ocultar. */
export function EntradaClave({ className, ...props }: ComponentProps<"input">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input type={visible ? "text" : "password"} className={clsx("entrada pr-10", className)} {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 hover:text-slate-600"
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

/** Texto con botón de copiar (contraseñas temporales). */
export function CopiarTexto({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1.5 pl-3">
      <code className="min-w-0 flex-1 truncate font-mono text-sm font-semibold tracking-wide text-marca-950">{texto}</code>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(texto);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 1800);
        }}
        className={claseBoton("secundario", "sm")}
      >
        {copiado ? <Check className="size-3.5 text-hoja-600" /> : <Copy className="size-3.5" />}
        {copiado ? "Copiada" : "Copiar"}
      </button>
    </div>
  );
}

/**
 * Fecha en la zona horaria del navegador. El servidor no sabe dónde está quien
 * mira, así que renderiza en UTC y el cliente la reescribe al hidratar.
 */
export function Fecha({ iso, conHora = false, relativa = false }: { iso: string | null; conHora?: boolean; relativa?: boolean }) {
  if (!iso) return <span className="text-slate-400">—</span>;
  const d = new Date(iso);
  const texto = relativa
    ? haceCuanto(d)
    : d.toLocaleString("es", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        ...(conHora ? { hour: "2-digit", minute: "2-digit" } : {}),
      });
  return (
    <time dateTime={iso} title={d.toLocaleString("es")} suppressHydrationWarning>
      {texto}
    </time>
  );
}

function haceCuanto(d: Date) {
  const seg = Math.round((Date.now() - d.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
  if (Math.abs(seg) < 60) return rtf.format(-seg, "second");
  const min = Math.round(seg / 60);
  if (Math.abs(min) < 60) return rtf.format(-min, "minute");
  const h = Math.round(min / 60);
  if (Math.abs(h) < 24) return rtf.format(-h, "hour");
  const dias = Math.round(h / 24);
  if (Math.abs(dias) < 30) return rtf.format(-dias, "day");
  return d.toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
}

const sinSuscripcion = () => () => {};

/**
 * Diálogo modal nativo (<dialog>): foco atrapado, Esc para cerrar y fondo
 * inerte sin librerías.
 *
 * Se dibuja en un portal sobre <body>: así un diálogo con su propio formulario
 * puede abrirse desde dentro de otro formulario (un <form> anidado en otro es
 * HTML inválido y el interno terminaría enviando el externo).
 */
export function Dialogo({
  abierto,
  alCerrar,
  titulo,
  descripcion,
  children,
  ancho = "max-w-md",
}: {
  abierto: boolean;
  alCerrar: () => void;
  titulo: string;
  descripcion?: ReactNode;
  children: ReactNode;
  ancho?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const enCliente = useSyncExternalStore(sinSuscripcion, () => true, () => false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal();
    if (!abierto && d.open) d.close();
  }, [abierto, enCliente]);

  if (!enCliente) return null;
  return createPortal(
    <dialog
      ref={ref}
      onClose={alCerrar}
      onClick={(e) => {
        if (e.target === ref.current) alCerrar();
      }}
      className={clsx(
        "m-auto w-[calc(100%-2rem)] rounded-2xl border border-slate-200 bg-white p-0 text-slate-800 shadow-flotante backdrop:bg-marca-950/40 backdrop:backdrop-blur-[2px]",
        ancho,
      )}
    >
      {abierto && (
        <div className="animar-entrada p-6">
          <h2 className="text-lg font-semibold text-marca-950">{titulo}</h2>
          {descripcion && <div className="mt-1.5 text-sm text-slate-500">{descripcion}</div>}
          <div className="mt-5">{children}</div>
        </div>
      )}
    </dialog>,
    document.body,
  );
}
