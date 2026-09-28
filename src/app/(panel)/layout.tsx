import { redirect } from "next/navigation";

import { Estructura } from "@/components/estructura";
import { urlFoto } from "@/lib/fotos";
import { menuVisible } from "@/lib/navegacion";
import { exigirSesion } from "@/lib/sesion";

// Todo el panel depende de la sesión: nunca se prerenderiza ni se cachea.
export const dynamic = "force-dynamic";

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
