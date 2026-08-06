import { Scale, ExternalLink } from "lucide-react";
import { getComparisonUniverse } from "@/lib/queries";
import { formatCOP } from "@/lib/utils/format";

// Server component async: arma y muestra el universo de comparación de un
// contrato "monto inflado" directamente en la página (verificación automática).
export async function ComparisonUniverse({ contractId }: { contractId: string }) {
  const u = await getComparisonUniverse(contractId);
  if (!u) return null;

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary">
          <Scale className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-fg">
            Universo de comparación
          </h2>
          <p className="text-[11px] text-muted">
            Contratos distritales de la misma categoría ({u.categoria}) usados
            como referencia. Revisa si son comparables en alcance y duración.
          </p>
        </div>
      </div>

      <div className="px-5 py-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Contratos comparados" value={String(u.total)} />
          <Stat label="Promedio categoría" value={formatCOP(u.promedio)} />
          <Stat label="Mediana" value={formatCOP(u.mediana)} />
          <Stat
            label="Este contrato"
            value={`${u.ratio.toFixed(1)}× el promedio`}
            accent="var(--critical)"
          />
        </div>

        <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted">
          Contratos de referencia más altos
        </p>
        <div className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border">
          {u.contratos.map((c) => (
            <a
              key={c.id}
              href={c.secop_url ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-2.5 text-sm transition hover:bg-surface-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-fg">
                  {c.contractor_name ?? "—"}
                </p>
                <p className="truncate text-xs text-muted">
                  {c.contract_object ?? c.entity_name}
                </p>
              </div>
              <span className="shrink-0 tabular-nums font-semibold text-fg">
                {formatCOP(c.contract_value)}
              </span>
              {c.secop_url && (
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted" />
              )}
            </a>
          ))}
        </div>
        {u.total > u.contratos.length && (
          <p className="mt-2 text-xs text-muted">
            Mostrando los {u.contratos.length} de mayor valor de {u.total}{" "}
            contratos de la categoría.
          </p>
        )}
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-bg p-3">
      <div className="text-[11px] text-muted">{label}</div>
      <div
        className="mt-0.5 text-sm font-bold tabular-nums"
        style={{ color: accent ?? "var(--fg)" }}
      >
        {value}
      </div>
    </div>
  );
}
