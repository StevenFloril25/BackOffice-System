import { redirect } from "next/navigation";

import { Estructura } from "@/components/estructura";
import { urlFoto } from "@/lib/fotos";
import { menuVisible } from "@/lib/navegacion";
import { exigirSesion } from "@/lib/sesion";

// Todo el panel depende de la sesión: nunca se prerenderiza ni se cachea.
export const dynamic = "force-dynamic";

// Sin loading.tsx en el panel, a propósito. Con esa frontera de Suspense, este
// layout que consulta la sesión en cada pedido y acciones que refrescan la
// cookie de Supabase y llaman a revalidatePath, Next 16.2 a veces nunca aplica
// la respuesta de la acción: los datos se guardan pero el botón queda en
// "Guardando…" (vercel/next.js#98303). Pasaba en ~la mitad de los guardados;
// sin la frontera, en ninguno. El menú muestra la carga en el enlace tocado.

export default async function LayoutPanel({ children }: { children: React.ReactNode }) {
  const sesion = await exigirSesion();
  if (sesion.debeCambiarClave) redirect("/primer-ingreso");
  const foto = await urlFoto(sesion.fotoPath);

  return (
    <Estructura
      menu={menuVisible(sesion.permisos, sesion.esAdmin)}
      usuario={{ nombre: sesion.nombre, email: sesion.email, rol: sesion.rol?.name ?? "Sin rol asignado", foto }}
    >
      {children}
    </Estructura>
  );
}
