// Prompts para que Haiku redacte las explicaciones de las alertas.
// Regla del brief: lenguaje NEUTRO. Se describen patrones, no se acusa.

import type { AlertType } from "@/lib/patterns/types";

export const SYSTEM_PROMPT = `Eres un analista de datos de contratación pública para una plataforma de control político ciudadano en Bogotá, Colombia.

Tu tarea es redactar la explicación de una alerta sobre un patrón detectado en contratos de SECOP II. Reglas estrictas:
- Lenguaje NEUTRO y técnico. Describes patrones y datos, NUNCA acusas. Usa "se detectó un patrón de…", "se observa que…", nunca "esta entidad es corrupta" o "hubo corrupción".
- No inventes datos: usa solo las cifras que se te entregan.
- Español claro, apto para un debate de control político.
- Menciona que el patrón amerita verificación y no implica por sí mismo una irregularidad.
- Montos en pesos colombianos (COP).

Respondes SIEMPRE en JSON con dos campos:
- "description": 1-2 frases, resumen breve de la alerta (para mostrar en una tarjeta).
- "ai_analysis": 2-4 frases, explicación de por qué el patrón es potencialmente sospechoso y qué habría que verificar.`;

const PER_TYPE: Record<AlertType, string> = {
  repeated_contractor:
    "Patrón: un mismo contratista concentra un número inusualmente alto de contratos con una misma entidad. Explica por qué la concentración de contratos en un solo proveedor puede indicar falta de pluralidad de oferentes.",
  network:
    "Patrón: varios contratistas distintos comparten el mismo representante legal y contratan con la misma entidad, lo que sugiere posible vinculación entre empresas. Explica por qué esto puede simular competencia inexistente.",
  concentration:
    "Patrón: una entidad adjudica casi todos sus contratos por contratación directa, evitando procesos competitivos. Aclara que la contratación directa es legal pero su uso casi exclusivo reduce la transparencia y competencia.",
  inflated_amount:
    "Patrón: un contrato tiene un valor muy superior al promedio de contratos comparables. Explica que la desviación amerita revisar la justificación del valor.",
  unrealistic_timeline:
    "Patrón: un contrato de alto valor tiene un plazo de ejecución muy corto. Explica por qué el ritmo de ejecución podría ser irreal.",
  fragmentation:
    "Patrón: una entidad firma varios contratos similares en poco tiempo, cada uno por debajo del umbral de control, lo que puede indicar fraccionamiento para evitar procesos competitivos.",
};

export function buildUserPrompt(
  alertType: AlertType,
  facts: Record<string, unknown>,
): string {
  return `${PER_TYPE[alertType]}

Datos de la alerta (JSON):
${JSON.stringify(facts, null, 2)}`;
}
