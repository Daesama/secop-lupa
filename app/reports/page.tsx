import Link from "next/link";
import { FileBarChart, ChevronRight } from "lucide-react";
import { getReports } from "@/lib/queries";
import { GenerateReportButton } from "@/components/report-actions";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const reports = await getReports();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-fg">
            Reportes
          </h1>
          <p className="mt-1 text-muted">
            Documentos de análisis listos para debate de control político.
          </p>
        </div>
        <GenerateReportButton />
      </div>

      <div className="mt-6 space-y-3">
        {reports.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center text-muted">
            Aún no hay reportes. Genera el primero con la IA.
          </p>
        ) : (
          reports.map((r) => (
            <Link
              key={r.id}
              href={`/reports/${r.id}`}
              className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 transition hover:border-primary/40"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <FileBarChart className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-fg">{r.title}</p>
                <p className="text-xs text-muted">
                  Período {r.period_start ?? "?"} a {r.period_end ?? "?"} ·
                  generado {new Date(r.created_at).toLocaleDateString("es-CO")}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted" />
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
