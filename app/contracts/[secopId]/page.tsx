import { ArrowLeft, ExternalLink, Database, Globe } from "lucide-react";
import { lookupContract, analyzeContractSignals } from "@/lib/contract-analysis";
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
            Verifica el ID ({id}). Debe tener la forma CO1.PCCNTR.XXXXXXX.
          </p>
        </div>
      </div>
    );
  }

  const signals = await analyzeContractSignals(contract);

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

      {/* Señales deterministas */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Signal
          label="vs. promedio de categoría"
          value={
            signals.vecesSobrePromedio
              ? `${signals.vecesSobrePromedio.toFixed(1)}×`
              : "n/d"
          }
          sub={
            signals.promedioCategoria
              ? `prom. ${formatCOP(signals.promedioCategoria)} · ${signals.contratosCategoria} contratos`
              : "sin categoría comparable"
          }
          alert={(signals.vecesSobrePromedio ?? 0) >= 3}
        />
        <Signal
          label="Contratos del contratista"
          value={String(signals.contratosDelContratista ?? "n/d")}
          sub="en el distrito"
          alert={(signals.contratosDelContratista ?? 0) > 5}
        />
        <Signal
          label="Directa de la entidad"
          value={
            signals.porcentajeDirectaEntidad != null
              ? `${signals.porcentajeDirectaEntidad.toFixed(0)}%`
              : "n/d"
          }
          sub={`de ${signals.contratosEntidad ?? "?"} contratos`}
          alert={(signals.porcentajeDirectaEntidad ?? 0) >= 90}
        />
      </div>

      <ContractAssessment secopId={contract.secop_id} />
      <RecommendedProcess secopId={contract.secop_id} />
      <AlertChat secopId={contract.secop_id} />
    </div>
  );
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
