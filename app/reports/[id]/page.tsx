import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { getReportById } from "@/lib/queries";
import { PrintButton } from "@/components/report-actions";
import { formatCOP } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  repeated_contractor: "Contratista repetido",
  inflated_amount: "Monto inflado",
  unrealistic_timeline: "Tiempo irreal",
  concentration: "Concentración de directa",
  fragmentation: "Fraccionamiento",
  network: "Red de contratistas",
};
const SEV_LABEL: Record<string, string> = {
  critical: "Crítica",
  suspicious: "Sospechosa",
  low: "Baja",
};

interface ReportContent {
  titulo: string;
  resumen_ejecutivo: string;
  hallazgos: { titulo: string; descripcion: string }[];
  conclusiones: string;
  periodo: { inicio: string | null; fin: string | null };
  stats: { total: number; critical: number; suspicious: number; totalAmount: number };
  alertas: {
    id: string;
    alert_type: string;
    severity: string;
    title: string;
    entity_name: string | null;
    contractor_name: string | null;
    total_amount: number | null;
  }[];
}

export default async function ReportDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const report = await getReportById(id);
  if (!report) notFound();

  let c: ReportContent;
  try {
    c = JSON.parse(report.content) as ReportContent;
  } catch {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between print:hidden">
        <Link
          href="/reports"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-fg"
        >
          <ArrowLeft className="h-4 w-4" /> Reportes
        </Link>
        <PrintButton />
      </div>

      {/* Documento */}
      <article className="mt-5 rounded-2xl border border-border bg-surface p-6 sm:p-10 print:border-0 print:p-0">
        {/* Encabezado institucional */}
        <header className="border-b border-border pb-5">
          <div className="flex items-center gap-2 text-primary">
            <ShieldCheck className="h-5 w-5" />
            <span className="text-sm font-semibold">
              Seguimiento SECOP II · Bogotá
            </span>
          </div>
          <h1 className="mt-3 font-display text-2xl font-bold leading-tight text-fg text-balance">
            {c.titulo}
          </h1>
          <p className="mt-2 text-sm text-muted">
            Período analizado: {c.periodo?.inicio ?? "?"} a {c.periodo?.fin ?? "?"} ·
            Generado el{" "}
            {new Date(report.created_at).toLocaleDateString("es-CO", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </header>

        {/* Cifras */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { l: "Alertas", v: String(c.stats.total) },
            { l: "Críticas", v: String(c.stats.critical) },
            { l: "Sospechosas", v: String(c.stats.suspicious) },
            { l: "Valor bajo alerta", v: formatCOP(c.stats.totalAmount) },
          ].map((s) => (
            <div key={s.l} className="rounded-xl border border-border bg-bg p-3">
              <div className="text-[11px] text-muted">{s.l}</div>
              <div className="mt-0.5 text-base font-bold tabular-nums text-fg">
                {s.v}
              </div>
            </div>
          ))}
        </div>

        {/* Resumen ejecutivo */}
        <section className="mt-7 break-inside-avoid">
          <h2 className="font-display text-lg font-semibold text-fg">
            Resumen ejecutivo
          </h2>
          <p className="mt-2 whitespace-pre-line leading-relaxed text-fg/90">
            {c.resumen_ejecutivo}
          </p>
        </section>

        {/* Hallazgos */}
        <section className="mt-7">
          <h2 className="font-display text-lg font-semibold text-fg">
            Hallazgos
          </h2>
          <div className="mt-3 space-y-4">
            {c.hallazgos.map((h, i) => (
              <div key={i} className="break-inside-avoid">
                <h3 className="font-semibold text-fg">{h.titulo}</h3>
                <p className="mt-1 whitespace-pre-line leading-relaxed text-muted">
                  {h.descripcion}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Tabla de alertas (datos reales) */}
        <section className="mt-7">
          <h2 className="font-display text-lg font-semibold text-fg">
            Alertas incluidas ({c.alertas.length})
          </h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase text-muted">
                  <th className="py-2 pr-3 font-medium">Tipo</th>
                  <th className="py-2 pr-3 font-medium">Entidad</th>
                  <th className="py-2 pr-3 font-medium">Descripción</th>
                  <th className="py-2 text-right font-medium">Valor</th>
                </tr>
              </thead>
              <tbody>
                {c.alertas.map((a) => (
                  <tr key={a.id} className="border-b border-border align-top">
                    <td className="py-2 pr-3">
                      <span className="text-fg">
                        {TYPE_LABEL[a.alert_type] ?? a.alert_type}
                      </span>
                      <div className="text-[11px] text-muted">
                        {SEV_LABEL[a.severity] ?? a.severity}
                      </div>
                    </td>
                    <td className="py-2 pr-3 text-muted">{a.entity_name ?? "—"}</td>
                    <td className="py-2 pr-3 text-fg">{a.title}</td>
                    <td className="py-2 text-right font-semibold tabular-nums text-fg">
                      {formatCOP(a.total_amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Conclusiones */}
        <section className="mt-7 break-inside-avoid">
          <h2 className="font-display text-lg font-semibold text-fg">
            Conclusiones y recomendaciones
          </h2>
          <p className="mt-2 whitespace-pre-line leading-relaxed text-fg/90">
            {c.conclusiones}
          </p>
        </section>

        <footer className="mt-8 border-t border-border pt-4 text-xs leading-relaxed text-muted">
          Reporte generado por análisis automatizado con IA a partir de datos
          públicos de SECOP II (datos.gov.co). Los patrones señalados ameritan
          verificación y no implican por sí mismos una irregularidad. Este
          documento es un insumo de control político, no una acusación.
        </footer>
      </article>
    </div>
  );
}
