// Utilidades de formateo y parseo de datos de SECOP.

/**
 * Convierte un valor de SECOP (siempre string, p.ej. "8959088") a número.
 * Devuelve null si está vacío o no es parseable.
 */
export function parseSecopNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(String(value).trim());
  return Number.isFinite(n) ? n : null;
}

/**
 * Normaliza una fecha de SECOP ("2022-11-01T00:00:00.000") a formato
 * DATE de Postgres ("2022-11-01"). Devuelve null si no es válida.
 */
export function parseSecopDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const s = String(value).trim();
  const match = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

/** Devuelve un string no vacío o null. */
export function orNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

/** Formatea un monto en pesos colombianos (COP) para la UI. */
export function formatCOP(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}
