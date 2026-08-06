// Patrón 6 — Redes de contratistas.
// Varios contratistas DISTINTOS que comparten el mismo representante legal
// (un tercero) y contratan con la misma entidad. Señal de posibles empresas
// de fachada vinculadas. Umbral del brief: ≥3 contratistas vinculados.

import { isDocumentId, isRealId } from "@/lib/patterns/helpers";
import type { AlertCandidate, ContractLite } from "@/lib/patterns/types";

const MIN_LINKED = 3;
// Cota superior de plausibilidad: una red de fachada real es pequeña. Un
// "representante" detrás de decenas de contratistas suele ser un artefacto de
// datos (campo mal diligenciado), no una red.
const MAX_LINKED = 25;

export function detectContractorNetworks(
  contracts: ContractLite[],
): AlertCandidate[] {
  // Agrupar por (representante legal, entidad). Exigir que el representante sea
  // un documento real (numérico) descarta placeholders de texto.
  const groups = new Map<string, ContractLite[]>();
  for (const c of contracts) {
    if (!isDocumentId(c.legal_rep_id) || !isRealId(c.entity_nit)) continue;
    // Excluir el caso natural (persona = su propio representante), típico en
    // contratos de prestación de servicios: no es una red.
    if (c.legal_rep_id === c.contractor_id) continue;
    const key = `${c.legal_rep_id}||${c.entity_nit}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(c);
  }

  const out: AlertCandidate[] = [];
  for (const group of groups.values()) {
    const contractorIds = new Set(
      group.map((c) => c.contractor_id).filter(isRealId),
    );
    if (contractorIds.size < MIN_LINKED || contractorIds.size > MAX_LINKED)
      continue;

    const first = group[0];
    const total = group.reduce((s, c) => s + (c.contract_value ?? 0), 0);
    const contractorNames = [
      ...new Set(group.map((c) => c.contractor_name).filter(Boolean)),
    ];
    out.push({
      alert_type: "network",
      severity: "critical",
      title: `Red de ${contractorIds.size} contratistas vinculados en ${first.entity_name ?? "la entidad"}`,
      related_contract_ids: group.map((c) => c.id),
      entity_name: first.entity_name,
      contractor_name: null,
      total_amount: total,
      facts: {
        representante_legal_comun: first.legal_rep_name ?? first.legal_rep_id,
        entidad: first.entity_name,
        numero_de_contratistas_vinculados: contractorIds.size,
        contratistas: contractorNames.slice(0, 10),
        numero_de_contratos: group.length,
        valor_total: total,
      },
    });
  }
  return out;
}
