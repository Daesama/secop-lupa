// Patrón 2 — Montos inflados.
// Un contrato cuyo valor supera enormemente el promedio de contratos
// comparables. Comparamos por (modalidad de selección + tipo de contrato) como
// proxy de "objeto similar" — sin cargar raw_data. Umbrales del brief:
// > 200% del promedio → sospechoso (3× la media), > 400% → crítico (5×).
// Nota: al incorporar `category_code` (UNSPSC) la comparación será más fina.

import type { AlertCandidate, ContractLite } from "@/lib/patterns/types";

const SUSPICIOUS_FACTOR = 3; // +200%
const CRITICAL_FACTOR = 5; // +400%
const MIN_GROUP_SIZE = 15; // suficientes muestras para un promedio confiable

export function detectInflatedAmounts(
  contracts: ContractLite[],
): AlertCandidate[] {
  const groups = new Map<string, ContractLite[]>();
  for (const c of contracts) {
    if (!c.contract_value || c.contract_value <= 0) continue;
    const key = `${c.selection_method ?? "?"}||${c.contract_type ?? "?"}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(c);
  }

  const out: AlertCandidate[] = [];
  for (const group of groups.values()) {
    if (group.length < MIN_GROUP_SIZE) continue;
    const avg =
      group.reduce((s, c) => s + (c.contract_value ?? 0), 0) / group.length;
    if (avg <= 0) continue;

    for (const c of group) {
      const ratio = (c.contract_value ?? 0) / avg;
      if (ratio < SUSPICIOUS_FACTOR) continue;
      const severity = ratio >= CRITICAL_FACTOR ? "critical" : "suspicious";
      out.push({
        alert_type: "inflated_amount",
        severity,
        title: `Contrato ${ratio.toFixed(1)}× el promedio — ${c.entity_name ?? "entidad"}`,
        related_contract_ids: [c.id],
        entity_name: c.entity_name,
        contractor_name: c.contractor_name,
        total_amount: c.contract_value,
        facts: {
          entidad: c.entity_name,
          contratista: c.contractor_name,
          objeto: c.contract_object,
          valor_del_contrato: c.contract_value,
          promedio_categoria: Math.round(avg),
          veces_sobre_promedio: Number(ratio.toFixed(1)),
          categoria_comparada: `${c.selection_method} / ${c.contract_type}`,
        },
      });
    }
  }
  return out;
}
