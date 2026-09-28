// Aplica las migraciones pendientes de supabase/migrations/*.sql contra
// DATABASE_URL (Session pooler de Supabase) y registra cada una en la tabla
// _migrations. Cada archivo corre en su propia transacción: si falla, hace
// rollback y se detiene.
//
//   npm run migrate                       aplica las pendientes
//   npm run migrate -- --estado           lista aplicadas y pendientes

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import pg from "pg";

import { cargarEnvLocal, exigir } from "./env.mjs";

cargarEnvLocal();
exigir("DATABASE_URL");

const DIR = path.join(import.meta.dirname, "..", "supabase", "migrations");

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
} catch (err) {
  // El mensaje de pg puede incluir el host, nunca la contraseña; igual se
  // resume para no volcar la cadena completa.
  console.error("No se pudo conectar a la base:", err.code ?? err.message);
  console.error("Revisa DATABASE_URL: debe ser la del Session pooler (puerto 5432) con la contraseña real.");
  process.exit(1);
}

await client.query(`
  create table if not exists _migrations (
    id serial primary key,
    name text not null unique,
    applied_at timestamptz not null default now()
  );
  revoke all on _migrations from anon, authenticated;
`);

const archivos = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
const { rows } = await client.query("select name from _migrations");
const aplicadas = new Set(rows.map((r) => r.name));

if (process.argv.includes("--estado")) {
  for (const f of archivos) console.log(`${aplicadas.has(f) ? "✓ aplicada " : "· pendiente"}  ${f}`);
  await client.end();
  process.exit(0);
}

let corridas = 0;
for (const archivo of archivos) {
  if (aplicadas.has(archivo)) continue;
  const sql = readFileSync(path.join(DIR, archivo), "utf-8");
  process.stdout.write(`Aplicando ${archivo}... `);
  try {
    await client.query("begin");
    await client.query(sql);
    await client.query("insert into _migrations (name) values ($1)", [archivo]);
    await client.query("commit");
    console.log("✓");
    corridas++;
  } catch (err) {
    await client.query("rollback");
    console.log("✗");
    console.error(`  ${err.message}`);
    await client.end();
    process.exit(1);
  }
}

console.log(corridas ? `Listo: ${corridas} migración(es) aplicada(s).` : "Nada pendiente.");
await client.end();
