import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Sparkles } from "lucide-react";
import { getAlertById, getContractsByIds } from "@/lib/queries";
import { SeverityBadge, TypeChip } from "@/components/ui";
import { AlertChat } from "@/components/alert-chat";
import { RecommendedProcess } from "@/components/recommended-process";
import { ComparisonUniverse } from "@/components/comparison-universe";
import { formatCOP } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function AlertDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const alert = await getAlertById(id);
  if (!alert) notFound();

  const contracts = await getContractsByIds(alert.related_contracts);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <a
        href="/alerts"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a alertas
      </a>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <SeverityBadge severity={alert.severity} />
        <TypeChip type={alert.alert_type} />
        {alert.total_amount != null && (
          <span className="ml-auto text-xl font-bold tabular-nums text-fg">
            {formatCOP(alert.total_amount)}
          </span>
        )}
      </div>

      <h1 className="mt-3 font-display text-2xl font-bold leading-tight text-fg text-balance">
        {alert.title}
      </h1>
      <p className="mt-3 leading-relaxed text-fg/90">{alert.description}</p>

      {alert.ai_analysis && (
        <section className="mt-6 rounded-2xl border border-border bg-surface p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-fg">
            <Sparkles className="h-4 w-4 text-primary" /> Análisis
          </h2>
          <p className="mt-2.5 whitespace-pre-line leading-relaxed text-muted">
            {alert.ai_analysis}
          </p>
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Contratos relacionados ({alert.related_contracts.length})
        </h2>
        <p className="mt-1 text-xs text-muted">
          Haz clic en un contrato para verlo en SECOP II.
        </p>
        <div className="mt-3 space-y-3">
          {contracts.map((c) => {
            const inner = (
              <>
                <div className="flex flex-wrap items-start gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-fg">
                      {c.contractor_name ?? "Contratista no especificado"}
                    </p>
                    <p className="text-sm text-muted">{c.entity_name}</p>
                  </div>
                  {c.contract_value != null && (
                    <span className="ml-auto text-sm font-bold tabular-nums text-fg">
                      {formatCOP(c.contract_value)}
                    </span>
                  )}
                </div>
                {c.contract_object && (
                  <p className="mt-2 line-clamp-2 text-sm text-muted">
                    {c.contract_object}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                  <span>{c.selection_method}</span>
                  {c.signing_date && <span>· firma {c.signing_date}</span>}
                  {c.secop_url && (
                    <span className="ml-auto inline-flex items-center gap-1.5 font-medium text-primary">
                      Ver en SECOP II <ExternalLink className="h-3.5 w-3.5" />
                    </span>
                  )}
                </div>
              </>
            );
            return c.secop_url ? (
              <a
                key={c.id}
                href={c.secop_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-2xl border border-border bg-surface p-4 transition hover:border-primary/50 hover:shadow-[0_4px_20px_-8px_rgba(37,99,235,0.25)] focus-visible:outline-2 focus-visible:outline-primary"
              >
                {inner}
              </a>
            ) : (
              <div
                key={c.id}
                className="rounded-2xl border border-border bg-surface p-4"
              >
                {inner}
              </div>
            );
          })}
          {alert.related_contracts.length > contracts.length && (
            <p className="text-xs text-muted">
              Mostrando {contracts.length} de {alert.related_contracts.length}{" "}
              contratos.
            </p>
          )}
        </div>
      </section>

      {alert.alert_type === "inflated_amount" && alert.related_contracts[0] && (
        <ComparisonUniverse contractId={alert.related_contracts[0]} />
      )}

      <RecommendedProcess alertId={alert.id} />

      <AlertChat alertId={alert.id} />
    </div>
  );
}
