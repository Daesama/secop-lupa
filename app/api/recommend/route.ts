// Genera la "ruta recomendada" de acción para una alerta: pasos de verificación
// (debido proceso colombiano) + borrador de derecho de petición. Claude Sonnet
// con salida estructurada. Es una guía procedimental, no asesoría jurídica.

import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import { getAlertById, getContractsByIds } from "@/lib/queries";
import {
  lookupContract,
  analyzeContractSignals,
  contractContextText,
} from "@/lib/contract-analysis";
import { formatCOP } from "@/lib/utils/format";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "claude-sonnet-5";

const SYSTEM = `Eres un asesor de control político para el equipo de un concejal de Bogotá. Dada una alerta sobre un contrato público, propones la RUTA DE ACCIÓN recomendada para VERIFICAR los hechos antes de cualquier denuncia, siguiendo el debido proceso en Colombia.

Principios obligatorios:
- NUNCA recomiendes denunciar de entrada. Primero recolectar información y verificar.
- El instrumento inicial es el DERECHO DE PETICIÓN (art. 23 de la Constitución; Ley 1755 de 2015) dirigido a la entidad contratante, solicitando documentos y justificaciones concretas.
- Escalar a órganos de control (Contraloría de Bogotá, Personería de Bogotá, Procuraduría, Fiscalía) SOLO si la información recolectada sustenta indicios.
- Lenguaje NEUTRO y prudente. Esto es una guía procedimental, no asesoría jurídica definitiva ni una acusación.
- Sé específico según el tipo de alerta y los datos del contrato (cita el identificador de SECOP).
- Montos en pesos colombianos.
- Anticipa las ramas de decisión: según lo que responda la entidad, indica la acción concreta (cerrar el caso, insistir, o escalar a un órgano de control específico como la Contraloría de Bogotá o la Personería, con el motivo).

Devuelves SIEMPRE un JSON con la estructura pedida. El campo derecho_peticion.cuerpo debe ser un texto formal, respetuoso y listo para radicar, que cite el contrato y solicite la información concreta.`;

const SCHEMA = {
  type: "object",
  properties: {
    advertencia: {
      type: "string",
      description: "Nota de cautela: por qué aún no se debe denunciar.",
    },
    pasos: {
      type: "array",
      items: {
        type: "object",
        properties: {
          titulo: { type: "string" },
          detalle: { type: "string" },
        },
        required: ["titulo", "detalle"],
        additionalProperties: false,
      },
    },
    preguntas_derecho_peticion: {
      type: "array",
      items: { type: "string" },
    },
    segun_la_respuesta: {
      type: "array",
      description:
        "Ramas de decisión según lo que responda la entidad al derecho de petición.",
      items: {
        type: "object",
        properties: {
          escenario: {
            type: "string",
            description: "La condición, p.ej. 'Si justifica el valor con soportes técnicos'.",
          },
          accion: {
            type: "string",
            description: "Qué hacer en ese caso, p.ej. 'Cerrar el caso' o 'Escalar a la Contraloría de Bogotá'.",
          },
        },
        required: ["escenario", "accion"],
        additionalProperties: false,
      },
    },
    derecho_peticion: {
      type: "object",
      properties: {
        asunto: { type: "string" },
        destinatario: { type: "string" },
        cuerpo: { type: "string" },
      },
      required: ["asunto", "destinatario", "cuerpo"],
      additionalProperties: false,
    },
  },
  required: [
    "advertencia",
    "pasos",
    "preguntas_derecho_peticion",
    "segun_la_respuesta",
    "derecho_peticion",
  ],
  additionalProperties: false,
} as const;

export async function POST(req: NextRequest) {
  let body: { alertId?: string; secopId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  let context: string;
  if (body.alertId) {
    const alert = await getAlertById(body.alertId);
    if (!alert) {
      return NextResponse.json({ error: "Alerta no encontrada" }, { status: 404 });
    }
    const contracts = await getContractsByIds(alert.related_contracts);
    context = `ALERTA:
Tipo: ${alert.alert_type} | Gravedad: ${alert.severity}
Título: ${alert.title}
Descripción: ${alert.description}
Análisis: ${alert.ai_analysis ?? "—"}
Entidad: ${alert.entity_name ?? "—"} | Contratista: ${alert.contractor_name ?? "—"} | Valor: ${formatCOP(alert.total_amount)}

CONTRATOS RELACIONADOS (muestra):
${contracts
  .slice(0, 10)
  .map((c) => `- ${c.secop_id} | ${c.contractor_name ?? "?"} | ${formatCOP(c.contract_value)} | ${c.selection_method ?? "?"}`)
  .join("\n")}`;
  } else if (body.secopId) {
    const c = await lookupContract(body.secopId);
    if (!c) {
      return NextResponse.json({ error: "Contrato no encontrado" }, { status: 404 });
    }
    const signals = await analyzeContractSignals(c);
    context = contractContextText(c, signals);
  } else {
    return NextResponse.json(
      { error: "Falta alertId o secopId" },
      { status: 400 },
    );
  }

  try {
    const client = new Anthropic();
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 4500,
      system: SYSTEM,
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      messages: [
        {
          role: "user",
          content: `Genera la ruta de acción recomendada a partir de la siguiente información.\n\n${context}`,
        },
      ],
    });
    const textBlock = res.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "Sin respuesta" }, { status: 502 });
    }
    return NextResponse.json(JSON.parse(textBlock.text));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
