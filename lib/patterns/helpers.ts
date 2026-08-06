// Utilidades compartidas por los detectores.

import { getServiceClient } from "@/lib/supabase";
import type { ContractLite, Severity } from "@/lib/patterns/types";

const COLUMNS =
  "id,contractor_id,contractor_name,entity_nit,entity_name,entity_order," +
  "contract_value,selection_method,contract_type,start_date,end_date,signing_date," +
  "legal_rep_id,legal_rep_name,legal_rep_address,secop_url,contract_object," +
  "category_code:raw_data->>codigo_de_categoria_principal";

/**
 * Carga TODOS los contratos (paginando de a 1000) a memoria. Con el universo
 * acotado de desarrollo (~30k filas, sin raw_data) esto es liviano y permite
 * agregación en TypeScript sin funciones SQL.
 */
export async function fetchAllContracts(): Promise<ContractLite[]> {
  const supabase = getServiceClient();
  const pageSize = 1000;
  const all: ContractLite[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("contracts")
      .select(COLUMNS)
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Error cargando contratos: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...(data as unknown as ContractLite[]));
    if (data.length < pageSize) break;
  }
  return all;
}

/** Valores de `contractor_id`/`legal_rep_id` que no identifican a nadie. */
const GENERIC_IDS = new Set([
  "no definido",
  "no aplica",
  "sin descripcion",
  "sin descripción",
  "0",
  "",
]);

export function isRealId(id: string | null | undefined): id is string {
  if (!id) return false;
  return !GENERIC_IDS.has(id.trim().toLowerCase());
}

/**
 * ¿Parece un documento de identidad real (cédula/NIT)? Filtra placeholders de
 * texto como "Sin Descripcion" que corrompen el patrón de redes: exige que sea
 * numérico (tras quitar puntos/guiones/espacios) y de longitud plausible.
 */
export function isDocumentId(id: string | null | undefined): id is string {
  if (!isRealId(id)) return false;
  const digits = id.replace(/[.\-\s]/g, "");
  return /^\d{5,}$/.test(digits);
}

/**
 * ¿La entidad es DISTRITAL (jurisdicción del Concejo de Bogotá)? Se usa para
 * excluir el ruido de entidades nacionales (Defensoría, ANT, JEP…) que están en
 * Bogotá pero no son objeto de control político distrital. Combina el campo
 * `orden`=Territorial con el nombre para recuperar entidades distritales mal
 * clasificadas, y excluye Corporaciones Autónomas (CAR) y Nacionales.
 */
const DISTRITAL_NAME = /distrital|distrito capital|alcald[íi]a local|bogot[áa]\s*d\.?\s*c/i;

export function isDistrital(c: {
  entity_order: string | null;
  entity_name: string | null;
}): boolean {
  if ((c.entity_order ?? "").trim().toLowerCase() === "territorial") return true;
  return DISTRITAL_NAME.test(c.entity_name ?? "");
}

/**
 * ¿El "contratista" es en realidad una entidad pública? (convenio
 * interadministrativo — Estado contratando con Estado, no es corrupción).
 * Se detecta si su documento coincide con un NIT de entidad, o por nombre.
 */
const PUBLIC_NAME =
  /^(alcald[íi]a|secretar[íi]a|instituto|fondo|unidad administrativa|departamento administrativo|ministerio|agencia nacional|corporaci[óo]n aut|subred|empresa social del estado|e\.s\.e|universidad (nacional|distrital|pedag))/i;

export function isPublicContractor(
  c: { contractor_id: string | null; contractor_name: string | null },
  entityNits: Set<string>,
): boolean {
  if (c.contractor_id && entityNits.has(c.contractor_id)) return true;
  return PUBLIC_NAME.test((c.contractor_name ?? "").trim());
}

/** Ordena candidatos: primero críticos, luego por monto involucrado. */
const SEVERITY_RANK: Record<Severity, number> = {
  critical: 0,
  suspicious: 1,
  low: 2,
};

export function bySeverityThenAmount(
  a: { severity: Severity; total_amount: number | null },
  b: { severity: Severity; total_amount: number | null },
): number {
  const s = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
  if (s !== 0) return s;
  return (b.total_amount ?? 0) - (a.total_amount ?? 0);
}
