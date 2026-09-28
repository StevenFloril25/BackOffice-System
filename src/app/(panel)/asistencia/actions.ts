"use server";

import { revalidatePath } from "next/cache";

import { urlFoto } from "@/lib/fotos";
import { validarPermiso } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { tokenDeQr } from "@/lib/token-qr";

export type EstadoLectura = "registrado" | "ya_registrado" | "no_encontrado" | "no_valido" | "error";

export interface ResultadoLectura {
  estado: EstadoLectura;
  mensaje?: string;
  participante?: {
    id: string;
    nombres: string;
    apellidos: string;
    nombre_preferido: string;
    sexo: string | null;
    talla_camiseta: string | null;
    asistio_at: string | null;
    registrado_por: string | null;
    barrio: string | null;
    estaca: string | null;
    foto: string | null;
  };
}

/**
 * Registra la llegada a partir de lo que leyó la cámara. Toda la decisión
 * (¿existe?, ¿ya llegó?) la toma registrar_asistencia en la
 * base, en una sola operación: dos lectores escaneando el mismo QR a la vez no
 * duplican nada.
 */
export async function registrarPorQr(texto: string): Promise<ResultadoLectura> {
  const permiso = await validarPermiso("asistencia.registrar");
  if (!permiso.ok) return { estado: "error", mensaje: permiso.error };

  const token = tokenDeQr(texto);
  if (!token) return { estado: "no_valido" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("registrar_asistencia", { p_token: token });
  if (error) return { estado: "error", mensaje: error.message };

  const r = data as { estado: EstadoLectura; participante?: Record<string, unknown> };
  if (!r.participante) return { estado: r.estado };

  const p = r.participante;
  if (r.estado === "registrado") revalidatePath("/participantes");
  return {
    estado: r.estado,
    participante: {
      id: p.id as string,
      nombres: p.nombres as string,
      apellidos: p.apellidos as string,
      nombre_preferido: (p.nombre_preferido as string) ?? "",
      sexo: (p.sexo as string) ?? null,
      talla_camiseta: (p.talla_camiseta as string) ?? null,
      asistio_at: (p.asistio_at as string) ?? null,
      registrado_por: (p.registrado_por as string) ?? null,
      barrio: (p.barrio as string) ?? null,
      estaca: (p.estaca as string) ?? null,
      foto: await urlFoto(p.foto_path as string | null),
    },
  };
}

/** Registro manual: búsqueda por nombre para quien no trae su QR. */
export async function registrarManual(id: string): Promise<{ ok?: string; error?: string; asistio_at?: string }> {
  const permiso = await validarPermiso("asistencia.registrar");
  if (!permiso.ok) return { error: permiso.error };
  const supabase = await createClient();
  const { error } = await supabase.rpc("marcar_asistencia", { p_id: id, p_asistio: true });
  if (error) return { error: error.message };
  const { data } = await supabase.from("participantes").select("asistio_at").eq("id", id).maybeSingle();
  revalidatePath("/participantes");
  revalidatePath(`/participantes/${id}`);
  return { ok: "Llegada registrada.", asistio_at: data?.asistio_at ?? new Date().toISOString() };
}
