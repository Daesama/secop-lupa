# SECOP Lupa — Seguimiento SECOP II, Bogotá

Herramienta de análisis forense de contratación pública. Sincroniza los contratos de **SECOP II (Bogotá D.C.)** desde datos abiertos, los analiza con IA y produce insumos accionables de **control político**: hallazgos, alertas y reportes pensados para el equipo de un concejal, asesores y periodistas.

No es un dashboard que "muestra datos": cada análisis termina en una acción concreta con instrumento y destinatario (derecho de petición, expediente en SECOP II, cruce con RUES, traslado a Contraloría o Personería Distrital, citación a debate).

> **Demo en vivo:** _(pendiente de enlazar)_
> **Stack:** Next.js 14 · TypeScript · Supabase (PostgreSQL) · Claude (Anthropic) · Recharts

---

## Qué hace

- **Sincronización automática** de contratos de SECOP II (Bogotá) mediante un *cron job* que pagina la API de datos abiertos y hace *upsert* en Supabase sin duplicar (`onConflict: secop_id`), con registro de cada corrida en `sync_logs`.
- **Análisis forense con IA** por contrato: envía el contrato a Claude bajo un *system prompt* de analista de contratación y devuelve hallazgos con estándar de control político, cada uno con su acción ejecutable (instrumento + destinatario).
- **Alertas** sobre patrones de riesgo en la contratación.
- **Reportes** generados y exportables.
- **Chat** sobre la base de contratos para consultas en lenguaje natural.
- **Visualizaciones**: ranking de contratistas/entidades, grafo de red de relaciones, mapa por localidad y resumen ejecutivo.

## Arquitectura

```
SECOP II (datos abiertos)
        │  cron/sync-contracts  → paginación + upsert
        ▼
   Supabase (PostgreSQL)
   contracts · alerts · reports · sync_logs
        │
        ▼
   API routes (Next.js App Router)
   analyze-contract · summary · recommend · chat · reports/generate
        │  Claude (Anthropic SDK)
        ▼
   UI (React · Recharts)
   ranking · network-graph · locality-map · exec-summary
```

- **`app/api/cron/sync-contracts`** — descarga e ingesta incremental desde SECOP II.
- **`app/api/cron/analyze-contracts`** — análisis por lotes programado.
- **`app/api/analyze-contract`** — análisis forense de un contrato puntual con Claude.
- **`app/api/{summary,recommend,chat,reports/generate}`** — resúmenes, recomendaciones, chat y reportes.
- Validación de entradas con **Zod**; acceso a datos con el cliente de **Supabase**.

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 14 (App Router), TypeScript |
| Base de datos | Supabase (PostgreSQL) |
| IA | Claude (Anthropic SDK) |
| Gráficas | Recharts |
| Validación | Zod |
| Deploy | Vercel |

## Ejecutar en local

```bash
git clone https://github.com/Daesama/secop-lupa.git
cd secop-lupa
npm install
cp .env.example .env.local   # completar las variables de abajo
npm run dev
```

Variables de entorno (`.env.local`):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
CRON_SECRET=
```

Esquema de base de datos en `supabase/schema.sql` y `supabase/migrations/`.

Disparar la sincronización manualmente:

```bash
curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/cron/sync-contracts
```

## Estado

Proyecto en desarrollo activo. Construido en solitario como herramienta real de control social sobre la contratación pública de Bogotá.
