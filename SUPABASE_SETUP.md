# Activar las cuentas de NegativeStudios

La web está alojada como sitio estático en GitHub Pages. La interfaz y el flujo de autenticación están preparados para Supabase Auth; las cuentas reales no funcionarán hasta conectar un proyecto de Supabase y completar estos pasos.

## 1. Crear el proyecto y configurar la clave pública

1. Crea un proyecto en [Supabase](https://supabase.com/).
2. En Project Settings / API, copia la **Project URL** y la **Publishable key** (o la clave pública legacy `anon`).
3. Abre `assets/supabase-config.js` y completa:
   - `url`: Project URL, por ejemplo `https://xxxx.supabase.co`.
   - `publishableKey`: la clave pública `sb_publishable_...` o la clave legacy `anon`.
4. No introduzcas la clave `service_role` ni ningún secreto privado en el sitio web.

La clave publicable está destinada al navegador; la protección de los datos depende de las políticas de acceso de la base de datos y del almacenamiento.

## 2. Crear tablas, políticas y almacenamiento

Abre **SQL Editor** en Supabase y ejecuta todo el archivo `supabase/schema.sql`.

El script crea la tabla `public.profiles`, habilita Row Level Security (RLS), limita las escrituras al propietario de cada perfil y crea el bucket público `avatars`. Los perfiles marcados como privados no se devuelven a otros usuarios mediante la tabla; las imágenes en un bucket público, en cambio, siguen siendo accesibles mediante su URL directa.

## 3. Configurar las URL de autenticación

En **Authentication / URL Configuration**:

- Site URL: `https://mrlion303.github.io/NegativeStudiosWeb/`
- Añade como Redirect URLs:
  - `https://mrlion303.github.io/NegativeStudiosWeb/**`
  - `http://localhost:5500/**` (solo si haces pruebas locales en ese puerto).

Si cambias de dominio, actualiza también `siteUrl` en `assets/supabase-config.js` y las URL permitidas en Supabase.

## 4. Correo y código de verificación

En **Authentication / Sign In / Providers / Email**:

- Habilita el registro por correo y contraseña.
- Mantén activada la confirmación de correo electrónico.
- En **Authentication / Email Templates / Confirm signup**, usa un código de un solo uso en lugar de depender solamente del enlace. Por ejemplo:

```html
<h2>Verifica tu correo de NegativeStudios</h2>
<p>Introduce este código de 6 dígitos en la página de registro:</p>
<p style="font-size: 28px; font-weight: 700; letter-spacing: 8px">{{ .Token }}</p>
<p>Si no solicitaste esta cuenta, puedes ignorar este mensaje.</p>
```

El formulario de registro verifica ese código usando el flujo OTP de Supabase. Prueba que la plantilla envíe el código correctamente antes de anunciar el registro público.

El servicio de correo predeterminado puede tener límites de envío. Para producción, configura un proveedor SMTP propio y revisa los límites de Auth para evitar que los registros legítimos se queden sin correos.

## 5. Inicio de sesión con Google

1. En Google Cloud Console, configura OAuth para una aplicación web y copia su Client ID y Client Secret.
2. En Supabase, abre **Authentication / Sign In / Providers / Google** y habilita el proveedor.
3. Añade los datos de Google en Supabase.
4. En Google Cloud, registra como URI de redirección autorizada la URL de callback que muestra Supabase, normalmente `https://<project-ref>.supabase.co/auth/v1/callback`.
5. Asegúrate de que la URL del sitio de NegativeStudios esté en los orígenes web autorizados y en la lista de redirecciones de Supabase.

La web usa Google como proveedor social inicial; pueden añadirse otros proveedores desde Supabase sin almacenar contraseñas sociales en el sitio.

## 6. Características preparadas

- Registro e inicio de sesión por correo y contraseña.
- Confirmación del correo mediante un código de 6 dígitos.
- Inicio de sesión con Google.
- Recuperación y cambio de contraseña.
- Cambio de correo con el flujo de confirmación de Supabase.
- Perfil con nombre de usuario, nombre a mostrar, biografía, avatar y preferencia de privacidad.
- Subida de avatares con rutas separadas por usuario.
- Botón de navegación que cambia de “Registrar / Iniciar sesión” a un avatar al iniciar sesión.

## Nota sobre privacidad

El perfil privado restringe el acceso a la fila de perfil a través de la API de la base de datos, pero los avatares se guardan en el bucket público para permitir mostrarlos en la web. Si después quieres privacidad estricta de imágenes o una red social con seguidores, mensajes y publicaciones privadas, habrá que diseñar esas reglas específicamente.
