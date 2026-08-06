// Herramientas de solo lectura que Claude puede invocar para responder con
// datos REALES de la base (grounding). Todas se limitan a entidades distritales.

import { getServiceClient } from "@/lib/supabase";
import { isDistrital } from "@/lib/patterns/helpers";

const FIELDS =
  "secop_id,entity_name,entity_order,contractor_name,contractor_id," +
  "contract_value,selection_method,signing_date,contract_object,secop_url";

interface ContractLike {
  entity_order: string | null;
  entity_name: string | null;
  [k: string]: unknown;
}

function trimObject<T extends Record<string, unknown>>(c: T) {
  const obj = c.contract_object;
  return {
    ...c,
    contract_object:
      typeof obj === "string" && obj.length > 160 ? obj.slice(0, 160) + "…" : obj,
  };
}

/** Definiciones de herramientas para el Messages API. */
export const CHAT_TOOLS = [
  {
    name: "contratos_de_contratista",
    description:
      "Devuelve hasta 25 contratos de un contratista distrital, buscando por su documento (NIT o cédula). Úsala cuando pregunten por los contratos, historial o vínculos de un contratista.",
    input_schema: {
      type: "object",
      properties: {
        documento: {
          type: "string",
          description: "NIT o cédula del contratista (solo dígitos).",
        },
      },
      required: ["documento"],
      additionalProperties: false,
    },
  },
  {
    name: "resumen_contratista",
    description:
      "Resumen agregado de un contratista distrital: número de contratos, valor total y entidades con las que contrata. Úsala para '¿cuánto ha recibido X?' o '¿con cuántas entidades contrata?'.",
    input_schema: {
      type: "object",
      properties: {
        documento: { type: "string", description: "NIT o cédula del contratista." },
      },
      required: ["documento"],
      additionalProperties: false,
    },
  },
  {
    name: "contratos_de_entidad",
    description:
      "Devuelve hasta 25 contratos recientes de una entidad distrital, buscando por nombre parcial. Úsala para preguntas sobre lo que contrata una entidad.",
    input_schema: {
      type: "object",
      properties: {
        nombre: {
          type: "string",
          description: "Nombre o fragmento del nombre de la entidad.",
        },
      },
      required: ["nombre"],
      additionalProperties: false,
    },
  },
] as const;

async function contratosDeContratista(documento: string) {
  const sb = getServiceClient();
  const { data } = await sb
    .from("contracts")
    .select(FIELDS)
    .eq("contractor_id", documento.trim())
    .order("signing_date", { ascending: false })
    .limit(60);
  const distrital = ((data ?? []) as unknown as ContractLike[])
    .filter(isDistrital)
    .slice(0, 25)
    .map(trimObject);
  return { encontrados: distrital.length, contratos: distrital };
}

async function resumenContratista(documento: string) {
  const sb = getServiceClient();
  const { data } = await sb
    .from("contracts")
    .select("entity_name,entity_order,contract_value,contractor_name")
    .eq("contractor_id", documento.trim())
    .limit(2000);
  const rows = ((data ?? []) as unknown as ContractLike[]).filter(isDistrital);
  if (rows.length === 0)
    return { nota: "No se encontraron contratos distritales para ese documento." };
  const total = rows.reduce(
    (s, r) => s + (Number(r.contract_value) || 0),
    0,
  );
  const entidades = [...new Set(rows.map((r) => r.entity_name))];
  return {
    contratista: rows[0].contractor_name,
    numero_de_contratos: rows.length,
    valor_total_cop: total,
    numero_de_entidades: entidades.length,
    entidades: entidades.slice(0, 15),
  };
}

async function contratosDeEntidad(nombre: string) {
  const sb = getServiceClient();
  const { data } = await sb
    .from("contracts")
    .select(FIELDS)
    .ilike("entity_name", `%${nombre.trim()}%`)
    .order("contract_value", { ascending: false, nullsFirst: false })
    .limit(60);
  const distrital = ((data ?? []) as unknown as ContractLike[])
    .filter(isDistrital)
    .slice(0, 25)
    .map(trimObject);
  return { encontrados: distrital.length, contratos: distrital };
}

/** Ejecuta una herramienta por nombre. Devuelve un objeto serializable. */
export async function runChatTool(
  name: string,
  input: Record<string, unknown>,
): Promise<unknown> {
  try {
    if (name === "contratos_de_contratista")
      return await contratosDeContratista(String(input.documento ?? ""));
    if (name === "resumen_contratista")
      return await resumenContratista(String(input.documento ?? ""));
    if (name === "contratos_de_entidad")
      return await contratosDeEntidad(String(input.nombre ?? ""));
    return { error: `Herramienta desconocida: ${name}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
