// Evaluación on-demand de un contrato con IA: dado un id de SECOP, busca el
// contrato + señales deterministas y Sonnet interpreta (nivel de sospecha,
// confiabilidad, factores de duda, qué verificar). Cifras reales; IA interpreta.

import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import {
  lookupContract,
  analyzeContractSignals,
  contractContextText,
} from "@/lib/contract-analysis";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "claude-sonnet-5";

const SYSTEM = `Eres un analista de contratación pública que evalúa un contrato para el equipo de control político de un concejal de Bogotá.

Reglas:
- Evalúa SOLO con las señales y datos entregados. No inventes cifras ni hechos.
- Lenguaje NEUTRO. Describes indicios que ameritan verificación; NUNCA afirmas que hubo corrupción.
- El nivel de sospecha refleja qué tan fuerte es la señal, no una certeza.
- Si las señales son normales o los datos insuficientes, dilo (nivel bajo).

Devuelves un JSON con: nivel_sospecha ("alto"|"medio"|"bajo"), confiabilidad (frase breve sobre qué tan sólidos son los datos), resumen (2-3 frases), factores_de_duda (lista de lo que hace dudoso el contrato, o vacía), que_verificar (lista de acciones concretas de verificación).`;

const SCHEMA = {
  type: "object",
  properties: {
    nivel_sospecha: { type: "string", enum: ["alto", "medio", "bajo"] },
    confiabilidad: { type: "string" },
    resumen: { type: "string" },
    factores_de_duda: { type: "array", items: { type: "string" } },
    que_verificar: { type: "array", items: { type: "string" } },
  },
  required: [
    "nivel_sospecha",
    "confiabilidad",
    "resumen",
    "factores_de_duda",
    "que_verificar",
  ],
  additionalProperties: false,
} as const;

export async function POST(req: NextRequest) {
  let body: { secopId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!body.secopId) {
    return NextResponse.json({ error: "Falta secopId" }, { status: 400 });
  }

  const contract = await lookupContract(body.secopId);
  if (!contract) {
    return NextResponse.json(
      { error: "No se encontró el contrato en la base ni en SECOP." },
      { status: 404 },
    );
  }
  const signals = await analyzeContractSignals(contract);
  const ctx = contractContextText(contract, signals);

  try {
    const client = new Anthropic();
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: SYSTEM,
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      messages: [{ role: "user", content: `Evalúa este contrato.\n\n${ctx}` }],
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
