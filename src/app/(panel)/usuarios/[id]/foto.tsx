"use client";

import { EditorFoto } from "@/components/foto";
import { quitarFotoUsuario, subirFotoUsuario } from "../actions";

export function FotoUsuario({ id, url, texto, editable }: { id: string; url: string | null; texto: string; editable: boolean }) {
  return (
    <EditorFoto
      url={url}
      texto={texto}
      editable={editable}
      subir={(datos) => subirFotoUsuario(id, datos)}
      quitar={() => quitarFotoUsuario(id)}
    />
  );
}
