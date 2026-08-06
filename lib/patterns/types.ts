// Tipos del motor de detección de patrones.

/** Contrato en memoria (subconjunto de columnas usado por los detectores). */
export interface ContractLite {
  id: string;
  contractor_id: string | null;
  contractor_name: string | null;
  entity_nit: string | null;
  entity_name: string | null;
  entity_order: string | null;
  contract_value: number | null;
  selection_method: string | null;
  contract_type: string | null;
  start_date: string | null;
  end_date: string | null;
  signing_date: string | null;
  legal_rep_id: string | null;
  legal_rep_name: string | null;
  legal_rep_address: string | null;
  secop_url: string | null;
  contract_object: string | null;
  /** Código UNSPSC de categoría (desde raw_data), para comparar objetos similares. */
  category_code: string | null;
}

export type Severity = "critical" | "suspicious" | "low";

export type AlertType =
  | "repeated_contractor"
  | "inflated_amount"
  | "unrealistic_timeline"
  | "concentration"
  | "fragmentation"
  | "network";

/** Anomalía detectada de forma determinista, antes de que la IA la redacte. */
export interface AlertCandidate {
  alert_type: AlertType;
  severity: Severity;
  title: string;
  related_contract_ids: string[];
  entity_name: string | null;
  contractor_name: string | null;
  total_amount: number | null;
  /** Datos estructurados que la IA usa para redactar la explicación. */
  facts: Record<string, unknown>;
}
