import { ArrowLeft, ExternalLink, Database, Globe } from "lucide-react";
import {
  lookupContract,
  analyzeContractSignals,
  UMBRALES,
} from "@/lib/contract-analysis";
import { ContractAssessment } from "@/components/contract-assessment";
import { RecommendedProcess } from "@/components/recommended-process";
import { AlertChat } from "@/components/alert-chat";
import { formatCOP } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-4">
      <span className="w-40 shrink-0 text-sm text-muted">{label}</span>
      <span className="text-sm text-fg">{value}</span>
    </div>
  );
}

export default async function ContractPage({
  params,
}: {
  params: Promise<{ secopId: string }>;
}) {
  const { secopId } = await params;
  const id = decodeURIComponent(secopId);
  const contract = await lookupContract(id);

  if (!contract) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <a href="/contracts" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
          <ArrowLeft className="h-4 w-4" /> Buscar otro
        </a>
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-surface p-10 text-center">
          <p className="font-medium text-fg">No se encontró el contrato</p>
          <p className="mt-1 text-sm text-muted">
            No hallamos “{id}” en la base ni en vivo. Puede que sea un proceso
            fuera de nuestro universo distrital, o un ID incompleto.
          </p>
          <p className="mt-3 text-sm text-muted">
            Prueba <a href="/contracts" className="text-primary hover:underline">buscar por nombre del contratista o entidad</a>,
            o usa el ID del contrato con la forma <code className="rounded bg-surface-2 px-1">CO1.PCCNTR.XXXXXXX</code>.
          </p>
        </div>
      </div>
    );
  }

  const signals = await analyzeContractSignals(contract);
  const { disponibles, faltantes } = buildMetrics(signals, contract);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <a href="/contracts" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> Analizar otro contrato
      </a>

      {/* Info del contrato */}
      <div className="mt-5 rounded-2xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-muted">
            {contract.source === "base" ? (
              <>
                <Database className="h-3.5 w-3.5" /> En la base
              </>
            ) : (
              <>
                <Globe className="h-3.5 w-3.5" /> En vivo de SECOP
              </>
            )}
          </span>
          {!signals.esDistrital && (
            <span className="rounded-full border border-suspicious-bd bg-suspicious-bg px-2.5 py-0.5 text-xs font-medium text-suspicious">
              Entidad no distrital
            </span>
          )}
          {contract.contract_value != null && (
            <span className="ml-auto text-lg font-bold tabular-nums text-fg">
              {formatCOP(contract.contract_value)}
            </span>
          )}
        </div>
        <h1 className="mt-2 font-display text-xl font-bold leading-tight text-fg text-balance">
          {contract.contract_object ?? contract.secop_id}
        </h1>
        <div className="mt-3 divide-y divide-border">
          <Row label="Id SECOP" value={contract.secop_id} />
          <Row label="Entidad" value={contract.entity_name ?? "—"} />
          <Row
            label="Contratista"
            value={`${contract.contractor_name ?? "—"}${contract.contractor_id ? ` (${contract.contractor_id})` : ""}`}
          />
          <Row label="Modalidad" value={contract.selection_method ?? "—"} />
          <Row
            label="Ejecución"
            value={`${contract.start_date ?? "?"} a ${contract.end_date ?? "?"}`}
          />
          <Row label="Estado" value={contract.contract_status ?? "—"} />
        </div>
        {contract.secop_url && (
          <a
            href={contract.secop_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90"
          >
            Ver en SECOP II <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {/* Señales deterministas. Solo se pinta la métrica que TIENE dato; las que
          no, se agrupan abajo con su causa. Una casilla en "n/d" no informa
          nada y hace ver la plataforma incompleta cuando el vacío es de SECOP. */}
      {disponibles.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {disponibles.map((m) => (
            <Signal
              key={m.label}
              label={m.label}
              value={m.value!}
              sub={m.sub!}
              alert={m.alert}
            />
          ))}
        </div>
      )}

      {/* Posible fraccionamiento: solo si de verdad hay contratos en la ventana. */}
      {(signals.contratosVentana ?? 0) > 0 && (
        <div className="mt-3">
          <span className="inline-block rounded-full border border-suspicious-bd bg-suspicious-bg px-3 py-1 text-xs font-medium text-suspicious">
            {signals.contratosVentana} contrato(s) más con el mismo contratista en
            ±{UMBRALES.VENTANA_DIAS} días · {formatCOP(signals.montoVentana)}
          </span>
        </div>
      )}

      {/* Lo que la fuente no permite calcular, dicho con su causa. */}
      {faltantes.length > 0 && (
        <div className="mt-3 rounded-xl border border-dashed border-border bg-surface/60 p-3.5">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            No calculable con los datos de SECOP ({faltantes.length})
          </h2>
          <ul className="mt-2 space-y-1.5">
            {faltantes.map((m) => (
              <li key={m.label} className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                <span className="shrink-0 text-xs font-medium text-fg/80">
                  {m.label}:
                </span>
                <span className="text-xs leading-relaxed text-muted">
                  {m.motivo}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {signals.coberturaDesde && signals.coberturaHasta && (
        <p className="mt-2.5 text-[11px] leading-relaxed text-muted">
          Base distrital: contratos firmados entre {signals.coberturaDesde} y{" "}
          {signals.coberturaHasta}. Fuera de esa ventana el historial del
          contratista se consulta en SECOP II en vivo.
        </p>
      )}

      <ContractAssessment secopId={contract.secop_id} />
      <RecommendedProcess secopId={contract.secop_id} />
      <AlertChat secopId={contract.secop_id} />
    </div>
  );
}

interface Metric {
  label: string;
  value?: string;
  sub?: string;
  alert?: boolean;
  /** Presente solo si la métrica no se pudo calcular: explica por qué. */
  motivo?: string;
}

/**
 * Decide, métrica por métrica, si hay dato o no — y cuando no lo hay, con qué
 * causa concreta. Las causas son límites reales de SECOP (campo mal
 * diligenciado, consorcio sin documento propio, ventana de la base), no fallas
 * del análisis, y por eso se enuncian en vez de mostrar un "n/d" mudo.
 */
function buildMetrics(
  s: Awaited<ReturnType<typeof analyzeContractSignals>>,
  c: Awaited<ReturnType<typeof lookupContract>>,
): { disponibles: Metric[]; faltantes: Metric[] } {
  const sinHistorial =
    !c?.contractor_id || /no definido|sin descripcion|^0$/i.test(c.contractor_id)
      ? "el contratista figura en SECOP sin documento propio (habitual en consorcios y uniones temporales), así que no hay historial que agregar"
      : "no se hallaron otros contratos suyos con entidades distritales, ni en la base ni consultando SECOP en vivo";

  const all: Metric[] = [
    s.vecesSobreMediana != null && s.medianaCategoria != null
      ? {
          label: "vs. mediana de categoría",
          value: `${s.vecesSobreMediana.toFixed(1)}×`,
          sub: `mediana ${formatCOP(s.medianaCategoria)} · n=${s.muestraCategoria}${s.muestraExacta ? "" : " (muestra parcial)"}`,
          alert:
            s.vecesSobreMediana >= UMBRALES.PRECIO_ATENCION && s.muestraSuficiente,
        }
      : {
          label: "vs. mediana de categoría",
          motivo: c?.category_code
            ? `la categoría ${c.category_code} no tiene contratos distritales comparables en la base`
            : "el contrato no trae código de categoría UNSPSC en SECOP, así que no hay universo contra el cual compararlo",
        },

    s.percentilValor != null
      ? {
          label: "Percentil del valor",
          value: `P${s.percentilValor.toFixed(1)}`,
          sub: `supera a ese % de los ${s.muestraCategoria} comparables`,
          alert: s.percentilValor >= 99,
        }
      : {
          label: "Percentil del valor",
          motivo:
            c?.contract_value == null
              ? "el contrato no reporta valor en SECOP"
              : "depende del universo de la categoría, que no está disponible",
        },

    s.porcentajeDirectaEntidad != null
      ? {
          label: "Directa de la entidad",
          value: `${s.porcentajeDirectaEntidad.toFixed(0)}%`,
          sub:
            s.baseDirectaDistrito != null
              ? `distrito: ${s.baseDirectaDistrito.toFixed(0)}% · ${s.contratosEntidad} contratos`
              : `de ${s.contratosEntidad} contratos`,
          alert: s.porcentajeDirectaEntidad >= UMBRALES.DIRECTA_ALTA,
        }
      : {
          label: "Directa de la entidad",
          motivo:
            "la entidad no tiene contratos en la ventana de la base distrital",
        },

    s.dependenciaDeLaEntidad != null
      ? {
          label: "Dependencia del contratista",
          value: `${s.dependenciaDeLaEntidad.toFixed(0)}%`,
          sub: `de sus ${s.contratosDelContratista} contratos${s.fuenteContratista === "secop" ? " (SECOP en vivo)" : ""}`,
          alert: s.dependenciaDeLaEntidad >= UMBRALES.DEPENDENCIA_ALTA,
        }
      : { label: "Dependencia del contratista", motivo: sinHistorial },

    s.puestoEnLaEntidad != null
      ? {
          label: "Puesto en la entidad",
          value: `#${s.puestoEnLaEntidad}`,
          sub:
            s.participacionEnLaEntidad != null
              ? `de ${s.totalContratistasEntidad} · ${s.participacionEnLaEntidad.toFixed(1)}% del gasto`
              : "por monto adjudicado",
          alert: s.puestoEnLaEntidad <= 3,
        }
      : {
          label: "Puesto en la entidad",
          motivo:
            "este contratista no aparece entre los proveedores de la entidad dentro de la ventana de la base",
        },

    s.vecesSobreRitmoCategoria != null && s.copPorDia != null
      ? {
          label: "Ritmo de ejecución",
          value: `${s.vecesSobreRitmoCategoria.toFixed(1)}×`,
          sub: `${formatCOP(Math.round(s.copPorDia))}/día · ${s.diasDeEjecucion} días`,
          alert: s.vecesSobreRitmoCategoria >= 5,
        }
      : {
          label: "Ritmo de ejecución",
          motivo:
            s.diasDeEjecucion == null
              ? "el contrato no reporta fechas de inicio y fin en SECOP (falta en ~18% de los registros)"
              : "no hay suficientes contratos de la categoría con plazo diligenciado para fijar un ritmo de referencia",
        },

    s.contratistasMismoRepresentante != null
      ? {
          label: "Red del representante legal",
          value: String(s.contratistasMismoRepresentante),
          sub: "contratistas comparten representante en esta entidad",
          alert: s.contratistasMismoRepresentante >= UMBRALES.RED_MIN,
        }
      : {
          label: "Red del representante legal",
          motivo:
            "SECOP reporta el representante legal como “Sin Descripción” en cerca del 75% de los contratos del distrito; sin documento no se puede cruzar. Es una omisión de la entidad al diligenciar, exigible por derecho de petición",
        },
  ];

  return {
    disponibles: all.filter((m) => m.value != null),
    faltantes: all.filter((m) => m.value == null),
  };
}

function Signal({
  label,
  value,
  sub,
  alert,
}: {
  label: string;
  value: string;
  sub: string;
  alert?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="text-[11px] text-muted">{label}</div>
      <div
        className="mt-0.5 text-lg font-bold tabular-nums"
        style={{ color: alert ? "var(--critical)" : "var(--fg)" }}
      >
        {value}
      </div>
      <div className="text-[11px] text-muted">{sub}</div>
    </div>
  );
}
