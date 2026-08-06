import { getAlerts } from "@/lib/queries";
import { AlertCard } from "@/components/ui";

export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "", label: "Todas" },
  { key: "critical", label: "Críticas" },
  { key: "suspicious", label: "Sospechosas" },
];

export default async function AlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ severity?: string }>;
}) {
  const { severity } = await searchParams;
  const alerts = await getAlerts({ severity, limit: 100 });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl font-bold tracking-tight text-fg">
        Alertas
      </h1>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => {
          const active = (severity ?? "") === f.key;
          return (
            <a
              key={f.key}
              href={f.key ? `/alerts?severity=${f.key}` : "/alerts"}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                active
                  ? "border-primary bg-primary text-primary-fg"
                  : "border-border bg-surface text-muted hover:text-fg"
              }`}
            >
              {f.label}
            </a>
          );
        })}
        <span className="ml-auto text-sm text-muted tabular-nums">
          {alerts.length} alerta(s)
        </span>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {alerts.map((a) => (
          <AlertCard key={a.id} alert={a} />
        ))}
      </div>
    </div>
  );
}
