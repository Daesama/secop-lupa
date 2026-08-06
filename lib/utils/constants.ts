// Constantes de configuración del pipeline SECOP.

/** Dataset "SECOP II - Contratos Electrónicos" en datos.gov.co (SODA API). */
export const SECOP_CONTRACTS_URL =
  process.env.SECOP_BASE_URL ??
  "https://www.datos.gov.co/resource/jbjy-vk9h.json";

/**
 * Valor exacto del campo `departamento` para filtrar Bogotá D.C.
 * (confirmado contra el dataset real). Incluye todas las entidades
 * ubicadas en Bogotá, distritales y nacionales.
 */
export const BOGOTA_DEPARTMENT = "Distrito Capital de Bogotá";

/** Tamaño de página al paginar la API (máximo práctico de Socrata). */
export const SECOP_PAGE_SIZE = 1000;

/** Reintentos ante 503/errores transitorios de la API. */
export const SECOP_MAX_RETRIES = 4;
export const SECOP_RETRY_BASE_MS = 800;

/** Timeout por request a la API (ms). */
export const SECOP_REQUEST_TIMEOUT_MS = 45_000;
