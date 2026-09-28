// Carga .env.local en process.env sin imprimir nada. Lo comparten los scripts
// para que ninguna credencial tenga que pasar por la línea de comandos.
import { readFileSync } from "node:fs";
import path from "node:path";

export function cargarEnvLocal() {
  try {
    const contenido = readFileSync(path.join(import.meta.dirname, "..", ".env.local"), "utf-8");
    for (const linea of contenido.split(/\r?\n/)) {
      const t = linea.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i === -1) continue;
      const clave = t.slice(0, i).trim();
      const valor = t.slice(i + 1).trim();
      if (valor && !process.env[clave]) process.env[clave] = valor;
    }
  } catch {
    // Sin .env.local: se usan las variables del entorno tal cual.
  }
}

export function exigir(...claves) {
  const faltan = claves.filter((c) => !process.env[c]);
  if (faltan.length) {
    console.error(`Faltan en .env.local: ${faltan.join(", ")}`);
    process.exit(1);
  }
}
