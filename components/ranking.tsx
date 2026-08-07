import { TriangleAlert } from "lucide-react";
import { formatCOP } from "@/lib/utils/format";
import type { RankRow } from "@/lib/queries";

export function RankingList({
  title,
  subtitle,
  icon,
  rows,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  rows: RankRow[];
}) {
  const maxAlerts = Math.max(1, ...rows.map((r) => r.alerts));
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
          {icon}
        </span>
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-fg">
            {title}
          </h1>
          <p className="mt-1 text-muted">{subtitle}</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="card-soft mt-6 rounded-2xl p-10 text-center text-muted">
          Aún no hay datos. Ejecuta el análisis para generar alertas.
        </p>
      ) : (
        <ol className="mt-6 space-y-2">
          {rows.map((r, i) => (
            <li
              key={r.name}
              className="card-soft flex items-center gap-4 rounded-2xl p-4"
            >
              <span className="w-6 shrink-0 text-center font-display text-lg font-bold text-muted">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-fg">{r.name}</p>
                <div className="mt-1.5 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(r.alerts / maxAlerts) * 100}%` }}
                  />
                </div>
              </div>
              <div className="hidden text-right sm:block">
                <div className="text-sm font-semibold tabular-nums text-fg">
                  {r.alerts} alerta(s)
                </div>
                {r.critical > 0 && (
                  <div className="inline-flex items-center gap-1 text-xs text-critical">
                    <TriangleAlert className="h-3 w-3" /> {r.critical} crítica(s)
                  </div>
                )}
              </div>
              <div className="w-32 shrink-0 text-right text-sm font-bold tabular-nums text-fg">
                {formatCOP(r.amount)}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
