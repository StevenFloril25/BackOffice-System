import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Hay otro lockfile en la carpeta del usuario; sin esto Turbopack toma esa
  // carpeta como raíz del proyecto.
  turbopack: { root: path.resolve(".") },
};

export default nextConfig;
