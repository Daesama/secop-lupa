import { Bell, Flame, Eye, Coins } from "lucide-react";
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
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header>
        <p className="text-sm font-medium text-primary">Contratación distrital · Bogotá</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-fg text-balance">
          Alertas de contratación sospechosa
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          Patrones detectados automáticamente con IA en contratos de SECOP II de
          entidades del Distrito. Cada alerta enlaza a los contratos originales.
        </p>
      </header>

      <div className="mt-7 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Alertas activas" value={String(stats.total)} icon={Bell} />
        <StatCard
          label="Críticas"
          value={String(stats.critical)}
          icon={Flame}
          accent="var(--critical)"
        />
        <StatCard
          label="Sospechosas"
          value={String(stats.suspicious)}
          icon={Eye}
          accent="var(--suspicious)"
        />
        <StatCard
          label="Valor bajo alerta"
          value={formatCOP(stats.totalAmount)}
          icon={Coins}
        />
      </div>

      <div className="mt-9 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-fg">
          Más relevantes
        </h2>
        <a
          href="/alerts"
          className="text-sm font-medium text-primary hover:underline"
        >
          Ver todas →
        </a>
      </div>

      {topAlerts.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-border bg-surface p-10 text-center text-muted">
          Aún no hay alertas. Ejecuta el análisis para generarlas.
        </p>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {topAlerts.map((a) => (
            <AlertCard key={a.id} alert={a} />
          ))}
        </div>
      )}
    </div>
  );
}
