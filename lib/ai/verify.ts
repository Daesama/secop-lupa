// Capa de verificación con IA (2º pase). La detección es determinista; aquí
// Claude revisa cada candidato y descarta los débiles (probables falsos
// positivos), subiendo la precisión SIN alterar la lógica de detección.

import Anthropic from "@anthropic-ai/sdk";
import type { AlertCandidate } from "@/lib/patterns/types";

const MODEL = "claude-haiku-4-5";
const BATCH = 12;

const SYSTEM = `Eres un revisor experto en contratación pública distrital de Bogotá. Recibes una lista de ALERTAS candidatas detectadas por reglas automáticas. Tu tarea es evaluar, para cada una, si es una señal CREÍBLE de posible irregularidad que amerita revisión, o si probablemente es un FALSO POSITIVO (contratación legítima, patrón normal del sector, o dato insuficiente).

Criterios:
- Sé conservador: mantén la alerta salvo que sea claramente débil. Ante la duda, mantener.
- Marca como débil (mantener=false o confianza "baja") lo que tenga explicación legítima evidente o base de datos insuficiente.
- No acusas; solo evalúas la solidez de la señal.

Devuelves un JSON con "evaluaciones": una por alerta, con su índice, si mantener (boolean), confianza ("alta"|"media"|"baja") y un motivo breve.`;

const SCHEMA = {
  type: "object",
  properties: {
    evaluaciones: {
      type: "array",
      items: {
        type: "object",
        properties: {
          indice: { type: "integer" },
          mantener: { type: "boolean" },
          confianza: { type: "string", enum: ["alta", "media", "baja"] },
          motivo: { type: "string" },
        },
        required: ["indice", "mantener", "confianza", "motivo"],
        additionalProperties: false,
      },
    },
  },
  required: ["evaluaciones"],
  additionalProperties: false,
} as const;

interface Evaluacion {
  indice: number;
  mantener: boolean;
  confianza: "alta" | "media" | "baja";
  motivo: string;
}

async function verifyBatch(
  client: Anthropic,
  batch: AlertCandidate[],
): Promise<Set<number>> {
  const list = batch
    .map(
      (c, i) =>
        `#${i} [${c.alert_type} · ${c.severity}] ${c.title}\n  datos: ${JSON.stringify(c.facts)}`,
    )
    .join("\n\n");

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: SYSTEM,
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    messages: [
      { role: "user", content: `Evalúa estas ${batch.length} alertas:\n\n${list}` },
    ],
  });
  const textBlock = res.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    // Si falla, mantener todo el lote (no perder señales).
    return new Set(batch.map((_, i) => i));
  }
  const parsed = JSON.parse(textBlock.text) as { evaluaciones: Evaluacion[] };
  const keep = new Set<number>();
  for (const e of parsed.evaluaciones ?? []) {
    if (e.mantener && e.confianza !== "baja") keep.add(e.indice);
  }
  return keep;
}

/**
 * Verifica todos los candidatos por lotes y devuelve solo los que superan el
 * filtro (creíbles). Ante error de API, conserva el lote (no pierde señales).
 */
export async function verifyCandidates(
  candidates: AlertCandidate[],
): Promise<AlertCandidate[]> {
  if (candidates.length === 0) return candidates;
  const client = new Anthropic();
  const kept: AlertCandidate[] = [];

  for (let start = 0; start < candidates.length; start += BATCH) {
    const batch = candidates.slice(start, start + BATCH);
    try {
      const keepIdx = await verifyBatch(client, batch);
      batch.forEach((c, i) => {
        if (keepIdx.has(i)) kept.push(c);
      });
    } catch {
      // Fallback: conservar el lote completo.
      kept.push(...batch);
    }
  }
  return kept;
}
