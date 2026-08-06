// Patrón 4 — Concentración de contratación directa.
// CALIBRADO: en Bogotá la "Contratación directa" es el ~74% del total (incluye
// prestación de servicios legítima), así que el umbral absoluto del brief (>70%)
// marcaría casi todas las entidades. En su lugar señalamos entidades que
// contratan de forma CASI EXCLUSIVA por directa (outliers), con un mínimo de
// contratos para que sea significativo.

import { isRealId } from "@/lib/patterns/helpers";
import type { AlertCandidate, ContractLite } from "@/lib/patterns/types";

const MIN_CONTRACTS = 20; // entidades con volumen suficiente
const SUSPICIOUS_SHARE = 0.9; // ≥90% directa
// La concentración de contratación directa es una señal de TRANSPARENCIA
// (amerita revisión), no prueba de corrupción por sí sola: se mantiene en
// "sospechosa", nunca "crítica".

const DIRECT_METHODS = new Set([
  "contratación directa",
  "contratación directa (con ofertas)",
]);

function isDirect(method: string | null): boolean {
  return method ? DIRECT_METHODS.has(method.trim().toLowerCase()) : false;
}

export function detectConcentration(
  contracts: ContractLite[],
): AlertCandidate[] {
  const groups = new Map<string, ContractLite[]>();
  for (const c of contracts) {
    if (!isRealId(c.entity_nit)) continue;
    (groups.get(c.entity_nit) ?? groups.set(c.entity_nit, []).get(c.entity_nit)!).push(c);
  }

  const out: AlertCandidate[] = [];
  for (const group of groups.values()) {
    if (group.length < MIN_CONTRACTS) continue;
    const direct = group.filter((c) => isDirect(c.selection_method));
    const share = direct.length / group.length;
    if (share < SUSPICIOUS_SHARE) continue;

    const severity = "suspicious" as const;
    const first = group[0];
    const totalDirect = direct.reduce((s, c) => s + (c.contract_value ?? 0), 0);
    out.push({
      alert_type: "concentration",
      severity,
      title: `${first.entity_name ?? "Entidad"} — ${(share * 100).toFixed(0)}% por contratación directa`,
      related_contract_ids: direct.slice(0, 100).map((c) => c.id),
      entity_name: first.entity_name,
      contractor_name: null,
      total_amount: totalDirect,
      facts: {
        entidad: first.entity_name,
        total_contratos: group.length,
        contratos_directa: direct.length,
        porcentaje_directa: Number((share * 100).toFixed(1)),
        valor_total_directa: totalDirect,
        nota_calibracion:
          "Umbral calibrado: se marca solo contratación directa casi exclusiva, no el promedio distrital (~74%).",
      },
    });
  }
  return out;
}
