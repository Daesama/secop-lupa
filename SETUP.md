# Setup — Plataforma de análisis IA de contratos SECOP II (Bogotá)

Guía para dejar el **Hito 1 (pipeline de datos)** funcionando desde cero.

## 1. Crear proyecto Supabase (tier free)

1. Entra a <https://supabase.com> → **New project**.
2. Guarda la contraseña de la base de datos.
3. Ve a **Project Settings → API** y copia:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** (secreto) → `SUPABASE_SERVICE_ROLE_KEY`

## 2. Crear el esquema de base de datos

1. En Supabase → **SQL Editor → New query**.
2. Pega el contenido de [`supabase/schema.sql`](./supabase/schema.sql) y pulsa **Run**.
3. Verifica en **Table Editor** que existen: `contracts`, `alerts`, `reports`, `sync_logs`.

## 3. API key de Anthropic (se usa desde el Hito 2)

- Consola de Anthropic → API Keys → crea una y ponla en `ANTHROPIC_API_KEY`.

## 4. Variables de entorno

```bash
cp .env.example .env.local
```

Rellena `.env.local` con los valores de los pasos anteriores. Genera un `CRON_SECRET` largo:

```bash
# PowerShell
[Convert]::ToBase64String((1..24 | ForEach-Object { Get-Random -Max 256 }))
```

## 5. Instalar y arrancar

```bash
npm install
npm run dev
```

## 6. Ejecutar la primera sincronización (manual)

Con el server corriendo, invoca el cron pasando el `CRON_SECRET`:

```bash
# Sincronización incremental (por defecto)
curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/cron/sync-contracts

# Backfill desde lo más reciente (ignora el cursor incremental)
curl -H "Authorization: Bearer <CRON_SECRET>" "http://localhost:3000/api/cron/sync-contracts?full=1"
```

La respuesta es un JSON con `contracts_downloaded`, `contracts_new`, `contracts_updated` y `duration_seconds`.

> Cada corrida procesa hasta `SYNC_MAX_PAGES` páginas de 1000 (5000 contratos por defecto).
> Para un backfill histórico grande, sube `SYNC_MAX_PAGES` en `.env.local` y/o ejecuta el
> endpoint varias veces; el upsert es idempotente, no duplica.

### Notas sobre el volumen de datos

- Bogotá D.C. tiene **~2 millones** de contratos en SECOP II. No se bajan todos: la sync
  prioriza los **más recientes por fecha de firma** y acumula histórico corrida a corrida.
  Para análisis con más profundidad, sube `SYNC_MAX_PAGES` y corre el backfill (`?full=1`) varias veces.
- ~8% de los contratos **no tienen fecha de firma** y quedan fuera de la sync por fecha. Capturarlos
  requiere un pase de backfill dedicado (pendiente para un hito futuro).

## 7. Verificar

- En Supabase → **Table Editor → contracts**: deben aparecer contratos con
  `department = 'Distrito Capital de Bogotá'`, montos/fechas parseados y `secop_url` hacia
  `community.secop.gov.co`.
- En **sync_logs**: debe existir el registro de la corrida (`status = success`).
- Vuelve a ejecutar el cron: no se crean duplicados (mismos `secop_id` → update).

## Despliegue en Vercel (Hito 5)

- Importa el repo en Vercel, define las mismas variables de entorno en el proyecto.
- Con `CRON_SECRET` definido, Vercel envía automáticamente el header `Authorization: Bearer`
  al ejecutar el cron de `vercel.json` (`0 8 * * *`, 3 AM Colombia).
