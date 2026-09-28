import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";

import { MARCA } from "@/lib/marca";

import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: `${MARCA.nombre} · ${MARCA.sesion}`, template: `%s · ${MARCA.nombre}` },
  description: `Sistema administrativo de ${MARCA.nombre}, ${MARCA.sesion}.`,
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#025582",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${jakarta.variable} h-full`}>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
