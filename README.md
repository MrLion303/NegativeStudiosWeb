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
- `perfil.html` — edición de perfil, avatar, correo, contraseña y privacidad.
- `assets/accounts.js` y `assets/account.css` — integración del cliente y componentes visuales.
- `assets/supabase-config.js` — URL y clave publicable del proyecto.
- `supabase/schema.sql` — tabla de perfiles, políticas RLS y almacenamiento de avatares.
- `SUPABASE_SETUP.md` — guía para conectar Supabase y Google OAuth.

El registro permanece sin conexión hasta configurar `assets/supabase-config.js` y completar los pasos de `SUPABASE_SETUP.md`. No se necesita ni debe publicarse una clave `service_role`.
