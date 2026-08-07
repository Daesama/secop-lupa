// Análisis on-demand de CUALQUIER contrato (esté o no en nuestra base / tenga o
// no alerta). Busca el contrato (base primero, SECOP en vivo si no está) y
// calcula señales deterministas de sospecha. La IA solo interpreta (aparte).

import { getServiceClient } from "@/lib/supabase";
import { SECOP_CONTRACTS_URL } from "@/lib/utils/constants";
import { isDistrital } from "@/lib/patterns/helpers";
import {
  parseSecopNumber,
  parseSecopDate,
  orNull,
  formatCOP,
} from "@/lib/utils/format";
import type { SecopRawContract } from "@/lib/types";

export interface ContractDetail {
  secop_id: string;
  contractor_name: string | null;
  contractor_id: string | null;
  entity_name: string | null;
  entity_nit: string | null;
  entity_order: string | null;
  contract_value: number | null;
  selection_method: string | null;
  contract_type: string | null;
  contract_status: string | null;
  signing_date: string | null;
  start_date: string | null;
  end_date: string | null;
  contract_object: string | null;
  secop_url: string | null;
  category_code: string | null;
  source: "base" | "secop";
}

export interface ContractSignals {
  esDistrital: boolean;
  // Comparación por categoría
  categoria: string | null;
  promedioCategoria: number | null;
  medianaCategoria: number | null;
  contratosCategoria: number | null;
  vecesSobrePromedio: number | null;
  // Contratista
  contratosDelContratista: number | null;
  // Entidad
  porcentajeDirectaEntidad: number | null;
  contratosEntidad: number | null;
}

const DB_SELECT =
  "secop_id,contractor_name,contractor_id,entity_name,entity_nit,entity_order," +
  "contract_value,selection_method,contract_type,contract_status,signing_date," +
  "start_date,end_date,contract_object,secop_url," +
  "category_code:raw_data->>codigo_de_categoria_principal";

/** Texto de contexto (contrato + señales) para inyectar a la IA. */
export function contractContextText(
  c: ContractDetail,
  s: ContractSignals,
): string {
  return `CONTRATO:
Id SECOP: ${c.secop_id}
Entidad: ${c.entity_name ?? "—"} (${c.entity_order ?? "?"})
Contratista: ${c.contractor_name ?? "—"} (doc ${c.contractor_id ?? "—"})
Objeto: ${c.contract_object ?? "—"}
Valor: ${formatCOP(c.contract_value)}
Modalidad: ${c.selection_method ?? "—"} | Tipo: ${c.contract_type ?? "—"}
Firma: ${c.signing_date ?? "—"} | Ejecución: ${c.start_date ?? "?"} a ${c.end_date ?? "?"}

SEÑALES CALCULADAS (datos distritales):
- ¿Entidad distrital?: ${s.esDistrital ? "Sí" : "No (fuera de jurisdicción del Concejo)"}
- Comparación por categoría (${s.categoria ?? "?"}): promedio ${formatCOP(s.promedioCategoria)}, mediana ${formatCOP(s.medianaCategoria)}, sobre ${s.contratosCategoria ?? "?"} contratos. Este contrato es ${s.vecesSobrePromedio ? s.vecesSobrePromedio.toFixed(1) + "× el promedio" : "no comparable"}.
- Contratos del contratista en el distrito: ${s.contratosDelContratista ?? "?"}
- Contratación directa de la entidad: ${s.porcentajeDirectaEntidad != null ? s.porcentajeDirectaEntidad.toFixed(0) + "%" : "?"} de ${s.contratosEntidad ?? "?"} contratos.`;
}

function mapDbRow(d: Record<string, unknown>): ContractDetail {
  return {
    secop_id: (d.secop_id as string) ?? "",
    contractor_name: (d.contractor_name as string) ?? null,
    contractor_id: (d.contractor_id as string) ?? null,
    entity_name: (d.entity_name as string) ?? null,
    entity_nit: (d.entity_nit as string) ?? null,
    entity_order: (d.entity_order as string) ?? null,
    contract_value: (d.contract_value as number) ?? null,
    selection_method: (d.selection_method as string) ?? null,
    contract_type: (d.contract_type as string) ?? null,
    contract_status: (d.contract_status as string) ?? null,
    signing_date: (d.signing_date as string) ?? null,
    start_date: (d.start_date as string) ?? null,
    end_date: (d.end_date as string) ?? null,
    contract_object: (d.contract_object as string) ?? null,
    secop_url: (d.secop_url as string) ?? null,
    category_code: (d.category_code as string) ?? null,
    source: "base",
  };
}

/** Busca un contrato por su id de SECOP: primero en la base, luego en vivo. */
export async function lookupContract(
  secopId: string,
): Promise<ContractDetail | null> {
  const id = secopId.trim();
  if (!id) return null;
  const sb = getServiceClient();

  // 1) Por id de contrato (CO1.PCCNTR) exacto
  const exact = await sb
    .from("contracts")
    .select(DB_SELECT)
    .eq("secop_id", id)
    .maybeSingle();
  if (exact.data) return mapDbRow(exact.data as unknown as Record<string, unknown>);

  // 2) Por id de proceso (CO1.NTC) dentro de la url
  const byProcess = await sb
    .from("contracts")
    .select(DB_SELECT)
    .ilike("raw_data->urlproceso->>url", `%${id}%`)
    .limit(1)
    .maybeSingle();
  if (byProcess.data) return mapDbRow(byProcess.data as unknown as Record<string, unknown>);

  // 3) En vivo desde SECOP (SODA API) por id_contrato (solo si es un CO1.PCCNTR)
  if (!/pccntr/i.test(id)) return null;
  const url = `${SECOP_CONTRACTS_URL}?id_contrato=${encodeURIComponent(id)}&$limit=1`;
  // Reintentos ante 503/429 transitorios de SECOP (frecuentes bajo carga).
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 700 * attempt));
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (res.status === 503 || res.status === 429) continue;
      if (!res.ok) return null;
      const arr = (await res.json()) as SecopRawContract[];
      const raw = arr?.[0];
      if (!raw) return null;
      return {
      secop_id: id,
      contractor_name: orNull(raw.proveedor_adjudicado),
      contractor_id: orNull(raw.documento_proveedor),
      entity_name: orNull(raw.nombre_entidad),
      entity_nit: orNull(raw.nit_entidad),
      entity_order: orNull(raw.orden),
      contract_value: parseSecopNumber(raw.valor_del_contrato),
      selection_method: orNull(raw.modalidad_de_contratacion),
      contract_type: orNull(raw.tipo_de_contrato),
      contract_status: orNull(raw.estado_contrato),
      signing_date: parseSecopDate(raw.fecha_de_firma),
      start_date: parseSecopDate(raw.fecha_de_inicio_del_contrato),
      end_date: parseSecopDate(raw.fecha_de_fin_del_contrato),
      contract_object:
        orNull(raw.objeto_del_contrato) ?? orNull(raw.descripcion_del_proceso),
      secop_url: orNull(raw.urlproceso?.url),
      category_code: orNull(
        raw.codigo_de_categoria_principal as string | undefined,
      ),
      source: "secop",
      };
    } catch {
      // reintentar
    }
  }
  return null;
}

/** Calcula señales deterministas de sospecha para un contrato. */
export async function analyzeContractSignals(
  c: ContractDetail,
): Promise<ContractSignals> {
  const sb = getServiceClient();
  const signals: ContractSignals = {
    esDistrital: isDistrital(c),
    categoria: c.category_code,
    promedioCategoria: null,
    medianaCategoria: null,
    contratosCategoria: null,
    vecesSobrePromedio: null,
    contratosDelContratista: null,
    porcentajeDirectaEntidad: null,
    contratosEntidad: null,
  };

  // Comparación por categoría (distrital)
  if (c.category_code && c.contract_value && c.contract_value > 0) {
    const { data } = await sb
      .from("contracts")
      .select("entity_order,entity_name,contract_value")
      .eq("raw_data->>codigo_de_categoria_principal", c.category_code)
      .not("contract_value", "is", null)
      .limit(3000);
    const group = ((data ?? []) as unknown as {
      entity_order: string | null;
      entity_name: string | null;
      contract_value: number | null;
    }[])
      .filter(isDistrital)
      .map((r) => Number(r.contract_value))
      .filter((v) => v > 0)
      .sort((a, b) => a - b);
    if (group.length > 0) {
      const prom = group.reduce((a, b) => a + b, 0) / group.length;
      signals.categoria = c.category_code;
      signals.promedioCategoria = prom;
      signals.medianaCategoria = group[Math.floor(group.length / 2)];
      signals.contratosCategoria = group.length;
      signals.vecesSobrePromedio = prom > 0 ? c.contract_value / prom : null;
    }
  }

  // Frecuencia del contratista (distrital)
  if (c.contractor_id) {
    const { count } = await sb
      .from("contracts")
      .select("*", { count: "exact", head: true })
      .eq("contractor_id", c.contractor_id);
    signals.contratosDelContratista = count ?? null;
  }

  // Concentración de contratación directa de la entidad
  if (c.entity_nit) {
    const { data } = await sb
      .from("contracts")
      .select("selection_method")
      .eq("entity_nit", c.entity_nit)
      .limit(5000);
    const rows = (data ?? []) as { selection_method: string | null }[];
    if (rows.length > 0) {
      const directa = rows.filter((r) =>
        (r.selection_method ?? "").toLowerCase().startsWith("contratación directa"),
      ).length;
      signals.contratosEntidad = rows.length;
      signals.porcentajeDirectaEntidad = (directa / rows.length) * 100;
    }
  }

  return signals;
}
