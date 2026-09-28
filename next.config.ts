import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Hay otro lockfile en la carpeta del usuario; sin esto Turbopack toma esa
  // carpeta como raíz del proyecto.
  turbopack: { root: path.resolve(".") },
  experimental: {
    // Las fotos llegan ya reducidas (decenas de KB), pero la lista de
    // participantes en Excel pesa ~0,7 MB y va a crecer. Vercel acepta hasta
    // 4,5 MB por petición; se deja margen.
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
