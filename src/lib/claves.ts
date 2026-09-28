/** Reglas de contraseña compartidas por el alta, el restablecimiento y el cambio propio. */
export function validarClaveNueva(nueva: string, repetida?: string): string | null {
  if (nueva.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
  // Supabase (bcrypt) solo considera los primeros 72 bytes: más largo engaña.
  if (new TextEncoder().encode(nueva).length > 72) return "La contraseña no puede superar 72 caracteres.";
  if (!/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(nueva) || !/\d/.test(nueva)) {
    return "Usa al menos una letra y un número.";
  }
  if (repetida !== undefined && nueva !== repetida) return "Las contraseñas no coinciden.";
  return null;
}
