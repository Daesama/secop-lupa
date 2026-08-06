// Patrón 1 — Contratistas repetidos.
// Un mismo contratista (NIT) con demasiados contratos en la MISMA entidad.
// Umbrales del brief: >5 → sospechoso, >10 → crítico.
// (Nota: el universo de desarrollo cubre ~6 semanas; con más histórico se
//  aplicaría la ventana de 12 meses del brief.)

import { isRealId } from "@/lib/patterns/helpers";
import type { AlertCandidate, ContractLite } from "@/lib/patterns/types";

const SUSPICIOUS_MIN = 6; // > 5
const CRITICAL_MIN = 11; // > 10

export function detectRepeatedContractors(
  contracts: ContractLite[],
): AlertCandidate[] {
  // Agrupar por (contratista, entidad).
  const groups = new Map<string, ContractLite[]>();
  for (const c of contracts) {
    if (!isRealId(c.contractor_id) || !isRealId(c.entity_nit)) continue;
    const key = `${c.contractor_id}||${c.entity_nit}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(c);
  }

  const out: AlertCandidate[] = [];
  for (const group of groups.values()) {
    const n = group.length;
    if (n < SUSPICIOUS_MIN) continue;
    const severity = n >= CRITICAL_MIN ? "critical" : "suspicious";
    const first = group[0];
    const total = group.reduce((s, c) => s + (c.contract_value ?? 0), 0);
    out.push({
      alert_type: "repeated_contractor",
      severity,
      title: `${first.contractor_name ?? "Contratista"} — ${n} contratos con ${first.entity_name ?? "la entidad"}`,
      related_contract_ids: group.map((c) => c.id),
      entity_name: first.entity_name,
      contractor_name: first.contractor_name,
      total_amount: total,
      facts: {
        contratista: first.contractor_name,
        nit_contratista: first.contractor_id,
        entidad: first.entity_name,
        numero_de_contratos: n,
        valor_total: total,
        umbral_aplicado:
          severity === "critical" ? "más de 10 contratos" : "más de 5 contratos",
      },
    });
  }
  return out;
}
