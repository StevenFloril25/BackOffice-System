/**
 * Mensaje para mostrar a partir de un error de la base.
 *
 * Las reglas de la conferencia (sexo del ala, cupo de la habitación, lugares de
 * la compañía) las valida la base con `raise exception` y un texto pensado para
 * la persona: ese llega con el código P0001 y se muestra tal cual. Cualquier
 * otro error es técnico y se reemplaza por el mensaje genérico de la acción.
 */
export function mensajeBd(error: { code?: string; message: string } | null | undefined, porDefecto: string): string {
  if (error?.code === "P0001" && error.message) return error.message;
  return porDefecto;
}
