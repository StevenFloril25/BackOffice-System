import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Fecha } from "@/components/cliente";
import { SinAcceso } from "@/components/sin-acceso";
import { Alerta, Avatar, EncabezadoPagina, EncabezadoTarjeta, EnlaceBoton, Insignia, Tarjeta } from "@/components/ui";
import { urlFoto } from "@/lib/fotos";
import { exigirSesion, puede } from "@/lib/sesion";
import { estadoUsuario, listarRolesOpciones, obtenerUsuario } from "@/lib/usuarios";
import { AccionesCuenta } from "./acciones-cuenta";
import { FotoUsuario } from "./foto";
import { FormularioEditarUsuario } from "./formulario";

export const metadata: Metadata = { title: "Usuario" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function DetalleUsuario({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await exigirSesion();
  if (!puede(sesion, "usuarios.ver")) return <SinAcceso permiso="usuarios.ver" />;

  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const [usuario, roles] = await Promise.all([obtenerUsuario(id), listarRolesOpciones()]);
  if (!usuario) notFound();

  const esPropia = usuario.id === sesion.id;
  const protegido = usuario.role_is_system && !sesion.esAdmin;
  const puedeEditar = puede(sesion, "usuarios.editar") && !esPropia && !protegido;
  const puedeEliminar = puede(sesion, "usuarios.eliminar") && !esPropia && !protegido;
  const e = estadoUsuario(usuario);
  const foto = await urlFoto(usuario.avatar_path);

  // El rol de sistema solo lo asigna un admin, pero si ya lo tiene debe verse.
  const opcionesRol = roles.filter((r) => sesion.esAdmin || !r.is_system || r.id === usuario.role_id);

  return (
    <>
      <EncabezadoPagina
        migas={[{ etiqueta: "Usuarios", href: "/usuarios" }, { etiqueta: usuario.full_name || usuario.email }]}
        titulo={
          <span className="flex items-center gap-4">
            <Avatar texto={usuario.full_name || usuario.email} tamano="lg" src={foto} />
            <span className="min-w-0">
              <span className="block truncate">{usuario.full_name || "Sin nombre"}</span>
              <span className="mt-1 flex flex-wrap items-center gap-2 text-sm font-normal tracking-normal">
                <span className="text-slate-500">
                  {usuario.username && <span className="font-medium text-slate-600">@{usuario.username} · </span>}
                  {usuario.email}
                </span>
                <Insignia tono={usuario.role_is_system ? "sol" : usuario.role_name ? "marca" : "neutro"}>
                  {usuario.role_name ?? "Sin rol"}
                </Insignia>
                <Insignia tono={e.tono} punto>
                  {e.etiqueta}
                </Insignia>
              </span>
            </span>
          </span>
        }
      />

      {esPropia && (
        <div className="mb-6">
          <Alerta tipo="info" titulo="Esta es tu cuenta">
            Tus datos y tu contraseña se cambian desde{" "}
            <a href="/cuenta" className="font-semibold underline">
              Mi cuenta
            </a>
            . Tu rol y tu estado solo los puede cambiar otra persona con permiso.
          </Alerta>
        </div>
      )}
      {protegido && !esPropia && (
        <div className="mb-6">
          <Alerta tipo="aviso" titulo="Cuenta de administrador">
            Solo otro administrador puede modificar esta cuenta.
          </Alerta>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Tarjeta className="lg:col-span-2">
          <EncabezadoTarjeta titulo="Datos" descripcion={puedeEditar ? undefined : "Solo lectura."} />
          <FormularioEditarUsuario usuario={usuario} roles={opcionesRol} editable={puedeEditar} />
        </Tarjeta>

        <div className="space-y-6">
          <Tarjeta>
            <EncabezadoTarjeta titulo="Foto" />
            <div className="p-6">
              <FotoUsuario
                id={usuario.id}
                url={foto}
                texto={usuario.full_name || usuario.email}
                editable={puedeEditar || esPropia}
              />
            </div>
          </Tarjeta>

          <Tarjeta>
            <EncabezadoTarjeta titulo="Actividad" />
            <dl className="divide-y divide-slate-100 text-sm">
              <Dato etiqueta="Último ingreso">
                <Fecha iso={usuario.last_sign_in_at} conHora />
              </Dato>
              <Dato etiqueta="Cuenta creada">
                <Fecha iso={usuario.created_at} />
              </Dato>
              <Dato etiqueta="Contraseña">
                {usuario.must_change_password ? (
                  <Insignia tono="sol">Temporal</Insignia>
                ) : (
                  <span className="text-slate-700">Definida por el usuario</span>
                )}
              </Dato>
            </dl>
          </Tarjeta>

          {(puedeEditar || puedeEliminar) && (
            <AccionesCuenta
              id={usuario.id}
              nombre={usuario.full_name || usuario.email}
              activo={usuario.active}
              puedeEditar={puedeEditar}
              puedeEliminar={puedeEliminar}
            />
          )}

          <EnlaceBoton href="/usuarios" variante="fantasma" className="w-full">
            Volver al listado
          </EnlaceBoton>
        </div>
      </div>
    </>
  );
}

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3 sm:px-6">
      <dt className="text-slate-500">{etiqueta}</dt>
      <dd className="text-right font-medium text-slate-800">{children}</dd>
    </div>
  );
}
