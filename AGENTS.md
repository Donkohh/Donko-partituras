# Donko Partituras — Especificación del proyecto

> Lee este archivo completo antes de escribir código. Es la fuente de verdad.
> Trabaja por fases (ver sección 11). Al terminar cada fase, detente y resume qué hiciste.

## 1. Resumen

Sitio web público para compartir partituras en PDF. **Solo el dueño (admin) puede subir, editar y borrar.** Cualquier persona puede ver el repertorio, buscar, navegar carpetas y abrir PDFs, sin login.

- Idioma de la interfaz: **español**.
- Prioridades, en orden: **seguridad → velocidad → simplicidad → estética**.
- Va a producción en 1–2 días: **MVP limpio, sin sobreingeniería.**

## 2. Stack (no cambiar sin avisar)

| Capa | Tecnología |
|---|---|
| Framework | **Astro** (salida estática) + **islas de React** para las partes interactivas |
| Estilos | **Tailwind CSS** |
| Lenguaje | **TypeScript** estricto |
| Backend | **Supabase**: Postgres + Auth + Storage, todo protegido con RLS |
| Cliente | `@supabase/supabase-js` |
| Hosting | **Cloudflare Pages** (build estático, sin SSR, sin Workers) |
| Captcha login | **Cloudflare Turnstile** (integrado con Supabase Auth) |
| Fuentes | Autoalojadas con `@fontsource/*` (nada de Google Fonts, por la CSP) |

No hay servidor propio: el navegador habla directo con Supabase y la seguridad la da **RLS**.

## 3. Rutas

| Ruta | Descripción |
|---|---|
| `/` | **Repertorio general** + buscador + filtro por etiquetas |
| `/carpetas` | Lista de carpetas. Con `?c=<uuid>` muestra el contenido de esa carpeta (con su propio buscador) |
| `/admin` | Panel de admin (login si no hay sesión). `noindex`, **sin ningún link desde el sitio público** |
| `404` | Página simple con el estilo del sitio |

## 4. Funcionalidades públicas

1. **Repertorio general:** todas las partituras, orden alfabético por defecto (alternar: más recientes).
2. **Buscador:** instantáneo, en el cliente, **insensible a mayúsculas y tildes** (normalizar con `normalize('NFD')`). Busca en nombre y etiquetas.
3. **Filtro por etiquetas:** chips de las etiquetas existentes (multi-selección). Partituras sin etiquetas = **chart general** (mostrar una insignia sutil "General" o simplemente sin chips).
4. **Carpetas:** públicas. Cada una muestra sus partituras con el mismo buscador.
5. **Abrir PDF:** `<a href="URL_PUBLICA" target="_blank" rel="noopener noreferrer">`. **Prohibido** visor embebido, `<iframe>`, `<embed>`, `<object>` o pdf.js. Se abre en otra pestaña con el visor nativo del navegador.
6. **Carga de datos:** `select id, nombre, etiquetas, archivo_path`. Supabase devuelve máx. **1000 filas por request**: paginar con `.range()` hasta traer todo. Cachear en memoria durante la sesión. Mostrar skeletons mientras carga.
7. Si hay muchas partituras, renderizar por tandas (“Cargar más” o virtualización simple) para mantener fluidez.
8. Responsive real: se usará mucho desde el celular.

## 5. Funcionalidades del panel admin

**Login**
- Email + contraseña con Supabase Auth + Turnstile.
- Tras login, verificar `session.user.app_metadata.role === 'admin'`. Si no, cerrar sesión y mostrar error genérico ("Credenciales inválidas").
- Botón de cerrar sesión. Mensajes de error **genéricos** (no revelar si el correo existe).
- Soporte de **2FA TOTP** de Supabase (enrolar y verificar) como fase opcional.

**Subida (1 o 200 PDFs)**
- Zona drag & drop + botón de seleccionar archivos, múltiple.
- Validaciones en cliente por archivo:
  - Extensión `.pdf` y MIME `application/pdf`.
  - **Magic bytes:** los primeros 5 bytes deben ser `%PDF-`.
  - Tamaño ≤ 50 MB.
- Calcular **SHA-256** con `crypto.subtle.digest`. Si el hash ya existe en la BD (consultar por lotes con `.in('hash_sha256', [...])`) o está repetido dentro del mismo lote → **saltarlo y avisar al final** con un resumen: "X subidas, Y omitidas por duplicadas (lista), Z con error".
- Subir con **concurrencia limitada (3 a la vez)**, barra de progreso global y por archivo, y posibilidad de cancelar.
- Ruta en el bucket: **`<uuid-v4>.pdf`** (`crypto.randomUUID()`), nunca el nombre original.
- Nombre visual inicial = nombre original limpio (sin `.pdf`, `_`/`-` → espacios, trim).
- Opcional en la misma subida: asignar **etiquetas** y **carpetas** a todo el lote antes de subir.
- Si falla el insert en BD después de subir el archivo, **borrar el archivo huérfano** del storage.

**Gestión del repertorio**
- Tabla/lista con selección múltiple (checkbox, "seleccionar todo lo filtrado").
- Editar **solo el nombre visual** y las etiquetas (el PDF y su `archivo_path` nunca cambian). Edición rápida inline.
- Acciones masivas: agregar a carpeta, quitar de carpeta, agregar/quitar etiquetas, eliminar.
- **Eliminar del general:** confirmar con diálogo; borrar primero el objeto del storage y luego la fila (el `ON DELETE CASCADE` la saca de todas las carpetas).
- Buscador y filtros también dentro del admin.

**Gestión de carpetas**
- Crear, renombrar, eliminar carpetas (eliminar una carpeta **nunca** borra partituras).
- Dentro de una carpeta: agregar partituras (selector con buscador) y **quitar de la carpeta** (sin borrar del general).
- Una partitura puede estar en varias carpetas sin duplicar nada (solo referencias).

## 6. Modelo de datos

Ver **`schema.sql`** (ya incluye tablas, índices, RLS, bucket y políticas). No modificar la lógica de seguridad sin avisar.

- `partituras(id, nombre, archivo_path, hash_sha256, etiquetas text[], tamano_bytes, creado_en)`
- `carpetas(id, nombre, creado_en)`
- `partitura_carpeta(partitura_id, carpeta_id)` con `ON DELETE CASCADE` en ambos lados.
- URL pública del PDF: `${PUBLIC_SUPABASE_URL}/storage/v1/object/public/partituras/${archivo_path}`.

## 7. Seguridad (checklist obligatorio)

- [ ] Registro público **desactivado** en Supabase Auth. Existe un único usuario, creado a mano.
- [ ] Rol admin en `app_metadata` (no editable por el usuario). Toda escritura exige `is_admin()` vía RLS, **en tablas y en storage**.
- [ ] RLS habilitado en **todas** las tablas. Lectura pública, escritura solo admin.
- [ ] Bucket: solo `application/pdf`, límite 50 MB, sin listado público.
- [ ] En el código solo va la **anon key**. **Jamás** la `service_role` (ni en el repo, ni en variables `PUBLIC_*`, ni en el cliente).
- [ ] `.env` en `.gitignore`. Entregar `.env.example` sin valores.
- [ ] **Sin `dangerouslySetInnerHTML`, `innerHTML` ni `eval`.** Todo texto de usuario (nombres, etiquetas) se renderiza escapado por React.
- [ ] Validar y sanear inputs (longitudes, etiquetas máx. 10 y 40 chars) en cliente; la BD refuerza con `CHECK`.
- [ ] Captcha Turnstile en el login.
- [ ] Cabeceras de seguridad vía `public/_headers` (ver abajo).
- [ ] `/admin` con `<meta name="robots" content="noindex,nofollow">` y sin links públicos hacia él.
- [ ] Enlaces externos con `rel="noopener noreferrer"`.
- [ ] Dependencias mínimas, versiones fijadas, `npm audit` limpio antes de producción.

**`public/_headers`** (ajustar al dominio real de Supabase):

```
/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  Content-Security-Policy: default-src 'self'; script-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; connect-src 'self' https://TU_PROYECTO.supabase.co; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'
```

Nota: Astro puede generar scripts inline para hidratar islas. Intenta que `script-src` quede **sin** `'unsafe-inline'` (usa la opción de CSP de Astro según su documentación actual, o configura el build para evitar inline). Si es imposible, usa hashes; documenta lo que hiciste y avisa.

## 8. Rendimiento

- Páginas estáticas, mínimo JS en el sitio público (islas con `client:load` solo donde haga falta; `client:visible`/`client:idle` si aplica).
- Búsqueda en cliente con datos en memoria; **debounce** ~100 ms.
- Fuentes autoalojadas con `font-display: swap`, máx. 2 familias.
- Sin librerías pesadas (nada de moment, lodash completo, UI kits enormes).
- Meta tags, favicon, `og:title`, `og:description`.

## 9. Diseño: oscuro, moderno, con personalidad

- **Tema oscuro por defecto**. Fondo casi negro `#0a0a0f`, superficies `#14141c`, bordes sutiles `rgba(255,255,255,.08)`.
- **Acento principal ámbar/dorado** (`#f5b942`) con **secundario violeta** (`#8b5cf6`); usar gradiente suave en el logo y estados activos.
- **Logo:** "Donko" en tipografía serif itálica elegante (p. ej. *Instrument Serif*) + "Partituras" en sans moderna (p. ej. *Sora* o *Inter*).
- Detalles de sorpresa (sutiles, que no pesen):
  - Líneas de **pentagrama** tenues (SVG/CSS) como fondo del hero y de las tarjetas al hacer hover.
  - Resplandor radial ámbar/violeta detrás del buscador.
  - Buscador grande y protagonista, con atajo `/` para enfocarlo.
  - Tarjetas de partitura con ícono de nota/PDF, nombre, chips de etiquetas y micro-animación al hover.
  - Animaciones cortas (≤200 ms) y respetar `prefers-reduced-motion`.
- Accesibilidad: contraste AA, foco visible, navegación por teclado, `aria-label` en botones de ícono.
- Usa la skill `frontend-design` si está disponible.

## 10. Estructura sugerida

```
donko-partituras/
├─ AGENTS.md
├─ schema.sql
├─ .env.example
├─ astro.config.mjs
├─ public/
│  ├─ _headers
│  └─ favicon.svg
└─ src/
   ├─ layouts/Base.astro
   ├─ pages/ (index.astro, carpetas.astro, admin.astro, 404.astro)
   ├─ components/
   │  ├─ public/  (Buscador, ListaPartituras, Tarjeta, Chips, ListaCarpetas)
   │  └─ admin/   (Login, Subida, TablaRepertorio, Carpetas, SelectorCarpeta)
   └─ lib/ (supabase.ts, hash.ts, validarPdf.ts, normalizar.ts, tipos.ts)
```

Variables de entorno (`.env.example`):

```
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_ANON_KEY=
PUBLIC_TURNSTILE_SITE_KEY=
```

## 11. Fases

1. **Base:** proyecto Astro + React + Tailwind + TS, layout, tema oscuro, cliente Supabase, `.env.example`, `_headers`.
2. **Público:** repertorio, buscador, filtro por etiquetas, carpetas, apertura de PDF en pestaña nueva.
3. **Admin:** login (+Turnstile), verificación de rol, subida masiva con duplicados y resumen.
4. **Admin:** edición de nombre/etiquetas, acciones masivas, carpetas (CRUD y asignación/quitado), eliminación.
5. **Endurecer y pulir:** revisar checklist de seguridad, CSP, `npm audit`, responsive, estados vacíos/errores, rendimiento.
6. **Despliegue** (sección 12).

**Criterios de aceptación finales**
- Un visitante sin sesión **no puede** insertar/editar/borrar nada (probar directamente con la anon key en la consola/REST: debe fallar por RLS).
- Un usuario autenticado **sin** rol admin tampoco puede.
- No se puede subir un archivo que no sea PDF real ni de más de 50 MB.
- Subir 200 PDFs funciona con progreso, sin congelar la UI, y los duplicados se saltan y se reportan.
- Quitar de una carpeta no borra del general; borrar del general lo quita de todas las carpetas y elimina el archivo del storage.
- Renombrar una partitura cambia solo el nombre visual, no el archivo.
- Lighthouse móvil: Performance y Best Practices ≥ 90.

## 12. Pasos manuales (los hace el dueño, no el agente)

**Supabase**
1. Crear proyecto. En **SQL Editor**, ejecutar `schema.sql` completo.
2. **Authentication > Sign In / Providers:** desactivar **"Allow new users to sign up"**. Dejar solo Email; desactivar otros proveedores.
3. **Authentication > Users > Add user:** crear tu usuario con contraseña **larga y única** (gestor de contraseñas).
4. En SQL Editor, ejecutar el `update auth.users ...` del final de `schema.sql` con tu correo para darte el rol `admin`.
5. **Authentication > Attack Protection:** activar captcha **Turnstile** (pegar la secret key de Cloudflare). Activar protección de contraseñas filtradas si está disponible.
6. **Authentication > URL Configuration:** poner la URL final del sitio como Site URL.
7. (Recomendado) Activar **MFA TOTP** y enrolarte desde el panel.

**Cloudflare**
1. Crear widget **Turnstile** (site key → `PUBLIC_TURNSTILE_SITE_KEY`, secret key → Supabase).
2. **Workers & Pages > Create > Pages > Connect to Git** (repo en GitHub).
3. Build command: `npm run build` · Output directory: `dist` · Framework preset: Astro.
4. Variables de entorno: las 3 `PUBLIC_*` (**nunca** la service_role).
5. Cuando haya dominio propio: agregarlo en Pages > Custom domains y actualizarlo en `_headers` y en Supabase.

## 13. Reglas para el agente

- Pregunta antes de agregar dependencias grandes o cambiar el stack.
- No inventes funcionalidades fuera de este documento.
- Código claro y comentado lo justo; nombres de UI en español, nombres de código en inglés o español pero **consistentes**.
- Si algo del checklist de seguridad no se puede cumplir, **avisa explícitamente** en vez de omitirlo.
- Al final de cada fase: lista de archivos tocados, cómo probar y qué sigue.
