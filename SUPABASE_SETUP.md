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

- Site URL: `https://negativestudios.akjon.dev/`
- Añade como Redirect URLs:
  - `https://negativestudios.akjon.dev/**`
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
5. En Google Cloud Console, añade `https://negativestudios.akjon.dev` como origen JavaScript autorizado. En Supabase, añade `https://negativestudios.akjon.dev/**` a las URL de redirección permitidas.

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

`https://negativestudios.akjon.dev/`

En **Redirect URLs**, asegúrate de que exista:

`https://negativestudios.akjon.dev/**`

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
5. Pulsa **Deploy function** y espera a que Supabase confirme que se publicó. La función permite el dominio actual `https://negativestudios.akjon.dev`, además de GitHub Pages y `http://localhost:5500` para pruebas locales.
6. Cada vez que cambie `supabase/functions/delete-account/index.ts` en GitHub, vuelve a copiar el archivo completo en la función `delete-account` del panel y pulsa **Deploy function**. El despliegue de la página web por GitHub Pages no actualiza automáticamente esta función.
7. No crees secretos manuales llamados `SUPABASE_URL`, `SUPABASE_ANON_KEY` o `SUPABASE_SERVICE_ROLE_KEY`: Supabase los proporciona a las Edge Functions. Nunca pongas una clave administrativa en GitHub o en JavaScript del navegador.
8. Para probarlo, inicia sesión en la web y usa la sección **Eliminar mi cuenta** de `configurar-perfil.html`. Es una operación permanente; haz la primera prueba únicamente con una cuenta que estés dispuesto a borrar.


## 10. Inicio de sesión con nombre de usuario

Para permitir acceso con correo o nombre de usuario, despliega la función `login-by-username`:

1. En Supabase → **Edge Functions**, crea una función llamada exactamente `login-by-username` usando el editor web.
2. Copia el contenido de [`supabase/functions/login-by-username/index.ts`](https://github.com/MrLion303/NegativeStudiosWeb/blob/main/supabase/functions/login-by-username/index.ts) y publícalo.
3. Desactiva **Verify JWT** para esta función porque el usuario todavía no ha iniciado sesión. La función valida internamente la contraseña con Supabase Auth antes de devolver tokens. El despliegue actual debe conservar **Verify JWT: OFF**; no actives esa opción, porque bloquearía los inicios de sesión por nombre de usuario antes de llegar al código.
4. El código permite únicamente los orígenes `https://negativestudios.akjon.dev`, `https://mrlion303.github.io` y `http://localhost:5500`, y devuelve `Cache-Control: no-store` para no almacenar respuestas que contienen tokens.
5. No añadas claves privadas al navegador. La función usa las variables de entorno de Supabase; nunca copies la `service_role` a archivos públicos.

Hasta que la función se despliegue, el inicio de sesión por correo sigue disponible; el inicio con nombre de usuario mostrará un aviso. El estado desplegado del proyecto NegativeWeb debe seguir en **Verify JWT: OFF** para esta función.

## 11. Centro de notificaciones, menciones y menús de moderación

Ejecuta otra vez **todo** `supabase/schema.sql` en SQL Editor para crear la tabla privada de notificaciones, sus disparadores y la tabla de menciones. Se generan notificaciones por solicitudes de amistad, corazones en comentarios y publicaciones, respuestas a comentarios y menciones en publicaciones. Los usuarios solo pueden leer y marcar como leídas sus propias notificaciones.

Las opciones de borrar contenido también se muestran en el menú de tres puntos. Los permisos reales siguen impuestos por RLS y las funciones protegidas: una cuenta normal puede borrar solo sus propios comentarios y publicaciones; la capacidad de moderación requiere el badge correspondiente.

## 12. Conectar Google, Discord, Twitch y hasta tres cuentas Microsoft

### Google, Discord y Twitch

Antes de usar la vinculación, habilita la opción **Allow manual linking** en Supabase → **Authentication → Settings**. Esta opción viene desactivada por defecto; sin ella, el botón «Vincular» no puede asociar una identidad OAuth a una cuenta Negative existente. Este ajuste pertenece a Supabase Auth y no se activa ejecutando el SQL del repositorio.

Después, activa y configura Google, Discord y Twitch en Supabase → **Authentication → Sign In / Providers**, siguiendo los pasos de esta guía. Comprueba también que la URL `https://negativestudios.akjon.dev/**` siga en **Authentication → URL Configuration → Redirect URLs**.

Desde **Personalizar perfil → Conexiones**, el usuario debe iniciar sesión primero en la cuenta de Negative que desea conservar y después vincular sus cuentas externas. La vinculación usa la función `linkIdentity()`; al volver de Google, Discord o Twitch, Supabase guarda esa identidad en el mismo usuario de Auth y la web conserva el mismo perfil, nombre de usuario, amistades, publicaciones y comentarios.

A partir de entonces, los botones sociales de `cuenta.html` (`signInWithOAuth()`) permiten entrar con cualquiera de las identidades que estén vinculadas y Supabase devuelve la misma cuenta de Negative. Si el proveedor usa el mismo correo verificado, Supabase también puede enlazar automáticamente esa identidad. Para cuentas externas con correos diferentes se necesita la vinculación manual descrita arriba.

**Importante:** si una cuenta de Google, Discord o Twitch ya está vinculada a otro usuario de Supabase, no se puede asociar directamente a una segunda cuenta ni se fusionarán perfiles automáticamente. Inicia sesión con la cuenta de Negative que ya tiene esa identidad vinculada. No elimines ni recrees usuarios para intentar unirlos. Antes de desvincular una identidad, asegúrate de conservar otro método de acceso; la web impide quitar el último método disponible.

### Microsoft / Minecraft

La vinculación Microsoft usa la Edge Function `microsoft-link`; no utiliza los proveedores sociales enlazados a Supabase porque hay que mantener hasta tres cuentas Microsoft distintas por perfil.

1. Registra una aplicación web en [Microsoft Entra](https://entra.microsoft.com/) que permita cuentas personales de Microsoft (y organizacionales, si las necesitas).
2. En la configuración de autenticación de la aplicación, añade como redirect URI de plataforma **Web** la URL exacta de tu proyecto Supabase seguida de `/functions/v1/microsoft-link`. El valor tiene esta forma: `https://TU-PROYECTO.supabase.co/functions/v1/microsoft-link`; reemplaza el dominio por el que muestra tu propio proyecto.
3. Configura los permisos de Microsoft necesarios para la identidad y Xbox Live, incluido `XboxLive.signin`, y acepta el consentimiento que solicite Microsoft.
4. La Edge Function `microsoft-link` ya está desplegada en el proyecto `NegativeWeb`. Su código fuente está en [`supabase/functions/microsoft-link/index.ts`](https://github.com/MrLion303/NegativeStudiosWeb/blob/main/supabase/functions/microsoft-link/index.ts). Si haces cambios en ese archivo, vuelve a desplegar la función desde Supabase.
5. La función tiene **Verify JWT** desactivado para permitir el callback GET de Microsoft. No queda abierta sin control: cada petición POST comprueba el Bearer token con Supabase Auth y el callback GET exige un estado de un solo uso, verifica el nonce y la firma del ID token de Microsoft.
6. En Supabase → **Edge Functions → Secrets**, configura:
   - `MICROSOFT_CLIENT_ID`: Application (client) ID de Microsoft Entra.
   - `MICROSOFT_CLIENT_SECRET`: valor del Client Secret de la aplicación de Entra.
   - `MICROSOFT_TOKEN_ENCRYPTION_KEY`: secreto aleatorio largo (32 bytes o más) para cifrar los tokens. No lo compartas ni lo guardes en GitHub.
   
   Supabase proporciona las variables internas del proyecto que usa la función. No crees ni copies claves administrativas en el navegador.
7. La URL exacta de retorno de Microsoft Entra para este proyecto es `https://fdoqiddixjxzaugkqquo.supabase.co/functions/v1/microsoft-link`. Debe estar registrada como plataforma **Web** en Entra; no uses la URL de Negative como callback de Microsoft.
8. Las tablas `microsoft_account_connections` y `microsoft_oauth_states` ya existen en la base de datos actual. Ambas tienen RLS activo y deniegan lectura directa a `anon` y `authenticated`; solo la función de servidor puede consultar o guardar tokens cifrados. No hace falta volver a ejecutar el esquema para este despliegue.

Las tres posiciones Microsoft se muestran en la pestaña **Conexiones**. La vinculación guarda una identidad Microsoft y tokens cifrados para futuras integraciones con el launcher; todavía no implementa el inicio de sesión Minecraft en el launcher ni comprueba licencias/entitlements. Esa integración requiere desarrollar y probar el flujo Xbox Live / Minecraft del launcher después.



Para activar las respuestas del foro, vuelve a ejecutar el archivo completo `supabase/schema.sql`. Este crea `forum_post_comments`, permite que cada usuario elimine únicamente sus propias respuestas y genera notificaciones para las respuestas a publicaciones y a otros comentarios.

## 9. Activar comentarios

Después de ejecutar el nuevo `supabase/schema.sql`, abre una página de proyecto, por ejemplo OVERLAND. Los comentarios se leen públicamente; para escribir o responder es necesario iniciar sesión. Las respuestas quedan enlazadas al comentario original y no se pueden asociar a otro proyecto.


## Badges y moderación

Después de añadir los emblemas, vuelve a ejecutar **todo** `supabase/schema.sql` en Supabase → SQL Editor. Esto crea la tabla de badges y las funciones protegidas para asignarlos y moderar comentarios. La cuenta `mrlion303` se registra como administradora si su perfil ya existe al ejecutar el esquema; si creas esa cuenta después, vuelve a ejecutar el esquema para registrarla.

Los emblemas se cargan desde `assets/badges/mod.png` y `assets/badges/verificado.png`. La interfaz no es la autoridad de los permisos: Supabase valida que solo la cuenta administradora pueda asignar badges y que solo las cuentas con badge de moderador puedan eliminar comentarios ajenos.


## Foro, amistades, publicaciones y corazones

Para mostrar el contador de amigos y abrir la lista pública en los perfiles, vuelve a ejecutar el esquema completo `supabase/schema.sql`. Las políticas nuevas solo permiten consultar públicamente las amistades con estado `accepted`; las solicitudes pendientes siguen limitadas a las personas implicadas.

Ejecuta **todo** `supabase/schema.sql` en Supabase → SQL Editor. Esta actualización añade:

- Solicitudes de amistad, aceptación/rechazo y eliminación de amistades.
- En los perfiles, sugerencias de hasta tres personas y solicitudes recibidas.
- Un foro en `foro.html`, cuyas publicaciones también aparecen en el perfil de su autor.
- Formato de texto en publicaciones: negrita, cursiva y texto más grande o pequeño.
- Adjuntos PNG, JPG o WebP de hasta 5 MB.
- Reacciones de corazón en comentarios y publicaciones.
- Respuestas a publicaciones, con respuestas anidadas y notificaciones al autor o al usuario respondido.

La cuenta con badge de moderador también puede eliminar publicaciones ajenas del foro; Supabase comprueba el permiso mediante una función protegida.
- Políticas de acceso para solicitudes, publicaciones, corazones e imágenes.

El esquema crea el bucket público `post-images`. Los perfiles, publicaciones e imágenes adjuntas son públicos por diseño; no publiques información privada.

Después de ejecutar el SQL, prueba con dos cuentas distintas: envía una solicitud desde una, acéptala desde la otra, crea una publicación con formato e imagen y comprueba los corazones. El código ya está preparado, pero estas tablas y políticas no se activan en Supabase hasta ejecutar el esquema.

## Auditoría y mantenimiento de Supabase

El esquema actual mantiene RLS activo en las tablas públicas y aplica permisos explícitos:

- Las consultas públicas solo pueden leer perfiles, proyectos, comentarios, publicaciones, respuestas, reacciones y amistades aceptadas.
- Publicar, responder, reaccionar, actualizar perfiles y gestionar amistades requiere una sesión autenticada.
- Las solicitudes pendientes y las notificaciones son privadas.
- Los tokens Microsoft y la lista de administradores no tienen acceso directo desde el navegador; solo las funciones de servidor pueden utilizarlos.
- Las funciones que se ejecutan exclusivamente como triggers no deben exponerse como RPC. El bloque final de `supabase/schema.sql` revoca su ejecución directa y deja los RPC de la aplicación solo para `authenticated`.

**Importante para el inicio con nombre de usuario:** la Edge Function `login-by-username` debe estar desplegada con **Verify JWT desactivado**. No hay una sesión válida todavía cuando se llama al endpoint; la propia función verifica la contraseña con Supabase Auth antes de entregar los tokens de sesión. Si se activa Verify JWT, Supabase rechazará la petición antes de ejecutar esa validación.

### Proveedores sociales

Si aparece `provider is not enabled`, abre Supabase → Authentication → Sign In / Providers y habilita el proveedor que se desea utilizar. Google, Discord y Twitch requieren sus credenciales OAuth correspondientes y las URL de callback configuradas en cada proveedor. Que el botón aparezca en la web no significa que el proveedor esté habilitado en el proyecto.

### Protección de contraseñas filtradas

En Supabase → Authentication → Security / Password security, activa **Leaked password protection** cuando esté disponible en el plan del proyecto. Esta opción comprueba las contraseñas contra la base de contraseñas filtradas de HaveIBeenPwned y no se activa mediante el SQL del repositorio. Consulta la [documentación oficial de Supabase sobre seguridad de contraseñas](https://supabase.com/docs/guides/auth/password-security).

### Cambios de base de datos

Cuando se modifique el esquema, ejecuta el archivo completo `supabase/schema.sql` en SQL Editor. El bloque final de permisos está preparado para repetirse: vuelve a aplicar las ACL estrictas, las políticas de lectura de amistades y los índices de claves foráneas. No otorgues permisos generales a `anon` para solucionar errores de escritura; revisa primero la política RLS, el GRANT de la tabla y los permisos de columna.

