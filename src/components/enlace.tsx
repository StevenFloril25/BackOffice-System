import NextLink from "next/link";
import type { ComponentProps } from "react";

/**
 * <Link> de Next sin prefetch. Se usa en lugar de next/link.
 *
 * Next pide por adelantado cada enlace que aparece en pantalla. En el panel
 * todas las páginas son dinámicas (dependen de la sesión) y no hay loading.tsx,
 * así que ese pedido no adelanta nada y a cada uno el servidor le responde
 * consultando la sesión en Supabase. Con 30 a 65 enlaces por página (menú,
 * habitaciones, compañías) la ráfaga atrasaba la página que sí se había pedido:
 * de ~0,5 s pasaba a 2-9 s. Medido en producción el 2026-09-28.
 */
export default function Link({ prefetch = false, ...props }: ComponentProps<typeof NextLink>) {
  return <NextLink prefetch={prefetch} {...props} />;
}
