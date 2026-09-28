"use client";

import { Printer } from "lucide-react";

import { claseBoton } from "@/components/ui";

export function BotonImprimir() {
  return (
    <button type="button" onClick={() => window.print()} className={claseBoton("primario", "sm")}>
      <Printer className="size-3.5" aria-hidden />
      Imprimir
    </button>
  );
}
