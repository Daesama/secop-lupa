// Patrón 2 — Montos inflados.
// Un contrato cuyo valor supera enormemente el promedio de contratos del MISMO
// objeto (código UNSPSC de categoría). Comparar dentro de la misma categoría
// evita marcar programas grandes legítimos como anomalías. Umbrales del brief:
// > 200% del promedio → sospechoso (3×), > 400% → crítico (5×).

import type { AlertCandidate, ContractLite } from "@/lib/patterns/types";

const SUSPICIOUS_FACTOR = 3; // +200%
const CRITICAL_FACTOR = 5; // +400%
const MIN_GROUP_SIZE = 15; // muestras suficientes para un promedio confiable

export function detectInflatedAmounts(
  contracts: ContractLite[],
): AlertCandidate[] {
  // Agrupar por categoría UNSPSC. Sin categoría no se compara (conservador).
  const groups = new Map<string, ContractLite[]>();
  for (const c of contracts) {
    if (!c.category_code) continue;
    if (!c.contract_value || c.contract_value <= 0) continue;
    (groups.get(c.category_code) ?? groups.set(c.category_code, []).get(c.category_code)!).push(c);
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
        title: `Contrato ${ratio.toFixed(1)}× el promedio de su categoría — ${c.entity_name ?? "entidad"}`,
        related_contract_ids: [c.id],
        entity_name: c.entity_name,
        contractor_name: c.contractor_name,
        total_amount: c.contract_value,
        facts: {
          entidad: c.entity_name,
          contratista: c.contractor_name,
          objeto: c.contract_object,
          valor_del_contrato: c.contract_value,
          categoria_unspsc: c.category_code,
          promedio_misma_categoria: Math.round(avg),
          contratos_comparados: group.length,
          veces_sobre_promedio: Number(ratio.toFixed(1)),
        },
      });
    }
  }
  return out;
}
