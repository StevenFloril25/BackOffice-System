"use client";

import clsx from "clsx";
import Link from "@/components/enlace";
import { CalendarDays, Clock3, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { useActionState, useCallback, useEffect, useState, useSyncExternalStore, useTransition } from "react";

import { AvisoBreve, BotonEnviar, Dialogo, Seleccion } from "@/components/cliente";
import { Alerta, Boton, Campo, Insignia } from "@/components/ui";
import { ahoraEnLaSesion, ahoraYSigue, hora, horario, type Actividad, type DiaAgenda } from "@/lib/agenda";
import { eliminarActividad, guardarActividad, guardarDia, guardarFechas, type EstadoAgenda } from "./actions";

// ---------------------------------------------------------------------------
// Reloj: "ahora" se calcula en el navegador, minuto a minuto
// ---------------------------------------------------------------------------

function suscribirReloj(avisar: () => void) {
  const t = setInterval(avisar, 20_000);
  return () => clearInterval(t);
}
const minutoActual = () => Math.floor(Date.now() / 60_000);

/** Minuto actual (se actualiza solo); null en el servidor, que no sabe la hora de quien mira. */
function useMinuto() {
  return useSyncExternalStore(suscribirReloj, minutoActual, () => null);
}

function useAvisos() {
  const [aviso, setAviso] = useState<{ n: number; texto: string } | null>(null);
  const avisar = useCallback((texto: string) => setAviso((a) => ({ n: (a?.n ?? 0) + 1, texto })), []);
  return { aviso: aviso && <AvisoBreve key={aviso.n} titulo={aviso.texto} />, avisar };
}

/**
 * Franja con lo que pasa ahora y lo que sigue, si hoy es un día de la sesión.
 * Pensada para el celular de los líderes durante la sesión.
 */
export function AhoraEnLaSesion({ dias, actividades, enlace }: { dias: DiaAgenda[]; actividades: Actividad[]; enlace?: boolean }) {
  const minuto = useMinuto();
  if (minuto === null) return null;
  const { fecha, minuto: ahora } = ahoraEnLaSesion(new Date(minuto * 60_000));
  const dia = dias.find((d) => d.fecha === fecha);
  if (!dia) return null;
  const { ahora: enCurso, sigue } = ahoraYSigue(
    actividades.filter((a) => a.dia === dia.dia),
    ahora,
  );
  if (enCurso.length === 0 && sigue.length === 0) return null;
  return (
    <div className="mb-5 grid gap-3 rounded-2xl border border-hoja-200 bg-hoja-100/60 p-4 sm:grid-cols-2 sm:p-5">
      <Franja titulo={`Ahora · día ${dia.dia}`} actividades={enCurso} vacio="Nada en este momento." tono="hoja" />
      <Franja titulo="Sigue" actividades={sigue} vacio="No queda nada más hoy." tono="sol" />
      {enlace && (
        <Link href={`/agenda?dia=${dia.dia}`} className="text-sm font-semibold text-hoja-700 hover:text-hoja-600 sm:col-span-2">
          Ver la agenda del día →
        </Link>
      )}
    </div>
  );
}

function Franja({ titulo, actividades, vacio, tono }: { titulo: string; actividades: Actividad[]; vacio: string; tono: "hoja" | "sol" }) {
  return (
    <div className="min-w-0">
      <p className={clsx("mb-1 flex items-center gap-1.5 text-xs font-bold tracking-wide uppercase", tono === "hoja" ? "text-hoja-700" : "text-sol-600")}>
        <Clock3 className="size-3.5" aria-hidden />
        {titulo}
      </p>
      {actividades.length === 0 ? (
        <p className="text-sm text-slate-500">{vacio}</p>
      ) : (
        <ul className="space-y-1">
          {actividades.map((a) => (
            <li key={a.id} className="text-sm">
              <span className="font-semibold text-marca-950">{a.actividad}</span>
              <span className="text-slate-500">
                {" · "}
                {horario(a)}
                {a.lugar && ` · ${a.lugar}`}
              </span>
              {a.solo_personal && <span className="ml-1.5 text-[11px] font-semibold text-slate-500 uppercase">personal</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lista de un día
// ---------------------------------------------------------------------------

export function ListaActividades({
  actividades,
  fecha,
  editable,
  dias,
  vacio,
}: {
  actividades: Actividad[];
  fecha: string | null;
  editable: boolean;
  dias: number[];
  vacio: string;
}) {
  const minuto = useMinuto();
  const [editando, setEditando] = useState<Actividad | null>(null);
  const [quitando, setQuitando] = useState<Actividad | null>(null);
  const { aviso, avisar } = useAvisos();
  const cerrar = useCallback(() => setEditando(null), []);

  let enCurso = new Set<string>();
  let siguientes = new Set<string>();
  let pasado: (a: Actividad) => boolean = () => false;
  if (minuto !== null && fecha) {
    const ahora = ahoraEnLaSesion(new Date(minuto * 60_000));
    if (ahora.fecha === fecha) {
      const r = ahoraYSigue(actividades, ahora.minuto);
      enCurso = new Set(r.ahora.map((a) => a.id));
      siguientes = new Set(r.sigue.map((a) => a.id));
      pasado = (a) => {
        const fin = a.hora_fin ?? a.hora_inicio;
        if (!fin || enCurso.has(a.id)) return false;
        const [h, m] = fin.split(":").map(Number);
        return h * 60 + m + (a.hora_fin ? 0 : 15) <= ahora.minuto;
      };
    } else if (ahora.fecha > fecha) {
      pasado = () => true;
    }
  }

  if (actividades.length === 0) return <p className="px-6 py-10 text-center text-sm text-slate-500">{vacio}</p>;

  return (
    <>
      <ol className="divide-y divide-slate-100">
        {actividades.map((a) => {
          const esAhora = enCurso.has(a.id);
          const esSigue = siguientes.has(a.id);
          return (
            <li
              key={a.id}
              className={clsx(
                "flex gap-3 px-4 py-3 sm:gap-4 sm:px-6",
                esAhora && "border-l-4 border-hoja-500 bg-hoja-100/60 pl-3 sm:pl-5",
                esSigue && "border-l-4 border-sol-400 bg-sol-100/40 pl-3 sm:pl-5",
                pasado(a) && "opacity-55",
              )}
            >
              <div className="w-[5.5rem] shrink-0 pt-0.5 text-sm font-semibold text-marca-900 tabular-nums sm:w-28">
                {a.hora_inicio ? (
                  <>
                    {hora(a.hora_inicio)}
                    {a.hora_fin && <span className="font-normal text-slate-400"> – {hora(a.hora_fin)}</span>}
                  </>
                ) : (
                  <span className="text-xs font-medium text-slate-400">Hora por definir</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900">
                  {a.actividad}
                  {esAhora && (
                    <span className="ml-2 align-middle">
                      <Insignia tono="hoja">Ahora</Insignia>
                    </span>
                  )}
                  {esSigue && (
                    <span className="ml-2 align-middle">
                      <Insignia tono="sol">Sigue</Insignia>
                    </span>
                  )}
                </p>
                {(a.lugar || a.solo_personal) && (
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                    {a.solo_personal && <Insignia>Personal</Insignia>}
                    {a.lugar && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3" aria-hidden />
                        {a.lugar}
                      </span>
                    )}
                  </p>
                )}
              </div>
              {editable && (
                <div className="flex shrink-0 items-start gap-0.5">
                  <button
                    type="button"
                    onClick={() => setEditando(a)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-marca-700"
                    aria-label={`Editar ${a.actividad}`}
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuitando(a)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    aria-label={`Quitar ${a.actividad}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {editable && (
        <>
          <Dialogo abierto={editando !== null} alCerrar={cerrar} titulo="Editar actividad" ancho="max-w-lg">
            {editando && <FormularioActividad key={editando.id} actividad={editando} dia={editando.dia} dias={dias} alCerrar={cerrar} alGuardar={avisar} />}
          </Dialogo>
          <QuitarActividad actividad={quitando} alCerrar={() => setQuitando(null)} alQuitar={avisar} />
        </>
      )}
      {aviso}
    </>
  );
}

function QuitarActividad({ actividad, alCerrar, alQuitar }: { actividad: Actividad | null; alCerrar: () => void; alQuitar: (t: string) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  return (
    <Dialogo
      abierto={actividad !== null}
      alCerrar={() => {
        setError(null);
        alCerrar();
      }}
      titulo="¿Quitar de la agenda?"
      descripcion={actividad && `«${actividad.actividad}» (${horario(actividad)}) se quita del día ${actividad.dia}.`}
    >
      <div className="space-y-4">
        {error && <Alerta tipo="error">{error}</Alerta>}
        <div className="flex justify-end gap-2">
          <Boton type="button" variante="secundario" onClick={alCerrar} disabled={pendiente}>
            Cancelar
          </Boton>
          <Boton
            type="button"
            variante="peligro"
            disabled={pendiente}
            onClick={() =>
              actividad &&
              iniciar(async () => {
                const r = await eliminarActividad(actividad.id);
                if (r.error) setError(r.error);
                else {
                  alCerrar();
                  alQuitar(r.ok ?? "Actividad quitada.");
                }
              })
            }
          >
            {pendiente ? "Quitando…" : "Quitar"}
          </Boton>
        </div>
      </div>
    </Dialogo>
  );
}

// ---------------------------------------------------------------------------
// Formularios
// ---------------------------------------------------------------------------

/** Botones "Fechas" y "Agregar actividad" del encabezado. */
export function AccionesAgenda({ dias, diaElegido, inicio }: { dias: number[]; diaElegido: number; inicio: string | null }) {
  const [abierto, setAbierto] = useState<"fechas" | "actividad" | null>(null);
  const { aviso, avisar } = useAvisos();
  const cerrar = useCallback(() => setAbierto(null), []);
  return (
    <>
      <Boton variante="secundario" onClick={() => setAbierto("fechas")}>
        <CalendarDays className="size-4" aria-hidden />
        Fechas
      </Boton>
      <Boton onClick={() => setAbierto("actividad")}>
        <Plus className="size-4" aria-hidden />
        Agregar actividad
      </Boton>

      <Dialogo
        abierto={abierto === "fechas"}
        alCerrar={cerrar}
        titulo="Fechas de la sesión"
        descripcion="Pon la fecha del día 0 (el día del personal): los demás días van seguidos. Con las fechas, la agenda marca qué toca ahora y qué sigue."
      >
        <FormularioFechas inicio={inicio} alCerrar={cerrar} alGuardar={avisar} />
      </Dialogo>
      <Dialogo abierto={abierto === "actividad"} alCerrar={cerrar} titulo="Agregar actividad" ancho="max-w-lg">
        {abierto === "actividad" && <FormularioActividad actividad={null} dia={diaElegido} dias={dias} alCerrar={cerrar} alGuardar={avisar} />}
      </Dialogo>
      {aviso}
    </>
  );
}

function FormularioFechas({ inicio, alCerrar, alGuardar }: { inicio: string | null; alCerrar: () => void; alGuardar: (t: string) => void }) {
  const [estado, accion] = useActionState<EstadoAgenda | undefined, FormData>(guardarFechas, undefined);
  useEffect(() => {
    if (estado?.ok) {
      alGuardar(estado.ok);
      alCerrar();
    }
  }, [estado, alGuardar, alCerrar]);
  return (
    <form action={accion} noValidate className="space-y-4">
      {estado?.error && <Alerta tipo="error">{estado.error}</Alerta>}
      <Campo etiqueta="Día 0" htmlFor="inicio" error={estado?.errores?.inicio} ayuda="Déjalo vacío para quitar las fechas.">
        <input id="inicio" name="inicio" type="date" defaultValue={estado?.valores?.inicio ?? inicio ?? ""} className="entrada" />
      </Campo>
      <div className="flex justify-end gap-2">
        <Boton type="button" variante="secundario" onClick={alCerrar}>
          Cancelar
        </Boton>
        <BotonEnviar pendiente="Guardando…">Guardar fechas</BotonEnviar>
      </div>
    </form>
  );
}

function FormularioActividad({
  actividad,
  dia,
  dias,
  alCerrar,
  alGuardar,
}: {
  actividad: Actividad | null;
  dia: number;
  dias: number[];
  alCerrar: () => void;
  alGuardar: (t: string) => void;
}) {
  const [estado, accion] = useActionState<EstadoAgenda | undefined, FormData>(
    guardarActividad.bind(null, actividad?.id ?? null),
    undefined,
  );
  const err = estado?.errores ?? {};
  const val = estado?.valores ?? {
    dia: String(actividad?.dia ?? dia),
    hora_inicio: actividad?.hora_inicio?.slice(0, 5) ?? "",
    hora_fin: actividad?.hora_fin?.slice(0, 5) ?? "",
    actividad: actividad?.actividad ?? "",
    lugar: actividad?.lugar ?? "",
    solo_personal: actividad?.solo_personal ? "on" : "",
  };

  useEffect(() => {
    if (estado?.ok) {
      alGuardar(estado.ok);
      alCerrar();
    }
  }, [estado, alGuardar, alCerrar]);

  return (
    <form action={accion} noValidate className="space-y-4">
      {estado?.error && <Alerta tipo="error">{estado.error}</Alerta>}
      <div className="grid grid-cols-3 gap-3">
        <Campo etiqueta="Día" htmlFor="dia" error={err.dia}>
          <Seleccion id="dia" name="dia" defaultValue={val.dia} className="entrada">
            {dias.map((d) => (
              <option key={d} value={d}>
                Día {d}
              </option>
            ))}
          </Seleccion>
        </Campo>
        <Campo etiqueta="Empieza" htmlFor="hora_inicio" error={err.hora_inicio}>
          <input id="hora_inicio" name="hora_inicio" type="time" defaultValue={val.hora_inicio} className="entrada" />
        </Campo>
        <Campo etiqueta="Termina" htmlFor="hora_fin" error={err.hora_fin}>
          <input id="hora_fin" name="hora_fin" type="time" defaultValue={val.hora_fin} className="entrada" />
        </Campo>
      </div>
      <Campo etiqueta="Actividad" htmlFor="actividad" error={err.actividad}>
        <input id="actividad" name="actividad" defaultValue={val.actividad} className="entrada" autoComplete="off" />
      </Campo>
      <Campo etiqueta="Lugar" htmlFor="lugar" error={err.lugar}>
        <input id="lugar" name="lugar" defaultValue={val.lugar} placeholder="Opcional" className="entrada" autoComplete="off" />
      </Campo>
      <label className="flex items-start gap-2.5 text-sm text-slate-700">
        <input
          key={val.solo_personal}
          type="checkbox"
          name="solo_personal"
          defaultChecked={val.solo_personal === "on"}
          className="mt-0.5 size-4 rounded border-slate-300 accent-marca-700"
        />
        <span>
          Solo para el personal
          <span className="block text-xs text-slate-500">Reuniones de coordinadores o consejeros: los jóvenes no participan.</span>
        </span>
      </label>
      <div className="flex justify-end gap-2">
        <Boton type="button" variante="secundario" onClick={alCerrar}>
          Cancelar
        </Boton>
        <BotonEnviar pendiente="Guardando…">{actividad ? "Guardar cambios" : "Agregar"}</BotonEnviar>
      </div>
    </form>
  );
}

/** Botón para cambiar la ropa y las notas de un día. */
export function EditarDia({ dia }: { dia: DiaAgenda }) {
  const [abierto, setAbierto] = useState(false);
  const { aviso, avisar } = useAvisos();
  const cerrar = useCallback(() => setAbierto(false), []);
  return (
    <>
      <Boton variante="fantasma" tamano="sm" onClick={() => setAbierto(true)}>
        <Pencil className="size-3.5" aria-hidden />
        Editar día
      </Boton>
      <Dialogo abierto={abierto} alCerrar={cerrar} titulo={`Día ${dia.dia}`} descripcion="La ropa del día y una nota para todos.">
        {abierto && <FormularioDia key={dia.dia} dia={dia} alCerrar={cerrar} alGuardar={avisar} />}
      </Dialogo>
      {aviso}
    </>
  );
}

function FormularioDia({ dia, alCerrar, alGuardar }: { dia: DiaAgenda; alCerrar: () => void; alGuardar: (t: string) => void }) {
  const [estado, accion] = useActionState<EstadoAgenda | undefined, FormData>(guardarDia.bind(null, dia.dia), undefined);
  const val = estado?.valores ?? { vestimenta: dia.vestimenta ?? "", notas: dia.notas ?? "" };
  useEffect(() => {
    if (estado?.ok) {
      alGuardar(estado.ok);
      alCerrar();
    }
  }, [estado, alGuardar, alCerrar]);
  return (
    <form action={accion} noValidate className="space-y-4">
      {estado?.error && <Alerta tipo="error">{estado.error}</Alerta>}
      <Campo etiqueta="Ropa" htmlFor="vestimenta" error={estado?.errores?.vestimenta} ayuda="Por ejemplo: Ropa de domingo, Camiseta del personal.">
        <input id="vestimenta" name="vestimenta" defaultValue={val.vestimenta} className="entrada" autoComplete="off" />
      </Campo>
      <Campo etiqueta="Notas" htmlFor="notas" error={estado?.errores?.notas}>
        <textarea id="notas" name="notas" rows={2} defaultValue={val.notas} className="entrada resize-y" />
      </Campo>
      <div className="flex justify-end gap-2">
        <Boton type="button" variante="secundario" onClick={alCerrar}>
          Cancelar
        </Boton>
        <BotonEnviar pendiente="Guardando…">Guardar</BotonEnviar>
      </div>
    </form>
  );
}
