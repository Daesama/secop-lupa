// Cron: descarga contratos de SECOP II (Bogotá D.C.) y los sincroniza en Supabase.
// Programado en vercel.json ("0 8 * * *"). También se puede invocar manualmente:
//   curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/cron/sync-contracts
// Query params:
//   ?full=1  -> ignora el cursor incremental y baja desde lo más reciente (backfill).

import { NextResponse, type NextRequest } from "next/server";
import { fetchContractsPage, mapSecopToContract } from "@/lib/secop";
import { getServiceClient } from "@/lib/supabase";
import { SECOP_PAGE_SIZE } from "@/lib/utils/constants";
import type { ContractRow, SyncStatus } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60; // Vercel: tope de ejecución en segundos.

/** Máximo de páginas por invocación, para respetar el límite serverless. */
const MAX_PAGES_PER_RUN = Number(process.env.SYNC_MAX_PAGES ?? 5);

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

/**
 * Cursor incremental: firma más reciente ya almacenada, menos 1 día de
 * margen (el solape es inofensivo porque el upsert es idempotente).
 * Devuelve null si la tabla está vacía (→ backfill).
 */
async function getIncrementalCursor(
  supabase: ReturnType<typeof getServiceClient>,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("contracts")
    .select("signing_date")
    .not("signing_date", "is", null)
    .order("signing_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.signing_date) return null;

  const cursor = new Date(`${data.signing_date}T00:00:00Z`);
  cursor.setUTCDate(cursor.getUTCDate() - 1);
  return `${cursor.toISOString().slice(0, 10)}T00:00:00`;
}

/** Upsert de un lote; devuelve cuántos eran nuevos vs. actualizados. */
async function upsertBatch(
  supabase: ReturnType<typeof getServiceClient>,
  rows: ContractRow[],
): Promise<{ inserted: number; updated: number }> {
  const ids = rows.map((r) => r.secop_id);

  const { data: existing, error: selErr } = await supabase
    .from("contracts")
    .select("secop_id")
    .in("secop_id", ids);
  if (selErr) throw new Error(`Error consultando existentes: ${selErr.message}`);

  const existingIds = new Set((existing ?? []).map((r) => r.secop_id));
  const inserted = rows.filter((r) => !existingIds.has(r.secop_id)).length;

  const { error: upErr } = await supabase
    .from("contracts")
    .upsert(rows, { onConflict: "secop_id" });
  if (upErr) throw new Error(`Error en upsert: ${upErr.message}`);

  return { inserted, updated: rows.length - inserted };
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const startedAt = Date.now();
  const full = req.nextUrl.searchParams.get("full") === "1";

  let downloaded = 0;
  let newCount = 0;
  let updatedCount = 0;
  let status: SyncStatus = "success";
  let errorMessage: string | null = null;

  try {
    const supabase = getServiceClient();
    const signedAfter = full ? undefined : (await getIncrementalCursor(supabase)) ?? undefined;

    for (let page = 0; page < MAX_PAGES_PER_RUN; page++) {
      const raw = await fetchContractsPage({
        limit: SECOP_PAGE_SIZE,
        offset: page * SECOP_PAGE_SIZE,
        signedAfter,
      });
      if (raw.length === 0) break;
      downloaded += raw.length;

      const rows = raw
        .map(mapSecopToContract)
        .filter((r): r is ContractRow => r !== null);

      if (rows.length > 0) {
        const { inserted, updated } = await upsertBatch(supabase, rows);
        newCount += inserted;
        updatedCount += updated;
      }

      // Última página: la API devolvió menos de lo pedido → no hay más.
      if (raw.length < SECOP_PAGE_SIZE) break;
    }
  } catch (err) {
    status = "failed";
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  const durationSeconds = Math.round((Date.now() - startedAt) / 1000);

  // Bitácora en sync_logs (best-effort: no debe tumbar la respuesta).
  try {
    await getServiceClient()
      .from("sync_logs")
      .insert({
        contracts_downloaded: downloaded,
        contracts_new: newCount,
        contracts_updated: updatedCount,
        status,
        error_message: errorMessage,
        duration_seconds: durationSeconds,
      });
  } catch {
    // Ignorar fallo de logging.
  }

  return NextResponse.json(
    {
      status,
      contracts_downloaded: downloaded,
      contracts_new: newCount,
      contracts_updated: updatedCount,
      duration_seconds: durationSeconds,
      error: errorMessage,
    },
    { status: status === "failed" ? 500 : 200 },
  );
}
