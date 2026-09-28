# BackOffice FSY

Sistema administrativo de las conferencias FSY. Primer módulo: **acceso**
(login, usuarios, roles y permisos por módulo, bitácora). Los siguientes
módulos se enchufan al mismo esquema de permisos.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Supabase
(Postgres + Auth) · Vercel.

## Puesta en marcha

### 1. Configuración

Copia `.env.local.example` a `.env.local` (o usa el que ya trae la guía paso a
paso) y completa:

| Variable | Dónde se obtiene | Uso |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → Data API | App |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API Keys | App |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API Keys (secreta) | Servidor: crear usuarios, contraseñas |
| `DATABASE_URL` | Supabase → **Connect** → Session pooler (5432) | Solo `npm run migrate` |
| `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD` | Los eliges tú | Solo `npm run crear-admin` |

> El repositorio es público: `.env.local` está en `.gitignore` y nunca se sube.

### 2. Base de datos y primer administrador

```bash
npm install
npm run migrate        # crea tablas, funciones y políticas (idempotente)
npm run crear-admin    # crea el primer admin con ADMIN_* de .env.local
```

En Supabase → **Authentication → Sign In / Providers**, desactiva
*Allow new users to sign up*: las cuentas solo las crea un administrador.

### 3. Desarrollo

```bash
npm run dev            # http://localhost:3000
npm run typecheck && npm run lint && npm run build
```

### 4. Vercel

Variables de entorno del proyecto (Production y Preview):
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y
`SUPABASE_SERVICE_ROLE_KEY` (esta **sin** prefijo `NEXT_PUBLIC_`).
`DATABASE_URL` y `ADMIN_*` no van a Vercel.

Orden al desplegar un cambio que toca la base: **primero `npm run migrate`,
después el despliegue.**

## Modelo de permisos

- `modules` y `permissions` son un **catálogo**: cada permiso es
  `<módulo>.<acción>` (`usuarios.crear`, `roles.ver`…).
- Un **rol** es un conjunto de permisos (`role_permissions`). Se editan desde
  *Roles y permisos* sin desplegar nada.
- El rol **Administrador** (`is_system`) no guarda permisos: la base le concede
  todos, también los de módulos futuros. No se puede editar ni borrar, y
  siempre debe quedar al menos un administrador activo (lo impide un
  disparador).
- La autorización vive en la base (`has_permission()` + RLS) y se repite en
  cada acción del servidor. Ocultar un botón es solo interfaz.
- Nadie modifica su propio rol ni su propia cuenta desde Usuarios; solo un
  admin toca a otro admin.
- Las contraseñas que crea o restablece un admin son temporales: al primer
  ingreso se exige cambiarlas.

## Cómo agregar un módulo nuevo

1. **Migración** `supabase/migrations/00NN_<modulo>.sql`: tablas con RLS usando
   `has_permission('<modulo>.<accion>')`, y el catálogo:

   ```sql
   insert into modules (key, name, description, icon, sort_order)
   values ('participantes', 'Participantes', 'Jóvenes inscritos.', 'users', 30);

   insert into permissions (key, module_key, action, label, sort_order) values
     ('participantes.ver', 'participantes', 'ver', 'Ver', 10),
     ('participantes.crear', 'participantes', 'crear', 'Crear', 20);
   ```

   El admin lo recibe automáticamente; los demás roles, desde el panel.
2. **Menú:** una entrada en `src/lib/navegacion.ts` con su permiso `ver`.
3. **Ícono:** si es nuevo, agrégalo a `src/components/iconos.tsx`.
4. **Páginas** en `src/app/(panel)/<modulo>/`: `exigirSesion()` +
   `puede(sesion, "<modulo>.ver")`; en cada acción, `validarPermiso(...)`.

## Estructura

```
supabase/migrations/     Esquema, RLS y funciones (guardar_rol, listar_usuarios…)
scripts/                 migrate.mjs, crear-admin.mjs
src/proxy.ts             Sesión en cada petición (el "middleware" de Next 16)
src/lib/sesion.ts        Sesión + permisos resueltos una vez por petición
src/app/login            Ingreso
src/app/primer-ingreso   Cambio obligatorio de contraseña temporal
src/app/(panel)/         Inicio, usuarios, roles, bitácora, mi cuenta
```
