// Chat aterrizado sobre una alerta/contrato. Claude Sonnet responde SOLO con
// datos reales: recibe el contexto de la alerta y puede invocar herramientas
// de solo lectura para consultar la base (RAG + tool use). Nunca inventa.

import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import { getAlertById, getContractsByIds } from "@/lib/queries";
import { CHAT_TOOLS, runChatTool } from "@/lib/ai/chat-tools";
import { formatCOP } from "@/lib/utils/format";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "claude-sonnet-5";
const MAX_STEPS = 5;

const SYSTEM = `Eres un asistente de análisis de contratación pública para el equipo de un concejal de Bogotá. Respondes preguntas sobre contratos de SECOP II.

REGLAS ESTRICTAS (obligatorias):
- Responde ÚNICAMENTE con datos reales: los del contexto entregado o los que obtengas con las herramientas. Si no tienes el dato, dilo claramente ("no tengo ese dato"). NUNCA inventes cifras, nombres ni hechos.
- Cuando la pregunta requiera información más allá del contrato en contexto (otros contratos de un contratista o entidad, totales, vínculos), USA las herramientas disponibles antes de responder.
- Lenguaje NEUTRO y técnico. Describes datos y patrones; NUNCA acusas ni afirmas que hubo corrupción. Usa "se observa", "los datos muestran", "amerita verificación".
- Cita los contratos por su identificador de SECOP cuando sea relevante. Montos en pesos colombianos.
- Sé claro y conciso. Responde en español.`;

function buildContext(
  alert: NonNullable<Awaited<ReturnType<typeof getAlertById>>>,
  contracts: Awaited<ReturnType<typeof getContractsByIds>>,
): string {
  const lines = contracts
    .slice(0, 15)
    .map(
      (c) =>
        `- ${c.secop_id} | ${c.contractor_name ?? "?"} | ${c.entity_name ?? "?"} | ${formatCOP(c.contract_value)} | ${c.selection_method ?? "?"} | ${c.contract_object ?? ""}`,
    )
    .join("\n");
  return `ALERTA EN CONTEXTO:
Tipo: ${alert.alert_type} | Gravedad: ${alert.severity}
Título: ${alert.title}
Descripción: ${alert.description}
Análisis: ${alert.ai_analysis ?? "—"}
Entidad: ${alert.entity_name ?? "—"} | Contratista: ${alert.contractor_name ?? "—"} | Valor: ${formatCOP(alert.total_amount)}

CONTRATOS RELACIONADOS (${alert.related_contracts.length} en total, muestra):
${lines}`;
}

interface InMsg {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: NextRequest) {
  let body: { alertId?: string; messages?: InMsg[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const incoming = (body.messages ?? [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && m.content)
    .slice(-12);
  if (incoming.length === 0) {
    return NextResponse.json({ error: "Sin mensajes" }, { status: 400 });
  }

  let system = SYSTEM;
  if (body.alertId) {
    const alert = await getAlertById(body.alertId);
    if (alert) {
      const contracts = await getContractsByIds(alert.related_contracts);
      system = `${SYSTEM}\n\n${buildContext(alert, contracts)}`;
    }
  }

  const client = new Anthropic();
  // El historial arranca con los mensajes del usuario/asistente (texto).
  const messages: Anthropic.MessageParam[] = incoming.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      const res = await client.messages.create({
        model: MODEL,
        max_tokens: 2000,
        system,
        tools: CHAT_TOOLS as unknown as Anthropic.Tool[],
        output_config: { effort: "low" },
        messages,
      });

      if (res.stop_reason === "tool_use") {
        messages.push({
          role: "assistant",
          content: res.content as unknown as Anthropic.ContentBlockParam[],
        });
        const toolResults: Anthropic.ContentBlockParam[] = [];
        for (const block of res.content) {
          if (block.type === "tool_use") {
            const result = await runChatTool(
              block.name,
              block.input as Record<string, unknown>,
            );
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: JSON.stringify(result),
            });
          }
        }
        messages.push({ role: "user", content: toolResults });
        continue;
      }

      const text = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return NextResponse.json({
        reply: text || "No pude generar una respuesta.",
      });
    }
    return NextResponse.json({
      reply:
        "La consulta requirió demasiados pasos. Intenta reformular la pregunta.",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
