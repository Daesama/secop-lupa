// Consultas de solo lectura para la UI. Se ejecutan en server components con la
// service key (nunca llega al navegador). Datos: tablas `alerts` y `contracts`.

import { getServiceClient } from "@/lib/supabase";

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
