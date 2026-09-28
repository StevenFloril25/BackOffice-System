// Crea (o promueve) el primer administrador con ADMIN_EMAIL / ADMIN_NAME /
// ADMIN_PASSWORD de .env.local. Es la única forma de entrar la primera vez:
// el sistema no tiene registro público.
//
// Si el correo ya existe en Supabase Auth, no le cambia la contraseña: solo le
// asigna el rol de administrador y lo activa.

import { createClient } from "@supabase/supabase-js";

import { cargarEnvLocal, exigir } from "./env.mjs";

cargarEnvLocal();
exigir("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ADMIN_EMAIL");

const email = process.env.ADMIN_EMAIL.trim().toLowerCase();
const nombre = (process.env.ADMIN_NAME ?? "").trim();
const password = process.env.ADMIN_PASSWORD ?? "";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: rolAdmin, error: errRol } = await supabase.from("roles").select("id").eq("key", "admin").single();
if (errRol || !rolAdmin) {
  console.error("No existe el rol admin. ¿Corriste primero `npm run migrate`?");
  process.exit(1);
}

async function buscarPorEmail(correo) {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const u = data.users.find((x) => x.email?.toLowerCase() === correo);
    if (u) return u;
    if (data.users.length < 200) return null;
  }
  return null;
}

const existente = await buscarPorEmail(email);

if (!existente) {
  if (password.length < 8) {
    console.error("ADMIN_PASSWORD debe tener al menos 8 caracteres.");
    process.exit(1);
  }
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: nombre },
    app_metadata: { role_key: "admin", must_change_password: true },
  });
  if (error) {
    console.error("No se pudo crear el usuario:", error.message);
    process.exit(1);
  }
  await supabase.from("audit_log").insert({
    actor_email: "script:crear-admin",
    action: "usuario.crear",
    entity: "usuario",
    entity_id: data.user.id,
    summary: `Creó el primer administrador ${email}`,
  });
  console.log(`Administrador creado: ${email}. Al primer ingreso se le pedirá cambiar la contraseña.`);
} else {
  const { error } = await supabase
    .from("profiles")
    .update({ role_id: rolAdmin.id, active: true, ...(nombre ? { full_name: nombre } : {}) })
    .eq("id", existente.id);
  if (error) {
    console.error("No se pudo asignar el rol:", error.message);
    process.exit(1);
  }
  await supabase.auth.admin.updateUserById(existente.id, { ban_duration: "none" });
  console.log(`El usuario ${email} ya existía: ahora es administrador y está activo.`);
}
