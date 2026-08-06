// Cliente de la SODA API de SECOP II (datos.gov.co).
// Descarga contratos de Bogotá D.C. y los mapea al shape de la tabla `contracts`.

import {
  BOGOTA_DEPARTMENT,
  SECOP_CONTRACTS_URL,
  SECOP_MAX_RETRIES,
  SECOP_PAGE_SIZE,
  SECOP_REQUEST_TIMEOUT_MS,
  SECOP_RETRY_BASE_MS,
} from "@/lib/utils/constants";
import { orNull, parseSecopDate, parseSecopNumber } from "@/lib/utils/format";
import type { ContractRow, SecopRawContract } from "@/lib/types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Escapa comillas simples para una cláusula SoQL ($where). */
function soqlEscape(value: string): string {
  return value.replace(/'/g, "''");
}

interface FetchPageParams {
  limit?: number;
  offset?: number;
  /** ISO local (p.ej. "2026-08-01T00:00:00") para traer solo firmas posteriores. */
  signedAfter?: string;
}

/**
 * Descarga una página de contratos de Bogotá D.C. desde la SODA API,
 * con reintentos y backoff exponencial ante 503/errores transitorios.
 */
export async function fetchContractsPage({
  limit = SECOP_PAGE_SIZE,
  offset = 0,
  signedAfter,
}: FetchPageParams): Promise<SecopRawContract[]> {
  // fecha_de_firma IS NOT NULL: ~8% de los contratos de Bogotá no tienen fecha
  // de firma y Socrata los ordena PRIMERO en DESC. Excluirlos hace que el orden
  // por firma sea significativo y que el cursor incremental funcione. (Esos
  // contratos sin firma requieren un backfill dedicado; ver SETUP.md.)
  let where = `departamento='${soqlEscape(BOGOTA_DEPARTMENT)}' AND fecha_de_firma IS NOT NULL`;
  if (signedAfter) {
    where += ` AND fecha_de_firma > '${soqlEscape(signedAfter)}'`;
  }

  const params = new URLSearchParams({
    $where: where,
    $order: "fecha_de_firma DESC",
    $limit: String(limit),
    $offset: String(offset),
  });

  const appToken = process.env.SECOP_APP_TOKEN;
  const url = `${SECOP_CONTRACTS_URL}?${params.toString()}`;

  let lastError: unknown;
  for (let attempt = 0; attempt <= SECOP_MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      // Backoff exponencial: 0.8s, 1.6s, 3.2s, ...
      await sleep(SECOP_RETRY_BASE_MS * 2 ** (attempt - 1));
    }
    try {
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(),
        SECOP_REQUEST_TIMEOUT_MS,
      );
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          ...(appToken ? { "X-App-Token": appToken } : {}),
        },
        // El cron necesita datos frescos; nunca cachear.
        cache: "no-store",
      });
      clearTimeout(timer);

      // 503/429 son transitorios en esta API: reintentar.
      if (res.status === 503 || res.status === 429) {
        lastError = new Error(`SECOP API ${res.status} (transitorio)`);
        continue;
      }
      if (!res.ok) {
        throw new Error(`SECOP API respondió ${res.status}: ${await res.text()}`);
      }
      return (await res.json()) as SecopRawContract[];
    } catch (err) {
      lastError = err;
      // AbortError y errores de red también se reintentan.
    }
  }
  throw new Error(
    `SECOP API falló tras ${SECOP_MAX_RETRIES + 1} intentos: ${String(lastError)}`,
  );
}

/** Traduce un registro crudo de SECOP a una fila de la tabla `contracts`. */
export function mapSecopToContract(raw: SecopRawContract): ContractRow | null {
  // secop_id es obligatorio (clave única). Sin él, descartamos el registro.
  const secopId = orNull(raw.id_contrato);
  if (!secopId) return null;

  return {
    secop_id: secopId,
    contractor_name: orNull(raw.proveedor_adjudicado),
    contractor_id: orNull(raw.documento_proveedor),
    contractor_doc_type: orNull(raw.tipodocproveedor),
    entity_name: orNull(raw.nombre_entidad),
    entity_nit: orNull(raw.nit_entidad),
    contract_object:
      orNull(raw.objeto_del_contrato) ?? orNull(raw.descripcion_del_proceso),
    contract_value: parseSecopNumber(raw.valor_del_contrato),
    start_date: parseSecopDate(raw.fecha_de_inicio_del_contrato),
    end_date: parseSecopDate(raw.fecha_de_fin_del_contrato),
    signing_date: parseSecopDate(raw.fecha_de_firma),
    selection_method: orNull(raw.modalidad_de_contratacion),
    contract_type: orNull(raw.tipo_de_contrato),
    contract_status: orNull(raw.estado_contrato),
    secop_url: orNull(raw.urlproceso?.url),
    department: orNull(raw.departamento),
    city: orNull(raw.ciudad),
    entity_order: orNull(raw.orden),
    legal_rep_name: orNull(raw.nombre_representante_legal),
    legal_rep_id: orNull(raw.identificaci_n_representante_legal),
    legal_rep_address: orNull(raw.domicilio_representante_legal),
    raw_data: raw,
  };
}
