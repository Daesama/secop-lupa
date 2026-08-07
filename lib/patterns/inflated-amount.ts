// Patrón 2 — Montos inflados (calibrado para precisión).
// Se compara contra la MEDIANA de la misma categoría UNSPSC (robusta frente a
// outliers, a diferencia del promedio) y se exige un valor mínimo absoluto para
// marcar solo contratos grandes que ameritan escrutinio. Así se evita el ruido.
// Umbrales: > 5× la mediana → sospechoso, > 10× → crítico.

import type { AlertCandidate, ContractLite } from "@/lib/patterns/types";

const SUSPICIOUS_FACTOR = 8;
const CRITICAL_FACTOR = 15;
const MIN_GROUP_SIZE = 20; // muestras suficientes para una mediana confiable
const MIN_VALUE = 1_000_000_000; // solo contratos ≥ COP 1.000M (relevancia)
const MAX_ALERTS = 40; // solo los casos más extremos (evita ruido)

function median(sorted: number[]): number {
  const n = sorted.length;
  return n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
}

export function detectInflatedAmounts(
  contracts: ContractLite[],
): AlertCandidate[] {
  const groups = new Map<string, ContractLite[]>();
  for (const c of contracts) {
    if (!c.category_code) continue;
    if (!c.contract_value || c.contract_value <= 0) continue;
    (groups.get(c.category_code) ?? groups.set(c.category_code, []).get(c.category_code)!).push(c);
  }

  const out: AlertCandidate[] = [];
  for (const group of groups.values()) {
    if (group.length < MIN_GROUP_SIZE) continue;
    const values = group
      .map((c) => c.contract_value as number)
      .sort((a, b) => a - b);
    const med = median(values);
    if (med <= 0) continue;

    for (const c of group) {
      const value = c.contract_value as number;
      if (value < MIN_VALUE) continue; // ignora contratos pequeños
      const ratio = value / med;
      if (ratio < SUSPICIOUS_FACTOR) continue;
      const severity = ratio >= CRITICAL_FACTOR ? "critical" : "suspicious";
      out.push({
        alert_type: "inflated_amount",
        severity,
        title: `Contrato ${ratio.toFixed(1)}× la mediana de su categoría — ${c.entity_name ?? "entidad"}`,
        related_contract_ids: [c.id],
        entity_name: c.entity_name,
        contractor_name: c.contractor_name,
        total_amount: value,
        facts: {
          entidad: c.entity_name,
          contratista: c.contractor_name,
          objeto: c.contract_object,
          valor_del_contrato: value,
          mediana_categoria: Math.round(med),
          contratos_comparados: group.length,
          veces_sobre_mediana: Number(ratio.toFixed(1)),
          categoria_unspsc: c.category_code,
        },
      });
    }
  }
  // Solo los más extremos: ordena por múltiplo sobre la mediana y corta.
  return out
    .sort(
      (a, b) =>
        (b.facts.veces_sobre_mediana as number) -
        (a.facts.veces_sobre_mediana as number),
    )
    .slice(0, MAX_ALERTS);
}
