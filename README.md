# Donko Partituras 🎵

Sitio web público para compartir y consultar partituras en formato PDF.  
Solo el administrador puede subir, editar y borrar. Cualquier visitante puede ver y abrir PDFs sin login.

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Astro (salida estática) + islas de React |
| Estilos | Tailwind CSS v4 |
| Lenguaje | TypeScript estricto |
| Backend | Supabase (Postgres + Auth + Storage + RLS) |
| Hosting | Cloudflare Pages |
| Captcha | Cloudflare Turnstile |

## Desarrollo local

```bash
# 1. Copiar y rellenar variables de entorno
cp .env.example .env

# 2. Instalar dependencias
npm install

# 3. Iniciar servidor de desarrollo
npm run dev
```

> En Windows sin Node en el PATH global, usar `dev.bat` en la raíz del proyecto.

## Producción / Build

```bash
npm run build
```

### ⚠️ CSP — hashes de scripts inline

Astro genera pequeños scripts inline para hidratar las islas de React.
En lugar de `'unsafe-inline'`, la CSP usa hashes SHA-256 exactos.

**Después de cada build que cambia el contenido de las islas**, verificar/actualizar los hashes:

```bash
# Solo verificar (falla si los hashes no coinciden)
npm run verificar:csp

# Verificar y actualizar public/_headers + dist/_headers automáticamente
npm run verificar:csp -- --fix
```

> Ejecutar `-- --fix` siempre antes de hacer deploy si no estás seguro.

## Despliegue en Cloudflare Pages

> Estos pasos los hace el dueño del sitio manualmente.

### Supabase (una sola vez)

1. Crear proyecto en [supabase.com](https://supabase.com).
2. En **SQL Editor**, ejecutar `schema.sql` completo.
3. **Authentication → Sign In / Providers:** desactivar *"Allow new users to sign up"*. Dejar solo Email.
4. **Authentication → Users → Add user:** crear tu usuario con contraseña larga y única.
5. En SQL Editor, dar el rol admin:
   ```sql
   UPDATE auth.users
   SET raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'::jsonb
   WHERE email = 'TU_CORREO@ejemplo.com';
   ```
6. **Authentication → Attack Protection:** activar captcha **Turnstile** (pegar la *secret key* de Cloudflare).
7. **Authentication → URL Configuration:** poner la URL final del sitio como *Site URL*.

### Cloudflare (una sola vez)

1. Crear widget **Turnstile**: la *site key* va en `PUBLIC_TURNSTILE_SITE_KEY`; la *secret key* va en Supabase.
2. **Workers & Pages → Create → Pages → Connect to Git** (repo en GitHub).
   - Build command: `npm run build`
   - Output directory: `dist`
   - Framework preset: Astro
3. Variables de entorno en Cloudflare Pages (nunca la `service_role`):
   ```
   PUBLIC_SUPABASE_URL=https://TU_PROYECTO.supabase.co
   PUBLIC_SUPABASE_ANON_KEY=eyJ...
   PUBLIC_TURNSTILE_SITE_KEY=0x...
   ```
4. Tras el primer deploy exitoso:
   - Actualizar el dominio real en **Supabase → Authentication → URL Configuration**.
   - Actualizar `connect-src` en `public/_headers` con el dominio de Supabase real (ya debería estar).
   - Ejecutar localmente `npm run build && npm run verificar:csp -- --fix`, hacer commit y push.

## Scripts de utilidad (Windows)

| Archivo | Función |
|---|---|
| `dev.bat` | Inicia el servidor de desarrollo |
| `build.bat` | Ejecuta `npm run build` |
| `push.bat` | Hace `git push origin main` |

## Seguridad

- RLS habilitado en todas las tablas: lectura pública, escritura solo admin.
- Solo se usa la **anon key** en el cliente; la `service_role` nunca toca el código.
- CSP sin `'unsafe-inline'` en `script-src` (hashes exactos post-build).
- Captcha Turnstile en el login de admin.
- Validación de magic bytes `%PDF-` y SHA-256 para deduplicación en la subida.
- `/admin` sin links públicos ni indexable por bots.

## npm audit

```bash
npm audit
# Debe reportar 0 vulnerabilidades antes de producción.
```
