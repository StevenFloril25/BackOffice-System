import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Rutas que se ven sin sesión. Se listan una por una: una ruta nueva no queda
// pública sin que alguien lo decida. El latido diario se protege con su propio
// secreto (ver api/mantener-activo).
const RUTAS_PUBLICAS = ["/login", "/api/mantener-activo"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Los prefetch de <Link> no necesitan refrescar la sesión de rutas que
  // quizá nunca se visiten.
  if (request.headers.get("next-router-prefetch") === "1") {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // getClaims verifica el token localmente (y lo renueva si venció); ver
  // obtenerSesion en lib/sesion.ts.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims?.sub ? data.claims : null;

  const esPublica = RUTAS_PUBLICAS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!user && !esPublica) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname !== "/" ? `?volver=${encodeURIComponent(pathname)}` : "";
    return sinCache(NextResponse.redirect(url));
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/inicio";
    url.search = "";
    return sinCache(NextResponse.redirect(url));
  }

  return sinCache(response);
}

// Una respuesta con datos de sesión nunca debe quedar en una caché compartida.
function sinCache(res: NextResponse) {
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|brand/|icon.png|apple-icon.png|favicon.ico).*)"],
};
