import type { NombreIcono } from "@/components/iconos";

export interface ItemMenu {
  href: string;
  etiqueta: string;
  icono: NombreIcono;
  /** Permiso que habilita la entrada. Sin permiso: visible para todos. */
  permiso?: string;
}

export interface SeccionMenu {
  titulo: string;
  items: ItemMenu[];
}

/**
 * Menú lateral. Cada módulo nuevo agrega aquí su entrada con el permiso "ver"
 * que declaró en su migración; el menú filtra solo lo que el rol puede ver.
 */
export const MENU: SeccionMenu[] = [
  {
    titulo: "General",
    items: [{ href: "/inicio", etiqueta: "Inicio", icono: "inicio" }],
  },
  {
    titulo: "Conferencia",
    items: [
      { href: "/participantes", etiqueta: "Participantes", icono: "id-card", permiso: "participantes.ver" },
      { href: "/barrios", etiqueta: "Barrios", icono: "church", permiso: "barrios.ver" },
    ],
  },
  {
    titulo: "Administración",
    items: [
      { href: "/usuarios", etiqueta: "Usuarios", icono: "users", permiso: "usuarios.ver" },
      { href: "/roles", etiqueta: "Roles y permisos", icono: "shield-check", permiso: "roles.ver" },
      { href: "/bitacora", etiqueta: "Bitácora", icono: "history", permiso: "auditoria.ver" },
    ],
  },
];

export function menuVisible(permisos: string[], esAdmin: boolean): SeccionMenu[] {
  return MENU.map((s) => ({
    ...s,
    items: s.items.filter((i) => !i.permiso || esAdmin || permisos.includes(i.permiso)),
  })).filter((s) => s.items.length > 0);
}
