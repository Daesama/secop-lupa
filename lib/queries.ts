// Consultas de solo lectura para la UI. Se ejecutan en server components con la
// service key (nunca llega al navegador). Datos: tablas `alerts` y `contracts`.

import { getServiceClient } from "@/lib/supabase";
import { isDistrital } from "@/lib/patterns/helpers";

export interface AlertRow {
  id: string;
  alert_type: string;
  severity: "critical" | "suspicious" | "low";
  title: string;
  description: string;
  ai_analysis: string | null;
  related_contracts: string[];
  entity_name: string | null;
  contractor_name: string | null;
  total_amount: number | null;
  created_at: string;
}

export interface ContractRow {
  id: string;
  secop_id: string;
  contractor_name: string | null;
  entity_name: string | null;
  contract_object: string | null;
  contract_value: number | null;
  signing_date: string | null;
  selection_method: string | null;
  secop_url: string | null;
}

export interface AlertStats {
  total: number;
  critical: number;
  suspicious: number;
  totalAmount: number;
}

export async function getAlertStats(): Promise<AlertStats> {
  const sb = getServiceClient();
  const [{ count: total }, { count: critical }, { count: suspicious }, sums] =
    await Promise.all([
      sb.from("alerts").select("*", { count: "exact", head: true }),
      sb.from("alerts").select("*", { count: "exact", head: true }).eq("severity", "critical"),
      sb.from("alerts").select("*", { count: "exact", head: true }).eq("severity", "suspicious"),
      sb.from("alerts").select("total_amount"),
    ]);
  const totalAmount = (sums.data ?? []).reduce(
    (s, r) => s + (r.total_amount ?? 0),
    0,
  );
  return {
    total: total ?? 0,
    critical: critical ?? 0,
    suspicious: suspicious ?? 0,
    totalAmount,
  };
}

export interface Count {
  label: string;
  value: number;
  key?: string;
}

export interface RankRow {
  name: string;
  alerts: number;
  critical: number;
  amount: number;
}

/** Ranking de entidades por número de alertas y valor bajo alerta. */
export async function getEntityRanking(): Promise<RankRow[]> {
  const sb = getServiceClient();
  const { data } = await sb
    .from("alerts")
    .select("entity_name,severity,total_amount");
  return rank(
    (data ?? []) as {
      entity_name: string | null;
      severity: string;
      total_amount: number | null;
    }[],
    (r) => r.entity_name,
  );
}

/** Ranking de contratistas más señalados (por alertas y valor). */
export async function getContractorRanking(): Promise<RankRow[]> {
  const sb = getServiceClient();
  const { data } = await sb
    .from("alerts")
    .select("contractor_name,severity,total_amount");
  return rank(
    (data ?? []) as {
      contractor_name: string | null;
      severity: string;
      total_amount: number | null;
    }[],
    (r) => r.contractor_name,
  );
}

function rank<T extends { severity: string; total_amount: number | null }>(
  rows: T[],
  keyOf: (r: T) => string | null,
): RankRow[] {
  const map = new Map<string, RankRow>();
  for (const r of rows) {
    const name = keyOf(r);
    if (!name) continue;
    const cur = map.get(name) ?? { name, alerts: 0, critical: 0, amount: 0 };
    cur.alerts += 1;
    if (r.severity === "critical") cur.critical += 1;
    cur.amount += r.total_amount ?? 0;
    map.set(name, cur);
  }
  return [...map.values()].sort((a, b) => b.alerts - a.alerts || b.amount - a.amount);
}

/** Top entidades por número de alertas (para gráfica de ranking). */
export async function getAlertsByEntity(limit = 7): Promise<Count[]> {
  const sb = getServiceClient();
  const { data } = await sb.from("alerts").select("entity_name");
  const counts = new Map<string, number>();
  for (const r of (data ?? []) as { entity_name: string | null }[]) {
    const k = r.entity_name ?? "Sin entidad";
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

/** Alertas por tipo de patrón (para gráfica por categoría). */
export async function getAlertsByType(): Promise<Count[]> {
  const sb = getServiceClient();
  const { data } = await sb.from("alerts").select("alert_type");
  const counts = new Map<string, number>();
  for (const r of (data ?? []) as { alert_type: string }[]) {
    counts.set(r.alert_type, (counts.get(r.alert_type) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, value]) => ({ key, label: key, value }))
    .sort((a, b) => b.value - a.value);
}

export async function getAlerts(opts: {
  severity?: string;
  limit?: number;
} = {}): Promise<AlertRow[]> {
  const sb = getServiceClient();
  let q = sb
    .from("alerts")
    .select(
      "id,alert_type,severity,title,description,ai_analysis,related_contracts,entity_name,contractor_name,total_amount,created_at",
    )
    .order("total_amount", { ascending: false, nullsFirst: false });
  if (opts.severity) q = q.eq("severity", opts.severity);
  if (opts.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as AlertRow[];
}

export async function getAlertById(id: string): Promise<AlertRow | null> {
  const sb = getServiceClient();
  const { data } = await sb
    .from("alerts")
    .select(
      "id,alert_type,severity,title,description,ai_analysis,related_contracts,entity_name,contractor_name,total_amount,created_at",
    )
    .eq("id", id)
    .maybeSingle();
  return (data as AlertRow) ?? null;
}

/**
 * Búsqueda de contratos por texto libre: id de contrato (CO1.PCCNTR), id de
 * proceso (CO1.NTC, en la url), contratista, entidad u objeto. Devuelve
 * coincidencias en nuestra base para que el usuario elija (evita adivinar el ID).
 */
export async function searchContracts(q: string): Promise<ContractRow[]> {
  const term = q.trim();
  if (term.length < 3) return [];
  const sb = getServiceClient();
  const cols =
    "id,secop_id,contractor_name,entity_name,contract_object,contract_value,signing_date,selection_method,secop_url";

  const results = new Map<string, ContractRow>();
  const add = (rows: ContractRow[] | null) =>
    (rows ?? []).forEach((r) => results.set(r.secop_id, r));

  // 1) Coincidencia en id de proceso (CO1.NTC, dentro de la url).
  if (/co1\.ntc/i.test(term)) {
    const { data } = await sb
      .from("contracts")
      .select(cols)
      .ilike("raw_data->urlproceso->>url", `%${term}%`)
      .limit(25);
    add(data as unknown as ContractRow[]);
  }

  // 2) Coincidencia por id de contrato / contratista / entidad / objeto.
  const pattern = `%${term}%`;
  const { data } = await sb
    .from("contracts")
    .select(cols)
    .or(
      `secop_id.ilike.${pattern},contractor_name.ilike.${pattern},entity_name.ilike.${pattern},contract_object.ilike.${pattern}`,
    )
    .order("contract_value", { ascending: false, nullsFirst: false })
    .limit(25);
  add(data as unknown as ContractRow[]);

  return [...results.values()].slice(0, 25);
}

export interface GraphData {
  hub: string; // nodo central
  subtitle: string; // texto bajo el centro
  nodes: { name: string; count: number; value: number }[];
  totalValue: number;
  accent: string; // color del hub
}

function aggregate(
  rows: { key: string | null; value: number | null }[],
): { nodes: { name: string; count: number; value: number }[]; total: number } {
  const by = new Map<string, { count: number; value: number }>();
  let total = 0;
  for (const r of rows) {
    const k = r.key ?? "—";
    const cur = by.get(k) ?? { count: 0, value: 0 };
    cur.count += 1;
    cur.value += r.value ?? 0;
    by.set(k, cur);
    total += r.value ?? 0;
  }
  return {
    nodes: [...by.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.value - a.value),
    total,
  };
}

/** Grafo de red de fachada: representante legal (hub) ↔ contratistas. */
export async function getNetworkGraph(ids: string[]): Promise<GraphData | null> {
  if (ids.length === 0) return null;
  const sb = getServiceClient();
  const { data } = await sb
    .from("contracts")
    .select("contractor_name,legal_rep_name,entity_name,contract_value")
    .in("id", ids.slice(0, 200));
  const rows = (data ?? []) as {
    contractor_name: string | null;
    legal_rep_name: string | null;
    entity_name: string | null;
    contract_value: number | null;
  }[];
  if (rows.length === 0) return null;
  const { nodes, total } = aggregate(
    rows.map((r) => ({ key: r.contractor_name, value: r.contract_value })),
  );
  return {
    hub: rows.find((r) => r.legal_rep_name)?.legal_rep_name ?? "Representante legal",
    subtitle: rows[0].entity_name ?? "",
    nodes,
    totalValue: total,
    accent: "#8b5cf6",
  };
}

/** Grafo de la entidad (hub) ↔ sus principales contratistas por valor. */
export async function getEntityGraph(ids: string[]): Promise<GraphData | null> {
  if (ids.length === 0) return null;
  const sb = getServiceClient();
  const { data: one } = await sb
    .from("contracts")
    .select("entity_nit,entity_name")
    .eq("id", ids[0])
    .maybeSingle();
  const nit = (one as { entity_nit?: string } | null)?.entity_nit;
  const name = (one as { entity_name?: string } | null)?.entity_name;
  if (!nit) return null;

  const { data } = await sb
    .from("contracts")
    .select("contractor_name,contract_value")
    .eq("entity_nit", nit)
    .limit(3000);
  const rows = (data ?? []) as {
    contractor_name: string | null;
    contract_value: number | null;
  }[];
  if (rows.length === 0) return null;
  const { nodes, total } = aggregate(
    rows.map((r) => ({ key: r.contractor_name, value: r.contract_value })),
  );
  return {
    hub: name ?? "Entidad",
    subtitle: `${nodes.length} contratistas · ${rows.length} contratos`,
    nodes,
    totalValue: total,
    accent: "#2563eb",
  };
}

function normLoc(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
}

/** Valor y # de contratos por localidad (vía Alcaldías Locales). Para el mapa. */
export async function getLocalityValues(): Promise<
  Record<string, { count: number; value: number }>
> {
  const sb = getServiceClient();
  const out: Record<string, { count: number; value: number }> = {};
  let last = "";
  for (;;) {
    let q = sb
      .from("contracts")
      .select("id,entity_name,contract_value")
      .ilike("entity_name", "%alcald%local%")
      .order("id")
      .limit(1000);
    if (last) q = q.gt("id", last);
    const { data } = await q;
    if (!data || data.length === 0) break;
    for (const c of data as {
      id: string;
      entity_name: string | null;
      contract_value: number | null;
    }[]) {
      const m = (c.entity_name ?? "").match(/local\s+de\s+(.+)/i);
      if (!m) continue;
      const key = normLoc(m[1]);
      if (!key) continue;
      out[key] = out[key] ?? { count: 0, value: 0 };
      out[key].count += 1;
      out[key].value += c.contract_value ?? 0;
    }
    last = (data[data.length - 1] as { id: string }).id;
    if (data.length < 1000) break;
  }
  return out;
}

export interface ReportRow {
  id: string;
  title: string;
  period_start: string | null;
  period_end: string | null;
  content: string;
  created_at: string;
}

export async function getReports(): Promise<ReportRow[]> {
  const sb = getServiceClient();
  const { data } = await sb
    .from("reports")
    .select("id,title,period_start,period_end,content,created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []) as ReportRow[];
}

export async function getReportById(id: string): Promise<ReportRow | null> {
  const sb = getServiceClient();
  const { data } = await sb
    .from("reports")
    .select("id,title,period_start,period_end,content,created_at")
    .eq("id", id)
    .maybeSingle();
  return (data as ReportRow) ?? null;
}

export interface ComparisonUniverse {
  categoria: string;
  promedio: number;
  mediana: number;
  total: number;
  flaggedValue: number;
  ratio: number;
  contratos: ContractRow[];
}

/**
 * Universo de comparación de un contrato "monto inflado": los contratos
 * distritales de la MISMA categoría UNSPSC que se usaron como referencia.
 * Permite que el concejal vea y juzgue la comparabilidad sin reconstruirlo a mano.
 */
export async function getComparisonUniverse(
  contractId: string,
): Promise<ComparisonUniverse | null> {
  const sb = getServiceClient();
  const { data: flaggedRaw } = await sb
    .from("contracts")
    .select("contract_value,cat:raw_data->>codigo_de_categoria_principal")
    .eq("id", contractId)
    .maybeSingle();
  const flagged = flaggedRaw as unknown as {
    contract_value: number | null;
    cat: string | null;
  } | null;
  if (!flagged?.cat) return null;

  const { data } = await sb
    .from("contracts")
    .select(
      "id,secop_id,contractor_name,entity_name,entity_order,contract_object,contract_value,signing_date,selection_method,secop_url",
    )
    .eq("raw_data->>codigo_de_categoria_principal", flagged.cat)
    .not("contract_value", "is", null)
    .limit(3000);

  const group = ((data ?? []) as unknown as (ContractRow & {
    entity_order: string | null;
  })[])
    .filter(isDistrital)
    .filter((c) => Number(c.contract_value) > 0);
  if (group.length === 0) return null;

  const values = group
    .map((c) => Number(c.contract_value))
    .sort((a, b) => a - b);
  const promedio = values.reduce((a, b) => a + b, 0) / values.length;
  const mediana = values[Math.floor(values.length / 2)];
  const flaggedValue = Number(flagged.contract_value) || 0;

  const contratos = group
    .filter((c) => c.id !== contractId)
    .sort((a, b) => Number(b.contract_value) - Number(a.contract_value))
    .slice(0, 15);

  return {
    categoria: flagged.cat,
    promedio,
    mediana,
    total: group.length,
    flaggedValue,
    ratio: promedio > 0 ? flaggedValue / promedio : 0,
    contratos,
  };
}

export async function getContractsByIds(ids: string[]): Promise<ContractRow[]> {
  if (ids.length === 0) return [];
  const sb = getServiceClient();
  const { data } = await sb
    .from("contracts")
    .select(
      "id,secop_id,contractor_name,entity_name,contract_object,contract_value,signing_date,selection_method,secop_url",
    )
    .in("id", ids.slice(0, 50)); // acotar la lista mostrada
  return (data ?? []) as ContractRow[];
}
