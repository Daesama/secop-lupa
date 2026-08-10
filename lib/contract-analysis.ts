// Análisis on-demand de CUALQUIER contrato (esté o no en nuestra base / tenga o
// no alerta). Busca el contrato (base primero, SECOP en vivo si no está) y
// calcula un PERFIL FORENSE determinista: precio vs. su categoría, competencia,
// concentración entidad↔contratista, ritmo de ejecución, red de representante
// legal y posible fraccionamiento. La IA solo interpreta este perfil (aparte).

import { getServiceClient } from "@/lib/supabase";
import {
  SECOP_CONTRACTS_URL,
  BOGOTA_DEPARTMENT,
  SECOP_PAGE_SIZE,
  SECOP_REQUEST_TIMEOUT_MS,
} from "@/lib/utils/constants";
import { isDistrital, isDocumentId } from "@/lib/patterns/helpers";
import {
  parseSecopNumber,
  parseSecopDate,
  orNull,
  formatCOP,
} from "@/lib/utils/format";
import type { SecopRawContract } from "@/lib/types";

export interface ContractDetail {
  secop_id: string;
  contractor_name: string | null;
  contractor_id: string | null;
  entity_name: string | null;
  entity_nit: string | null;
  entity_order: string | null;
  contract_value: number | null;
  selection_method: string | null;
  contract_type: string | null;
  contract_status: string | null;
  signing_date: string | null;
  start_date: string | null;
  end_date: string | null;
  contract_object: string | null;
  secop_url: string | null;
  category_code: string | null;
  legal_rep_id: string | null;
  legal_rep_name: string | null;
  source: "base" | "secop";
}

/**
 * Perfil forense determinista. Todo sale de SQL/aritmética sobre datos reales de
 * SECOP II; la IA no calcula nada de esto. `null` significa "no calculable con
 * los datos disponibles" y debe reportarse como tal, nunca rellenarse.
 */
export interface ContractSignals {
  esDistrital: boolean;

  // --- Precio: comparación contra la misma categoría UNSPSC distrital ---
  categoria: string | null;
  muestraCategoria: number | null;
  muestraSuficiente: boolean; // n >= MIN_MUESTRA → la comparación es defendible
  muestraExacta: boolean; // false = recorte parcial (falta aplicar la migración 002)
  medianaCategoria: number | null;
  promedioCategoria: number | null;
  p90Categoria: number | null;
  maxCategoria: number | null;
  vecesSobreMediana: number | null;
  percentilValor: number | null; // 0-100: % de contratos de la categoría por debajo

  // --- Cobertura de la base (para explicar honestamente qué falta) ---
  coberturaDesde: string | null;
  coberturaHasta: string | null;

  // --- Contratista ---
  /** De dónde salió el historial: la base, SECOP en vivo, o por qué no hay. */
  fuenteContratista: "base" | "secop" | null;
  contratosDelContratista: number | null;
  montoDelContratista: number | null;
  entidadesDelContratista: number | null;
  directaDelContratista: number | null; // % de sus contratos por contratación directa
  primerContratoContratista: string | null;
  ultimoContratoContratista: string | null;

  // --- Relación entidad ↔ contratista ---
  contratosConEstaEntidad: number | null;
  montoConEstaEntidad: number | null;
  dependenciaDeLaEntidad: number | null; // % del monto del contratista que viene de esta entidad
  participacionEnLaEntidad: number | null; // % del monto de la entidad que se lleva el contratista
  puestoEnLaEntidad: number | null; // ranking por monto adjudicado
  totalContratistasEntidad: number | null;

  // --- Entidad ---
  contratosEntidad: number | null;
  montoEntidad: number | null;
  porcentajeDirectaEntidad: number | null;
  baseDirectaDistrito: number | null; // línea base para saber si ese % es alto

  // --- Ejecución ---
  diasDeEjecucion: number | null;
  copPorDia: number | null;
  medianaCopPorDiaCategoria: number | null;
  vecesSobreRitmoCategoria: number | null;

  // --- Red (representante legal compartido dentro de la misma entidad) ---
  representanteLegal: string | null;
  contratistasMismoRepresentante: number | null;

  // --- Posible fraccionamiento ---
  contratosVentana: number | null; // misma entidad+contratista, ±VENTANA_DIAS de la firma
  montoVentana: number | null;

  // --- Integridad del dato ---
  camposFaltantes: string[];
}

/** Umbrales de la plataforma (mismos que usan los detectores deterministas). */
export const UMBRALES = {
  MIN_MUESTRA: 20, // mediana confiable
  PRECIO_ATENCION: 8, // × la mediana de la categoría
  PRECIO_CRITICO: 15,
  DIRECTA_ALTA: 90, // % de contratación directa de la entidad
  DEPENDENCIA_ALTA: 70, // % del ingreso del contratista que viene de una entidad
  RED_MIN: 3, // contratistas distintos con el mismo representante legal
  VENTANA_DIAS: 45, // ventana de fraccionamiento
} as const;

const DB_SELECT =
  "secop_id,contractor_name,contractor_id,entity_name,entity_nit,entity_order," +
  "contract_value,selection_method,contract_type,contract_status,signing_date," +
  "start_date,end_date,contract_object,secop_url,legal_rep_id,legal_rep_name," +
  "category_code:raw_data->>codigo_de_categoria_principal";

const DIRECTA = "contratación directa";

function esDirecta(m: string | null | undefined): boolean {
  return (m ?? "").toLowerCase().startsWith(DIRECTA);
}

function median(sorted: number[]): number {
  const n = sorted.length;
  return n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
}

function quantile(sorted: number[], q: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
}

/** % de valores del arreglo ordenado que quedan por debajo de `v`. */
function percentileOf(sorted: number[], v: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] < v) lo = mid + 1;
    else hi = mid;
  }
  return (lo / sorted.length) * 100;
}

function daysBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const d = (Date.parse(b) - Date.parse(a)) / 86_400_000;
  return Number.isFinite(d) ? Math.round(d) : null;
}

function pct(part: number, whole: number): number | null {
  return whole > 0 ? (part / whole) * 100 : null;
}

const fmtPct = (v: number | null, d = 0) =>
  v == null ? "n/d" : `${v.toFixed(d)}%`;
const fmtNum = (v: number | null) => (v == null ? "n/d" : String(v));
const fmtX = (v: number | null) => (v == null ? "n/d" : `${v.toFixed(1)}×`);

/**
 * Brief estructurado (contrato + perfil forense) que se inyecta a la IA. Cada
 * cifra va con su denominador y su tamaño de muestra para que el modelo pueda
 * ser específico y, sobre todo, honesto cuando el dato no alcanza.
 */
export function contractContextText(
  c: ContractDetail,
  s: ContractSignals,
): string {
  const durTxt =
    s.diasDeEjecucion != null
      ? `${s.diasDeEjecucion} días` +
        (s.copPorDia != null ? ` · ${formatCOP(Math.round(s.copPorDia))}/día` : "")
      : "n/d";

  return `═══ FICHA DEL CONTRATO ═══
Id SECOP: ${c.secop_id}   (fuente: ${c.source === "base" ? "base distrital" : "SECOP II en vivo"})
Entidad: ${c.entity_name ?? "n/d"} — NIT ${c.entity_nit ?? "n/d"} — orden: ${c.entity_order ?? "n/d"}
Contratista: ${c.contractor_name ?? "n/d"} — doc ${c.contractor_id ?? "n/d"}
Representante legal: ${c.legal_rep_name ?? "n/d"} (${c.legal_rep_id ?? "n/d"})
Objeto: ${c.contract_object ?? "n/d"}
Valor: ${formatCOP(c.contract_value)}
Modalidad: ${c.selection_method ?? "n/d"} | Tipo: ${c.contract_type ?? "n/d"} | Estado: ${c.contract_status ?? "n/d"}
Firma: ${c.signing_date ?? "n/d"} | Ejecución: ${c.start_date ?? "n/d"} → ${c.end_date ?? "n/d"} (${durTxt})
Jurisdicción del Concejo de Bogotá: ${s.esDistrital ? "SÍ, entidad distrital" : "NO — entidad no distrital, fuera del control político del Concejo"}

═══ PERFIL FORENSE (calculado sobre datos reales, no estimado) ═══

[1] PRECIO vs. categoría UNSPSC ${s.categoria ?? "n/d"}
  Muestra comparable (contratos distritales de la misma categoría): ${fmtNum(s.muestraCategoria)} — ${s.muestraExacta ? "universo COMPLETO, agregado en base de datos" : "⚠ MUESTRA PARCIAL (recorte de una página, no el universo): trata mediana y percentil como indicativos, no como concluyentes"}${s.muestraCategoria != null && !s.muestraSuficiente ? ` ⚠ además está POR DEBAJO del mínimo de ${UMBRALES.MIN_MUESTRA} → la comparación de precio NO es concluyente` : ""}
  Mediana: ${formatCOP(s.medianaCategoria)} | Promedio: ${formatCOP(s.promedioCategoria)} | P90: ${formatCOP(s.p90Categoria)} | Máximo: ${formatCOP(s.maxCategoria)}
  Este contrato: ${fmtX(s.vecesSobreMediana)} la mediana | percentil ${s.percentilValor != null ? s.percentilValor.toFixed(1) : "n/d"} (supera a ese % de los contratos comparables)
  Referencia de la plataforma: ≥${UMBRALES.PRECIO_ATENCION}× mediana = atención; ≥${UMBRALES.PRECIO_CRITICO}× = crítico.

[2] CONTRATISTA — fuente: ${s.fuenteContratista === "base" ? "base distrital" : s.fuenteContratista === "secop" ? "SECOP II en vivo (el contrato es anterior a la ventana de la base)" : `SIN HISTORIAL. Causa: ${!isDocumentId(c.contractor_id) ? `el documento del contratista es "${c.contractor_id ?? "vacío"}", no un documento real — típico de consorcios y uniones temporales, que SECOP no identifica con NIT propio` : "no se hallaron contratos suyos ni en la base ni en SECOP en vivo"}. NO es un vacío del análisis: es un límite de la fuente, y así debes reportarlo.`}
  Contratos en el distrito: ${fmtNum(s.contratosDelContratista)} por ${formatCOP(s.montoDelContratista)}
  Entidades distintas que lo contratan: ${fmtNum(s.entidadesDelContratista)}
  Adjudicados por contratación directa: ${fmtPct(s.directaDelContratista)}
  Historial: ${s.primerContratoContratista ?? "n/d"} → ${s.ultimoContratoContratista ?? "n/d"}

[3] RELACIÓN ENTIDAD ↔ CONTRATISTA
  Contratos entre ambos: ${fmtNum(s.contratosConEstaEntidad)} por ${formatCOP(s.montoConEstaEntidad)}
  Dependencia del contratista respecto de esta entidad: ${fmtPct(s.dependenciaDeLaEntidad)} de todo su monto${s.dependenciaDeLaEntidad != null && s.dependenciaDeLaEntidad >= UMBRALES.DEPENDENCIA_ALTA ? ` ⚠ supera el ${UMBRALES.DEPENDENCIA_ALTA}%` : ""}
  Participación en el gasto de la entidad: ${fmtPct(s.participacionEnLaEntidad, 1)}
  Puesto entre los proveedores de la entidad: ${s.puestoEnLaEntidad != null ? `#${s.puestoEnLaEntidad} de ${fmtNum(s.totalContratistasEntidad)}` : "n/d"}

[4] ENTIDAD
  Contratos: ${fmtNum(s.contratosEntidad)} por ${formatCOP(s.montoEntidad)}
  Contratación directa: ${fmtPct(s.porcentajeDirectaEntidad)} — línea base del distrito: ${fmtPct(s.baseDirectaDistrito)}${s.porcentajeDirectaEntidad != null && s.baseDirectaDistrito != null ? ` (diferencia: ${(s.porcentajeDirectaEntidad - s.baseDirectaDistrito).toFixed(0)} pts)` : ""}
  Referencia: ≥${UMBRALES.DIRECTA_ALTA}% de directa = concentración que amerita revisión.

[5] RITMO DE EJECUCIÓN
  Plazo: ${fmtNum(s.diasDeEjecucion)} días | ${s.copPorDia != null ? formatCOP(Math.round(s.copPorDia)) + "/día" : "n/d"}
  Mediana de la categoría: ${s.medianaCopPorDiaCategoria != null ? formatCOP(Math.round(s.medianaCopPorDiaCategoria)) + "/día" : "n/d"} → este contrato ejecuta ${fmtX(s.vecesSobreRitmoCategoria)} ese ritmo

[6] RED DE REPRESENTANTE LEGAL
  ${!isDocumentId(c.legal_rep_id) ? `NO EVALUABLE. SECOP reporta el representante legal como "${c.legal_rep_id ?? "vacío"}" en lugar de un documento. Esto ocurre en ~75% de los contratos del distrito: es una falla de diligenciamiento de la fuente, no un dato que falte en este análisis. Repórtalo así — y como una omisión de transparencia atribuible a la entidad, no como indicio contra el contratista.` : `Contratistas DISTINTOS con el mismo representante legal contratando con esta entidad: ${fmtNum(s.contratistasMismoRepresentante)}${(s.contratistasMismoRepresentante ?? 0) >= UMBRALES.RED_MIN ? ` ⚠ ≥${UMBRALES.RED_MIN}, patrón de posible vinculación entre oferentes` : ""}`}

[7] POSIBLE FRACCIONAMIENTO
  Otros contratos entre esta entidad y este contratista firmados dentro de ±${UMBRALES.VENTANA_DIAS} días: ${fmtNum(s.contratosVentana)} por ${formatCOP(s.montoVentana)}

[8] INTEGRIDAD DEL DATO
  Campos ausentes en SECOP: ${s.camposFaltantes.length > 0 ? s.camposFaltantes.join(", ") : "ninguno relevante"}
  Cobertura de la base distrital: contratos firmados entre ${s.coberturaDesde ?? "?"} y ${s.coberturaHasta ?? "?"}. Fuera de esa ventana el historial se consulta en SECOP en vivo.

REGLA SOBRE LOS DATOS AUSENTES: cuando una dimensión no sea evaluable, NO la despaches con "no hay datos". Di qué dato falta, POR QUÉ falta (ventana de la base, campo mal diligenciado en SECOP, contratista sin documento propio) y qué habría que pedir para obtenerlo. Un límite explicado es información útil; un "n/d" no lo es.`;
}

function mapDbRow(d: Record<string, unknown>): ContractDetail {
  return {
    secop_id: (d.secop_id as string) ?? "",
    contractor_name: (d.contractor_name as string) ?? null,
    contractor_id: (d.contractor_id as string) ?? null,
    entity_name: (d.entity_name as string) ?? null,
    entity_nit: (d.entity_nit as string) ?? null,
    entity_order: (d.entity_order as string) ?? null,
    contract_value: (d.contract_value as number) ?? null,
    selection_method: (d.selection_method as string) ?? null,
    contract_type: (d.contract_type as string) ?? null,
    contract_status: (d.contract_status as string) ?? null,
    signing_date: (d.signing_date as string) ?? null,
    start_date: (d.start_date as string) ?? null,
    end_date: (d.end_date as string) ?? null,
    contract_object: (d.contract_object as string) ?? null,
    secop_url: (d.secop_url as string) ?? null,
    category_code: (d.category_code as string) ?? null,
    legal_rep_id: (d.legal_rep_id as string) ?? null,
    legal_rep_name: (d.legal_rep_name as string) ?? null,
    source: "base",
  };
}

/** Busca un contrato por su id de SECOP: primero en la base, luego en vivo. */
export async function lookupContract(
  secopId: string,
): Promise<ContractDetail | null> {
  const id = secopId.trim();
  if (!id) return null;
  const sb = getServiceClient();

  // 1) Por id de contrato (CO1.PCCNTR) exacto
  const exact = await sb
    .from("contracts")
    .select(DB_SELECT)
    .eq("secop_id", id)
    .maybeSingle();
  if (exact.data) return mapDbRow(exact.data as unknown as Record<string, unknown>);

  // 2) Por id de proceso (CO1.NTC) dentro de la url
  const byProcess = await sb
    .from("contracts")
    .select(DB_SELECT)
    .ilike("raw_data->urlproceso->>url", `%${id}%`)
    .limit(1)
    .maybeSingle();
  if (byProcess.data) return mapDbRow(byProcess.data as unknown as Record<string, unknown>);

  // 3) En vivo desde SECOP (SODA API) por id_contrato (solo si es un CO1.PCCNTR)
  if (!/pccntr/i.test(id)) return null;
  const url = `${SECOP_CONTRACTS_URL}?id_contrato=${encodeURIComponent(id)}&$limit=1`;
  // Reintentos ante 503/429 transitorios de SECOP (frecuentes bajo carga).
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 700 * attempt));
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (res.status === 503 || res.status === 429) continue;
      if (!res.ok) return null;
      const arr = (await res.json()) as SecopRawContract[];
      const raw = arr?.[0];
      if (!raw) return null;
      return {
      secop_id: id,
      contractor_name: orNull(raw.proveedor_adjudicado),
      contractor_id: orNull(raw.documento_proveedor),
      entity_name: orNull(raw.nombre_entidad),
      entity_nit: orNull(raw.nit_entidad),
      entity_order: orNull(raw.orden),
      contract_value: parseSecopNumber(raw.valor_del_contrato),
      selection_method: orNull(raw.modalidad_de_contratacion),
      contract_type: orNull(raw.tipo_de_contrato),
      contract_status: orNull(raw.estado_contrato),
      signing_date: parseSecopDate(raw.fecha_de_firma),
      start_date: parseSecopDate(raw.fecha_de_inicio_del_contrato),
      end_date: parseSecopDate(raw.fecha_de_fin_del_contrato),
      contract_object:
        orNull(raw.objeto_del_contrato) ?? orNull(raw.descripcion_del_proceso),
      secop_url: orNull(raw.urlproceso?.url),
      category_code: orNull(
        raw.codigo_de_categoria_principal as string | undefined,
      ),
      legal_rep_id: orNull(raw.identificaci_n_representante_legal),
      legal_rep_name: orNull(raw.nombre_representante_legal),
      source: "secop",
      };
    } catch {
      // reintentar
    }
  }
  return null;
}

const EMPTY: ContractSignals = {
  esDistrital: false,
  categoria: null,
  muestraCategoria: null,
  muestraSuficiente: false,
  muestraExacta: false,
  medianaCategoria: null,
  promedioCategoria: null,
  p90Categoria: null,
  maxCategoria: null,
  vecesSobreMediana: null,
  percentilValor: null,
  coberturaDesde: null,
  coberturaHasta: null,
  fuenteContratista: null,
  contratosDelContratista: null,
  montoDelContratista: null,
  entidadesDelContratista: null,
  directaDelContratista: null,
  primerContratoContratista: null,
  ultimoContratoContratista: null,
  contratosConEstaEntidad: null,
  montoConEstaEntidad: null,
  dependenciaDeLaEntidad: null,
  participacionEnLaEntidad: null,
  puestoEnLaEntidad: null,
  totalContratistasEntidad: null,
  contratosEntidad: null,
  montoEntidad: null,
  porcentajeDirectaEntidad: null,
  baseDirectaDistrito: null,
  diasDeEjecucion: null,
  copPorDia: null,
  medianaCopPorDiaCategoria: null,
  vecesSobreRitmoCategoria: null,
  representanteLegal: null,
  contratistasMismoRepresentante: null,
  contratosVentana: null,
  montoVentana: null,
  camposFaltantes: [],
};

/**
 * PostgREST corta cada respuesta en 1.000 filas ignorando `.limit()`, así que un
 * `.limit(5000)` devuelve en silencio un recorte arbitrario y corrompe cualquier
 * mediana o porcentaje calculado sobre él. Aquí se pagina por KEYSET (id > último)
 * hasta agotar el universo o llegar al tope, igual que `fetchAllContracts`.
 */
const PAGE = 1000;
const MAX_PAGES = 25; // cota de seguridad: 25.000 filas por consulta

async function fetchPaged<T extends { id: string }>(
  page: (afterId: string) => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<T[]> {
  const all: T[] = [];
  let lastId = "";
  for (let i = 0; i < MAX_PAGES; i++) {
    const { data } = await page(lastId);
    const rows = (data ?? []) as T[];
    if (rows.length === 0) break;
    all.push(...rows);
    lastId = rows[rows.length - 1].id;
    if (rows.length < PAGE) break;
  }
  return all;
}

interface CategoryRow {
  id: string;
  entity_order: string | null;
  entity_name: string | null;
  contract_value: number | null;
  start_date: string | null;
  end_date: string | null;
}

interface ContractorRow {
  id: string;
  entity_nit: string | null;
  contract_value: number | null;
  selection_method: string | null;
  signing_date: string | null;
}

interface EntityRow {
  id: string;
  secop_id: string;
  contractor_id: string | null;
  contractor_name: string | null;
  contract_value: number | null;
  selection_method: string | null;
  signing_date: string | null;
  legal_rep_id: string | null;
}

/**
 * Historial del contratista traído de SECOP II en vivo. La base solo guarda una
 * ventana reciente (~6 meses), así que para un contrato más antiguo el historial
 * en base sale vacío y todas las métricas de contratista quedarían en "n/d".
 * Aquí se recupera de la fuente, acotado a Bogotá y a entidades distritales.
 */
async function fetchContractorHistoryLive(
  doc: string,
): Promise<ContractorRow[]> {
  const params = new URLSearchParams({
    documento_proveedor: doc,
    departamento: BOGOTA_DEPARTMENT,
    $limit: String(SECOP_PAGE_SIZE),
    $select:
      "nit_entidad,nombre_entidad,orden,valor_del_contrato,modalidad_de_contratacion,fecha_de_firma",
  });
  try {
    const res = await fetch(`${SECOP_CONTRACTS_URL}?${params}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(SECOP_REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) return [];
    const raw = (await res.json()) as SecopRawContract[];
    return raw
      .filter((r) =>
        isDistrital({
          entity_order: orNull(r.orden),
          entity_name: orNull(r.nombre_entidad),
        }),
      )
      .map((r, i) => ({
        id: `live-${i}`,
        entity_nit: orNull(r.nit_entidad),
        contract_value: parseSecopNumber(r.valor_del_contrato),
        selection_method: orNull(r.modalidad_de_contratacion),
        signing_date: parseSecopDate(r.fecha_de_firma),
      }));
  } catch {
    return [];
  }
}

interface CategoryStats {
  n: number;
  mediana: number | null;
  promedio: number | null;
  p90: number | null;
  maximo: number | null;
  percentil: number | null;
  medianaCopDia: number | null;
  /** true = agregado en Postgres sobre el universo completo. */
  exacta: boolean;
}

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Estadísticas de la categoría UNSPSC. Vía RPC `contract_category_stats`
 * (migración 002) el cálculo es exacto sobre el universo completo. Si la
 * migración aún no está aplicada, cae a una muestra de una página y lo marca
 * como parcial para que ni la UI ni la IA la presenten como concluyente.
 */
async function categoryStats(
  sb: ReturnType<typeof getServiceClient>,
  cat: string | null,
  valor: number | null,
): Promise<CategoryStats | null> {
  if (!cat) return null;

  const rpc = await sb.rpc("contract_category_stats", {
    p_cat: cat,
    p_value: valor,
  });
  const row = (rpc.data as Record<string, unknown>[] | null)?.[0];
  if (!rpc.error && row) {
    return {
      n: num(row.n) ?? 0,
      mediana: num(row.mediana),
      promedio: num(row.promedio),
      p90: num(row.p90),
      maximo: num(row.maximo),
      percentil: num(row.percentil),
      medianaCopDia: num(row.mediana_cop_dia),
      exacta: true,
    };
  }

  // Respaldo: una sola página, sin ORDER BY (ordenar el filtro JSON sin índice
  // supera el statement timeout). Es una muestra, no el universo.
  const { data } = await sb
    .from("contracts")
    .select("id,entity_order,entity_name,contract_value,start_date,end_date")
    .eq("raw_data->>codigo_de_categoria_principal", cat)
    .not("contract_value", "is", null)
    .limit(PAGE);

  const grupo = ((data ?? []) as unknown as CategoryRow[]).filter(
    (r) => isDistrital(r) && Number(r.contract_value) > 0,
  );
  if (grupo.length === 0) return null;

  const valores = grupo.map((r) => Number(r.contract_value)).sort((a, b) => a - b);
  const ritmos = grupo
    .map((r) => {
      const d = daysBetween(r.start_date, r.end_date);
      return d && d > 0 ? Number(r.contract_value) / d : null;
    })
    .filter((v): v is number => v != null && v > 0)
    .sort((a, b) => a - b);

  return {
    n: valores.length,
    mediana: median(valores),
    promedio: valores.reduce((a, b) => a + b, 0) / valores.length,
    p90: quantile(valores, 0.9),
    maximo: valores[valores.length - 1],
    percentil: valor != null ? percentileOf(valores, valor) : null,
    medianaCopDia:
      ritmos.length >= UMBRALES.MIN_MUESTRA ? median(ritmos) : null,
    exacta: false,
  };
}

const CAMPOS_CLAVE: [keyof ContractDetail, string][] = [
  ["contract_value", "valor del contrato"],
  ["contract_object", "objeto"],
  ["category_code", "categoría UNSPSC"],
  ["contractor_id", "documento del contratista"],
  ["selection_method", "modalidad de selección"],
  ["signing_date", "fecha de firma"],
  ["start_date", "fecha de inicio"],
  ["end_date", "fecha de terminación"],
];

/**
 * Calcula el perfil forense determinista del contrato. Todas las consultas van
 * en paralelo: el detalle de contrato hace ~5 lecturas y el tiempo de pared es
 * el de la más lenta, no la suma.
 */
export async function analyzeContractSignals(
  c: ContractDetail,
): Promise<ContractSignals> {
  const sb = getServiceClient();
  const s: ContractSignals = {
    ...EMPTY,
    esDistrital: isDistrital(c),
    categoria: c.category_code,
    representanteLegal: c.legal_rep_name ?? c.legal_rep_id,
    camposFaltantes: CAMPOS_CLAVE.filter(([k]) => c[k] == null).map(
      ([, label]) => label,
    ),
  };
  const valor = c.contract_value && c.contract_value > 0 ? c.contract_value : null;

  /** Aplica el keyset a una consulta ya filtrada. */
  const keyset = (q: {
    order: (c: string, o: { ascending: boolean }) => {
      limit: (n: number) => { gt: (c: string, v: string) => unknown };
    };
  }, afterId: string) => {
    const base = q.order("id", { ascending: true }).limit(PAGE);
    return (afterId ? base.gt("id", afterId) : base) as PromiseLike<{
      data: unknown;
      error: unknown;
    }>;
  };

  const [
    categoria,
    enBase,
    deLaEntidad,
    baseTotal,
    baseDirecta,
    coberturaMin,
    coberturaMax,
  ] = await Promise.all([
      // Universo de comparación por categoría UNSPSC (agregado en Postgres)
      categoryStats(sb, c.category_code, valor),
      // Historial del contratista
      c.contractor_id
        ? fetchPaged<ContractorRow>((afterId) =>
            keyset(
              sb
                .from("contracts")
                .select("id,entity_nit,contract_value,selection_method,signing_date")
                .eq("contractor_id", c.contractor_id!),
              afterId,
            ),
          )
        : Promise.resolve([] as ContractorRow[]),
      // Universo de la entidad (competencia, ranking, red, fraccionamiento)
      c.entity_nit
        ? fetchPaged<EntityRow>((afterId) =>
            keyset(
              sb
                .from("contracts")
                .select(
                  "id,secop_id,contractor_id,contractor_name,contract_value,selection_method,signing_date,legal_rep_id",
                )
                .eq("entity_nit", c.entity_nit!),
              afterId,
            ),
          )
        : Promise.resolve([] as EntityRow[]),
      // Línea base distrital de contratación directa (aprox. por orden Territorial).
      // `head:true` devuelve solo el conteo, así que no le aplica el tope de filas.
      sb
        .from("contracts")
        .select("*", { count: "exact", head: true })
        .eq("entity_order", "Territorial"),
      sb
        .from("contracts")
        .select("*", { count: "exact", head: true })
        .eq("entity_order", "Territorial")
        .ilike("selection_method", `${DIRECTA}%`),
      // Ventana temporal que cubre la base: se declara en la UI y en el brief
      // para que un "sin datos" se lea como límite de cobertura, no como vacío.
      sb
        .from("contracts")
        .select("signing_date")
        .not("signing_date", "is", null)
        .order("signing_date", { ascending: true })
        .limit(1)
        .maybeSingle(),
      sb
        .from("contracts")
        .select("signing_date")
        .not("signing_date", "is", null)
        .order("signing_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  s.coberturaDesde =
    (coberturaMin.data as { signing_date?: string } | null)?.signing_date ?? null;
  s.coberturaHasta =
    (coberturaMax.data as { signing_date?: string } | null)?.signing_date ?? null;

  // ---------- [1] Precio y [5] ritmo, contra la categoría ----------
  if (categoria && categoria.n > 0) {
    s.muestraCategoria = categoria.n;
    s.muestraSuficiente = categoria.n >= UMBRALES.MIN_MUESTRA;
    s.muestraExacta = categoria.exacta;
    s.medianaCategoria = categoria.mediana;
    s.promedioCategoria = categoria.promedio;
    s.p90Categoria = categoria.p90;
    s.maxCategoria = categoria.maximo;
    s.percentilValor = categoria.percentil;
    s.medianaCopPorDiaCategoria = categoria.medianaCopDia;
    if (valor != null && categoria.mediana && categoria.mediana > 0) {
      s.vecesSobreMediana = valor / categoria.mediana;
    }
  }

  s.diasDeEjecucion = daysBetween(c.start_date, c.end_date);
  if (valor != null && s.diasDeEjecucion != null && s.diasDeEjecucion > 0) {
    s.copPorDia = valor / s.diasDeEjecucion;
    if (s.medianaCopPorDiaCategoria && s.medianaCopPorDiaCategoria > 0) {
      s.vecesSobreRitmoCategoria = s.copPorDia / s.medianaCopPorDiaCategoria;
    }
  }

  // ---------- [2] Contratista ----------
  // Si la base no cubre a este contratista (contrato anterior a la ventana),
  // se recupera su historial de SECOP en vivo antes de rendirse a un "n/d".
  let suyos = enBase;
  if (suyos.length > 0) {
    s.fuenteContratista = "base";
  } else if (isDocumentId(c.contractor_id)) {
    suyos = await fetchContractorHistoryLive(c.contractor_id);
    if (suyos.length > 0) s.fuenteContratista = "secop";
  }

  if (suyos.length > 0) {
    s.contratosDelContratista = suyos.length;
    s.montoDelContratista = suyos.reduce(
      (t, r) => t + (Number(r.contract_value) || 0),
      0,
    );
    s.entidadesDelContratista = new Set(
      suyos.map((r) => r.entity_nit).filter(Boolean),
    ).size;
    s.directaDelContratista = pct(
      suyos.filter((r) => esDirecta(r.selection_method)).length,
      suyos.length,
    );
    const fechas = suyos
      .map((r) => r.signing_date)
      .filter((d): d is string => !!d)
      .sort();
    s.primerContratoContratista = fechas[0] ?? null;
    s.ultimoContratoContratista = fechas[fechas.length - 1] ?? null;

    // [3] parte A: cuánto de su facturación depende de ESTA entidad
    if (c.entity_nit) {
      const conEsta = suyos.filter((r) => r.entity_nit === c.entity_nit);
      s.contratosConEstaEntidad = conEsta.length;
      s.montoConEstaEntidad = conEsta.reduce(
        (t, r) => t + (Number(r.contract_value) || 0),
        0,
      );
      s.dependenciaDeLaEntidad = pct(
        s.montoConEstaEntidad,
        s.montoDelContratista,
      );
    }
  }

  // ---------- [3] parte B, [4] entidad, [6] red, [7] fraccionamiento ----------
  const deEntidad = deLaEntidad;
  if (deEntidad.length > 0) {
    s.contratosEntidad = deEntidad.length;
    s.montoEntidad = deEntidad.reduce(
      (t, r) => t + (Number(r.contract_value) || 0),
      0,
    );
    s.porcentajeDirectaEntidad = pct(
      deEntidad.filter((r) => esDirecta(r.selection_method)).length,
      deEntidad.length,
    );

    // Ranking de proveedores de la entidad por monto adjudicado
    const porProveedor = new Map<string, number>();
    for (const r of deEntidad) {
      const k = r.contractor_id ?? r.contractor_name;
      if (!k) continue;
      porProveedor.set(k, (porProveedor.get(k) ?? 0) + (Number(r.contract_value) || 0));
    }
    s.totalContratistasEntidad = porProveedor.size;
    const clave = c.contractor_id ?? c.contractor_name;
    if (clave && porProveedor.has(clave)) {
      const orden = [...porProveedor.entries()].sort((a, b) => b[1] - a[1]);
      s.puestoEnLaEntidad = orden.findIndex(([k]) => k === clave) + 1;
      s.participacionEnLaEntidad = pct(
        porProveedor.get(clave) ?? 0,
        s.montoEntidad,
      );
    }

    // [6] Red: contratistas distintos que comparten representante legal con este,
    // excluyendo el caso natural (persona = su propio representante).
    if (isDocumentId(c.legal_rep_id) && c.legal_rep_id !== c.contractor_id) {
      s.contratistasMismoRepresentante = new Set(
        deEntidad
          .filter(
            (r) =>
              r.legal_rep_id === c.legal_rep_id &&
              r.contractor_id &&
              r.contractor_id !== r.legal_rep_id,
          )
          .map((r) => r.contractor_id),
      ).size;
    }

    // [7] Fraccionamiento: otros contratos con el mismo contratista en la ventana
    if (c.signing_date && c.contractor_id) {
      const ventana = deEntidad.filter((r) => {
        if (r.contractor_id !== c.contractor_id) return false;
        if (r.secop_id === c.secop_id) return false;
        const d = daysBetween(c.signing_date, r.signing_date);
        return d != null && Math.abs(d) <= UMBRALES.VENTANA_DIAS;
      });
      s.contratosVentana = ventana.length;
      s.montoVentana = ventana.reduce(
        (t, r) => t + (Number(r.contract_value) || 0),
        0,
      );
    }
  }

  // ---------- [4] línea base distrital ----------
  s.baseDirectaDistrito = pct(baseDirecta.count ?? 0, baseTotal.count ?? 0);

  return s;
}
