// Cron: corre los detectores deterministas, deja que Haiku redacte cada alerta
// y regenera la tabla `alerts`. Programado en vercel.json ("0 10 * * *").
//   curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/cron/analyze-contracts
// Query params:
//   ?limit=N  -> máximo de alertas a redactar con IA en esta corrida.

import { NextResponse, type NextRequest } from "next/server";
import { runAllDetectors } from "@/lib/patterns";
import { explainAlert } from "@/lib/ai/analyze";
import { getServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/** Tope de alertas redactadas por corrida (cada una es una llamada a Haiku). */
const DEFAULT_MAX_ALERTS = Number(process.env.ANALYZE_MAX_ALERTS ?? 25);

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const startedAt = Date.now();
  const maxAlerts =
    Number(req.nextUrl.searchParams.get("limit")) || DEFAULT_MAX_ALERTS;

  try {
    const supabase = getServiceClient();

    // 1. Detección determinista sobre todos los contratos.
    const candidates = await runAllDetectors();
    const selected = candidates.slice(0, maxAlerts);

    // 2. Haiku redacta cada alerta seleccionada.
    const rows = [];
    for (const candidate of selected) {
      const { description, ai_analysis } = await explainAlert(candidate);
      rows.push({
        alert_type: candidate.alert_type,
        severity: candidate.severity,
        title: candidate.title,
        description,
        ai_analysis,
        related_contracts: candidate.related_contract_ids,
        entity_name: candidate.entity_name,
        contractor_name: candidate.contractor_name,
        total_amount: candidate.total_amount,
      });
    }

    // 3. Regenerar la tabla de alertas (idempotente por diseño).
    const del = await supabase.from("alerts").delete().not("id", "is", null);
    if (del.error) throw new Error(`Error limpiando alertas: ${del.error.message}`);
    if (rows.length > 0) {
      const ins = await supabase.from("alerts").insert(rows);
      if (ins.error) throw new Error(`Error insertando alertas: ${ins.error.message}`);
    }

    // Conteo por gravedad para el resumen.
    const bySeverity = candidates.reduce<Record<string, number>>((acc, c) => {
      acc[c.severity] = (acc[c.severity] ?? 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      status: "success",
      candidates_detected: candidates.length,
      by_severity: bySeverity,
      alerts_written: rows.length,
      duration_seconds: Math.round((Date.now() - startedAt) / 1000),
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
        duration_seconds: Math.round((Date.now() - startedAt) / 1000),
      },
      { status: 500 },
    );
  }
}
