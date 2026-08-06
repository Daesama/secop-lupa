// Capa de IA: Haiku redacta la explicación de cada alerta a partir de los
// datos estructurados del detector. (La detección es determinista; la IA solo
// redacta — ver decisión de arquitectura híbrida.)

import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT, buildUserPrompt } from "@/lib/ai/prompts";
import type { AlertCandidate } from "@/lib/patterns/types";

const MODEL = "claude-haiku-4-5";

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    description: { type: "string" },
    ai_analysis: { type: "string" },
  },
  required: ["description", "ai_analysis"],
  additionalProperties: false,
} as const;

export interface AlertText {
  description: string;
  ai_analysis: string;
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic(); // lee ANTHROPIC_API_KEY del entorno
  return client;
}

// Análisis-plantilla por tipo (neutro) para las alertas que aún no pasan por
// la IA. Permite persistir TODAS las alertas detectadas con texto útil; las de
// mayor valor se enriquecen con Haiku. Se puede reemplazar por IA en corridas
// futuras sin cambiar la detección.
const TEMPLATE_ANALYSIS: Record<string, string> = {
  repeated_contractor:
    "Un mismo contratista concentra varios contratos con esta entidad. La concentración amerita verificar si hubo pluralidad de oferentes.",
  inflated_amount:
    "El valor del contrato supera ampliamente el promedio de su categoría. Amerita verificar la justificación técnica y económica del valor.",
  concentration:
    "La entidad concentra la mayoría de sus contratos en contratación directa. Amerita revisar la justificación del uso de este mecanismo frente a procesos competitivos.",
  network:
    "Varios contratistas distintos comparten representante legal y contratan con la misma entidad. Amerita verificar posible vinculación entre las empresas.",
  unrealistic_timeline:
    "El contrato presenta un plazo de ejecución atípico frente a su valor. Amerita verificar la viabilidad del cronograma.",
  fragmentation:
    "La entidad firmó varios contratos similares en poco tiempo. Amerita verificar un posible fraccionamiento para evitar procesos competitivos.",
};

/** Texto determinista (sin IA) para una alerta: título + plantilla por tipo. */
export function templateText(candidate: AlertCandidate): AlertText {
  return {
    description: candidate.title,
    ai_analysis:
      TEMPLATE_ANALYSIS[candidate.alert_type] ??
      "Se detectó un patrón que amerita verificación en SECOP II.",
  };
}

/** Explicación de respaldo si la IA falla (no debe tumbar el cron). */
function fallbackText(candidate: AlertCandidate): AlertText {
  return templateText(candidate);
}

/** Redacta la explicación de una alerta usando Haiku. */
export async function explainAlert(
  candidate: AlertCandidate,
): Promise<AlertText> {
  try {
    const res = await getClient().messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      output_config: { format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
      messages: [
        {
          role: "user",
          content: buildUserPrompt(candidate.alert_type, candidate.facts),
        },
      ],
    });
    const textBlock = res.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return fallbackText(candidate);
    const parsed = JSON.parse(textBlock.text) as Partial<AlertText>;
    if (!parsed.description || !parsed.ai_analysis) return fallbackText(candidate);
    return { description: parsed.description, ai_analysis: parsed.ai_analysis };
  } catch {
    return fallbackText(candidate);
  }
}
