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

/** Explicación de respaldo si la IA no está disponible (no debe tumbar el cron). */
function fallbackText(candidate: AlertCandidate): AlertText {
  return {
    description: candidate.title,
    ai_analysis:
      "Se detectó un patrón que amerita verificación. Consulte los contratos relacionados en SECOP II para más detalle.",
  };
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
