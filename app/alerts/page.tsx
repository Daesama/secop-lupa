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
    <main className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="text-2xl font-semibold text-[#1a365d]">Alertas</h1>

      <div className="mt-4 flex gap-2">
        {FILTERS.map((f) => {
          const active = (severity ?? "") === f.key;
          return (
            <a
              key={f.key}
              href={f.key ? `/alerts?severity=${f.key}` : "/alerts"}
              className={`rounded-full border px-3 py-1 text-sm ${
                active
                  ? "border-[#1a365d] bg-[#1a365d] text-white"
                  : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
              }`}
            >
              {f.label}
            </a>
          );
        })}
      </div>

      <p className="mt-4 text-sm text-gray-500">
        {alerts.length} alerta(s){severity ? ` · ${severity}` : ""}
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {alerts.map((a) => (
          <AlertCard key={a.id} alert={a} />
        ))}
      </div>
    </main>
  );
}
