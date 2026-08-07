import { Bell, Flame, Eye, Coins, ArrowRight } from "lucide-react";
import {
  getAlertStats,
  getAlerts,
  getAlertsByEntity,
  getAlertsByType,
} from "@/lib/queries";
import { AlertCard, StatCard } from "@/components/ui";
import { EntityBars, TypeBars } from "@/components/charts";
import { ExecSummary } from "@/components/exec-summary";
import { formatCOP } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [stats, topAlerts, byEntity, byType] = await Promise.all([
    getAlertStats(),
    getAlerts({ limit: 8 }),
    getAlertsByEntity(7),
    getAlertsByType(),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* Héroe */}
      <section className="gradient-brand relative overflow-hidden rounded-3xl px-6 py-8 text-white shadow-hover sm:px-9 sm:py-10">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 right-24 h-52 w-52 rounded-full bg-white/10 blur-2xl" />
        <div className="relative">
          <p className="text-sm font-medium text-white/80">
            Contratación distrital · Bogotá
          </p>
          <h1 className="mt-1 max-w-2xl font-display text-3xl font-bold leading-tight text-balance sm:text-4xl">
            Detección de contratación sospechosa con inteligencia artificial
          </h1>
          <p className="mt-3 max-w-2xl text-white/85">
            Patrones detectados automáticamente en SECOP II, con evidencia
            verificable y rutas de acción. Cada alerta enlaza al contrato original.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a
              href="/alerts"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#1a365d] transition hover:bg-white/90"
            >
              Ver alertas <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="/contracts"
              className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Analizar un contrato
            </a>
          </div>
        </div>
      </section>

      <ExecSummary />

      {/* KPIs */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
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

      {/* Gráficas */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <EntityBars data={byEntity} />
        <TypeBars data={byType} />
      </div>

      {/* Alertas destacadas */}
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
        <p className="card-soft mt-4 rounded-2xl p-10 text-center text-muted">
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
