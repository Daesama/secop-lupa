"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  LabelList,
  Tooltip,
} from "recharts";
import type { Count } from "@/lib/queries";

const TYPE_LABEL: Record<string, string> = {
  repeated_contractor: "Contratista repetido",
  inflated_amount: "Monto inflado",
  unrealistic_timeline: "Tiempo irreal",
  concentration: "Concentración directa",
  fragmentation: "Fraccionamiento",
  network: "Red de contratistas",
};

// Colores categóricos por tipo (identidad; el eje nombra cada barra).
const TYPE_COLOR: Record<string, string> = {
  inflated_amount: "#ef4444",
  concentration: "#f59e0b",
  network: "#8b5cf6",
  repeated_contractor: "#3b82f6",
  unrealistic_timeline: "#06b6d4",
  fragmentation: "#ec4899",
};

function truncate(s: string, n = 30) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card-soft rounded-2xl p-5">
      <h3 className="mb-3 text-sm font-semibold text-fg">{title}</h3>
      {children}
    </div>
  );
}

function Tip({ active, payload }: { active?: boolean; payload?: unknown[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0] as { payload: { label: string; value: number } };
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs shadow-lg">
      <div className="font-medium text-fg">{p.payload.label}</div>
      <div className="text-muted">{p.payload.value} alerta(s)</div>
    </div>
  );
}

export function EntityBars({ data }: { data: Count[] }) {
  return (
    <ChartCard title="Entidades con más alertas">
      <ResponsiveContainer width="100%" height={Math.max(180, data.length * 42)}>
        <BarChart
          layout="vertical"
          data={data}
          margin={{ left: 0, right: 40, top: 0, bottom: 0 }}
          barCategoryGap="28%"
        >
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="label"
            width={175}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--muted)", fontSize: 12 }}
            tickFormatter={(v: string) => truncate(v, 26)}
          />
          <Tooltip cursor={{ fill: "var(--surface-2)" }} content={<Tip />} />
          <Bar dataKey="value" fill="var(--primary)" radius={[0, 6, 6, 0]} barSize={16}>
            <LabelList
              dataKey="value"
              position="right"
              fill="var(--fg)"
              fontSize={12}
              fontWeight={700}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function TypeBars({ data }: { data: Count[] }) {
  const rows = data.map((d) => ({
    ...d,
    label: TYPE_LABEL[d.key ?? ""] ?? d.label,
    color: TYPE_COLOR[d.key ?? ""] ?? "#3b82f6",
  }));
  return (
    <ChartCard title="Alertas por tipo de patrón">
      <ResponsiveContainer width="100%" height={Math.max(180, rows.length * 42)}>
        <BarChart
          layout="vertical"
          data={rows}
          margin={{ left: 0, right: 40, top: 0, bottom: 0 }}
          barCategoryGap="28%"
        >
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="label"
            width={155}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--muted)", fontSize: 12 }}
          />
          <Tooltip cursor={{ fill: "var(--surface-2)" }} content={<Tip />} />
          <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={16}>
            {rows.map((r, i) => (
              <Cell key={i} fill={r.color} />
            ))}
            <LabelList
              dataKey="value"
              position="right"
              fill="var(--fg)"
              fontSize={12}
              fontWeight={700}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
