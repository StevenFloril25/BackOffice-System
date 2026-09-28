// Despliega a producción en Vercel el último commit.
//
//   npm run desplegar
//
// Usa VERCEL_TOKEN de .env.local (nunca en la línea de comandos) y el proyecto
// de .vercel/project.json. Despliega desde una copia del commit SIN .git por
// dos motivos: solo sale lo que está commiteado, y en el plan Hobby Vercel
// rechaza (deja en UNKNOWN) los despliegues cuyo autor de commit no es miembro
// de la cuenta.
//
// Recuerda: si el cambio toca la base, primero `npm run migrate`.

import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { cargarEnvLocal, exigir } from "./env.mjs";

cargarEnvLocal();
exigir("VERCEL_TOKEN");

if (!fs.existsSync(".vercel/project.json")) {
  console.error("Falta .vercel/project.json: vincula la carpeta con `npx vercel link` una vez.");
  process.exit(1);
}

const pendientes = execSync("git status --porcelain").toString().trim();
if (pendientes) {
  console.warn("Aviso: hay cambios sin commitear; NO se incluyen en el despliegue.");
}
const commit = execSync("git rev-parse --short HEAD").toString().trim();

// Restos de despliegues anteriores (ver el comentario de la limpieza al final).
for (const d of fs.readdirSync(os.tmpdir())) {
  if (d.startsWith("backoffice-deploy-") && !d.endsWith(".log")) {
    try {
      fs.rmSync(path.join(os.tmpdir(), d), { recursive: true, force: true });
    } catch {
      // sigue bloqueada: se intentará la próxima vez
    }
  }
}

const copia = fs.mkdtempSync(path.join(os.tmpdir(), "backoffice-deploy-"));
const log = path.join(os.tmpdir(), `backoffice-deploy-${commit}.log`);

execSync(`git worktree add --detach "${copia}" HEAD`, { stdio: "ignore" });
fs.rmSync(path.join(copia, ".git"), { force: true });
fs.mkdirSync(path.join(copia, ".vercel"), { recursive: true });
fs.copyFileSync(".vercel/project.json", path.join(copia, ".vercel", "project.json"));

console.log(`Desplegando ${commit} a producción… (salida completa en ${log})`);
const salida = fs.openSync(log, "w");
const hijo = spawn("npx vercel deploy --prod --yes", {
  cwd: copia,
  shell: true,
  // Sin avisos de actualización ni telemetría: el CLI los corre en procesos en
  // segundo plano que se quedan con la carpeta abierta después de terminar.
  env: { ...process.env, NO_UPDATE_NOTIFIER: "1", VERCEL_TELEMETRY_DISABLED: "1" },
  stdio: ["ignore", salida, salida],
});

hijo.on("exit", (codigo) => {
  // En Windows algún proceso del CLI puede seguir con la carpeta abierta un
  // rato: se reintenta, y si igual falla la borra el próximo despliegue. No es
  // motivo para dar por fallido un despliegue que sí salió.
  try {
    fs.rmSync(copia, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
  } catch {
    console.warn("La copia temporal sigue en uso; se borra en el próximo despliegue.");
  }
  execSync("git worktree prune");
  const texto = fs.readFileSync(log, "utf8").replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");
  const alias = texto.match(/Aliased\s+(https:\/\/\S+)/)?.[1];
  const url = texto.match(/Production\s+(https:\/\/\S+)/)?.[1];
  if (codigo === 0) {
    console.log(`Listo: ${alias ?? url ?? "ver el log"}`);
  } else {
    console.error(`Vercel terminó con código ${codigo}. Revisa ${log}`);
  }
  process.exitCode = codigo ?? 1;
});
