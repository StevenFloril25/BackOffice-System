import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Cliente con la service role: ignora RLS y puede administrar Supabase Auth.
 *
 * Solo para lo que la sesión del usuario no puede hacer por diseño (crear
 * cuentas, cambiar contraseñas ajenas, rol y estado). Quien lo use tiene que
 * haber validado antes el permiso con `exigirPermiso`; este cliente no valida
 * nada. `server-only` hace fallar el build si alguien lo importa desde un
 * componente de cliente.
 */
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
