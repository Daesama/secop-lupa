import { notFound } from "next/navigation";
import { getAlertById, getContractsByIds } from "@/lib/queries";
import { ALERT_TYPE_LABEL, SeverityBadge } from "@/components/ui";
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
    <main className="mx-auto max-w-4xl px-6 py-8">
      <a href="/alerts" className="text-sm text-[#1a365d] hover:underline">
        ← Volver a alertas
      </a>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <SeverityBadge severity={alert.severity} />
        <span className="text-sm text-gray-500">
          {ALERT_TYPE_LABEL[alert.alert_type] ?? alert.alert_type}
        </span>
        {alert.total_amount != null && (
          <span className="ml-auto text-lg font-semibold text-[#1a365d]">
            {formatCOP(alert.total_amount)}
          </span>
        )}
      </div>

      <h1 className="mt-2 text-2xl font-semibold text-gray-900">
        {alert.title}
      </h1>
      <p className="mt-3 text-gray-700">{alert.description}</p>

      {alert.ai_analysis && (
        <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Análisis
          </h2>
          <p className="mt-2 whitespace-pre-line text-gray-700">
            {alert.ai_analysis}
          </p>
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Contratos relacionados ({alert.related_contracts.length})
        </h2>
        <div className="mt-3 space-y-3">
          {contracts.map((c) => (
            <div
              key={c.id}
              className="rounded-xl border border-gray-200 bg-white p-4"
            >
              <div className="flex flex-wrap items-start gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900">
                    {c.contractor_name ?? "Contratista no especificado"}
                  </p>
                  <p className="text-sm text-gray-500">{c.entity_name}</p>
                </div>
                {c.contract_value != null && (
                  <span className="ml-auto text-sm font-semibold text-[#1a365d]">
                    {formatCOP(c.contract_value)}
                  </span>
                )}
              </div>
              {c.contract_object && (
                <p className="mt-2 line-clamp-2 text-sm text-gray-600">
                  {c.contract_object}
                </p>
              )}
              <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                <span>{c.selection_method}</span>
                {c.signing_date && <span>· firma {c.signing_date}</span>}
                {c.secop_url && (
                  <a
                    href={c.secop_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto rounded-md bg-[#1a365d] px-3 py-1 font-medium text-white hover:bg-[#22467a]"
                  >
                    Ver en SECOP II ↗
                  </a>
                )}
              </div>
            </div>
          ))}
          {alert.related_contracts.length > contracts.length && (
            <p className="text-xs text-gray-400">
              Mostrando {contracts.length} de {alert.related_contracts.length}{" "}
              contratos.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
