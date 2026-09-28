import "server-only";

import { createClient } from "@/lib/supabase/server";

export interface RolResumenFila {
  id: string;
  key: string;
  name: string;
  description: string;
  is_system: boolean;
  usuarios: number;
  usuarios_activos: number;
  permisos: number;
}

export interface PermisoCatalogo {
  key: string;
  action: string;
  label: string;
  description: string;
}

export interface ModuloCatalogo {
  key: string;
  name: string;
  description: string;
  icon: string;
  permisos: PermisoCatalogo[];
}

export async function resumenRoles(): Promise<RolResumenFila[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("resumen_roles");
  if (error) throw new Error(`No se pudieron cargar los roles: ${error.message}`);
  return (data ?? []) as RolResumenFila[];
}

/** Módulos con sus permisos, en el orden del catálogo. */
export async function catalogoPermisos(): Promise<ModuloCatalogo[]> {
  const supabase = await createClient();
  const [{ data: modulos }, { data: permisos }] = await Promise.all([
    supabase.from("modules").select("key, name, description, icon").order("sort_order").order("name"),
    supabase.from("permissions").select("key, module_key, action, label, description").order("sort_order"),
  ]);
  return (modulos ?? []).map((m) => ({
    ...m,
    permisos: (permisos ?? [])
      .filter((p) => p.module_key === m.key)
      .map((p) => ({ key: p.key, action: p.action, label: p.label, description: p.description })),
  })) as ModuloCatalogo[];
}

export async function obtenerRol(id: string) {
  const supabase = await createClient();
  const [{ data: rol }, { data: permisos }] = await Promise.all([
    supabase.from("roles").select("id, key, name, description, is_system, created_at, updated_at").eq("id", id).maybeSingle(),
    supabase.from("role_permissions").select("permission_key").eq("role_id", id),
  ]);
  if (!rol) return null;
  return { ...rol, permisos: (permisos ?? []).map((p) => p.permission_key as string) } as {
    id: string;
    key: string;
    name: string;
    description: string;
    is_system: boolean;
    created_at: string;
    updated_at: string;
    permisos: string[];
  };
}
