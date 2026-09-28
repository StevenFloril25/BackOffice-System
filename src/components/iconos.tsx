import {
  BedDouble,
  Church,
  Flag,
  HeartHandshake,
  History,
  IdCard,
  Package,
  ScanLine,
  LayoutDashboard,
  ShieldCheck,
  Square,
  Users,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";

/**
 * Íconos por nombre. El menú y el catálogo de módulos (columna modules.icon)
 * guardan un nombre de texto, no un componente, para poder viajar del servidor
 * al cliente y vivir en la base. Un módulo nuevo agrega aquí su ícono.
 */
const ICONOS = {
  inicio: LayoutDashboard,
  users: Users,
  "shield-check": ShieldCheck,
  history: History,
  "id-card": IdCard,
  "scan-line": ScanLine,
  church: Church,
  "heart-handshake": HeartHandshake,
  flag: Flag,
  "bed-double": BedDouble,
  package: Package,
} satisfies Record<string, LucideIcon>;

export type NombreIcono = keyof typeof ICONOS;

export function Icono({ nombre, ...props }: { nombre: string } & LucideProps) {
  const Componente = (ICONOS as Record<string, LucideIcon>)[nombre] ?? Square;
  return <Componente aria-hidden {...props} />;
}
