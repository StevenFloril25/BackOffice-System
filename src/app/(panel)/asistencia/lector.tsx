"use client";

import clsx from "clsx";
import { Camera, CameraOff, CheckCircle2, Loader2, RotateCcw, Search, UserCheck, XCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import { Fecha } from "@/components/cliente";
import { Insignia, Tarjeta, claseBoton } from "@/components/ui";
import { iniciales, tonoAvatar } from "@/lib/utilidades";
import { registrarManual, registrarPorQr, type ResultadoLectura } from "./actions";

export interface Persona {
  id: string;
  nombre: string;
  preferido: string;
  barrio: string;
  asistio_at: string | null;
}

type Escaner = {
  start: () => Promise<void>;
  stop: () => void;
  destroy: () => void;
  setCamera: (id: string) => Promise<void>;
};

const sinTildes = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Tono corto con Web Audio: no hace falta ningún archivo de sonido. */
function sonar(tipo: "ok" | "aviso" | "error") {
  try {
    const ctx = new AudioContext();
    const notas = tipo === "ok" ? [880, 1320] : tipo === "aviso" ? [520, 520] : [220];
    notas.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      o.type = "sine";
      g.gain.setValueAtTime(0.18, ctx.currentTime + i * 0.14);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.14 + 0.13);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.14);
      o.stop(ctx.currentTime + i * 0.14 + 0.14);
    });
    navigator.vibrate?.(tipo === "ok" ? 80 : [60, 60, 60]);
  } catch {
    // Sin audio no pasa nada: el resultado igual se ve en pantalla.
  }
}

export function LectorAsistencia({ personas: iniciales_ }: { personas: Persona[] }) {
  const [personas, setPersonas] = useState(iniciales_);
  const [resultado, setResultado] = useState<ResultadoLectura | null>(null);
  const [recientes, setRecientes] = useState<{ id: string; nombre: string; barrio: string; hora: string }[]>([]);
  const [camaraActiva, setCamaraActiva] = useState(false);
  const [errorCamara, setErrorCamara] = useState<string | null>(null);
  const [camaras, setCamaras] = useState<{ id: string; label: string }[]>([]);
  const [procesando, setProcesando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [pendienteManual, iniciarManual] = useTransition();

  const video = useRef<HTMLVideoElement>(null);
  const escaner = useRef<Escaner | null>(null);
  const ultimo = useRef<{ texto: string; t: number }>({ texto: "", t: 0 });
  const ocupado = useRef(false);

  const vigentes = personas.length;
  const llegaron = personas.filter((p) => p.asistio_at).length;

  const anotar = useCallback((r: ResultadoLectura) => {
    const p = r.participante;
    if (!p) return;
    if (r.estado === "registrado") {
      setPersonas((lista) => lista.map((x) => (x.id === p.id ? { ...x, asistio_at: p.asistio_at } : x)));
      setRecientes((l) =>
        [{ id: p.id, nombre: `${p.nombres} ${p.apellidos}`, barrio: p.barrio ?? "", hora: p.asistio_at ?? new Date().toISOString() }, ...l].slice(0, 8),
      );
    }
  }, []);

  const procesar = useCallback(
    async (texto: string) => {
      const ahora = Date.now();
      // El mismo QR frente a la cámara se lee muchas veces por segundo.
      if (ocupado.current || (texto === ultimo.current.texto && ahora - ultimo.current.t < 4000)) return;
      ultimo.current = { texto, t: ahora };
      ocupado.current = true;
      setProcesando(true);
      try {
        const r = await registrarPorQr(texto);
        setResultado(r);
        anotar(r);
        sonar(r.estado === "registrado" ? "ok" : r.estado === "ya_registrado" ? "aviso" : "error");
      } catch {
        setResultado({ estado: "error", mensaje: "Sin conexión. Vuelve a intentar." });
        sonar("error");
      } finally {
        ocupado.current = false;
        setProcesando(false);
      }
    },
    [anotar],
  );

  async function encender() {
    setErrorCamara(null);
    if (!video.current) return;
    try {
      const { default: QrScanner } = await import("qr-scanner");
      if (!(await QrScanner.hasCamera())) {
        setErrorCamara("No se encontró ninguna cámara en este dispositivo.");
        return;
      }
      escaner.current?.destroy();
      const s = new QrScanner(video.current, (r) => procesar(r.data), {
        preferredCamera: "environment",
        highlightScanRegion: true,
        highlightCodeOutline: true,
        maxScansPerSecond: 6,
        returnDetailedScanResult: true,
      });
      escaner.current = s as unknown as Escaner;
      await s.start();
      setCamaraActiva(true);
      const lista = await QrScanner.listCameras(true);
      setCamaras(lista.map((c) => ({ id: c.id, label: c.label || "Cámara" })));
    } catch (e) {
      const texto = String(e);
      setErrorCamara(
        /NotAllowed|Permission|denied/i.test(texto)
          ? "El navegador no dio permiso para usar la cámara. Actívalo en el candado de la barra de direcciones y vuelve a intentar."
          : /secure|https/i.test(texto)
            ? "La cámara solo funciona en una conexión segura (https)."
            : "No se pudo encender la cámara.",
      );
      setCamaraActiva(false);
    }
  }

  function apagar() {
    escaner.current?.stop();
    setCamaraActiva(false);
  }

  useEffect(() => () => escaner.current?.destroy(), []);

  const coincidencias = useMemo(() => {
    const t = sinTildes(busqueda.trim());
    if (t.length < 2) return [];
    const partes = t.split(/\s+/);
    return personas
      .filter((p) => {
        const pajar = sinTildes(`${p.nombre} ${p.preferido} ${p.barrio}`);
        return partes.every((x) => pajar.includes(x));
      })
      .slice(0, 8);
  }, [busqueda, personas]);

  function marcarManual(p: Persona) {
    iniciarManual(async () => {
      const r = await registrarManual(p.id);
      if (r.error) {
        setResultado({ estado: "error", mensaje: r.error });
        sonar("error");
        return;
      }
      const hora = r.asistio_at ?? new Date().toISOString();
      setPersonas((lista) => lista.map((x) => (x.id === p.id ? { ...x, asistio_at: hora } : x)));
      setRecientes((l) => [{ id: p.id, nombre: p.nombre, barrio: p.barrio, hora }, ...l].slice(0, 8));
      setResultado({
        estado: "registrado",
        participante: {
          id: p.id,
          nombres: p.nombre,
          apellidos: "",
          nombre_preferido: p.preferido,
          sexo: null,
          talla_camiseta: null,
          asistio_at: hora,
          registrado_por: null,
          barrio: p.barrio,
          estaca: null,
          foto: null,
        },
      });
      sonar("ok");
      setBusqueda("");
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* Cámara */}
      <div className="space-y-4 lg:col-span-3">
        <Contador llegaron={llegaron} vigentes={vigentes} />

        <Tarjeta className="overflow-hidden">
          <div className="relative aspect-square bg-marca-950 sm:aspect-[4/3]">
            <video ref={video} className={clsx("h-full w-full object-cover", !camaraActiva && "invisible")} muted playsInline />
            {!camaraActiva && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center text-white">
                <span className="flex size-16 items-center justify-center rounded-2xl bg-white/10">
                  {errorCamara ? <CameraOff className="size-8 text-sol-200" /> : <Camera className="size-8 text-sol-200" />}
                </span>
                <p className="max-w-sm text-sm text-marca-100">
                  {errorCamara ?? "Enciende la cámara y apunta al código QR del participante."}
                </p>
                <button type="button" onClick={encender} className={claseBoton("sol")}>
                  <Camera className="size-4" aria-hidden />
                  {errorCamara ? "Intentar de nuevo" : "Encender cámara"}
                </button>
              </div>
            )}
            {procesando && (
              <div className="absolute inset-x-0 top-0 flex justify-center p-3">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-marca-800 shadow">
                  <Loader2 className="size-3.5 animate-spin" /> Verificando…
                </span>
              </div>
            )}
          </div>
          {camaraActiva && (
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 p-3">
              {camaras.length > 1 && (
                <select
                  aria-label="Cámara"
                  className="entrada w-auto flex-1 py-1.5 text-sm"
                  onChange={(e) => escaner.current?.setCamera(e.target.value)}
                >
                  {camaras.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              )}
              <button type="button" onClick={apagar} className={claseBoton("secundario", "sm")}>
                <CameraOff className="size-3.5" aria-hidden />
                Apagar cámara
              </button>
            </div>
          )}
        </Tarjeta>
      </div>

      {/* Resultado, búsqueda y últimos */}
      <div className="space-y-4 lg:col-span-2">
        <PanelResultado resultado={resultado} />

        <Tarjeta>
          <div className="border-b border-slate-100 p-4">
            <label htmlFor="busqueda" className="mb-2 block text-sm font-semibold text-slate-800">
              ¿No trae su QR?
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <input
                id="busqueda"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Busca por nombre o barrio"
                className="entrada pl-10"
                autoComplete="off"
              />
            </div>
          </div>
          {busqueda.trim().length >= 2 && (
            <ul className="divide-y divide-slate-100">
              {coincidencias.length === 0 && <li className="px-4 py-4 text-sm text-slate-500">Nadie coincide.</li>}
              {coincidencias.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{p.nombre}</p>
                    <p className="truncate text-xs text-slate-500">{p.barrio}</p>
                  </div>
                  {p.asistio_at ? (
                    <Insignia tono="hoja" punto>
                      Llegó
                    </Insignia>
                  ) : (
                    <button
                      type="button"
                      disabled={pendienteManual}
                      onClick={() => marcarManual(p)}
                      className={claseBoton("primario", "sm")}
                    >
                      <UserCheck className="size-3.5" aria-hidden />
                      Registrar
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>

        {recientes.length > 0 && (
          <Tarjeta>
            <p className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-800">Últimos registrados aquí</p>
            <ul className="divide-y divide-slate-100">
              {recientes.map((r) => (
                <li key={`${r.id}-${r.hora}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <Link href={`/participantes/${r.id}`} className="min-w-0 truncate font-medium text-slate-800 hover:text-marca-700">
                    {r.nombre}
                    <span className="ml-2 text-xs font-normal text-slate-500">{r.barrio}</span>
                  </Link>
                  <span className="shrink-0 text-xs text-slate-500">
                    <Fecha iso={r.hora} relativa />
                  </span>
                </li>
              ))}
            </ul>
          </Tarjeta>
        )}
      </div>
    </div>
  );
}

function Contador({ llegaron, vigentes }: { llegaron: number; vigentes: number }) {
  const pct = vigentes ? Math.round((llegaron / vigentes) * 100) : 0;
  return (
    <Tarjeta className="flex items-center gap-4 p-4 sm:p-5">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-slate-500">Han llegado</p>
        <p className="text-3xl font-bold text-marca-950">
          {llegaron}
          <span className="text-lg font-medium text-slate-400"> / {vigentes}</span>
        </p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-hoja-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <p className="text-2xl font-bold text-hoja-700">{pct}%</p>
    </Tarjeta>
  );
}

const ESTILOS: Record<string, { clase: string; Icono: typeof CheckCircle2; titulo: string }> = {
  registrado: { clase: "bg-hoja-100 border-hoja-200 text-hoja-700", Icono: CheckCircle2, titulo: "¡Bienvenido! Llegada registrada" },
  ya_registrado: { clase: "bg-sol-100 border-sol-200 text-sol-600", Icono: RotateCcw, titulo: "Ya estaba registrado" },
  no_encontrado: { clase: "bg-red-50 border-red-200 text-red-700", Icono: XCircle, titulo: "QR no reconocido" },
  no_valido: { clase: "bg-red-50 border-red-200 text-red-700", Icono: XCircle, titulo: "Ese código no es de la conferencia" },
  error: { clase: "bg-red-50 border-red-200 text-red-700", Icono: XCircle, titulo: "No se pudo registrar" },
};

function PanelResultado({ resultado }: { resultado: ResultadoLectura | null }) {
  if (!resultado) {
    return (
      <Tarjeta className="flex items-center gap-3 p-5 text-sm text-slate-500">
        <Camera className="size-5 text-marca-400" aria-hidden />
        Aquí aparece cada participante al leer su QR.
      </Tarjeta>
    );
  }
  const e = ESTILOS[resultado.estado] ?? ESTILOS.error;
  const p = resultado.participante;
  const nombre = p ? p.nombre_preferido || `${p.nombres} ${p.apellidos}`.trim() : "";

  return (
    <div key={`${resultado.estado}-${p?.id}-${p?.asistio_at}`} className={clsx("animar-entrada rounded-2xl border p-5", e.clase)} role="status" aria-live="polite">
      <div className="flex items-center gap-2 font-semibold">
        <e.Icono className="size-5" aria-hidden />
        {e.titulo}
      </div>
      {p ? (
        <div className="mt-4 flex items-center gap-4">
          <div className={clsx("relative aspect-[3/4] w-20 shrink-0 overflow-hidden rounded-xl bg-white", !p.foto && tonoAvatar(nombre))}>
            {p.foto ? (
              <Image src={p.foto} alt="" fill unoptimized className="object-cover" sizes="80px" />
            ) : (
              <span className="flex h-full items-center justify-center text-xl font-bold">{iniciales(nombre)}</span>
            )}
          </div>
          <div className="min-w-0 text-slate-800">
            <p className="text-lg leading-tight font-bold">{nombre}</p>
            {p.barrio && (
              <p className="text-sm text-slate-600">
                {p.barrio}
                {p.estaca && ` · ${p.estaca}`}
              </p>
            )}
            {p.talla_camiseta && <p className="text-xs text-slate-500">Camiseta {p.talla_camiseta.replace(" (unisex)", "")}</p>}
            {resultado.estado === "ya_registrado" && p.asistio_at && (
              <p className="mt-1 text-xs font-medium text-sol-600">
                Llegó <Fecha iso={p.asistio_at} relativa />
                {p.registrado_por && ` · registró ${p.registrado_por}`}
              </p>
            )}
          </div>
        </div>
      ) : (
        resultado.mensaje && <p className="mt-2 text-sm">{resultado.mensaje}</p>
      )}
    </div>
  );
}
