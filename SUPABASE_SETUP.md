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

El script crea o actualiza `public.profiles`, la tabla `public.project_comments`, las políticas RLS y los buckets públicos `avatars` (3 MB) y `banners` (6 MB). **Cuando actualices el sistema, vuelve a ejecutar el archivo completo `supabase/schema.sql`** en SQL Editor. Los perfiles son siempre públicos. El servidor impide cambiar el nombre de usuario antes de que pasen 14 días; no depende de la interfaz del navegador.

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
- Perfil público con diseño de banner, avatar, nombre a mostrar, nombre de usuario, biografía y fecha de registro.
- Página independiente `configurar-perfil.html` para personalizar el perfil, cambiar avatar/banner, correo y contraseña.
- Los nombres de usuario solo pueden cambiarse una vez cada 14 días; Supabase aplica la regla del lado del servidor.
- Comentarios públicos por proyecto con respuestas y opción de eliminar comentarios propios.
- Botón de navegación con el mismo estilo que “Descargar Negative Client”; cambia a un avatar cuando hay sesión.

## Nota sobre privacidad

El perfil privado restringe el acceso a la fila de perfil a través de la API de la base de datos, pero los avatares se guardan en el bucket público para permitir mostrarlos en la web. Si después quieres privacidad estricta de imágenes o una red social con seguidores, mensajes y publicaciones privadas, habrá que diseñar esas reglas específicamente.


## 7. Activar la eliminación de cuentas

La eliminación permanente usa una Supabase Edge Function porque la web publicada en GitHub Pages no puede guardar de forma segura una clave administrativa.

1. Instala e inicia sesión en [Supabase CLI](https://supabase.com/docs/guides/cli) y vincula el proyecto correcto.
2. Desde la raíz de este repositorio, despliega la función:

   ```bash
   supabase functions deploy delete-account
   ```

3. En **Project Settings / Edge Functions / Secrets** (o mediante Supabase CLI), comprueba que la función tenga disponibles `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`. Usa la clave administrativa solo como secreto del servidor; nunca la copies a un HTML, JavaScript o repositorio público.
4. Prueba la eliminación con una cuenta de prueba. La función valida la sesión del usuario, elimina sus archivos de avatar/banner y después elimina la cuenta, lo que también elimina el perfil y sus comentarios asociados.

## 8. Activar comentarios

Después de ejecutar el nuevo `supabase/schema.sql`, abre una página de proyecto, por ejemplo OVERLAND. Los comentarios se leen públicamente; para escribir o responder es necesario iniciar sesión. Las respuestas quedan enlazadas al comentario original y no se pueden asociar a otro proyecto.
