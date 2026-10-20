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

## 6. Activar el acceso con Discord y Twitch

La web ya incluye botones para los dos proveedores. Para que funcionen, hay que registrar una aplicación en cada plataforma y guardar sus credenciales en Supabase.

### Discord

1. Abre el [Discord Developer Portal](https://discord.com/developers/applications) y pulsa **New Application**.
2. Ponle un nombre (por ejemplo, `NegativeStudios Web`) y crea la aplicación.
3. Entra a **OAuth2** y busca el apartado **Redirects**. Antes de completarlo, copia la URL de callback de Supabase: abre el proyecto en Supabase → **Authentication** → **Sign In / Providers** → **Discord**. La URL será parecida a `https://<project-ref>.supabase.co/auth/v1/callback`; copia la que muestra tu propio panel, no escribas una inventada.
4. En Discord, añade esa URL en **Redirects** y guarda los cambios.
5. Copia el **Client ID** y el **Client Secret** de Discord.
6. Regresa a Supabase → **Authentication** → **Sign In / Providers** → **Discord**, activa el proveedor, pega el Client ID y Client Secret y guarda.

### Twitch

1. Abre la [Twitch Developer Console](https://dev.twitch.tv/console/apps) e inicia sesión. Twitch puede pedirte que actives la autenticación en dos pasos en tu cuenta antes de registrar una aplicación.
2. Pulsa **Register Your Application** y crea una aplicación para el sitio web.
3. En Supabase → **Authentication** → **Sign In / Providers** → **Twitch**, copia la URL de callback que muestra el panel.
4. Regresa al formulario de Twitch y pega esa URL en **OAuth Redirect URL**. Selecciona la categoría que mejor encaje, completa el CAPTCHA y crea la aplicación.
5. En la aplicación creada, pulsa **Manage**. Copia el **Client ID** y genera un **Client Secret**.
6. En Supabase, abre el proveedor **Twitch**, actívalo, pega el Client ID y Client Secret y guarda los cambios.

### Comprueba las URL de retorno

En Supabase → **Authentication** → **URL Configuration**, mantén como **Site URL**:

`https://mrlion303.github.io/NegativeStudiosWeb/`

En **Redirect URLs**, asegúrate de que exista:

`https://mrlion303.github.io/NegativeStudiosWeb/**`

Los proveedores Discord y Twitch deben tener configurada la URL de callback de Supabase; esa URL no es la misma que la dirección de GitHub Pages. Las credenciales de cliente y los secretos OAuth se introducen en los paneles de los proveedores y en Supabase, nunca en el JavaScript de la web ni en GitHub.

### Foto de perfil del proveedor

Al iniciar sesión, la web intenta obtener la imagen que Supabase recibe del proveedor OAuth. Si el perfil todavía no tiene avatar, guarda la imagen proporcionada por Discord o Twitch en el perfil público. Si el usuario ya ha subido una foto manualmente, esa imagen tiene prioridad y no se sobrescribe automáticamente. La disponibilidad del avatar depende de que el proveedor devuelva una URL de imagen dentro de los datos de identidad.

Después de guardar estos cambios, vuelve a ejecutar el archivo completo `supabase/schema.sql` desde el SQL Editor de Supabase para actualizar también el trigger que crea perfiles y copiar mejor los datos de nombre y avatar que envían los proveedores.

## 7. Características preparadas

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

Los perfiles, avatares, banners y comentarios son públicos por diseño, incluso cuando alguien no ha iniciado sesión. El nombre de usuario tiene un límite de cambio de 14 días aplicado en la base de datos. No añadas datos personales sensibles a la biografía ni publiques información privada en los comentarios. Si en el futuro se quiere añadir contenido privado, habrá que diseñar políticas de acceso específicas para esa función.


## 8. Activar la eliminación de cuentas

La eliminación usa una Supabase Edge Function. Puedes desplegarla desde el navegador, sin instalar la CLI.

1. Abre tu proyecto en [Supabase Dashboard](https://supabase.com/dashboard) y entra en **Edge Functions** desde el menú lateral.
2. Pulsa **Deploy a new function** y elige **Via Editor**.
3. Ponle exactamente este nombre: `delete-account`.
4. En GitHub, abre [`supabase/functions/delete-account/index.ts`](https://github.com/MrLion303/NegativeStudiosWeb/blob/main/supabase/functions/delete-account/index.ts), copia todo el código y pégalo en el editor de Supabase, reemplazando el ejemplo que venga por defecto.
5. Pulsa **Deploy function** y espera a que Supabase confirme que se publicó.
6. No crees secretos manuales llamados `SUPABASE_URL`, `SUPABASE_ANON_KEY` o `SUPABASE_SERVICE_ROLE_KEY`: Supabase los proporciona a las Edge Functions. Nunca pongas una clave administrativa en GitHub o en JavaScript del navegador.
7. Para probarlo, inicia sesión en la web y usa la sección **Eliminar mi cuenta** de `configurar-perfil.html`. Es una operación permanente; haz la primera prueba únicamente con una cuenta que estés dispuesto a borrar.

## 9. Activar comentarios

Después de ejecutar el nuevo `supabase/schema.sql`, abre una página de proyecto, por ejemplo OVERLAND. Los comentarios se leen públicamente; para escribir o responder es necesario iniciar sesión. Las respuestas quedan enlazadas al comentario original y no se pueden asociar a otro proyecto.
