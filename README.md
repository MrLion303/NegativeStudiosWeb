# NegativeStudios Web

Rediseño oficial del sitio de **NegativeStudios**.

## Objetivo

Migrar la web histórica de Google Sites a una experiencia propia, moderna, responsive y mantenible, preservando el archivo de proyectos y reorganizando la información del estudio.

## Stack

HTML, CSS y JavaScript puro. No requiere Node, paquetes ni proceso de build para funcionar.

## Estructura

- `index.html` — portada
- `proyectos.html` — archivo filtrable de proyectos
- `proyecto.html?id=...` — fichas dinámicas desde un modelo de datos central
- `anuncios.html` — archivo editorial de anuncios
- `equipo.html` — disciplinas y reclutamiento
- `colaboradores.html` — alianzas creativas
- `acerca.html` — historia y FAQ
- `contacto.html` — contacto y comunidad
- `archivo.html` — mapa de migración de las páginas históricas
- `legal.html` — puente hacia los términos históricos durante la migración
- `assets/data.js` — fuente central de proyectos y archivo editorial
- `assets/styles.css` — sistema visual responsive

## Publicar con GitHub Pages

En el repositorio abre **Settings → Pages**, selecciona **Deploy from a branch** y usa `main` con `/ (root)`.

## Dirección visual

La estructura toma referencias generales de estudios creativos contemporáneos —jerarquía editorial fuerte, portafolio protagonista, superficies oscuras, acentos luminosos y navegación simple— manteniendo una identidad propia para NegativeStudios.


## Cuentas y perfiles

La estructura de autenticación se prepara con Supabase Auth para registro con correo y contraseña, confirmación por código, acceso con Google, recuperación de acceso y perfiles personales.

- `cuenta.html` — registro e inicio de sesión.
- `perfil.html` — perfil público con avatar y banner.
- `configurar-perfil.html` — personalización del perfil, imágenes, correo, contraseña y eliminación de cuenta.
- Comentarios y respuestas por proyecto mediante Supabase.
- `assets/accounts.js` y `assets/account.css` — integración del cliente y componentes visuales.
- `assets/supabase-config.js` — URL y clave publicable del proyecto.
- `supabase/schema.sql` — perfiles públicos, límite de cambio de usuario de 14 días, comentarios, políticas RLS y almacenamiento de avatares/banners.
- `supabase/functions/delete-account/index.ts` — función de servidor para borrar cuentas sin exponer la clave administrativa.
- `SUPABASE_SETUP.md` — guía para conectar Supabase y Google OAuth.

La web requiere Supabase configurado. Cuando actualices funciones de perfiles o comentarios, vuelve a ejecutar `supabase/schema.sql`. Para borrar cuentas, también despliega la función `delete-account` siguiendo `SUPABASE_SETUP.md`. No publiques nunca una clave `service_role`.
