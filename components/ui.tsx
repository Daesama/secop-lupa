// Componentes de presentación (server components) + mapas de etiquetas/estilos.

import Link from "next/link";
import {
  Users,
  Repeat,
  TrendingUp,
  Network,
  Timer,
  Scissors,
  type LucideIcon,
} from "lucide-react";
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

// Color por categoría (dirección gov-tech). Cada tipo tiene su ícono y matiz.
const TYPE_META: Record<string, { icon: LucideIcon; color: string; bg: string }> = {
  repeated_contractor: { icon: Repeat, color: "#2563eb", bg: "#2563eb1a" },
  inflated_amount: { icon: TrendingUp, color: "#dc2626", bg: "#dc26261a" },
  unrealistic_timeline: { icon: Timer, color: "#0891b2", bg: "#0891b21a" },
  concentration: { icon: Users, color: "#d97706", bg: "#d977061a" },
  fragmentation: { icon: Scissors, color: "#db2777", bg: "#db27771a" },
  network: { icon: Network, color: "#7c3aed", bg: "#7c3aed1a" },
};

const SEVERITY_STRIPE: Record<string, string> = {
  critical: "bg-critical",
  suspicious: "bg-suspicious",
  low: "bg-low",
};

export function SeverityBadge({ severity }: { severity: string }) {
  const cls =
    severity === "critical"
      ? "bg-critical-bg text-critical border-critical-bd"
      : severity === "suspicious"
        ? "bg-suspicious-bg text-suspicious border-suspicious-bd"
        : "bg-low-bg text-low border-low-bd";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {SEVERITY_LABEL[severity] ?? severity}
    </span>
  );
}

export function TypeChip({ type }: { type: string }) {
  const meta = TYPE_META[type];
  const Icon = meta?.icon;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium"
      style={{ color: meta?.color, backgroundColor: meta?.bg }}
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {ALERT_TYPE_LABEL[type] ?? type}
    </span>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">{label}</span>
        {Icon && (
          <span
            className="grid h-8 w-8 place-items-center rounded-lg"
            style={{ color: accent ?? "var(--primary)", backgroundColor: "var(--surface-2)" }}
          >
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <div
        className="mt-2 text-2xl font-bold tabular-nums"
        style={{ color: accent ?? "var(--fg)" }}
      >
        {value}
      </div>
    </div>
  );
}

export function AlertCard({ alert }: { alert: AlertRow }) {
  return (
    <Link
      href={`/alerts/${alert.id}`}
      className="group flex overflow-hidden rounded-2xl border border-border bg-surface transition hover:border-primary/40 hover:shadow-[0_4px_24px_-8px_rgba(37,99,235,0.25)] focus-visible:outline-2 focus-visible:outline-primary"
    >
      <div className={`w-1.5 shrink-0 ${SEVERITY_STRIPE[alert.severity]}`} />
      <div className="flex-1 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={alert.severity} />
          <TypeChip type={alert.alert_type} />
          {alert.total_amount != null && (
            <span className="ml-auto text-sm font-bold tabular-nums text-fg">
              {formatCOP(alert.total_amount)}
            </span>
          )}
        </div>
        <h3 className="mt-2.5 font-display text-[15px] font-semibold leading-snug text-fg text-balance group-hover:text-primary">
          {alert.title}
        </h3>
        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted">
          {alert.description}
        </p>
      </div>
    </Link>
  );
}
