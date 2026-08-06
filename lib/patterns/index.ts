// Orquestador de detectores deterministas.

import { bySeverityThenAmount, fetchAllContracts } from "@/lib/patterns/helpers";
import { detectRepeatedContractors } from "@/lib/patterns/repeated-contractor";
import { detectContractorNetworks } from "@/lib/patterns/contractor-network";
import { detectConcentration } from "@/lib/patterns/concentration";
import { detectInflatedAmounts } from "@/lib/patterns/inflated-amount";
import type { AlertCandidate } from "@/lib/patterns/types";

export type { AlertCandidate } from "@/lib/patterns/types";

/**
 * Carga los contratos y corre todos los detectores. Devuelve los candidatos
 * ordenados por gravedad y monto. (Los patrones 3-tiempos y 5-fraccionamiento
 * se enchufan aquí en el siguiente incremento.)
 */
export async function runAllDetectors(): Promise<AlertCandidate[]> {
  const contracts = await fetchAllContracts();
  const candidates: AlertCandidate[] = [
    ...detectRepeatedContractors(contracts),
    ...detectContractorNetworks(contracts),
    ...detectConcentration(contracts),
    ...detectInflatedAmounts(contracts),
  ];
  candidates.sort(bySeverityThenAmount);
  return candidates;
}
