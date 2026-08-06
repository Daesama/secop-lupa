// Componentes de presentación (server components) + mapas de etiquetas/estilos.

import Link from "next/link";
import { formatCOP } from "@/lib/utils/format";
import type { AlertRow } from "@/lib/queries";

export const SEVERITY_LABEL: Record<string, string> = {
  critical: "Crítica",
  suspicious: "Sospechosa",
  low: "Baja",
};

export const ALERT_TYPE_LABEL: Record<string, string> = {
  repeated_contractor: "Contratista repetido",
  inflated_amount: "Monto inflado",
  unrealistic_timeline: "Tiempo irreal",
  concentration: "Concentración de directa",
  fragmentation: "Fraccionamiento",
  network: "Red de contratistas",
};

// Paleta del brief: rojo crítico, amarillo sospechoso, verde bajo.
const SEVERITY_STYLE: Record<string, string> = {
  critical: "bg-red-50 text-red-700 border-red-200",
  suspicious: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const SEVERITY_BAR: Record<string, string> = {
  critical: "bg-red-500",
  suspicious: "bg-amber-500",
  low: "bg-emerald-500",
};

export function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${SEVERITY_STYLE[severity] ?? SEVERITY_STYLE.low}`}
    >
      {SEVERITY_LABEL[severity] ?? severity}
    </span>
  );
}

export function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-sm text-gray-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${accent ?? "text-[#1a365d]"}`}>
        {value}
      </div>
    </div>
  );
}

export function AlertCard({ alert }: { alert: AlertRow }) {
  return (
    <Link
      href={`/alerts/${alert.id}`}
      className="group block overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md"
    >
      <div className="flex">
        <div className={`w-1.5 shrink-0 ${SEVERITY_BAR[alert.severity]}`} />
        <div className="flex-1 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={alert.severity} />
            <span className="text-xs text-gray-500">
              {ALERT_TYPE_LABEL[alert.alert_type] ?? alert.alert_type}
            </span>
            {alert.total_amount != null && (
              <span className="ml-auto text-sm font-semibold text-[#1a365d]">
                {formatCOP(alert.total_amount)}
              </span>
            )}
          </div>
          <h3 className="mt-2 font-semibold text-gray-900 group-hover:text-[#1a365d]">
            {alert.title}
          </h3>
          <p className="mt-1 line-clamp-2 text-sm text-gray-600">
            {alert.description}
          </p>
        </div>
      </div>
    </Link>
  );
}
