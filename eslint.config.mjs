import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
  {
    // Los enlaces van por @/components/enlace (sin prefetch): ver el porqué ahí.
    ignores: ["src/components/enlace.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "next/link",
              importNames: ["default"],
              message: "Usa Link de @/components/enlace: el de Next hace prefetch y en el panel satura al servidor.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
