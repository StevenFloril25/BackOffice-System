import "server-only";

import type { Sesion } from "@/lib/sesion";
import { createAdminClient } from "@/lib/supabase/admin";

interface Entrada {
  accion: string;
  entidad: string;
  entidadId?: string;
  resumen: string;
  detalles?: Record<string, unknown>;
}

/**
 * Deja constancia de una acción administrativa. La bitácora no se puede
 * escribir desde el navegador (RLS), así que pasa por la service role.
 *
 * Un fallo al registrar no deshace la acción ya hecha: se informa en el log
 * del servidor y la operación sigue. Las acciones sobre roles registran desde
 * la propia base (guardar_rol / eliminar_rol), en la misma transacción.
 */
export async function registrarAuditoria(sesion: Sesion, e: Entrada) {
  const { error } = await createAdminClient().from("audit_log").insert({
    actor_id: sesion.id,
    actor_email: sesion.email,
    action: e.accion,
    entity: e.entidad,
    entity_id: e.entidadId ?? null,
    summary: e.resumen,
    details: e.detalles ?? {},
  });
  if (error) console.error("[auditoría] no se pudo registrar:", e.accion, error.message);
}
