import { z } from "zod";

/** Reglas de formulario que se repiten entre módulos. Un campo vacío se guarda como null. */

export const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres.`)
    .transform((v) => v || null);

export const telefonoOpcional = z
  .string()
  .trim()
  .max(25, "Máximo 25 caracteres.")
  .regex(/^[\d\s+()-]*$/, "Solo números, espacios y + ( ) -.")
  .transform((v) => v || null);

export const correoOpcional = z
  .string()
  .trim()
  .toLowerCase()
  .refine((v) => v === "" || z.email().safeParse(v).success, { message: "Correo no válido." })
  .transform((v) => v || null);

export const fechaOpcional = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), { message: "Fecha no válida." })
  .transform((v) => v || null);

export const idOpcional = z
  .string()
  .trim()
  .refine((v) => v === "" || z.uuid().safeParse(v).success, { message: "Opción no válida." })
  .transform((v) => v || null);

/** Primer error de cada campo, para mostrarlo debajo del campo. */
export function erroresDe(error: z.ZodError): Record<string, string> {
  const salida: Record<string, string> = {};
  for (const i of error.issues) salida[String(i.path[0])] ??= i.message;
  return salida;
}

/** Lee del formulario solo los campos esperados, como texto. */
export function leerCampos(formData: FormData, campos: readonly string[]): Record<string, string> {
  return Object.fromEntries(campos.map((c) => [c, String(formData.get(c) ?? "")]));
}
