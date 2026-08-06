// Genera un reporte de análisis: Sonnet redacta la NARRATIVA (resumen, hallazgos,
// conclusiones) a partir de las alertas reales; las cifras vienen de la base.
// El reporte se congela (snapshot) en la tabla `reports` y es reproducible.

import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import { getAlertStats, getAlerts } from "@/lib/queries";
import { getServiceClient } from "@/lib/supabase";
import { formatCOP } from "@/lib/utils/format";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "claude-sonnet-5";

const TYPE_LABEL: Record<string, string> = {
  repeated_contractor: "Contratista repetido",
  inflated_amount: "Monto inflado",
  unrealistic_timeline: "Tiempo irreal",
  concentration: "Concentración de contratación directa",
  fragmentation: "Fraccionamiento",
  network: "Red de contratistas",
};

const SYSTEM = `Eres un analista de contratación pública que redacta reportes para el equipo de control político de un concejal de Bogotá. Escribes en español, con tono técnico, NEUTRO y prudente.

Reglas:
- Describe patrones y datos; NUNCA acuses ni afirmes que hubo corrupción. Usa "se observa", "los datos muestran", "amerita verificación".
- Usa ÚNICAMENTE las cifras y hechos que se te entregan. No inventes datos.
- El reporte es un insumo de control político que señala hallazgos que ameritan verificación, no una acusación.

Devuelves un JSON con: titulo, resumen_ejecutivo (2-3 párrafos), hallazgos (lista de {titulo, descripcion} agrupando por tipo de patrón o entidad), y conclusiones (párrafo con recomendaciones generales de verificación, sin acusar).`;

const SCHEMA = {
  type: "object",
  properties: {
    titulo: { type: "string" },
    resumen_ejecutivo: { type: "string" },
    hallazgos: {
      type: "array",
      items: {
        type: "object",
        properties: {
          titulo: { type: "string" },
          descripcion: { type: "string" },
        },
        required: ["titulo", "descripcion"],
        additionalProperties: false,
      },
    },
    conclusiones: { type: "string" },
  },
  required: ["titulo", "resumen_ejecutivo", "hallazgos", "conclusiones"],
  additionalProperties: false,
} as const;

function isAuthorized(req: NextRequest): boolean {
  // Reporte abierto por ahora (MVP). El brief pide login del equipo: pendiente.
  void req;
  return true;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const sb = getServiceClient();
    const [stats, alerts] = await Promise.all([
      getAlertStats(),
      getAlerts({ limit: 30 }),
    ]);
    if (alerts.length === 0) {
      return NextResponse.json(
        { error: "No hay alertas para reportar. Ejecuta el análisis primero." },
        { status: 400 },
      );
    }

    // Período analizado (rango de firmas en la base).
    const { data: minRow } = await sb
      .from("contracts")
      .select("signing_date")
      .not("signing_date", "is", null)
      .order("signing_date", { ascending: true })
      .limit(1)
      .maybeSingle();
    const { data: maxRow } = await sb
      .from("contracts")
      .select("signing_date")
      .not("signing_date", "is", null)
      .order("signing_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    const periodStart = minRow?.signing_date ?? null;
    const periodEnd = maxRow?.signing_date ?? null;

    const alertsForPrompt = alerts
      .map(
        (a) =>
          `- [${TYPE_LABEL[a.alert_type] ?? a.alert_type} · ${a.severity}] ${a.title} | Entidad: ${a.entity_name ?? "—"} | Contratista: ${a.contractor_name ?? "—"} | Valor: ${formatCOP(a.total_amount)}\n  ${a.description}`,
      )
      .join("\n");

    const client = new Anthropic();
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: SYSTEM,
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      messages: [
        {
          role: "user",
          content: `Redacta el reporte de análisis de contratación distrital de Bogotá.

Período analizado: ${periodStart ?? "?"} a ${periodEnd ?? "?"}.
Total de alertas: ${stats.total} (${stats.critical} críticas, ${stats.suspicious} sospechosas).
Valor total bajo alerta: ${formatCOP(stats.totalAmount)}.

ALERTAS (las más relevantes):
${alertsForPrompt}`,
        },
      ],
    });

    const textBlock = res.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "Sin respuesta de la IA" }, { status: 502 });
    }
    const narrative = JSON.parse(textBlock.text);

    // Contenido congelado del reporte (narrativa IA + datos reales).
    const content = {
      ...narrative,
      periodo: { inicio: periodStart, fin: periodEnd },
      stats,
      alertas: alerts.map((a) => ({
        id: a.id,
        alert_type: a.alert_type,
        severity: a.severity,
        title: a.title,
        entity_name: a.entity_name,
        contractor_name: a.contractor_name,
        total_amount: a.total_amount,
      })),
    };

    const { data: inserted, error } = await sb
      .from("reports")
      .insert({
        title: narrative.titulo ?? "Reporte de contratación distrital",
        period_start: periodStart,
        period_end: periodEnd,
        content: JSON.stringify(content),
        alert_ids: alerts.map((a) => a.id),
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    return NextResponse.json({ id: inserted.id });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
