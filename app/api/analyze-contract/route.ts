// Evaluación on-demand de un contrato con IA. La aritmética la hace SQL
// (lib/contract-analysis); la IA solo INTERPRETA el perfil forense: califica
// cada dimensión, cita la cifra que sostiene cada afirmación, plantea la
// explicación legítima alternativa y propone verificaciones accionables.

import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import {
  lookupContract,
  analyzeContractSignals,
  contractContextText,
  UMBRALES,
} from "@/lib/contract-analysis";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const MODEL = "claude-opus-5";

const SYSTEM = `Eres analista forense de contratación pública. Tu producto es un insumo de control político para el equipo de un concejal de Bogotá: lo van a leer asesores, periodistas y eventualmente órganos de control. Escribe con ese estándar.

═══ REGLA CENTRAL: CERO AFIRMACIONES SIN CIFRA ═══
Cada afirmación que hagas debe estar anclada a un número del perfil forense que recibes. Está PROHIBIDO escribir adjetivos de magnitud sin la cifra que los sostiene:
✗ "El valor es notablemente elevado."
✓ "El valor ($2.400 millones) es 11,3× la mediana de su categoría ($212 millones, n=340) y queda en el percentil 99,4."
✗ "La entidad concentra mucha contratación directa."
✓ "El 94% de los 1.208 contratos de la entidad son directa, 32 puntos por encima de la línea base distrital (62%)."

═══ QUÉ NO PUEDES HACER ═══
- No inventes, estimes ni redondees hacia arriba ninguna cifra. Si un dato dice "n/d", escribe explícitamente que no está disponible y trata esa dimensión como no evaluable.
- No afirmes que hubo corrupción, delito, direccionamiento ni favorecimiento. Describes INDICIOS que ameritan verificación. Lenguaje neutro y verificable.
- No conviertas la ausencia de datos en señal negativa. Dato faltante = menor confiabilidad, no mayor sospecha.
- No trates una muestra pequeña como evidencia: si la muestra de la categoría está por debajo de ${UMBRALES.MIN_MUESTRA} contratos, la comparación de precio NO es concluyente y debes decirlo.

═══ RÚBRICA DE NIVEL DE SOSPECHA (aplícala literalmente) ═══
ALTO — se cumple al menos UNA de estas, con muestra suficiente:
  · Valor ≥ ${UMBRALES.PRECIO_CRITICO}× la mediana de la categoría
  · Red de ≥ ${UMBRALES.RED_MIN} contratistas distintos con el mismo representante legal en la misma entidad
  · Dependencia del contratista ≥ ${UMBRALES.DEPENDENCIA_ALTA}% combinada con contratación directa
  · Dos o más dimensiones simultáneamente en estado "critico"
MEDIO — se cumple al menos UNA:
  · Valor entre ${UMBRALES.PRECIO_ATENCION}× y ${UMBRALES.PRECIO_CRITICO}× la mediana
  · Entidad ≥ ${UMBRALES.DIRECTA_ALTA}% de contratación directa, muy por encima de la línea base
  · Concentración fuerte del contratista dentro de la entidad, o indicios de fraccionamiento en la ventana de ±${UMBRALES.VENTANA_DIAS} días
  · Ritmo de ejecución (COP/día) muy por encima de la mediana de la categoría
BAJO — el contrato se comporta dentro de los parámetros de su categoría, o los datos no alcanzan para sostener una señal.

El puntaje (0-100) debe ser coherente con el nivel: bajo 0-33, medio 34-66, alto 67-100.

═══ CONTRAPESO OBLIGATORIO ═══
Siempre debes incluir explicaciones legítimas plausibles: por qué este contrato podría ser perfectamente normal. Un análisis que solo acusa no es creíble ni sirve en debate. Ejemplos del dominio: convenios interadministrativos, contratos de obra o tecnología atípicos dentro de una categoría UNSPSC heterogénea, urgencia manifiesta declarada, mercados con oferente único, o una entidad cuyo objeto misional hace legal el uso intensivo de contratación directa (prestación de servicios profesionales).

═══ VERIFICACIONES ═══
Cada acción debe ser ejecutable por el equipo del concejal esta semana, con instrumento y destino concretos: derecho de petición a la entidad, solicitud del expediente del proceso en SECOP II, cruce con RUES/Cámara de Comercio, citación a debate de control político, traslado a Personería o Contraloría Distrital, revisión de los estudios previos y del análisis del sector. Nada de "investigar más".

Escribe en español de Colombia. Montos en COP con separador de miles.`;

const DIMENSIONES = [
  "precio",
  "competencia",
  "concentracion",
  "ejecucion",
  "red",
  "integridad_datos",
] as const;

const SCHEMA = {
  type: "object",
  properties: {
    nivel_sospecha: { type: "string", enum: ["alto", "medio", "bajo"] },
    puntaje: {
      type: "integer",
      description: "0-100, coherente con el nivel según la rúbrica.",
    },
    titular: {
      type: "string",
      description:
        "Una sola línea que resume el hallazgo principal e incluye su cifra. Sin adjetivos vacíos.",
    },
    resumen_ejecutivo: {
      type: "string",
      description:
        "3 a 5 frases. Qué es el contrato, qué señal aparece con su cifra, y qué tan sólida es la evidencia.",
    },
    confiabilidad: {
      type: "object",
      properties: {
        nivel: { type: "string", enum: ["alta", "media", "baja"] },
        motivo: {
          type: "string",
          description:
            "Qué tan sólidos son los datos: tamaño de muestra, campos faltantes, comparabilidad de la categoría.",
        },
      },
      required: ["nivel", "motivo"],
      additionalProperties: false,
    },
    dimensiones: {
      type: "array",
      description:
        "Una entrada por cada dimensión evaluable. Usa 'normal' cuando el dato exista y esté dentro de parámetros; si no hay dato, dilo en la lectura.",
      items: {
        type: "object",
        properties: {
          dimension: { type: "string", enum: DIMENSIONES },
          estado: {
            type: "string",
            enum: ["normal", "atencion", "critico", "sin_datos"],
          },
          lectura: {
            type: "string",
            description: "Una frase con la cifra que sustenta el estado.",
          },
        },
        required: ["dimension", "estado", "lectura"],
        additionalProperties: false,
      },
    },
    hallazgos: {
      type: "array",
      description:
        "Solo los hallazgos que un dato sostiene. Vacío si el contrato es normal — no rellenes.",
      items: {
        type: "object",
        properties: {
          titulo: { type: "string" },
          evidencia: {
            type: "string",
            description:
              "Las cifras exactas del perfil forense, con su denominador y tamaño de muestra.",
          },
          implicacion: {
            type: "string",
            description:
              "Qué podría significar en términos de transparencia o competencia. Neutro, sin acusar.",
          },
          solidez: { type: "string", enum: ["alta", "media", "baja"] },
        },
        required: ["titulo", "evidencia", "implicacion", "solidez"],
        additionalProperties: false,
      },
    },
    explicaciones_legitimas: {
      type: "array",
      description:
        "Obligatorio y no vacío: razones plausibles por las que el patrón podría ser normal y legal.",
      items: { type: "string" },
    },
    que_verificar: {
      type: "array",
      items: {
        type: "object",
        properties: {
          accion: { type: "string", description: "Qué hacer, en imperativo." },
          donde: {
            type: "string",
            description:
              "Instrumento y destinatario: derecho de petición a X, expediente en SECOP II, RUES, Contraloría Distrital…",
          },
          para_que: {
            type: "string",
            description: "Qué confirmaría o descartaría esta acción.",
          },
        },
        required: ["accion", "donde", "para_que"],
        additionalProperties: false,
      },
    },
    limitaciones: {
      type: "array",
      description:
        "Qué NO permite concluir este análisis y qué datos faltan para cerrarlo.",
      items: { type: "string" },
    },
  },
  required: [
    "nivel_sospecha",
    "puntaje",
    "titular",
    "resumen_ejecutivo",
    "confiabilidad",
    "dimensiones",
    "hallazgos",
    "explicaciones_legitimas",
    "que_verificar",
    "limitaciones",
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
    // Streaming: el análisis con effort alto puede tardar más que el timeout
    // HTTP por defecto del SDK en una petición no-streaming.
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 8000,
      system: SYSTEM,
      output_config: {
        effort: "high",
        format: { type: "json_schema", schema: SCHEMA },
      },
      messages: [
        {
          role: "user",
          content: `Evalúa este contrato siguiendo la rúbrica. Ancla cada afirmación a una cifra del perfil.\n\n${ctx}`,
        },
      ],
    });
    const res = await stream.finalMessage();

    if (res.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "El modelo declinó evaluar este contrato." },
        { status: 502 },
      );
    }
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
