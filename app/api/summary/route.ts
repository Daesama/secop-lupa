// Resumen ejecutivo del dashboard: Haiku sintetiza "lo más importante ahora" a
// partir de las cifras y alertas reales. Barato; se genera al cargar el panel.

import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { getAlertStats, getAlerts } from "@/lib/queries";
import { formatCOP } from "@/lib/utils/format";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MODEL = "claude-haiku-4-5";

// Caché simple en memoria (por instancia) para no regenerar en cada visita.
let cache: { text: string; at: number } | null = null;
const TTL = 20 * 60 * 1000;

const SYSTEM = `Eres un analista que redacta el resumen ejecutivo de un panel de control de contratación pública distrital de Bogotá, para el equipo de un concejal.
- 2 a 3 frases, en español, tono técnico y NEUTRO. Describes hallazgos; nunca acusas.
- Menciona lo más relevante: el número de alertas, la más grave, y la entidad o patrón que más resalta, con cifras reales.
- No inventes datos: usa solo lo que se te entrega.
- IMPORTANTE: responde SOLO con el párrafo. Sin título, sin encabezados, sin markdown, sin negritas ni viñetas.`;

export async function GET() {
  if (cache && Date.now() - cache.at < TTL) {
    return NextResponse.json({ summary: cache.text });
  }
  try {
    const [stats, alerts] = await Promise.all([
      getAlertStats(),
      getAlerts({ limit: 8 }),
    ]);
    if (stats.total === 0) {
      return NextResponse.json({ summary: "" });
    }
    const top = alerts
      .map((a) => `- [${a.severity}] ${a.title} (${formatCOP(a.total_amount)})`)
      .join("\n");
    const client = new Anthropic();
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 400,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Datos actuales:
Total de alertas: ${stats.total} (${stats.critical} críticas, ${stats.suspicious} sospechosas).
Valor total bajo alerta: ${formatCOP(stats.totalAmount)}.
Alertas más relevantes:
${top}

Redacta el resumen ejecutivo.`,
        },
      ],
    });
    const text = res.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join(" ")
      .trim();
    cache = { text, at: Date.now() };
    return NextResponse.json({ summary: text });
  } catch (err) {
    return NextResponse.json(
      { summary: "", error: err instanceof Error ? err.message : String(err) },
      { status: 200 },
    );
  }
}
