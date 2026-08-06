import { getAlertStats, getAlerts } from "@/lib/queries";
import { AlertCard, StatCard } from "@/components/ui";
import { formatCOP } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [stats, topAlerts] = await Promise.all([
    getAlertStats(),
    getAlerts({ limit: 12 }),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="text-2xl font-semibold text-[#1a365d]">
        Alertas de contratación en Bogotá
      </h1>
      <p className="mt-1 text-gray-600">
        Patrones sospechosos detectados automáticamente en contratos de SECOP II.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Alertas activas" value={String(stats.total)} />
        <StatCard
          label="Críticas"
          value={String(stats.critical)}
          accent="text-red-600"
        />
        <StatCard
          label="Sospechosas"
          value={String(stats.suspicious)}
          accent="text-amber-600"
        />
        <StatCard
          label="Valor bajo alerta"
          value={formatCOP(stats.totalAmount)}
        />
      </div>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          Alertas más relevantes
        </h2>
        <a href="/alerts" className="text-sm text-[#1a365d] hover:underline">
          Ver todas →
        </a>
      </div>

      {topAlerts.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-gray-500">
          Aún no hay alertas. Ejecuta el análisis para generarlas.
        </p>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {topAlerts.map((a) => (
            <AlertCard key={a.id} alert={a} />
          ))}
        </div>
      )}
    </main>
  );
}
