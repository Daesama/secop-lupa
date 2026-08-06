// Orquestador de detectores deterministas.

import {
  bySeverityThenAmount,
  fetchAllContracts,
  isDistrital,
  isPublicContractor,
  isRealId,
} from "@/lib/patterns/helpers";
import { detectRepeatedContractors } from "@/lib/patterns/repeated-contractor";
import { detectContractorNetworks } from "@/lib/patterns/contractor-network";
import { detectConcentration } from "@/lib/patterns/concentration";
import { detectInflatedAmounts } from "@/lib/patterns/inflated-amount";
import type { AlertCandidate } from "@/lib/patterns/types";

export type { AlertCandidate } from "@/lib/patterns/types";

/**
 * Carga los contratos y corre los detectores SOLO sobre entidades distritales
 * (jurisdicción de control político del Concejo de Bogotá), reduciendo el ruido
 * de entidades nacionales. Devuelve los candidatos ordenados por gravedad y monto.
 * (Los patrones 3-tiempos y 5-fraccionamiento se enchufan en el siguiente incremento.)
 */
export async function runAllDetectors(): Promise<AlertCandidate[]> {
  const contracts = await fetchAllContracts();

  // Universo de NITs de entidades (para detectar convenios interadministrativos).
  const entityNits = new Set(contracts.map((c) => c.entity_nit).filter(isRealId));

  // 1) Solo entidades distritales.
  const distrital = contracts.filter(isDistrital);
  // 2) Para patrones por contratista, excluir convenios (Estado con Estado).
  const distritalPrivate = distrital.filter(
    (c) => !isPublicContractor(c, entityNits),
  );

  const candidates: AlertCandidate[] = [
    ...detectRepeatedContractors(distritalPrivate),
    ...detectContractorNetworks(distritalPrivate),
    ...detectConcentration(distrital),
    ...detectInflatedAmounts(distritalPrivate),
  ];
  candidates.sort(bySeverityThenAmount);

  // Deduplicar alertas visualmente idénticas (p.ej. registros duplicados en SECOP).
  const seen = new Set<string>();
  return candidates.filter((c) => {
    const key = `${c.alert_type}|${c.title}|${c.total_amount}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
