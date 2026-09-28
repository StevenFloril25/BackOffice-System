import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Fotos en el bucket privado "fotos" (ver 0004_usuario_y_fotos.sql).
 *
 * Nadie lee el bucket directo: el servidor sube con la service role después de
 * validar el permiso, y para mostrar genera URLs firmadas que caducan en una
 * hora. Así una foto (de un menor, por ejemplo) no queda en una dirección
 * pública permanente.
 */

const BUCKET = "fotos";
const DURACION_URL = 60 * 60;
const TIPOS: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };
const MAXIMO = 2 * 1024 * 1024;

export type CarpetaFoto = "usuarios" | "participantes" | "consejeros" | "informe";

/** URL firmada de una foto, o null si no hay. */
export async function urlFoto(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const { data } = await createAdminClient().storage.from(BUCKET).createSignedUrl(path, DURACION_URL);
  return data?.signedUrl ?? null;
}

/** URLs firmadas de varias fotos en una sola llamada: { path: url }. */
export async function urlsFotos(paths: (string | null | undefined)[]): Promise<Record<string, string>> {
  const unicos = [...new Set(paths.filter((p): p is string => !!p))];
  if (unicos.length === 0) return {};
  const { data } = await createAdminClient().storage.from(BUCKET).createSignedUrls(unicos, DURACION_URL);
  const salida: Record<string, string> = {};
  for (const d of data ?? []) if (d.path && d.signedUrl) salida[d.path] = d.signedUrl;
  return salida;
}

/**
 * Sube una foto nueva y devuelve su ruta. Cada subida usa un nombre nuevo: así
 * ningún navegador sigue mostrando la anterior desde su caché. Quien llama
 * guarda la ruta y borra la vieja.
 */
export async function subirFoto(
  carpeta: CarpetaFoto,
  id: string,
  archivo: FormDataEntryValue | null,
): Promise<{ path: string } | { error: string }> {
  if (!(archivo instanceof Blob) || archivo.size === 0) return { error: "Elige una imagen." };
  const extension = TIPOS[archivo.type];
  if (!extension) return { error: "La foto debe ser JPG, PNG o WEBP." };
  if (archivo.size > MAXIMO) return { error: "La foto supera 2 MB." };

  const path = `${carpeta}/${id}/${Date.now()}.${extension}`;
  const { error } = await createAdminClient()
    .storage.from(BUCKET)
    .upload(path, archivo, { contentType: archivo.type, upsert: false });
  if (error) return { error: "No se pudo guardar la foto. Intenta de nuevo." };
  return { path };
}

export async function borrarFoto(path: string | null | undefined) {
  if (!path) return;
  const { error } = await createAdminClient().storage.from(BUCKET).remove([path]);
  if (error) console.error("[fotos] no se pudo borrar", path, error.message);
}
